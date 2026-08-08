<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">客户分析</h2>
        <p class="page-desc">客户贡献、复购、RFM 与流失预警分析</p>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
      />
      <el-select v-model="selectedStore" placeholder="选择门店" clearable>
        <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-button type="primary" @click="refreshAll">
        <el-icon><Search /></el-icon>&nbsp;查询
      </el-button>
      <el-button @click="refreshAll">
        <el-icon><Refresh /></el-icon>&nbsp;刷新
      </el-button>
      <div class="filter-bar-spacer" />
    </div>

    <!-- 客户概览卡片 -->
    <div class="stat-grid">
      <div v-for="card in overviewCards" :key="card.label" class="stat-grid-card">
        <div class="stat-grid-value stat-grid-value--primary">{{ card.value }}</div>
        <div class="stat-grid-label">{{ card.label }}</div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- 客户贡献排行 -->
      <el-tab-pane label="客户贡献排行" name="customerContribution">
        <div ref="customerContributionChartRef" class="chart-box chart-medium"></div>
        <div class="table-card chart-table">
          <el-table :data="customerContribution" stripe style="width:100%">
            <el-table-column type="index" label="排名" width="60" align="center" />
            <el-table-column prop="customerName" label="客户名称" min-width="140" />
            <el-table-column label="累计消费" width="120" align="right">
              <template #default="{ row }"><span class="amount-text">{{ formatYuan(row.totalAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
            <el-table-column label="客单价" width="110" align="right">
              <template #default="{ row }"><span class="amount-text">{{ formatYuan(row.avgOrderValue) }}</span></template>
            </el-table-column>
            <el-table-column prop="lastOrderDate" label="最近消费" width="120" align="center" />
            <template #empty>
              <el-empty description="暂无客户贡献数据" :image-size="80" />
            </template>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 复购率趋势 -->
      <el-tab-pane label="复购率趋势" name="repurchaseTrend">
        <div ref="repurchaseTrendChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- 客单价分布 -->
      <el-tab-pane label="客单价分布" name="avgOrderValue">
        <el-row :gutter="16">
          <el-col :span="14"><div ref="aoDistributionChartRef" class="chart-box chart-medium"></div></el-col>
          <el-col :span="10">
            <div class="table-card">
              <el-table :data="avgOrderValueDistribution" stripe size="small">
                <el-table-column prop="label" label="客单价区间" width="120" />
                <el-table-column prop="customerCount" label="客户数" width="90" align="right" />
                <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
                <template #empty>
                  <el-empty description="暂无客单价分布数据" :image-size="60" />
                </template>
              </el-table>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- RFM分析 -->
      <el-tab-pane label="RFM分析" name="rfm">
        <el-row :gutter="12" style="margin-bottom:12px">
          <el-col :span="4">
            <el-radio-group v-model="rfmScatterType" size="small" @change="initRFMScatterChart">
              <el-radio-button value="rf">R-F</el-radio-button>
              <el-radio-button value="fm">F-M</el-radio-button>
            </el-radio-group>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="14"><div ref="rfmScatterChartRef" class="chart-box chart-medium"></div></el-col>
          <el-col :span="10">
            <div class="table-card">
              <el-table :data="rfm.segments" stripe size="small" max-height="350" @row-click="onRFMGroupClick">
                <el-table-column prop="group" label="分群名称" min-width="120" />
                <el-table-column prop="customerCount" label="客户数" width="80" align="right" />
                <el-table-column label="销售额" width="110" align="right">
                  <template #default="{ row }"><span class="amount-text">{{ formatYuan(row.totalAmount) }}</span></template>
                </el-table-column>
                <el-table-column label="占比" width="80" align="center">
                  <template #default="{ row }">{{ row.ratio }}%</template>
                </el-table-column>
                <template #empty>
                  <el-empty description="暂无 RFM 分群数据" :image-size="60" />
                </template>
              </el-table>
            </div>
          </el-col>
        </el-row>
        <!-- 客户明细弹窗 -->
        <el-dialog v-model="rfmDetailVisible" title="客户明细" width="720px">
          <el-table :data="rfmDetailCustomers" stripe size="small">
            <el-table-column prop="customerName" label="客户名称" />
            <el-table-column prop="r" label="R值" width="80" align="center" />
            <el-table-column prop="f" label="F值" width="80" align="center" />
            <el-table-column prop="m" label="M值" width="80" align="center" />
          </el-table>
        </el-dialog>
      </el-tab-pane>

      <!-- 新增客户趋势 -->
      <el-tab-pane label="新增客户趋势" name="newCustomerTrend">
        <div ref="newCustomerTrendChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- 流失客户预警 -->
      <el-tab-pane label="流失客户预警" name="lostCustomer">
        <div ref="lostCustomerTrendChartRef" class="chart-box chart-medium"></div>
        <div class="table-card chart-table">
          <el-table :data="lostCustomer.list" stripe style="width:100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="customerName" label="客户名称" min-width="140" />
            <el-table-column prop="lastOrderDate" label="最后消费日期" width="130" align="center" />
            <el-table-column label="未消费天数" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="row.daysSinceLastOrder > 120 ? 'danger' : row.daysSinceLastOrder > 100 ? 'warning' : 'info'" size="small">
                  {{ row.daysSinceLastOrder }}天
                </el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无流失客户数据" :image-size="80" />
            </template>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { CHART_COLORS } from '@/styles/theme'
