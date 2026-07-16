<template>
  <view class="cashier-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <view class="scan-btn" @tap="onScan">
        <text class="scan-icon">&#xe614;</text>
        <text class="scan-text">扫码添加</text>
      </view>
      <view class="search-wrap">
        <input
          class="search-input"
          v-model="searchKeyword"
          type="text"
          placeholder="输入商品名称/条码"
          placeholder-class="search-placeholder"
          @confirm="onSearchProduct"
        />
      </view>
    </view>

    <!-- 搜索结果浮层 -->
    <view class="search-result" v-if="showSearchResult && searchResults.length > 0">
      <scroll-view class="result-list" scroll-y>
        <view
          class="result-item"
          v-for="item in searchResults"
          :key="item.productId"
          @tap="addCartItem(item)"
        >
          <view class="result-info">
            <text class="result-name">{{ item.productName }}</text>
            <text class="result-sku">条码：{{ item.sku }}</text>
          </view>
          <text class="result-price">¥{{ item.price.toFixed(2) }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="cashier-body">
      <!-- 购物车列表 -->
      <scroll-view class="cart-list" scroll-y>
        <view class="empty-cart" v-if="cartItems.length === 0">
          <text class="empty-icon">&#xe631;</text>
          <text class="empty-text">购物车为空，请扫码或搜索添加商品</text>
        </view>

        <view class="cart-item" v-for="(item, index) in cartItems" :key="item.productId">
          <view class="cart-info">
            <text class="cart-name">{{ item.productName }}</text>
            <text class="cart-price">¥{{ item.price.toFixed(2) }}</text>
          </view>
          <view class="cart-quantity">
            <view class="qty-btn" @tap="decreaseQty(index)">-</view>
            <input class="qty-input" v-model="item.quantity" type="number" @input="onQtyChange(index)" />
            <view class="qty-btn" @tap="increaseQty(index)">+</view>
          </view>
          <text class="cart-subtotal">¥{{ item.subtotal.toFixed(2) }}</text>
          <view class="cart-delete" @tap="removeItem(index)">&#xe615;</view>
        </view>
      </scroll-view>

      <!-- 会员 & 优惠 -->
      <view class="member-section" v-if="cartItems.length > 0">
        <view class="member-row" @tap="goMemberIdentify">
          <text class="member-label">会员</text>
          <text class="member-value" v-if="memberInfo">{{ memberInfo.name }}（{{ memberInfo.levelName }}）</text>
          <text class="member-placeholder" v-else>点击识别会员</text>
          <text class="member-arrow">&#xe616;</text>
        </view>
        <view class="member-row">
          <text class="member-label">优惠</text>
          <text class="member-value">¥{{ discountAmount.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 底部结算栏 -->
    <view class="bottom-bar" v-if="cartItems.length > 0">
      <view class="bottom-total">
        <text class="total-label">合计</text>
        <text class="total-amount">¥{{ payableAmount.toFixed(2) }}</text>
        <view class="hold-btn" @tap="onHoldOrder">
          <text class="hold-text">挂单</text>
        </view>
      </view>
      <button class="checkout-btn" :disabled="submitting" @tap="onCheckout">
        {{ submitting ? '结算中...' : '收银结账' }}
      </button>
    </view>

    <!-- 支付方式弹窗 -->
    <view class="pay-mask" v-if="showPayPanel" @tap="showPayPanel = false">
      <view class="pay-panel" @tap.stop>
        <view class="panel-header">
          <text class="panel-title">选择支付方式</text>
          <text class="panel-close" @tap="showPayPanel = false">&#xe615;</text>
        </view>
        <view class="pay-amount-row">
          <text class="pay-amount-label">应收金额</text>
          <text class="pay-amount-value">¥{{ payableAmount.toFixed(2) }}</text>
        </view>
        <view class="pay-channels">
          <view
            class="pay-channel"
            v-for="ch in payChannels"
            :key="ch.value"
            :class="{ 'pay-channel--active': payChannel === ch.value }"
            @tap="payChannel = ch.value"
          >
            <text class="channel-icon">{{ ch.icon }}</text>
            <text class="channel-name">{{ ch.label }}</text>
          </view>
        </view>
        <!-- 现金支付：输入实收金额 -->
        <view class="cash-input-row" v-if="payChannel === 'cash'">
          <text class="cash-label">实收金额</text>
          <input
            class="cash-input"
            v-model="receivedAmountStr"
            type="digit"
            placeholder="0.00"
            placeholder-class="cash-placeholder"
          />
          <view class="quick-amount">
            <text class="quick-amt-btn" @tap="setReceivedAmount(payableAmount)"> exact </text>
            <text class="quick-amt-btn" @tap="setReceivedAmount(Math.ceil(payableAmount / 50) * 50)">50</text>
            <text class="quick-amt-btn" @tap="setReceivedAmount(Math.ceil(payableAmount / 100) * 100)">100</text>
          </view>
        </view>
        <view class="cash-change-row" v-if="payChannel === 'cash' && receivedAmount > 0">
          <text class="change-label">找零</text>
          <text class="change-value">¥{{ changeAmount.toFixed(2) }}</text>
        </view>
        <button class="confirm-pay-btn" :disabled="submitting" @tap="confirmPay">
          {{ submitting ? '处理中...' : '确认收款' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { cashierApi, shiftApi, holdOrderApi, type CashierItem, type MemberIdentifyResult, type PaymentChannel } from '@/api/modules/cashier'

const searchKeyword = ref('')
const showSearchResult = ref(false)
const searchResults = ref<CashierItem[]>([])
const cartItems = ref<CashierItem[]>([])
const memberInfo = ref<MemberIdentifyResult | null>(null)
const discountAmount = ref(0)
const submitting = ref(false)

// 支付相关
const showPayPanel = ref(false)
const payChannel = ref<'cash' | 'wechat' | 'alipay' | 'store_card'>('cash')
const receivedAmountStr = ref('')
const receivedAmount = ref(0)
const currentShiftId = ref<number | undefined>(undefined)

// 支付方式列表（本地默认值，可由后端覆盖）
const payChannels = ref<PaymentChannel[]>([
  { value: 'cash', label: '现金', icon: '¥' },
  { value: 'wechat', label: '微信', icon: 'W' },
  { value: 'alipay', label: '支付宝', icon: 'A' },
  { value: 'store_card', label: '储值卡', icon: 'S' },
])

const payableAmount = computed(() => {
  const total = cartItems.value.reduce((sum, item) => sum + item.subtotal, 0)
  return Math.max(0, total - discountAmount.value)
})

const changeAmount = computed(() => {
  return Math.max(0, receivedAmount.value - payableAmount.value)
})

function onScan() {
  uni.scanCode({
    onlyFromCamera: false,
    success: async (res) => {
      try {
        const product = await cashierApi.scanProduct(res.result)
        addCartItem(product)
      } catch (err) {
        uni.showToast({ title: '未识别到商品', icon: 'none' })
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码已取消', icon: 'none' })
    }
  })
}

async function onSearchProduct() {
  const kw = searchKeyword.value.trim()
  if (!kw) {
    showSearchResult.value = false
    return
  }
  try {
    // 复用商品搜索接口（按名称/条码查询）
    const product = await cashierApi.scanProduct(kw)
    searchResults.value = [product]
    showSearchResult.value = true
  } catch (err) {
    showSearchResult.value = false
    uni.showToast({ title: '未找到商品', icon: 'none' })
  }
}

function addCartItem(item: CashierItem) {
  const existing = cartItems.value.find((c) => c.productId === item.productId)
  if (existing) {
    existing.quantity += 1
    existing.subtotal = existing.price * existing.quantity
  } else {
    cartItems.value.push({
      ...item,
      quantity: 1,
      subtotal: item.price,
    })
  }
  searchKeyword.value = ''
  showSearchResult.value = false
}

function increaseQty(index: number) {
  const item = cartItems.value[index]!
  item.quantity += 1
  item.subtotal = item.price * item.quantity
}

function decreaseQty(index: number) {
  const item = cartItems.value[index]!
  if (item.quantity > 1) {
    item.quantity -= 1
    item.subtotal = item.price * item.quantity
  } else {
    cartItems.value.splice(index, 1)
  }
}

function onQtyChange(index: number) {
  const item = cartItems.value[index]!
  const qty = Math.max(1, Number(item.quantity) || 1)
  item.quantity = qty
  item.subtotal = item.price * qty
}

function removeItem(index: number) {
  cartItems.value.splice(index, 1)
}

function goMemberIdentify() {
  uni.navigateTo({
    url: '/pages/member-identify/member-identify',
    events: {
      onMemberSelected: (member: MemberIdentifyResult) => {
        memberInfo.value = member
      }
    }
  })
}

async function onHoldOrder() {
  if (cartItems.value.length === 0) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  try {
    await holdOrderApi.hold({
      items: cartItems.value.map((c) => ({ ...c })),
      memberId: memberInfo.value?.id,
      remark: '',
    })
    uni.showToast({ title: '挂单成功', icon: 'success' })
    resetCart()
  } catch (err) {
    uni.showToast({ title: '挂单失败', icon: 'none' })
  }
}

function resetCart() {
  cartItems.value = []
  memberInfo.value = null
  discountAmount.value = 0
  receivedAmountStr.value = ''
  receivedAmount.value = 0
  showPayPanel.value = false
}

function onCheckout() {
  if (cartItems.value.length === 0) return
  showPayPanel.value = true
  payChannel.value = 'cash'
  receivedAmountStr.value = ''
  receivedAmount.value = 0
}

function setReceivedAmount(amount: number) {
  receivedAmount.value = amount
  receivedAmountStr.value = amount.toFixed(2)
}

async function confirmPay() {
  if (submitting.value) return
  if (payChannel.value === 'cash' && receivedAmount.value < payableAmount.value) {
    uni.showToast({ title: '实收金额不足', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await cashierApi.createCashierOrder({
      items: cartItems.value.map((c) => ({ ...c })),
      memberId: memberInfo.value?.id,
      paymentChannel: payChannel.value,
      receivedAmount: payChannel.value === 'cash' ? receivedAmount.value : undefined,
      discountAmount: discountAmount.value,
      shiftId: currentShiftId.value,
    })
    uni.showModal({
      title: '收银成功',
      content: `订单号：${result.orderNo}\n应收：¥${result.paidAmount.toFixed(2)}${payChannel.value === 'cash' ? `\n找零：¥${result.changeAmount.toFixed(2)}` : ''}`,
      showCancel: false,
      success: () => {
        resetCart()
      }
    })
  } catch (err) {
    uni.showToast({ title: '收银失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

// 初始化：获取当前班次与支付方式
async function init() {
  try {
    const [shift, channels] = await Promise.allSettled([
      shiftApi.getCurrentShift(),
      cashierApi.getPaymentChannels(),
    ])
    if (shift.status === 'fulfilled' && shift.value) {
      currentShiftId.value = shift.value.id
    }
    if (channels.status === 'fulfilled' && channels.value && channels.value.length > 0) {
      payChannels.value = channels.value
    }
  } catch (err) {
    // 忽略初始化错误，使用默认值
  }
}

init()
</script>

<style scoped>
.cashier-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

/* 顶部操作栏 */
.top-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-top: calc(20rpx + env(safe-area-inset-top));
  background: #fff;
  gap: 16rpx;
}

.scan-btn {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 36rpx;
  gap: 8rpx;
}

.scan-icon {
  font-size: 32rpx;
  color: #fff;
}

.scan-text {
  font-size: 26rpx;
  color: #fff;
}

.search-wrap {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

/* 搜索结果 */
.search-result {
  position: absolute;
  top: 140rpx;
  left: 24rpx;
  right: 24rpx;
  max-height: 500rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
}

.result-list {
  max-height: 500rpx;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.result-item:last-child {
  border-bottom: none;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.result-sku {
  font-size: 22rpx;
  color: #999;
}

.result-price {
  font-size: 28rpx;
  color: #1677FF;
  font-weight: 600;
}

/* 主体 */
.cashier-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cart-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.cart-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.cart-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.cart-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.cart-price {
  font-size: 24rpx;
  color: #999;
}

.cart-quantity {
  display: flex;
  align-items: center;
  margin: 0 16rpx;
}

.qty-btn {
  width: 48rpx;
  height: 48rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #1677FF;
  font-weight: 600;
}

.qty-input {
  width: 80rpx;
  height: 48rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
  margin: 0 8rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
}

.cart-subtotal {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  min-width: 120rpx;
  text-align: right;
  margin-right: 12rpx;
}

.cart-delete {
  font-size: 32rpx;
  color: #ff4d4f;
  padding: 4rpx;
}

/* 会员 & 优惠 */
.member-section {
  background: #fff;
  margin: 0 24rpx 16rpx;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
}

.member-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.member-row:last-child {
  border-bottom: none;
}

.member-label {
  font-size: 26rpx;
  color: #999;
  width: 100rpx;
}

.member-value {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.member-placeholder {
  flex: 1;
  font-size: 28rpx;
  color: #bbb;
}

.member-arrow {
  font-size: 28rpx;
  color: #bbb;
}

/* 底部结算栏 */
.bottom-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.bottom-total {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 12rpx;
}

.total-amount {
  font-size: 40rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.hold-btn {
  margin-left: 24rpx;
  padding: 8rpx 24rpx;
  background: #f5f7fa;
  border-radius: 24rpx;
}

.hold-text {
  font-size: 24rpx;
  color: #666;
}

.checkout-btn {
  width: 240rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.checkout-btn::after {
  border: none;
}

.checkout-btn[disabled] {
  opacity: 0.5;
}

/* 支付弹窗 */
.pay-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.pay-panel {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
}

.panel-close {
  font-size: 32rpx;
  color: #999;
  padding: 4rpx;
}

.pay-amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  background: #fff7e6;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}

.pay-amount-label {
  font-size: 26rpx;
  color: #fa8c16;
}

.pay-amount-value {
  font-size: 40rpx;
  font-weight: 700;
  color: #fa8c16;
}

.pay-channels {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.pay-channel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0;
  background: #f5f7fa;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
}

.pay-channel--active {
  background: #e6f4ff;
  border-color: #1677FF;
}

.channel-icon {
  font-size: 36rpx;
  color: #1677FF;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.channel-name {
  font-size: 24rpx;
  color: #333;
}

.pay-channel--active .channel-name {
  color: #1677FF;
  font-weight: 600;
}

/* 现金输入 */
.cash-input-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-top: 1rpx solid #f0f0f0;
}

.cash-label {
  font-size: 28rpx;
  color: #333;
  width: 160rpx;
}

.cash-input {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  color: #333;
  font-weight: 600;
}

.cash-placeholder {
  color: #bbb;
  font-size: 28rpx;
  font-weight: normal;
}

.quick-amount {
  display: flex;
  gap: 8rpx;
  margin-left: 16rpx;
}

.quick-amt-btn {
  font-size: 22rpx;
  color: #1677FF;
  padding: 8rpx 16rpx;
  background: #e6f4ff;
  border-radius: 20rpx;
}

.cash-change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-top: 1rpx solid #f0f0f0;
}

.change-label {
  font-size: 28rpx;
  color: #333;
}

.change-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.confirm-pay-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 24rpx;
}

.confirm-pay-btn::after {
  border: none;
}

.confirm-pay-btn[disabled] {
  opacity: 0.5;
}
</style>
