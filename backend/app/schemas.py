"""Pydantic 出入参模型。"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ScreenshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    caption: str = ""
    note: str = ""
    width: int | None = None
    height: int | None = None
    url: str = ""


class SourceFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    kind: str
    file_name: str = ""


class StageOut(BaseModel):
    seq: int
    name: str
    state: str
    note: str = ""


class DeveloperOut(BaseModel):
    """项目开发成员；姓名与分工均只来自人工录入。"""

    name: str = ""
    role: str = ""


class ProjectSummary(BaseModel):
    id: str
    name: str
    summary: str
    stage_label: str
    stage_note: str
    status: str | None = None
    progress: int | None = None
    updated_at: str | None = None
    docx_count: int = 0
    docx_name: str | None = None
    shot_count: int = 0
    cover: str | None = None
    stage_done: int = 0
    developers: list[DeveloperOut] = Field(default_factory=list)
    advisor: str | None = None


class ProjectDetail(ProjectSummary):
    content: str = ""
    data_note: str = ""
    source_files: list[SourceFileOut] = Field(default_factory=list)
    screenshots: list[ScreenshotOut] = Field(default_factory=list)
    stages: list[StageOut] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    summary: str = ""
    content: str = ""
    stage_label: str = ""
    stage_note: str = ""
    data_note: str = ""
    status: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    developers: list[DeveloperOut] = Field(default_factory=list)
    advisor: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    content: str | None = None
    stage_label: str | None = None
    stage_note: str | None = None
    data_note: str | None = None
    status: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    developers: list[DeveloperOut] | None = None
    advisor: str | None = None


class StageUpdate(BaseModel):
    state: str = Field(pattern="^(missing|active|done)$")
    note: str = ""


class MaterialsOut(BaseModel):
    projectFolders: int
    docx: int
    screenshots: int


class MetaOut(BaseModel):
    title: str
    subtitle: str
    source: str
    sourceNote: str
    materials: MaterialsOut
    stageFramework: list[str]
    stageNote: str
    missingValue: str


class StatsOut(BaseModel):
    total: int
    docx: int
    screenshots: int
    developers: int = 0
    advisors: int = 0
    stage_done: int
    stage_total: int
    per_project: list[ProjectSummary]