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
