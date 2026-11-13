<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import {
  KANBAN_TREND,
  KANBAN_WEEKS,
  loadKanbanData,
  type KanbanProject,
  type KanbanVersion
} from '../kanban/data'
import { registerAction } from '../agent/bus'
import { uiState } from '../agent/uiState'

interface VersionView extends KanbanVersion {
  id: string
  project: KanbanProject
  current: boolean
  delivery: string
  commits: number[]
}

const kanbanData = loadKanbanData()
const KANBAN_STAGES = kanbanData.stages
const KANBAN_PROJECTS = kanbanData.projects

// 数字人已移到全局浮层（components/AgentDock.vue），这里只负责把界面状态同步过去并注册可被调用的动作。

const appEl = ref<HTMLDivElement | null>(null)
const stageChartEl = ref<HTMLDivElement | null>(null)
const donutChartEl = ref<HTMLDivElement | null>(null)
const lineChartEl = ref<HTMLDivElement | null>(null)

const activeView = ref<'overview' | 'board'>('board')
const projectFilter = ref('')
const ownerFilter = ref('')
const historyOnly = ref(false)
const selected = ref<VersionView | null>(null)
const galleryIndex = ref(-1)

let charts: echarts.ECharts[] = []

const toNum = (value: string) => value.replace(/^v/, '').split('.').map(Number)
const compareVersion = (a: string, b: string) => {
  const left = toNum(a)
  const right = toNum(b)
  return left[0] - right[0] || left[1] - right[1]
}
const addDays = (start: string, days: number) => {
  const date = new Date(start + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const versions: VersionView[] = KANBAN_PROJECTS.flatMap((project, projectIndex) => {
  const latest = project.versions.map((version) => version.number).sort(compareVersion).at(-1)
  return project.versions.map((version, versionIndex) => ({
    ...version,
    id: projectIndex + '-' + versionIndex,
    project,
    current: version.number === latest,
    delivery: addDays(version.start, 75),
    commits: [4 + (projectIndex % 5), 8 + versionIndex * 2, 5 + (projectIndex % 4), 10 + versionIndex + (projectIndex % 3)]
  }))
})

const lastStage = KANBAN_STAGES.length - 1
const stageCounts = computed(() => KANBAN_STAGES.map((_, index) => versions.filter((version) => version.stage === index).length))
const activeCount = computed(() => versions.filter((version) => version.stage < lastStage).length)
const liveCount = computed(() => versions.length - activeCount.value)

const averageProgress = computed(() => Math.round(versions.reduce((total, version) => total + ((version.stage + 1) / KANBAN_STAGES.length) * 100, 0) / versions.length))
const techStack = computed(() => {
  const counts = new Map<string, number>()
  versions.forEach((version) => version.project.stack.forEach((stack) => counts.set(stack, (counts.get(stack) || 0) + 1)))
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
})
const techStackMax = computed(() => techStack.value[0]?.count || 1)
const lineLegend = [['开发', 2], ['测试', 3], ['已上线', 4]] as const
const kpis = computed(() => [
  { label: '项目总数', value: KANBAN_PROJECTS.length, unit: '个', risk: false },
  { label: '在研版本数', value: activeCount.value, unit: '个', risk: false },
  { label: '已上线版本数', value: liveCount.value, unit: '个', risk: false },
  { label: '平均阶段完成度', value: averageProgress.value, unit: '%', risk: false }
])
const projectNames = KANBAN_PROJECTS.map((project) => project.name)
const owners = [...new Set(KANBAN_PROJECTS.map((project) => project.owner))]

const filteredVersions = computed(() => versions.filter((version) => {
  const projectMatched = !projectFilter.value || version.project.name === projectFilter.value
  const ownerMatched = !ownerFilter.value || version.project.owner === ownerFilter.value
  const historyMatched = historyOnly.value || version.current
  return projectMatched && ownerMatched && historyMatched
}))

const lanes = computed(() => KANBAN_STAGES.map((stage, index) => ({
  ...stage,
  list: filteredVersions.value.filter((version) => version.stage === index)
})))

const selectedStage = computed(() => selected.value ? KANBAN_STAGES[selected.value.stage] : null)
const drawerDates = computed(() => selected.value
  ? KANBAN_STAGES.map((_, index) => index <= selected.value!.stage ? addDays(selected.value!.start, index * 12) : '—')
  : [])
const drawerHistory = computed(() => {
  if (!selected.value) return []
  return selected.value.project.versions
    .slice()
    .sort((a, b) => compareVersion(b.number, a.number))
    .map((version) => ({ ...version, selected: version.number === selected.value!.number }))
})
const drawerOpen = computed(() => selected.value !== null)
const galleryOpen = computed(() => galleryIndex.value >= 0 && selected.value !== null)
const galleryImages = computed(() => selected.value?.project.images ?? [])
const selectedProjectCurrentVersion = computed(() => {
  const project = selected.value?.project
  if (!project) return null
  const latest = project.versions.map((version) => version.number).sort(compareVersion).at(-1)
  return project.versions.find((version) => version.number === latest) ?? null
})
const isLiveProject = computed(() => selectedProjectCurrentVersion.value?.stage === lastStage)
const usageMetrics = computed(() => {
  const project = selected.value?.project
  if (!project) return []
  return [
    { key: 'users', label: '累计用户', value: project.users, unit: '人', accent: '#22D3EE', note: '当前上线版本累计' },
    { key: 'features', label: '上线功能', value: project.features, unit: '项', accent: '#34D399', note: '当前上线版本已完成' }
  ]
})

const stageColor = (index: number) => KANBAN_STAGES[index]?.color ?? '#64748B'
const switchView = (view: 'overview' | 'board') => {
  activeView.value = view
  closeDrawer()
}
const openDrawer = (id: string) => {
  const version = versions.find((item) => item.id === id)
  if (version) { selected.value = version; galleryIndex.value = -1 }
}
const closeDrawer = () => {
  selected.value = null
  galleryIndex.value = -1
}
const openGallery = (index: number) => {
  if (index >= 0 && index < galleryImages.value.length) galleryIndex.value = index
}
const closeGallery = () => { galleryIndex.value = -1 }
const stepGallery = (delta: number) => {
  const total = galleryImages.value.length
  if (!total) return
  galleryIndex.value = (galleryIndex.value + delta + total) % total
}
const fit = () => {
  if (!appEl.value) return
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  appEl.value.style.transform = 'scale(' + scale + ')'
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (galleryOpen.value) closeGallery()
    else closeDrawer()
    return
  }
  if (galleryOpen.value && event.key === 'ArrowLeft') { event.preventDefault(); stepGallery(-1) }
  if (galleryOpen.value && event.key === 'ArrowRight') { event.preventDefault(); stepGallery(1) }
}

const chartTip = {
  trigger: 'axis',
  backgroundColor: '#0F1522',
  borderColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderRadius: 8,
  textStyle: { color: '#E6EDF7', fontSize: 12 },
  extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,0.25);'
}
const chartAxis = {
  axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
  axisLabel: { color: '#8B98AD', fontSize: 12 },
  axisTick: { show: false }
}
const chartSplit = { show: true, lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }

