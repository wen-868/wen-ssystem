<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">销售分析</h2>
        <p class="page-desc">销售趋势、时段分布与多维度排行分析</p>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="datePreset" @change="onDatePresetChange">
        <el-radio-button value="day">日</el-radio-button>
        <el-radio-button value="week">周</el-radio-button>
        <el-radio-button value="month">月</el-radio-button>
        <el-radio-button value="custom">自定义</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-if="datePreset === 'custom'"
        v-model="customDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        @change="refreshAll"
      />
      <el-date-picker
        v-else
        v-model="singleDate"
        :type="datePreset === 'day' ? 'date' : datePreset === 'week' ? 'week' : 'month'"
        value-format="YYYY-MM-DD"
        @change="refreshAll"
      />
      <el-select v-model="selectedStores" multiple placeholder="选择门店" clearable @change="refreshAll">
        <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-button type="primary" @click="refreshAll">
        <el-icon><Search /></el-icon>&nbsp;查询
      </el-button>
      <el-button @click="refreshAll">
        <el-icon><Refresh /></el-icon>&nbsp;刷新
      </el-button>
    </div>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- Tab 1: 销售趋势 -->
      <el-tab-pane label="销售趋势" name="trend">
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="6">
            <el-radio-group v-model="trendGranularity" size="small" @change="onTrendGranularityChange">
              <el-radio-button value="day">日</el-radio-button>
              <el-radio-button value="week">周</el-radio-button>
              <el-radio-button value="month">月</el-radio-button>
            </el-radio-group>
          </el-col>
        </el-row>
        <div ref="trendChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 2: 时段热力图 -->
      <el-tab-pane label="时段热力图" name="heatmap">
        <div ref="heatmapChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 3: 商品排行 -->
      <el-tab-pane label="商品排行" name="productRank">
        <div class="filter-bar">
          <div class="filter-bar-spacer" />
          <el-button type="primary" @click="exportProductRank">
            <el-icon><Download /></el-icon>&nbsp;导出
          </el-button>
        </div>
        <div class="table-card">
          <el-table :data="productRanking" stripe border style="width: 100%">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="productName" label="商品名" width="150" />
            <el-table-column prop="categoryName" label="品类" width="100" />
            <el-table-column prop="salesCount" label="销量" sortable width="100" />
            <el-table-column prop="salesAmount" label="销售额" sortable width="130">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.salesAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="grossProfit" label="毛利" sortable width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.grossProfit) }}</span></template>
            </el-table-column>
            <el-table-column prop="profitRate" label="毛利率" sortable width="100">
              <template #default="{ row }">{{ row.profitRate }}%</template>
            </el-table-column>
          </el-table>
          <div class="table-card-footer">
            <el-pagination
              v-if="productRanking.length > 0"
              layout="total, prev, pager, next"
              :total="productRanking.length"
              :page-size="20"
              :pager-count="5"
              small
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 4: 客户排行 -->
      <el-tab-pane label="客户排行" name="customerRank">
        <div class="table-card">
          <el-table :data="customerRanking" stripe border style="width: 100%">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="customerName" label="客户名" width="150" />
            <el-table-column prop="totalAmount" label="消费金额" sortable width="130">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.totalAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" sortable width="100" />
            <el-table-column prop="avgOrderValue" label="客单价" sortable width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.avgOrderValue) }}</span></template>
            </el-table-column>
            <el-table-column prop="lastOrderTime" label="最近消费" width="160" />
          </el-table>
          <div class="table-card-footer">
            <el-pagination
              v-if="customerRanking.length > 0"
              layout="total, prev, pager, next"
              :total="customerRanking.length"
              :page-size="20"
              :pager-count="5"
              small
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 5: 门店排行 -->
      <el-tab-pane label="门店排行" name="storeRank">
        <div ref="storeRankChartRef" class="chart-box chart-medium"></div>
        <div class="table-card chart-table">
          <el-table :data="storeRankingData" stripe border style="width: 100%">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="storeName" label="门店" width="150" />
            <el-table-column prop="salesAmount" label="销售额" sortable width="130">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.salesAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" sortable width="100" />
            <el-table-column prop="grossProfit" label="毛利" sortable width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.grossProfit) }}</span></template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 6: 业务员排行 -->
      <el-tab-pane label="业务员排行" name="salesmanRank">
        <div ref="salesmanChartRef" class="chart-box chart-medium"></div>
        <div class="table-card chart-table">
          <el-table :data="salesmanRanking" stripe border style="width: 100%">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="salesmanName" label="业务员" width="120" />
            <el-table-column prop="salesAmount" label="销售额" sortable width="130">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.salesAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" sortable width="100" />
            <el-table-column prop="grossProfit" label="毛利" sortable width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.grossProfit) }}</span></template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 7: 同期对比 -->
      <el-tab-pane label="同期对比" name="compare">
        <div class="table-card">
          <el-table :data="compareData" stripe border style="width: 100%">
            <el-table-column prop="metric" label="指标" width="150" />
            <el-table-column prop="currentValue" label="本期" width="150" />
            <el-table-column prop="previousValue" label="上期" width="150" />
            <el-table-column prop="changeAmount" label="变化金额" width="150" />
            <el-table-column label="变化率" width="120">
              <template #default="{ row }">
                <span :class="row.changeRate >= 0 ? 'growth-up-text' : 'growth-down-text'">
                  {{ row.changeRate >= 0 ? '+' : '' }}{{ row.changeRate }}%
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 8: 销售日报 -->
      <el-tab-pane label="销售日报" name="dailyReport">
        <div class="table-card">
          <el-table :data="paginatedDailyReport" stripe border style="width: 100%">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="salesAmount" label="销售额" sortable width="130">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.salesAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" sortable width="100" />
            <el-table-column prop="avgOrderValue" label="客单价" sortable width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.avgOrderValue) }}</span></template>
            </el-table-column>
            <el-table-column prop="refundAmount" label="退款金额" width="120">
              <template #default="{ row }"><span class="amount-text">¥{{ formatMoney(row.refundAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="refundRate" label="退款率" width="100">
              <template #default="{ row }">{{ row.refundRate }}%</template>
            </el-table-column>
          </el-table>
          <div class="table-card-footer">
            <el-pagination
              v-model:current-page="dailyReportPage"
              layout="total, prev, pager, next"
              :total="dailyReportData.length"
              :page-size="10"
              :pager-count="5"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHART_COLORS } from "@/styles/theme";
