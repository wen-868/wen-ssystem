<template>
  <view class="wholesale-order-detail">
    <!-- 订单状态头部 -->
    <view class="order-status-header" v-if="orderDetail">
      <view class="status-icon">
        <text>{{ getStatusIcon(orderDetail.status) }}</text>
      </view>
      <view class="status-info">
        <text class="status-text" :style="{ color: getStatusColor(orderDetail.status) }">
          {{ getStatusText(orderDetail.status) }}
        </text>
        <text class="status-desc">{{ getStatusDesc(orderDetail.status) }}</text>
      </view>
    </view>

    <!-- 物流信息 -->
    <view class="logistics-card" v-if="orderDetail && orderDetail.trackingNo">
      <view class="logistics-header">
        <text class="logistics-title">物流信息</text>
        <text class="logistics-company">{{ orderDetail.logisticsCompany }}</text>
      </view>
      <view class="logistics-info">
        <text class="tracking-label">运单号：</text>
        <text class="tracking-no">{{ orderDetail.trackingNo }}</text>
        <text class="copy-btn" @tap="copyTrackingNo">复制</text>
      </view>
    </view>

    <!-- 收货地址 -->
    <view class="address-card" v-if="orderDetail && orderDetail.address">
      <view class="address-icon">📍</view>
      <view class="address-info">
        <view class="address-top">
          <text class="receiver-name">{{ orderDetail.address.name }}</text>
          <text class="receiver-phone">{{ orderDetail.address.phone }}</text>
        </view>
        <text class="address-detail">
          {{ orderDetail.address.province }}{{ orderDetail.address.city }}{{ orderDetail.address.district }}{{ orderDetail.address.detail }}
        </text>
      </view>
    </view>

    <!-- 商品列表 -->
    <view class="goods-card" v-if="orderDetail">
      <view class="card-title">商品信息</view>
      <view class="goods-list">
        <view
          class="goods-item"
          v-for="item in orderDetail.items"
          :key="item.id"
          @tap="goProductDetail(item.productId)"
        >
          <image :src="item.productImage" mode="aspectFill" class="goods-image" />
          <view class="goods-info">
            <text class="goods-name ellipsis-2">{{ item.productName }}</text>
            <text class="goods-sku" v-if="item.skuName">{{ item.skuName }}</text>
            <view class="goods-bottom">
              <view class="goods-price">
                <text class="price-symbol">¥</text>
                <text class="price-value">{{ item.unitPrice.toFixed(2) }}</text>
                <text class="price-unit">/{{ item.unit }}</text>
              </view>
              <text class="goods-qty">x{{ item.quantity }}{{ item.unit }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 金额明细 -->
    <view class="amount-card" v-if="orderDetail">
      <view class="card-title">金额明细</view>
      <view class="amount-list">
        <view class="amount-row">
          <text class="amount-label">商品总额</text>
          <text class="amount-value">¥{{ orderDetail.goodsAmount.toFixed(2) }}</text>
        </view>
        <view class="amount-row">
          <text class="amount-label">运费</text>
          <text class="amount-value">
            {{ orderDetail.shippingFee === 0 ? '包邮' : '¥' + orderDetail.shippingFee.toFixed(2) }}
          </text>
        </view>
        <view class="amount-row" v-if="orderDetail.discountAmount > 0">
          <text class="amount-label">优惠减免</text>
          <text class="amount-value discount">-¥{{ orderDetail.discountAmount.toFixed(2) }}</text>
        </view>
        <view class="amount-row total">
          <text class="amount-label">实付金额</text>
          <text class="amount-value total-value">¥{{ orderDetail.payAmount.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 订单信息 -->
    <view class="order-info-card" v-if="orderDetail">
      <view class="card-title">订单信息</view>
      <view class="info-list">
        <view class="info-row">
          <text class="info-label">订单编号</text>
          <view class="info-value-wrap">
            <text class="info-value">{{ orderDetail.orderNo }}</text>
            <text class="copy-btn" @tap="copyOrderNo">复制</text>
          </view>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ orderDetail.createTime }}</text>
        </view>
        <view class="info-row" v-if="orderDetail.paymentTime">
          <text class="info-label">付款时间</text>
          <text class="info-value">{{ orderDetail.paymentTime }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">支付方式</text>
          <text class="info-value">{{ getPaymentMethodText(orderDetail.paymentMethod) }}</text>
        </view>
        <view class="info-row" v-if="orderDetail.remark">
          <text class="info-label">订单备注</text>
          <text class="info-value remark">{{ orderDetail.remark }}</text>
        </view>
      </view>
    </view>

    <view class="bottom-placeholder"></view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="orderDetail">
      <view class="bar-actions">
        <view
          class="action-btn outline"
          v-if="orderDetail.status === 'PENDING_PAY'"
          @tap="cancelOrder"
        >
          取消订单
        </view>
        <view
          class="action-btn outline"
          v-if="orderDetail.status === 'PENDING_SHIP' || orderDetail.status === 'PENDING_RECEIVE'"
          @tap="contactService"
        >
          联系客服
        </view>
        <view
          class="action-btn outline"
          v-if="orderDetail.status === 'COMPLETED'"
          @tap="applyAftersale"
        >
          申请售后
        </view>
        <view
          class="action-btn primary"
          v-if="orderDetail.status === 'PENDING_PAY'"
          @tap="goPay"
        >
          立即付款
        </view>
        <view
          class="action-btn primary"
          v-if="orderDetail.status === 'PENDING_RECEIVE'"
          @tap="confirmReceive"
        >
          确认收货
        </view>
        <view
          class="action-btn primary"
          v-if="orderDetail.status === 'COMPLETED'"
          @tap="rebuy"
        >
          再次采购
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  wholesaleApi,
  WHOLESALE_ORDER_STATUS_TEXT,
  WHOLESALE_ORDER_STATUS_COLOR,
  type WholesaleOrderInfo,
  type WholesaleOrderStatus
} from '@/api/wholesale'

const router = useRouter()
const orderId = ref<number>(0)
const orderDetail = ref<WholesaleOrderInfo | null>(null)
const loading = ref(false)

const getStatusText = (status: WholesaleOrderStatus): string => {
  return WHOLESALE_ORDER_STATUS_TEXT[status] || status
}

const getStatusColor = (status: WholesaleOrderStatus): string => {
  return WHOLESALE_ORDER_STATUS_COLOR[status] || '#333'
}

const getStatusIcon = (status: WholesaleOrderStatus): string => {
  const icons: Record<WholesaleOrderStatus, string> = {
    PENDING_PAY: '💰',
    PENDING_SHIP: '📦',
    PENDING_RECEIVE: '🚚',
    COMPLETED: '✅',
    CANCELLED: '❌'
  }
  return icons[status] || '📋'
}

const getStatusDesc = (status: WholesaleOrderStatus): string => {
  const descs: Record<WholesaleOrderStatus, string> = {
    PENDING_PAY: '请尽快完成付款',
    PENDING_SHIP: '商家正在备货，即将发货',
    PENDING_RECEIVE: '商品已发出，请注意查收',
    COMPLETED: '交易已完成，感谢您的采购',
    CANCELLED: '订单已取消'
  }
  return descs[status] || ''
}

const getPaymentMethodText = (method?: string): string => {
  const map: Record<string, string> = {
    WECHAT: '微信支付',
    ALIPAY: '支付宝',
    BANK_TRANSFER: '银行转账',
    CREDIT: '赊账',
    CASH: '现金'
  }
  return map[method || ''] || '未知'
}

// 加载订单详情
const loadOrderDetail = async () => {
  loading.value = true
  try {
    const data = await wholesaleApi.getOrderDetail(orderId.value)
    orderDetail.value = data
  } catch (error) {
    console.error('加载批发订单详情失败:', error)
    // 模拟数据
    orderDetail.value = generateMockDetail()
  } finally {
    loading.value = false
  }
}

// 生成模拟数据
const generateMockDetail = (): WholesaleOrderInfo => {
  return {
    id: orderId.value,
    orderNo: `PF${20260714}${String(orderId.value).padStart(6, '0')}`,
    status: 'PENDING_RECEIVE',
    statusText: '待收货',
    totalAmount: 19650,
    goodsAmount: 19600,
    shippingFee: 50,
    discountAmount: 600,
    payAmount: 19050,
    paymentMethod: 'WECHAT',
    paymentTime: '2026-07-14 10:30:00',
    createTime: '2026-07-14 10:00:00',
    updateTime: '2026-07-14 14:00:00',
    remark: '请尽快发货，急用',
    items: [
      {
        id: 1,
        productId: 1,
        productName: '茅台飞天53度500ml 整箱批发',
        productImage: 'https://via.placeholder.com/200x200/f5f5f5/999?text=MT',
        skuId: 1,
        skuName: '500ml*6瓶/箱 53度',
        unitPrice: 1250,
        quantity: 15,
        subtotal: 18750,
        unit: '箱'
      },
      {
        id: 2,
        productId: 2,
        productName: '青岛啤酒经典500ml*24罐 整箱',
        productImage: 'https://via.placeholder.com/200x200/f5f5f5/999?text=QD',
        skuId: 2,
        skuName: '500ml*24罐/箱 经典',
        unitPrice: 85,
        quantity: 10,
        subtotal: 850,
        unit: '箱'
      }
    ],
    address: {
      id: 1,
      name: '张经理',
      phone: '13888888888',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号SOHO现代城A座1001室',
      isDefault: true
    },
    trackingNo: 'SF1234567890123',
    logisticsCompany: '顺丰速运'
  }
}

// 复制运单号
const copyTrackingNo = () => {
  if (!orderDetail.value?.trackingNo) return
  Taro.setClipboardData({
    data: orderDetail.value.trackingNo,
    success: () => {
      Taro.showToast({ title: '复制成功', icon: 'success' })
    }
  })
}

// 复制订单号
const copyOrderNo = () => {
  if (!orderDetail.value?.orderNo) return
  Taro.setClipboardData({
    data: orderDetail.value.orderNo,
    success: () => {
      Taro.showToast({ title: '复制成功', icon: 'success' })
    }
  })
}

// 跳转商品详情
const goProductDetail = (productId: number) => {
  Taro.navigateTo({ url: `/pages/wholesale/product/index?id=${productId}` })
}

// 取消订单
const cancelOrder = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个批发订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wholesaleApi.cancelOrder(orderId.value)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          loadOrderDetail()
        } catch (error) {
          console.error('取消订单失败:', error)
          if (orderDetail.value) {
            orderDetail.value.status = 'CANCELLED'
            orderDetail.value.statusText = '已取消'
          }
        }
      }
    }
  })
}

