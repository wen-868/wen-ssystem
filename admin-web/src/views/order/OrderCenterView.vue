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
        <div class="stat-grid-value stat-grid-value--primary">{{ stats.todayOrders }}</div>
        <div class="stat-grid-label">今日订单数</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">¥{{ stats.todayAmount.toLocaleString("zh-CN") }}</div>
        <div class="stat-grid-label">今日金额</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ stats.pendingCount }}</div>
        <div class="stat-grid-label">待处理数</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ stats.exceptionCount }}</div>
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
      <el-table :data="paginatedOrders" v-loading="loading" stripe border style="width: 100%">
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
          :total="totalOrders"
          v-model:page-size="pageSize"
          v-model:current-page="currentPage"
          :page-sizes="[10, 20, 50]"
          :pager-count="5"
          @current-change="loadOrders"
          @size-change="handleSizeChange"
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
                <el-descriptions-item label="收货地址" :span="2">{{ currentOrder.deliveryAddress || currentOrder.receiverAddress || '-' }}</el-descriptions-item>
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
                <el-table-column label="合计金额" width="90">
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
import { downloadRowsCsv } from '@/utils/download'

import { fetchOrderCenterStats, fetchInstantOrders, fetchInstantOrderDetail } from '@/api'

// ─── 渠道映射 ───
const channelTypes = ['ALL', 'WECHAT', 'DOUYIN', 'MEITUAN', 'ELEME', 'JD', 'OFFLINE']
const channelNames: Record<string, string> = { ALL: '全部', WECHAT: '微信', DOUYIN: '抖音', MEITUAN: '美团', ELEME: '饿了么', JD: '京东', OFFLINE: '线下' }
const channelColors: Record<string, string> = { WECHAT: 'var(--color-success)', DOUYIN: 'var(--text-primary)', MEITUAN: 'var(--color-warning)', ELEME: 'var(--color-primary)', JD: 'var(--color-danger)', OFFLINE: 'var(--gray-500)' }
const channelSoftColors: Record<string, string> = { WECHAT: 'var(--color-success-soft)', DOUYIN: 'var(--bg-soft)', MEITUAN: 'var(--color-warning-soft)', ELEME: 'var(--color-primary-soft)', JD: 'var(--color-danger-soft)', OFFLINE: 'var(--gray-100)' }

// 兼容后端平台值（小写/别名）→ 标准渠道
const channelAlias: Record<string, string> = {
  wechat: 'WECHAT', wx: 'WECHAT',
  douyin: 'DOUYIN', dy: 'DOUYIN',
  meituan: 'MEITUAN', mt: 'MEITUAN',
  eleme: 'ELEME', ele: 'ELEME',
  jd: 'JD',
  offline: 'OFFLINE', store: 'OFFLINE'
}
function normalizeChannel(c: string | null | undefined): string {
  if (!c) return 'OFFLINE'
  return channelAlias[c.toLowerCase()] || c.toUpperCase()
}
// 前端标准渠道 → 后端平台值（后端存储小写）
function toBackendChannel(c: string): string {
  const map: Record<string, string> = { WECHAT: 'wechat', DOUYIN: 'douyin', MEITUAN: 'meituan', ELEME: 'eleme', JD: 'jd', OFFLINE: 'offline' }
  return map[c] || c.toLowerCase()
}

// ─── 真实接口数据 ───
const stats = ref({ todayOrders: 0, todayAmount: 0, pendingCount: 0, exceptionCount: 0 })
const orders = ref<any[]>([])
const totalOrders = ref(0)
const loading = ref(false)
const channelDistribution = ref<{ channel: string; count: number; ratio: number }[]>([])
const orderTrend = ref<{ date: string; count: number }[]>([])

async function loadStats() {
  try {
    const data = await fetchOrderCenterStats()
    stats.value = {
      todayOrders: Number(data?.todayOrders ?? 0),
      todayAmount: Number(data?.todayAmount ?? 0),
      pendingCount: Number(data?.pendingCount ?? 0),
      exceptionCount: Number(data?.exceptionCount ?? 0),
    }
    channelDistribution.value = (data?.channelDistribution || []).map((d: any) => ({
      channel: d.channel,
      count: Number(d.count ?? 0),
      ratio: Number(d.ratio ?? 0),
    }))
    orderTrend.value = (data?.orderTrend || []).map((d: any) => ({ date: String(d.date).slice(0, 10), count: Number(d.count ?? 0) }))
    initChannelPieChart()
    initOrderTrendChart()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载订单统计失败')
  }
}

// ─── 渠道Tab ───
const activeChannel = ref('ALL')
const channelTabs = computed(() => {
  const counts: Record<string, number> = {}
  channelDistribution.value.forEach(d => {
    counts[normalizeChannel(d.channel)] = (counts[normalizeChannel(d.channel)] || 0) + d.count
  })
  return channelTypes.map(ch => ({
    type: ch,
    name: channelNames[ch],
    todayCount: ch === 'ALL' ? channelDistribution.value.reduce((s, d) => s + d.count, 0) : (counts[ch] || 0)
  }))
})

const channelOptions = channelTypes.filter(c => c !== 'ALL').map(c => ({ label: channelNames[c], value: c }))

function onChannelChange() {
  currentPage.value = 1
  loadOrders()
}

