<template>
  <view class="order-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-box" @tap="toggleSearch">
        <text class="search-icon">🔍</text>
        <input
          v-if="showSearch"
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="搜索订单号"
          confirm-type="search"
          @confirm="handleSearch"
          @blur="handleSearchBlur"
          focus
        />
        <text v-else class="search-placeholder">搜索订单号</text>
      </view>
    </view>

    <!-- 状态Tab -->
    <scroll-view scroll-x class="status-tabs" :show-scrollbar="false">
      <view
        class="tab-item"
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="{ active: currentStatus === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-line" v-if="currentStatus === tab.value"></view>
      </view>
    </scroll-view>

    <!-- 订单列表 -->
    <scroll-view
      scroll-y
      class="order-list"
      @scrolltolower="loadMore"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="order-empty" v-if="orderList.length === 0 && !loading">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无订单</text>
        <text class="empty-hint">快去逛逛吧</text>
        <view class="go-shopping" @tap="goShopping">去购物</view>
      </view>

      <view class="order-cards" v-else>
        <view
          class="order-card"
          v-for="order in orderList"
          :key="order.id"
          @tap="goDetail(order.id)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <text class="order-no">订单号：{{ order.orderNo }}</text>
            <text class="order-status" :style="{ color: getStatusColor(order.status) }">
              {{ getStatusText(order.status) }}
            </text>
          </view>

          <!-- 商品列表 -->
          <view class="goods-list">
            <view class="goods-item" v-for="item in order.items.slice(0, 2)" :key="item.id">
              <image :src="item.productImage" mode="aspectFill" class="goods-image" />
              <view class="goods-info">
                <text class="goods-name ellipsis-2">{{ item.productName }}</text>
                <text class="goods-sku" v-if="item.skuName">{{ item.skuName }}</text>
                <view class="goods-bottom">
                  <text class="goods-price">¥{{ item.price.toFixed(2) }}</text>
                  <text class="goods-qty">x{{ item.quantity }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 更多商品 -->
          <view class="more-goods" v-if="order.items.length > 2">
            <text class="more-text">共{{ order.items.length }}件商品</text>
          </view>

          <!-- 订单金额 -->
          <view class="order-amount">
            <text class="amount-label">实付：</text>
            <text class="amount-value">¥{{ order.payAmount.toFixed(2) }}</text>
          </view>

          <!-- 操作按钮 -->
          <view class="order-actions">
            <view
              class="action-btn outline"
              v-if="order.status === 'PENDING_PAY'"
              @tap.stop="cancelOrder(order.id)"
            >
              取消订单
            </view>
            <view
              class="action-btn primary"
              v-if="order.status === 'PENDING_PAY'"
              @tap.stop="goPay(order.id)"
            >
              去支付
            </view>
            <view
              class="action-btn outline"
              v-if="order.status === 'PENDING_SHIP'"
              @tap.stop="contactService"
            >
              联系客服
            </view>
            <view
              class="action-btn outline"
              v-if="order.status === 'PENDING_RECEIVE'"
              @tap.stop="viewLogistics(order.id)"
            >
              查看物流
            </view>
            <view
              class="action-btn primary"
              v-if="order.status === 'PENDING_RECEIVE'"
              @tap.stop="confirmReceive(order.id)"
            >
              确认收货
            </view>
            <view
              class="action-btn outline"
              v-if="order.status === 'COMPLETED'"
              @tap.stop="applyAftersale(order.id)"
            >
              申请售后
            </view>
            <view
              class="action-btn primary"
              v-if="order.status === 'COMPLETED'"
              @tap.stop="goReview(order.id)"
            >
              去评价
            </view>
            <view
              class="action-btn outline"
              v-if="order.status === 'CANCELLED'"
              @tap.stop="deleteOrder(order.id)"
            >
              删除订单
            </view>
          </view>
        </view>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="loading && orderList.length > 0">
        <text class="loading-text">加载中...</text>
      </view>

      <view class="no-more" v-if="!hasMore && orderList.length > 0">
        <text class="no-more-text">没有更多了</text>
      </view>

      <view class="list-bottom" v-if="orderList.length > 0"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  orderApi,
  ORDER_STATUS_TEXT,
  ORDER_STATUS_COLOR,
  type OrderInfo,
  type OrderStatus
} from '@/api/order'

const router = useRouter()

const statusTabs = [
  { label: '全部', value: 'ALL' },
  { label: '待付款', value: 'PENDING_PAY' },
  { label: '待发货', value: 'PENDING_SHIP' },
  { label: '待收货', value: 'PENDING_RECEIVE' },
  { label: '已完成', value: 'COMPLETED' }
]

