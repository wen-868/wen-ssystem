<template>
  <view class="bargain-detail-page">
    <scroll-view class="detail-scroll" scroll-y v-if="activity">
      <!-- 商品信息 -->
      <view class="product-section">
        <view class="product-image-wrap">
          <view class="product-image">
            <text class="image-icon">🍷</text>
          </view>
          <view class="bargain-badge">砍价</view>
        </view>
        <view class="product-info">
          <text class="product-name">{{ activity.activityName }}</text>
          <view class="price-row">
            <view class="price-main">
              <text class="price-label">底价</text>
              <text class="price-min">¥{{ activity.minPrice }}</text>
            </view>
            <view class="price-sub">
              <text class="price-label">原价</text>
              <text class="price-original">¥{{ activity.originalPrice }}</text>
            </view>
          </view>
          <view class="bargain-stats">
            <view class="stat-item">
              <text class="stat-value">{{ activity.totalStock - activity.soldCount }}</text>
              <text class="stat-label">剩余库存</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
              <text class="stat-value">{{ activity.bargainTimes }}</text>
              <text class="stat-label">最多砍几刀</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
              <text class="stat-value">{{ activity.timeLimitHours }}h</text>
              <text class="stat-label">有效期</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 砍价进度（我发起的砍价） -->
      <view class="section" v-if="myBargain">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">我的砍价进度</text>
        </view>
        <view class="bargain-progress-card">
          <view class="progress-header">
            <text class="progress-label">当前价</text>
            <text class="progress-price">¥{{ myBargain.currentPrice }}</text>
          </view>
          <view class="progress-bar-wrap">
            <view class="progress-bar">
              <view
                class="progress-fill"
                :style="{ width: progressPercent + '%' }"
              ></view>
            </view>
            <view class="progress-info">
              <text class="progress-start">¥{{ activity.originalPrice }}</text>
              <text class="progress-end">¥{{ activity.minPrice }}</text>
            </view>
          </view>
          <view class="progress-count">
            <text>已砍 {{ myBargain.bargainCount }} / {{ activity.bargainTimes }} 刀</text>
          </view>
          <view class="progress-status" :class="'status-' + myBargain.status">
            <text>{{ getBargainStatusLabel(myBargain.status) }}</text>
          </view>
        </view>
      </view>

      <!-- 活动规则 -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">活动规则</text>
        </view>
        <view class="rule-list">
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">发起砍价后，可邀请好友帮忙砍价</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">每位好友只能帮砍一次，砍价金额随机（¥{{ activity.helpMinAmount }}-¥{{ activity.helpMaxAmount }}）</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">砍价有效期{{ activity.timeLimitHours }}小时，超时未砍到底价则失效</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">砍到低价后，需在有效期内下单，否则过期失效</text>
          </view>
          <view class="rule-item" v-if="activity.activityDesc">
            <text class="rule-dot">·</text>
            <text class="rule-text">{{ activity.activityDesc }}</text>
          </view>
        </view>
      </view>

      <!-- 活动时间 -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">活动时间</text>
        </view>
        <view class="time-info">
          <view class="time-row">
            <text class="time-label">开始时间</text>
            <text class="time-value">{{ formatDateTime(activity.startTime) }}</text>
          </view>
          <view class="time-row">
            <text class="time-label">结束时间</text>
            <text class="time-value">{{ formatDateTime(activity.endTime) }}</text>
          </view>
        </view>
      </view>

      <!-- 帮砍记录（模拟） -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">砍价记录</text>
        </view>
        <view class="help-list" v-if="helpList.length > 0">
          <view class="help-item" v-for="help in helpList" :key="help.id">
            <view class="help-avatar">
              <text>{{ help.name.charAt(0) }}</text>
            </view>
            <view class="help-info">
              <text class="help-name">{{ help.name }}</text>
              <text class="help-time">{{ help.time }}</text>
            </view>
            <text class="help-amount">-¥{{ help.amount }}</text>
          </view>
        </view>
        <view class="empty-help" v-else>
          <text class="empty-text">暂无砍价记录</text>
        </view>
      </view>

      <view class="bottom-placeholder"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="activity">
      <view class="status-tag" :class="'tag-' + activity.status">
        <text>{{ getStatusLabel(activity.status) }}</text>
      </view>
      <button
        class="action-btn bargain-btn"
        :class="{ disabled: activity.status !== 'ACTIVE' }"
        :disabled="activity.status !== 'ACTIVE'"
        @tap="startBargain"
        v-if="!myBargain"
      >
        发起砍价
      </button>
      <button
        class="action-btn help-btn"
        :class="{ disabled: activity.status !== 'ACTIVE' || myBargain?.status === 'SUCCESS' }"
        :disabled="activity.status !== 'ACTIVE' || myBargain?.status === 'SUCCESS'"
        @tap="helpBargain"
        v-else-if="showHelpButton"
      >
        帮TA砍一刀
      </button>
      <button
        class="action-btn buy-btn"
        :class="{ disabled: myBargain?.status !== 'SUCCESS' }"
        :disabled="myBargain?.status !== 'SUCCESS'"
        @tap="buyWithBargain"
        v-else
      >
        立即购买
      </button>
    </view>

    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { communityMarketingApi, type BargainActivity, type BargainRecord } from '@/api/modules/community-marketing'

