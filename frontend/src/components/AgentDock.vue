<template>
  <div v-show="!uiState.modalOpen" ref="dockEl" class="agent-dock" :class="{ 'is-collapsed': collapsed }" :style="dockStyle">
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
import RagAvatar, { DEFAULT_CHARACTER_SRC } from '../../vendor/rag-avatar/rag-avatar.js'
import { agentFetch } from '../agent/fetch'
import { setActionFailureHandler } from '../agent/bus'
import { uiState } from '../agent/uiState'

const props = defineProps<{ page: 'kanban' | 'edit' | 'admin' }>()

const dockEl = ref<HTMLDivElement | null>(null)
const avatarRef = ref<{ chat?: { messages?: { value: unknown[] } } } | null>(null)
const collapsed = ref(false)
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

watch(
  () => props.page,
  async (next) => {
    if (next !== 'kanban') collapsed.value = false
    observedApp = null
    await nextTick()
    measure()
    observeApp()
    setTimeout(measure, 120)
    setTimeout(measure, 400)
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
  setTimeout(measure, 120)
  setTimeout(measure, 500)
})

onBeforeUnmount(() => {
  setActionFailureHandler(null)
  window.removeEventListener('resize', measure)
  appObserver?.disconnect()
  cancelAnimationFrame(rafId)
})

</script>
