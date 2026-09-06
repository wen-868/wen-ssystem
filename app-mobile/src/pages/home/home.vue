<template>
  <scroll-view class="home-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 顶部标题栏（与子页面统一：page-header 组件，主 tab 页无返回键） -->
    <page-header title="首页" :show-back="false" />
    <!-- 搜索栏（UI1.2：扫码/订单/消息三入口，40px 热区） -->
    <view class="search-bar" @tap="navigateTo('/pages/products/products')">
      <image class="search-bar-icon" src="/static/icons/sc-search.svg" mode="aspectFit" />
      <text class="search-bar-placeholder">搜索商品/订单/客户</text>
      <view class="search-actions">
        <view class="icon-btn" @tap.stop="onScan">
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
          <text class="db-label">本月毛利</text>
          <text class="db-val">¥{{ formatCn(stats.monthProfit) }}</text>
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
          <text class="hp-num">{{ stats.pendingDelivery }}</text>
          <text class="hp-label">待配送</text>
        </view>
        <view class="hp-item hp-item--primary" @tap="navigateTo('/pages/orders/orders')">
          <text class="hp-num">{{ stats.pendingPickup }}</text>
          <text class="hp-label">待取货</text>
        </view>
        <view class="hp-item hp-item--purple" @tap="navigateTo('/pages/orders/orders')">
          <text class="hp-num">{{ stats.pendingPayment }}</text>
          <text class="hp-label">待收款</text>
        </view>
        <view class="hp-item hp-item--success" @tap="navigateTo('/pages/orders/orders')">
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
        <!-- #ifdef H5 -->
        <svg class="chart-svg" viewBox="0 0 340 140" preserveAspectRatio="none">
          <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="COLOR_PRIMARY" stop-opacity="0.15" />
            <stop offset="50%" :stop-color="COLOR_PRIMARY" stop-opacity="0.05" />
            <stop offset="100%" :stop-color="COLOR_PRIMARY" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line v-for="(gy, i) in chartMeta.gridYs" :key="'g' + i" x1="10" :y1="gy" x2="330" :y2="gy" :stroke="COLOR_BLACK_03" stroke-width="1" />
        <line x1="10" :y1="chartMeta.avgY" x2="330" :y2="chartMeta.avgY" :stroke="COLOR_PRIMARY" stroke-width="0.8" stroke-dasharray="4,4" opacity="0.15" />
        <text :x="330" :y="chartMeta.avgY - 5" text-anchor="end" font-size="11" font-weight="600" :fill="COLOR_PRIMARY" opacity="0.55">均 {{ formatCn(averageDaily) }}</text>
        <path :d="chartMeta.area" fill="url(#chartArea)" />
        <path :d="chartMeta.line" fill="none" :stroke="COLOR_PRIMARY" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle v-for="(p, i) in chartMeta.dots" :key="'d' + i" :cx="p.x" :cy="p.y" :r="p.r" :fill="COLOR_WHITE" :stroke="COLOR_PRIMARY" stroke-width="2" />
        <circle :cx="chartMeta.lastDot.x" :cy="chartMeta.lastDot.y" r="10" :fill="COLOR_PRIMARY" opacity="0.06" class="chart-pulse" />
        <text :x="chartMeta.lastDot.x" :y="chartMeta.lastDot.y - 12" text-anchor="middle" :fill="COLOR_PRIMARY" font-size="10" font-weight="700">{{ formatCn(chartMeta.lastVal) }}</text>
        </svg>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <!-- App/小程序端模板不支持内联 SVG，用 canvas 2d 绘制同款趋势图 -->
        <canvas id="trendCanvas" type="2d" class="chart-canvas" @tap="noop"></canvas>
        <!-- #endif -->
      </view>
      <view class="chart-labels" v-if="trendList.length > 0">
        <text class="chart-label" v-for="item in trendList" :key="item.date">{{ item.date }}</text>
      </view>
      <view class="chart-empty" v-else>
        <text class="chart-empty-text">暂无趋势数据</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
    <custom-tab-bar :current="'home'" />
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { dashboardApi, type TodoItem, type SalesTrend } from '@/api/modules/dashboard'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'
import { notificationsApi } from '@/api/modules/notifications'
import { reportsApi } from '@/api/modules/reports'
import { inventoryApi } from '@/api/modules/inventory'
import { productsApi } from '@/api/modules/products'
import CustomTabBar from '@/components/custom-tab-bar.vue'
import { COLOR_PRIMARY, COLOR_WHITE, COLOR_WARNING, COLOR_ERROR, COLOR_BLACK_03 } from '@/constants/colors'

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
    { count: stats.value.pendingDelivery, label: '单待配送', color: COLOR_WARNING },
    { count: alertCount.value, label: '件库存预警商品', color: COLOR_ERROR },
    { count: stats.value.pendingPayment, label: '笔待收款', color: COLOR_PRIMARY }
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

