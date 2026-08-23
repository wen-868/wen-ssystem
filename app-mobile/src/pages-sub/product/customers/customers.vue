<template>
  <view class="customers-page">
    <!-- 页头 -->
    <page-header title="会员管理" @back="goBack">
      <template #right>
        <text class="header-add" @tap="goAdd">＋</text>
      </template>
    </page-header>

    <!-- 统计 -->
    <view class="mem-stats">
      <view class="mem-stat">
        <text class="ms-val">{{ totalCount }}</text>
        <text class="ms-label">总会员</text>
      </view>
      <view class="mem-stat">
        <text class="ms-val">—</text>
        <text class="ms-label">本月新增</text>
      </view>
      <view class="mem-stat">
        <text class="ms-val">—</text>
        <text class="ms-label">活跃率</text>
      </view>
    </view>

    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索会员姓名 / 手机号"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <!-- 会员列表（原稿分区标题） -->
    <view class="section-title">
      <text class="st-text">会员列表</text>
      <text class="st-sub">共 {{ totalCount }} 人</text>
    </view>

    <scroll-view
      class="customer-list"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onPullDownRefresh"
    >
      <view class="loading-overlay" v-if="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <view
        class="customer-card"
        v-for="customer in list"
        :key="customer.id"
        @tap="goDetail(customer.id)"
        @touchstart="activeCard = customer.id"
        @touchend="activeCard = null"
        :class="{ 'card-active': activeCard === customer.id }"
      >
        <view class="card-left">
          <view class="avatar-circle">
            <text class="avatar-text">{{ customer.name.charAt(0) }}</text>
          </view>
        </view>
        <view class="card-right">
          <view class="customer-header">
            <text class="customer-name">{{ customer.name }}</text>
            <view class="customer-type-tag" :class="vipClass(customer.level)" v-if="customer.level || customer.typeLabel">
              <text class="type-text">{{ customer.level || customer.typeLabel }}</text>
            </view>
          </view>
          <view class="customer-info">
            <text class="customer-phone">
              最近消费：{{ customer.lastOrderTime ? formatDate(customer.lastOrderTime) : '暂无' }}
            </text>
          </view>
          <view class="customer-footer">
            <text class="debt-label">累计消费</text>
            <text class="debt-amount">
              ¥{{ formatAmount(customer.totalAmount) }}
            </text>
          </view>
        </view>
        <image class="card-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>

      <view class="empty-state" v-if="!loading && list.length === 0">
        <image class="empty-icon ic" src="/static/icons/ic/users.svg" mode="aspectFit"/>
        <text class="empty-text">暂无客户数据</text>
        <text class="empty-hint">点击右上角添加客户</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="add-btn-wrap">
      <button class="add-btn" @tap="goAdd">
        <image class="add-icon ic" src="/static/icons/ic/plus.svg" mode="aspectFit"/>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'

const searchForm = reactive({
  keyword: '',
})

const list = ref<CustomerInfo[]>([])
const totalCount = ref(0)
const loading = ref(false)
const activeCard = ref<number | null>(null)
const refresherTriggered = ref(false)
const navigating = ref(false)

function onSearch() {
  loadCustomers()
}

function clearSearch() {
  searchForm.keyword = ''
  loadCustomers()
}

async function loadCustomers() {
  loading.value = true
  try {
    const result = await customersApi.list({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
    totalCount.value = result.total ?? list.value.length
  } catch (err) {
    console.error('加载客户失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    refresherTriggered.value = false
  }
}

async function onPullDownRefresh() {
  refresherTriggered.value = true
  await loadCustomers()
}

function goDetail(id: number) {
  if (navigating.value) return
  navigating.value = true
  uni.navigateTo({
    url: `/pages-sub/product/customers/customer-detail?id=${id}`,
    complete: () => { navigating.value = false }
  })
}

function goAdd() {
  uni.navigateTo({ url: '/pages-sub/product/customers/customer-detail?id=0' })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/functions/functions' })
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '暂无'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr.slice(0, 10)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function vipClass(level?: string): string {
  if (!level) return ''
  const l = level.toUpperCase()
  if (l.includes('3')) return 'vip3'
  if (l.includes('2')) return 'vip2'
  return ''
}

function formatAmount(amount: number | string): string {
  const num = Number(amount ?? 0)
  return num.toFixed(2)
}

onMounted(() => {
  loadCustomers()
})
</script>

<style lang="scss" scoped>
.customers-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}

/* 页头 */
.mem-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
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

.header-add {
  font-size: 40rpx;
  color: $uni-color-primary;
  padding: 12rpx;
  font-weight: 500;
}

/* 分区标题（原稿 section-title 风格） */
.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 32rpx 32rpx 8rpx;
}

.st-text {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.st-sub {
  font-size: 22rpx;
  color: $uni-gray-400;
  font-weight: 400;
}

/* 统计 */
.mem-stats {
  display: flex;
  gap: 20rpx;
  margin: 28rpx 28rpx 0;
}

.mem-stat {
  flex: 1;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 28rpx 16rpx;
  text-align: center;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.ms-val {
  display: block;
  font-size: 36rpx;
  font-weight: 800;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.ms-label {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 8rpx;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  margin-top: 28rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.customer-list {
  padding: 16rpx 32rpx;
  height: calc(100vh - 300rpx);
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-top: 20rpx;
}

.customer-card {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.customer-card:active,
.card-active {
  transform: scale(0.98);
  background: $uni-gray-50;
}

.card-left {
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar-circle {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.card-right {
  flex: 1;
  min-width: 0;
}

.customer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.customer-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.customer-type-tag {
  padding: 4rpx 14rpx;
  background: $uni-gray-100;
  border-radius: 8rpx;
}

.customer-type-tag.vip3 {
  background: #fef3c7;
}

.customer-type-tag.vip2 {
  background: $uni-color-primary-soft;
}

.type-text {
  font-size: 22rpx;
  color: $uni-gray-600;
}

.customer-type-tag.vip3 .type-text {
  color: #92400e;
}

.customer-type-tag.vip2 .type-text {
  color: $uni-color-primary;
}

.customer-info {
  display: flex;
  flex-direction: column;
  margin-bottom: 12rpx;
}

.customer-phone {
  font-size: 26rpx;
  color: $uni-gray-500;
  margin-bottom: 4rpx;
}

.customer-address {
  font-size: 24rpx;
  color: $uni-gray-400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.debt-label {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.debt-amount {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.debt-zero {
  color: $uni-color-success;
}

.card-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
  margin-left: 16rpx;
  flex-shrink: 0;
}

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

.empty-hint {
  font-size: 24rpx;
  color: $uni-gray-300;
  margin-top: 12rpx;
}

.add-btn-wrap {
  position: fixed;
  right: 32rpx;
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  z-index: 100;
}

.add-btn {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.35);
  border: none;
}

.add-btn::after {
  border: none;
}

.add-icon {
  font-size: 40rpx;
  color: $uni-text-color-inverse;
}

.safe-bottom {
  height: 140rpx;
}
</style>
