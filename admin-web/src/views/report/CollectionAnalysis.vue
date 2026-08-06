<template>
  <div class="page">
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="12" align="middle">
        <el-col :span="5">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="refreshAll"
          />
        </el-col>
        <el-col :span="4">
          <el-select v-model="selectedStores" multiple placeholder="选择门店" clearable style="width: 100%" @change="refreshAll">
            <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="selectedChannels" multiple placeholder="选择渠道" clearable style="width: 100%" @change="refreshAll">
            <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-button type="primary" @click="refreshAll">
            <el-icon><Search /></el-icon> 查询
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 收款总览卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-a">
          <div class="stat-label">累计收款总额</div>
          <div class="stat-value">¥{{ formatMoney(overview.totalCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-b">
          <div class="stat-label">本月收款</div>
          <div class="stat-value">¥{{ formatMoney(overview.monthCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-c">
          <div class="stat-label">今日收款</div>
          <div class="stat-value">¥{{ formatMoney(overview.todayCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-d">
          <div class="stat-label">待收金额</div>
          <div class="stat-value">¥{{ formatMoney(overview.pendingAmount) }}</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6" :md="4" :lg="4">
        <div class="stat-card stat-card-e">
          <div class="stat-label">退款率</div>
          <div class="stat-value">{{ overview.refundRate }}%</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6" :md="4" :lg="4">
        <div class="stat-card stat-card-f">
          <div class="stat-label">平均收款周期</div>
          <div class="stat-value">{{ overview.avgCollectionCycle }}天</div>
        </div>
      </el-col>
    </el-row>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
      <!-- Tab 1: 收款漏斗 -->
      <el-tab-pane label="收款漏斗" name="funnel">
        <div ref="funnelChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 2: 收款趋势 -->
      <el-tab-pane label="收款趋势" name="trend">
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="6">
            <el-checkbox v-model="splitByChannel" @change="initTrendChart">按渠道拆分</el-checkbox>
          </el-col>
        </el-row>
        <div ref="collectionTrendRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 3: 渠道分布 -->
      <el-tab-pane label="渠道分布" name="channelDist">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="channelPieRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <el-table :data="channelConversionData" stripe border style="width: 100%">
              <el-table-column prop="channel" label="渠道" width="100" />
              <el-table-column prop="shareCount" label="分享数" width="80" />
              <el-table-column prop="viewCount" label="查看数" width="80" />
              <el-table-column prop="payCount" label="支付数" width="80" />
              <el-table-column prop="payAmount" label="支付金额" width="110">
                <template #default="{ row }">¥{{ formatMoney(row.payAmount) }}</template>
              </el-table-column>
              <el-table-column prop="conversionRate" label="转化率" width="90">
                <template #default="{ row }">{{ row.conversionRate }}%</template>
              </el-table-column>
              <el-table-column prop="ratio" label="占比" width="80">
                <template #default="{ row }">{{ row.ratio }}%</template>
              </el-table-column>
            </el-table>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- Tab 4: 超时未付分析 -->
      <el-tab-pane label="超时未付分析" name="timeout">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="timeoutDistRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <div ref="timeoutTrendRef" class="chart-box chart-medium"></div>
          </el-col>
        </el-row>
        <el-table :data="timeoutOrders" stripe border style="width: 100%; margin-top: 16px">
          <el-table-column prop="billNo" label="订单号" width="180" />
          <el-table-column prop="customerName" label="客户" width="120" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="overdueHours" label="超时(小时)" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="160" />
          <el-table-column label="状态" width="100">
            <template #default>
              <el-tag type="danger" size="small">超时未付</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="timeoutOrders.length > 0"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, prev, pager, next"
          :total="timeoutOrders.length"
          :page-size="10"
          :pager-count="5"
          small
        />
      </el-tab-pane>

      <!-- Tab 5: 退款分析 -->
      <el-tab-pane label="退款分析" name="refund">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="refundTrendRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <div ref="refundReasonPieRef" class="chart-box chart-medium"></div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CHART_COLORS } from "@/styles/theme";
import { Search } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'

// ─── 筛选状态 ───
const dateRange = ref<string[]>(['2026-06-01', '2026-06-30'])
const selectedStores = ref<number[]>([])
const selectedChannels = ref<string[]>([])
const storeOptions = ref(Array.from({ length: 10 }, (_, i) => ({ label: `门店${i + 1}`, value: i + 1 })))
const channelOptions = ref([
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '银行卡', value: 'bank' },
  { label: '现金', value: 'cash' }
])

function formatMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── 收款总览 ───
const overview = ref({
  totalCollection: 2856000,
  monthCollection: 452000,
  todayCollection: 38600,
  pendingAmount: 128000,
  refundRate: 3.2,
  avgCollectionCycle: 7
})

// ─── Tab 1: 收款漏斗 ───
const funnelChartRef = ref<HTMLDivElement | null>(null)
let funnelChart: echarts.ECharts | null = null

const funnelData = ref([
  { name: '分享数', value: 1000 },
  { name: '查看数', value: 780 },
  { name: '支付数', value: 520 },
  { name: '支付成功数', value: 480 }
])

function initFunnelChart() {
  if (!funnelChartRef.value) return
  if (funnelChart) funnelChart.dispose()
  funnelChart = echarts.init(funnelChartRef.value)
  const data = funnelData.value
  funnelChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const rate = p.dataIndex === 0 ? '100%' : ((p.value / funnelData.value[0].value) * 100).toFixed(1) + '%'
        return `${p.name}: ${p.value} (转化率: ${rate})`
      }
    },
    series: [{
      type: 'funnel',
      left: '15%',
      right: '15%',
      top: 30,
      bottom: 30,
      width: '70%',
      minSize: '20%',
      maxSize: '100%',
      gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: (p: any) => {
          const rate = p.dataIndex === 0 ? '100%' : ((p.value / funnelData.value[0].value) * 100).toFixed(1) + '%'
          return `${p.name}\n${p.value} (${rate})`
        },
        fontSize: 12
      },
      data: data.map(d => ({ name: d.name, value: d.value })),
      itemStyle: { borderColor: '#fff', borderWidth: 1 }
    }]
  })
}

// ─── Tab 2: 收款趋势 ───
const collectionTrendRef = ref<HTMLDivElement | null>(null)
let collectionTrendChart: echarts.ECharts | null = null
const splitByChannel = ref(false)

const trendData = ref(
  Array.from({ length: 30 }, (_, i) => ({
    date: `06-${String(i + 1).padStart(2, '0')}`,
    amount: Math.floor(Math.random() * 30000 + 10000),
    count: Math.floor(Math.random() * 20 + 5)
  }))
)

function initTrendChart() {
  if (!collectionTrendRef.value) return
  if (collectionTrendChart) collectionTrendChart.dispose()
  collectionTrendChart = echarts.init(collectionTrendRef.value)

  if (splitByChannel.value) {
    const channels = ['微信', '支付宝', '银行卡', '现金']
    const dates = trendData.value.map(d => d.date)
    const series = channels.map((ch, idx) => ({
      name: ch,
      type: 'line' as const,
      smooth: true,
      data: trendData.value.map(() => Math.floor(Math.random() * 15000 + 3000)),
      itemStyle: { color: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.warning][idx] }
    }))
    collectionTrendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: channels },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
      series
    })
  } else {
    collectionTrendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['收款金额', '收款笔数'] },
      grid: { left: 50, right: 50, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: trendData.value.map(d => d.date), axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
      yAxis: [
        { type: 'value', name: '元', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
        { type: 'value', name: '笔' }
      ],
      series: [
        { name: '收款金额', type: 'line', smooth: true, data: trendData.value.map(d => d.amount), itemStyle: { color: CHART_COLORS.primary } },
        { name: '收款笔数', type: 'line', smooth: true, yAxisIndex: 1, data: trendData.value.map(d => d.count), itemStyle: { color: CHART_COLORS.success } }
      ]
    })
  }
}

