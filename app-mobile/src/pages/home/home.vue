<template>
  <scroll-view class="home-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 数据看板（卡片） -->
    <view class="dashboard-card">
      <view class="dashboard-header">
        <view class="dashboard-title-wrap">
          <text class="dashboard-icon">&#xe614;</text>
          <text class="dashboard-title">经营数据看板</text>
        </view>
        <view class="realtime-tag">
          <text class="realtime-dot"></text>
          <text class="realtime-text">实时</text>
        </view>
      </view>
      <view class="dash-today">
        <view class="dash-today-item">
          <text class="dash-value-today">¥{{ formatAmount(stats.todaySales) }}</text>
          <text class="dash-label">今日营业额</text>
        </view>
        <view class="dash-today-item">
          <text class="dash-value-today">{{ stats.todayOrders }}</text>
          <text class="dash-label">今日订单</text>
        </view>
      </view>
      <view class="dash-month">
        <view class="dash-month-item">
          <text class="dash-value-month">¥{{ formatAmount(stats.weekTotal) }}</text>
          <text class="dash-label">本周累计</text>
        </view>
        <view class="dash-month-item">
          <text class="dash-value-month">{{ stats.productCount }}</text>
          <text class="dash-label">在售商品</text>
        </view>
        <view class="dash-month-item">
          <text class="dash-value-month">{{ stats.totalCustomers }}</text>
          <text class="dash-label">活跃客户</text>
        </view>
      </view>
      <view class="dash-warn" v-if="stats.stockAlerts > 0">
        <text class="dash-warn-dot"></text>
        <text class="dash-warn-text">库存预警 {{ stats.stockAlerts }} 项</text>
      </view>
      <view class="ai-insight">
        <text class="ai-insight-icon">💡</text>
        <text class="ai-insight-text">AI 洞察：点击底部 AI 助手，一句话完成开单、查库存、对账</text>
      </view>
    </view>

    <!-- 订单进度 -->
    <view class="card-section">
      <view class="card-title-row">
        <text class="card-title">订单进度</text>
      </view>
      <view class="order-progress-grid">
        <view class="order-stat">
          <view class="order-dot order-dot--red"></view>
          <text class="order-num order-num--red">{{ stats.pendingDelivery }}</text>
          <text class="order-label">待配送</text>
        </view>
        <view class="order-stat">
          <view class="order-dot order-dot--orange"></view>
          <text class="order-num order-num--orange">{{ stats.pendingPickup }}</text>
          <text class="order-label">待取货</text>
        </view>
        <view class="order-stat">
          <view class="order-dot order-dot--blue"></view>
          <text class="order-num order-num--blue">{{ stats.pendingPayment }}</text>
          <text class="order-label">待收款</text>
        </view>
        <view class="order-stat">
          <view class="order-dot order-dot--green"></view>
          <text class="order-num order-num--green">{{ stats.completedToday }}</text>
          <text class="order-label">已完成</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="card-section">
      <view class="card-title-row">
        <text class="card-title">快捷入口</text>
      </view>
      <view class="quick-grid">
        <view class="quick-item" @tap="navigateTo('/pages/sales/create-sale')">
          <view class="quick-icon-wrap quick-icon-wrap--blue">
            <text class="quick-icon">&#xe610;</text>
          </view>
          <text class="quick-label">开单收银</text>
        </view>
        <view class="quick-item" @tap="navigateTo('/pages/products/products')">
          <view class="quick-icon-wrap quick-icon-wrap--green">
            <text class="quick-icon">&#xe611;</text>
          </view>
          <text class="quick-label">商品管理</text>
        </view>
        <view class="quick-item" @tap="navigateTo('/pages-sub/product/customers/customers')">
          <view class="quick-icon-wrap quick-icon-wrap--orange">
            <text class="quick-icon">&#xe612;</text>
          </view>
          <text class="quick-label">客户管理</text>
        </view>
        <view class="quick-item" @tap="navigateTo('/pages-sub/finance/reports/reports')">
          <view class="quick-icon-wrap quick-icon-wrap--purple">
            <text class="quick-icon">&#xe613;</text>
          </view>
          <text class="quick-label">数据报表</text>
        </view>
      </view>
    </view>

    <!-- 最新订单 -->
    <view class="card-section" v-if="recentOrders.length > 0">
      <view class="card-title-row">
        <text class="card-title">最新订单</text>
        <text class="card-more" @tap="navigateTo('/pages/orders/orders')">查看全部 ></text>
      </view>
      <view class="order-list">
        <view class="order-item" v-for="order in recentOrders" :key="order.id">
          <view class="order-avatar" :class="'order-avatar--' + order.avatarColor">
            <text class="avatar-text">{{ order.customerName.charAt(0) }}</text>
          </view>
          <view class="order-info">
            <view class="order-info-top">
              <text class="order-customer">{{ order.customerName }}</text>
              <text class="order-type-tag">{{ order.orderType }}</text>
            </view>
            <text class="order-meta">{{ order.orderNo }} · {{ order.time }}</text>
          </view>
          <view class="order-right">
            <text class="order-amount">¥{{ formatAmount(order.amount) }}</text>
            <text class="order-status" :class="{ 'order-status--pending': order.status !== 'done' }">{{ order.statusText }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 待办提醒 -->
    <view class="card-section">
      <view class="card-title-row">
        <text class="card-title">待办提醒</text>
        <text class="card-more" @tap="navigateTo('/pages/todos/todos')">全部 ></text>
      </view>
      <view class="todo-list" v-if="todos.length > 0">
        <view class="todo-item" v-for="item in todos" :key="item.id">
          <view class="todo-dot" :class="item.status === 'done' ? 'todo-dot--done' : 'todo-dot--pending'"></view>
          <text class="todo-title" :class="{ 'todo-title--done': item.status === 'done' }">{{ item.title }}</text>
          <text class="todo-date" v-if="item.deadline">{{ item.deadline }}</text>
        </view>
      </view>
      <view class="empty-state" v-else>
        <text class="empty-text">暂无待办事项</text>
      </view>
    </view>

    <!-- 安全区域底部间距 -->
    <view class="safe-bottom"></view>
    <custom-tab-bar :current="'home'" />
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi, type TodoItem } from '@/api/modules/dashboard'
import CustomTabBar from '@/components/custom-tab-bar.vue'

