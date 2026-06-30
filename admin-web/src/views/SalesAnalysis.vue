<template>
  <div class="page">
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="12" align="middle">
        <el-col :span="4">
          <el-radio-group v-model="datePreset" @change="onDatePresetChange">
            <el-radio-button value="day">日</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="month">月</el-radio-button>
            <el-radio-button value="custom">自定义</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="6">
          <el-date-picker
            v-if="datePreset === 'custom'"
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="refreshAll"
          />
          <el-date-picker
            v-else
            v-model="singleDate"
            :type="datePreset === 'day' ? 'date' : datePreset === 'week' ? 'week' : 'month'"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="refreshAll"
          />
        </el-col>
        <el-col :span="8">
          <el-select v-model="selectedStores" multiple placeholder="选择门店" clearable style="width: 100%" @change="refreshAll">
            <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-button type="primary" @click="refreshAll">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="refreshAll">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
      <!-- Tab 1: 销售趋势 -->
      <el-tab-pane label="销售趋势" name="trend">
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="6">
            <el-radio-group v-model="trendGranularity" size="small" @change="initTrendChart">
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
        <el-button size="small" type="primary" style="margin-bottom: 12px" @click="exportProductRank">
          <el-icon><Download /></el-icon> 导出
        </el-button>
        <el-table :data="productRanking" stripe border style="width: 100%">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="productName" label="商品名" width="150" />
          <el-table-column prop="categoryName" label="品类" width="100" />
          <el-table-column prop="salesCount" label="销量" sortable width="100" />
          <el-table-column prop="salesAmount" label="销售额" sortable width="130">
            <template #default="{ row }">¥{{ formatMoney(row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column prop="grossProfit" label="毛利" sortable width="120">
            <template #default="{ row }">¥{{ formatMoney(row.grossProfit) }}</template>
          </el-table-column>
          <el-table-column prop="profitRate" label="毛利率" sortable width="100">
            <template #default="{ row }">{{ row.profitRate }}%</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="productRanking.length > 0"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, prev, pager, next"
          :total="productRanking.length"
          :page-size="20"
          :pager-count="5"
          small
        />
      </el-tab-pane>

      <!-- Tab 4: 客户排行 -->
      <el-tab-pane label="客户排行" name="customerRank">
        <el-table :data="customerRanking" stripe border style="width: 100%">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="customerName" label="客户名" width="150" />
          <el-table-column prop="totalAmount" label="消费金额" sortable width="130">
            <template #default="{ row }">¥{{ formatMoney(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" sortable width="100" />
          <el-table-column prop="avgOrderValue" label="客单价" sortable width="120">
            <template #default="{ row }">¥{{ formatMoney(row.avgOrderValue) }}</template>
          </el-table-column>
          <el-table-column prop="lastOrderTime" label="最近消费" width="160" />
        </el-table>
        <el-pagination
          v-if="customerRanking.length > 0"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, prev, pager, next"
          :total="customerRanking.length"
          :page-size="20"
          :pager-count="5"
          small
        />
      </el-tab-pane>

      <!-- Tab 5: 门店排行 -->
      <el-tab-pane label="门店排行" name="storeRank">
        <div ref="storeRankChartRef" class="chart-box chart-medium"></div>
        <el-table :data="storeRankingData" stripe border style="width: 100%; margin-top: 16px">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="storeName" label="门店" width="150" />
          <el-table-column prop="salesAmount" label="销售额" sortable width="130">
            <template #default="{ row }">¥{{ formatMoney(row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" sortable width="100" />
          <el-table-column prop="grossProfit" label="毛利" sortable width="120">
            <template #default="{ row }">¥{{ formatMoney(row.grossProfit) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Tab 6: 业务员排行 -->
      <el-tab-pane label="业务员排行" name="salesmanRank">
        <div ref="salesmanChartRef" class="chart-box chart-medium"></div>
        <el-table :data="salesmanRanking" stripe border style="width: 100%; margin-top: 16px">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="salesmanName" label="业务员" width="120" />
          <el-table-column prop="salesAmount" label="销售额" sortable width="130">
            <template #default="{ row }">¥{{ formatMoney(row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" sortable width="100" />
          <el-table-column prop="grossProfit" label="毛利" sortable width="120">
            <template #default="{ row }">¥{{ formatMoney(row.grossProfit) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Tab 7: 同期对比 -->
      <el-tab-pane label="同期对比" name="compare">
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
      </el-tab-pane>

      <!-- Tab 8: 销售日报 -->
      <el-tab-pane label="销售日报" name="dailyReport">
        <el-table :data="paginatedDailyReport" stripe border style="width: 100%">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="salesAmount" label="销售额" sortable width="130">
            <template #default="{ row }">¥{{ formatMoney(row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" sortable width="100" />
          <el-table-column prop="avgOrderValue" label="客单价" sortable width="120">
            <template #default="{ row }">¥{{ formatMoney(row.avgOrderValue) }}</template>
          </el-table-column>
          <el-table-column prop="refundAmount" label="退款金额" width="120">
            <template #default="{ row }">¥{{ formatMoney(row.refundAmount) }}</template>
          </el-table-column>
          <el-table-column prop="refundRate" label="退款率" width="100">
            <template #default="{ row }">{{ row.refundRate }}%</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="dailyReportPage"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, prev, pager, next"
          :total="dailyReportData.length"
          :page-size="10"
          :pager-count="5"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Download, Refresh, Search } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'

