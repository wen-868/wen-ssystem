<template>
  <view class="member-page">
    <view class="page-header">
      <text class="header-title">会员识别</text>
    </view>

    <!-- 会员搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="输入手机号 / 会员姓名 / 会员卡号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <view class="search-btn" @tap="onSearch">
          <text class="search-btn-text">查询</text>
        </view>
      </view>
    </view>

    <!-- 扫码识别 -->
    <view class="scan-entry" @tap="onScanCode">
      <text class="scan-icon">&#xe617;</text>
      <text class="scan-text">扫会员码识别</text>
    </view>

    <!-- 会员详情 -->
    <view class="member-card" v-if="currentMember">
      <view class="member-header">
        <view class="member-avatar">
          <text class="avatar-text">{{ (currentMember.name || currentMember.mobile || '?').charAt(0) }}</text>
        </view>
        <view class="member-base">
          <text class="member-name">{{ currentMember.name || '匿名会员' }}</text>
          <text class="member-mobile" v-if="currentMember.mobile">{{ currentMember.mobile }}</text>
          <view class="member-level" v-if="currentMember.levelName">
            <text class="level-text">{{ currentMember.levelName }}</text>
          </view>
        </view>
      </view>

      <view class="member-stats">
        <view class="stat-item">
          <text class="stat-value">{{ currentMember.points ?? 0 }}</text>
          <text class="stat-label">积分</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ Number(currentMember.balance || 0).toFixed(2) }}</text>
          <text class="stat-label">余额</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ Number(currentMember.totalSpent || 0).toFixed(2) }}</text>
          <text class="stat-label">累计消费</text>
        </view>
      </view>

      <view class="member-actions">
        <view class="action-btn action-btn--primary" @tap="goPointsHistory">积分明细</view>
        <view class="action-btn" @tap="goOrders">消费记录</view>
      </view>
    </view>

    <!-- 搜索结果列表 -->
    <view class="section-title" v-if="!currentMember && searchResults.length > 0">
      <text class="section-text">搜索结果（{{ searchResults.length }}）</text>
    </view>
    <scroll-view class="result-list" scroll-y v-if="!currentMember && searchResults.length > 0">
      <view
        class="result-item"
        v-for="item in searchResults"
        :key="item.id"
        @tap="selectMember(item)"
      >
        <view class="result-avatar">
          <text class="avatar-text">{{ (item.name || item.mobile || '?').charAt(0) }}</text>
        </view>
        <view class="result-info">
          <view class="result-name-row">
            <text class="result-name">{{ item.name || '匿名会员' }}</text>
            <view class="result-level" v-if="item.levelName">
              <text class="level-text">{{ item.levelName }}</text>
            </view>
          </view>
          <text class="result-mobile" v-if="item.mobile">{{ item.mobile }}</text>
          <text class="result-points">积分：{{ item.points ?? 0 }}</text>
        </view>
        <text class="result-arrow">&#xe616;</text>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-if="!currentMember && searchResults.length === 0 && hasSearched && !loading">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">未找到匹配会员</text>
      <text class="empty-hint">请确认手机号 / 姓名 / 会员卡号后重试</text>
    </view>

    <view class="empty-state" v-if="!currentMember && searchResults.length === 0 && !hasSearched && !loading">
      <text class="empty-icon">&#xe612;</text>
      <text class="empty-text">输入信息查询会员</text>
      <text class="empty-hint">支持手机号、姓名、会员卡号</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeApi, type StoreMember } from '@/api/modules/store'

const keyword = ref('')
const loading = ref(false)
const hasSearched = ref(false)
const searchResults = ref<StoreMember[]>([])
const currentMember = ref<StoreMember | null>(null)

async function onSearch() {
  if (!keyword.value.trim()) {
    uni.showToast({ title: '请输入查询信息', icon: 'none' })
    return
  }
  currentMember.value = null
  loading.value = true
  hasSearched.value = true
  try {
    uni.showLoading({ title: '查询中...' })
    const res = await storeApi.searchMember(keyword.value.trim())
    // 兼容返回数组或 { records: [] }
    const rows = Array.isArray(res) ? res : (res?.records || [])
    searchResults.value = rows
    // 如果只命中一条，直接展示详情
    if (rows.length === 1) {
      await selectMember(rows[0])
    }
  } catch (err) {
    console.error('会员查询失败:', err)
    searchResults.value = []
  } finally {
    loading.value = false
    uni.hideLoading()
  }
}

