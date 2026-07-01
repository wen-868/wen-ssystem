<template>
  <view class="orders-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索订单号 / 客户名"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- Tab 切换 -->
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

    <!-- 订单列表 -->
    <scroll-view
      class="order-list"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onPullDownRefresh"
      @scrolltolower="onLoadMore"
    >
      <view class="order-card" v-for="order in orderList" :key="order.orderNo" @tap="goDetail(order.orderNo)">
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

      <!-- 空状态 -->
      <view class="empty-state" v-if="!loading && orderList.length === 0">
        <text class="empty-icon">&#xe617;</text>
        <text class="empty-text">暂无订单数据</text>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="orderList.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

const tabs = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

const keyword = ref('')
const activeTab = ref('')
const orderList = ref<OrderInfo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function switchTab(tab: string) {
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
  keyword.value = ''
  onSearch()
}

async function loadOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await ordersApi.list({
      keyword: keyword.value || undefined,
      status: activeTab.value || undefined,
      page: page.value,
      pageSize
    })
    orderList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载订单失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await ordersApi.list({
      keyword: keyword.value || undefined,
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
      keyword: keyword.value || undefined,
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
  uni.navigateTo({ url: `/pages/orders/order-detail?orderNo=${orderNo}` })
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

/* 搜索栏 */
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

/* Tab Bar */
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
}

.tab-text {
  font-size: 28rpx;
  color: #666;
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
}

/* 订单列表 */
.order-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
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
  font-size: 30rpx;
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
  color: #bbb;
}

/* 空状态 */
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

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 24rpx 0;
}

.load-more-text {
  font-size: 24rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>