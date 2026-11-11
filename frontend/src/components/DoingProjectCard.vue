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
const done = computed(() => showcase.value.modulesDone)
const doing = computed(() => showcase.value.modulesDoing)
const doneShown = computed(() => done.value.slice(0, 4))
const doingShown = computed(() => doing.value.slice(0, 3))
const doneMore = computed(() => Math.max(0, done.value.length - doneShown.value.length))
const doingMore = computed(() => Math.max(0, doing.value.length - doingShown.value.length))
</script>

<template>
  <RouterLink
    class="card doing-card"
    :to="{ name: 'project', params: { id: project.id } }"
    :style="{ '--accent': showcase.accent }"
    :aria-label="'打开 ' + project.name + ' 的项目页'"
  >
    <div class="doing-head">
      <div class="doing-title">
        <span class="kind-badge doing">在做</span>
        <span class="tag tag-muted">—</span>
        <h3 class="card-name" :title="project.name">{{ project.name }}</h3>
      </div>
      <div class="doing-phase">{{ showcase.phase }}</div>
    </div>

    <p class="doing-summary">{{ project.summary }}</p>

    <div class="doing-people">
      <span><b>开发成员</b><em>{{ developerText }}</em></span>
      <span><b>指导教师</b><em>{{ advisorText }}</em></span>
    </div>

    <div class="doing-modules">
      <section class="module-col done">
        <header>
          <span class="module-mark">✓</span>
          <b>已开发完毕</b>
          <em>{{ done.length }} 项</em>
        </header>
        <ul>
          <li v-for="item in doneShown" :key="item.name">
            <span class="module-dot"></span>
            <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
          </li>
          <li v-if="doneMore" class="module-more">另有 {{ doneMore }} 项，详情页查看</li>
        </ul>
      </section>

      <section class="module-col doing">
        <header>
          <span class="module-mark">◌</span>
          <b>正在开发</b>
          <em>{{ doing.length }} 项</em>
        </header>
        <ul>
          <li v-for="item in doingShown" :key="item.name">
            <span class="module-dot"></span>
            <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
          </li>
          <li v-if="doingMore" class="module-more">另有 {{ doingMore }} 项，详情页查看</li>
        </ul>
      </section>
    </div>

    <div class="doing-foot">
      <span class="stage-head">阶段 <b>{{ stageDone }}</b> / 6</span>
      <span class="open-link">查看项目详情 <i>→</i></span>
    </div>
  </RouterLink>
</template>
