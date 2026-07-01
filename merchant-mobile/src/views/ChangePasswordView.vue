<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, showSuccessToast, closeToast, showToast } from 'vant'
import { changePassword } from '../api'

const router = useRouter()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const errors = ref<Record<string, string>>({})

const passwordStrengthHint = computed(() => {
  if (!newPassword.value) return ''
  if (newPassword.value.length < 8) return '至少8位，包含字母和数字'
  if (!/[a-zA-Z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) return '至少8位，包含字母和数字'
  return '密码强度：良好'
})

function validate(): boolean {
  errors.value = {}

  if (!oldPassword.value) {
    errors.value.oldPassword = '请输入旧密码'
  }

  if (!newPassword.value) {
    errors.value.newPassword = '请输入新密码'
  } else if (newPassword.value.length < 8 || !/[a-zA-Z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    errors.value.newPassword = '密码至少8位，包含字母和数字'
  }

  if (!confirmPassword.value) {
    errors.value.confirmPassword = '请确认新密码'
  } else if (confirmPassword.value !== newPassword.value) {
    errors.value.confirmPassword = '两次密码不一致'
  }

  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) {
    showToast('请检查表单信息')
    return
  }

  showLoadingToast({ message: '修改中...', forbidClick: true })
  try {
    await changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    })
    closeToast()
    showSuccessToast('密码修改成功')
    localStorage.removeItem('merchant_token')
    localStorage.removeItem('merchant_user')
    window.dispatchEvent(new Event('auth:logout'))
    router.replace('/login')
  } catch (e: any) {
    closeToast()
    showToast(e?.response?.data?.message || '修改失败')
  }
}
</script>

<template>
  <section class="page">
    <van-nav-bar
      title="修改密码"
      left-arrow
      @click-left="router.back"
    />

    <!-- 表单 -->
    <div class="form-section">
      <van-cell-group inset>
        <van-field
          v-model="oldPassword"
          label="旧密码"
          type="password"
          placeholder="请输入旧密码"
          required
          :error="!!errors.oldPassword"
          :error-message="errors.oldPassword"
        />
        <van-field
          v-model="newPassword"
          label="新密码"
          type="password"
          placeholder="请输入新密码"
          required
          :error="!!errors.newPassword"
          :error-message="errors.newPassword"
        />
        <van-field
          v-model="confirmPassword"
          label="确认密码"
          type="password"
          placeholder="请再次输入新密码"
          required
          :error="!!errors.confirmPassword"
          :error-message="errors.confirmPassword"
        />
      </van-cell-group>
    </div>

    <!-- 密码强度提示 -->
    <div v-if="passwordStrengthHint" class="hint-section">
      <van-cell-group inset>
        <van-cell :value="passwordStrengthHint" />
      </van-cell-group>
    </div>

    <!-- 确认按钮 -->
    <div class="submit-section">
      <van-button
        block
        type="primary"
        @click="handleSubmit"
      >
        确认修改
      </van-button>
    </div>
  </section>
</template>

<style scoped>
.form-section {
  margin: 0 0 12px;
}

.hint-section {
  margin-bottom: 24px;
}

.submit-section {
  padding: 0 16px;
}
</style>