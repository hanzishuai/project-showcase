<template>
  <div
    v-show="!uiState.modalOpen"
    ref="dockEl"
    class="agent-dock"
    :class="{ 'is-collapsed': collapsed }"
    :style="dockStyle"
    @click.capture="onClickCapture"
  >
    <RagAvatar
      ref="avatarRef"
      v-show="!collapsed"
      api-base-url=""
      :fetch="fetchWithNarration"
      stream-mode="sse"
      position="bottom-left"
      :width="600"
      :height="864"
      theme="dark"
      title="项目实践聚合平台 AI 助手"
      placeholder="问我问题，或让我帮你打开页面"
      :enable-voice="true"
      :auto-speak="true"
      :show-sources="true"
      :suggestions="true"
      :vad="true"
      :persist-session="true"
      @error="onError"
    />

    <div v-if="!collapsed" class="agent-voice-control">
      <button type="button" :class="{ active: voiceEnabled }" @click="toggleVoice">
        {{ voiceEnabled ? '关闭语音监听' : '开启语音唤醒' }}
      </button>
      <span role="status">{{ voiceMessage }}</span>
    </div>

    <section v-if="!collapsed && narrationDocument" class="agent-narration" aria-label="全文朗读">
      <div class="agent-narration__title">
        <strong>{{ narrationDocument.title }}</strong>
        <span role="status">{{ narrationLabel }}</span>
      </div>
      <progress :value="completed" :max="total" aria-label="朗读进度" />
      <div class="agent-narration__controls">
        <select :value="position.chapter + 1" aria-label="选择朗读章节" @change="selectChapter">
          <option v-for="(chapter, index) in narrationDocument.sections" :key="index" :value="index + 1">
            {{ index + 1 }}. {{ chapter.title }}
          </option>
        </select>
        <button type="button" @click="playingNarration ? narration.pause() : resumeFromCard()">
          {{ playingNarration ? '暂停' : narrationStatus === 'error' ? '重试' : narrationStatus === 'finished' ? '重播' : '继续' }}
        </button>
        <button type="button" @click="narration.stop()">停止</button>
      </div>
      <p v-if="narrationError && narrationStatus === 'error'" role="alert">{{ narrationError }}</p>
      <p v-else>{{ voiceEnabled ? '说“豆姐”可以打断，接着直接说你的问题。' : '开启语音唤醒后，可以说话打断。' }}</p>
    </section>

    <!-- 收起 / 展开（看板页不使用：那里是页面布局的一部分） -->
    <button
      v-if="!isBoard"
      type="button"
      class="agent-dock__toggle"
      :title="collapsed ? '展开助手' : '收起助手'"
      :aria-label="collapsed ? '展开助手' : '收起助手'"
      @click="toggleCollapsed"
    >
      {{ collapsed ? '🎙' : '—' }}
    </button>

    <button
      v-if="!isBoard && collapsed"
      type="button"
      class="agent-dock__bubble"
      :class="{ 'voice-active': voiceEnabled }"
      :title="voiceEnabled ? voiceMessage + ' · 点击展开助手' : '展开项目助手'"
      :aria-label="voiceEnabled ? '展开项目助手（正在监听麦克风）' : '展开项目助手'"
      @click="collapsed = false"
    >
      <img :src="characterSrc" alt="" />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * 数字人的全局挂载点：跨页面常驻。
 *
 * - 在看板页：精确贴合 .pet-stage（600×864）并按舞台缩放，视觉与之前一致；
 * - 在数据修改 / 管理后台：缩成右下角浮层，可最小化成圆形入口；
 * - 全屏灯箱打开时隐藏，避免压在遮罩上。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RagAvatar, { DEFAULT_CHARACTER_SRC } from '../../vendor/rag-avatar/rag-avatar.js'
import { agentFetch, clearAgentHistory } from '../agent/fetch'
import { registerAction, setActionFailureHandler } from '../agent/bus'
import { uiState } from '../agent/uiState'
import { narration } from '../agent/narration'
import { createVoiceLoop, INTERRUPT_PHRASE, WAKE_PHRASE, type VoiceStatus } from '../agent/voiceLoop'

const props = defineProps<{ page: 'kanban' | 'edit' | 'admin' }>()

const dockEl = ref<HTMLDivElement | null>(null)
interface ChatLike {
  state?: { value: string }
  messages?: { value: unknown[] }
  busy?: { value: boolean }
  speaking?: { value: boolean }
  interrupt?: () => void
  ask?: (text: string) => Promise<unknown>
  primeAudio?: () => Promise<unknown>
}

const avatarRef = ref<{ chat?: ChatLike } | null>(null)
// 直接打开后台/编辑页时也默认收起（不依赖页面切换事件）
const collapsed = ref(props.page !== 'kanban' || uiState.boardView !== 'board')
const boardRect = ref({ left: 0, top: 0, scale: 1 })
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const characterSrc = DEFAULT_CHARACTER_SRC as string

