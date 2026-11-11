<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFitScreen } from '../useFitScreen'
import { api, updateStage, type ProjectDetail, type StageItem } from '../api'
import { getShowcase } from '../content/projectShowcase'

const route = useRoute()
const detail = ref<ProjectDetail | null>(null)
const error = ref('')
const saving = ref<Record<number, boolean>>({})
const picks = ref<Record<number, StageItem['state']>>({})
const zoomIndex = ref(-1)
let lastFocus: HTMLElement | null = null
const { screen } = useFitScreen()

const STATE_TEXT: Record<StageItem['state'], string> = {
  missing: '文档未提供',
  active: '维护中',
  done: '已完成'
}
const stateText = STATE_TEXT

const showcase = computed(() => (detail.value ? getShowcase(detail.value.id) : null))
const stageDone = computed(() => detail.value?.stages.filter((stage) => stage.state === 'done').length ?? 0)
const stageTotal = computed(() => detail.value?.stages.length ?? 0)
const statusText = computed(() => detail.value?.status ?? '—')
const developerText = computed(() => {
  const list = detail.value?.developers ?? []
  return list.length ? list.map((item) => item.role ? item.name + '（' + item.role + '）' : item.name).join('、') : '—'
})
const advisorText = computed(() => detail.value?.advisor || '—')
const zoomed = computed(() => {
  const shots = detail.value?.screenshots ?? []
  return zoomIndex.value >= 0 ? shots[zoomIndex.value] ?? null : null
})

function applyDetail(next: ProjectDetail) {
  detail.value = next
  for (const stage of next.stages) picks.value[stage.seq] = stage.state
}

async function load() {
  error.value = ''
  zoomIndex.value = -1
  try {
    const next = await api.project(String(route.params.id))
    applyDetail(next)
    document.title = next.name + '项目介绍'
  } catch (e) {
    error.value = String(e)
  }
}

async function saveStage(seq: number) {
  if (!detail.value) return
  saving.value[seq] = true
  try {
    const next = await updateStage(detail.value.id, seq, picks.value[seq] ?? 'missing')
    applyDetail(next)
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value[seq] = false
  }
}

async function openShot(index: number) {
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  zoomIndex.value = index
  await nextTick()
  document.querySelector<HTMLElement>('.lightbox-close')?.focus()
}

function closeZoom() {
  zoomIndex.value = -1
  nextTick(() => lastFocus?.focus())
}

function moveZoom(step: number) {
  const shots = detail.value?.screenshots ?? []
  if (!shots.length || zoomIndex.value < 0) return
  zoomIndex.value = (zoomIndex.value + step + shots.length) % shots.length
}