import { Download, Refresh, Search } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { ElMessage } from 'element-plus'
import {
  fetchReportSalesTrend,
  fetchReportSalesHourlyHeatmap,
  fetchReportSalesRanking,
  fetchReportSalesDaily,
  fetchReportStaffPerformance,
} from '@/api'
import { fetchStores } from '@/api/common'

// ─── 筛选状态 ───
const datePreset = ref('day')
const singleDate = ref(new Date().toISOString().slice(0, 10))
const customDateRange = ref<string[]>([])
const selectedStores = ref<number[]>([])
const storeOptions = ref<{ label: string; value: number }[]>([])

// 根据预设日期计算查询区间（day/week/month/custom）
function getDateRange(): { startDate?: string; endDate?: string } {
  if (datePreset.value === 'custom') {
    if (customDateRange.value?.length === 2) {
      return { startDate: customDateRange.value[0], endDate: customDateRange.value[1] }
    }
    return {}
  }
  const d = new Date(singleDate.value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return {}
  const fmt = (dt: Date) => {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  if (datePreset.value === 'day') {
    return { startDate: fmt(d), endDate: fmt(d) }
  }
  if (datePreset.value === 'week') {
    const offset = (d.getDay() + 6) % 7 // 周一为一周起点
    const start = new Date(d)
    start.setDate(d.getDate() - offset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { startDate: fmt(start), endDate: fmt(end) }
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { startDate: fmt(start), endDate: fmt(end) }
}

async function loadStores() {
  try {
    const data = await fetchStores()
    const records = Array.isArray(data) ? data : (data?.records || data?.list || [])
    storeOptions.value = records.map((s: any) => ({ label: s.name, value: Number(s.id) }))
  } catch {
    storeOptions.value = []
  }
}

function onDatePresetChange() {
  if (datePreset.value !== 'custom') {
    refreshAll()
  }
}

function onTrendGranularityChange() {
  loadTrend().then(initTrendChart)
}

const activeTab = ref('trend')

// ─── 工具函数 ───
function formatMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Tab 1: 销售趋势 ───
const trendGranularity = ref('day')
const trendChartRef = ref<HTMLDivElement | null>(null)
let trendChart: echarts.ECharts | null = null
const trendLoading = ref(false)

const trendData = ref<{ label: string; salesAmount: number; orderCount: number; avgOrderValue: number }[]>([])

async function loadTrend() {
  trendLoading.value = true
  try {
    const data = await fetchReportSalesTrend({ granularity: trendGranularity.value })
    const list = Array.isArray(data) ? data : (data?.list || data?.records || [])
    trendData.value = list.map((d: any) => {
      const salesAmount = Number(d.salesAmount ?? 0)
      const orderCount = Number(d.orderCount ?? 0)
      return {
        label: formatPeriodLabel(d.period, trendGranularity.value),
        salesAmount,
        orderCount,
        avgOrderValue: orderCount > 0 ? Math.round((salesAmount / orderCount) * 100) / 100 : 0,
      }
    })
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载销售趋势失败')
    trendData.value = []
  } finally {
    trendLoading.value = false
  }
}

function formatPeriodLabel(period: string | undefined, granularity: string): string {
  const p = String(period || '')
  if (!p) return '-'
  if (granularity === 'day') return p.slice(5) // MM-DD
  if (granularity === 'week') return `第${p.slice(-2).replace(/^0/, '')}周`
  return p // YYYY-MM
}

function initTrendChart() {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)
  const data = trendData.value
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '订单数', '客单价'] },
    grid: { left: 60, right: 60, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.label) },
    yAxis: [
      { type: 'value', name: '元', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
      { type: 'value', name: '单/元' }
    ],
    series: [
      { name: '销售额', type: 'line', smooth: true, data: data.map(d => d.salesAmount), itemStyle: { color: CHART_COLORS.primary } },
      { name: '订单数', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.orderCount), itemStyle: { color: CHART_COLORS.success } },
      { name: '客单价', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.avgOrderValue), itemStyle: { color: CHART_COLORS.danger } }
    ]
  })
}

