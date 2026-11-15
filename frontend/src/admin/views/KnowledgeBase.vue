<template>
  <div>
    <div class="page-heading"><h2>知识库管理</h2><p>维护讲解员回答问题时使用的参考资料。</p></div>
    <section class="surface">
      <div class="knowledge-intro">
        <div>
          <h3>文档与索引</h3>
          <p>支持 .md / .txt / .docx / .pdf，单个文件不超过 20MB。上传后先预览分块与解析提示，确认入库才会写入知识库并重建索引。</p>
        </div>
        <div class="toolbar">
          <a-upload :custom-request="doUpload" :accept="ACCEPT" :show-file-list="false" :disabled="previewing">
            <template #upload-button>
              <a-button type="primary" :loading="previewing">{{ previewing ? '解析中…' : '上传文档' }}</a-button>
            </template>
          </a-upload>
          <a-button @click="rebuild" :loading="rebuilding">重建索引</a-button>
        </div>
      </div>

      <a-alert v-if="result" type="success" closable style="margin-bottom:18px" @close="result = ''">{{ result }}</a-alert>
      <a-alert v-if="operationError" type="error" closable style="margin-bottom:18px" @close="operationError = ''">{{ operationError }}</a-alert>

      <div class="section-title">
        <h3>已上传文档 <span v-if="docs.length" class="doc-count">· {{ docs.length }} 篇</span></h3>
        <a-button type="text" size="small" :loading="docsLoading" @click="loadDocs">刷新</a-button>
      </div>
      <a-spin v-if="docsLoading" style="display:flex;justify-content:center;padding:36px" />
      <a-result v-else-if="docsError" status="error" title="文档列表加载失败">
        <template #extra><a-button @click="loadDocs">重试</a-button></template>
      </a-result>
      <a-empty v-else-if="!docs.length" description="暂无文档，可上传 .md / .txt / .docx / .pdf 文件" />
      <div v-else class="table-scroll">
        <a-table :columns="docColumns" :data="docs" row-key="name" :pagination="false" size="small">
          <template #name="{ record }"><span class="doc-name" :title="record.name">{{ record.name }}</span></template>
          <template #size="{ record }">{{ formatSize(record.size) }}</template>
          <template #modified_at="{ record }"><span class="time-text">{{ formatTime(record.modified_at) }}</span></template>
          <template #action="{ record }">
            <a-popconfirm content="确定删除此文档？删除后会自动重建索引。" @ok="removeDoc(record.name)">
              <a-button type="text" status="danger" size="small">删除</a-button>
            </a-popconfirm>
          </template>
        </a-table>
      </div>
      <p v-if="docs.length && !docsError" class="section-tip">删除文档会自动重建索引；如需刷新整个索引，可使用右上角「重建索引」。</p>
    </section>

    <a-modal
      v-model:visible="previewVisible"
      title="分块预览"
      :width="'min(900px, calc(100vw - 32px))'"
      :mask-closable="false"
      :body-style="{ maxHeight: '68vh', overflowY: 'auto' }"
      @cancel="cancelPreview"
    >
      <div v-if="previewing" class="preview-loading"><a-spin /><span>正在解析文档，请稍候…</span></div>
      <a-alert v-else-if="previewError" type="error" show-icon :title="previewError" />
      <template v-else>
        <div class="preview-head">
          <div class="preview-title">{{ previewTitle }}</div>
          <div class="preview-meta">
            <a-tag color="arcoblue">{{ chunkTotal }} 个分块</a-tag>
            <a-tag>{{ previewChars }} 字</a-tag>
            <span v-if="previewFilename" class="preview-source" :title="previewFilename">源文件：{{ previewFilename }}</span>
          </div>
        </div>
        <div class="filename-row">
          <label class="field-label">入库文件名</label>
          <a-input v-model="commitFilename" allow-clear :max-length="120" placeholder="例如 产品手册.md" style="width:100%;max-width:360px" />
          <span class="field-hint">统一保存为 .md，非法字符会被替换</span>
        </div>
        <a-alert v-if="markdownTruncated" type="warning" show-icon style="margin-top:14px">
          <template #title>文档超出预览上限</template>
          该文档共 {{ previewChars }} 字，预览接口仅返回前 20000 字；确认入库将以预览内容为准，超出部分不会写入，建议拆分文档后分别上传。
        </a-alert>
        <a-alert v-if="warningList.length" type="warning" show-icon style="margin-top:14px">
          <template #title>解析提示</template>
          <ul class="warning-list">
            <li v-for="(warning, index) in warningList" :key="index">{{ warning }}</li>
          </ul>
        </a-alert>
        <a-empty v-if="!chunkTotal" class="chunk-empty" description="未解析出有效分块，请检查文档内容" />
        <div v-else class="chunk-list">
          <a-table :columns="chunkColumns" :data="chunkList" row-key="index" size="small" :pagination="chunkPagination" :scroll="{ x: 640 }">
            <template #index="{ record }"><span class="chunk-no">#{{ record.index + 1 }}</span></template>
            <template #title="{ record }"><span class="chunk-title" :title="record.title">{{ record.title }}</span></template>
            <template #chars="{ record }">{{ record.chars }} 字</template>
            <template #text="{ record }"><span class="chunk-text">{{ excerpt(record.text) }}</span></template>
          </a-table>
        </div>
        <p class="preview-note">预览分块与入库后的索引分块一致；确认后将写入知识库并立即重建索引。</p>
      </template>
      <template #footer>
        <a-button :disabled="committing" @click="cancelPreview">取消</a-button>
        <a-button type="primary" :loading="committing" :disabled="!canCommit" @click="confirmCommit">确认入库</a-button>
      </template>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { api } from '../api'
