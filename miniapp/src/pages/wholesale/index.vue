<template>
  <view class="wholesale-home">
    <!-- 顶部搜索栏 -->
    <view class="search-header">
      <view class="search-box" @tap="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索批发商品</text>
      </view>
      <view class="cart-entry" @tap="goCart">
        <text class="cart-icon">🛒</text>
        <view class="cart-badge" v-if="cartCount > 0">{{ cartCount > 99 ? '99+' : cartCount }}</view>
      </view>
    </view>

    <!-- 批发专区Banner -->
    <view class="banner-section">
      <swiper
        class="banner-swiper"
        :indicator-dots="true"
        :autoplay="true"
        :interval="3000"
        :circular="true"
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#ffffff"
      >
        <swiper-item v-for="banner in bannerList" :key="banner.id">
          <view class="banner-item" :style="{ background: banner.bgColor }">
            <view class="banner-content">
              <text class="banner-title">{{ banner.title }}</text>
              <text class="banner-subtitle">{{ banner.subtitle }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- 批发分类导航（横向滚动） -->
    <view class="category-section">
      <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
        <view class="category-list">
          <view
            class="category-item"
            :class="{ active: currentCategoryId === 0 }"
            @tap="switchCategory(0)"
          >
            <view class="category-icon all-icon">
              <text>📦</text>
            </view>
            <text class="category-name">全部</text>
          </view>
          <view
            class="category-item"
            v-for="cat in categoryList"
            :key="cat.id"
            :class="{ active: currentCategoryId === cat.id }"
            @tap="switchCategory(cat.id)"
          >
            <view class="category-icon" v-if="cat.icon">
              <image :src="cat.icon" mode="aspectFit" class="icon-img" />
            </view>
            <view class="category-icon" v-else>
              <text>{{ cat.name.charAt(0) }}</text>
            </view>
            <text class="category-name">{{ cat.name }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-entry">
      <view class="entry-item" @tap="goOrderList('ALL')">
        <text class="entry-icon">📋</text>
        <text class="entry-text">批发订单</text>
      </view>
      <view class="entry-item" @tap="goOrderList('PENDING_PAY')">
        <text class="entry-icon">💰</text>
        <text class="entry-text">待付款</text>
      </view>
      <view class="entry-item" @tap="goOrderList('PENDING_SHIP')">
        <text class="entry-icon">📦</text>
        <text class="entry-text">待发货</text>
      </view>
      <view class="entry-item" @tap="goOrderList('PENDING_RECEIVE')">
        <text class="entry-icon">🚚</text>
        <text class="entry-text">待收货</text>
      </view>
    </view>

    <!-- 批发商品列表 -->
    <view class="product-section">
      <view class="section-header">
        <text class="section-title">批发商品</text>
        <view class="sort-tabs">
          <view
            class="sort-item"
            :class="{ active: sortBy === 'default' }"
            @tap="changeSort('default')"
          >
            综合
          </view>
          <view
            class="sort-item"
            :class="{ active: sortBy === 'sales' }"
            @tap="changeSort('sales')"
          >
            销量
          </view>
          <view
            class="sort-item"
            :class="{ active: sortBy === 'price' }"
            @tap="changeSort('price')"
          >
            价格
            <text class="sort-arrow">{{ sortOrder === 'asc' ? '↑' : '↓' }}</text>
          </view>
        </view>
      </view>

      <scroll-view
        scroll-y
        class="product-list-wrap"
        @scrolltolower="loadMore"
        refresher-enabled
        :refresher-triggered="isRefreshing"
        @refresherrefresh="onRefresh"
      >
        <view class="product-grid">
          <view
            class="product-card"
            v-for="item in productList"
            :key="item.id"
            @tap="goProductDetail(item.id)"
          >
            <image :src="item.image" mode="aspectFill" class="product-image" />
            <view class="product-info">
              <text class="product-name ellipsis-2">{{ item.name }}</text>
              <view class="product-tags">
                <text class="tag wholesale-tag">批发</text>
                <text class="tag unit-tag">{{ item.unit }}</text>
              </view>
              <view class="product-price-row">
                <view class="price-box">
                  <text class="price-symbol">¥</text>
                  <text class="price-value">{{ item.wholesalePrice.toFixed(2) }}</text>
                </view>
                <text class="min-order">{{ item.minOrderQty }}{{ item.unit }}起订</text>
              </view>
              <view class="product-bottom">
                <text class="sales-text">已售{{ item.sales }}{{ item.unit }}</text>
                <view class="add-cart-btn" @tap.stop="quickAddCart(item)">
                  <text class="add-icon">+</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view class="empty-state" v-if="productList.length === 0 && !loading">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无批发商品</text>
        </view>

        <!-- 加载更多 -->
        <view class="load-more" v-if="loading && productList.length > 0">
          <text class="loading-text">加载中...</text>
        </view>
        <view class="no-more" v-if="!hasMore && productList.length > 0">
          <text class="no-more-text">没有更多了</text>
        </view>
        <view class="list-bottom" v-if="productList.length > 0"></view>
      </scroll-view>
    </view>

    <!-- 搜索弹窗 -->
    <view class="search-modal" v-if="showSearch" @tap="closeSearch">
      <view class="search-modal-content" @tap.stop>
        <view class="search-header-bar">
          <view class="search-input-box">
            <text class="search-icon">🔍</text>
            <input
              class="search-input"
              type="text"
              v-model="searchKeyword"
              placeholder="搜索批发商品"
              confirm-type="search"
              @confirm="handleSearch"
              focus
            />
            <text class="clear-icon" v-if="searchKeyword" @tap="clearSearch">✕</text>
          </view>
          <text class="cancel-btn" @tap="closeSearch">取消</text>
        </view>
        <view class="search-history" v-if="searchHistory.length > 0">
          <view class="history-header">
            <text class="history-title">搜索历史</text>
            <text class="clear-history" @tap="clearHistory">清空</text>
          </view>
          <view class="history-tags">
            <view
              class="history-tag"
              v-for="(kw, idx) in searchHistory"
              :key="idx"
              @tap="searchByKeyword(kw)"
            >
              {{ kw }}
            </view>
          </view>
        </view>
        <view class="hot-search">
          <view class="history-header">
            <text class="history-title">热门搜索</text>
          </view>
          <view class="history-tags">
            <view
              class="hot-tag"
              v-for="(item, idx) in hotSearchList"
              :key="idx"
              @tap="searchByKeyword(item.keyword)"
            >
              <text class="hot-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</text>
              <text class="hot-keyword">{{ item.keyword }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Taro from '@tarojs/taro'
import {
  wholesaleApi,
  type WholesaleCategory,
  type WholesaleProductItem
} from '@/api/wholesale'

// Banner数据（模拟）
const bannerList = ref([
  { id: 1, title: '批发专区', subtitle: '批量采购 价格更优', bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 2, title: '新客专享', subtitle: '首单立减50元', bgColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 3, title: '热销爆款', subtitle: '掌柜推荐 品质保证', bgColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
])

// 分类
const categoryList = ref<WholesaleCategory[]>([])
const currentCategoryId = ref<number>(0)

// 商品列表
const productList = ref<WholesaleProductItem[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const isRefreshing = ref(false)

// 排序
const sortBy = ref('default')
const sortOrder = ref<'asc' | 'desc'>('desc')

// 购物车数量
const cartCount = ref(0)

// 搜索
const showSearch = ref(false)
const searchKeyword = ref('')
const searchHistory = ref<string[]>([])
const hotSearchList = ref([
  { keyword: '白酒' },
  { keyword: '红酒' },
  { keyword: '啤酒' },
  { keyword: '洋酒' },
  { keyword: '饮料' },
  { keyword: '整箱批发' }
])

const hasMore = computed(() => productList.value.length < total.value)

// 加载分类
const loadCategories = async () => {
  try {
    const data = await wholesaleApi.getCategories()
    categoryList.value = data
  } catch (error) {
    console.error('加载批发分类失败:', error)
    // 模拟数据
    categoryList.value = [
      { id: 1, name: '白酒', sortOrder: 1 },
      { id: 2, name: '红酒', sortOrder: 2 },
      { id: 3, name: '啤酒', sortOrder: 3 },
      { id: 4, name: '洋酒', sortOrder: 4 },
      { id: 5, name: '饮料', sortOrder: 5 },
      { id: 6, name: '茶叶', sortOrder: 6 },
      { id: 7, name: '零食', sortOrder: 7 },
      { id: 8, name: '日用品', sortOrder: 8 }
    ]
  }
}

// 加载商品列表
const loadProducts = async (isRefresh = false) => {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    productList.value = []
  }

  loading.value = true

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    }

    if (currentCategoryId.value > 0) {
      params.categoryId = currentCategoryId.value
    }

    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }

    if (sortBy.value !== 'default') {
      params.sortBy = sortBy.value
      params.sortOrder = sortOrder.value
    }

    const result = await wholesaleApi.getProductList(params as any)

    if (isRefresh) {
      productList.value = result.list
    } else {
      productList.value = [...productList.value, ...result.list]
    }
    total.value = result.total
  } catch (error) {
    console.error('加载批发商品列表失败:', error)
    // 模拟数据
    if (isRefresh) {
      productList.value = generateMockProducts(page.value, pageSize.value)
      total.value = 50
    } else {
      productList.value = [...productList.value, ...generateMockProducts(page.value, pageSize.value)]
      total.value = 50
    }
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

// 生成模拟数据
const generateMockProducts = (pageNum: number, size: number): WholesaleProductItem[] => {
  const mockProducts: WholesaleProductItem[] = []
  const categories = ['白酒', '红酒', '啤酒', '洋酒']
  const names = [
    '茅台飞天53度500ml',
    '五粮液52度500ml',
    '拉菲古堡红葡萄酒750ml',
    '青岛啤酒经典500ml*24罐',
    '百威啤酒330ml*24瓶',
    '轩尼诗XO干邑白兰地700ml',
    '人头马VSOP700ml',
    '古井贡酒年份原浆500ml',
    '剑南春52度500ml',
    '洋河蓝色经典52度500ml'
  ]

  for (let i = 0; i < size; i++) {
    const idx = (pageNum - 1) * size + i
    if (idx >= 50) break
    const nameIdx = idx % names.length
    const catIdx = idx % categories.length
    mockProducts.push({
      id: idx + 1,
      name: names[nameIdx],
      image: 'https://via.placeholder.com/300x300/f5f5f5/999?text=Product',
      wholesalePrice: Math.floor(Math.random() * 500) + 50,
      minOrderQty: Math.floor(Math.random() * 5) + 1,
      sales: Math.floor(Math.random() * 1000) + 100,
      categoryId: catIdx + 1,
      categoryName: categories[catIdx],
      unit: ['箱', '瓶', '件'][idx % 3]
    })
  }

  return mockProducts
}

// 切换分类
const switchCategory = (catId: number) => {
  currentCategoryId.value = catId
  loadProducts(true)
}

// 排序切换
const changeSort = (sort: string) => {
  if (sort === 'price') {
    if (sortBy.value === 'price') {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = 'price'
      sortOrder.value = 'asc'
    }
  } else {
    sortBy.value = sort
  }
  loadProducts(true)
}

// 下拉刷新
const onRefresh = () => {
  isRefreshing.value = true
  loadProducts(true)
}

// 加载更多
const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadProducts()
}

// 跳转商品详情
const goProductDetail = (id: number) => {
  Taro.navigateTo({ url: `/pages/wholesale/product/index?id=${id}` })
}

// 跳转购物车
const goCart = () => {
  Taro.navigateTo({ url: '/pages/wholesale/cart/index' })
}

// 跳转订单列表
const goOrderList = (status: string) => {
  Taro.navigateTo({ url: `/pages/wholesale/order-list/index?status=${status}` })
}

// 快速加入购物车
const quickAddCart = (item: WholesaleProductItem) => {
  Taro.showToast({ title: '请进入详情选择规格', icon: 'none' })
}

// 搜索相关
const goSearch = () => {
  showSearch.value = true
}

const closeSearch = () => {
  showSearch.value = false
}

const clearSearch = () => {
  searchKeyword.value = ''
}

const handleSearch = () => {
  if (!searchKeyword.value.trim()) return

  // 保存搜索历史
  const history = searchHistory.value.filter(k => k !== searchKeyword.value)
  history.unshift(searchKeyword.value)
  searchHistory.value = history.slice(0, 10)
  Taro.setStorageSync('wholesale_search_history', searchHistory.value)

  showSearch.value = false
  loadProducts(true)
}

const searchByKeyword = (kw: string) => {
  searchKeyword.value = kw
  handleSearch()
}

const clearHistory = () => {
  Taro.showModal({
    title: '提示',
    content: '确定清空搜索历史？',
    success: (res) => {
      if (res.confirm) {
        searchHistory.value = []
        Taro.removeStorageSync('wholesale_search_history')
      }
    }
  })
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
  // 读取搜索历史
  const history = Taro.getStorageSync('wholesale_search_history')
  if (history) {
    searchHistory.value = history
  }

  loadCategories()
  loadProducts(true)
})
</script>

<style lang="scss" scoped>
.wholesale-home {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

// 搜索头部
.search-header {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background-color: $bg-primary;
  gap: $spacing-sm;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-lg;
}

.search-icon {
  font-size: 28rpx;
  margin-right: $spacing-sm;
}

.search-placeholder {
  font-size: $font-size-sm;
  color: $text-placeholder;
  flex: 1;
}

.cart-entry {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-icon {
  font-size: 40rpx;
}

.cart-badge {
  position: absolute;
  top: 0;
  right: 0;
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

// Banner
.banner-section {
  padding: $spacing-md;
}

.banner-swiper {
  height: 200rpx;
  border-radius: $radius-lg;
  overflow: hidden;
}

.banner-item {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 $spacing-xl;
}

.banner-content {
  display: flex;
  flex-direction: column;
}

.banner-title {
  font-size: $font-size-xl;
  font-weight: bold;
  color: #fff;
  margin-bottom: $spacing-xs;
}

.banner-subtitle {
  font-size: $font-size-sm;
  color: rgba(255, 255, 255, 0.8);
}

// 分类导航
.category-section {
  background-color: $bg-primary;
  padding: $spacing-md 0;
}

.category-scroll {
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
  padding: 0 $spacing-sm;
  gap: $spacing-sm;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120rpx;
  padding: $spacing-sm;
  border-radius: $radius-md;
  transition: all 0.3s;

  &.active {
    .category-icon {
      background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
      color: #fff;
    }

    .category-name {
      color: $primary-color;
      font-weight: bold;
    }
  }
}

.category-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: $bg-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-bottom: $spacing-xs;

  &.all-icon {
    font-size: 36rpx;
  }
}

.icon-img {
  width: 60rpx;
  height: 60rpx;
}

.category-name {
  font-size: $font-size-sm;
  color: $text-secondary;
}

// 快捷入口
.quick-entry {
  display: flex;
  justify-content: space-around;
  background-color: $bg-primary;
  padding: $spacing-md 0;
  margin-top: $spacing-sm;
}

.entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.entry-icon {
  font-size: 40rpx;
  margin-bottom: $spacing-xs;
}

.entry-text {
  font-size: $font-size-xs;
  color: $text-secondary;
}

// 商品列表
.product-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: $spacing-sm;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background-color: $bg-primary;
}

.section-title {
  font-size: $font-size-md;
  font-weight: bold;
  color: $text-primary;
}

.sort-tabs {
  display: flex;
  gap: $spacing-lg;
}

.sort-item {
  font-size: $font-size-sm;
  color: $text-secondary;
  display: flex;
  align-items: center;

  &.active {
    color: $primary-color;
    font-weight: bold;
  }
}

.sort-arrow {
  font-size: $font-size-xs;
  margin-left: 4rpx;
}

.product-list-wrap {
  flex: 1;
  padding: $spacing-sm;
}

.product-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.product-card {
  width: calc(50% - 8rpx);
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 340rpx;
}

.product-info {
  padding: $spacing-sm;
}

.product-name {
  font-size: $font-size-sm;
  color: $text-primary;
  line-height: 1.4;
  height: 70rpx;
  margin-bottom: $spacing-xs;
}

.product-tags {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;
}

.tag {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.wholesale-tag {
  background-color: rgba(64, 128, 255, 0.1);
  color: $primary-color;
}

.unit-tag {
  background-color: $bg-secondary;
  color: $text-tertiary;
}

.product-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: $spacing-xs;
}

.price-box {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: $font-size-sm;
  color: $error-color;
}

.price-value {
  font-size: $font-size-lg;
  font-weight: bold;
  color: $error-color;
}

.min-order {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.product-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sales-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.add-cart-btn {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-icon {
  color: #fff;
  font-size: $font-size-lg;
  line-height: 1;
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-lg;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-tertiary;
}

// 加载更多
.load-more,
.no-more {
  text-align: center;
  padding: $spacing-lg;
}

.loading-text,
.no-more-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.list-bottom {
  height: $spacing-lg;
}

// 搜索弹窗
.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.search-modal-content {
  background-color: $bg-primary;
  min-height: 60vh;
}

.search-header-bar {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  gap: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.search-input-box {
  flex: 1;
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-lg;
}

.search-input {
  flex: 1;
  font-size: $font-size-sm;
  color: $text-primary;
}

.clear-icon {
  font-size: $font-size-sm;
  color: $text-tertiary;
  padding: $spacing-xs;
}

.cancel-btn {
  font-size: $font-size-base;
  color: $text-secondary;
}

.search-history,
.hot-search {
  padding: $spacing-md;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.history-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.clear-history {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.history-tag {
  padding: $spacing-sm $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-lg;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.hot-tag {
  width: 100%;
  display: flex;
  align-items: center;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $border-color;
}

.hot-rank {
  width: 40rpx;
  font-size: $font-size-sm;
  font-weight: bold;
  color: $text-tertiary;
  text-align: center;

  &.top {
    color: $error-color;
  }
}

.hot-keyword {
  font-size: $font-size-sm;
  color: $text-primary;
}

// 工具类
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