// 去付款
const goPay = () => {
  Taro.showToast({ title: '支付功能开发中', icon: 'none' })
}

// 确认收货
const confirmReceive = () => {
  Taro.showModal({
    title: '提示',
    content: '确认已收到全部商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wholesaleApi.confirmReceive(orderId.value)
          Taro.showToast({ title: '确认收货成功', icon: 'success' })
          loadOrderDetail()
        } catch (error) {
          console.error('确认收货失败:', error)
          if (orderDetail.value) {
            orderDetail.value.status = 'COMPLETED'
            orderDetail.value.statusText = '已完成'
          }
        }
      }
    }
  })
}

// 申请售后
const applyAftersale = () => {
  Taro.showToast({ title: '售后功能开发中', icon: 'none' })
}

// 再次采购
const rebuy = () => {
  Taro.showToast({ title: '再次采购功能开发中', icon: 'none' })
}

// 联系客服
const contactService = () => {
  Taro.showToast({ title: '客服功能开发中', icon: 'none' })
}

onMounted(() => {
  const id = router.params.id
  if (id) {
    orderId.value = parseInt(id)
    loadOrderDetail()
  }
})
</script>

<style lang="scss" scoped>
.wholesale-order-detail {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 140rpx;
}

// 订单状态头部
.order-status-header {
  display: flex;
  align-items: center;
  padding: $spacing-xl $spacing-md;
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  color: #fff;
}

