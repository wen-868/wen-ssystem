<template>
  <view class="register-page">
    <!-- 顶部品牌区 -->
    <view class="brand-section">
      <view class="brand-logo-wrap">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFit" />
      </view>
      <text class="brand-title">注册智享全链</text>
      <text class="brand-subtitle">开通商户账号，开启数字化经营</text>
    </view>

    <!-- 表单区域 -->
    <view class="form-section">
      <view class="form-card">
        <view class="form-item">
          <view class="input-icon"><image class="ic" src="/static/icons/ic/user.svg" mode="aspectFit"/></view>
          <input
            class="form-input"
            v-model="registerForm.mobile"
            type="number"
            placeholder="手机号"
            placeholder-class="input-placeholder"
            maxlength="11"
            @input="clearError('mobile')"
          />
        </view>
        <view class="field-error" v-if="errors.mobile">
          <text class="error-text">{{ errors.mobile }}</text>
        </view>

        <view class="form-item">
          <view class="input-icon"><image class="ic" src="/static/icons/ic/lock.svg" mode="aspectFit"/></view>
          <input
            class="form-input"
            v-model="registerForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="设置密码（8-32位）"
            placeholder-class="input-placeholder"
            @input="clearError('password')"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <image class="toggle-icon ic" :src="showPassword ? '/static/icons/ic/eyeoff.svg' : '/static/icons/ic/eye.svg'" mode="aspectFit" />
          </view>
        </view>
        <view class="field-error" v-if="errors.password">
          <text class="error-text">{{ errors.password }}</text>
        </view>

        <!-- 密码强度提示 -->
        <view v-if="registerForm.password" class="password-strength">
          <view class="strength-bar">
            <view :class="['strength-segment', getStrengthClass(1)]"></view>
            <view :class="['strength-segment', getStrengthClass(2)]"></view>
            <view :class="['strength-segment', getStrengthClass(3)]"></view>
            <view :class="['strength-segment', getStrengthClass(4)]"></view>
          </view>
          <text class="strength-text">{{ passwordStrengthText }}</text>
        </view>

        <view class="form-item">
          <view class="input-icon"><image class="ic" src="/static/icons/ic/lock.svg" mode="aspectFit"/></view>
          <input
            class="form-input"
            v-model="registerForm.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="确认密码"
            placeholder-class="input-placeholder"
            @input="clearError('confirmPassword')"
          />
          <view class="password-toggle" @tap="showConfirmPassword = !showConfirmPassword">
            <image class="toggle-icon ic" :src="showConfirmPassword ? '/static/icons/ic/eyeoff.svg' : '/static/icons/ic/eye.svg'" mode="aspectFit" />
          </view>
        </view>
        <view class="field-error" v-if="errors.confirmPassword">
          <text class="error-text">{{ errors.confirmPassword }}</text>
        </view>

        <view class="agreement-item" @tap="registerForm.agreement = !registerForm.agreement">
          <view :class="['checkbox', { 'checkbox--checked': registerForm.agreement }]">
            <image v-if="registerForm.agreement" class="checkbox-icon ic" src="/static/icons/ic/check.svg" mode="aspectFit"/>
          </view>
          <text class="agreement-text">我已阅读并同意</text>
          <text class="agreement-link">《用户服务协议》</text>
          <text class="agreement-text">和</text>
          <text class="agreement-link">《隐私政策》</text>
        </view>
        <view class="field-error" v-if="errors.agreement">
          <text class="error-text">{{ errors.agreement }}</text>
        </view>

        <view class="register-error" v-if="errorMsg">
          <text class="error-text">{{ errorMsg }}</text>
        </view>

        <button
          class="register-btn"
          :class="{ 'register-btn--loading': loading }"
          :disabled="loading"
          @tap="handleRegister"
        >
          <text v-if="loading" class="btn-text">提交中...</text>
          <text v-else class="btn-text">提交注册申请</text>
        </button>
        <text class="register-tip">提交后由平台审核开通，审核通过短信通知</text>
      </view>
    </view>

    <view class="login-link">
      <text class="link-text">已有账号？</text>
      <text class="link-btn" @tap="goLogin">立即登录</text>
    </view>

    <!-- 底部 -->
    <view class="footer-section">
      <text class="footer-text">v1.0.0 · 粤ICP备2026103101号-2A</text>
      <view class="footer-beian">
        <image class="beian-icon" src="/static/gongan.png" mode="aspectFit" />
        <text class="beian-text">粤公网安备44030002015715号</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { authApi } from '@/api/modules/auth'

const userStore = useUserStore()

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const registerForm = reactive({
  mobile: '',
  password: '',
  confirmPassword: '',
  agreement: false
})

const registerRules: Rules = {
  mobile: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { minLength: 8, message: '密码至少8个字符' },
    { maxLength: 32, message: '密码最多32个字符' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/, message: '密码需包含字母、数字和特殊字符' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码' },
    {
      message: '两次输入的密码不一致',
      validator: (value: string) => {
        return value === registerForm.password
      }
    }
  ],
  agreement: [
    { required: true, message: '请先阅读并同意协议' }
  ]
}

