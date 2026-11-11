<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectSummary } from '../api'
import { getShowcase } from '../content/projectShowcase'

const props = defineProps<{ project: ProjectSummary }>()

const showcase = computed(() => getShowcase(props.project.id))
const developers = computed(() => props.project.developers ?? [])
const developerText = computed(() => developers.value.map((item) => item.name).filter(Boolean).join('、') || '—')
const advisorText = computed(() => props.project.advisor || '—')
const stageDone = computed(() => Math.max(0, Math.min(6, props.project.stage_done ?? 0)))
const usage = computed(() => showcase.value.usage ?? [])
const runtime = computed(() => showcase.value.runtime)
const doneModules = computed(() => showcase.value.modulesDone.length)
</script>

<template>
  <RouterLink
    class="card done-card"
    :to="{ name: 'project', params: { id: project.id } }"
    :style="{ '--accent': showcase.accent }"
    :aria-label="'打开 ' + project.name + ' 的项目页'"
  >
    <div class="done-head">
      <div class="doing-title">
        <span class="kind-badge done">已做</span>
        <span class="tag tag-muted">—</span>
        <h3 class="card-name" :title="project.name">{{ project.name }}</h3>
      </div>
      <div class="doing-phase">{{ showcase.phase }}</div>
    </div>

    <p class="doing-summary">{{ project.summary }}</p>

    <div class="done-body">
      <div class="done-left">
        <div class="done-people">
          <span>开发成员 <b>{{ developerText }}</b></span>
          <span>指导教师 <b>{{ advisorText }}</b></span>
          <span>已交付模块 <b>{{ doneModules }}</b> 项</span>
        </div>

        <div class="usage-grid">
          <div v-for="item in usage" :key="item.label" class="usage-tile">
            <div class="usage-value"><b>{{ item.value }}</b><small>{{ item.unit }}</small></div>
            <div class="usage-label">{{ item.label }}</div>
            <div class="usage-note">{{ item.note }}</div>
          </div>
        </div>

        <div class="done-modules">
          <div class="done-modules-head"><span>已交付功能</span><b>{{ doneModules }} 项</b></div>
          <div class="done-module-chips">
            <span v-for="item in showcase.modulesDone" :key="item.name">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <aside class="done-side" aria-label="运行概况">
        <div class="side-kicker">RUN TIME</div>
        <div class="side-runtime" :class="{ missing: !runtime?.value || runtime.value === '—' }">{{ runtime?.value ?? '—' }}</div>
        <div class="side-label">运行时长</div>
        <div class="side-note">{{ runtime?.note }}</div>
        <div class="side-sep"></div>
        <div class="side-row"><span>已交付模块</span><b>{{ doneModules }} 项</b></div>
        <div class="side-row"><span>阶段记录</span><b>{{ stageDone }} / 6</b></div>
        <div class="side-row"><span>项目状态</span><b>{{ showcase.phase }}</b></div>
      </aside>
    </div>

    <div class="done-foot">
      <span class="stage-head">阶段 <b>{{ stageDone }}</b> / 6</span>
      <span class="open-link">查看运行详情 <i>→</i></span>
    </div>
  </RouterLink>
</template>
