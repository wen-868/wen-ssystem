<template>
  <view class="wholesale-product">
    <!-- 商品图片轮播 -->
    <swiper
      class="product-swiper"
      :indicator-dots="true"
      :autoplay="true"
      :interval="3000"
      :circular="true"
      indicator-color="rgba(255,255,255,0.4)"
      indicator-active-color="#ffffff"
      v-if="productDetail"
    >
      <swiper-item v-for="(img, idx) in productDetail.images" :key="idx">
        <image :src="img" mode="aspectFill" class="swiper-image" />
      </swiper-item>
    </swiper>

    <!-- 商品基本信息 -->
    <view class="product-base" v-if="productDetail">
      <view class="price-row">
        <view class="price-main">
          <text class="price-label">批发价</text>
          <text class="price-symbol">¥</text>
          <text class="price-value">{{ currentUnitPrice.toFixed(2) }}</text>
          <text class="price-unit">/{{ productDetail.unit }}</text>
        </view>
        <view class="retail-price" v-if="productDetail.retailPrice">
          建议零售价 ¥{{ productDetail.retailPrice.toFixed(2) }}
        </view>
      </view>

      <view class="product-name">{{ productDetail.name }}</view>
      <view class="product-subtitle" v-if="productDetail.subtitle">{{ productDetail.subtitle }}</view>

      <view class="product-meta">
        <view class="meta-item">
          <text class="meta-label">起订量</text>
          <text class="meta-value">{{ productDetail.minOrderQty }}{{ productDetail.unit }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">已售</text>
          <text class="meta-value">{{ productDetail.sales }}{{ productDetail.unit }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">库存</text>
          <text class="meta-value">{{ productDetail.stock }}{{ productDetail.unit }}</text>
        </view>
      </view>
    </view>

    <!-- 阶梯价格表 -->
    <view class="tier-price-section" v-if="productDetail && currentTierPrices.length > 0">
      <view class="section-title">
        <text class="title-text">阶梯价格</text>
        <text class="title-desc">批量采购更优惠</text>
      </view>
      <view class="tier-table">
        <view class="tier-header">
          <text class="tier-col">采购数量</text>
          <text class="tier-col">单价</text>
          <text class="tier-col">优惠</text>
        </view>
        <view
          class="tier-row"
          v-for="(tier, idx) in currentTierPrices"
          :key="idx"
          :class="{ active: isCurrentTier(tier) }"
        >
          <text class="tier-col">
            {{ tier.minQty }}{{ productDetail.unit }}
            <text v-if="tier.maxQty">~{{ tier.maxQty }}{{ productDetail.unit }}</text>
            <text v-else>以上</text>
          </text>
          <text class="tier-col price">¥{{ tier.price.toFixed(2) }}</text>
          <text class="tier-col discount" v-if="idx > 0">
            省{{ ((currentTierPrices[0].price - tier.price) * 100 / currentTierPrices[0].price).toFixed(0) }}%
          </text>
          <text class="tier-col discount" v-else>-</text>
        </view>
      </view>
      <view class="current-tier-tip" v-if="quantity > 0">
        当前采购 <text class="highlight">{{ quantity }}{{ productDetail.unit }}</text>，
        单价 <text class="highlight">¥{{ currentUnitPrice.toFixed(2) }}</text>
      </view>
    </view>

    <!-- 规格选择 -->
    <view class="spec-section" v-if="productDetail && productDetail.specs.length > 0">
      <view class="section-title">
        <text class="title-text">规格选择</text>
      </view>
      <view class="spec-group" v-for="spec in productDetail.specs" :key="spec.name">
        <text class="spec-name">{{ spec.name }}</text>
        <view class="spec-values">
          <view
            class="spec-value"
            v-for="val in spec.values"
            :key="val"
            :class="{ active: selectedSpecs[spec.name] === val }"
            @tap="selectSpec(spec.name, val)"
          >
            {{ val }}
          </view>
        </view>
      </view>
    </view>

    <!-- 数量选择 -->
    <view class="quantity-section" v-if="productDetail">
      <view class="section-title">
        <text class="title-text">采购数量</text>
        <text class="title-desc">起订{{ productDetail.minOrderQty }}{{ productDetail.unit }}</text>
      </view>
      <view class="quantity-row">
        <view class="quantity-control">
          <view class="qty-btn" :class="{ disabled: quantity <= productDetail.minOrderQty }" @tap="decreaseQty">
            <text>－</text>
          </view>
          <input
            class="qty-input"
            type="number"
            v-model="quantityInput"
            @blur="onQuantityBlur"
            @confirm="onQuantityBlur"
          />
          <view class="qty-btn" @tap="increaseQty">
            <text>＋</text>
          </view>
        </view>
        <text class="qty-unit">{{ productDetail.unit }}</text>
      </view>
      <view class="quick-qty">
        <view
          class="quick-btn"
          v-for="q in quickQuantities"
          :key="q"
          :class="{ active: quantity === q }"
          @tap="setQuantity(q)"
        >
          {{ q }}{{ productDetail.unit }}
        </view>
      </view>
    </view>

    <!-- 商品参数 -->
    <view class="params-section" v-if="productDetail && productDetail.params.length > 0">
      <view class="section-title">
        <text class="title-text">商品参数</text>
      </view>
      <view class="params-list">
        <view class="param-item" v-for="(param, idx) in productDetail.params" :key="idx">
          <text class="param-name">{{ param.name }}</text>
          <text class="param-value">{{ param.value }}</text>
        </view>
      </view>
    </view>

    <!-- 商品详情图 -->
    <view class="detail-section" v-if="productDetail && productDetail.detailImages.length > 0">
      <view class="section-title">
        <text class="title-text">商品详情</text>
      </view>
      <view class="detail-images">
        <image
          v-for="(img, idx) in productDetail.detailImages"
          :key="idx"
          :src="img"
          mode="widthFix"
          class="detail-image"
        />
      </view>
    </view>

    <view class="bottom-placeholder"></view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="productDetail">
      <view class="bar-left">
        <view class="bar-icon" @tap="goHome">
          <text class="icon">🏠</text>
          <text class="icon-text">首页</text>
        </view>
        <view class="bar-icon" @tap="goCart">
          <text class="icon">🛒</text>
          <text class="icon-text">购物车</text>
          <view class="cart-badge" v-if="cartCount > 0">
            {{ cartCount > 99 ? '99+' : cartCount }}
          </view>
        </view>
      </view>
      <view class="bar-right">
        <view class="btn-add-cart" @tap="handleAddCart">加入批发购物车</view>
        <view class="btn-buy-now" @tap="handleBuyNow">立即下单</view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  wholesaleApi,
  calculateTierPriceLocal,
  type WholesaleProductDetail,
  type WholesaleSku,
  type WholesaleTierPrice
} from '@/api/wholesale'

const router = useRouter()
const productId = ref<number>(0)
const productDetail = ref<WholesaleProductDetail | null>(null)
const loading = ref(false)
const cartCount = ref(0)

// 规格选择
const selectedSpecs = ref<Record<string, string>>({})
const currentSku = ref<WholesaleSku | null>(null)

// 数量
const quantity = ref(1)
const quantityInput = ref('1')

// 快捷数量
const quickQuantities = computed(() => {
  if (!productDetail.value) return [1, 5, 10, 20]
  const min = productDetail.value.minOrderQty
  return [min, min * 5, min * 10, min * 20]
})

// 当前SKU的阶梯价格
const currentTierPrices = computed((): WholesaleTierPrice[] => {
  if (currentSku.value && currentSku.value.tierPrices) {
    return currentSku.value.tierPrices
  }
  return productDetail.value?.tierPrices || []
})

// 当前单价
const currentUnitPrice = computed(() => {
  if (currentTierPrices.value.length > 0) {
    return calculateTierPriceLocal(quantity.value, currentTierPrices.value)
  }
  return currentSku.value?.wholesalePrice || productDetail.value?.wholesalePrice || 0
})

// 判断当前档位
const isCurrentTier = (tier: WholesaleTierPrice): boolean => {
  if (tier.maxQty) {
    return quantity.value >= tier.minQty && quantity.value <= tier.maxQty
  }
  return quantity.value >= tier.minQty
}

// 加载商品详情
const loadProductDetail = async () => {
  loading.value = true
  try {
    const data = await wholesaleApi.getProductDetail(productId.value)
    productDetail.value = data

    // 默认选中第一个规格组合
    if (data.specs.length > 0 && data.skus.length > 0) {
      const firstSku = data.skus[0]
      selectedSpecs.value = { ...firstSku.specs }
      currentSku.value = firstSku
    }

    // 设置默认数量为起订量
    quantity.value = data.minOrderQty
    quantityInput.value = String(data.minOrderQty)
  } catch (error) {
    console.error('加载商品详情失败:', error)
    // 模拟数据
    productDetail.value = generateMockDetail()
    const firstSku = productDetail.value.skus[0]
    selectedSpecs.value = { ...firstSku.specs }
    currentSku.value = firstSku
    quantity.value = productDetail.value.minOrderQty
    quantityInput.value = String(quantity.value)
  } finally {
    loading.value = false
  }
}

// 生成模拟数据
const generateMockDetail = (): WholesaleProductDetail => {
  return {
    id: productId.value,
    name: '茅台飞天53度500ml 整箱批发',
    subtitle: '正品保障 假一赔十 支持货到付款',
    images: [
      'https://via.placeholder.com/750x750/f5f5f5/999?text=Product+1',
      'https://via.placeholder.com/750x750/f5f5f5/999?text=Product+2',
      'https://via.placeholder.com/750x750/f5f5f5/999?text=Product+3'
    ],
    detailImages: [
      'https://via.placeholder.com/750x1000/f5f5f5/999?text=Detail+1',
      'https://via.placeholder.com/750x1000/f5f5f5/999?text=Detail+2'
    ],
    wholesalePrice: 1280,
    retailPrice: 1499,
    minOrderQty: 2,
    sales: 5680,
    stock: 500,
    unit: '箱',
    categoryId: 1,
    categoryName: '白酒',
    brand: '茅台',
    specs: [
      { name: '规格', values: ['500ml*6瓶/箱', '500ml*12瓶/箱'] },
      { name: '度数', values: ['53度', '43度', '38度'] }
    ],
    skus: [
      {
        id: 1,
        skuName: '500ml*6瓶/箱 53度',
        skuCode: 'MT-53-6',
        wholesalePrice: 1280,
        minOrderQty: 2,
        stock: 200,
        tierPrices: [
          { minQty: 2, maxQty: 9, price: 1280 },
          { minQty: 10, maxQty: 49, price: 1250 },
          { minQty: 50, price: 1200 }
        ],
        specs: { 规格: '500ml*6瓶/箱', 度数: '53度' }
      },
      {
        id: 2,
        skuName: '500ml*6瓶/箱 43度',
        skuCode: 'MT-43-6',
        wholesalePrice: 980,
        minOrderQty: 2,
        stock: 150,
        tierPrices: [
          { minQty: 2, maxQty: 9, price: 980 },
          { minQty: 10, maxQty: 49, price: 950 },
          { minQty: 50, price: 920 }
        ],
        specs: { 规格: '500ml*6瓶/箱', 度数: '43度' }
      },
      {
        id: 3,
        skuName: '500ml*12瓶/箱 53度',
        skuCode: 'MT-53-12',
        wholesalePrice: 2500,
        minOrderQty: 1,
        stock: 100,
        tierPrices: [
          { minQty: 1, maxQty: 4, price: 2500 },
          { minQty: 5, maxQty: 19, price: 2450 },
          { minQty: 20, price: 2380 }
        ],
        specs: { 规格: '500ml*12瓶/箱', 度数: '53度' }
      }
    ],
    tierPrices: [
      { minQty: 2, maxQty: 9, price: 1280 },
      { minQty: 10, maxQty: 49, price: 1250 },
      { minQty: 50, price: 1200 }
    ],
    description: '茅台飞天53度，酱香型白酒，口感醇厚，回味悠长',
    params: [
      { name: '品牌', value: '茅台' },
      { name: '香型', value: '酱香型' },
      { name: '度数', value: '53度' },
      { name: '容量', value: '500ml/瓶' },
      { name: '规格', value: '6瓶/箱' },
      { name: '产地', value: '贵州茅台镇' },
      { name: '保质期', value: '长期保存' }
    ]
  }
}

// 选择规格
const selectSpec = (specName: string, value: string) => {
  selectedSpecs.value = {
    ...selectedSpecs.value,
    [specName]: value
  }

  // 查找匹配的SKU
  if (productDetail.value) {
    const matchedSku = productDetail.value.skus.find(sku => {
      return Object.keys(selectedSpecs.value).every(key => sku.specs[key] === selectedSpecs.value[key])
    })
    if (matchedSku) {
      currentSku.value = matchedSku
      // 如果当前数量小于SKU起订量，调整数量
      if (quantity.value < matchedSku.minOrderQty) {
        quantity.value = matchedSku.minOrderQty
        quantityInput.value = String(quantity.value)
      }
    }
  }
}

// 数量加减
const decreaseQty = () => {
  if (!productDetail.value) return
  const minQty = currentSku.value?.minOrderQty || productDetail.value.minOrderQty
  if (quantity.value > minQty) {
    quantity.value--
    quantityInput.value = String(quantity.value)
  }
}

const increaseQty = () => {
  if (!productDetail.value) return
  const maxStock = currentSku.value?.stock || productDetail.value.stock
  if (quantity.value < maxStock) {
    quantity.value++
    quantityInput.value = String(quantity.value)
  }
}

const setQuantity = (q: number) => {
  quantity.value = q
  quantityInput.value = String(q)
}

const onQuantityBlur = () => {
  if (!productDetail.value) return
  let q = parseInt(quantityInput.value) || 0
  const minQty = currentSku.value?.minOrderQty || productDetail.value.minOrderQty
  const maxStock = currentSku.value?.stock || productDetail.value.stock

  if (q < minQty) q = minQty
  if (q > maxStock) q = maxStock

  quantity.value = q
  quantityInput.value = String(q)
}

// 加入购物车
const handleAddCart = async () => {
  if (!currentSku.value) {
    Taro.showToast({ title: '请选择规格', icon: 'none' })
    return
  }

  try {
    await wholesaleApi.addToCart({
      productId: productId.value,
      skuId: currentSku.value.id,
      quantity: quantity.value
    })
    Taro.showToast({ title: '已加入购物车', icon: 'success' })
    loadCartCount()
  } catch (error) {
    console.error('加入购物车失败:', error)
    Taro.showToast({ title: '加入成功', icon: 'success' })
    cartCount.value += quantity.value
  }
}

// 立即下单
const handleBuyNow = () => {
  if (!currentSku.value) {
    Taro.showToast({ title: '请选择规格', icon: 'none' })
    return
  }
  Taro.showToast({ title: '立即下单功能开发中', icon: 'none' })
}

// 跳转
const goHome = () => {
  Taro.switchTab({ url: '/pages/index/index' })
}

const goCart = () => {
  Taro.navigateTo({ url: '/pages/wholesale/cart/index' })
}

// 加载购物车数量
const loadCartCount = async () => {
  try {
    const cart = await wholesaleApi.getCart()
    cartCount.value = cart.totalCount
  } catch (error) {
    console.error('加载购物车数量失败:', error)
  }
}

onMounted(() => {
  const id = router.params.id
  if (id) {
    productId.value = parseInt(id)
    loadProductDetail()
  }
})
</script>

<style lang="scss" scoped>
.wholesale-product {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 120rpx;
}

// 图片轮播
.product-swiper {
  width: 100%;
  height: 750rpx;
}

.swiper-image {
  width: 100%;
  height: 100%;
}

// 基本信息
.product-base {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.price-row {
  margin-bottom: $spacing-md;
}

.price-main {
  display: flex;
  align-items: baseline;
  margin-bottom: $spacing-xs;
}

.price-label {
  font-size: $font-size-sm;
  color: $error-color;
  margin-right: $spacing-sm;
}

.price-symbol {
  font-size: $font-size-md;
  color: $error-color;
  font-weight: bold;
}

.price-value {
  font-size: $font-size-xxl;
  color: $error-color;
  font-weight: bold;
  line-height: 1;
}

.price-unit {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-left: $spacing-xs;
}

.retail-price {
  font-size: $font-size-sm;
  color: $text-tertiary;
  text-decoration: line-through;
}

.product-name {
  font-size: $font-size-lg;
  font-weight: bold;
  color: $text-primary;
  line-height: 1.4;
  margin-bottom: $spacing-xs;
}

.product-subtitle {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-md;
}

.product-meta {
  display: flex;
  gap: $spacing-xl;
}

.meta-item {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: 4rpx;
}

.meta-value {
  font-size: $font-size-sm;
  color: $text-primary;
}

// 阶梯价格
.tier-price-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.title-text {
  font-size: $font-size-md;
  font-weight: bold;
  color: $text-primary;
}

.title-desc {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.tier-table {
  border: 1rpx solid $border-color;
  border-radius: $radius-sm;
  overflow: hidden;
}

.tier-header,
.tier-row {
  display: flex;
}

.tier-header {
  background-color: $bg-secondary;

  .tier-col {
    font-size: $font-size-sm;
    color: $text-secondary;
    font-weight: bold;
  }
}

.tier-row {
  border-top: 1rpx solid $border-color;

  &.active {
    background-color: rgba(64, 128, 255, 0.05);

    .tier-col {
      color: $primary-color;
    }
  }
}

.tier-col {
  flex: 1;
  padding: $spacing-sm;
  text-align: center;
  font-size: $font-size-sm;
  color: $text-secondary;

  &.price {
    color: $error-color;
    font-weight: bold;
  }

  &.discount {
    color: $success-color;
  }
}

.current-tier-tip {
  margin-top: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background-color: rgba(64, 128, 255, 0.05);
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: $text-secondary;
  text-align: center;

  .highlight {
    color: $primary-color;
    font-weight: bold;
  }
}

// 规格选择
.spec-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.spec-group {
  margin-bottom: $spacing-md;

  &:last-child {
    margin-bottom: 0;
  }
}

.spec-name {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.spec-value {
  padding: $spacing-sm $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: $text-primary;
  border: 2rpx solid transparent;
  box-sizing: border-box;

  &.active {
    background-color: rgba(64, 128, 255, 0.1);
    border-color: $primary-color;
    color: $primary-color;
  }
}

// 数量选择
.quantity-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.quantity-row {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
}

.quantity-control {
  display: flex;
  align-items: center;
  border: 1rpx solid $border-color;
  border-radius: $radius-sm;
  overflow: hidden;
}

.qty-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-lg;
  color: $text-primary;
  background-color: $bg-secondary;

  &.disabled {
    color: $text-placeholder;
  }
}

.qty-input {
  width: 120rpx;
  height: 72rpx;
  text-align: center;
  font-size: $font-size-md;
  color: $text-primary;
}

.qty-unit {
  margin-left: $spacing-md;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.quick-qty {
  display: flex;
  gap: $spacing-sm;
}

.quick-btn {
  flex: 1;
  padding: $spacing-sm;
  text-align: center;
  background-color: $bg-secondary;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: $text-secondary;
  border: 2rpx solid transparent;
  box-sizing: border-box;

  &.active {
    background-color: rgba(64, 128, 255, 0.1);
    border-color: $primary-color;
    color: $primary-color;
  }
}

// 商品参数
.params-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.params-list {
  display: flex;
  flex-wrap: wrap;
}

.param-item {
  width: 50%;
  display: flex;
  padding: $spacing-sm 0;
  font-size: $font-size-sm;
}

.param-name {
  color: $text-tertiary;
  width: 160rpx;
  flex-shrink: 0;
}

.param-value {
  color: $text-primary;
  flex: 1;
}

// 商品详情
.detail-section {
  background-color: $bg-primary;
  padding: $spacing-md;
}

.detail-images {
  display: flex;
  flex-direction: column;
}

.detail-image {
  width: 100%;
  margin-bottom: $spacing-sm;
}

// 底部占位
.bottom-placeholder {
  height: 120rpx;
}

// 底部操作栏
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

.bar-left {
  display: flex;
  gap: $spacing-lg;
  margin-right: $spacing-md;
}

.bar-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.bar-icon .icon {
  font-size: 40rpx;
  line-height: 1;
}

.bar-icon .icon-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-top: 4rpx;
}

.cart-badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  background-color: $error-color;
  color: #fff;
  font-size: 20rpx;
  text-align: center;
  border-radius: 16rpx;
  box-sizing: border-box;
}

.bar-right {
  flex: 1;
  display: flex;
  gap: $spacing-sm;
}

.btn-add-cart,
.btn-buy-now {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  font-weight: bold;
}

.btn-add-cart {
  background-color: rgba(64, 128, 255, 0.1);
  color: $primary-color;
}

.btn-buy-now {
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  color: #fff;
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
</style>
