<template>
  <scroll-view class="home-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 搜索栏 -->
    <view class="search-bar" @tap="navigateTo('/pages/products/products')">
      <text class="search-bar-icon">&#xe614;</text>
      <text class="search-bar-placeholder">搜索商品、订单、客户名称</text>
    </view>

    <!-- 数据卡（今日营业额 / 今日订单 + 环比） -->
    <view class="home-data">
      <view class="home-data-top">
        <view class="home-data-item">
          <text class="home-data-label">今日营业额</text>
          <text class="home-data-val">¥{{ formatAmount(stats.todaySales) }}</text>
          <view class="home-data-trend up">
            <text class="trend-arrow">▲</text>
            <text class="trend-text">{{ stats.todaySales > 0 ? '实时' : '—' }}</text>
          </view>
        </view>
        <view class="home-data-item">
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
          <text class="db-val">¥{{ formatAmount(stats.monthSales) }}</text>
        </view>
        <view class="db-item">
          <text class="db-label">本月订单</text>
          <text class="db-val">{{ stats.monthOrders }}</text>
        </view>
        <view class="db-item">
          <text class="db-label">本月毛利</text>
          <text class="db-val">¥{{ formatAmount(stats.monthProfit) }}</text>
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
            <text class="hp-ico-text">配</text>
          </view>
          <text class="hp-num">{{ stats.pendingDelivery }}</text>
          <text class="hp-label">待配送</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--blue">
            <text class="hp-ico-text">取</text>
          </view>
          <text class="hp-num">{{ stats.pendingPickup }}</text>
          <text class="hp-label">待取货</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--red">
            <text class="hp-ico-text">收</text>
          </view>
          <text class="hp-num">{{ stats.pendingPayment }}</text>
          <text class="hp-label">待收款</text>
        </view>
        <view class="hp-item" @tap="navigateTo('/pages/orders/orders')">
          <view class="hp-ico hp-ico--green">
            <text class="hp-ico-text">完</text>
          </view>
          <text class="hp-num">{{ stats.completedToday }}</text>
          <text class="hp-label">已完成</text>
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
          <view class="ho-amount">¥{{ formatAmount(order.amount) }}</view>
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
        <text class="chart-daily" v-if="trendList.length > 0">日均 ¥{{ formatAmount(averageDaily) }}</text>
      </view>
      <view class="chart-wrap" v-if="trendList.length > 0">
        <view class="chart-bar-col" v-for="(item, idx) in trendList" :key="idx">
          <text class="chart-bar-val">{{ formatAmount(item.amount) }}</text>
          <view class="chart-bar" :style="{ height: barHeight(item.amount) }"></view>
          <text class="chart-bar-label">{{ item.date }}</text>
        </view>
      </view>
      <view class="chart-empty" v-else>
        <text class="chart-empty-text">暂无趋势数据</text>
      </view>
    </view>

    <!-- 待办提醒 -->
    <view class="home-todos" v-if="todos.length > 0">
      <view class="section-head">
        <view class="section-title-wrap">
          <view class="title-bar-line"></view>
          <text class="section-title">待办提醒</text>
        </view>
        <text class="section-more" @tap="navigateTo('/pages/todos/todos')">全部 ›</text>
      </view>
      <view class="todo-item" v-for="item in todos" :key="item.id">
        <view class="todo-dot" :class="item.status === 'done' ? 'todo-dot--done' : 'todo-dot--pending'"></view>
        <text class="todo-title">{{ item.title }}</text>
        <text class="todo-date" v-if="item.deadline">{{ item.deadline }}</text>
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

const averageDaily = computed(() => {
  if (trendList.value.length === 0) return 0
  const sum = trendList.value.reduce((acc, item) => acc + item.amount, 0)
  return sum / trendList.value.length
})

const maxTrendAmount = computed(() => {
  if (trendList.value.length === 0) return 1
  return Math.max(...trendList.value.map((item) => item.amount), 1)
})

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toFixed(2)
}

