<template>
  <view class="detail-page">
    <scroll-view scroll-y class="detail-scroll">
      <!-- 订单状态头部 -->
      <view class="status-header" :style="{ background: getStatusBg(orderInfo?.status) }">
        <view class="status-icon">{{ getStatusIcon(orderInfo?.status) }}</view>
        <view class="status-info">
          <text class="status-text">{{ getStatusText(orderInfo?.status) }}</text>
          <text class="status-desc" v-if="orderInfo?.status === 'PENDING_PAY'">
            请在 {{ formatCountdown(orderInfo?.countdown) }} 内完成支付
          </text>
          <text class="status-desc" v-else-if="orderInfo?.status === 'PENDING_SHIP'">
            商家正在准备发货，请耐心等待
          </text>
          <text class="status-desc" v-else-if="orderInfo?.status === 'PENDING_RECEIVE'">
            商品已发出，请注意查收
          </text>
          <text class="status-desc" v-else-if="orderInfo?.status === 'COMPLETED'">
            感谢您的购买，期待再次光临
          </text>
        </view>
      </view>

      <!-- 物流信息 -->
      <view class="logistics-card" v-if="orderInfo?.logistics" @tap="goLogistics">
        <view class="logistics-left">
          <text class="logistics-icon">🚚</text>
          <view class="logistics-info">
            <text class="logistics-company">{{ orderInfo.logistics.company }}</text>
            <text class="logistics-trace" v-if="orderInfo.logistics.traces?.length > 0">
              {{ orderInfo.logistics.traces[0].description }}
            </text>
          </view>
        </view>
        <text class="logistics-arrow">›</text>
      </view>

      <!-- 收货地址 -->
      <view class="section-card address-card">
        <view class="section-header">
          <text class="section-icon">📍</text>
          <text class="section-title">收货地址</text>
        </view>
        <view class="address-info" v-if="orderInfo?.address">
          <view class="address-top">
            <text class="address-name">{{ orderInfo.address.name }}</text>
            <text class="address-phone">{{ orderInfo.address.phone }}</text>
          </view>
          <text class="address-detail">
            {{ orderInfo.address.province }}{{ orderInfo.address.city }}{{ orderInfo.address.district }}{{ orderInfo.address.detail }}
          </text>
        </view>
        <view class="address-empty" v-else>
          <text class="empty-text">暂无收货地址</text>
        </view>
      </view>

      <!-- 商品列表 -->
      <view class="section-card goods-card">
        <view class="section-header">
          <text class="section-icon">📦</text>
          <text class="section-title">商品信息</text>
        </view>
        <view class="goods-list">
          <view class="goods-item" v-for="item in orderInfo?.items" :key="item.id">
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
      </view>

      <!-- 金额明细 -->
      <view class="section-card amount-card">
        <view class="section-header">
          <text class="section-icon">💰</text>
          <text class="section-title">金额明细</text>
        </view>
        <view class="amount-list">
          <view class="amount-row">
            <text class="amount-label">商品金额</text>
            <text class="amount-value">¥{{ orderInfo?.goodsAmount?.toFixed(2) || '0.00' }}</text>
          </view>
          <view class="amount-row">
            <text class="amount-label">运费</text>
            <text class="amount-value">
              {{ orderInfo?.shippingFee === 0 ? '免运费' : '¥' + (orderInfo?.shippingFee?.toFixed(2) || '0.00') }}
            </text>
          </view>
          <view class="amount-row" v-if="orderInfo && orderInfo.discountAmount > 0">
            <text class="amount-label">优惠金额</text>
            <text class="amount-value discount">-¥{{ orderInfo.discountAmount.toFixed(2) }}</text>
          </view>
          <view class="amount-row" v-if="orderInfo && orderInfo.couponDiscount > 0">
            <text class="amount-label">优惠券</text>
            <text class="amount-value discount">-¥{{ orderInfo.couponDiscount.toFixed(2) }}</text>
          </view>
          <view class="amount-row total">
            <text class="amount-label">实付金额</text>
            <text class="amount-value total-value">¥{{ orderInfo?.payAmount?.toFixed(2) || '0.00' }}</text>
          </view>
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="section-card info-card">
        <view class="section-header">
          <text class="section-icon">📋</text>
          <text class="section-title">订单信息</text>
        </view>
        <view class="info-list">
          <view class="info-row">
            <text class="info-label">订单编号</text>
            <view class="info-value-wrap">
              <text class="info-value">{{ orderInfo?.orderNo }}</text>
              <text class="copy-btn" @tap="copyOrderNo">复制</text>
            </view>
          </view>
          <view class="info-row">
            <text class="info-label">下单时间</text>
            <text class="info-value">{{ formatTime(orderInfo?.createTime) }}</text>
          </view>
          <view class="info-row" v-if="orderInfo?.paymentTime">
            <text class="info-label">支付时间</text>
            <text class="info-value">{{ formatTime(orderInfo.paymentTime) }}</text>
          </view>
          <view class="info-row" v-if="orderInfo?.paymentMethod">
            <text class="info-label">支付方式</text>
            <text class="info-value">{{ getPaymentMethodText(orderInfo.paymentMethod) }}</text>
          </view>
          <view class="info-row" v-if="orderInfo?.remark">
            <text class="info-label">订单备注</text>
            <text class="info-value">{{ orderInfo.remark }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="action-bar" v-if="orderInfo">
      <view
        class="action-btn outline"
        v-if="orderInfo.status === 'PENDING_PAY'"
        @tap="cancelOrder"
      >
        取消订单
      </view>
      <view
        class="action-btn outline"
        v-if="orderInfo.status === 'PENDING_SHIP' || orderInfo.status === 'PENDING_RECEIVE'"
        @tap="contactService"
      >
        联系客服
      </view>
      <view
        class="action-btn outline"
        v-if="orderInfo.status === 'PENDING_RECEIVE'"
        @tap="viewLogistics"
      >
        查看物流
      </view>
      <view
        class="action-btn primary"
        v-if="orderInfo.status === 'PENDING_PAY'"
        @tap="goPay"
      >
        立即支付
      </view>
      <view
        class="action-btn primary"
        v-if="orderInfo.status === 'PENDING_RECEIVE'"
        @tap="confirmReceive"
      >
        确认收货
      </view>
      <view
        class="action-btn outline"
        v-if="orderInfo.status === 'COMPLETED'"
        @tap="applyAftersale"
      >
        申请售后
      </view>
      <view
        class="action-btn primary"
        v-if="orderInfo.status === 'COMPLETED'"
        @tap="goReview"
      >
        去评价
      </view>
      <view
        class="action-btn outline"
        v-if="orderInfo.status === 'CANCELLED'"
        @tap="deleteOrder"
      >
        删除订单
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  orderApi,
  ORDER_STATUS_TEXT,
  type OrderInfo,
  type OrderStatus
} from '@/api/order'

