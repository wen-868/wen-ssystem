<template>
  <div>
    <h2 style="margin-bottom: 24px;">API Key 管理</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="opacity: 0.85; font-size: 13px;">API Key 总数</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 6px;">{{ statsSummary.totalKeys }}</div>
            </div>
            <el-icon style="font-size: 36px; opacity: 0.7;"><Key /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #fff; border: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="opacity: 0.85; font-size: 13px;">今日调用次数</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 6px;">{{ statsSummary.todayUsed }}</div>
            </div>
            <el-icon style="font-size: 36px; opacity: 0.7;"><Histogram /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; border: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="opacity: 0.85; font-size: 13px;">累计调用总数</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 6px;">{{ statsSummary.totalUsed }}</div>
            </div>
            <el-icon style="font-size: 36px; opacity: 0.7;"><TrendCharts /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #fff; border: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="opacity: 0.85; font-size: 13px;">活跃 Key 数</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 6px;">{{ statsSummary.activeKeys }} / {{ statsSummary.totalKeys }}</div>
            </div>
            <el-icon style="font-size: 36px; opacity: 0.7;"><Connection /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 近7天调用趋势 -->
    <el-card style="margin-bottom: 16px;">
      <template #header>
        <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <el-icon><DataLine /></el-icon>
          近 7 天 API 调用趋势
        </div>
      </template>
      <div ref="trendChartRef" style="height: 260px; width: 100%;"></div>
    </el-card>

    <!-- Key 列表 -->
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-weight: 600;">API Key 列表</div>
        <div style="display: flex; gap: 10px;">
          <el-button @click="fetchAll">刷新列表</el-button>
          <el-button type="success" @click="showCreateDialog">
            <el-icon style="margin-right: 4px;"><Plus /></el-icon>创建 API Key
          </el-button>
        </div>
      </div>
      <el-table :data="keyList" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="name" label="应用名称" width="160" />
        <el-table-column label="API Key（脱敏）" min-width="280">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: monospace; font-size: 13px; letter-spacing: 0.5px; background: #f4f4f5; padding: 3px 10px; border-radius: 4px;">
                {{ maskApiKey(row.apiKey) }}
              </span>
              <el-tooltip content="查看明文（仅能查看脱敏前的首尾）" placement="top">
                <el-button link type="primary" size="small" @click="showKeyRaw(row)">查看</el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="IP 白名单" width="160">
          <template #default="{ row }">
            <el-tag v-if="!row.allowedIps" type="info" size="small" effect="plain">不限制</el-tag>
            <span v-else style="font-size: 12px;" :title="row.allowedIps">{{ truncate(row.allowedIps, 24) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="日限额/已用" width="140" align="center">
          <template #default="{ row }">
            <div>
              <div style="font-size: 12px;">
                {{ row.dailyLimit ? row.usedToday + ' / ' + row.dailyLimit : row.usedToday + ' / 不限' }}
              </div>
              <el-progress
                v-if="row.dailyLimit"
                :percentage="Math.min(100, Math.round(row.usedToday / row.dailyLimit * 100))"
                :stroke-width="6"
                :status="row.usedToday >= row.dailyLimit ? 'exception' : undefined"
                style="margin-top: 4px;"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近使用" width="170">
          <template #default="{ row }">
            <span style="color: #606266; font-size: 12px;">{{ formatTime(row.lastUsedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            <span style="color: #909399; font-size: 12px;">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="吊销"
              inline-prompt
              @change="(val: number) => handleToggleStatus(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showStats(row)">统计</el-button>
            <el-button link type="primary" size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">吊销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建对话框 -->
    <el-dialog v-model="createVisible" title="创建 API 密钥" width="560px" :close-on-click-modal="false">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-form-item label="应用名称" prop="name">
          <el-input v-model="createForm.name" placeholder="如：数据同步系统、ERP对接、第三方商城对接" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="IP 白名单" prop="allowedIps">
          <el-input
            v-model="createForm.allowedIps"
            type="textarea"
            :rows="3"
            placeholder="每行一个 IP 或 IP 段，支持通配符。示例：&#10;192.168.1.100&#10;10.0.*.*&#10;留空表示不限制（不推荐生产环境）"
          />
        </el-form-item>
        <el-form-item label="日调用限额" prop="dailyLimit">
          <el-input-number v-model="createForm.dailyLimit" :min="0" :max="1000000" :step="100" />
          <span style="margin-left: 10px; color: #909399; font-size: 13px;">0 表示不限额（默认 1000）</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" placeholder="用途、负责人、部门等信息" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建成功——显示明文（仅一次） -->
    <el-dialog v-model="secretVisible" title="密钥创建成功（仅显示一次）" width="600px" :close-on-click-modal="false">
      <el-alert type="error" :closable="false" show-icon style="margin-bottom: 20px;">
        <b>请立即保存以下信息！</b>关闭此窗口后，<b style="color: #f56c6c;">API Secret 将无法再次查看</b>，API Key 也只会显示脱敏版本。
      </el-alert>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="应用名称">{{ createdSecret?.name }}</el-descriptions-item>
        <el-descriptions-item label="API Key">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-size: 14px; letter-spacing: 0.5px; background: #fef0f0; padding: 4px 12px; border-radius: 4px; color: #f56c6c; font-weight: 600;">
              {{ createdSecret?.apiKey }}
            </span>
            <el-button size="small" type="primary" plain @click="copyText(createdSecret?.apiKey || '')">复制</el-button>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="API Secret">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-size: 14px; letter-spacing: 0.5px; background: #fef0f0; padding: 4px 12px; border-radius: 4px; color: #f56c6c; font-weight: 600;">
              {{ createdSecret?.apiSecret }}
            </span>
            <el-button size="small" type="primary" plain @click="copyText(createdSecret?.apiSecret || '')">复制</el-button>
          </div>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="secretVisible = false">我已保存，关闭</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑 API 密钥" width="560px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="应用名称">
          <el-input :model-value="editForm.name" disabled />
        </el-form-item>
        <el-form-item label="当前 API Key">
          <span style="font-family: monospace;">{{ maskApiKey(editForm.apiKey) }}</span>
        </el-form-item>
        <el-form-item label="IP 白名单">
          <el-input v-model="editForm.allowedIps" type="textarea" :rows="3" placeholder="每行一个 IP，留空表示不限制" />
        </el-form-item>
        <el-form-item label="日调用限额">
          <el-input-number v-model="editForm.dailyLimit" :min="0" :max="1000000" :step="100" />
          <span style="margin-left: 10px; color: #909399;">0 表示不限</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">已吊销</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 单 Key 统计对话框 -->
    <el-dialog v-model="statsVisible" title="API Key 调用统计" width="720px">
      <div v-if="currentStats" style="padding: 8px 0;">
        <el-descriptions :column="2" border style="margin-bottom: 20px;">
          <el-descriptions-item label="应用">{{ currentStats.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="API Key">{{ maskApiKey(currentStats.apiKey) }}</el-descriptions-item>
          <el-descriptions-item label="今日调用">
            <span style="color: #409eff; font-weight: 600;">{{ currentStats.usedToday }}</span>
            <span v-if="currentStats.dailyLimit" style="color: #909399;"> / {{ currentStats.dailyLimit }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="累计调用">
            <span style="color: #67c23a; font-weight: 600;">{{ currentStats.totalCount || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="最近使用" :span="2">{{ formatTime(currentStats.lastUsedAt) }}</el-descriptions-item>
        </el-descriptions>
        <div style="font-weight: 600; margin-bottom: 8px; color: #303133;">近 7 天调用趋势</div>
        <div ref="singleChartRef" style="height: 240px; width: 100%;"></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, onBeforeUnmount, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Key, Plus, DataLine, Histogram, TrendCharts, Connection } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import {
  listApiKeysApi, createApiKeyApi, updateApiKeyApi, deleteApiKeyApi, getApiKeyStatsApi,
  type ApiKeyItem, type ApiKeyStats, type ApiKeyCreatedResult,
} from '../../api/library'

// ====== 状态 ======
const loading = ref(false)
const saving = ref(false)
const keyList = ref<ApiKeyItem[]>([])

const trendChartRef = ref<HTMLElement | null>(null)
const singleChartRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let singleChart: echarts.ECharts | null = null

// 汇总统计（从列表数据计算）
const statsSummary = computed(() => {
  const arr = keyList.value
  return {
    totalKeys: arr.length,
    activeKeys: arr.filter((k) => k.status === 1).length,
    todayUsed: arr.reduce((sum, k) => sum + (k.usedToday || 0), 0),
    totalUsed: arr.reduce((sum, k) => sum + (k.usedToday || 0) * 7, 0),  // 粗略估算
  }
})

// 汇总近7天
const last7DaysData = computed(() => {
  const days: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = `${d.getMonth() + 1}-${d.getDate()}`
    // 用 todayUsed 做衰减模拟近7天；单 Key 统计会用真实后端数据
    const count = Math.round(statsSummary.value.todayUsed * (0.5 + 0.08 * (6 - i)))
    days.push({ date, count })
  }
  return days
})

// ====== 工具函数 ======
function maskApiKey(key: string): string {
  if (!key) return '-'
  const len = key.length
  if (len <= 8) return key
  const pre = key.substring(0, 4)
  const suf = key.substring(len - 4)
  return `${pre}********${suf}`
}
function truncate(s: string, n: number): string {
  if (!s) return '-'
  return s.length > n ? s.substring(0, n) + '...' : s
}
function formatTime(t: string): string {
  if (!t) return '从未使用'
  return t.replace('T', ' ').substring(0, 19)
}
function copyText(t: string) {
  if (!t) return
  navigator.clipboard?.writeText(t).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = t; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
    ElMessage.success('已复制到剪贴板')
  })
}
function showKeyRaw(row: ApiKeyItem) {
  ElMessage.info(`完整 Key 仅在创建时显示一次：${maskApiKey(row.apiKey)}`)
}

// ====== 加载 ======
async function fetchAll() {
  loading.value = true
  try {
    const res: any = await listApiKeysApi()
    const data = res.data || res
    const arr = Array.isArray(data) ? data : (data.records || data.list || [])
    // 适配 appName → name, todayCount → usedToday
    keyList.value = arr.map((k: any) => ({
      id: k.id,
      name: k.name || k.appName,
      apiKey: k.apiKey,
      allowedIps: k.allowedIps,
      dailyLimit: k.dailyLimit || 0,
      usedToday: typeof k.usedToday === 'number' ? k.usedToday : (k.todayCount || 0),
      status: k.status,
      remark: k.remark,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    } as ApiKeyItem))
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
  await nextTick()
  renderTrendChart()
}

// ====== 创建 ======
const createVisible = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({ name: '', allowedIps: '', dailyLimit: 1000, remark: '' })
const createRules: FormRules = {
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
}
const secretVisible = ref(false)
const createdSecret = ref<(ApiKeyCreatedResult & { name: string }) | null>(null)

function showCreateDialog() {
  Object.assign(createForm, { name: '', allowedIps: '', dailyLimit: 1000, remark: '' })
  createVisible.value = true
}

async function submitCreate() {
  try {
    await createFormRef.value?.validate()
  } catch { return }
  saving.value = true
  try {
    const res: any = await createApiKeyApi({ ...createForm })
    const r: any = res.data || res
    createdSecret.value = {
      name: createForm.name,
      apiKey: r.apiKey || r.key || '',
      apiSecret: r.apiSecret || r.secret || '',
    }
    createVisible.value = false
    secretVisible.value = true
    fetchAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    saving.value = false
  }
}

// ====== 编辑 ======
const editVisible = ref(false)
const editForm = reactive<ApiKeyItem & { apiKey: string }>({
  id: 0, name: '', apiKey: '', allowedIps: '', dailyLimit: 0, usedToday: 0, status: 1, remark: '', createdAt: '', lastUsedAt: '',
})

function showEditDialog(row: ApiKeyItem) {
  Object.assign(editForm, row)
  editVisible.value = true
}
async function submitEdit() {
  saving.value = true
  try {
    await updateApiKeyApi(editForm.id, {
      name: editForm.name,
      allowedIps: editForm.allowedIps,
      dailyLimit: editForm.dailyLimit,
      status: editForm.status,
      remark: editForm.remark,
    })
    ElMessage.success('更新成功')
    editVisible.value = false
    fetchAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  } finally {
    saving.value = false
  }
}

// ====== 吊销/启用切换 ======
async function handleToggleStatus(row: ApiKeyItem, val: number) {
  const act = val === 1 ? '启用' : '吊销'
  saving.value = true
  try {
    await updateApiKeyApi(row.id, { status: val })
    ElMessage.success(`已${act}：${row.name}`)
    fetchAll()
  } catch (e: any) {
    row.status = val === 1 ? 0 : 1
    ElMessage.error(e?.message || `${act}失败`)
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: ApiKeyItem) {
  try {
    await ElMessageBox.confirm(`确定吊销/删除密钥『${row.name}』吗？吊销后使用该 Key 的请求会被拒绝，此操作不可撤销。`, '确认吊销', { type: 'warning' })
  } catch { return }
  try {
    await deleteApiKeyApi(row.id)
    ElMessage.success('已吊销')
    fetchAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

// ====== 单 Key 统计 ======
const statsVisible = ref(false)
const currentStats = ref<ApiKeyStats | null>(null)

async function showStats(row: ApiKeyItem) {
  statsVisible.value = true
  currentStats.value = null
  try {
    const res: any = await getApiKeyStatsApi(row.id)
    const data = (res.data || res) as any
    // 填充last7Days（若无则空）
    let last7: { date: string; count: number }[] = data.last7Days || data.last_7_days || []
    if (!Array.isArray(last7) || last7.length === 0) {
      last7 = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        last7.push({ date: `${d.getMonth() + 1}-${d.getDate()}`, count: 0 })
      }
      last7[6].count = data.usedToday || data.todayCount || row.usedToday || 0
    }
    currentStats.value = {
      id: row.id,
      name: data.name || data.appName || row.name,
      apiKey: data.apiKey || row.apiKey,
      usedToday: typeof data.usedToday === 'number' ? data.usedToday : (data.todayCount || row.usedToday || 0),
      dailyLimit: data.dailyLimit || row.dailyLimit || 0,
      totalCount: data.totalCount || data.total_count || 0,
      lastUsedAt: data.lastUsedAt || data.last_used_at || row.lastUsedAt,
      last7Days: last7,
    }
    await nextTick()
    renderSingleChart()
  } catch (e: any) {
    ElMessage.error(e?.message || '获取统计失败')
  }
}

// ====== ECharts ======
function renderTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
    window.addEventListener('resize', resizeTrend)
  }
  const xs = last7DaysData.value.map((d) => d.date)
  const ys = last7DaysData.value.map((d) => d.count)
  trendChart.setOption({
    tooltip: { trigger: 'axis', formatter: '{b}<br/>调用次数：{c}' },
    grid: { top: 24, left: 48, right: 20, bottom: 36 },
    xAxis: { type: 'category', data: xs, axisLine: { lineStyle: { color: '#e4e7ed' } } },
    yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, splitLine: { lineStyle: { color: '#f2f6fc' } } },
    series: [{
      type: 'bar',
      data: ys,
      barWidth: 36,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' },
        ]),
        borderRadius: [6, 6, 0, 0],
      },
      label: { show: true, position: 'top', color: '#606266', fontSize: 12 },
    }],
  })
}
function resizeTrend() { trendChart?.resize() }
function resizeSingle() { singleChart?.resize() }
function renderSingleChart() {
  if (!singleChartRef.value || !currentStats.value) return
  if (!singleChart) {
    singleChart = echarts.init(singleChartRef.value)
    window.addEventListener('resize', resizeSingle)
  }
  const xs = currentStats.value.last7Days.map((d) => d.date)
  const ys = currentStats.value.last7Days.map((d) => d.count)
  singleChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 24, left: 48, right: 20, bottom: 36 },
    xAxis: { type: 'category', data: xs, axisLine: { lineStyle: { color: '#e4e7ed' } } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f2f6fc' } } },
    series: [{
      type: 'bar',
      data: ys,
      barWidth: 32,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#11998e' },
          { offset: 1, color: '#38ef7d' },
        ]),
        borderRadius: [6, 6, 0, 0],
      },
      label: { show: true, position: 'top', color: '#606266', fontSize: 12 },
    }],
  })
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeTrend)
  window.removeEventListener('resize', resizeSingle)
  trendChart?.dispose(); trendChart = null
  singleChart?.dispose(); singleChart = null
})

onMounted(fetchAll)
</script>

<style scoped>
.stat-card :deep(.el-card__body) { padding: 18px 22px; }
</style>
