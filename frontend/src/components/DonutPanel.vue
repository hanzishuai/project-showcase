<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ProjectSummary } from '../api'

const props = defineProps<{ projects: ProjectSummary[] }>()
const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const COLORS = ['#80cdb1', '#ecc26e', '#84b6f4', '#f1a48c', '#b5a2e8', '#e9a7c4']

const legend = computed(() => {
  const totalShots = props.projects.reduce((sum, p) => sum + p.shot_count, 0)
  return props.projects.map((p, i) => ({
    name: p.name,
    count: p.shot_count,
    color: COLORS[i % COLORS.length],
    percent: totalShots ? Math.round((p.shot_count / totalShots) * 1000) / 10 : 0
  }))
})

const total = computed(() => props.projects.reduce((sum, p) => sum + p.shot_count, 0))

function render() {
  if (!chart) return
  chart.setOption({
    color: legend.value.map((l) => l.color),
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,.98)',
      borderColor: '#e2e8f1',
      textStyle: { color: '#3a4557', fontSize: 12 },
      formatter: (params: any) => {
        const value = Number(params.value ?? 0)
        return value > 0 ? params.name + '<br/>' + value + ' 张（' + params.percent + '%）' : params.name + '<br/>0 张'
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '77%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        label: { show: false },
        data: props.projects.map((p, i) => ({ value: p.shot_count, name: p.name, itemStyle: { color: COLORS[i % COLORS.length] } }))
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'center',
        silent: true,
        style: {
          text: total.value > 0 ? total.value + ' 张' : '—',
          fill: '#2f3a4d',
          fontSize: 23,
          fontWeight: 700,
          fontFamily: 'Bahnschrift, Consolas, monospace',
          textAlign: 'center'
        }
      }
    ]
  }, true)
}

function resize() { chart?.resize() }
onMounted(() => {
  if (el.value) {
    chart = echarts.init(el.value)
    render()
    window.addEventListener('resize', resize)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
watch(() => props.projects, render, { deep: true })
</script>

<template>
  <section class="panel chart-right">
    <div class="panel-head"><span>截图证据分布</span><span class="hint">按项目 · 张</span></div>
    <div class="donut-body">
      <div ref="el" class="chart-box donut-canvas"></div>
      <div class="legend">
        <div
          v-for="item in legend"
          :key="item.name"
          class="legend-item"
          :class="{ zero: item.count === 0 }"
          :style="{ color: item.color }"
        >
          <i></i><span class="nm" :title="item.name">{{ item.name }}</span>
          <span class="ct">{{ item.count }} 张</span>
          <span v-if="item.count > 0 && total > 0" class="pc">{{ item.percent }}%</span>
        </div>
      </div>
    </div>
  </section>
</template>