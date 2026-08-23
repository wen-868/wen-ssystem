<template>
  <view class="member-detail-page">
    <page-header title="会员详情" @back="goBack" />

    <view class="loading-overlay" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="member">
      <!-- 会员卡头 -->
      <view class="member-header">
        <view class="member-avatar">
          <text class="avatar-text">{{ (member.name || '会').charAt(0) }}</text>
        </view>
        <view class="member-info">
          <view class="member-name-row">
            <text class="member-name">{{ member.name || '会员' }}</text>
            <view class="level-tag" :class="member.levelName ? '' : 'level-tag--plain'">
              <text class="level-tag-text">{{ member.levelName || '普通' }}</text>
            </view>
          </view>
          <text class="member-phone">{{ member.mobile || '未留手机号' }}</text>
        </view>
      </view>

      <!-- 统计 -->
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-value">{{ member.points ?? 0 }}</text>
          <text class="stat-label">可用积分</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">¥{{ formatAmount(member.totalSpent) }}</text>
          <text class="stat-label">累计消费</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">¥{{ formatAmount(member.balance) }}</text>
          <text class="stat-label">余额</text>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="info-section">
        <view class="section-title">基本信息</view>
        <view class="info-card">
          <view class="info-row">
            <text class="info-label">会员等级</text>
            <text class="info-value">{{ member.levelName || '普通' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">联系电话</text>
            <text class="info-value info-value--link" @tap="callPhone">{{ member.mobile || '—' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">客户类型</text>
            <text class="info-value">{{ typeLabel }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">积分账户</text>
            <text class="info-value">{{ member.totalPoints ?? member.points ?? 0 }}（冻结 {{ member.frozenPoints ?? 0 }}）</text>
          </view>
          <view class="info-row">
            <text class="info-label">最近消费</text>
            <text class="info-value">{{ formatDate(member.lastConsumeAt) || '—' }}</text>
          </view>
          <view class="info-row info-row--last">
            <text class="info-label">加入时间</text>
            <text class="info-value">{{ formatDate(member.createdAt) || '—' }}</text>
          </view>
        </view>
      </view>

      <!-- 最近订单 -->
      <view class="orders-section">
        <view class="section-title">最近订单</view>
        <view class="order-card" v-for="order in orders" :key="order.billNo">
          <view class="order-card-header">
            <text class="order-no">{{ order.billNo }}</text>
            <view class="order-status">
              <text class="status-text">{{ orderStatusLabel(order) }}</text>
            </view>
          </view>
          <view class="order-card-footer">
            <text class="order-time">{{ formatDate(order.createdAt) }}</text>
            <text class="order-amount">¥{{ formatAmount(order.receivableAmount) }}</text>
          </view>
        </view>
        <view class="empty-tip" v-if="!loadingOrders && orders.length === 0">
          <text class="empty-tip-text">暂无消费订单</text>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-text">会员不存在或已失效</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

interface MemberDetail {
  id: number
  name: string
  mobile: string
  customerType: string
  levelCode: string
  levelName: string
  status: number
  points: number
  totalPoints: number
  frozenPoints: number
  balance: number
  totalSpent: number
  lastConsumeAt: string | null
  createdAt: string | null
}

interface MemberOrder {
  billNo: string
  storeId: number
  receivableAmount: number
  receivedAmount: number
  collectionStatus: string
  businessStatus: string
  createdAt: string
}

const member = ref<MemberDetail | null>(null)
const orders = ref<MemberOrder[]>([])
const loading = ref(false)
const loadingOrders = ref(false)
const memberId = ref(0)

const typeLabel = computed(() => {
  const t = member.value?.customerType || ''
  if (t === 'WHOLESALE') return '批发会员'
  if (t === 'RETAIL') return '零售会员'
  return '会员'
})

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function formatAmount(v: number | string | null | undefined): string {
  const n = Number(v ?? 0)
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toFixed(2)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return String(d).slice(0, 16).replace('T', ' ')
}

function orderStatusLabel(order: MemberOrder): string {
  const s = order.businessStatus || ''
  if (s === 'VOIDED') return '已作废'
  if (s === 'DRAFT') return '暂存'
  const c = order.collectionStatus || ''
  if (c === 'PAID') return '已收款'
  if (c === 'PARTIAL') return '部分收款'
  return '待收款'
}

function callPhone() {
  if (member.value?.mobile) {
    uni.makePhoneCall({ phoneNumber: member.value.mobile })
  }
}

async function loadDetail() {
  if (!memberId.value) return
  loading.value = true
  try {
    const res: any = await get(`/store/members/${memberId.value}`)
    member.value = (res?.data ?? res) as MemberDetail
  } catch (err: any) {
    uni.showToast({ title: err?.msg || '加载会员详情失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadOrders() {
  if (!memberId.value) return
  loadingOrders.value = true
  try {
    const res: any = await get(`/store/members/${memberId.value}/orders`, { page: 1, pageSize: 10 })
    const data = res?.data ?? res ?? {}
    orders.value = data.records ?? []
  } catch (err) {
    console.error('加载会员订单失败:', err)
  } finally {
    loadingOrders.value = false
  }
}

onLoad((query: any) => {
  memberId.value = Number(query?.id ?? 0)
  loadDetail()
  loadOrders()
})
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.member-detail-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.page-header {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  background: $uni-bg-color;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-text-color;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-text-color;
  margin-right: 64rpx;
}

/* 会员卡头 */
.member-header {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin: 24rpx 28rpx 0;
  padding: 32rpx;
  background: $uni-bg-color;
  border-radius: 28rpx;
  box-shadow: $uni-shadow-card;
}

.member-avatar {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: $uni-gradient-blue;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.member-name {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.level-tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: $uni-color-primary-soft;
}

.level-tag--plain {
  background: #f3f4f6;
}

.level-tag-text {
  font-size: 20rpx;
  color: $uni-color-primary;
}

.level-tag--plain .level-tag-text {
  color: $uni-gray-500;
}

.member-phone {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $uni-gray-500;
}

/* 统计 */
.stats-row {
  display: flex;
  align-items: center;
  margin: 24rpx 28rpx 0;
  padding: 28rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 28rpx;
  box-shadow: $uni-shadow-card;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-value {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.stat-label {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.stat-divider {
  width: 1rpx;
  height: 48rpx;
  background: #e5e7eb;
}

/* 信息卡片 */
.info-section {
  margin: 28rpx 28rpx 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-text-color;
  margin-bottom: 16rpx;
}

.info-card,
.orders-section {
  background: $uni-bg-color;
  border-radius: 24rpx;
  padding: 8rpx 32rpx;
  box-shadow: $uni-shadow-card;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.info-row--last {
  border-bottom: none;
}

.info-label {
  width: 160rpx;
  font-size: 26rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
  text-align: right;
}

.info-value--link {
  color: $uni-color-primary;
}

/* 最近订单 */
.orders-section {
  margin: 28rpx 28rpx 0;
}

.order-card {
  padding: 20rpx 4rpx;
  border-bottom: 1rpx solid #f3f4f6;
}

.order-card:last-child {
  border-bottom: none;
}

.order-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-no {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.order-status {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: $uni-color-primary-soft;
}

.status-text {
  font-size: 20rpx;
  color: $uni-color-primary;
}

.order-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.order-time {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.order-amount {
  font-size: 26rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.empty-tip {
  padding: 36rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-tip-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.loading-overlay {
  padding: 120rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.empty-state {
  padding: 160rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}
</style>
