<template>
  <view class="register-page">
    <view class="brand-section">
      <view class="brand-icon">
        <view class="brand-icon-inner">
          <text class="brand-icon-text">智</text>
        </view>
      </view>
      <text class="brand-title">会员注册</text>
      <text class="brand-subtitle">开启智慧消费之旅</text>
    </view>

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
            placeholder="请输入手机号"
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
          <view class="code-input-wrap">
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
              :class="{ 'send-code-btn--disabled': countDown > 0 || !canSendCode }"
              :disabled="countDown > 0 || !canSendCode"
              @tap="sendSmsCode"
            >
              <text class="send-code-text">{{ countDown > 0 ? `${countDown}秒` : '获取验证码' }}</text>
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
            placeholder="请输入密码（8-32位，含字母+数字+特殊字符）"
            placeholder-class="input-placeholder"
            maxlength="32"
            @input="handlePasswordInput"
          />
          <view class="password-toggle" @tap="showPassword = !showPassword">
            <text class="toggle-icon">{{ showPassword ? '&#xe603;' : '&#xe604;' }}</text>
          </view>
          <view class="field-error" v-if="errors.password">
            <text class="error-text">{{ errors.password }}</text>
          </view>
          <view class="password-strength" v-if="registerForm.password">
            <view class="strength-bar">
              <view class="strength-item" :class="strengthClass(0)"></view>
              <view class="strength-item" :class="strengthClass(1)"></view>
              <view class="strength-item" :class="strengthClass(2)"></view>
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
            maxlength="32"
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
            <text class="label-text">姓名（选填）</text>
          </view>
          <input
            class="form-input"
            v-model="registerForm.name"
            type="text"
            placeholder="请输入姓名"
            placeholder-class="input-placeholder"
            maxlength="32"
          />
        </view>

        <view class="agreement-item">
          <view class="checkbox-wrap" @tap="registerForm.agreed = !registerForm.agreed">
            <view class="checkbox" :class="{ 'checkbox--checked': registerForm.agreed }">
              <text v-if="registerForm.agreed" class="check-icon">&#xe607;</text>
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

      <view class="login-link">
        <text class="link-text">已有账号？</text>
        <text class="link-btn" @tap="goLogin">立即登录</text>
      </view>
    </view>

    <view class="footer-section">
      <text class="footer-text">v1.0.0</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { memberApi, type MemberRegisterParams } from '@/api/modules/member'

const userStore = useUserStore()

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const countDown = ref(0)

const formRef = ref<any>(null)
const registerForm = reactive({
  mobile: '',
  smsCode: '',
  password: '',
  confirmPassword: '',
  name: '',
  agreed: false
})

const canSendCode = computed(() => {
  const mobile = registerForm.mobile.trim()
  return mobile.length === 11 && /^1[3-9]\d{9}$/.test(mobile)
})

const passwordStrength = computed(() => {
  const password = registerForm.password
  if (!password) return 0
  
  let score = 0
  if (password.length >= 8) score++
  if (/[a-zA-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  
  return score
})

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength === 0) return ''
  if (strength === 1) return '弱'
  if (strength === 2) return '中'
  if (strength === 3) return '强'
  return '非常强'
})

function strengthClass(index: number): string {
  const strength = passwordStrength.value
  if (index < strength) {
    if (strength === 1) return 'strength-item--weak'
    if (strength === 2) return 'strength-item--medium'
    return 'strength-item--strong'
  }
  return 'strength-item--empty'
}

const registerRules: Rules = {
  mobile: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
  ],
  smsCode: [
    { required: true, message: '请输入验证码' },
    { minLength: 6, maxLength: 6, message: '验证码必须是6位数字' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { minLength: 8, message: '密码长度不能少于8位' },
    { maxLength: 32, message: '密码长度不能超过32位' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, message: '密码需包含字母、数字和特殊字符' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码' },
    { validator: (val: string, model: any) => val === model.password, message: '两次输入的密码不一致' }
  ],
  agreed: [
    { validator: (val: boolean) => val, message: '请阅读并同意用户协议' }
  ]
}

const { errors, validate, clearError } = useFormValidation(registerForm, registerRules)

function handlePasswordInput() {
  clearError('password')
  clearError('confirmPassword')
}

async function sendSmsCode() {
  if (!canSendCode.value || countDown.value > 0) return
  
  loading.value = true
  try {
    await memberApi.sendSmsCode({ mobile: registerForm.mobile })
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    
    countDown.value = 60
    const timer = setInterval(() => {
      countDown.value--
      if (countDown.value <= 0) {
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
    const params: MemberRegisterParams = {
      mobile: registerForm.mobile.trim(),
      password: registerForm.password,
      smsCode: registerForm.smsCode,
      name: registerForm.name.trim() || undefined
    }
    
    await memberApi.register(params)
    
    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/login' })
    }, 1500)
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

<style scoped>
.register-page {
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
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-icon-text {
  font-size: 36rpx;
  font-weight: 700;
  color: #1677FF;
}

.brand-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 4rpx;
  margin-bottom: 10rpx;
}

.brand-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.form-section {
  width: 100%;
  padding: 0 40rpx;
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

.code-input-wrap {
  display: flex;
  gap: 20rpx;
}

.code-input {
  flex: 1;
}

.send-code-btn {
  width: 200rpx;
  height: 88rpx;
  background: #1677FF;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.send-code-btn::after {
  border: none;
}

.send-code-btn--disabled {
  background: #ccc;
}

.send-code-text {
  font-size: 26rpx;
  color: #fff;
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

.password-strength {
  margin-top: 16rpx;
}

.strength-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.strength-item {
  flex: 1;
  height: 8rpx;
  border-radius: 4rpx;
}

.strength-item--empty {
  background: #e8e8e8;
}

.strength-item--weak {
  background: #ff4d4f;
}

.strength-item--medium {
  background: #faad14;
}

.strength-item--strong {
  background: #52c41a;
}

.strength-text {
  font-size: 24rpx;
  color: #999;
}

.agreement-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

.checkbox-wrap {
  margin-right: 12rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox--checked {
  background: #1677FF;
  border-color: #1677FF;
}

.check-icon {
  font-size: 24rpx;
  color: #fff;
}

.agreement-text {
  font-size: 24rpx;
  color: #666;
}

.agreement-link {
  font-size: 24rpx;
  color: #1677FF;
  margin: 0 4rpx;
}

.register-error {
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

.register-btn {
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

.register-btn::after {
  border: none;
}

.register-btn--loading {
  opacity: 0.7;
}

.btn-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  letter-spacing: 8rpx;
}

.login-link {
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