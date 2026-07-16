<template>
  <view class="identify-page">
    <view class="page-header">
      <text class="header-title">会员识别</text>
    </view>

    <!-- 识别方式切换 -->
    <view class="method-bar">
      <view class="method-item" :class="{ 'method-item--active': method === 'mobile' }" @tap="method = 'mobile'">
        <text class="method-text">手机号查询</text>
      </view>
      <view class="method-item" :class="{ 'method-item--active': method === 'code' }" @tap="method = 'code'">
        <text class="method-text">会员码扫描</text>
      </view>
    </view>

    <!-- 手机号查询 -->
    <view class="input-section" v-if="method === 'mobile'">
      <view class="input-wrap">
        <text class="input-icon">&#xe614;</text>
        <input
          class="mobile-input"
          v-model="mobile"
          type="number"
          maxlength="11"
          placeholder="请输入会员手机号"
          placeholder-class="input-placeholder"
          @confirm="onIdentifyByMobile"
        />
      </view>
      <button class="search-btn" :disabled="!isMobileValid || loading" @tap="onIdentifyByMobile">
        {{ loading ? '查询中...' : '查询会员' }}
      </button>
    </view>

    <!-- 会员码扫描 -->
    <view class="scan-section" v-else>
      <view class="scan-area" @tap="onScanCode">
        <text class="scan-icon">&#xe610;</text>
        <text class="scan-text">点击扫描会员码</text>
        <text class="scan-tip">对准会员手机上的会员二维码</text>
      </view>
    </view>

    <!-- 查询结果 -->
    <view class="result-section" v-if="memberInfo">
      <view class="member-card">
        <view class="member-header">
          <view class="member-avatar">
            <text class="avatar-text">{{ memberInfo.name.charAt(0) }}</text>
          </view>
          <view class="member-base">
            <view class="member-name-row">
              <text class="member-name">{{ memberInfo.name }}</text>
              <view class="member-level" :class="'level-' + memberInfo.level">
                <text class="level-text">{{ memberInfo.levelName }}</text>
              </view>
            </view>
            <text class="member-mobile">{{ memberInfo.mobile }}</text>
          </view>
        </view>

        <view class="member-stats">
          <view class="stat-item">
            <text class="stat-label">积分</text>
            <text class="stat-value stat-value--points">{{ memberInfo.points }}</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-label">储值余额</text>
            <text class="stat-value stat-value--balance">¥{{ memberInfo.balance.toFixed(2) }}</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-label">累计消费</text>
            <text class="stat-value">¥{{ memberInfo.totalSpent.toFixed(2) }}</text>
          </view>
        </view>

        <view class="member-detail">
          <view class="detail-row">
            <text class="detail-label">订单数</text>
            <text class="detail-value">{{ memberInfo.orderCount }} 笔</text>
          </view>
          <view class="detail-row" v-if="memberInfo.lastConsumeAt">
            <text class="detail-label">最近消费</text>
            <text class="detail-value">{{ memberInfo.lastConsumeAt }}</text>
          </view>
        </view>
      </view>

      <button class="confirm-btn" @tap="onConfirmSelect">选此会员收银</button>
    </view>

    <!-- 未找到会员 -->
    <view class="not-found" v-if="notFound">
      <text class="not-found-icon">&#xe631;</text>
      <text class="not-found-text">未找到该会员</text>
      <text class="not-found-tip">请确认手机号/会员码是否正确</text>
      <button class="register-btn" @tap="goRegister">前往注册会员</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { memberIdentifyApi, type MemberIdentifyResult } from '@/api/modules/cashier'

const method = ref<'mobile' | 'code'>('mobile')
const mobile = ref('')
const loading = ref(false)
const memberInfo = ref<MemberIdentifyResult | null>(null)
const notFound = ref(false)

const isMobileValid = computed(() => /^1[3-9]\d{9}$/.test(mobile.value))

