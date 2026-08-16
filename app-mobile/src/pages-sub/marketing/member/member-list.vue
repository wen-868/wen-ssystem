<template>
  <view class="member-list-page">
    <!-- 页头 -->
    <view class="page-header">
      <view class="header-back" @tap="goBack">
        <text class="header-back-icon">‹</text>
      </view>
      <text class="header-title">会员管理</text>
    </view>

    <!-- 统计卡 -->
    <view class="stats-grid">
      <view class="stats-card">
        <text class="stats-value">{{ stats.totalMembers }}</text>
        <text class="stats-label">总会员</text>
      </view>
      <view class="stats-card">
        <text class="stats-value stats-value--up">+{{ stats.monthNew }}</text>
        <text class="stats-label">本月新增</text>
      </view>
      <view class="stats-card">
        <text class="stats-value">{{ stats.activeRate }}%</text>
        <text class="stats-label">活跃率</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索会员姓名 / 手机号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="reload"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 会员列表 -->
    <view class="loading-overlay" v-if="loading && list.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <scroll-view class="member-scroll" scroll-y :show-scrollbar="false" @scrolltolower="onLoadMore">
      <view class="member-item" v-for="m in list" :key="m.id" @tap="goDetail(m.id)">
        <view class="member-avatar">
          <text class="avatar-letter">{{ (m.name || '会').charAt(0) }}</text>
        </view>
        <view class="member-info">
          <view class="member-name-row">
            <text class="member-name">{{ m.name || '会员' }}</text>
            <text class="level-tag" v-if="m.levelName">{{ m.levelName }}</text>
            <text class="level-tag level-tag--plain" v-else>普通</text>
          </view>
          <view class="member-meta">
            <text class="meta-text">最近消费：{{ formatDate(m.lastOrderAt) || '—' }}</text>
          </view>
        </view>
        <view class="member-right">
          <text class="consume-label">累计消费</text>
          <text class="consume-value">¥{{ formatAmount(m.totalConsume) }}</text>
        </view>
      </view>

      <view class="empty-state" v-if="!loading && list.length === 0">
        <text class="empty-text">暂无会员数据</text>
      </view>

      <view class="load-more" v-if="list.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface MemberRow {
  id: number
  name: string
  mobile: string
  levelCode: string
  levelName: string
  points: number
  lastOrderAt: string | null
  createdAt: string
  totalConsume: number
}

const list = ref<MemberRow[]>([])
const stats = ref({ totalMembers: 0, monthNew: 0, activeRate: 0 })
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function goDetail(id: number) {
  // 会员详情接口已就绪（/store/members/:id），详情页待后续补齐
  uni.showToast({ title: `会员 #${id} 详情开发中`, icon: 'none' })
}

function formatAmount(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return Number(v || 0).toFixed(2)
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return String(d).slice(0, 10)
}

async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    const p = reset ? 1 : page.value
    const res: any = await get('/store/members/manage', { page: p, pageSize, keyword: keyword.value })
    const data = res?.data ?? res ?? {}
    const rows: MemberRow[] = data.records ?? []
    if (reset) list.value = rows
    else list.value = list.value.concat(rows)
    page.value = p + 1
    noMore.value = rows.length < pageSize
    if (data.stats) stats.value = data.stats
  } catch (err) {
    console.error('加载会员列表失败:', err)
  } finally {
    loading.value = false
  }
}

function reload() {
  list.value = []
  page.value = 1
  noMore.value = false
  load(true)
}

function clearSearch() {
  keyword.value = ''
  reload()
}

function onLoadMore() {
  if (!noMore.value && !loadingMore.value) {
    loadingMore.value = true
    load(false).finally(() => (loadingMore.value = false))
  }
}

onMounted(() => load(true))
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.member-list-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  background: #fff;
}
.header-back {
  padding: 8rpx 16rpx 8rpx 0;
}
.header-back-icon {
  font-size: 44rpx;
  color: #333;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
}

.stats-grid {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx;
}
.stats-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.stats-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2937;
}
.stats-value--up {
  color: #10b981;
}
.stats-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.search-bar {
  padding: 0 24rpx 16rpx;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 68rpx;
}
.search-icon {
  color: #9ca3af;
  margin-right: 12rpx;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
}
.search-clear {
  color: #9ca3af;
}

.member-scroll {
  flex: 1;
  padding: 0 24rpx;
}
.member-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
}
.member-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-letter {
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}
.member-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.member-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.member-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.level-tag {
  font-size: 20rpx;
  color: #7c3aed;
  background: #ede9fe;
  border-radius: 8rpx;
  padding: 2rpx 10rpx;
}
.level-tag--plain {
  color: #6b7280;
  background: #f3f4f6;
}
.member-meta {
  margin-top: 8rpx;
}
.meta-text {
  font-size: 22rpx;
  color: #9ca3af;
}
.member-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}
.consume-label {
  font-size: 20rpx;
  color: #9ca3af;
}
.consume-value {
  margin-top: 6rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #ef4444;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text {
  color: #9ca3af;
  font-size: 26rpx;
}
.load-more {
  text-align: center;
  padding: 16rpx 0;
}
.load-more-text {
  color: #9ca3af;
  font-size: 22rpx;
}
</style>
