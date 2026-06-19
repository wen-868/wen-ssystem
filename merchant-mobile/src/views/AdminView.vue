<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const menus = [
  { label: '商品管理', icon: 'goods-collect-o', path: '/admin/products', color: 'var(--color-primary)' },
  { label: '员工管理', icon: 'friends-o', path: '/admin/staff', color: 'var(--color-success)' },
  { label: '门店设置', icon: 'shop-o', path: '/admin/stores', color: 'var(--color-warning)' },
  { label: '价格管理', icon: 'gold-coin-o', path: '/admin/prices', color: 'var(--color-danger)' }
]

function goTo(path: string) {
  router.push(path)
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">管理后台</h2>

    <div class="admin-grid">
      <div
        v-for="item in menus"
        :key="item.path"
        class="admin-card"
        @click="goTo(item.path)"
      >
        <div class="admin-icon" :style="{ background: item.color + '14', color: item.color }">
          <van-icon :name="item.icon" size="28" />
        </div>
        <span class="admin-label">{{ item.label }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.admin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.admin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 24px 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.admin-card:active {
  transform: scale(0.98);
}

.admin-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
</style>