interface DashboardData {
  todaySales: number
  todayOrders: number
  weekTotal: number
  productCount: number
  totalCustomers: number
  stockAlerts: number
  pendingDelivery: number
  pendingPickup: number
  pendingPayment: number
  completedToday: number
}

interface RecentOrder {
  id: string
  customerName: string
  avatarColor: string
  orderType: string
  orderNo: string
  time: string
  amount: number
  status: string
  statusText: string
}

const stats = ref<DashboardData>({
  todaySales: 0,
  todayOrders: 0,
  weekTotal: 0,
  productCount: 0,
  totalCustomers: 0,
  stockAlerts: 0,
  pendingDelivery: 0,
  pendingPickup: 0,
  pendingPayment: 0,
  completedToday: 0
})

const todos = ref<TodoItem[]>([])
const recentOrders = ref<RecentOrder[]>([])
const loading = ref(false)
const refresherTriggered = ref(false)

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toFixed(2)
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

async function loadData() {
  loading.value = true
  try {
    const [statsData, todosData] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTodos()
    ])
    // 合并接口数据到看板数据
    const s = statsData as any
    stats.value = {
      todaySales: s.todaySales || 0,
      todayOrders: s.todayOrders || 0,
      weekTotal: s.weekTotal || s.todaySales * 5 || 0,
      productCount: s.productCount || 0,
      totalCustomers: s.totalCustomers || 0,
      stockAlerts: s.stockAlerts || 0,
      pendingDelivery: s.pendingDelivery || 0,
      pendingPickup: s.pendingPickup || 0,
      pendingPayment: s.pendingPayment || 0,
      completedToday: s.completedToday || 0
    }
    todos.value = todosData.slice(0, 5)
  } catch (err) {
    console.error('加载首页数据失败:', err)
  } finally {
    loading.value = false
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

/* --- 数据看板通栏 --- */
.dashboard-banner {
  background: linear-gradient(135deg, $uni-color-primary 0%, $uni-color-primary 100%);
  padding: calc(48rpx + env(safe-area-inset-top)) 32rpx 36rpx;
  border-radius: 0 0 32rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(43, 127, 255, 0.2);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28rpx;
}

.dashboard-title-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.dashboard-icon {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.9);
}

.dashboard-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
}

.realtime-tag {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.2);
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
}

.realtime-dot {
  width: 12rpx;
  height: 12rpx;
  background: $uni-color-success;
  border-radius: 50%;
}

.realtime-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24rpx 0;
}

.dash-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dash-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
  margin-bottom: 6rpx;
}

.dash-value--warn {
  color: $uni-color-error-soft;
}

.dash-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
}

/* --- 通用卡片 --- */
.card-section {
  margin: 24rpx 24rpx 0;
  background: $uni-bg-color;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $ai-text-body;
}

.card-more {
  font-size: 24rpx;
  color: $uni-color-primary;
}

/* --- 订单进度 --- */
.order-progress-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16rpx;
}

