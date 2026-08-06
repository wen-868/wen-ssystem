<template>
  <view class="products-page">
    <!-- 页头 -->
    <view class="prod-hd">
      <view class="prod-hd-left">
        <view class="prod-status-row">
          <view class="prod-status-dot"></view>
          <text class="prod-status-text">营业中</text>
        </view>
        <text class="prod-hd-title">商品</text>
        <text class="prod-count" v-if="totalCount > 0">共 {{ totalCount }} 件商品</text>
      </view>
      <view class="prod-hd-icons">
        <text class="prod-hd-icon" @tap="goNotifications">&#xe642;</text>
        <text class="prod-hd-icon" @tap="focusSearch">&#xe614;</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索商品名/条码/品牌"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 商品主体：左侧分类 + 右侧列表 -->
    <view class="prod-body">
      <scroll-view class="prod-side" scroll-y :show-scrollbar="false">
        <view
          class="prod-side-item"
          :class="{ 'prod-side-item--active': activeCategory === 0 }"
          @tap="switchCategory(0)"
        >
          <text class="prod-side-text">全部</text>
        </view>
        <view
          class="prod-side-item"
          v-for="cat in categories"
          :key="cat.id"
          :class="{ 'prod-side-item--active': activeCategory === cat.id }"
          @tap="switchCategory(cat.id)"
        >
          <text class="prod-side-text">{{ cat.name }}</text>
          <view class="category-offline-dot" v-if="cat.allowOnlineSale === 0"></view>
        </view>
      </scroll-view>

      <view class="prod-main">
        <!-- 操作行：建议核价 / 批量调价 / 价格异常（保留原入口） -->
        <view class="action-row">
          <view class="action-card" @tap="onAction('suggest')">
            <text class="action-card-title">建议核价</text>
            <text class="action-card-sub">市场价格变动</text>
          </view>
          <view class="action-card" @tap="onAction('batch')">
            <text class="action-card-title">批量调价</text>
            <text class="action-card-sub">按分类调整</text>
          </view>
          <view class="action-card action-card--danger" @tap="onAction('anomaly')">
            <text class="action-card-title action-card-title--danger">价格异常</text>
            <text class="action-card-sub action-card-sub--danger">待处理</text>
          </view>
        </view>

        <!-- 虚拟滚动商品列表 -->
        <virtual-list
          v-if="productList.length > 0"
          class="product-scroll"
          :data="productList"
          :item-size="itemSize"
          :height="0"
          :buffer="5"
          item-key="id"
          :refresher-enabled="true"
          :refresher-triggered="refresherTriggered"
          @load-more="onLoadMore"
          @refresh="onPullDownRefresh"
        >
          <template #default="{ item }">
            <view class="product-card" @tap="goDetail(item.id)">
              <view class="product-image-wrap">
                <image
                  v-if="item.image"
                  class="product-image"
                  :src="item.image"
                  mode="aspectFill"
                  lazy-load
                />
                <view v-else class="product-image-placeholder">
                  <text class="placeholder-icon">&#xe630;</text>
                </view>
                <view class="offline-tag" v-if="isOfflineProduct(item)">
                  <text class="offline-tag-text">仅线下</text>
                </view>
              </view>
              <view class="product-info">
                <text class="product-name">{{ item.name }}</text>
                <text class="product-spec">{{ item.spec || '标准规格' }}</text>
                <view class="product-meta">
                  <text class="product-price">¥{{ item.price.toFixed(2) }}</text>
                  <text class="product-stock" :class="stockClass(item.stock)">
                    库存 {{ item.stock }}
                  </text>
                </view>
              </view>
            </view>
          </template>
        </virtual-list>

        <view class="empty-state" v-if="!loading && productList.length === 0">
          <text class="empty-icon">&#xe631;</text>
          <text class="empty-text">暂无商品数据</text>
        </view>

        <view class="load-more" v-if="productList.length > 0">
          <text class="load-more-text" v-if="loadingMore">加载中...</text>
          <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
    <custom-tab-bar :current="'products'" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { productsApi, type ProductInfo, type CategoryInfo } from '@/api/modules/products'
import VirtualList from '@/components/virtual-list.vue'
import CustomTabBar from '@/components/custom-tab-bar.vue'

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
const totalCount = ref(0)

/** 单行高度（px），onMounted 时按 rpx 转 px 计算 */
const itemSize = ref(200)

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

/** 库存状态：0=缺货红 / ≤10=偏低橙 / 其余=充足绿 */
function stockClass(stock: number): string {
  if (stock <= 0) return 'stock-out'
  if (stock <= 10) return 'stock-low'
  return 'stock-ok'
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
    totalCount.value = result.total ?? productList.value.length
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载商品失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const list = await productsApi.categories()
    categories.value = list
    // 构建分类ID -> 是否允许线上销售（1=允许 0=禁止）的映射，
    // 用于给商品打"仅线下"标识（后端商品列表当前未返回 allowOnlineSale 字段时兜底）
    offlineCategoryMap.value = new Map(
      list.map((c) => [c.id, c.allowOnlineSale ?? 1])
    )
  } catch (err) {
    console.error('加载分类失败:', err)
  }
}

// 分类ID -> allowOnlineSale 的映射
const offlineCategoryMap = ref<Map<number, number>>(new Map())

