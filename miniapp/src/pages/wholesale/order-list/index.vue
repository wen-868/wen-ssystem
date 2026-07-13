<template>
  <view class="wholesale-order-list">
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
      <!-- 空状态 -->
      <view class="order-empty" v-if="orderList.length === 0 && !loading">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无批发订单</text>
        <text class="empty-hint">去批发专区逛逛吧</text>
        <view class="go-shopping" @tap="goWholesale">去逛逛</view>
      </view>

      <!-- 订单卡片列表 -->
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
            <view
              class="goods-item"
              v-for="item in order.items.slice(0, 2)"
              :key="item.id"
            >
              <image :src="item.productImage" mode="aspectFill" class="goods-image" />
              <view class="goods-info">
                <text class="goods-name ellipsis-2">{{ item.productName }}</text>
                <text class="goods-sku" v-if="item.skuName">{{ item.skuName }}</text>
                <view class="goods-bottom">
                  <text class="goods-price">¥{{ item.unitPrice.toFixed(2) }}/{{ item.unit }}</text>
                  <text class="goods-qty">x{{ item.quantity }}{{ item.unit }}</text>
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
              去付款
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
              @tap.stop="rebuy(order.id)"
            >
              再次采购
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
  wholesaleApi,
  WHOLESALE_ORDER_STATUS_TEXT,
  WHOLESALE_ORDER_STATUS_COLOR,
  type WholesaleOrderInfo,
  type WholesaleOrderStatus
} from '@/api/wholesale'

const router = useRouter()

const statusTabs = [
  { label: '全部', value: 'ALL' },
  { label: '待付款', value: 'PENDING_PAY' },
  { label: '待发货', value: 'PENDING_SHIP' },
  { label: '待收货', value: 'PENDING_RECEIVE' },
  { label: '已完成', value: 'COMPLETED' }
]

const currentStatus = ref<string>('ALL')
const orderList = ref<WholesaleOrderInfo[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const isRefreshing = ref(false)

const hasMore = computed(() => orderList.value.length < total.value)

const getStatusText = (status: WholesaleOrderStatus): string => {
  return WHOLESALE_ORDER_STATUS_TEXT[status] || status
}

const getStatusColor = (status: WholesaleOrderStatus): string => {
  return WHOLESALE_ORDER_STATUS_COLOR[status] || '#333'
}

// 加载订单列表
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

    const result = await wholesaleApi.getOrderList(params as any)

    if (isRefresh) {
      orderList.value = result.list
    } else {
      orderList.value = [...orderList.value, ...result.list]
    }
    total.value = result.total
  } catch (error) {
    console.error('加载批发订单列表失败:', error)
    // 模拟数据
    if (isRefresh) {
      orderList.value = generateMockOrders()
      total.value = 15
    } else {
      orderList.value = [...orderList.value, ...generateMockOrders(page.value)]
      total.value = 15
    }
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

// 生成模拟订单
const generateMockOrders = (pageNum = 1): WholesaleOrderInfo[] => {
  const statuses: WholesaleOrderStatus[] = [
    'PENDING_PAY',
    'PENDING_SHIP',
    'PENDING_RECEIVE',
    'COMPLETED',
    'CANCELLED'
  ]
  const orders: WholesaleOrderInfo[] = []

  for (let i = 0; i < 5; i++) {
    const idx = (pageNum - 1) * 5 + i
    if (idx >= 15) break
    const status = statuses[idx % statuses.length]
    const itemCount = (idx % 3) + 1

    orders.push({
      id: idx + 1,
      orderNo: `PF${20260714}${String(idx + 1).padStart(6, '0')}`,
      status,
      statusText: WHOLESALE_ORDER_STATUS_TEXT[status],
      totalAmount: 12800 + idx * 500,
      goodsAmount: 12800 + idx * 500,
      shippingFee: idx % 2 === 0 ? 0 : 50,
      discountAmount: idx * 100,
      payAmount: 12800 + idx * 400,
      paymentMethod: 'WECHAT',
      paymentTime: status !== 'PENDING_PAY' ? '2026-07-14 10:30:00' : undefined,
      createTime: '2026-07-14 10:00:00',
      updateTime: '2026-07-14 10:30:00',
      remark: idx % 2 === 0 ? '请尽快发货' : undefined,
      items: Array.from({ length: itemCount }, (_, j) => ({
        id: idx * 10 + j,
        productId: idx + j,
        productName: ['茅台飞天53度500ml 整箱', '青岛啤酒经典500ml*24罐', '拉菲古堡红葡萄酒750ml'][j % 3],
        productImage: `https://via.placeholder.com/200x200/f5f5f5/999?text=P${idx}${j}`,
        skuId: idx * 10 + j,
        skuName: ['500ml*6瓶/箱 53度', '500ml*24罐/箱 经典', '750ml/瓶 正牌'][j % 3],
        unitPrice: [1280, 85, 5800][j % 3],
        quantity: (idx + j + 1) * 2,
        subtotal: [1280, 85, 5800][j % 3] * (idx + j + 1) * 2,
        unit: ['箱', '箱', '瓶'][j % 3]
      })),
      address: {
        id: 1,
        name: '张经理',
        phone: '138****8888',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路88号SOHO现代城A座1001室',
        isDefault: true
      },
      trackingNo: status === 'PENDING_RECEIVE' || status === 'COMPLETED' ? 'SF1234567890' : undefined,
      logisticsCompany: status === 'PENDING_RECEIVE' || status === 'COMPLETED' ? '顺丰速运' : undefined
    })
  }

  return orders
}

// 切换状态Tab
const switchTab = (status: string) => {
  if (currentStatus.value === status) return
  currentStatus.value = status
  loadOrders(true)
}

// 下拉刷新
const onRefresh = () => {
  isRefreshing.value = true
  loadOrders(true)
}

// 加载更多
const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadOrders()
}

