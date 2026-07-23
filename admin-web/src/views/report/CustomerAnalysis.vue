<template>
  <div class="page">
    <!-- 筛选区 -->
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
          />
        </el-col>
        <el-col :span="4">
          <el-select v-model="selectedStores" multiple placeholder="选择门店" clearable style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="refreshAll">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="refreshAll">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 客户概览卡片 -->
    <el-row :gutter="16" class="overview-row">
      <el-col :span="4" v-for="(card, idx) in overviewCards" :key="idx">
        <el-card shadow="hover" :class="['overview-card', card.gradient]">
          <div class="overview-label">{{ card.label }}</div>
          <div class="overview-value">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
      <!-- 客户贡献排行 -->
      <el-tab-pane label="客户贡献排行" name="customerContribution">
        <div ref="customerContributionChartRef" class="chart-box chart-medium"></div>
        <el-table :data="customerContribution" stripe style="width:100%;margin-top:12px">
          <el-table-column type="index" label="排名" width="60" align="center" />
          <el-table-column prop="customerName" label="客户名称" min-width="140" />
          <el-table-column label="累计消费" width="120" align="right">
            <template #default="{ row }">{{ formatYuan(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
          <el-table-column label="客单价" width="110" align="right">
            <template #default="{ row }">{{ formatYuan(row.avgOrderValue) }}</template>
          </el-table-column>
          <el-table-column prop="lastOrderDate" label="最近消费" width="120" align="center" />
        </el-table>
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
            <el-table :data="avgOrderValueDistribution" stripe size="small">
              <el-table-column prop="label" label="客单价区间" width="120" />
              <el-table-column prop="customerCount" label="客户数" width="90" align="right" />
              <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
            </el-table>
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
            <el-table :data="rfm.segments" stripe size="small" max-height="350" @row-click="onRFMGroupClick">
              <el-table-column prop="group" label="分群名称" min-width="120" />
              <el-table-column prop="customerCount" label="客户数" width="80" align="right" />
              <el-table-column label="销售额" width="110" align="right">
                <template #default="{ row }">{{ formatYuan(row.totalAmount) }}</template>
              </el-table-column>
              <el-table-column label="占比" width="80" align="center">
                <template #default="{ row }">{{ row.ratio }}%</template>
              </el-table-column>
            </el-table>
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
        <el-table :data="lostCustomer.list" stripe style="width:100%;margin-top:12px">
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
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { formatYuan } from '../../utils/format'

// ─── 筛选状态 ───
const dateRange = ref<string[]>(['2026-06-01', '2026-06-30'])
const selectedStores = ref<string[]>([])
const storeOptions = ['门店1', '门店2', '门店3', '门店4', '门店5']

// ─── Mock 数据 ───
const mockOverview = { totalCount: 2560, newCount: 128, activeCount: 890, lostCount: 320, repurchaseRate: 35.2 }
const mockCustomerContribution = Array.from({ length: 20 }, (_, i) => ({ customerId: i + 1, customerName: `客户${i + 1}`, totalAmount: Math.floor(Math.random() * 100000 + 10000), orderCount: Math.floor(Math.random() * 50 + 5), avgOrderValue: Math.floor(Math.random() * 3000 + 500), lastOrderDate: `2026-06-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')}` }))
const mockRepurchaseTrend = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, rate: (Math.random() * 10 + 30).toFixed(1) }))
const mockAvgOrderValueDistribution = [{ range: '0-100', label: '<100元', customerCount: 320, orderCount: 850 }, { range: '100-300', label: '100-300元', customerCount: 680, orderCount: 2100 }, { range: '300-500', label: '300-500元', customerCount: 520, orderCount: 1800 }, { range: '500-1000', label: '500-1000元', customerCount: 380, orderCount: 1200 }, { range: '1000-3000', label: '1000-3000元', customerCount: 240, orderCount: 680 }, { range: '3000+', label: '3000元以上', customerCount: 120, orderCount: 320 }]
const mockRFM = { segments: [{ group: '重要价值客户', customerCount: 320, totalAmount: 450000, ratio: 12.5 }, { group: '重要发展客户', customerCount: 280, totalAmount: 280000, ratio: 10.9 }, { group: '重要保持客户', customerCount: 180, totalAmount: 220000, ratio: 7.0 }, { group: '重要挽留客户', customerCount: 150, totalAmount: 180000, ratio: 5.9 }, { group: '一般价值客户', customerCount: 420, totalAmount: 320000, ratio: 16.4 }, { group: '一般发展客户', customerCount: 350, totalAmount: 180000, ratio: 13.7 }, { group: '一般保持客户', customerCount: 380, totalAmount: 150000, ratio: 14.8 }, { group: '一般挽留客户', customerCount: 480, totalAmount: 120000, ratio: 18.8 }], scatter: Array.from({ length: 50 }, (_, i) => ({ r: Math.floor(Math.random() * 5) + 1, f: Math.floor(Math.random() * 5) + 1, m: Math.floor(Math.random() * 5) + 1, customerName: `客户${i + 1}` })) }
const mockNewCustomerTrend = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, count: Math.floor(Math.random() * 50 + 80) }))
const mockLostCustomer = { trend: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, count: Math.floor(Math.random() * 30 + 20) })), list: Array.from({ length: 20 }, (_, i) => ({ customerId: i + 1, customerName: `流失客户${i + 1}`, lastOrderDate: `2026-03-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')}`, daysSinceLastOrder: Math.floor(Math.random() * 60 + 90) })) }

// ─── 数据引用 ───
const customerContribution = ref(mockCustomerContribution)
const repurchaseTrend = ref(mockRepurchaseTrend)
const avgOrderValueDistribution = ref(mockAvgOrderValueDistribution)
const rfm = ref(mockRFM)
const newCustomerTrend = ref(mockNewCustomerTrend)
const lostCustomer = ref(mockLostCustomer)