// ─── Tab 2: 时段热力图 ───
const heatmapChartRef = ref<HTMLDivElement | null>(null)
let heatmapChart: echarts.ECharts | null = null
const heatmapLoading = ref(false)

const heatmapData = ref<{ hours: string[]; days: string[]; data: [number, number, number][] }>({
  hours: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00'),
  days: [],
  data: [],
})

async function loadHeatmap() {
  heatmapLoading.value = true
  try {
    const range = getDateRange()
    const data = await fetchReportSalesHourlyHeatmap({
      dateStart: range.startDate,
      dateEnd: range.endDate,
      storeId: selectedStores.value.length === 1 ? selectedStores.value[0] : undefined,
    })
    heatmapData.value = {
      hours: data?.hours || heatmapData.value.hours,
      days: data?.days || [],
      data: data?.data || [],
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载时段热力图失败')
    heatmapData.value = { hours: heatmapData.value.hours, days: [], data: [] }
  } finally {
    heatmapLoading.value = false
  }
}

function initHeatmapChart() {
  if (!heatmapChartRef.value) return
  if (heatmapChart) heatmapChart.dispose()
  heatmapChart = echarts.init(heatmapChartRef.value)
  const hd = heatmapData.value
  heatmapChart.setOption({
    tooltip: { position: 'top' },
    grid: { left: 60, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: 'category', data: hd.days,
      axisLabel: { fontSize: 9, rotate: 45, interval: 4 },
      splitArea: { show: true }
    },
    yAxis: {
      type: 'category', data: hd.hours,
      axisLabel: { fontSize: 10 },
      splitArea: { show: true }
    },
    visualMap: {
      min: 0, max: 10000,
      calculable: true,
      orient: 'vertical',
      right: 0,
      bottom: '15%',
      textStyle: { color: '#333' },
      inRange: { color: ['rgba(63,111,239,0.05)', CHART_COLORS.primary, CHART_COLORS.purple] }
    },
    series: [{
      type: 'heatmap', data: hd.data,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
    }]
  })
}

// ─── Tab 3: 商品排行 ───
const productRanking = ref<any[]>([])
const rankingLoading = ref(false)

async function loadRankings() {
  rankingLoading.value = true
  try {
    const range = getDateRange()
    const [product, customer, store, staff] = await Promise.all([
      fetchReportSalesRanking({ dimension: 'product', dateStart: range.startDate, dateEnd: range.endDate, limit: 20 }),
      fetchReportSalesRanking({ dimension: 'customer', dateStart: range.startDate, dateEnd: range.endDate, limit: 20 }),
      fetchReportSalesRanking({ dimension: 'store', dateStart: range.startDate, dateEnd: range.endDate, limit: 10 }),
      fetchReportStaffPerformance({ dateStart: range.startDate, dateEnd: range.endDate }),
    ])
    const asList = (d: any) => (Array.isArray(d) ? d : (d?.list || d?.records || []))
    productRanking.value = asList(product).map((r: any) => ({
      productName: r.name || '-',
      categoryName: '-',
      salesCount: Number(r.totalQty ?? 0),
      salesAmount: Number(r.totalAmount ?? 0),
      // 毛利/毛利率无数据源（t_sale_bill_item 无成本字段），显示 0 而非随机数
      grossProfit: 0,
      profitRate: 0,
    }))
    customerRanking.value = asList(customer).map((r: any) => {
      const totalAmount = Number(r.totalAmount ?? 0)
      const orderCount = Number(r.orderCount ?? 0)
      return {
        customerName: r.name || r.mobile || '-',
        totalAmount,
        orderCount,
        avgOrderValue: orderCount > 0 ? Math.round((totalAmount / orderCount) * 100) / 100 : 0,
        lastOrderTime: r.lastOrderTime ? String(r.lastOrderTime).replace('T', ' ').slice(0, 19) : '-',
      }
    })
    storeRankingData.value = asList(store).map((r: any) => ({
      storeName: r.name || '-',
      salesAmount: Number(r.totalAmount ?? 0),
      orderCount: Number(r.orderCount ?? 0),
      grossProfit: 0,
    }))
    salesmanRanking.value = asList(staff).map((r: any) => ({
      salesmanName: r.name || '-',
      salesAmount: Number(r.totalAmount ?? 0),
      orderCount: Number(r.orderCount ?? 0),
      grossProfit: 0,
    }))
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载排行数据失败')
  } finally {
    rankingLoading.value = false
  }
}

function exportProductRank() {
  // TODO: 排行导出可接入后端 POST /admin/reports/export（report_type=sales_ranking）
  ElMessage.info('导出功能暂未实现')
}

// ─── Tab 4: 客户排行（数据在 loadRankings 中加载） ───
const customerRanking = ref<any[]>([])

// ─── Tab 5: 门店排行 ───
const storeRankChartRef = ref<HTMLDivElement | null>(null)
let storeRankChart: echarts.ECharts | null = null

const storeRankingData = ref<any[]>([])

function initStoreRankChart() {
  if (!storeRankChartRef.value) return
  if (storeRankChart) storeRankChart.dispose()
  storeRankChart = echarts.init(storeRankChartRef.value)
  const names = storeRankingData.value.map(s => s.storeName).reverse()
  const amounts = storeRankingData.value.map(s => s.salesAmount).reverse()
  storeRankChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 60, right: 60, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
    yAxis: { type: 'category', data: names, inverse: true },
    series: [{
      type: 'bar', data: amounts,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CHART_COLORS.primary }, { offset: 1, color: CHART_COLORS.cyan }]) },
      label: { show: true, position: 'right', formatter: (p: any) => '¥' + (p.value / 10000).toFixed(1) + '万' }
    }]
  })
}

