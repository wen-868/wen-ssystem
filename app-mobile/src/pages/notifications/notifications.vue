<template>
  <view class="notifications-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">消息通知</text>
      <text class="header-action" @tap="markAllRead" v-if="list.length > 0">全部已读</text>
    </view>

    <scroll-view class="notification-list" scroll-y v-if="list.length > 0">
      <view
        class="notification-item"
        v-for="item in list"
        :key="item.id"
        :class="{ 'notification-item--unread': !item.read }"
        @tap="handleClick(item)"
      >
        <view class="notification-dot" :class="{ 'dot-unread': !item.read }"></view>
        <view class="notification-content">
          <view class="notification-header">
            <text class="notification-title">{{ item.title }}</text>
            <text class="notification-time">{{ item.createdAt }}</text>
          </view>
          <view class="notification-tags">
            <text class="notification-type" :class="'type-' + item.type">
              {{ typeLabel(item.type) }}
            </text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe617;</text>
      <text class="empty-text">暂无消息通知</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { notificationsApi, type NotificationItem } from '@/api/modules/notifications'

const list = ref<NotificationItem[]>([])
const loading = ref(false)

function typeLabel(type?: string): string {
  const map: Record<string, string> = {
    system: '系统',
    order: '订单',
    alert: '预警'
  }
  return type ? map[type] || '其他' : '其他'
}

async function loadNotifications() {
  loading.value = true
  try {
    const result = await notificationsApi.list({ page: 1, pageSize: 50 })
    list.value = result.list
  } catch (err) {
    console.error('加载通知失败:', err)
  } finally {
    loading.value = false
  }
}

async function handleClick(item: NotificationItem) {
  if (!item.read) {
    try {
      await notificationsApi.markRead(item.id)
      item.read = true
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }
}

async function markAllRead() {
  try {
    await notificationsApi.markAllRead()
    list.value.forEach((item) => {
        item.read = true
    })
    uni.showToast({ title: '已全部标记为已读', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onMounted(() => {
  loadNotifications()
})
</script>

<style scoped>
.notifications-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

.header-action {
  font-size: 26rpx;
  color: #1677FF;
}

.notification-list {
  padding: 16rpx 24rpx;
}

.notification-item {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.notification-item--unread {
  background: #f6faff;
}

.notification-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-top: 10rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.dot-unread {
  background: #1677FF;
}

.notification-content {
  flex: 1;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.notification-title {
  font-size: 28rpx;
  color: #333;
  flex: 1;
  margin-right: 16rpx;
}

.notification-time {
  font-size: 24rpx;
  color: #bbb;
  flex-shrink: 0;
}

.notification-type {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.type-system { background: #e6f4ff; color: #1677FF; }
.type-order { background: #fff7e6; color: #fa8c16; }
.type-alert { background: #fff2f0; color: #ff4d4f; }

/* 空状态 */
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