const initCharts = () => {
  if (charts.length || !stageChartEl.value || !donutChartEl.value || !lineChartEl.value) return

  const stageChart = echarts.init(stageChartEl.value, null, { renderer: 'canvas' })
  const donutChart = echarts.init(donutChartEl.value, null, { renderer: 'canvas' })
  const lineChart = echarts.init(lineChartEl.value, null, { renderer: 'canvas' })
  charts = [stageChart, donutChart, lineChart]

  stageChart.setOption({
    animation: false,
    tooltip: { ...chartTip, formatter: (params: any) => params[0].name + '：' + params[0].value + ' 个版本' },
    grid: { left: 32, right: 16, top: 32, bottom: 24 },
    xAxis: { type: 'category', data: KANBAN_STAGES.map((stage) => stage.name), ...chartAxis, splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...chartAxis, splitLine: chartSplit },
    series: [{
      type: 'bar',
      data: stageCounts.value.map((count, index) => ({ value: count, itemStyle: { color: stageColor(index), borderRadius: [4, 4, 0, 0] } })),
      barWidth: 28,
      label: { show: true, position: 'top', color: '#E6EDF7', fontSize: 12 }
    }]
  })

  donutChart.setOption({
    animation: false,
    tooltip: { ...chartTip, trigger: 'item', formatter: (params: any) => params.name + '：' + params.value + ' 个版本' },
    series: [{
      type: 'pie',
      radius: ['62%', '82%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: '#121826', borderWidth: 3 },
      data: KANBAN_STAGES.map((stage, index) => ({ name: stage.name, value: stageCounts.value[index], itemStyle: { color: stage.color } }))
    }]
  })

  lineChart.setOption({
    animation: false,
    tooltip: { ...chartTip, trigger: 'axis' },
    grid: { left: 32, right: 16, top: 24, bottom: 24 },
    xAxis: { type: 'category', boundaryGap: false, data: KANBAN_WEEKS, ...chartAxis, splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...chartAxis, splitLine: chartSplit },
    series: [['开发', 2], ['测试', 3], ['已上线', 4]].map(([name, index]) => ({
      name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: stageColor(Number(index)) },
      itemStyle: { color: stageColor(Number(index)) },
      emphasis: { showSymbol: true },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: echarts.color.modifyAlpha(stageColor(Number(index)), 0.25) },
          { offset: 1, color: echarts.color.modifyAlpha(stageColor(Number(index)), 0) }
        ])
      },
      data: KANBAN_TREND[name as string]
    }))
  })
}