// ─── 筛选状态 ───
const datePreset = ref('day')
const singleDate = ref('2026-06-30')
const customDateRange = ref<string[]>([])
const selectedStores = ref<number[]>([])
const storeOptions = ref(
  Array.from({ length: 10 }, (_, i) => ({ label: `门店${i + 1}`, value: i + 1 }))
)

function onDatePresetChange() {
  if (datePreset.value !== 'custom') {
    refreshAll()
  }
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

const trendData = computed(() => {
  if (trendGranularity.value === 'day') {
    return Array.from({ length: 30 }, (_, i) => ({
      label: `06-${String(i + 1).padStart(2, '0')}`,
      salesAmount: Math.floor(Math.random() * 50000 + 30000),
      orderCount: Math.floor(Math.random() * 30 + 20),
      avgOrderValue: Math.floor(Math.random() * 2000 + 1500)
    }))
  } else if (trendGranularity.value === 'week') {
    return ['第1周', '第2周', '第3周', '第4周'].map(l => ({
      label: l,
      salesAmount: Math.floor(Math.random() * 300000 + 200000),
      orderCount: Math.floor(Math.random() * 200 + 150),
      avgOrderValue: Math.floor(Math.random() * 2000 + 1500)
    }))
  } else {
    return ['1月', '2月', '3月', '4月', '5月', '6月'].map(l => ({
      label: l,
      salesAmount: Math.floor(Math.random() * 1200000 + 800000),
      orderCount: Math.floor(Math.random() * 800 + 600),
      avgOrderValue: Math.floor(Math.random() * 2000 + 1500)
    }))
  }
})

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
      { name: '销售额', type: 'line', smooth: true, data: data.map(d => d.salesAmount), itemStyle: { color: '#667eea' } },
      { name: '订单数', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.orderCount), itemStyle: { color: '#11998e' } },
      { name: '客单价', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.avgOrderValue), itemStyle: { color: '#f5576c' } }
    ]
  })
}

// ─── Tab 2: 时段热力图 ───
const heatmapChartRef = ref<HTMLDivElement | null>(null)
let heatmapChart: echarts.ECharts | null = null

const heatmapData = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00')
  const days = Array.from({ length: 30 }, (_, i) => `06-${String(i + 1).padStart(2, '0')}`)
  const data: [number, number, number][] = []
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 30; d++) {
      data.push([d, h, Math.floor(Math.random() * 10000 + 500)])
    }
  }
  return { hours, days, data }
})

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
      inRange: { color: ['#f0f5ff', '#667eea', '#764ba2'] }
    },
    series: [{
      type: 'heatmap', data: hd.data,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
    }]
  })
}