import type { KnowledgeDocument, KnowledgePreview } from '../api'

const ACCEPT = '.md,.markdown,.txt,.docx,.pdf'
const SUPPORTED_EXTS = ['.md', '.markdown', '.txt', '.docx', '.pdf']
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const rebuilding = ref(false)
const previewing = ref(false)
const committing = ref(false)
const result = ref('')
const operationError = ref('')
const docs = ref<KnowledgeDocument[]>([])
const docsLoading = ref(false)
const docsError = ref(false)

const previewVisible = ref(false)
const preview = ref<KnowledgePreview | null>(null)
const previewError = ref('')
const commitFilename = ref('')
let previewSequence = 0

const docColumns = [
  { title: '文件名', dataIndex: 'name', slotName: 'name' },
  { title: '大小', dataIndex: 'size', slotName: 'size', width: 100 },
  { title: '更新时间', dataIndex: 'modified_at', slotName: 'modified_at', width: 180 },
  { title: '操作', slotName: 'action', width: 90 },
]
const chunkColumns = [
  { title: '序号', dataIndex: 'index', slotName: 'index', width: 70 },
  { title: '分块标题', dataIndex: 'title', slotName: 'title', width: 180 },
  { title: '字数', dataIndex: 'chars', slotName: 'chars', width: 80 },
  { title: '内容预览（前 80 字）', dataIndex: 'text', slotName: 'text' },
]

const previewTitle = computed(() => preview.value?.title || '未命名文档')
const previewFilename = computed(() => preview.value?.filename || '')
const previewChars = computed(() => preview.value?.markdown_chars ?? 0)
const chunkList = computed(() => preview.value?.chunks ?? [])
const chunkTotal = computed(() => chunkList.value.length)
const warningList = computed(() => preview.value?.warnings ?? [])
const chunkPagination = computed(() => (chunkTotal.value > 8 ? { pageSize: 8, showTotal: true } : false))
const markdownTruncated = computed(() => !!preview.value && preview.value.markdown.length < preview.value.markdown_chars)
const canCommit = computed(() => !!preview.value && chunkTotal.value > 0 && !!commitFilename.value.trim())

onMounted(loadDocs)

async function loadDocs() {
  docsLoading.value = true
  docsError.value = false
  try {
    const res = await api.listDocuments()
    docs.value = res.data || []
  } catch {
    docsError.value = true
  } finally {
    docsLoading.value = false
  }
}

function formatSize(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '-'
  return bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'
}

function formatTime(value?: number | string | null) {
  if (value === undefined || value === null || value === '') return '-'
  const numeric = typeof value === 'number' ? value : Number(value)
  const date = Number.isFinite(numeric) && String(value).trim() !== '' && !String(value).includes('-')
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}

function excerpt(text: string, limit = 80) {
  const compact = (text || '').replace(/\s+/g, ' ').trim()
  if (!compact) return '-'
  return compact.length > limit ? compact.slice(0, limit) + '…' : compact
}

function errorText(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : ''
  if (!message || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) return fallback
  return message
}

function fileExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function defaultCommitName(filename: string) {
  const stem = (filename || '').replace(/\.[^./\\]+$/, '').trim()
  return (stem || '未命名文档') + '.md'
}

function doUpload(option: any) {
  const file: File | undefined = option?.fileItem?.file
  if (!file) {
    Message.error('未读取到文件，请重新选择')
    option?.onError?.(new Error('missing file'))
    return { abort: () => {} }
  }
  const extension = fileExtension(file.name)
  if (!SUPPORTED_EXTS.includes(extension)) {
    Message.error(`不支持的文件类型：${extension || '(无扩展名)'}，请上传 .md / .txt / .docx / .pdf`)
    option?.onError?.(new Error('unsupported type'))
    return { abort: () => {} }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    Message.error(`文件过大（${formatSize(file.size)}），单个文件不能超过 20MB`)
    option?.onError?.(new Error('file too large'))
    return { abort: () => {} }
  }
  result.value = ''
  operationError.value = ''
  preview.value = null
  previewError.value = ''
  commitFilename.value = ''
  previewVisible.value = true
  previewing.value = true
  const sequence = ++previewSequence
  api.previewDocument(file).then(response => {
    if (sequence !== previewSequence) return
    preview.value = response
    commitFilename.value = defaultCommitName(response.filename || file.name)
    option?.onSuccess?.(response)
  }).catch((err: unknown) => {
    if (sequence !== previewSequence) return
    previewError.value = errorText(err, '解析失败，请检查文件格式后重试')
    option?.onError?.(err)
  }).finally(() => {
    if (sequence === previewSequence) previewing.value = false
  })
  return { abort: () => {} }
}