const currentStatus = ref<string>('ALL')
const orderList = ref<OrderInfo[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const isRefreshing = ref(false)
const showSearch = ref(false)
const searchKeyword = ref('')

const hasMore = computed(() => {
  return orderList.value.length < total.value
})

const getStatusText = (status: OrderStatus): string => {
  return ORDER_STATUS_TEXT[status] || status
}

const getStatusColor = (status: OrderStatus): string => {
  return ORDER_STATUS_COLOR[status] || '#333'
}

const loadOrders = async (isRefresh = false) => {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    orderList.value = []
  }

  loading.value = true

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    }

    if (currentStatus.value !== 'ALL') {
      params.status = currentStatus.value
    }

    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }

    const result = await orderApi.getOrderList(params as any)

    if (isRefresh) {
      orderList.value = result.list
    } else {
      orderList.value = [...orderList.value, ...result.list]
    }
    total.value = result.total
  } catch (error) {
    console.error('加载订单列表失败:', error)
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

const switchTab = (status: string) => {
  if (currentStatus.value === status) return
  currentStatus.value = status
  page.value = 1
  orderList.value = []
  loadOrders(true)
}

const onRefresh = () => {
  isRefreshing.value = true
  loadOrders(true)
}

const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadOrders()
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchKeyword.value = ''
    loadOrders(true)
  }
}

const handleSearch = () => {
  showSearch.value = false
  loadOrders(true)
}

const handleSearchBlur = () => {
  // 搜索框失焦时，如果有关键词则搜索
  if (searchKeyword.value) {
    loadOrders(true)
  }
}

const goDetail = (orderId: number) => {
  Taro.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
}

const goPay = (orderId: number) => {
  Taro.navigateTo({ url: `/pages/order/pay?id=${orderId}` })
}

const viewLogistics = (orderId: number) => {
  Taro.navigateTo({ url: `/pages/order/track?id=${orderId}` })
}

const cancelOrder = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.cancelOrder(orderId)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          loadOrders(true)
        } catch (error) {
          console.error('取消订单失败:', error)
        }
      }
    }
  })
}

const confirmReceive = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.confirmReceive(orderId)
          Taro.showToast({ title: '确认收货成功', icon: 'success' })
          loadOrders(true)
        } catch (error) {
          console.error('确认收货失败:', error)
        }
      }
    }
  })
}

const applyAftersale = (orderId: number) => {
  Taro.showToast({ title: '申请售后功能开发中', icon: 'none' })
}

const goReview = (orderId: number) => {
  Taro.showToast({ title: '评价功能开发中', icon: 'none' })
}

const deleteOrder = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要删除这个订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.deleteOrder(orderId)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          loadOrders(true)
        } catch (error) {
          console.error('删除订单失败:', error)
        }
      }
    }
  })
}

const contactService = () => {
  Taro.showToast({ title: '客服功能开发中', icon: 'none' })
}

const goShopping = () => {
  Taro.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  // 从路由参数获取初始状态
  const status = router.params.status
  if (status && status !== 'ALL') {
    currentStatus.value = status.toUpperCase()
  }
  loadOrders(true)
})
</script>

<style lang="scss" scoped>
.order-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: $spacing-sm $spacing-md;
  background-color: $bg-primary;
}

.search-box {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-lg;
}

.search-icon {
  font-size: $font-size-base;
  margin-right: $spacing-sm;
}

.search-placeholder {
  font-size: $font-size-sm;
  color: $text-placeholder;
  flex: 1;
}

.search-input {
  flex: 1;
  font-size: $font-size-sm;
  color: $text-primary;
}

.status-tabs {
  white-space: nowrap;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $border-color;
  padding: 0 $spacing-sm;
}

.tab-item {
  display: inline-block;
  position: relative;
  padding: $spacing-md $spacing-lg;
}

.tab-text {
  font-size: $font-size-base;
  color: $text-secondary;
}

.tab-item.active .tab-text {
  color: $primary-color;
  font-weight: bold;
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 6rpx;
  background-color: $primary-color;
  border-radius: 3rpx;
}

.order-list {
  flex: 1;
  padding: $spacing-md;
}

.order-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-lg;
}

.empty-text {
  font-size: $font-size-lg;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.empty-hint {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-bottom: $spacing-xl;
}

.go-shopping {
  padding: $spacing-md $spacing-xl;
  background-color: $primary-color;
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-size-base;
}

.order-cards {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.order-card {
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.order-no {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.order-status {
  font-size: $font-size-sm;
  font-weight: bold;
}

.goods-list {
  padding: $spacing-md;
}

.goods-item {
  display: flex;
  margin-bottom: $spacing-md;

  &:last-child {
    margin-bottom: 0;
  }
}

.goods-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.goods-info {
  flex: 1;
  margin-left: $spacing-md;
  display: flex;
  flex-direction: column;
}

.goods-name {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.goods-sku {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: $spacing-sm;
}

.goods-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.goods-price {
  font-size: $font-size-base;
  color: $text-primary;
}

.goods-qty {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.more-goods {
  padding: 0 $spacing-md $spacing-md;
  text-align: right;
}

.more-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.order-amount {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 $spacing-md $spacing-md;
}

.amount-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.amount-value {
  font-size: $font-size-md;
  color: $error-color;
  font-weight: bold;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md $spacing-md;
  border-top: 1rpx solid $border-color;
}

.action-btn {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-lg;
  font-size: $font-size-sm;
  min-width: 140rpx;
  text-align: center;

  &.outline {
    background-color: $bg-primary;
    border: 1rpx solid $border-color;
    color: $text-secondary;
  }

  &.primary {
    background-color: $primary-color;
    color: #fff;
  }
}

.load-more,
.no-more {
  text-align: center;
  padding: $spacing-lg;
}

.loading-text,
.no-more-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.list-bottom {
  height: $spacing-lg;
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
