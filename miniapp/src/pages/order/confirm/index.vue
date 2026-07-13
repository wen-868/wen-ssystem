<template>
  <view class="confirm-page">
    <scroll-view scroll-y class="confirm-scroll">
      <!-- 收货地址 -->
      <view class="section-card address-card" @tap="chooseAddress">
        <view class="address-content" v-if="previewData?.address">
          <view class="address-top">
            <text class="address-icon">📍</text>
            <text class="address-name">{{ previewData.address.name }}</text>
            <text class="address-phone">{{ previewData.address.phone }}</text>
          </view>
          <text class="address-detail">
            {{ previewData.address.province }}{{ previewData.address.city }}{{ previewData.address.district }}{{ previewData.address.detail }}
          </text>
        </view>
        <view class="address-empty" v-else>
          <text class="empty-icon">📍</text>
          <text class="empty-text">请选择收货地址</text>
        </view>
        <text class="address-arrow">›</text>
      </view>

      <!-- 商品列表 -->
      <view class="section-card goods-card">
        <view class="section-header">
          <text class="section-title">商品信息</text>
          <text class="goods-count">共{{ totalQuantity }}件</text>
        </view>
        <view class="goods-list">
          <view class="goods-item" v-for="item in previewData?.items" :key="item.id">
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

      <!-- 优惠券 -->
      <view class="section-card coupon-card" @tap="toggleCouponPanel">
        <view class="coupon-row">
          <text class="coupon-label">优惠券</text>
          <view class="coupon-right">
            <text class="coupon-value" v-if="selectedCoupon">
              -¥{{ couponDiscount.toFixed(2) }}
            </text>
            <text class="coupon-placeholder" v-else-if="availableCoupons.length > 0">
              {{ availableCoupons.length }}张可用
            </text>
            <text class="coupon-placeholder" v-else>暂无可用</text>
            <text class="coupon-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 订单备注 -->
      <view class="section-card remark-card">
        <view class="remark-row">
          <text class="remark-label">订单备注</text>
          <input
            class="remark-input"
            type="text"
            v-model="remark"
            placeholder="选填，可填写您的特殊需求"
            maxlength="200"
          />
        </view>
      </view>

      <!-- 金额明细 -->
      <view class="section-card amount-card">
        <view class="amount-row">
          <text class="amount-label">商品金额</text>
          <text class="amount-value">¥{{ previewData?.goodsAmount?.toFixed(2) || '0.00' }}</text>
        </view>
        <view class="amount-row">
          <text class="amount-label">运费</text>
          <text class="amount-value">
            {{ previewData?.shippingFee === 0 ? '免运费' : '¥' + (previewData?.shippingFee?.toFixed(2) || '0.00') }}
          </text>
        </view>
        <view class="amount-row" v-if="previewData && previewData.discountAmount > 0">
          <text class="amount-label">优惠金额</text>
          <text class="amount-value discount">-¥{{ previewData.discountAmount.toFixed(2) }}</text>
        </view>
        <view class="amount-row" v-if="selectedCoupon">
          <text class="amount-label">优惠券</text>
          <text class="amount-value discount">-¥{{ couponDiscount.toFixed(2) }}</text>
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <!-- 底部结算栏 -->
    <view class="settle-bar">
      <view class="settle-left">
        <text class="total-label">合计：</text>
        <text class="total-price">¥{{ totalAmount.toFixed(2) }}</text>
      </view>
      <view
        class="submit-btn"
        :class="{ disabled: !canSubmit }"
        @tap="submitOrder"
      >
        提交订单
      </view>
    </view>

    <!-- 优惠券选择弹窗 -->
    <view class="coupon-modal" v-if="showCouponModal" @tap="closeCouponModal">
      <view class="coupon-modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">选择优惠券</text>
          <text class="modal-close" @tap="closeCouponModal">✕</text>
        </view>
        <scroll-view scroll-y class="coupon-list">
          <view class="coupon-empty" v-if="availableCoupons.length === 0">
            <text class="empty-text">暂无可用优惠券</text>
          </view>
          <view
            class="coupon-item"
            v-for="coupon in availableCoupons"
            :key="coupon.id"
            :class="{ selected: selectedCoupon?.id === coupon.id, disabled: !canUseCoupon(coupon) }"
            @tap="selectCoupon(coupon)"
          >
            <view class="coupon-left">
              <text class="coupon-amount">
                <text class="coupon-symbol">¥</text>
                <text class="coupon-value-big">{{ coupon.value }}</text>
              </text>
              <text class="coupon-condition" v-if="coupon.minAmount > 0">
                满{{ coupon.minAmount }}可用
              </text>
            </view>
            <view class="coupon-right-info">
              <text class="coupon-name">{{ coupon.name }}</text>
              <text class="coupon-type">{{ getCouponTypeText(coupon.type) }}</text>
            </view>
            <view class="coupon-check" v-if="selectedCoupon?.id === coupon.id">✓</view>
          </view>
          <view
            class="coupon-item no-use"
            :class="{ selected: !selectedCoupon }"
            @tap="clearCoupon"
          >
            <text class="no-use-text">不使用优惠券</text>
            <view class="coupon-check" v-if="!selectedCoupon">✓</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { orderApi, type OrderConfirmPreview } from '@/api/order'

