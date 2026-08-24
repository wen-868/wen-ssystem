<template>
  <view class="batch-detail-page">
    <page-header title="批次详情" @back="goBack" />

    <scroll-view class="detail-content" scroll-y>
      <view class="detail-card" v-if="detail">
        <view class="card-section">
          <view class="section-header">
            <text class="section-title">基本信息</text>
          </view>
          <view class="product-card">
            <view class="product-image-wrap">
              <image v-if="detail.productImage" class="product-image" :src="detail.productImage" mode="aspectFill" />
              <view v-else class="product-image-placeholder">
                <image class="placeholder-icon ic" src="/static/icons/ic/image.svg" mode="aspectFit"/>
              </view>
            </view>
            <view class="product-info">
              <text class="product-name">{{ detail.productName }}</text>
              <text class="product-sku">SKU: {{ detail.skuId }}</text>
              <text class="batch-no">批次号: {{ detail.batchNo }}</text>
            </view>
          </view>
        </view>

        <view class="card-section">
          <view class="info-grid">
            <view class="info-item">
              <text class="info-label">数量</text>
              <text class="info-value">{{ detail.quantity }} {{ detail.unit }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">状态</text>
              <view class="status-tag" :class="'status-' + detail.status">
                <text>{{ detail.statusText }}</text>
              </view>
            </view>
            <view class="info-item">
              <text class="info-label">生产日期</text>
              <text class="info-value">{{ detail.productionDate }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">有效期至</text>
              <text class="info-value expiry-text" :class="{ 'expiry-warning': detail.status === 'expiring' || detail.status === 'expired' }">{{ detail.expiryDate }}</text>
            </view>
          </view>
        </view>

        <view class="card-section" v-if="detail.createdAt">
          <view class="time-info">
            <view class="time-row">
              <text class="time-label">创建时间</text>
              <text class="time-value">{{ detail.createdAt }}</text>
            </view>
            <view class="time-row" v-if="detail.updatedAt">
              <text class="time-label">更新时间</text>
              <text class="time-value">{{ detail.updatedAt }}</text>
            </view>
          </view>
        </view>

        <view class="card-section" v-if="detail.stockRecords && detail.stockRecords.length > 0">
          <view class="section-header">
            <text class="section-title">库存变动记录</text>
          </view>
          <view class="record-list">
            <view class="record-item" v-for="(record, index) in detail.stockRecords" :key="index">
              <view class="record-icon" :class="record.type === 'in' ? 'icon-in' : 'icon-out'">
                <text>{{ record.type === 'in' ? '+' : '-' }}</text>
              </view>
              <view class="record-info">
                <view class="record-header">
                  <text class="record-type">{{ record.typeText }}</text>
                  <text class="record-time">{{ record.time }}</text>
                </view>
                <view class="record-detail">
                  <text class="record-quantity" :class="record.type === 'in' ? 'quantity-in' : 'quantity-out'">{{ record.type === 'in' ? '+' : '-' }}{{ record.quantity }}</text>
                  <text class="record-remaining">剩余: {{ record.remaining }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { batchApi, type BatchDetail } from '@/api/modules/batches'

const detail = ref<BatchDetail | null>(null)
const loading = ref(false)

function goBack() {
  uni.navigateBack()
}

async function loadDetail() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const id = Number(currentPage.options?.id)
  
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }

  loading.value = true
  try {
    detail.value = await batchApi.detail(id)
  } catch (err) {
    console.error('加载批次详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style lang="scss" scoped>
.batch-detail-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(20rpx + env(safe-area-inset-top));
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 36rpx;
  color: $uni-gray-700;
}

.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.header-right {
  width: 64rpx;
}

.detail-content {
  padding: $uni-spacing-base;
}

.detail-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-section {
  margin-bottom: $uni-spacing-base;
}

.card-section:last-child {
  margin-bottom: 0;
}

.section-header {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.product-card {
  display: flex;
  padding: $uni-spacing-sm;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
}

.product-image-wrap {
  width: 140rpx;
  height: 140rpx;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
  background: $uni-bg-color;
  flex-shrink: 0;
  margin-right: $uni-spacing-md;
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
  font-size: 56rpx;
  color: $uni-gray-300;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.product-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
}

.product-sku {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-bottom: $uni-spacing-xs;
}

.batch-no {
  font-size: 26rpx;
  color: $uni-color-primary;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $uni-spacing-md;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: $uni-spacing-sm;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
}

.info-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: $uni-spacing-xs;
}

.info-value {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.expiry-text {
  font-size: 26rpx;
}

.expiry-warning {
  color: $uni-color-warning;
}

.status-tag {
  display: inline-flex;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  align-self: flex-start;
}

.status-valid { background: $uni-color-success-soft; color: $uni-color-success; }
.status-expiring { background: $uni-color-warning-soft; color: $uni-color-warning; }
.status-expired { background: $uni-color-error-soft; color: $uni-color-error; }

.time-info {
  padding: $uni-spacing-sm;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $uni-spacing-sm;
}

.time-row:last-child {
  margin-bottom: 0;
}

.time-label {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.time-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.record-list {
  padding-top: $uni-spacing-xs;
}

.record-item {
  display: flex;
  padding: $uni-spacing-sm;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-sm;
}

.record-item:last-child {
  margin-bottom: 0;
}

.record-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: $uni-spacing-sm;
}

.icon-in {
  background: $uni-color-success-soft;
}

.icon-in text {
  color: $uni-color-success;
  font-size: 28rpx;
  font-weight: 700;
}

.icon-out {
  background: $uni-color-error-soft;
}

.icon-out text {
  color: $uni-color-error;
  font-size: 28rpx;
  font-weight: 700;
}

.record-info {
  flex: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.record-type {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.record-time {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.record-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-quantity {
  font-size: 26rpx;
  font-weight: 600;
}

.quantity-in {
  color: $uni-color-success;
}

.quantity-out {
  color: $uni-color-error;
}

.record-remaining {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
