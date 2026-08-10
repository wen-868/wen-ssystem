<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">订单同步</h2>
      <p class="page-desc">渠道订单同步状态</p>
    </div>
  </div>
<!-- 同步统计区 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="4">
        <el-card shadow="never">
          <el-statistic title="今日同步总数" :value="syncStats.totalSync" />
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <el-statistic title="成功数" :value="syncStats.successCount">
            <template #suffix>
              <el-tag type="success" size="small">成功</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <el-statistic title="失败数" :value="syncStats.failCount">
            <template #suffix>
              <el-tag type="danger" size="small">失败</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never">
          <el-statistic title="待同步数" :value="syncStats.pendingCount">
            <template #suffix>
              <el-tag type="warning" size="small">待同步</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div ref="channelSuccessChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作区 -->
    <el-card shadow="never" class="action-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="14">
          <el-button-group>
            <el-button type="primary" @click="handleSingleSync">单订单同步</el-button>
            <el-button type="success" @click="handleBatchSync">批量同步选中</el-button>
            <el-button type="warning" @click="handleFullSync">全量同步全部渠道</el-button>
          </el-button-group>
        </el-col>
        <el-col :span="10">
          <div v-if="syncProgress > 0 && syncProgress < 100" class="sync-progress">
            <span class="progress-label">同步进度</span>
            <el-progress :percentage="syncProgress" :stroke-width="16" :text-inside="true" style="flex: 1; margin-left: 12px" />
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 同步日志表格 -->
    <el-card shadow="never" class="table-card">
      <!-- 筛选栏 -->
      <el-row :gutter="12" align="middle" class="filter-row">
        <el-col :span="3">
          <el-select v-model="logFilterChannel" placeholder="渠道" clearable style="width: 100%">
            <el-option v-for="ch in channelOptions" :key="ch.value" :label="ch.label" :value="ch.value" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="logFilterType" placeholder="类型" clearable style="width: 100%">
            <el-option label="PULL" value="PULL" />
            <el-option label="PUSH" value="PUSH" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="logFilterResult" placeholder="结果" clearable style="width: 100%">
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAILED" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-date-picker
            v-model="logFilterDate"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="4">
          <el-input v-model="logFilterKeyword" placeholder="搜索订单号" clearable style="width: 100%" />
        </el-col>
        <el-col :span="3">
          <el-button type="primary" @click="handleLogFilter">查询</el-button>
        </el-col>
      </el-row>

      <div class="table-card">
