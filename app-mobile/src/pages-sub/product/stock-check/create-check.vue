<template>
  <view class="create-check-page">
    <page-header title="新建盘点单" @back="goBack" />

    <form ref="formRef" :model="form" class="check-form">
      <view class="form-section">
        <view class="form-item">
          <text class="form-label">盘点标题</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.title"
              type="text"
              placeholder="请输入盘点标题（如：2026年7月月度盘点）"
              placeholder-class="input-placeholder"
              @input="clearError('title')"
            />
          </view>
          <view class="field-error" v-if="errors.title">
            <text class="error-text">{{ errors.title }}</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">盘点范围</text>
          <view class="scope-options">
            <view class="scope-option" :class="{ 'scope-option--active': form.scope === 'all' }" @tap="form.scope = 'all'">
              <text>全部商品</text>
            </view>
            <view class="scope-option" :class="{ 'scope-option--active': form.scope === 'category' }" @tap="form.scope = 'category'">
              <text>指定分类</text>
            </view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="form-item">
          <text class="form-label">备注说明</text>
          <view class="form-control">
            <textarea
              class="form-textarea"
              v-model="form.remark"
              placeholder="选填，盘点说明"
              placeholder-class="input-placeholder"
              maxlength="200"
            />
          </view>
        </view>
      </view>

      <view class="tips-card">
        <text class="tips-title">盘点流程说明</text>
        <text class="tips-text">1. 创建盘点单后状态为「草稿」</text>
        <text class="tips-text">2. 点击「开始盘点」后进入盘点中</text>
        <text class="tips-text">3. 逐项录入实际数量，系统自动计算差异</text>
        <text class="tips-text">4. 处理差异后点击「完成盘点」</text>
      </view>

      <button class="submit-btn" @tap="onSubmit" :disabled="submitting">
        {{ submitting ? '创建中...' : '创建盘点单' }}
      </button>
    </form>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { stockCheckApi } from '@/api/modules/stock-check'

const formRef = ref<any>(null)
const submitting = ref(false)

const form = reactive({
  title: '',
  scope: 'all' as 'all' | 'category',
  remark: '',
})

const rules: Rules = {
  title: [
    { required: true, message: '请输入盘点标题' },
    { minLength: 2, message: '标题至少2个字' },
    { maxLength: 50, message: '标题最多50个字' },
  ],
}

const { errors, validate, clearError } = useFormValidation(form, rules)

async function onSubmit() {
  const valid = await validate()
  if (!valid) return

  submitting.value = true
  uni.showLoading({ title: '创建中...' })
  try {
    await stockCheckApi.create({
      title: form.title,
      remark: form.remark || undefined,
    })
    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err) {
    uni.hideLoading()
    console.error('创建盘点单失败:', err)
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-check-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.check-form { padding: $uni-spacing-sm $uni-spacing-base; }
.form-section { background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base; margin-bottom: $uni-spacing-sm; box-shadow: $uni-shadow-card-sm; }
.form-item { margin-bottom: $uni-spacing-md; }
.form-label { font-size: 26rpx; color: $uni-gray-500; margin-bottom: $uni-spacing-sm; display: block; }
.form-control { position: relative; }
.form-input { width: 100%; height: 80rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs; padding: 0 $uni-spacing-base; font-size: 28rpx; color: $uni-gray-700; box-sizing: border-box; }
.form-textarea { width: 100%; height: 160rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs; padding: $uni-spacing-md $uni-spacing-base; font-size: 28rpx; color: $uni-gray-700; box-sizing: border-box; }
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.field-error { margin-top: $uni-spacing-xs; }
.error-text { font-size: 24rpx; color: $uni-color-error; }
.scope-options { display: flex; gap: $uni-spacing-sm; }
.scope-option { flex: 1; height: 72rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs; display: flex; align-items: center; justify-content: center; font-size: 26rpx; color: $uni-gray-500; border: 2rpx solid transparent; }
.scope-option--active { background: $uni-color-primary-soft; border-color: $uni-color-primary; color: $uni-color-primary; }
.tips-card { background: $uni-color-warning-soft; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base; margin-bottom: $uni-spacing-base; border: 1rpx solid $uni-color-warning-soft; }
.tips-title { font-size: 26rpx; font-weight: 600; color: $uni-color-warning; display: block; margin-bottom: $uni-spacing-sm; }
.tips-text { font-size: 24rpx; color: $uni-gray-400; display: block; line-height: 1.8; }
.submit-btn { width: 100%; height: 88rpx; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); border-radius: 44rpx; font-size: 30rpx; font-weight: 600; color: $uni-text-color-inverse; border: none; margin-top: 16rpx; }
.submit-btn::after { border: none; }
.submit-btn[disabled] { opacity: 0.5; }
.safe-bottom { height: 40rpx; }
</style>
