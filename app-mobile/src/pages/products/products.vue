<template>
  <view class="products-page">
    <!-- 搜索栏（UI1.2：无页头，铃铛并入搜索栏，顶部承接 safe-area） -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon" src="/static/icons/sc-search.svg" mode="aspectFit" />
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索商品名/条码/品牌"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear" v-if="keyword" src="/static/icons/sc-clear.svg" mode="aspectFit" @tap="clearSearch" />
        <view class="icon-btn" @tap.stop="onScan">
          <view class="icon-btn-svg"></view>
        </view>
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
                  <text class="placeholder-letter">{{ (item.name || '')[0] }}</text>
                </view>
                <view class="offline-tag" v-if="isOfflineProduct(item)">
                  <text class="offline-tag-text">仅线下</text>
                </view>
              </view>
              <view class="product-info">
                <text class="product-name">{{ item.name }}</text>
                <text class="product-spec">{{ item.spec || '标准规格' }}</text>
                <view class="product-meta">
                  <view class="price-line">
                    <text class="price-tag price-tag--ws">批 ¥{{ (item.wholesalePrice ?? item.price ?? 0).toFixed(2) }}</text>
                    <text class="price-tag price-tag--rt">零 ¥{{ (item.retailPrice ?? item.price ?? 0).toFixed(2) }}</text>
                  </view>
                  <text class="product-stock" :class="stockClass(item.stock)">
                    库 {{ item.stock }}
                  </text>
                </view>
              </view>
            </view>
          </template>
        </virtual-list>

        <view class="empty-state" v-if="!loading && productList.length === 0">
          <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
          <text class="empty-text">暂无商品数据</text>
        </view>

        <!-- 翻页加载中反馈；"没有更多了"常驻条用户已要求去掉，列表直接止于胶囊上方 -->
        <view class="load-more" v-if="loadingMore">
          <text class="load-more-text">加载中...</text>
        </view>
      </view>
    </view>

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
const itemSize = ref(82)

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

