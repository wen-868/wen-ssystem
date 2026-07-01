<template>
  <div class="notification-page">
    <van-nav-bar
      title="消息通知"
      left-arrow
      @click-left="$router.back()"
      right-text="全部已读"
      @click-right="onMarkAllRead"
    />

    <!-- 推送设置入口 -->
    <van-cell
      title="推送设置"
      icon="setting-o"
      is-link
      @click="showSettings = true"
      class="settings-cell"
    />

    <!-- 时间筛选 -->
    <van-dropdown-menu>
      <van-dropdown-item
        v-model="timeFilter"
        :options="timeOptions"
        @change="onTimeFilterChange"
      />
    </van-dropdown-menu>

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
            <div
              class="notification-icon-wrapper"
              :style="{ background: iconBgMap[item.type] || '#f0f2f5' }"
            >
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

    <!-- 推送设置弹窗 -->
    <van-popup
      v-model:show="showSettings"
      position="bottom"
      :style="{ height: '65%' }"
      round
      closeable
      safe-area-inset-bottom
    >
      <div class="settings-popup">
        <h3 class="settings-title">推送设置</h3>

        <van-cell-group inset>
          <van-cell title="免打扰模式" center>
            <template #right-icon>
              <van-switch v-model="pushSettings.dndEnabled" size="24" />
            </template>
          </van-cell>
        </van-cell-group>

        <van-cell-group v-if="pushSettings.dndEnabled" inset style="margin-top: 12px">
          <van-cell title="免打扰时段" center>
            <template #right-icon>
              <span class="dnd-time-range" @click="showDndStartPicker = true">
                {{ pushSettings.dndStart }} — {{ pushSettings.dndEnd }}
              </span>
            </template>
          </van-cell>
        </van-cell-group>

        <van-cell-group inset style="margin-top: 12px">
          <van-cell
            v-for="typeItem in typeSwitchList"
            :key="typeItem.type"
            :title="typeItem.label"
            center
          >
            <template #right-icon>
              <van-switch
                v-model="pushSettings.typeSwitches[typeItem.type]"
                size="24"
              />
            </template>
          </van-cell>
        </van-cell-group>

        <div class="settings-footer">
          <van-button type="primary" block round @click="savePushSettings">
            保存设置
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 时间选择弹窗 -->
    <van-popup v-model:show="showDndStartPicker" position="bottom" round>
      <van-datetime-picker
        v-model="dndStartPickerValue"
        type="time"
        title="选择开始时间"
        @confirm="onDndStartConfirm"
        @cancel="showDndStartPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showDndEndPicker" position="bottom" round>
      <van-datetime-picker
        v-model="dndEndPickerValue"
        type="time"
        title="选择结束时间"
        @confirm="onDndEndConfirm"
        @cancel="showDndEndPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
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

const iconBgMap: Record<string, string> = {
  SYSTEM: '#f0f2f5',
  ORDER: '#e8f4fd',
  PAYMENT: '#fff7e6',
  ALERT: '#fff0f0',
  CREDIT: '#e6f7ff',
  RECALL: '#f0ffe6'
}

/* ========== 时间筛选 ========== */
const timeFilter = ref(0)
const timeOptions = [
  { text: '全部', value: 0 },
  { text: '今天', value: 1 },
  { text: '本周', value: 2 },
  { text: '本月', value: 3 }
]

function getTimeRange(): { startDate?: string; endDate?: string } {
  const now = new Date()
  switch (timeFilter.value) {
    case 1: {
      const today = now.toISOString().slice(0, 10)
      return { startDate: today, endDate: today }
    }
    case 2: {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        startDate: monday.toISOString().slice(0, 10),
        endDate: sunday.toISOString().slice(0, 10)
      }
    }
    case 3: {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        startDate: firstDay.toISOString().slice(0, 10),
        endDate: lastDay.toISOString().slice(0, 10)
      }
    }
    default:
      return {}
  }
}

/* ========== 推送设置 ========== */
const showSettings = ref(false)
const showDndStartPicker = ref(false)
const showDndEndPicker = ref(false)
const dndStartPickerValue = ref(['22', '00'])
const dndEndPickerValue = ref(['08', '00'])

const pushSettings = reactive({
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  typeSwitches: {
    SYSTEM: true,
    ORDER: true,
    PAYMENT: true,
    ALERT: true,
    CREDIT: true,
    RECALL: true
  } as Record<string, boolean>
})

const typeSwitchList = [
  { type: 'SYSTEM', label: '系统通知' },
  { type: 'ORDER', label: '订单通知' },
  { type: 'PAYMENT', label: '支付通知' },
  { type: 'ALERT', label: '预警通知' },
  { type: 'CREDIT', label: '信用通知' },
  { type: 'RECALL', label: '召回通知' }
]

function onDndStartConfirm({ selectedValues }: { selectedValues: string[] }) {
  pushSettings.dndStart = selectedValues.join(':')
  showDndStartPicker.value = false
  showDndEndPicker.value = true
}

function onDndEndConfirm({ selectedValues }: { selectedValues: string[] }) {
  pushSettings.dndEnd = selectedValues.join(':')
  showDndEndPicker.value = false
}

function savePushSettings() {
  localStorage.setItem('notification_push_settings', JSON.stringify(pushSettings))
  showSuccessToast('设置已保存')
  showSettings.value = false
}

function loadPushSettings() {
  try {
    const saved = localStorage.getItem('notification_push_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.dndEnabled !== undefined) pushSettings.dndEnabled = parsed.dndEnabled
      if (parsed.dndStart) pushSettings.dndStart = parsed.dndStart
      if (parsed.dndEnd) pushSettings.dndEnd = parsed.dndEnd
      if (parsed.typeSwitches) {
        Object.assign(pushSettings.typeSwitches, parsed.typeSwitches)
      }
      // 初始化时间选择器值
      const [sh, sm] = pushSettings.dndStart.split(':')
      const [eh, em] = pushSettings.dndEnd.split(':')
      dndStartPickerValue.value = [sh || '22', sm || '00']
      dndEndPickerValue.value = [eh || '08', em || '00']
    }
  } catch {
    // 忽略
  }
}

/* ========== 通知列表 ========== */
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
    const timeRange = getTimeRange()
    const res = await fetchNotifications({
      page: page.value,
      pageSize: 20,
      type: currentType || undefined
    })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as NotificationItem[]
    const total = data?.total ?? items.length

    // 客户端时间筛选
    let filtered = items
    if (timeRange.startDate && timeRange.endDate) {
      const start = new Date(timeRange.startDate + 'T00:00:00')
      const end = new Date(timeRange.endDate + 'T23:59:59')
      filtered = items.filter((item) => {
        const d = new Date(item.createdAt)
        return d >= start && d <= end
      })
    }

    if (reset) {
      notifications.value = filtered
    } else {
      notifications.value.push(...filtered)
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

function onTimeFilterChange() {
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

// 初始化加载设置
loadPushSettings()
</script>

<style scoped>
.notification-page {
  min-height: 100vh;
  background: #f7f8fa;
}

/* ===== 推送设置入口 ===== */
.settings-cell {
  margin: 0;
}

/* ===== 通知图标 ===== */
.notification-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 12px;
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

/* ===== 推送设置弹窗 ===== */
.settings-popup {
  padding: 24px 0 16px;
}

.settings-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 20px;
}

.settings-footer {
  padding: 24px 16px;
}

.dnd-time-range {
  font-size: 14px;
  color: var(--color-primary);
  cursor: pointer;
}
</style>