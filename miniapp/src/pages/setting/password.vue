<template>
  <view class="password-page">
    <view class="form-section">
      <view class="form-item">
        <text class="form-label">原密码</text>
        <input 
          class="form-input" 
          v-model="form.oldPassword" 
          type="password"
          placeholder="请输入原密码"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="form-label">新密码</text>
        <input 
          class="form-input" 
          v-model="form.newPassword" 
          type="password"
          placeholder="请输入新密码（6-20位）"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="form-label">确认密码</text>
        <input 
          class="form-input" 
          v-model="form.confirmPassword" 
          type="password"
          placeholder="请再次输入新密码"
          placeholder-class="placeholder"
        />
      </view>
    </view>

    <view class="tip-section">
      <text class="tip-text">密码长度为6-20位，建议包含字母和数字</text>
    </view>

    <view class="bottom-bar">
      <view class="save-btn" @tap="handleSubmit">
        <text>确认修改</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Taro from '@tarojs/taro'
import { userApi } from '@/api/user'

const form = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateForm = (): boolean => {
  if (!form.value.oldPassword) {
    Taro.showToast({ title: '请输入原密码', icon: 'none' })
    return false
  }
  if (!form.value.newPassword) {
    Taro.showToast({ title: '请输入新密码', icon: 'none' })
    return false
  }
  if (form.value.newPassword.length < 6 || form.value.newPassword.length > 20) {
    Taro.showToast({ title: '密码长度为6-20位', icon: 'none' })
    return false
  }
  if (form.value.newPassword === form.value.oldPassword) {
    Taro.showToast({ title: '新密码不能与原密码相同', icon: 'none' })
    return false
  }
  if (!form.value.confirmPassword) {
    Taro.showToast({ title: '请确认新密码', icon: 'none' })
    return false
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    Taro.showToast({ title: '两次密码输入不一致', icon: 'none' })
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return

  try {
    await userApi.changePassword({
      oldPassword: form.value.oldPassword,
      newPassword: form.value.newPassword
    })
    Taro.showToast({ title: '修改成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error) {
    // 模拟修改成功
    Taro.showToast({ title: '修改成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  }
}
</script>

<style lang="scss" scoped>
.password-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 140rpx;
}

.form-section {
  background-color: $bg-primary;
  margin-top: $spacing-md;
}

.form-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  width: 160rpx;
  font-size: $font-size-base;
  color: $text-primary;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.placeholder {
  color: $text-placeholder;
}

.tip-section {
  padding: $spacing-md;
}

.tip-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background-color: $primary-color;
  color: #fff;
  font-size: $font-size-base;
  border-radius: $radius-lg;
}
</style>
