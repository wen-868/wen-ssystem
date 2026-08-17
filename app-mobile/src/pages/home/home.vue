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
        <view class="db-item db-item--left">
          <text class="db-label">本月营业额</text>
          <text class="db-val">¥{{ formatFull(stats.monthSales) }}</text>
        </view>
        <view class="db-item db-item--mid">
          <text class="db-label">本月订单</text>
          <text class="db-val">{{ stats.monthOrders }}</text>
        </view>
        <view class="db-item db-item--right">
          <text class="db-label">本月毛利</text>
          <text class="db-val">¥{{ formatFull(stats.monthProfit) }}</text>
        </view>
      </view>
    </view>

    <!-- 订单进度四宫格 -->
    <view class="home-progress">
      <view class="section-head">
        <text class="section-title">订单进度</text>
        <text class="section-more" @tap="navigateTo('/pages/orders/orders')">查看全部 ›</text>
      </view>
      <view class="hp-row">
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--orange">
            <image class="hp-ico-img" src="/static/icons/hp-deliver.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingDelivery }}</text>
          <text class="hp-label">待配送</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--blue">
            <image class="hp-ico-img" src="/static/icons/hp-pickup.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingPickup }}</text>
          <text class="hp-label">待取货</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--red">
            <image class="hp-ico-img" src="/static/icons/hp-payment.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.pendingPayment }}</text>
          <text class="hp-label">待收款</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--green">
            <image class="hp-ico-img" src="/static/icons/hp-complete.svg" mode="aspectFit" />
          </view>
          <text class="hp-num">{{ stats.completedToday }}</text>
          <text class="hp-label">已完成</text>
        </view>
      </view>
    </view>

    <!-- 今日待办 -->
    <view class="home-todos" v-if="todos.length > 0">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">今日待办</text>
        </view>
        <text class="section-more" @tap="navigateTo('/pages/todos/todos')">全部 ›</text>
      </view>
      <view class="todo-item" v-for="item in todos" :key="item.id">
        <view class="todo-dot" :class="item.status === 'done' ? 'todo-dot--done' : 'todo-dot--pending'"></view>
        <text class="todo-title">{{ item.title }}</text>
        <text class="todo-date" v-if="item.deadline">{{ item.deadline }}</text>
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
        <view class="chart-bar-col" v-for="(item, idx) in trendList" :key="idx">
          <text class="chart-bar-val">{{ formatCn(item.amount) }}</text>
          <view class="chart-bar" :style="{ height: barHeight(item.amount) }"></view>
          <text class="chart-bar-label">{{ item.date }}</text>
        </view>
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
import { ref, computed, onMounted } from 'vue'
import { dashboardApi, type TodoItem, type SalesTrend } from '@/api/modules/dashboard'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'
import { notificationsApi } from '@/api/modules/notifications'
import CustomTabBar from '@/components/custom-tab-bar.vue'

interface DashboardData {
  todaySales: number
  todayOrders: number
  monthSales: number
  monthOrders: number
  monthProfit: number
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
  pendingDelivery: 0,
  pendingPickup: 0,
  pendingPayment: 0,
  completedToday: 0
})

const todos = ref<TodoItem[]>([])
const recentOrders = ref<HomeOrder[]>([])
const trendList = ref<SalesTrend[]>([])
const refresherTriggered = ref(false)
const unreadCount = ref(0)

const averageDaily = computed(() => {
  if (trendList.value.length === 0) return 0
  const sum = trendList.value.reduce((acc, item) => acc + item.amount, 0)
  return sum / trendList.value.length
})

const maxTrendAmount = computed(() => {
  if (trendList.value.length === 0) return 1
  return Math.max(...trendList.value.map((item) => item.amount), 1)
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
    const [statsData, todosData, trendData, orderResult, unreadResult] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTodos(),
      dashboardApi.getSalesTrend(7),
      ordersApi.list({ page: 1, pageSize: 4 }).catch(() => null),
      notificationsApi.getUnreadCount().catch(() => null)
    ])
    unreadCount.value = unreadResult?.total ?? 0
    const s = statsData as any
    stats.value = {
      todaySales: s.todaySales || 0,
      todayOrders: s.todayOrders || 0,
      monthSales: s.monthSales || s.monthTotal || 0,
      monthOrders: s.monthOrders || 0,
      monthProfit: s.monthProfit || s.monthGrossProfit || 0,
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

.icon-btn {
  width: 72rpx;
  height: 72rpx;
  margin: -8rpx 0;
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
}

.home-data-val {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  margin-top: 16rpx;
  color: $uni-text-color;
  line-height: 1.1;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.home-data-trend {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
}

.home-data-trend.up .trend-arrow {
  color: $uni-color-success;
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

.home-data-bot {
  display: flex;
}

/* 三项：左靠左、右靠右、中间居中，与上方数据卡对齐 */
.db-item {
  flex: 1;
  position: relative;
}

.db-item--left { text-align: left; }
.db-item--mid  { text-align: center; }
.db-item--right { text-align: right; }

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
  font-size: 26rpx;
  font-weight: 700;
  margin-top: 8rpx;
  color: $uni-text-color;
}

/* 通用区块 */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 24rpx;
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
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
  letter-spacing: -0.5rpx;
}

.section-more {
  font-size: 24rpx;
  color: $uni-gray-500;
}

/* 订单进度 */
.home-progress {
  margin: 36rpx 28rpx 0;
}

.hp-row {
  display: flex;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx 12rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.hp-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.hp-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hp-ico--orange { background: rgba(200, 128, 58, 0.1); }
.hp-ico--blue { background: rgba(37, 99, 235, 0.1); }
.hp-ico--red { background: rgba(196, 80, 80, 0.1); }
.hp-ico--green { background: rgba(58, 157, 92, 0.1); }

.hp-ico-img {
  width: 28rpx;
  height: 28rpx;
}

.hp-num {
  font-size: 36rpx;
  font-weight: 800;
  color: $uni-text-color;
  line-height: 1;
}

.hp-label {
  font-size: 22rpx;
  color: $uni-gray-500;
}

/* 最新订单 */
.home-orders {
  margin: 36rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx 28rpx 8rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.ho-item {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
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
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
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

/* 7 日趋势 */
.home-chart {
  margin: 36rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx 28rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.chart-daily {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.chart-wrap {
  display: flex;
  align-items: flex-end;
  gap: 20rpx;
  height: 240rpx;
  padding-top: 24rpx;
}

.chart-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  height: 100%;
  justify-content: flex-end;
}

.chart-bar-val {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.chart-bar {
  width: 36rpx;
  border-radius: 8rpx 8rpx 4rpx 4rpx;
  background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
  min-height: 8rpx;
}

.chart-bar-label {
  font-size: 22rpx;
  color: $uni-gray-500;
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

/* 待办提醒 */
.home-todos {
  margin: 36rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx 28rpx 12rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  gap: 16rpx;
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