// #ifndef H5
/** App/小程序端：模板内联 SVG 不渲染，用 canvas 2d 绘制同款 7 日趋势图 */
function drawTrendChart() {
  const data = trendList.value.map((t) => t.amount)
  if (data.length < 2) return
  uni.createSelectorQuery()
    .select('#trendCanvas')
    .fields({ node: true, size: true }, (res: any) => {
      if (!res || !res.node) return
      const canvas: any = res.node
      const dpr: number = (uni.getSystemInfoSync().pixelRatio as number) || 2
      canvas.width = res.width * dpr
      canvas.height = res.height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      renderTrendChart(ctx, res.width, res.height, data)
    })
    .exec()
}

function renderTrendChart(ctx: any, w: number, h: number, data: number[]) {
  const pad = { t: 20, b: 20, l: 10, r: 10 }
  const uw = w - pad.l - pad.r
  const uh = h - pad.t - pad.b
  const max = Math.max(...data) * 1.06
  const min = Math.min(...data) * 0.88
  const range = max - min || 1
  const n = data.length
  const px = (i: number) => pad.l + (uw * i) / (n - 1)
  const py = (v: number) => pad.t + uh - ((v - min) / range) * uh
  // 网格（三条）
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  for (let g = 0; g < 3; g++) {
    const y = pad.t + (uh / 3) * g
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(w - pad.r, y)
    ctx.stroke()
  }
  // 渐变面积（用固定透明度近似 SVG 渐变）
  const pts = data.map((v, i) => [px(i), py(v)] as [number, number])
  ctx.beginPath()
  ctx.moveTo(pts[0][0], h - pad.b)
  pts.forEach((p) => ctx.lineTo(p[0], p[1]))
  ctx.lineTo(pts[n - 1][0], h - pad.b)
  ctx.closePath()
  ctx.fillStyle = 'rgba(37,99,235,0.10)'
  ctx.fill()
  // 折线
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])))
  ctx.strokeStyle = COLOR_PRIMARY
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
  // 均值虚线
  const avg = data.reduce((a, b) => a + b, 0) / n
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(pad.l, py(avg))
  ctx.lineTo(w - pad.r, py(avg))
  ctx.strokeStyle = 'rgba(37,99,235,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])
  // 数据点（白底蓝边圆点）
  pts.forEach((p) => {
    ctx.beginPath()
    ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2)
    ctx.fillStyle = COLOR_WHITE
    ctx.fill()
    ctx.strokeStyle = COLOR_PRIMARY
    ctx.lineWidth = 2
    ctx.stroke()
  })
  // 末点数值标签
  ctx.fillStyle = COLOR_PRIMARY
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(formatCn(data[n - 1]), pts[n - 1][0], Math.max(pts[n - 1][1] - 10, 12))
}

watch(trendList, () => {
  nextTick(() => setTimeout(drawTrendChart, 80))
})
// #endif

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

