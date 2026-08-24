<template>
  <view class="batch-adjust-page">
    <page-header title="批量调价" @back="goBack" />

    <form ref="formRef" :model="form" class="adjust-form">
      <!-- 调价范围 -->
      <view class="form-section">
        <view class="section-title">调价范围</view>
        <view class="form-item">
          <text class="form-label">商品范围</text>
          <view class="scope-options">
            <view
              class="scope-option"
              :class="{ 'scope-option--active': form.scope === 'all' }"
              @tap="form.scope = 'all'"
            >
              <text>全部商品</text>
            </view>
            <view
              class="scope-option"
              :class="{ 'scope-option--active': form.scope === 'category' }"
              @tap="form.scope = 'category'"
            >
              <text>指定分类</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 调价方式 -->
      <view class="form-section">
        <view class="section-title">调价方式</view>
        <view class="form-item">
          <view class="type-row">
            <view
              v-for="item in adjustTypes"
              :key="item.value"
              class="type-option"
              :class="{ 'type-option--active': form.adjustType === item.value }"
              @tap="form.adjustType = item.value"
            >
              <text class="type-label">{{ item.label }}</text>
              <text class="type-desc">{{ item.desc }}</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">{{ valueLabel }}</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.adjustValue"
              type="digit"
              :placeholder="valuePlaceholder"
              placeholder-class="input-placeholder"
              @input="clearError('adjustValue')"
            />
          </view>
          <view class="field-error" v-if="errors.adjustValue">
            <text class="error-text">{{ errors.adjustValue }}</text>
          </view>
        </view>
      </view>

      <!-- 预览结果 -->
      <view class="form-section" v-if="previewList.length > 0">
        <view class="section-title">
          预览结果（共{{ previewTotal }}件）
        </view>
        <view class="preview-list">
          <view class="preview-item" v-for="item in previewList" :key="item.productId">
            <text class="preview-name">{{ item.productName }}</text>
            <view class="preview-prices">
              <text class="price-old">¥{{ item.originalPrice.toFixed(2) }}</text>
              <text class="price-arrow">→</text>
              <text class="price-new">¥{{ item.newPrice.toFixed(2) }}</text>
              <text class="price-diff" :class="{ 'price-diff--up': item.diff > 0, 'price-diff--down': item.diff < 0 }">
                {{ item.diff > 0 ? '+' : '' }}{{ item.diff.toFixed(2) }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <button class="preview-btn" @tap="onPreview" :disabled="previewing">
        {{ previewing ? '预览中...' : '预览调价结果' }}
      </button>
      <button class="submit-btn" @tap="onExecute" :disabled="executing || previewList.length === 0">
        {{ executing ? '执行中...' : '确认执行调价' }}
      </button>
    </form>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { priceApi, type BatchPreviewResult } from '@/api/modules/price'

const formRef = ref<any>(null)
const previewing = ref(false)
const executing = ref(false)
const previewList = ref<BatchPreviewResult['previewList']>([])
const previewTotal = ref(0)

const adjustTypes = [
  { value: 'percent' as const, label: '按比例', desc: '按百分比调整' },
  { value: 'fixed' as const, label: '固定额', desc: '增减固定金额' },
  { value: 'set' as const, label: '直接设价', desc: '设置为指定价格' },
]

const form = reactive({
  scope: 'all' as 'all' | 'category',
  adjustType: 'percent' as 'percent' | 'fixed' | 'set',
  adjustValue: '',
})

const rules: Rules = {
  adjustValue: [
    { required: true, message: '请输入调价数值' },
    {
      validator: (value: string) => {
        const num = parseFloat(value)
        if (isNaN(num)) return false
        if (form.adjustType === 'percent') return num >= -100 && num <= 1000
        return num >= 0
      },
      message: '请输入有效的数值（比例范围 -100~1000）',
    },
  ],
}

const { errors, validate, clearError } = useFormValidation(form, rules)

const valueLabel = computed(() => {
  if (form.adjustType === 'percent') return '调整比例 (%)'
  if (form.adjustType === 'fixed') return '调整金额 (元)'
  return '目标价格 (元)'
})

const valuePlaceholder = computed(() => {
  if (form.adjustType === 'percent') return '如：10（涨价10%）或 -5（降价5%）'
  if (form.adjustType === 'fixed') return '如：5（加价5元）或 -3（减价3元）'
  return '如：88.00'
})

function buildParams() {
  return {
    adjustType: form.adjustType,
    adjustValue: parseFloat(form.adjustValue),
    categoryIds: form.scope === 'category' ? undefined : undefined,
  }
}

async function onPreview() {
  const valid = await validate()
  if (!valid) return

  previewing.value = true
  try {
    const result = await priceApi.previewBatch(buildParams())
    previewList.value = result?.previewList ?? []
    previewTotal.value = result?.totalProducts ?? previewList.value.length
    uni.showToast({ title: `共${previewTotal.value}件商品将调价`, icon: 'none' })
  } catch (err) {
    console.error('预览失败:', err)
  } finally {
    previewing.value = false
  }
}

async function onExecute() {
  if (previewList.value.length === 0) {
    uni.showToast({ title: '请先预览调价结果', icon: 'none' })
    return
  }

  uni.showModal({
    title: '确认执行',
    content: `将对${previewTotal.value}件商品执行调价，确认继续？`,
    success: async (res) => {
      if (res.confirm) {
        executing.value = true
        uni.showLoading({ title: '执行中...' })
        try {
          const result = await priceApi.executeBatch(buildParams())
          uni.hideLoading()
          const success = result?.successCount ?? 0
          const fail = result?.failCount ?? 0
          uni.showModal({
            title: '执行完成',
            content: `成功${success}件，失败${fail}件\n批次号：${result?.batchNo ?? '-'}`,
            showCancel: false,
            success: () => {
              uni.navigateBack()
            },
          })
        } catch (err) {
          uni.hideLoading()
          console.error('执行失败:', err)
        } finally {
          executing.value = false
        }
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.batch-adjust-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.adjust-form { padding: $uni-spacing-sm $uni-spacing-base; }
.form-section {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm; box-shadow: $uni-shadow-card-sm;
}
.section-title { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; margin-bottom: $uni-spacing-md; }
.form-item { margin-bottom: $uni-spacing-md; }
.form-label { font-size: 26rpx; color: $uni-gray-500; margin-bottom: $uni-spacing-sm; display: block; }
.form-control { position: relative; }
.form-input {
  width: 100%; height: 80rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base; font-size: 28rpx; color: $uni-gray-700; box-sizing: border-box;
}
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.field-error { margin-top: $uni-spacing-xs; }
.error-text { font-size: 24rpx; color: $uni-color-error; }
.scope-options { display: flex; gap: $uni-spacing-sm; }
.scope-option {
  flex: 1; height: 72rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs;
  display: flex; align-items: center; justify-content: center;
  font-size: 26rpx; color: $uni-gray-500; border: 2rpx solid transparent;
}
.scope-option--active { background: $uni-color-primary-soft; border-color: $uni-color-primary; color: $uni-color-primary; }
.type-row { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.type-option {
  display: flex; flex-direction: column; padding: $uni-spacing-sm $uni-spacing-base;
  background: $uni-bg-color-page; border-radius: $uni-border-radius-xs; border: 2rpx solid transparent;
}
.type-option--active { background: $uni-color-primary-soft; border-color: $uni-color-primary; }
.type-label { font-size: 28rpx; font-weight: 500; color: $uni-gray-700; }
.type-desc { font-size: 22rpx; color: $uni-gray-400; margin-top: 4rpx; }
.preview-list { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.preview-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: $uni-spacing-sm; background: $uni-color-primary-soft; border-radius: 8rpx;
}
.preview-name { font-size: 26rpx; color: $uni-gray-700; flex: 1; }
.preview-prices { display: flex; align-items: center; gap: $uni-spacing-xs; }
.price-old { font-size: 24rpx; color: $uni-gray-400; }
.price-arrow { font-size: 22rpx; color: $uni-gray-300; }
.price-new { font-size: 28rpx; font-weight: 600; color: $uni-color-primary; }
.price-diff { font-size: 22rpx; color: $uni-gray-400; margin-left: $uni-spacing-xs; }
.price-diff--up { color: $uni-color-error; }
.price-diff--down { color: $uni-color-success; }
.preview-btn {
  width: 100%; height: 80rpx; background: $uni-bg-color; border: 2rpx solid $uni-color-primary;
  border-radius: 44rpx; font-size: 28rpx; font-weight: 600; color: $uni-color-primary;
  margin-top: 16rpx; display: flex; align-items: center; justify-content: center;
}
.preview-btn::after { border: none; }
.preview-btn[disabled] { opacity: 0.5; }
.submit-btn {
  width: 100%; height: 88rpx; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx; font-size: 30rpx; font-weight: 600; color: $uni-text-color-inverse; border: none;
  margin-top: 16rpx; display: flex; align-items: center; justify-content: center;
}
.submit-btn::after { border: none; }
.submit-btn[disabled] { opacity: 0.5; }
.safe-bottom { height: 40rpx; }
</style>
