<script setup lang="ts">
import { computed } from 'vue'
import type { Meta, Stats } from '../api'

const props = defineProps<{
  meta: Meta | null
  stats: Stats | null
  doingCount: number
  doneCount: number
}>()

const stageGap = computed(() => !!props.stats && props.stats.stage_done === 0)
const stageValue = computed(() => (props.stats ? props.stats.stage_done + ' / ' + props.stats.stage_total : '—'))
const stageNote = computed(() => {
  if (!props.stats) return '—'
  if (props.stats.stage_done === 0) return '文档未提供结构化阶段'
  return props.stats.stage_done + ' / ' + props.stats.stage_total + ' 段已维护'
})
const developerValue = computed(() => (props.stats ? props.stats.developers : '—'))
const advisorValue = computed(() => (props.stats ? props.stats.advisors : '—'))
const developerGap = computed(() => !!props.stats && props.stats.developers === 0)
const advisorGap = computed(() => !!props.stats && props.stats.advisors === 0)
const totalNote = computed(() => props.doingCount + ' 个在做 · ' + props.doneCount + ' 个已做')
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">项</div>
      <div>
        <h1>项目实践聚合平台</h1>
        <div class="brand-sub">
          {{ meta?.subtitle ?? 'PROJECT PRACTICE HUB' }}
        </div>
      </div>
    </div>
    <div class="metrics">
      <div class="metric">
        <div class="k">项目总数</div>
        <div class="v num">{{ stats?.total ?? '—' }}</div>
        <div class="s">{{ totalNote }}</div>
      </div>
      <div class="metric">
        <div class="k">在做项目</div>
        <div class="v num">{{ doingCount }}</div>
        <div class="s">模块化跟踪</div>
      </div>
      <div class="metric">
        <div class="k">已做项目</div>
        <div class="v num">{{ doneCount }}</div>
        <div class="s">运行数据可查</div>
      </div>
      <div class="metric" :class="{ 'is-warn': developerGap }">
        <div class="k">开发成员</div>
        <div class="v num">{{ developerValue }}<small>人</small></div>
        <div class="s">{{ developerGap ? '文档未提供成员名单' : '已录入成员' }}</div>
      </div>
      <div class="metric" :class="{ 'is-warn': advisorGap }">
        <div class="k">指导教师</div>
        <div class="v num">{{ advisorValue }}<small>位</small></div>
        <div class="s">{{ advisorGap ? '文档未提供教师信息' : '已录入指导教师' }}</div>
      </div>
      <div class="metric" :class="{ 'is-warn': stageGap }">
        <div class="k">已维护阶段</div>
        <div class="v num">{{ stageValue }}</div>
        <div class="s">{{ stageNote }}</div>
      </div>
    </div>
  </header>
</template>
