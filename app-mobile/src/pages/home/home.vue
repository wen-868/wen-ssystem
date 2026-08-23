<template>
  <scroll-view class="home-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 搜索栏（UI1.2：扫码/订单/消息三入口，40px 热区） -->
    <view class="search-bar" @tap="navigateTo('/pages/products/products')">
      <image class="search-bar-icon" src="/static/icons/sc-search.svg" mode="aspectFit" />
      <text class="search-bar-placeholder">搜索商品、订单、客户名称</text>
      <view class="search-actions">
        <view class="icon-btn" @tap.stop="navigateTo('/pages/sales/create-sale')">
          <image class="icon-btn-img" src="/static/icons/hd-scan.svg" mode="aspectFit" />
        </view>
        <view class="icon-btn" @tap.stop="navigateTo('/pages/orders/orders')">
          <image class="icon-btn-img" src="/static/icons/hd-order.svg" mode="aspectFit" />
        </view>
        <view class="icon-btn" @tap.stop="navigateTo('/pages/notifications/notifications')">
          <image class="icon-btn-img" src="/static/icons/hd-bell.svg" mode="aspectFit" />
          <view class="icon-btn-dot" v-if="unreadCount > 0"></view>
        </view>
      </view>
    </view>

    <!-- 数据卡（今日营业额 / 今日订单 + 环比） -->
    <view class="home-data">
      <view class="home-data-top">
        <view class="home-data-item home-data-item--main">
          <text class="home-data-label">今日营业额</text>
          <text class="home-data-val">¥{{ formatFull(stats.todaySales) }}</text>
          <view class="home-data-trend up">
            <text class="trend-arrow">▲</text>
            <text class="trend-text">{{ stats.todaySales > 0 ? '实时' : '—' }}</text>
          </view>
        </view>
        <view class="home-data-item home-data-item--sub">
          <text class="home-data-label">今日订单</text>
          <text class="home-data-val">{{ stats.todayOrders }}</text>
          <view class="home-data-trend up">
            <text class="trend-arrow">▲</text>
            <text class="trend-text">{{ stats.todayOrders }}单</text>
          </view>
        </view>
      </view>
      <view class="home-data-div"></view>
      <view class="home-data-bot">
        <view class="db-item">
          <text class="db-label">本月营业额</text>
          <text class="db-val">¥{{ formatCn(stats.monthSales) }}</text>
        </view>
        <view class="db-item">
          <text class="db-label">本月订单</text>
          <text class="db-val">{{ stats.monthOrders }}</text>
        </view>
        <view class="db-item">
          <text class="db-label">总客户数</text>
          <text class="db-val">{{ formatFull(stats.customerCount) }}</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口（原稿 hq-row：快速开单/单据管理/扫码入库/会员管理） -->
    <view class="home-quick">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">快捷入口</text>
        </view>
      </view>
      <view class="hq-row">
        <view class="hq-item" @tap="navigateTo('/pages/sales/create-sale')">
          <view class="hq-ico">
            <image class="hq-ico-img" src="/static/icons/fn-open.svg" mode="aspectFit" />
          </view>
          <text class="hq-label">快速开单</text>
        </view>
        <view class="hq-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hq-ico">
            <image class="hq-ico-img" src="/static/icons/fn-order.svg" mode="aspectFit" />
          </view>
          <text class="hq-label">单据管理</text>
        </view>
        <view class="hq-item" @tap="navigateTo('/pages-sub/finance/purchase/in-stock')">
          <view class="hq-ico">
            <image class="hq-ico-img" src="/static/icons/ic/scan.svg" mode="aspectFit" />
          </view>
          <text class="hq-label">扫码入库</text>
        </view>
        <view class="hq-item" @tap="navigateTo('/pages-sub/marketing/member/member-list')">
          <view class="hq-ico">
            <image class="hq-ico-img" src="/static/icons/fn-member.svg" mode="aspectFit" />
          </view>
          <text class="hq-label">会员管理</text>
        </view>
      </view>
    </view>

    <!-- 订单进度四宫格（原稿：四色 tint 卡片，无查看全部） -->
    <view class="home-progress">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">订单进度</text>
        </view>
      </view>
      <view class="hp-row">
        <view class="hp-item hp-item--warning" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--orange">
            <image class="hp-ico-img" src="/static/icons/hp-deliver.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingDelivery }}</text>
          <text class="hp-label">待配送</text>
        </view>
        <view class="hp-item hp-item--primary" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--blue">
            <image class="hp-ico-img" src="/static/icons/hp-pickup.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingPickup }}</text>
          <text class="hp-label">待取货</text>
        </view>
        <view class="hp-item hp-item--purple" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--purple">
            <image class="hp-ico-img" src="/static/icons/hp-payment.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingPayment }}</text>
          <text class="hp-label">待收款</text>
        </view>
        <view class="hp-item hp-item--success" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--green">
            <image class="hp-ico-img" src="/static/icons/hp-complete.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.completedToday }}</text>
          <text class="hp-label">已完成</text>
        </view>
      </view>
    </view>

    <!-- 今日待办（原稿：色点 + 计数行，真实数据：订单状态 + 库存预警） -->
    <view class="home-todos" v-if="todoRows.length > 0">
      <view class="todo-head">
        <view class="todo-head-title">
          <image class="todo-check-ic" src="/static/icons/ic/check.svg" mode="aspectFit" />
          <text class="todo-title-main">今日待办</text>
        </view>
        <text class="todo-count">{{ todoTotal }}项需处理</text>
      </view>
      <view class="todo-rows">
        <view class="todo-row" v-for="row in todoRows" :key="row.label">
          <view class="todo-row-dot" :style="{ background: row.color }"></view>
          <text class="todo-row-text">
            <text class="todo-row-num" :style="{ color: row.color }">{{ row.count }}</text>
            {{ row.label }}
          </text>
        </view>
      </view>
    </view>

    <!-- 最新订单 -->
    <view class="home-orders" v-if="recentOrders.length > 0">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">最新订单</text>
        </view>
        <text class="section-more" @tap="navigateTo('/pages/orders/orders')">查看全部 ›</text>
      </view>
      <view class="ho-item" v-for="order in recentOrders" :key="order.orderNo" @tap="navigateTo('/pages/orders/orders')">
        <view class="ho-info">
          <view class="ho-name">
            {{ order.customerName }}
            <text class="ho-channel">{{ order.channel }}</text>
          </view>
          <view class="ho-meta">{{ order.orderNo }} · {{ order.time }}</view>
        </view>
        <view class="ho-right">
          <view class="ho-amount">¥{{ formatFull(order.amount) }}</view>
          <text class="ho-status badge" :class="statusBadgeClass(order.status)">{{ order.statusText }}</text>
        </view>
      </view>
    </view>

    <!-- 7 日趋势 -->
    <view class="home-chart">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">7日趋势</text>
        </view>
        <text class="chart-daily" v-if="trendList.length > 0">日均 ¥{{ formatFull(averageDaily) }}</text>
      </view>
      <view class="chart-wrap" v-if="trendList.length > 0">
        <!-- 原稿 drawChart：平滑贝塞尔折线 + 渐变面积 + 三条网格线 + 均值虚线 + 末点脉冲 -->
        <svg class="chart-svg" viewBox="0 0 340 140" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2563EB" stop-opacity="0.15" />
              <stop offset="50%" stop-color="#2563EB" stop-opacity="0.05" />
              <stop offset="100%" stop-color="#2563EB" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line v-for="(gy, i) in chartMeta.gridYs" :key="'g' + i" x1="10" :y1="gy" x2="330" :y2="gy" stroke="rgba(0,0,0,0.03)" stroke-width="1" />
          <line x1="10" :y1="chartMeta.avgY" x2="330" :y2="chartMeta.avgY" stroke="#2563EB" stroke-width="0.8" stroke-dasharray="4,4" opacity="0.15" />
          <text :x="330" :y="chartMeta.avgY - 5" text-anchor="end" font-size="11" font-weight="600" fill="#2563EB" opacity="0.55">均 {{ formatCn(averageDaily) }}</text>
          <path :d="chartMeta.area" fill="url(#chartArea)" />
          <path :d="chartMeta.line" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle v-for="(p, i) in chartMeta.dots" :key="'d' + i" :cx="p.x" :cy="p.y" :r="p.r" fill="#fff" stroke="#2563EB" stroke-width="2" />
          <circle :cx="chartMeta.lastDot.x" :cy="chartMeta.lastDot.y" r="10" fill="#2563EB" opacity="0.06" class="chart-pulse" />
          <text :x="chartMeta.lastDot.x" :y="chartMeta.lastDot.y - 12" text-anchor="middle" fill="#2563EB" font-size="10" font-weight="700">{{ formatCn(chartMeta.lastVal) }}</text>
        </svg>
      </view>
      <view class="chart-labels" v-if="trendList.length > 0">
        <text class="chart-label" v-for="(item, idx) in trendList" :key="idx">{{ item.date }}</text>
      </view>
      <view class="chart-empty" v-else>
        <text class="chart-empty-text">暂无趋势数据</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
    <view class="beian-footer">
      <text class="beian-footer-text">粤ICP备2026103101号-2A</text>
      <view class="beian-row">
        <image class="beian-icon" src="/static/gongan.png" mode="aspectFit" />
        <text class="beian-footer-text">粤公网安备44030002015715号</text>
      </view>
    </view>
    <custom-tab-bar :current="'home'" />
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { dashboardApi, type TodoItem, type SalesTrend } from '@/api/modules/dashboard'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'
import { notificationsApi } from '@/api/modules/notifications'
import { reportsApi } from '@/api/modules/reports'
import { inventoryApi } from '@/api/modules/inventory'
import CustomTabBar from '@/components/custom-tab-bar.vue'