interface HelpRecord {
  id: number
  name: string
  time: string
  amount: number
}

const activity = ref<BargainActivity | null>(null)
const myBargain = ref<BargainRecord | null>(null)
const loading = ref(false)
const showHelpButton = ref(false)
const helpList = ref<HelpRecord[]>([
  { id: 1, name: '张三', time: '10分钟前', amount: 5.5 },
  { id: 2, name: '李四', time: '20分钟前', amount: 3.2 },
  { id: 3, name: '王五', time: '30分钟前', amount: 8.8 },
])

const progressPercent = computed(() => {
  if (!activity.value || !myBargain.value) return 0
  const total = activity.value.originalPrice - activity.value.minPrice
  const cut = activity.value.originalPrice - myBargain.value.currentPrice
  return total > 0 ? Math.min((cut / total) * 100, 100) : 0
})

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '未开始',
    ACTIVE: '进行中',
    ENDED: '已结束',
  }
  return map[status] || status
}

function getBargainStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ONGOING: '砍价中',
    SUCCESS: '砍价成功',
    FAILED: '砍价失败',
    EXPIRED: '已过期',
  }
  return map[status] || status
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 16)
}

async function loadDetail() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const id = Number(currentPage?.options?.id || 0)
  const recordId = Number(currentPage?.options?.recordId || 0)
  if (!id) return

  loading.value = true
  try {
    const result = await communityMarketingApi.getBargain(id)
    activity.value = result

    // 如果传入了recordId，表示是帮砍页面
    if (recordId) {
      showHelpButton.value = true
    }
  } catch (err) {
    console.error('加载砍价详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function startBargain() {
  if (!activity.value) return
  uni.showModal({
    title: '发起砍价',
    content: `确定发起砍价吗？邀请好友帮忙砍，最低可砍至¥${activity.value.minPrice}`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await communityMarketingApi.startBargain(activity.value!.id)
          myBargain.value = result
          uni.showToast({ title: '砍价发起成功', icon: 'success' })
        } catch (err) {
          console.error('发起砍价失败:', err)
        }
      }
    }
  })
}

function helpBargain() {
  if (!activity.value) return
  uni.showModal({
    title: '帮砍确认',
    content: '确定帮好友砍一刀吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          // 模拟使用第一个记录
          const result = await communityMarketingApi.helpBargain(1, '测试用户')
          uni.showToast({ title: `砍了¥${result.bargainAmount}`, icon: 'success' })
          // 更新进度
          if (myBargain.value) {
            myBargain.value.currentPrice = result.currentPrice
            myBargain.value.bargainCount = result.bargainCount
            myBargain.value.status = result.status as any
          }
        } catch (err) {
          console.error('帮砍失败:', err)
        }
      }
    }
  })
}