const router = useRouter()

const itemIds = ref<number[]>([])
const previewData = ref<OrderConfirmPreview | null>(null)
const remark = ref('')
const selectedCoupon = ref<OrderConfirmPreview['availableCoupons'][0] | null>(null)
const showCouponModal = ref(false)

const availableCoupons = computed(() => {
  return previewData.value?.availableCoupons || []
})

const totalQuantity = computed(() => {
  if (!previewData.value?.items) return 0
  return previewData.value.items.reduce((sum, item) => sum + item.quantity, 0)
})

const couponDiscount = computed(() => {
  if (!selectedCoupon.value || !previewData.value) return 0
  const coupon = selectedCoupon.value
  const goodsAmount = previewData.value.goodsAmount

  if (goodsAmount < coupon.minAmount) return 0

  if (coupon.type === 'PERCENT') {
    return Math.min(goodsAmount * coupon.value / 100, coupon.value)
  }
  return coupon.value
})

const totalAmount = computed(() => {
  if (!previewData.value) return 0
  const { goodsAmount, shippingFee, discountAmount } = previewData.value
  return Math.max(0, goodsAmount + shippingFee - discountAmount - couponDiscount.value)
})

const canSubmit = computed(() => {
  return previewData.value?.address && previewData.value.items.length > 0
})

const canUseCoupon = (coupon: OrderConfirmPreview['availableCoupons'][0]): boolean => {
  if (!previewData.value) return false
  return previewData.value.goodsAmount >= coupon.minAmount
}

const getCouponTypeText = (type: string): string => {
  const map: Record<string, string> = {
    FIXED: '满减券',
    PERCENT: '折扣券',
    SHIPPING: '包邮券'
  }
  return map[type] || '优惠券'
}

const loadConfirmPreview = async () => {
  if (itemIds.value.length === 0) return

  try {
    Taro.showLoading({ title: '加载中' })
    const data = await orderApi.getOrderConfirm(itemIds.value)
    previewData.value = data
  } catch (error) {
    console.error('加载订单确认失败:', error)
  } finally {
    Taro.hideLoading()
  }
}

const chooseAddress = () => {
  Taro.showToast({ title: '地址选择功能开发中', icon: 'none' })
}

const toggleCouponPanel = () => {
  if (availableCoupons.value.length === 0) {
    Taro.showToast({ title: '暂无可用优惠券', icon: 'none' })
    return
  }
  showCouponModal.value = true
}

const closeCouponModal = () => {
  showCouponModal.value = false
}

const selectCoupon = (coupon: OrderConfirmPreview['availableCoupons'][0]) => {
  if (!canUseCoupon(coupon)) {
    Taro.showToast({ title: `满${coupon.minAmount}元可用`, icon: 'none' })
    return
  }
  selectedCoupon.value = coupon
  showCouponModal.value = false
}

const clearCoupon = () => {
  selectedCoupon.value = null
  showCouponModal.value = false
}

const submitOrder = async () => {
  if (!canSubmit.value) {
    Taro.showToast({ title: '请选择收货地址', icon: 'none' })
    return
  }

  try {
    Taro.showLoading({ title: '提交中' })

    const result = await orderApi.createOrder({
      itemIds: itemIds.value,
      addressId: previewData.value?.address?.id,
      couponId: selectedCoupon.value?.id,
      remark: remark.value,
      paymentMethod: 'WECHAT'
    })

    Taro.hideLoading()
    Taro.showToast({ title: '下单成功', icon: 'success' })

    // 跳转到支付页
    setTimeout(() => {
      Taro.redirectTo({
        url: `/pages/order/pay?id=${result.orderId}`
      })
    }, 1000)
  } catch (error) {
    console.error('提交订单失败:', error)
    Taro.hideLoading()
  }
}