import { formatYuan } from '../../utils/format'
import {
  fetchReportCustomerRepurchase,
  fetchReportAvgOrderValueDistribution,
  fetchReportRFMAnalysis,
  fetchReportCustomerContributionRanking,
  fetchReportNewCustomerTrend,
  fetchReportLostCustomer,
  fetchStores,
  fetchMembers,
} from '@/api'

// ─── 筛选状态 ───
function defaultDateRange(): string[] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [fmt(first), fmt(now)]
}

const dateRange = ref<string[]>(defaultDateRange())
const selectedStore = ref<number | undefined>(undefined)
const storeOptions = ref<Array<{ id: number; name: string }>>([])

// ─── 数据引用（初始空态，禁止编造数字） ───
const customerContribution = ref<Array<{
  customerName: string
  totalAmount: number
  orderCount: number
  avgOrderValue: number
  lastOrderDate: string
}>>([])
const repurchaseTrend = ref<Array<{ month: string; rate: number }>>([])
const avgOrderValueDistribution = ref<Array<{ label: string; customerCount: number; orderCount: number }>>([])
const rfm = ref<{ segments: any[]; customers: any[] }>({ segments: [], customers: [] })
const newCustomerTrend = ref<Array<{ month: string; count: number }>>([])
const lostCustomer = ref<{ list: any[]; trend: any[] }>({ list: [], trend: [] })

// ─── 概览卡片（真实接口数据组装） ───
const overview = ref({ totalCount: 0, newCount: 0, activeCount: 0, lostCount: 0, repurchaseRate: 0 })
const overviewCards = computed(() => [
  { label: '客户总数', value: overview.value.totalCount, gradient: 'gradient-primary' },
  { label: '本月新增', value: overview.value.newCount, gradient: 'gradient-success' },
  { label: '活跃客户数', value: overview.value.activeCount, gradient: 'gradient-warning' },
  { label: '流失客户数', value: overview.value.lostCount, gradient: 'gradient-danger' },
  { label: '复购率', value: overview.value.repurchaseRate + '%', gradient: 'gradient-info' }
])

// ─── 门店加载（真实门店接口） ───
async function loadStores() {
  try {
    const data = await fetchStores()
    const list = data?.records || data || []
    storeOptions.value = list.map((s: any) => ({ id: Number(s.id), name: s.name }))
  } catch {
    storeOptions.value = []
  }
}