async function onIdentifyByMobile() {
  if (!isMobileValid.value || loading.value) return
  loading.value = true
  memberInfo.value = null
  notFound.value = false
  try {
    const result = await memberIdentifyApi.identifyByMobile(mobile.value)
    if (result) {
      memberInfo.value = result
    } else {
      notFound.value = true
    }
  } catch (err) {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

async function onScanCode() {
  uni.scanCode({
    onlyFromCamera: false,
    success: async (res) => {
      loading.value = true
      memberInfo.value = null
      notFound.value = false
      try {
        const result = await memberIdentifyApi.identifyByCode(res.result)
        if (result) {
          memberInfo.value = result
        } else {
          notFound.value = true
        }
      } catch (err) {
        notFound.value = true
      } finally {
        loading.value = false
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码已取消', icon: 'none' })
    }
  })
}

function onConfirmSelect() {
  if (!memberInfo.value) return
  // 通过 eventChannel 通知上一页（收银台）
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  if (currentPage && typeof currentPage.getOpenerEventChannel === 'function') {
    const eventChannel = currentPage.getOpenerEventChannel()
    if (eventChannel && typeof eventChannel.emit === 'function') {
      eventChannel.emit('onMemberSelected', memberInfo.value)
    }
  }
  uni.navigateBack()
}

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}
</script>

<style scoped>
.identify-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

/* 识别方式切换 */
.method-bar {
  display: flex;
  background: #fff;
  padding: 0 24rpx 24rpx;
  gap: 16rpx;
}

.method-item {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 36rpx;
  border: 2rpx solid transparent;
}

.method-item--active {
  background: #e6f4ff;
  border-color: #1677FF;
}

.method-text {
  font-size: 28rpx;
  color: #666;
}

.method-item--active .method-text {
  color: #1677FF;
  font-weight: 600;
}

/* 手机号输入 */
.input-section {
  padding: 32rpx 24rpx;
}

.input-wrap {
  display: flex;
  align-items: center;
  height: 96rpx;
  background: #fff;
  border-radius: 48rpx;
  padding: 0 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.input-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 16rpx;
}

.mobile-input {
  flex: 1;
  font-size: 32rpx;
  color: #333;
  font-weight: 600;
}

.input-placeholder {
  color: #bbb;
  font-size: 30rpx;
  font-weight: normal;
}

.search-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  border: none;
}

.search-btn::after {
  border: none;
}

.search-btn[disabled] {
  opacity: 0.5;
}

/* 扫描区域 */
.scan-section {
  padding: 60rpx 24rpx;
}

.scan-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  border: 2rpx dashed #1677FF;
}

.scan-icon {
  font-size: 100rpx;
  color: #1677FF;
  margin-bottom: 24rpx;
}

.scan-text {
  font-size: 32rpx;
  color: #1677FF;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.scan-tip {
  font-size: 24rpx;
  color: #999;
}

/* 会员卡片 */
.result-section {
  padding: 24rpx;
}

.member-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}

.member-header {
  display: flex;
  align-items: center;
  margin-bottom: 32rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.member-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.avatar-text {
  font-size: 40rpx;
  color: #fff;
  font-weight: 700;
}

.member-base {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.member-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.member-name {
  font-size: 34rpx;
  color: #333;
  font-weight: 700;
}

.member-level {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.level-bronze {
  background: #fff7e6;
}

.level-bronze .level-text {
  color: #fa8c16;
  font-size: 20rpx;
}

.level-silver {
  background: #f0f0f0;
}

.level-silver .level-text {
  color: #666;
  font-size: 20rpx;
}

.level-gold {
  background: #fffbe6;
}

.level-gold .level-text {
  color: #d4b106;
  font-size: 20rpx;
}

.level-platinum,
.level-diamond {
  background: #f9f0ff;
}

.level-platinum .level-text,
.level-diamond .level-text {
  color: #722ed1;
  font-size: 20rpx;
}

.member-mobile {
  font-size: 26rpx;
  color: #999;
}

/* 统计 */
.member-stats {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  margin-bottom: 16rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.stat-value {
  font-size: 32rpx;
  color: #333;
  font-weight: 700;
}

.stat-value--points {
  color: #fa8c16;
}

.stat-value--balance {
  color: #1677FF;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background: #f0f0f0;
}

/* 详情 */
.member-detail {
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}

.detail-label {
  font-size: 26rpx;
  color: #999;
}

.detail-value {
  font-size: 26rpx;
  color: #333;
}

.confirm-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  border: none;
}

.confirm-btn::after {
  border: none;
}

/* 未找到 */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 24rpx;
}

.not-found-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 24rpx;
}

.not-found-text {
  font-size: 30rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.not-found-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-bottom: 40rpx;
}

.register-btn {
  width: 320rpx;
  height: 80rpx;
  background: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #1677FF;
  border: 2rpx solid #1677FF;
}

.register-btn::after {
  border: none;
}
</style>