const router = useRouter()
const orderId = ref<number>(0)
const orderInfo = ref<OrderInfo | null>(null)

const getStatusText = (status?: OrderStatus): string => {
  if (!status) return ''
  return ORDER_STATUS_TEXT[status] || status
}

const getStatusBg = (status?: OrderStatus): string => {
  const bgMap: Record<string, string> = {
    PENDING_PAY: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
    PENDING_SHIP: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
    PENDING_RECEIVE: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
    COMPLETED: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
    CANCELLED: 'linear-gradient(135deg, #999999 0%, #bfbfbf 100%)',
    AFTERSALE: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)'
  }
  return status ? bgMap[status] || bgMap.PENDING_PAY : bgMap.PENDING_PAY
}

const getStatusIcon = (status?: OrderStatus): string => {
  const iconMap: Record<string, string> = {
    PENDING_PAY: '💳',
    PENDING_SHIP: '📦',
    PENDING_RECEIVE: '🚚',
    COMPLETED: '✅',
    CANCELLED: '❌',
    AFTERSALE: '🔄'
  }
  return status ? iconMap[status] || '📋' : '📋'
}

const getPaymentMethodText = (method: string): string => {
  const map: Record<string, string> = {
    WECHAT: '微信支付',
    ALIPAY: '支付宝',
    CASH: '现金支付'
  }
  return map[method] || method
}

const formatTime = (timeStr?: string): string => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatCountdown = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const loadOrderDetail = async () => {
  if (!orderId.value) return

  try {
    Taro.showLoading({ title: '加载中' })
    const data = await orderApi.getOrderDetail(orderId.value)
    orderInfo.value = data
  } catch (error) {
    console.error('加载订单详情失败:', error)
  } finally {
    Taro.hideLoading()
  }
}