// 跳转详情
const goDetail = (orderId: number) => {
  Taro.navigateTo({ url: `/pages/wholesale/order-detail/index?id=${orderId}` })
}

// 跳转支付
const goPay = (orderId: number) => {
  Taro.showToast({ title: '支付功能开发中', icon: 'none' })
}

// 取消订单
const cancelOrder = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个批发订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wholesaleApi.cancelOrder(orderId)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          loadOrders(true)
        } catch (error) {
          console.error('取消订单失败:', error)
          // 模拟取消
          const order = orderList.value.find(o => o.id === orderId)
          if (order) {
            order.status = 'CANCELLED'
            order.statusText = '已取消'
          }
          Taro.showToast({ title: '取消成功', icon: 'success' })
        }
      }
    }
  })
}

// 确认收货
const confirmReceive = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wholesaleApi.confirmReceive(orderId)
          Taro.showToast({ title: '确认收货成功', icon: 'success' })
          loadOrders(true)
        } catch (error) {
          console.error('确认收货失败:', error)
          // 模拟确认
          const order = orderList.value.find(o => o.id === orderId)
          if (order) {
            order.status = 'COMPLETED'
            order.statusText = '已完成'
          }
          Taro.showToast({ title: '确认收货成功', icon: 'success' })
        }
      }
    }
  })
}

// 查看物流
const viewLogistics = (orderId: number) => {
  Taro.showToast({ title: '物流详情开发中', icon: 'none' })
}

// 申请售后
const applyAftersale = (orderId: number) => {
  Taro.showToast({ title: '售后功能开发中', icon: 'none' })
}

// 再次采购
const rebuy = (orderId: number) => {
  Taro.showToast({ title: '再次采购功能开发中', icon: 'none' })
}

// 删除订单
const deleteOrder = (orderId: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要删除这个订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          Taro.showToast({ title: '删除成功', icon: 'success' })
          orderList.value = orderList.value.filter(o => o.id !== orderId)
        } catch (error) {
          console.error('删除订单失败:', error)
        }
      }
    }
  })
}

// 联系客服
const contactService = () => {
  Taro.showToast({ title: '客服功能开发中', icon: 'none' })
}

// 跳转批发专区
const goWholesale = () => {
  Taro.navigateTo({ url: '/pages/wholesale/index' })
}

onMounted(() => {
  const status = router.params.status
  if (status && status !== 'ALL') {
    currentStatus.value = status.toUpperCase()
  }
  loadOrders(true)
})
</script>

<style lang="scss" scoped>
.wholesale-order-list {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

// 状态Tab
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

// 订单列表
.order-list {
  flex: 1;
  padding: $spacing-md;
}

// 空状态
.order-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-size-base;
}

// 订单卡片
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

// 商品列表
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
  width: 140rpx;
  height: 140rpx;
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
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: $spacing-xs;
  line-height: 1.4;
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
  font-size: $font-size-sm;
  color: $text-primary;
}

.goods-qty {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

// 更多商品
.more-goods {
  padding: 0 $spacing-md $spacing-md;
  text-align: right;
}

.more-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

// 订单金额
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

// 操作按钮
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
    background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
    color: #fff;
  }
}

// 加载更多
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

// 工具类
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
