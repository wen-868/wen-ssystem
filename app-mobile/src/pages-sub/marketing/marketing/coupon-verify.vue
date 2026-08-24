<template>
  <view class="verify-page">
    <!-- 模式切换：扫码核销 / 手动核销 -->
    <view class="mode-tabs">
      <view
        class="mode-tab"
        :class="{ 'mode-tab--active': mode === 'scan' }"
        @tap="mode = 'scan'"
      >
        <text class="mode-text">扫码核销</text>
      </view>
      <view
        class="mode-tab"
        :class="{ 'mode-tab--active': mode === 'manual' }"
        @tap="mode = 'manual'"
      >
        <text class="mode-text">手动核销</text>
      </view>
    </view>

    <view class="form-card">
      <!-- 扫码核销：顾客出示券码（扫码枪输入后自动确认） -->
      <template v-if="mode === 'scan'">
        <view class="form-row">
          <text class="form-label">券码</text>
          <input
            class="form-input"
            v-model="couponCode"
            type="text"
            placeholder="扫描或输入优惠券码"
            placeholder-class="form-placeholder"
            focus
            confirm-type="done"
            @confirm="doVerify"
          />
        </view>
        <view class="form-row">
          <text class="form-label">关联订单号</text>
          <input
            class="form-input"
            v-model="orderNo"
            type="text"
            placeholder="选填：销售单/订单号"
            placeholder-class="form-placeholder"
          />
        </view>
        <button class="verify-btn" :loading="verifying" :disabled="verifying" @tap="doVerify">
          确认核销
        </button>
      </template>

      <!-- 手动核销：顾客报手机号 + 券码 -->
      <template v-else>
        <view class="form-row">
          <text class="form-label">顾客手机号</text>
          <input
            class="form-input"
            v-model="mobile"
            type="number"
            maxlength="11"
            placeholder="输入顾客手机号"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-row">
          <text class="form-label">优惠券码</text>
          <input
            class="form-input"
            v-model="couponCode"
            type="text"
            placeholder="输入优惠券码"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-row">
          <text class="form-label">关联订单号</text>
          <input
            class="form-input"
            v-model="orderNo"
            type="text"
            placeholder="选填：销售单/订单号"
            placeholder-class="form-placeholder"
          />
        </view>
        <button class="verify-btn" :loading="verifying" :disabled="verifying" @tap="doVerify">
          确认核销
        </button>
      </template>
    </view>

    <!-- 核销结果 -->
    <view class="result-card" v-if="result">
      <view class="result-header" :class="result.success ? 'result--success' : 'result--fail'">
        <text class="result-title">{{ result.success ? '核销成功' : '核销失败' }}</text>
      </view>
      <template v-if="result.success">
        <view class="result-row">
          <text class="result-label">优惠券</text>
          <text class="result-value">{{ result.data.couponName }}</text>
        </view>
        <view class="result-row">
          <text class="result-label">优惠金额</text>
          <text class="result-value result-amount">¥{{ result.data.discountAmount }}</text>
        </view>
        <view class="result-row" v-if="result.data.userName">
          <text class="result-label">顾客</text>
          <text class="result-value">{{ result.data.userName }}<text v-if="result.data.userMobile">（{{ maskMobile(result.data.userMobile) }}）</text></text>
        </view>
        <view class="result-row">
          <text class="result-label">券码</text>
          <text class="result-value">{{ result.data.couponNo }}</text>
        </view>
      </template>
      <text class="result-msg" v-else>{{ result.msg }}</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeApi } from '@/api/modules/store'

const mode = ref<'scan' | 'manual'>('scan')
const couponCode = ref('')
const mobile = ref('')
const orderNo = ref('')
const verifying = ref(false)
const result = ref<{
  success: boolean
  msg?: string
  data?: any
} | null>(null)

function maskMobile(m: string): string {
  if (!m || m.length < 7) return m
  return `${m.slice(0, 3)}****${m.slice(-4)}`
}

async function doVerify() {
  if (!couponCode.value.trim()) {
    uni.showToast({ title: '请输入优惠券码', icon: 'none' })
    return
  }
  if (mode.value === 'manual' && !mobile.value.trim()) {
    uni.showToast({ title: '请输入顾客手机号', icon: 'none' })
    return
  }
  verifying.value = true
  result.value = null
  try {
    if (mode.value === 'scan') {
      const data = await storeApi.verifyCoupon(couponCode.value.trim())
      result.value = { success: true, data }
    } else {
      const data = await storeApi.manualVerifyCoupon({
        couponCode: couponCode.value.trim(),
        mobile: mobile.value.trim(),
        saleBillNo: orderNo.value.trim() || undefined,
      })
      result.value = { success: true, data }
    }
    couponCode.value = ''
    mobile.value = ''
    orderNo.value = ''
  } catch (err: any) {
    console.error('优惠券核销失败:', err)
    result.value = { success: false, msg: err?.message || err?.msg || '核销失败，请检查券码与手机号' }
  } finally {
    verifying.value = false
  }
}
</script>

<style lang="scss" scoped>
.verify-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  padding: $uni-spacing-base;
}
.mode-tabs {
  display: flex;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
}
.mode-tab {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}
.mode-tab--active {
  background: $uni-color-warning;
}
.mode-tab--active .mode-text {
  color: $uni-text-color-inverse;
}
.mode-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}
.form-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-sm $uni-spacing-base;
}
.form-row {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-page;
}
.form-label {
  width: 180rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
}
.form-input {
  flex: 1;
  height: 68rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-md;
}
.form-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}
.verify-btn {
  margin: 32rpx 0;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  color: $uni-text-color-inverse;
  background: $uni-color-warning;
  border-radius: 40rpx;
}
.result-card {
  margin-top: $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
}
.result-header {
  padding: 16rpx 0 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-page;
}
.result-title {
  font-size: 32rpx;
  font-weight: 700;
}
.result--success .result-title {
  color: $uni-color-success;
}
.result--fail .result-title {
  color: $uni-color-error;
}
.result-row {
  display: flex;
  justify-content: space-between;
  padding: 18rpx 0;
}
.result-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}
.result-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}
.result-amount {
  color: $uni-color-error;
  font-weight: 700;
}
.result-msg {
  display: block;
  padding: $uni-spacing-base 0 $uni-spacing-xs;
  font-size: 26rpx;
  color: $uni-color-error;
}
.safe-bottom {
  height: calc(env(safe-area-inset-bottom) + 24rpx);
}
</style>
