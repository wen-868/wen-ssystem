<template>
  <view class="group-detail-page">
    <scroll-view class="detail-scroll" scroll-y v-if="activity">
      <!-- 商品信息 -->
      <view class="product-section">
        <view class="product-image-wrap">
          <view class="product-image">
            <text class="image-icon">🍷</text>
          </view>
          <view class="group-badge">拼团</view>
        </view>
        <view class="product-info">
          <text class="product-name">{{ activity.name }}</text>
          <view class="price-row">
            <text class="group-price-symbol">¥</text>
            <text class="group-price">{{ activity.groupPrice }}</text>
            <text class="original-price">¥{{ activity.originalPrice }}</text>
          </view>
          <view class="group-stats">
            <view class="stat-item">
              <text class="stat-value">{{ activity.minGroupSize }}</text>
              <text class="stat-label">人成团</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
              <text class="stat-value">{{ activity.soldCount }}</text>
              <text class="stat-label">已团人数</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
              <text class="stat-value">{{ activity.totalStock - activity.soldCount }}</text>
              <text class="stat-label">剩余库存</text>
            </view>
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
            <text class="rule-text">{{ activity.minGroupSize }}人成团，满员即拼团成功</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">拼团有效期{{ activity.timeLimitHours }}小时，超时未成团自动退款</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">每人可发起或参与多个拼团</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">拼团成功后按订单正常发货</text>
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

      <!-- 拼团列表（模拟数据） -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">正在拼团</text>
        </view>
        <view class="team-list" v-if="teamList.length > 0">
          <view class="team-item" v-for="team in teamList" :key="team.id">
            <view class="team-avatars">
              <view class="avatar" v-for="(avatar, idx) in team.avatars" :key="idx">
                <text>{{ avatar }}</text>
              </view>
              <view class="avatar-more" v-if="team.currentSize < team.targetSize">
                <text>+{{ team.targetSize - team.currentSize }}</text>
              </view>
            </view>
            <view class="team-info">
              <text class="team-leader">{{ team.leaderName }}的团</text>
              <view class="team-progress">
                <view class="progress-bar">
                  <view class="progress-fill" :style="{ width: (team.currentSize / team.targetSize * 100) + '%' }"></view>
                </view>
                <text class="progress-text">{{ team.currentSize }}/{{ team.targetSize }}人</text>
              </view>
            </view>
            <button class="join-btn" @tap.stop="joinTeam(team.id)">去参团</button>
          </view>
        </view>
        <view class="empty-team" v-else>
          <text class="empty-text">暂无正在进行的拼团，快来发起第一个吧！</text>
        </view>
      </view>

      <view class="bottom-placeholder"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="activity">
      <view class="status-info">
        <view class="status-tag" :class="'tag-' + activity.status">
          <text>{{ getStatusLabel(activity.status) }}</text>
        </view>
      </view>
      <button
        class="action-btn start-btn"
        :class="{ disabled: activity.status !== 'ACTIVE' }"
        :disabled="activity.status !== 'ACTIVE'"
        @tap="startGroupBuy"
      >
        发起拼团
      </button>
    </view>

    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { communityMarketingApi, type GroupBuyActivity } from '@/api/modules/community-marketing'

interface TeamItem {
  id: number
  leaderName: string
  currentSize: number
  targetSize: number
  avatars: string[]
}

const activity = ref<GroupBuyActivity | null>(null)
const loading = ref(false)
const teamList = ref<TeamItem[]>([
  { id: 1, leaderName: '张先生', currentSize: 2, targetSize: 5, avatars: ['张', '李'] },
  { id: 2, leaderName: '王女士', currentSize: 3, targetSize: 5, avatars: ['王', '赵', '刘'] },
  { id: 3, leaderName: '陈先生', currentSize: 1, targetSize: 5, avatars: ['陈'] },
])

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '未开始',
    ACTIVE: '进行中',
    ENDED: '已结束',
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
  if (!id) return

  loading.value = true
  try {
    const result = await communityMarketingApi.getGroupBuy(id)
    activity.value = result
  } catch (err) {
    console.error('加载拼团详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function startGroupBuy() {
  if (!activity.value) return
  uni.showModal({
    title: '发起拼团',
    content: `确定以¥${activity.value.groupPrice}的拼团价发起${activity.value.minGroupSize}人团吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await communityMarketingApi.startGroupBuy(activity.value!.id)
          uni.showToast({ title: '拼团发起成功', icon: 'success' })
        } catch (err) {
          console.error('发起拼团失败:', err)
        }
      }
    }
  })
}

function joinTeam(teamId: number) {
  uni.showModal({
    title: '参团确认',
    content: '确定加入该拼团吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await communityMarketingApi.joinGroupBuy(teamId)
          uni.showToast({ title: '参团成功', icon: 'success' })
        } catch (err) {
          console.error('参团失败:', err)
        }
      }
    }
  })
}

onMounted(() => {
  loadDetail()
})
</script>

<style lang="scss" scoped>
.group-detail-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  position: relative;
}

.detail-scroll {
  height: calc(100vh - 120rpx);
}

.product-section {
  background: $uni-bg-color;
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
  background: linear-gradient(135deg, $uni-color-success-soft, $uni-color-success-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 70rpx;
}

.group-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: $uni-color-success;
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
  align-items: baseline;
  gap: 4rpx;
}

.group-price-symbol {
  font-size: 24rpx;
  color: $uni-color-success;
  font-weight: 600;
}

.group-price {
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-color-success;
}

.original-price {
  font-size: 24rpx;
  color: $uni-gray-300;
  text-decoration: line-through;
  margin-left: 12rpx;
}

.group-stats {
  display: flex;
  align-items: center;
  background: $uni-gray-50;
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
  background: $uni-color-success;
  border-radius: 3rpx;
  margin-right: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
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
  color: $uni-color-success;
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
  gap: 12rpx;
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

.team-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.team-item {
  display: flex;
  align-items: center;
  padding: 16rpx;
  background: $uni-gray-50;
  border-radius: 12rpx;
  gap: 16rpx;
}

.team-avatars {
  display: flex;
  align-items: center;
}

.avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $uni-color-success;
  color: $uni-text-color-inverse;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -12rpx;
  border: 2rpx solid $uni-bg-color;
}

.avatar:first-child {
  margin-left: 0;
}

.avatar-more {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $uni-gray-100;
  color: $uni-gray-400;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -12rpx;
  border: 2rpx solid $uni-bg-color;
}

.team-info {
  flex: 1;
  min-width: 0;
}

.team-leader {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
  display: block;
  margin-bottom: 8rpx;
}

.team-progress {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.progress-bar {
  flex: 1;
  height: 12rpx;
  background: $uni-gray-200;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $uni-color-success, $uni-color-success);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.join-btn {
  flex-shrink: 0;
  height: 56rpx;
  padding: 0 24rpx;
  background: $uni-color-success;
  color: $uni-text-color-inverse;
  font-size: 24rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.join-btn::after {
  border: none;
}

.empty-team {
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
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.status-info {
  flex-shrink: 0;
}

.status-tag {
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

.start-btn {
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
  color: $uni-text-color-inverse;
}

.start-btn.disabled {
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
</style>
