<template>
  <view class="bargain-detail-page">
    <page-header title="砍价详情" @back="goBack" />
    <scroll-view class="detail-scroll" scroll-y v-if="activity">
      <!-- 商品信息 -->
      <view class="product-section">
        <view class="product-image-wrap">
          <view class="product-image">
            <image class="image-icon-img" src="/static/icons/ic/wine.svg" mode="aspectFit" />
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

      <!-- 砍价参与记录 -->
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
            <text class="help-status">{{ help.statusText }}</text>
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
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
import { ref, computed, onMounted } from 'vue'
import { communityMarketingApi, type BargainActivity, type BargainRecord } from '@/api/modules/community-marketing'
import { getUser } from '@/api/storage'

interface HelpRecord {
  id: number
  name: string
  time: string
  statusText: string
}

const activity = ref<BargainActivity | null>(null)
const myBargain = ref<BargainRecord | null>(null)
const loading = ref(false)
const showHelpButton = ref(false)
const helpList = ref<HelpRecord[]>([])

function getBargainStatusText(status: string): string {
  const map: Record<string, string> = {
    ONGOING: '砍价中',
    SUCCESS: '砍价成功',
    FAILED: '砍价失败',
    EXPIRED: '已过期',
  }
  return map[status] || status || ''
}

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

    // 砍价参与记录（真实接口 GET /marketing/bargain/:id/records）
    try {
      const records = await communityMarketingApi.getBargainRecords(id, { page: 1, pageSize: 50 })
      helpList.value = (records.records || []).map((r) => ({
        id: r.id,
        name: r.memberName || '匿名用户',
        time: formatDateTime(r.participationTime),
        statusText: getBargainStatusText(r.status),
      }))
    } catch (err) {
      console.error('加载砍价记录失败:', err)
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
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const recordId = Number(currentPage?.options?.recordId || 0)
  if (!activity.value || !recordId) {
    uni.showToast({ title: '缺少砍价记录，无法帮砍', icon: 'none' })
    return
  }
  const user = getUser()
  uni.showModal({
    title: '帮砍确认',
    content: '确定帮好友砍一刀吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await communityMarketingApi.helpBargain(
            recordId,
            user?.realName || user?.name || user?.username || ''
          )
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

<style lang="scss" scoped>
.bargain-detail-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  position: relative;
}

.detail-scroll {
  height: calc(100vh - 120rpx);
}

.product-section {
  background: $uni-bg-color;
  padding: $uni-spacing-base;
  display: flex;
  gap: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
}

.product-image-wrap {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  position: relative;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $uni-color-error-soft, $uni-color-error-soft);
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
  background: $uni-color-error;
  color: $uni-text-color-inverse;
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
  color: $uni-gray-700;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.price-row {
  display: flex;
  align-items: flex-end;
  gap: $uni-spacing-base;
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
  color: $uni-gray-400;
}

.price-min {
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-color-error;
}

.price-original {
  font-size: 26rpx;
  color: $uni-gray-300;
  text-decoration: line-through;
}

.bargain-stats {
  display: flex;
  align-items: center;
  background: $uni-gray-50;
  border-radius: 8rpx;
  padding: $uni-spacing-sm 0;
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
  color: $uni-gray-700;
}

.stat-label {
  font-size: 20rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
}

.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: $uni-gray-200;
}

.section {
  background: $uni-bg-color;
  margin-bottom: $uni-spacing-sm;
  padding: $uni-spacing-base;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title-bar {
  width: 6rpx;
  height: 28rpx;
  background: $uni-color-error;
  border-radius: 3rpx;
  margin-right: 12rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.bargain-progress-card {
  background: linear-gradient(135deg, $uni-color-error-soft, $uni-color-warning-soft);
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
}

.progress-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.progress-label {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.progress-price {
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-color-error;
}

.progress-bar-wrap {
  margin-bottom: $uni-spacing-sm;
}

.progress-bar {
  height: 16rpx;
  background: $uni-color-error-soft;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $uni-color-error, $uni-color-warning);
  border-radius: 8rpx;
  transition: width 0.3s;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: $uni-spacing-xs;
}

.progress-start,
.progress-end {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.progress-count {
  text-align: center;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-bottom: $uni-spacing-sm;
}

.progress-status {
  text-align: center;
  padding: 8rpx 0;
  border-radius: 20rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.progress-status.status-ONGOING {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

.progress-status.status-SUCCESS {
  background: $uni-color-success-soft;
  color: $uni-color-success;
}

.progress-status.status-FAILED,
.progress-status.status-EXPIRED {
  background: $uni-bg-color-grey;
  color: $uni-gray-400;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: $uni-spacing-xs;
}

.rule-dot {
  color: $uni-color-error;
  font-size: 24rpx;
  line-height: 1.6;
}

.rule-text {
  font-size: 24rpx;
  color: $uni-gray-500;
  line-height: 1.6;
  flex: 1;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-label {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.time-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.help-list {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
}

.help-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-sm 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  gap: $uni-spacing-sm;
}

.help-item:last-child {
  border-bottom: none;
}

.help-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-color-error;
  color: $uni-text-color-inverse;
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
  color: $uni-gray-700;
  font-weight: 500;
}

.help-time {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.help-status {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-color-primary;
  flex-shrink: 0;
}

.empty-help {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: $uni-gray-400;
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
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 12rpx $zx-black-60;
  gap: 20rpx;
}

.status-tag {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.tag-DRAFT { background: $uni-color-primary-soft; color: $uni-color-primary; }
.tag-ACTIVE { background: $uni-color-success-soft; color: $uni-color-success; }
.tag-ENDED { background: $uni-bg-color-grey; color: $uni-gray-400; }

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
  background: linear-gradient(135deg, $uni-color-error, $uni-color-warning);
  color: $uni-text-color-inverse;
}

.help-btn {
  background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning);
  color: $uni-text-color-inverse;
}

.buy-btn {
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
  color: $uni-text-color-inverse;
}

.action-btn.disabled {
  background: $uni-gray-300;
  color: $uni-text-color-inverse;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
  color: $uni-gray-400;
  font-size: 28rpx;
}

.image-icon-img{width:120rpx;height:120rpx}
.empty-icon-img{width:96rpx;height:96rpx}
</style>
