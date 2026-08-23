<template>
  <view class="log-detail-page">
    <!-- 顶部 -->
    <page-header title="操作日志详情" @back="goBack" />

    <view class="detail-content" v-if="logDetail">
      <!-- 操作类型 -->
      <view class="type-header">
        <view class="type-badge">
          <text class="badge-text">{{ logDetail.operationTypeName || logDetail.operationType }}</text>
        </view>
        <text class="log-id">#{{ logDetail.id }}</text>
      </view>

      <!-- 基础信息 -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">操作人</text>
          <text class="info-value">{{ logDetail.operator }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">操作时间</text>
          <text class="info-value">{{ formatFullTime(logDetail.createdAt) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">操作模块</text>
          <text class="info-value">{{ logDetail.moduleName || logDetail.module }}</text>
        </view>
        <view class="info-row" v-if="logDetail.bizNo">
          <text class="info-label">业务单号</text>
          <text class="info-value">{{ logDetail.bizNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">IP地址</text>
          <text class="info-value">{{ logDetail.ip }}</text>
        </view>
      </view>

      <!-- 操作内容 -->
      <view class="content-card">
        <view class="card-title">
          <text class="title-text">操作内容</text>
        </view>
        <view class="content-body">
          <text class="content-text">{{ logDetail.content }}</text>
        </view>
      </view>

      <!-- 变更前数据 -->
      <view class="content-card" v-if="logDetail.beforeData">
        <view class="card-title">
          <text class="title-text">变更前数据</text>
        </view>
        <view class="content-body">
          <text class="detail-text">{{ logDetail.beforeData }}</text>
        </view>
      </view>

      <!-- 变更后数据 -->
      <view class="content-card" v-if="logDetail.afterData">
        <view class="card-title">
          <text class="title-text">变更后数据</text>
        </view>
        <view class="content-body">
          <text class="detail-text">{{ logDetail.afterData }}</text>
        </view>
      </view>
    </view>

    <view class="loading-state" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>

    <view class="empty-state" v-if="!loading && !logDetail">
      <text class="empty-text">加载失败</text>
      <text class="retry-btn" @tap="loadDetail">点击重试</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { operationLogApi, type OperationLog } from '@/api/modules/operation-logs'

const logDetail = ref<OperationLog | null>(null)
const loading = ref(true)

function formatFullTime(time: string): string {
  if (!time) return ''
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function goBack() {
  uni.navigateBack()
}

async function loadDetail() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  const id = Number(options.id)

  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    loading.value = false
    return
  }

  loading.value = true
  try {
    logDetail.value = await operationLogApi.getDetail(id)
  } catch (err) {
    console.error('加载操作日志详情失败:', err)
    logDetail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style lang="scss" scoped>
.log-detail-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.back-icon {
  font-size: 32rpx;
  color: $uni-gray-700;
}

.bar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.detail-content {
  padding: 24rpx;
}

.type-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.type-badge {
  padding: 12rpx 32rpx;
  border-radius: 32rpx;
  background: rgba(22, 119, 255, 0.1);
}

.badge-text {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-color-primary;
}

.log-id {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.info-card,
.content-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.info-value {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: 24rpx;
  word-break: break-all;
}

.card-title {
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.title-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.content-body {
  padding: 24rpx;
}

.content-text {
  font-size: 28rpx;
  color: $uni-gray-700;
  line-height: 1.8;
}

.detail-text {
  font-size: 26rpx;
  color: $uni-gray-500;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
}

.loading-state {
  padding: 100rpx 0;
  text-align: center;
}

.loading-text {
  font-size: 28rpx;
  color: $uni-gray-400;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-400;
  display: block;
  margin-bottom: 24rpx;
}

.retry-btn {
  font-size: 26rpx;
  color: $uni-color-primary;
  padding: 12rpx 32rpx;
  border: 1rpx solid $uni-color-primary;
  border-radius: 32rpx;
}

.safe-bottom {
  height: 40rpx;
}
</style>
