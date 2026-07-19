<template>
  <view class="batch-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索批次号 / 商品名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
                <text class="placeholder-icon">&#xe630;</text>
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
          <text class="footer-arrow">&#xe60a;</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无批次数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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

<style scoped>
.batch-page {
  min-height: 100vh;
  background: #f0f5ff;
}

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

.batch-list {
  padding: 16rpx 24rpx;
}

.batch-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.batch-no-wrap {
  display: flex;
  align-items: center;
}

.batch-no-label {
  font-size: 24rpx;
  color: #999;
  margin-right: 8rpx;
}

.batch-no {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-valid { background: #f6ffed; color: #52c41a; }
.status-expiring { background: #fff7e6; color: #fa8c16; }
.status-expired { background: #fff2f0; color: #ff4d4f; }

.card-body {
  margin-bottom: 16rpx;
}

.product-info {
  display: flex;
  margin-bottom: 16rpx;
}

.product-image-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #f5f7fa;
  flex-shrink: 0;
  margin-right: 16rpx;
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
  font-size: 40rpx;
  color: #bbb;
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
  color: #333;
  margin-bottom: 8rpx;
}

.product-sku {
  font-size: 24rpx;
  color: #999;
}

.batch-info {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 16rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
}

.info-value {
  font-size: 26rpx;
  color: #333;
}

.expiry-warning {
  color: #fa8c16;
  font-weight: 600;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.footer-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
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

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>