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

    <!-- 筛选区域 -->
    <view class="filter-bar">
      <view class="filter-item" @tap="showCustomerPicker = true">
        <text class="filter-label">客户</text>
        <text class="filter-value" v-if="selectedCustomer">{{ selectedCustomer }}</text>
        <text class="filter-value filter-value--placeholder" v-else>全部客户</text>
        <text class="filter-arrow">&#xe616;</text>
      </view>
      <view class="filter-divider"></view>
      <view class="filter-item" @tap="showDatePicker = true">
        <text class="filter-label">时间</text>
        <text class="filter-value" v-if="dateRangeText">{{ dateRangeText }}</text>
        <text class="filter-value filter-value--placeholder" v-else>选择时间</text>
        <text class="filter-arrow">&#xe616;</text>
      </view>
      <view class="filter-divider"></view>
      <view class="filter-item filter-item--action" @tap="handleExport">
        <text class="filter-icon">&#xe624;</text>
        <text class="filter-label">导出</text>
      </view>
    </view>

    <view class="loading-overlay" v-if="loading && orderList.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 虚拟滚动订单列表 -->
    <virtual-list
      v-if="orderList.length > 0"
      class="order-list"
      :data="orderList"
      :item-size="itemSize"
      :height="0"
      :buffer="5"
      item-key="orderNo"
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @load-more="onLoadMore"
      @refresh="onPullDownRefresh"
    >
      <template #default="{ item }">
        <view
          class="order-card"
          @tap="goDetail(item.orderNo)"
          @touchstart="activeCard = item.orderNo"
          @touchend="activeCard = null"
          :class="{ 'card-active': activeCard === item.orderNo }"
        >
          <view class="order-card-header">
            <text class="order-no">订单号：{{ item.orderNo }}</text>
            <view class="order-status" :class="'status-' + item.status">
              <text class="status-text">{{ item.statusLabel }}</text>
            </view>
          </view>

          <view class="order-card-body">
            <text class="order-customer">{{ item.customerName }}</text>
            <text class="order-amount">¥{{ item.totalAmount.toFixed(2) }}</text>
          </view>

          <view class="order-card-footer">
            <text class="order-time">{{ formatTime(item.createdAt) }}</text>
            <text class="order-arrow">&#xe616;</text>
          </view>
        </view>
      </template>
    </virtual-list>

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

    <!-- 客户选择弹窗 -->
    <view class="picker-mask" v-if="showCustomerPicker" @tap="showCustomerPicker = false">
      <view class="picker-popup" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择客户</text>
          <text class="picker-close" @tap="showCustomerPicker = false">×</text>
        </view>
        <scroll-view class="picker-content" scroll-y>
          <view
            class="picker-item"
            :class="{ 'picker-item--active': !selectedCustomer }"
            @tap="selectCustomer('')"
          >
            <text class="picker-item-text">全部客户</text>
            <view class="picker-check" v-if="!selectedCustomer">✓</view>
          </view>
          <view
            class="picker-item"
            v-for="customer in customerList"
            :key="customer.id"
            :class="{ 'picker-item--active': selectedCustomer === customer.name }"
            @tap="selectCustomer(customer)"
          >
            <text class="picker-item-text">{{ customer.name }}</text>
            <view class="picker-check" v-if="selectedCustomer === customer.name">✓</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 日期选择弹窗 -->
    <view class="picker-mask" v-if="showDatePicker" @tap="showDatePicker = false">
      <view class="picker-popup" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择时间范围</text>
          <text class="picker-close" @tap="showDatePicker = false">×</text>
        </view>
        <view class="date-picker-content">
          <view class="date-picker-item">
            <text class="date-picker-label">开始日期</text>
            <picker mode="date" :value="searchForm.startDate" @change="onStartDateChange">
              <view class="date-picker-value">
                <text>{{ searchForm.startDate || '请选择' }}</text>
                <text class="date-picker-arrow">▾</text>
              </view>
            </picker>
          </view>
          <view class="date-picker-item">
            <text class="date-picker-label">结束日期</text>
            <picker mode="date" :value="searchForm.endDate" @change="onEndDateChange">
              <view class="date-picker-value">
                <text>{{ searchForm.endDate || '请选择' }}</text>
                <text class="date-picker-arrow">▾</text>
              </view>
            </picker>
          </view>
          <view class="date-quick-options">
            <view class="quick-btn" :class="{ 'quick-btn--active': quickDate === 'today' }" @tap="selectQuickDate('today')">今天</view>
            <view class="quick-btn" :class="{ 'quick-btn--active': quickDate === 'week' }" @tap="selectQuickDate('week')">近7天</view>
            <view class="quick-btn" :class="{ 'quick-btn--active': quickDate === 'month' }" @tap="selectQuickDate('month')">近30天</view>
            <view class="quick-btn" :class="{ 'quick-btn--active': quickDate === 'quarter' }" @tap="selectQuickDate('quarter')">近90天</view>
          </view>
          <view class="date-picker-actions">
            <button class="picker-cancel-btn" @tap="showDatePicker = false">取消</button>
            <button class="picker-confirm-btn" @tap="confirmDateFilter">确定</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'
