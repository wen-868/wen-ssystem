<template>
  <view class="price-push-page">
    <!-- 顶部栏 -->
    <page-header title="报价推送" @back="goBack" />

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="pushForm" :rules="pushRules" class="push-form" @submit="handlePush">
      <view class="form-section">
        <view class="section-title">新建报价单</view>

        <view class="form-item">
          <view class="form-label">报价有效期</view>
          <picker
            :value="pushForm.validityIndex"
            :range="validityOptions"
            @change="onValidityChange"
          >
            <view class="form-picker">
              <text>{{ validityOptions[pushForm.validityIndex] ?? '请选择有效期' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <view class="form-label">推送对象</view>
          <picker
            :value="pushForm.targetIndex"
            :range="targetOptions"
            @change="onTargetChange"
          >
            <view class="form-picker">
              <text>{{ targetOptions[pushForm.targetIndex] ?? '请选择推送对象' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
          <view class="field-error" v-if="errors.targetIndex">
            <text class="error-text">{{ errors.targetIndex }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">行情说明</view>
          <textarea
            class="form-textarea"
            v-model="pushForm.marketNote"
            placeholder="如：本周茅台到货，价格下调5%"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <view class="form-label">推送渠道</view>
          <view class="channel-group">
            <view class="channel-item" v-for="ch in channels" :key="ch.value">
              <view
                class="channel-check"
                :class="{ 'channel-check--active': pushForm.channels.includes(ch.value) }"
                @tap="toggleChannel(ch.value)"
              >
                <text v-if="pushForm.channels.includes(ch.value)">✓</text>
              </view>
              <text class="channel-label">{{ ch.label }}</text>
            </view>
          </view>
        </view>

        <button
          class="submit-btn"
          form-type="submit"
          :disabled="pushing"
        >
          {{ pushing ? '推送中...' : '一键推送报价' }}
        </button>
      </view>
    </form>

    <!-- 报价单历史 -->
    <view class="history-section" v-if="quoteList.length > 0">
      <view class="section-title">报价单记录</view>
      <view class="quote-card" v-for="item in quoteList" :key="item.quoteNo">
        <view class="quote-header">
          <text class="quote-no">报价单：{{ item.quoteNo }}</text>
          <view class="quote-status" :class="item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="quote-body">
          <text class="quote-info">有效期：{{ item.validity }}</text>
          <text class="quote-info">商品数：{{ item.productCount }}</text>
          <text class="quote-info">已读：{{ item.readCount }}/{{ item.totalCount }}</text>
        </view>
        <view class="quote-actions" v-if="item.status === 'sent'">
          <button class="action-btn resend-btn" @tap="resendQuote(item)">重新推送</button>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { post, get } from '@/api/request'

const formRef = ref<any>(null)
const pushForm = reactive({
  validityIndex: 0,
  targetIndex: 0,
  marketNote: '',
  channels: ['app', 'wechat'] as string[],
})

const validityOptions = ['今日有效', '本周有效', '本月有效', '自定义']
const targetOptions = ['全部客户', '按等级推送', '按标签推送', '手动选择']

const pushRules: Rules = {
  targetIndex: [
    { required: true, message: '请选择推送对象' },
  ],
}

const { errors, validate, clearError } = useFormValidation(pushForm, pushRules)

const channels = [
  { label: '站内信', value: 'app' },
  { label: '微信推送', value: 'wechat' },
  { label: '短信通知', value: 'sms' },
]

const pushing = ref(false)
const quoteList = ref<any[]>([])

function onValidityChange(e: any) {
  pushForm.validityIndex = e.detail.value
}

function onTargetChange(e: any) {
  pushForm.targetIndex = e.detail.value
}

function toggleChannel(value: string) {
  const idx = pushForm.channels.indexOf(value)
  if (idx > -1) {
    pushForm.channels.splice(idx, 1)
  } else {
    pushForm.channels.push(value)
  }
}

async function handlePush() {
  if (!validate()) return
  if (pushForm.channels.length === 0) {
    uni.showToast({ title: '请选择至少一个推送渠道', icon: 'none' })
    return
  }
  pushing.value = true
  try {
    await post('/admin/quote-push', {
      validity: validityOptions[pushForm.validityIndex],
      target: targetOptions[pushForm.targetIndex],
      marketNote: pushForm.marketNote,
      channels: pushForm.channels,
    })
    uni.showToast({ title: '报价已推送', icon: 'success' })
    loadQuoteHistory()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '推送失败', icon: 'none' })
  } finally {
    pushing.value = false
  }
}

async function resendQuote(item: any) {
  uni.showModal({
    title: '重新推送',
    content: '确定要重新推送此报价单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await post(`/admin/quote-push/${item.quoteNo}/resend`, {})
          uni.showToast({ title: '已推送', icon: 'success' })
          loadQuoteHistory()
        } catch (err: any) {
          uni.showToast({ title: err?.message || '推送失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadQuoteHistory() {
  try {
    // 后端 quote-push 路由：GET /api/admin/quote-push（分页查询列表）
    const res = await get('/admin/quote-push', { page: 1, pageSize: 10 })
    quoteList.value = res?.list || res?.records || []
  } catch (err) {
    console.error('加载报价历史失败:', err)
  }
}

onMounted(() => {
  loadQuoteHistory()
})
</script>

<style lang="scss" scoped>
.price-push-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}

.push-form {
  padding: $uni-spacing-sm $uni-spacing-base;
}

.form-section {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-md;
}

.form-item {
  margin-bottom: $uni-spacing-md;
}

.form-label {
  font-size: 26rpx;
  color: $uni-gray-500;
  margin-bottom: $uni-spacing-xs;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.form-picker {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.picker-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.input-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.channel-group {
  display: flex;
  flex-wrap: wrap;
  gap: $uni-spacing-sm;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: $uni-spacing-xs;
}

.channel-check {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: $uni-text-color-inverse;
}

.channel-check--active {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.channel-label {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.field-error {
  margin-top: $uni-spacing-xs;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 20rpx;
}

.submit-btn::after {
  border: none;
}

.history-section {
  padding: 0 $uni-spacing-lg;
}

.quote-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.quote-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.quote-no {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 600;
}

.quote-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.quote-status.sent {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

.quote-status.read {
  background: $uni-color-success-soft;
  color: $uni-color-success;
}

.status-text {
  font-size: 22rpx;
}

.quote-body {
  display: flex;
  gap: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
}

.quote-info {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.quote-actions {
  display: flex;
}

.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.resend-btn {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}

.action-btn::after {
  border: none;
}

.safe-bottom {
  height: 40rpx;
}
</style>
