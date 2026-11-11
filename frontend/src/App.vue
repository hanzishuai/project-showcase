<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import KanbanPage from './views/KanbanPage.vue'
import DataEditPage from './views/DataEditPage.vue'

const editing = ref(window.location.hash === '#/edit')
const syncRoute = () => {
  editing.value = window.location.hash === '#/edit'
}

onMounted(() => window.addEventListener('hashchange', syncRoute))
onBeforeUnmount(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template>
  <DataEditPage v-if="editing" />
  <KanbanPage v-else />
</template>
