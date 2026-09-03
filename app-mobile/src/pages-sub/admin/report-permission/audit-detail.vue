<template>
  <view class="audit-detail-page">
    <!-- 顶部 -->
    <page-header title="日志详情" @back="goBack" />

    <view class="detail-content" v-if="logDetail">
      <!-- 操作类型 -->
      <view class="type-header">
        <view class="type-badge" :class="'type-' + logDetail.operationType">
          <text class="badge-text">{{ logDetail.operationTypeName }}</text>
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
          <text class="info-label">IP地址</text>
          <text class="info-value">{{ logDetail.ip }}</text>
        </view>
        <view class="info-row" v-if="logDetail.targetRole">
          <text class="info-label">目标角色</text>
          <text class="info-value">{{ logDetail.targetRole }}</text>
        </view>
        <view class="info-row" v-if="logDetail.targetUser">
          <text class="info-label">目标用户</text>
          <text class="info-value">{{ logDetail.targetUser }}</text>
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

      <!-- 详细信息 -->
      <view class="detail-card" v-if="logDetail.detail">
        <view class="card-title">
          <text class="title-text">详细信息</text>
        </view>
        <view class="detail-body">
          <text class="detail-text">{{ logDetail.detail }}</text>
        </view>
      </view>
    </view>

    <view class="loading-state" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { reportPermissionApi, type PermissionAuditLog } from '@/api/modules/report-permission'

const logDetail = ref<PermissionAuditLog | null>(null)
const loading = ref(true)

function formatFullTime(time: string): string {
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
    return
  }

  loading.value = true
  try {
    logDetail.value = await reportPermissionApi.getAuditLogDetail(id)
  } catch (err) {
    console.error('加载日志详情失败:', err)
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
.audit-detail-page {
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
  gap: $uni-spacing-sm;
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
  padding: $uni-spacing-base;
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
}

.type-ROLE_PERMISSION_CHANGE {
  background: $zx-antblue-100;
}

.type-DATA_SCOPE_CHANGE {
  background: $zx-antgreen-100;
}

.type-USER_ROLE_ASSIGN {
  background: $zx-purple-soft-10;
}

.type-USER_PERMISSION_CHANGE {
  background: $zx-antorange-100;
}

.type-ROLE_CREATE {
  background: $zx-cyan-soft-10;
}

.type-ROLE_DELETE {
  background: $zx-antred-100;
}

.badge-text {
  font-size: 26rpx;
  font-weight: 600;
}

.type-ROLE_PERMISSION_CHANGE .badge-text {
  color: $uni-color-primary;
}

.type-DATA_SCOPE_CHANGE .badge-text {
  color: $uni-color-success;
}

.type-USER_ROLE_ASSIGN .badge-text {
  color: $uni-color-purple;
}

.type-USER_PERMISSION_CHANGE .badge-text {
  color: $uni-color-warning;
}

.type-ROLE_CREATE .badge-text {
  color: $uni-color-cyan;
}

.type-ROLE_DELETE .badge-text {
  color: $uni-color-error;
}

.log-id {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.info-card,
.content-card,
.detail-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-md;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-md $uni-spacing-base;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.info-value {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: $uni-spacing-base;
}

.card-title {
  padding: $uni-spacing-md $uni-spacing-base;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.title-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.content-body,
.detail-body {
  padding: $uni-spacing-base;
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

.safe-bottom {
  height: 40rpx;
}
</style>
