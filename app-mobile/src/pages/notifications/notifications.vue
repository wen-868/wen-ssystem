<template>
  <!-- 无表单交互，无需三件套（纯展示消息列表页） -->
  <view class="notifications-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <view class="header-back" @tap="goBack">
        <text class="header-back-icon">‹</text>
      </view>
      <text class="header-title">消息中心</text>
      <view class="header-actions">
        <text class="header-action" @tap="toggleEditMode" v-if="list.length > 0 || editMode">
          {{ editMode ? '取消' : '管理' }}
        </text>
      </view>
    </view>

    <!-- 分类 Tab -->
    <scroll-view class="tab-bar" scroll-x :show-scrollbar="false">
      <view
        class="tab-item"
        v-for="tab in tabs"
        :key="tab.value"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-badge" v-if="getUnreadCount(tab.value) > 0">
          <text class="tab-badge-text">{{ formatBadgeCount(getUnreadCount(tab.value)) }}</text>
        </view>
        <view v-if="activeTab === tab.value" class="tab-indicator"></view>
      </view>
    </scroll-view>

    <!-- 操作栏 -->
    <view class="action-bar" v-if="editMode">
      <view class="action-left">
        <view class="checkbox" :class="{ 'checkbox--checked': isAllSelected }" @tap="toggleSelectAll">
          <text class="checkbox-icon" v-if="isAllSelected">✓</text>
        </view>
        <text class="action-text">全选</text>
      </view>
      <view class="action-right">
        <text
          class="action-btn action-btn--danger"
          :class="{ 'action-btn--disabled': selectedIds.length === 0 }"
          @tap="handleBatchDelete"
        >
          删除({{ selectedIds.length }})
        </text>
      </view>
    </view>

    <view class="action-bar" v-else-if="list.length > 0">
      <text class="action-btn" @tap="markCurrentTabRead">一键已读</text>
      <text class="action-btn" @tap="markAllRead">全部已读</text>
    </view>

    <view class="loading-overlay" v-if="loading && list.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 虚拟滚动消息列表 -->
    <virtual-list
      v-if="list.length > 0"
      class="notification-list"
      :data="list"
      :item-size="itemSize"
      :height="0"
      :buffer="5"
      item-key="id"
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @load-more="onLoadMore"
      @refresh="onPullDownRefresh"
    >
      <template #default="{ item }">
        <view
          class="notification-item"
          :class="{ 'notification-item--unread': !item.read, 'notification-item--selected': selectedIds.includes(item.id) }"
          @tap="handleItemClick(item)"
          @longpress="onLongPress(item)"
        >
          <!-- 编辑模式选择框 -->
          <view class="select-checkbox" v-if="editMode" @tap.stop="toggleSelect(item.id)">
            <view class="checkbox" :class="{ 'checkbox--checked': selectedIds.includes(item.id) }">
              <text class="checkbox-icon" v-if="selectedIds.includes(item.id)">✓</text>
            </view>
          </view>

          <view class="notification-icon-wrap">
            <view class="notification-icon" :class="'icon-' + item.type">
              <text class="icon-text">{{ getTypeIcon(item.type) }}</text>
            </view>
            <view class="unread-dot" v-if="!item.read && !editMode"></view>
          </view>

          <view class="notification-content">
            <view class="notification-header">
              <text class="notification-title">{{ item.title }}</text>
              <text class="notification-time">{{ formatTime(item.createdAt) }}</text>
            </view>
            <text class="notification-summary">{{ item.summary || item.content }}</text>
            <view class="notification-footer">
              <text class="notification-type-tag" :class="'tag-' + item.type">
                {{ getTypeLabel(item.type) }}
              </text>
              <text class="notification-link" v-if="item.linkUrl && !editMode">查看详情 ›</text>
            </view>
          </view>

          <!-- 删除按钮 -->
          <view class="delete-btn" v-if="editMode" @tap.stop="handleDelete(item.id)">
            <text class="delete-text">删除</text>
          </view>
        </view>
      </template>
    </virtual-list>

    <!-- 空状态 -->
    <view class="empty-state" v-if="!loading && list.length === 0">
      <text class="empty-icon">&#xe617;</text>
      <text class="empty-text">{{ emptyText }}</text>
    </view>

    <!-- 加载更多 -->
    <view class="load-more" v-if="list.length > 0">
      <view class="loading-more-spinner" v-if="loadingMore"></view>
      <text class="load-more-text" v-if="loadingMore">加载中...</text>
      <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { notificationsApi, type NotificationItem, type NotificationType } from '@/api/modules/notifications'
import VirtualList from '@/components/virtual-list.vue'

// 分类 Tab 配置
const tabs = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '系统通知' },
  { value: 'order', label: '订单通知' },
  { value: 'inventory', label: '库存预警' },
  { value: 'marketing', label: '营销通知' }
]

