var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { ref, computed, onMounted, onBeforeUnmount, inject, defineComponent, watch, openBlock, createElementBlock, unref, createElementVNode, toDisplayString, createCommentVNode, nextTick, reactive, createTextVNode, Fragment, renderList, normalizeClass, withKeys, withModifiers, withDirectives, vModelText, normalizeStyle, createVNode } from "vue";
const warmupCache = /* @__PURE__ */ new Map();
function cacheKey$1(client) {
  return client.apiBaseUrl.trim() || "(same-origin)";
}
function prewarmRagHealth(client, signal) {
  const key = cacheKey$1(client);
  const existing = warmupCache.get(key);
  if (existing) return existing.promise;
  const entry = { settled: false, promise: Promise.resolve() };
  entry.promise = client.health({ signal }).then(() => void 0).catch(() => void 0).finally(() => {
    entry.settled = true;
  });
  warmupCache.set(key, entry);
  if (signal) {
    signal.addEventListener(
      "abort",
      () => {
        if (!entry.settled && warmupCache.get(key) === entry) warmupCache.delete(key);
      },
      { once: true }
    );
  }
  return entry.promise;
}
function resetRagWarmupCache() {
  warmupCache.clear();
}
class RagError extends Error {
  constructor(message, kind = "unknown", status) {
    super(message);
    __publicField(this, "kind");
    __publicField(this, "status");
    this.name = "RagError";
    this.kind = kind;
    this.status = status;
  }
}
function isAbortError(error) {
  if (!error) return false;
  if (error instanceof RagError) return error.kind === "aborted";
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  const maybeName = error.name;
  return maybeName === "AbortError";
}
function toRagError(error, fallbackMessage = "请求失败") {
  if (error instanceof RagError) return error;
  if (isAbortError(error)) return new RagError("请求已取消", "aborted");
  if (error instanceof TypeError) {
    return new RagError(error.message || fallbackMessage, "network");
  }
  if (error instanceof Error) {
    return new RagError(error.message || fallbackMessage, "unknown");
  }
  return new RagError(fallbackMessage, "unknown");
}
const WAV_HEADER_BYTES = 44;
function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
function encodeWav(samples, sampleRate, channels = 1) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(WAV_HEADER_BYTES + i * 2, samples[i] ?? 0, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
function float32ToInt16(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}
function downsampleBuffer(input, inputSampleRate, outputSampleRate) {
  if (outputSampleRate >= inputSampleRate || input.length === 0) return input;
  const ratio = inputSampleRate / outputSampleRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const low = Math.floor(position);
    const high = Math.min(low + 1, input.length - 1);
    const fraction = position - low;
    const a = input[low] ?? 0;
    const b = input[high] ?? 0;
    output[i] = a + (b - a) * fraction;
  }
  return output;
}
async function toArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source;
  if (source instanceof Blob) return await source.arrayBuffer();
  const view = source;
  const copy = new Uint8Array(view.byteLength);
  copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy.buffer;
}
function readAscii(view, offset, length) {
  let text = "";
  for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i));
  return text;
}
function decodeWavPcm(buffer) {
  if (buffer.byteLength < 44) throw new RagError("WAV 数据过短", "parse");
  const view = new DataView(buffer);
  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new RagError("不是合法的 WAV 数据", "parse");
  }
  let format = null;
  let dataOffset = -1;
  let dataLength = 0;
  let offset = 12;
  let guard = 0;
  while (offset + 8 <= buffer.byteLength && guard < 256) {
    guard += 1;
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (chunkId === "fmt ") {
      if (chunkSize < 16 || body + 16 > buffer.byteLength) {
        throw new RagError("WAV fmt 块损坏", "parse");
      }
      const audioFormat = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      const bitsPerSample = view.getUint16(body + 14, true);
      if (audioFormat !== 1 && audioFormat !== 65534) {
        throw new RagError("仅支持 PCM 编码的 WAV", "unsupported");
      }
      if (bitsPerSample !== 16) {
        throw new RagError(`仅支持 16bit WAV（实际 ${bitsPerSample}bit）`, "unsupported");
      }
      format = { sampleRate, channels: Math.max(1, channels), bitsPerSample };
    } else if (chunkId === "data") {
      dataOffset = body;
      dataLength = Math.min(chunkSize, Math.max(0, buffer.byteLength - body));
    }
    const advance = 8 + chunkSize + chunkSize % 2;
    if (advance <= 0) break;
    offset += advance;
  }
  if (!format || dataOffset < 0) {
    throw new RagError("WAV 缺少 fmt/data 块", "parse");
  }
  const frameBytes = 2 * format.channels;
  const frames = Math.floor(dataLength / frameBytes);
  const samples = new Int16Array(frames * format.channels);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(dataOffset + i * 2, true);
  }
  return { format, samples };
}
const TTS_SPEED_MIN = 0.5;
const TTS_SPEED_MAX = 2;
const DEFAULT_TTS_SPEED = 1;
const CITATION_PATTERN = /\[(\d{1,3})\]/g;
function normalizeSpeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) return clampSpeed(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clampSpeed(parsed);
  }
  return void 0;
}
function clampSpeed(value) {
  const bounded = Math.min(TTS_SPEED_MAX, Math.max(TTS_SPEED_MIN, value));
  return Math.round(bounded * 100) / 100;
}
function sourceCitation(source, index) {
  const citation = source == null ? void 0 : source.citation;
  if (typeof citation === "number" && Number.isFinite(citation) && citation >= 1) {
    return Math.round(citation);
  }
  return index + 1;
}
function extractCitationNumbers(text) {
  if (!text) return [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => a - b);
}
function toRawNodes(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push({ type: "text", text: text.slice(last, index), start: last, end: index });
    }
    nodes.push({
      type: "cite",
      text: match[0],
      citation: Number(match[1]),
      start: index,
      end: index + match[0].length
    });
    last = index + match[0].length;
  }
  if (last < text.length) {
    nodes.push({ type: "text", text: text.slice(last), start: last, end: text.length });
  }
  return nodes;
}
function overlaps(range, start, end) {
  if (!range) return false;
  return range.start < end && range.end > start;
}
function buildRichNodes(text, options = {}) {
  if (!text) return [];
  const highlight = options.highlight ?? null;
  const citations = options.citations ?? null;
  const result = [];
  for (const node of toRawNodes(text)) {
    if (node.type === "cite") {
      const citation = node.citation ?? 0;
      const hl = overlaps(highlight, node.start, node.end);
      if (citations && !citations.has(citation)) {
        result.push({ type: "text", text: node.text, hl });
      } else {
        result.push({ type: "cite", text: node.text, citation, hl });
      }
      continue;
    }
    if (!highlight || !overlaps(highlight, node.start, node.end)) {
      result.push({ type: "text", text: node.text, hl: false });
      continue;
    }
    const cutStart = Math.max(node.start, highlight.start) - node.start;
    const cutEnd = Math.min(node.end, highlight.end) - node.start;
    if (cutStart > 0) result.push({ type: "text", text: node.text.slice(0, cutStart), hl: false });
    if (cutEnd > cutStart) result.push({ type: "text", text: node.text.slice(cutStart, cutEnd), hl: true });
    if (cutEnd < node.text.length) result.push({ type: "text", text: node.text.slice(cutEnd), hl: false });
  }
  return result;
}
function compactText(text) {
  let compact = "";
  const map = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === void 0 || /\s/.test(char)) continue;
    compact += char;
    map.push(index);
  }
  map.push(text.length);
  return { text: compact, map };
}
function lowerBound(map, from) {
  let low = 0;
  let high = map.length;
  while (low < high) {
    const mid = low + high >> 1;
    if ((map[mid] ?? 0) < from) low = mid + 1;
    else high = mid;
  }
  return low;
}
function locateSegmentText(content, cursor, segment) {
  const needle = (segment ?? "").trim();
  if (!content || !needle) return null;
  const from = Math.max(0, Math.min(cursor, content.length));
  const direct = content.indexOf(needle, from);
  if (direct >= 0) return { start: direct, end: direct + needle.length };
  const compact = compactText(content);
  const needleCompact = needle.replace(/\s+/g, "");
  if (!needleCompact) return null;
  const compactFrom = lowerBound(compact.map, from);
  const hit = compact.text.indexOf(needleCompact, compactFrom);
  if (hit < 0) return null;
  const start = compact.map[hit];
  const lastIndex = hit + needleCompact.length - 1;
  const end = (compact.map[lastIndex] ?? -1) + 1;
  if (start === void 0 || end <= start) return null;
  return { start, end };
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlightTermParts(text, terms) {
  if (!text) return [];
  const cleaned = Array.from(
    new Set(
      (terms ?? []).map((term) => typeof term === "string" ? term.trim() : "").filter((term) => term.length >= 1 && term.length <= 40)
    )
  );
  if (cleaned.length === 0) return [{ text, hit: false }];
  cleaned.sort((a, b) => b.length - a.length);
  let pattern;
  try {
    pattern = new RegExp(cleaned.map(escapeRegExp).join("|"), "gi");
  } catch {
    return [{ text, hit: false }];
  }
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length > 0 ? parts : [{ text, hit: false }];
}
const LINE_BREAK = /\r\n|\r|\n/;
function createSseParser(onMessage) {
  let buffer = "";
  let eventName = "";
  let dataLines = [];
  let lastEventId;
  function dispatch() {
    const data = dataLines.join("\n");
    const event = eventName || "message";
    eventName = "";
    dataLines = [];
    if (data === "") return;
    const message = { event, data };
    if (lastEventId !== void 0) message.id = lastEventId;
    onMessage(message);
  }
  function processLine(line) {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        eventName = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "id":
        if (!value.includes("\0")) lastEventId = value;
        break;
    }
  }
  function drain() {
    let text = buffer;
    const holdTrailingCr = text.endsWith("\r");
    if (holdTrailingCr) text = text.slice(0, -1);
    const lines = text.split(LINE_BREAK);
    const rest = lines.pop() ?? "";
    buffer = holdTrailingCr ? `${rest}\r` : rest;
    for (const line of lines) processLine(line);
  }
  return {
    push(chunk) {
      if (!chunk) return;
      buffer += chunk;
      drain();
    },
    end() {
      let rest = buffer;
      buffer = "";
      if (rest.endsWith("\r")) rest = rest.slice(0, -1);
      if (rest.length > 0) processLine(rest);
      dispatch();
    }
  };
}
async function readSseStream(stream, onMessage) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = createSseParser(onMessage);
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
}
const RAG_PREFIX = "/api/v1/rag";
function asRecord$1(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function pickString$1(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return void 0;
}
function pickNumber$1(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return void 0;
}
function parseJson(data) {
  const trimmed = data.trim();
  if (!trimmed) return void 0;
  try {
    return JSON.parse(trimmed);
  } catch {
    return void 0;
  }
}
function normalizeSources(raw) {
  const record = asRecord$1(raw);
  const list = record && Array.isArray(record.sources) ? record.sources : Array.isArray(raw) ? raw : [];
  const sources = [];
  list.forEach((item, index) => {
    const entry = asRecord$1(item);
    if (!entry) return;
    const id = entry.id;
    const source = {
      id: typeof id === "string" || typeof id === "number" ? id : `source-${index}`,
      title: pickString$1(entry, ["title", "name"]) ?? `资料 ${index + 1}`,
      text: pickString$1(entry, ["text", "content", "snippet"]) ?? "",
      score: pickNumber$1(entry, ["score", "similarity"]) ?? 0
    };
    const citation = pickNumber$1(entry, ["citation", "cite"]);
    if (citation !== void 0 && citation >= 1) source.citation = Math.round(citation);
    const snippet = pickString$1(entry, ["snippet", "summary", "digest"]);
    if (snippet !== void 0) source.snippet = snippet;
    const terms = normalizeTermList(entry.terms ?? entry.highlight_terms ?? entry.highlightTerms);
    if (terms.length > 0) source.terms = terms;
    const retrieval = pickString$1(entry, ["retrieval", "retriever", "method"]);
    if (retrieval !== void 0) source.retrieval = retrieval;
    sources.push(source);
  });
  return sources;
}
function normalizeTermList(raw) {
  if (!Array.isArray(raw)) return [];
  const terms = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const term = item.trim();
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms;
}
function buildTtsBody(text, voice, speed) {
  const body = { text };
  if (voice) body.voice = voice;
  const normalized = normalizeSpeed(speed);
  if (normalized !== void 0) body.speed = normalized;
  return body;
}
function resolveRagRoot(apiBaseUrl) {
  const base = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!base) return RAG_PREFIX;
  if (base.endsWith(RAG_PREFIX)) return base;
  if (base.endsWith("/api/v1")) return `${base}/rag`;
  if (base.endsWith("/api")) return `${base}/v1/rag`;
  return `${base}${RAG_PREFIX}`;
}
function resolveFetch(config) {
  if (config.fetch) return config.fetch;
  const globalFetch = globalThis.fetch;
  if (typeof globalFetch !== "function") {
    throw new RagError("当前环境不支持 fetch()", "unsupported");
  }
  return globalFetch;
}
async function httpErrorFromResponse(response) {
  const fallback2 = `请求失败（HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}）`;
  let message = fallback2;
  try {
    const text = await response.text();
    if (text) {
      const parsed = parseJson(text);
      const record = asRecord$1(parsed);
      const detail = (record && pickString$1(record, ["message", "error", "detail", "msg"])) ?? (typeof parsed === "string" ? parsed : void 0);
      message = detail ? detail : text.slice(0, 300);
    }
  } catch {
  }
  return new RagError(message, "http", response.status);
}
function parsePcmFormatFromResponse(response) {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("audio/l16") && !contentType.includes("audio/pcm") && !contentType.includes("audio/raw")) {
    return null;
  }
  const sampleRate = Number(
    response.headers.get("x-sample-rate") ?? response.headers.get("x-audio-sample-rate") ?? "24000"
  );
  const channels = Number(response.headers.get("x-channels") ?? "1");
  const bitsPerSample = Number(
    response.headers.get("x-bits-per-sample") ?? response.headers.get("x-audio-bits") ?? "16"
  );
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  if (!Number.isFinite(channels) || channels <= 0 || channels > 8) return null;
  if (bitsPerSample !== 16) return null;
  return {
    sampleRate: Math.round(sampleRate),
    channels: Math.round(channels),
    bitsPerSample: 16
  };
}
async function consumePcmStream(body, format, options, startedAt) {
  var _a, _b;
  (_a = options.onFormat) == null ? void 0 : _a.call(options, format);
  const reader = body.getReader();
  let pending = new Uint8Array(0);
  let chunkCount = 0;
  let pcmBytes = 0;
  let firstChunkMs = null;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      let merged;
      if (pending.byteLength > 0) {
        merged = new Uint8Array(pending.byteLength + value.byteLength);
        merged.set(pending, 0);
        merged.set(value, pending.byteLength);
      } else {
        merged = value;
      }
      const evenLength = merged.byteLength - merged.byteLength % 2;
      if (evenLength > 0) {
        const samples = new Int16Array(evenLength / 2);
        const view = new DataView(merged.buffer, merged.byteOffset, evenLength);
        for (let i = 0; i < samples.length; i += 1) {
          samples[i] = view.getInt16(i * 2, true);
        }
        pcmBytes += evenLength;
        chunkCount += 1;
        if (firstChunkMs === null) firstChunkMs = Date.now() - startedAt;
        (_b = options.onChunk) == null ? void 0 : _b.call(options, { samples, format });
      }
      pending = evenLength < merged.byteLength ? merged.slice(evenLength) : new Uint8Array(0);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
  return {
    format,
    chunkCount,
    bytes: pcmBytes,
    fallbackUsed: false,
    firstChunkMs: firstChunkMs ?? Date.now() - startedAt,
    totalMs: Date.now() - startedAt
  };
}
async function fallbackTtsToPcm(tts, options, startedAt) {
  var _a, _b;
  const wav = await tts({
    text: options.text,
    voice: options.voice,
    speed: options.speed,
    signal: options.signal
  });
  const decoded = decodeWavPcm(wav);
  (_a = options.onFormat) == null ? void 0 : _a.call(options, decoded.format);
  (_b = options.onChunk) == null ? void 0 : _b.call(options, { samples: decoded.samples, format: decoded.format });
  const now = Date.now() - startedAt;
  return {
    format: decoded.format,
    chunkCount: 1,
    bytes: decoded.samples.byteLength,
    fallbackUsed: true,
    firstChunkMs: now,
    totalMs: now
  };
}
function parseSseEvent(message) {
  const { event, data } = message;
  const parsed = parseJson(data);
  switch (event) {
    case "meta": {
      const record = asRecord$1(parsed);
      if (!record) throw new RagError("SSE meta 事件数据格式错误", "parse");
      const meta = {
        requestId: pickString$1(record, ["request_id", "requestId"]) ?? "",
        sessionId: pickString$1(record, ["session_id", "sessionId"]) ?? ""
      };
      return { type: "meta", meta, data: parsed };
    }
    case "sources":
      return { type: "sources", sources: normalizeSources(parsed), data: parsed };
    case "token": {
      const record = asRecord$1(parsed);
      if (!record) {
        if (data.trim()) return { type: "token", text: data, data };
        throw new RagError("SSE token 事件数据格式错误", "parse");
      }
      const text = pickString$1(record, ["text", "content", "delta"]);
      if (text === void 0) throw new RagError("SSE token 事件缺少 text 字段", "parse");
      return { type: "token", text, data: parsed };
    }
    case "done": {
      const record = asRecord$1(parsed);
      if (!record) throw new RagError("SSE done 事件数据格式错误", "parse");
      const done = {
        elapsedMs: pickNumber$1(record, ["elapsed_ms", "elapsedMs"]) ?? 0,
        answerChars: pickNumber$1(record, ["answer_chars", "answerChars"]) ?? 0
      };
      const timingsRecord = asRecord$1(record.timings_ms ?? record.timingsMs);
      if (timingsRecord) {
        const timingsMs = {};
        for (const [key, value] of Object.entries(timingsRecord)) {
          if (typeof value === "number" && Number.isFinite(value)) timingsMs[key] = value;
        }
        if (Object.keys(timingsMs).length > 0) done.timingsMs = timingsMs;
      }
      const cacheHit = record.cache_hit ?? record.cacheHit;
      if (typeof cacheHit === "boolean") done.cacheHit = cacheHit;
      else if (cacheHit === "true" || cacheHit === 1) done.cacheHit = true;
      else if (cacheHit === "false" || cacheHit === 0) done.cacheHit = false;
      return { type: "done", done, data: parsed };
    }
    case "error": {
      const record = asRecord$1(parsed);
      const messageText = record && pickString$1(record, ["message", "error", "detail"]) || "回答生成失败";
      return { type: "error", message: messageText, data: parsed };
    }
    default:
      return null;
  }
}
function createRagClient(config = {}) {
  const apiBaseUrl = config.apiBaseUrl ?? "";
  const ragRoot = resolveRagRoot(apiBaseUrl);
  const baseHeaders = { ...config.requestHeaders ?? {} };
  function fetcher() {
    return resolveFetch(config);
  }
  function url(path) {
    return `${ragRoot}${path}`;
  }
  async function askStream(options) {
    var _a;
    const { signal } = options;
    if (signal == null ? void 0 : signal.aborted) throw new RagError("请求已取消", "aborted");
    const body = { question: options.question };
    if (options.sessionId) body.session_id = options.sessionId;
    if (typeof options.topK === "number") body.top_k = options.topK;
    const startedAt = Date.now();
    let receivedDone = false;
    let receivedChars = 0;
    let serverError = null;
    try {
      const response = await fetcher()(url("/ask"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...baseHeaders
        },
        body: JSON.stringify(body),
        signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const parsed = parseJson(await response.text());
        const record = asRecord$1(parsed);
        const message = (record && pickString$1(record, ["message", "error", "detail"])) ?? "后端返回了非 SSE 响应";
        throw new RagError(message, "http", response.status);
      }
      if (!response.body) throw new RagError("响应缺少可读的 SSE 流", "network");
      await readSseStream(response.body, (message) => {
        var _a2, _b, _c, _d, _e, _f;
        const event = parseSseEvent(message);
        if (!event) return;
        if (event.type === "done") {
          receivedDone = true;
          (_a2 = options.onDone) == null ? void 0 : _a2.call(options, event.done);
        } else if (event.type === "token") {
          receivedChars += event.text.length;
          (_b = options.onToken) == null ? void 0 : _b.call(options, event.text);
        } else if (event.type === "sources") {
          (_c = options.onSources) == null ? void 0 : _c.call(options, event.sources);
        } else if (event.type === "meta") {
          (_d = options.onMeta) == null ? void 0 : _d.call(options, event.meta);
        } else if (event.type === "error") {
          serverError = event.message;
        }
        (_e = options.onEvent) == null ? void 0 : _e.call(options, event);
        if (event.type === "error") {
          (_f = options.onError) == null ? void 0 : _f.call(options, event.message);
          throw new RagError(event.message, "http", response.status);
        }
      });
      if (signal == null ? void 0 : signal.aborted) throw new RagError("请求已取消", "aborted");
      if (serverError) throw new RagError(serverError, "http", response.status);
      if (!receivedDone) {
        (_a = options.onDone) == null ? void 0 : _a.call(options, { elapsedMs: Date.now() - startedAt, answerChars: receivedChars });
      }
    } catch (error) {
      if ((signal == null ? void 0 : signal.aborted) && !(error instanceof RagError)) {
        throw new RagError("请求已取消", "aborted");
      }
      throw toRagError(error, "问答请求失败");
    }
  }
  async function asr(wav, options = {}) {
    var _a, _b;
    if ((_a = options.signal) == null ? void 0 : _a.aborted) throw new RagError("请求已取消", "aborted");
    try {
      const form = new FormData();
      form.append("file", wav, "audio.wav");
      if (options.sessionId) form.append("session_id", options.sessionId);
      const response = await fetcher()(url("/asr"), {
        method: "POST",
        headers: { ...baseHeaders },
        body: form,
        signal: options.signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const parsed = parseJson(await response.text());
      const record = asRecord$1(parsed);
      const text = record ? pickString$1(record, ["text", "transcript", "result"]) : void 0;
      if (text === void 0) throw new RagError("ASR 响应缺少 text 字段", "parse");
      const elapsedMs = record ? pickNumber$1(record, ["elapsed_ms", "elapsedMs"]) : void 0;
      const result = { text };
      if (elapsedMs !== void 0) result.elapsedMs = elapsedMs;
      return result;
    } catch (error) {
      if (((_b = options.signal) == null ? void 0 : _b.aborted) && !(error instanceof RagError)) {
        throw new RagError("请求已取消", "aborted");
      }
      throw toRagError(error, "语音识别失败");
    }
  }
  async function tts(options) {
    var _a, _b;
    if ((_a = options.signal) == null ? void 0 : _a.aborted) throw new RagError("请求已取消", "aborted");
    try {
      const body = buildTtsBody(options.text, options.voice, options.speed);
      const response = await fetcher()(url("/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...baseHeaders },
        body: JSON.stringify(body),
        signal: options.signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const parsed = parseJson(await response.text());
        const record = asRecord$1(parsed);
        const message = (record && pickString$1(record, ["message", "error", "detail"])) ?? "语音合成失败";
        throw new RagError(message, "http", response.status);
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) throw new RagError("语音合成返回了空音频", "parse");
      return buffer;
    } catch (error) {
      if (((_b = options.signal) == null ? void 0 : _b.aborted) && !(error instanceof RagError)) {
        throw new RagError("请求已取消", "aborted");
      }
      throw toRagError(error, "语音合成失败");
    }
  }
  async function streamTts(options) {
    var _a, _b;
    if ((_a = options.signal) == null ? void 0 : _a.aborted) throw new RagError("请求已取消", "aborted");
    const startedAt = Date.now();
    try {
      let response = null;
      let useFallback = false;
      try {
        response = await fetcher()(url("/tts/stream"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...baseHeaders },
          body: JSON.stringify(buildTtsBody(options.text, options.voice, options.speed)),
          signal: options.signal
        });
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          useFallback = true;
        } else if (!response.ok) {
          throw await httpErrorFromResponse(response);
        } else if (!parsePcmFormatFromResponse(response)) {
          useFallback = true;
        }
      } catch (error) {
        if (error instanceof RagError) throw error;
        useFallback = true;
      }
      if (useFallback || !response) {
        return await fallbackTtsToPcm(tts, options, startedAt);
      }
      const format = parsePcmFormatFromResponse(response);
      if (!format) return await fallbackTtsToPcm(tts, options, startedAt);
      if (!response.body) throw new RagError("流式 TTS 响应缺少 body", "network");
      return await consumePcmStream(response.body, format, options, startedAt);
    } catch (error) {
      if ((_b = options.signal) == null ? void 0 : _b.aborted) throw new RagError("请求已取消", "aborted");
      throw toRagError(error, "语音合成失败");
    }
  }
  async function suggestions(options = {}) {
    var _a, _b;
    const limit = Math.min(Math.max(Math.round(options.limit ?? 3), 1), 6);
    if ((_a = options.signal) == null ? void 0 : _a.aborted) throw new RagError("请求已取消", "aborted");
    try {
      const response = await fetcher()(`${url("/suggestions")}?limit=${limit}`, {
        method: "GET",
        headers: { ...baseHeaders },
        signal: options.signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const parsed = parseJson(await response.text());
      const record = asRecord$1(parsed);
      if (!record) throw new RagError("推荐问题响应不是 JSON 对象", "parse");
      const raw = Array.isArray(record.suggestions) ? record.suggestions : [];
      const list = [];
      for (const item of raw) {
        if (typeof item !== "string") continue;
        const text = item.trim();
        if (text && !list.includes(text)) list.push(text);
      }
      const result = { suggestions: list.slice(0, limit) };
      const source = pickString$1(record, ["source"]);
      if (source !== void 0) result.source = source;
      const revision = pickNumber$1(record, ["revision"]);
      if (revision !== void 0) result.revision = revision;
      return result;
    } catch (error) {
      if (((_b = options.signal) == null ? void 0 : _b.aborted) && !(error instanceof RagError)) {
        throw new RagError("请求已取消", "aborted");
      }
      throw toRagError(error, "推荐问题获取失败");
    }
  }
  async function feedback(options) {
    var _a, _b;
    const requestId = (options.requestId ?? "").trim();
    if (!requestId) throw new RagError("缺少 request_id，无法提交反馈", "unsupported");
    if ((_a = options.signal) == null ? void 0 : _a.aborted) throw new RagError("请求已取消", "aborted");
    try {
      const body = { request_id: requestId, vote: options.vote };
      const comment = (options.comment ?? "").trim();
      if (comment) body.comment = comment.slice(0, 500);
      const response = await fetcher()(url("/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...baseHeaders },
        body: JSON.stringify(body),
        signal: options.signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const parsed = parseJson(await response.text());
      const record = asRecord$1(parsed);
      if (!record) throw new RagError("反馈响应不是 JSON 对象", "parse");
      return { ok: record.ok === true };
    } catch (error) {
      if (((_b = options.signal) == null ? void 0 : _b.aborted) && !(error instanceof RagError)) {
        throw new RagError("请求已取消", "aborted");
      }
      throw toRagError(error, "反馈提交失败");
    }
  }
  async function health(options = {}) {
    try {
      const response = await fetcher()(url("/health"), {
        method: "GET",
        headers: { ...baseHeaders },
        signal: options.signal
      });
      if (!response.ok) throw await httpErrorFromResponse(response);
      const parsed = parseJson(await response.text());
      const record = asRecord$1(parsed);
      if (!record) throw new RagError("健康检查响应不是 JSON 对象", "parse");
      return record;
    } catch (error) {
      throw toRagError(error, "健康检查失败");
    }
  }
  return {
    apiBaseUrl,
    askStream,
    asr,
    tts,
    streamTts,
    suggestions,
    feedback,
    health
  };
}
const DEFAULT_CONNECT_TIMEOUT_MS$1 = 5e3;
const DEFAULT_PING_TIMEOUT_MS = 3e3;
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function pickString(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return void 0;
}
function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return void 0;
}
function pickBoolean(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return void 0;
}
function pickFlag(record, key, fallback2) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return fallback2;
}
function normalizeTimings(record) {
  const raw = asRecord(record.timings_ms ?? record.timingsMs);
  if (!raw) return void 0;
  const timings = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) timings[key] = value;
  }
  return Object.keys(timings).length > 0 ? timings : void 0;
}
function normalizeCitationList(record) {
  const raw = record.citations;
  if (!Array.isArray(raw)) return void 0;
  const citations = [];
  for (const item of raw) {
    const value = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(value) && value >= 1) citations.push(Math.round(value));
  }
  return citations.length > 0 ? Array.from(new Set(citations)).sort((a, b) => a - b) : [];
}
function normalizeDone(record) {
  const done = {
    answerChars: pickNumber(record, ["answer_chars", "answerChars"]) ?? 0
  };
  const sessionId = pickString(record, ["session_id", "sessionId"]);
  if (sessionId !== void 0) done.sessionId = sessionId;
  const requestId = pickString(record, ["request_id", "requestId"]);
  if (requestId !== void 0) done.requestId = requestId;
  const cacheHit = pickBoolean(record, ["cache_hit", "cacheHit"]);
  if (cacheHit !== void 0) done.cacheHit = cacheHit;
  const style = pickString(record, ["style"]);
  if (style !== void 0) done.style = style;
  const citations = normalizeCitationList(record);
  if (citations !== void 0) done.citations = citations;
  const timings = normalizeTimings(record);
  if (timings) done.timingsMs = timings;
  return done;
}
function normalizeReady(record) {
  const audioRecord = asRecord(record.audio) ?? {};
  const audio = {
    sampleRate: pickNumber(audioRecord, ["sample_rate", "sampleRate"]) ?? 24e3,
    channels: pickNumber(audioRecord, ["channels"]) ?? 1,
    bitsPerSample: pickNumber(audioRecord, ["bits", "bits_per_sample", "bitsPerSample"]) ?? 16
  };
  const rawLeadIns = record.lead_ins ?? record.leadIns;
  const leadIns = [];
  if (Array.isArray(rawLeadIns)) {
    rawLeadIns.forEach((item, index) => {
      const entry = asRecord(item);
      if (!entry) return;
      leadIns.push({
        id: pickString(entry, ["id"]) ?? `li-${index}`,
        text: pickString(entry, ["text"]) ?? ""
      });
    });
  }
  const featuresRecord = asRecord(record.features) ?? {};
  const features = {
    tts: pickFlag(featuresRecord, "tts", true),
    asrStream: pickFlag(featuresRecord, "asr_stream", false) || pickFlag(featuresRecord, "asrStream", false),
    citations: pickFlag(featuresRecord, "citations", false),
    sourcesHighlight: pickFlag(featuresRecord, "sources_highlight", false) || pickFlag(featuresRecord, "sourcesHighlight", false),
    asrPartial: pickFlag(featuresRecord, "asr_partial", false) || pickFlag(featuresRecord, "asrPartial", false),
    suggestions: pickFlag(featuresRecord, "suggestions", false),
    feedback: pickFlag(featuresRecord, "feedback", false),
    voice: pickFlag(featuresRecord, "voice", false),
    speed: pickFlag(featuresRecord, "speed", false)
  };
  const voices = normalizeStringList(record.voices ?? record.voice_list ?? record.voiceList);
  const speeds = normalizeNumberList(record.speeds ?? record.speed_list ?? record.speedList);
  return {
    protocol: pickNumber(record, ["protocol"]) ?? 1,
    audio,
    leadIns,
    features,
    voices,
    speeds
  };
}
function normalizeStringList(raw) {
  if (!Array.isArray(raw)) return [];
  const list = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (value && !list.includes(value)) list.push(value);
  }
  return list;
}
function normalizeNumberList(raw) {
  if (!Array.isArray(raw)) return [];
  const list = [];
  for (const item of raw) {
    const value = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!list.includes(value)) list.push(value);
  }
  return list.sort((a, b) => a - b);
}
function parseRagStreamEvent(raw) {
  const record = asRecord(raw);
  if (!record) throw new RagError("WS 事件数据格式错误", "parse");
  const type = pickString(record, ["type"]) ?? "unknown";
  switch (type) {
    case "ready":
      return { type: "ready", ready: normalizeReady(record), data: raw };
    case "meta": {
      const meta = {
        sessionId: pickString(record, ["session_id", "sessionId"]) ?? "",
        requestId: pickString(record, ["request_id", "requestId"]) ?? ""
      };
      const cacheHit = pickBoolean(record, ["cache_hit", "cacheHit"]);
      if (cacheHit !== void 0) meta.cacheHit = cacheHit;
      const style = pickString(record, ["style"]);
      if (style !== void 0) meta.style = style;
      const historyMessages = pickNumber(record, ["history_messages", "historyMessages"]);
      if (historyMessages !== void 0) meta.historyMessages = historyMessages;
      const historyChars = pickNumber(record, ["history_chars", "historyChars"]);
      if (historyChars !== void 0) meta.historyChars = historyChars;
      return { type: "meta", meta, data: raw };
    }
    case "sources": {
      const cached = pickBoolean(record, ["cached"]);
      const event = {
        type: "sources",
        sources: normalizeSources(record),
        degraded: pickBoolean(record, ["degraded"]) ?? false,
        data: raw
      };
      if (cached !== void 0) event.cached = cached;
      const style = pickString(record, ["style"]);
      if (style !== void 0) event.style = style;
      const historyDropped = pickNumber(record, ["history_dropped", "historyDropped"]);
      if (historyDropped !== void 0) event.historyDropped = historyDropped;
      return event;
    }
    case "token":
      return { type: "token", text: pickString(record, ["text", "content", "delta"]) ?? "", data: raw };
    case "segment":
      return {
        type: "segment",
        index: pickNumber(record, ["index"]) ?? 0,
        text: pickString(record, ["text"]) ?? "",
        data: raw
      };
    case "segment_end":
      return { type: "segment_end", index: pickNumber(record, ["index"]) ?? 0, data: raw };
    case "leadin_start":
      return {
        type: "leadin_start",
        id: pickString(record, ["id"]) ?? "",
        text: pickString(record, ["text"]) ?? "",
        data: raw
      };
    case "leadin_end":
      return { type: "leadin_end", id: pickString(record, ["id"]) ?? "", data: raw };
    case "text_done":
      return { type: "text_done", textDone: normalizeDone(record), data: raw };
    case "done":
      return { type: "done", done: normalizeDone(record), data: raw };
    case "error":
      return {
        type: "error",
        message: pickString(record, ["message", "error", "detail"]) ?? "回答生成失败",
        data: raw
      };
    case "aborted":
      return { type: "aborted", data: raw };
    case "pong":
      return { type: "pong", data: raw };
    default:
      return { type: "unknown", rawType: type, data: raw };
  }
}
function resolveRagWebSocketUrl(apiBaseUrl, path) {
  const ragRoot = resolveRagRoot(apiBaseUrl);
  const trimmed = ragRoot.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(trimmed)) return `${trimmed.replace(/^http/i, "ws")}${suffix}`;
  if (/^wss?:\/\//i.test(trimmed)) return `${trimmed}${suffix}`;
  const locationRef = globalThis.location;
  const origin = locationRef == null ? void 0 : locationRef.origin;
  if (!origin) {
    throw new RagError("无法解析 WebSocket 地址：请传入绝对 apiBaseUrl", "unsupported");
  }
  const root = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${origin.replace(/^http/i, "ws")}${root}${suffix}`;
}
function resolveStreamUrl(apiBaseUrl) {
  return resolveRagWebSocketUrl(apiBaseUrl, "/stream");
}
function defaultNow() {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === "function") return perf.now();
  return Date.now();
}
function defaultWebSocketFactory$1(url) {
  const Ctor = globalThis.WebSocket;
  if (typeof Ctor !== "function") {
    throw new RagError("当前环境不支持 WebSocket", "unsupported");
  }
  return new Ctor(url);
}
class RagStreamConnection {
  constructor(options = {}) {
    __publicField(this, "options");
    __publicField(this, "now");
    __publicField(this, "socket", null);
    __publicField(this, "currentState", "idle");
    __publicField(this, "readyValue", null);
    __publicField(this, "socketUrl", null);
    __publicField(this, "lastErrorValue", null);
    __publicField(this, "connectOptions", {});
    __publicField(this, "connectPromise", null);
    __publicField(this, "connectResolve", null);
    __publicField(this, "connectReject", null);
    __publicField(this, "connectTimer", null);
    __publicField(this, "signalListener", null);
    __publicField(this, "pingWaiters", []);
    this.options = options;
    this.now = options.now ?? defaultNow;
  }
  get state() {
    return this.currentState;
  }
  get connected() {
    return this.currentState === "open";
  }
  get ready() {
    return this.readyValue;
  }
  get url() {
    return this.socketUrl;
  }
  get lastError() {
    return this.lastErrorValue;
  }
  connect(apiBaseUrl, options = {}) {
    if (this.currentState === "open" && this.readyValue) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.connectOptions = options;
    this.lastErrorValue = null;
    this.readyValue = null;
    this.currentState = "connecting";
    const promise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    });
    this.connectPromise = promise;
    try {
      const url = resolveStreamUrl(apiBaseUrl);
      this.socketUrl = url;
      const factory = this.options.webSocketFactory ?? defaultWebSocketFactory$1;
      const socket = factory(url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      const isCurrentSocket = () => this.socket === socket;
      socket.onopen = () => {
      };
      socket.onmessage = (event) => {
        if (!isCurrentSocket()) return;
        this.handleMessage(event == null ? void 0 : event.data);
      };
      socket.onerror = () => {
        var _a, _b;
        if (!isCurrentSocket()) return;
        const error = new RagError("WebSocket 连接错误", "network");
        this.lastErrorValue = error;
        (_b = (_a = this.connectOptions).onError) == null ? void 0 : _b.call(_a, error);
        if (this.connectReject) this.failConnect(error);
      };
      socket.onclose = (event) => {
        if (!isCurrentSocket()) return;
        this.handleClose(event);
      };
      const signal = options.signal;
      if (signal) {
        if (signal.aborted) {
          this.lastErrorValue = new RagError("连接已取消", "aborted");
          this.failConnect(this.lastErrorValue);
          this.close();
        } else {
          this.signalListener = () => {
            this.lastErrorValue = new RagError("连接已取消", "aborted");
            this.failConnect(this.lastErrorValue);
            this.close();
          };
          signal.addEventListener("abort", this.signalListener, { once: true });
        }
      }
      const timeout = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS$1;
      this.connectTimer = setTimeout(() => {
        const error = new RagError("WS 连接超时（未收到 ready）", "network");
        this.lastErrorValue = error;
        this.failConnect(error);
        this.close();
      }, timeout);
    } catch (error) {
      const ragError = toRagError(error, "WS 连接失败");
      this.lastErrorValue = ragError;
      this.failConnect(ragError);
      this.close();
    }
    return promise;
  }
  ask(options) {
    const socket = this.socket;
    if (!socket || this.currentState !== "open") {
      throw new RagError("WS 尚未就绪，无法提问", "network");
    }
    const payload = { type: "ask", question: options.question };
    if (options.sessionId) payload.session_id = options.sessionId;
    if (typeof options.topK === "number") payload.top_k = options.topK;
    if (options.leadIn === null) payload.lead_in = null;
    else if (typeof options.leadIn === "string") payload.lead_in = options.leadIn;
    if (typeof options.voice === "string" && options.voice.trim()) payload.voice = options.voice.trim();
    if (typeof options.speed === "number" && Number.isFinite(options.speed)) {
      payload.speed = Math.round(Math.min(2, Math.max(0.5, options.speed)) * 100) / 100;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      throw toRagError(error, "发送提问失败");
    }
  }
  abort() {
    this.sendControl({ type: "abort" });
  }
  ping(timeoutMs = DEFAULT_PING_TIMEOUT_MS) {
    const socket = this.socket;
    if (!socket || this.currentState !== "open") {
      return Promise.reject(new RagError("WS 未连接，无法 ping", "network"));
    }
    const startedAt = this.now();
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: () => resolve(this.now() - startedAt),
        reject,
        timer: setTimeout(() => {
          this.removePingWaiter(waiter);
          reject(new RagError("ping 超时（未收到 pong）", "network"));
        }, timeoutMs)
      };
      this.pingWaiters.push(waiter);
      try {
        socket.send(JSON.stringify({ type: "ping" }));
      } catch (error) {
        this.removePingWaiter(waiter);
        reject(toRagError(error, "发送 ping 失败"));
      }
    });
  }
  close() {
    const socket = this.socket;
    const wasConnecting = this.connectReject !== null;
    const shouldNotify = this.currentState !== "closed" || socket !== null || wasConnecting;
    this.clearConnectTimer();
    this.clearSignal();
    this.rejectPings(new RagError("WS 连接已关闭", "network"));
    if (wasConnecting) this.failConnect(new RagError("WS 连接已关闭", "aborted"));
    this.socket = null;
    this.readyValue = null;
    this.connectPromise = null;
    this.currentState = "closed";
    if (socket) {
      try {
        socket.close(1e3, "client close");
      } catch {
      }
    }
    if (shouldNotify) {
      this.safeInvoke(
        () => {
          var _a, _b;
          return (_b = (_a = this.connectOptions).onClose) == null ? void 0 : _b.call(_a, { code: 1e3, reason: "client close", wasClean: true });
        }
      );
    }
  }
  /* ------------------------------ 内部实现 ------------------------------ */
  sendControl(payload) {
    const socket = this.socket;
    if (!socket || this.currentState !== "open") return;
    try {
      socket.send(JSON.stringify(payload));
    } catch {
    }
  }
  handleMessage(data) {
    if (typeof data === "string") {
      this.handleJson(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.deliverAudio(data);
      return;
    }
    if (ArrayBuffer.isView(data)) {
      const view = data;
      const copy = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      this.deliverAudio(copy);
      return;
    }
    const BlobCtor = globalThis.Blob;
    if (BlobCtor && data instanceof BlobCtor) {
      void data.arrayBuffer().then((buffer) => this.deliverAudio(buffer)).catch((error) => this.reportError(toRagError(error, "读取音频帧失败")));
    }
  }
  handleJson(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.reportError(new RagError("WS 消息不是合法 JSON", "parse"));
      return;
    }
    let event;
    try {
      event = parseRagStreamEvent(parsed);
    } catch (error) {
      this.reportError(toRagError(error, "WS 事件解析失败"));
      return;
    }
    if (event.type === "ready") {
      this.readyValue = event.ready;
      this.currentState = "open";
      this.clearConnectTimer();
      const resolve = this.connectResolve;
      this.connectResolve = null;
      this.connectReject = null;
      this.connectPromise = null;
      if (resolve) resolve();
      this.safeInvoke(() => {
        var _a, _b;
        return (_b = (_a = this.connectOptions).onReady) == null ? void 0 : _b.call(_a, event.ready);
      });
      this.safeInvoke(() => {
        var _a, _b;
        return (_b = (_a = this.connectOptions).onEvent) == null ? void 0 : _b.call(_a, event);
      });
      return;
    }
    if (event.type === "pong") {
      const waiters = this.pingWaiters;
      this.pingWaiters = [];
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
    }
    if (event.type === "error") {
      const error = new RagError(event.message, "http");
      this.lastErrorValue = error;
      this.safeInvoke(() => {
        var _a, _b;
        return (_b = (_a = this.connectOptions).onError) == null ? void 0 : _b.call(_a, error);
      });
    }
    this.safeInvoke(() => {
      var _a, _b;
      return (_b = (_a = this.connectOptions).onEvent) == null ? void 0 : _b.call(_a, event);
    });
  }
  deliverAudio(chunk) {
    if (chunk.byteLength === 0) return;
    this.safeInvoke(() => {
      var _a, _b;
      return (_b = (_a = this.connectOptions).onAudio) == null ? void 0 : _b.call(_a, chunk);
    });
  }
  reportError(error) {
    this.lastErrorValue = error;
    this.safeInvoke(() => {
      var _a, _b;
      return (_b = (_a = this.connectOptions).onError) == null ? void 0 : _b.call(_a, error);
    });
  }
  safeInvoke(callback) {
    try {
      callback();
    } catch {
    }
  }
  handleClose(event) {
    this.clearConnectTimer();
    this.clearSignal();
    this.socket = null;
    this.readyValue = null;
    this.rejectPings(new RagError("WS 连接已关闭", "network"));
    const wasConnecting = this.connectReject !== null;
    this.connectPromise = null;
    this.currentState = "closed";
    if (wasConnecting) {
      this.failConnect(new RagError("WS 连接在 ready 之前关闭", "network"));
    }
    const info = {
      code: typeof (event == null ? void 0 : event.code) === "number" ? event.code : 0,
      reason: typeof (event == null ? void 0 : event.reason) === "string" ? event.reason : "",
      wasClean: Boolean(event == null ? void 0 : event.wasClean)
    };
    this.safeInvoke(() => {
      var _a, _b;
      return (_b = (_a = this.connectOptions).onClose) == null ? void 0 : _b.call(_a, info);
    });
  }
  failConnect(error) {
    this.lastErrorValue = error;
    const reject = this.connectReject;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectPromise = null;
    this.clearConnectTimer();
    if (reject) reject(error);
  }
  clearConnectTimer() {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }
  clearSignal() {
    const signal = this.connectOptions.signal;
    if (signal && this.signalListener) {
      signal.removeEventListener("abort", this.signalListener);
    }
    this.signalListener = null;
  }
  removePingWaiter(waiter) {
    const index = this.pingWaiters.indexOf(waiter);
    if (index >= 0) this.pingWaiters.splice(index, 1);
    clearTimeout(waiter.timer);
  }
  rejectPings(error) {
    const waiters = this.pingWaiters;
    this.pingWaiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}
function createRagStreamConnection(options = {}) {
  return new RagStreamConnection(options);
}
const DEFAULT_SCHEDULE_AHEAD = 0.08;
const MIN_SCHEDULE_AHEAD = 5e-3;
const IDLE_TIMEOUT_MS = 1e4;
function getAudioContextCtor$2() {
  const globalRef = globalThis;
  return globalRef.AudioContext ?? globalRef.webkitAudioContext;
}
function createPcmStreamPlayer(options = {}) {
  let context = null;
  let analyser = null;
  let amplitudeData = null;
  let rafId = 0;
  let smoothedLevel = 0;
  let state = "idle";
  let disposed = false;
  let nextStartTime = 0;
  let openSegments = 0;
  const scheduledSources = /* @__PURE__ */ new Set();
  let idleWaiters = [];
  const scheduleAhead = Math.max(
    MIN_SCHEDULE_AHEAD,
    options.scheduleAheadTime ?? DEFAULT_SCHEDULE_AHEAD
  );
  function setState(next) {
    var _a;
    if (state === next) return;
    state = next;
    (_a = options.onStateChange) == null ? void 0 : _a.call(options, next);
  }
  function notifyAmplitude(level, speaking) {
    var _a;
    (_a = options.onAmplitude) == null ? void 0 : _a.call(options, level, speaking);
  }
  function createContext() {
    if (context) return context;
    let ctx;
    if (options.audioContextFactory) {
      ctx = options.audioContextFactory();
    } else {
      const Ctor = getAudioContextCtor$2();
      if (!Ctor) throw new RagError("当前环境不支持 Web Audio", "unsupported");
      ctx = new Ctor();
    }
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.5;
    analyserNode.connect(ctx.destination);
    context = ctx;
    analyser = analyserNode;
    amplitudeData = new Float32Array(analyserNode.fftSize);
    return ctx;
  }
  function isQuiet() {
    return scheduledSources.size === 0 && openSegments === 0;
  }
  function resolveIdleWaiters() {
    if (idleWaiters.length === 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
  function finishIfQuiet() {
    if (disposed) return;
    if (!isQuiet()) return;
    nextStartTime = 0;
    if (state !== "idle") {
      setState("idle");
      stopLevelLoop();
      notifyAmplitude(0, false);
    }
    resolveIdleWaiters();
  }
  function stopLevelLoop() {
    if (rafId !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
    rafId = 0;
    smoothedLevel = 0;
  }
  function startLevelLoop() {
    if (rafId !== 0) return;
    if (typeof requestAnimationFrame !== "function") return;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!analyser || !amplitudeData) return;
      analyser.getFloatTimeDomainData(amplitudeData);
      let sum = 0;
      for (let i = 0; i < amplitudeData.length; i += 1) {
        const value = amplitudeData[i] ?? 0;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / amplitudeData.length);
      const level = Math.min(1, rms * 3.4);
      smoothedLevel = smoothedLevel * 0.55 + level * 0.45;
      notifyAmplitude(smoothedLevel, true);
    };
    rafId = requestAnimationFrame(tick);
  }
  function push(samples, format) {
    if (disposed || samples.length === 0) return;
    let ctx;
    try {
      ctx = createContext();
    } catch {
      return;
    }
    const channels = Math.max(1, format.channels || 1);
    const frames = Math.floor(samples.length / channels);
    if (frames <= 0) return;
    let buffer;
    try {
      buffer = ctx.createBuffer(channels, frames, format.sampleRate);
    } catch {
      return;
    }
    for (let channel = 0; channel < channels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) {
        const sample = samples[frame * channels + channel] ?? 0;
        data[frame] = sample / 32768;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (analyser) source.connect(analyser);
    else source.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(nextStartTime, now + scheduleAhead);
    nextStartTime = startAt + buffer.duration;
    scheduledSources.add(source);
    source.onended = () => {
      scheduledSources.delete(source);
      finishIfQuiet();
    };
    try {
      source.start(startAt);
    } catch {
      scheduledSources.delete(source);
      try {
        source.disconnect();
      } catch {
      }
      finishIfQuiet();
      return;
    }
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
      });
    }
    if (state !== "playing") {
      setState("playing");
      startLevelLoop();
    }
  }
  return {
    get state() {
      return state;
    },
    get speaking() {
      return state === "playing";
    },
    async ensureReady() {
      if (disposed) throw new RagError("播放器已释放", "unsupported");
      const ctx = createContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
        }
      }
    },
    startSegment(_format) {
      if (disposed) return;
      openSegments += 1;
      try {
        createContext();
      } catch {
      }
    },
    push,
    endSegment() {
      if (disposed) return;
      if (openSegments > 0) openSegments -= 1;
      finishIfQuiet();
    },
    whenIdle() {
      if (disposed || isQuiet()) return Promise.resolve();
      return new Promise((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          const index = idleWaiters.indexOf(settle);
          if (index >= 0) idleWaiters.splice(index, 1);
          settle();
        }, IDLE_TIMEOUT_MS);
        idleWaiters.push(settle);
      });
    },
    stop() {
      if (disposed) return;
      const sources = Array.from(scheduledSources);
      scheduledSources.clear();
      nextStartTime = 0;
      openSegments = 0;
      for (const source of sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
        }
        try {
          source.disconnect();
        } catch {
        }
      }
      if (state !== "idle") setState("idle");
      stopLevelLoop();
      notifyAmplitude(0, false);
      resolveIdleWaiters();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const sources = Array.from(scheduledSources);
      scheduledSources.clear();
      for (const source of sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
        }
        try {
          source.disconnect();
        } catch {
        }
      }
      const ctx = context;
      context = null;
      analyser = null;
      amplitudeData = null;
      openSegments = 0;
      nextStartTime = 0;
      stopLevelLoop();
      resolveIdleWaiters();
      if (ctx) {
        void ctx.close().catch(() => {
        });
      }
    }
  };
}
let counter = 0;
function createMessageId() {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    try {
      return `msg_${cryptoRef.randomUUID()}`;
    } catch {
    }
  }
  counter += 1;
  return `msg_${Date.now().toString(36)}_${counter}`;
}
const TERMINATORS = /* @__PURE__ */ new Set(["。", "！", "？", "；", "!", "?", ";", "\n", "…"]);
const CLOSERS = /* @__PURE__ */ new Set(["”", "’", "」", "』", "）", ")", "】", "》", '"', "'", "…"]);
const SOFT_BREAKS = /* @__PURE__ */ new Set(["，", ",", "、", "：", ":"]);
function extractCompleteSentences(buffer) {
  const sentences = [];
  let start = 0;
  let i = 0;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === void 0 || !TERMINATORS.has(ch)) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < buffer.length) {
      const next = buffer[end];
      if (next === void 0 || !CLOSERS.has(next)) break;
      end += 1;
    }
    const candidate = buffer.slice(start, end).trim();
    if (candidate.length >= 2) {
      sentences.push(candidate);
      start = end;
      i = end;
    } else {
      i = end;
    }
  }
  return { sentences, rest: buffer.slice(start) };
}
function splitBySoftBreaks(text) {
  const parts = [];
  let current = "";
  for (const ch of text) {
    current += ch;
    if (SOFT_BREAKS.has(ch)) {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts;
}
function splitLongSentence(sentence, maxLength) {
  if (sentence.length <= maxLength) return [sentence];
  const result = [];
  let current = "";
  for (const part of splitBySoftBreaks(sentence)) {
    if (current.length + part.length > maxLength && current.length > 0) {
      result.push(current);
      current = "";
    }
    if (part.length > maxLength) {
      for (let i = 0; i < part.length; i += maxLength) {
        result.push(part.slice(i, i + maxLength));
      }
    } else {
      current += part;
    }
  }
  if (current) result.push(current);
  return result.filter((s) => s.trim().length > 0);
}
function splitSentences(text, options = {}) {
  const maxLength = options.maxLength ?? 120;
  const { sentences, rest } = extractCompleteSentences(text);
  const all = rest.trim() ? [...sentences, rest.trim()] : sentences;
  return all.flatMap((sentence) => splitLongSentence(sentence, maxLength));
}
const SPEAK_HARD = /* @__PURE__ */ new Set(["。", "！", "？", "；", "!", "?", ";", "\n", "…"]);
const SPEAK_SOFT = /* @__PURE__ */ new Set(["，", ",", "、", "：", ":"]);
function chunkSpeakable(text, maxLength) {
  const source = text.trim();
  if (!source) return [];
  if (source.length <= maxLength) return [source];
  const chunks = [];
  let current = "";
  for (const ch of source) {
    current += ch;
    const softCut = SPEAK_SOFT.has(ch) && current.length >= Math.max(4, Math.floor(maxLength * 0.6));
    if (softCut || current.length >= maxLength) {
      const piece = current.trim();
      if (piece) chunks.push(piece);
      current = "";
    }
  }
  const tail = current.trim();
  if (tail) chunks.push(tail);
  return chunks;
}
function extractSpeakableSegments(buffer, options = {}) {
  const maxLength = options.maxLength ?? 24;
  const minLength = options.minLength ?? 2;
  const firstMinLength = options.firstMinLength ?? 4;
  const firstSoftMin = options.firstSoftMin ?? 4;
  const firstMaxLength = options.firstMaxLength ?? 10;
  const softMin = options.softMin ?? 14;
  const eagerFirst = options.eagerFirst ?? true;
  const segments = [];
  let emitted = 0;
  let start = 0;
  let i = 0;
  const emit = (raw) => {
    const pieces = chunkSpeakable(raw, maxLength);
    for (const piece of pieces) {
      segments.push(piece);
      emitted += 1;
    }
  };
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === void 0) break;
    if (SPEAK_HARD.has(ch) || SPEAK_SOFT.has(ch)) {
      let end = i + 1;
      while (end < buffer.length) {
        const next = buffer[end];
        if (next === void 0 || !CLOSERS.has(next)) break;
        end += 1;
      }
      const candidate = buffer.slice(start, end).trim();
      const eager = eagerFirst && emitted === 0;
      const requiredLength = eager ? Math.max(minLength, firstMinLength) : minLength;
      if (candidate.length >= requiredLength) {
        if (SPEAK_HARD.has(ch)) {
          emit(candidate);
          start = end;
          i = end;
          continue;
        }
        const threshold = eager ? firstSoftMin : softMin;
        if (candidate.length >= threshold) {
          emit(candidate);
          start = end;
          i = end;
          continue;
        }
      }
      i = end;
      continue;
    }
    const forceLimit = eagerFirst && emitted === 0 ? Math.min(maxLength, firstMaxLength) : maxLength;
    if (i - start + 1 >= forceLimit) {
      const candidate = buffer.slice(start, i + 1).trim();
      if (candidate.length >= minLength) emit(candidate);
      start = i + 1;
    }
    i += 1;
  }
  return { segments, rest: buffer.slice(start) };
}
function splitSpeakableText(text, options = {}) {
  const maxLength = options.maxLength ?? 24;
  const { segments, rest } = extractSpeakableSegments(text, options);
  const tail = rest.trim();
  if (tail) segments.push(...chunkSpeakable(tail, maxLength));
  return segments;
}
const TTS_TIMEOUT_MS = 2e4;
const WS_ROUND_TIMEOUT_MS = 12e4;
function nowMs() {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === "function") return perf.now();
  return Date.now();
}
function createPcmFrameAssembler() {
  let carry = new Uint8Array(0);
  return (chunk) => {
    const incoming = new Uint8Array(chunk);
    let merged;
    if (carry.byteLength > 0) {
      merged = new Uint8Array(carry.byteLength + incoming.byteLength);
      merged.set(carry, 0);
      merged.set(incoming, carry.byteLength);
    } else {
      merged = incoming;
    }
    const evenLength = merged.byteLength - merged.byteLength % 2;
    if (evenLength === 0) {
      carry = merged;
      return null;
    }
    const samples = new Int16Array(evenLength / 2);
    const view = new DataView(merged.buffer, merged.byteOffset, evenLength);
    for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true);
    carry = merged.slice(evenLength);
    return samples;
  };
}
function resolveLeadInId(ready, setting) {
  var _a;
  if (setting === false) return null;
  const list = (ready == null ? void 0 : ready.leadIns) ?? [];
  if (list.length === 0) return void 0;
  if (setting === true) return (_a = list[0]) == null ? void 0 : _a.id;
  const key = setting.trim();
  if (!key) return void 0;
  const byId = list.find((item) => item.id === key);
  if (byId) return byId.id;
  const byText = list.find((item) => item.text === key);
  if (byText) return byText.id;
  return key;
}
function useRagChat(options = {}) {
  const client = options.client ?? createRagClient({
    apiBaseUrl: options.apiBaseUrl ?? "",
    requestHeaders: options.requestHeaders,
    fetch: options.fetch
  });
  const resolvedApiBaseUrl = options.apiBaseUrl ?? client.apiBaseUrl;
  const streamMode = options.streamMode ?? "auto";
  const leadInSetting = options.leadIn ?? false;
  const autoSpeak = options.autoSpeak ?? true;
  const ownsPlayer = !options.player;
  let voiceSetting = (options.voice ?? options.ttsVoice ?? "").trim() || void 0;
  let speedSetting = normalizeSpeed(options.speed) ?? DEFAULT_TTS_SPEED;
  const messages = ref([]);
  const sources = ref([]);
  const state = ref("idle");
  const error = ref(null);
  const amplitude = ref(0);
  const speaking = ref(false);
  const transcribing = ref(false);
  const voice = ref(voiceSetting);
  const speed = ref(speedSetting);
  const ready = ref(null);
  const voices = ref([]);
  const speeds = ref([]);
  const speakingSegment = ref(null);
  const persistSession = options.persistSession ?? true;
  const sessionStorageKey = "pp7-rag-session:" + (resolvedApiBaseUrl || "(same-origin)");
  const readStoredSession = () => {
    var _a;
    if (!persistSession) return void 0;
    try {
      const value = (_a = globalThis.sessionStorage) == null ? void 0 : _a.getItem(sessionStorageKey);
      return value || void 0;
    } catch {
      return void 0;
    }
  };
  const writeStoredSession = (value) => {
    var _a, _b;
    if (!persistSession) return;
    try {
      if (value) (_a = globalThis.sessionStorage) == null ? void 0 : _a.setItem(sessionStorageKey, value);
      else (_b = globalThis.sessionStorage) == null ? void 0 : _b.removeItem(sessionStorageKey);
    } catch {
    }
  };
  const sessionId = ref(options.sessionId ?? readStoredSession());
  const metrics = ref({});
  const player = ref(options.player ?? null);
  const busy = computed(() => state.value === "loading" || state.value === "streaming");
  let streamController = null;
  let speechController = null;
  let speechPumpOwner = 0;
  let speechWaiters = [];
  let runToken = 0;
  let disposed = false;
  const lifetimeController = new AbortController();
  let wsConnection = null;
  let wsConnectPromise = null;
  let wsReady = null;
  let wsUnavailable = false;
  let activeWsToken = null;
  let wsEventSink = null;
  let wsAudioSink = null;
  let wsErrorSink = null;
  let wsCloseSink = null;
  let wsRunAbort = null;
  let wsEventDeferred = null;
  function setState(next) {
    var _a;
    if (state.value === next) return;
    state.value = next;
    (_a = options.onStateChange) == null ? void 0 : _a.call(options, next);
  }
  function setVoice(next) {
    voiceSetting = (next ?? "").trim() || void 0;
    voice.value = voiceSetting;
  }
  function setSpeed(next) {
    speedSetting = normalizeSpeed(next) ?? DEFAULT_TTS_SPEED;
    speed.value = speedSetting;
  }
  function notifySpeechIdle() {
    if (speechWaiters.length === 0) return;
    const waiters = speechWaiters;
    speechWaiters = [];
    for (const resolve of waiters) resolve();
  }
  function clearSpeech() {
    const controller = speechController;
    speechController = null;
    controller == null ? void 0 : controller.abort();
    notifySpeechIdle();
  }
  function ensurePlayer() {
    if (!player.value) {
      player.value = createPcmStreamPlayer({
        onAmplitude(level, isSpeakingNow) {
          amplitude.value = level;
          speaking.value = isSpeakingNow;
        }
      });
    }
    return player.value;
  }
  function buildMetrics(round, totalMs) {
    const next = {};
    if (round.streamModeUsed) next.streamMode = round.streamModeUsed;
    if (round.ttftMs !== void 0) next.ttftMs = round.ttftMs;
    if (round.firstTtsRequestMs !== void 0) next.firstTtsRequestMs = round.firstTtsRequestMs;
    if (round.firstAudioMs !== void 0) next.firstAudioMs = round.firstAudioMs;
    if (round.firstAnswerAudioMs !== void 0) next.firstAnswerAudioMs = round.firstAnswerAudioMs;
    if (round.leadInMs !== void 0) next.leadInMs = round.leadInMs;
    if (round.textDoneMs !== void 0) next.textDoneMs = round.textDoneMs;
    if (round.doneMs !== void 0) next.doneMs = round.doneMs;
    if (totalMs !== void 0) next.totalMs = totalMs;
    if (round.timingsMs !== void 0) next.timingsMs = round.timingsMs;
    if (round.cacheHit !== void 0) next.cacheHit = round.cacheHit;
    return next;
  }
  function patchMetrics(round) {
    metrics.value = buildMetrics(round);
  }
  function applyRoundMeta(round, meta) {
    if (meta.sessionId) {
      sessionId.value = meta.sessionId;
      writeStoredSession(meta.sessionId);
    }
    if (meta.requestId) {
      round.requestId = meta.requestId;
      round.assistant.requestId = meta.requestId;
    }
    if (meta.style) {
      round.style = meta.style;
      round.assistant.style = meta.style;
    }
    if (meta.cacheHit !== void 0) round.cacheHit = meta.cacheHit;
  }
  function syncSpeakingSegment(round) {
    if (!round) {
      speakingSegment.value = null;
      return;
    }
    const index = round.activeSegments.length > 0 ? round.activeSegments[round.activeSegments.length - 1] : void 0;
    if (index === void 0) {
      speakingSegment.value = null;
      return;
    }
    const range = round.segmentRanges.get(index);
    if (!range) {
      speakingSegment.value = null;
      return;
    }
    speakingSegment.value = {
      messageId: round.assistant.id,
      index,
      text: round.segmentTexts.get(index) ?? "",
      start: range.start,
      end: range.end
    };
  }
  function flushPendingSegments(round, dropUnlocatable = false) {
    for (; ; ) {
      const head = round.pendingSegments[0];
      if (!head) break;
      const range = locateSegmentText(round.assistant.content, round.segmentCursor, head.text);
      if (!range) {
        if (!dropUnlocatable) break;
        round.pendingSegments.shift();
        continue;
      }
      round.segmentRanges.set(head.index, range);
      round.segmentCursor = range.end;
      round.pendingSegments.shift();
    }
    syncSpeakingSegment(round);
  }
  function trackSegment(round, index, text) {
    round.segmentTexts.set(index, text);
    if (!round.activeSegments.includes(index)) round.activeSegments.push(index);
    round.pendingSegments.push({ index, text });
    flushPendingSegments(round);
  }
  function endSegment(round, index) {
    const at = round.activeSegments.indexOf(index);
    if (at >= 0) round.activeSegments.splice(at, 1);
    syncSpeakingSegment(round);
  }
  function clearSegments(round) {
    if (round) {
      round.activeSegments = [];
      round.pendingSegments = [];
      round.segmentRanges.clear();
      round.segmentTexts.clear();
    }
    speakingSegment.value = null;
  }
  function ensureWsConnection() {
    if (streamMode === "sse") {
      return Promise.reject(new RagError("当前为 SSE 模式", "unsupported"));
    }
    if (wsUnavailable) {
      return Promise.reject(new RagError("WS 流式连接不可用", "network"));
    }
    if (wsConnection == null ? void 0 : wsConnection.connected) return Promise.resolve(wsConnection);
    if (wsConnectPromise) return wsConnectPromise;
    if (typeof WebSocket === "undefined") {
      if (streamMode === "auto") wsUnavailable = true;
      return Promise.reject(new RagError("当前环境不支持 WebSocket", "unsupported"));
    }
    const connection = new RagStreamConnection();
    wsConnection = connection;
    let ownPromise = null;
    const isCurrentConnection = () => wsConnection === connection;
    ownPromise = connection.connect(resolvedApiBaseUrl, {
      signal: lifetimeController.signal,
      connectTimeoutMs: options.streamConnectTimeoutMs,
      onReady: (readyValue) => {
        if (!isCurrentConnection()) return;
        wsReady = readyValue;
        ready.value = readyValue;
        voices.value = readyValue.voices ?? [];
        speeds.value = readyValue.speeds ?? [];
      },
      onEvent: (event) => {
        if (!isCurrentConnection()) return;
        wsEventSink == null ? void 0 : wsEventSink(event);
      },
      onAudio: (chunk) => {
        if (!isCurrentConnection()) return;
        wsAudioSink == null ? void 0 : wsAudioSink(chunk);
      },
      onError: (streamError) => {
        if (!isCurrentConnection()) return;
        wsErrorSink == null ? void 0 : wsErrorSink(streamError);
      },
      onClose: () => {
        const wasCurrent = isCurrentConnection();
        if (wsConnectPromise === ownPromise) wsConnectPromise = null;
        if (!wasCurrent) return;
        wsConnection = null;
        wsReady = null;
        ready.value = null;
        wsCloseSink == null ? void 0 : wsCloseSink();
      }
    }).then(() => connection).catch((streamError) => {
      if (wsConnectPromise === ownPromise) wsConnectPromise = null;
      if (isCurrentConnection()) {
        wsConnection = null;
        wsReady = null;
        ready.value = null;
        connection.close();
      }
      throw streamError;
    });
    wsConnectPromise = ownPromise;
    return ownPromise;
  }
  function releaseWsSinks(roundToken) {
    if (activeWsToken !== roundToken) return;
    activeWsToken = null;
    wsEventSink = null;
    wsAudioSink = null;
    wsErrorSink = null;
    wsCloseSink = null;
    wsRunAbort = null;
  }
  async function primeAudio() {
    if (disposed) return;
    if (streamMode !== "sse" && !wsUnavailable) {
      void ensureWsConnection().catch((streamError) => {
        if (streamMode === "auto" && !isAbortError(streamError)) wsUnavailable = true;
      });
    }
    try {
      await ensurePlayer().ensureReady();
    } catch {
    }
  }
  function interrupt() {
    runToken += 1;
    const controller = streamController;
    streamController = null;
    controller == null ? void 0 : controller.abort();
    const abortRun = wsRunAbort;
    wsRunAbort = null;
    if (activeWsToken !== null && wsConnection) {
      try {
        wsConnection.abort();
      } catch {
      }
    }
    activeWsToken = null;
    wsEventSink = null;
    wsAudioSink = null;
    wsErrorSink = null;
    wsCloseSink = null;
    abortRun == null ? void 0 : abortRun();
    wsEventDeferred = null;
    speakingSegment.value = null;
    clearSpeech();
    if (player.value) player.value.stop();
    amplitude.value = 0;
    speaking.value = false;
    if (state.value !== "idle" && state.value !== "error") setState("idle");
  }
  async function selectStream() {
    if (streamMode === "sse") return { mode: "sse" };
    try {
      const connection = await ensureWsConnection();
      return { mode: "ws", connection };
    } catch (streamError) {
      if (disposed || isAbortError(streamError)) throw new RagError("请求已取消", "aborted");
      if (streamMode === "ws") throw toRagError(streamError, "流式连接失败");
      wsUnavailable = true;
      return { mode: "sse" };
    }
  }
  async function ask(question) {
    var _a;
    const text = question.trim();
    if (!text || disposed) return;
    interrupt();
    const token = runToken;
    const isCurrent = () => !disposed && token === runToken;
    const askStartedAt = nowMs();
    error.value = null;
    sources.value = [];
    metrics.value = {};
    messages.value.push({
      id: createMessageId(),
      role: "user",
      content: text,
      createdAt: Date.now()
    });
    messages.value.push({
      id: createMessageId(),
      role: "assistant",
      content: "",
      sources: [],
      streaming: true,
      createdAt: Date.now()
    });
    const assistant = messages.value[messages.value.length - 1];
    setState("loading");
    const controller = new AbortController();
    streamController = controller;
    const round = {
      token,
      question: text,
      isCurrent,
      assistant,
      controller,
      askStartedAt,
      elapsedMs: 0,
      segmentCursor: 0,
      segmentRanges: /* @__PURE__ */ new Map(),
      segmentTexts: /* @__PURE__ */ new Map(),
      activeSegments: [],
      pendingSegments: []
    };
    try {
      const selection = await selectStream();
      if (!isCurrent()) return;
      if (selection.mode === "ws") {
        round.streamModeUsed = "ws";
        await runWsRound(round, selection.connection);
      } else {
        round.streamModeUsed = "sse";
        await runSseRound(round);
      }
      if (!isCurrent()) return;
      finalizeRound(round);
    } catch (askError) {
      if (!isCurrent()) return;
      if (isAbortError(askError)) return;
      const ragError = toRagError(askError, "回答生成失败");
      assistant.streaming = false;
      error.value = ragError.message;
      assistant.error = ragError.message;
      setState("error");
      metrics.value = buildMetrics(round);
      (_a = options.onError) == null ? void 0 : _a.call(options, ragError);
    } finally {
      assistant.streaming = false;
      if (streamController === controller) streamController = null;
      releaseWsSinks(token);
    }
  }
  function finalizeRound(round) {
    var _a;
    round.assistant.streaming = false;
    clearSegments(round);
    if (!round.citations && round.assistant.content) {
      const derived = extractCitationNumbers(round.assistant.content);
      if (derived.length > 0) round.citations = derived;
    }
    if (round.citations && round.assistant.citations === void 0) {
      round.assistant.citations = round.citations;
    }
    setState("idle");
    const totalMs = nowMs() - round.askStartedAt;
    metrics.value = buildMetrics(round, totalMs);
    const payload = {
      text: round.assistant.content,
      sources: round.assistant.sources ?? [],
      elapsedMs: round.elapsedMs,
      totalMs,
      message: round.assistant
    };
    if (round.ttftMs !== void 0) payload.ttftMs = round.ttftMs;
    if (round.firstAudioMs !== void 0) payload.firstAudioMs = round.firstAudioMs;
    if (round.firstAnswerAudioMs !== void 0) payload.firstAnswerAudioMs = round.firstAnswerAudioMs;
    if (round.leadInMs !== void 0) payload.leadInMs = round.leadInMs;
    if (round.textDoneMs !== void 0) payload.textDoneMs = round.textDoneMs;
    if (round.streamModeUsed !== void 0) payload.streamMode = round.streamModeUsed;
    if (round.timingsMs !== void 0) payload.timingsMs = round.timingsMs;
    if (round.cacheHit !== void 0) payload.cacheHit = round.cacheHit;
    if (round.requestId !== void 0) payload.requestId = round.requestId;
    if (round.style !== void 0) payload.style = round.style;
    if (round.citations !== void 0) payload.citations = round.citations;
    if (voiceSetting !== void 0) payload.voice = voiceSetting;
    payload.speed = speedSetting;
    (_a = options.onAnswer) == null ? void 0 : _a.call(options, payload);
  }
  async function runSseRound(round) {
    var _a;
    const { token, question, isCurrent, assistant, controller, askStartedAt } = round;
    let sentenceBuffer = "";
    let speechSegmentCount = 0;
    const speechQueue = [];
    const waitForSpeech = () => {
      if (speechPumpOwner !== token) return Promise.resolve();
      return new Promise((resolve) => {
        speechWaiters.push(resolve);
      });
    };
    const startSpeechPump = () => {
      if (speechPumpOwner === token) return;
      speechPumpOwner = token;
      void (async () => {
        try {
          while (isCurrent() && speechQueue.length > 0) {
            const speechText = speechQueue.shift();
            if (!speechText) continue;
            if (round.firstTtsRequestMs === void 0) {
              round.firstTtsRequestMs = nowMs() - askStartedAt;
              patchMetrics(round);
            }
            const ttsController = new AbortController();
            speechController = ttsController;
            const timeout = setTimeout(() => ttsController.abort(), TTS_TIMEOUT_MS);
            let segmentOpen = false;
            try {
              await client.streamTts({
                text: speechText,
                voice: voiceSetting,
                speed: speedSetting,
                signal: ttsController.signal,
                onFormat: (format) => {
                  if (!isCurrent()) return;
                  ensurePlayer().startSegment(format);
                  segmentOpen = true;
                },
                onChunk: (chunk) => {
                  if (!isCurrent()) return;
                  const activePlayer = ensurePlayer();
                  if (!segmentOpen) {
                    activePlayer.startSegment(chunk.format);
                    segmentOpen = true;
                  }
                  if (round.firstAudioMs === void 0) {
                    round.firstAudioMs = nowMs() - askStartedAt;
                    patchMetrics(round);
                  }
                  activePlayer.push(chunk.samples, chunk.format);
                }
              });
            } catch (ttsError) {
              if (!isCurrent() || isAbortError(ttsError)) return;
            } finally {
              clearTimeout(timeout);
              if (speechController === ttsController) speechController = null;
              if (segmentOpen && isCurrent()) ensurePlayer().endSegment();
            }
          }
        } finally {
          if (speechPumpOwner === token) {
            speechPumpOwner = 0;
            notifySpeechIdle();
            if (isCurrent() && speechQueue.length > 0) startSpeechPump();
          }
        }
      })();
    };
    const scheduleSpeech = (segment) => {
      if (!autoSpeak || !isCurrent()) return;
      const piece = segment.trim();
      if (!piece) return;
      speechQueue.push(piece);
      speechSegmentCount += 1;
      startSpeechPump();
    };
    await client.askStream({
      question,
      sessionId: sessionId.value,
      topK: options.topK,
      signal: controller.signal,
      onMeta(meta) {
        if (!isCurrent()) return;
        applyRoundMeta(round, { sessionId: meta.sessionId, requestId: meta.requestId });
      },
      onSources(list) {
        var _a2;
        if (!isCurrent()) return;
        sources.value = list;
        assistant.sources = list;
        (_a2 = options.onSources) == null ? void 0 : _a2.call(options, list);
      },
      onToken(chunk) {
        if (!isCurrent()) return;
        if (round.ttftMs === void 0) {
          round.ttftMs = nowMs() - askStartedAt;
          patchMetrics(round);
        }
        assistant.content += chunk;
        if (state.value === "loading") setState("streaming");
        if (!autoSpeak) return;
        sentenceBuffer += chunk;
        const { segments, rest } = extractSpeakableSegments(sentenceBuffer, {
          eagerFirst: speechSegmentCount === 0
        });
        sentenceBuffer = rest;
        for (const segment of segments) scheduleSpeech(segment);
      },
      onDone(done) {
        if (!isCurrent()) return;
        round.elapsedMs = done.elapsedMs;
        round.timingsMs = done.timingsMs;
        round.doneMs = nowMs() - askStartedAt;
        round.cacheHit = done.cacheHit;
        patchMetrics(round);
      }
    });
    if (!isCurrent()) return;
    assistant.streaming = false;
    if (sentenceBuffer.trim()) {
      for (const segment of splitSpeakableText(sentenceBuffer, { eagerFirst: false })) {
        scheduleSpeech(segment);
      }
      sentenceBuffer = "";
    }
    const hasPendingSpeech = speechSegmentCount > 0 && (speechPumpOwner === token || ((_a = player.value) == null ? void 0 : _a.speaking) === true);
    if (hasPendingSpeech) setState("speaking");
    if (speechSegmentCount > 0) {
      await waitForSpeech();
      const activePlayer = player.value;
      if (activePlayer) await activePlayer.whenIdle();
    }
  }
  async function runWsRound(round, connection) {
    const { token, question, isCurrent, assistant, controller, askStartedAt } = round;
    const readyValue = connection.ready ?? wsReady;
    const format = (readyValue == null ? void 0 : readyValue.audio) ?? { sampleRate: 24e3, channels: 1, bitsPerSample: 16 };
    const leadInId = autoSpeak ? resolveLeadInId(readyValue, leadInSetting) : null;
    const assemble = createPcmFrameAssembler();
    let openSegments = 0;
    let receivedAudio = false;
    let settled = false;
    activeWsToken = token;
    const donePromise = new Promise((resolve, reject) => {
      wsEventDeferred = {
        finish: () => {
          if (settled) return;
          settled = true;
          resolve();
        },
        fail: (reason) => {
          if (settled) return;
          settled = true;
          reject(reason);
        }
      };
    });
    wsRunAbort = () => wsEventDeferred == null ? void 0 : wsEventDeferred.fail(new RagError("请求已取消", "aborted"));
    const onAbort = () => {
      wsRunAbort == null ? void 0 : wsRunAbort();
    };
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort);
    wsEventSink = (event) => {
      var _a;
      if (!isCurrent()) return;
      switch (event.type) {
        case "meta":
          applyRoundMeta(round, event.meta);
          break;
        case "sources":
          sources.value = event.sources;
          assistant.sources = event.sources;
          if (event.style) {
            round.style = event.style;
            assistant.style = event.style;
          }
          (_a = options.onSources) == null ? void 0 : _a.call(options, event.sources);
          break;
        case "token": {
          if (!event.text) break;
          if (round.ttftMs === void 0) {
            round.ttftMs = nowMs() - askStartedAt;
            patchMetrics(round);
          }
          assistant.content += event.text;
          if (state.value === "loading") setState("streaming");
          flushPendingSegments(round);
          break;
        }
        case "leadin_start":
          round.leadInMs = nowMs() - askStartedAt;
          if (autoSpeak) ensurePlayer().startSegment(format);
          break;
        case "leadin_end":
          if (autoSpeak) ensurePlayer().endSegment();
          break;
        case "segment":
          openSegments += 1;
          if (autoSpeak) ensurePlayer().startSegment(format);
          trackSegment(round, event.index, event.text);
          break;
        case "segment_end":
          if (openSegments > 0) openSegments -= 1;
          if (autoSpeak) ensurePlayer().endSegment();
          endSegment(round, event.index);
          break;
        case "text_done":
          round.textDoneMs = nowMs() - askStartedAt;
          if (event.textDone.timingsMs) round.timingsMs = event.textDone.timingsMs;
          if (event.textDone.cacheHit !== void 0) round.cacheHit = event.textDone.cacheHit;
          if (event.textDone.style) {
            round.style = event.textDone.style;
            assistant.style = event.textDone.style;
          }
          if (event.textDone.citations) {
            round.citations = event.textDone.citations;
            assistant.citations = event.textDone.citations;
          }
          flushPendingSegments(round, true);
          assistant.streaming = false;
          if (state.value === "streaming" && autoSpeak && receivedAudio) setState("speaking");
          patchMetrics(round);
          break;
        case "done": {
          round.doneMs = nowMs() - askStartedAt;
          const done = event.done;
          if (done.timingsMs) {
            round.timingsMs = done.timingsMs;
            if (typeof done.timingsMs.total === "number") round.elapsedMs = done.timingsMs.total;
          }
          if (done.cacheHit !== void 0) round.cacheHit = done.cacheHit;
          if (done.requestId) {
            round.requestId = done.requestId;
            assistant.requestId = done.requestId;
          }
          if (done.style) {
            round.style = done.style;
            assistant.style = done.style;
          }
          if (done.citations) {
            round.citations = done.citations;
            assistant.citations = done.citations;
          }
          patchMetrics(round);
          wsEventDeferred == null ? void 0 : wsEventDeferred.finish();
          break;
        }
        case "error":
          wsEventDeferred == null ? void 0 : wsEventDeferred.fail(new RagError(event.message, "http"));
          break;
        case "aborted":
          wsEventDeferred == null ? void 0 : wsEventDeferred.fail(new RagError("回答已中断", "aborted"));
          break;
      }
    };
    wsAudioSink = (chunk) => {
      if (!isCurrent() || !autoSpeak) return;
      const samples = assemble(chunk);
      if (!samples) return;
      if (round.firstAudioMs === void 0) {
        round.firstAudioMs = nowMs() - askStartedAt;
        patchMetrics(round);
      }
      if (openSegments > 0 && round.firstAnswerAudioMs === void 0) {
        round.firstAnswerAudioMs = nowMs() - askStartedAt;
        patchMetrics(round);
      }
      receivedAudio = true;
      ensurePlayer().push(samples, format);
    };
    wsErrorSink = (streamError) => {
      if (!isCurrent()) return;
      wsEventDeferred == null ? void 0 : wsEventDeferred.fail(streamError);
    };
    wsCloseSink = () => {
      if (!isCurrent()) return;
      wsEventDeferred == null ? void 0 : wsEventDeferred.fail(new RagError("WS 连接已断开", "network"));
    };
    let timeoutHandle = null;
    try {
      connection.ask({
        question,
        sessionId: sessionId.value,
        topK: options.topK,
        leadIn: leadInId,
        voice: voiceSetting,
        speed: speedSetting
      });
      timeoutHandle = setTimeout(() => {
        wsEventDeferred == null ? void 0 : wsEventDeferred.fail(new RagError("等待回答超时（未收到 done）", "network"));
      }, WS_ROUND_TIMEOUT_MS);
      await donePromise;
      if (!isCurrent()) return;
      assistant.streaming = false;
      if (receivedAudio && autoSpeak) {
        setState("speaking");
        await ensurePlayer().whenIdle();
      }
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      controller.signal.removeEventListener("abort", onAbort);
      if (activeWsToken === token) {
        wsEventDeferred = null;
        wsRunAbort = null;
        releaseWsSinks(token);
      }
    }
  }
  async function transcribe(wav) {
    var _a;
    if (disposed) throw new RagError("组件已卸载", "unsupported");
    if (!wav || wav.size <= 0) throw new RagError("录音为空，请重试", "parse");
    transcribing.value = true;
    try {
      const result = await client.asr(wav, { sessionId: sessionId.value });
      const recognized = result.text.trim();
      if (!recognized) throw new RagError("没有识别到语音内容", "parse");
      return recognized;
    } catch (asrError) {
      const ragError = toRagError(asrError, "语音识别失败");
      error.value = ragError.message;
      (_a = options.onError) == null ? void 0 : _a.call(options, ragError);
      throw ragError;
    } finally {
      if (!disposed) transcribing.value = false;
    }
  }
  async function submitFeedback(feedback) {
    var _a;
    if (disposed) throw new RagError("组件已卸载", "unsupported");
    const target = feedback.messageId ? messages.value.find((message) => message.id === feedback.messageId) : [...messages.value].reverse().find((message) => message.role === "assistant" && Boolean(message.requestId));
    const requestId = (feedback.requestId ?? (target == null ? void 0 : target.requestId) ?? "").trim();
    if (!requestId) throw new RagError("缺少 request_id，无法提交反馈", "unsupported");
    const result = await client.feedback({
      requestId,
      vote: feedback.vote,
      comment: feedback.comment,
      signal: feedback.signal
    });
    if (target) {
      if (result.ok) {
        target.feedback = feedback.vote;
        const comment = (feedback.comment ?? "").trim();
        if (feedback.vote === "down" && comment) target.feedbackComment = comment;
      }
      (_a = options.onFeedback) == null ? void 0 : _a.call(options, { message: target, vote: feedback.vote, ok: result.ok });
    }
    return result.ok;
  }
  function reset() {
    interrupt();
    messages.value = [];
    sources.value = [];
    error.value = null;
    metrics.value = {};
    wsUnavailable = false;
    sessionId.value = options.sessionId;
    writeStoredSession(options.sessionId);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    interrupt();
    lifetimeController.abort();
    const connection = wsConnection;
    wsConnection = null;
    wsConnectPromise = null;
    wsReady = null;
    ready.value = null;
    voices.value = [];
    speeds.value = [];
    wsUnavailable = true;
    connection == null ? void 0 : connection.close();
    speakingSegment.value = null;
    const currentPlayer = player.value;
    player.value = null;
    if (ownsPlayer) currentPlayer == null ? void 0 : currentPlayer.dispose();
    notifySpeechIdle();
  }
  return {
    messages,
    sources,
    state,
    error,
    amplitude,
    speaking,
    transcribing,
    sessionId,
    metrics,
    voice,
    speed,
    ready,
    voices,
    speeds,
    speakingSegment,
    busy,
    ask,
    interrupt,
    abort: interrupt,
    reset,
    transcribe,
    primeAudio,
    dispose,
    setVoice,
    setSpeed,
    submitFeedback,
    client,
    player
  };
}
function useResolvedTheme(theme) {
  const prefersDark = ref(true);
  let mediaQuery = null;
  let removeListener = null;
  onMounted(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    prefersDark.value = mediaQuery.matches;
    const listener = (event) => {
      prefersDark.value = event.matches;
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      removeListener = () => mediaQuery == null ? void 0 : mediaQuery.removeEventListener("change", listener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(listener);
      removeListener = () => mediaQuery == null ? void 0 : mediaQuery.removeListener(listener);
    }
  });
  onBeforeUnmount(() => {
    removeListener == null ? void 0 : removeListener();
    removeListener = null;
    mediaQuery = null;
  });
  return computed(
    () => theme.value === "auto" ? prefersDark.value ? "dark" : "light" : theme.value
  );
}
const guideWebpUrl = "data:image/webp;base64,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";
const DEFAULT_CHARACTER_SRC = guideWebpUrl;
const RAG_AVATAR_CONFIG_KEY = Symbol("pp7-rag-avatar-config");
const DEFAULT_RAG_AVATAR_CONFIG = {
  apiBaseUrl: "",
  characterSrc: DEFAULT_CHARACTER_SRC,
  enableVoice: true,
  language: "zh-CN",
  theme: "dark",
  position: "bottom-right",
  width: 360,
  height: 520,
  topK: 5,
  title: "项目实践聚合平台",
  placeholder: "问平台上的项目、进展或合作方式…",
  autoSpeak: true,
  speed: DEFAULT_TTS_SPEED,
  streamMode: "auto",
  leadIn: false,
  persistSession: true,
  streamAsr: true,
  showSources: false,
  suggestions: true,
  vad: true,
  vadSilenceMs: 1200,
  requestHeaders: {}
};
const RAG_AVATAR_CONFIG_KEYS = [
  "apiBaseUrl",
  "characterSrc",
  "enableVoice",
  "language",
  "theme",
  "position",
  "width",
  "height",
  "topK",
  "sessionId",
  "title",
  "placeholder",
  "autoSpeak",
  "voice",
  "speed",
  "ttsVoice",
  "streamMode",
  "leadIn",
  "persistSession",
  "streamAsr",
  "showSources",
  "suggestions",
  "vad",
  "vadSilenceMs",
  "requestHeaders",
  "fetch",
  "avatarRenderer"
];
function pickRagAvatarConfig(source) {
  const result = {};
  if (!source) return result;
  const record = source;
  for (const key of RAG_AVATAR_CONFIG_KEYS) {
    const value = record[key];
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return result;
}
function resolveRagAvatarConfig(...sources) {
  const resolved = {
    ...DEFAULT_RAG_AVATAR_CONFIG,
    requestHeaders: { ...DEFAULT_RAG_AVATAR_CONFIG.requestHeaders }
  };
  for (const source of sources) {
    if (!source) continue;
    if (source.apiBaseUrl !== void 0) resolved.apiBaseUrl = source.apiBaseUrl;
    if (source.characterSrc !== void 0) resolved.characterSrc = source.characterSrc;
    if (source.enableVoice !== void 0) resolved.enableVoice = source.enableVoice;
    if (source.language !== void 0) resolved.language = source.language;
    if (source.theme !== void 0) resolved.theme = source.theme;
    if (source.position !== void 0) resolved.position = source.position;
    if (source.width !== void 0) resolved.width = source.width;
    if (source.height !== void 0) resolved.height = source.height;
    if (source.topK !== void 0) resolved.topK = source.topK;
    if (source.sessionId !== void 0) resolved.sessionId = source.sessionId;
    if (source.title !== void 0) resolved.title = source.title;
    if (source.placeholder !== void 0) resolved.placeholder = source.placeholder;
    if (source.autoSpeak !== void 0) resolved.autoSpeak = source.autoSpeak;
    const voice = source.voice ?? source.ttsVoice;
    if (voice !== void 0) resolved.voice = voice;
    const speed = normalizeSpeed(source.speed);
    if (speed !== void 0) resolved.speed = speed;
    if (source.streamMode !== void 0) resolved.streamMode = source.streamMode;
    if (source.leadIn !== void 0) resolved.leadIn = source.leadIn;
    if (source.persistSession !== void 0) resolved.persistSession = source.persistSession;
    if (source.streamAsr !== void 0) resolved.streamAsr = source.streamAsr;
    if (source.showSources !== void 0) resolved.showSources = source.showSources;
    if (source.suggestions !== void 0) resolved.suggestions = source.suggestions;
    if (source.vad !== void 0) resolved.vad = source.vad;
    if (source.vadSilenceMs !== void 0 && Number.isFinite(source.vadSilenceMs) && source.vadSilenceMs > 0) {
      resolved.vadSilenceMs = Math.min(1e4, Math.round(source.vadSilenceMs));
    }
    if (source.requestHeaders !== void 0) {
      resolved.requestHeaders = { ...resolved.requestHeaders, ...source.requestHeaders };
    }
    if (source.fetch !== void 0) resolved.fetch = source.fetch;
    if (source.avatarRenderer !== void 0) resolved.avatarRenderer = source.avatarRenderer;
  }
  return resolved;
}
function useRagAvatarConfig(overrides) {
  const injected = inject(RAG_AVATAR_CONFIG_KEY, void 0);
  return resolveRagAvatarConfig(injected, overrides);
}
function useInjectedRagAvatarConfig() {
  return inject(RAG_AVATAR_CONFIG_KEY, void 0);
}
function createStaticAvatarRenderer(options = {}) {
  let nodes = null;
  let state = "idle";
  let amplitude = 0;
  let characterSrc = options.characterSrc ?? DEFAULT_CHARACTER_SRC;
  const alt = options.alt ?? "项目助手";
  const fallbackText = options.fallbackText ?? "项目助手";
  function applyState() {
    if (!nodes) return;
    nodes.root.dataset.state = state;
  }
  function applyAmplitude() {
    if (!nodes) return;
    nodes.inner.style.setProperty("--pp7-amplitude", Math.max(0, Math.min(1, amplitude)).toFixed(3));
  }
  function applyCharacterSrc() {
    if (!nodes) return;
    nodes.image.src = characterSrc;
  }
  return {
    kind: "static",
    mount(host, mountOptions) {
      if (typeof document === "undefined") {
        throw new RagError("形象渲染器只能在浏览器环境挂载", "unsupported");
      }
      if (mountOptions == null ? void 0 : mountOptions.characterSrc) characterSrc = mountOptions.characterSrc;
      const root = document.createElement("div");
      root.className = "pp7-avatar-renderer";
      root.dataset.kind = "static";
      const glow = document.createElement("div");
      glow.className = "pp7-avatar-glow";
      const ring = document.createElement("div");
      ring.className = "pp7-avatar-ring";
      const figure = document.createElement("div");
      figure.className = "pp7-avatar-figure";
      const sway = document.createElement("div");
      sway.className = "pp7-avatar-sway";
      const inner = document.createElement("div");
      inner.className = "pp7-avatar-inner";
      const image = document.createElement("img");
      image.className = "pp7-avatar-image";
      image.alt = alt;
      image.decoding = "async";
      image.draggable = false;
      image.addEventListener("load", () => {
        if (!nodes) return;
        nodes.image.style.opacity = "1";
        nodes.fallback.style.opacity = "0";
      });
      image.addEventListener("error", () => {
        if (!nodes) return;
        nodes.image.style.opacity = "0";
        nodes.fallback.style.opacity = "1";
      });
      const fallback2 = document.createElement("div");
      fallback2.className = "pp7-avatar-fallback";
      fallback2.textContent = fallbackText;
      const shadow = document.createElement("div");
      shadow.className = "pp7-avatar-shadow";
      const thinking = document.createElement("div");
      thinking.className = "pp7-avatar-thinking";
      for (let i = 0; i < 3; i += 1) thinking.appendChild(document.createElement("i"));
      inner.append(image, fallback2);
      sway.appendChild(inner);
      figure.appendChild(sway);
      root.append(glow, ring, figure, shadow, thinking);
      host.appendChild(root);
      nodes = { root, figure, inner, image, fallback: fallback2 };
      applyState();
      applyAmplitude();
      applyCharacterSrc();
    },
    setState(next) {
      state = next;
      applyState();
    },
    setAmplitude(level) {
      amplitude = level;
      applyAmplitude();
    },
    setCharacterSrc(src) {
      characterSrc = src;
      if (nodes) {
        nodes.image.style.opacity = "";
        nodes.fallback.style.opacity = "0";
      }
      applyCharacterSrc();
    },
    destroy() {
      const current = nodes;
      nodes = null;
      if (!current) return;
      try {
        current.root.remove();
      } catch {
      }
    }
  };
}
const _hoisted_1$2 = ["data-theme", "data-state", "aria-label"];
const _hoisted_2$2 = {
  key: 0,
  class: "pp7-avatar-stage__error"
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "AvatarStage",
  props: {
    characterSrc: {},
    theme: {},
    state: {},
    amplitude: { default: 0 },
    listening: { type: Boolean, default: false },
    renderer: {},
    rendererFactory: {},
    alt: { default: "项目助手" }
  },
  setup(__props) {
    const props = __props;
    const injected = inject(RAG_AVATAR_CONFIG_KEY, void 0);
    const resolved = computed(
      () => resolveRagAvatarConfig(injected, {
        characterSrc: props.characterSrc,
        theme: props.theme
      })
    );
    const resolvedTheme = useResolvedTheme(computed(() => resolved.value.theme));
    const visualState = computed(() => {
      if (props.state) return props.state;
      if (props.listening) return "listening";
      if (props.amplitude > 0.015) return "speaking";
      return "idle";
    });
    const host = ref(null);
    const renderError = ref(null);
    let renderer = null;
    let ownsRenderer = false;
    onMounted(() => {
      const element = host.value;
      if (!element) return;
      try {
        if (props.renderer) {
          renderer = props.renderer;
          ownsRenderer = false;
        } else {
          const factory = props.rendererFactory ?? resolved.value.avatarRenderer ?? createStaticAvatarRenderer;
          renderer = factory({
            characterSrc: resolved.value.characterSrc,
            alt: props.alt
          });
          ownsRenderer = true;
        }
        renderer.mount(element, { characterSrc: resolved.value.characterSrc, alt: props.alt });
        renderer.setState(visualState.value);
        renderer.setAmplitude(props.amplitude);
        renderError.value = null;
      } catch (error) {
        renderer = null;
        renderError.value = error instanceof Error ? error.message : "形象渲染失败";
      }
    });
    watch(visualState, (next) => {
      renderer == null ? void 0 : renderer.setState(next);
    });
    watch(
      () => props.amplitude,
      (next) => {
        renderer == null ? void 0 : renderer.setAmplitude(next);
      }
    );
    watch(
      () => resolved.value.characterSrc,
      (next) => {
        var _a;
        (_a = renderer == null ? void 0 : renderer.setCharacterSrc) == null ? void 0 : _a.call(renderer, next);
      }
    );
    onBeforeUnmount(() => {
      if (renderer && ownsRenderer) renderer.destroy();
      renderer = null;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: "pp7-avatar-stage",
        "data-theme": unref(resolvedTheme),
        "data-state": visualState.value,
        role: "img",
        "aria-label": props.alt
      }, [
        createElementVNode("div", {
          ref_key: "host",
          ref: host,
          class: "pp7-avatar-stage__host"
        }, null, 512),
        renderError.value ? (openBlock(), createElementBlock("div", _hoisted_2$2, toDisplayString(renderError.value), 1)) : createCommentVNode("", true)
      ], 8, _hoisted_1$2);
    };
  }
});
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const AvatarStage = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-38c44bca"]]);
const DEFAULT_CONNECT_TIMEOUT_MS = 5e3;
const DEFAULT_FINAL_TIMEOUT_MS = 1e4;
const MAX_QUEUED_BYTES = 2 * 1024 * 1024;
function defaultWebSocketFactory(url) {
  const Ctor = globalThis.WebSocket;
  if (typeof Ctor !== "function") {
    throw new RagError("当前环境不支持 WebSocket", "unsupported");
  }
  return new Ctor(url);
}
function isAsrStreamSupported() {
  const Ctor = globalThis.WebSocket;
  return typeof Ctor === "function";
}
function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function createAsrStreamSession(options) {
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const finalTimeoutMs = options.finalTimeoutMs ?? DEFAULT_FINAL_TIMEOUT_MS;
  let currentState = "idle";
  let socket = null;
  let disposed = false;
  let finalText = "";
  let queued = [];
  let queuedBytes = 0;
  let openPromise = null;
  let openResolve = null;
  let openReject = null;
  let openTimer = null;
  let finalPromise = null;
  let finalResolve = null;
  let finalReject = null;
  let finalTimer = null;
  let signalListener = null;
  let closedByUser = false;
  function setState(next) {
    currentState = next;
  }
  function clearOpenTimer() {
    if (openTimer !== null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  }
  function clearFinalTimer() {
    if (finalTimer !== null) {
      clearTimeout(finalTimer);
      finalTimer = null;
    }
  }
  function rejectOpen(error) {
    clearOpenTimer();
    const reject = openReject;
    openResolve = null;
    openReject = null;
    openPromise = null;
    if (reject) reject(error);
  }
  function rejectFinal(error) {
    clearFinalTimer();
    const reject = finalReject;
    finalResolve = null;
    finalReject = null;
    finalPromise = null;
    if (reject) reject(error);
  }
  function settleFinal(text) {
    finalText = text;
    clearFinalTimer();
    const resolve = finalResolve;
    finalResolve = null;
    finalReject = null;
    if (resolve) resolve(text);
  }
  function sendBinary(buffer) {
    var _a;
    if (!socket) return;
    try {
      socket.send(buffer);
    } catch (error) {
      (_a = options.onError) == null ? void 0 : _a.call(options, toRagError(error, "发送音频失败"));
    }
  }
  function flushQueue() {
    if (queued.length === 0) return;
    const pending = queued;
    queued = [];
    queuedBytes = 0;
    for (const buffer of pending) sendBinary(buffer);
  }
  function closeSocket() {
    const current = socket;
    socket = null;
    if (!current) return;
    try {
      current.close(1e3, "asr done");
    } catch {
    }
  }
  function handleMessage(data) {
    var _a, _b, _c;
    if (typeof data !== "string") return;
    const record = parseJsonObject(data);
    if (!record) return;
    const type = typeof record.type === "string" ? record.type : "";
    switch (type) {
      case "connecting":
        break;
      case "ready": {
        clearOpenTimer();
        setState("ready");
        const resolve = openResolve;
        openResolve = null;
        openReject = null;
        if (resolve) resolve();
        flushQueue();
        (_a = options.onReady) == null ? void 0 : _a.call(options);
        break;
      }
      case "partial": {
        const text = typeof record.text === "string" ? record.text : "";
        if (text) (_b = options.onPartial) == null ? void 0 : _b.call(options, text);
        break;
      }
      case "final": {
        const text = typeof record.text === "string" ? record.text : "";
        setState("finalized");
        settleFinal(text);
        closeSocket();
        break;
      }
      case "error": {
        const message = typeof record.message === "string" ? record.message : "语音识别失败";
        const error = new RagError(message, "http");
        (_c = options.onError) == null ? void 0 : _c.call(options, error);
        if (openReject) rejectOpen(error);
        if (finalReject) rejectFinal(error);
        setState("error");
        closeSocket();
        break;
      }
    }
  }
  function handleClose() {
    const wasClosedByUser = closedByUser;
    socket = null;
    clearOpenTimer();
    if (openReject) {
      rejectOpen(
        new RagError(wasClosedByUser ? "语音识别已取消" : "流式 ASR 连接已关闭", wasClosedByUser ? "aborted" : "network")
      );
    }
    if (finalReject) {
      rejectFinal(
        new RagError(wasClosedByUser ? "语音识别已取消" : "流式 ASR 连接已关闭", wasClosedByUser ? "aborted" : "network")
      );
    }
    if (!wasClosedByUser && currentState !== "finalized") setState("closed");
  }
  function open() {
    if (disposed) return Promise.reject(new RagError("语音识别会话已释放", "unsupported"));
    if (currentState === "ready") return Promise.resolve();
    if (openPromise) return openPromise;
    if (currentState === "closed" || currentState === "finalized" || currentState === "error") {
      return Promise.reject(new RagError("语音识别会话已结束", "unsupported"));
    }
    setState("connecting");
    const opening = new Promise((resolve, reject) => {
      openResolve = resolve;
      openReject = reject;
    });
    openPromise = opening;
    try {
      const url = resolveRagWebSocketUrl(options.apiBaseUrl, "/asr/stream");
      const factory = options.webSocketFactory ?? defaultWebSocketFactory;
      const nextSocket = factory(url);
      socket = nextSocket;
      nextSocket.binaryType = "arraybuffer";
      nextSocket.onopen = () => {
      };
      nextSocket.onmessage = (event) => {
        handleMessage(event == null ? void 0 : event.data);
      };
      nextSocket.onerror = () => {
        var _a;
        const error = new RagError("流式 ASR 连接错误", "network");
        (_a = options.onError) == null ? void 0 : _a.call(options, error);
        if (openReject) {
          rejectOpen(error);
          setState("error");
        }
        if (finalReject) rejectFinal(error);
      };
      nextSocket.onclose = () => {
        handleClose();
      };
      openTimer = setTimeout(() => {
        var _a;
        const error = new RagError("流式 ASR 连接超时（未收到 ready）", "network");
        (_a = options.onError) == null ? void 0 : _a.call(options, error);
        if (openReject) rejectOpen(error);
        closeSocket();
      }, connectTimeoutMs);
      if (options.signal) {
        if (options.signal.aborted) {
          const error = new RagError("语音识别已取消", "aborted");
          rejectOpen(error);
          closeSocket();
        } else {
          signalListener = () => {
            closedByUser = true;
            const error = new RagError("语音识别已取消", "aborted");
            if (openReject) rejectOpen(error);
            if (finalReject) rejectFinal(error);
            closeSocket();
            if (currentState !== "finalized") setState("closed");
          };
          options.signal.addEventListener("abort", signalListener, { once: true });
        }
      }
    } catch (error) {
      const ragError = toRagError(error, "流式 ASR 连接失败");
      rejectOpen(ragError);
      setState("error");
    }
    return opening;
  }
  function push(samples) {
    if (disposed || samples.length === 0) return;
    const buffer = samples.buffer.slice(
      samples.byteOffset,
      samples.byteOffset + samples.byteLength
    );
    if (currentState === "ready" || currentState === "stopping") {
      sendBinary(buffer);
      return;
    }
    if (currentState !== "connecting" && currentState !== "idle") return;
    queued.push(buffer);
    queuedBytes += buffer.byteLength;
    while (queuedBytes > MAX_QUEUED_BYTES && queued.length > 1) {
      const dropped = queued.shift();
      if (dropped) queuedBytes -= dropped.byteLength;
    }
  }
  function stop() {
    if (disposed) return Promise.reject(new RagError("语音识别会话已释放", "unsupported"));
    if (finalText) return Promise.resolve(finalText);
    if (finalPromise) return finalPromise;
    if (!socket) return Promise.reject(new RagError("流式 ASR 未连接", "network"));
    setState("stopping");
    const waiting = new Promise((resolve, reject) => {
      finalResolve = resolve;
      finalReject = reject;
    });
    finalPromise = waiting;
    try {
      socket.send(JSON.stringify({ type: "stop" }));
    } catch (error) {
      rejectFinal(toRagError(error, "发送 stop 失败"));
      return waiting;
    }
    finalTimer = setTimeout(() => {
      var _a;
      const error = new RagError("等待语音识别结果超时", "network");
      (_a = options.onError) == null ? void 0 : _a.call(options, error);
      rejectFinal(error);
      closeSocket();
    }, finalTimeoutMs);
    return waiting;
  }
  function cancel() {
    if (disposed) return;
    closedByUser = true;
    if (socket) {
      try {
        socket.send(JSON.stringify({ type: "cancel" }));
      } catch {
      }
    }
    const error = new RagError("语音识别已取消", "aborted");
    if (openReject) rejectOpen(error);
    if (finalReject) rejectFinal(error);
    closeSocket();
    if (currentState !== "finalized") setState("closed");
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    closedByUser = true;
    clearOpenTimer();
    clearFinalTimer();
    if (options.signal && signalListener) {
      options.signal.removeEventListener("abort", signalListener);
    }
    signalListener = null;
    queued = [];
    queuedBytes = 0;
    closeSocket();
    const error = new RagError("语音识别会话已释放", "unsupported");
    if (openReject) rejectOpen(error);
    if (finalReject) rejectFinal(error);
    setState("closed");
  }
  return {
    get state() {
      return currentState;
    },
    get opened() {
      return currentState === "ready";
    },
    open,
    push,
    stop,
    cancel,
    dispose
  };
}
const ASR_STREAM_SAMPLE_RATE = 16e3;
const DEFAULT_RAG_SUGGESTIONS = [
  "平台上有哪些项目？",
  "介绍一下产教融合服务平台",
  "这个平台现在能用了吗？"
];
const CACHE_TTL_MS = 5 * 6e4;
const DEFAULT_TIMEOUT_MS = 3e3;
const cache = /* @__PURE__ */ new Map();
const inflight = /* @__PURE__ */ new Map();
function resetSuggestionCache() {
  cache.clear();
  inflight.clear();
}
function cacheKey(client, limit) {
  return (client.apiBaseUrl || "(same-origin)") + "#" + limit;
}
function fallback(limit) {
  return DEFAULT_RAG_SUGGESTIONS.slice(0, Math.max(1, Math.min(DEFAULT_RAG_SUGGESTIONS.length, limit)));
}
async function loadRagSuggestions(client, options = {}) {
  const limit = Math.min(Math.max(Math.round(options.limit ?? 3), 1), 6);
  const key = cacheKey(client, limit);
  const now = Date.now();
  if (!options.force) {
    const hit = cache.get(key);
    if (hit && hit.expires > now) return [...hit.items];
    const pending = inflight.get(key);
    if (pending) return pending;
  }
  const controller = new AbortController();
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  const task = (async () => {
    try {
      const result = await client.suggestions({
        limit,
        signal: controller.signal
      });
      const items = Array.isArray(result.suggestions) ? result.suggestions.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
      if (items.length === 0) return fallback(limit);
      const sliced = items.slice(0, limit);
      cache.set(key, { items: sliced, expires: Date.now() + CACHE_TTL_MS });
      return [...sliced];
    } catch {
      return fallback(limit);
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}
const DEFAULT_SAMPLE_RATE = 16e3;
const FRAME_SIZE = 4096;
const DEFAULT_PCM_CHUNK_MS = 100;
function getAudioContextCtor$1() {
  const globalRef = globalThis;
  return globalRef.AudioContext ?? globalRef.webkitAudioContext;
}
function createWavRecorder(options = {}) {
  const targetSampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  let state = "idle";
  let stream = null;
  let context = null;
  let sourceNode = null;
  let processor = null;
  let muteNode = null;
  let nativeSampleRate = targetSampleRate;
  let chunks = [];
  let started = false;
  let closed = false;
  const streamFrameSize = Math.max(
    1,
    Math.round(targetSampleRate * (options.pcmChunkMs ?? DEFAULT_PCM_CHUNK_MS) / 1e3)
  );
  let streamPending = new Int16Array(0);
  const vadOptions = options.vad === false ? null : options.vad ?? {};
  let vadAnalyser = null;
  let vadBuffer = null;
  let vadTimer = null;
  let vadSilenceStartedAt = null;
  let vadFired = false;
  function stopVad() {
    if (vadTimer !== null) {
      clearInterval(vadTimer);
      vadTimer = null;
    }
    const analyser = vadAnalyser;
    vadAnalyser = null;
    vadBuffer = null;
    vadSilenceStartedAt = null;
    if (analyser) {
      try {
        analyser.disconnect();
      } catch {
      }
    }
  }
  function startVad(source, sink, ctx) {
    if (!options.onVadSilence || !vadOptions || vadOptions.enabled === false) return;
    let analyser;
    try {
      analyser = ctx.createAnalyser();
    } catch {
      return;
    }
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    const buffer = new Float32Array(analyser.fftSize);
    try {
      source.connect(analyser);
      analyser.connect(sink);
    } catch {
      return;
    }
    vadAnalyser = analyser;
    vadBuffer = buffer;
    vadFired = false;
    vadSilenceStartedAt = null;
    const silenceMs = Math.max(200, vadOptions.silenceMs ?? 1200);
    const threshold = Math.min(0.9, Math.max(5e-4, vadOptions.threshold ?? 0.012));
    const intervalMs = Math.min(500, Math.max(20, vadOptions.intervalMs ?? 50));
    vadTimer = setInterval(() => {
      var _a;
      if (!started || vadFired) return;
      const activeAnalyser = vadAnalyser;
      const activeBuffer = vadBuffer;
      if (!activeAnalyser || !activeBuffer) return;
      let rms = 0;
      try {
        activeAnalyser.getFloatTimeDomainData(activeBuffer);
        let sum = 0;
        for (let i = 0; i < activeBuffer.length; i += 1) {
          const value = activeBuffer[i] ?? 0;
          sum += value * value;
        }
        rms = Math.sqrt(sum / Math.max(1, activeBuffer.length));
      } catch {
        return;
      }
      if (rms >= threshold) {
        vadSilenceStartedAt = null;
        return;
      }
      const now = Date.now();
      if (vadSilenceStartedAt === null) {
        vadSilenceStartedAt = now;
        return;
      }
      const silentFor = now - vadSilenceStartedAt;
      if (silentFor < silenceMs) return;
      vadFired = true;
      stopVad();
      (_a = options.onVadSilence) == null ? void 0 : _a.call(options, { silenceMs: silentFor, level: rms });
    }, intervalMs);
  }
  function setState(next) {
    var _a;
    if (state === next) return;
    state = next;
    (_a = options.onStateChange) == null ? void 0 : _a.call(options, next);
  }
  function disconnectNodes() {
    try {
      sourceNode == null ? void 0 : sourceNode.disconnect();
      processor == null ? void 0 : processor.disconnect();
      muteNode == null ? void 0 : muteNode.disconnect();
    } catch {
    }
    sourceNode = null;
    processor = null;
    muteNode = null;
  }
  function emitStreamSamples(samples) {
    const sink = options.onPcmChunk;
    if (!sink || samples.length === 0) return;
    let merged;
    if (streamPending.length > 0) {
      merged = new Int16Array(streamPending.length + samples.length);
      merged.set(streamPending, 0);
      merged.set(samples, streamPending.length);
    } else {
      merged = samples;
    }
    let offset = 0;
    while (merged.length - offset >= streamFrameSize) {
      sink(merged.slice(offset, offset + streamFrameSize));
      offset += streamFrameSize;
    }
    streamPending = offset < merged.length ? merged.slice(offset) : new Int16Array(0);
  }
  function flushStreamSamples() {
    const sink = options.onPcmChunk;
    if (!sink || streamPending.length === 0) return;
    sink(streamPending);
    streamPending = new Int16Array(0);
  }
  function stopTracks() {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
      }
    }
    stream = null;
  }
  async function closeContext() {
    disconnectNodes();
    const ctx = context;
    context = null;
    if (!ctx) return;
    try {
      await ctx.close();
    } catch {
    }
  }
  async function releaseAll() {
    var _a;
    stopVad();
    started = false;
    stopTracks();
    await closeContext();
    chunks = [];
    (_a = options.onLevel) == null ? void 0 : _a.call(options, 0);
  }
  async function start() {
    if (closed) throw new RagError("录音器已释放", "unsupported");
    if (state === "recording" || state === "requesting") return;
    setState("requesting");
    try {
      const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : void 0;
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        throw new RagError("当前环境不支持录音（需要 HTTPS 或 localhost）", "unsupported");
      }
      const mediaStream = await mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      stream = mediaStream;
      const Ctor = getAudioContextCtor$1();
      if (!Ctor) throw new RagError("当前环境不支持 Web Audio", "unsupported");
      let ctx;
      try {
        ctx = new Ctor({ sampleRate: targetSampleRate });
      } catch {
        ctx = new Ctor();
      }
      context = ctx;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
        }
      }
      nativeSampleRate = ctx.sampleRate;
      chunks = [];
      streamPending = new Int16Array(0);
      const mediaSource = ctx.createMediaStreamSource(mediaStream);
      sourceNode = mediaSource;
      const scriptProcessor = ctx.createScriptProcessor(FRAME_SIZE, 1, 1);
      processor = scriptProcessor;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      muteNode = mute;
      scriptProcessor.onaudioprocess = (event) => {
        var _a;
        if (!started) return;
        const input = event.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
        if (options.onPcmChunk) {
          emitStreamSamples(float32ToInt16(downsampleBuffer(input, nativeSampleRate, targetSampleRate)));
        }
        let sum = 0;
        for (let i = 0; i < input.length; i += 1) {
          const value = input[i] ?? 0;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / Math.max(1, input.length));
        (_a = options.onLevel) == null ? void 0 : _a.call(options, Math.min(1, rms * 3.2));
      };
      mediaSource.connect(scriptProcessor);
      scriptProcessor.connect(mute);
      mute.connect(ctx.destination);
      started = true;
      startVad(mediaSource, mute, ctx);
      setState("recording");
    } catch (error) {
      await releaseAll();
      setState("idle");
      if (error instanceof RagError) throw error;
      const name = error == null ? void 0 : error.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new RagError("麦克风权限被拒绝，请在浏览器中允许录音权限", "unsupported");
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw new RagError("未检测到可用的麦克风设备", "unsupported");
      }
      throw toRagError(error, "无法开始录音");
    }
  }
  async function stop() {
    var _a;
    if (state !== "recording") {
      return encodeWav(new Int16Array(0), targetSampleRate);
    }
    flushStreamSamples();
    stopVad();
    started = false;
    setState("processing");
    stopTracks();
    const nativeRate = nativeSampleRate;
    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    chunks = [];
    await closeContext();
    const downsampled = downsampleBuffer(merged, nativeRate, targetSampleRate);
    const pcm = float32ToInt16(downsampled);
    (_a = options.onLevel) == null ? void 0 : _a.call(options, 0);
    setState("idle");
    return encodeWav(pcm, targetSampleRate);
  }
  function cancel() {
    var _a;
    stopVad();
    started = false;
    chunks = [];
    streamPending = new Int16Array(0);
    stopTracks();
    disconnectNodes();
    const ctx = context;
    context = null;
    if (ctx) {
      void ctx.close().catch(() => {
      });
    }
    (_a = options.onLevel) == null ? void 0 : _a.call(options, 0);
    if (!closed) setState("idle");
  }
  function dispose() {
    if (closed) return;
    closed = true;
    cancel();
    setState("closed");
  }
  return {
    get state() {
      return state;
    },
    start,
    stop,
    cancel,
    dispose
  };
}
const _hoisted_1$1 = ["data-theme"];
const _hoisted_2$1 = { class: "pp7-chat-header" };
const _hoisted_3 = {
  class: "pp7-chat-header__avatar",
  "aria-hidden": "true"
};
const _hoisted_4 = ["src"];
const _hoisted_5 = { class: "pp7-chat-header__meta" };
const _hoisted_6 = { class: "pp7-chat-header__title" };
const _hoisted_7 = ["data-tone"];
const _hoisted_8 = { class: "pp7-chat-header__actions" };
const _hoisted_9 = { class: "pp7-chat-msg__bubble" };
const _hoisted_10 = ["data-citation", "title", "onClick", "onKeydown"];
const _hoisted_11 = {
  key: 0,
  class: "pp7-chat-cursor"
};
const _hoisted_12 = {
  key: 1,
  class: "pp7-chat-typing"
};
const _hoisted_13 = {
  key: 2,
  class: "pp7-chat-msg__muted"
};
const _hoisted_14 = {
  key: 3,
  class: "pp7-chat-msg__error"
};
const _hoisted_15 = {
  key: 0,
  class: "pp7-chat-sources"
};
const _hoisted_16 = { class: "pp7-chat-sources__caption" };
const _hoisted_17 = {
  key: 0,
  class: "pp7-chat-sources__style"
};
const _hoisted_18 = {
  key: 1,
  class: "pp7-chat-sources__used"
};
const _hoisted_19 = ["data-citation"];
const _hoisted_20 = { class: "pp7-chat-sources__head" };
const _hoisted_21 = { class: "pp7-chat-sources__badge" };
const _hoisted_22 = { class: "pp7-chat-sources__title" };
const _hoisted_23 = { class: "pp7-chat-sources__score" };
const _hoisted_24 = { class: "pp7-chat-sources__snippet" };
const _hoisted_25 = {
  key: 0,
  class: "pp7-chat-sources__mark"
};
const _hoisted_26 = ["onClick"];
const _hoisted_27 = {
  key: 1,
  class: "pp7-chat-sources__full"
};
const _hoisted_28 = {
  key: 1,
  class: "pp7-chat-feedback"
};
const _hoisted_29 = {
  key: 0,
  class: "pp7-chat-feedback__done"
};
const _hoisted_30 = ["disabled", "onClick"];
const _hoisted_31 = ["disabled", "onClick"];
const _hoisted_32 = ["onSubmit"];
const _hoisted_33 = ["disabled"];
const _hoisted_34 = {
  key: 0,
  class: "pp7-chat-hints"
};
const _hoisted_35 = {
  key: 0,
  class: "pp7-chat-hints__loading"
};
const _hoisted_36 = ["onClick"];
const _hoisted_37 = {
  key: 0,
  class: "pp7-chat-alert",
  role: "alert"
};
const _hoisted_38 = {
  key: 1,
  class: "pp7-chat-recording"
};
const _hoisted_39 = { class: "pp7-chat-recording__body" };
const _hoisted_40 = {
  key: 0,
  class: "pp7-chat-recording__text"
};
const _hoisted_41 = {
  key: 1,
  class: "pp7-chat-recording__partial"
};
const _hoisted_42 = {
  key: 2,
  class: "pp7-chat-recording__notice"
};
const _hoisted_43 = {
  key: 0,
  class: "pp7-chat-recording__meter"
};
const _hoisted_44 = ["disabled", "title", "aria-label"];
const _hoisted_45 = {
  key: 0,
  class: "pp7-chat-mic__pulse"
};
const _hoisted_46 = ["placeholder", "disabled"];
const _hoisted_47 = ["disabled"];
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ChatPanel",
  props: {
    chat: {},
    apiBaseUrl: {},
    characterSrc: {},
    enableVoice: { type: Boolean, default: void 0 },
    language: {},
    theme: {},
    position: {},
    width: {},
    height: {},
    topK: {},
    sessionId: {},
    title: {},
    placeholder: {},
    autoSpeak: { type: Boolean, default: void 0 },
    voice: {},
    speed: {},
    ttsVoice: {},
    streamMode: {},
    leadIn: { type: [Boolean, String], default: void 0 },
    streamAsr: { type: Boolean, default: void 0 },
    persistSession: { type: Boolean, default: void 0 },
    showSources: { type: Boolean, default: void 0 },
    suggestions: { type: Boolean, default: void 0 },
    vad: { type: Boolean, default: void 0 },
    vadSilenceMs: {},
    requestHeaders: {},
    fetch: {},
    avatarRenderer: {}
  },
  emits: ["submit", "interrupt", "voice-state", "voice-error", "partial", "vad-silence", "feedback"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const injected = inject(RAG_AVATAR_CONFIG_KEY, void 0);
    const config = computed(() => resolveRagAvatarConfig(injected, pickRagAvatarConfig(props)));
    const resolvedTheme = useResolvedTheme(computed(() => config.value.theme));
    const draft = ref("");
    const recordError = ref(null);
    const recording = ref(false);
    const recordLevel = ref(0);
    const recordSeconds = ref(0);
    const partialText = ref("");
    const vadNotice = ref("");
    const inputRef = ref(null);
    const listRef = ref(null);
    let recorder = null;
    let asrSession = null;
    let recordTimer = null;
    let vadNoticeTimer = null;
    const warmupController = new AbortController();
    const audioPrimed = ref(false);
    function primeOnce() {
      if (audioPrimed.value) return;
      audioPrimed.value = true;
      void chat.primeAudio();
    }
    const ownsChat = !props.chat;
    const chat = props.chat ?? useRagChat({
      apiBaseUrl: config.value.apiBaseUrl,
      requestHeaders: config.value.requestHeaders,
      fetch: config.value.fetch,
      topK: config.value.topK,
      sessionId: config.value.sessionId,
      autoSpeak: config.value.autoSpeak,
      voice: config.value.voice,
      speed: config.value.speed,
      streamMode: config.value.streamMode,
      leadIn: config.value.leadIn,
      persistSession: config.value.persistSession
    });
    const messages = computed(() => chat.messages.value);
    const busy = computed(() => chat.busy.value);
    const speaking = computed(() => chat.speaking.value);
    const transcribing = computed(() => chat.transcribing.value);
    const chatError = computed(() => chat.error.value);
    const showSources = computed(() => config.value.showSources);
    const suggestions = ref([...DEFAULT_RAG_SUGGESTIONS]);
    const suggestionsLoading = ref(false);
    let suggestionsController = null;
    async function loadSuggestions(force = false) {
      if (config.value.suggestions === false) {
        suggestions.value = [...DEFAULT_RAG_SUGGESTIONS];
        return;
      }
      suggestionsController == null ? void 0 : suggestionsController.abort();
      const controller = new AbortController();
      suggestionsController = controller;
      suggestionsLoading.value = true;
      try {
        const list = await loadRagSuggestions(chat.client, {
          limit: 3,
          force,
          signal: controller.signal
        });
        if (suggestionsController === controller) suggestions.value = list;
      } catch {
        if (suggestionsController === controller) suggestions.value = [...DEFAULT_RAG_SUGGESTIONS];
      } finally {
        if (suggestionsController === controller) {
          suggestionsController = null;
          suggestionsLoading.value = false;
        }
      }
    }
    const statusTone = computed(() => {
      if (recording.value) return "recording";
      if (transcribing.value) return "thinking";
      if (chat.state.value === "error") return "error";
      if (busy.value) return "thinking";
      if (speaking.value) return "speaking";
      return "idle";
    });
    const statusText = computed(() => {
      if (recording.value) {
        return partialText.value ? "正在识别…" : `正在录音 ${recordSeconds.value}s`;
      }
      if (transcribing.value) return "正在识别语音…";
      switch (chat.state.value) {
        case "loading":
          return "正在检索知识库…";
        case "streaming":
          return "正在回答…";
        case "speaking":
          return "正在播报…";
        case "error":
          return "出了点问题";
        default:
          return speaking.value ? "正在播报…" : "就绪";
      }
    });
    const scrollTick = computed(() => {
      const list = messages.value;
      const last = list[list.length - 1];
      return `${list.length}:${last ? last.content.length : 0}:${(last == null ? void 0 : last.streaming) ? 1 : 0}`;
    });
    watch(scrollTick, () => {
      void nextTick(scrollToBottom);
    });
    watch(
      () => config.value.voice,
      (value) => {
        if (value !== void 0) chat.setVoice(value);
      }
    );
    watch(
      () => config.value.speed,
      (value) => {
        if (value !== void 0) chat.setSpeed(value);
      }
    );
    function scrollToBottom() {
      const element = listRef.value;
      if (!element) return;
      element.scrollTop = element.scrollHeight;
    }
    function formatScore(score) {
      if (!Number.isFinite(score)) return "—";
      if (score > 0 && score <= 1) return `${Math.round(score * 100)}%`;
      if (score > 1 && score <= 100) return `${Math.round(score)}%`;
      return score.toFixed(2);
    }
    function autoGrow() {
      const element = inputRef.value;
      if (!element) return;
      element.style.height = "auto";
      element.style.height = `${Math.min(120, element.scrollHeight)}px`;
    }
    function onKeydown(event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      void send();
    }
    async function send() {
      const text = draft.value.trim();
      if (!text || busy.value) return;
      draft.value = "";
      const element = inputRef.value;
      if (element) element.style.height = "";
      emit("submit", text);
      void chat.primeAudio();
      await chat.ask(text);
    }
    function askSuggestion(text) {
      draft.value = text;
      void send();
    }
    function stop() {
      chat.interrupt();
      emit("interrupt");
    }
    function resetChat() {
      chat.interrupt();
      chat.reset();
      draft.value = "";
      recordError.value = null;
      feedbackOpenFor.value = null;
      feedbackComment.value = "";
    }
    function dismissError() {
      recordError.value = null;
      if (chat.error.value) chat.error.value = null;
    }
    const richNodesByMessage = computed(() => {
      const map = /* @__PURE__ */ new Map();
      const active = chat.speakingSegment.value;
      for (const message of messages.value) {
        if (!message.content) continue;
        const highlight = active && active.messageId === message.id ? { start: active.start, end: active.end } : null;
        const citationSet = /* @__PURE__ */ new Set();
        (message.sources ?? []).forEach((source, index) => citationSet.add(sourceCitation(source, index)));
        map.set(
          message.id,
          buildRichNodes(message.content, {
            highlight,
            citations: citationSet.size > 0 ? citationSet : null
          })
        );
      }
      return map;
    });
    function richNodes(message) {
      return richNodesByMessage.value.get(message.id) ?? [];
    }
    const expandedSources = reactive(/* @__PURE__ */ new Set());
    const flashedSource = ref(null);
    const sourceCardRefs = /* @__PURE__ */ new Map();
    let flashTimer = null;
    function sourceKey(messageId, citation) {
      return `${messageId}:${citation}`;
    }
    function isSourceExpanded(messageId, citation) {
      return expandedSources.has(sourceKey(messageId, citation));
    }
    function toggleSource(messageId, citation) {
      const key = sourceKey(messageId, citation);
      if (expandedSources.has(key)) expandedSources.delete(key);
      else expandedSources.add(key);
    }
    function setSourceCardRef(messageId, citation, element) {
      const key = sourceKey(messageId, citation);
      if (element && typeof element === "object" && "scrollIntoView" in element) {
        sourceCardRefs.set(key, element);
      } else {
        sourceCardRefs.delete(key);
      }
    }
    function jumpToSource(message, citation) {
      const key = sourceKey(message.id, citation);
      expandedSources.add(key);
      flashedSource.value = key;
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (flashedSource.value === key) flashedSource.value = null;
        flashTimer = null;
      }, 1600);
      void nextTick(() => {
        var _a, _b;
        (_b = (_a = sourceCardRefs.get(key)) == null ? void 0 : _a.scrollIntoView) == null ? void 0 : _b.call(_a, { block: "nearest", behavior: "smooth" });
      });
    }
    function sourceSnippet(source) {
      return source.snippet || source.text || "";
    }
    function termParts(source) {
      return highlightTermParts(sourceSnippet(source), source.terms);
    }
    const feedbackOpenFor = ref(null);
    const feedbackComment = ref("");
    const feedbackBusy = ref(null);
    async function vote(message, value) {
      if (!message.requestId || feedbackBusy.value) return;
      if (value === "down" && feedbackOpenFor.value !== message.id) {
        feedbackOpenFor.value = message.id;
        feedbackComment.value = "";
        return;
      }
      await sendFeedback(message, value, value === "down" ? feedbackComment.value : void 0);
    }
    async function sendFeedback(message, value, comment) {
      feedbackBusy.value = message.id;
      try {
        const ok = await chat.submitFeedback({ messageId: message.id, vote: value, comment });
        emit("feedback", { messageId: message.id, vote: value, ok });
        if (ok) {
          feedbackOpenFor.value = null;
          feedbackComment.value = "";
        } else {
          recordError.value = "反馈未记录（该请求可能已过期）";
        }
      } catch (error) {
        recordError.value = error instanceof Error ? error.message : "反馈提交失败";
      } finally {
        feedbackBusy.value = null;
      }
    }
    function submitDownFeedback(message) {
      void sendFeedback(message, "down", feedbackComment.value);
    }
    function cancelFeedback() {
      feedbackOpenFor.value = null;
      feedbackComment.value = "";
    }
    async function startRecording() {
      if (!config.value.enableVoice || recording.value || transcribing.value) return;
      recordError.value = null;
      partialText.value = "";
      vadNotice.value = "";
      if (vadNoticeTimer !== null) {
        clearTimeout(vadNoticeTimer);
        vadNoticeTimer = null;
      }
      await chat.primeAudio();
      let currentAsr = null;
      if (config.value.streamAsr !== false && isAsrStreamSupported()) {
        currentAsr = createAsrStreamSession({
          apiBaseUrl: config.value.apiBaseUrl,
          onPartial(text) {
            partialText.value = text;
            emit("partial", text);
          }
        });
        asrSession = currentAsr;
        void currentAsr.open().catch(() => {
        });
      }
      const nextRecorder = createWavRecorder({
        onLevel(level) {
          recordLevel.value = level;
        },
        onPcmChunk: currentAsr ? (samples) => {
          currentAsr == null ? void 0 : currentAsr.push(samples);
        } : void 0,
        vad: config.value.vad === false ? false : { enabled: true, silenceMs: config.value.vadSilenceMs },
        onVadSilence(info) {
          if (!recording.value) return;
          emit("vad-silence", info);
          vadNotice.value = "检测到停顿，自动结束";
          if (vadNoticeTimer !== null) clearTimeout(vadNoticeTimer);
          vadNoticeTimer = setTimeout(() => {
            vadNotice.value = "";
            vadNoticeTimer = null;
          }, 3e3);
          void stopRecording();
        }
      });
      recorder = nextRecorder;
      try {
        await nextRecorder.start();
        recording.value = true;
        recordSeconds.value = 0;
        emit("voice-state", true);
        recordTimer = setInterval(() => {
          if (!recording.value) return;
          recordSeconds.value += 1;
          if (recordSeconds.value >= 60) void stopRecording();
        }, 1e3);
      } catch (error) {
        recorder = null;
        nextRecorder.dispose();
        const failedAsr = asrSession;
        asrSession = null;
        failedAsr == null ? void 0 : failedAsr.cancel();
        failedAsr == null ? void 0 : failedAsr.dispose();
        const message = error instanceof Error ? error.message : "无法开始录音";
        recordError.value = message;
        emit("voice-error", message);
      }
    }
    async function stopRecording() {
      const current = recorder;
      if (!current) return;
      recorder = null;
      if (recordTimer !== null) {
        clearInterval(recordTimer);
        recordTimer = null;
      }
      recording.value = false;
      recordLevel.value = 0;
      emit("voice-state", false);
      const streamAsr = asrSession;
      asrSession = null;
      try {
        const wav = await current.stop();
        current.dispose();
        if (wav.size <= 44) {
          streamAsr == null ? void 0 : streamAsr.cancel();
          streamAsr == null ? void 0 : streamAsr.dispose();
          throw new Error("录音太短，请重试");
        }
        let recognized = "";
        if (streamAsr) {
          try {
            recognized = (await streamAsr.stop()).trim();
          } catch {
            recognized = "";
          } finally {
            streamAsr.dispose();
          }
        }
        if (!recognized) recognized = (await chat.transcribe(wav)).trim();
        if (!recognized) throw new Error("没有识别到语音内容");
        const text = recognized;
        emit("submit", text);
        void chat.primeAudio();
        const asking = chat.ask(text);
        draft.value = "";
        if (inputRef.value) inputRef.value.style.height = "";
        void nextTick(autoGrow);
        await asking;
      } catch (error) {
        const message = error instanceof Error ? error.message : "语音识别失败";
        recordError.value = message;
        emit("voice-error", message);
      } finally {
        partialText.value = "";
      }
    }
    function toggleRecording() {
      if (recording.value) {
        void stopRecording();
      } else {
        void startRecording();
      }
    }
    function cleanupRecording() {
      if (recordTimer !== null) {
        clearInterval(recordTimer);
        recordTimer = null;
      }
      if (vadNoticeTimer !== null) {
        clearTimeout(vadNoticeTimer);
        vadNoticeTimer = null;
      }
      if (flashTimer !== null) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
      const pendingAsr = asrSession;
      asrSession = null;
      if (pendingAsr) {
        pendingAsr.cancel();
        pendingAsr.dispose();
      }
      if (recorder) {
        recorder.cancel();
        recorder.dispose();
        recorder = null;
      }
      if (recording.value) {
        recording.value = false;
        emit("voice-state", false);
      }
      recordLevel.value = 0;
      partialText.value = "";
    }
    onMounted(() => {
      scrollToBottom();
      void loadSuggestions();
      if (ownsChat && config.value.enableVoice) {
        void prewarmRagHealth(chat.client, warmupController.signal);
      }
    });
    onBeforeUnmount(() => {
      warmupController.abort();
      suggestionsController == null ? void 0 : suggestionsController.abort();
      suggestionsController = null;
      cleanupRecording();
      if (ownsChat) chat.dispose();
    });
    __expose({
      chat,
      suggestions,
      loadSuggestions,
      focus: () => {
        var _a;
        return (_a = inputRef.value) == null ? void 0 : _a.focus();
      },
      send,
      startRecording,
      stopRecording
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("section", {
        class: "pp7-chat-panel",
        "data-theme": unref(resolvedTheme),
        onPointerdown: primeOnce,
        onKeydown: primeOnce
      }, [
        createElementVNode("header", _hoisted_2$1, [
          createElementVNode("div", _hoisted_3, [
            createElementVNode("img", {
              src: config.value.characterSrc,
              alt: ""
            }, null, 8, _hoisted_4)
          ]),
          createElementVNode("div", _hoisted_5, [
            createElementVNode("strong", _hoisted_6, toDisplayString(config.value.title), 1),
            createElementVNode("span", {
              class: "pp7-chat-header__status",
              "data-tone": statusTone.value
            }, [
              _cache[2] || (_cache[2] = createElementVNode("i", { class: "pp7-chat-header__dot" }, null, -1)),
              createTextVNode(" " + toDisplayString(statusText.value), 1)
            ], 8, _hoisted_7)
          ]),
          createElementVNode("div", _hoisted_8, [
            busy.value || speaking.value ? (openBlock(), createElementBlock("button", {
              key: 0,
              type: "button",
              class: "pp7-chat-action pp7-chat-action--danger",
              onClick: stop
            }, " 打断 ")) : createCommentVNode("", true),
            createElementVNode("button", {
              type: "button",
              class: "pp7-chat-action",
              title: "清空对话",
              onClick: resetChat
            }, " 清空 ")
          ])
        ]),
        createElementVNode("div", {
          ref_key: "listRef",
          ref: listRef,
          class: "pp7-chat-messages",
          role: "log",
          "aria-live": "polite"
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(messages.value, (message) => {
            var _a, _b, _c, _d;
            return openBlock(), createElementBlock("div", {
              key: message.id,
              class: normalizeClass(["pp7-chat-msg", "pp7-chat-msg--" + message.role])
            }, [
              createElementVNode("div", _hoisted_9, [
                message.content ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(richNodes(message), (node, nodeIndex) => {
                    return openBlock(), createElementBlock(Fragment, { key: nodeIndex }, [
                      node.type === "cite" ? (openBlock(), createElementBlock("sup", {
                        key: 0,
                        class: normalizeClass(["pp7-chat-cite", { "is-highlight": node.hl }]),
                        "data-citation": node.citation,
                        role: "button",
                        tabindex: "0",
                        title: "查看第 " + node.citation + " 条来源",
                        onClick: ($event) => jumpToSource(message, node.citation),
                        onKeydown: withKeys(withModifiers(($event) => jumpToSource(message, node.citation), ["prevent"]), ["enter"])
                      }, toDisplayString(node.text), 43, _hoisted_10)) : (openBlock(), createElementBlock("span", {
                        key: 1,
                        class: normalizeClass({ "pp7-chat-msg__hl": node.hl })
                      }, toDisplayString(node.text), 3))
                    ], 64);
                  }), 128)),
                  message.streaming ? (openBlock(), createElementBlock("span", _hoisted_11)) : createCommentVNode("", true)
                ], 64)) : message.streaming ? (openBlock(), createElementBlock("span", _hoisted_12, [..._cache[3] || (_cache[3] = [
                  createElementVNode("i", null, null, -1),
                  createElementVNode("i", null, null, -1),
                  createElementVNode("i", null, null, -1)
                ])])) : (openBlock(), createElementBlock("span", _hoisted_13, "（空回答）")),
                message.error ? (openBlock(), createElementBlock("div", _hoisted_14, toDisplayString(message.error), 1)) : createCommentVNode("", true)
              ]),
              showSources.value && message.role === "assistant" && (((_a = message.sources) == null ? void 0 : _a.length) ?? 0) > 0 ? (openBlock(), createElementBlock("div", _hoisted_15, [
                createElementVNode("p", _hoisted_16, [
                  createElementVNode("span", null, "参考资料 " + toDisplayString((_b = message.sources) == null ? void 0 : _b.length) + " 条", 1),
                  message.style ? (openBlock(), createElementBlock("span", _hoisted_17, toDisplayString(message.style), 1)) : createCommentVNode("", true),
                  (((_c = message.citations) == null ? void 0 : _c.length) ?? 0) > 0 ? (openBlock(), createElementBlock("span", _hoisted_18, " 引用 " + toDisplayString((_d = message.citations) == null ? void 0 : _d.join("、")), 1)) : createCommentVNode("", true)
                ]),
                createElementVNode("ul", null, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(message.sources ?? [], (source, sourceIndex) => {
                    return openBlock(), createElementBlock("li", {
                      key: String(source.id),
                      ref_for: true,
                      ref: (el) => setSourceCardRef(message.id, unref(sourceCitation)(source, sourceIndex), el),
                      class: normalizeClass(["pp7-chat-sources__item", {
                        "is-flash": flashedSource.value === sourceKey(message.id, unref(sourceCitation)(source, sourceIndex))
                      }]),
                      "data-citation": unref(sourceCitation)(source, sourceIndex)
                    }, [
                      createElementVNode("div", _hoisted_20, [
                        createElementVNode("span", _hoisted_21, "[" + toDisplayString(unref(sourceCitation)(source, sourceIndex)) + "]", 1),
                        createElementVNode("span", _hoisted_22, toDisplayString(source.title), 1),
                        createElementVNode("span", _hoisted_23, toDisplayString(formatScore(source.score)), 1)
                      ]),
                      createElementVNode("p", _hoisted_24, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(termParts(source), (part, partIndex) => {
                          return openBlock(), createElementBlock(Fragment, { key: partIndex }, [
                            part.hit ? (openBlock(), createElementBlock("mark", _hoisted_25, toDisplayString(part.text), 1)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                              createTextVNode(toDisplayString(part.text), 1)
                            ], 64))
                          ], 64);
                        }), 128))
                      ]),
                      source.text ? (openBlock(), createElementBlock("button", {
                        key: 0,
                        type: "button",
                        class: "pp7-chat-sources__toggle",
                        onClick: ($event) => toggleSource(message.id, unref(sourceCitation)(source, sourceIndex))
                      }, toDisplayString(isSourceExpanded(message.id, unref(sourceCitation)(source, sourceIndex)) ? "收起原文" : "展开原文"), 9, _hoisted_26)) : createCommentVNode("", true),
                      isSourceExpanded(message.id, unref(sourceCitation)(source, sourceIndex)) ? (openBlock(), createElementBlock("p", _hoisted_27, toDisplayString(source.text), 1)) : createCommentVNode("", true)
                    ], 10, _hoisted_19);
                  }), 128))
                ])
              ])) : createCommentVNode("", true),
              message.role === "assistant" && message.content && !message.streaming ? (openBlock(), createElementBlock("div", _hoisted_28, [
                message.feedback ? (openBlock(), createElementBlock("span", _hoisted_29, toDisplayString(message.feedback === "up" ? "已反馈 👍" : "已反馈 👎"), 1)) : message.requestId ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createElementVNode("button", {
                    type: "button",
                    class: "pp7-chat-feedback__btn",
                    disabled: feedbackBusy.value === message.id,
                    title: "回答有帮助",
                    onClick: ($event) => vote(message, "up")
                  }, " 👍 ", 8, _hoisted_30),
                  createElementVNode("button", {
                    type: "button",
                    class: "pp7-chat-feedback__btn",
                    disabled: feedbackBusy.value === message.id,
                    title: "回答没帮助",
                    onClick: ($event) => vote(message, "down")
                  }, " 👎 ", 8, _hoisted_31)
                ], 64)) : createCommentVNode("", true),
                feedbackOpenFor.value === message.id ? (openBlock(), createElementBlock("form", {
                  key: 2,
                  class: "pp7-chat-feedback__form",
                  onSubmit: withModifiers(($event) => submitDownFeedback(message), ["prevent"])
                }, [
                  withDirectives(createElementVNode("input", {
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => feedbackComment.value = $event),
                    class: "pp7-chat-feedback__input",
                    maxlength: "500",
                    placeholder: "哪里不满意？可留空"
                  }, null, 512), [
                    [vModelText, feedbackComment.value]
                  ]),
                  createElementVNode("button", {
                    type: "submit",
                    class: "pp7-chat-feedback__submit",
                    disabled: feedbackBusy.value === message.id
                  }, " 提交 ", 8, _hoisted_33),
                  createElementVNode("button", {
                    type: "button",
                    class: "pp7-chat-feedback__cancel",
                    onClick: cancelFeedback
                  }, " 取消 ")
                ], 40, _hoisted_32)) : createCommentVNode("", true)
              ])) : createCommentVNode("", true)
            ], 2);
          }), 128)),
          messages.value.length === 0 && !busy.value ? (openBlock(), createElementBlock("div", _hoisted_34, [
            createElementVNode("p", null, [
              _cache[4] || (_cache[4] = createTextVNode(" 试试这样问： ", -1)),
              suggestionsLoading.value ? (openBlock(), createElementBlock("span", _hoisted_35, "推荐加载中…")) : createCommentVNode("", true)
            ]),
            (openBlock(true), createElementBlock(Fragment, null, renderList(suggestions.value, (suggestion) => {
              return openBlock(), createElementBlock("button", {
                key: suggestion,
                type: "button",
                class: "pp7-chat-hint",
                onClick: ($event) => askSuggestion(suggestion)
              }, toDisplayString(suggestion), 9, _hoisted_36);
            }), 128))
          ])) : createCommentVNode("", true)
        ], 512),
        chatError.value || recordError.value ? (openBlock(), createElementBlock("div", _hoisted_37, [
          createElementVNode("span", null, toDisplayString(recordError.value ?? chatError.value), 1),
          createElementVNode("button", {
            type: "button",
            class: "pp7-chat-alert__close",
            "aria-label": "关闭错误提示",
            onClick: dismissError
          }, " × ")
        ])) : createCommentVNode("", true),
        recording.value || vadNotice.value ? (openBlock(), createElementBlock("div", _hoisted_38, [
          _cache[5] || (_cache[5] = createElementVNode("span", { class: "pp7-chat-recording__dot" }, null, -1)),
          createElementVNode("div", _hoisted_39, [
            recording.value && !partialText.value ? (openBlock(), createElementBlock("span", _hoisted_40, "正在聆听 " + toDisplayString(recordSeconds.value) + "s · 点麦克风结束并发送", 1)) : createCommentVNode("", true),
            partialText.value ? (openBlock(), createElementBlock("span", _hoisted_41, "识别中：" + toDisplayString(partialText.value), 1)) : createCommentVNode("", true),
            vadNotice.value ? (openBlock(), createElementBlock("span", _hoisted_42, toDisplayString(vadNotice.value), 1)) : createCommentVNode("", true)
          ]),
          recording.value ? (openBlock(), createElementBlock("span", _hoisted_43, [
            createElementVNode("i", {
              style: normalizeStyle({
                transform: "scaleX(" + Math.max(0.05, Math.min(1, recordLevel.value)) + ")"
              })
            }, null, 4)
          ])) : createCommentVNode("", true)
        ])) : createCommentVNode("", true),
        createElementVNode("form", {
          class: "pp7-chat-input",
          onSubmit: withModifiers(send, ["prevent"])
        }, [
          config.value.enableVoice ? (openBlock(), createElementBlock("button", {
            key: 0,
            type: "button",
            class: normalizeClass(["pp7-chat-mic", { "is-recording": recording.value }]),
            disabled: transcribing.value,
            title: recording.value ? "结束录音并发送" : "语音提问",
            "aria-label": recording.value ? "结束录音并发送" : "语音提问",
            onClick: toggleRecording
          }, [
            _cache[6] || (_cache[6] = createElementVNode("svg", {
              viewBox: "0 0 24 24",
              "aria-hidden": "true"
            }, [
              createElementVNode("path", { d: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" }),
              createElementVNode("path", { d: "M19 11a7 7 0 0 1-14 0" }),
              createElementVNode("path", { d: "M12 18v3" })
            ], -1)),
            recording.value ? (openBlock(), createElementBlock("span", _hoisted_45)) : createCommentVNode("", true)
          ], 10, _hoisted_44)) : createCommentVNode("", true),
          withDirectives(createElementVNode("textarea", {
            ref_key: "inputRef",
            ref: inputRef,
            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => draft.value = $event),
            class: "pp7-chat-textarea",
            rows: "1",
            placeholder: config.value.placeholder,
            disabled: transcribing.value,
            onInput: autoGrow,
            onKeydown
          }, null, 40, _hoisted_46), [
            [vModelText, draft.value]
          ]),
          createElementVNode("button", {
            type: "submit",
            class: "pp7-chat-send",
            disabled: !draft.value.trim() || busy.value,
            "aria-label": "发送"
          }, [..._cache[7] || (_cache[7] = [
            createElementVNode("svg", {
              viewBox: "0 0 24 24",
              "aria-hidden": "true"
            }, [
              createElementVNode("path", { d: "M4 12 20 4l-6 16-2.5-6.5L4 12Z" })
            ], -1)
          ])], 8, _hoisted_47)
        ], 32),
        _cache[8] || (_cache[8] = createElementVNode("p", { class: "pp7-chat-footer" }, " Enter 发送 · Shift+Enter 换行 · 语音点击开始 / 再点结束（连续停顿自动结束） ", -1))
      ], 40, _hoisted_1$1);
    };
  }
});
const ChatPanel = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-fca610f9"]]);
const _hoisted_1 = ["data-theme", "lang"];
const _hoisted_2 = { class: "pp7-rag-avatar__stage" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "RagAvatar",
  props: {
    chat: {},
    apiBaseUrl: {},
    characterSrc: {},
    enableVoice: { type: Boolean, default: void 0 },
    language: {},
    theme: {},
    position: {},
    width: {},
    height: {},
    topK: {},
    sessionId: {},
    title: {},
    placeholder: {},
    autoSpeak: { type: Boolean, default: void 0 },
    voice: {},
    speed: {},
    ttsVoice: {},
    streamMode: {},
    leadIn: { type: [Boolean, String], default: void 0 },
    streamAsr: { type: Boolean, default: void 0 },
    persistSession: { type: Boolean, default: void 0 },
    showSources: { type: Boolean, default: void 0 },
    suggestions: { type: Boolean, default: void 0 },
    vad: { type: Boolean, default: void 0 },
    vadSilenceMs: {},
    requestHeaders: {},
    fetch: {},
    avatarRenderer: {}
  },
  emits: ["ready", "answer", "sources", "error", "state-change", "voice-state", "partial", "vad-silence", "feedback"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const injected = inject(RAG_AVATAR_CONFIG_KEY, void 0);
    const resolved = computed(() => resolveRagAvatarConfig(injected, pickRagAvatarConfig(props)));
    const resolvedTheme = useResolvedTheme(computed(() => resolved.value.theme));
    const voiceRecording = ref(false);
    const warmupController = new AbortController();
    const ownsChat = !props.chat;
    const chat = props.chat ?? useRagChat({
      apiBaseUrl: resolved.value.apiBaseUrl,
      requestHeaders: resolved.value.requestHeaders,
      fetch: resolved.value.fetch,
      topK: resolved.value.topK,
      sessionId: resolved.value.sessionId,
      autoSpeak: resolved.value.autoSpeak,
      voice: resolved.value.voice,
      speed: resolved.value.speed,
      streamMode: resolved.value.streamMode,
      leadIn: resolved.value.leadIn,
      persistSession: resolved.value.persistSession,
      onAnswer: (payload) => {
        emit("answer", payload);
      },
      onSources: (list) => {
        emit("sources", list);
      },
      onError: (error) => {
        emit("error", error.message);
      },
      onStateChange: (next) => {
        emit("state-change", next);
      }
    });
    const avatarState = computed(() => {
      if (chat.transcribing.value) return "thinking";
      const pipeline = chat.state.value;
      if (pipeline === "loading" || pipeline === "streaming") return "thinking";
      if (pipeline === "speaking" || chat.speaking.value) return "speaking";
      if (voiceRecording.value) return "listening";
      return "idle";
    });
    const avatarAmplitude = computed(() => chat.amplitude.value);
    const positionClass = computed(() => `pp7-rag-avatar--${resolved.value.position}`);
    const rootStyle = computed(() => {
      const toSize = (value) => typeof value === "number" ? `${value}px` : value;
      return {
        "--pp7-width": toSize(resolved.value.width),
        "--pp7-height": toSize(resolved.value.height)
      };
    });
    function onVoiceState(recording) {
      voiceRecording.value = recording;
      emit("voice-state", recording);
    }
    onMounted(() => {
      emit("ready", { apiBaseUrl: resolved.value.apiBaseUrl, config: resolved.value });
      if (resolved.value.enableVoice) {
        void prewarmRagHealth(chat.client, warmupController.signal);
      }
    });
    onBeforeUnmount(() => {
      warmupController.abort();
      if (voiceRecording.value) {
        voiceRecording.value = false;
        emit("voice-state", false);
      }
      if (ownsChat) chat.dispose();
    });
    __expose({
      chat,
      ask: (question) => chat.ask(question),
      interrupt: () => chat.interrupt(),
      reset: () => chat.reset()
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["pp7-rag-avatar", positionClass.value]),
        "data-theme": unref(resolvedTheme),
        lang: resolved.value.language,
        style: normalizeStyle(rootStyle.value)
      }, [
        createElementVNode("div", _hoisted_2, [
          createVNode(AvatarStage, {
            "character-src": resolved.value.characterSrc,
            theme: resolved.value.theme,
            state: avatarState.value,
            amplitude: avatarAmplitude.value,
            alt: resolved.value.title,
            "renderer-factory": resolved.value.avatarRenderer
          }, null, 8, ["character-src", "theme", "state", "amplitude", "alt", "renderer-factory"])
        ]),
        createVNode(ChatPanel, {
          class: "pp7-rag-avatar__panel",
          chat: unref(chat),
          title: resolved.value.title,
          placeholder: resolved.value.placeholder,
          "enable-voice": resolved.value.enableVoice,
          "show-sources": resolved.value.showSources,
          theme: resolved.value.theme,
          "auto-speak": resolved.value.autoSpeak,
          voice: resolved.value.voice,
          speed: resolved.value.speed,
          "stream-asr": resolved.value.streamAsr,
          suggestions: resolved.value.suggestions,
          vad: resolved.value.vad,
          "vad-silence-ms": resolved.value.vadSilenceMs,
          "api-base-url": resolved.value.apiBaseUrl,
          "top-k": resolved.value.topK,
          onVoiceState,
          onPartial: _cache[0] || (_cache[0] = (text) => emit("partial", text)),
          onVadSilence: _cache[1] || (_cache[1] = (payload) => emit("vad-silence", payload)),
          onFeedback: _cache[2] || (_cache[2] = (payload) => emit("feedback", payload))
        }, null, 8, ["chat", "title", "placeholder", "enable-voice", "show-sources", "theme", "auto-speak", "voice", "speed", "stream-asr", "suggestions", "vad", "vad-silence-ms", "api-base-url", "top-k"])
      ], 14, _hoisted_1);
    };
  }
});
const RagAvatar = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-fb0cd0ca"]]);
const RagAvatarPlugin = {
  install(app, options = {}) {
    app.provide(RAG_AVATAR_CONFIG_KEY, { ...options });
    app.component("RagAvatar", RagAvatar);
    app.component("AvatarStage", AvatarStage);
    app.component("ChatPanel", ChatPanel);
  }
};
function getAudioContextCtor() {
  const globalRef = globalThis;
  return globalRef.AudioContext ?? globalRef.webkitAudioContext;
}
function createWavPlayer(options = {}) {
  let context = null;
  let analyser = null;
  let amplitudeData = null;
  let rafId = 0;
  let smoothedLevel = 0;
  let state = "idle";
  let disposed = false;
  let pumping = false;
  let activeSource = null;
  let activeFinish = null;
  let queue = [];
  let idleWaiters = [];
  function setState(next) {
    var _a;
    if (state === next) return;
    state = next;
    (_a = options.onStateChange) == null ? void 0 : _a.call(options, next);
  }
  function notifyAmplitude(level, speaking) {
    var _a;
    (_a = options.onAmplitude) == null ? void 0 : _a.call(options, level, speaking);
  }
  function createContext() {
    if (context) return context;
    let ctx;
    if (options.audioContextFactory) {
      ctx = options.audioContextFactory();
    } else {
      const Ctor = getAudioContextCtor();
      if (!Ctor) throw new RagError("当前环境不支持 Web Audio", "unsupported");
      ctx = new Ctor();
    }
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.5;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    analyserNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    context = ctx;
    analyser = analyserNode;
    amplitudeData = new Float32Array(analyserNode.fftSize);
    return ctx;
  }
  function resolveIdleWaiters() {
    if (idleWaiters.length === 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
  function isQuiet() {
    return !pumping && queue.length === 0 && activeSource === null;
  }
  function stopLevelLoop() {
    if (rafId !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
    rafId = 0;
    smoothedLevel = 0;
  }
  function startLevelLoop() {
    if (rafId !== 0) return;
    const canRaf = typeof requestAnimationFrame === "function";
    if (!canRaf) return;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!analyser || !amplitudeData) return;
      analyser.getFloatTimeDomainData(amplitudeData);
      let sum = 0;
      for (let i = 0; i < amplitudeData.length; i += 1) {
        const value = amplitudeData[i] ?? 0;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / amplitudeData.length);
      const level = Math.min(1, rms * 3.4);
      smoothedLevel = smoothedLevel * 0.55 + level * 0.45;
      notifyAmplitude(smoothedLevel, true);
    };
    rafId = requestAnimationFrame(tick);
  }
  async function playClip(clip) {
    const ctx = createContext();
    const data = await toArrayBuffer(clip.source);
    if (disposed || clip.done) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
      }
    }
    const audioBuffer = await ctx.decodeAudioData(data.slice(0));
    if (disposed || clip.done) return;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    if (analyser) source.connect(analyser);
    activeSource = source;
    setState("playing");
    startLevelLoop();
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        activeFinish = null;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(
        finish,
        Math.max(2e3, audioBuffer.duration * 1e3 + 2500)
      );
      activeFinish = finish;
      source.onended = finish;
      try {
        source.start();
      } catch {
        finish();
      }
    });
    try {
      source.disconnect();
    } catch {
    }
    if (activeSource === source) activeSource = null;
  }
  async function pump() {
    if (pumping || disposed) return;
    pumping = true;
    try {
      while (!disposed && queue.length > 0) {
        const clip = queue[0];
        if (!clip) break;
        if (clip.done) {
          queue.shift();
          continue;
        }
        try {
          await playClip(clip);
        } catch {
        }
        clip.done = true;
        clip.resolve();
        if (queue[0] === clip) queue.shift();
      }
    } finally {
      pumping = false;
      if (!disposed && isQuiet()) {
        setState("idle");
        stopLevelLoop();
        notifyAmplitude(0, false);
        resolveIdleWaiters();
      }
    }
  }
  function stop() {
    const waiters = queue;
    queue = [];
    for (const clip of waiters) {
      clip.done = true;
      clip.resolve();
    }
    const finish = activeFinish;
    activeFinish = null;
    if (activeSource) {
      const source = activeSource;
      activeSource = null;
      try {
        source.stop();
      } catch {
      }
    }
    if (finish) finish();
    setState("idle");
    stopLevelLoop();
    notifyAmplitude(0, false);
    if (isQuiet()) resolveIdleWaiters();
  }
  return {
    get state() {
      return state;
    },
    async ensureReady() {
      if (disposed) throw new RagError("播放器已释放", "unsupported");
      const ctx = createContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
        }
      }
    },
    enqueue(wav) {
      if (disposed) return Promise.resolve();
      return new Promise((resolve) => {
        queue.push({ source: wav, resolve, done: false });
        void pump();
      });
    },
    stop,
    whenIdle() {
      if (isQuiet()) return Promise.resolve();
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      const ctx = context;
      context = null;
      analyser = null;
      amplitudeData = null;
      if (ctx) {
        void ctx.close().catch(() => {
        });
      }
      resolveIdleWaiters();
    }
  };
}
export {
  ASR_STREAM_SAMPLE_RATE,
  AvatarStage,
  ChatPanel,
  DEFAULT_CHARACTER_SRC,
  DEFAULT_RAG_AVATAR_CONFIG,
  DEFAULT_RAG_SUGGESTIONS,
  DEFAULT_TTS_SPEED,
  RAG_AVATAR_CONFIG_KEY,
  RAG_AVATAR_CONFIG_KEYS,
  RagAvatar,
  RagAvatarPlugin,
  RagError,
  RagStreamConnection,
  TTS_SPEED_MAX,
  TTS_SPEED_MIN,
  buildRichNodes,
  clampSpeed,
  createAsrStreamSession,
  createPcmStreamPlayer,
  createRagClient,
  createRagStreamConnection,
  createSseParser,
  createStaticAvatarRenderer,
  createWavPlayer,
  createWavRecorder,
  decodeWavPcm,
  RagAvatar as default,
  downsampleBuffer,
  encodeWav,
  extractCitationNumbers,
  extractCompleteSentences,
  extractSpeakableSegments,
  float32ToInt16,
  highlightTermParts,
  isAbortError,
  isAsrStreamSupported,
  loadRagSuggestions,
  locateSegmentText,
  normalizeSpeed,
  parseRagStreamEvent,
  pickRagAvatarConfig,
  prewarmRagHealth,
  readSseStream,
  resetRagWarmupCache,
  resetSuggestionCache,
  resolveRagAvatarConfig,
  resolveRagRoot,
  resolveRagWebSocketUrl,
  resolveStreamUrl,
  sourceCitation,
  splitSentences,
  splitSpeakableText,
  toArrayBuffer,
  toRagError,
  useInjectedRagAvatarConfig,
  useRagAvatarConfig,
  useRagChat,
  useResolvedTheme
};
