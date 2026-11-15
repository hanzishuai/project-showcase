<template>
  <div class="admin-root">
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">聚</div>
          <div><strong>平台管理</strong><span>数字人 · RAG 工作台</span></div>
        </div>
        <div class="nav-label">工作台</div>
        <nav class="nav-list">
          <button
            v-for="item in items"
            :key="item.key"
            class="nav-link"
            :class="{ active: item.key === active }"
            type="button"
            @click="$emit('change', item.key)"
          >
            <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <button class="back-link" type="button" @click="$emit('back')">← 返回看板</button>
      </aside>
      <div class="shell-body">
        <header class="top-bar">
          <div>
            <span class="top-eyebrow">软件学院 · 项目实践聚合平台 / 管理工作台</span>
            <h1>{{ pageTitle }}</h1>
          </div>
        </header>
        <main class="main-content"><slot /></main>
        <footer class="main-footer">项目实践聚合平台 · 数字人管理 <span>·</span> {{ year }}</footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ active: string }>()
defineEmits<{ (e: 'change', key: 'dashboard' | 'conversations' | 'knowledge' | 'settings'): void; (e: 'back'): void }>()

const year = new Date().getFullYear()
const items = [
  { key: 'dashboard' as const, label: '工作概览', icon: '▦' },
  { key: 'conversations' as const, label: '对话记录', icon: '◫' },
  { key: 'knowledge' as const, label: '知识库管理', icon: '▤' },
  { key: 'settings' as const, label: '系统设置', icon: '⚙' }
]
const pageTitle = computed(() => items.find((item) => item.key === props.active)?.label || '管理工作台')
</script>