function buyWithBargain() {
  uni.showToast({ title: '前往下单', icon: 'none' })
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.bargain-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
  position: relative;
}

.detail-scroll {
  height: calc(100vh - 120rpx);
}

.product-section {
  background: #fff;
  padding: 24rpx;
  display: flex;
  gap: 24rpx;
  margin-bottom: 16rpx;
}

.product-image-wrap {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff1f0, #ffccc7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 70rpx;
}

.bargain-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: #ff4d4f;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-bottom-right-radius: 12rpx;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.product-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.price-row {
  display: flex;
  align-items: flex-end;
  gap: 24rpx;
}

.price-main {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.price-sub {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.price-label {
  font-size: 20rpx;
  color: #999;
}

.price-min {
  font-size: 40rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.price-original {
  font-size: 26rpx;
  color: #bbb;
  text-decoration: line-through;
}

.bargain-stats {
  display: flex;
  align-items: center;
  background: #f9f9f9;
  border-radius: 8rpx;
  padding: 12rpx 0;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 20rpx;
  color: #999;
  margin-top: 4rpx;
}

.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: #e8e8e8;
}

.section {
  background: #fff;
  margin-bottom: 16rpx;
  padding: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title-bar {
  width: 6rpx;
  height: 28rpx;
  background: #ff4d4f;
  border-radius: 3rpx;
  margin-right: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.bargain-progress-card {
  background: linear-gradient(135deg, #fff1f0, #fff7e6);
  border-radius: 12rpx;
  padding: 24rpx;
}

.progress-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.progress-label {
  font-size: 24rpx;
  color: #666;
}

.progress-price {
  font-size: 40rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.progress-bar-wrap {
  margin-bottom: 12rpx;
}

.progress-bar {
  height: 16rpx;
  background: #ffccc7;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4d4f, #ff7a45);
  border-radius: 8rpx;
  transition: width 0.3s;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
}

.progress-start,
.progress-end {
  font-size: 20rpx;
  color: #999;
}

.progress-count {
  text-align: center;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.progress-status {
  text-align: center;
  padding: 8rpx 0;
  border-radius: 20rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.progress-status.status-ONGOING {
  background: #e6f7ff;
  color: #1677FF;
}

.progress-status.status-SUCCESS {
  background: #f6ffed;
  color: #52c41a;
}

.progress-status.status-FAILED,
.progress-status.status-EXPIRED {
  background: #f5f5f5;
  color: #999;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
}

.rule-dot {
  color: #ff4d4f;
  font-size: 24rpx;
  line-height: 1.6;
}

.rule-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
  flex: 1;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-label {
  font-size: 26rpx;
  color: #999;
}

.time-value {
  font-size: 26rpx;
  color: #333;
}

.help-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.help-item {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  gap: 16rpx;
}

.help-item:last-child {
  border-bottom: none;
}

.help-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #ff4d4f;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.help-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.help-name {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.help-time {
  font-size: 22rpx;
  color: #999;
}

.help-amount {
  font-size: 28rpx;
  font-weight: 600;
  color: #ff4d4f;
  flex-shrink: 0;
}

.empty-help {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: #999;
}

.bottom-placeholder {
  height: 140rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.status-tag {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.tag-DRAFT { background: #e6f7ff; color: #1677FF; }
.tag-ACTIVE { background: #f6ffed; color: #52c41a; }
.tag-ENDED { background: #f5f5f5; color: #999; }

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.action-btn::after {
  border: none;
}

.bargain-btn {
  background: linear-gradient(135deg, #ff4d4f, #ff7a45);
  color: #fff;
}

.help-btn {
  background: linear-gradient(135deg, #fa8c16, #ffa940);
  color: #fff;
}

.buy-btn {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
}

.action-btn.disabled {
  background: #d9d9d9;
  color: #fff;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
