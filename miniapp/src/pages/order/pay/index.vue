<template>
  <view class="pay-page">
    <!-- 支付金额 -->
    <view class="pay-amount-section">
      <text class="amount-label">支付金额</text>
      <view class="amount-value">
        <text class="amount-symbol">¥</text>
        <text class="amount-number">{{ payAmount.toFixed(2) }}</text>
      </view>
      <text class="order-no">订单号：{{ orderNo }}</text>
    </view>

    <!-- 支付方式 -->
    <view class="pay-method-section">
      <view class="section-title">支付方式</view>
      <view class="method-list">
        <view
          class="method-item"
          :class="{ active: selectedMethod === 'WECHAT' }"
          @tap="selectMethod('WECHAT')"
        >
          <view class="method-left">
            <text class="method-icon wechat">💚</text>
            <view class="method-info">
              <text class="method-name">微信支付</text>
              <text class="method-desc">推荐使用</text>
            </view>
          </view>
          <view class="radio" :class="{ checked: selectedMethod === 'WECHAT' }">
            <text v-if="selectedMethod === 'WECHAT'">✓</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 支付安全提示 -->
    <view class="pay-tips">
      <text class="tips-icon">🔒</text>
      <text class="tips-text">支付安全由微信支付保障</text>
    </view>

    <!-- 底部支付按钮 -->
    <view class="pay-footer">
      <view class="pay-btn" :class="{ loading: isPaying }" @tap="handlePay">
        <text v-if="!isPaying">确认支付</text>
        <text v-else>支付中...</text>
      </view>
    </view>

    <!-- 支付结果弹窗 -->
    <view class="result-modal" v-if="showResult" @tap="closeResult">
      <view class="result-content" @tap.stop>
        <view class="result-icon" :class="paySuccess ? 'success' : 'fail'">
          {{ paySuccess ? '✓' : '✕' }}
        </view>
        <text class="result-title">{{ paySuccess ? '支付成功' : '支付失败' }}</text>
        <text class="result-desc" v-if="paySuccess">订单支付成功，商家将尽快为您发货</text>
        <text class="result-desc" v-else>{{ errorMsg || '支付失败，请稍后重试' }}</text>
        <view class="result-actions">
          <view class="result-btn outline" v-if="!paySuccess" @tap="retryPay">
            重新支付
          </view>
          <view class="result-btn primary" @tap="goOrderDetail">
            {{ paySuccess ? '查看订单' : '返回订单' }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { orderApi } from '@/api/order'

const router = useRouter()

const orderId = ref<number>(0)
const orderNo = ref('')
const payAmount = ref(0)
const selectedMethod = ref<'WECHAT' | 'ALIPAY'>('WECHAT')
const isPaying = ref(false)
const showResult = ref(false)
const paySuccess = ref(false)
const errorMsg = ref('')

const loadOrderInfo = async () => {
  if (!orderId.value) return

  try {
    const data = await orderApi.getOrderDetail(orderId.value)
    orderNo.value = data.orderNo
    payAmount.value = data.payAmount
  } catch (error) {
    console.error('加载订单信息失败:', error)
  }
}

const selectMethod = (method: 'WECHAT' | 'ALIPAY') => {
  selectedMethod.value = method
}

const handlePay = async () => {
  if (isPaying.value) return
  if (!orderId.value) return

  isPaying.value = true

  try {
    // 获取支付参数
    const payParams = await orderApi.getPayParams(orderId.value, selectedMethod.value)

    // 调用微信支付
    const payResult = await Taro.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType as 'MD5' | 'HMAC-SHA256',
      paySign: payParams.paySign
    })

    // 支付成功
    console.log('支付成功:', payResult)
    paySuccess.value = true
    showResult.value = true
  } catch (error: any) {
    console.error('支付失败:', error)

    // 用户取消支付
    if (error.errMsg && error.errMsg.includes('cancel')) {
      Taro.showToast({ title: '已取消支付', icon: 'none' })
      isPaying.value = false
      return
    }

    // 支付失败
    paySuccess.value = false
    errorMsg.value = error.errMsg || '支付失败，请稍后重试'
    showResult.value = true
  } finally {
    isPaying.value = false
  }
}

const retryPay = () => {
  showResult.value = false
  errorMsg.value = ''
}

const closeResult = () => {
  showResult.value = false
}

const goOrderDetail = () => {
  showResult.value = false
  Taro.redirectTo({ url: `/pages/order/detail?id=${orderId.value}` })
}

onMounted(() => {
  const id = router.params.id
  if (id) {
    orderId.value = parseInt(id)
    loadOrderInfo()
  } else {
    Taro.showToast({ title: '订单参数错误', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.pay-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.pay-amount-section {
  background-color: $bg-primary;
  padding: $spacing-xl $spacing-md;
  text-align: center;
  margin-bottom: $spacing-md;
}

.amount-label {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}

.amount-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: $spacing-md;
}

.amount-symbol {
  font-size: $font-size-lg;
  color: $error-color;
  font-weight: bold;
  margin-right: 4rpx;
}

.amount-number {
  font-size: 72rpx;
  color: $error-color;
  font-weight: bold;
  line-height: 1;
}

.order-no {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.pay-method-section {
  background-color: $bg-primary;
  margin: 0 $spacing-md;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.section-title {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: bold;
  margin-bottom: $spacing-md;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.method-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md;
  border: 2rpx solid $border-color;
  border-radius: $radius-md;
  transition: all 0.2s;

  &.active {
    border-color: $primary-color;
    background-color: rgba($primary-color, 0.05);
  }
}

.method-left {
  display: flex;
  align-items: center;
}

.method-icon {
  font-size: 48rpx;
  margin-right: $spacing-md;

  &.wechat {
    color: #07c160;
  }
}

.method-info {
  display: flex;
  flex-direction: column;
}

.method-name {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.method-desc {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.radio {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: $font-size-xs;

  &.checked {
    background-color: $primary-color;
    border-color: $primary-color;
    color: #fff;
  }
}

.pay-tips {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg 0;
}

.tips-icon {
  font-size: $font-size-sm;
  margin-right: $spacing-xs;
}

.tips-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.pay-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
}

.pay-btn {
  width: 100%;
  padding: $spacing-md;
  background-color: $primary-color;
  color: #fff;
  text-align: center;
  border-radius: $radius-lg;
  font-size: $font-size-lg;
  font-weight: bold;

  &.loading {
    opacity: 0.7;
  }
}

.result-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-content {
  width: 600rpx;
  background-color: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  text-align: center;
}

.result-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto $spacing-lg;
  font-size: 60rpx;
  color: #fff;

  &.success {
    background-color: $success-color;
  }

  &.fail {
    background-color: $error-color;
  }
}

.result-title {
  display: block;
  font-size: $font-size-xl;
  color: $text-primary;
  font-weight: bold;
  margin-bottom: $spacing-sm;
}

.result-desc {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xl;
  line-height: 1.5;
}

.result-actions {
  display: flex;
  gap: $spacing-md;
}

.result-btn {
  flex: 1;
  padding: $spacing-md;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  text-align: center;

  &.outline {
    background-color: $bg-primary;
    border: 1rpx solid $border-color;
    color: $text-secondary;
  }

  &.primary {
    background-color: $primary-color;
    color: #fff;
  }
}
</style>