.order-stat {
  text-align: center;
  padding: 20rpx 8rpx;
  background: $uni-bg-color-page;
  border-radius: 16rpx;
}

.order-num {
  font-size: 44rpx;
  font-weight: 700;
  margin-bottom: 6rpx;
  display: block;
}

.order-num--red { color: $ai-danger; }
.order-num--orange { color: $ai-warning; }
.order-num--blue { color: $uni-color-primary; }
.order-num--green { color: $ai-success; }

.order-label {
  font-size: 22rpx;
  color: $ai-text-sub;
}

/* --- 快捷入口 --- */
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 20rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-icon-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.quick-icon-wrap--blue { background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft); }
.quick-icon-wrap--green { background: linear-gradient(135deg, $ai-success-bg, $uni-color-success-soft); }
.quick-icon-wrap--orange { background: linear-gradient(135deg, $ai-warning-bg, $uni-color-warning-soft); }
.quick-icon-wrap--purple { background: linear-gradient(135deg, $uni-color-purple-soft, $uni-color-purple-soft); }
.quick-icon-wrap--cyan { background: linear-gradient(135deg, $uni-color-success-soft, $uni-color-cyan-soft); }

.quick-icon {
  font-size: 40rpx;
  color: $uni-color-primary;
}

.quick-icon--ai {
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.quick-label {
  font-size: 24rpx;
  color: $ai-text-mid;
}

/* --- 最新订单 --- */
.order-list {
  display: flex;
  flex-direction: column;
}

.order-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $ai-bg-gap;
}

.order-item:last-child {
  border-bottom: none;
}

.order-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.order-avatar--blue { background: $uni-color-primary; }
.order-avatar--green { background: $ai-success; }
.order-avatar--orange { background: $ai-warning; }

.avatar-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
}

.order-info {
  flex: 1;
  min-width: 0;
}

.order-info-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.order-customer {
  font-size: 28rpx;
  font-weight: 600;
  color: $ai-text-body;
}

.order-type-tag {
  font-size: 20rpx;
  color: $ai-text-sub;
  background: $ai-bg-gap;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}

.order-meta {
  font-size: 22rpx;
  color: $ai-text-sub;
}

.order-right {
  text-align: right;
  flex-shrink: 0;
}

.order-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: $ai-text-body;
}

.order-status {
  font-size: 20rpx;
  color: $ai-success;
  margin-top: 4rpx;
}

.order-status--pending {
  color: $ai-warning;
}

/* --- 待办提醒 --- */
.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid $ai-bg-gap;
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.todo-dot--pending {
  background: $uni-color-primary;
}

.todo-dot--done {
  background: $uni-gray-300;
}

.todo-title {
  flex: 1;
  font-size: 28rpx;
  color: $ai-text-body;
}

.todo-title--done {
  color: $uni-gray-300;
  text-decoration: line-through;
}

.todo-date {
  font-size: 22rpx;
  color: $ai-text-sub;
  margin-left: 16rpx;
}

.empty-state {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: calc(108rpx + env(safe-area-inset-bottom));
}

/* ─── 移动端打磨 v1.3：数据看板卡片化 ─── */
.dashboard-card {
  margin: 16rpx 32rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 24rpx;
  padding: 28rpx 32rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}
.dash-today {
  display: flex;
  margin-top: 20rpx;
}
.dash-today-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.dash-value-today {
  font-size: 56rpx;
  font-weight: 700;
  color: $uni-text-color;
  font-variant-numeric: tabular-nums;
}
.dash-month {
  display: flex;
  margin-top: 24rpx;
  border-top: 2rpx solid $ai-bg-gap;
  padding-top: 20rpx;
}
.dash-month-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.dash-value-month {
  font-size: 28rpx;
  color: $ai-text-mid;
  font-variant-numeric: tabular-nums;
}
.dash-label {
  font-size: 22rpx;
  color: $ai-text-sub;
}
.dash-warn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 20rpx;
  background: $ai-danger-bg;
  border-radius: 12rpx;
  padding: 10rpx 16rpx;
}
.dash-warn-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: $ai-danger;
}
.dash-warn-text {
  font-size: 22rpx;
  color: $ai-danger;
}
.ai-insight {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 20rpx;
  background: $ai-bg-gap;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
}
.ai-insight-icon {
  font-size: 24rpx;
}
.ai-insight-text {
  flex: 1;
  font-size: 24rpx;
  color: $ai-text-body;
}

/* 订单进度色点 */
.order-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-bottom: 4rpx;
}
.order-dot--red { background: $ai-danger; }
.order-dot--orange { background: $ai-warning; }
.order-dot--blue { background: $ai-primary; }
.order-dot--green { background: $ai-success; }
</style>
