"""Handle unambiguous requests using application state and registered UI actions."""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from .agent_actions import make_action
from .agent_plan import ProjectDetailsPlan
from .board import read_board


@dataclass(frozen=True)
class DirectReply:
    text: str = ""
    action: dict | None = None
    plan: ProjectDetailsPlan | None = None


_VIEW_COMMANDS = {
    "切到数据总览": "overview",
    "打开数据总览": "overview",
    "切换到数据总览": "overview",
    "切回生命周期看板": "board",
    "切到生命周期看板": "board",
    "打开生命周期看板": "board",
}
_VIDEO_COMMANDS = {
    "播放视频": "play",
    "播放当前视频": "play",
    "播放这个视频": "play",
    "暂停视频": "pause",
    "暂停当前视频": "pause",
    "暂停这个视频": "pause",
}
_MEDIA_QUESTIONS = {
    "现在展示的是视频还是图片",
    "当前展示的是视频还是图片",
    "现在展示的是图片还是视频",
    "当前展示的是图片还是视频",
    "现在展示的是一个视频还是一个图片",
    "当前是图片还是视频",
    "当前是视频还是图片",
}
_PROJECT_DETAILS = re.compile(
    r"(?:请)?打开(?P<project>[^，,。！？?；;：:]+)[，,]\s*(?:并|顺便|再)?"
    r"(?:说说|介绍(?:一下)?|告诉我)(?:它的|这个项目的)?(?P<field>技术栈|指导老师)"
)
_OPEN = re.compile(r"打开([^，,。！？?；;：:]+)")
_INTRO = re.compile(r"(?:请)?介绍(?:一下)?(?P<target>[^，,。！？?；;：:]+)|(?P<owner>[^，,。！？?；;：:]+)的(?:项目)?简介是什么")


async def direct_reply(question: str, ui: dict | None) -> DirectReply | None:
    """Recognize explicit phrases before passing natural language to the model."""
    prompt = question.strip().rstrip("。！!？?").strip()
    state = ui or {}
    match = _PROJECT_DETAILS.fullmatch(prompt)
    if match:
        name = match.group("project").strip()
        if name in {"当前项目", "这个项目", "该项目"}:
            name = state.get("openProject") if state.get("page") == "board" else None
        if isinstance(name, str) and 0 < len(name) <= 200:
            return DirectReply(plan=ProjectDetailsPlan(
                project=name, field="stack" if match.group("field") == "技术栈" else "advisor",
            ))
    if state.get("page") == "board":
        if prompt in _VIEW_COMMANDS:
            return DirectReply(action=make_action("set_board_view", {"view": _VIEW_COMMANDS[prompt]}))
        if prompt in _VIDEO_COMMANDS and state.get("mediaType") == "video":
            return DirectReply(action=make_action("control_video", {"action": _VIDEO_COMMANDS[prompt]}))
        if prompt in _MEDIA_QUESTIONS and state.get("openProject"):
            media_type = state.get("mediaType")
            if media_type == "image":
                return DirectReply("当前展示的是图片。")
            if media_type == "video":
                status = "正在播放" if state.get("mediaPlaying") is True else "当前未播放"
                return DirectReply(f"当前展示的是视频，{status}。")
        opened = _OPEN.fullmatch(prompt)
        if opened:
            name = opened.group(1).strip()
            data, _ = await asyncio.to_thread(read_board)
            if any(isinstance(item, dict) and item.get("name") == name for item in data.get("projects", [])):
                return DirectReply(action=make_action("open_project", {"project": name}))

    match = _INTRO.fullmatch(prompt)
    if match:
        name = match.group("target") or match.group("owner")
        if name in {"当前项目", "这个项目", "该项目"}:
            name = state.get("openProject") if state.get("page") == "board" else None
        if not name:
            return None
        data, _ = await asyncio.to_thread(read_board)
        projects = [p for p in data.get("projects", []) if isinstance(p, dict) and p.get("name") == name]
        if len(projects) == 1:
            intro = projects[0].get("intro")
            if isinstance(intro, str) and 0 < len(intro.strip()) <= 600:
                return DirectReply(intro.strip())
    return None
