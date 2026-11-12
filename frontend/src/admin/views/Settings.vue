<template>
  <div>
    <div class="page-heading">
      <h2>系统设置</h2>
      <p>模型、语音与检索参数。保存后立即生效，不需要重启服务。</p>
    </div>

    <a-spin :loading="loading" style="display:block">
      <section v-for="group in groups" :key="group.name" class="surface" style="margin-bottom:16px">
        <h3 class="group-title">{{ group.name }}</h3>
        <div class="field-grid">
          <label v-for="item in group.items" :key="item.key" class="field">
            <span class="field-label">
              {{ item.label }}
              <a-tag v-if="item.overridden" size="small" color="green">已改</a-tag>
            </span>

            <a-select
              v-if="item.type === 'select'"
              v-model="draft[item.key]"
              :style="{ width: '100%' }"
              allow-create
              allow-search
            >
              <a-option v-for="option in item.options" :key="option" :value="option">{{ option }}</a-option>
            </a-select>

            <a-input-password
              v-else-if="item.type === 'password'"
              v-model="draft[item.key]"
              :placeholder="item.configured ? '已配置（留空表示不修改）' : '未配置'"
              allow-clear
            />

            <a-input v-else v-model="draft[item.key]" :placeholder="item.hint" />

            <span class="field-hint">{{ item.hint }}</span>
          </label>
        </div>
      </section>

      <div class="actions">
        <a-space>
          <a-button type="primary" :loading="saving" @click="save">保存设置</a-button>
          <a-button :loading="testing === 'llm'" @click="test('llm')">测试语言模型</a-button>
          <a-button :loading="testing === 'tts'" @click="test('tts')">测试语音合成</a-button>
          <a-button @click="load">重新读取</a-button>
        </a-space>
        <p class="note">{{ note }}</p>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'

interface SettingItem {
  key: string
  group: string
  label: string
  type: string
  secret: boolean
  options: string[]
  hint: string
  value: string
  configured: boolean
  overridden: boolean
}

interface SettingGroup {
  name: string
  items: SettingItem[]
}

const groups = ref<SettingGroup[]>([])
const draft = ref<Record<string, string>>({})
const loading = ref(false)
const saving = ref(false)
const testing = ref('')
const note = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const response = await fetch('/api/admin/settings')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const data = await response.json()
    groups.value = Array.isArray(data.groups) ? data.groups : []
    note.value = data.note || ''
    const next: Record<string, string> = {}
    for (const group of groups.value) {
      for (const item of group.items) next[item.key] = item.secret ? '' : item.value
    }
    draft.value = next
  } catch (error) {
    Message.error('读取设置失败：' + String(error))
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  const values: Record<string, string> = {}
  for (const group of groups.value) {
    for (const item of group.items) {
      const next = draft.value[item.key]
      if (next === undefined) continue
      const trimmed = String(next).trim()
      if (item.secret && trimmed === '') continue // 密钥留空 = 不修改
      if (!item.secret && trimmed === item.value) continue
      if (item.secret && trimmed === item.value) continue
      values[item.key] = trimmed
    }
  }
  if (Object.keys(values).length === 0) {
    Message.info('没有需要保存的改动')
    return
  }
  saving.value = true
  try {
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || 'HTTP ' + response.status)
    Message.success('已保存并生效：' + (data.applied || []).length + ' 项')
    await load()
  } catch (error) {
    Message.error('保存失败：' + String(error))
  } finally {
    saving.value = false
  }
}

async function test(target: 'llm' | 'tts'): Promise<void> {
  testing.value = target
  try {
    const response = await fetch('/api/admin/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    })
    const data = await response.json().catch(() => ({}))
    const message = String(data.message || (response.ok ? '成功' : '失败'))
    if (data.ok) Message.success(message + '（' + (data.ms ?? 0) + 'ms）')
    else Message.error(message)
  } catch (error) {
    Message.error('测试失败：' + String(error))
  } finally {
    testing.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.group-title {
  font-size: 15px;
  font-weight: 600;
  color: #203345;
  margin: 0 0 16px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px 24px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 13px;
  color: #52606d;
  display: flex;
  align-items: center;
  gap: 8px;
}
.field-hint {
  font-size: 12px;
  color: #90a0ad;
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.note {
  margin: 0;
  font-size: 12px;
  color: #8a99a6;
}
</style>
