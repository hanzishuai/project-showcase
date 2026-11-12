<template>
  <div v-show="!uiState.modalOpen" ref="dockEl" class="agent-dock" :style="dockStyle">
    <RagAvatar
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
  </div>
</template>

<script setup lang="ts">
/**
 * 数字人的全局挂载点：跨页面常驻。
 *
 * - 在看板页：精确贴合 .pet-stage（600×864）并按舞台缩放，视觉与之前一致；
 * - 在数据修改 / 管理后台：缩成右下角浮层，继续可用；
 * - 全屏灯箱打开时隐藏，避免压在遮罩上。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import RagAvatar from '../../vendor/rag-avatar/rag-avatar.js'
import { agentFetch } from '../agent/fetch'
import { uiState } from '../agent/uiState'

const props = defineProps<{ page: 'kanban' | 'edit' | 'admin' }>()

const dockEl = ref<HTMLDivElement | null>(null)
const boardRect = ref({ left: 0, top: 0, scale: 1 })
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })

const isBoard = computed(() => props.page === 'kanban')

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
  const width = 380
  const height = 620
  const left = Math.max(16, viewport.value.width - width - 24)
  const top = Math.max(16, viewport.value.height - height - 24)
  return {
    left: left + 'px',
    top: top + 'px',
    width: width + 'px',
    height: height + 'px',
    transform: 'none'
  }
})

const measure = () => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  if (!isBoard.value) return
  const target = document.querySelector('.pet-stage')
  if (!target) return
  const box = target.getBoundingClientRect()
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  boardRect.value = { left: box.left, top: box.top, scale }
}

const onError = (message: string) => console.warn('[rag-avatar]', message)

watch(
  () => props.page,
  async () => {
    await nextTick()
    requestAnimationFrame(measure)
  }
)

onMounted(() => {
  requestAnimationFrame(measure)
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>
