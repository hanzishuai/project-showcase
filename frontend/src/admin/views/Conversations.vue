<template>
  <div>
    <div class="page-heading"><h2>对话记录</h2><p>查看历史会话、搜索内容并管理记录。</p></div>
    <section class="surface">
    <a-input-search v-model="searchQuery" placeholder="搜索对话内容..." @search="doSearch" @clear="clearSearch" search-button allow-clear class="search-input" style="width: min(100%, 360px); margin-bottom: 20px" />

    <!-- Loading skeleton -->
    <div v-if="loading" class="skeleton-wrap">
      <a-skeleton v-for="i in 5" :key="i" :animation="true" style="margin-bottom: 12px;">
        <a-skeleton-line :rows="1" :line-height="32" />
      </a-skeleton>
    </div>

    <!-- Error state -->
    <a-result v-else-if="error" status="error" title="加载失败" sub-title="无法获取对话记录，请检查网络后重试">
      <template #extra>
        <a-button type="primary" @click="searchActive ? doSearch() : refresh()">重试</a-button>
      </template>
    </a-result>

    <!-- Empty state -->
    <a-empty v-else-if="sessions.length === 0 && !searchQuery" description="暂无对话记录，等待用户接入" />

    <!-- No search results -->
    <div v-else-if="sessions.length === 0" class="empty-search"><a-empty description="未找到匹配的对话" /><a-button @click="clearSearch">清除搜索</a-button></div>

    <!-- Data table -->
    <div v-else>
    <div class="table-scroll desktop-table"><a-table :columns="columns" :data="sessions" row-key="id" :pagination="searchActive ? false : pagination" @page-change="onPageChange" @page-size-change="onPageSizeChange" @row-click="showDetail">
      <template #user_name="{ record }">
        <span style="font-size:12px;color:#888">{{ record.user_name || record.user_id || '-' }}</span>
      </template>
      <template #preview="{ record }">
        <span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;display:inline-block">{{ record.preview || '-' }}</span>
      </template>
      <template #status="{ record }">
        <a-tag :color="!record.status || record.status === 'normal' ? 'green' : 'gray'" size="small">
          {{ !record.status || record.status === 'normal' ? '正常' : '已中断' }}
        </a-tag>
      </template>
      <template #message_count="{ record }">
        <span>{{ record.message_count || 0 }}</span>
      </template>
      <template #created_at="{ record }"><span class="date-text">{{ (record.created_at || '-').replace('T', ' ') }}</span></template>
      <template #action="{ record }">
        <a-button type="text" @click.stop="showDetail(record)">查看</a-button>
        <a-popconfirm content="确定删除这条对话记录及其消息吗？" @ok="remove(record.id)"><a-button type="text" status="danger" @click.stop>删除</a-button></a-popconfirm>
      </template>
    </a-table></div>
    <div class="mobile-records">
      <article v-for="record in sessions" :key="record.id" class="mobile-record">
        <div class="record-top"><strong>{{ record.user_name || record.user_id || '未知用户' }}</strong><a-tag :color="!record.status || record.status === 'normal' ? 'green' : 'gray'" size="small">{{ !record.status || record.status === 'normal' ? '正常' : '已中断' }}</a-tag></div>
        <p class="record-preview">{{ record.preview || '暂无消息内容' }}</p>
        <div class="record-meta">{{ (record.created_at || '-').replace('T', ' ').slice(0, 19) }} · {{ record.message_count || 0 }} 条消息</div>
        <div class="record-actions"><a-button size="small" @click="showDetail(record)">查看详情</a-button><a-popconfirm content="确定删除这条对话记录及其消息吗？" @ok="remove(record.id)"><a-button type="text" status="danger" size="small">删除</a-button></a-popconfirm></div>
      </article>
      <a-pagination v-if="!searchActive && pagination.total > pagination.pageSize" :current="pagination.current" :page-size="pagination.pageSize" :total="pagination.total" simple @change="onPageChange" />
    </div>
    </div>
    </section>

    <!-- Detail modal -->
    <a-modal v-model:visible="detailVisible" title="对话详情" :width="'min(700px, calc(100vw - 32px))'" :footer="false" :body-style="{ maxHeight: '70vh', overflowY: 'auto' }">
      <a-spin v-if="detailLoading" style="display:flex;justify-content:center;padding:40px" />
      <a-result v-else-if="detailError" status="error" title="加载失败" sub-title="无法获取对话详情"><template #extra><a-button @click="showDetail({ id: detailSessionId })">重试</a-button></template></a-result>
      <template v-else>
        <div v-for="m in messages" :key="m.id" class="msg-row">
          <a-tag :color="m.role === 'user' ? 'blue' : 'green'">{{ m.role === 'user' ? '用户' : '讲解员' }}</a-tag>
          <span class="msg-content">{{ m.content }}</span>
          <a-tag v-if="m.status && m.status !== 'normal'" color="gray">{{ statusLabel(m.status) }}</a-tag>
        </div>
        <a-empty v-if="messages.length === 0" description="该会话暂无消息" />
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { Message } from '@arco-design/web-vue'