import VirtualList from '@/components/virtual-list.vue'

const tabs = [
  { label: '全部', value: '' },
  { label: '待确认', value: 'pending' },
  { label: '待处理', value: 'processing' },
  { label: '配送中', value: 'delivering' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

const searchForm = reactive({
  keyword: '',
  customerName: '',
  startDate: '',
  endDate: ''
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
const showCustomerPicker = ref(false)
const showDatePicker = ref(false)
const quickDate = ref('')
const customerList = ref<CustomerInfo[]>([])
const selectedCustomer = ref('')

/** 单行高度（px），onMounted 时按 rpx 转 px 计算 */
const itemSize = ref(220)

const dateRangeText = computed(() => {
  if (!searchForm.startDate && !searchForm.endDate) return ''
  if (searchForm.startDate === searchForm.endDate) return searchForm.startDate
  return `${searchForm.startDate} ~ ${searchForm.endDate}`
})

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

function selectCustomer(customer: CustomerInfo | '') {
  if (customer === '') {
    selectedCustomer.value = ''
    searchForm.customerName = ''
  } else {
    selectedCustomer.value = customer.name
    searchForm.customerName = customer.name
  }
  showCustomerPicker.value = false
  onSearch()
}

function onStartDateChange(e: any) {
  searchForm.startDate = e.detail.value
}

function onEndDateChange(e: any) {
  searchForm.endDate = e.detail.value
}

function selectQuickDate(type: string) {
  quickDate.value = type
  const today = new Date()
  let startDate: Date

  switch (type) {
    case 'today':
      startDate = today
      break
    case 'week':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'quarter':
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = today
  }

  searchForm.startDate = formatDate(startDate)
  searchForm.endDate = formatDate(today)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

function confirmDateFilter() {
  showDatePicker.value = false
  onSearch()
}

async function loadCustomers() {
  try {
    const result = await customersApi.list({
      page: 1,
      pageSize: 50,
    })
    customerList.value = result.list || []
  } catch (err) {
    console.error('加载客户列表失败:', err)
    uni.showToast({ title: '加载客户失败', icon: 'none' })
  }
}

async function loadOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await ordersApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      customerName: searchForm.customerName || undefined,
      startDate: searchForm.startDate || undefined,
      endDate: searchForm.endDate || undefined,
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
      customerName: searchForm.customerName || undefined,
      startDate: searchForm.startDate || undefined,
      endDate: searchForm.endDate || undefined,
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
      customerName: searchForm.customerName || undefined,
      startDate: searchForm.startDate || undefined,
      endDate: searchForm.endDate || undefined,
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

async function handleExport() {
  uni.showLoading({ title: '导出中...' })
  try {
    const blob = await ordersApi.export({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      customerName: searchForm.customerName || undefined,
      startDate: searchForm.startDate || undefined,
      endDate: searchForm.endDate || undefined
    })

    // H5 端下载处理
    // #ifdef H5
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `订单列表_${formatDate(new Date())}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    // #endif

    // 小程序端处理
    // #ifndef H5
    uni.showToast({ title: '导出成功', icon: 'success' })
    // #endif
  } catch (err) {
    console.error('导出失败:', err)
    uni.showToast({ title: '导出失败', icon: 'none' })
  } finally {
    uni.hideLoading()
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
  // 220rpx 转 px（依赖屏幕宽度）
  try {
    itemSize.value = uni.upx2px(220)
  } catch (err) {
    itemSize.value = 110
  }
  loadCustomers()
  loadOrders()
})
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.tab-bar {
  background: $uni-bg-color;
  white-space: nowrap;
  padding: 0 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.tab-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 20rpx;
  position: relative;
  transition: all 0.2s ease;
}

.tab-text {
  font-size: 26rpx;
  color: $uni-gray-500;
  transition: color 0.2s ease;
}

.tab-item--active .tab-text {
  color: $uni-color-primary;
  font-weight: 600;
}

.tab-indicator {
  width: 40rpx;
  height: 6rpx;
  background: $uni-color-primary;
  border-radius: 3rpx;
  position: absolute;
  bottom: 4rpx;
  transition: width 0.3s ease;
}

.filter-bar {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.filter-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.filter-item--action {
  flex: 0.5;
  color: $uni-color-primary;
}

.filter-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.filter-item--action .filter-label {
  color: $uni-color-primary;
}

.filter-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.filter-value--placeholder {
  color: $uni-gray-300;
}

.filter-arrow {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.filter-icon {
  font-size: 28rpx;
}

.filter-divider {
  width: 1rpx;
  height: 40rpx;
  background: $uni-gray-100;
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
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-top: 20rpx;
}

.order-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  box-sizing: border-box;
  height: 100%;
}

.order-card:active,
.card-active {
  transform: scale(0.98);
  background: $uni-gray-50;
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.order-no {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.order-status {
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }

.status-processing { background: $uni-color-warning-soft; }
.status-processing .status-text { color: $uni-color-warning; }

.status-delivering { background: $uni-color-primary-soft; }
.status-delivering .status-text { color: $uni-color-primary; }

.status-completed { background: $uni-color-success-soft; }
.status-completed .status-text { color: $uni-color-success; }

.status-cancelled { background: $uni-color-error-soft; }
.status-cancelled .status-text { color: $uni-color-error; }

.order-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.order-customer {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.order-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.order-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
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
  border: 3rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}

/* 弹窗样式 */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.picker-popup {
  width: 100%;
  background: $uni-bg-color;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 70vh;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.picker-close {
  font-size: 48rpx;
  color: $uni-gray-400;
  line-height: 1;
}

.picker-content {
  max-height: 50vh;
}

.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-50;
}

.picker-item-text {
  font-size: 28rpx;
  color: $uni-gray-700;
}

.picker-item--active .picker-item-text {
  color: $uni-color-primary;
  font-weight: 600;
}

.picker-check {
  font-size: 32rpx;
  color: $uni-color-primary;
}

/* 日期选择弹窗 */
.date-picker-content {
  padding: 24rpx 32rpx;
}

.date-picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.date-picker-label {
  font-size: 28rpx;
  color: $uni-gray-500;
}

.date-picker-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.date-picker-arrow {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.date-quick-options {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 0;
}

.quick-btn {
  flex: 1;
  padding: 16rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-500;
  background: $uni-bg-color-page;
  border-radius: 8rpx;
}

.quick-btn--active {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}

.date-picker-actions {
  display: flex;
  gap: 24rpx;
  padding-top: 16rpx;
}

.picker-cancel-btn,
.picker-confirm-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.picker-cancel-btn {
  background: $uni-bg-color-page;
  color: $uni-gray-500;
}

.picker-confirm-btn {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}
</style>