function barHeight(amount: number): string {
  const ratio = maxTrendAmount.value > 0 ? amount / maxTrendAmount.value : 0
  const height = Math.max(8, Math.round(ratio * 120))
  return height + 'rpx'
}

function statusBadgeClass(status: string): string {
  if (status === 'done' || status === 'COMPLETED' || status === '已完成') return 'badge-green'
  if (status === 'pending' || status === 'PENDING' || status === '待付款') return 'badge-red'
  if (status === 'delivering' || status === 'DELIVERING' || status === '待配送') return 'badge-orange'
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

async function loadData() {
  try {
    const [statsData, todosData, trendData, orderResult] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTodos(),
      dashboardApi.getSalesTrend(7),
      ordersApi.list({ page: 1, pageSize: 4 }).catch(() => null)
    ])
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
    trendList.value = trendData.slice(0, 7)
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
  font-size: 30rpx;
  color: $uni-gray-400;
}

.search-bar-placeholder {
  font-size: 26rpx;
  color: $uni-gray-400;
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
  gap: 48rpx;
}

.home-data-item {
  flex: 1;
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

.home-data-label::before {
  content: '';
  width: 28rpx;
  height: 2rpx;
  background: rgba(37, 99, 235, 0.2);
  border-radius: 2rpx;
}

.home-data-val {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  margin-top: 16rpx;
  color: #2563EB;
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
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.08) 20%, rgba(37, 99, 235, 0.08) 80%, transparent);
  margin: 36rpx 0 28rpx;
}

.home-data-bot {
  display: flex;
}

.db-item {
  flex: 1;
}

.db-label {
  font-size: 20rpx;
  color: #A3A3A3;
  font-weight: 500;
}

.db-val {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  margin-top: 8rpx;
  color: #2563EB;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -0.6rpx;
}

/* 通用区块 */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 24rpx;
  position: relative;
  padding-left: 20rpx;
}

.section-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4rpx;
  height: 32rpx;
  border-radius: 2rpx;
  background: #2563EB;
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
  color: $uni-gray-400;
}

/* 订单进度 */
.home-progress {
  margin: 36rpx 28rpx 0;
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 40rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.hp-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.hp-item {
  text-align: center;
  padding: 28rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(0, 0, 0, 0.015);
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.hp-ico {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin: 0 auto 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hp-ico--orange { background: rgba(200, 128, 58, 0.1); }
.hp-ico--blue { background: rgba(37, 99, 235, 0.1); }
.hp-ico--red { background: rgba(196, 80, 80, 0.1); }
.hp-ico--green { background: rgba(58, 157, 92, 0.1); }

.hp-ico-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #2563EB;
}

.hp-num {
  font-size: 44rpx;
  font-weight: 800;
  color: $uni-text-color;
  line-height: 1;
  font-family: 'SF Mono', 'Fira Code', monospace;
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

.ho-channel {
  font-size: 20rpx;
  color: $uni-gray-400;
  margin-left: 12rpx;
  font-weight: 400;
}

.ho-meta {
  font-size: 22rpx;
  color: $uni-gray-400;
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
  font-size: 20rpx;
  font-weight: 600;
  margin-top: 8rpx;
}

.badge-green { background: $uni-color-success-soft; color: $uni-color-success; }
.badge-orange { background: $uni-color-warning-soft; color: $uni-color-warning; }
.badge-red { background: $uni-color-error-soft; color: $uni-color-error; }

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
  color: $uni-gray-400;
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
  font-size: 18rpx;
  color: $uni-gray-400;
}

.chart-bar {
  width: 36rpx;
  border-radius: 8rpx 8rpx 4rpx 4rpx;
  background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
  min-height: 8rpx;
}

.chart-bar-label {
  font-size: 20rpx;
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
  color: $uni-gray-400;
}
</style>
