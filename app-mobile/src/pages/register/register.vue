<template>
  <view class="register-page">
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
      <form ref="formRef" :model="registerForm" :rules="registerRules" class="form-card" @submit="handleRegister">
        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe601;</text>
            <text class="label-text">手机号</text>
          </view>
          <input
            class="form-input"
            v-model="registerForm.mobile"
            type="number"
            placeholder="请输入手机号码"
            placeholder-class="input-placeholder"
            maxlength="11"
            @input="clearError('mobile')"
          />
          <view class="field-error" v-if="errors.mobile">
            <text class="error-text">{{ errors.mobile }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe605;</text>
            <text class="label-text">验证码</text>
          </view>
          <view class="code-input-wrapper">
            <input
              class="form-input code-input"
              v-model="registerForm.smsCode"
              type="number"
              placeholder="请输入验证码"
              placeholder-class="input-placeholder"
              maxlength="6"
              @input="clearError('smsCode')"
            />
            <button
              class="send-code-btn"
              :class="{ 'send-code-btn--disabled': countdown > 0 || !isMobileValid }"
              :disabled="countdown > 0 || !isMobileValid"
              @tap="sendSmsCode"
            >
              <text class="send-code-text">{{ countdown > 0 ? `${countdown}s` : '发送验证码' }}</text>
            </button>
          </view>
          <view class="field-error" v-if="errors.smsCode">
            <text class="error-text">{{ errors.smsCode }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe602;</text>
            <text class="label-text">密码</text>
          </view>
          <input
            class="form-input"
            v-model="registerForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码（8-32位）"
            placeholder-class="input-placeholder"
            @input="clearError('password')"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <text class="toggle-icon">{{ showPassword ? '&#xe603;' : '&#xe604;' }}</text>
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
        </view>

        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe602;</text>
            <text class="label-text">确认密码</text>
          </view>
          <input
            class="form-input"
            v-model="registerForm.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="请再次输入密码"
            placeholder-class="input-placeholder"
            @input="clearError('confirmPassword')"
          />
          <view class="password-toggle" @tap="showConfirmPassword = !showConfirmPassword">
            <text class="toggle-icon">{{ showConfirmPassword ? '&#xe603;' : '&#xe604;' }}</text>
          </view>
          <view class="field-error" v-if="errors.confirmPassword">
            <text class="error-text">{{ errors.confirmPassword }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">
            <text class="label-icon">&#xe606;</text>
            <text class="label-text">姓名</text>
            <text class="label-optional">（选填）</text>
          </view>
          <input
            class="form-input"
            v-model="registerForm.name"
            type="text"
            placeholder="请输入姓名"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="agreement-item">
          <view class="checkbox-wrapper" @tap="registerForm.agreement = !registerForm.agreement">
            <view :class="['checkbox', { 'checkbox--checked': registerForm.agreement }]">
              <text v-if="registerForm.agreement" class="checkbox-icon">&#xe607;</text>
            </view>
          </view>
          <text class="agreement-text">我已阅读并同意</text>
          <text class="agreement-link">《用户服务协议》</text>
          <text class="agreement-text">和</text>
          <text class="agreement-link">《隐私政策》</text>
        </view>

        <view class="register-error" v-if="errorMsg">
          <text class="error-text">{{ errorMsg }}</text>
        </view>

        <button
          class="register-btn"
          :class="{ 'register-btn--loading': loading }"
          :disabled="loading"
          form-type="submit"
        >
          <text v-if="loading" class="btn-text">注册中...</text>
          <text v-else class="btn-text">注 册</text>
        </button>
      </form>
    </view>

    <view class="login-link">
      <text class="link-text">已有账号？</text>
      <text class="link-btn" @tap="goLogin">立即登录</text>
    </view>

    <!-- 底部版本 -->
    <view class="footer-section">
      <text class="footer-text">v1.0.0</text>
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
const countdown = ref(0)
const errorMsg = ref('')

// 表单三件套：ref + :model + :rules
const formRef = ref<any>(null)
const registerForm = reactive({
  mobile: '',
  smsCode: '',
  password: '',
  confirmPassword: '',
  name: '',
  agreement: false
})

const registerRules: Rules = {
  mobile: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
  ],
  smsCode: [
    { required: true, message: '请输入验证码' },
    { minLength: 6, message: '验证码必须是6位数字' },
    { maxLength: 6, message: '验证码必须是6位数字' }
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

// 手机号是否有效（用于控制验证码发送按钮）
const isMobileValid = computed(() => {
  return /^1[3-9]\d{9}$/.test(registerForm.mobile)
})

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

async function sendSmsCode() {
  if (!isMobileValid.value) {
    uni.showToast({ title: '请输入有效的手机号码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await authApi.sendSmsCode({ mobile: registerForm.mobile })
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '发送失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  errorMsg.value = ''

  if (!validate()) return

  loading.value = true
  try {
    // 租户注册申请
    await authApi.register({
      companyName: registerForm.name || registerForm.mobile,
      contactPerson: registerForm.name || '管理员',
      contactMobile: registerForm.mobile,
      adminUsername: registerForm.mobile,
      adminPassword: registerForm.password,
      adminRealName: registerForm.name || '管理员',
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
  background: linear-gradient(180deg, $uni-color-primary 0%, $uni-color-primary 60%, $uni-color-primary-soft 100%);
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
  padding-top: 80rpx;
  padding-bottom: 40rpx;
}

.brand-icon {
  width: 100rpx;
  height: 100rpx;
  border-radius: 25rpx;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(22, 119, 255, 0.3);
}

.brand-icon-inner {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: $uni-bg-color;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-icon-text {
  font-size: 38rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.brand-title {
  font-size: 44rpx;
  font-weight: 700;
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
  padding: 0 48rpx;
  box-sizing: border-box;
}

.form-card {
  background: $uni-bg-color;
  border-radius: 24rpx;
  padding: 36rpx;
  box-shadow: 0 8rpx 40rpx rgba(22, 119, 255, 0.12);
}

.form-item {
  margin-bottom: 28rpx;
  position: relative;
}

.form-label {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.label-icon {
  font-size: 28rpx;
  color: $uni-color-primary;
  margin-right: 8rpx;
}

.label-text {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.label-optional {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-left: 6rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: 14rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.input-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.code-input-wrapper {
  display: flex;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.send-code-btn {
  width: 180rpx;
  height: 80rpx;
  background: $uni-color-primary;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
}

.send-code-btn::after {
  border: none;
}

.send-code-btn--disabled {
  background: $uni-gray-300;
}

.send-code-text {
  font-size: 24rpx;
  color: $uni-text-color-inverse;
  font-weight: 500;
}

.password-toggle {
  position: absolute;
  right: 16rpx;
  bottom: 14rpx;
  padding: 6rpx;
}

.toggle-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
}

.register-error {
  margin-bottom: 12rpx;
  padding: 10rpx 16rpx;
  background: $uni-color-error-soft;
  border-radius: 10rpx;
  border-left: 6rpx solid $uni-color-error;
}

.field-error {
  margin-top: 6rpx;
  padding: 4rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

/* 密码强度样式 */
.password-strength {
  margin-top: 10rpx;
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
  background: $ai-border;
}

.strength-segment.weak {
  background: $ai-danger;
}

.strength-segment.medium {
  background: $ai-warning;
}

.strength-segment.strong {
  background: $uni-color-primary;
}

.strength-segment.very-strong {
  background: $ai-success;
}

.strength-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

/* 协议勾选 */
.agreement-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
  padding: 0 4rpx;
}

.checkbox-wrapper {
  padding: 6rpx;
}

.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
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
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 16rpx;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.35);
  transition: all 0.3s;
}

.register-btn::after {
  border: none;
}

.register-btn--loading {
  opacity: 0.7;
}

.btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  letter-spacing: 8rpx;
}

.login-link {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 28rpx;
}

.link-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}

.link-btn {
  font-size: 26rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
  margin-left: 8rpx;
  text-decoration: underline;
}

.footer-section {
  flex: 1;
  display: flex;
  align-items: flex-end;
  padding-bottom: 36rpx;
}

.footer-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}
</style>