/** 搜索栏扫码入口：扫条码 → 按条码查商品 → 进商品详情（与商品页扫码逻辑一致） */
async function onScan() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    uni.showLoading({ title: '查询商品...' })
    const res = await productsApi.list({ keyword: code, page: 1, pageSize: 10 })
    uni.hideLoading()
    const rows = res?.list ?? []
    const matched = rows.find((p) => String(p.skuId) === code || (p.name || '').includes(code)) ?? rows[0]
    if (matched) {
      uni.navigateTo({ url: `/pages/products/product-detail?id=${matched.id}` })
    } else {
      uni.showToast({ title: '未找到该条码商品', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
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
    // 取最近 7 天（接口按日期升序返回；补零后恒为 7 条，slice(-7) 防上游多返回丢掉今天）
    trendList.value = trendData.slice(-7).map((t) => ({ ...t, date: formatTrendDate(t.date) }))
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

// 下拉刷新并发防护：refresh 触发期间再次下拉/切换可能叠加 loadData，
// 造成重复请求与 refresher 状态错乱
let refreshing = false
async function onRefresh() {
  if (refreshing) return
  refreshing = true
  refresherTriggered.value = true
  try {
    await loadData()
  } finally {
    refreshing = false
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.home-page {
  /* scroll-view 必须固定高度：无高度时 App 端页面级滚动与 refresher 冲突，
     表现为"滑下去就滑不上来"（下拉刷新手势锁死滚动）。
     安全区由内部 page-header 自带的 padding-top 承接，这里不能重复加 */
  height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
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
  border: 1rpx solid $zx-black-60;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  gap: 20rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-30;
}

.search-bar-icon {
  width: 34rpx;
  height: 34rpx;
  flex-shrink: 0;
}

.search-bar-placeholder {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: $uni-gray-500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  margin: $uni-spacing-lg $uni-spacing-base 0;
  background: $zx-blue-50;
  border-radius: $uni-border-radius-lg;
  padding: $uni-spacing-xl 44rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx $zx-primary-60, 0 2rpx 6rpx $zx-black-40;
  border: 1rpx solid $zx-primary-80;
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
  flex: 1;
  text-align: center;
}

.home-data-item--sub {
  flex: 1;
  text-align: center;
}

.home-data-item--main .home-data-trend {
  justify-content: center;
  padding-left: 0;
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
  gap: $uni-spacing-sm;
}

/* 原稿：标签前置 14×1px 蓝色短横线 */
.home-data-label::before {
  content: '';
  width: 28rpx;
  height: 2rpx;
  border-radius: 2rpx;
  background: $zx-primary-200;
  flex-shrink: 0;
}

.home-data-item--main .home-data-label {
  justify-content: center;
  padding-left: 0;
}

.home-data-item--main .home-data-val {
  padding-left: 0;
}

.home-data-item--main .home-data-trend {
  padding-left: 0;
}

.home-data-item--sub .home-data-label {
  justify-content: center;
}

.home-data-val {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  margin-top: $uni-spacing-sm;
  color: $uni-color-primary;
  line-height: 1.1;
  letter-spacing: -1rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.home-data-trend {
  display: flex;
  align-items: center;
  gap: $uni-spacing-xs;
  margin-top: $uni-spacing-sm;
}

.home-data-trend.up {
  color: $zx-success-text;
}

.home-data-trend.up .trend-text {
  color: $zx-success-text;
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
  background: $uni-color-primary-soft;
  margin: 36rpx 0 $uni-spacing-base;
}

/* 原稿主项错落缩进：val 缩 5px、trend 缩 33px */
.home-data-item--main .home-data-val {
  padding-left: 0;
}

.home-data-item--main .home-data-trend {
  padding-left: 0;
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
  background: linear-gradient(180deg, transparent, $zx-primary-80, transparent);
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
  margin: $uni-spacing-lg $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 36rpx $uni-spacing-lg $uni-spacing-sm;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

/* 快捷入口标题 14px、间距对齐原稿 h3 */
.home-quick .section-title {
  font-size: 26rpx;
}

.home-quick .section-head {
  margin-bottom: $uni-spacing-base;
}

.hq-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $uni-spacing-xs;
}

.hq-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-sm $uni-spacing-xs $uni-spacing-md;
  border-radius: $uni-border-radius-sm;
}

.hq-item:active {
  background: $zx-black-30;
}

.hq-ico {
  width: 76rpx;
  height: 76rpx;
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
  margin-bottom: $uni-spacing-lg;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
}

.title-bar-line {
  width: 8rpx;
  height: 32rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color;
  letter-spacing: -0.5rpx;
}

.section-more {
  font-size: 24rpx;
  color: $uni-gray-500;
}

/* 订单进度（原稿：白色卡片包裹标题 + 四色 tint 宫格） */
.home-progress {
  margin: $uni-spacing-lg $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 40rpx 36rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

.hp-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $uni-spacing-sm;
}

.hp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $uni-spacing-base $uni-spacing-sm;
  border-radius: $uni-border-radius-base;
  background: $zx-black-15;
  border: 1rpx solid $zx-black-30;
}

.hp-item:active {
  transform: scale(0.95);
}

.hp-item--warning {
  background: $zx-warning2-40;
  border-color: $zx-warning2-80;
}

.hp-item--primary {
  background: $zx-primary-30;
  border-color: $zx-primary-60;
}

.hp-item--purple {
  background: $zx-violet2-30;
  border-color: $zx-violet2-60;
}

.hp-item--success {
  background: $zx-success2-30;
  border-color: $zx-success2-60;
}

.hp-ico {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $uni-spacing-sm;
}

.hp-ico--orange { background: $zx-warning2-100; }
.hp-ico--blue { background: $zx-primary-80; }
.hp-ico--purple { background: $zx-violet2-80; }
.hp-ico--green { background: $zx-success-chip-bg; }

.hp-ico-img {
  width: 28rpx;
  height: 28rpx;
}

.hp-item--warning .hp-num { color: $uni-color-warning; }
.hp-item--primary .hp-num { color: $uni-color-primary; }
.hp-item--purple .hp-num { color: $zx-violet-600; }
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
  margin-top: $uni-spacing-sm;
  font-weight: 500;
}

/* 最新订单（原稿尺寸：name 13px / meta 11px mono / amount 15px mono） */
.home-orders {
  margin: $uni-spacing-base $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 40rpx 36rpx $uni-spacing-base;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

.ho-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-base 0;
  border-bottom: 1rpx solid $zx-black-40;
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
  padding: 2rpx $uni-spacing-sm;
  border-radius: 8rpx;
  margin-left: $uni-spacing-sm;
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
.badge-green { background: $uni-color-success-soft; color: $zx-success-text; }
.badge-orange { background: $uni-color-warning-soft; color: $zx-amber-700; }
.badge-red { background: $uni-color-error-soft; color: $zx-red-700; }
.badge-gray { background: $uni-border-color-light; color: $zx-ant-gray-500; }

/* 7 日趋势（原稿：SVG 平滑折线 + 底部日期行） */
.home-chart {
  margin: $uni-spacing-lg $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 40rpx 36rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
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

/* App/小程序 canvas 趋势图，与 SVG 版同尺寸 */
.chart-canvas {
  width: 100%;
  height: 100%;
}

/* 末点脉冲光圈（原稿 animate r 10→16）；App 端关闭以消除持续重绘卡顿 */
.chart-pulse {
  /* #ifndef APP-PLUS */
  animation: chartPulse 2.5s ease-in-out infinite;
  /* #endif */
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
  margin-top: $uni-spacing-md;
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
  margin: $uni-spacing-base $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: $uni-spacing-lg 36rpx $uni-spacing-base;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
  border-left: 6rpx solid $uni-color-primary;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  gap: $uni-spacing-sm;
}

/* 原稿今日待办：标题行 + 色点计数行 */
.todo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $uni-spacing-md;
}

.todo-head-title {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
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
  gap: $uni-spacing-sm;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
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
</style>