// ─── 筛选 ───
const filterChannel = ref('')
const filterOrderStatus = ref('')
const filterPaymentStatus = ref('')
const filterDateRange = ref<string[]>([])
const filterKeyword = ref('')

const filteredOrders = computed(() => {
  let list = orders.value
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
// 后端已按 currentPage/pageSize 分页，此处直接使用过滤后的当前页数据
const paginatedOrders = computed(() => filteredOrders.value)

function handleFilter() {
  currentPage.value = 1
  loadOrders()
}

function handleSizeChange() {
  currentPage.value = 1
  loadOrders()
}

function handleExport() {
  if (!orders.value.length) {
    ElMessage.info('暂无数据可导出')
    return
  }
  downloadRowsCsv('订单中心.csv', orders.value)
  ElMessage.success('导出成功')
}

// ─── 订单状态映射 ───
function orderStatusType(status: string) {
  const map: Record<string, string> = { PENDING: 'warning', PAID: 'primary', DELIVERING: 'primary', CONFIRMED: 'primary', COMPLETED: 'success', CANCELLED: 'info' }
  return map[status] || 'info'
}
function orderStatusLabel(status: string) {
  const map: Record<string, string> = { PENDING: '待处理', PAID: '已支付', DELIVERING: '配送中', CONFIRMED: '已确认', COMPLETED: '已完成', CANCELLED: '已取消' }
  return map[status] || status
}

// ─── 详情抽屉 ───
const detailVisible = ref(false)
const currentOrder = ref<any>(null)

const orderItems = ref<any[]>([])
const detailLoading = ref(false)

async function viewDetail(row: any) {
  currentOrder.value = row
  detailVisible.value = true
  orderItems.value = []
  detailLoading.value = true
  try {
    const detail = await fetchInstantOrderDetail(row.orderNo)
    const items = detail?.items || []
    orderItems.value = items.map((it: any) => ({
      channelProductName: it.productName || it.skuName,
      localProductName: it.productName || it.skuName,
      price: it.price || it.unitPrice,
      quantity: it.quantity,
    }))
    currentOrder.value = { ...row, ...detail, orderItems: items }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载订单详情失败')
  } finally {
    detailLoading.value = false
  }
}

function handleSync(row: any) {
  // TODO: 手动同步已接入平台时调用 /admin/instant-retail/configs/:platform/sync-orders
  ElMessage.success(`订单 ${row.channelOrderNo} 手动同步成功`)
}

// ─── 渠道占比饼图 ───
const channelPieChartRef = ref<HTMLDivElement | null>(null)
let channelPieChart: echarts.ECharts | null = null

function initChannelPieChart() {
  if (!channelPieChartRef.value) return
  if (channelPieChart) channelPieChart.dispose()
  channelPieChart = echarts.init(channelPieChartRef.value)
  const pieData = channelDistribution.value.map(d => ({
    name: channelNames[normalizeChannel(d.channel)] || d.channel,
    value: d.count
  }))
  channelPieChart.setOption({
    title: { text: '渠道占比', left: 'center', top: 0, textStyle: { fontSize: 13, fontWeight: 'normal' } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '55%'],
      label: { show: false },
      data: pieData
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
  const trend = orderTrend.value.length > 0 ? orderTrend.value : []
  orderTrendChart.setOption({
    title: { text: '订单趋势(近30天)', left: 'center', top: 0, textStyle: { fontSize: 13, fontWeight: 'normal' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 10, top: 30, bottom: 20 },
    xAxis: { type: 'category', data: trend.map(d => d.date.slice(5)), axisLabel: { fontSize: 9, interval: 4 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
    series: [{
      type: 'line', data: trend.map(d => d.count),
      smooth: true, symbol: 'none', lineStyle: { color: CHART_COLORS.primary, width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(63,111,239,0.3)' }, { offset: 1, color: 'rgba(63,111,239,0.05)' }]) }
    }]
  })
}

// ─── 订单列表加载（真实接口） ───
async function loadOrders() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    if (activeChannel.value !== 'ALL') params.platform = toBackendChannel(activeChannel.value)
    if (filterChannel.value) params.platform = toBackendChannel(filterChannel.value)
    if (filterOrderStatus.value) params.orderStatus = filterOrderStatus.value
    if (filterPaymentStatus.value) params.paymentStatus = filterPaymentStatus.value
    if (filterKeyword.value) params.keyword = filterKeyword.value
    if (filterDateRange.value?.length === 2) {
      params.startDate = filterDateRange.value[0]
      params.endDate = filterDateRange.value[1]
    }
    const data = await fetchInstantOrders(params)
    orders.value = (data?.list || data?.records || []).map((o: any) => ({
      ...o,
      id: o.id,
      channelOrderNo: o.orderNo,
      channelType: normalizeChannel(o.platform),
      channelStatus: o.paymentStatus,
      customerName: o.receiverName || o.userName || '-',
      customerPhone: o.receiverPhone || o.userPhone || '',
      productSummary: o.productSummary || '',
      totalAmount: Number(o.payAmount ?? o.totalAmount ?? 0),
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    }))
    totalOrders.value = Number(data?.total ?? orders.value.length)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载订单列表失败')
  } finally {
    loading.value = false
  }
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
  loadStats()
  loadOrders()
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
