<template>
  <view class="member-list-page">
    <!-- 页头 -->
    <page-header title="会员管理" @back="goBack" />

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
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索会员姓名 / 手机号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="reload"
        />
        <image class="search-clear ic" v-if="keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <view class="section-title">会员列表</view>

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
            <text class="level-tag" :class="levelClass(m.levelName)">{{ m.levelName || '普通' }}</text>
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
  uni.navigateTo({ url: `/pages-sub/marketing/member/member-detail?id=${id}` })
}

function formatAmount(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return Number(v || 0).toFixed(2)
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return String(d).slice(0, 10)
}

// 会员等级标签配色（对齐原稿：VIP3 琥珀 / VIP2 蓝 / VIP1·普通 灰）
function levelClass(name?: string): string {
  const n = (name || '').toUpperCase()
  if (n.includes('VIP3')) return 'level-tag--vip3'
  if (n.includes('VIP2')) return 'level-tag--vip2'
  if (n.includes('VIP1')) return 'level-tag--vip1'
  return 'level-tag--plain'
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
  background: $uni-bg-color;
}
.header-back {
  padding: 8rpx 16rpx 8rpx 0;
}
.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.stats-grid {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx;
}
.stats-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}
.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background: $uni-color-primary;
}
.stats-value {
  font-size: 40rpx;
  font-weight: 800;
  color: $uni-color-primary;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -1rpx;
}
.stats-value--up {
  color: $uni-color-primary;
}
.stats-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $uni-gray-400;
}

.search-bar {
  padding: 0 24rpx 16rpx;
}

.section-title {
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
  padding: 24rpx 28rpx 12rpx;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  background: $uni-bg-color-page;
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 68rpx;
}
.search-icon {
  color: $uni-gray-400;
  margin-right: 12rpx;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
}
.search-clear {
  color: $uni-gray-400;
}

.member-scroll {
  flex: 1;
  padding: 0 32rpx;
}
.member-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  padding: 26rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
}
.member-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: $uni-color-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-letter {
  color: $uni-color-primary;
  font-size: 30rpx;
  font-weight: 700;
}
.member-info {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
  margin-right: 14rpx;
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
  color: $uni-text-color;
}
.level-tag {
  font-size: 22rpx;
  font-weight: 600;
  color: $uni-gray-500;
  background: $uni-bg-color-soft;
  border-radius: $uni-border-radius-pill;
  padding: 2rpx 12rpx;
}
.level-tag--vip3 {
  color: #92400e;
  background: #fef3c7;
  border: 1rpx solid rgba(217, 119, 6, 0.15);
}
.level-tag--vip2 {
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  border: 1rpx solid rgba(37, 99, 235, 0.1);
}
.level-tag--vip1 {
  color: $uni-gray-500;
  background: $uni-bg-color-soft;
}
.level-tag--plain {
  color: $uni-gray-500;
  background: $uni-bg-color-soft;
}
.member-meta {
  margin-top: 8rpx;
}
.meta-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.member-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  align-self: flex-end;
  flex-shrink: 0;
  margin-left: 14rpx;
  padding-bottom: 2rpx;
}
.consume-label {
  white-space: nowrap;
  font-size: 20rpx;
  color: $uni-gray-400;
}
.consume-value {
  margin-top: 6rpx;
  font-size: 28rpx;
  font-weight: 800;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text {
  color: $uni-gray-300;
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
