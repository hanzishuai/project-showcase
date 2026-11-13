<template>
  <div>
    <div class="page-heading"><h2>工作概览</h2><p>查看讲解服务的使用情况和最近对话。</p></div>
    <!-- Loading -->
    <div v-if="loading" style="margin-top: 16px;">
      <a-row :gutter="16">
        <a-col :xs="24" :sm="12" :lg="12" v-for="i in 2" :key="i">
          <a-skeleton :animation="true"><a-skeleton-shape shape="square" style="width:100%;height:100px" /></a-skeleton>
        </a-col>
      </a-row>
      <a-skeleton :animation="true" style="margin-top: 16px;"><a-skeleton-line :rows="5" /></a-skeleton>
    </div>

    <!-- Error -->
    <a-result v-else-if="error" status="error" title="加载失败" sub-title="无法获取系统状态">
      <template #extra>
        <a-button type="primary" @click="loadStats">重试</a-button>
      </template>
    </a-result>

    <!-- Data -->
    <template v-else>
      <!-- Stat cards -->
      <a-row :gutter="16" style="margin-top: 16px;">
        <a-col :xs="24" :sm="12" :lg="12">
          <a-card :bordered="false" class="stat-card stat-sessions">
            <div class="stat-value">{{ stats.total_sessions }}</div>
            <div class="stat-label">会话总数</div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="12">
          <a-card :bordered="false" class="stat-card stat-docs">
            <div class="stat-value">{{ stats.total_documents }}</div>
            <div class="stat-label">知识库文档</div>
          </a-card>
        </a-col>
      </a-row>

      <!-- Recent sessions -->
      <a-card title="最近会话" :bordered="false" class="recent-card" style="margin-top: 20px;">
        <template #extra><a class="view-all" @click="$emit('goto', 'conversations')">查看全部 →</a></template>
        <div class="table-scroll"><a-table v-if="stats.recent_sessions.length" :columns="columns" :data="stats.recent_sessions" row-key="id" :pagination="false" size="small">
          <template #user_name="{ record }">
            <span style="font-size:12px;color:#888">{{ record.user_name || record.user_id || '-' }}</span>
          </template>
          <template #preview="{ record }">
            <span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;display:inline-block">{{ record.preview || '-' }}</span>
          </template>
          <template #created_at="{ record }"><span class="date-text">{{ (record.created_at || '-').replace('T', ' ').slice(0, 19) }}</span></template>
          <template #status="{ record }">
            <a-tag :color="!record.status || record.status === 'normal' ? 'green' : 'gray'" size="small">
              {{ !record.status || record.status === 'normal' ? '正常' : '已中断' }}
            </a-tag>
          </template>
        </a-table>
        <a-empty v-else description="暂无会话记录" /></div>
      </a-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineEmits<{ (e: 'goto', tab: string): void }>()
import { api } from '../api'

const stats = ref({ total_sessions: 0, total_documents: 0, recent_sessions: [] as any[] })
const loading = ref(false)
const error = ref('')

const columns = [
  { title: '用户', dataIndex: 'user_name', slotName: 'user_name', width: 100 },
  { title: '首条消息', dataIndex: 'preview', slotName: 'preview', width: 200 },
  { title: '消息数', dataIndex: 'message_count', width: 70 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 70 },
  { title: '创建时间', dataIndex: 'created_at', slotName: 'created_at', width: 165 },
]

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.getStats()
    stats.value = res
  } catch {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => loadStats())
</script>

<style scoped>
.stat-card { text-align: left; padding: 8px 4px; border: 1px solid #e7edf0; border-radius: 12px; box-shadow: 0 2px 9px rgba(27,47,64,.035); margin-bottom: 16px; min-height: 116px; }
.recent-card { border: 1px solid #e7edf0; border-radius: 12px; }
.view-all { color:#315b73; text-decoration:none; font-size:13px; }
.view-all:hover { text-decoration:underline; }
.date-text { white-space:nowrap; color:#657789; font-size:12px; }
.stat-value { font-size: 30px; font-weight: 700; margin-bottom: 8px; }
.stat-label { font-size: 13px; color: #888; }
.stat-sessions .stat-value { color: #315b73; }
.stat-docs .stat-value { color: #FF7D00; }
</style>
