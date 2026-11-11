"""ORM 模型：项目、源文件、截图、阶段模板与项目阶段记录。"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    stage_label: Mapped[str] = mapped_column(String(120), default="")
    stage_note: Mapped[str] = mapped_column(Text, default="")
    data_note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    developers: Mapped[list[dict]] = mapped_column(JSON, default=list)
    advisor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    source_files: Mapped[list["SourceFile"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="SourceFile.id"
    )
    screenshots: Mapped[list["Screenshot"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Screenshot.id"
    )
    stages: Mapped[list["ProjectStage"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectStage.id"
    )


class SourceFile(Base):
    __tablename__ = "source_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="docx")

    project: Mapped[Project] = relationship(back_populates="source_files")


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    caption: Mapped[str] = mapped_column(String(300), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    project: Mapped[Project] = relationship(back_populates="screenshots")


class StageTemplate(Base):
    __tablename__ = "stage_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    seq: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)


class ProjectStage(Base):
    __tablename__ = "project_stages"
    __table_args__ = (UniqueConstraint("project_id", "seq", name="uq_project_stage"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="missing")
    note: Mapped[str] = mapped_column(String(200), default="")

    project: Mapped[Project] = relationship(back_populates="stages")