const { errors, validate, clearError } = useFormValidation(registerForm, registerRules)

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = registerForm.password
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Za-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[@$!%*?&]/.test(pwd)) score++
  return Math.min(score, 4)
})

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength === 0) return ''
  if (strength === 1) return '弱 - 请增加密码长度'
  if (strength === 2) return '中 - 建议添加特殊字符'
  if (strength === 3) return '强 - 密码安全性良好'
  return '非常强 - 密码安全性优秀'
})

function getStrengthClass(level: number) {
  const strength = passwordStrength.value
  if (strength >= level) {
    if (strength <= 1) return 'weak'
    if (strength <= 2) return 'medium'
    if (strength <= 3) return 'strong'
    return 'very-strong'
  }
  return 'empty'
}

async function handleRegister() {
  errorMsg.value = ''

  if (!validate()) return

  loading.value = true
  try {
    // 租户注册申请（平台审核制，无需短信验证码）
    await authApi.register({
      companyName: registerForm.mobile,
      contactPerson: registerForm.mobile,
      contactMobile: registerForm.mobile,
      adminUsername: registerForm.mobile,
      adminPassword: registerForm.password,
      adminRealName: registerForm.mobile,
    })

    uni.showToast({ title: '注册申请已提交，等待审核', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/login' })
    }, 2000)
  } catch (err: any) {
    errorMsg.value = err?.message || '注册失败，请重试'
  } finally {
    loading.value = false
  }
}

function goLogin() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  background: linear-gradient(180deg, $uni-color-primary-active 0%, $uni-color-primary 52%, $uni-color-primary-soft 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 90rpx;
  padding-bottom: 44rpx;
}

.brand-logo-wrap {
  width: 112rpx;
  height: 112rpx;
  border-radius: 28rpx;
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(13, 44, 124, 0.35);
}

.brand-logo {
  width: 80rpx;
  height: 80rpx;
}

.brand-title {
  font-size: 40rpx;
  font-weight: $uni-font-bold;
  color: $uni-text-color-inverse;
  letter-spacing: 4rpx;
  margin-bottom: 10rpx;
}

.brand-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.form-section {
  width: 100%;
  padding: 0 56rpx;
  box-sizing: border-box;
}

.form-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xl;
  padding: 40rpx 36rpx 32rpx;
  box-shadow: 0 20rpx 64rpx rgba(13, 44, 124, 0.18);
}

.form-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 92rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  padding: 0 26rpx;
  margin-bottom: 8rpx;
}

.input-icon {
  font-size: 32rpx;
  color: $uni-color-primary;
  margin-right: 16rpx;
}

.form-input {
  flex: 1;
  height: 92rpx;
  font-size: 29rpx;
  color: $uni-text-color;
}

.input-placeholder {
  color: $uni-text-color-placeholder;
  font-size: 27rpx;
}

.password-toggle {
  padding: 8rpx;
}

.toggle-icon {
  font-size: 34rpx;
  color: $uni-gray-400;
}

.field-error {
  padding: 8rpx 8rpx 0;
}

.register-error {
  margin-top: 12rpx;
  padding: 14rpx 20rpx;
  background: $uni-color-error-soft;
  border-radius: $uni-border-radius-xs;
}

.error-text {
  font-size: 25rpx;
  color: $uni-color-error;
}

/* 密码强度 */
.password-strength {
  margin: 10rpx 4rpx 0;
}

.strength-bar {
  display: flex;
  gap: 6rpx;
  margin-bottom: 4rpx;
}

.strength-segment {
  flex: 1;
  height: 6rpx;
  border-radius: 3rpx;
  transition: all 0.3s;
}

.strength-segment.empty {
  background: $uni-border-color;
}

.strength-segment.weak {
  background: $uni-color-error;
}

.strength-segment.medium {
  background: $uni-color-warning;
}

.strength-segment.strong {
  background: $uni-color-primary;
}

.strength-segment.very-strong {
  background: $uni-color-success;
}

.strength-text {
  font-size: 22rpx;
  color: $uni-text-color-placeholder;
}

/* 协议勾选 */
.agreement-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 24rpx;
  padding: 0 4rpx;
}

.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid $uni-border-color;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10rpx;
}

.checkbox--checked {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.checkbox-icon {
  font-size: 20rpx;
  color: $uni-text-color-inverse;
}

.agreement-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.agreement-link {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.register-btn {
  width: 100%;
  height: 94rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 28rpx;
  box-shadow: 0 10rpx 28rpx rgba(37, 99, 235, 0.35);
}

.register-btn::after {
  border: none;
}

.register-btn--loading {
  opacity: 0.7;
}

.btn-text {
  font-size: 32rpx;
  font-weight: $uni-font-semibold;
  color: $uni-text-color-inverse;
  letter-spacing: 4rpx;
}

.register-tip {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: $uni-text-color-placeholder;
  margin-top: 16rpx;
}

.login-link {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32rpx;
}

.link-text {
  font-size: 27rpx;
  color: rgba(255, 255, 255, 0.9);
}

.link-btn {
  font-size: 27rpx;
  color: $uni-text-color-inverse;
  font-weight: $uni-font-semibold;
  margin-left: 8rpx;
}

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
  color: rgba(255, 255, 255, 0.65);
}
</style>