interface DashboardData {
  todaySales: number
  todayOrders: number
  monthSales: number
  monthOrders: number
  monthProfit: number
  customerCount: number
  pendingDelivery: number
  pendingPickup: number
  pendingPayment: number
  completedToday: number
}

interface HomeOrder {
  orderNo: string
  customerName: string
  channel: string
  time: string
  amount: number
  status: string
  statusText: string
}

const stats = ref<DashboardData>({
  todaySales: 0,
  todayOrders: 0,
  monthSales: 0,
  monthOrders: 0,
  monthProfit: 0,
  customerCount: 0,
  pendingDelivery: 0,
  pendingPickup: 0,
  pendingPayment: 0,
  completedToday: 0
})

const todos = ref<TodoItem[]>([])
const alertCount = ref(0)
const recentOrders = ref<HomeOrder[]>([])
const trendList = ref<SalesTrend[]>([])
const refresherTriggered = ref(false)
const unreadCount = ref(0)

/** 原稿今日待办行：真实数据（待配送/库存预警/待收款） */
const todoRows = computed(() => {
  const rows = [
    { count: stats.value.pendingDelivery, label: '单待配送', color: '#C8803A' },
    { count: alertCount.value, label: '件库存预警商品', color: '#C45050' },
    { count: stats.value.pendingPayment, label: '笔待收款', color: '#2563EB' }
  ]
  return rows.filter((r) => r.count > 0)
})

