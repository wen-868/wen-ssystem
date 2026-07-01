<template>
  <view class="products-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索商品名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 分类筛选 -->
    <scroll-view class="category-bar" scroll-x :show-scrollbar="false">
      <view
        class="category-item"
        :class="{ 'category-item--active': activeCategory === 0 }"
        @tap="switchCategory(0)"
      >
        <text class="category-text">全部</text>
      </view>
      <view
        class="category-item"
        v-for="cat in categories"
        :key="cat.id"
        :class="{ 'category-item--active': activeCategory === cat.id }"
        @tap="switchCategory(cat.id)"
      >
        <text class="category-text">{{ cat.name }}</text>
      </view>
    </scroll-view>

    <!-- 商品网格 -->
    <scroll-view
      class="product-scroll"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onPullDownRefresh"
      @scrolltolower="onLoadMore"
    >
      <view class="product-grid" v-if="productList.length > 0">
        <view
          class="product-card"
          v-for="product in productList"
          :key="product.id"
          @tap="goDetail(product.id)"
        >
          <view class="product-image-wrap">
            <image
              v-if="product.image"
              class="product-image"
              :src="product.image"
              mode="aspectFill"
            />
            <view v-else class="product-image-placeholder">
              <text class="placeholder-icon">&#xe630;</text>
            </view>
          </view>
          <view class="product-info">
            <text class="product-name">{{ product.name }}</text>
            <view class="product-meta">
              <text class="product-price">¥{{ product.price.toFixed(2) }}</text>
              <text class="product-stock" :class="{ 'stock-low': product.stock <= 10 }">
                库存 {{ product.stock }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-if="!loading && productList.length === 0">
        <text class="empty-icon">&#xe631;</text>
        <text class="empty-text">暂无商品数据</text>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="productList.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { productsApi, type ProductInfo, type CategoryInfo } from '@/api/modules/products'

const keyword = ref('')
const activeCategory = ref(0)
const categories = ref<CategoryInfo[]>([])
const productList = ref<ProductInfo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function switchCategory(categoryId: number) {
  activeCategory.value = categoryId
  page.value = 1
  productList.value = []
  noMore.value = false
  loadProducts()
}

function onSearch() {
  page.value = 1
  productList.value = []
  noMore.value = false
  loadProducts()
}

function clearSearch() {
  keyword.value = ''
  onSearch()
}

async function loadProducts() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await productsApi.list({
      keyword: keyword.value || undefined,
      categoryId: activeCategory.value || undefined,
      page: page.value,
      pageSize
    })
    productList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载商品失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await productsApi.categories()
  } catch (err) {
    console.error('加载分类失败:', err)
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await productsApi.list({
      keyword: keyword.value || undefined,
      categoryId: activeCategory.value || undefined,
      page: page.value,
      pageSize
    })
    if (result.list.length === 0) {
      noMore.value = true
      page.value--
    } else {
      productList.value = [...productList.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

async function onPullDownRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  try {
    const result = await productsApi.list({
      keyword: keyword.value || undefined,
      categoryId: activeCategory.value || undefined,
      page: 1,
      pageSize
    })
    productList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('刷新失败:', err)
  } finally {
    refresherTriggered.value = false
  }
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/products/product-detail?id=${id}` })
}

onMounted(() => {
  loadCategories()
  loadProducts()
})
</script>

<style scoped>
.products-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

/* 搜索栏 */
.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: #bbb;
  padding: 4rpx;
}

/* 分类筛选 */
.category-bar {
  background: #fff;
  white-space: nowrap;
  padding: 12rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.category-item {
  display: inline-flex;
  padding: 12rpx 28rpx;
  margin: 0 8rpx;
  border-radius: 32rpx;
  background: #f5f7fa;
}

.category-item--active {
  background: #1677FF;
}

.category-item--active .category-text {
  color: #fff;
  font-weight: 600;
}

.category-text {
  font-size: 26rpx;
  color: #666;
}

/* 商品网格 */
.product-scroll {
  flex: 1;
  padding: 16rpx 24rpx;
}

.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.product-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.product-image-wrap {
  width: 100%;
  height: 280rpx;
  background: #f5f7fa;
  position: relative;
}

.product-image {
  width: 100%;
  height: 100%;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e6f4ff, #f0f5ff);
}

.placeholder-icon {
  font-size: 64rpx;
  color: #bbb;
}

.product-info {
  padding: 16rpx;
}

.product-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-bottom: 12rpx;
  line-height: 1.4;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-price {
  font-size: 30rpx;
  font-weight: 700;
  color: #1677FF;
}

.product-stock {
  font-size: 22rpx;
  color: #999;
}

.stock-low {
  color: #ff4d4f;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 180rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 24rpx 0;
}

.load-more-text {
  font-size: 24rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>