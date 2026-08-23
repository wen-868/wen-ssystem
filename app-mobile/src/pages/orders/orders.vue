<template>
  <view class="orders-page">
    <!-- 页头 -->
    <page-header title="订单管理" @back="goBack" />

    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索订单号 / 客户名"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
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
        <text class="tab-count" v-if="tabCounts[tab.value] !== undefined">{{ tabCounts[tab.value] }}</text>
      </view>
    </scroll-view>

    <!-- 筛选区域 -->
    <view class="filter-bar">
      <view class="filter-item" @tap="showCustomerPicker = true">
        <text class="filter-label">客户</text>
        <text class="filter-value" v-if="selectedCustomer">{{ selectedCustomer }}</text>
        <text class="filter-value filter-value--placeholder" v-else>全部客户</text>
        <image class="filter-arrow ic" src="/static/icons/ic/funnel.svg" mode="aspectFit"/>
      </view>
      <view class="filter-divider"></view>
      <view class="filter-item" @tap="showDatePicker = true">
        <text class="filter-label">时间</text>
        <text class="filter-value" v-if="dateRangeText">{{ dateRangeText }}</text>
        <text class="filter-value filter-value--placeholder" v-else>选择时间</text>
        <image class="filter-arrow ic" src="/static/icons/ic/funnel.svg" mode="aspectFit"/>
      </view>
      <view class="filter-divider"></view>
      <view class="filter-item filter-item--action" @tap="handleExport">
        <image class="filter-icon ic" src="/static/icons/ic/download.svg" mode="aspectFit"/>
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
        >
          <view class="order-card-header">
            <text class="order-no">{{ item.orderNo }}</text>
            <view class="order-status" :class="statusClass(item.status)">
              <text class="status-text">{{ item.statusLabel }}</text>
            </view>
          </view>

          <view class="order-card-body">
            <text class="order-items">{{ orderItemsSummary(item) }}</text>
          </view>

          <view class="order-card-footer">
            <text class="order-time">{{ item.customerName }} · {{ item.channel || '门店' }} · {{ formatTime(item.createdAt) }}</text>
            <text class="order-amount">¥{{ item.totalAmount.toFixed(2) }}</text>
          </view>

          <view class="order-card-actions">
            <view class="ord-action" @tap.stop="goDetail(item.orderNo)">
              <text class="ord-action-text">详情</text>
            </view>
            <view
              class="ord-action ord-action--primary"
              v-if="primaryAction(item) !== ''"
              @tap.stop="handleOrderAction(item, primaryAction(item))"
            >
              <text class="ord-action-text">{{ primaryAction(item) }}</text>
            </view>
          </view>
        </view>
      </template>
    </virtual-list>

    <view class="empty-state" v-if="!loading && orderList.length === 0">
      <image class="empty-icon" src="/static/icons/od-empty.svg" mode="aspectFit" />
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

// 原稿 tab：全部/待付款/待发货/已完成/退款；value 对齐后端 order_status 枚举（精确匹配）
const tabs = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'PENDING_PAYMENT' },
  { label: '待发货', value: 'ACCEPTED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '退款', value: 'REFUNDED' }
]

// 标签数量角标（原稿 tab 带计数；用真实接口统计，失败不阻塞页面）
const tabCounts = reactive<Record<string, number>>({})

async function loadTabCounts() {
  try {
    await Promise.all(tabs.map(async (t) => {
      const res = await ordersApi.list({ status: t.value || undefined, pageSize: 1, page: 1 })
      tabCounts[t.value] = res.total ?? 0
    }))
  } catch (err) {
    console.error('加载订单标签计数失败:', err)
  }
}

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

/** 单行高度（px），onMounted 时按 rpx 转 px 计算（含操作按钮行） */
const itemSize = ref(280)

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

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
}

function orderItemsSummary(order: OrderInfo): string {
  if (order.items && order.items.length > 0) {
    return order.items
      .slice(0, 3)
      .map((it) => `${it.productName || it.skuName || ''}×${it.quantity ?? it.totalBottleQty ?? ''}`)
      .join('  ')
  }
  return '暂无商品明细'
}

