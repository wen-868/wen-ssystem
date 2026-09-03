<template>
  <view class="batch-page">
    <page-header title="批次管理" @back="goBack" />
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索批次号 / 商品名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <scroll-view class="batch-list" scroll-y v-if="list.length > 0">
      <view class="batch-card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <view class="card-header">
          <view class="batch-no-wrap">
            <text class="batch-no-label">批次号</text>
            <text class="batch-no">{{ item.batchNo }}</text>
          </view>
          <view class="status-tag" :class="'status-' + item.status">
            <text>{{ item.statusText }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="product-info">
            <view class="product-image-wrap">
              <image v-if="item.productImage" class="product-image" :src="item.productImage" mode="aspectFill" />
              <view v-else class="product-image-placeholder">
                <image class="placeholder-icon ic" src="/static/icons/ic/image.svg" mode="aspectFit"/>
              </view>
            </view>
            <view class="product-detail">
              <text class="product-name">{{ item.productName }}</text>
              <text class="product-sku">{{ item.skuId }}</text>
            </view>
          </view>
          <view class="batch-info">
            <view class="info-row">
              <text class="info-label">数量</text>
              <text class="info-value">{{ item.quantity }} {{ item.unit }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">生产日期</text>
              <text class="info-value">{{ item.productionDate }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">有效期至</text>
              <text class="info-value" :class="{ 'expiry-warning': isExpiring(item) }">{{ item.expiryDate }}</text>
            </view>
          </view>
        </view>
        <view class="card-footer">
          <image class="footer-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无批次数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
import { ref, reactive, onMounted } from 'vue'
import { batchApi, type BatchItem } from '@/api/modules/batches'

const searchForm = reactive({
  keyword: '',
})

const list = ref<BatchItem[]>([])
const loading = ref(false)

function onSearch() {
  loadBatches()
}

function clearSearch() {
  searchForm.keyword = ''
  loadBatches()
}

function goDetail(id: number) {
  uni.navigateTo({
    url: `/pages-sub/product/batches/batch-detail?id=${id}`
  })
}

function isExpiring(item: BatchItem): boolean {
  return item.status === 'expiring' || item.status === 'expired'
}

async function loadBatches() {
  loading.value = true
  try {
    const result = await batchApi.list({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载批次数据失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadBatches()
})
</script>

<style lang="scss" scoped>
.batch-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + env(safe-area-inset-top));
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

.batch-list {
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.batch-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.batch-no-wrap {
  display: flex;
  align-items: center;
}

.batch-no-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-right: $uni-spacing-xs;
}

.batch-no {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-valid { background: $uni-color-success-soft; color: $uni-color-success; }
.status-expiring { background: $uni-color-warning-soft; color: $uni-color-warning; }
.status-expired { background: $uni-color-error-soft; color: $uni-color-error; }

.card-body {
  margin-bottom: $uni-spacing-sm;
}

.product-info {
  display: flex;
  margin-bottom: $uni-spacing-sm;
}

.product-image-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
  background: $uni-bg-color-page;
  flex-shrink: 0;
  margin-right: $uni-spacing-sm;
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
  font-size: 40rpx;
  color: $uni-gray-300;
}

.product-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.product-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-xs;
}

.product-sku {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.batch-info {
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-sm;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $uni-spacing-sm;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.info-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.expiry-warning {
  color: $uni-color-warning;
  font-weight: 600;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.footer-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
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

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>