function onKeydown(event: KeyboardEvent) {
  if (!zoomed.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeZoom()
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveZoom(-1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveZoom(1)
    return
  }
  if (event.key === 'Tab') {
    const root = document.querySelector<HTMLElement>('.lightbox')
    if (!root) return
    const focusables = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'))
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.title = '项目实践聚合平台'
})
watch(() => route.params.id, load)
</script>

<template>
  <div class="viewport">
    <div id="screen" class="screen" ref="screen">
      <div class="detail-top">
        <RouterLink class="back-link" to="/">← 返回项目总览</RouterLink>
        <div class="detail-head">
          <div v-if="showcase" class="detail-kindline">
            <span class="kind-badge" :class="showcase.kind">{{ showcase.kindLabel }}</span>
            <span class="detail-phase">{{ showcase.phase }}</span>
          </div>
          <div class="detail-title-line">
            <h1 v-if="detail">{{ detail.name }}</h1>
            <span v-if="detail" class="tag" :class="detail.status ? 'tag-ok' : 'tag-muted'">{{ statusText }}</span>
          </div>
          <div v-if="detail" class="detail-sub">{{ detail.summary }}</div>
        </div>
        <div v-if="detail" class="detail-meta">
          <span>更新 <b>{{ detail.updated_at || '—' }}</b></span>
          <span><b>{{ detail.docx_count }}</b> 份 docx · <b>{{ detail.shot_count }}</b> 张截图</span>
        </div>
      </div>

      <div v-if="error" class="empty-block">数据读取失败：{{ error }}</div>

      <main v-if="detail" class="detail-body">
        <aside class="detail-rail" aria-label="项目档案">
          <section class="detail-panel rail-panel">
            <h2 class="d-title">项目档案</h2>
            <div class="info-grid">
              <div class="info-item"><div class="k">文档阶段</div><div class="v">{{ detail.stage_label || '—' }}</div></div>
              <div class="info-item"><div class="k">阶段完成</div><div class="v">{{ stageDone }} / {{ stageTotal }}</div></div>
              <div class="info-item"><div class="k">开发成员</div><div class="v">{{ developerText }}</div></div>
              <div class="info-item"><div class="k">指导教师</div><div class="v">{{ advisorText }}</div></div>
              <div class="info-item"><div class="k">更新时间</div><div class="v">{{ detail.updated_at || '—' }}</div></div>
              <div class="info-item"><div class="k">源文件</div><div class="v">{{ detail.source_files.length ? detail.source_files.map((file) => file.file_name).join('、') : '—' }}</div></div>
              <div class="info-item"><div class="k">截图数量</div><div class="v">{{ detail.screenshots.length }} 张</div></div>
              <div class="info-item full"><div class="k">资料说明</div><div class="v">{{ detail.data_note || '—' }}</div></div>
            </div>
          </section>
        </aside>

        <div class="detail-main">
          <section v-if="showcase && showcase.kind === 'doing'" class="detail-panel">
            <h2 class="d-title">模块进度 <span class="d-meta">{{ showcase.modulesDone.length }} 项已完成 · {{ showcase.modulesDoing.length }} 项开发中</span></h2>
            <div class="module-board">
              <div class="module-column done">
                <h3>已开发完毕 <em>{{ showcase.modulesDone.length }} 项</em></h3>
                <ul class="module-list">
                  <li v-for="item in showcase.modulesDone" :key="item.name">
                    <span class="module-dot"></span>
                    <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
                  </li>
                </ul>
              </div>
              <div class="module-column doing">
                <h3>正在开发 <em>{{ showcase.modulesDoing.length }} 项</em></h3>
                <ul v-if="showcase.modulesDoing.length" class="module-list">
                  <li v-for="item in showcase.modulesDoing" :key="item.name">
                    <span class="module-dot"></span>
                    <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
                  </li>
                </ul>
                <div v-else class="module-empty">文档未注明正在开发的功能</div>
              </div>
            </div>
          </section>

          <section v-if="showcase && showcase.kind === 'done'" class="detail-panel">
            <h2 class="d-title">运行数据 <span class="d-meta">业务现状</span></h2>
            <div class="usage-board">
              <div v-for="item in showcase.usage" :key="item.label" class="usage-tile">
                <div class="usage-value"><b>{{ item.value }}</b><small>{{ item.unit }}</small></div>
                <div class="usage-label">{{ item.label }}</div>
                <div class="usage-note">{{ item.note }}</div>
              </div>
            </div>
            <div class="runtime-line"><span>运行时长</span><b>{{ showcase.runtime?.value ?? '—' }}</b><span>{{ showcase.runtime?.note }}</span></div>
          </section>

          <section v-if="showcase && showcase.kind === 'done'" class="detail-panel">
            <h2 class="d-title">已交付模块 <span class="d-meta">{{ showcase.modulesDone.length }} 项</span></h2>
            <div class="module-board" :class="{ single: !showcase.modulesPlanned?.length }">
              <div class="module-column done">
                <h3>功能清单</h3>
                <ul class="module-list">
                  <li v-for="item in showcase.modulesDone" :key="item.name">
                    <span class="module-dot"></span>
                    <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
                  </li>
                </ul>
              </div>
              <div class="module-column">
                <h3>上线准备 <em>{{ showcase.modulesPlanned?.length ?? 0 }} 项</em></h3>
                <ul v-if="showcase.modulesPlanned?.length" class="module-list">
                  <li v-for="item in showcase.modulesPlanned" :key="item.name">
                    <span class="module-dot"></span>
                    <div><b>{{ item.name }}</b><small v-if="item.note">{{ item.note }}</small></div>
                  </li>
                </ul>
                <div v-else class="module-empty">暂无上线准备事项记录</div>
              </div>
            </div>
          </section>

          <section class="detail-panel">
            <h2 class="d-title">六段阶段记录 <span class="d-count">{{ stageDone }} / {{ stageTotal }}</span></h2>
            <div class="d-steps">
              <div v-for="stage in detail.stages" :key="stage.seq" class="step" :class="stage.state">
                <span class="n">{{ String(stage.seq).padStart(2, '0') }}</span>
                <span class="t">{{ stage.name }}</span>
                <span class="bar"></span>
                <span class="st">{{ stateText[stage.state] }}</span>
              </div>
            </div>
            <p v-if="detail.stage_note" class="stage-note">{{ detail.stage_note }}</p>
          </section>

          <section class="detail-panel">
            <h2 class="d-title">阶段维护 <span class="d-count">仅人工确认</span></h2>
            <div class="stage-editor">
              <div class="d-editor-grid">
                <div v-for="stage in detail.stages" :key="stage.seq" class="editor-row">
                  <span class="editor-name">{{ stage.seq }}. {{ stage.name }}</span>
                  <select v-model="picks[stage.seq]" class="editor-select" :aria-label="'设置 ' + stage.name + ' 阶段状态'">
                    <option value="missing">文档未提供</option>
                    <option value="active">维护中</option>
                    <option value="done">已完成</option>
                  </select>
                  <button class="editor-save" :disabled="saving[stage.seq]" @click="saveStage(stage.seq)">
                    {{ saving[stage.seq] ? '保存中…' : '保存' }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="detail-panel">
            <h2 class="d-title">文档原话</h2>
            <blockquote v-if="detail.stage_note" class="quote">{{ detail.stage_note }}</blockquote>
            <div v-else class="empty-block">文档未提供原话</div>
          </section>

          <section class="detail-panel">
            <h2 class="d-title">内容摘要</h2>
            <div class="prose">
              <p v-if="detail.content">{{ detail.content }}</p>
              <div v-else class="empty-block">文档未提供内容摘要</div>
            </div>
          </section>
        </div>

        <aside class="detail-evidence" aria-label="界面截图">
          <section class="detail-panel">
            <h2 class="d-title">界面截图 <span class="d-count">{{ detail.screenshots.length }} 张</span></h2>
            <div v-if="detail.screenshots.length" class="shots">
              <figure v-for="(shot, index) in detail.screenshots" :key="shot.id" class="shot">
                <button class="shot-open" type="button" :aria-label="'放大截图：' + (shot.caption || shot.file_name)" @click="openShot(index)">
                  <img :src="shot.url" :alt="shot.caption || shot.file_name" loading="lazy" />
                </button>
                <figcaption>{{ shot.caption || shot.file_name }}</figcaption>
              </figure>
            </div>
            <div v-else class="empty-block">暂无界面截图</div>
          </section>
        </aside>
      </main>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="zoomed" class="lightbox" role="dialog" aria-modal="true" :aria-label="'截图预览：' + (zoomed.caption || zoomed.file_name)" @click.self="closeZoom">
      <button class="lightbox-close" type="button" aria-label="关闭截图预览" @click="closeZoom">×</button>
      <button class="lightbox-nav prev" type="button" aria-label="上一张截图" @click.stop="moveZoom(-1)">‹</button>
      <figure class="lightbox-figure">
        <img :src="zoomed.url" :alt="zoomed.caption || zoomed.file_name" />
        <figcaption>
          {{ zoomed.caption || zoomed.file_name }}
          <span class="lightbox-counter">{{ zoomIndex + 1 }} / {{ detail?.screenshots.length }}</span>
        </figcaption>
      </figure>
      <button class="lightbox-nav next" type="button" aria-label="下一张截图" @click.stop="moveZoom(1)">›</button>
    </div>
  </Teleport>
</template>