<template>
  <view class="page-container">
    <scroll-view scroll-y class="scroll-container">
      <view class="image-section">
        <swiper class="image-swiper" indicator-dots circular @change="onSwiperChange">
          <swiper-item v-for="(img, index) in productDetail.images" :key="index">
            <image :src="img" mode="aspectFill" class="product-image" @tap="previewImage(index)" />
          </swiper-item>
        </swiper>
        <view class="image-counter">
          <text>{{ currentImageIndex + 1 }}/{{ productDetail.images.length }}</text>
        </view>
      </view>

      <view class="info-section">
        <view class="price-row">
          <text class="current-price">{{ formatPrice(selectedSku?.price || productDetail.price) }}</text>
          <text class="original-price" v-if="selectedSku?.originalPrice || productDetail.originalPrice">
            {{ formatPrice(selectedSku?.originalPrice || productDetail.originalPrice) }}
          </text>
        </view>
        <text class="product-name">{{ productDetail.name }}</text>
        <text class="product-subtitle" v-if="productDetail.subtitle">{{ productDetail.subtitle }}</text>
        <view class="stats-row">
          <text class="stat-item">销量 {{ productDetail.sales }}件</text>
          <text class="stat-item">库存 {{ selectedSku?.stock || productDetail.stock }}件</text>
          <text class="stat-item">{{ productDetail.categoryName }}</text>
        </view>
      </view>

      <view class="spec-section">
        <view class="section-header">
          <text class="section-title">规格选择</text>
          <text class="selected-spec" v-if="selectedSpecText">{{ selectedSpecText }}</text>
        </view>
        <view class="spec-list" v-for="spec in productDetail.specs" :key="spec.name">
          <text class="spec-name">{{ spec.name }}:</text>
          <view class="spec-values">
            <view
              class="spec-value"
              :class="{ selected: selectedSpecs[spec.name] === value, disabled: !isSpecAvailable(spec.name, value) }"
              v-for="value in spec.values"
              :key="value"
              @tap="selectSpec(spec.name, value)"
            >
              {{ value }}
            </view>
          </view>
        </view>
      </view>

      <view class="detail-section">
        <view class="section-header">
          <text class="section-title">商品详情</text>
        </view>
        <view class="detail-images">
          <image :src="img" mode="widthFix" class="detail-image" v-for="(img, index) in productDetail.detailImages" :key="index" />
        </view>
      </view>

      <view class="params-section">
        <view class="section-header">
          <text class="section-title">商品参数</text>
        </view>
        <view class="params-table">
          <view class="param-row" v-for="(param, index) in productDetail.params" :key="index">
            <text class="param-name">{{ param.name }}</text>
            <text class="param-value">{{ param.value }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="bottom-left">
        <view class="bottom-item" @tap="goHome">
          <text class="bottom-icon">🏠</text>
          <text class="bottom-label">首页</text>
        </view>
        <view class="bottom-item" @tap="goShare">
          <text class="bottom-icon">📤</text>
          <text class="bottom-label">分享</text>
        </view>
        <view class="bottom-item cart-item" @tap="goCart">
          <text class="bottom-icon">🛒</text>
          <text class="bottom-label">购物车</text>
          <view class="cart-badge" v-if="cartStore.totalCount > 0">{{ cartStore.totalCount }}</view>
        </view>
      </view>
      <view class="bottom-right">
        <view class="btn-cart" @tap="handleAddToCart">加入购物车</view>
        <view class="btn-buy" @tap="handleBuyNow">立即购买</view>
      </view>
    </view>

    <view class="action-popup" v-if="showActionPopup" @tap="closeActionPopup">
      <view class="action-content" @tap.stop>
        <view class="action-header">
          <text class="action-title">选择规格</text>
          <text class="action-close" @tap="closeActionPopup">×</text>
        </view>
        <view class="action-body">
          <image :src="productDetail.images[0]" class="action-image" />
          <view class="action-info">
            <text class="action-price">{{ formatPrice(selectedSku?.price || productDetail.price) }}</text>
            <text class="action-stock">库存 {{ selectedSku?.stock || productDetail.stock }}件</text>
          </view>
          <view class="spec-list" v-for="spec in productDetail.specs" :key="spec.name">
            <text class="spec-name">{{ spec.name }}:</text>
            <view class="spec-values">
              <view
                class="spec-value"
                :class="{ selected: selectedSpecs[spec.name] === value, disabled: !isSpecAvailable(spec.name, value) }"
                v-for="value in spec.values"
                :key="value"
                @tap="selectSpec(spec.name, value)"
              >
                {{ value }}
              </view>
            </view>
          </view>
          <view class="quantity-control">
            <text class="quantity-label">数量</text>
            <view class="quantity-btn" @tap="decreaseQuantity" :class="{ disabled: quantity <= 1 }">-</view>
            <text class="quantity-value">{{ quantity }}</text>
            <view class="quantity-btn" @tap="increaseQuantity" :class="{ disabled: quantity >= (selectedSku?.stock || productDetail.stock) }">+</view>
          </view>
        </view>
        <view class="action-footer">
          <view class="btn-add-cart" @tap="confirmAddToCart">加入购物车</view>
          <view class="btn-confirm" @tap="confirmBuyNow">立即购买</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { getProductDetail, addToCart, type ProductDetail, type ProductSku } from '@/api/product'
import { useCartStore } from '@/stores/cart'

const cartStore = useCartStore()

const productDetail = ref<ProductDetail>({
  id: 0,
  name: '',
  price: 0,
  originalPrice: 0,
  sales: 0,
  stock: 0,
  images: [],
  detailImages: [],
  specs: [],
  skus: [],
  params: [],
  categoryId: 0,
  categoryName: ''
})

const currentImageIndex = ref(0)
const selectedSpecs = ref<Record<string, string>>({})
const quantity = ref(1)
const showActionPopup = ref(false)
const isLoading = ref(true)

const selectedSku = computed<ProductSku | undefined>(() => {
  if (productDetail.value.skus.length === 0) return undefined
  return productDetail.value.skus.find(sku => {
    return Object.keys(selectedSpecs.value).every(key => sku.specs[key] === selectedSpecs.value[key])
  })
})

const selectedSpecText = computed(() => {
  return Object.values(selectedSpecs.value).join(' / ')
})

const onSwiperChange = (e: any) => {
  currentImageIndex.value = e.detail.current
}

const previewImage = (index: number) => {
  Taro.previewImage({
    current: productDetail.value.images[index],
    urls: productDetail.value.images
  })
}

const selectSpec = (specName: string, value: string) => {
  if (!isSpecAvailable(specName, value)) return
  selectedSpecs.value[specName] = value
}

const isSpecAvailable = (specName: string, value: string): boolean => {
  const tempSpecs = { ...selectedSpecs.value, [specName]: value }
  const availableSkus = productDetail.value.skus.filter(sku => {
    return Object.keys(tempSpecs).every(key => sku.specs[key] === tempSpecs[key])
  })
  return availableSkus.some(sku => sku.stock > 0)
}

const increaseQuantity = () => {
  const maxStock = selectedSku.value?.stock || productDetail.value.stock
  if (quantity.value < maxStock) {
    quantity.value++
  }
}

const decreaseQuantity = () => {
  if (quantity.value > 1) {
    quantity.value--
  }
}

const showAction = () => {
  showActionPopup.value = true
  quantity.value = 1
}

const closeActionPopup = () => {
  showActionPopup.value = false
}

const handleAddToCart = () => {
  if (productDetail.value.specs.length > 0 && !selectedSku.value) {
    Taro.showToast({ title: '请选择规格', icon: 'none' })
    return
  }
  showAction()
}

const handleBuyNow = () => {
  if (productDetail.value.specs.length > 0 && !selectedSku.value) {
    Taro.showToast({ title: '请选择规格', icon: 'none' })
    return
  }
  showAction()
}

const confirmAddToCart = async () => {
  if (!selectedSku.value && productDetail.value.specs.length > 0) {
    Taro.showToast({ title: '请选择完整规格', icon: 'none' })
    return
  }

  try {
    await addToCart({
      productId: productDetail.value.id,
      skuId: selectedSku.value?.id,
      quantity: quantity.value
    })

    cartStore.addItem({
      productId: productDetail.value.id,
      productName: productDetail.value.name,
      productImage: productDetail.value.images[0],
      skuId: selectedSku.value?.id,
      skuName: selectedSku.value?.name,
      price: selectedSku.value?.price || productDetail.value.price,
      originalPrice: selectedSku.value?.originalPrice || productDetail.value.originalPrice,
      quantity: quantity.value
    })

    Taro.showToast({ title: '加入购物车成功', icon: 'success' })
    closeActionPopup()
  } catch (error) {
    console.error('Add to cart failed:', error)
  }
}

const confirmBuyNow = async () => {
  if (!selectedSku.value && productDetail.value.specs.length > 0) {
    Taro.showToast({ title: '请选择完整规格', icon: 'none' })
    return
  }

  try {
    await addToCart({
      productId: productDetail.value.id,
      skuId: selectedSku.value?.id,
      quantity: quantity.value
    })

    cartStore.addItem({
      productId: productDetail.value.id,
      productName: productDetail.value.name,
      productImage: productDetail.value.images[0],
      skuId: selectedSku.value?.id,
      skuName: selectedSku.value?.name,
      price: selectedSku.value?.price || productDetail.value.price,
      originalPrice: selectedSku.value?.originalPrice || productDetail.value.originalPrice,
      quantity: quantity.value
    })

    closeActionPopup()
    Taro.navigateTo({ url: '/pages/cart/index' })
  } catch (error) {
    console.error('Buy now failed:', error)
  }
}

const goHome = () => {
  Taro.switchTab({ url: '/pages/index/index' })
}

const goShare = () => {
  Taro.showShareMenu({
    withShareTicket: true
  })
}

const goCart = () => {
  Taro.switchTab({ url: '/pages/cart/index' })
}

const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`
}

const loadProductData = async (productId: number) => {
  isLoading.value = true
  try {
    const data = await getProductDetail(productId)
    productDetail.value = data

    if (data.specs.length > 0 && data.skus.length > 0) {
      data.specs.forEach(spec => {
        selectedSpecs.value[spec.name] = spec.values[0]
      })
    }
  } catch (error) {
    console.error('Load product detail failed:', error)
    productDetail.value = {
      id: productId,
      name: '贵州茅台 飞天53度 500ml',
      subtitle: '酱香典范，国酒茅台',
      price: 1499,
      originalPrice: 1699,
      sales: 2580,
      stock: 150,
      images: [
        'https://neeko-copilot.bytedance.net/api/text2image?prompt=maotai%20wine%20bottle%20elegant%20white%20background',
        'https://neeko-copilot.bytedance.net/api/text2image?prompt=maotai%20wine%20box%20packaging%20luxury',
        'https://neeko-copilot.bytedance.net/api/text2image?prompt=maotai%20wine%20close%20up%20detail'
      ],
      detailImages: [
        'https://neeko-copilot.bytedance.net/api/text2image?prompt=wine%20product%20detail%20page%20elegant%20layout',
        'https://neeko-copilot.bytedance.net/api/text2image?prompt=wine%20production%20process%20traditional'
      ],
      specs: [
        { name: '规格', values: ['500ml', '1000ml'] }
      ],
      skus: [
        { id: 1, name: '500ml', skuCode: 'MT-500', price: 1499, originalPrice: 1699, stock: 150, specs: { '规格': '500ml' } },
        { id: 2, name: '1000ml', skuCode: 'MT-1000', price: 2899, originalPrice: 3299, stock: 50, specs: { '规格': '1000ml' } }
      ],
      params: [
        { name: '品牌', value: '茅台' },
        { name: '产地', value: '贵州' },
        { name: '香型', value: '酱香型' },
        { name: '酒精度', value: '53%vol' },
        { name: '净含量', value: '500ml' },
        { name: '原料', value: '高粱、小麦' }
      ],
      categoryId: 1,
      categoryName: '白酒',
      brand: '茅台'
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  const pages = Taro.getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const options = currentPage.options || {}
  const productId = parseInt(options.id || '1')
  loadProductData(productId)
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.scroll-container {
  height: 100vh;
  padding-bottom: 120rpx;
}

.image-section {
  position: relative;
  background-color: $bg-primary;
}

.image-swiper {
  height: 750rpx;
}

.product-image {
  width: 100%;
  height: 100%;
}

.image-counter {
  position: absolute;
  right: $spacing-md;
  bottom: $spacing-md;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: $font-size-sm;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-md;
}

.info-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.price-row {
  display: flex;
  align-items: baseline;
  margin-bottom: $spacing-sm;
}

.current-price {
  font-size: $font-size-xxl;
  color: $error-color;
  font-weight: bold;
}

.original-price {
  font-size: $font-size-base;
  color: $text-tertiary;
  text-decoration: line-through;
  margin-left: $spacing-sm;
}

.product-name {
  font-size: $font-size-lg;
  color: $text-primary;
  font-weight: bold;
  line-height: 1.4;
}

.product-subtitle {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-top: $spacing-xs;
  line-height: 1.4;
}

.stats-row {
  display: flex;
  margin-top: $spacing-md;
}

.stat-item {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-right: $spacing-lg;
}

.spec-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-size-md;
  font-weight: bold;
  color: $text-primary;
}

.selected-spec {
  font-size: $font-size-sm;
  color: $primary-color;
}

.spec-list {
  margin-bottom: $spacing-md;

  &:last-child {
    margin-bottom: 0;
  }
}

.spec-name {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
}

.spec-value {
  font-size: $font-size-base;
  color: $text-primary;
  background-color: $bg-secondary;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-sm;
  margin-right: $spacing-md;
  margin-bottom: $spacing-sm;
  border: 2rpx solid transparent;

  &.selected {
    background-color: rgba($primary-color, 0.1);
    border-color: $primary-color;
    color: $primary-color;
  }

  &.disabled {
    opacity: 0.5;
    color: $text-placeholder;
  }
}

.detail-section {
  background-color: $bg-primary;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.detail-images {
  padding: $spacing-sm 0;
}

.detail-image {
  width: 100%;
  margin-bottom: $spacing-xs;
}

.params-section {
  background-color: $bg-primary;
  padding: $spacing-md;
}

.params-table {
  padding: $spacing-sm 0;
}

.param-row {
  display: flex;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.param-name {
  width: 200rpx;
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.param-value {
  flex: 1;
  font-size: $font-size-sm;
  color: $text-primary;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  background-color: $bg-primary;
  padding: $spacing-sm $spacing-md;
  padding-bottom: calc($spacing-sm + env(safe-area-inset-bottom));
  box-shadow: $shadow-md;
}

.bottom-left {
  display: flex;
  width: 200rpx;
}

.bottom-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.bottom-icon {
  font-size: $font-size-lg;
}

.bottom-label {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-top: $spacing-xs;
}

.cart-item {
  position: relative;
}

.cart-badge {
  position: absolute;
  top: -8rpx;
  right: 8rpx;
  background-color: $error-color;
  color: #fff;
  font-size: $font-size-xs;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;
  padding: 0 8rpx;
}

.bottom-right {
  flex: 1;
  display: flex;
  margin-left: $spacing-md;
}

.btn-cart {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background-color: $warning-color;
  color: #fff;
  font-size: $font-size-base;
  border-radius: $radius-sm;
  margin-right: $spacing-sm;
}

.btn-buy {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background-color: $error-color;
  color: #fff;
  font-size: $font-size-base;
  border-radius: $radius-sm;
}

.action-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.action-content {
  width: 100%;
  background-color: $bg-primary;
  border-radius: $radius-lg $radius-lg 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.action-title {
  font-size: $font-size-md;
  font-weight: bold;
  color: $text-primary;
}

.action-close {
  font-size: $font-size-xl;
  color: $text-tertiary;
}

.action-body {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-md;
}

.action-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: $radius-md;
  margin-bottom: $spacing-md;
}

.action-info {
  margin-bottom: $spacing-md;
}

.action-price {
  font-size: $font-size-xl;
  color: $error-color;
  font-weight: bold;
}

.action-stock {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-left: $spacing-md;
}

.quantity-control {
  display: flex;
  align-items: center;
  margin-top: $spacing-lg;
}

.quantity-label {
  font-size: $font-size-base;
  color: $text-primary;
  margin-right: $spacing-md;
}

.quantity-btn {
  width: 64rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  background-color: $bg-secondary;
  font-size: $font-size-lg;
  color: $text-primary;
  border-radius: $radius-sm;

  &.disabled {
    opacity: 0.5;
    color: $text-placeholder;
  }
}

.quantity-value {
  width: 100rpx;
  text-align: center;
  font-size: $font-size-lg;
  color: $text-primary;
}

.action-footer {
  display: flex;
  padding: $spacing-md;
  padding-bottom: calc($spacing-md + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
}

.btn-add-cart {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background-color: $warning-color;
  color: #fff;
  font-size: $font-size-md;
  border-radius: $radius-sm;
  margin-right: $spacing-md;
}

.btn-confirm {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background-color: $error-color;
  color: #fff;
  font-size: $font-size-md;
  border-radius: $radius-sm;
}
</style>