const isBoard = computed(() => props.page === 'kanban' && uiState.boardView === 'board')

const FLOAT_WIDTH = 380
const FLOAT_HEIGHT = 620
const BUBBLE = 88
const MARGIN = 24

const dockStyle = computed<Record<string, string>>(() => {
  if (isBoard.value) {
    return {
      left: boardRect.value.left + 'px',
      top: boardRect.value.top + 'px',
      width: '600px',
      height: '864px',
      transform: 'scale(' + boardRect.value.scale + ')',
      transformOrigin: 'top left'
    }
  }
  const shrink = collapsed.value
  const width = shrink ? BUBBLE : FLOAT_WIDTH
  const height = shrink ? BUBBLE : FLOAT_HEIGHT
  const left = Math.max(16, viewport.value.width - width - MARGIN)
  const top = Math.max(16, viewport.value.height - height - MARGIN)
  return {
    left: left + 'px',
    top: top + 'px',
    width: width + 'px',
    height: height + 'px',
    transform: 'none'
  }
})

const applyMeasure = () => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  if (!isBoard.value) return
  const target = document.querySelector('.pet-stage')
  if (!target) return
  const box = target.getBoundingClientRect()
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1
  boardRect.value = { left: box.left, top: box.top, scale }
}

let rafId = 0
const measure = () => {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(applyMeasure)
}

/**
 * #app 的等比缩放是 transform，不会触发 ResizeObserver，
 * 所以监听它的 style 变化来捕捉 fit() 的每次更新。
 */
let appObserver: MutationObserver | null = null
let observedApp: Element | null = null

const observeApp = () => {
  const appEl = document.querySelector('#app')
  if (!appEl || appEl === observedApp) return
  appObserver?.disconnect()
  observedApp = appEl
  appObserver = new MutationObserver(measure)
  appObserver.observe(appEl, { attributes: true, attributeFilter: ['style'] })
}

const onError = (message: string) => console.warn('[rag-avatar]', message)

const { document: narrationDocument, status: narrationStatus, error: narrationError, position, completed, total } = narration
const playingNarration = computed(() => ['loading', 'preparing', 'playing'].includes(narrationStatus.value))
const narrationLabel = computed(() => {
  const labels = { idle: '', loading: '正在载入', preparing: '正在准备', playing: '朗读中', paused: '已暂停', error: '待重试', finished: '已读完' }
  return labels[narrationStatus.value]
})
function isChatBusy() {
  const chat = avatarRef.value?.chat
  return !!(chat?.busy?.value || chat?.speaking?.value || chat?.state?.value === 'speaking')
}
const fetchWithNarration: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/v1/rag/ask')) narration.pause()
  return agentFetch(input, init)
}
function resumeFromCard() {
  avatarRef.value?.chat?.interrupt?.()
  narration.resume()
}
function selectChapter(event: Event) {
  avatarRef.value?.chat?.interrupt?.()
  narration.seek(Number((event.target as HTMLSelectElement).value))
}
watch(narrationDocument, doc => { if (doc) collapsed.value = false })

const voiceStatus = ref<VoiceStatus>('off')
const voiceError = ref('')
const voiceReply = ref('')
const voiceEnabled = ref(false)
const voiceLoop = createVoiceLoop({
  onStatus(status, detail) {
    voiceStatus.value = status
    voiceReply.value = status === 'answering' ? (detail || '') : ''
    if (status === 'error') { voiceEnabled.value = false; voiceError.value = detail || '语音不可用' }
  },
  isAssistantBusy: isChatBusy,
  isNarrating: () => narrationStatus.value === 'playing',
  onInterrupt() {
    narration.pause()
    avatarRef.value?.chat?.interrupt?.()
  },
  async onAcknowledge(text, signal) {
    const response = await fetch('/api/v1/rag/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal
    })
    if (!response.ok) throw new Error('语音播报服务不可用（' + response.status + '）')
    const audioUrl = URL.createObjectURL(await response.blob())
    const audio = new Audio(audioUrl)
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => { audio.pause(); reject(new DOMException('已停止', 'AbortError')) }
        if (signal.aborted) { abort(); return }
        signal.addEventListener('abort', abort, { once: true })
        audio.onended = () => { signal.removeEventListener('abort', abort); resolve() }
        audio.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('语音播放失败')) }
        audio.play().catch((error) => { signal.removeEventListener('abort', abort); reject(error) })
      })
    } finally { URL.revokeObjectURL(audioUrl) }
  },
  async onQuestion(text, signal) {
    const chat = avatarRef.value?.chat
    if (!chat?.ask) throw new Error('助手尚未准备好')
    if (signal.aborted) return
    const abort = () => chat.interrupt?.()
    signal.addEventListener('abort', abort, { once: true })
    try { await chat.ask(text) }
    finally { signal.removeEventListener('abort', abort) }
  }
})
const voiceMessage = computed(() => {
  switch (voiceStatus.value) {
    case 'wake': return '等待唤醒：说“' + WAKE_PHRASE + '”'
    case 'listening': return '连续对话中，请说话'
    case 'recognizing': return '正在识别…'
    case 'answering': return voiceReply.value || '助手回答中 · 说“' + INTERRUPT_PHRASE + '”打断'
    case 'error': return voiceError.value
    default: return '开启后语音将发送至识别服务'
  }
})
const toggleVoice = () => {
  if (voiceEnabled.value) { voiceEnabled.value = false; voiceLoop.stop(); return }
  voiceError.value = ''
  voiceEnabled.value = true
  void avatarRef.value?.chat?.primeAudio?.()
  voiceLoop.start()
}


