"""系统设置：把运行时可改的参数暴露给管理后台。

设计：
- 可改字段白名单（EDITABLE），只允许改模型/语音/检索/人设这类参数；
- 修改写入 backend/data/settings.json（不入库），启动时自动应用；
- 改动立即 setattr 到 pp7rag.config.settings，无需重启；
- 密钥类字段读接口只返回掩码，写接口传空字符串表示「不修改」。
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pp7rag.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])

SETTINGS_FILE = Path(__file__).resolve().parent.parent / "data" / "settings.json"

# key -> (分组, 标签, 类型, 是否密钥, 选项, 提示)
EDITABLE: dict[str, dict[str, Any]] = {
    "llm_base_url": {
        "group": "语言模型", "label": "API 地址", "type": "text", "secret": False,
        "hint": "OpenAI 兼容的 /chat/completions 服务地址",
    },
    "llm_model": {
        "group": "语言模型", "label": "模型", "type": "text", "secret": False,
        "hint": "例如 deepseek-flash、qwen-flash",
    },
    "llm_api_key": {
        "group": "语言模型", "label": "API Key", "type": "password", "secret": True,
        "hint": "留空表示不修改",
    },
    "tts_model": {
        "group": "语音合成", "label": "TTS 模型", "type": "text", "secret": False,
        "hint": "例如 qwen3-tts-flash",
    },
    "tts_voice": {
        "group": "语音合成", "label": "音色", "type": "select", "secret": False,
        "options": ["Cherry", "Serena", "Ethan", "Chelsie"], "hint": "数字人朗读使用的音色",
    },
    "asr_model": {
        "group": "语音识别", "label": "ASR 模型", "type": "text", "secret": False,
        "hint": "例如 qwen3-asr-flash-realtime",
    },
    "dashscope_api_key": {
        "group": "语音服务", "label": "百炼 API Key", "type": "password", "secret": True,
        "hint": "TTS/ASR 共用；留空表示不修改",
    },
    "rag_top_k": {
        "group": "知识检索", "label": "检索条数 top_k", "type": "number", "secret": False,
        "hint": "每次问答召回的资料条数，1–10",
    },
    "rag_reference_max_chars": {
        "group": "知识检索", "label": "单条资料截断字数", "type": "number", "secret": False,
        "hint": "拼进提示词的每条资料最大字符数",
    },
    "rag_answer_short_chars": {
        "group": "知识检索", "label": "简洁回答字数上限", "type": "number", "secret": False,
        "hint": "默认 220",
    },
    "rag_assistant_name": {
        "group": "数字人", "label": "助手名字", "type": "text", "secret": False,
        "hint": "例如「平台助手」",
    },
    "rag_platform_name": {
        "group": "数字人", "label": "平台名称", "type": "text", "secret": False,
        "hint": "出现在身份描述与推荐问题里",
    },
}

_PROTECTED = {"llm_api_key", "dashscope_api_key"}


def _mask(value: str) -> str:
    # 不再回显首尾字符，避免无意义泄露；前端用 configured 判断是否已配置
    return "****" if value else ""


def _coerce(key: str, value: Any) -> Any:
    """按 pydantic 字段类型转换，避免把字符串塞进 int 字段。"""
    field = settings.model_fields.get(key)
    annotation = getattr(field, "annotation", str) if field else str
    origin = getattr(annotation, "__origin__", None)
    target = origin or annotation
    if target is int or str(target).endswith("int"):
        return int(value)
    if target is float or str(target).endswith("float"):
        return float(value)
    if target is bool or str(target).endswith("bool"):
        return bool(value)
    return str(value)


def _read_overrides() -> dict[str, Any]:
    if not SETTINGS_FILE.exists():
        return {}
    try:
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("settings_file_read_failed: %s", exc)
        return {}


def _write_overrides(data: dict[str, Any]) -> None:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = SETTINGS_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, SETTINGS_FILE)  # 原子替换，避免断电留下半个 JSON


def apply_overrides() -> None:
    """启动时把 settings.json 里的覆盖值应用到运行配置。"""
    overrides = _read_overrides()
    applied = []
    for key, value in overrides.items():
        if key not in EDITABLE or value in (None, ""):
            continue
        try:
            setattr(settings, key, _coerce(key, value))
            applied.append(key)
        except Exception as exc:
            logger.warning("settings_apply_failed key=%s: %s", key, exc)
    if applied:
        logger.warning("settings_overrides_applied: %s", ", ".join(applied))


def _item(key: str, meta: dict[str, Any]) -> dict[str, Any]:
    raw = getattr(settings, key, "")
    value = str(raw) if raw is not None else ""
    return {
        "key": key,
        "group": meta.get("group", ""),
        "label": meta.get("label", key),
        "type": meta.get("type", "text"),
        "secret": bool(meta.get("secret")),
        "options": meta.get("options") or [],
        "hint": meta.get("hint", ""),
        "value": _mask(value) if meta.get("secret") else value,
        "configured": bool(value),
    }


@router.get("")
async def list_settings() -> dict:
    overrides = _read_overrides()
    items = [_item(key, meta) for key, meta in EDITABLE.items()]
    groups: dict[str, list[dict]] = {}
    for item in items:
        item["overridden"] = item["key"] in overrides
        groups.setdefault(item["group"], []).append(item)
    return {
        "groups": [{"name": name, "items": value} for name, value in groups.items()],
        "note": "密钥保存在本机文件里，接口只返回掩码；改动立即生效，无需重启。",
    }


class SettingsUpdate(BaseModel):
    values: dict[str, Any]


@router.put("")
async def update_settings(payload: SettingsUpdate) -> dict:
    values = payload.values or {}
    if not values:
        raise HTTPException(status_code=400, detail="没有要更新的字段")
    unknown = [key for key in values if key not in EDITABLE]
    if unknown:
        raise HTTPException(status_code=400, detail="不支持修改：" + "、".join(unknown))

    overrides = _read_overrides()
    applied: list[str] = []
    for key, value in values.items():
        if value is None:
            continue
        text = str(value).strip()
        if key in _PROTECTED and text == "":
            continue  # 空表示不修改密钥
        if key in _PROTECTED and "*" in text:
            continue  # 掩码值（****）不能被当成真实密钥写回
        try:
            converted = _coerce(key, value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{EDITABLE[key]['label']} 的取值不合法")
        if key == "llm_base_url":
            base = str(converted).strip()
            if not (base.startswith("https://") or base.startswith("http://")):
                raise HTTPException(status_code=400, detail="API 地址必须以 http:// 或 https:// 开头")
        if key == "rag_top_k":
            converted = max(1, min(10, int(converted)))
        if key == "rag_reference_max_chars":
            converted = max(100, min(4000, int(converted)))
        setattr(settings, key, converted)
        overrides[key] = converted
        applied.append(key)

    try:
        _write_overrides(overrides)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"写入配置文件失败：{exc}")

    logger.warning("settings_updated: %s", ", ".join(applied))
    return {"ok": True, "applied": applied}


class TestRequest(BaseModel):
    target: str = "llm"


@router.post("/test")
async def test_connection(payload: TestRequest) -> dict:
    """测试当前配置是否可用：LLM 发一次最小请求，TTS 合成一个短词。"""
    target = (payload.target or "llm").strip().lower()
    started = time.perf_counter()
    if target == "llm":
        url = settings.llm_base_url.rstrip("/") + "/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {settings.llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.llm_model,
                        "messages": [{"role": "user", "content": "hi"}],
                        "max_tokens": 4,
                        "stream": False,
                    },
                )
        except Exception as exc:
            return {"ok": False, "target": target, "message": f"连接失败：{exc}", "ms": int((time.perf_counter() - started) * 1000)}
        if response.status_code >= 400:
            return {
                "ok": False,
                "target": target,
                "message": f"HTTP {response.status_code}：{response.text[:160]}",
                "ms": int((time.perf_counter() - started) * 1000),
            }
        return {
            "ok": True,
            "target": target,
            "message": f"模型 {settings.llm_model} 可用",
            "ms": int((time.perf_counter() - started) * 1000),
        }

    if target == "tts":
        try:
            from pp7rag.ragapi.providers import tts as tts_provider

            audio = await tts_provider.synthesize("测试", settings.tts_voice, 1.0)
        except Exception as exc:
            return {"ok": False, "target": target, "message": f"语音合成失败：{exc}", "ms": int((time.perf_counter() - started) * 1000)}
        return {
            "ok": True,
            "target": target,
            "message": f"音色 {settings.tts_voice} 可用（{len(audio)} 字节）",
            "ms": int((time.perf_counter() - started) * 1000),
        }

    raise HTTPException(status_code=400, detail="target 只支持 llm / tts")