// ─── 数据加载（admin-report 客户维度真实接口） ───
async function loadData() {
  const [startDate, endDate] = dateRange.value
  const storeId = selectedStore.value
  const dateParams = { startDate, endDate, storeId }

  try {
    const [repurchase, avgOrderValue, rfmRes, contribution, newTrend, lostRes, members] = await Promise.all([
      fetchReportCustomerRepurchase(dateParams),
      fetchReportAvgOrderValueDistribution(dateParams),
      fetchReportRFMAnalysis({ storeId }),
      fetchReportCustomerContributionRanking({ ...dateParams, limit: 20 }),
      fetchReportNewCustomerTrend({ groupBy: 'month', storeId }),
      fetchReportLostCustomer({ daysThreshold: 90, storeId }),
      fetchMembers({ page: 1, pageSize: 1 }).catch(() => null),
    ])

    // 概览卡片
    overview.value.totalCount = Number(members?.total ?? 0)
    overview.value.activeCount = Number(repurchase?.totalCustomerCount ?? 0)
    overview.value.repurchaseRate = Number(repurchase?.repurchaseRate ?? 0)
    overview.value.lostCount = Number(lostRes?.lostCustomerCount ?? 0)
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const trendRows = Array.isArray(newTrend) ? newTrend : []
    const thisMonth = trendRows.find((r: any) => String(r.period).startsWith(currentMonth))
    overview.value.newCount = Number(thisMonth?.newCustomerCount ?? 0)
    newCustomerTrend.value = trendRows.map((r: any) => ({ month: String(r.period), count: Number(r.newCustomerCount) }))

    // 客户贡献排行（后端未返回最近消费日期，该列按空态显示）
    customerContribution.value = (Array.isArray(contribution) ? contribution : []).map((c: any) => ({
      customerName: c.customerName || `客户${c.customerId ?? ''}`,
      totalAmount: Number(c.totalAmount ?? 0),
      orderCount: Number(c.orderCount ?? 0),
      avgOrderValue: Number(c.avgOrderValue ?? 0),
      lastOrderDate: '-'
    }))

    // 复购率趋势（按月，rate 由真实总客户数/复购客户数计算）
    const repurchaseTrendRows = Array.isArray(repurchase?.trend) ? repurchase.trend : []
    repurchaseTrend.value = repurchaseTrendRows.map((t: any) => ({
      month: String(t.month),
      rate: Number(t.totalCustomers) > 0 ? Math.round((Number(t.repurchaseCustomers) / Number(t.totalCustomers)) * 10000) / 100 : 0
    }))

    // 客单价分布
    avgOrderValueDistribution.value = Array.isArray(avgOrderValue?.distribution)
      ? avgOrderValue.distribution.map((d: any) => ({
        label: d.label,
        customerCount: Number(d.customerCount ?? 0),
        orderCount: Number(d.orderCount ?? 0)
      }))
      : []

    // RFM 分析（销售额 = 组均消费额 × 客户数，占比 = 组客户数 / 总客户数）
    const rfmGroups = Array.isArray(rfmRes?.groups) ? rfmRes.groups : []
    const rfmTotal = Number(rfmRes?.totalCustomers ?? 0)
    rfm.value = {
      segments: rfmGroups.map((g: any) => ({
        group: g.rfmGroup,
        customerCount: Number(g.customerCount ?? 0),
        totalAmount: Math.round(Number(g.avgMonetary ?? 0) * Number(g.customerCount ?? 0)),
        ratio: rfmTotal > 0 ? Math.round((Number(g.customerCount) / rfmTotal) * 1000) / 10 : 0
      })),
      customers: Array.isArray(rfmRes?.customers) ? rfmRes.customers : []
    }

    // 流失客户预警（后端无趋势数据，图表按空态显示）
    const lostList = Array.isArray(lostRes?.customers) ? lostRes.customers : []
    lostCustomer.value = {
      trend: [],
      list: lostList.map((c: any) => ({
        customerName: c.customerName || `客户${c.customerId ?? ''}`,
        lastOrderDate: c.lastOrderDate ? String(c.lastOrderDate).slice(0, 10) : '-',
        daysSinceLastOrder: Number(c.daysSinceLastOrder ?? 0)
      }))
    }

    onTabChange(activeTab.value)
  } catch {
    // 接口失败时保持空态，不编造数据
    customerContribution.value = []
    repurchaseTrend.value = []
    avgOrderValueDistribution.value = []
    rfm.value = { segments: [], customers: [] }
    newCustomerTrend.value = []
    lostCustomer.value = { list: [], trend: [] }
    overview.value = { totalCount: 0, newCount: 0, activeCount: 0, lostCount: 0, repurchaseRate: 0 }
  }
}

// ─── Tab 状态 ───
const activeTab = ref('customerContribution')
const rfmScatterType = ref('rf')
const rfmDetailVisible = ref(false)
const rfmDetailCustomers = ref<any[]>([])