/**
 * 语音打断（barge-in）：数字人还在播报或回答时点麦克风，先中断当前回答，
 * 再开始录音——否则麦克风会把数字人自己的声音录进去。
 */
const onClickCapture = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('button[title="清空对话"]')) clearAgentHistory()
  if (!target.closest('.pp7-chat-mic')) return
  narration.pause()
  if (voiceEnabled.value) { voiceEnabled.value = false; voiceLoop.stop() }
  const chat = avatarRef.value?.chat
  if (!chat?.interrupt) return
  if (chat.speaking?.value || chat.busy?.value) {
    chat.interrupt()
  }
}

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
  if (collapsed.value && voiceEnabled.value && !narrationDocument.value) toggleVoice()
}

watch(
  () => [props.page, isBoard.value] as const,
  async ([, board]) => {
    // 后台/编辑页内容较满：默认收起成气泡；回看板时恢复完整数字人
    // （看板页没有展开按钮，收起状态下数字人会一直不显示，必须重置）
    collapsed.value = !board
    observedApp = null
    await nextTick()
    measure()
    observeApp()
    setTimeout(measure, 120)
    setTimeout(measure, 400)
  }
)

let unregisterNarration: Array<() => void> = []
onMounted(() => {
  narration.setChatBusy(isChatBusy)
  unregisterNarration = [
    registerAction('start_narration', async (args, signal) => {
      const source = args.source === 'script' || args.source === 'document' ? args.source : undefined
      const chapter = typeof args.section === 'number' || typeof args.section === 'string' ? args.section : undefined
      const title = await narration.start(String(args.title ?? ''), source, chapter, signal)
      return `已准备朗读《${title}》。`
    }),
    registerAction('control_narration', args => {
      if (!narrationDocument.value) throw new Error('还没有选中一篇朗读文档。')
      switch (args.action) {
        case 'pause': narration.pause(); return '已暂停，保留朗读位置。'
        case 'resume': narration.resume(); return '接着刚才的位置朗读。'
        case 'stop': narration.stop(); return '已结束朗读。'
        case 'restart': narration.seek(1); return '从头朗读。'
        case 'previous': narration.seek(position.value.chapter); return '返回上一节。'
        case 'next': narration.seek(position.value.chapter + 2); return '跳到下一节。'
        case 'last': narration.seek(narrationDocument.value.sections.length); return '从最后一节开始朗读。'
        case 'seek':
          if (typeof args.section !== 'string' && typeof args.section !== 'number') throw new Error('请指定朗读章节。')
          narration.seek(args.section)
          return '已切换朗读章节。'
        default: return false
      }
    })
  ]
  // 动作执行失败时，让数字人自己说一句，而不是只弹 toast
  setActionFailureHandler((text) => {
    const messages = avatarRef.value?.chat?.messages
    if (!messages) return
    messages.value.push({
      id: 'agent-fail-' + Date.now(),
      role: 'assistant',
      content: text,
      createdAt: Date.now()
    })
  })
  measure()
  observeApp()
  window.addEventListener('resize', measure)
  setTimeout(measure, 120)
  setTimeout(measure, 500)
})

onBeforeUnmount(() => {
  voiceLoop.stop()
  narration.stop()
  narration.setChatBusy(() => false)
  unregisterNarration.forEach(off => off())
  setActionFailureHandler(null)
  window.removeEventListener('resize', measure)
  appObserver?.disconnect()
  cancelAnimationFrame(rafId)
})

</script>

<style scoped>
.agent-narration {
  position: absolute;
  z-index: 9;
  top: 68px;
  right: 8px;
  width: min(320px, calc(100% - 16px));
  padding: 12px;
  border: 1px solid #3b526e;
  border-radius: 12px;
  background: #121826;
  color: #e6edf7;
}
.agent-narration__title, .agent-narration__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.agent-narration__title strong, .agent-narration__controls select {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-narration__title span, .agent-narration p { color: #b1c1d4; font-size: 12px; }
.agent-narration progress { width: 100%; accent-color: #22b8c9; }
.agent-narration button, .agent-narration select {
  background: #172338;
  color: #e6edf7;
  border: 1px solid #3b526e;
  border-radius: 6px;
  padding: 5px 8px;
}
.agent-narration p { margin: 8px 0 0; }
</style>
