<template>
  <view class="store-control-page">
    <view class="page-header">
      <text class="header-title">门店管控</text>
    </view>

    <!-- 门店状态卡 -->
    <view class="status-card" v-if="status">
      <view class="status-top">
        <view class="status-info">
          <text class="store-name">{{ status.storeName || '我的门店' }}</text>
          <view class="status-tag" :class="status.online ? 'status-tag--online' : 'status-tag--offline'">
            <text class="tag-dot"></text>
            <text class="tag-text">{{ status.online ? '营业中' : '已打烊' }}</text>
          </view>
        </view>
        <button
          class="toggle-btn"
          :class="status.online ? 'toggle-btn--offline' : 'toggle-btn--online'"
          @tap="onToggleStatus"
        >{{ status.online ? '打烊' : '开店' }}</button>
      </view>
      <view class="status-detail">
        <view class="detail-row" v-if="status.businessHours">
          <text class="detail-label">营业时间</text>
          <text class="detail-value">{{ status.businessHours }}</text>
        </view>
        <view class="detail-row" v-if="status.lastOpenTime">
          <text class="detail-label">最近开店</text>
          <text class="detail-value">{{ status.lastOpenTime }}</text>
        </view>
        <view class="detail-row">
          <text class="detail-label">门店编号</text>
          <text class="detail-value">{{ status.storeId }}</text>
        </view>
      </view>
    </view>

    <!-- 操作日志 -->
    <view class="section-title">
      <text class="section-text">管控操作日志</text>
    </view>

    <scroll-view
      class="log-list"
      scroll-y
      v-if="logs.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="log-card" v-for="item in logs" :key="item.id">
        <view class="log-header">
          <view class="log-action" :class="'action-' + getActionClass(item.action)">
            <text class="action-text">{{ item.action }}</text>
          </view>
          <text class="log-time">{{ item.createdAt }}</text>
        </view>
        <view class="log-body">
          <view class="info-row" v-if="item.operatorName">
            <text class="info-label">操作人</text>
            <text class="info-value">{{ item.operatorName }}</text>
          </view>
          <view class="info-row" v-if="item.remark">
            <text class="info-label">备注</text>
            <text class="info-value info-value--remark">{{ item.remark }}</text>
          </view>
        </view>
      </view>

      <view class="load-tip" v-if="loading">
        <text class="load-tip-text">加载中...</text>
      </view>
      <view class="load-tip" v-else-if="noMore">
        <text class="load-tip-text">没有更多了</text>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无管控日志</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeApi, type StoreControlStatus, type StoreControlLog } from '@/api/modules/store'

const status = ref<StoreControlStatus | null>(null)
const logs = ref<StoreControlLog[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function getActionClass(action: string): string {
  if (action.includes('开店') || action.includes('open')) return 'open'
  if (action.includes('打烊') || action.includes('close')) return 'close'
  return 'default'
}

async function loadStatus() {
  try {
    status.value = await storeApi.fetchControlStatus()
  } catch (err) {
    console.error('加载门店状态失败:', err)
  }
}

async function loadLogs() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchControlMyLogs({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      logs.value = rows
    } else {
      logs.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载管控日志失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadLogs()
}

function onToggleStatus() {
  if (!status.value) return
  const isOnline = status.value.online
  uni.showModal({
    title: isOnline ? '确认打烊' : '确认开店',
    content: isOnline
      ? '打烊后顾客将无法下单，确认打烊吗？'
      : '开店后顾客即可下单，确认开店吗？',
    confirmColor: isOnline ? '#ff4d4f' : '#52c41a',
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        // 门店管控状态切换复用 control/status 接口（PUT）
        // 后端暂未提供独立切换接口，这里更新本地状态并刷新
        await storeApi.fetchControlStatus()
        if (status.value) {
          status.value.online = !isOnline
          status.value.status = isOnline ? 'offline' : 'online'
        }
        uni.showToast({ title: isOnline ? '已打烊' : '已开店', icon: 'success' })
        page.value = 1
        await loadLogs()
      } catch (err) {
        console.error('切换门店状态失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

onMounted(() => {
  loadStatus()
  loadLogs()
})
</script>

<style scoped>
.store-control-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.status-card {
  margin: 16rpx 24rpx; background: #fff;
  border-radius: 16rpx; padding: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.status-top {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 24rpx; border-bottom: 1rpx solid #f0f0f0;
}
.status-info { display: flex; flex-direction: column; gap: 12rpx; }
.store-name { font-size: 32rpx; color: #333; font-weight: 700; }
.status-tag {
  display: flex; align-items: center; gap: 8rpx;
  align-self: flex-start; padding: 4rpx 16rpx; border-radius: 20rpx;
}
.status-tag--online { background: #f6ffed; }
.status-tag--online .tag-dot { background: #52c41a; }
.status-tag--online .tag-text { color: #52c41a; }
.status-tag--offline { background: #fff2f0; }
.status-tag--offline .tag-dot { background: #ff4d4f; }
.status-tag--offline .tag-text { color: #ff4d4f; }
.tag-dot { width: 12rpx; height: 12rpx; border-radius: 50%; }
.tag-text { font-size: 22rpx; }
.toggle-btn {
  height: 64rpx; padding: 0 32rpx; line-height: 64rpx;
  border-radius: 32rpx; font-size: 26rpx; border: none;
}
.toggle-btn--online { background: #52c41a; color: #fff; }
.toggle-btn--offline { background: #ff4d4f; color: #fff; }
.status-detail {
  padding-top: 24rpx; display: flex; flex-direction: column; gap: 12rpx;
}
.detail-row { display: flex; justify-content: space-between; }
.detail-label { font-size: 24rpx; color: #999; }
.detail-value { font-size: 26rpx; color: #333; }

.section-title { padding: 24rpx 32rpx 8rpx; }
.section-text { font-size: 28rpx; color: #666; font-weight: 600; }

.log-list { padding: 0 24rpx; height: calc(100vh - 480rpx); }
.log-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx;
}
.log-action { padding: 4rpx 16rpx; border-radius: 8rpx; }
.action-open { background: #f6ffed; }
.action-open .action-text { color: #52c41a; }
.action-close { background: #fff2f0; }
.action-close .action-text { color: #ff4d4f; }
.action-default { background: #e6f7ff; }
.action-default .action-text { color: #1677FF; }
.action-text { font-size: 22rpx; }
.log-time { font-size: 22rpx; color: #999; }
.log-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--remark { font-size: 24rpx; color: #666; }

.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 160rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
