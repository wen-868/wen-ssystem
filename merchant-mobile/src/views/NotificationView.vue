<template>
  <div class="notification-page">
    <van-nav-bar
      title="消息通知"
      left-arrow
      @click-left="$router.back()"
      right-text="全部已读"
      @click-right="onMarkAllRead"
    />
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab v-for="tab in tabs" :key="tab.type" :title="tab.label" />
    </van-tabs>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <van-cell
          v-for="item in notifications"
          :key="item.id"
          :title="item.title"
          :label="item.summary || item.content"
          :value="formatRelativeTime(item.createdAt)"
          is-link
          @click="goToDetail(item)"
        >
          <template #icon>
            <div class="notification-icon-wrapper">
              <van-icon :name="iconMap[item.type] || 'bullhorn-o'" size="20" />
              <span v-if="!item.isRead" class="unread-dot" />
            </div>
          </template>
          <template #title>
            <span :class="['notification-title', { 'notification-title--unread': !item.isRead }]">
              {{ item.title }}
            </span>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem
} from '../api'

const router = useRouter()

const tabs = [
  { label: '全部', type: '' },
  { label: '系统', type: 'SYSTEM' },
  { label: '订单', type: 'ORDER' },
  { label: '支付', type: 'PAYMENT' },
  { label: '预警', type: 'ALERT' },
  { label: '信用', type: 'CREDIT' },
  { label: '召回', type: 'RECALL' }
]

const iconMap: Record<string, string> = {
  SYSTEM: 'setting-o',
  ORDER: 'orders-o',
  PAYMENT: 'gold-coin-o',
  ALERT: 'warning-o',
  CREDIT: 'shield-o',
  RECALL: 'chat-o'
}

const activeTab = ref(0)
const notifications = ref<NotificationItem[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString()
}

async function loadNotifications(reset: boolean) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const currentType = tabs[activeTab.value]?.type ?? ''
    const res = await fetchNotifications({
      page: page.value,
      pageSize: 20,
      type: currentType || undefined
    })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as NotificationItem[]
    const total = data?.total ?? items.length
    if (reset) {
      notifications.value = items
    } else {
      notifications.value.push(...items)
    }
    if (notifications.value.length >= total) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('加载失败，请重试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onLoad() {
  loadNotifications(false)
}

function onRefresh() {
  refreshing.value = true
  loadNotifications(true)
}

function onTabChange() {
  loadNotifications(true)
}

async function onMarkAllRead() {
  try {
    await markAllNotificationsRead()
    showSuccessToast('已全部标记为已读')
    loadNotifications(true)
  } catch {
    showToast('操作失败，请重试')
  }
}

async function goToDetail(item: NotificationItem) {
  if (!item.isRead) {
    try {
      await markNotificationRead(item.id)
    } catch {
      // 静默失败，不影响跳转
    }
  }
  router.push({
    path: `/notifications/${item.id}`,
    query: {
      type: item.type,
      title: item.title,
      content: item.content,
      summary: item.summary,
      createdAt: item.createdAt,
      relatedId: item.relatedId,
      relatedType: item.relatedType
    }
  })
}
</script>

<style scoped>
.notification-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.notification-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 12px;
  background: #f0f2f5;
  border-radius: 50%;
}

.unread-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background: #1989fa;
  border-radius: 50%;
  border: 1px solid #fff;
}

.notification-title {
  font-size: 15px;
  color: #323233;
}

.notification-title--unread {
  font-weight: 600;
}

:deep(.van-cell__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.van-cell__value) {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
  margin-left: 8px;
}
</style>