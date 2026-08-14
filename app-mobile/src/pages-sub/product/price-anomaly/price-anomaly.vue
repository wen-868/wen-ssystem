<template>
  <view class="anomaly-page">
    <view class="page-header">
      <text class="header-title">价格异常</text>
    </view>

    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索商品名称 / 条码"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <view class="type-tabs">
      <view
        v-for="tab in typeTabs"
        :key="tab.value"
        class="type-tab"
        :class="{ 'type-tab--active': activeType === tab.value }"
        @tap="switchType(tab.value)"
      >
        <text class="type-tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <scroll-view class="anomaly-list" scroll-y @scrolltolower="onLoadMore">
      <view class="anomaly-card" v-for="item in list" :key="item.skuId">
        <view class="card-header">
          <view class="header-left">
            <text class="product-name">{{ item.productName }}</text>
            <text class="anomaly-type" :class="item.anomalyType === 'BELOW_COST' ? 'type-below' : 'type-zero'">
              {{ item.anomalyTypeLabel }}
            </text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row" v-if="item.skuName && item.skuName !== item.productName">
            <text class="info-label">SKU</text>
            <text class="info-value">{{ item.skuName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">规格</text>
            <text class="info-value">{{ item.spec || '—' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">条码</text>
            <text class="info-value">{{ item.barcode || '—' }}</text>
          </view>
          <view class="price-row">
            <view class="price-cell">
              <text class="price-label">成本价</text>
              <text class="price-value">¥{{ item.costPrice.toFixed(2) }}</text>
            </view>
            <view class="price-cell">
              <text class="price-label">零售价</text>
              <text class="price-value" :class="{ 'price-danger': item.retailPrice < item.costPrice }">
                ¥{{ item.retailPrice.toFixed(2) }}
              </text>
            </view>
            <view class="price-cell">
              <text class="price-label">门店价</text>
              <text class="price-value">¥{{ item.storePrice.toFixed(2) }}</text>
            </view>
            <view class="price-cell">
              <text class="price-label">小程序价</text>
              <text class="price-value">¥{{ item.miniappPrice.toFixed(2) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="list.length > 0 && loadingMore">
        <text class="load-more-text">加载中...</text>
      </view>
      <view class="load-more" v-else-if="list.length > 0 && noMore">
        <text class="load-more-text">已加载全部</text>
      </view>
    </scroll-view>

    <view class="empty-state" v-if="!loading && list.length === 0">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无价格异常商品</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { priceApi } from '@/api/modules/price'

const typeTabs = [
  { label: '全部', value: '' },
  { label: '低于成本', value: 'BELOW_COST' },
  { label: '售价为0', value: 'ZERO_PRICE' },
]

const keyword = ref('')
const activeType = ref('')
const list = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const pageSize = 20

function onSearch() {
  page.value = 1
  list.value = []
  loadAnomalies()
}

function clearSearch() {
  keyword.value = ''
  onSearch()
}

function switchType(val: string) {
  activeType.value = val
  onSearch()
}

async function loadAnomalies() {
  if (loading.value || loadingMore.value) return
  loading.value = true
  try {
    const result = await priceApi.listAnomalies({
      keyword: keyword.value || undefined,
      anomalyType: activeType.value || undefined,
      page: page.value,
      pageSize,
    })
    const rows = result?.records ?? []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value = [...list.value, ...rows]
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载价格异常失败:', err)
    if (page.value === 1) list.value = []
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function onLoadMore() {
  if (loading.value || loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value += 1
  loadAnomalies()
}

onMounted(() => {
  loadAnomalies()
})
</script>

<style lang="scss" scoped>
.anomaly-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
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
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.type-tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 0 24rpx 16rpx;
  gap: 12rpx;
}
.type-tab {
  padding: 10rpx 28rpx;
  border-radius: 28rpx;
  background: $uni-bg-color-page;
}
.type-tab--active { background: $uni-color-primary; }
.type-tab--active .type-tab-text { color: $uni-text-color-inverse; }
.type-tab-text { font-size: 24rpx; color: $uni-gray-500; }
.anomaly-list { padding: 16rpx 24rpx; height: calc(100vh - 340rpx); }
.anomaly-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.header-left { display: flex; align-items: center; gap: 12rpx; flex: 1; }
.product-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; flex: 1; }
.anomaly-type { padding: 4rpx 14rpx; border-radius: 8rpx; font-size: 22rpx; flex-shrink: 0; }
.type-below { background: $uni-color-error-soft; color: $uni-color-error; }
.type-zero { background: $uni-color-warning-soft; color: $uni-color-warning; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 24rpx; color: $uni-gray-600; }
.price-row {
  display: flex;
  margin-top: 12rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}
.price-cell { flex: 1; display: flex; flex-direction: column; gap: 6rpx; align-items: center; }
.price-label { font-size: 22rpx; color: $uni-gray-400; }
.price-value { font-size: 26rpx; font-weight: 600; color: $uni-gray-700; }
.price-danger { color: $uni-color-error; }
.load-more { padding: 20rpx 0; text-align: center; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-200; margin-bottom: 16rpx; }
.empty-text { font-size: 26rpx; color: $uni-gray-400; }
</style>
