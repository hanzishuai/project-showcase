import logging
import os
from pydantic_settings import BaseSettings
from pydantic import AliasChoices, Field
from pathlib import Path

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = {"env_file": str(_BASE_DIR / ".env"), "env_file_encoding": "utf-8", "extra": "ignore"}

    # ── Qwen Omni realtime: speech and text share one RAG path ──
    # The older TTS_API_KEY name remains accepted for existing local installs.
    omni_api_key: str = Field(default="", validation_alias=AliasChoices("OMNI_API_KEY", "DASHSCOPE_API_KEY", "TTS_API_KEY"))
    omni_workspace_id: str = ""
    omni_region: str = "cn-beijing"
    omni_model: str = "qwen3.8-omni-flash-realtime"
    omni_voice: str = "Tina"
    guide_system_prompt: str = Field(default="", validation_alias=AliasChoices("GUIDE_SYSTEM_PROMPT", "LLM_SYSTEM_PROMPT"))
    # 人设：助手名字与平台名字都可在 .env 覆盖（RAG_ASSISTANT_NAME / RAG_PLATFORM_NAME）。
    rag_assistant_name: str = "平台助手"
    rag_platform_name: str = "软件学院项目实践聚合平台"
    # full = complete rules + few-shot examples (default; token budget is not a concern)
    # compact = identity + evidence + style only, for latency-critical setups
    rag_prompt_profile: str = "full"

    # ── Serial RAG API (for embedding into third-party Vue systems) ──
    # Text generation uses any OpenAI-compatible /chat/completions endpoint.
    llm_api_key: str = ""
    # Primary: DeepSeek first-party API. Fallback: Alibaba DashScope compatible
    # mode (qwen-flash), used only when the primary fails before emitting text.
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-flash"
    llm_max_tokens: int = 1024
    llm_temperature: float = 0.7
    # Optional fallback used when the primary model fails before emitting text.
    llm_fallback_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_fallback_model: str = "qwen-flash"
    llm_fallback_api_key: str = ""
    # Latency tuning: Qwen3 thinking mode roughly doubles time-to-first-token.
    llm_fatal_cooldown_s: int = 3600  # 余额/鉴权类错误后跳过该目标的时长（避免每 10 分钟白付一次 402）
    llm_enable_thinking: bool = False
    # "none" turns DeepSeek/Qwen reasoning off (deepseek-flash otherwise spends
    # 1-3 s on reasoning tokens before the first visible token).
    llm_reasoning_effort: str = "none"  # "", "none", "minimal", ... ; empty = do not send
    llm_warmup_on_startup: bool = True
    # Retrieval/prompt budget: smaller context = faster prefill.
    rag_top_k: int = 3
    rag_reference_max_chars: int = 600
    # Hybrid retrieval: vector recall + BM25 keyword recall, fused with RRF, then
    # reranked by DashScope. Keyword recall matters for project names and codes.
    rag_hybrid_enabled: bool = True
    rag_recall_pool: int = 16            # 每路召回条数
    rag_rerank_enabled: bool = True
    rag_rerank_model: str = "gte-rerank-v2"
    rag_rerank_timeout_ms: int = 2000
    rag_snippet_chars: int = 240         # 来源卡片里展示的命中片段长度
    rag_source_text_chars: int = 1600    # 点击展开时给到的原文长度
    # Answer style: default short; commands like "详细说说" switch to detailed.
    rag_answer_short_chars: int = 220
    rag_answer_detailed_chars: int = 700
    # Topic switch: if the new question is far from the previous one, drop history.
    rag_topic_switch_enabled: bool = True
    rag_topic_switch_threshold: float = 0.45
    # QA log + feedback (sqlite, no external dependency)
    rag_qa_log_enabled: bool = True
    rag_qa_log_path: Path = Path(__file__).parent.parent / "data" / "qa_log.sqlite3"
    # Dynamic suggested questions generated from the knowledge base
    rag_suggestions_enabled: bool = True
    rag_suggestions_ttl: int = 3600
    # Short, predictable conversation window (turns = user + assistant pairs).
    rag_history_turns: int = 4            # 携带最近 4 轮（8 条消息）
    rag_history_message_chars: int = 300  # 单条消息截断长度
    rag_history_budget_chars: int = 1200  # 历史总字数预算（从最近往前装）
    # Speech: ASR/TTS share the DashScope key; falls back to TTS_API_KEY/OMNI_API_KEY.
    dashscope_api_key: str = ""
    asr_enabled: bool = True
    asr_model: str = "qwen3-asr-flash-realtime"
    tts_enabled: bool = True
    tts_model: str = "qwen3-tts-flash"
    tts_voice: str = "Cherry"
    tts_cache_enabled: bool = True
    tts_cache_ttl: int = 1800
    tts_cache_max: int = 256
    rag_api_persist: bool = False
    # Caching: repeated identical questions can be answered without retrieval/LLM.
    rag_answer_cache_enabled: bool = True
    rag_answer_cache_ttl: int = 300
    rag_answer_cache_max: int = 128

    # ── Single-connection streaming (WS): server-side segmentation + TTS fan-out ──
    # The server splits the answer into short speakable fragments and starts TTS
    # the moment a fragment is complete, streaming PCM back over the same socket.
    rag_stream_enabled: bool = True
    rag_segment_max_chars: int = 32
    rag_segment_first_min_chars: int = 4   # 首段只需 4 字即可送 TTS（更早开口）
    rag_segment_first_max_chars: int = 24  # 首段无标点也强制切（尽量等到标点，别切在词中间）
    rag_segment_soft_min_chars: int = 20   # 后续段在软停顿处切开的最小字数
    rag_tts_concurrency: int = 1           # 并发 TTS 请求上限（DashScope TTS 有 QPS 限制，>1 会触发 429）
    tts_min_interval_ms: int = 300         # TTS 请求最小间隔（全局限速，避免突发 429）

    # ── Embedding ──
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    rag_predictive_enabled: bool = True
    rag_predictor_model: str = "qwen3.8-flash"
    rag_cache_similarity: float = 0.85

    # ── Paths ──
    data_dir: Path = Path(__file__).parent.parent / "data"
    chroma_path: Path = Path(__file__).parent.parent / "data" / "chroma_storage"
    db_path: Path = Path(__file__).parent.parent / "data" / "pp7.db"

    # ── Session ──
    max_history_rounds: int = 10

    # Redis
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 0

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # MySQL
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = "pp7"

    # CORS
    cors_origins: str = "*"

settings = Settings()

# Resolve system prompts: if value is a path to an existing file, load it;
# otherwise use the value as-is (empty = keep built-in default).
def _resolve_prompt(value: str) -> str:
    if not value:
        return ""
    p = Path(value)
    if p.is_file():
        return p.read_text(encoding="utf-8").strip()
    return value

settings.guide_system_prompt = _resolve_prompt(settings.guide_system_prompt)
