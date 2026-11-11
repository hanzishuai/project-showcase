<script setup lang="ts">
interface StageItem {
  name: string
  state: string
}

interface StageStat {
  seq: number
  name: string
  done: number
  active: number
  total: number
  items: StageItem[]
}

defineProps<{ stages: StageStat[]; total: number; maintained: number; slots: number }>()

const stateLabel = (state: string) => (state === 'done' ? '已完成' : state === 'active' ? '维护中' : '未维护')
</script>

<template>
  <section class="panel chart-lifecycle">
    <div class="panel-head">
      <span>软件生命周期环节</span>
      <span class="hint">六段环节 · {{ maintained }} / {{ slots }} 已维护</span>
    </div>
    <div class="lifecycle" role="list" aria-label="软件生命周期六段环节">
      <article
        v-for="stage in stages"
        :key="stage.seq"
        class="life-stage"
        role="listitem"
      >
        <div class="ls-top">
          <span class="ls-no">{{ String(stage.seq).padStart(2, '0') }}</span>
          <span class="ls-name">{{ stage.name }}</span>
        </div>
        <div class="ls-projects" :aria-label="stage.name + '：' + stage.done + ' / ' + stage.total + ' 个项目已维护'">
          <div v-for="item in stage.items" :key="item.name" class="ls-project" :title="item.name">
            <span class="ls-status" :class="'is-' + item.state"></span>
            <span class="ls-pname">{{ item.name }}</span>
            <span class="ls-pstate">{{ stateLabel(item.state) }}</span>
          </div>
        </div>
        <div class="ls-foot">
          <b>{{ stage.done }} / {{ stage.total }}</b>
          <span>已维护</span>
        </div>
      </article>
    </div>
  </section>
</template>