// 状态
const activeTab = ref<string>('all')
const list = ref<NotificationItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
const editMode = ref(false)
const selectedIds = ref<number[]>([])
const unreadByType = ref<Record<string, number>>({
  system: 0,
  order: 0,
  inventory: 0,
  marketing: 0,
  all: 0
})

/** 单行高度（px），onMounted 时按 rpx 转 px 计算 */
const itemSize = ref(260)

// 计算属性
const emptyText = computed(() => {
  if (activeTab.value === 'all') return '暂无消息通知'
  const tab = tabs.find((t) => t.value === activeTab.value)
  return `暂无${tab?.label || ''}消息`
})

const isAllSelected = computed(() => {
  return list.value.length > 0 && selectedIds.value.length === list.value.length
})

// 获取未读数
function getUnreadCount(type: string): number {
  return unreadByType.value[type] || 0
}

// 格式化角标数字
function formatBadgeCount(count: number): string {
  if (count > 99) return '99+'
  return String(count)
}

// 获取类型图标
function getTypeIcon(type: string): string {
  const map: Record<string, string> = {
    system: '系',
    order: '订',
    inventory: '库',
    marketing: '营'
  }
  return map[type] || '通'
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

// 格式化时间
function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      if (minutes === 0) return '刚刚'
      return `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}-${day}`
  }
}

// 切换 Tab
function switchTab(tabValue: string) {
  if (activeTab.value === tabValue) return
  activeTab.value = tabValue
  editMode.value = false
  selectedIds.value = []
  page.value = 1
  noMore.value = false
  list.value = []
  loadNotifications()
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
}

// 加载消息列表
async function loadNotifications() {
  if (loading.value) return
  loading.value = true

  try {
    const params: any = {
      page: page.value,
      pageSize
    }
    if (activeTab.value !== 'all') {
      params.type = activeTab.value
    }

    const result = await notificationsApi.list(params)

    if (page.value === 1) {
      list.value = result.list || []
    } else {
      list.value = [...list.value, ...(result.list || [])]
    }

    // 更新未读数
    if (result.unreadByType) {
      unreadByType.value = {
        ...result.unreadByType,
        all: result.unreadCount || 0
      }
    }

    // 判断是否还有更多
    if (!result.list || result.list.length < pageSize) {
      noMore.value = true
    } else {
      noMore.value = false
    }
  } catch (err) {
    console.error('加载通知失败:', err)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
    refresherTriggered.value = false
  }
}

// 下拉刷新
function onPullDownRefresh() {
  page.value = 1
  noMore.value = false
  refresherTriggered.value = true
  loadNotifications()
}

// 上拉加载更多
function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  page.value++
  loadNotifications()
}

// 点击消息项
function handleItemClick(item: NotificationItem) {
  if (editMode.value) {
    toggleSelect(item.id)
    return
  }

  // 标记已读
  if (!item.read) {
    notificationsApi.markRead(item.id).catch(() => {})
    item.read = true
    // 更新未读数
    if (unreadByType.value[item.type] > 0) {
      unreadByType.value[item.type]--
    }
    if (unreadByType.value.all > 0) {
      unreadByType.value.all--
    }
  }

  // 跳转详情页（详情页通过 GET /admin/notifications/:id 拉取真实数据）
  uni.navigateTo({
    url: `/pages/notifications/notification-detail?id=${item.id}`
  })
}

// 长按消息项
function onLongPress(item: NotificationItem) {
  if (editMode.value) return
  editMode.value = true
  selectedIds.value = [item.id]
}

// 切换编辑模式
function toggleEditMode() {
  editMode.value = !editMode.value
  selectedIds.value = []
}

// 切换选中
function toggleSelect(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = list.value.map((item) => item.id)
  }
}