// ─── Tab 6: 业务员排行 ───
const salesmanChartRef = ref<HTMLDivElement | null>(null)
let salesmanChart: echarts.ECharts | null = null

const salesmanRanking = ref<any[]>([])

function initSalesmanChart() {
  if (!salesmanChartRef.value) return
  if (salesmanChart) salesmanChart.dispose()
  salesmanChart = echarts.init(salesmanChartRef.value)
  const names = salesmanRanking.value.map(s => s.salesmanName).reverse()
  const amounts = salesmanRanking.value.map(s => s.salesAmount).reverse()
  salesmanChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 70, right: 60, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
    yAxis: { type: 'category', data: names, inverse: true },
    series: [{
      type: 'bar', data: amounts,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CHART_COLORS.purple }, { offset: 1, color: CHART_COLORS.danger }]) },
      label: { show: true, position: 'right', formatter: (p: any) => '¥' + (p.value / 10000).toFixed(1) + '万' }
    }]
  })
}

// ─── Tab 7: 同期对比 ───
const fmtMoney = (v: number) => '¥' + v.toLocaleString('zh-CN')

// 基于销售趋势数据计算「本期 vs 上期」（前半段为上期、后半段为本期）
const compareData = computed(() => {
  const list = trendData.value
  const half = Math.floor(list.length / 2)
  const current = list.slice(half)
  const previous = list.slice(0, half)
  const sum = (arr: { salesAmount: number; orderCount: number; avgOrderValue: number }[], key: 'salesAmount' | 'orderCount') =>
    arr.reduce((s, d) => s + (d[key] || 0), 0)
  const curAmount = sum(current, 'salesAmount')
  const prevAmount = sum(previous, 'salesAmount')
  const curOrders = sum(current, 'orderCount')
  const prevOrders = sum(previous, 'orderCount')
  const curAvg = current.length > 0 ? curAmount / current.length : 0
  const prevAvg = previous.length > 0 ? prevAmount / previous.length : 0
  const calc = (cur: number, prev: number) => {
    const change = cur - prev
    const rate = prev !== 0 ? Math.round((change / prev) * 1000) / 10 : (cur > 0 ? 100 : 0)
    return { change, rate }
  }
  const amount = calc(curAmount, prevAmount)
  const orders = calc(curOrders, prevOrders)
  const avg = calc(curAvg, prevAvg)
  const sign = (v: number) => (v >= 0 ? '+' : '')
  return [
    { metric: '销售额', currentValue: fmtMoney(curAmount), previousValue: fmtMoney(prevAmount), changeAmount: `${sign(amount.change)}${fmtMoney(amount.change)}`, changeRate: amount.rate },
    { metric: '订单数', currentValue: String(curOrders), previousValue: String(prevOrders), changeAmount: `${sign(orders.change)}${orders.change}`, changeRate: orders.rate },
    { metric: '客单价', currentValue: fmtMoney(curAvg), previousValue: fmtMoney(prevAvg), changeAmount: `${sign(avg.change)}${fmtMoney(avg.change)}`, changeRate: avg.rate },
    // 毛利暂无数据源（销售明细无成本字段），显示 0 而非随机数
    { metric: '毛利', currentValue: fmtMoney(0), previousValue: fmtMoney(0), changeAmount: '+¥0', changeRate: 0 },
  ]
})

