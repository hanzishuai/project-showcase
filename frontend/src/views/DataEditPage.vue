<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  loadKanbanData,
  resetKanbanData,
  saveKanbanData,
  type KanbanData,
  type KanbanStage,
  type KanbanVersion
} from '../kanban/data'

interface EditorProject {
  name: string
  owner: string
  team: string
  users: number
  features: number
  stackText: string
  images: string[]
  versions: KanbanVersion[]
}

const rootEl = ref<HTMLDivElement | null>(null)
const stages = ref<KanbanStage[]>([])
const projects = ref<EditorProject[]>([])
const message = ref('')
const messageType = ref<'info' | 'error'>('info')

const totalVersions = computed(() => projects.value.reduce((total, project) => total + project.versions.length, 0))

const splitStack = (value: string) => value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)

const load = () => {
  const data = loadKanbanData()
  stages.value = data.stages.map((stage) => ({ ...stage }))
  projects.value = data.projects.map((project) => ({
    name: project.name,
    owner: project.owner,
    team: project.team,
    users: project.users,
    features: project.features,
    stackText: (project.stack || []).join(', '),
    images: [...(project.images || [])],
    versions: (project.versions || []).map((version) => ({ ...version }))
  }))
}

load()

const fit = () => {
  if (!rootEl.value) return
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  rootEl.value.style.transform = 'scale(' + scale + ')'
}

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
})

onBeforeUnmount(() => window.removeEventListener('resize', fit))

const addProject = () => {
  projects.value.push({
    name: '新项目',
    owner: '待补充',
    team: '待补充',
    users: 0,
    features: 0,
    stackText: 'Vue 3, Spring Boot, MySQL',
    images: [],
    versions: []
  })
}

const removeProject = (index: number) => {
  projects.value.splice(index, 1)
}

const addVersion = (project: EditorProject) => {
  project.versions.push({
    number: 'v1.0',
    stage: 0,
    days: 0,
    start: new Date().toISOString().slice(0, 10),
    note: ''
  })
}

const removeVersion = (project: EditorProject, index: number) => {
  project.versions.splice(index, 1)
}

const MAX_IMAGE_EDGE = 1400

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error(file.name + ' 不是图片文件'))
    return
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error(file.name + ' 超过 12 MB，请换小一点的图片'))
    return
  }
  const reader = new FileReader()
  reader.onerror = () => reject(new Error(file.name + ' 读取失败'))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error(file.name + ' 解析失败'))
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('浏览器无法处理图片'))
        return
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
})

const filesFromEvent = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.length) return Array.from(input.files)
  return Array.from((event as DragEvent).dataTransfer?.files || [])
}

const uploadImages = async (project: EditorProject, event: Event) => {
  const input = event.target as HTMLInputElement
  const files = filesFromEvent(event)
  if (input instanceof HTMLInputElement) input.value = ''
  if (!files.length) return
  try {
    const uploaded: string[] = []
    for (const file of files) uploaded.push(await fileToDataUrl(file))
    project.images.push(...uploaded)
    messageType.value = 'info'
    message.value = '已添加 ' + uploaded.length + ' 张图片，点击保存后写入看板'
  } catch (error) {
    messageType.value = 'error'
    message.value = String(error instanceof Error ? error.message : error)
  }
}

const removeImage = (project: EditorProject, index: number) => {
  project.images.splice(index, 1)
}

const validate = (): string[] => {
  const errors: string[] = []
  if (!stages.value.length) errors.push('至少保留一个阶段')
  stages.value.forEach((stage, index) => {
    if (!stage.name.trim()) errors.push('阶段 ' + (index + 1) + ' 名称不能为空')
  })
  projects.value.forEach((project, projectIndex) => {
    const label = project.name.trim() || '第 ' + (projectIndex + 1) + ' 个项目'
    if (!project.name.trim()) errors.push('第 ' + (projectIndex + 1) + ' 个项目名称不能为空')
    if (!Number.isFinite(Number(project.users)) || Number(project.users) < 0) errors.push(label + '：用户数量需为非负数字')
    if (!Number.isFinite(Number(project.features)) || Number(project.features) < 0) errors.push(label + '：已开发功能需为非负数字')
    project.versions.forEach((version, versionIndex) => {
      const versionLabel = label + ' 第 ' + (versionIndex + 1) + ' 个版本'
      if (!version.number.trim()) errors.push(versionLabel + '：版本号不能为空')
      if (!Number.isInteger(Number(version.stage)) || Number(version.stage) < 0 || Number(version.stage) >= stages.value.length) {
        errors.push(versionLabel + '：阶段不合法')
      }
      if (!Number.isFinite(Number(version.days)) || Number(version.days) < 0) errors.push(versionLabel + '：停留天数需为非负数字')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(version.start)) errors.push(versionLabel + '：开始日期格式应为 YYYY-MM-DD')
    })
  })
  return errors
}

const save = () => {
  const errors = validate()
  if (errors.length) {
    messageType.value = 'error'
    message.value = errors[0] + (errors.length > 1 ? '（另有 ' + (errors.length - 1) + ' 项问题）' : '')
    return
  }
  const payload: KanbanData = {
    stages: stages.value.map((stage, index) => ({
      name: stage.name.trim() || '阶段 ' + (index + 1),
      color: stage.color
    })),
    projects: projects.value.map((project) => ({
      name: project.name.trim(),
      owner: project.owner.trim(),
      team: project.team.trim(),
      users: Number(project.users) || 0,
      features: Number(project.features) || 0,
      stack: splitStack(project.stackText),
      images: project.images.filter(Boolean),
      versions: project.versions.map((version) => ({
        number: version.number.trim(),
        stage: Number(version.stage),
        days: Number(version.days) || 0,
        start: version.start,
        note: version.note.trim()
      }))
    }))
  }
  try {
    saveKanbanData(payload)
    messageType.value = 'info'
    message.value = '已保存，正在返回看板…'
    window.setTimeout(() => { window.location.hash = '#/' }, 260)
  } catch (error) {
    messageType.value = 'error'
    message.value = '保存失败：' + String(error)
  }
}

