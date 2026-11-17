import asyncio

from pp7rag.config import settings
from pp7rag.ragapi.providers import asr, tts


class Response:
    status = 200
    def __init__(self):
        self.content = self
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def json(self): return {"text": "测试"}
    async def iter_chunked(self, size):
        yield b"pcm-data"


def test_openai_speech_adapters(monkeypatch):
    class Session:
        def __init__(self): self.requests = []
        def post(self, url, **kwargs):
            self.requests.append((url, kwargs))
            return Response()
    session = Session()
    async def get_session(): return session
    monkeypatch.setattr(settings, "asr_protocol", "openai")
    monkeypatch.setattr(settings, "tts_protocol", "openai")
    monkeypatch.setattr(settings, "asr_api_key", "test")
    monkeypatch.setattr(settings, "tts_api_key", "test")
    monkeypatch.setattr(asr, "get_session", get_session)
    monkeypatch.setattr(tts, "get_tts_session", get_session)
    async def run():
        transcriber = asr.create_transcriber()
        await transcriber.open()
        await transcriber.push(bytes(3200))
        assert await transcriber.finish() == "测试"
        await transcriber.close()
        chunks = [chunk async for chunk in tts._stream_pcm("你好", "alloy")]
        assert chunks == [b"pcm-data"]
        assert session.requests[-1][1]["json"]["response_format"] == "pcm"
    asyncio.run(run())


def test_batch_asr_partial_and_cancellation(monkeypatch):
    monkeypatch.setattr(settings, "asr_api_key", "test")
    seen = []
    async def fake_transcribe(audio, *, timeout_s=40):
        await asyncio.sleep(0)
        return "豆姐"
    monkeypatch.setattr(asr, "transcribe", fake_transcribe)
    async def run():
        transcriber = asr.BatchTranscriber(on_partial=seen.append)
        await transcriber.open()
        await transcriber.push(bytes(asr.SAMPLE_RATE * 4))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert seen == ["豆姐"]
        assert await transcriber.finish() == "豆姐"
        await transcriber.close()
    asyncio.run(run())