const copyOrderNo = () => {
  if (!orderInfo.value?.orderNo) return
  Taro.setClipboardData({
    data: orderInfo.value.orderNo,
    success: () => {
      Taro.showToast({ title: '复制成功', icon: 'success' })
    }
  })
}

const goLogistics = () => {
  Taro.navigateTo({ url: `/pages/order/track?id=${orderId.value}` })
}

const viewLogistics = () => {
  Taro.navigateTo({ url: `/pages/order/track?id=${orderId.value}` })
}

const goPay = () => {
  Taro.navigateTo({ url: `/pages/order/pay?id=${orderId.value}` })
}

const cancelOrder = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.cancelOrder(orderId.value)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          loadOrderDetail()
        } catch (error) {
          console.error('取消订单失败:', error)
        }
      }
    }
  })
}

const confirmReceive = () => {
  Taro.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.confirmReceive(orderId.value)
          Taro.showToast({ title: '确认收货成功', icon: 'success' })
          loadOrderDetail()
        } catch (error) {
          console.error('确认收货失败:', error)
        }
      }
    }
  })
}

const applyAftersale = () => {
  Taro.showToast({ title: '售后功能开发中', icon: 'none' })
}

const goReview = () => {
  Taro.showToast({ title: '评价功能开发中', icon: 'none' })
}

const deleteOrder = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要删除这个订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await orderApi.deleteOrder(orderId.value)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          setTimeout(() => {
            Taro.navigateBack()
          }, 1500)
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

onMounted(() => {
  const id = router.params.id
  if (id) {
    orderId.value = parseInt(id)
    loadOrderDetail()
  } else {
    Taro.showToast({ title: '订单参数错误', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.detail-scroll {
  flex: 1;
}

.status-header {
  display: flex;
  align-items: center;
  padding: $spacing-xl $spacing-md;
  color: #fff;
}

.status-icon {
  font-size: 80rpx;
  margin-right: $spacing-md;
}

.status-info {
  flex: 1;
}

.status-text {
  display: block;
  font-size: $font-size-xl;
  font-weight: bold;
  margin-bottom: $spacing-xs;
}

.status-desc {
  font-size: $font-size-sm;
  opacity: 0.9;
}

.logistics-card {
  display: flex;
  align-items: center;
  margin: $spacing-md;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
}

.logistics-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.logistics-icon {
  font-size: $font-size-xxl;
  margin-right: $spacing-md;
}

.logistics-info {
  flex: 1;
}

.logistics-company {
  display: block;
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.logistics-trace {
  font-size: $font-size-xs;
  color: $text-secondary;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.logistics-arrow {
  font-size: $font-size-xl;
  color: $text-tertiary;
}

.section-card {
  margin: 0 $spacing-md $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.section-icon {
  font-size: $font-size-lg;
  margin-right: $spacing-sm;
}

.section-title {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: bold;
}

.address-card {
  margin-top: $spacing-md;
}

.address-info {
  padding: $spacing-md;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.address-name {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: bold;
  margin-right: $spacing-md;
}

.address-phone {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.address-detail {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.address-empty {
  padding: $spacing-lg;
  text-align: center;
}

.empty-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
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

.amount-list {
  padding: $spacing-md;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;

  &.total {
    padding-top: $spacing-md;
    margin-top: $spacing-sm;
    border-top: 1rpx solid $border-color;
  }
}

.amount-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.amount-value {
  font-size: $font-size-sm;
  color: $text-primary;

  &.discount {
    color: $primary-color;
  }

  &.total-value {
    font-size: $font-size-lg;
    color: $error-color;
    font-weight: bold;
  }
}

.info-list {
  padding: $spacing-md;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;
}

.info-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  flex-shrink: 0;
}

.info-value-wrap {
  display: flex;
  align-items: center;
}

.info-value {
  font-size: $font-size-sm;
  color: $text-primary;
  text-align: right;
  flex: 1;
  word-break: break-all;
}

.copy-btn {
  font-size: $font-size-xs;
  color: $primary-color;
  margin-left: $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  border: 1rpx solid $primary-color;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.bottom-space {
  height: 160rpx;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
  padding-bottom: calc(#{$spacing-sm} + env(safe-area-inset-bottom));
  gap: $spacing-sm;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  min-width: 180rpx;
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

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