<el-table :data="filteredSyncLogs" stripe border style="width: 100%; margin-top: 12px">
        <el-table-column prop="channelOrderNo" label="订单号" width="150" />
        <el-table-column label="渠道" width="80">
          <template #default="{ row }">
            <el-tag :color="channelColors[row.channelType] || 'var(--color-primary)'" style="color: #fff; border: none" size="small">
              {{ channelNames[row.channelType] || row.channelType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.syncType === 'PULL' ? '' : 'success'" size="small">
              {{ row.syncType === 'PULL' ? 'PULL' : 'PUSH' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态变更" width="180">
          <template #default="{ row }">
            <span class="status-from">{{ row.fromStatus }}</span>
            <span class="status-arrow">→</span>
            <span class="status-to">{{ row.toStatus }}</span>
          </template>
        </el-table-column>
        <el-table-column label="同步结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.syncResult === 'SUCCESS' ? 'success' : 'danger'" size="small">
              {{ row.syncResult === 'SUCCESS' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="160">
          <template #default="{ row }">
            <template v-if="row.errorMessage">
              <el-tooltip :content="row.errorMessage" placement="top">
                <span class="error-text">{{ row.errorMessage }}</span>
              </el-tooltip>
              <el-popover placement="top" :width="300" trigger="click">
                <template #reference>
                  <el-button size="small" link type="primary" style="margin-left: 4px">详情</el-button>
                </template>
                <div>
                  <p><strong>错误详情</strong></p>
                  <p style="color: var(--text-muted); font-size: 13px">{{ row.errorMessage }} - 接口返回超时，请检查网络连接或稍后重试</p>
                </div>
              </el-popover>
            </template>
            <span v-else style="color: var(--text-muted)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="syncedAt" label="同步时间" width="160" />
      </el-table>
</div>
      <el-pagination
        style="margin-top: 16px; justify-content: flex-end"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="filteredLogCount"
        v-model:page-size="logPageSize"
        v-model:current-page="logPage"
        :page-sizes="[10, 20, 50]"
        :pager-count="5"
      />
    </el-card>

    <!-- 定时任务配置 -->
    <el-card shadow="never" class="config-card">
      <template #header>
        <div class="card-header">
          <span>定时任务配置</span>
          <el-button size="small" @click="handleSaveConfig">保存配置</el-button>
        </div>
      </template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="同步频率">
          <el-select v-model="syncConfig.frequency" size="small" style="width: 150px">
            <el-option label="每5分钟" value="5min" />
            <el-option label="每10分钟" value="10min" />
            <el-option label="每30分钟" value="30min" />
            <el-option label="每小时" value="1hour" />
          </el-select>
        </el-descriptions-item>
        <el-descriptions-item label="同步范围">
          <el-select v-model="syncConfig.scope" size="small" style="width: 150px">
            <el-option label="全部渠道" value="ALL" />
            <el-option label="仅微信" value="WECHAT" />
            <el-option label="仅美团" value="MEITUAN" />
            <el-option label="仅饿了么" value="ELEME" />
          </el-select>
        </el-descriptions-item>
        <el-descriptions-item label="同步开关">
          <el-switch v-model="syncConfig.enabled" size="small" />
        </el-descriptions-item>
        <el-descriptions-item label="失败告警开关">
          <el-switch v-model="syncConfig.alertOnFail" size="small" />
        </el-descriptions-item>
        <el-descriptions-item label="告警方式">
          <el-select v-model="syncConfig.alertMethod" size="small" style="width: 150px" :disabled="!syncConfig.alertOnFail">
            <el-option label="短信通知" value="SMS" />
            <el-option label="邮件通知" value="EMAIL" />
            <el-option label="短信+邮件" value="BOTH" />
          </el-select>
        </el-descriptions-item>
        <el-descriptions-item label="下次执行时间">
          <span style="color: var(--color-primary)">{{ nextExecutionTime }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import echarts from '@/utils/echarts'
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from 'element-plus'
import { fetchInstantRetailSyncStats, fetchInstantRetailSyncLogs } from '../../api'

// ─── Mock 数据 ───
const channelNames: Record<string, string> = { WECHAT: '微信', DOUYIN: '抖音', MEITUAN: '美团', ELEME: '饿了么', JD: '京东', OFFLINE: '线下' }
const channelColors: Record<string, string> = { WECHAT: 'var(--color-success)', DOUYIN: 'var(--text-primary)', MEITUAN: 'var(--color-warning)', ELEME: 'var(--color-primary)', JD: 'var(--color-danger)', OFFLINE: 'var(--gray-500)' }

const syncStats = ref({ totalSync: 0, successCount: 0, failCount: 0, pendingCount: 0 })

const channelSuccessData = computed(() => {
  const agg: Record<string, { total: number; success: number }> = {}
  for (const l of syncLogs.value) {
    if (!agg[l.channelType]) agg[l.channelType] = { total: 0, success: 0 }
    agg[l.channelType].total += 1
    if (l.syncResult === 'SUCCESS') agg[l.channelType].success += 1
  }
  return Object.keys(agg).map((ch) => ({
    channel: ch,
    name: channelNames[ch] || ch,
    rate: agg[ch].total ? Number(((agg[ch].success / agg[ch].total) * 100).toFixed(1)) : 0,
  }))
})

const syncLogs = ref<any[]>([])

function handleLogFilter() {
  logPage.value = 1
  ElMessage.success('筛选完成')
}

// ─── 同步操作（触发后端同步 + 进度展示） ───
const syncProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null

function runSyncWithProgress(action: string) {
  ElMessage.success(`${action}已触发`)
  syncProgress.value = 0
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    syncProgress.value = Math.min(syncProgress.value + 10, 100)
    if (syncProgress.value >= 100) {
      if (progressTimer) clearInterval(progressTimer)
      progressTimer = null
      ElMessage.success('同步完成')
      loadSyncData()
    }
  }, 400)
}

function handleSingleSync() {
  runSyncWithProgress('单订单同步')
}

function handleBatchSync() {
  runSyncWithProgress('批量同步')
}

function handleFullSync() {
  runSyncWithProgress('全量同步')
}

// ─── 日志筛选与分页 ───
const logFilterChannel = ref('')
const logFilterType = ref('')
const logFilterResult = ref('')
const logFilterDate = ref<[string, string] | null>(null)
const logFilterKeyword = ref('')
const logPage = ref(1)
const logPageSize = ref(10)

const channelOptions = computed(() =>
  Object.keys(channelNames).map((ch) => ({ value: ch, label: channelNames[ch] }))
)

const filteredLogCount = computed(() => filterSyncLogs().length)

const filteredSyncLogs = computed(() => {
  const list = filterSyncLogs()
  const start = (logPage.value - 1) * logPageSize.value
  return list.slice(start, start + logPageSize.value)
})

function filterSyncLogs() {
  let list = syncLogs.value
  if (logFilterChannel.value) list = list.filter((l) => l.channelType === logFilterChannel.value)
  if (logFilterType.value) list = list.filter((l) => l.syncType === logFilterType.value)
  if (logFilterResult.value) list = list.filter((l) => l.syncResult === logFilterResult.value)
  if (logFilterKeyword.value) {
    const kw = logFilterKeyword.value.toLowerCase()
    list = list.filter((l) => String(l.channelOrderNo || '').toLowerCase().includes(kw))
  }
  if (logFilterDate.value && logFilterDate.value[0]) {
    const start = logFilterDate.value[0]
    const end = logFilterDate.value[1]
    list = list.filter((l) => {
      const d = String(l.syncedAt || '').slice(0, 10)
      return d >= start && d <= end
    })
  }
  return list
}

// ─── 定时任务配置 ───
const syncConfig = ref({
  frequency: '10min',
  scope: 'ALL',
  enabled: true,
  alertOnFail: false,
  alertMethod: 'EMAIL',
})

const nextExecutionTime = computed(() => {
  if (!syncConfig.value.enabled) return '已暂停'
  const map: Record<string, string> = { '5min': '2026-07-01 14:05:00', '10min': '2026-07-01 14:10:00', '30min': '2026-07-01 14:30:00', '1hour': '2026-07-01 15:00:00' }
  return map[syncConfig.value.frequency] || '2026-07-01 14:05:00'
})

function handleSaveConfig() {
  ElMessage.success('同步配置保存成功')
}

// ─── 渠道同步成功率柱状图 ───
const channelSuccessChartRef = ref<HTMLDivElement | null>(null)
let channelSuccessChart: echarts.ECharts | null = null

function initChannelSuccessChart() {
  if (!channelSuccessChartRef.value) return
  if (channelSuccessChart) channelSuccessChart.dispose()
  channelSuccessChart = echarts.init(channelSuccessChartRef.value)
  channelSuccessChart.setOption({
    title: { text: '各渠道同步成功率', left: 'center', top: 0, textStyle: { fontSize: 13, fontWeight: 'normal' } },
    tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
    grid: { left: 50, right: 40, top: 30, bottom: 20 },
    xAxis: { type: 'category', data: channelSuccessData.value.map(d => d.name), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', min: 80, max: 100, axisLabel: { formatter: '{value}%', fontSize: 10 } },
    series: [{
      type: 'bar',
      data: channelSuccessData.value.map(d => d.rate),
      barWidth: 24,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: CHART_COLORS.success },
          { offset: 1, color: 'rgba(14,168,121,0.4)' }
        ])
      },
      label: { show: true, position: 'top', formatter: '{c}%', fontSize: 10 }
    }]
  })
}

// ─── 图表生命周期 ───
function handleResize() {
  channelSuccessChart?.resize()
}

function disposeAllCharts() {
  channelSuccessChart?.dispose()
  channelSuccessChart = null
}

async function loadSyncData() {
  try {
    const [stats, logs] = await Promise.all([
      fetchInstantRetailSyncStats(),
      fetchInstantRetailSyncLogs({ page: 1, pageSize: 200 }),
    ])
    syncStats.value = { totalSync: stats?.totalSync ?? 0, successCount: stats?.successCount ?? 0, failCount: stats?.failCount ?? 0, pendingCount: stats?.pendingCount ?? 0 }
    syncLogs.value = logs?.records || []
  } catch (e: any) {
    ElMessage.warning(e?.response?.data?.msg || '加载同步数据失败')
  }
  initChannelSuccessChart()
}

onMounted(() => {
  loadSyncData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
  if (progressTimer) clearInterval(progressTimer)
})
</script>

<style scoped>
.page {
  padding: 20px;
}

.stats-row {
  margin-bottom: 16px;
}

.stats-row .el-card {
  text-align: center;
}

.chart-box {
  width: 100%;
  height: 180px;
}

.action-card {
  margin-bottom: 16px;
}

.sync-progress {
  display: flex;
  align-items: center;
}

.progress-label {
  font-size: 13px;
  color: var(--gray-600);
  white-space: nowrap;
}

.table-card {
  margin-bottom: 16px;
}

.filter-row {
  margin-bottom: 0;
}

.status-from {
  color: var(--color-warning);
  font-weight: 500;
}

.status-arrow {
  margin: 0 8px;
  color: var(--gray-400);
  font-weight: bold;
}

.status-to {
  color: var(--color-success);
  font-weight: 500;
}

.error-text {
  color: var(--color-danger);
  font-size: 13px;
  cursor: pointer;
}

.config-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
