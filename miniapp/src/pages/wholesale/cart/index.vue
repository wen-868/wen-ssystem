<template>
  <view class="wholesale-cart">
    <!-- 顶部提示 -->
    <view class="top-tip" v-if="cartItems.length > 0">
      <text class="tip-icon">💡</text>
      <text class="tip-text">批量采购享受阶梯价格，买多省多</text>
    </view>

    <!-- 购物车列表 -->
    <scroll-view
      scroll-y
      class="cart-list"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 空购物车 -->
      <view class="cart-empty" v-if="cartItems.length === 0 && !loading">
        <text class="empty-icon">🛒</text>
        <text class="empty-text">批发购物车还是空的</text>
        <text class="empty-hint">去批发专区挑选商品吧</text>
        <view class="go-shopping" @tap="goWholesale">去逛逛</view>
      </view>

      <!-- 商品列表 -->
      <view class="cart-items" v-else>
        <view
          class="cart-item"
          v-for="item in cartItems"
          :key="item.id"
        >
          <!-- 勾选框 -->
          <view
            class="item-checkbox"
            :class="{ checked: item.selected }"
            @tap="toggleSelect(item)"
          >
            <text v-if="item.selected">✓</text>
          </view>

          <!-- 商品图片 -->
          <image
            :src="item.productImage"
            mode="aspectFill"
            class="item-image"
            @tap="goProductDetail(item.productId)"
          />

          <!-- 商品信息 -->
          <view class="item-info" @tap="goProductDetail(item.productId)">
            <text class="item-name ellipsis-2">{{ item.productName }}</text>
            <text class="item-sku">{{ item.skuName }}</text>
            <view class="item-tags">
              <text class="tag min-order-tag">{{ item.minOrderQty }}{{ item.unit }}起订</text>
            </view>
            <view class="item-bottom">
              <view class="item-price">
                <text class="price-symbol">¥</text>
                <text class="price-value">{{ item.unitPrice.toFixed(2) }}</text>
                <text class="price-unit">/{{ item.unit }}</text>
              </view>
              <view class="quantity-control">
                <view
                  class="qty-btn"
                  :class="{ disabled: item.quantity <= item.minOrderQty }"
                  @tap.stop="decreaseQty(item)"
                >
                  <text>－</text>
                </view>
                <text class="qty-text">{{ item.quantity }}</text>
                <view
                  class="qty-btn"
                  @tap.stop="increaseQty(item)"
                >
                  <text>＋</text>
                </view>
              </view>
            </view>
            <view class="item-subtotal">
              小计：<text class="subtotal-value">¥{{ item.subtotal.toFixed(2) }}</text>
            </view>
          </view>

          <!-- 删除按钮 -->
          <view class="delete-btn" @tap="deleteItem(item)">
            <text class="delete-icon">🗑</text>
          </view>
        </view>
      </view>

      <view class="list-bottom" v-if="cartItems.length > 0"></view>
    </scroll-view>

    <!-- 底部结算栏 -->
    <view class="bottom-bar" v-if="cartItems.length > 0">
      <!-- 全选 -->
      <view class="select-all" @tap="toggleSelectAll">
        <view class="checkbox" :class="{ checked: isAllSelected }">
          <text v-if="isAllSelected">✓</text>
        </view>
        <text class="select-text">全选</text>
      </view>

      <!-- 价格汇总 -->
      <view class="price-summary">
        <view class="summary-row">
          <text class="summary-label">合计：</text>
          <text class="summary-symbol">¥</text>
          <text class="summary-value">{{ totalAmount.toFixed(2) }}</text>
        </view>
        <view class="summary-row discount" v-if="discountAmount > 0">
          <text class="discount-text">已优惠 ¥{{ discountAmount.toFixed(2) }}</text>
        </view>
      </view>

      <!-- 结算按钮 -->
      <view
        class="checkout-btn"
        :class="{ disabled: selectedCount === 0 }"
        @tap="handleCheckout"
      >
        批量下单({{ selectedCount }})
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading && cartItems.length === 0">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import {
  wholesaleApi,
  calculateTierPriceLocal,
  type WholesaleCartItem
} from '@/api/wholesale'

const cartItems = ref<WholesaleCartItem[]>([])
const loading = ref(false)
const isRefreshing = ref(false)

// 已选数量
const selectedCount = computed(() => {
  return cartItems.value.filter(item => item.selected).reduce((sum, item) => sum + item.quantity, 0)
})