function cancelPreview() {
  if (committing.value) return
  previewSequence += 1
  previewVisible.value = false
  previewing.value = false
  preview.value = null
  previewError.value = ''
  commitFilename.value = ''
}

async function confirmCommit() {
  if (committing.value || !preview.value) return
  const filename = commitFilename.value.trim()
  if (!filename) {
    Message.warning('请填写入库文件名')
    return
  }
  if (!preview.value.chunks.length) {
    Message.warning('未解析出有效分块，无法入库')
    return
  }
  const pending = preview.value
  committing.value = true
  operationError.value = ''
  result.value = ''
  try {
    const res = await api.commitDocument(filename, pending.markdown)
    result.value = `已入库「${res.filename}」，共 ${pending.chunks.length} 个分块；当前索引 ${res.chunks} 个分块 / ${res.documents} 个文档。`
    Message.success(`入库成功：${pending.chunks.length} 个分块`)
    previewVisible.value = false
    preview.value = null
    previewError.value = ''
    commitFilename.value = ''
    await loadDocs()
  } catch (err: unknown) {
    const message = errorText(err, '入库失败，请稍后重试')
    operationError.value = message
    Message.error(message)
  } finally {
    committing.value = false
  }
}

async function rebuild() {
  rebuilding.value = true
  result.value = ''
  operationError.value = ''
  try {
    const res = await api.rebuildIndex()
    if (res.status === 'no_docs') {
      result.value = '暂无可索引文档，请先上传文档。'
    } else {
      const documentsPart = typeof res.documents === 'number' ? ` / ${res.documents} 个文档` : ''
      result.value = `索引重建完成，共 ${res.chunks} 个分块${documentsPart}。`
    }
    await loadDocs()
  } catch (err: unknown) {
    operationError.value = errorText(err, '索引重建失败，请稍后重试')
  } finally {
    rebuilding.value = false
  }
}

async function removeDoc(filename: string) {
  operationError.value = ''
  result.value = ''
  try {
    await api.deleteDocument(filename)
    result.value = `已删除「${filename}」，索引已自动重建。`
    Message.success('文档已删除')
    await loadDocs()
  } catch (err: unknown) {
    operationError.value = errorText(err, '删除失败，请稍后重试')
  }
}
</script>
<style scoped>
.knowledge-intro {
  display:flex;
  justify-content:space-between;
  gap:20px;
  align-items:flex-start;
  padding-bottom:20px;
  border-bottom:1px solid #edf1f4;
  margin-bottom:22px
}
.knowledge-intro h3,.section-title h3 {
  margin:0;
  font-size:16px;
  color:#263c4e
}
.knowledge-intro p {
  color:#778897;
  font-size:13px;
  margin:7px 0 0;
  line-height:1.6
}
.knowledge-intro .toolbar {
  margin:0
}
.section-title {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px
}
.doc-count {
  color:#8a99a6;
  font-size:13px;
  font-weight:400
}
.doc-name {
  display:inline-block;
  max-width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  vertical-align:bottom;
  color:#263c4e
}
.time-text {
  white-space:nowrap;
  color:#657789;
  font-size:12px
}
.section-tip {
  margin:12px 0 0;
  color:#82939f;
  font-size:12px;
  line-height:1.6
}
.preview-loading {
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:14px;
  padding:56px 0;
  color:#657789;
  font-size:13px
}
.preview-head {
  padding-bottom:14px;
  border-bottom:1px solid #edf1f4
}
.preview-title {
  font-size:17px;
  font-weight:600;
  color:#203345;
  overflow-wrap:anywhere
}
.preview-meta {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  margin-top:9px
}
.preview-source {
  color:#82939f;
  font-size:12px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width:100%
}
.filename-row {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:10px;
  margin-top:16px
}
.field-label {
  color:#4a6072;
  font-size:13px;
  font-weight:600
}
.field-hint {
  color:#8b9aa7;
  font-size:12px
}
.warning-list {
  margin:4px 0 0;
  padding-left:18px;
  line-height:1.7
}
.chunk-list {
  margin-top:16px
}
.chunk-no {
  color:#8a99a6;
  font-size:12px
}
.chunk-title {
  display:inline-block;
  max-width:160px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  vertical-align:bottom;
  color:#354c5b;
  font-size:13px
}
.chunk-text {
  color:#4d6273;
  font-size:12px;
  line-height:1.6;
  overflow-wrap:anywhere
}
.chunk-empty {
  padding:26px 0
}
.preview-note {
  margin:14px 0 0;
  color:#8b9aa7;
  font-size:12px;
  line-height:1.6
}
@media(max-width:800px) {
  .knowledge-intro {
    display:block
  }
  .knowledge-intro .toolbar {
    margin-top:16px
  }
}
</style>