/** 扫码查商品：扫条码 → 按条码搜索 → 进入商品详情 */
async function onScan() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    uni.showLoading({ title: '查询商品...' })
    const res = await productsApi.list({ keyword: code, page: 1, pageSize: 10 })
    uni.hideLoading()
    const rows = res?.list ?? []
    const matched =
      rows.find((p) => String(p.skuId) === code || (p.name || '').includes(code)) ?? rows[0]
    if (matched) {
      goDetail(matched.id)
    } else {
      uni.showToast({ title: '未找到该条码商品', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

/** 操作卡入口：建议核价/批量调价/价格异常均接入真实页面 */
function onAction(type: 'suggest' | 'batch' | 'anomaly') {
  if (type === 'batch') {
    // R94-01：批量调价已接入真实页面
    uni.navigateTo({ url: '/pages-sub/product/batch-price/batch-price' })
    return
  }
  if (type === 'suggest') {
    // R100：建议核价已接入真实页面（搜索商品 → 填写建议价 → 提交核价单）
    uni.navigateTo({ url: '/pages-sub/product/price-review/price-review' })
    return
  }
  // R100：价格异常已接入真实页面（售价低于成本 / 售价为 0 商品列表）
  uni.navigateTo({ url: '/pages-sub/product/price-anomaly/price-anomaly' })
}

onMounted(() => {
  // 行高 = 卡体高(max(缩略图,信息区) + 内距) + 卡间距，取 252rpx 确保卡片不重叠、间距可见
  try {
    itemSize.value = uni.upx2px(164)
  } catch (err) {
    itemSize.value = 82
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

/* 搜索栏（原稿 margin 10px 14px 0，高 42px，灰底页面浮白条） */
.search-bar {
  padding: 20rpx 28rpx 0;
  padding-top: calc(20rpx + var(--safe-top));
  background: $uni-bg-color-grey;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 84rpx;
  background: $uni-bg-color;
  border: 1rpx solid $zx-black-60;
  border-radius: 999rpx;
  padding: 0 32rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-30;
  gap: 16rpx;
}

/* 搜索栏扫码入口：热区 80rpx（原稿 icon-btn 40px） */
.icon-btn {
  width: 72rpx;
  height: 72rpx;
  margin-right: -24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.15s ease;
}

.icon-btn:active {
  transform: scale(0.88);
}

.icon-btn-img {
  width: 36rpx;
  height: 36rpx;
}

/* 扫码图标：CSS 背景方式加载 SVG（避免 H5 端 image 组件对 SVG 渲染为空） */
.icon-btn-svg {
  width: 36rpx;
  height: 36rpx;
  background-image: url('/static/icons/hd-scan.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
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
  width: 34rpx;
  height: 34rpx;
  padding: 4rpx;
  flex-shrink: 0;
}

/* ─── 商品主体：左分类 + 右列表 ─── */
.prod-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.prod-side {
  width: 152rpx;
  background: $zx-black-15;
  flex-shrink: 0;
  height: 100%;
  padding-top: $uni-spacing-base;
}

.prod-side-item {
  padding: $uni-spacing-lg $uni-spacing-sm;
  text-align: center;
  font-size: 24rpx;
  color: $uni-gray-500;
  position: relative;
  transition: all 0.25s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $uni-spacing-xs;
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
  /* 底部留白=悬浮胶囊高度+下缘偏移（124rpx+20rpx+2×safe-area），列表滚到胶囊顶即止，其下不留灰底条 */
  padding: $uni-spacing-base $uni-spacing-base calc(148rpx + 2 * env(safe-area-inset-bottom));
}

/* ─── 操作卡：建议核价 / 批量调价 / 价格异常 ─── */
.action-row {
  display: flex;
  gap: $uni-spacing-sm;
  margin-bottom: $uni-spacing-base;
}

.action-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: $uni-spacing-base $uni-spacing-sm;
  text-align: center;
  box-shadow: 0 2rpx 8rpx $zx-black-40;
  border: 1rpx solid $zx-black-30;
}

.action-card-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $ai-text-body;
}

.action-card-sub {
  display: block;
  font-size: 22rpx;
  color: $ai-text-mid;
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
  border-radius: $uni-border-radius-base;
  padding: $uni-spacing-sm;
  margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
  box-sizing: border-box;
  height: 144rpx;
}

.product-image-wrap {
  width: 112rpx;
  height: 112rpx;
  background: $uni-bg-color-grey;
  border-radius: $uni-border-radius-sm;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  margin-right: $uni-spacing-sm;
}

.offline-tag {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 12rpx;
  background: $zx-antred-900;
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
  margin-left: $uni-spacing-xs;
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
  background: $uni-bg-color-grey;
}

/* 原稿 t-letter：无图时商品名首字占位 */
.placeholder-letter {
  font-size: 32rpx;
  font-weight: 800;
  color: $uni-gray-400;
}

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
}

.product-spec {
  font-size: 20rpx;
  color: $uni-gray-500;
  margin-top: 4rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
}

.product-name {
  font-size: 24rpx;
  color: $uni-text-color;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
  letter-spacing: -0.2rpx;
}

.product-price {
  font-size: 32rpx;
  font-weight: 800;
  color: $uni-color-primary;
  letter-spacing: -0.6rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.price-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.price-tag {
  font-size: 20rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.2;
}

.price-tag--ws {
  color: $uni-color-primary;
}

.price-tag--rt {
  color: $uni-gray-400;
  text-decoration: line-through;
}

.product-stock {
  font-size: 20rpx;
  color: $uni-gray-500;
  font-family: 'SF Mono', 'Fira Code', monospace;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

/* 原稿：库存前置小圆点，低库存红色 */
.product-stock::before {
  content: '';
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: $uni-gray-400;
  flex-shrink: 0;
}

.stock-low {
  color: $ai-warning;
  font-weight: 700;
}

.stock-low::before {
  background: $uni-color-error;
}

.stock-out {
  color: $ai-danger;
  font-weight: 700;
}

.stock-out::before {
  background: $uni-color-error;
}

.stock-ok {
  color: $uni-gray-500;
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
  margin-bottom: $uni-spacing-md;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  text-align: center;
  padding: $uni-spacing-base 0;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-300;
}
</style>