.status-icon {
  font-size: 80rpx;
  margin-right: $spacing-md;
}

.status-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.status-text {
  font-size: $font-size-xl;
  font-weight: bold;
  color: #fff !important;
  margin-bottom: $spacing-xs;
}

.status-desc {
  font-size: $font-size-sm;
  color: rgba(255, 255, 255, 0.8);
}

// 物流卡片
.logistics-card {
  background-color: $bg-primary;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.logistics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.logistics-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.logistics-company {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.logistics-info {
  display: flex;
  align-items: center;
  font-size: $font-size-sm;
}

.tracking-label {
  color: $text-tertiary;
}

.tracking-no {
  color: $text-primary;
  flex: 1;
}

.copy-btn {
  color: $primary-color;
  font-size: $font-size-sm;
  padding: $spacing-xs $spacing-sm;
}

// 地址卡片
.address-card {
  display: flex;
  background-color: $bg-primary;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.address-icon {
  font-size: 40rpx;
  margin-right: $spacing-md;
  flex-shrink: 0;
}

.address-info {
  flex: 1;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-xs;
}

.receiver-name {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-right: $spacing-md;
}

.receiver-phone {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.address-detail {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}

// 商品卡片
.goods-card {
  background-color: $bg-primary;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.card-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid $border-color;
}

.goods-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.goods-item {
  display: flex;
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
  line-height: 1.4;
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
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: $font-size-sm;
  color: $error-color;
}

.price-value {
  font-size: $font-size-md;
  font-weight: bold;
  color: $error-color;
}

.price-unit {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-left: 4rpx;
}

.goods-qty {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

// 金额卡片
.amount-card {
  background-color: $bg-primary;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.amount-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: $font-size-sm;

  &.total {
    padding-top: $spacing-sm;
    border-top: 1rpx solid $border-color;
    margin-top: $spacing-xs;
  }
}

.amount-label {
  color: $text-secondary;
}

.amount-value {
  color: $text-primary;

  &.discount {
    color: $success-color;
  }

  &.total-value {
    font-size: $font-size-lg;
    font-weight: bold;
    color: $error-color;
  }
}

// 订单信息卡片
.order-info-card {
  background-color: $bg-primary;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: $font-size-sm;
}

.info-label {
  color: $text-tertiary;
  flex-shrink: 0;
  width: 160rpx;
}

.info-value-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
}

.info-value {
  color: $text-primary;
  text-align: right;
  flex: 1;

  &.remark {
    line-height: 1.5;
  }
}

// 底部占位
.bottom-placeholder {
  height: 140rpx;
}

// 底部操作栏
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-primary;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.bar-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  border-radius: $radius-lg;
  font-size: $font-size-sm;
  min-width: 160rpx;
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

// 加载状态
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.loading-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

// 工具类
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
