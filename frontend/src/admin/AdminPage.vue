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
import { computed, ref } from 'vue'
import AdminShell from './AdminShell.vue'
import Dashboard from './views/Dashboard.vue'
import Conversations from './views/Conversations.vue'
import KnowledgeBase from './views/KnowledgeBase.vue'

defineEmits<{ (e: 'back'): void }>()

type TabKey = 'dashboard' | 'conversations' | 'knowledge'
const active = ref<TabKey>('dashboard')
const views = { dashboard: Dashboard, conversations: Conversations, knowledge: KnowledgeBase }
const currentView = computed(() => views[active.value])
</script>
