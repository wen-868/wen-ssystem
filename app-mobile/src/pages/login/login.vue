<template>
  <view class="login-page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo-wrap">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFit" />
      </view>
      <text class="brand-title">智享全链</text>
      <text class="brand-subtitle">酒水经营一体化工作台</text>
    </view>

    <!-- 登录表单 -->
    <view class="form-section">
      <view class="form-card">
        <view class="form-item">
          <view class="input-icon">&#xe601;</view>
          <input
            class="form-input"
            v-model="loginForm.username"
            type="text"
            placeholder="账号 / 手机号"
            placeholder-class="input-placeholder"
            @input="clearError('username')"
          />
        </view>
        <view class="field-error" v-if="errors.username">
          <text class="error-text">{{ errors.username }}</text>
        </view>

        <view class="form-item">
          <view class="input-icon">&#xe602;</view>
          <input
            class="form-input"
            v-model="loginForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="密码"
            placeholder-class="input-placeholder"
            @input="clearError('password')"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <text class="toggle-icon">{{ showPassword ? '&#xe603;' : '&#xe604;' }}</text>
          </view>
        </view>
        <view class="field-error" v-if="errors.password">
          <text class="error-text">{{ errors.password }}</text>
        </view>

        <view class="login-error" v-if="errorMsg">
          <text class="error-text">{{ errorMsg }}</text>
        </view>

        <!-- 双因素认证：账号启用 MFA 时的动态码输入 -->
        <view class="mfa-section" v-if="mfaRequired">
          <view class="mfa-tip">
            <text class="mfa-tip-text">该账号已开启双因素认证，请输入动态验证码</text>
          </view>
          <view class="form-item">
            <view class="input-icon">&#xe605;</view>
            <input
              class="form-input"
              v-model="mfaCode"
              type="number"
              maxlength="6"
              placeholder="6 位动态验证码"
              placeholder-class="input-placeholder"
            />
          </view>
          <button
            class="login-btn"
            :class="{ 'login-btn--loading': mfaVerifying }"
            :disabled="mfaVerifying"
            @tap="handleMfaVerify"
          >
            <text v-if="mfaVerifying" class="btn-text">验证中...</text>
            <text v-else class="btn-text">验证并登录</text>
          </button>
        </view>

        <template v-if="!mfaRequired">
        <button
          class="login-btn"
          :class="{ 'login-btn--loading': loading }"
          :disabled="loading"
          @tap="handleLogin"
        >
          <text v-if="loading" class="btn-text">登录中...</text>
          <text v-else class="btn-text">登 录</text>
        </button>
        </template>

        <!-- 演示账号一键登录 -->
        <view class="demo-divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>

        <button
          class="demo-btn"
          :class="{ 'login-btn--loading': demoLoading }"
          :disabled="demoLoading"
          @tap="handleDemoLogin"
        >
          <text v-if="demoLoading" class="demo-btn-text">正在进入演示环境...</text>
          <text v-else class="demo-btn-text">&#xe608; 演示账号一键体验</text>
        </button>
        <text class="demo-tip">无需注册，直接体验全部功能</text>
      </view>
    </view>

    <!-- 注册入口 -->
    <view class="register-link">
      <text class="link-text">还没有账号？</text>
      <text class="link-btn" @tap="goRegister">立即注册</text>
    </view>

    <!-- 底部 -->
    <view class="footer-section">
      <text class="footer-text">v1.0.0 · 粤ICP备2026103101号-1</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { authApi } from '@/api/modules/auth'

const userStore = useUserStore()

// 已登录（如跳转失败后刷新/重新显示本页）时自动进入系统
onLoad(() => {
  if (userStore.isLoggedIn) goHome()
})
onShow(() => {
  if (userStore.isLoggedIn && userStore.initialized) goHome()
})

const showPassword = ref(false)
const loading = ref(false)
const demoLoading = ref(false)
const mfaRequired = ref(false)
const mfaToken = ref('')
const mfaCode = ref('')
const mfaVerifying = ref(false)
const errorMsg = ref('')

const loginForm = reactive({
  username: '',
  password: '',
})

const loginRules: Rules = {
  username: [
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
    const result = await authApi.login({ username: loginForm.username.trim(), password: loginForm.password })
    if (result.mfaRequired) {
      mfaRequired.value = true
      mfaToken.value = result.mfaToken || ''
      errorMsg.value = ''
    } else {
      userStore.applyLoginResult(result)
      uni.showToast({ title: '登录成功', icon: 'success' })
      goHome()
    }
  } catch (err: any) {
    errorMsg.value = err?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

/** MFA 二次验证 */
async function handleMfaVerify() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    errorMsg.value = '请输入 6 位动态验证码'
    return
  }
  mfaVerifying.value = true
  errorMsg.value = ''
  try {
    const result = await authApi.verifyMfa(mfaToken.value, mfaCode.value)
    userStore.applyLoginResult(result)
    uni.showToast({ title: '登录成功', icon: 'success' })
    goHome()
  } catch (err: any) {
    errorMsg.value = err?.message || '验证码错误，请重试'
  } finally {
    mfaVerifying.value = false
  }
}

