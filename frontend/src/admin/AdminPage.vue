<template>
  <div v-if="authState === 'checking'" class="admin-gate">
    <a-spin :loading="true" tip="正在检查访问权限…" />
  </div>
  <div v-else-if="authState === 'need-token'" class="admin-gate">
    <div class="admin-gate__card">
      <h2>管理后台</h2>
      <p>该环境启用了访问口令（ADMIN_TOKEN）。请输入口令后进入；口令只保存在本浏览器。</p>
      <a-input-password v-model="tokenInput" placeholder="管理口令" allow-clear @press-enter="submitToken" />
      <a-button type="primary" long :loading="checking" @click="submitToken">进入</a-button>
      <p v-if="authError" class="admin-gate__error">{{ authError }}</p>
    </div>
  </div>
  <AdminShell
    v-else
    :active="active"
    @change="(key) => (active = key)"
    @back="$emit('back')"
  >
    <component :is="currentView" @goto="(tab) => (active = tab)" />
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { refreshGlobalContext } from '../agent/context'
import { uiState } from '../agent/uiState'
import AdminShell from './AdminShell.vue'
import { getAdminToken, setAdminToken } from './auth'
import Dashboard from './views/Dashboard.vue'
import Conversations from './views/Conversations.vue'
import KnowledgeBase from './views/KnowledgeBase.vue'
import Settings from './views/Settings.vue'

defineEmits<{ (e: 'back'): void }>()

type TabKey = 'dashboard' | 'conversations' | 'knowledge' | 'settings'
const active = ref<TabKey>((uiState.adminTab as TabKey) || 'dashboard')

// 可选管理口令：服务端设置 ADMIN_TOKEN 时先验证一次，未设置时直接进入
const authState = ref<'checking' | 'ready' | 'need-token'>('checking')
const tokenInput = ref(getAdminToken())
const checking = ref(false)
const authError = ref('')

async function checkAdminAccess(showError = false): Promise<void> {
  checking.value = true
  try {
    const response = await fetch('/api/admin/stats')
    if (response.status === 401) {
      authState.value = 'need-token'
      if (showError) authError.value = '口令不正确，请重试'
      return
    }
    authState.value = 'ready'
    authError.value = ''
    // 后台数据由 agent/context 统一预取与刷新
    void refreshGlobalContext()
  } catch {
    // 网络异常时先进入，具体错误由页面自行提示
    authState.value = 'ready'
    void refreshGlobalContext()
  } finally {
    checking.value = false
  }
}

function submitToken(): void {
  setAdminToken(tokenInput.value)
  void checkAdminAccess(true)
}

// Agent 切换页签：外部改 uiState，本页跟随；手动点页签时回写 uiState
watch(
  () => uiState.adminTab,
  (tab) => {
    if (tab !== active.value) active.value = tab
  }
)
watch(active, (tab) => {
  uiState.adminTab = tab
})
const views = { dashboard: Dashboard, conversations: Conversations, knowledge: KnowledgeBase, settings: Settings }
const currentView = computed(() => views[active.value])

onMounted(() => {
  void checkAdminAccess()
})
</script>

<style scoped>
.admin-gate {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #f5f7fa;
}
.admin-gate__card {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}
.admin-gate__card h2 {
  margin: 0;
  font-size: 20px;
  color: #203345;
}
.admin-gate__card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #6b7a8c;
}
.admin-gate__error {
  color: #e5484d !important;
}
</style>