const showOverview = async () => {
  if (activeView.value !== 'overview') return
  await nextTick()
  initCharts()
  requestAnimationFrame(() => charts.forEach((chart) => chart.resize()))
}

watch(activeView, showOverview)

/* ---------------------- Agent：把看板操作暴露给数字人 ---------------------- */

const agentOffs: Array<() => void> = []

const setupAgentActions = () => {
  agentOffs.push(
    registerAction('set_board_view', (args) => {
      const view = String(args.view ?? 'board')
      if (view !== 'board' && view !== 'overview') return false
      switchView(view)
      return true
    }),
    registerAction('filter_board', (args) => {
      if ('project' in args) projectFilter.value = String(args.project ?? '')
      if ('advisor' in args) ownerFilter.value = String(args.advisor ?? '')
      if ('show_history' in args) historyOnly.value = Boolean(args.show_history)
      if (activeView.value !== 'board') switchView('board')
      const count = filteredVersions.value.length
      const who = String(args.advisor ?? '').trim()
      return who ? `已按「${who}」筛出 ${count} 个项目` : `已筛出 ${count} 个项目`
    }),
    registerAction('open_project', (args) => {
      const name = String(args.project ?? '').trim()
      const version = String(args.version ?? '').trim()
      if (!name) return false
      const exact = versions.find((item) => item.project.name === name && (!version || item.number === version))
      const target =
        exact ??
        versions.find((item) => item.project.name.includes(name) || name.includes(item.project.name))
      if (!target) return false
      switchView('board')
      openDrawer(target.id)
      return `已打开「${target.project.name}」`
    }),
    registerAction('close_drawer', () => {
      closeDrawer()
      return true
    }),
    registerAction('open_gallery', (args) => {
      const projectName = String(args.project ?? '').trim()
      if (projectName) {
        const exact = versions.find((item) => item.project.name === projectName && item.current)
        const target =
          exact ??
          versions.find((item) => item.project.name === projectName) ??
          versions.find((item) => item.project.name.includes(projectName) || projectName.includes(item.project.name))
        if (!target) return false
        switchView('board')
        openDrawer(target.id)
      }
      if (!selected.value) return false
      const total = selected.value.project.images.length
      if (!total) return false
      const index = Math.min(Math.max(Number(args.index ?? 0), 0), total - 1)
      openGallery(index)
      return `已打开「${selected.value.project.name}」的项目图片`
    }),
    registerAction('step_gallery', (args) => {
      if (!selected.value || galleryIndex.value < 0) return false
      stepGallery(Number(args.delta) >= 0 ? 1 : -1)
      return true
    }),
    registerAction('close_gallery', () => {
      closeGallery()
      return true
    })
  )
}