// 判断商品是否禁止线上销售：优先取商品自带字段，兜底用其所属分类的配置
function isOfflineProduct(product: ProductInfo): boolean {
  if (product.allowOnlineSale === 0) return true
  if (product.categoryId != null) {
    return offlineCategoryMap.value.get(product.categoryId) === 0
  }
  return false
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

function goNotifications() {
  uni.navigateTo({ url: '/pages/notifications/notifications' })
}

function focusSearch() {
  // 聚焦搜索输入框
  const query = uni.createSelectorQuery()
  query.select('.search-input').node((node: any) => {
    if (node && node.focus) node.focus()
  }).exec()
}

/** 操作卡入口：对应功能尚未开发，提示占位（不编造数据） */
function onAction(type: 'suggest' | 'batch' | 'anomaly') {
  if (type === 'batch') {
    // R94-01：批量调价已接入真实页面
    uni.navigateTo({ url: '/pages-sub/product/batch-price/batch-price' })
    return
  }
  const titles: Record<string, string> = {
    suggest: '建议核价',
    anomaly: '价格异常'
  }
  // R94-01 评估：建议核价 / 价格异常后端无对应接口（已核实），如实保留开发中提示，不编造
  uni.showToast({ title: `${titles[type]}功能开发中`, icon: 'none' })
}

onMounted(() => {
  // 200rpx 转 px（依赖屏幕宽度）
  try {
    itemSize.value = uni.upx2px(200)
  } catch (err) {
    itemSize.value = 100
  }
  loadCategories()
  loadProducts()
})
</script>

<style lang="scss" scoped>
.products-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* 页头 */
.prod-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx 8rpx;
  padding-top: calc(20rpx + env(safe-area-inset-top));
}

.prod-hd-left {
  flex: 1;
}

.prod-status-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.prod-status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $uni-color-success;
  animation: pulse-dot 2s infinite;
}

.prod-status-text {
  font-size: 20rpx;
  color: $uni-color-success;
  font-weight: 600;
}

.prod-hd-title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: $uni-text-color;
  margin-top: 4rpx;
  letter-spacing: -0.5rpx;
}

.prod-count {
  font-size: 20rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
  display: block;
}

.prod-hd-icons {
  display: flex;
  gap: 8rpx;
}

.prod-hd-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: $uni-gray-600;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

/* ─── 商品主体：左分类 + 右列表 ─── */
.prod-body {
  flex: 1;
  display: flex;
  min-height: 0;
  margin-top: 16rpx;
}

.prod-side {
  width: 160rpx;
  background: rgba(0, 0, 0, 0.015);
  flex-shrink: 0;
  height: 100%;
}

.prod-side-item {
  padding: 28rpx 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: $uni-gray-500;
  position: relative;
  transition: all 0.25s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.prod-side-item--active {
  background: $uni-bg-color;
  color: $uni-color-primary;
  font-weight: 700;
}

.prod-side-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 40rpx;
  background: $uni-color-primary;
  border-radius: 0 6rpx 6rpx 0;
}

.prod-side-text {
  font-size: 24rpx;
}

.prod-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 20rpx;
}

/* ─── 操作卡：建议核价 / 批量调价 / 价格异常 ─── */
.action-row {
  display: flex;
  gap: 16rpx;
  padding: 4rpx 0 16rpx;
  background: $uni-bg-color-grey;
}

.action-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 18rpx 8rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.action-card-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $ai-text-body;
}

.action-card-sub {
  display: block;
  font-size: 20rpx;
  color: $ai-text-sub;
  margin-top: 6rpx;
}

.action-card--danger {
  background: $ai-danger-bg;
}

.action-card-title--danger {
  color: $ai-danger;
}

.action-card-sub--danger {
  color: $ai-warning;
}

.product-scroll {
  flex: 1;
  min-height: 0;
}

/* 单行商品卡片（横向布局） */
.product-card {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  border-radius: 24rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  box-sizing: border-box;
  height: 100%;
}

.product-image-wrap {
  width: 140rpx;
  height: 140rpx;
  background: $uni-bg-color-page;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.offline-tag {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 12rpx;
  background: rgba(255, 77, 79, 0.9);
  border-radius: 6rpx;
}

.offline-tag-text {
  font-size: 20rpx;
  color: $uni-text-color-inverse;
  font-weight: 500;
}

.category-offline-dot {
  display: inline-block;
  width: 12rpx;
  height: 12rpx;
  background: $uni-color-error;
  border-radius: 50%;
  margin-left: 8rpx;
  vertical-align: middle;
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
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
}

.placeholder-icon {
  font-size: 64rpx;
  color: $uni-gray-300;
}

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8rpx;
}

.product-name {
  font-size: 28rpx;
  color: $uni-text-color;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.product-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4rpx;
}

.product-price {
  font-size: 30rpx;
  font-weight: 800;
  color: $uni-color-primary;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.product-stock {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.stock-low {
  color: $ai-warning;
}

.stock-out {
  color: $ai-danger;
}

.stock-ok {
  color: $ai-success;
}

/* 门店状态条 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 180rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  text-align: center;
  padding: 24rpx 0;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: calc(108rpx + env(safe-area-inset-bottom));
}
</style>