// ─── 概览卡片 ───
const overviewCards = computed(() => [
  { label: '客户总数', value: mockOverview.totalCount, gradient: 'gradient-primary' },
  { label: '本月新增', value: mockOverview.newCount, gradient: 'gradient-success' },
  { label: '活跃客户数', value: mockOverview.activeCount, gradient: 'gradient-warning' },
  { label: '流失客户数', value: mockOverview.lostCount, gradient: 'gradient-danger' },
  { label: '复购率', value: mockOverview.repurchaseRate + '%', gradient: 'gradient-info' }
])

// ─── Tab 状态 ───
const activeTab = ref('customerContribution')
const rfmScatterType = ref('rf')
const rfmDetailVisible = ref(false)
const rfmDetailCustomers = ref<any[]>([])

function onRFMGroupClick(row: any) {
  rfmDetailCustomers.value = rfm.value.scatter.slice(0, 10).map(s => ({
    customerName: s.customerName,
    r: s.r,
    f: s.f,
    m: s.m
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
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 80, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => '¥' + (v / 10000).toFixed(1) + '万' } },
    yAxis: { type: 'category', data: names, inverse: true, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: values,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#764ba2' }]) },
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
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>复购率：${p[0].value}%` },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '%', min: 20, max: 50 },
    series: [{
      type: 'line', smooth: true, data: data.map(d => Number(d.rate)),
      itemStyle: { color: '#667eea' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(102,126,234,0.3)' }, { offset: 1, color: 'rgba(102,126,234,0.05)' }]) },
      markLine: { data: [{ type: 'average', name: '平均值' }], lineStyle: { color: '#f5576c', type: 'dashed' } }
    }]
  })
}

function initAODistributionChart() {
  if (!aoDistributionChartRef.value) return
  if (aoDistributionChart) aoDistributionChart.dispose()
  aoDistributionChart = echarts.init(aoDistributionChartRef.value)
  const data = avgOrderValueDistribution.value
  aoDistributionChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['客户数', '订单数'], bottom: 0 },
    grid: { left: 50, right: 30, top: 10, bottom: 40 },
    xAxis: { type: 'category', data: data.map(d => d.label) },
    yAxis: { type: 'value' },
    series: [
      { name: '客户数', type: 'bar', data: data.map(d => d.customerCount), itemStyle: { color: '#667eea' } },
      { name: '订单数', type: 'bar', data: data.map(d => d.orderCount), itemStyle: { color: '#43e97b' } }
    ]
  })
}

function initRFMScatterChart() {
  if (!rfmScatterChartRef.value) return
  if (rfmScatterChart) rfmScatterChart.dispose()
  rfmScatterChart = echarts.init(rfmScatterChartRef.value)
  const scatter = rfm.value.scatter
  const isRF = rfmScatterType.value === 'rf'
  const xKey = isRF ? 'r' : 'f'
  const yKey = isRF ? 'f' : 'm'
  const xLabel = isRF ? 'R值（最近消费）' : 'F值（消费频率）'
  const yLabel = isRF ? 'F值（消费频率）' : 'M值（消费金额）'
  rfmScatterChart.setOption({
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.data[2]}<br/>${xLabel}: ${p.data[0]}<br/>${yLabel}: ${p.data[1]}` },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: xLabel, min: 0, max: 6, interval: 1 },
    yAxis: { type: 'value', name: yLabel, min: 0, max: 6, interval: 1 },
    series: [{
      type: 'scatter',
      data: scatter.map(s => ({ value: [s[xKey as keyof typeof s], s[yKey as keyof typeof s]], name: s.customerName })),
      symbolSize: (val: number[]) => (val[0] + val[1]) * 3 + 8,
      itemStyle: { color: '#667eea' },
      emphasis: { itemStyle: { color: '#f5576c' } }
    }]
  })
}

function initNewCustomerTrendChart() {
  if (!newCustomerTrendChartRef.value) return
  if (newCustomerTrendChart) newCustomerTrendChart.dispose()
  newCustomerTrendChart = echarts.init(newCustomerTrendChartRef.value)
  const data = newCustomerTrend.value
  newCustomerTrendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '人' },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.count),
      itemStyle: { color: '#11998e' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(17,153,142,0.3)' }, { offset: 1, color: 'rgba(17,153,142,0.05)' }]) }
    }]
  })
}

function initLostCustomerTrendChart() {
  if (!lostCustomerTrendChartRef.value) return
  if (lostCustomerTrendChart) lostCustomerTrendChart.dispose()
  lostCustomerTrendChart = echarts.init(lostCustomerTrendChartRef.value)
  const data = lostCustomer.value.trend
  lostCustomerTrendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: { type: 'value', name: '人' },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.count),
      itemStyle: { color: '#f5576c' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,87,108,0.3)' }, { offset: 1, color: 'rgba(245,87,108,0.05)' }]) }
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
  onTabChange(activeTab.value)
}

onMounted(() => {
  initCustomerContributionChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})
</script>

<style scoped>
.page { padding: 20px; }
.filter-card { margin-bottom: 16px; }
.overview-row { margin-bottom: 16px; }

.overview-card { border-radius: 8px; text-align: center; padding: 4px 0; }
.overview-card .overview-label { font-size: 13px; color: #fff; opacity: 0.9; margin-bottom: 8px; }
.overview-card .overview-value { font-size: 24px; font-weight: 700; color: #fff; }

.gradient-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.gradient-success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
.gradient-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.gradient-danger { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
.gradient-info { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }

.chart-box { width: 100%; }
.chart-medium { height: 350px; }
.chart-tall { height: 400px; }
</style>