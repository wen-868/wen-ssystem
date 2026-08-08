<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">订单中心</h2>
        <p class="page-desc">多渠道订单聚合、同步与处理</p>
      </div>
    </div>

    <!-- 渠道Tab -->
    <el-card shadow="never" class="channel-tab-card">
      <el-tabs v-model="activeChannel" @tab-change="onChannelChange">
        <el-tab-pane v-for="ch in channelTabs" :key="ch.type" :name="ch.type">
          <template #label>
            <span>{{ ch.name }}
              <el-badge :value="ch.todayCount" class="channel-badge" />
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 统计区 -->
    <div class="stat-grid">
      <div class="stat-grid-card">
        <div class="stat-grid-value stat-grid-value--primary">{{ mockStats.todayOrders }}</div>
        <div class="stat-grid-label">今日订单数</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">¥{{ mockStats.todayAmount.toLocaleString("zh-CN") }}</div>
        <div class="stat-grid-label">今日金额</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ mockStats.pendingCount }}</div>
        <div class="stat-grid-label">待处理数</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ mockStats.exceptionCount }}</div>
        <div class="stat-grid-label">异常数</div>
      </div>
    </div>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-card-header">渠道占比</div>
          <div class="chart-card-body">
            <div ref="channelPieChartRef" class="chart-mini-box"></div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-card-header">订单趋势（近30天）</div>
          <div class="chart-card-body">
            <div ref="orderTrendChartRef" class="chart-mini-box"></div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="filterChannel" placeholder="渠道" clearable>
        <el-option v-for="ch in channelOptions" :key="ch.value" :label="ch.label" :value="ch.value" />
      </el-select>
      <el-select v-model="filterOrderStatus" placeholder="订单状态" clearable>
        <el-option label="待处理" value="PENDING" />
        <el-option label="已确认" value="CONFIRMED" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>
      <el-select v-model="filterPaymentStatus" placeholder="支付状态" clearable>
        <el-option label="已支付" value="PAID" />
        <el-option label="未支付" value="UNPAID" />
        <el-option label="已退款" value="REFUNDED" />
      </el-select>
      <el-date-picker
        v-model="filterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
      />
      <el-input v-model="filterKeyword" placeholder="搜索订单号/客户" clearable />
      <el-button type="primary" @click="handleFilter">查询</el-button>
      <el-button @click="handleExport">导出</el-button>
    </div>

    <!-- 订单表格 -->
    <div class="table-card">
      <el-table :data="paginatedOrders" stripe border style="width: 100%">
        <el-table-column label="渠道" width="80">
          <template #default="{ row }">
            <el-tag
              size="small"
              :style="{
                background: channelSoftColors[row.channelType],
                color: channelColors[row.channelType],
                border: 'none'
              }"
            >
              {{ channelNames[row.channelType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channelOrderNo" label="渠道订单号" width="150" />
        <el-table-column prop="channelStatus" label="渠道状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.channelStatus === 'PAID' ? 'success' : 'info'" size="small">
              {{ row.channelStatus === 'PAID' ? '已支付' : row.channelStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="客户" width="150">
          <template #default="{ row }">
            <div>{{ row.customerName }}</div>
            <div style="font-size: 12px; color: var(--text-muted)">{{ row.customerPhone }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="productSummary" label="商品摘要" min-width="180" show-overflow-tooltip />
        <el-table-column label="订单金额" width="110">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.paymentStatus === 'PAID' ? 'success' : row.paymentStatus === 'UNPAID' ? 'warning' : 'danger'" size="small">
              {{ row.paymentStatus === 'PAID' ? '已支付' : row.paymentStatus === 'UNPAID' ? '未支付' : '已退款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="90">
          <template #default="{ row }">
            <el-tag :type="orderStatusType(row.orderStatus)" size="small">
              {{ orderStatusLabel(row.orderStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="聚合时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">查看详情</el-button>
            <el-button size="small" link type="success" @click="handleSync(row)">手动同步</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-card-footer">
        <el-pagination
          v-if="filteredOrders.length > 0"
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredOrders.length"
          v-model:page-size="pageSize"
          v-model:current-page="currentPage"
          :page-sizes="[10, 20, 50]"
          :pager-count="5"
        />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="订单详情" size="900px" direction="rtl">
      <template v-if="currentOrder">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card shadow="never" class="detail-card">
              <template #header><span>订单基本信息</span></template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="渠道订单号">{{ currentOrder.channelOrderNo }}</el-descriptions-item>
                <el-descriptions-item label="渠道">
                  <el-tag
                    size="small"
                    :style="{
                      background: channelSoftColors[currentOrder.channelType],
                      color: channelColors[currentOrder.channelType],
                      border: 'none'
                    }"
                  >
                    {{ channelNames[currentOrder.channelType] }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="订单状态">
                  <el-tag :type="orderStatusType(currentOrder.orderStatus)" size="small">
                    {{ orderStatusLabel(currentOrder.orderStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="支付状态">
                  <el-tag :type="currentOrder.paymentStatus === 'PAID' ? 'success' : currentOrder.paymentStatus === 'UNPAID' ? 'warning' : 'danger'" size="small">
                    {{ currentOrder.paymentStatus === 'PAID' ? '已支付' : currentOrder.paymentStatus === 'UNPAID' ? '未支付' : '已退款' }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="订单金额">¥{{ Number(currentOrder.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="聚合时间">{{ currentOrder.createdAt }}</el-descriptions-item>
              </el-descriptions>
            </el-card>

            <el-card shadow="never" class="detail-card">
              <template #header><span>收货信息</span></template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="客户姓名">{{ currentOrder.customerName }}</el-descriptions-item>
                <el-descriptions-item label="联系电话">{{ currentOrder.customerPhone }}</el-descriptions-item>
                <el-descriptions-item label="收货地址" :span="2">北京市朝阳区某某街道123号</el-descriptions-item>
              </el-descriptions>
            </el-card>

            <el-card shadow="never" class="detail-card">
              <template #header><span>渠道原始数据</span></template>
              <pre class="json-block">{{ JSON.stringify(currentOrder, null, 2) }}</pre>
            </el-card>
          </el-col>

          <el-col :span="12">
            <el-card shadow="never" class="detail-card">
              <template #header><span>商品明细</span></template>
              <el-table :data="orderItems" size="small" border>
                <el-table-column prop="channelProductName" label="渠道商品名" min-width="120" />
                <el-table-column prop="localProductName" label="本地商品名" min-width="120" />
                <el-table-column label="单价" width="80">
                  <template #default="{ row }">¥{{ Number(row.price || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="quantity" label="数量" width="60" />
                <el-table-column label="小计" width="90">
                  <template #default="{ row }">¥{{ Number(row.price * row.quantity || 0).toFixed(2) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="16" style="margin-top: 16px">
          <el-col :span="12">
            <el-card shadow="never" class="detail-card">
              <template #header><span>支付信息</span></template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="支付方式">微信支付</el-descriptions-item>
                <el-descriptions-item label="支付金额">¥{{ Number(currentOrder.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="支付时间">2026-07-01 10:30:00</el-descriptions-item>
                <el-descriptions-item label="交易流水号">WX20260701{{ String(currentOrder.id).padStart(6, '0') }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never" class="detail-card">
              <template #header><span>操作日志</span></template>
              <el-timeline>
                <el-timeline-item timestamp="2026-07-01 10:30:00" placement="top" type="primary">
                  订单支付成功，渠道回调通知
                </el-timeline-item>
                <el-timeline-item timestamp="2026-07-01 10:30:05" placement="top" type="success">
                  订单聚合入库，分配路由规则
                </el-timeline-item>
                <el-timeline-item timestamp="2026-07-01 10:30:10" placement="top" type="warning">
                  订单推送至门店，等待确认
                </el-timeline-item>
                <el-timeline-item timestamp="2026-07-01 10:30:30" placement="top" type="success">
                  门店确认接单
                </el-timeline-item>
              </el-timeline>
            </el-card>
          </el-col>
        </el-row>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import echarts from '@/utils/echarts'
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from 'element-plus'

// ─── Mock 数据 ───
const channelTypes = ['ALL', 'WECHAT', 'DOUYIN', 'MEITUAN', 'ELEME', 'JD', 'OFFLINE']
const channelNames: Record<string, string> = { ALL: '全部', WECHAT: '微信', DOUYIN: '抖音', MEITUAN: '美团', ELEME: '饿了么', JD: '京东', OFFLINE: '线下' }
const channelColors: Record<string, string> = { WECHAT: 'var(--color-success)', DOUYIN: 'var(--text-primary)', MEITUAN: 'var(--color-warning)', ELEME: 'var(--color-primary)', JD: 'var(--color-danger)', OFFLINE: 'var(--gray-500)' }
const channelSoftColors: Record<string, string> = { WECHAT: 'var(--color-success-soft)', DOUYIN: 'var(--bg-soft)', MEITUAN: 'var(--color-warning-soft)', ELEME: 'var(--color-primary-soft)', JD: 'var(--color-danger-soft)', OFFLINE: 'var(--gray-100)' }

const mockStats = { todayOrders: 128, todayAmount: 35680, pendingCount: 23, exceptionCount: 5 }

const mockOrders = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  channelOrderNo: `CH${String(i + 1).padStart(6, '0')}`,
  channelType: channelTypes[(i % 6) + 1],
  channelStatus: 'PAID',
  customerName: `客户${i + 1}`,
  customerPhone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
  productSummary: `商品A x2, 商品B x1, 商品C x3`,
  totalAmount: Math.floor(Math.random() * 500 + 100),
  orderStatus: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'][i % 4],
  paymentStatus: ['PAID', 'UNPAID', 'REFUNDED'][i % 3],
  createdAt: `2026-07-01 ${String(i + 8).padStart(2, '0')}:00:00`
}))

const mockChannelDistribution = [
  { channel: 'WECHAT', name: '微信', count: 45, ratio: 35.2 },
  { channel: 'MEITUAN', name: '美团', count: 32, ratio: 25.0 },
  { channel: 'ELEME', name: '饿了么', count: 22, ratio: 17.2 },
  { channel: 'DOUYIN', name: '抖音', count: 15, ratio: 11.7 },
  { channel: 'JD', name: '京东', count: 10, ratio: 7.8 },
  { channel: 'OFFLINE', name: '线下', count: 4, ratio: 3.1 }
]

const mockOrderTrend = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 2).padStart(2, '0')}`,
  count: Math.floor(Math.random() * 30 + 10)
}))

// ─── 渠道Tab ───
const activeChannel = ref('ALL')
const channelTabs = computed(() => {
  const counts: Record<string, number> = {}
  mockOrders.forEach(o => {
    counts[o.channelType] = (counts[o.channelType] || 0) + 1
  })
  return channelTypes.map(ch => ({
    type: ch,
    name: channelNames[ch],
    todayCount: ch === 'ALL' ? mockOrders.length : (counts[ch] || 0)
  }))
})

const channelOptions = channelTypes.filter(c => c !== 'ALL').map(c => ({ label: channelNames[c], value: c }))

function onChannelChange() {
  currentPage.value = 1
}

// ─── 筛选 ───
const filterChannel = ref('')
const filterOrderStatus = ref('')
const filterPaymentStatus = ref('')
const filterDateRange = ref<string[]>([])
const filterKeyword = ref('')

const filteredOrders = computed(() => {
  let list = mockOrders
  if (activeChannel.value !== 'ALL') {
    list = list.filter(o => o.channelType === activeChannel.value)
  }
  if (filterChannel.value) {
    list = list.filter(o => o.channelType === filterChannel.value)
  }
  if (filterOrderStatus.value) {
    list = list.filter(o => o.orderStatus === filterOrderStatus.value)
  }
  if (filterPaymentStatus.value) {
    list = list.filter(o => o.paymentStatus === filterPaymentStatus.value)
  }
  if (filterKeyword.value) {
    const kw = filterKeyword.value.toLowerCase()
    list = list.filter(o => o.channelOrderNo.toLowerCase().includes(kw) || o.customerName.toLowerCase().includes(kw))
  }
  return list
})

const currentPage = ref(1)
const pageSize = ref(10)
const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredOrders.value.slice(start, start + pageSize.value)
})

function handleFilter() {
  currentPage.value = 1
  ElMessage.success('筛选完成')
}

function handleExport() {
  ElMessage.success('导出功能暂未实现（使用 mock 数据）')
}

// ─── 订单状态映射 ───
function orderStatusType(status: string) {
  const map: Record<string, string> = { PENDING: 'warning', CONFIRMED: 'primary', COMPLETED: 'success', CANCELLED: 'info' }
  return map[status] || 'info'
}
function orderStatusLabel(status: string) {
  const map: Record<string, string> = { PENDING: '待处理', CONFIRMED: '已确认', COMPLETED: '已完成', CANCELLED: '已取消' }
  return map[status] || status
}

// ─── 详情抽屉 ───
const detailVisible = ref(false)
const currentOrder = ref<any>(null)

const orderItems = ref([
  { channelProductName: '招牌奶茶', localProductName: '招牌奶茶(大杯)', price: 18, quantity: 2 },
  { channelProductName: '珍珠奶茶', localProductName: '珍珠奶茶(中杯)', price: 15, quantity: 1 },
  { channelProductName: '椰果奶茶', localProductName: '椰果奶茶(大杯)', price: 20, quantity: 3 }
])

function viewDetail(row: any) {
  currentOrder.value = row
  detailVisible.value = true
}

function handleSync(row: any) {
  ElMessage.success(`订单 ${row.channelOrderNo} 手动同步成功`)
}

// ─── 渠道占比饼图 ───
const channelPieChartRef = ref<HTMLDivElement | null>(null)
let channelPieChart: echarts.ECharts | null = null

function initChannelPieChart() {
  if (!channelPieChartRef.value) return
  if (channelPieChart) channelPieChart.dispose()
  channelPieChart = echarts.init(channelPieChartRef.value)
  channelPieChart.setOption({
    title: { text: '渠道占比', left: 'center', top: 0, textStyle: { fontSize: 13, fontWeight: 'normal' } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '55%'],
      label: { show: false },
      data: mockChannelDistribution.map(d => ({ name: d.name, value: d.count }))
    }]
  })
}

// ─── 订单趋势折线图 ───
const orderTrendChartRef = ref<HTMLDivElement | null>(null)
let orderTrendChart: echarts.ECharts | null = null

function initOrderTrendChart() {
  if (!orderTrendChartRef.value) return
  if (orderTrendChart) orderTrendChart.dispose()
  orderTrendChart = echarts.init(orderTrendChartRef.value)
  orderTrendChart.setOption({
    title: { text: '订单趋势(近30天)', left: 'center', top: 0, textStyle: { fontSize: 13, fontWeight: 'normal' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 10, top: 30, bottom: 20 },
    xAxis: { type: 'category', data: mockOrderTrend.map(d => d.date.slice(5)), axisLabel: { fontSize: 9, interval: 4 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
    series: [{
      type: 'line', data: mockOrderTrend.map(d => d.count),
      smooth: true, symbol: 'none', lineStyle: { color: CHART_COLORS.primary, width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(63,111,239,0.3)' }, { offset: 1, color: 'rgba(63,111,239,0.05)' }]) }
    }]
  })
}

// ─── 图表生命周期 ───
function handleResize() {
  channelPieChart?.resize()
  orderTrendChart?.resize()
}

function disposeAllCharts() {
  channelPieChart?.dispose()
  orderTrendChart?.dispose()
  channelPieChart = null
  orderTrendChart = null
}

onMounted(() => {
  initChannelPieChart()
  initOrderTrendChart()
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

.channel-tab-card {
  margin-bottom: 16px;
}

.channel-badge {
  margin-left: 6px;
}

.chart-row {
  margin-bottom: 16px;
}

.chart-mini-box {
  width: 100%;
  height: 180px;
}

.table-card {
  margin-bottom: 16px;
}

.amount-text {
  color: var(--color-danger);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.detail-card {
  margin-bottom: 16px;
}

.json-block {
  background: var(--bg-page);
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  margin: 0;
}
</style>