// ─── Tab 8: 销售日报 ───
const dailyReportData = ref<any[]>([])
const dailyReportLoading = ref(false)

async function loadDailyReport() {
  dailyReportLoading.value = true
  try {
    const range = getDateRange()
    const data = await fetchReportSalesDaily({ dateStart: range.startDate, dateEnd: range.endDate })
    const list = Array.isArray(data) ? data : (data?.list || data?.records || [])
    dailyReportData.value = list.map((d: any) => {
      const salesAmount = Number(d.salesAmount ?? 0)
      const refundAmount = Number(d.returnAmount ?? 0)
      return {
        date: String(d.date).slice(0, 10),
        salesAmount,
        orderCount: Number(d.orderCount ?? 0),
        avgOrderValue: Number(d.avgOrderAmount ?? 0),
        refundAmount,
        refundRate: salesAmount > 0 ? Math.round((refundAmount / salesAmount) * 1000) / 10 : 0,
      }
    })
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载销售日报失败')
    dailyReportData.value = []
  } finally {
    dailyReportLoading.value = false
  }
}

const dailyReportPage = ref(1)
const paginatedDailyReport = computed(() => {
  const start = (dailyReportPage.value - 1) * 10
  return dailyReportData.value.slice(start, start + 10)
})

// ─── 图表生命周期 ───
const chartInits: Record<string, () => void> = {
  trend: initTrendChart,
  heatmap: initHeatmapChart,
  storeRank: initStoreRankChart,
  salesmanRank: initSalesmanChart
}

function onTabChange(name: string) {
  const initFn = chartInits[name]
  if (initFn) {
    // 延迟以确保 DOM 渲染完成
    setTimeout(initFn, 50)
  }
}

function handleResize() {
  [trendChart, heatmapChart, storeRankChart, salesmanChart].forEach(c => c?.resize())
}

function disposeAllCharts() {
  [trendChart, heatmapChart, storeRankChart, salesmanChart].forEach(c => c?.dispose())
  trendChart = null
  heatmapChart = null
  storeRankChart = null
  salesmanChart = null
}

function refreshAll() {
  loadTrend().then(() => {
    if (activeTab.value === 'trend') initTrendChart()
  })
  loadHeatmap().then(() => {
    if (activeTab.value === 'heatmap') initHeatmapChart()
  })
  loadRankings().then(() => {
    if (activeTab.value === 'storeRank') initStoreRankChart()
    if (activeTab.value === 'salesmanRank') initSalesmanChart()
  })
  loadDailyReport()
}

async function loadAllData() {
  await Promise.all([loadStores(), loadTrend(), loadHeatmap(), loadRankings(), loadDailyReport()])
  initTrendChart()
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})
</script>

<style scoped>
.page {
  padding: 0;
}

.chart-box {
  width: 100%;
}

.chart-tall {
  height: 420px;
}

.chart-medium {
  height: 340px;
}

.growth-up-text {
  color: var(--color-danger);
  font-weight: 600;
}

.growth-down-text {
  color: var(--color-success);
  font-weight: 600;
}

.chart-table {
  margin-top: 16px;
}

.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
