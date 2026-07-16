<template>
  <view class="cashier-page">
    <!-- 顶栏：搜索 + 状态 -->
    <view class="page-header">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="productKeyword"
            type="text"
            placeholder="搜索商品名称 / 条码 / 拼音"
            placeholder-class="search-placeholder"
            confirm-type="search"
            @confirm="handleSearchProducts"
          />
          <text class="search-clear" v-if="productKeyword" @tap="clearKeyword">&#xe615;</text>
        </view>
      </view>
      <view class="header-status">
        <text class="store-name">{{ storeName || '智享酒仓' }}</text>
        <text class="status-dot" :class="statusType"></text>
        <text class="status-text">{{ statusText }}</text>
      </view>
    </view>

    <!-- 分类标签 -->
    <scroll-view class="category-bar" scroll-x v-if="categories.length > 0">
      <view class="category-list">
        <view
          class="category-item"
          :class="{ 'category-item--active': activeCategory === null }"
          @tap="activeCategory = null"
        >
          <text class="category-text">全部</text>
        </view>
        <view
          v-for="cat in categories"
          :key="cat.id"
          class="category-item"
          :class="{ 'category-item--active': activeCategory === cat.id }"
          @tap="switchCategory(cat.id)"
        >
          <text class="category-text">{{ cat.shortName || cat.name }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 商品列表 -->
    <scroll-view class="product-area" scroll-y v-if="productOptions.length > 0">
      <view class="product-grid">
        <view
          v-for="product in filteredProducts"
          :key="product.skuId || product.id"
          class="product-card"
          @tap="addCartItem(product)"
        >
          <view class="product-img">
            <text class="product-img-text">{{ (product.productName || product.skuName || '?').charAt(0) }}</text>
          </view>
          <view class="product-info">
            <text class="product-name">{{ product.productName || product.skuName }}</text>
            <text class="product-spec">库存：{{ product.availableQty || 0 }}</text>
            <text class="product-price">¥{{ Number(product.unitPrice || product.price || 0).toFixed(2) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">输入关键词搜索商品</text>
      <text class="empty-hint">支持商品名称、条码、拼音首字母</text>
    </view>

    <!-- 购物车浮层 -->
    <view class="cart-bar" v-if="cartItems.length > 0">
      <view class="cart-left" @tap="toggleCartPanel">
        <view class="cart-icon-wrap">
          <text class="cart-icon">&#xe613;</text>
          <view class="cart-badge">
            <text class="cart-badge-text">{{ totalCount }}</text>
          </view>
        </view>
        <text class="cart-total">¥{{ totalAmount.toFixed(2) }}</text>
      </view>
      <view class="cart-submit" :class="{ 'cart-submit--disabled': submitting }" @tap="handleSubmit">
        <text class="cart-submit-text">{{ submitting ? '提交中...' : '去结算' }}</text>
      </view>
    </view>

    <!-- 购物车明细面板 -->
    <view class="cart-mask" v-if="cartPanelVisible" @tap="toggleCartPanel"></view>
    <view class="cart-panel" :class="{ 'cart-panel--show': cartPanelVisible }" v-if="cartItems.length > 0">
      <view class="cart-panel-header">
        <text class="cart-panel-title">已选商品</text>
        <text class="cart-clear" @tap="clearCart">清空</text>
      </view>
      <scroll-view class="cart-panel-list" scroll-y>
        <view class="cart-item" v-for="(item, index) in cartItems" :key="index">
          <view class="cart-item-info">
            <text class="cart-item-name">{{ item.skuName }}</text>
            <text class="cart-item-price">¥{{ Number(item.unitPrice).toFixed(2) }}</text>
          </view>
          <view class="cart-item-qty">
            <view class="qty-btn" @tap="decreaseQty(index)">-</view>
            <text class="qty-text">{{ item.quantity }}</text>
            <view class="qty-btn qty-btn--plus" @tap="increaseQty(index)">+</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="safe-bottom" v-if="cartItems.length > 0"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { storeApi, type StoreProduct, type StoreCategory } from '@/api/modules/store'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const storeName = computed(() => userStore.storeName)

// 商品搜索
const productKeyword = ref('')
const productOptions = ref<StoreProduct[]>([])
const categories = ref<StoreCategory[]>([])
const activeCategory = ref<number | null>(null)

// 收银状态
const statusType = ref('online')
const statusText = ref('营业中')

// 购物车
interface CartItem {
  skuId: number
  skuName: string
  unitPrice: number
  quantity: number
}
const cartItems = reactive<CartItem[]>([])
const cartPanelVisible = ref(false)
const submitting = ref(false)

const filteredProducts = computed(() => {
  if (activeCategory.value === null) return productOptions.value
  return productOptions.value.filter(p => p.categoryId === activeCategory.value)
})

const totalCount = computed(() => cartItems.reduce((sum, item) => sum + item.quantity, 0))
const totalAmount = computed(() =>
  cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
)

function clearKeyword() {
  productKeyword.value = ''
  productOptions.value = []
}

function switchCategory(catId: number) {
  activeCategory.value = catId
}

async function handleSearchProducts() {
  if (!productKeyword.value.trim()) {
    productOptions.value = []
    return
  }
  try {
    uni.showLoading({ title: '搜索中...' })
    const res = await storeApi.searchProducts(productKeyword.value.trim())
    productOptions.value = res?.records || []
    if (productOptions.value.length === 0) {
      uni.showToast({ title: '未找到相关商品', icon: 'none' })
    }
  } catch (err) {
    console.error('搜索商品失败:', err)
  } finally {
    uni.hideLoading()
  }
}

async function loadCategories() {
  try {
    categories.value = await storeApi.fetchCategories()
  } catch (err) {
    console.error('加载分类失败:', err)
  }
}

function addCartItem(product: StoreProduct) {
  const skuId = product.skuId || product.id || 0
  if (!skuId) {
    uni.showToast({ title: '商品信息异常', icon: 'none' })
    return
  }
  const existing = cartItems.find(item => item.skuId === skuId)
  if (existing) {
    existing.quantity += 1
  } else {
    cartItems.push({
      skuId,
      skuName: product.productName || product.skuName || '未知商品',
      unitPrice: Number(product.unitPrice || product.price || 0),
      quantity: 1,
    })
  }
  uni.vibrateShort?.({ type: 'light' })
}

function increaseQty(index: number) {
  cartItems[index].quantity += 1
}

function decreaseQty(index: number) {
  if (cartItems[index].quantity > 1) {
    cartItems[index].quantity -= 1
  } else {
    cartItems.splice(index, 1)
    if (cartItems.length === 0) cartPanelVisible.value = false
  }
}

function toggleCartPanel() {
  cartPanelVisible.value = !cartPanelVisible.value
}

function clearCart() {
  uni.showModal({
    title: '提示',
    content: '确定清空购物车吗？',
    success: (res) => {
      if (res.confirm) {
        cartItems.splice(0, cartItems.length)
        cartPanelVisible.value = false
      }
    }
  })
}

async function handleSubmit() {
  if (cartItems.length === 0 || submitting.value) return
  submitting.value = true
  try {
    uni.showLoading({ title: '提交中...' })
    await storeApi.createSaleBill({
      items: cartItems.map(item => ({
        skuId: item.skuId,
        skuName: item.skuName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotalAmount: Number((item.unitPrice * item.quantity).toFixed(2)),
      })),
    })
    uni.showToast({ title: '收银成功', icon: 'success' })
    cartItems.splice(0, cartItems.length)
    cartPanelVisible.value = false
  } catch (err) {
    console.error('收银提交失败:', err)
  } finally {
    submitting.value = false
    uni.hideLoading()
  }
}

loadCategories()
</script>

<style scoped>
.cashier-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header {
  background: #fff;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}
.search-bar { padding: 8rpx 0; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: #f5f7fa;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: #bbb; padding: 4rpx; }
.header-status {
  display: flex; align-items: center;
  padding: 8rpx 8rpx 0; gap: 12rpx;
}
.store-name { font-size: 24rpx; color: #333; font-weight: 600; }
.status-dot {
  width: 12rpx; height: 12rpx; border-radius: 50%;
  background: #52c41a;
}
.status-dot.online { background: #52c41a; }
.status-dot.offline { background: #bbb; }
.status-text { font-size: 22rpx; color: #999; }

.category-bar { background: #fff; padding: 8rpx 16rpx 16rpx; white-space: nowrap; }
.category-list { display: inline-flex; gap: 12rpx; }
.category-item {
  display: inline-flex; align-items: center; justify-content: center;
  height: 56rpx; padding: 0 24rpx;
  background: #f5f7fa; border-radius: 28rpx;
}
.category-item--active { background: #fa8c16; }
.category-item--active .category-text { color: #fff; }
.category-text { font-size: 24rpx; color: #666; }

.product-area { flex: 1; padding: 16rpx 24rpx; }
.product-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.product-card {
  width: calc((100% - 32rpx) / 3);
  background: #fff; border-radius: 16rpx;
  padding: 16rpx; display: flex; flex-direction: column;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.product-img {
  width: 100%; height: 120rpx;
  background: linear-gradient(135deg, #fa8c16, #ffa940);
  border-radius: 12rpx; display: flex;
  align-items: center; justify-content: center;
  margin-bottom: 12rpx;
}
.product-img-text { font-size: 48rpx; color: #fff; font-weight: 700; }
.product-info { display: flex; flex-direction: column; gap: 4rpx; }
.product-name { font-size: 24rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-spec { font-size: 20rpx; color: #999; }
.product-price { font-size: 26rpx; color: #fa8c16; font-weight: 600; }

.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 100rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; margin-bottom: 8rpx; }
.empty-hint { font-size: 22rpx; color: #ccc; }

.cart-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  height: 100rpx; background: #333;
  display: flex; align-items: center;
  padding: 0 24rpx; z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
.cart-left { flex: 1; display: flex; align-items: center; gap: 16rpx; }
.cart-icon-wrap { position: relative; }
.cart-icon { font-size: 44rpx; color: #fa8c16; }
.cart-badge {
  position: absolute; top: -8rpx; right: -12rpx;
  min-width: 28rpx; height: 28rpx;
  background: #ff4d4f; border-radius: 14rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 0 6rpx;
}
.cart-badge-text { font-size: 20rpx; color: #fff; }
.cart-total { font-size: 32rpx; color: #fff; font-weight: 600; }
.cart-submit {
  height: 72rpx; padding: 0 40rpx;
  background: #fa8c16; border-radius: 36rpx;
  display: flex; align-items: center; justify-content: center;
}
.cart-submit--disabled { background: #999; }
.cart-submit-text { font-size: 28rpx; color: #fff; font-weight: 600; }

.cart-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 100rpx;
  background: rgba(0,0,0,0.4); z-index: 99;
}
.cart-panel {
  position: fixed; left: 0; right: 0; bottom: 100rpx;
  max-height: 600rpx; background: #fff;
  border-radius: 24rpx 24rpx 0 0; z-index: 100;
  display: flex; flex-direction: column;
}
.cart-panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx; border-bottom: 1rpx solid #f0f0f0;
}
.cart-panel-title { font-size: 28rpx; color: #333; font-weight: 600; }
.cart-clear { font-size: 24rpx; color: #ff4d4f; }
.cart-panel-list { max-height: 480rpx; padding: 0 24rpx; }
.cart-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5;
}
.cart-item-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.cart-item-name { font-size: 26rpx; color: #333; }
.cart-item-price { font-size: 22rpx; color: #999; }
.cart-item-qty { display: flex; align-items: center; gap: 16rpx; }
.qty-btn {
  width: 44rpx; height: 44rpx; border-radius: 50%;
  background: #f5f7fa; display: flex;
  align-items: center; justify-content: center;
  font-size: 32rpx; color: #666;
}
.qty-btn--plus { background: #fa8c16; color: #fff; }
.qty-text { font-size: 28rpx; color: #333; min-width: 40rpx; text-align: center; }
.safe-bottom { height: 120rpx; }
</style>
