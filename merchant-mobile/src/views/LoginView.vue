<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { api } from '../api'

const emit = defineEmits<{ login: [token: string] }>()
const username = ref('store_manager')
const password = ref('admin123')

async function login() {
  try {
    const res = await api.post('/auth/login', { username: username.value, password: password.value })
    const token = res.data.data.token
    if (!token) {
      showToast('登录失败')
      return
    }
    emit('login', token)
  } catch {
    showToast('登录失败，请检查网络')
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-card card">
      <h1>智享商家端</h1>
      <p>手机经营，PC 管理，小程序接客</p>
      <van-field v-model="username" label="账号" placeholder="请输入账号" />
      <van-field v-model="password" label="密码" type="password" placeholder="请输入密码" />
      <van-button block type="primary" @click="login">登录</van-button>
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
}

.login-card h1 {
  margin: 0 0 8px;
  color: var(--color-primary);
}

.login-card p {
  margin: 0 0 24px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