async function selectMember(member: StoreMember) {
  searchResults.value = []
  currentMember.value = member
  // 拉取详情补充积分等字段
  try {
    const detail = await storeApi.getMemberDetail(member.id)
    currentMember.value = { ...member, ...detail }
  } catch (err) {
    console.error('加载会员详情失败:', err)
  }
}

function onScanCode() {
  uni.scanCode?.({
    onlyFromCamera: false,
    success: async (res: any) => {
      const code = res.result || ''
      if (!code) return
      keyword.value = code
      await onSearch()
    },
    fail: () => {
      uni.showToast({ title: '扫码取消或失败', icon: 'none' })
    },
  })
}

function goPointsHistory() {
  if (!currentMember.value) return
  uni.navigateTo({ url: `/pages/points/points-detail?memberId=${currentMember.value.id}` })
}

function goOrders() {
  if (!currentMember.value) return
  uni.navigateTo({ url: `/pages/orders/orders?memberId=${currentMember.value.id}` })
}
</script>

<style scoped>
.member-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: #f5f7fa;
  border-radius: 36rpx; padding: 0 8rpx 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-btn {
  height: 56rpx; padding: 0 28rpx; line-height: 56rpx;
  background: #fa8c16; border-radius: 28rpx; margin-left: 8rpx;
}
.search-btn-text { font-size: 26rpx; color: #fff; }

.scan-entry {
  display: flex; align-items: center; justify-content: center;
  gap: 12rpx; margin: 16rpx 24rpx; padding: 24rpx;
  background: #fff; border-radius: 16rpx;
  border: 2rpx dashed #fa8c16;
}
.scan-icon { font-size: 40rpx; color: #fa8c16; }
.scan-text { font-size: 28rpx; color: #fa8c16; font-weight: 600; }

.member-card {
  margin: 16rpx 24rpx; background: #fff;
  border-radius: 16rpx; padding: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.member-header {
  display: flex; align-items: center; gap: 24rpx;
  padding-bottom: 24rpx; border-bottom: 1rpx solid #f0f0f0;
}
.member-avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: linear-gradient(135deg, #fa8c16, #ffa940);
  display: flex; align-items: center; justify-content: center;
}
.avatar-text { font-size: 40rpx; color: #fff; font-weight: 700; }
.member-base { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.member-name { font-size: 32rpx; color: #333; font-weight: 600; }
.member-mobile { font-size: 24rpx; color: #999; }
.member-level {
  align-self: flex-start; padding: 2rpx 12rpx;
  background: #fff7e6; border-radius: 12rpx; margin-top: 4rpx;
}
.level-text { font-size: 20rpx; color: #fa8c16; }
.member-stats {
  display: flex; padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.stat-value { font-size: 32rpx; color: #fa8c16; font-weight: 700; }
.stat-label { font-size: 22rpx; color: #999; }
.member-actions {
  display: flex; gap: 16rpx; padding-top: 24rpx;
}
.action-btn {
  flex: 1; height: 72rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: 36rpx; font-size: 26rpx;
  background: #f5f7fa; color: #666;
}
.action-btn--primary { background: #fa8c16; color: #fff; }

.section-title { padding: 24rpx 32rpx 8rpx; }
.section-text { font-size: 28rpx; color: #666; font-weight: 600; }
.result-list { padding: 0 24rpx; height: calc(100vh - 360rpx); }
.result-item {
  display: flex; align-items: center; gap: 16rpx;
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.result-avatar {
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #40a9ff);
  display: flex; align-items: center; justify-content: center;
}
.result-avatar .avatar-text { font-size: 32rpx; }
.result-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.result-name-row { display: flex; align-items: center; gap: 12rpx; }
.result-name { font-size: 28rpx; color: #333; font-weight: 600; }
.result-level { padding: 2rpx 10rpx; background: #fff7e6; border-radius: 8rpx; }
.result-mobile { font-size: 22rpx; color: #999; }
.result-points { font-size: 22rpx; color: #fa8c16; }
.result-arrow { font-size: 32rpx; color: #ccc; }

.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 160rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; margin-bottom: 8rpx; }
.empty-hint { font-size: 22rpx; color: #ccc; }
.safe-bottom { height: 40rpx; }
</style>