// 把看板状态同步给 Agent 作为上下文
watchEffect(() => {
  uiState.boardView = activeView.value
  uiState.projectFilter = projectFilter.value
  uiState.advisorFilter = ownerFilter.value
  uiState.showHistory = historyOnly.value
  uiState.openProject = selected.value?.project.name ?? ''
  uiState.modalOpen = galleryOpen.value
  uiState.galleryOpen = galleryOpen.value
  uiState.galleryIndex = galleryIndex.value
  uiState.visibleCards = filteredVersions.value.length
  uiState.boardProjects = KANBAN_PROJECTS.map((project) => {
    const current = versions.find((item) => item.project.name === project.name && item.current)
    return {
      name: project.name,
      version: current?.number ?? '',
      stage: current ? KANBAN_STAGES[current.stage]?.name ?? '' : '',
      advisor: project.owner,
      stack: project.stack.join('·'),
      team: project.team,
      users: project.users,
      features: project.features
    }
  })
  uiState.projects = projectNames
})

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
  document.addEventListener('keydown', onKeydown)
  showOverview()
  setupAgentActions()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  document.removeEventListener('keydown', onKeydown)
  charts.forEach((chart) => chart.dispose())
  charts = []
  agentOffs.splice(0).forEach((off) => off())
})
</script>