// 是否全选
const isAllSelected = computed(() => {
  return cartItems.value.length > 0 && cartItems.value.every(item => item.selected)
})

// 总金额
const totalAmount = computed(() => {
  return cartItems.value
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.subtotal, 0)
})

// 优惠金额
const discountAmount = computed(() => {
  return cartItems.value
    .filter(item => item.selected)
    .reduce((sum, item) => {
      const basePrice = item.tierPrices && item.tierPrices.length > 0
        ? item.tierPrices[0].price
        : item.unitPrice
      return sum + (basePrice - item.unitPrice) * item.quantity
    }, 0)
})

// 加载购物车
const loadCart = async () => {
  loading.value = true
  try {
    const data = await wholesaleApi.getCart()
    cartItems.value = data.items
  } catch (error) {
    console.error('加载批发购物车失败:', error)
    // 模拟数据
    cartItems.value = generateMockCartItems()
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

// 生成模拟数据
const generateMockCartItems = (): WholesaleCartItem[] => {
  const tierPrices1 = [
    { minQty: 2, maxQty: 9, price: 1280 },
    { minQty: 10, maxQty: 49, price: 1250 },
    { minQty: 50, price: 1200 }
  ]
  const tierPrices2 = [
    { minQty: 5, maxQty: 19, price: 85 },
    { minQty: 20, maxQty: 99, price: 80 },
    { minQty: 100, price: 75 }
  ]
  const qty1 = 15
  const qty2 = 30

  return [
    {
      id: 1,
      productId: 1,
      productName: '茅台飞天53度500ml 整箱批发',
      productImage: 'https://via.placeholder.com/200x200/f5f5f5/999?text=MT',
      skuId: 1,
      skuName: '500ml*6瓶/箱 53度',
      unitPrice: calculateTierPriceLocal(qty1, tierPrices1),
      quantity: qty1,
      minOrderQty: 2,
      subtotal: calculateTierPriceLocal(qty1, tierPrices1) * qty1,
      unit: '箱',
      selected: true,
      tierPrices: tierPrices1
    },
    {
      id: 2,
      productId: 2,
      productName: '青岛啤酒经典500ml*24罐 整箱',
      productImage: 'https://via.placeholder.com/200x200/f5f5f5/999?text=QD',
      skuId: 2,
      skuName: '500ml*24罐/箱 经典',
      unitPrice: calculateTierPriceLocal(qty2, tierPrices2),
      quantity: qty2,
      minOrderQty: 5,
      subtotal: calculateTierPriceLocal(qty2, tierPrices2) * qty2,
      unit: '箱',
      selected: true,
      tierPrices: tierPrices2
    },
    {
      id: 3,
      productId: 3,
      productName: '拉菲古堡红葡萄酒750ml 批发',
      productImage: 'https://via.placeholder.com/200x200/f5f5f5/999?text=LF',
      skuId: 3,
      skuName: '750ml/瓶 正牌',
      unitPrice: 5800,
      quantity: 3,
      minOrderQty: 1,
      subtotal: 17400,
      unit: '瓶',
      selected: false,
      tierPrices: [
        { minQty: 1, maxQty: 5, price: 5800 },
        { minQty: 6, price: 5500 }
      ]
    }
  ]
}

// 下拉刷新
const onRefresh = () => {
  isRefreshing.value = true
  loadCart()
}

// 切换选中
const toggleSelect = async (item: WholesaleCartItem) => {
  item.selected = !item.selected
  try {
    await wholesaleApi.toggleCartSelect(item.id, item.selected)
  } catch (error) {
    console.error('切换选中状态失败:', error)
  }
}

// 全选/取消全选
const toggleSelectAll = async () => {
  const newState = !isAllSelected.value
  cartItems.value.forEach(item => {
    item.selected = newState
  })
  try {
    await wholesaleApi.toggleCartSelectAll(newState)
  } catch (error) {
    console.error('全选操作失败:', error)
  }
}

// 减少数量
const decreaseQty = async (item: WholesaleCartItem) => {
  if (item.quantity <= item.minOrderQty) return

  const newQty = item.quantity - 1
  updateItemQuantity(item, newQty)
}

// 增加数量
const increaseQty = async (item: WholesaleCartItem) => {
  const newQty = item.quantity + 1
  updateItemQuantity(item, newQty)
}

// 更新数量
const updateItemQuantity = async (item: WholesaleCartItem, newQty: number) => {
  item.quantity = newQty
  // 重新计算单价和小计
  if (item.tierPrices && item.tierPrices.length > 0) {
    item.unitPrice = calculateTierPriceLocal(newQty, item.tierPrices)
  }
  item.subtotal = item.unitPrice * newQty

  try {
    await wholesaleApi.updateCartItem(item.id, newQty)
  } catch (error) {
    console.error('更新购物车数量失败:', error)
  }
}

// 删除商品
const deleteItem = (item: WholesaleCartItem) => {
  Taro.showModal({
    title: '提示',
    content: '确定删除该商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wholesaleApi.deleteCartItem([item.id])
          cartItems.value = cartItems.value.filter(i => i.id !== item.id)
          Taro.showToast({ title: '删除成功', icon: 'success' })
        } catch (error) {
          console.error('删除失败:', error)
          cartItems.value = cartItems.value.filter(i => i.id !== item.id)
        }
      }
    }
  })
}

