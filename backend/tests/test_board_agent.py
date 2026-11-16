import json

from app import agent, main
from app.db import SessionLocal
from app.models import KanbanBoard


def test_shared_board_revision_and_permissions(client, monkeypatch):
    with SessionLocal() as db:
        db.query(KanbanBoard).delete()
        db.commit()
    monkeypatch.setattr(main, "ADMIN_TOKEN", "board-test")
    initial = client.get("/api/board").json()
    assert initial["revision"] == 0
    data = {"stages": [{"name": "开发", "color": "#123456"}], "projects": [{"name": "示例", "intro": "最新简介", "owner": "老师", "team": "成员", "stack": [], "images": [], "videos": [], "versions": [{"number": "v1.0", "stage": 0, "note": "完成接口"}]}]}
    assert client.put("/api/board", json={"data": data, "revision": 0}).status_code == 401
    headers = {"X-Admin-Token": "board-test"}
    assert client.put("/api/board", json={"data": data, "revision": 0}, headers=headers).json()["revision"] == 1
    assert client.put("/api/board", json={"data": data, "revision": 0}, headers=headers).status_code == 409
    assert client.get("/api/board").json()["data"] == data
    result = json.loads(agent._query_board("示例"))
    assert result["projects"][0]["intro"] == "最新简介"
    assert result["projects"][0]["versions"][0]["stage_name"] == "开发"


def test_agent_queries_before_answer(client, monkeypatch):
    seen = []
    async def stream(messages):
        seen.append(list(messages))
        if len(seen) == 1:
            yield "tool_calls", {0: {"id": "call1", "name": "query_board", "arguments": "{\"project\":\"示例\"}"}}
        else:
            yield "token", "示例项目的简介是最新简介。"
            yield "tool_calls", {}
    async def log_turn(**kwargs):
        pass
    monkeypatch.setattr(agent, "_stream_llm", stream)
    monkeypatch.setattr(agent.qa_log, "log_turn", log_turn)
    monkeypatch.setattr(agent, "_needs_retrieval", lambda _: False)
    response = client.post("/api/v1/agent/ask", json={"question": "介绍示例项目", "ui": {"page": "board"}})
    assert response.status_code == 200
    assert "最新简介" in response.text
    assert len(seen) == 2
    assert seen[1][-1]["role"] == "tool"
    assert "最新简介" in seen[1][-1]["content"]


def test_query_filters_and_counts(monkeypatch):
    data = {"stages": [{"name": "开发"}, {"name": "上线"}], "projects": [
        {"name": "甲", "owner": "王老师", "versions": [{"number": "v1.0", "stage": 0}, {"number": "v2.0", "stage": 1}]},
        {"name": "乙", "owner": "王老师", "versions": [{"number": "v1.0", "stage": 0}]},
        {"name": "丙", "owner": "李老师", "versions": [{"number": "v1.0", "stage": 0}]}]}
    monkeypatch.setattr(agent, "read_board", lambda: (data, 1))
    result = json.loads(agent._query_board(advisor="王", stage="开发"))
    assert [p["name"] for p in result["projects"]] == ["乙"]
    assert result["current_stage_counts"] == {"开发": 1}
    result = json.loads(agent._query_board(projects=["甲", "丙"]))
    assert result["total"] == 2


def test_change_requires_auth_and_revision(client, monkeypatch):
    with SessionLocal() as db:
        db.query(KanbanBoard).delete()
        db.commit()
    monkeypatch.setattr(main, "ADMIN_TOKEN", "board-test")
    headers = {"X-Admin-Token": "board-test"}
    data = {"stages": [{"name": "开发", "color": "#123456"}], "projects": [{"name": "示例", "intro": "旧简介", "versions": []}]}
    client.put("/api/board", json={"data": data, "revision": 0}, headers=headers)
    change = {"project": "示例", "kind": "intro", "intro": "新简介", "revision": 1}
    assert client.post("/api/board/change", json=change).status_code == 401
    assert client.get("/api/board").json()["data"]["projects"][0]["intro"] == "旧简介"
    assert client.post("/api/board/change", json=change, headers=headers).status_code == 200
    assert client.post("/api/board/change", json=change, headers=headers).status_code == 409
    assert client.get("/api/board").json()["data"]["projects"][0]["intro"] == "新简介"
    version = {"project": "示例", "kind": "add_version", "revision": 2, "version": {"number": "v1.0", "stage": 0}}
    assert client.post("/api/board/change", json=version, headers=headers).status_code == 200
    version["revision"] = 3
    assert client.post("/api/board/change", json=version, headers=headers).status_code == 409


def test_agent_receives_actual_action_failure(monkeypatch):
    import asyncio
    seen = []
    async def stream(messages):
        seen.append(list(messages))
        if len(seen) == 1:
            yield "tool_calls", {0: {"id": "call1", "name": "open_project", "arguments": json.dumps({"project": "示例"})}}
        else:
            yield "token", "没有打开项目。"
            yield "tool_calls", {}
    async def log_turn(**kwargs): pass
    monkeypatch.setattr(agent, "_stream_llm", stream)
    monkeypatch.setattr(agent.qa_log, "log_turn", log_turn)
    monkeypatch.setattr(agent, "_needs_retrieval", lambda _: False)
    async def run():
        response = await agent.agent_ask(agent.AgentAskRequest(question="打开示例", ui={"page": "board"}))
        it = response.body_iterator
        meta = await anext(it)
        event = await anext(it)
        assert "event: action" in event
        action = json.loads(event.split("data: ", 1)[1])
        await agent.action_result(agent.ActionResult(action_id=action["action_id"], ok=False, message="项目不存在"))
        frames = []
        async for frame in it: frames.append(frame)
        assert "没有打开项目" in ''.join(frames)
        assert json.loads(seen[1][-1]["content"])["message"] == "项目不存在"
    asyncio.run(run())