const restoreDefaults = () => {
  if (!window.confirm('恢复默认数据会覆盖当前所有修改，确认继续？')) return
  resetKanbanData()
  load()
  messageType.value = 'info'
  message.value = '已恢复默认数据，点击保存后生效'
}
</script>

<template>
  <div id="data-editor" ref="rootEl">
    <header class="nav">
      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 7 12 3l8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4" />
          </svg>
        </span>
        软件学院 · 项目实践聚合平台
        <span class="editor-crumb">/ 数据修改</span>
      </div>
      <div class="editor-actions">
        <span v-if="message" class="editor-message" :class="messageType">{{ message }}</span>
        <button class="ghost-btn" type="button" @click="restoreDefaults">恢复默认</button>
        <a class="ghost-btn" href="#/">返回看板</a>
        <button class="primary-btn" type="button" @click="save">保存并查看看板</button>
      </div>
    </header>

    <main class="editor-main">
      <section class="editor-intro">
        <div>
          <h1>数据修改</h1>
          <p>修改生命周期看板的阶段、项目与版本；保存后立即生效。数据保存在当前浏览器。</p>
        </div>
        <div class="editor-summary">{{ projects.length }} 个项目 · {{ totalVersions }} 个版本</div>
      </section>

      <section class="panel editor-panel">
        <div class="editor-panel-head">
          <h2>阶段设置</h2>
          <span>名称与颜色会同步到看板列</span>
        </div>
        <div class="stage-grid">
          <label v-for="(stage, index) in stages" :key="index" class="stage-field">
            <span>阶段 {{ index + 1 }}</span>
            <div class="stage-inputs">
              <input v-model="stage.name" placeholder="阶段名称" />
              <input v-model="stage.color" type="color" aria-label="阶段颜色" />
            </div>
          </label>
        </div>
      </section>

      <section class="projects-editor">
        <div class="editor-panel-head">
          <h2>项目与版本</h2>
          <span>共 {{ projects.length }} 个项目 / {{ totalVersions }} 个版本</span>
        </div>

        <article v-for="(project, projectIndex) in projects" :key="projectIndex" class="panel project-editor">
          <div class="project-editor-head">
            <span class="project-badge">{{ String(projectIndex + 1).padStart(2, '0') }}</span>
            <input v-model="project.name" class="project-name-input" placeholder="项目名称" />
            <button class="link-danger" type="button" @click="removeProject(projectIndex)">删除项目</button>
          </div>

          <div class="field-grid">
            <label><span>指导老师</span><input v-model="project.owner" /></label>
            <label><span>团队成员</span><input v-model="project.team" /></label>
            <label><span>用户数量</span><input v-model.number="project.users" type="number" min="0" /></label>
            <label><span>已开发功能</span><input v-model.number="project.features" type="number" min="0" /></label>
            <label class="wide"><span>技术栈（逗号分隔）</span><input v-model="project.stackText" /></label>
            <div class="image-field wide">
              <div class="image-field-head">
                <span>项目图片 <em v-if="project.images.length">{{ project.images.length }} 张</em></span>
                <label class="image-upload-btn">
                  上传图片
                  <input type="file" accept="image/*" multiple @change="uploadImages(project, $event)" />
                </label>
              </div>
              <div class="image-drop" @dragover.prevent @drop.prevent="uploadImages(project, $event)">
                <div v-if="project.images.length" class="image-grid">
                  <div v-for="(src, imageIndex) in project.images" :key="imageIndex" class="image-item">
                    <img :src="src" :alt="project.name + ' 图片 ' + (imageIndex + 1)" />
                    <button class="image-remove" type="button" :aria-label="'删除第 ' + (imageIndex + 1) + ' 张图片'" @click="removeImage(project, imageIndex)">×</button>
                  </div>
                </div>
                <div v-else class="image-empty">还没有项目图片，点击上方「上传图片」或把图片拖进来</div>
              </div>
              <p class="image-hint">支持多选，单张不超过 12 MB，上传后自动压缩为最长边 1400px。</p>
            </div>
          </div>

          <div class="versions-editor">
            <div class="versions-title">版本列表 <span>{{ project.versions.length }} 个</span></div>
            <div v-if="project.versions.length" class="version-table">
              <div class="version-head">
                <span>版本号</span><span>阶段</span><span>已停留天数</span><span>开始日期</span><span>版本说明</span><span>操作</span>
              </div>
              <div v-for="(version, versionIndex) in project.versions" :key="versionIndex" class="version-row">
                <input v-model="version.number" placeholder="v1.0" />
                <select v-model.number="version.stage">
                  <option v-for="(stage, stageIndex) in stages" :key="stageIndex" :value="stageIndex">{{ stage.name || '阶段 ' + (stageIndex + 1) }}</option>
                </select>
                <input v-model.number="version.days" type="number" min="0" />
                <input v-model="version.start" type="date" />
                <input v-model="version.note" placeholder="版本说明" />
                <button class="link-danger" type="button" @click="removeVersion(project, versionIndex)">删除</button>
              </div>
            </div>
            <p v-else class="empty-tip">这个项目还没有版本，点击下方按钮添加。</p>
            <button class="add-row" type="button" @click="addVersion(project)">+ 添加版本</button>
          </div>
        </article>

        <button class="add-project" type="button" @click="addProject">+ 添加项目</button>
      </section>
    </main>
  </div>
</template>
