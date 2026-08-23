<template>
  <view class="login-page">
    <!-- 品牌区（Atlas 蓝渐变 + 装饰光斑） -->
    <view class="brand-section">
      <view class="brand-glow brand-glow--a"></view>
      <view class="brand-glow brand-glow--b"></view>
      <view class="brand-logo-wrap">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFit" />
      </view>
      <text class="brand-title">智享全链</text>
      <text class="brand-subtitle">酒水经营一体化工作台</text>
    </view>

    <!-- 登录表单（悬浮白卡） -->
    <view class="form-section">
      <view class="form-card">
        <view class="card-head">
          <text class="card-title">登录</text>
          <text class="card-sub">欢迎回来，请登录继续经营</text>
        </view>

        <view class="form-item">
          <view class="input-icon"><image class="input-icon-img" src="/static/icons/ld-user.svg" mode="aspectFit" /></view>
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
          <view class="input-icon"><image class="input-icon-img" src="/static/icons/ld-lock.svg" mode="aspectFit" /></view>
          <input
            class="form-input"
            v-model="loginForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="密码"
            placeholder-class="input-placeholder"
            @input="clearError('password')"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <image class="toggle-img" :src="showPassword ? '/static/icons/ld-eyeoff.svg' : '/static/icons/ld-eye.svg'" mode="aspectFit" />
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
            <view class="input-icon"><image class="input-icon-img" src="/static/icons/ld-shield.svg" mode="aspectFit" /></view>
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

        <view class="demo-divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>

        <!-- 注册 / 演示登录 双入口 -->
        <view class="action-row">
          <button class="ghost-btn" @tap="goRegister">
            <text class="ghost-btn-text">注 册</text>
          </button>
          <button
            class="demo-btn"
            :class="{ 'login-btn--loading': demoLoading }"
            :disabled="demoLoading"
            @tap="handleDemoLogin"
          >
            <text v-if="demoLoading" class="demo-btn-text">进入中...</text>
            <text v-else class="demo-btn-text">演示登录</text>
          </button>
        </view>
        <text class="demo-tip">演示登录无需注册，直接体验全部功能</text>
      </view>
    </view>

    <!-- 底部 -->
    <view class="footer-section">
      <text class="footer-text">v{{ appVersion }} · 粤ICP备2026103101号-2A</text>
      <view class="footer-beian">
        <image class="beian-icon" src="/static/gongan.png" mode="aspectFit" />
        <text class="beian-text">粤公网安备44030002015715号</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { authApi } from '@/api/modules/auth'
import manifest from '@/manifest.json'

const userStore = useUserStore()

/** 版本号读 manifest（与「关于」一致，不硬编码） */
const appVersion = (manifest as any)?.versionName || ''

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
/* ── 登录页（UI1.2 设计语言：蓝渐变品牌区 + 悬浮白卡） ── */
.login-page {
  min-height: 100vh;
  background: #F0F5FF;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

/* ── 品牌区 ── */
.brand-section {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0 130rpx;
  background: linear-gradient(160deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%);
  border-radius: 0 0 44rpx 44rpx;
  overflow: hidden;
}

/* 装饰光斑 */
.brand-glow {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}

.brand-glow--a {
  width: 340rpx;
  height: 340rpx;
  top: -120rpx;
  right: -100rpx;
}

.brand-glow--b {
  width: 240rpx;
  height: 240rpx;
  bottom: -80rpx;
  left: -70rpx;
}

.brand-logo-wrap {
  position: relative;
  width: 136rpx;
  height: 136rpx;
  border-radius: 36rpx;
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
  box-shadow: 0 16rpx 44rpx rgba(15, 23, 42, 0.28);
}

.brand-logo {
  width: 96rpx;
  height: 96rpx;
}

.brand-title {
  position: relative;
  font-size: 46rpx;
  font-weight: $uni-font-bold;
  color: $uni-text-color-inverse;
  letter-spacing: 6rpx;
  margin-bottom: 14rpx;
}

.brand-subtitle {
  position: relative;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 2rpx;
}

/* ── 表单区（悬浮卡） ── */
.form-section {
  position: relative;
  z-index: 2;
  width: 100%;
  padding: 0 48rpx;
  margin-top: -72rpx;
  box-sizing: border-box;
}

.form-card {
  background: $uni-bg-color;
  border-radius: 36rpx;
  padding: 44rpx 40rpx 34rpx;
  box-shadow: 0 20rpx 60rpx rgba(29, 78, 216, 0.16), 0 4rpx 16rpx rgba(29, 78, 216, 0.06);
}

.card-head {
  margin-bottom: 34rpx;
}

.card-title {
  display: block;
  font-size: 38rpx;
  font-weight: $uni-font-bold;
  color: $uni-text-color;
  letter-spacing: 2rpx;
}

.card-sub {
  display: block;
  font-size: 25rpx;
  color: $uni-text-color-placeholder;
  margin-top: 10rpx;
}

/* 输入框（spec08：默认灰底，聚焦蓝边+外发光） */
.form-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 96rpx;
  background: $uni-bg-color-page;
  border: 2rpx solid transparent;
  border-radius: 20rpx;
  padding: 0 28rpx;
  margin-bottom: 8rpx;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.form-item:focus-within {
  background: $uni-bg-color;
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: 0 0 0 6rpx rgba(37, 99, 235, 0.08);
}

.input-icon {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  flex-shrink: 0;
}

.input-icon-img {
  width: 36rpx;
  height: 36rpx;
}

.form-input {
  flex: 1;
  height: 92rpx;
  font-size: 30rpx;
  color: $uni-text-color;
}

.input-placeholder {
  color: $uni-text-color-placeholder;
  font-size: 28rpx;
}

.password-toggle {
  padding: 12rpx;
}

.toggle-img {
  width: 38rpx;
  height: 38rpx;
  display: block;
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

/* 登录主按钮 */
.login-btn {
  width: 100%;
  height: 96rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 32rpx;
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

/* ── 分隔线 ── */
.demo-divider {
  display: flex;
  align-items: center;
  margin: 32rpx 0 26rpx;
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

/* ── 注册 / 演示登录 双入口 ── */
.action-row {
  display: flex;
  gap: 24rpx;
}

.ghost-btn {
  flex: 1;
  height: 88rpx;
  background: $uni-bg-color;
  border: 2rpx solid rgba(37, 99, 235, 0.35);
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
}

.ghost-btn::after {
  border: none;
}

.ghost-btn:active {
  background: $uni-color-primary-soft;
}

.ghost-btn-text {
  font-size: 30rpx;
  font-weight: $uni-font-medium;
  color: $uni-color-primary;
  letter-spacing: 4rpx;
  line-height: 1;
}

.demo-btn {
  flex: 1;
  height: 88rpx;
  background: $uni-color-primary-soft;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
}

.demo-btn::after {
  border: none;
}

.demo-btn:active {
  opacity: 0.85;
}

.demo-btn-text {
  font-size: 30rpx;
  font-weight: $uni-font-medium;
  color: $uni-color-primary;
  letter-spacing: 4rpx;
  line-height: 1;
}

.demo-tip {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: $uni-text-color-placeholder;
  margin-top: 14rpx;
}

/* ── 底部 ── */
.footer-section {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 40rpx 0 28rpx;
}

.footer-text {
  font-size: 22rpx;
  color: $uni-gray-500;
}
.footer-beian {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 10rpx;
}
.beian-icon {
  width: 28rpx;
  height: 28rpx;
}
.beian-text {
  font-size: 22rpx;
  color: $uni-gray-500;
}
</style>