// 标记当前分类已读
async function markCurrentTabRead() {
  try {
    await notificationsApi.markReadByType(activeTab.value as NotificationType | 'all')
    list.value.forEach((item) => {
      item.read = true
    })
    // 更新未读数
    if (activeTab.value === 'all') {
      unreadByType.value = {
        system: 0,
        order: 0,
        inventory: 0,
        marketing: 0,
        all: 0
      }
    } else {
      unreadByType.value[activeTab.value] = 0
      // 重新计算总数
      unreadByType.value.all = Object.keys(unreadByType.value)
        .filter((k) => k !== 'all')
        .reduce((sum, k) => sum + (unreadByType.value[k] || 0), 0)
    }
    uni.showToast({ title: '已标记为已读', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 全部已读
async function markAllRead() {
  try {
    await notificationsApi.markAllRead()
    list.value.forEach((item) => {
      item.read = true
    })
    unreadByType.value = {
      system: 0,
      order: 0,
      inventory: 0,
      marketing: 0,
      all: 0
    }
    uni.showToast({ title: '已全部标记为已读', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 删除单条消息
async function handleDelete(id: number) {
  uni.showModal({
    title: '提示',
    content: '确定删除这条消息吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await notificationsApi.delete(id)
          const index = list.value.findIndex((item) => item.id === id)
          if (index > -1) {
            const item = list.value[index]
            if (!item.read) {
              if (unreadByType.value[item.type] > 0) unreadByType.value[item.type]--
              if (unreadByType.value.all > 0) unreadByType.value.all--
            }
            list.value.splice(index, 1)
          }
          uni.showToast({ title: '删除成功', icon: 'success' })
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

// 批量删除
async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return

  uni.showModal({
    title: '提示',
    content: `确定删除选中的 ${selectedIds.value.length} 条消息吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await notificationsApi.batchDelete(selectedIds.value)
          const deletedIds = new Set(selectedIds.value)
          list.value = list.value.filter((item) => {
            if (deletedIds.has(item.id)) {
              if (!item.read) {
                if (unreadByType.value[item.type] > 0) unreadByType.value[item.type]--
                if (unreadByType.value.all > 0) unreadByType.value.all--
              }
              return false
            }
            return true
          })
          selectedIds.value = []
          uni.showToast({ title: '删除成功', icon: 'success' })
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

// 加载未读数
async function loadUnreadCount() {
  try {
    const result = await notificationsApi.getUnreadCount()
    unreadByType.value = {
      system: result.system || 0,
      order: result.order || 0,
      inventory: result.inventory || 0,
      marketing: result.marketing || 0,
      all: result.total || 0
    }
  } catch (err) {
    console.error('加载未读数失败:', err)
  }
}

onMounted(() => {
  // 260rpx 转 px（依赖屏幕宽度）
  try {
    itemSize.value = uni.upx2px(260)
  } catch (err) {
    itemSize.value = 130
  }
  loadNotifications()
  loadUnreadCount()
})
</script>

<style lang="scss" scoped>
.notifications-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.page-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.header-actions {
  display: flex;
  align-items: center;
}

.header-action {
  font-size: 26rpx;
  color: $uni-color-primary;
}

/* 分类 Tab */
.tab-bar {
  white-space: nowrap;
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.tab-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 32rpx;
  position: relative;
}

.tab-text {
  font-size: 28rpx;
  color: $uni-gray-500;
}

.tab-item--active .tab-text {
  color: $uni-color-primary;
  font-weight: 600;
}

.tab-badge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: $uni-color-error;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-badge-text {
  font-size: 20rpx;
  color: $uni-text-color-inverse;
  line-height: 1;
}

.tab-indicator {
  width: 48rpx;
  height: 6rpx;
  background: $uni-color-primary;
  border-radius: 3rpx;
  margin-top: 8rpx;
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 32rpx;
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.action-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.action-btn {
  font-size: 26rpx;
  color: $uni-color-primary;
  padding: 8rpx 20rpx;
}

.action-btn--danger {
  color: $uni-color-error;
}

.action-btn--disabled {
  color: $uni-gray-300;
}

/* 复选框 */
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox--checked {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.checkbox-icon {
  font-size: 22rpx;
  color: $uni-text-color-inverse;
}

/* 消息列表 */
.notification-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
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

.notification-item {
  display: flex;
  align-items: flex-start;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  position: relative;
  transition: all 0.2s ease;
  box-sizing: border-box;
  height: 100%;
}

.notification-item--unread {
  background: $uni-color-primary-soft;
}

.notification-item--selected {
  background: $uni-color-primary-soft;
}

.select-checkbox {
  margin-right: 16rpx;
  padding-top: 20rpx;
}

.notification-icon-wrap {
  position: relative;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.notification-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-system { background: $uni-color-primary-soft; }
.icon-order { background: $uni-color-warning-soft; }
.icon-inventory { background: $uni-color-error-soft; }
.icon-marketing { background: $uni-color-success-soft; }

.icon-text {
  font-size: 26rpx;
  font-weight: 600;
}

.icon-system .icon-text { color: $uni-color-primary; }
.icon-order .icon-text { color: $uni-color-warning; }
.icon-inventory .icon-text { color: $uni-color-error; }
.icon-marketing .icon-text { color: $uni-color-success; }

.unread-dot {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  background: $uni-color-error;
  border-radius: 50%;
  border: 2rpx solid $uni-bg-color;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.notification-title {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 600;
  flex: 1;
  margin-right: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  font-size: 24rpx;
  color: $uni-gray-300;
  flex-shrink: 0;
}

.notification-summary {
  font-size: 26rpx;
  color: $uni-gray-500;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.notification-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-type-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.tag-system { background: $uni-color-primary-soft; color: $uni-color-primary; }
.tag-order { background: $uni-color-warning-soft; color: $uni-color-warning; }
.tag-inventory { background: $uni-color-error-soft; color: $uni-color-error; }
.tag-marketing { background: $uni-color-success-soft; color: $uni-color-success; }

.notification-link {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.delete-btn {
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  background: $uni-color-error;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.delete-text {
  font-size: 24rpx;
  color: $uni-text-color-inverse;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

/* 加载更多 */
.load-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32rpx 0;
  gap: 16rpx;
}

.loading-more-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid $uni-gray-100;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