const todoTotal = computed(() => todoRows.value.reduce((acc, r) => acc + r.count, 0))

const averageDaily = computed(() => {
  if (trendList.value.length === 0) return 0
  const sum = trendList.value.reduce((acc, item) => acc + item.amount, 0)
  return sum / trendList.value.length
})

const maxTrendAmount = computed(() => {
  if (trendList.value.length === 0) return 1
  return Math.max(...trendList.value.map((item) => item.amount), 1)
})

/** 原稿 drawChart 的 SVG 几何：平滑贝塞尔折线 + 面积 + 均线 + 网格 */
const chartMeta = computed(() => {
  const data = trendList.value.map((t) => t.amount)
  const n = data.length
  const w = 340
  const h = 140
  const pad = { t: 20, b: 20, l: 10, r: 10 }
  const uw = w - pad.l - pad.r
  const uh = h - pad.t - pad.b
  const empty = { line: '', area: '', avgY: h - pad.b, gridYs: [] as number[], dots: [] as Array<{ x: number; y: number; r: number }>, lastDot: { x: 0, y: 0 }, lastVal: 0 }
  if (n < 2) return empty
  const min = Math.min(...data) * 0.88
  const max = Math.max(...data) * 1.06
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (n - 1)) * uw,
    y: pad.t + uh - ((v - min) / range) * uh
  }))
  let line = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    line += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  const area = `${line} L${pts[n - 1].x.toFixed(1)},${h - pad.b} L${pts[0].x.toFixed(1)},${h - pad.b} Z`
  const avg = data.reduce((a, b) => a + b, 0) / n
  const avgY = pad.t + uh - ((avg - min) / range) * uh
  const gridYs = [0, 1, 2].map((g) => pad.t + (uh / 3) * g)
  const dots = pts.slice(0, -1).map((p, i) => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), r: i === 0 ? 3 : 3 }))
  return {
    line,
    area,
    avgY: +avgY.toFixed(1),
    gridYs: gridYs.map((y) => +y.toFixed(1)),
    dots,
    lastDot: { x: +pts[n - 1].x.toFixed(1), y: +pts[n - 1].y.toFixed(1) },
    lastVal: data[n - 1]
  }
})

