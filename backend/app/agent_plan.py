"""Resolve and format the supported project-detail execution plan."""
from typing import Literal

from pydantic import Field

from .agent_actions import Arguments, make_action
from .board import read_board


class ProjectDetailsPlan(Arguments):
    project: str = Field(min_length=1, max_length=200)
    field: Literal["stack", "advisor"]


def resolve_project_plan(plan: ProjectDetailsPlan) -> tuple[dict, str]:
    target = plan.project.strip()
    if not target:
        raise ValueError("请告诉我项目名称。")
    data, _ = read_board()
    projects = [item for item in data.get("projects", []) if isinstance(item, dict)]
    matches = [item for item in projects if item.get("name") == target]
    if not matches:
        matches = [item for item in projects if target.casefold() in str(item.get("name", "")).casefold()]
    if not matches:
        raise ValueError("看板里未找到这个项目，请核对项目名称。")
    if len(matches) > 1:
        raise ValueError("找到多个名称相近的项目，请提供完整项目名称。")

    project = matches[0]
    if plan.field == "advisor":
        advisor = project.get("owner")
        fact = f"指导老师是{advisor}。" if advisor and advisor != "—" else "看板尚未记录指导老师。"
    else:
        stack = project.get("stack")
        technologies = "、".join(item.strip() for item in stack if isinstance(item, str) and item.strip()) if isinstance(stack, list) else ""
        fact = f"技术栈是{technologies}。" if technologies else "看板尚未记录技术栈。"
    return make_action("open_project", {"project": project["name"]}), fact
