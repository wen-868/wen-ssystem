<template>
  <!-- 无表单交互，无需三件套（纯展示消息详情页） -->
  <view class="detail-page">
    <view class="detail-content" v-if="detail">
      <!-- 消息类型标签 -->
      <view class="type-tag-wrap">
        <text class="type-tag" :class="'tag-' + detail.type">
          {{ getTypeLabel(detail.type) }}
        </text>
        <text class="read-status" v-if="detail.read">已读</text>
        <text class="read-status read-status--unread" v-else>未读</text>
      </view>

      <!-- 消息标题 -->
      <text class="detail-title">{{ detail.title }}</text>

      <!-- 发布时间 -->
      <text class="detail-time">发布时间：{{ formatFullTime(detail.createdAt) }}</text>

      <!-- 阅读时间 -->
      <text class="detail-time" v-if="detail.readAt">阅读时间：{{ formatFullTime(detail.readAt) }}</text>

      <!-- 分隔线 -->
      <view class="divider"></view>

      <!-- 消息内容 -->
      <view class="detail-body">
        <rich-text :nodes="detail.content" v-if="isRichText()"></rich-text>
        <text class="detail-text" v-else>{{ detail.content }}</text>
      </view>

      <!-- 相关链接 -->
      <view class="link-section" v-if="detail.linkUrl">
        <view class="link-card" @tap="handleLinkClick">
          <view class="link-icon">
            <text class="link-icon-text">链</text>
          </view>
          <view class="link-info">
            <text class="link-text">{{ detail.linkText || '查看相关内容' }}</text>
            <text class="link-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-wrap" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 加载失败 -->
    <view class="error-wrap" v-if="!loading && !detail">
      <text class="error-icon">&#xe617;</text>
      <text class="error-text">加载失败</text>
      <text class="retry-btn" @tap="loadDetail">点击重试</text>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="detail">
      <text class="bottom-btn" @tap="handleDelete">删除</text>
      <text class="bottom-btn bottom-btn--primary" v-if="!detail.read" @tap="handleMarkRead">
        标记已读
      </text>
      <text class="bottom-btn bottom-btn--primary" v-else>已读</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { notificationsApi, type NotificationItem } from '@/api/modules/notifications'

const detail = ref<NotificationItem | null>(null)
const loading = ref(false)
const notificationId = ref(0)

// 检查是否为富文本
function isRichText(): boolean {
  if (!detail.value?.content) return false
  return /<[^>]+>/.test(detail.value.content)
}

// 获取类型标签
function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    system: '系统通知',
    order: '订单通知',
    inventory: '库存预警',
    marketing: '营销通知'
  }
  return map[type] || '通知'
}

// 格式化完整时间
function formatFullTime(timeStr: string): string {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 加载详情
async function loadDetail() {
  if (notificationId.value <= 0) return
  loading.value = true

  try {
    const result = await notificationsApi.detail(notificationId.value)
    detail.value = result

    // 自动标记已读
    if (!result.read) {
      try {
        await notificationsApi.markRead(notificationId.value)
        detail.value.read = true
        detail.value.readAt = new Date().toISOString()
      } catch {
        // 忽略标记已读失败
      }
    }
  } catch (err) {
    console.error('加载消息详情失败:', err)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 标记已读
async function handleMarkRead() {
  if (!detail.value || detail.value.read) return
  try {
    await notificationsApi.markRead(notificationId.value)
    detail.value.read = true
    detail.value.readAt = new Date().toISOString()
    uni.showToast({ title: '已标记为已读', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 删除消息
function handleDelete() {
  uni.showModal({
    title: '提示',
    content: '确定删除这条消息吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await notificationsApi.delete(notificationId.value)
          uni.showToast({ title: '删除成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1000)
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

// 点击相关链接
function handleLinkClick() {
  if (!detail.value?.linkUrl) return
  // 跳转到相关页面
  uni.navigateTo({
    url: detail.value.linkUrl,
    fail: () => {
      // 如果 navigateTo 失败，尝试 redirectTo
      uni.redirectTo({
        url: detail.value?.linkUrl || '',
        fail: () => {
          uni.showToast({ title: '无法打开链接', icon: 'none' })
        }
      })
    }
  })
}

onMounted(() => {
  // 获取页面参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  const id = Number(options.id)

  if (id > 0) {
    notificationId.value = id
    loadDetail()
  } else {
    uni.showToast({ title: '消息ID无效', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  padding-bottom: 120rpx;
}

.detail-content {
  background: $uni-bg-color;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

/* 类型标签 */
.type-tag-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.type-tag {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
}

.tag-system { background: $uni-color-primary-soft; color: $uni-color-primary; }
.tag-order { background: $uni-color-warning-soft; color: $uni-color-warning; }
.tag-inventory { background: $uni-color-error-soft; color: $uni-color-error; }
.tag-marketing { background: $uni-color-success-soft; color: $uni-color-success; }

.read-status {
  font-size: 22rpx;
  color: $uni-color-success;
  background: $uni-color-success-soft;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.read-status--unread {
  color: $uni-color-error;
  background: $uni-color-error-soft;
}

/* 标题 */
.detail-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-gray-700;
  line-height: 1.5;
  margin-bottom: 16rpx;
  display: block;
}

/* 时间 */
.detail-time {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: 8rpx;
  display: block;
}

/* 分隔线 */
.divider {
  height: 1rpx;
  background: $uni-gray-100;
  margin: 24rpx 0;
}

/* 内容 */
.detail-body {
  font-size: 28rpx;
  color: $uni-gray-700;
  line-height: 1.8;
}

.detail-text {
  font-size: 28rpx;
  color: $uni-gray-700;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 相关链接 */
.link-section {
  margin-top: 32rpx;
}

.link-card {
  display: flex;
  align-items: center;
  background: $uni-gray-50;
  border-radius: 12rpx;
  padding: 24rpx;
  border: 1rpx solid $uni-gray-100;
}

.link-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-color-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.link-icon-text {
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 600;
}

.link-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-text {
  font-size: 26rpx;
  color: $uni-color-primary;
}

.link-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

/* 加载状态 */
.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-100;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}

/* 错误状态 */
.error-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.error-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.error-text {
  font-size: 28rpx;
  color: $uni-gray-300;
  margin-bottom: 24rpx;
}

.retry-btn {
  font-size: 26rpx;
  color: $uni-color-primary;
  padding: 12rpx 32rpx;
  border: 1rpx solid $uni-color-primary;
  border-radius: 32rpx;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-gray-100;
  gap: 24rpx;
}

.bottom-btn {
  flex: 1;
  text-align: center;
  font-size: 28rpx;
  color: $uni-gray-500;
  padding: 20rpx 0;
  border: 1rpx solid $uni-gray-300;
  border-radius: 40rpx;
}

.bottom-btn--primary {
  color: $uni-text-color-inverse;
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>

