<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import OrdersView from './views/OrdersView.vue'
import InventoryView from './views/InventoryView.vue'
import CustomersView from './views/CustomersView.vue'
import ReceivablesView from './views/ReceivablesView.vue'
import ReportsView from './views/ReportsView.vue'
import ProfileView from './views/ProfileView.vue'

const token = ref(localStorage.getItem('merchant_token') || '')
const active = ref('home')

const views: Record<string, unknown> = {
  home: HomeView,
  orders: OrdersView,
  inventory: InventoryView,
  customers: CustomersView,
  receivables: ReceivablesView,
  reports: ReportsView,
  profile: ProfileView
}

const currentView = computed(() => views[active.value] || HomeView)

function onLogin(nextToken: string) {
  localStorage.setItem('merchant_token', nextToken)
  token.value = nextToken
}

onMounted(() => {
  window.addEventListener('auth:logout', () => {
    token.value = ''
    active.value = 'home'
  })
})
</script>

<template>
  <LoginView v-if="!token" @login="onLogin" />
  <main v-else class="app-shell">
    <component :is="currentView" />
    <van-tabbar v-model="active" safe-area-inset-bottom>
      <van-tabbar-item name="home" icon="wap-home">首页</van-tabbar-item>
      <van-tabbar-item name="orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item name="inventory" icon="cluster-o">库存</van-tabbar-item>
      <van-tabbar-item name="customers" icon="friends-o">客户</van-tabbar-item>
      <van-tabbar-item name="profile" icon="manager-o">我的</van-tabbar-item>
    </van-tabbar>
  </main>
</template>