// 结算
const handleCheckout = () => {
  if (selectedCount.value === 0) return

  const selectedIds = cartItems.value
    .filter(item => item.selected)
    .map(item => item.id)

  if (selectedIds.length === 0) {
    Taro.showToast({ title: '请选择商品', icon: 'none' })
    return
  }

  Taro.showToast({ title: '订单确认页开发中', icon: 'none' })
}

// 跳转
const goProductDetail = (productId: number) => {
  Taro.navigateTo({ url: `/pages/wholesale/product/index?id=${productId}` })
}

const goWholesale = () => {
  Taro.navigateTo({ url: '/pages/wholesale/index' })
}

onMounted(() => {
  loadCart()
})
</script>

<style lang="scss" scoped>
.wholesale-cart {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
  padding-bottom: 140rpx;
}

// 顶部提示
.top-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm $spacing-md;
  background-color: rgba(250, 173, 20, 0.1);
}

.tip-icon {
  font-size: 28rpx;
  margin-right: $spacing-xs;
}

.tip-text {
  font-size: $font-size-sm;
  color: $warning-color;
}

// 购物车列表
.cart-list {
  flex: 1;
  padding: $spacing-sm;
}

// 空状态
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon {
  font-size: 160rpx;
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

// 购物车项
.cart-items {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  background-color: $bg-primary;
  border-radius: $radius-md;
  padding: $spacing-md;
  position: relative;
}

.item-checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-md;
  margin-top: 60rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  color: #fff;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
  }
}

.item-image {
  width: 180rpx;
  height: 180rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
  margin-right: $spacing-md;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: $font-size-base;
  color: $text-primary;
  line-height: 1.4;
  margin-bottom: $spacing-xs;
}

.item-sku {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: $spacing-xs;
}

.item-tags {
  margin-bottom: $spacing-sm;
}

.tag {
  display: inline-block;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  background-color: rgba(64, 128, 255, 0.1);
  color: $primary-color;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-xs;
}

.item-price {
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

.quantity-control {
  display: flex;
  align-items: center;
  border: 1rpx solid $border-color;
  border-radius: $radius-sm;
  overflow: hidden;
}

.qty-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-md;
  color: $text-primary;
  background-color: $bg-secondary;

  &.disabled {
    color: $text-placeholder;
  }
}

.qty-text {
  width: 80rpx;
  text-align: center;
  font-size: $font-size-base;
  color: $text-primary;
}

.item-subtotal {
  font-size: $font-size-sm;
  color: $text-secondary;
  text-align: right;
}

.subtotal-value {
  color: $error-color;
  font-weight: bold;
}

.delete-btn {
  position: absolute;
  top: $spacing-sm;
  right: $spacing-sm;
  padding: $spacing-xs;
}

.delete-icon {
  font-size: 32rpx;
  opacity: 0.5;
}

// 底部结算栏
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  background-color: $bg-primary;
  display: flex;
  align-items: center;
  padding: 0 $spacing-md;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.select-all {
  display: flex;
  align-items: center;
  margin-right: $spacing-md;
}

.checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  font-size: 24rpx;
  color: #fff;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
  }
}

.select-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.price-summary {
  flex: 1;
  text-align: right;
}

.summary-row {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
}

.summary-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.summary-symbol {
  font-size: $font-size-sm;
  color: $error-color;
}

.summary-value {
  font-size: $font-size-xl;
  font-weight: bold;
  color: $error-color;
}

.discount-text {
  font-size: $font-size-xs;
  color: $success-color;
}

.checkout-btn {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 $spacing-lg;
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  font-weight: bold;

  &.disabled {
    opacity: 0.5;
  }
}

.list-bottom {
  height: $spacing-lg;
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
