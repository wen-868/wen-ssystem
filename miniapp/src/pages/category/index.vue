<template>
  <view class="page-container">
    <view class="category-sidebar">
      <scroll-view scroll-y class="sidebar-scroll">
        <view 
          class="sidebar-item" 
          :class="{ active: activeCategory === cat.id }"
          v-for="cat in categories" 
          :key="cat.id"
          @tap="selectCategory(cat.id)"
        >
          <text class="sidebar-icon">{{ cat.icon }}</text>
          <text class="sidebar-name">{{ cat.name }}</text>
          <view class="sidebar-active-indicator" v-if="activeCategory === cat.id"></view>
        </view>
      </scroll-view>
    </view>

    <view class="category-content">
      <view class="content-header">
        <text class="content-title">{{ currentCategoryName }}</text>
      </view>
      
      <scroll-view scroll-y class="content-scroll">
        <view class="product-grid">
          <view class="product-card" v-for="product in currentProducts" :key="product.id">
            <image :src="product.image" mode="aspectFill" class="product-image" />
            <text class="product-name ellipsis-2">{{ product.name }}</text>
            <text class="product-price">{{ formatPrice(product.price) }}</text>
            <view class="product-action">
              <text class="add-cart" @tap="addToCart(product)">加入购物车</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCartStore } from '@/stores/cart'
import Taro from '@tarojs/taro'

const cartStore = useCartStore()

const categories = ref([
  { id: 1, name: '白酒', icon: '🍶' },
  { id: 2, name: '红酒', icon: '🍷' },
  { id: 3, name: '啤酒', icon: '🍺' },
  { id: 4, name: '洋酒', icon: '🥃' },
  { id: 5, name: '黄酒', icon: '🍾' },
  { id: 6, name: '保健酒', icon: '🧪' },
  { id: 7, name: '饮料', icon: '🥤' },
  { id: 8, name: '零食', icon: '🍫' }
])

const activeCategory = ref(1)

const allProducts = ref({
  1: [
    { id: 1, name: '贵州茅台 飞天53度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=maotai%20wine%20bottle', price: 1499 },
    { id: 2, name: '五粮液 普五52度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=wuliangye%20wine%20bottle', price: 1099 },
    { id: 3, name: '洋河蓝色经典 梦之蓝M6', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=yanghe%20blue%20wine', price: 899 },
    { id: 4, name: '剑南春 水晶剑52度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=jiannanchun%20wine', price: 458 },
    { id: 5, name: '郎酒 红花郎十53度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=langjiu%20red%20wine', price: 598 },
    { id: 6, name: '汾酒 老白汾酒53度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=fenjiu%20white%20wine', price: 158 }
  ],
  2: [
    { id: 7, name: '奔富 Bin 407 红葡萄酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=penfolds%20wine%20bottle', price: 698 },
    { id: 8, name: '拉菲 传奇波尔多红酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=chateau%20latour%20wine', price: 298 },
    { id: 9, name: '长城 华夏葡园红酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=great%20wall%20wine', price: 128 }
  ],
  3: [
    { id: 10, name: '雪花啤酒 勇闯天涯', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=snow%20beer%20bottle', price: 58 },
    { id: 11, name: '青岛啤酒 经典1903', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=tsingtao%20beer', price: 68 },
    { id: 12, name: '百威啤酒 经典', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=budweiser%20beer', price: 78 }
  ],
  4: [
    { id: 13, name: '人头马 VSOP', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=remy%20martin%20cognac', price: 458 },
    { id: 14, name: '轩尼诗 VSOP', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=hennessy%20cognac', price: 498 },
    { id: 15, name: '芝华士 12年威士忌', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=chivas%20whiskey', price: 358 }
  ],
  5: [
    { id: 16, name: '绍兴黄酒 花雕酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=shaoxing%20yellow%20wine', price: 88 },
    { id: 17, name: '古越龙山 黄酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=guyue%20longshan%20wine', price: 68 }
  ],
  6: [
    { id: 18, name: '劲酒 35度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=jin%20jiu%20health%20wine', price: 38 },
    { id: 19, name: '椰岛鹿龟酒', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=coconut%20island%20wine', price: 58 }
  ],
  7: [
    { id: 20, name: '农夫山泉 550ml*24', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=nongfu%20spring%20water', price: 28 },
    { id: 21, name: '可口可乐 330ml*24', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=coca%20cola%20cans', price: 58 }
  ],
  8: [
    { id: 22, name: '乐事薯片 原味', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=lays%20potato%20chips', price: 12 },
    { id: 23, name: '德芙巧克力', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=cadbury%20chocolate', price: 28 }
  ]
})

const currentCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === activeCategory.value)
  return cat ? cat.name : ''
})

const currentProducts = computed(() => {
  return allProducts.value[activeCategory.value] || []
})

const selectCategory = (id: number) => {
  activeCategory.value = id
}

const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`
}

const addToCart = (product: { id: number; name: string; image: string; price: number }) => {
  cartStore.addItem({
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    price: product.price,
    quantity: 1
  })
  Taro.showToast({ title: '已加入购物车', icon: 'success' })
}
</script>

<style lang="scss" scoped>
.page-container {
  display: flex;
  min-height: 100vh;
  background-color: $bg-secondary;
}

.category-sidebar {
  width: 180rpx;
  background-color: $bg-tertiary;
  flex-shrink: 0;
}

.sidebar-scroll {
  height: 100vh;
}

.sidebar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg $spacing-sm;
  position: relative;
  background-color: $bg-tertiary;
  transition: background-color 0.2s;
  
  &.active {
    background-color: $bg-primary;
    
    .sidebar-name {
      color: $primary-color;
      font-weight: bold;
    }
  }
}

.sidebar-icon {
  font-size: 40rpx;
  margin-bottom: $spacing-xs;
}

.sidebar-name {
  font-size: $font-size-sm;
  color: $text-secondary;
  text-align: center;
}

.sidebar-active-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 40rpx;
  background-color: $primary-color;
  border-radius: 0 6rpx 6rpx 0;
}

.category-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: $spacing-md;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $border-color;
}

.content-title {
  font-size: $font-size-lg;
  font-weight: bold;
  color: $text-primary;
}

.content-scroll {
  flex: 1;
  padding: $spacing-md;
}

.product-grid {
  display: flex;
  flex-wrap: wrap;
}

.product-card {
  width: calc(50% - $spacing-sm);
  margin-right: $spacing-sm;
  margin-bottom: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
  
  &:nth-child(2n) {
    margin-right: 0;
  }
}

.product-image {
  width: 100%;
  height: 260rpx;
}

.product-name {
  font-size: $font-size-sm;
  color: $text-primary;
  padding: $spacing-xs $spacing-sm;
}

.product-price {
  font-size: $font-size-md;
  color: $error-color;
  font-weight: bold;
  padding: $spacing-xs $spacing-sm;
}

.product-action {
  padding: $spacing-sm;
}

.add-cart {
  display: block;
  text-align: center;
  background-color: $primary-color;
  color: #fff;
  font-size: $font-size-sm;
  padding: $spacing-sm;
  border-radius: $radius-sm;
}
</style>
