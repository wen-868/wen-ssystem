<template>
  <view class="change-password-page">
    <page-header title="修改密码" @back="goBack" />

    <form ref="formRef" :model="form" class="password-form">
      <view class="form-group">
        <view class="form-item">
          <text class="form-label">旧密码</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.oldPassword"
              type="password"
              placeholder="请输入旧密码"
              placeholder-class="input-placeholder"
              @input="clearError('oldPassword')"
            />
          </view>
          <view class="field-error" v-if="errors.oldPassword">
            <text class="error-text">{{ errors.oldPassword }}</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">新密码</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.newPassword"
              type="password"
              placeholder="请输入新密码（6-20位）"
              placeholder-class="input-placeholder"
              @input="clearError('newPassword')"
            />
          </view>
          <view class="field-error" v-if="errors.newPassword">
            <text class="error-text">{{ errors.newPassword }}</text>
          </view>
        </view>

        <view class="form-item form-item--last">
          <text class="form-label">确认新密码</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              placeholder-class="input-placeholder"
              @input="clearError('confirmPassword')"
            />
          </view>
          <view class="field-error" v-if="errors.confirmPassword">
            <text class="error-text">{{ errors.confirmPassword }}</text>
          </view>
        </view>
      </view>

      <button class="submit-btn" @tap="onSubmit">确认修改</button>
    </form>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules: Rules = {
  oldPassword: [
    { required: true, message: '请输入旧密码' },
    { minLength: 6, message: '密码至少6位' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码' },
    { minLength: 6, message: '密码至少6位' },
    { maxLength: 20, message: '密码最多20位' },
    {
      validator: (value: string) => {
        const hasLetter = /[a-zA-Z]/.test(value)
        const hasNumber = /[0-9]/.test(value)
        return hasLetter || hasNumber
      },
      message: '密码需包含字母或数字',
    },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码' },
    {
      validator: (value: string) => value === form.newPassword,
      message: '两次输入的密码不一致',
    },
  ],
}

const { errors, validate, clearError } = useFormValidation(form, rules)

async function onSubmit() {
  const valid = await validate()
  if (!valid) return

  uni.showModal({
    title: '确认修改',
    content: '确认修改密码？修改后需重新登录',
    success: (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '修改中...' })
        setTimeout(() => {
          uni.hideLoading()
          uni.showToast({ title: '修改成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        }, 1000)
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.change-password-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.password-form { padding: 24rpx; }
.form-group {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.form-item--last { border-bottom: none; }
.form-label {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  margin-bottom: 12rpx;
  display: block;
}
.form-control { position: relative; }
.form-input {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.field-error { margin-top: 8rpx; }
.error-text { font-size: 24rpx; color: $uni-color-error; }
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  border: none;
}
.submit-btn::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>
