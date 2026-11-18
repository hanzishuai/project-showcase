import asyncio
import json

from app import agent, main
from pp7rag.config import settings
from pp7rag.ragapi import knowledge_import


def test_long_upload_can_read_original_ending(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(main, "ADMIN_TOKEN", "test")
    monkeypatch.setattr(knowledge_import.indexer, "index_chunks", lambda _: None)
    header = {"X-Admin-Token": "test"}
    text = "# 开场\n" + "这是测试正文。" * 3200 + "\n## 收尾\n最后请大家举手。"
    upload = {"file": ("talk.md", text.encode("utf-8"), "text/markdown")}
    preview = client.post("/api/v1/rag/knowledge/preview", files=upload, headers=header)
    assert preview.status_code == 200
    assert "最后请大家举手" not in preview.json()["markdown"]
    for source in ("document", "script"):
        saved = client.post("/api/v1/rag/knowledge/commit-upload", files=upload, headers=header,
                            data={"filename": "talk.md", "source": source})
        assert saved.status_code == 200
    request = {"title": "《talk》", "source": "script"}
    path = "/api/v1/rag/narration"
    assert client.get("/api/v1/rag/knowledge/documents").status_code == 401
    assert client.post("/api/v1/rag/knowledge/commit-upload").status_code == 401
    assert client.delete("/api/v1/rag/knowledge/documents/talk.md").status_code == 401
    public_docs = client.get("/api/v1/rag/narration/documents")
    assert public_docs.status_code == 200
    assert {item["source"] for item in public_docs.json()["data"]} == {"document", "script"}
    response = client.post(path, json=request)
    assert response.status_code == 200
    chapters = response.json()["sections"]
    assert [chapter["title"] for chapter in chapters] == ["开场", "收尾"]
    assert chapters[-1]["segments"] == ["收尾", "最后请大家举手。"]
    assert client.post(path, json={"title": "talk"}).status_code == 404
    assert client.post(path, json={"title": "../talk", "source": "document"}).status_code == 404
    assert [doc["name"] for doc in knowledge_import.list_documents()] == ["talk.md"]


def test_agent_semantic_action_receives_result(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "data_dir", tmp_path)

    async def stream(messages):
        if messages[-1]["role"] != "tool":
            assert "全文朗读状态" in messages[0]["content"]
            assert "我抄完了，刚刚卡住的地方往下吧" in messages[-1]["content"]
            yield "tool_calls", {0: {
                "id": "n1", "name": "control_narration", "arguments": '{"action":"resume"}',
            }}
        else:
            assert json.loads(messages[-1]["content"])["ok"]
            yield "token", "接着念。"
            yield "tool_calls", {}

    async def log_turn(**_kwargs):
        pass

    monkeypatch.setattr(agent, "_stream_llm", stream)
    monkeypatch.setattr(agent.qa_log, "log_turn", log_turn)

    async def run():
        request = agent.AgentAskRequest(
            question="我抄完了，刚刚卡住的地方往下吧",
            ui={"narration": {"title": "讲解稿", "status": "paused", "section": "开场"}},
        )
        frames = (await agent.agent_ask(request)).body_iterator
        await anext(frames)
        action = json.loads((await anext(frames)).split("data: ", 1)[1])
        assert action["tool"] == "control_narration"
        assert action["args"] == {"action": "resume"}
        await agent.action_result(agent.ActionResult(action_id=action["action_id"], ok=True, message="已续读"))
        assert "接着念" in "".join([frame async for frame in frames])

    asyncio.run(run())