function onRFMGroupClick(row: any) {
  rfmDetailCustomers.value = rfm.value.customers
    .filter(c => c.rfmGroup === row.group)
    .map(c => ({
      customerName: c.customerName || '客户',
      r: c.rScore,
      f: c.fScore,
      m: c.mScore
    }))
  rfmDetailVisible.value = true
}

// ─── 图表 refs ───
const customerContributionChartRef = ref<HTMLDivElement | null>(null)
const repurchaseTrendChartRef = ref<HTMLDivElement | null>(null)
const aoDistributionChartRef = ref<HTMLDivElement | null>(null)
const rfmScatterChartRef = ref<HTMLDivElement | null>(null)
const newCustomerTrendChartRef = ref<HTMLDivElement | null>(null)
const lostCustomerTrendChartRef = ref<HTMLDivElement | null>(null)

// ─── 图表实例 ───
let customerContributionChart: echarts.ECharts | null = null
let repurchaseTrendChart: echarts.ECharts | null = null
let aoDistributionChart: echarts.ECharts | null = null
let rfmScatterChart: echarts.ECharts | null = null
let newCustomerTrendChart: echarts.ECharts | null = null
let lostCustomerTrendChart: echarts.ECharts | null = null

// ─── 图表初始化 ───
function initCustomerContributionChart() {
  if (!customerContributionChartRef.value) return
  if (customerContributionChart) customerContributionChart.dispose()
  customerContributionChart = echarts.init(customerContributionChartRef.value)
  const data = customerContribution.value
  const names = data.map(d => d.customerName).reverse()
  const values = data.map(d => d.totalAmount).reverse()
  customerContributionChart.setOption({
    title: {
      text: '暂无数据',
      show: data.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 80, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => '¥' + (v / 10000).toFixed(1) + '万' } },
    yAxis: { type: 'category', data: names, inverse: true, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: values,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CHART_COLORS.primary }, { offset: 1, color: CHART_COLORS.purple }]) },
      label: { show: true, position: 'right', fontSize: 11, formatter: (p: any) => formatYuan(p.value) }
    }]
  })
}

function initRepurchaseTrendChart() {
  if (!repurchaseTrendChartRef.value) return
  if (repurchaseTrendChart) repurchaseTrendChart.dispose()
  repurchaseTrendChart = echarts.init(repurchaseTrendChartRef.value)
  const data = repurchaseTrend.value
  repurchaseTrendChart.setOption({
    title: {
      text: '暂无数据',
      show: data.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>复购率：${p[0].value}%` },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '%', min: 0 },
    series: [{
      type: 'line', smooth: true, data: data.map(d => Number(d.rate)),
      itemStyle: { color: CHART_COLORS.primary },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(63,111,239,0.3)' }, { offset: 1, color: 'rgba(63,111,239,0.05)' }]) },
      markLine: { data: [{ type: 'average', name: '平均值' }], lineStyle: { color: CHART_COLORS.danger, type: 'dashed' } }
    }]
  })
}

function initAODistributionChart() {
  if (!aoDistributionChartRef.value) return
  if (aoDistributionChart) aoDistributionChart.dispose()
  aoDistributionChart = echarts.init(aoDistributionChartRef.value)
  const data = avgOrderValueDistribution.value
  aoDistributionChart.setOption({
    title: {
      text: '暂无数据',
      show: data.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['客户数', '订单数'], bottom: 0 },
    grid: { left: 50, right: 30, top: 10, bottom: 40 },
    xAxis: { type: 'category', data: data.map(d => d.label) },
    yAxis: { type: 'value' },
    series: [
      { name: '客户数', type: 'bar', data: data.map(d => d.customerCount), itemStyle: { color: CHART_COLORS.primary } },
      { name: '订单数', type: 'bar', data: data.map(d => d.orderCount), itemStyle: { color: CHART_COLORS.success } }
    ]
  })
}

function initRFMScatterChart() {
  if (!rfmScatterChartRef.value) return
  if (rfmScatterChart) rfmScatterChart.dispose()
  rfmScatterChart = echarts.init(rfmScatterChartRef.value)
  const scatter = rfm.value.customers
  const isRF = rfmScatterType.value === 'rf'
  const xKey = isRF ? 'recencyDays' : 'frequency'
  const yKey = isRF ? 'frequency' : 'monetary'
  const xLabel = isRF ? 'R值（最近消费天数）' : 'F值（消费次数）'
  const yLabel = isRF ? 'F值（消费次数）' : 'M值（消费金额）'
  const points = scatter.map(s => [Number(s[xKey] ?? 0), Number(s[yKey] ?? 0)])
  const xRange = paddedRange(points.map(p => p[0]))
  const yRange = paddedRange(points.map(p => p[1]))
  rfmScatterChart.setOption({
    title: {
      text: '暂无数据',
      show: scatter.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.data[2]}<br/>${xLabel}: ${p.data[0]}<br/>${yLabel}: ${p.data[1]}` },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: xLabel, min: xRange.min, max: xRange.max },
    yAxis: { type: 'value', name: yLabel, min: yRange.min, max: yRange.max },
    series: [{
      type: 'scatter',
      data: scatter.map(s => ({ value: [Number(s[xKey] ?? 0), Number(s[yKey] ?? 0)], name: s.customerName || '客户' })),
      symbolSize: 10,
      itemStyle: { color: CHART_COLORS.primary },
      emphasis: { itemStyle: { color: CHART_COLORS.danger } }
    }]
  })
}

