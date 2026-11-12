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
      :fetch="agentFetch"
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

    <!-- 语音唤醒开关 -->
    <button
      type="button"
      class="agent-dock__wake"
      :class="{ 'is-on': wakeOn }"
      :title="wakeOn ? '关闭语音唤醒' : '开启语音唤醒：说「' + wakePhrase + '」，进入连续对话'"
      :aria-label="wakeOn ? '关闭语音唤醒' : '开启语音唤醒'"
      @click="toggleWake"
    >
      <span class="agent-dock__wake-icon">🎧</span>
      <span class="agent-dock__wake-label">{{ wakeLabel }}</span>
    </button>

    <!-- 连续对话状态：点麦克风结束 -->
    <div v-if="conversationOn" class="agent-dock__conv" :class="'is-' + conversationStatus">
      <span class="agent-dock__conv-dot" aria-hidden="true"></span>
      <span>{{ conversationLabel }}</span>
      <span class="agent-dock__conv-hint">点麦克风结束</span>
    </div>

    <!-- 收起 / 展开（看板页不使用：那里是页面布局的一部分） -->
    <button
      v-if="!isBoard"
      type="button"
      class="agent-dock__toggle"
      :title="collapsed ? '展开助手' : '收起助手'"
      :aria-label="collapsed ? '展开助手' : '收起助手'"
      @click="collapsed = !collapsed"
    >
      {{ collapsed ? '🎙' : '—' }}
    </button>

    <button
      v-if="!isBoard && collapsed"
      type="button"
      class="agent-dock__bubble"
      title="展开项目助手"
      aria-label="展开项目助手"
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
import { Message } from '@arco-design/web-vue'
import RagAvatar, { DEFAULT_CHARACTER_SRC } from '../../vendor/rag-avatar/rag-avatar.js'
import { agentFetch } from '../agent/fetch'
import { setActionFailureHandler } from '../agent/bus'
import { createWakeWordDetector, getWakePhrase, WAKE_PHRASE_EVENT, type WakeStatus } from '../agent/wake'
import { createConversationLoop, type ConversationStatus } from '../agent/conversation'
import { uiState } from '../agent/uiState'

const props = defineProps<{ page: 'kanban' | 'edit' | 'admin' }>()

const dockEl = ref<HTMLDivElement | null>(null)
interface ChatLike {
  messages?: { value: unknown[] }
  busy?: { value: boolean }
  speaking?: { value: boolean }
  interrupt?: () => void
  ask?: (question: string) => Promise<void> | void
  primeAudio?: () => Promise<void> | void
}

const avatarRef = ref<{ chat?: ChatLike } | null>(null)
const wakeOn = ref(false)
const wakeStatus = ref<WakeStatus>('off')
const wakePhrase = ref(getWakePhrase())
const conversationOn = ref(false)
const conversationStatus = ref<ConversationStatus>('off')
let wakeDetector: ReturnType<typeof createWakeWordDetector> | null = null
let conversationLoop: ReturnType<typeof createConversationLoop> | null = null
// 直接打开后台/编辑页时也默认收起（不依赖页面切换事件）
const collapsed = ref(props.page !== 'kanban')
const boardRect = ref({ left: 0, top: 0, scale: 1 })
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const characterSrc = DEFAULT_CHARACTER_SRC as string

const isBoard = computed(() => props.page === 'kanban')

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

// 设置页改了唤醒词后，常驻浮层的提示文案立即跟着变（唤醒检测本身每次都会读最新值）
const onWakePhraseChanged = (event: Event): void => {
  const next = (event as CustomEvent<string>).detail
  if (typeof next === 'string' && next) wakePhrase.value = next
}

const wakeLabel = computed(() => {
  if (conversationOn.value) return '连续对话中'
  switch (wakeStatus.value) {
    case 'listening':
      return '在听「' + wakePhrase.value + '」'
    case 'speech':
      return '听到了…'
    case 'transcribing':
      return '识别中…'
    case 'detected':
      return '我在'
    case 'error':
      return '麦克风不可用'
    default:
      return '语音唤醒'
  }
})

const conversationLabel = computed(() => {
  switch (conversationStatus.value) {
    case 'listening':
      return '连续对话 · 在听'
    case 'speech':
      return '连续对话 · 听到了'
    case 'transcribing':
      return '连续对话 · 识别中'
    case 'waiting':
      return '连续对话 · 助手回答中'
    case 'error':
      return '连续对话 · 麦克风不可用'
    default:
      return '连续对话'
  }
})

/**
 * 数字人是否已经安静下来（思考和播报都停了 0.7s）。
 * TTS 是按句请求的，句与句之间 speaking 可能短暂变 false，
 * 加一个稳定期避免连续对话在句间空隙里把数字人自己的声音录进去。
 */
let chatIdleAt = 0
const chatIsIdle = (): boolean => {
  const chat = avatarRef.value?.chat
  if (chat?.busy?.value || chat?.speaking?.value) {
    chatIdleAt = 0
    return false
  }
  if (!chatIdleAt) chatIdleAt = Date.now()
  return Date.now() - chatIdleAt >= 700
}

