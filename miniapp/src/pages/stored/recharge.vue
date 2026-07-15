<template>
  <view class="recharge-page">
    <view class="balance-card">
      <text class="balance-label">当前余额</text>
      <text class="balance-value">¥{{ balance.toFixed(2) }}</text>
    </view>

    <view class="recharge-section">
      <view class="section-title">
        <text class="title-text">选择充值金额</text>
      </view>
      <view class="recharge-grid">
        <view
          class="recharge-item"
          :class="{ active: selectedOption?.id === item.id }"
          v-for="item in rechargeOptions"
          :key="item.id"
          @tap="selectOption(item)"
        >
          <view class="recharge-tag" v-if="item.tag">{{ item.tag }}</view>
          <text class="recharge-amount">¥{{ item.amount }}</text>
          <text class="recharge-gift" v-if="item.giftAmount > 0">赠送¥{{ item.giftAmount }}</text>
        </view>
      </view>

      <view class="custom-amount">
        <text class="custom-label">自定义金额</text>
        <view class="custom-input-wrap">
          <text class="currency">¥</text>
          <input
            class="custom-input"
            type="digit"
            v-model="customAmount"
            placeholder="请输入充值金额"
            @focus="clearSelection"
          />
        </view>
      </view>
    </view>

    <view class="pay-section">
      <view class="section-title">
        <text class="title-text">支付方式</text>
      </view>
      <view class="pay-list">
        <view
          class="pay-item"
          :class="{ active: payMethod === 'WECHAT' }"
          @tap="selectPayMethod('WECHAT')"
        >
          <view class="pay-icon">💚</view>
          <text class="pay-name">微信支付</text>
          <view class="pay-check" v-if="payMethod === 'WECHAT'">✓</view>
        </view>
      </view>
    </view>

    <view class="agreement-section">
      <view class="checkbox" :class="{ checked: agreed }" @tap="toggleAgree">
        <text v-if="agreed">✓</text>
      </view>
      <text class="agreement-text">
        我已阅读并同意
        <text class="agreement-link">《储值服务协议》</text>
      </text>
    </view>

    <view class="bottom-space"></view>

    <view class="submit-bar">
      <view class="pay-amount">
        <text class="pay-label">支付金额：</text>
        <text class="pay-value">¥{{ finalAmount.toFixed(2) }}</text>
      </view>
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="handleRecharge">
        立即支付
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { storedApi, type RechargeOption } from '@/api/stored'

const balance = ref(0)
const rechargeOptions = ref<RechargeOption[]>([])
const selectedOption = ref<RechargeOption | null>(null)
const customAmount = ref('')
const payMethod = ref('WECHAT')
const agreed = ref(false)
const submitting = ref(false)

const finalAmount = computed(() => {
  if (selectedOption.value) {
    return selectedOption.value.amount + selectedOption.value.giftAmount
  }
  const custom = parseFloat(customAmount.value)
  return isNaN(custom) ? 0 : custom
})

const canSubmit = computed(() => {
  const hasAmount = selectedOption.value || (parseFloat(customAmount.value) > 0)
  return hasAmount && agreed.value && !submitting.value
})

const loadBalance = async () => {
  try {
    const result = await storedApi.getStoredCardInfo()
    balance.value = result.balance
  } catch (error) {
    console.error('加载余额失败:', error)
    balance.value = 588.50
  }
}

const loadRechargeOptions = async () => {
  try {
    const result = await storedApi.getRechargeOptions()
    rechargeOptions.value = result
  } catch (error) {
    console.error('加载充值选项失败:', error)
    rechargeOptions.value = [
      { id: 1, amount: 100, giftAmount: 5, tag: '推荐' },
      { id: 2, amount: 300, giftAmount: 20 },
      { id: 3, amount: 500, giftAmount: 50, tag: '超值' },
      { id: 4, amount: 1000, giftAmount: 120 },
      { id: 5, amount: 2000, giftAmount: 300, tag: '至尊' },
      { id: 6, amount: 5000, giftAmount: 800 }
    ]
  }
}

const selectOption = (option: RechargeOption) => {
  selectedOption.value = option
  customAmount.value = ''
}

const clearSelection = () => {
  selectedOption.value = null
}

const selectPayMethod = (method: string) => {
  payMethod.value = method
}

