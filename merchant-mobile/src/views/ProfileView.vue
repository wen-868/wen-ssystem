<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'

const me = ref({
  realName: '',
  storeId: 1,
  role: '',
  permissions: [] as string[]
})
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/store/me')
    const data = res.data.data || {}
    me.value = {
      realName: data.realName || '商家用户',
      storeId: data.storeId || 1,
      role: data.role || '',
      permissions: data.permissions || []
    }
  } catch {
    // 使用本地缓存
    const savedUser = localStorage.getItem('merchant_user')
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        me.value.realName = parsed.name || '商家用户'
        me.value.role = parsed.role || ''
      } catch {
        // ignore
      }
    }
  } finally {
    loading.value = false
  }
})

function logout() {
  localStorage.removeItem('merchant_token')
  localStorage.removeItem('merchant_user')
  window.dispatchEvent(new Event('auth:logout'))
}
</script>

<template>
  <section class="page">
    <div class="card profile-card">
      <div class="profile-header">
        <van-icon name="manager-o" size="48" color="var(--color-primary)" />
        <div class="profile-info">
          <h2>{{ me.realName }}</h2>
          <van-tag v-if="me.role" plain size="medium">{{ me.role }}</van-tag>
        </div>
      </div>
      <van-cell-group inset>
        <van-cell title="门店ID" :value="String(me.storeId)" />
        <van-cell title="权限数" :value="`${me.permissions.length} 项`" />
      </van-cell-group>
    </div>
    <div class="logout-section">
      <van-button block type="danger" plain @click="logout">退出登录</van-button>
    </div>
  </section>
</template>

<style scoped>
.profile-card {
  text-align: center;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.profile-info h2 {
  margin: 8px 0 4px;
  font-size: 18px;
  color: var(--text-primary);
}

.logout-section {
  margin-top: 24px;
}
</style>
