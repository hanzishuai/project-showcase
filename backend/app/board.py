"""Shared board snapshot used by the UI and agent."""
from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import update
from .config import REPO_ROOT
from .db import SessionLocal
from .models import KanbanBoard

router = APIRouter(prefix="/api/board", tags=["board"])

class BoardWrite(BaseModel):
    data: dict
    revision: int = Field(ge=0)

def read_board() -> tuple[dict, int]:
    with SessionLocal() as db:
        row = db.get(KanbanBoard, 1)
        if row:
            return row.data, row.revision
    return json.loads((REPO_ROOT / "data" / "kanban-board.json").read_text(encoding="utf-8")), 0

@router.get("")
def get_board():
    data, revision = read_board()
    return {"data": data, "revision": revision}

@router.put("")
def put_board(payload: BoardWrite):
    data = payload.data
    if not isinstance(data.get("stages"), list) or not data["stages"] or not isinstance(data.get("projects"), list):
        raise HTTPException(422, "无效的看板数据")
    with SessionLocal() as db:
        if payload.revision == 0:
            if db.get(KanbanBoard, 1):
                raise HTTPException(409, "看板已被更新，请刷新后重试")
            db.add(KanbanBoard(id=1, data=data, revision=1))
            try:
                db.commit()
            except Exception:
                db.rollback()
                raise HTTPException(409, "看板已被更新，请刷新后重试")
            return {"revision": 1}
        result = db.execute(update(KanbanBoard).where(KanbanBoard.id == 1, KanbanBoard.revision == payload.revision).values(data=data, revision=payload.revision + 1))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "看板已被更新，请刷新后重试")
        db.commit()
        return {"revision": payload.revision + 1}


class BoardChange(BaseModel):
    revision: int = Field(ge=0)
    project: str = Field(min_length=1, max_length=200)
    kind: str
    intro: str | None = Field(default=None, max_length=10000)
    version: dict | None = None


def prepare_change(data: dict, change: BoardChange) -> dict:
    import copy
    data = copy.deepcopy(data)
    matches = [p for p in data.get("projects", []) if p.get("name") == change.project]
    if len(matches) != 1:
        raise HTTPException(400, "项目不存在或名称不唯一")
    project = matches[0]
    if change.kind == "intro":
        if change.intro is None or not change.intro.strip():
            raise HTTPException(400, "项目简介不能为空")
        before = project.get("intro") or ""
        after = change.intro.strip()
        project["intro"] = after
        return {"data": data, "label": "修改项目简介", "before": before, "after": after}
    if change.kind == "add_version":
        v = change.version or {}
        number = str(v.get("number") or "").strip()
        stage = v.get("stage")
        if not number or len(number) > 40:
            raise HTTPException(400, "版本号不能为空")
        if any(x.get("number") == number for x in project.get("versions", [])):
            raise HTTPException(409, "版本号已存在")
        if isinstance(stage, bool) or not isinstance(stage, int) or not 0 <= stage < len(data["stages"]):
            raise HTTPException(400, "版本阶段无效")
        version = {"number": number, "stage": stage, "days": 0, "start": str(v.get("start") or "—")[:40], "delivery": str(v.get("delivery") or "")[:40], "note": str(v.get("note") or "")[:2000]}
        project.setdefault("versions", []).append(version)
        return {"data": data, "label": "新增项目版本", "before": "无", "after": {**version, "stage_name": data["stages"][stage].get("name", "")}}
    raise HTTPException(400, "不支持的修改类型")


@router.post("/change")
def apply_board_change(change: BoardChange):
    data, revision = read_board()
    if revision != change.revision:
        raise HTTPException(409, "数据已变化，请重新发起修改")
    prepared = prepare_change(data, change)
    result = put_board(BoardWrite(data=prepared["data"], revision=revision))
    return {"ok": True, **result, "message": prepared["label"] + "成功"}
