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
        response = await agent.agent_ask(agent.AgentAskRequest(question="请打开一下示例", ui={"page": "board"}))
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


def test_agent_media_context_and_video_control():
    text = agent._ui_context({"page": "board", "openProject": "示例", "slideIndex": 1, "mediaType": "video", "mediaPlaying": False})
    assert "视频" in text and "暂停" in text
    assert "control_video" in agent.ACTION_TOOLS


def test_agent_still_answers_when_retrieval_fails(client, monkeypatch):
    async def failed_search(*args, **kwargs): raise RuntimeError("temporary retrieval failure")
    async def stream(messages):
        yield "token", "我可以帮你查看项目。"
        yield "tool_calls", {}
    async def log_turn(**kwargs): pass
    monkeypatch.setattr(agent.retrieval, "search", failed_search)
    monkeypatch.setattr(agent, "_stream_llm", stream)
    monkeypatch.setattr(agent.qa_log, "log_turn", log_turn)
    monkeypatch.setattr(agent, "_needs_retrieval", lambda _: True)
    response = client.post("/api/v1/agent/ask", json={"question": "有哪些项目？"})
    assert "我可以帮你查看项目" in response.text
    assert "event: done" in response.text


def test_simple_page_command_uses_actual_result_without_model(monkeypatch):
    import asyncio

    async def unexpected_model(*args):
        raise AssertionError("simple command called the model")
        yield

    async def run():
        request = agent.AgentAskRequest(question="切到数据总览", ui={"page": "board"})
        result = await agent.agent_ask(request)
        frames = result.body_iterator
        await anext(frames)
        action = json.loads((await anext(frames)).split("data: ", 1)[1])
        assert action["tool"] == "set_board_view"
        await agent.action_result(agent.ActionResult(
            action_id=action["action_id"], ok=False, message="页面未切换",
        ))
        output = "".join([event async for event in frames])
        assert "页面未切换" in output
        assert '"model_calls": 0' in output

    monkeypatch.setattr(agent, "_stream_llm", unexpected_model)
    asyncio.run(run())


def test_direct_project_intro_uses_server_snapshot(client, monkeypatch):
    from app import agent_direct

    monkeypatch.setattr(agent_direct, "read_board", lambda: ({
        "projects": [{"name": "样例项目", "intro": "服务器上的最新简介。"}],
    }, 1))
    response = client.post("/api/v1/agent/ask", json={
        "question": "介绍当前项目",
        "ui": {"page": "board", "openProject": "样例项目", "intro": "浏览器旧简介"},
    })
    assert "服务器上的最新简介" in response.text
    assert '"model_calls": 0' in response.text


def test_compound_request_is_not_handled_as_simple_navigation():
    import asyncio

    assert asyncio.run(agent.direct_reply("切到数据总览，顺便说有多少项目", {"page": "board"})) is None



def test_project_details_plan_waits_for_actual_result_without_replanning(monkeypatch):
    import asyncio

    from app import agent_plan

    monkeypatch.setattr(agent_plan, "read_board", lambda: ({
        "projects": [{"name": "样例项目", "stack": ["Vue 3", "FastAPI"]}],
    }, 1))
    calls = 0

    async def stream(messages):
        nonlocal calls
        calls += 1
        assert calls == 1
        yield "tool_calls", {0: {
            "id": "plan-1", "name": "open_project_with_details",
            "arguments": json.dumps({"project": "样例项目", "field": "stack"}),
        }}

    async def log_turn(**kwargs):
        pass

    monkeypatch.setattr(agent, "_stream_llm", stream)
    monkeypatch.setattr(agent.qa_log, "log_turn", log_turn)

    async def run(question, *, resolved, expect_model_calls):
        request = agent.AgentAskRequest(question=question, ui={
            "page": "board", "boardProjects": [{"name": "样例项目", "stack": "过时技术栈"}],
        })
        stream = (await agent.agent_ask(request)).body_iterator
        assert "event: meta" in await anext(stream)
        event = await anext(stream)
        assert "event: action" in event
        action = json.loads(event.split("data: ", 1)[1])
        assert action["tool"] == "open_project"
        assert action["args"]["project"] == "样例项目"
        await agent.action_result(agent.ActionResult(
            action_id=action["action_id"], ok=resolved, message="控件不可用" if not resolved else "完成",
        ))
        output = "".join([frame async for frame in stream])
        assert "Vue 3、FastAPI" in output
        assert "过时技术栈" not in output
        assert f'"model_calls": {expect_model_calls}' in output
        if resolved:
            assert "已打开样例项目" in output
        else:
            assert "已打开样例项目" not in output
            assert "控件不可用" in output

    asyncio.run(run("打开样例项目，顺便说说技术栈", resolved=True, expect_model_calls=0))
    asyncio.run(run("帮我把样例项目详情调出来，再告诉我它用了哪些技术", resolved=False, expect_model_calls=1))
    assert calls == 1


def test_page_action_schema_rejects_invalid_arguments():
    import pytest

    with pytest.raises(ValueError):
        agent.make_action("filter_board", {"show_history": "false"})
    with pytest.raises(ValueError):
        agent.make_action("control_video", {"action": "delete"})