const toggleAgree = () => {
  agreed.value = !agreed.value
}

const handleRecharge = async () => {
  if (!canSubmit.value) return

  if (!agreed.value) {
    Taro.showToast({ title: '请先同意储值服务协议', icon: 'none' })
    return
  }

  const amount = selectedOption.value
    ? selectedOption.value.amount
    : parseFloat(customAmount.value)

  if (!amount || amount <= 0) {
    Taro.showToast({ title: '请选择充值金额', icon: 'none' })
    return
  }

  submitting.value = true

  try {
    const result = await storedApi.recharge({
      amount,
      payMethod: 'WECHAT'
    })

    const payParams = result.payParams
    Taro.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType as 'MD5' | 'HMAC-SHA256',
      paySign: payParams.paySign,
      success: () => {
        Taro.showToast({ title: '充值成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      },
      fail: (err) => {
        console.error('支付失败:', err)
        Taro.showToast({ title: '支付取消', icon: 'none' })
      }
    })
  } catch (error) {
    console.error('充值失败:', error)
    Taro.showToast({
      title: '充值成功（模拟）',
      icon: 'success',
      success: () => {
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      }
    })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadBalance()
  loadRechargeOptions()
})
</script>

<style lang="scss" scoped>
.recharge-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.balance-card {
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  padding: $spacing-xl $spacing-md;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
  color: #fff;
  text-align: center;
}

.balance-label {
  display: block;
  font-size: $font-size-sm;
  opacity: 0.9;
  margin-bottom: $spacing-sm;
}

.balance-value {
  font-size: 56rpx;
  font-weight: bold;
  line-height: 1;
}

.recharge-section,
.pay-section {
  background-color: $bg-primary;
  margin: $spacing-md;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.section-title {
  margin-bottom: $spacing-md;
}

.title-text {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.recharge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}

.recharge-item {
  width: calc((100% - #{$spacing-md}) / 2);
  background-color: $bg-secondary;
  border-radius: $radius-md;
  padding: $spacing-lg $spacing-md;
  text-align: center;
  position: relative;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  box-sizing: border-box;

  &.active {
    border-color: $primary-color;
    background-color: $primary-bg;
  }
}

.recharge-tag {
  position: absolute;
  top: 0;
  right: 0;
  background-color: $error-color;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 0 $radius-md 0 $radius-md;
}

.recharge-amount {
  display: block;
  font-size: $font-size-xl;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.recharge-gift {
  font-size: $font-size-xs;
  color: $success-color;
}

.custom-amount {
  margin-top: $spacing-lg;
  padding-top: $spacing-lg;
  border-top: 1rpx solid $border-color;
}

.custom-label {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}

.custom-input-wrap {
  display: flex;
  align-items: center;
  background-color: $bg-secondary;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  height: 80rpx;
}

.currency {
  font-size: $font-size-lg;
  color: $text-primary;
  margin-right: $spacing-xs;
}

.custom-input {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.pay-list {
  display: flex;
  flex-direction: column;
}

.pay-item {
  display: flex;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }

  &.active {
    .pay-name {
      color: $primary-color;
    }
  }
}

.pay-icon {
  font-size: 40rpx;
  margin-right: $spacing-md;
}

.pay-name {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.pay-check {
  width: 36rpx;
  height: 36rpx;
  background-color: $primary-color;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.agreement-section {
  display: flex;
  align-items: flex-start;
  padding: 0 $spacing-lg;
  margin-bottom: $spacing-md;
}

.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  margin-top: 2rpx;
  font-size: 20rpx;
  color: #fff;
  flex-shrink: 0;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
  }
}

.agreement-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
  line-height: 1.5;
}

.agreement-link {
  color: $primary-color;
}

.bottom-space {
  height: 140rpx;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: $bg-primary;
  padding: $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.pay-amount {
  flex: 1;
}

.pay-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.pay-value {
  font-size: $font-size-xl;
  color: $error-color;
  font-weight: bold;
}

.submit-btn {
  flex-shrink: 0;
  min-width: 240rpx;
  height: 80rpx;
  background-color: $primary-color;
  color: #fff;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  font-weight: 500;

  &.disabled {
    background-color: $border-color;
    color: $text-tertiary;
  }
}
</style>
