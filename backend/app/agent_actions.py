"""UI action definitions shared by command parsing, model tools and dispatch."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Arguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Navigation(Arguments):
    page: Literal["board", "edit", "admin"]


class BoardView(Arguments):
    view: Literal["board", "overview"]


class BoardFilter(Arguments):
    project: str | None = None
    advisor: str | None = None
    show_history: bool | None = None


class ProjectSelection(Arguments):
    project: str = Field(min_length=1, max_length=200)
    version: str | None = None


class GallerySelection(Arguments):
    index: int = Field(default=0, ge=0, description="媒体下标，从 0 开始")
    project: str | None = None


class GalleryStep(Arguments):
    delta: Literal[-1, 1]


class VideoControl(Arguments):
    action: Literal["play", "pause"]


class AdminTab(Arguments):
    tab: Literal["dashboard", "conversations", "knowledge", "settings"]


PAGE_ACTIONS = {
    "navigate_page": ("切换页面。要打开后台某个页签时，直接用 open_admin_tab。", Navigation),
    "set_board_view": ("切换数据总览或生命周期看板。", BoardView),
    "filter_board": ("只传需要修改的筛选字段，空字符串表示清除该筛选。", BoardFilter),
    "open_project": ("按项目名打开详情，省略版本时打开当前版本。", ProjectSelection),
    "close_drawer": ("关闭项目详情。", Arguments),
    "open_gallery": ("打开媒体灯箱，可指定项目和媒体下标。", GallerySelection),
    "step_gallery": ("灯箱翻页，-1 为上一项，1 为下一项。", GalleryStep),
    "close_gallery": ("关闭媒体灯箱。", Arguments),
    "open_admin_tab": ("进入管理后台并打开指定页签。", AdminTab),
    "control_video": ("播放或暂停当前展示的视频。", VideoControl),
}


def tool_definition(name: str, description: str, arguments: type[BaseModel]) -> dict:
    schema = arguments.model_json_schema()
    schema.pop("title", None)
    return {"type": "function", "function": {
        "name": name, "description": description, "parameters": schema,
    }}


def make_action(tool: str, args: dict) -> dict:
    definition = PAGE_ACTIONS.get(tool)
    if definition is None:
        raise ValueError("不支持的页面操作")
    _, model = definition
    return {"tool": tool, "args": model.model_validate(args).model_dump(exclude_none=True)}
