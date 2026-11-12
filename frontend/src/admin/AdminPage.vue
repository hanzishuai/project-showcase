<template>
  <AdminShell
    :active="active"
    @change="(key) => (active = key)"
    @back="$emit('back')"
  >
    <component :is="currentView" @goto="(tab) => (active = tab)" />
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uiState } from '../agent/uiState'
import AdminShell from './AdminShell.vue'
import Dashboard from './views/Dashboard.vue'
import Conversations from './views/Conversations.vue'
import KnowledgeBase from './views/KnowledgeBase.vue'

defineEmits<{ (e: 'back'): void }>()

type TabKey = 'dashboard' | 'conversations' | 'knowledge'
const active = ref<TabKey>((uiState.adminTab as TabKey) || 'dashboard')

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
const views = { dashboard: Dashboard, conversations: Conversations, knowledge: KnowledgeBase }
const currentView = computed(() => views[active.value])
</script>