/** 千分位整数金额：12,680（数据卡主数字/订单金额） */
function formatFull(amount: number): string {
  return Math.round(amount || 0).toLocaleString()
}

/** 中文缩写金额：≥1万用「万」（图表数值标签，spec13 一致性） */
function formatCn(amount: number): string {
  const v = amount || 0
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : Math.round(v).toLocaleString()
}

function barHeight(amount: number): string {
  const ratio = maxTrendAmount.value > 0 ? amount / maxTrendAmount.value : 0
  const height = Math.max(8, Math.round(ratio * 120))
  return height + 'rpx'
}
void barHeight

function statusBadgeClass(status: string): string {
  const s = String(status || '').toUpperCase()
  if (s === 'DONE' || s === 'COMPLETED' || s === '已完成' || s === '已支付') return 'badge-green'
  if (s === 'PENDING_PAYMENT' || s === 'PENDING' || s === 'UNPAID' || s === '待付款' || s === '待处理') return 'badge-red'
  if (s === 'ACCEPTED' || s === 'DELIVERING' || s === '待配送' || s === '配送中') return 'badge-orange'
  if (s === 'CANCELLED' || s === 'REFUNDED' || s === '已取消') return 'badge-gray'
  return 'badge-green'
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function formatOrderTime(createdAt?: string): string {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt.slice(5, 16)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 趋势日期格式化为 M/D（设计稿 chart-labels：1/10、1/11…） */
function formatTrendDate(d: string): string {
  if (!d) return ''
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${Number(m[2])}/${Number(m[3])}`
  return d
}

async function loadData() {
  try {
    const [statsData, todosData, trendData, orderResult, unreadResult, summaryResult, alertResult] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTodos(),
      dashboardApi.getSalesTrend(7),
      ordersApi.list({ page: 1, pageSize: 4 }).catch(() => null),
      notificationsApi.getUnreadCount().catch(() => null),
      reportsApi.getSalesSummary().catch(() => null),
      inventoryApi.alerts().catch(() => [] as never[])
    ])
    unreadCount.value = unreadResult?.total ?? 0
    alertCount.value = Array.isArray(alertResult) ? alertResult.length : 0
    const s = statsData as any
    stats.value = {
      todaySales: s.todaySales || 0,
      todayOrders: s.todayOrders || 0,
      monthSales: s.monthSales || s.monthTotal || 0,
      monthOrders: s.monthOrders || 0,
      monthProfit: s.monthProfit || s.monthGrossProfit || 0,
      customerCount: summaryResult?.customerCount || 0,
      pendingDelivery: s.pendingDelivery || s.toDeliver || 0,
      pendingPickup: s.pendingPickup || s.toPickup || 0,
      pendingPayment: s.pendingPayment || s.toCollect || 0,
      completedToday: s.completedToday || 0
    }
    todos.value = todosData.slice(0, 4)
    trendList.value = trendData.slice(0, 7).map((t) => ({ ...t, date: formatTrendDate(t.date) }))
    const rows = orderResult?.list ?? []
    recentOrders.value = (rows as OrderInfo[]).slice(0, 4).map((o) => ({
      orderNo: o.orderNo || '',
      customerName: o.customerName || '客户',
      channel: o.channel || '门店',
      time: formatOrderTime(o.createdAt || o.createTime),
      amount: Number(o.totalAmount ?? o.receivableAmount ?? 0),
      status: o.status || '',
      statusText: o.statusLabel || o.status || ''
    }))
  } catch (err) {
    console.error('加载首页数据失败:', err)
  }
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await loadData()
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 隐藏 H5 滚动条（原稿 ::-webkit-scrollbar display:none，含 uni-scroll-view 内层容器） */
.home-page ::-webkit-scrollbar,
.home-page .uni-scroll-view ::-webkit-scrollbar,
uni-scroll-view ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 搜索栏 */
.search-bar {
  margin: 20rpx 28rpx 0;
  height: 84rpx;
  background: $uni-bg-color;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  gap: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.search-bar-icon {
  width: 34rpx;
  height: 34rpx;
  flex-shrink: 0;
}

.search-bar-placeholder {
  flex: 1;
  font-size: 26rpx;
  color: $uni-gray-500;
}

/* 三入口图标按钮：视觉 36rpx，热区 72rpx（spec12 触摸目标） */
.search-actions {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

/* 三入口图标按钮：视觉 36rpx，热区 80rpx=40px（原稿 icon-btn） */
.icon-btn {
  width: 80rpx;
  height: 80rpx;
  margin: -10rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  position: relative;
  transition: transform 0.15s ease;
}

.icon-btn:active {
  transform: scale(0.88);
}

.icon-btn-img {
  width: 36rpx;
  height: 36rpx;
}

.icon-btn-dot {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: $uni-color-error;
  border: 3rpx solid $uni-bg-color;
}

/* 数据卡 */
.home-data {
  margin: 32rpx 28rpx 0;
  background: #F0F5FF;
  border-radius: 40rpx;
  padding: 48rpx 44rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(37, 99, 235, 0.06), 0 2rpx 6rpx rgba(0, 0, 0, 0.04);
  border: 1rpx solid rgba(37, 99, 235, 0.08);
}

.home-data-top {
  display: flex;
  gap: 0;
}

.home-data-item {
  flex: 1;
}

/* 设计稿 v1.2：营业额占 2/3，订单占 1/3 居中 */
.home-data-item--main {
  flex: 2;
}

.home-data-item--sub {
  flex: 1;
  text-align: center;
}

.home-data-item--sub .home-data-trend {
  justify-content: center;
}

.home-data-label {
  font-size: 22rpx;
  color: $uni-gray-500;
  font-weight: 500;
  letter-spacing: 1rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* 原稿：标签前置 14×1px 蓝色短横线 */
.home-data-label::before {
  content: '';
  width: 28rpx;
  height: 2rpx;
  border-radius: 2rpx;
  background: rgba(37, 99, 235, 0.2);
  flex-shrink: 0;
}

.home-data-item--main .home-data-label {
  padding-left: 52rpx;
}

.home-data-item--main .home-data-val {
  padding-left: 10rpx;
}

.home-data-item--main .home-data-trend {
  padding-left: 66rpx;
}

.home-data-item--sub .home-data-label {
  justify-content: center;
}

.home-data-val {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  margin-top: 16rpx;
  color: $uni-color-primary;
  line-height: 1.1;
  letter-spacing: -1rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.home-data-trend {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
}

.home-data-trend.up {
  color: #047857;
}

.home-data-trend.up .trend-text {
  color: #047857;
}

.trend-arrow {
  font-size: 18rpx;
}

.trend-text {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.home-data-div {
  height: 1rpx;
  background: rgba(37, 99, 235, 0.12);
  margin: 36rpx 0 28rpx;
}

/* 原稿主项错落缩进：val 缩 5px、trend 缩 33px */
.home-data-item--main .home-data-val {
  padding-left: 10rpx;
}

.home-data-item--main .home-data-trend {
  padding-left: 66rpx;
}

.home-data-bot {
  display: flex;
}

/* 三项居中 + 渐变竖分隔线（原稿：db-item 全部 text-align:center） */
.db-item {
  flex: 1;
  text-align: center;
  position: relative;
}

.db-item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 12rpx;
  bottom: 12rpx;
  width: 1rpx;
  background: linear-gradient(180deg, transparent, rgba(37, 99, 235, 0.08), transparent);
}

.db-label {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.db-val {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  margin-top: 10rpx;
  color: $uni-color-primary;
  letter-spacing: -0.6rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

/* 快捷入口（原稿 home-quick：白卡 + 4 宫格 + 蓝色线框图标） */
.home-quick {
  margin: 32rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 36rpx 32rpx 16rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

/* 快捷入口标题 14px、间距对齐原稿 h3 */
.home-quick .section-title {
  font-size: 28rpx;
}

.home-quick .section-head {
  margin-bottom: 28rpx;
}

.hq-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
}

.hq-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 8rpx 20rpx;
  border-radius: 24rpx;
}

.hq-item:active {
  background: rgba(0, 0, 0, 0.03);
}

.hq-ico {
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  background: $uni-color-primary-light;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hq-ico-img {
  width: 44rpx;
  height: 44rpx;
}

.hq-label {
  font-size: 24rpx;
  color: $uni-text-color-secondary;
  font-weight: 500;
}

/* 通用区块 */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 32rpx;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.title-bar-line {
  width: 8rpx;
  height: 32rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-text-color;
  letter-spacing: -0.5rpx;
}

.section-more {
  font-size: 24rpx;
  color: $uni-gray-500;
}

/* 订单进度（原稿：白色卡片包裹标题 + 四色 tint 宫格） */
.home-progress {
  margin: 32rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 40rpx 36rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.hp-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.hp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28rpx 16rpx;
  border-radius: 32rpx;
  background: rgba(0, 0, 0, 0.015);
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.hp-item:active {
  transform: scale(0.95);
}

.hp-item--warning {
  background: rgba(200, 128, 58, 0.04);
  border-color: rgba(200, 128, 58, 0.08);
}

.hp-item--primary {
  background: rgba(37, 99, 235, 0.03);
  border-color: rgba(37, 99, 235, 0.06);
}

.hp-item--purple {
  background: rgba(124, 58, 237, 0.03);
  border-color: rgba(124, 58, 237, 0.06);
}

.hp-item--success {
  background: rgba(58, 157, 92, 0.03);
  border-color: rgba(58, 157, 92, 0.06);
}

.hp-ico {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.hp-ico--orange { background: rgba(200, 128, 58, 0.1); }
.hp-ico--blue { background: rgba(37, 99, 235, 0.08); }
.hp-ico--purple { background: rgba(124, 58, 237, 0.08); }
.hp-ico--green { background: rgba(58, 157, 92, 0.08); }

.hp-ico-img {
  width: 28rpx;
  height: 28rpx;
}

.hp-item--warning .hp-num { color: $uni-color-warning; }
.hp-item--primary .hp-num { color: $uni-color-primary; }
.hp-item--purple .hp-num { color: #7C3AED; }
.hp-item--success .hp-num { color: $uni-color-success; }

.hp-num {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -0.6rpx;
}

.hp-label {
  font-size: 22rpx;
  color: $uni-gray-500;
  margin-top: 12rpx;
  font-weight: 500;
}

/* 最新订单（原稿尺寸：name 13px / meta 11px mono / amount 15px mono） */
.home-orders {
  margin: 28rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 40rpx 36rpx 24rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.ho-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.ho-item:last-child {
  border-bottom: none;
}

.ho-info {
  flex: 1;
  min-width: 0;
}

.ho-name {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color;
  letter-spacing: -0.2rpx;
}

/* 渠道标签：浅灰底小标签（UI1.2 修复，此前无底色） */
.ho-channel {
  font-size: 22rpx;
  color: $uni-gray-600;
  background: $uni-bg-color-grey;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  margin-left: 12rpx;
  font-weight: 500;
}

.ho-meta {
  font-size: 22rpx;
  color: $uni-gray-500;
  margin-top: 6rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.ho-right {
  text-align: right;
  flex-shrink: 0;
}

.ho-amount {
  font-size: 30rpx;
  font-weight: 800;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -0.6rpx;
  margin-right: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  font-size: 22rpx;
  font-weight: 600;
  margin-top: 8rpx;
}

/* 徽章文字加深至 4.5:1 对比度（spec12） */
.badge-green { background: $uni-color-success-soft; color: #047857; }
.badge-orange { background: $uni-color-warning-soft; color: #B45309; }
.badge-red { background: $uni-color-error-soft; color: #B91C1C; }
.badge-gray { background: #f0f0f0; color: #909399; }

/* 7 日趋势（原稿：SVG 平滑折线 + 底部日期行） */
.home-chart {
  margin: 32rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 40rpx 36rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.chart-daily {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.chart-wrap {
  height: 300rpx;
}

.chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* 末点脉冲光圈（原稿 animate r 10→16） */
.chart-pulse {
  animation: chartPulse 2.5s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes chartPulse {
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.14; }
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 0 4rpx;
}

.chart-label {
  font-size: 22rpx;
  color: $uni-gray-500;
  font-weight: 500;
}

.chart-empty {
  height: 180rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-empty-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}

/* 待办提醒（原稿：左侧 3px 蓝色竖线卡片） */
.home-todos {
  margin: 28rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx 36rpx 24rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  border-left: 6rpx solid $uni-color-primary;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  gap: 16rpx;
}

/* 原稿今日待办：标题行 + 色点计数行 */
.todo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.todo-head-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.todo-check-ic {
  width: 28rpx;
  height: 28rpx;
}

.todo-title-main {
  font-size: 26rpx;
  font-weight: 700;
  color: $uni-text-color;
  letter-spacing: -0.4rpx;
}

.todo-count {
  font-size: 22rpx;
  color: $uni-gray-500;
  font-weight: 400;
}

.todo-rows {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.todo-row-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.todo-row-text {
  font-size: 24rpx;
  color: $uni-text-color-secondary;
}

.todo-row-num {
  font-weight: 700;
}

.todo-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.todo-dot--pending { background: $uni-color-warning; }
.todo-dot--done { background: $uni-color-success; }

.todo-title {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-date {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.beian-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 16rpx 0 8rpx;
}
.beian-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.beian-footer-text {
  font-size: 22rpx;
  color: $uni-gray-500;
}
.beian-icon {
  width: 26rpx;
  height: 26rpx;
}
</style>
