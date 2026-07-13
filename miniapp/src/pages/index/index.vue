<template>
  <view class="page-container">
    <view class="header">
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="搜索商品" placeholder-class="search-placeholder" />
      </view>
    </view>

    <view class="banner">
      <swiper class="banner-swiper" indicator-dots autoplay circular>
        <swiper-item v-for="item in banners" :key="item.id">
          <image :src="item.image" mode="aspectFill" class="banner-image" />
        </swiper-item>
      </swiper>
    </view>

    <view class="category-grid">
      <view class="category-item" v-for="cat in categories" :key="cat.id" @tap="goCategory(cat.id)">
        <image :src="cat.icon" class="category-icon" />
        <text class="category-name">{{ cat.name }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">热门推荐</text>
        <text class="section-more">查看更多 →</text>
      </view>
      <scroll-view scroll-x class="product-scroll">
        <view class="product-list">
          <view class="product-card" v-for="product in hotProducts" :key="product.id">
            <image :src="product.image" mode="aspectFill" class="product-image" />
            <text class="product-name ellipsis">{{ product.name }}</text>
            <text class="product-price">{{ formatPrice(product.price) }}</text>
            <text class="product-sales">{{ product.sales }}人购买</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">新品上市</text>
        <text class="section-more">查看更多 →</text>
      </view>
      <view class="product-grid">
        <view class="product-card" v-for="product in newProducts" :key="product.id">
          <image :src="product.image" mode="aspectFill" class="product-image" />
          <text class="product-name ellipsis-2">{{ product.name }}</text>
          <text class="product-price">{{ formatPrice(product.price) }}</text>
          <text class="product-sales">{{ product.sales }}人购买</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Taro from '@tarojs/taro'

const banners = ref([
  { id: 1, image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=wine%20promotion%20banner%20elegant%20design' },
  { id: 2, image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=liquor%20sale%20banner%20modern%20style' },
  { id: 3, image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=alcohol%20products%20banner%20premium' }
])

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

const hotProducts = ref([
  { id: 1, name: '贵州茅台 飞天53度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=maotai%20wine%20bottle%20elegant', price: 1499, sales: 2580 },
  { id: 2, name: '五粮液 普五52度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=wuliangye%20wine%20bottle%20luxury', price: 1099, sales: 1890 },
  { id: 3, name: '洋河蓝色经典 梦之蓝M6', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=yanghe%20blue%20wine%20bottle', price: 899, sales: 1230 },
  { id: 4, name: '剑南春 水晶剑52度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=jiannanchun%20wine%20bottle', price: 458, sales: 980 }
])

const newProducts = ref([
  { id: 5, name: '郎酒 红花郎十53度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=langjiu%20red%20wine%20bottle', price: 598, sales: 650 },
  { id: 6, name: '国台 龙酒53度 500ml', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=guotai%20wine%20bottle%20premium', price: 398, sales: 420 },
  { id: 7, name: '汾酒 老白汾酒53度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=fenjiu%20white%20wine%20bottle', price: 158, sales: 890 },
  { id: 8, name: '习酒 窖藏1988 53度', image: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=xijiu%20wine%20bottle', price: 798, sales: 320 }
])

const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`
}

const goCategory = (id: number) => {
  Taro.navigateTo({ url: `/pages/category/index?id=${id}` })
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.header {
  background-color: $primary-color;
  padding: $spacing-md;
  padding-top: calc($spacing-md + var(--status-bar-height));
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: $radius-lg;
  padding: $spacing-sm $spacing-md;
}

.search-icon {
  font-size: $font-size-md;
  margin-right: $spacing-sm;
}

.search-input {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.search-placeholder {
  color: $text-placeholder;
}

.banner {
  padding: $spacing-md;
}

.banner-swiper {
  height: 320rpx;
  border-radius: $radius-md;
  overflow: hidden;
}

.banner-image {
  width: 100%;
  height: 100%;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  background-color: $bg-primary;
  padding: $spacing-md;
}

.category-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md 0;
}

.category-icon {
  width: 80rpx;
  height: 80rpx;
  font-size: 48rpx;
  margin-bottom: $spacing-xs;
}

.category-name {
  font-size: $font-size-sm;
  color: $text-primary;
}

.section {
  margin-top: $spacing-md;
  background-color: $bg-primary;
  padding: $spacing-md;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: bold;
  color: $text-primary;
}

.section-more {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.product-scroll {
  white-space: nowrap;
}

.product-list {
  display: inline-flex;
}

.product-grid {
  display: flex;
  flex-wrap: wrap;
}

.product-card {
  width: calc(50% - $spacing-sm);
  margin-right: $spacing-sm;
  margin-bottom: $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-md;
  overflow: hidden;
  
  &:nth-child(2n) {
    margin-right: 0;
  }
}

.product-image {
  width: 100%;
  height: 280rpx;
}

.product-name {
  font-size: $font-size-sm;
  color: $text-primary;
  padding: 0 $spacing-sm;
  margin-top: $spacing-xs;
}

.product-price {
  font-size: $font-size-md;
  color: $error-color;
  font-weight: bold;
  padding: 0 $spacing-sm;
  margin-top: $spacing-xs;
}

.product-sales {
  font-size: $font-size-xs;
  color: $text-tertiary;
  padding: 0 $spacing-sm $spacing-sm;
  margin-top: $spacing-xs;
}
</style>
