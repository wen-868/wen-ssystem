<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { api } from '../api'

const emit = defineEmits<{ login: [token: string, user: { id: number; name: string; role: string }] }>()
const username = ref('')
const password = ref('')
const loading = ref(false)

async function login() {
  loading.value = true
  try {
    const res = await api.post('/store/auth/login', {
      username: username.value,
      password: password.value
    })
    const data = res.data
    if (!data || !data.token) {
      showToast('登录失败')
      return
    }
    // 存储 token 和用户信息到 localStorage
    localStorage.setItem('merchant_token', data.token)
    localStorage.setItem('merchant_user', JSON.stringify(data.user))
    emit('login', data.token, data.user)
    showToast('登录成功')
  } catch {
    showToast('登录失败，请检查网络')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-card card">
      <div class="login-header">
        <h1>智享商家端</h1>
        <p>手机经营，PC 管理，小程序接客</p>
      </div>
      <van-form @submit="login">
        <van-cell-group inset>
          <van-field
            v-model="username"
            name="username"
            label="账号"
            placeholder="请输入账号"
            :rules="[{ required: true, message: '请输入账号' }]"
          />
          <van-field
            v-model="password"
            type="password"
            name="password"
            label="密码"
            placeholder="请输入密码"
            :rules="[{ required: true, message: '请输入密码' }]"
          />
        </van-cell-group>
        <div class="login-btn">
          <van-button block type="primary" native-type="submit" :loading="loading">登录</van-button>
        </div>
      </van-form>
    </div>
  </section>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-soft);
}

.login-card {
  width: 100%;
  max-width: 360px;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-header h1 {
  margin: 0 0 8px;
  color: var(--color-primary);
  font-size: 24px;
}

.login-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.login-btn {
  margin-top: 24px;
  padding: 0 16px;
}
</style>