// ─── Tab 3: 商品排行 ───
const productRanking = ref(
  Array.from({ length: 20 }, (_, i) => ({
    productName: `商品${i + 1}`,
    categoryName: ['白酒', '红酒', '啤酒', '洋酒'][i % 4],
    salesCount: Math.floor(Math.random() * 500 + 50),
    salesAmount: Math.floor(Math.random() * 50000 + 5000),
    grossProfit: Math.floor(Math.random() * 15000 + 2000),
    profitRate: Number((Math.random() * 20 + 20).toFixed(1))
  }))
)

function exportProductRank() {
  ElMessage.success('导出功能暂未实现（使用 mock 数据）')
}

// ─── Tab 4: 客户排行 ───
const customerRanking = ref(
  Array.from({ length: 20 }, (_, i) => ({
    customerName: `客户${i + 1}`,
    totalAmount: Math.floor(Math.random() * 100000 + 10000),
    orderCount: Math.floor(Math.random() * 50 + 10),
    avgOrderValue: Math.floor(Math.random() * 3000 + 1000),
    lastOrderTime: `2026-06-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:00:00`
  }))
)

// ─── Tab 5: 门店排行 ───
const storeRankChartRef = ref<HTMLDivElement | null>(null)
let storeRankChart: echarts.ECharts | null = null

const storeRankingData = ref(
  Array.from({ length: 10 }, (_, i) => ({
    storeName: `门店${i + 1}`,
    salesAmount: Math.floor(Math.random() * 50000 + 10000),
    orderCount: Math.floor(Math.random() * 50 + 10),
    grossProfit: Math.floor(Math.random() * 15000 + 3000)
  }))
)

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
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#4facfe' }, { offset: 1, color: '#00f2fe' }]) },
      label: { show: true, position: 'right', formatter: (p: any) => '¥' + (p.value / 10000).toFixed(1) + '万' }
    }]
  })
}

// ─── Tab 6: 业务员排行 ───
const salesmanChartRef = ref<HTMLDivElement | null>(null)
let salesmanChart: echarts.ECharts | null = null

const salesmanRanking = ref(
  Array.from({ length: 10 }, (_, i) => ({
    salesmanName: `业务员${i + 1}`,
    salesAmount: Math.floor(Math.random() * 40000 + 8000),
    orderCount: Math.floor(Math.random() * 40 + 10),
    grossProfit: Math.floor(Math.random() * 12000 + 2000)
  }))
)

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
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f093fb' }, { offset: 1, color: '#f5576c' }]) },
      label: { show: true, position: 'right', formatter: (p: any) => '¥' + (p.value / 10000).toFixed(1) + '万' }
    }]
  })
}

// ─── Tab 7: 同期对比 ───
const compareData = ref([
  { metric: '销售额', currentValue: '¥125,600', previousValue: '¥111,600', changeAmount: '+¥14,000', changeRate: 12.5 },
  { metric: '订单数', currentValue: '48', previousValue: '44', changeAmount: '+4', changeRate: 9.1 },
  { metric: '客单价', currentValue: '¥2,617', previousValue: '¥2,536', changeAmount: '+¥81', changeRate: 3.2 },
  { metric: '毛利', currentValue: '¥38,200', previousValue: '¥33,200', changeAmount: '+¥5,000', changeRate: 15.1 }
])

// ─── Tab 8: 销售日报 ───
const dailyReportData = ref(
  Array.from({ length: 30 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    salesAmount: Math.floor(Math.random() * 50000 + 30000),
    orderCount: Math.floor(Math.random() * 30 + 20),
    avgOrderValue: Math.floor(Math.random() * 2000 + 1500),
    refundAmount: Math.floor(Math.random() * 3000 + 500),
    refundRate: Number((Math.random() * 5 + 1).toFixed(1))
  }))
)

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
  onTabChange(activeTab.value)
}

onMounted(() => {
  initTrendChart()
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
  color: #f56c6c;
  font-weight: 600;
}

.growth-down-text {
  color: #67c23a;
  font-weight: 600;
}
</style>