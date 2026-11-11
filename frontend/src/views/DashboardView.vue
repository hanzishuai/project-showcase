<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TopBar from '../components/TopBar.vue'
import DoingProjectCard from '../components/DoingProjectCard.vue'
import DoneProjectCard from '../components/DoneProjectCard.vue'
import { useFitScreen } from '../useFitScreen'
import { api, type Meta, type ProjectSummary, type Stats } from '../api'
import { projectKind } from '../content/projectShowcase'

const meta = ref<Meta | null>(null)
const stats = ref<Stats | null>(null)
const projects = ref<ProjectSummary[]>([])
const error = ref('')
const { screen } = useFitScreen()

const doingProjects = computed(() => projects.value.filter((project) => projectKind(project.id) === 'doing'))
const doneProjects = computed(() => projects.value.filter((project) => projectKind(project.id) === 'done'))

onMounted(async () => {
  try {
    const [m, s, p] = await Promise.all([api.meta(), api.stats(), api.projects()])
    meta.value = m
    stats.value = s
    projects.value = p
  } catch (e) {
    error.value = String(e)
  }
})
</script>

<template>
  <div class="viewport">
    <div id="screen" class="screen" ref="screen">
      <TopBar
        :meta="meta"
        :stats="stats"
        :doing-count="doingProjects.length"
        :done-count="doneProjects.length"
      />

      <section class="charts doing-zone">
        <div class="zone-head sec-head">
          <div class="zone-title">
            <span class="sec-kicker">IN PROGRESS</span>
            <h2>在做项目</h2>
            <span class="sec-note">按模块查看已开发完毕的功能与正在开发的功能</span>
          </div>
          <div class="zone-count"><b>{{ doingProjects.length }}</b><span>个在做</span></div>
        </div>
        <div v-if="error" class="empty-block">数据读取失败：{{ error }}</div>
        <div v-else class="doing-grid">
          <DoingProjectCard v-for="project in doingProjects" :key="project.id" :project="project" />
        </div>
      </section>

      <section class="done-zone">
        <div class="zone-head sec-head">
          <div class="zone-title">
            <span class="sec-kicker">DELIVERED</span>
            <h2>已做项目</h2>
            <span class="sec-note">运行数据 · 使用规模 · 已交付模块</span>
          </div>
          <div class="zone-count"><b>{{ doneProjects.length }}</b><span>个已做</span></div>
        </div>
        <div class="done-grid">
          <DoneProjectCard v-for="project in doneProjects" :key="project.id" :project="project" />
          <div class="card card-empty done-empty">
            <div class="empty-symbol">＋</div>
            <div class="empty-copy">
              <div class="card-name">更多已做项目待归档</div>
              <div class="card-summary">新的交付项目提交资料后进入这里；成员、教师与运行数据缺失时统一显示 —。</div>
            </div>
          </div>
        </div>
      </section>

      <footer class="footbar">
        <span>数据源 <code>data/projects.json</code> 唯一</span>
        <span>{{ stats?.total ?? '—' }} 个项目 · {{ doingProjects.length }} 个在做 · {{ doneProjects.length }} 个已做</span>
        <span>开发成员 {{ stats?.developers ?? '—' }} 人 · 指导教师 {{ stats?.advisors ?? '—' }} 位</span>
        <span>缺失值一律显示 —</span>
        <span class="sp">本地服务 · 零外链</span>
      </footer>
    </div>
  </div>
</template>
