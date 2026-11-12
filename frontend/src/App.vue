<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import KanbanPage from './views/KanbanPage.vue'
import DataEditPage from './views/DataEditPage.vue'
import AdminPage from './admin/AdminPage.vue'

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

onMounted(() => window.addEventListener('hashchange', syncRoute))
onBeforeUnmount(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template>
  <AdminPage v-if="route === 'admin'" @back="goKanban" />
  <DataEditPage v-else-if="route === 'edit'" />
  <KanbanPage v-else />
</template>