<template>
  <div id="app" ref="appEl">
    <header class="nav">
      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 7 12 3l8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" />
          </svg>
        </span>
        软件学院 · 项目实践聚合平台
      </div>
      <div class="nav-right">
        <a class="nav-action" href="#/edit">数据修改</a>
        <a class="nav-action" href="#/admin">管理后台</a>
        <nav class="nav-tabs" aria-label="页面视图">
          <button class="tab" :class="{ active: activeView === 'overview' }" type="button" @click="switchView('overview')">数据总览</button>
          <button class="tab" :class="{ active: activeView === 'board' }" type="button" @click="switchView('board')">生命周期看板</button>
        </nav>
      </div>
    </header>

    <main v-show="activeView === 'overview'" class="view overview">
      <section class="kpis" id="kpis">
        <div v-for="item in kpis" :key="item.label" class="kpi">
          <div class="kpi-label">{{ item.label }}</div>
          <div class="kpi-number" :class="{ risk: item.risk }">
            {{ item.value }}<span class="kpi-unit">{{ item.unit }}</span>
          </div>
        </div>
      </section>

      <section class="row-two">
        <article class="panel">
          <div class="panel-title">
            各阶段版本数量分布<span class="panel-caption">全量版本 · {{ KANBAN_STAGES.length }} 个生命周期阶段</span>
          </div>
          <div ref="stageChartEl" class="chart bar-chart"></div>
        </article>
        <article class="panel">
          <div class="panel-title">生命周期阶段占比<span class="panel-caption">全量版本</span></div>
          <div class="donut-wrap">
            <div ref="donutChartEl" class="chart donut-chart"></div>
            <div class="donut-center"><strong>{{ versions.length }}</strong><span>个版本</span></div>
          </div>
          <div class="legend">
            <span v-for="(stage, index) in KANBAN_STAGES" :key="stage.name" class="legend-item">
              <i class="dot" :style="{ background: stage.color }"></i>{{ stage.name }} {{ stageCounts[index] }}
            </span>
          </div>
        </article>
      </section>

      <section class="row-three">
        <article class="panel">
          <div class="panel-title">近 8 周各阶段版本数量变化<span class="panel-caption">周度趋势</span></div>
          <div class="line-legend">
            <span v-for="item in lineLegend" :key="item[0]" class="legend-item">
              <i class="dot" :style="{ background: stageColor(Number(item[1])) }"></i>{{ item[0] }}
            </span>
          </div>
          <div ref="lineChartEl" class="chart line-chart"></div>
        </article>
        <article class="panel">
          <div class="panel-title">技术栈分布<span class="panel-caption">使用频次 · TOP 6</span></div>
          <div class="tech-list">
            <div v-for="(item, index) in techStack" :key="item.name" class="tech-item">
              <span class="tech-name">{{ item.name }}</span>
              <div class="tech-track">
                <div class="tech-fill" :style="{ width: (item.count / techStackMax * 100) + '%', opacity: 1 - index * 0.11 }"></div>
              </div>
              <span class="tech-value">{{ item.count }}</span>
            </div>
          </div>
        </article>
      </section>
    </main>

    <main v-show="activeView === 'board'" class="view board-view">
      <div class="toolbar">
        <div class="stats">
          <div class="stat">版本总数<b>{{ versions.length }}</b></div>
          <div class="stat">在研<b>{{ activeCount }}</b></div>
          <div class="stat">已上线<b>{{ liveCount }}</b></div>
        </div>
        <div class="controls">
          <select v-model="projectFilter" aria-label="筛选项目">
            <option value="">全部项目</option>
            <option v-for="name in projectNames" :key="name" :value="name">{{ name }}</option>
          </select>
          <select v-model="ownerFilter" aria-label="筛选指导老师">
            <option value="">全部指导老师</option>
            <option v-for="owner in owners" :key="owner" :value="owner">{{ owner }}</option>
          </select>
          <label class="switch-label">
            <input v-model="historyOnly" type="checkbox" />
            <span class="switch"></span>显示历史版本
          </label>
        </div>
      </div>

      <div class="board-main">
        <!-- 左侧 600px 留白区：数字人已移到全局浮层（AgentDock），这里只保留布局占位 -->
        <div class="pet-stage" aria-hidden="true"></div>
        <div class="lanes">
        <section v-for="(lane, laneIndex) in lanes" :key="lane.name" class="lane">
          <div class="lane-head">
            <i class="lane-dot" :style="{ background: lane.color }"></i>{{ lane.name }}
            <span class="lane-count">{{ lane.list.length }}</span>
          </div>
          <div class="lane-rule" :style="{ background: lane.color }"></div>
          <div class="lane-body">
            <article
              v-for="version in lane.list"
              :key="version.id"
              class="version-card"
              :class="{ history: !version.current }"
              :style="{ '--stage': lane.color }"
              :data-id="version.id"
              tabindex="0"
              @click="openDrawer(version.id)"
              @keydown.enter="openDrawer(version.id)"
            >
              <div class="version-name" :title="version.project.name">{{ version.project.name }}</div>
              <div class="badges">
                <span class="badge">{{ version.number }}</span>
                <span v-if="version.current" class="badge current">当前版本</span>
              </div>
              <div class="segments">
                <span
                  v-for="(stage, stageIndex) in KANBAN_STAGES"
                  :key="stage.name"
                  class="segment"
                  :class="{ complete: stageIndex < version.stage, active: stageIndex === version.stage }"
                ></span>
              </div>
              <div class="card-meta">
                <span>指导老师 · {{ version.project.owner }}</span>
                <span class="developers" :title="'开发成员：' + version.project.team">开发成员 · {{ version.project.team }}</span>
              </div>
            </article>
            <div v-if="!lane.list.length" class="empty">暂无当前版本</div>
          </div>
        </section>
        </div>
      </div>
    </main>

    <div class="mask" :class="{ open: drawerOpen }" @click="closeDrawer"></div>
    <aside class="drawer" :class="{ open: drawerOpen }" role="dialog" aria-modal="true" aria-label="版本详情">
      <template v-if="selected && selectedStage">
        <div class="drawer-header">
          <button class="close" type="button" aria-label="关闭详情" @click="closeDrawer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M5 5 19 19M19 5 5 19" />
            </svg>
          </button>
          <h2>{{ selected.project.name }}</h2>
          <div class="drawer-badges">
            <span class="badge">{{ selected.number }}</span>
            <span v-if="selected.current" class="badge current">当前版本</span>
            <span class="stage-badge" :style="{ '--stage': selectedStage.color }">{{ selectedStage.name }}</span>
          </div>
        </div>
        <div class="drawer-body">
          <section class="section">
            <h3>生命周期进度</h3>
            <div class="segments detail-progress" :style="{ '--stage': selectedStage.color }">
              <span
                v-for="(stage, index) in KANBAN_STAGES"
                :key="stage.name"
                class="segment"
                :class="{ complete: index < selected.stage, active: index === selected.stage }"
              ></span>
            </div>
            <div class="date-grid">
              <span v-for="(date, index) in drawerDates" :key="index">{{ date }}</span>
            </div>
          </section>

          <section class="section">
            <h3>版本信息</h3>
            <div class="info-grid">
              <div><small>指导老师</small><strong>{{ selected.project.owner }}</strong></div>
              <div><small>团队成员</small><strong>{{ selected.project.team }}</strong></div>
              <div><small>技术栈</small><strong>{{ selected.project.stack.join(' / ') }}</strong></div>
              <div><small>开始日期</small><strong>{{ selected.start }}</strong></div>
              <div><small>预计交付</small><strong>{{ selected.delivery }}</strong></div>
            </div>
          </section>

          <section class="section">
            <h3>版本历史</h3>
            <div class="timeline">
              <div v-for="version in drawerHistory" :key="version.number" class="timeline-item" :class="{ selected: version.selected }">
                <div class="timeline-head">{{ version.number }}<span>{{ version.start }} · {{ KANBAN_STAGES[version.stage].name }}</span></div>
                <p>{{ version.note }}</p>
              </div>
            </div>
          </section>

          <section v-if="isLiveProject" class="section">
            <h3>项目使用情况 <span class="section-count">当前上线版本</span></h3>
            <div class="usage-stats">
              <div v-for="metric in usageMetrics" :key="metric.key" class="usage-stat" :style="{ '--accent': metric.accent }">
                <span class="usage-stat-label">{{ metric.label }}</span>
                <span class="usage-stat-value"><strong>{{ metric.value.toLocaleString() }}</strong><span>{{ metric.unit }}</span></span>
                <span class="usage-stat-note">{{ metric.note }}</span>
              </div>
            </div>
          </section>
          <section v-else class="section">
            <h3>近 4 周提交次数</h3>
            <div class="commit-bars">
              <div
                v-for="(count, index) in selected.commits"
                :key="index"
                class="commit-bar"
                :style="{ height: (count / 16 * 100) + '%' }"
                :data-tip="'第 ' + (index + 1) + ' 周 · ' + count + ' 次提交'"
              ></div>
            </div>
          </section>

          <section class="section">
            <h3>项目图片<span class="section-count">{{ selected.project.images.length }} 张</span></h3>
            <div class="shot-gallery">
              <button
                v-for="(src, index) in selected.project.images"
                :key="src + index"
                class="shot-thumb"
                type="button"
                :aria-label="'放大查看 ' + selected.project.name + ' 第 ' + (index + 1) + ' 张图片'"
                @click="openGallery(index)"
              >
                <img :src="src" :alt="selected.project.name + ' 界面截图 ' + (index + 1)" loading="lazy" />
                <span class="shot-index">{{ index + 1 }}</span>
              </button>
            </div>
            <p class="gallery-hint">点击任意图片放大查看</p>
          </section>
        </div>
      </template>
    </aside>

    <div v-if="galleryOpen && selected" class="lightbox" @click.self="closeGallery">
      <button class="lightbox-close" type="button" aria-label="关闭图片" @click="closeGallery">×</button>
      <div class="lightbox-stage">
        <button class="lightbox-nav prev" type="button" aria-label="上一张" @click.stop="stepGallery(-1)">‹</button>
        <img class="lightbox-img" :src="selected.project.images[galleryIndex]" :alt="selected.project.name + ' 界面截图 ' + (galleryIndex + 1)" />
        <button class="lightbox-nav next" type="button" aria-label="下一张" @click.stop="stepGallery(1)">›</button>
      </div>
      <div class="lightbox-caption">{{ selected.project.name }} · 项目图片 {{ galleryIndex + 1 }} / {{ selected.project.images.length }}</div>
    </div>

  </div>
</template>
