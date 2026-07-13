<template>
  <view class="page-container">
    <view class="cart-header">
      <view class="select-all" @tap="toggleSelectAll">
        <view class="checkbox" :class="{ checked: isAllSelected }">
          <text v-if="isAllSelected">✓</text>
        </view>
        <text class="select-all-text">全选</text>
      </view>
      <view class="header-actions">
        <text class="edit-btn" @tap="toggleEdit">{{ isEditing ? '完成' : '编辑' }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="cart-scroll">
      <view class="cart-empty" v-if="cartItems.length === 0">
        <text class="empty-icon">🛒</text>
        <text class="empty-text">购物车是空的</text>
        <text class="empty-hint">快去挑选心仪的商品吧</text>
        <view class="go-shopping" @tap="goShopping">去购物</view>
      </view>

      <view class="cart-list" v-else>
        <view class="cart-item" v-for="item in cartItems" :key="item.id">
          <view class="item-checkbox" @tap="toggleSelect(item.id)">
            <view class="checkbox" :class="{ checked: selectedIds.includes(item.id) }">
              <text v-if="selectedIds.includes(item.id)">✓</text>
            </view>
          </view>

          <image :src="item.productImage" mode="aspectFill" class="item-image" />

          <view class="item-info">
            <text class="item-name ellipsis-2">{{ item.productName }}</text>
            <text class="item-sku" v-if="item.skuName">{{ item.skuName }}</text>
            <view class="item-bottom">
              <text class="item-price">{{ formatPrice(item.price) }}</text>
              <view class="quantity-control">
                <text class="qty-btn" @tap="decreaseQty(item)" :class="{ disabled: item.quantity <= 1 }">-</text>
                <text class="qty-value">{{ item.quantity }}</text>
                <text class="qty-btn" @tap="increaseQty(item)">+</text>
              </view>
            </view>
          </view>

          <view class="item-delete" v-if="isEditing" @tap="deleteItem(item.id)">
            <text class="delete-icon">✕</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="price-section" v-if="cartItems.length > 0">
      <view class="price-row">
        <text class="price-label">商品小计</text>
        <text class="price-value">{{ formatPrice(subtotal) }}</text>
      </view>
      <view class="price-row">
        <text class="price-label">运费</text>
        <text class="price-value">{{ shippingFee === 0 ? '免运费' : formatPrice(shippingFee) }}</text>
      </view>
      <view class="price-row discount" v-if="discountAmount > 0">
        <text class="price-label">优惠金额</text>
        <text class="price-value">-{{ formatPrice(discountAmount) }}</text>
      </view>
    </view>

    <view class="coupon-section" v-if="cartItems.length > 0 && availableCoupons.length > 0">
      <view class="coupon-header" @tap="toggleCouponPanel">
        <text class="coupon-title">优惠券</text>
        <view class="coupon-right">
          <text class="coupon-count">{{ availableCoupons.length }}张可用</text>
          <text class="coupon-arrow" :class="{ expanded: showCouponPanel }">▼</text>
        </view>
      </view>

      <view class="coupon-panel" v-if="showCouponPanel">
        <view
          class="coupon-item"
          v-for="coupon in availableCoupons"
          :key="coupon.id"
          :class="{ selected: selectedCoupon?.id === coupon.id }"
          @tap="selectCoupon(coupon)"
        >
          <view class="coupon-left">
            <text class="coupon-value">¥{{ coupon.value }}</text>
            <text class="coupon-condition" v-if="coupon.minAmount > 0">满{{ coupon.minAmount }}可用</text>
          </view>
          <view class="coupon-right">
            <text class="coupon-name">{{ coupon.name }}</text>
            <text class="coupon-expire">有效期至{{ formatDate(coupon.endTime) }}</text>
            <view class="coupon-checkbox" :class="{ checked: selectedCoupon?.id === coupon.id }">
              <text v-if="selectedCoupon?.id === coupon.id">✓</text>
            </view>
          </view>
        </view>
      </view>

      <view class="selected-coupon" v-if="selectedCoupon">
        <text class="selected-coupon-name">{{ selectedCoupon.name }}</text>
        <text class="selected-coupon-discount">-{{ formatPrice(couponDiscount) }}</text>
      </view>
    </view>

    <view class="cart-footer" v-if="cartItems.length > 0">
      <view class="footer-left">
        <view class="select-all" @tap="toggleSelectAll">
          <view class="checkbox" :class="{ checked: isAllSelected }">
            <text v-if="isAllSelected">✓</text>
          </view>
          <text class="select-all-text">全选</text>
        </view>
        <view class="total-info">
          <text class="total-label">合计：</text>
          <text class="total-price">{{ formatPrice(actualTotal) }}</text>
        </view>
      </view>
      <view class="footer-right">
        <text
          class="checkout-btn"
          :class="{ disabled: selectedIds.length === 0 }"
          @tap="handleCheckout"
        >
          {{ isEditing ? '删除(' + selectedIds.length + ')' : '结算(' + selectedCount + ')' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { cartApi, type CartItem, type CouponInfo } from '@/api/cart'
import { couponApi, type UserCoupon } from '@/api/coupon'

const cartItems = ref<CartItem[]>([])
const selectedIds = ref<number[]>([])
const isEditing = ref(false)
const showCouponPanel = ref(false)
const selectedCoupon = ref<CouponInfo | null>(null)
const availableCoupons = ref<CouponInfo[]>([])
const shippingFee = ref(0)
const discountAmount = ref(0)

const isAllSelected = computed(() => {
  return cartItems.value.length > 0 && selectedIds.value.length === cartItems.value.length
})

const selectedCount = computed(() => {
  return cartItems.value.reduce((sum, item) => {
    return selectedIds.value.includes(item.id) ? sum + item.quantity : sum
  }, 0)
})

const subtotal = computed(() => {
  return cartItems.value.reduce((sum, item) => {
    return selectedIds.value.includes(item.id) ? sum + item.price * item.quantity : sum
  }, 0)
})

const couponDiscount = computed(() => {
  if (!selectedCoupon.value || subtotal.value < selectedCoupon.value.minAmount) {
    return 0
  }
  const coupon = selectedCoupon.value
  if (coupon.type === 'PERCENT') {
    return Math.min(subtotal.value * coupon.value / 100, coupon.value)
  }
  return coupon.value
})

const actualTotal = computed(() => {
  return Math.max(0, subtotal.value + shippingFee.value - discountAmount.value - couponDiscount.value)
})

const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const loadCart = async () => {
  try {
    Taro.showLoading({ title: '加载中' })
    const items = await cartApi.getCart()
    cartItems.value = items
    selectedIds.value = items.map(item => item.id)
    await loadAvailableCoupons()
  } catch (error) {
    console.error('加载购物车失败:', error)
  } finally {
    Taro.hideLoading()
  }
}

const loadAvailableCoupons = async () => {
  try {
    const result = await couponApi.getMyCoupons({ status: 'UNUSED' })
    const unusedCoupons = result.records || []
    availableCoupons.value = unusedCoupons.map(coupon => ({
      id: coupon.id,
      templateId: coupon.templateId,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      minAmount: coupon.minAmount,
      status: coupon.status,
      endTime: coupon.endTime
    }))
  } catch (error) {
    console.error('加载优惠券失败:', error)
    availableCoupons.value = []
  }
}

const toggleSelect = (id: number) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = cartItems.value.map(item => item.id)
  }
}

const toggleEdit = () => {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    selectedIds.value = cartItems.value.map(item => item.id)
  }
}