// ─── Tab 3: 渠道分布 ───
const channelPieRef = ref<HTMLDivElement | null>(null)
let channelPieChart: echarts.ECharts | null = null

const channelDistribution = ref([
  { method: '微信', amount: 52000, ratio: 41.6 },
  { method: '支付宝', amount: 38000, ratio: 30.4 },
  { method: '银行卡', amount: 12000, ratio: 9.6 },
  { method: '现金', amount: 18000, ratio: 14.4 },
  { method: '其他', amount: 5000, ratio: 4 }
])

const channelConversionData = ref([
  { channel: '微信', shareCount: 400, viewCount: 320, payCount: 240, payAmount: 52000, conversionRate: 60, ratio: 41.6 },
  { channel: '支付宝', shareCount: 300, viewCount: 240, payCount: 180, payAmount: 38000, conversionRate: 60, ratio: 30.4 },
  { channel: '银行卡', shareCount: 150, viewCount: 100, payCount: 60, payAmount: 12000, conversionRate: 40, ratio: 9.6 },
  { channel: '现金', shareCount: 100, viewCount: 80, payCount: 50, payAmount: 18000, conversionRate: 50, ratio: 14.4 },
  { channel: '其他', shareCount: 50, viewCount: 40, payCount: 30, payAmount: 5000, conversionRate: 60, ratio: 4 }
])

