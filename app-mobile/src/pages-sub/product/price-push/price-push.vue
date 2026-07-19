<template>
  <view class="price-push-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">报价推送</text>
    </view>

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
    const res = await get('/admin/quote-push/history', { page: 1, pageSize: 10 })
    quoteList.value = res?.list || res?.records || []
  } catch (err) {
    console.error('加载报价历史失败:', err)
  }
}

onMounted(() => {
  loadQuoteHistory()
})
</script>

<style scoped>
.price-push-page {
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

.push-form {
  padding: 16rpx 24rpx;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.form-picker {
  width: 100%;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.picker-arrow {
  font-size: 32rpx;
  color: #bbb;
}

.input-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.channel-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.channel-check {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
}

.channel-check--active {
  background: #1677FF;
  border-color: #1677FF;
}

.channel-label {
  font-size: 26rpx;
  color: #333;
}

.field-error {
  margin-top: 8rpx;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: #ff4d4f;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
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
  padding: 0 24rpx;
}

.quote-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
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
  color: #333;
  font-weight: 600;
}

.quote-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.quote-status.sent {
  background: #e6f7ff;
  color: #1677FF;
}

.quote-status.read {
  background: #f6ffed;
  color: #52c41a;
}

.status-text {
  font-size: 22rpx;
}

.quote-body {
  display: flex;
  gap: 24rpx;
  margin-bottom: 16rpx;
}

.quote-info {
  font-size: 24rpx;
  color: #666;
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
  background: #1677FF;
  color: #fff;
}

.action-btn::after {
  border: none;
}

.safe-bottom {
  height: 40rpx;
}
</style>