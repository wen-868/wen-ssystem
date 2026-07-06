<template>
  <view class="batch-price-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">批量调价</text>
    </view>

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="priceForm" :rules="priceRules" class="price-form" @submit="handlePreview">
      <view class="form-section">
        <view class="section-title">调价方式</view>
        <view class="mode-tabs">
          <view
            class="mode-tab"
            :class="{ 'mode-tab--active': priceForm.mode === 'fixed' }"
            @tap="priceForm.mode = 'fixed'"
          >
            <text>固定金额</text>
          </view>
          <view
            class="mode-tab"
            :class="{ 'mode-tab--active': priceForm.mode === 'percent' }"
            @tap="priceForm.mode = 'percent'"
          >
            <text>百分比</text>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">调价参数</view>

        <view class="form-item">
          <view class="form-label">调价方向</view>
          <view class="direction-tabs">
            <view
              class="dir-tab"
              :class="{ 'dir-tab--active': priceForm.direction === 'up' }"
              @tap="priceForm.direction = 'up'"
            >
              <text class="dir-icon">↑</text>
              <text>上调</text>
            </view>
            <view
              class="dir-tab"
              :class="{ 'dir-tab--active': priceForm.direction === 'down' }"
              @tap="priceForm.direction = 'down'"
            >
              <text class="dir-icon">↓</text>
              <text>下调</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">
            {{ priceForm.mode === 'fixed' ? '调价金额 (元)' : '调价幅度 (%)' }}
          </view>
          <input
            class="form-input"
            v-model="priceForm.value"
            type="digit"
            :placeholder="priceForm.mode === 'fixed' ? '请输入调价金额' : '请输入调价幅度'"
            placeholder-class="input-placeholder"
            @input="clearError('value')"
          />
          <view class="field-error" v-if="errors.value">
            <text class="error-text">{{ errors.value }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">价格类型</view>
          <picker
            :value="priceForm.priceTypeIndex"
            :range="priceTypeOptions"
            @change="onPriceTypeChange"
          >
            <view class="form-picker">
              <text>{{ priceTypeOptions[priceForm.priceTypeIndex] ?? '请选择' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <view class="form-label">生效时间</view>
          <picker
            mode="date"
            :value="priceForm.effectiveDate"
            @change="onDateChange"
          >
            <view class="form-picker">
              <text>{{ priceForm.effectiveDate || '请选择生效日期' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <view class="form-label">备注</view>
          <textarea
            class="form-textarea"
            v-model="priceForm.remark"
            placeholder="调价原因备注（选填）"
            placeholder-class="input-placeholder"
          />
        </view>

        <button
          class="submit-btn"
          form-type="submit"
          :disabled="previewing"
        >
          {{ previewing ? '计算中...' : '预览调价结果' }}
        </button>
      </view>
    </form>

    <!-- 调价记录 -->
    <view class="history-section" v-if="historyList.length > 0">
      <view class="section-title">调价记录</view>
      <view class="history-card" v-for="item in historyList" :key="item.batchNo">
        <view class="history-header">
          <text class="history-no">批次：{{ item.batchNo }}</text>
          <text class="history-time">{{ item.createTime }}</text>
        </view>
        <view class="history-body">
          <text class="history-info">商品数：{{ item.productCount }}</text>
          <text class="history-info">调价方式：{{ item.modeLabel }}</text>
          <text class="history-info">状态：{{ item.statusLabel }}</text>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const priceForm = reactive({
  mode: 'fixed' as 'fixed' | 'percent',
  direction: 'up' as 'up' | 'down',
  value: '',
  priceTypeIndex: 0,
  effectiveDate: '',
  remark: '',
})

const priceTypeOptions = ['批发价', '零售价', '供货价']

const priceRules: Rules = {
  value: [
    { required: true, message: '请输入调价金额或幅度' },
    { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入有效数字' },
  ],
}

const { errors, validate, clearError } = useFormValidation(priceForm, priceRules)

const previewing = ref(false)
const historyList = ref<any[]>([])

function onPriceTypeChange(e: any) {
  priceForm.priceTypeIndex = e.detail.value
}

function onDateChange(e: any) {
  priceForm.effectiveDate = e.detail.value
}

async function handlePreview() {
  if (!validate()) return
  previewing.value = true
  try {
    // TODO: 调用后端 API 预览调价结果
    uni.showToast({ title: '调价预览中...', icon: 'loading' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '预览失败', icon: 'none' })
  } finally {
    previewing.value = false
  }
}

onMounted(() => {
  // TODO: 加载调价历史记录
})
</script>

<style scoped>
.batch-price-page {
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

.price-form {
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

.mode-tabs {
  display: flex;
  gap: 16rpx;
}

.mode-tab {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666;
}

.mode-tab--active {
  background: #1677FF;
  color: #fff;
}

.direction-tabs {
  display: flex;
  gap: 16rpx;
}

.dir-tab {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: #666;
}

.dir-tab--active {
  background: #e6f7ff;
  color: #1677FF;
  border: 2rpx solid #1677FF;
}

.dir-icon {
  font-size: 24rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
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

.history-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.history-no {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
}

.history-time {
  font-size: 24rpx;
  color: #999;
}

.history-body {
  display: flex;
  gap: 24rpx;
}

.history-info {
  font-size: 24rpx;
  color: #666;
}

.safe-bottom {
  height: 40rpx;
}
</style>