const increaseQty = async (item: CartItem) => {
  try {
    await cartApi.updateCartItem(item.id, item.quantity + 1)
    item.quantity += 1
  } catch (error) {
    console.error('更新数量失败:', error)
  }
}

const decreaseQty = async (item: CartItem) => {
  if (item.quantity <= 1) return
  try {
    await cartApi.updateCartItem(item.id, item.quantity - 1)
    item.quantity -= 1
  } catch (error) {
    console.error('更新数量失败:', error)
  }
}

const deleteItem = async (id: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要删除这个商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await cartApi.removeCartItem(id)
          const index = cartItems.value.findIndex(item => item.id === id)
          if (index > -1) {
            cartItems.value.splice(index, 1)
            const selectedIndex = selectedIds.value.indexOf(id)
            if (selectedIndex > -1) {
              selectedIds.value.splice(selectedIndex, 1)
            }
          }
          Taro.showToast({ title: '删除成功', icon: 'success' })
        } catch (error) {
          console.error('删除商品失败:', error)
        }
      }
    }
  })
}

const toggleCouponPanel = () => {
  showCouponPanel.value = !showCouponPanel.value
}

const selectCoupon = (coupon: CouponInfo) => {
  if (selectedCoupon.value?.id === coupon.id) {
    selectedCoupon.value = null
  } else {
    if (subtotal.value < coupon.minAmount) {
      Taro.showToast({ title: `满${coupon.minAmount}元可用`, icon: 'none' })
      return
    }
    selectedCoupon.value = coupon
  }
  showCouponPanel.value = false
}

