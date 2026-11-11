"""从 data/projects.json 灌入初始数据；已有数据时跳过。"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DATA_SEED
from .models import Project, ProjectStage, Screenshot, SourceFile, StageTemplate

DEFAULT_STAGES = ["需求分析", "方案设计", "开发实现", "测试验证", "部署上线", "运维迭代"]


def _file_name(path: str) -> str:
    return Path(path.replace("\\", "/")).name


def seed_if_empty(session: Session, seed_path: Path | None = None) -> bool:
    """返回是否执行了灌入。"""
    if session.scalar(select(Project).limit(1)) is not None:
        return False
    path = seed_path or DATA_SEED
    if not path.exists():
        return False

    payload = json.loads(path.read_text(encoding="utf-8"))
    meta = payload.get("meta", {})
    stages = meta.get("stageFramework") or DEFAULT_STAGES
    for seq, name in enumerate(stages, start=1):
        if session.scalar(select(StageTemplate).where(StageTemplate.seq == seq)) is None:
            session.add(StageTemplate(seq=seq, name=name))

    catalog = meta.get("screenshotCatalog", {})
    for order, item in enumerate(payload.get("projects", [])):
        project = Project(
            id=item["id"],
            name=item["name"],
            summary=item.get("summary", ""),
            content=item.get("content", ""),
            stage_label=item.get("stage", ""),
            stage_note=item.get("stageNote", ""),
            data_note=item.get("dataNote", ""),
            status=item.get("status"),
            progress=item.get("progress"),
            updated_at=item.get("updatedAt"),
            developers=item.get("developers") or [],
            advisor=item.get("advisor") or None,
            sort_order=order,
        )
        session.add(project)
        session.flush()

        for rel_path in item.get("sourceFiles", []):
            session.add(
                SourceFile(
                    project_id=project.id,
                    path=rel_path,
                    kind="docx" if str(rel_path).lower().endswith(".docx") else "other",
                )
            )
        for file_name in item.get("screenshots", []):
            base = _file_name(file_name)
            info = catalog.get(base, {})
            session.add(
                Screenshot(
                    project_id=project.id,
                    file_name=base,
                    caption=info.get("caption", ""),
                    note=info.get("note", ""),
                    width=info.get("width"),
                    height=info.get("height"),
                )
            )
        for seq, _name in enumerate(stages, start=1):
            session.add(
                ProjectStage(project_id=project.id, seq=seq, state="missing", note="文档未提供")
            )
    session.commit()
    return True
