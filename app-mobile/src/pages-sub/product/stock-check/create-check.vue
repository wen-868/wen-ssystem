<template>
  <view class="create-check-page">
    <view class="page-header">
      <text class="header-title">新建盘点单</text>
    </view>

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

<style scoped>
.create-check-page { min-height: 100vh; background: #f0f5ff; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.check-form { padding: 16rpx 24rpx; }
.form-section { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.form-item { margin-bottom: 20rpx; }
.form-label { font-size: 26rpx; color: #666; margin-bottom: 12rpx; display: block; }
.form-control { position: relative; }
.form-input { width: 100%; height: 80rpx; background: #f5f7fa; border-radius: 12rpx; padding: 0 24rpx; font-size: 28rpx; color: #333; box-sizing: border-box; }
.form-textarea { width: 100%; height: 160rpx; background: #f5f7fa; border-radius: 12rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: #333; box-sizing: border-box; }
.input-placeholder { color: #bbb; font-size: 26rpx; }
.field-error { margin-top: 8rpx; }
.error-text { font-size: 24rpx; color: #ff4d4f; }
.scope-options { display: flex; gap: 16rpx; }
.scope-option { flex: 1; height: 72rpx; background: #f5f7fa; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; font-size: 26rpx; color: #666; border: 2rpx solid transparent; }
.scope-option--active { background: #e6f4ff; border-color: #1677FF; color: #1677FF; }
.tips-card { background: #fffbe6; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #ffe58f; }
.tips-title { font-size: 26rpx; font-weight: 600; color: #faad14; display: block; margin-bottom: 12rpx; }
.tips-text { font-size: 24rpx; color: #999; display: block; line-height: 1.8; }
.submit-btn { width: 100%; height: 88rpx; background: linear-gradient(135deg, #1677FF, #4096ff); border-radius: 44rpx; font-size: 30rpx; font-weight: 600; color: #fff; border: none; margin-top: 16rpx; }
.submit-btn::after { border: none; }
.submit-btn[disabled] { opacity: 0.5; }
.safe-bottom { height: 40rpx; }
</style>
