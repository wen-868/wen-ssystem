<template>
  <view class="login-page">
    <!-- 顶部品牌区域 -->
    <view class="brand-section">
      <view class="brand-icon">
        <view class="brand-icon-inner">
          <text class="brand-icon-text">智</text>
        </view>
      </view>
      <text class="brand-title">智享全链</text>
      <text class="brand-subtitle">智慧库存 · 高效管理</text>
    </view>

    <!-- 表单区域 -->
    <view class="form-section">
      <form ref="formRef" :model="loginForm" :rules="loginRules" class="form-card" @submit="handleLogin">
        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe601;</text>
            <text class="label-text">账号</text>
          </view>
          <input
            class="form-input"
            v-model="loginForm.account"
            type="text"
            placeholder="请输入账号（手机号）"
            placeholder-class="input-placeholder"
            @input="clearError('account')"
          />
          <view class="field-error" v-if="errors.account">
            <text class="error-text">{{ errors.account }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe602;</text>
            <text class="label-text">密码</text>
          </view>
          <input
            class="form-input"
            v-model="loginForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            placeholder-class="input-placeholder"
            @input="clearError('password')"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <text class="toggle-icon">{{ showPassword ? '&#xe603;' : '&#xe604;' }}</text>
          </view>
          <view class="field-error" v-if="errors.password">
            <text class="error-text">{{ errors.password }}</text>
          </view>
        </view>

        <view class="login-error" v-if="errorMsg">
          <text class="error-text">{{ errorMsg }}</text>
        </view>

        <button
          class="login-btn"
          :class="{ 'login-btn--loading': loading }"
          :disabled="loading"
          form-type="submit"
        >
          <text v-if="loading" class="btn-text">登录中...</text>
          <text v-else class="btn-text">登 录</text>
        </button>
      </form>
    </view>

    <view class="register-link">
      <text class="link-text">还没有账号？</text>
      <text class="link-btn" @tap="goRegister">立即注册</text>
    </view>

    <!-- 底部版本 -->
    <view class="footer-section">
      <text class="footer-text">v1.0.0</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const userStore = useUserStore()

const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

// 表单三件套：ref + :model + :rules
const formRef = ref<any>(null)
const loginForm = reactive({
  account: '',
  password: '',
})

const loginRules: Rules = {
  account: [
    { required: true, message: '请输入账号' },
    { minLength: 5, message: '账号长度不能少于5位' },
  ],
  password: [
    { required: true, message: '请输入密码' },
    { minLength: 6, message: '密码长度不能少于6位' },
  ],
}

const { errors, validate, clearError } = useFormValidation(loginForm, loginRules)

async function handleLogin() {
  errorMsg.value = ''

  if (!validate()) return

  loading.value = true
  try {
    await userStore.login(loginForm.account.trim(), loginForm.password)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/home/home' })
    }, 1500)
  } catch (err: any) {
    errorMsg.value = err?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1677FF 0%, #69b1ff 60%, #f0f5ff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
  padding-bottom: 60rpx;
}

.brand-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
  box-shadow: 0 8rpx 32rpx rgba(22, 119, 255, 0.3);
}

.brand-icon-inner {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-icon-text {
  font-size: 44rpx;
  font-weight: 700;
  color: #1677FF;
}

.brand-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 4rpx;
  margin-bottom: 12rpx;
}

.brand-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.form-section {
  width: 100%;
  padding: 0 60rpx;
  box-sizing: border-box;
}

.form-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 36rpx;
  box-shadow: 0 8rpx 40rpx rgba(22, 119, 255, 0.12);
}

.form-item {
  margin-bottom: 32rpx;
  position: relative;
}

.form-label {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.label-icon {
  font-size: 32rpx;
  color: #1677FF;
  margin-right: 8rpx;
}

.label-text {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: #333;
  box-sizing: border-box;
}

.input-placeholder {
  color: #bbb;
  font-size: 28rpx;
}

.password-toggle {
  position: absolute;
  right: 20rpx;
  bottom: 18rpx;
  padding: 8rpx;
}

.toggle-icon {
  font-size: 36rpx;
  color: #999;
}

.login-error {
  margin-bottom: 16rpx;
  padding: 12rpx 20rpx;
  background: #fff2f0;
  border-radius: 12rpx;
  border-left: 6rpx solid #ff4d4f;
}

.field-error {
  margin-top: 8rpx;
  padding: 6rpx 0;
}

.error-text {
  font-size: 26rpx;
  color: #ff4d4f;
}

.login-btn {
  width: 100%;
  height: 92rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.35);
  transition: all 0.3s;
}

.login-btn::after {
  border: none;
}

.login-btn--loading {
  opacity: 0.7;
}

.btn-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  letter-spacing: 8rpx;
}

.register-link {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32rpx;
}

.link-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.link-btn {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
  margin-left: 8rpx;
  text-decoration: underline;
}

.footer-section {
  flex: 1;
  display: flex;
  align-items: flex-end;
  padding-bottom: 40rpx;
}

.footer-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}
</style>