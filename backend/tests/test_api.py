"""后端契约测试：种子数据、CRUD、阶段与统计。"""
from __future__ import annotations


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"


def test_meta_materials(client):
    meta = client.get("/api/meta").json()
    assert meta["materials"] == {"projectFolders": 3, "docx": 3, "screenshots": 7}
    assert len(meta["stageFramework"]) == 6
    assert meta["stageFramework"][0] == "需求分析"
    assert meta["missingValue"] == "—"


def test_projects_seeded(client):
    rows = client.get("/api/projects").json()
    assert len(rows) == 3
    assert [r["name"] for r in rows] == [
        "高校党组织管理平台项目介绍",
        "科技成果转化平台项目介绍",
        "科研项目申报系统简介",
    ]
    assert [r["docx_count"] for r in rows] == [1, 1, 1]
    assert [r["shot_count"] for r in rows] == [3, 4, 0]
    assert rows[0]["cover"] == "微信图片_20261109162755_36_102.jpg"


def test_project_detail_shape(client):
    detail = client.get("/api/projects/gaoxiao-dangzuzhi-guanli").json()
    assert len(detail["stages"]) == 6
    assert all(s["state"] == "missing" for s in detail["stages"])
    assert len(detail["source_files"]) == 1
    assert detail["source_files"][0]["file_name"].endswith(".docx")
    assert len(detail["screenshots"]) == 3
    assert detail["screenshots"][0]["url"].startswith("/media/")
    assert detail["screenshots"][0]["caption"]
    assert detail["progress"] is None
    assert "基于原型设计实现" in detail["stage_note"]


def test_missing_project_404(client):
    response = client.get("/api/projects/does-not-exist")
    assert response.status_code == 404


def test_crud_roundtrip(client):
    payload = {
        "id": "demo-project",
        "name": "演示项目",
        "summary": "用于验证 CRUD",
        "stage_note": "文档未提供结构化阶段",
    }
    created = client.post("/api/projects", json=payload)
    assert created.status_code == 201
    assert created.json()["name"] == "演示项目"
    assert len(created.json()["stages"]) == 6

    duplicate = client.post("/api/projects", json=payload)
    assert duplicate.status_code == 409

    patched = client.patch("/api/projects/demo-project", json={"name": "演示项目二"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "演示项目二"

    stage = client.put(
        "/api/projects/demo-project/stages/1", json={"state": "done", "note": "已完成"}
    )
    assert stage.status_code == 200
    assert stage.json()["stages"][0]["state"] == "done"
    assert stage.json()["stage_done"] == 1

    bad_stage = client.put("/api/projects/demo-project/stages/9", json={"state": "done"})
    assert bad_stage.status_code == 400

    removed = client.delete("/api/projects/demo-project")
    assert removed.status_code == 204
    assert client.get("/api/projects/demo-project").status_code == 404


def test_stats(client):
    stats = client.get("/api/stats").json()
    assert stats["total"] == 3
    assert stats["docx"] == 3
    assert stats["screenshots"] == 7
    assert stats["stage_total"] == 18
    assert stats["stage_done"] == 0


def test_no_fabricated_percentages(client):
    """页面上不得出现写死百分比（缺失值必须是 —）。"""
    import re

    for path in ("/api/meta", "/api/projects", "/api/stats"):
        text = client.get(path).text
        assert not re.search(r"\b\d{1,3}\s*%", text), path


def test_media_file_served(client):
    response = client.get("/media/截图-科技成果列表.png")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")
