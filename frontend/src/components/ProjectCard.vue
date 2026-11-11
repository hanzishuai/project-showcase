<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectSummary } from '../api'

const props = defineProps<{ project: ProjectSummary }>()

const statusText = computed(() => props.project.status ?? '—')
const stageDone = computed(() => Math.max(0, Math.min(6, props.project.stage_done ?? 0)))
const developers = computed(() => props.project.developers ?? [])
const developerNames = computed(() => developers.value.map((item) => item.name).filter(Boolean).join('、') || '—')
const developerNote = computed(() => {
  if (!developers.value.length) return '0 人已录入 · 待补充'
  const roles = developers.value.map((item) => item.role).filter(Boolean)
  return roles.length ? roles.join(' · ') : '已录入'
})
const advisorText = computed(() => props.project.advisor || '—')
const phaseLabel = computed(() => {
  const value = (props.project.stage_label || '').trim()
  return !value || value.includes('文档未提供') ? '文档未提供' : value
})
const progressNote = computed(() => {
  const text = (props.project.stage_note || '').replace(/[「」]/g, '').trim()
  if (!text || text.includes('文档未提供结构化阶段')) return '文档未提供阶段叙述'
  const first = text.split(/[。；]/)[0]
  return first.length > 26 ? first.slice(0, 26) + '…' : first
})
const ACCENTS = ['#7fb6f2', '#7bcdb0', '#e7bd68', '#b5a2e8', '#ef9fb6', '#8fc9e5']
const accent = computed(() => {
  let hash = 0
  for (const ch of props.project.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
})
</script>

<template>
  <RouterLink
    class="card board-row"
    :to="{ name: 'project', params: { id: project.id } }"
    :style="{ '--accent': accent }"
    :aria-label="'打开 ' + project.name + ' 的项目页'"
  >
    <div class="board-ident">
      <div class="board-thumb" :class="{ empty: !project.cover }">
        <img v-if="project.cover" :src="'/media/' + project.cover" :alt="project.name + ' 界面截图'" loading="lazy" />
        <span v-else>无界面截图</span>
      </div>
      <div class="board-info">
        <div class="card-top">
          <span class="card-name" :title="project.name">{{ project.name }}</span>
          <span class="tag" :class="project.status ? 'tag-ok' : 'tag-muted'">{{ statusText }}</span>
        </div>
        <div class="card-summary">{{ project.summary }}</div>
      </div>
    </div>

    <div class="board-cell">
      <div class="board-label">开发成员</div>
      <div class="board-value" :class="{ muted: !developers.length }" :title="developerNames">{{ developerNames }}</div>
      <div class="board-sub">{{ developerNote }}</div>
    </div>

    <div class="board-cell">
      <div class="board-label">指导教师</div>
      <div class="board-value" :class="{ muted: !project.advisor }">{{ advisorText }}</div>
      <div class="board-sub">{{ project.advisor ? '已录入' : '待补充' }}</div>
    </div>

    <div class="board-cell board-progress">
      <div class="stage-head">
        <span>阶段 <b>{{ stageDone }}</b> / 6</span>
        <span class="stage-label" :title="project.stage_label || '文档未提供'">{{ phaseLabel }}</span>
      </div>
      <div class="stage-dots" :aria-label="'六段阶段完成 ' + stageDone + ' / 6'">
        <span v-for="n in 6" :key="n" class="stage-dot" :class="{ done: n <= stageDone }"></span>
      </div>
      <div class="board-sub progress-note" :title="project.stage_note">{{ progressNote }}</div>
    </div>

    <div class="board-cell board-material">
      <div class="board-label">资料</div>
      <div class="material-line"><span>DOCX</span><b>{{ project.docx_count }}</b><span>截图</span><b>{{ project.shot_count }}</b></div>
    </div>

    <div class="board-cell board-updated">
      <div class="board-label">更新时间</div>
      <div class="board-value muted">{{ project.updated_at || '—' }}</div>
    </div>

    <div class="board-action"><span>查看详情</span><span class="arrow">→</span></div>
  </RouterLink>
</template>
