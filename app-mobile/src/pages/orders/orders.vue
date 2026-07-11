<template>
  <view class="orders-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索订单号 / 客户名"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <scroll-view class="tab-bar" scroll-x :show-scrollbar="false">
      <view
        class="tab-item"
        v-for="tab in tabs"
        :key="tab.value"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view v-if="activeTab === tab.value" class="tab-indicator"></view>
      </view>
    </scroll-view>

    <scroll-view
      class="order-list"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onPullDownRefresh"
      @scrolltolower="onLoadMore"
    >
      <view class="loading-overlay" v-if="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <view
        class="order-card"
        v-for="order in orderList"
        :key="order.orderNo"
        @tap="goDetail(order.orderNo)"
        @touchstart="activeCard = order.orderNo"
        @touchend="activeCard = null"
        :class="{ 'card-active': activeCard === order.orderNo }"
      >
        <view class="order-card-header">
          <text class="order-no">订单号：{{ order.orderNo }}</text>
          <view class="order-status" :class="'status-' + order.status">
            <text class="status-text">{{ order.statusLabel }}</text>
          </view>
        </view>

        <view class="order-card-body">
          <text class="order-customer">{{ order.customerName }}</text>
          <text class="order-amount">¥{{ order.totalAmount.toFixed(2) }}</text>
        </view>

        <view class="order-card-footer">
          <text class="order-time">{{ order.createdAt }}</text>
          <text class="order-arrow">&#xe616;</text>
        </view>
      </view>

      <view class="empty-state" v-if="!loading && orderList.length === 0">
        <text class="empty-icon">&#xe617;</text>
        <text class="empty-text">暂无订单数据</text>
      </view>

      <view class="load-more" v-if="orderList.length > 0">
        <view class="loading-more-spinner" v-if="loadingMore"></view>
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

const tabs = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

const searchForm = reactive({
  keyword: '',
})

const activeTab = ref('')
const orderList = ref<OrderInfo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const activeCard = ref<string | null>(null)
const navigating = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function switchTab(tab: string) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  page.value = 1
  orderList.value = []
  noMore.value = false
  loadOrders()
}

function onSearch() {
  page.value = 1
  orderList.value = []
  noMore.value = false
  loadOrders()
}

function clearSearch() {
  searchForm.keyword = ''
  onSearch()
}

async function loadOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await ordersApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      page: page.value,
      pageSize
    })
    orderList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载订单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    refresherTriggered.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await ordersApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      page: page.value,
      pageSize
    })
    if (result.list.length === 0) {
      noMore.value = true
      page.value--
    } else {
      orderList.value = [...orderList.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

async function onPullDownRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  try {
    const result = await ordersApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      page: 1,
      pageSize
    })
    orderList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('刷新失败:', err)
  } finally {
    refresherTriggered.value = false
  }
}

function goDetail(orderNo: string) {
  if (navigating.value) return
  navigating.value = true
  uni.navigateTo({
    url: `/pages/orders/order-detail?orderNo=${orderNo}`,
    complete: () => { navigating.value = false }
  })
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: #bbb;
  padding: 4rpx;
}

.tab-bar {
  background: #fff;
  white-space: nowrap;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 24rpx;
  position: relative;
  transition: all 0.2s ease;
}

.tab-text {
  font-size: 28rpx;
  color: #666;
  transition: color 0.2s ease;
}

.tab-item--active .tab-text {
  color: #1677FF;
  font-weight: 600;
}

.tab-indicator {
  width: 40rpx;
  height: 6rpx;
  background: #1677FF;
  border-radius: 3rpx;
  position: absolute;
  bottom: 4rpx;
  transition: width 0.3s ease;
}

.order-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #1677FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #999;
  margin-top: 20rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.order-card:active,
.card-active {
  transform: scale(0.98);
  background: #f9fafc;
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.order-no {
  font-size: 26rpx;
  color: #666;
}

.order-status {
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }

.status-delivering { background: #e6f7ff; }
.status-delivering .status-text { color: #1677FF; }

.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }

.status-cancelled { background: #fff2f0; }
.status-cancelled .status-text { color: #ff4d4f; }

.order-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.order-customer {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.order-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: #1677FF;
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 24rpx;
  color: #999;
}

.order-arrow {
  font-size: 28rpx;
  color: #ddd;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  gap: 12rpx;
}

.loading-more-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid #e0e0e0;
  border-top-color: #1677FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.load-more-text {
  font-size: 24rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
