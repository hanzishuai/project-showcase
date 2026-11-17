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
const slideIndex = ref(0)
const slideVideo = ref<HTMLVideoElement | null>(null)
const galleryVideo = ref<HTMLVideoElement | null>(null)
const mediaPlaying = ref(false)
let slideshowTimer: number | null = null

let charts: echarts.ECharts[] = []

const toNum = (value: string) => value.replace(/^v/, '').split('.').map(Number)
const compareVersion = (a: string, b: string) => {
  const left = toNum(a)
  const right = toNum(b)
  return left[0] - right[0] || left[1] - right[1]
}
const addDays = (start: string, days: number) => {
  // 真实资料未提供日期时以「—」占位，不能拿假日期算交付日
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '—'
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
    // 交付日期只认数据修改页里填的真实值；旧存档没填就显示「—」，不再按开始日期 +75 天凭空推算
    delivery: version.delivery?.trim() || '—'
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
const drawerOpen = computed(() => selected.value !== null)
const galleryOpen = computed(() => galleryIndex.value >= 0 && selected.value !== null)
type GalleryItem = { type: 'image' | 'video'; src: string }
// 图片在前、视频在后，共用一套计数器 / 箭头 / 圆点
const galleryMedia = computed<GalleryItem[]>(() => {
  const project = selected.value?.project
  if (!project) return []
  return [
    ...(project.images ?? []).map((src): GalleryItem => ({ type: 'image', src })),
    ...(project.videos ?? []).map((src): GalleryItem => ({ type: 'video', src }))
  ]
})
const currentMedia = computed(() => galleryMedia.value[slideIndex.value] ?? null)
const videoCount = computed(() => (selected.value?.project.videos ?? []).length)
const stageColor = (index: number) => KANBAN_STAGES[index]?.color ?? '#64748B'
const switchView = (view: 'overview' | 'board') => {
  activeView.value = view
  closeDrawer()
}
const stopSlideshow = () => {
  if (slideshowTimer !== null) {
    window.clearInterval(slideshowTimer)
    slideshowTimer = null
  }
}
const startSlideshow = () => {
  stopSlideshow()
  const total = galleryMedia.value.length
  if (!selected.value || total <= 1 || galleryOpen.value) return
  slideshowTimer = window.setInterval(() => {
    if (selected.value && !galleryOpen.value) {
      // 视频项停下自动轮播，避免播放到一半被切走
      if (galleryMedia.value[slideIndex.value]?.type === 'video') return
      slideIndex.value = (slideIndex.value + 1) % galleryMedia.value.length
    }
  }, 4000)
}
const setSlide = (index: number) => {
  const total = galleryMedia.value.length
  if (!total) return
  slideIndex.value = ((index % total) + total) % total
  startSlideshow()
}
const stepSlide = (delta: number) => setSlide(slideIndex.value + delta)
const openDrawer = (id: string) => {
  const version = versions.find((item) => item.id === id)
  if (version) {
    selected.value = version
    galleryIndex.value = -1
    slideIndex.value = 0
    startSlideshow()
  }
}
const closeDrawer = () => {
  stopSlideshow()
  selected.value = null
  galleryIndex.value = -1
  slideIndex.value = 0
}
const openGallery = (index: number) => {
  stopSlideshow()
  if (index >= 0 && index < galleryMedia.value.length) galleryIndex.value = index
}
const closeGallery = () => {
  galleryIndex.value = -1
  startSlideshow()
}
const stepGallery = (delta: number) => {
  const total = galleryMedia.value.length
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
  if (drawerOpen.value && !galleryOpen.value && event.key === 'ArrowLeft') { event.preventDefault(); stepSlide(-1) }
  if (drawerOpen.value && !galleryOpen.value && event.key === 'ArrowRight') { event.preventDefault(); stepSlide(1) }
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
watch([slideIndex, galleryIndex], () => { mediaPlaying.value = false })

/* ---------------------- Agent：把看板操作暴露给数字人 ---------------------- */

const agentOffs: Array<() => void> = []

const setupAgentActions = () => {
  agentOffs.push(
    registerAction('set_board_view', (args) => {
      const view = String(args.view ?? 'board')
      if (view !== 'board' && view !== 'overview') return false
      switchView(view)
      return view === 'overview' ? '已切换到数据总览' : '已切换到生命周期看板'
    }),
    registerAction('filter_board', (args) => {
      const project = String(args.project ?? '')
      const advisor = String(args.advisor ?? '')
      if (project && !projectNames.includes(project)) throw new Error('未找到该项目，筛选没有改变')
      if (advisor && !owners.includes(advisor)) throw new Error('未找到该指导老师，筛选没有改变')
      if ('project' in args) projectFilter.value = project
      if ('advisor' in args) ownerFilter.value = advisor
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
      const exact = versions.filter(item => item.project.name === name)
      const matched = exact.length
        ? exact
        : versions.filter(item => item.project.name.includes(name) || name.includes(item.project.name))
      const names = new Set(matched.map(item => item.project.name))
      if (names.size > 1) throw new Error('项目名称不唯一，请提供完整名称')
      const target = version ? matched.find(item => item.number === version) : matched.find(item => item.current)
      if (!target) return false
      switchView('board')
      openDrawer(target.id)
      return `已打开「${target.project.name}」${target.number}版本`
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
      const total = galleryMedia.value.length
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
    registerAction('control_video', async (args) => {
      const media = galleryOpen.value ? galleryMedia.value[galleryIndex.value] : currentMedia.value
      if (!selected.value || media?.type !== 'video') throw new Error('当前展示的不是视频，请先切换到视频')
      const video = galleryOpen.value ? galleryVideo.value : slideVideo.value
      if (!video) throw new Error('视频尚未加载，请稍后重试')
      const action = String(args.action || '')
      if (action === 'pause') { video.pause(); mediaPlaying.value = false; return '视频已暂停' }
      if (action !== 'play') throw new Error('不支持的视频操作')
      try { await video.play() } catch { throw new Error('视频未能播放，请检查视频地址或点击播放按钮') }
      if (video.paused) throw new Error('视频未能播放，请点击播放按钮')
      mediaPlaying.value = true
      return '视频已开始播放'
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
  uiState.openVersion = selected.value?.number ?? ''
  uiState.slideIndex = selected.value ? slideIndex.value : -1
  const shownMedia = galleryOpen.value ? galleryMedia.value[galleryIndex.value] : currentMedia.value
  uiState.mediaType = selected.value ? (shownMedia?.type ?? '') : ''
  uiState.mediaPlaying = uiState.mediaType === 'video' && mediaPlaying.value
  uiState.modalOpen = galleryOpen.value
  uiState.galleryOpen = galleryOpen.value
  uiState.galleryIndex = galleryIndex.value
  uiState.visibleCards = filteredVersions.value.length
  uiState.mediaCount = galleryMedia.value.length
  uiState.overview = {
    projects: KANBAN_PROJECTS.length, active: activeCount.value, live: liveCount.value,
    averageProgress: Number.isFinite(averageProgress.value) ? averageProgress.value : 0,
    stages: KANBAN_STAGES.map((stage, index) => ({ name: stage.name, count: stageCounts.value[index] ?? 0 }))
  }

})

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
  document.addEventListener('keydown', onKeydown)
  showOverview()
  setupAgentActions()
})

onBeforeUnmount(() => {
  stopSlideshow()
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
          <div class="drawer-heading">
          <h2>{{ selected.project.name }}</h2>
          <div class="drawer-badges">
            <span class="badge">{{ selected.number }}</span>
            <span v-if="selected.current" class="badge current">当前版本</span>
            <span class="stage-badge" :style="{ '--stage': selectedStage.color }">{{ selectedStage.name }}</span>
          </div>
          </div>
          <div class="drawer-version-info" aria-label="版本信息">
            <div><span>指导老师</span><strong>{{ selected.project.owner }}</strong></div>
            <div><span>团队成员</span><strong>{{ selected.project.team }}</strong></div>
            <div><span>技术栈</span><strong>{{ selected.project.stack.length ? selected.project.stack.join(' / ') : '—' }}</strong></div>
            <div><span>开始日期</span><strong>{{ selected.start }}</strong></div>
            <div><span>{{ selected.project.versions.find(v => v.number === selected.project.versions.map(item => item.number).sort(compareVersion).at(-1))?.stage === lastStage ? '交付时间' : '预计交付' }}</span><strong>{{ selected.delivery }}</strong></div>
          </div>
        </div>
        <div class="drawer-body">
          <div class="drawer-col">
            <section class="section">
              <h3>项目简介</h3>
              <p class="project-intro">{{ selected.project.intro || '该项目暂未提供文字简介，可在「数据修改」页补充。' }}</p>
            </section>
          </div>
          <div class="drawer-col">
            <section class="section">
              <h3>{{ videoCount ? '项目图片 / 视频' : '项目图片' }}<span class="section-count">{{ galleryMedia.length }} 个<span v-if="videoCount">（含 {{ videoCount }} 个视频）</span></span><span v-if="galleryMedia.length" class="gallery-heading-hint">点击图片可放大查看</span></h3>
              <div v-if="galleryMedia.length" class="shot-slideshow">
                <div
                  class="shot-slide"
                  :class="{ 'is-video': currentMedia?.type === 'video' }"
                  :role="currentMedia?.type === 'video' ? 'group' : 'button'"
                  :tabindex="currentMedia?.type === 'video' ? -1 : 0"
                  :aria-label="currentMedia?.type === 'video' ? (selected.project.name + ' 第 ' + (slideIndex + 1) + ' 个视频') : ('放大查看 ' + selected.project.name + ' 第 ' + (slideIndex + 1) + ' 张图片')"
                  @click="currentMedia?.type === 'video' ? undefined : openGallery(slideIndex)"
                  @keydown.enter="currentMedia?.type === 'video' ? undefined : openGallery(slideIndex)"
                >
                  <Transition name="slide-fade" mode="out-in">
                    <video
                      v-if="currentMedia?.type === 'video'"
                      :key="'vid-' + slideIndex"
                      ref="slideVideo"
                      @play="mediaPlaying = true" @pause="mediaPlaying = false" @ended="mediaPlaying = false"
                      class="shot-slide-img shot-slide-video"
                      :src="currentMedia.src"
                      controls
                      playsinline
                      preload="metadata"
                      @click.stop
                    ></video>
                    <img v-else :key="'img-' + slideIndex" class="shot-slide-img" :src="currentMedia?.src" :alt="selected.project.name + ' 界面截图 ' + (slideIndex + 1)" />
                  </Transition>
                  <button
                    v-if="currentMedia?.type === 'video'"
                    class="shot-slide-zoom"
                    type="button"
                    @click.stop="openGallery(slideIndex)"
                  >放大播放</button>
                  <button
                    v-if="galleryMedia.length > 1"
                    class="shot-slide-nav prev"
                    type="button"
                    aria-label="上一项"
                    @click.stop="stepSlide(-1)"
                  >‹</button>
                  <button
                    v-if="galleryMedia.length > 1"
                    class="shot-slide-nav next"
                    type="button"
                    aria-label="下一项"
                    @click.stop="stepSlide(1)"
                  >›</button>
                  <span class="shot-slide-counter">{{ slideIndex + 1 }} / {{ galleryMedia.length }}</span>
                </div>
                <div v-if="galleryMedia.length > 1" class="shot-dots">
                  <button
                    v-for="(item, index) in galleryMedia"
                    :key="item.src + index"
                    class="shot-dot"
                    :class="{ active: index === slideIndex, video: item.type === 'video' }"
                    type="button"
                    :aria-label="item.type === 'video' ? ('显示第 ' + (index + 1) + ' 个视频') : ('显示第 ' + (index + 1) + ' 张图片')"
                    @click.stop="setSlide(index)"
                  ></button>
                </div>
              </div>
              <p v-else class="gallery-hint">暂无项目图片或视频</p>
            </section>
          </div>
        </div>
      </template>
    </aside>

    <div v-if="galleryOpen && selected" class="lightbox" @click.self="closeGallery">
      <button class="lightbox-close" type="button" aria-label="关闭" @click="closeGallery">×</button>
      <div class="lightbox-stage">
        <button class="lightbox-nav prev" type="button" aria-label="上一项" @click.stop="stepGallery(-1)">‹</button>
        <video
          v-if="galleryMedia[galleryIndex]?.type === 'video'"
          :key="'lv-' + galleryIndex"
          ref="galleryVideo"
          @play="mediaPlaying = true" @pause="mediaPlaying = false" @ended="mediaPlaying = false"
          class="lightbox-video"
          :src="galleryMedia[galleryIndex].src"
          controls
          playsinline
          preload="metadata"
          @click.stop
        ></video>
        <img v-else class="lightbox-img" :src="galleryMedia[galleryIndex]?.src" :alt="selected.project.name + ' 界面截图 ' + (galleryIndex + 1)" />
        <button class="lightbox-nav next" type="button" aria-label="下一项" @click.stop="stepGallery(1)">›</button>
      </div>
      <div class="lightbox-caption">{{ selected.project.name }} · {{ galleryMedia[galleryIndex]?.type === 'video' ? '项目视频' : '项目图片' }} {{ galleryIndex + 1 }} / {{ galleryMedia.length }}</div>
    </div>

  </div>
</template>
