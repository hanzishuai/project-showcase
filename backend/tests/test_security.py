"""上线加固回归：管理鉴权、限流、健康检查与安全响应头。"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)


def test_admin_settings_requires_token_when_enabled(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_TOKEN", "test-secret")
    assert client.get("/api/admin/settings").status_code == 401
    assert client.get("/api/admin/settings", headers={"X-Admin-Token": "wrong"}).status_code == 401
    ok = client.get("/api/admin/settings", headers={"X-Admin-Token": "test-secret"})
    assert ok.status_code == 200
    # 密钥只返回全掩码，不回显首尾字符
    secrets = [
        item["value"]
        for group in ok.json()["groups"]
        for item in group["items"]
        if item["secret"] and item["configured"]
    ]
    assert secrets and all(value == "****" for value in secrets)


def test_admin_settings_open_when_token_not_configured(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_TOKEN", "")
    assert client.get("/api/admin/settings").status_code == 200


def test_expensive_endpoints_rate_limited(monkeypatch):
    monkeypatch.setattr(main, "_RATE_LIMIT_PER_MIN", 2)
    main._rate_buckets.clear()
    payload = {}
    assert client.post("/api/v1/agent/ask", json=payload).status_code == 422
    assert client.post("/api/v1/agent/ask", json=payload).status_code == 422
    assert client.post("/api/v1/agent/ask", json=payload).status_code == 429


def test_ready_and_security_headers():
    ready = client.get("/api/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ok"
    page = client.get("/")
    assert page.status_code == 200
    assert page.headers.get("x-content-type-options") == "nosniff"
    assert page.headers.get("cache-control") == "no-cache"
    assert "default-src 'self'" in page.headers.get("content-security-policy", "")
