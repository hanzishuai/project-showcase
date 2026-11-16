<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import KanbanPage from './views/KanbanPage.vue'
import DataEditPage from './views/DataEditPage.vue'
import AdminPage from './admin/AdminPage.vue'
import AgentDock from './components/AgentDock.vue'
import { registerAction } from './agent/bus'
import { refreshGlobalContext } from './agent/context'
import { uiState } from './agent/uiState'
import { initializeKanbanData } from './kanban/data'
import { getAdminToken } from './admin/auth'

const boardKey = ref(0)
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
    if (value === 'admin') void refreshGlobalContext()
  },
  { immediate: true }
)

let offs: Array<() => void> = []

onMounted(() => {
  window.addEventListener('hashchange', syncRoute)
  // 启动即预取全局数据：这样在看板页也能回答「后台有多少会话」
  void refreshGlobalContext()
  offs = [
    registerAction('navigate_page', async (args) => {
      const page = String(args.page ?? '')
      const hash = PAGE_HASH[page]
      if (!hash) return false
      window.location.hash = hash
      for (let i = 0; i < 40 && route.value !== (page === 'board' ? 'kanban' : page); i++) await new Promise(resolve => setTimeout(resolve, 50))
      return route.value === (page === 'board' ? 'kanban' : page) ? `已切换至${page === 'board' ? '生命周期看板' : page === 'edit' ? '数据修改' : '管理后台'}` : false
    }),
    // 同时处理「跳到后台 + 指定页签」，避免依赖 AdminPage 的挂载时机
    registerAction('open_admin_tab', async (args) => {
      const tab = String(args.tab ?? 'dashboard')
      if (!['dashboard', 'conversations', 'knowledge', 'settings'].includes(tab)) return false
      const access = await fetch('/api/admin/stats')
      if (!access.ok) throw new Error(access.status === 401 ? '请先输入管理员口令' : '无法访问管理后台')
      uiState.adminTab = tab as typeof uiState.adminTab
      window.location.hash = '#/admin'
      for (let i = 0; i < 40 && route.value !== 'admin'; i++) await new Promise(resolve => setTimeout(resolve, 50))
      return route.value === 'admin' ? `已打开管理后台${tab}` : false
    }),
    registerAction('confirm_board_change', async (args) => {
      const change = args.change as Record<string, unknown>
      if (!change || typeof change !== 'object') throw new Error('修改内容无效')
      const before = typeof args.before === 'string' ? args.before : JSON.stringify(args.before, null, 2)
      const after = typeof args.after === 'string' ? args.after : JSON.stringify(args.after, null, 2)
      const confirmationStarted = Date.now()
      const confirmed = window.confirm(`${String(args.label)}：${String(change.project)}\n\n修改前：${before || '（空）'}\n\n修改后：${after}\n\n确认保存？`)
      if (!confirmed) throw new Error('用户取消修改，未保存')
      if (Date.now() - confirmationStarted >= 170000) throw new Error('确认已超时，请重新发起修改')
      const token = getAdminToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['X-Admin-Token'] = token
      const response = await fetch('/api/board/change', { method: 'POST', headers, body: JSON.stringify(change) })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('没有管理权限，请先进入管理后台输入口令')
        const body = await response.json().catch(() => ({}))
        throw new Error(typeof body.detail === 'string' ? body.detail : '保存失败')
      }
      const result = await response.json()
      await initializeKanbanData()
      boardKey.value++
      return String(result.message || '修改已保存')
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
  <KanbanPage v-else :key="boardKey" />
  <!-- 数字人全局浮层：跨页面常驻，看板页贴合左侧留白区 -->
  <AgentDock :page="route" />
</template>