const handleCheckout = () => {
  if (selectedIds.value.length === 0) {
    Taro.showToast({ title: '请选择要结算的商品', icon: 'none' })
    return
  }

  if (isEditing.value) {
    Taro.showModal({
      title: '提示',
      content: `确定要删除选中的${selectedIds.value.length}个商品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            for (const id of selectedIds.value) {
              await cartApi.removeCartItem(id)
            }
            cartItems.value = cartItems.value.filter(item => !selectedIds.value.includes(item.id))
            selectedIds.value = cartItems.value.map(item => item.id)
            isEditing.value = false
            Taro.showToast({ title: '删除成功', icon: 'success' })
          } catch (error) {
            console.error('批量删除失败:', error)
          }
        }
      }
    })
    return
  }

  const selectedItems = cartItems.value.filter(item => selectedIds.value.includes(item.id))
  const itemIds = selectedItems.map(item => item.id)

  Taro.navigateTo({
    url: `/pages/checkout/index?itemIds=${itemIds.join(',')}&couponId=${selectedCoupon.value?.id || ''}`
  })
}

const goShopping = () => {
  Taro.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  loadCart()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background-color: $bg-primary;
}

.select-all {
  display: flex;
  align-items: center;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  transition: all 0.2s;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
    color: #fff;
    font-size: $font-size-sm;
  }
}

.select-all-text {
  font-size: $font-size-base;
  color: $text-primary;
}

.header-actions {
  display: flex;
  align-items: center;
}

.edit-btn {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-left: $spacing-md;
}

.cart-scroll {
  flex: 1;
  padding: $spacing-md;
}

.cart-empty {
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

.cart-list {
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.cart-item {
  display: flex;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
  position: relative;

  &:last-child {
    border-bottom: none;
  }
}

.item-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  margin-top: $spacing-sm;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-sm;
  margin: 0 $spacing-md;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: $spacing-md;
}

.item-name {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.item-sku {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: $spacing-sm;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.item-price {
  font-size: $font-size-md;
  color: $error-color;
  font-weight: bold;
}

.quantity-control {
  display: flex;
  align-items: center;
  background-color: $bg-secondary;
  border-radius: $radius-sm;
}

.qty-btn {
  width: 56rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-lg;
  color: $text-secondary;

  &.disabled {
    color: $text-tertiary;
  }
}

.qty-value {
  width: 64rpx;
  text-align: center;
  font-size: $font-size-base;
  color: $text-primary;
}

.item-delete {
  position: absolute;
  right: $spacing-md;
  top: 50%;
  transform: translateY(-50%);
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-icon {
  font-size: $font-size-lg;
  color: $text-tertiary;
}

.price-section {
  background-color: $bg-primary;
  margin: 0 $spacing-md $spacing-md;
  padding: $spacing-md;
  border-radius: $radius-md;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;

  &.discount {
    .price-value {
      color: $primary-color;
    }
  }
}

.price-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.price-value {
  font-size: $font-size-sm;
  color: $text-primary;
}

.coupon-section {
  background-color: $bg-primary;
  margin: 0 $spacing-md $spacing-md;
  border-radius: $radius-md;
  overflow: hidden;
}

.coupon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.coupon-title {
  font-size: $font-size-base;
  color: $text-primary;
}

.coupon-right {
  display: flex;
  align-items: center;
}

.coupon-count {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-right: $spacing-xs;
}

.coupon-arrow {
  font-size: $font-size-xs;
  color: $text-tertiary;
  transition: transform 0.2s;

  &.expanded {
    transform: rotate(180deg);
  }
}

.coupon-panel {
  padding: $spacing-sm $spacing-md $spacing-md;
}

.coupon-item {
  display: flex;
  padding: $spacing-md;
  background: linear-gradient(135deg, #fff5f5 0%, #fff0f0 100%);
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
  border: 2rpx solid transparent;

  &.selected {
    border-color: $primary-color;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.coupon-left {
  width: 120rpx;
  text-align: center;
  padding-right: $spacing-md;
  border-right: 1rpx dashed $border-color;
}

.coupon-value {
  font-size: $font-size-xl;
  color: $primary-color;
  font-weight: bold;
}

.coupon-condition {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.coupon-right {
  flex: 1;
  padding-left: $spacing-md;
  position: relative;
}

.coupon-name {
  font-size: $font-size-base;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-xs;
}

.coupon-expire {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.coupon-checkbox {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
    color: #fff;
    font-size: $font-size-xs;
  }
}

.selected-coupon {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background-color: rgba($primary-color, 0.05);
}

.selected-coupon-name {
  font-size: $font-size-sm;
  color: $text-primary;
}

.selected-coupon-discount {
  font-size: $font-size-md;
  color: $primary-color;
  font-weight: bold;
}

.cart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
}

.footer-left {
  display: flex;
  align-items: center;
}

.total-info {
  margin-left: $spacing-lg;
}

.total-label {
  font-size: $font-size-base;
  color: $text-secondary;
}

.total-price {
  font-size: $font-size-xl;
  color: $error-color;
  font-weight: bold;
}

.footer-right {
  padding: $spacing-sm $spacing-xl;
}

.checkout-btn {
  display: block;
  padding: $spacing-md $spacing-xl;
  background-color: $primary-color;
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-size-base;

  &.disabled {
    background-color: $text-tertiary;
  }
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
