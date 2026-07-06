<template>
  <!-- 无表单交互，无需三件套（纯展示仪表盘页） -->
  <scroll-view class="home-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 顶部 Header -->
    <view class="home-header">
      <view class="header-top">
        <view class="header-brand">
          <text class="brand-name">智享全链</text>
          <text class="brand-divider">|</text>
          <text class="store-name">{{ userStore.user?.storeName || '门店' }}</text>
        </view>
        <view class="header-actions">
          <view class="action-btn" @tap="goNotifications">
            <text class="action-icon">&#xe605;</text>
            <view v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</view>
          </view>
        </view>
      </view>

      <!-- 欢迎语 -->
      <view class="header-greeting">
        <text class="greeting-text">{{ greetingText }}</text>
        <text class="greeting-name">{{ userStore.user?.name || '用户' }}</text>
      </view>
    </view>

    <!-- 指标卡片 -->
    <view class="stats-grid">
      <view class="stat-card stat-card--sales">
        <text class="stat-label">今日销售额</text>
        <text class="stat-value">¥{{ formatAmount(stats.todaySales) }}</text>
        <view class="stat-trend">
          <text class="trend-icon">&#xe606;</text>
          <text class="trend-text">较昨日 +12%</text>
        </view>
      </view>

      <view class="stat-card stat-card--orders">
        <text class="stat-label">今日订单数</text>
        <text class="stat-value">{{ stats.todayOrders }}</text>
        <view class="stat-trend">
          <text class="trend-icon">&#xe607;</text>
          <text class="trend-text">笔</text>
        </view>
      </view>

      <view class="stat-card stat-card--customers">
        <text class="stat-label">客户总数</text>
        <text class="stat-value">{{ stats.totalCustomers }}</text>
        <view class="stat-trend">
          <text class="trend-icon">&#xe608;</text>
          <text class="trend-text">位</text>
        </view>
      </view>

      <view class="stat-card stat-card--alerts">
        <text class="stat-label">库存预警</text>
        <text class="stat-value stat-value--danger">{{ stats.stockAlerts }}</text>
        <view class="stat-trend">
          <text class="trend-icon trend-icon--danger">&#xe609;</text>
          <text class="trend-text trend-text--danger">需关注</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-actions">
      <view class="quick-action" @tap="navigateTo('/pages/sales/create-sale')">
        <view class="quick-icon-wrap quick-icon-wrap--blue">
          <text class="quick-icon">&#xe610;</text>
        </view>
        <text class="quick-label">开单</text>
      </view>
      <view class="quick-action" @tap="navigateTo('/pages/products/products')">
        <view class="quick-icon-wrap quick-icon-wrap--green">
          <text class="quick-icon">&#xe611;</text>
        </view>
        <text class="quick-label">商品管理</text>
      </view>
      <view class="quick-action" @tap="navigateTo('/pages/customers/customers')">
        <view class="quick-icon-wrap quick-icon-wrap--orange">
          <text class="quick-icon">&#xe612;</text>
        </view>
        <text class="quick-label">客户管理</text>
      </view>
      <view class="quick-action" @tap="navigateTo('/pages/reports/reports')">
        <view class="quick-icon-wrap quick-icon-wrap--purple">
          <text class="quick-icon">&#xe613;</text>
        </view>
        <text class="quick-label">数据报表</text>
      </view>
    </view>

    <!-- 待办提醒 -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">待办提醒</text>
        <text class="section-more" @tap="navigateTo('/pages/todos/todos')">全部 ></text>
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
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { dashboardApi, type DashboardStats, type TodoItem } from '@/api/modules/dashboard'

const userStore = useUserStore()

const stats = ref<DashboardStats>({
  todaySales: 0,
  todayOrders: 0,
  totalCustomers: 0,
  stockAlerts: 0
})

const todos = ref<TodoItem[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const refresherTriggered = ref(false)

const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了，'
  if (hour < 12) return '早上好，'
  if (hour < 14) return '中午好，'
  if (hour < 18) return '下午好，'
  return '晚上好，'
})

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toFixed(2)
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function goNotifications() {
  uni.navigateTo({ url: '/pages/notifications/notifications' })
}

async function loadData() {
  loading.value = true
  try {
    const [statsData, todosData] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTodos()
    ])
    stats.value = statsData
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

<style scoped>
.home-page {
  min-height: 100vh;
  background: #f0f5ff;
  padding-bottom: env(safe-area-inset-bottom);
}

/* --- Header --- */
.home-header {
  background: linear-gradient(135deg, #1677FF, #4096ff);
  padding: 60rpx 32rpx 40rpx;
  padding-top: calc(60rpx + env(safe-area-inset-top));
  border-radius: 0 0 40rpx 40rpx;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.brand-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}

.brand-divider {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 12rpx;
}

.store-name {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.action-btn {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon {
  font-size: 36rpx;
  color: #fff;
}

.badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 32rpx;
  height: 32rpx;
  background: #ff4d4f;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
}

.header-greeting {
  display: flex;
  align-items: baseline;
}

.greeting-text {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
}

.greeting-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

/* --- 指标卡片 --- */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 24rpx 24rpx 0;
  margin-top: -20rpx;
}

.stat-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 12rpx;
  display: block;
}

.stat-value {
  font-size: 40rpx;
  font-weight: 700;
  color: #1677FF;
  margin-bottom: 8rpx;
  display: block;
}

.stat-value--danger {
  color: #ff4d4f;
}

.stat-trend {
  display: flex;
  align-items: center;
}

.trend-icon {
  font-size: 20rpx;
  color: #52c41a;
  margin-right: 4rpx;
}

.trend-icon--danger {
  color: #ff4d4f;
}

.trend-text {
  font-size: 22rpx;
  color: #52c41a;
}

.trend-text--danger {
  color: #ff4d4f;
}

/* --- 快捷入口 --- */
.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 28rpx 24rpx;
  margin: 20rpx 24rpx 0;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.quick-action {
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
  margin-bottom: 10rpx;
}

.quick-icon-wrap--blue { background: linear-gradient(135deg, #e6f4ff, #bae0ff); }
.quick-icon-wrap--green { background: linear-gradient(135deg, #f6ffed, #b7eb8f); }
.quick-icon-wrap--orange { background: linear-gradient(135deg, #fff7e6, #ffd591); }
.quick-icon-wrap--purple { background: linear-gradient(135deg, #f9f0ff, #d3adf7); }

.quick-icon {
  font-size: 40rpx;
  color: #1677FF;
}

.quick-label {
  font-size: 24rpx;
  color: #666;
}

/* --- 待办提醒 --- */
.section-card {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.section-more {
  font-size: 26rpx;
  color: #1677FF;
}

.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
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
  background: #1677FF;
}

.todo-dot--done {
  background: #bbb;
}

.todo-title {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.todo-title--done {
  color: #bbb;
  text-decoration: line-through;
}

.todo-date {
  font-size: 24rpx;
  color: #999;
  margin-left: 16rpx;
}

.empty-state {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #bbb;
}

.safe-bottom {
  height: 40rpx;
}
</style>