function statusClass(status: string): string {
  const s = (status || '').toUpperCase()
  // 待付款=红，待配送/配送中=橙，已完成=绿，退款/已取消=灰
  if (s === 'PENDING_PAYMENT' || s === 'UNPAID' || s === 'WAIT_PAY') return 'status-danger'
  if (s === 'PENDING' || s === 'ACCEPTED' || s === 'DELIVERING' || s === 'PROCESSING') return 'status-warning'
  if (s === 'COMPLETED' || s === 'DONE' || s === 'PAID') return 'status-success'
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'REFUNDED') return 'status-gray'
  return 'status-warning'
}

function primaryAction(order: OrderInfo): string {
  const s = (order.status || '').toUpperCase()
  // 待付款→确认收款；待发货/待配送(ACCEPTED)→配送
  if (s === 'PENDING_PAYMENT' || s === 'UNPAID' || s === 'PENDING') return '确认收款'
  if (s === 'ACCEPTED') return '配送'
  return ''
}

async function handleOrderAction(order: OrderInfo, action: string) {
  try {
    if (action === '确认收款') {
      uni.showLoading({ title: '处理中...' })
      await ordersApi.confirm(order.orderNo)
      uni.hideLoading()
      uni.showToast({ title: '已确认收款', icon: 'success' })
    } else if (action === '配送') {
      uni.showLoading({ title: '处理中...' })
      await ordersApi.startDelivery(order.orderNo)
      uni.hideLoading()
      uni.showToast({ title: '已开始配送', icon: 'success' })
    }
    onSearch()
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
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
  loadTabCounts()
})
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  display: flex;
  flex-direction: column;
}

/* 页头 */
.ord-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back:active {
  background: $uni-color-primary-soft;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
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
  padding: 0 28rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 26rpx 24rpx;
  position: relative;
  transition: all 0.2s ease;
}

.tab-text {
  font-size: 28rpx;
  color: $uni-gray-400;
  transition: color 0.2s ease;
}

.tab-item--active .tab-text {
  color: $uni-text-color;
  font-weight: 600;
}

.tab-count {
  font-size: 20rpx;
  color: $uni-gray-400;
  font-weight: 400;
  margin-left: 6rpx;
}

.tab-item--active .tab-count {
  color: $uni-color-primary;
}

.tab-item::after {
  content: '';
  position: absolute;
  bottom: -1rpx;
  left: 0;
  right: 0;
  height: 5rpx;
  background: $uni-color-primary;
  border-radius: 4rpx 4rpx 0 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tab-item--active::after {
  opacity: 1;
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
  padding: 20rpx 28rpx;
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
  border-radius: 32rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
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
  margin-bottom: 20rpx;
}

.order-no {
  font-size: 24rpx;
  color: $uni-gray-500;
  font-weight: 500;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.order-status {
  padding: 4rpx 20rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.status-danger { background: $uni-color-error-soft; }
.status-danger .status-text { color: $uni-color-error; }
.status-warning { background: $uni-color-warning-soft; }
.status-warning .status-text { color: $uni-color-warning; }
.status-success { background: $uni-color-success-soft; }
.status-success .status-text { color: $uni-color-success; }
.status-gray { background: $uni-bg-color-grey; }
.status-gray .status-text { color: $uni-gray-500; }

.order-card-body {
  margin-bottom: 16rpx;
}

.order-items {
  font-size: 26rpx;
  color: $uni-gray-600;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-amount {
  font-size: 34rpx;
  font-weight: 800;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.order-time {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.order-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding-top: 20rpx;
}

.ord-action {
  padding: 10rpx 32rpx;
  border-radius: 999rpx;
  border: 1rpx solid $uni-border-color;
}

.ord-action:active {
  background: $uni-bg-color-grey;
}

.ord-action--primary {
  background: $uni-gradient-blue;
  border-color: transparent;
  box-shadow: 0 4rpx 16rpx rgba(37, 99, 235, 0.2);
}

.ord-action--primary:active {
  opacity: 0.85;
}

.ord-action-text {
  font-size: 24rpx;
  color: $uni-gray-600;
  font-weight: 500;
}

.ord-action--primary .ord-action-text {
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
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
