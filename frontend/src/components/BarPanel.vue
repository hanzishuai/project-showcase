<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ProjectSummary } from '../api'

const props = defineProps<{ projects: ProjectSummary[] }>()
const box = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!box.value) return
  if (!chart) chart = echarts.init(box.value)
  const names = props.projects.map((p) => p.name.replace(/项目介绍$/, '').replace(/简介$/, ''))
  chart.setOption({
    animationDuration: 600,
    grid: { left: 132, right: 28, top: 26, bottom: 34 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#ffffff', borderColor: '#e2e8f1', textStyle: { color: '#3a4557', fontSize: 12 } },
    legend: { right: 8, top: 0, itemWidth: 10, itemHeight: 8, textStyle: { color: '#667085', fontSize: 11 } },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { lineStyle: { color: 'rgba(122,136,158,.35)' } },
      axisLabel: { color: '#657184', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(122,136,158,.12)' } }
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { lineStyle: { color: 'rgba(122,136,158,.35)' } },
      axisTick: { show: false },
      axisLabel: { color: '#4c596b', fontSize: 12, width: 118, overflow: 'truncate' }
    },
    series: [
      {
        name: 'docx 文档',
        type: 'bar',
        barWidth: 12,
        itemStyle: {
          borderRadius: 6,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#8db9f2' },
            { offset: 1, color: '#b6d4fa' }
          ])
        },
        data: props.projects.map((p) => p.docx_count)
      },
      {
        name: '界面截图',
        type: 'bar',
        barWidth: 12,
        itemStyle: {
          borderRadius: 6,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#f1a48c' },
            { offset: 1, color: '#f7c9bb' }
          ])
        },
        data: props.projects.map((p) => p.shot_count)
      }
    ]
  })
}

function resize() { chart?.resize() }

onMounted(() => { render(); window.addEventListener('resize', resize) })
watch(() => props.projects, render, { deep: true })
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <section class="panel chart-left">
    <div class="panel-head"><span>资料构成</span><span class="hint">按项目 · 份 / 张</span></div>
    <div ref="box" class="chart-box"></div>
  </section>
</template>