function paddedRange(nums: number[]) {
  if (nums.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const pad = max - min || 1
  return { min: Math.max(0, min - pad * 0.2), max: max + pad * 0.2 }
}

function initNewCustomerTrendChart() {
  if (!newCustomerTrendChartRef.value) return
  if (newCustomerTrendChart) newCustomerTrendChart.dispose()
  newCustomerTrendChart = echarts.init(newCustomerTrendChartRef.value)
  const data = newCustomerTrend.value
  newCustomerTrendChart.setOption({
    title: {
      text: '暂无数据',
      show: data.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '人' },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.count),
      itemStyle: { color: CHART_COLORS.success },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(14,168,121,0.3)' }, { offset: 1, color: 'rgba(14,168,121,0.05)' }]) }
    }]
  })
}

function initLostCustomerTrendChart() {
  if (!lostCustomerTrendChartRef.value) return
  if (lostCustomerTrendChart) lostCustomerTrendChart.dispose()
  lostCustomerTrendChart = echarts.init(lostCustomerTrendChartRef.value)
  const data = lostCustomer.value.trend
  lostCustomerTrendChart.setOption({
    title: {
      text: '暂无数据',
      show: data.length === 0,
      left: 'center',
      top: 'center',
      textStyle: { color: CHART_COLORS.textMuted, fontSize: 13, fontWeight: 'normal' }
    },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '人' },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.count),
      itemStyle: { color: CHART_COLORS.danger },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(192,57,43,0.3)' }, { offset: 1, color: 'rgba(192,57,43,0.05)' }]) }
    }]
  })
}

// ─── Tab 切换 ───
const chartInits: Record<string, () => void> = {
  customerContribution: initCustomerContributionChart,
  repurchaseTrend: initRepurchaseTrendChart,
  avgOrderValue: initAODistributionChart,
  rfm: initRFMScatterChart,
  newCustomerTrend: initNewCustomerTrendChart,
  lostCustomer: initLostCustomerTrendChart
}

function onTabChange(name: string) {
  const initFn = chartInits[name]
  if (initFn) setTimeout(initFn, 50)
}

// ─── 生命周期 ───
function handleResize() {
  [customerContributionChart, repurchaseTrendChart, aoDistributionChart, rfmScatterChart, newCustomerTrendChart, lostCustomerTrendChart].forEach(c => c?.resize())
}

function disposeAllCharts() {
  [customerContributionChart, repurchaseTrendChart, aoDistributionChart, rfmScatterChart, newCustomerTrendChart, lostCustomerTrendChart].forEach(c => c?.dispose())
  customerContributionChart = null
  repurchaseTrendChart = null
  aoDistributionChart = null
  rfmScatterChart = null
  newCustomerTrendChart = null
  lostCustomerTrendChart = null
}

function refreshAll() {
  loadData()
}

onMounted(async () => {
  await loadStores()
  await loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})
</script>

<style scoped>
.page { padding: 0; }

.chart-box { width: 100%; }
.chart-medium { height: 350px; }
.chart-tall { height: 400px; }

.chart-table {
  margin-top: 12px;
}

.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