onMounted(() => {
  const ids = router.params.itemIds
  if (ids) {
    itemIds.value = ids.split(',').map(Number).filter(Boolean)
  }

  // 从购物车跳转时可能带couponId
  const couponId = router.params.couponId
  if (couponId) {
    // 预选优惠券，等数据加载完后匹配
  }

  loadConfirmPreview()
})
</script>

<style lang="scss" scoped>
.confirm-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.confirm-scroll {
  flex: 1;
  padding: $spacing-md 0;
}

.section-card {
  margin: 0 $spacing-md $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.address-card {
  display: flex;
  align-items: center;
  padding: $spacing-md;
}

.address-content {
  flex: 1;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.address-icon {
  margin-right: $spacing-xs;
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
  padding-left: 36rpx;
}

.address-empty {
  flex: 1;
  display: flex;
  align-items: center;
  padding: $spacing-md 0;
}

.empty-icon {
  margin-right: $spacing-sm;
  font-size: $font-size-lg;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-tertiary;
}

.address-arrow {
  font-size: $font-size-xl;
  color: $text-tertiary;
  margin-left: $spacing-sm;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.section-title {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: bold;
}

.goods-count {
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

.coupon-card {
  padding: $spacing-md;
}

.coupon-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coupon-label {
  font-size: $font-size-base;
  color: $text-primary;
}

.coupon-right {
  display: flex;
  align-items: center;
}

.coupon-value {
  font-size: $font-size-base;
  color: $primary-color;
  font-weight: bold;
  margin-right: $spacing-xs;
}

.coupon-placeholder {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-right: $spacing-xs;
}

.coupon-arrow {
  font-size: $font-size-lg;
  color: $text-tertiary;
}

.remark-card {
  padding: $spacing-md;
}

.remark-row {
  display: flex;
  align-items: center;
}

.remark-label {
  font-size: $font-size-base;
  color: $text-primary;
  flex-shrink: 0;
  margin-right: $spacing-md;
}

.remark-input {
  flex: 1;
  font-size: $font-size-sm;
  color: $text-primary;
  text-align: right;
}

.amount-card {
  padding: $spacing-md;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;
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
}

.bottom-space {
  height: 160rpx;
}

.settle-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
  padding-bottom: calc(#{$spacing-sm} + env(safe-area-inset-bottom));
}

.settle-left {
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.total-price {
  font-size: $font-size-xxl;
  color: $error-color;
  font-weight: bold;
}

.submit-btn {
  padding: $spacing-sm $spacing-xl;
  background-color: $primary-color;
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  font-weight: bold;

  &.disabled {
    background-color: $text-tertiary;
  }
}

.coupon-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.coupon-modal-content {
  width: 100%;
  max-height: 70vh;
  background-color: $bg-primary;
  border-radius: $radius-xl $radius-xl 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.modal-title {
  font-size: $font-size-lg;
  color: $text-primary;
  font-weight: bold;
}

.modal-close {
  font-size: $font-size-lg;
  color: $text-tertiary;
  padding: $spacing-sm;
}

.coupon-list {
  flex: 1;
  padding: $spacing-md;
}

.coupon-empty {
  text-align: center;
  padding: $spacing-xl 0;
}

.coupon-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  background: linear-gradient(135deg, #fff5f5 0%, #fff0f0 100%);
  border-radius: $radius-md;
  margin-bottom: $spacing-md;
  border: 2rpx solid transparent;
  position: relative;

  &.selected {
    border-color: $primary-color;
  }

  &.disabled {
    opacity: 0.5;
  }

  &.no-use {
    background: $bg-secondary;
  }
}

.coupon-left {
  width: 180rpx;
  text-align: center;
  padding-right: $spacing-md;
  border-right: 1rpx dashed $border-color;
}

.coupon-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  color: $primary-color;
}

.coupon-symbol {
  font-size: $font-size-md;
  font-weight: bold;
}

.coupon-value-big {
  font-size: 56rpx;
  font-weight: bold;
  line-height: 1;
}

.coupon-condition {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-top: $spacing-xs;
}

.coupon-right-info {
  flex: 1;
  padding-left: $spacing-md;
}

.coupon-name {
  display: block;
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.coupon-type {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.coupon-check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background-color: $primary-color;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-sm;
}

.no-use-text {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