const sessions = ref<any[]>([])
const messages = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref(false)
const detailSessionId = ref('')
function statusLabel(status: string) {
  return ({ input_blocked: '已中断', output_blocked: '已中断', blocked: '已中断', interrupted: '已中断' } as Record<string, string>)[status] || '异常'
}
const searchActive = ref(false)
const searchQuery = ref('')
const pagination = ref({ current: 1, pageSize: 20, total: 0, showTotal: true })
const columns = [
  { title: '用户', dataIndex: 'user_name', slotName: 'user_name', width: 100 },
  { title: '首条消息', dataIndex: 'preview', slotName: 'preview', width: 200 },
  { title: '消息数', dataIndex: 'message_count', slotName: 'message_count', width: 70 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 70 },
  { title: '创建时间', dataIndex: 'created_at', slotName: 'created_at', width: 175 },
  { title: '操作', slotName: 'action', width: 130 },
]

onMounted(() => refresh())
async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.listSessions(pagination.value.pageSize, (pagination.value.current - 1) * pagination.value.pageSize)
    sessions.value = res.data || []
    pagination.value.total = res.total || 0
  } catch {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}
function onPageChange(page: number) {
  pagination.value.current = page
  refresh()
}
function onPageSizeChange(size: number) {
  pagination.value.pageSize = size
  pagination.value.current = 1
  refresh()
}
async function showDetail(record: any) {
  detailVisible.value = true
  detailSessionId.value = record.id
  detailLoading.value = true
  detailError.value = false
  messages.value = []
  try {
    const res = await api.getMessages(record.id)
    messages.value = res.data || []
  } catch {
    detailError.value = true
    messages.value = []
  } finally {
    detailLoading.value = false
  }
}
async function remove(id: string) {
  try {
    await api.deleteSession(id)
    Message.success('对话已删除')
    if (searchActive.value) await doSearch()
    else {
      if (sessions.value.length === 1 && pagination.value.current > 1) pagination.value.current--
      await refresh()
    }
  } catch { Message.error('删除失败，请重试') }
}
async function doSearch() {
  const query = searchQuery.value.trim()
  if (!query) return clearSearch()
  searchActive.value = true
  error.value = ''
  loading.value = true
  try {
    const res = await api.searchSessions(query)
    sessions.value = res.data || []
  } catch {
    error.value = '搜索失败'
  } finally {
    loading.value = false
  }
}
function clearSearch() {
  searchQuery.value = ''
  searchActive.value = false
  pagination.value.current = 1
  refresh()
}
</script>

<style scoped>
.skeleton-wrap { padding: 16px 0; }
.mobile-records { display:none; }
@media(max-width:800px) {
  .desktop-table { display:none; }
  .mobile-records { display:flex; flex-direction:column; gap:12px; }
  .mobile-record { border:1px solid #e5ebef; border-radius:10px; padding:14px; background:#fff; }
  .record-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .record-top strong { color:#263d4e; font-size:13px; }
  .record-preview { margin:10px 0 8px; color:#354c5b; font-size:13px; line-height:1.55; overflow-wrap:anywhere; }
  .record-meta { color:#81919e; font-size:11px; }
  .record-actions { display:flex; align-items:center; gap:8px; margin-top:12px; }
}
.empty-search { text-align:center; padding: 14px 0; }
.empty-search .arco-btn { margin-top: 12px; }
.date-text { white-space:nowrap; color:#657789; font-size:12px; }
.msg-row { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; gap: 8px; align-items: flex-start; }
.msg-content { flex:1; word-break: break-word; white-space: pre-wrap; font-size:13px; line-height:1.5; }
</style>