function initChannelPieChart() {
  if (!channelPieRef.value) return
  if (channelPieChart) channelPieChart.dispose()
  channelPieChart = echarts.init(channelPieRef.value)
  channelPieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['60%', '50%'],
      data: channelDistribution.value.map(c => ({ name: c.method, value: c.amount })),
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

// ─── Tab 4: 超时未付分析 ───
const timeoutDistRef = ref<HTMLDivElement | null>(null)
const timeoutTrendRef = ref<HTMLDivElement | null>(null)
let timeoutDistChart: echarts.ECharts | null = null
let timeoutTrendChart: echarts.ECharts | null = null

const timeoutOrders = ref(
  Array.from({ length: 15 }, (_, i) => ({
    billNo: `XS20260630${String(i + 1).padStart(3, '0')}`,
    customerName: `客户${i + 1}`,
    amount: Math.floor(Math.random() * 5000 + 500),
    overdueHours: Math.floor(Math.random() * 48 + 2),
    createdAt: `2026-06-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:00:00`
  }))
)

const timeoutDistData = ref([
  { name: '2小时内', value: 25 },
  { name: '2-6小时', value: 40 },
  { name: '6-12小时', value: 20 },
  { name: '12-24小时', value: 10 },
  { name: '24小时以上', value: 5 }
])

function initTimeoutDistChart() {
  if (!timeoutDistRef.value) return
  if (timeoutDistChart) timeoutDistChart.dispose()
  timeoutDistChart = echarts.init(timeoutDistRef.value)
  timeoutDistChart.setOption({
    title: { text: '超时区间分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'middle', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: '65%', center: ['60%', '50%'],
      data: timeoutDistData.value,
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

function initTimeoutTrendChart() {
  if (!timeoutTrendRef.value) return
  if (timeoutTrendChart) timeoutTrendChart.dispose()
  timeoutTrendChart = echarts.init(timeoutTrendRef.value)
  const days = Array.from({ length: 30 }, (_, i) => `06-${String(i + 1).padStart(2, '0')}`)
  const data = days.map(() => Number((Math.random() * 10 + 5).toFixed(1)))
  timeoutTrendChart.setOption({
    title: { text: '超时率趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
    yAxis: { type: 'value', name: '%' },
    series: [{
      type: 'line', smooth: true, data,
      itemStyle: { color: CHART_COLORS.danger },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,87,108,0.3)' }, { offset: 1, color: 'rgba(245,87,108,0.05)' }]) }
    }]
  })
}

// ─── Tab 5: 退款分析 ───
const refundTrendRef = ref<HTMLDivElement | null>(null)
const refundReasonPieRef = ref<HTMLDivElement | null>(null)
let refundTrendChart: echarts.ECharts | null = null
let refundReasonPieChart: echarts.ECharts | null = null

const refundReasonData = ref([
  { name: '商品质量问题', value: 35 },
  { name: '发货延迟', value: 25 },
  { name: '客户取消', value: 20 },
  { name: '价格异议', value: 12 },
  { name: '其他', value: 8 }
])

function initRefundTrendChart() {
  if (!refundTrendRef.value) return
  if (refundTrendChart) refundTrendChart.dispose()
  refundTrendChart = echarts.init(refundTrendRef.value)
  const days = Array.from({ length: 30 }, (_, i) => `06-${String(i + 1).padStart(2, '0')}`)
  refundTrendChart.setOption({
    title: { text: '退款金额/退款率趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['退款金额', '退款率'], bottom: 0 },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
    yAxis: [
      { type: 'value', name: '元', axisLabel: { formatter: (v: number) => (v / 1000).toFixed(0) + 'k' } },
      { type: 'value', name: '%', max: 10 }
    ],
    series: [
      { name: '退款金额', type: 'line', smooth: true, data: days.map(() => Math.floor(Math.random() * 5000 + 1000)), itemStyle: { color: CHART_COLORS.danger } },
      { name: '退款率', type: 'line', smooth: true, yAxisIndex: 1, data: days.map(() => Number((Math.random() * 5 + 2).toFixed(1))), itemStyle: { color: CHART_COLORS.warning } }
    ]
  })
}

function initRefundReasonPieChart() {
  if (!refundReasonPieRef.value) return
  if (refundReasonPieChart) refundReasonPieChart.dispose()
  refundReasonPieChart = echarts.init(refundReasonPieRef.value)
  refundReasonPieChart.setOption({
    title: { text: '退款原因分类', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'middle', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: '65%', center: ['60%', '50%'],
      data: refundReasonData.value,
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

// ─── 图表生命周期管理 ───
const activeTab = ref('funnel')

const tabInits: Record<string, () => void> = {
  funnel: initFunnelChart,
  trend: initTrendChart,
  channelDist: initChannelPieChart,
  timeout: () => { initTimeoutDistChart(); initTimeoutTrendChart() },
  refund: () => { initRefundTrendChart(); initRefundReasonPieChart() }
}

function onTabChange(name: string) {
  const initFn = tabInits[name]
  if (initFn) {
    setTimeout(initFn, 50)
  }
}

const allChartInstances = () => [
  funnelChart, collectionTrendChart,
  channelPieChart, timeoutDistChart, timeoutTrendChart,
  refundTrendChart, refundReasonPieChart
]

function handleResize() {
  allChartInstances().forEach(c => c?.resize())
}

function disposeAllCharts() {
  allChartInstances().forEach(c => c?.dispose())
  funnelChart = null
  collectionTrendChart = null
  channelPieChart = null
  timeoutDistChart = null
  timeoutTrendChart = null
  refundTrendChart = null
  refundReasonPieChart = null
}

function refreshAll() {
  onTabChange(activeTab.value)
}

onMounted(() => {
  initFunnelChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})
</script>

<style scoped>
.page {
  padding: 20px;
}

.filter-card {
  margin-bottom: 16px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  color: var(--text-inverse);
  margin-bottom: 16px;
}

.stat-card-a { background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-5) 100%); }
.stat-card-b { background: linear-gradient(135deg, var(--color-success) 0%, rgba(14,168,121,0.4) 100%); }
.stat-card-c { background: linear-gradient(135deg, var(--chart-5) 0%, var(--color-danger) 100%); }
.stat-card-d { background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-6) 100%); }
.stat-card-e { background: linear-gradient(135deg, var(--color-danger) 0%, var(--color-warning) 100%); }
.stat-card-f { background: linear-gradient(135deg, var(--chart-5) 0%, rgba(139,92,246,0.35) 100%); }

.stat-label {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
}

.chart-box {
  width: 100%;
}

.chart-tall {
  height: 400px;
}

.chart-medium {
  height: 320px;
}
</style>