/** 演示账号一键登录：免输入，直接进入演示环境 */
async function handleDemoLogin() {
  errorMsg.value = ''
  demoLoading.value = true
  try {
    await userStore.login('store_manager', 'admin123')
    uni.showToast({ title: '已进入演示环境', icon: 'success' })
    goHome()
  } catch (err: any) {
    errorMsg.value = err?.message || '演示登录失败，请稍后重试'
  } finally {
    demoLoading.value = false
  }
}

function goHome() {
  // H5 下 uni.switchTab 偶发 switchTab:fail（tabBar 路由兼容问题），统一用 reLaunch 更可靠
  uni.reLaunch({
    url: '/pages/home/home',
    fail(err) {
      console.error('[login] reLaunch fail:', err)
      uni.showToast({ title: '跳转失败，请手动进入首页', icon: 'none', duration: 3000 })
    },
  })
}

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, $uni-color-primary-active 0%, $uni-color-primary 52%, $uni-color-primary-soft 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

/* ── 品牌区 ── */
.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 110rpx;
  padding-bottom: 56rpx;
}

.brand-logo-wrap {
  width: 132rpx;
  height: 132rpx;
  border-radius: 32rpx;
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  box-shadow: 0 12rpx 40rpx rgba(13, 44, 124, 0.35);
}

.brand-logo {
  width: 96rpx;
  height: 96rpx;
}

.brand-title {
  font-size: 44rpx;
  font-weight: $uni-font-bold;
  color: $uni-text-color-inverse;
  letter-spacing: 6rpx;
  margin-bottom: 12rpx;
}

.brand-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 2rpx;
}

/* ── 表单区 ── */
.form-section {
  width: 100%;
  padding: 0 64rpx;
  box-sizing: border-box;
}

.form-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xl;
  padding: 48rpx 40rpx 36rpx;
  box-shadow: 0 20rpx 64rpx rgba(13, 44, 124, 0.18);
}

.form-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 96rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  padding: 0 28rpx;
  margin-bottom: 8rpx;
}

.input-icon {
  font-size: 34rpx;
  color: $uni-color-primary;
  margin-right: 18rpx;
}

.form-input {
  flex: 1;
  height: 96rpx;
  font-size: 30rpx;
  color: $uni-text-color;
}

.input-placeholder {
  color: $uni-text-color-placeholder;
  font-size: 28rpx;
}

.password-toggle {
  padding: 8rpx;
}

.toggle-icon {
  font-size: 36rpx;
  color: $uni-gray-400;
}

.field-error {
  padding: 8rpx 8rpx 0;
}
.mfa-section {
  margin-top: 8rpx;
}
.mfa-tip {
  padding: 0 8rpx 16rpx;
}
.mfa-tip-text {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.login-error {
  margin-top: 12rpx;
  padding: 14rpx 20rpx;
  background: $uni-color-error-soft;
  border-radius: $uni-border-radius-xs;
}

.error-text {
  font-size: 26rpx;
  color: $uni-color-error;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 28rpx;
  box-shadow: 0 10rpx 28rpx rgba(37, 99, 235, 0.35);
}

.login-btn::after {
  border: none;
}

.login-btn--loading {
  opacity: 0.7;
}

.btn-text {
  font-size: 34rpx;
  font-weight: $uni-font-semibold;
  color: $uni-text-color-inverse;
  letter-spacing: 10rpx;
}

/* ── 演示账号 ── */
.demo-divider {
  display: flex;
  align-items: center;
  margin: 34rpx 0 26rpx;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background: $uni-border-color;
}

.divider-text {
  font-size: 24rpx;
  color: $uni-text-color-placeholder;
  padding: 0 20rpx;
}

.demo-btn {
  width: 100%;
  height: 92rpx;
  background: $uni-color-primary-soft;
  border: 2rpx solid rgba(37, 99, 235, 0.35);
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-btn::after {
  border: none;
}

.demo-btn-text {
  font-size: 30rpx;
  font-weight: $uni-font-medium;
  color: $uni-color-primary;
}

.demo-tip {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: $uni-text-color-placeholder;
  margin-top: 14rpx;
}

/* ── 注册入口 ── */
.register-link {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 36rpx;
}

.link-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.link-btn {
  font-size: 28rpx;
  color: $uni-text-color-inverse;
  font-weight: $uni-font-semibold;
  margin-left: 8rpx;
}

/* ── 底部 ── */
.footer-section {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 32rpx;
}

.footer-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
}
</style>
