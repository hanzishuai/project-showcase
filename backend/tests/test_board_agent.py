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
