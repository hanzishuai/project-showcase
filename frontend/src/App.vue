<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import KanbanPage from './views/KanbanPage.vue'
import DataEditPage from './views/DataEditPage.vue'
import AdminPage from './admin/AdminPage.vue'
import AgentDock from './components/AgentDock.vue'
import { registerAction } from './agent/bus'
import { Message, Modal } from '@arco-design/web-vue'
import { uiState } from './agent/uiState'

const hash = ref(window.location.hash)
const syncRoute = () => {
  hash.value = window.location.hash
}

const route = computed<'kanban' | 'edit' | 'admin'>(() => {
  if (hash.value.startsWith('#/admin')) return 'admin'
  if (hash.value === '#/edit') return 'edit'
  return 'kanban'
})

const goKanban = () => {
  window.location.hash = '#/'
}

const PAGE_HASH: Record<string, string> = { board: '#/', edit: '#/edit', admin: '#/admin' }

watch(
  route,
  (value) => {
    uiState.page = value === 'kanban' ? 'board' : value
  },
  { immediate: true }
)

let offs: Array<() => void> = []

onMounted(() => {
  window.addEventListener('hashchange', syncRoute)
  offs = [
    registerAction('navigate_page', (args) => {
      const page = String(args.page ?? '')
      const hash = PAGE_HASH[page]
      if (!hash) return false
      window.location.hash = hash
      return true
    }),
    // 写操作示例：重建知识库索引（先确认，再执行）
    registerAction('rebuild_knowledge_index', () => {
      uiState.adminTab = 'knowledge'
      window.location.hash = '#/admin'
      Modal.confirm({
        title: '重建知识库索引',
        content: '会重新切分所有文档并写入向量库，大约需要几秒。确定继续吗？',
        okText: '开始重建',
        cancelText: '取消',
        onOk: async () => {
          const res = await fetch('/api/v1/rag/knowledge/rebuild', { method: 'POST' })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            Message.error('重建失败：' + (data.detail || res.status))
            return
          }
          Message.success('索引已重建：' + (data.chunks ?? 0) + ' 个片段')
        }
      })
      return true
    }),
    // 同时处理「跳到后台 + 指定页签」，避免依赖 AdminPage 的挂载时机
    registerAction('open_admin_tab', (args) => {
      const tab = String(args.tab ?? 'dashboard')
      if (!['dashboard', 'conversations', 'knowledge'].includes(tab)) return false
      uiState.adminTab = tab as typeof uiState.adminTab
      window.location.hash = '#/admin'
      return true
    })
  ]
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute)
  offs.splice(0).forEach((off) => off())
})
</script>

<template>
  <AdminPage v-if="route === 'admin'" @back="goKanban" />
  <DataEditPage v-else-if="route === 'edit'" />
  <KanbanPage v-else />
  <!-- 数字人全局浮层：跨页面常驻，看板页贴合左侧留白区 -->
  <AgentDock :page="route" />
</template>