/** 给 SDK 的麦克风按钮加一圈呼吸灯，提示「现在正在连续收音」 */
const setMicListening = (on: boolean): void => {
  const mic = dockEl.value?.querySelector('.pp7-chat-mic')
  if (mic) mic.classList.toggle('is-conversation', on)
}

/** 结束连续对话：停麦、打断回答、恢复唤醒监听 */
const endConversation = (notify = true): void => {
  if (!conversationOn.value) return
  conversationOn.value = false
  conversationStatus.value = 'off'
  conversationLoop?.stop()
  conversationLoop = null
  setMicListening(false)
  const chat = avatarRef.value?.chat
  if (chat?.busy?.value || chat?.speaking?.value) chat.interrupt?.()
  if (notify) Message.info({ content: '已结束连续对话', duration: 1600 })
}

/** 唤醒后进入连续对话：一直听 → 自动提问 → 回答完继续听，直到点麦克风 */
const startConversation = (): void => {
  if (conversationOn.value) return
  if (!avatarRef.value?.chat) return
  conversationOn.value = true
  collapsed.value = false
  conversationStatus.value = 'listening'
  setMicListening(true)
  Message.success({ content: '我在，请说；点麦克风结束连续对话', duration: 2400 })
  conversationLoop = createConversationLoop({
    shouldPause: () => {
      if (!chatIsIdle()) return true
      // 用户自己点了麦克风按钮、SDK 正在单句录音时也让路
      return !!dockEl.value?.querySelector('.pp7-chat-recording')
    },
    onTranscript: (text) => {
      const chat = avatarRef.value?.chat
      if (!chat?.ask) return
      conversationStatus.value = 'waiting'
      void chat.primeAudio?.()
      void chat.ask(text)
    },
    onStatus: (status) => {
      conversationStatus.value = status
    },
    onFatal: (message) => {
      Message.error({ content: '连续对话已结束：' + message, duration: 2400 })
      endConversation(false)
    }
  })
  conversationLoop.start()
}

const toggleWake = (): void => {
  if (wakeOn.value) {
    wakeDetector?.stop()
    wakeDetector = null
    wakeOn.value = false
    wakeStatus.value = 'off'
    return
  }
  const detector = createWakeWordDetector({
    phrase: wakePhrase.value,
    shouldPause: () => {
      if (conversationOn.value) return true
      if (!chatIsIdle()) return true
      return !!dockEl.value?.querySelector('.pp7-chat-recording')
    },
    onStatus: (status) => {
      wakeStatus.value = status
    },
    onWake: () => {
      // 唤醒后直接进入连续对话，不用再点麦克风
      collapsed.value = false
      startConversation()
    }
  })
  wakeDetector = detector
  wakeOn.value = true
  void detector.start()
}

/**
 * 语音打断（barge-in）：数字人还在播报或回答时点麦克风，先中断当前回答，
 * 再开始录音——否则麦克风会把数字人自己的声音录进去。
 */
const onClickCapture = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null
  if (!target || !target.closest('.pp7-chat-mic')) return
  if (conversationOn.value) {
    // 连续对话中：点麦克风 = 结束收音，不能再走 SDK 的「单句录音并发送」
    event.preventDefault()
    event.stopImmediatePropagation()
    endConversation()
    return
  }
  const chat = avatarRef.value?.chat
  if (!chat?.interrupt) return
  if (chat.speaking?.value || chat.busy?.value) {
    chat.interrupt()
  }
}

watch(
  () => props.page,
  async (next) => {
    // 后台/编辑页内容较满：默认收起成气泡，点开再展开
    if (next !== 'kanban') collapsed.value = true
    observedApp = null
    await nextTick()
    measure()
    observeApp()
    setTimeout(measure, 120)
    setTimeout(measure, 400)
  }
)

// 数字人在思考/播报时，连续对话先暂停收音
watch(
  () => [avatarRef.value?.chat?.busy?.value, avatarRef.value?.chat?.speaking?.value] as const,
  ([busy, speaking]) => {
    if (!conversationOn.value) return
    if (busy || speaking) conversationStatus.value = 'waiting'
  }
)

// 收起面板 / 打开灯箱遮罩时，结束连续对话（否则面板看不见但麦克风还开着）
watch(collapsed, (next) => {
  if (next) endConversation(false)
})

watch(
  () => uiState.modalOpen,
  (open) => {
    if (open) endConversation(false)
  }
)

onMounted(() => {
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
  window.addEventListener(WAKE_PHRASE_EVENT, onWakePhraseChanged)
  setTimeout(measure, 120)
  setTimeout(measure, 500)
})

onBeforeUnmount(() => {
  endConversation(false)
  conversationLoop?.stop()
  conversationLoop = null
  setMicListening(false)
  wakeDetector?.stop()
  wakeDetector = null
  setActionFailureHandler(null)
  window.removeEventListener('resize', measure)
  window.removeEventListener(WAKE_PHRASE_EVENT, onWakePhraseChanged)
  appObserver?.disconnect()
  cancelAnimationFrame(rafId)
})

</script>
