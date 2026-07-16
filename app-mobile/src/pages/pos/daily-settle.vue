<template>
  <view class="daily-settle-page">
    <view class="page-header">
      <text class="header-title">日结管理</text>
    </view>

    <!-- 今日概况 -->
    <view class="overview-card">
      <view class="overview-top">
        <text class="overview-date">{{ settleDate }}</text>
        <button
          class="settle-btn"
          :disabled="submitting"
          @tap="onSubmitSettle"
        >{{ submitting ? '提交中...' : '提交日结' }}</button>
      </view>
      <view class="overview-amount">
        <text class="amount-label">今日销售总额</text>
        <text class="amount-value">¥{{ todayAmount.toFixed(2) }}</text>
      </view>
      <view class="overview-stats">
        <view class="stat-item">
          <text class="stat-value">{{ todayCount }}</text>
          <text class="stat-label">订单数</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ cashAmount.toFixed(2) }}</text>
          <text class="stat-label">现金</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ wechatAmount.toFixed(2) }}</text>
          <text class="stat-label">微信</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ alipayAmount.toFixed(2) }}</text>
          <text class="stat-label">支付宝</text>
        </view>
      </view>
    </view>

    <!-- 日结历史 -->
    <view class="section-title">
      <text class="section-text">日结历史</text>
    </view>

    <scroll-view
      class="settle-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="settle-card" v-for="item in list" :key="item.id">
        <view class="card-header">
          <text class="settle-date">{{ item.settleDate }}</text>
          <view class="settle-status" :class="'status-' + (item.status || 'completed')">
            <text class="status-text">{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">销售总额</text>
            <text class="info-value info-value--price">¥{{ Number(item.totalAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">订单数</text>
            <text class="info-value">{{ item.totalCount || 0 }} 单</text>
          </view>
          <view class="info-row" v-if="item.operatorName">
            <text class="info-label">操作人</text>
            <text class="info-value">{{ item.operatorName }}</text>
          </view>
          <view class="info-row" v-if="item.createdAt">
            <text class="info-label">提交时间</text>
            <text class="info-value">{{ item.createdAt }}</text>
          </view>
        </view>
        <view class="amount-detail" v-if="item.cashAmount != null || item.wechatAmount != null">
          <view class="amount-item">
            <text class="amount-label">现金</text>
            <text class="amount-value">¥{{ Number(item.cashAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="amount-item">
            <text class="amount-label">微信</text>
            <text class="amount-value">¥{{ Number(item.wechatAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="amount-item">
            <text class="amount-label">支付宝</text>
            <text class="amount-value">¥{{ Number(item.alipayAmount || 0).toFixed(2) }}</text>
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
      <text class="empty-text">暂无日结记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeApi, type DailySettleRecord } from '@/api/modules/store'

const settleDate = ref(formatDate(new Date()))
const todayAmount = ref(0)
const todayCount = ref(0)
const cashAmount = ref(0)
const wechatAmount = ref(0)
const alipayAmount = ref(0)

const list = ref<DailySettleRecord[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 30
const noMore = ref(false)
const submitting = ref(false)

function getStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    completed: '已完成',
    pending: '待提交',
    processing: '处理中',
  }
  return map[status || 'completed'] || status || '已完成'
}

async function loadOverview() {
  try {
    const dashboard = await storeApi.fetchDashboard()
    todayAmount.value = Number(dashboard?.todayAmount ?? dashboard?.todaySales ?? 0)
    todayCount.value = Number(dashboard?.todayOrders ?? 0)
  } catch (err) {
    console.error('加载概况失败:', err)
  }
}

async function loadHistory() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchDailySettleHistory({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载日结历史失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadHistory()
}

function onSubmitSettle() {
  uni.showModal({
    title: '提交日结',
    content: `确认提交 ${settleDate.value} 的日结吗？提交后当日销售数据将归档。`,
    success: async (res) => {
      if (!res.confirm) return
      submitting.value = true
      try {
        uni.showLoading({ title: '提交中...' })
        await storeApi.submitDailySettle({ settleDate: settleDate.value })
        uni.showToast({ title: '日结提交成功', icon: 'success' })
        // 刷新历史与概况
        page.value = 1
        await loadHistory()
        await loadOverview()
      } catch (err) {
        console.error('日结提交失败:', err)
      } finally {
        submitting.value = false
        uni.hideLoading()
      }
    },
  })
}

function formatDate(date: Date): string {
  const pad = (n: number) => n < 10 ? '0' + n : '' + n
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

onMounted(() => {
  loadOverview()
  loadHistory()
})
</script>

<style scoped>
.daily-settle-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.overview-card {
  margin: 16rpx 24rpx; background: linear-gradient(135deg, #fa8c16, #ffa940);
  border-radius: 16rpx; padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(250,140,22,0.2);
}
.overview-top {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24rpx;
}
.overview-date { font-size: 30rpx; color: #fff; font-weight: 600; }
.settle-btn {
  height: 64rpx; padding: 0 32rpx; line-height: 64rpx;
  background: #fff; color: #fa8c16; border-radius: 32rpx;
  font-size: 26rpx; border: none; font-weight: 600;
}
.settle-btn[disabled] { color: #ccc; }
.overview-amount { margin-bottom: 24rpx; }
.amount-label { font-size: 24rpx; color: rgba(255,255,255,0.8); display: block; margin-bottom: 8rpx; }
.amount-value { font-size: 56rpx; color: #fff; font-weight: 700; }
.overview-stats {
  display: flex; background: rgba(255,255,255,0.15);
  border-radius: 12rpx; padding: 16rpx 0;
}
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.stat-value { font-size: 28rpx; color: #fff; font-weight: 600; }
.stat-label { font-size: 22rpx; color: rgba(255,255,255,0.8); }

.section-title { padding: 24rpx 32rpx 8rpx; }
.section-text { font-size: 28rpx; color: #666; font-weight: 600; }

.settle-list { padding: 0 24rpx; height: calc(100vh - 540rpx); }
.settle-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.settle-date { font-size: 28rpx; color: #333; font-weight: 600; }
.settle-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-processing { background: #e6f7ff; }
.status-processing .status-text { color: #1677FF; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--price { color: #fa8c16; font-weight: 600; }
.amount-detail {
  display: flex; gap: 16rpx; margin-top: 16rpx;
  padding: 16rpx; background: #fafafa; border-radius: 12rpx;
}
.amount-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.amount-label { font-size: 22rpx; color: #999; }
.amount-value { font-size: 24rpx; color: #666; }

.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
