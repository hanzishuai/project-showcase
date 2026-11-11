"""REST API：项目、阶段、统计与元信息。"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import DATA_SEED
from ..db import get_session
from ..models import Project, ProjectStage, Screenshot, SourceFile, StageTemplate
from ..schemas import (
    MaterialsOut,
    MetaOut,
    ProjectCreate,
    ProjectDetail,
    ProjectSummary,
    ProjectUpdate,
    ScreenshotOut,
    SourceFileOut,
    StageOut,
    StageUpdate,
    StatsOut,
)

router = APIRouter(prefix="/api", tags=["projects"])
MISSING = "—"


def _file_name(path: str) -> str:
    return Path(str(path).replace("\\", "/")).name


def _stage_names(session: Session) -> list[str]:
    rows = session.scalars(select(StageTemplate).order_by(StageTemplate.seq)).all()
    return [row.name for row in rows]


def _summary(project: Project) -> ProjectSummary:
    cover = project.screenshots[0].file_name if project.screenshots else None
    return ProjectSummary(
        id=project.id,
        name=project.name,
        summary=project.summary,
        stage_label=project.stage_label,
        stage_note=project.stage_note,
        status=project.status,
        progress=project.progress,
        updated_at=project.updated_at,
        docx_count=len([f for f in project.source_files if f.kind == "docx"]),
        docx_name=next(
            (_file_name(f.path) for f in project.source_files if f.kind == "docx"), None
        ),
        shot_count=len(project.screenshots),
        cover=cover,
        stage_done=len([s for s in project.stages if s.state == "done"]),
        developers=project.developers or [],
        advisor=project.advisor,
    )


def _detail(session: Session, project: Project) -> ProjectDetail:
    names = _stage_names(session)
    by_seq = {s.seq: s for s in project.stages}
    stages = [
        StageOut(
            seq=seq,
            name=names[seq - 1] if seq - 1 < len(names) else str(seq),
            state=by_seq[seq].state if seq in by_seq else "missing",
            note=by_seq[seq].note if seq in by_seq else "文档未提供",
        )
        for seq in range(1, len(names) + 1)
    ]
    base = _summary(project)
    return ProjectDetail(
        **base.model_dump(),
        content=project.content,
        data_note=project.data_note,
        source_files=[
            SourceFileOut(
                id=f.id, path=f.path, kind=f.kind, file_name=_file_name(f.path)
            )
            for f in project.source_files
        ],
        screenshots=[
            ScreenshotOut(
                id=s.id,
                file_name=s.file_name,
                caption=s.caption,
                note=s.note,
                width=s.width,
                height=s.height,
                url="/media/" + s.file_name,
            )
            for s in project.screenshots
        ],
        stages=stages,
    )


def _get_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return project


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "project-showcase-api"}


@router.get("/meta", response_model=MetaOut)
def read_meta(session: Session = Depends(get_session)) -> MetaOut:
    projects = session.scalars(select(Project)).all()
    docx = session.scalars(select(SourceFile).where(SourceFile.kind == "docx")).all()
    shots = session.scalars(select(Screenshot)).all()
    folders = len({(_file_name(f.path)) for f in docx}) or len(projects)
    return MetaOut(
        title="项目实践聚合平台",
        subtitle="三个已提交项目的内容摘要、阶段记录与资料完整性",
        source="data/projects.json",
        sourceNote="data/projects.json 是唯一数据源；页面禁止手写百分比，缺失值统一显示 —。",
        materials=MaterialsOut(
            projectFolders=folders, docx=len(docx), screenshots=len(shots)
        ),
        stageFramework=_stage_names(session),
        stageNote="六段框架来自项目组合看板调研；当前项目阶段只引用文档原话，项目到阶段的换算留空。",
        missingValue=MISSING,
    )


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(session: Session = Depends(get_session)) -> list[ProjectSummary]:
    rows = session.scalars(select(Project).order_by(Project.sort_order, Project.id)).all()
    return [_summary(p) for p in rows]


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def read_project(project_id: str, session: Session = Depends(get_session)) -> ProjectDetail:
    return _detail(session, _get_or_404(session, project_id))


@router.post("/projects", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> ProjectDetail:
    if session.get(Project, payload.id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="项目 id 已存在")
    project = Project(
        id=payload.id,
        name=payload.name,
        summary=payload.summary,
        content=payload.content,
        stage_label=payload.stage_label,
        stage_note=payload.stage_note,
        data_note=payload.data_note,
        status=payload.status,
        progress=payload.progress,
        developers=[developer.model_dump() for developer in payload.developers],
        advisor=payload.advisor,
        sort_order=session.query(Project).count(),
    )
    session.add(project)
    session.flush()
    for seq, _name in enumerate(_stage_names(session), start=1):
        session.add(
            ProjectStage(project_id=project.id, seq=seq, state="missing", note="文档未提供")
        )
    session.commit()
    session.refresh(project)
    return _detail(session, project)


@router.patch("/projects/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: str, payload: ProjectUpdate, session: Session = Depends(get_session)
) -> ProjectDetail:
    project = _get_or_404(session, project_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    session.commit()
    session.refresh(project)
    return _detail(session, project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, session: Session = Depends(get_session)) -> None:
    project = _get_or_404(session, project_id)
    session.delete(project)
    session.commit()


@router.put("/projects/{project_id}/stages/{seq}", response_model=ProjectDetail)
def update_stage(
    project_id: str,
    seq: int,
    payload: StageUpdate,
    session: Session = Depends(get_session),
) -> ProjectDetail:
    project = _get_or_404(session, project_id)
    if seq < 1 or seq > len(_stage_names(session)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="阶段序号越界")
    stage = session.scalar(
        select(ProjectStage).where(
            ProjectStage.project_id == project_id, ProjectStage.seq == seq
        )
    )
    if stage is None:
        stage = ProjectStage(project_id=project_id, seq=seq)
        session.add(stage)
    stage.state = payload.state
    stage.note = payload.note
    session.commit()
    session.refresh(project)
    return _detail(session, project)


@router.get("/stats", response_model=StatsOut)
def read_stats(session: Session = Depends(get_session)) -> StatsOut:
    projects = session.scalars(select(Project).order_by(Project.sort_order, Project.id)).all()
    stage_total = len(_stage_names(session))
    return StatsOut(
        total=len(projects),
        docx=len(session.scalars(select(SourceFile).where(SourceFile.kind == "docx")).all()),
        screenshots=len(session.scalars(select(Screenshot)).all()),
        developers=sum(len(p.developers or []) for p in projects),
        advisors=sum(1 for p in projects if p.advisor),
        stage_done=sum(len([s for s in p.stages if s.state == "done"]) for p in projects),
        stage_total=stage_total * len(projects),
        per_project=[_summary(p) for p in projects],
    )