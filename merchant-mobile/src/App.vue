<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import OrdersView from './views/OrdersView.vue'
import InventoryView from './views/InventoryView.vue'
import CustomersView from './views/CustomersView.vue'
import ReceivablesView from './views/ReceivablesView.vue'
import ReportsView from './views/ReportsView.vue'
import CreateSaleView from './views/CreateSaleView.vue'
import SaleBillsView from './views/SaleBillsView.vue'
import ProfileView from './views/ProfileView.vue'
import InventoryAdjustView from './views/InventoryAdjustView.vue'
import AdminView from './views/AdminView.vue'
import ShareCollectionView from './views/ShareCollectionView.vue'

const token = ref(localStorage.getItem('merchant_token') || '')
const active = ref('home')
const userRole = ref('')

// 所有角色都能看到的菜单
const baseTabs = [
  { name: 'home', icon: 'wap-home', label: '首页' },
  { name: 'orders', icon: 'orders-o', label: '订单' },
  { name: 'create-sale', icon: 'gold-coin', label: '开单' },
  { name: 'inventory', icon: 'cluster-o', label: '库存' },
  { name: 'customers', icon: 'friends-o', label: '客户' },
  { name: 'profile', icon: 'manager-o', label: '我的' }
]

// 管理员额外看到的菜单（应收、报表、管理）
const adminExtraTabs = [
  { name: 'receivables', icon: 'balance-o', label: '应收' },
  { name: 'reports', icon: 'chart-trending-o', label: '报表' },
  { name: 'admin', icon: 'setting-o', label: '管理' }
]

// 根据角色计算可见的 tabbar 菜单
const visibleTabs = computed(() => {
  const isAdmin = userRole.value === 'ADMIN' || userRole.value === 'SUPER_ADMIN'
  if (isAdmin) {
    // 管理员：首页、订单、库存、客户、应收、报表、我的
    return [
      ...baseTabs.slice(0, 4),
      ...adminExtraTabs,
      baseTabs[4]
    ]
  }
  // 普通角色：首页、订单、库存、客户、我的
  return baseTabs
})

const views: Record<string, unknown> = {
  home: HomeView,
  orders: OrdersView,
  inventory: InventoryView,
  customers: CustomersView,
  receivables: ReceivablesView,
  reports: ReportsView,
  admin: AdminView,
  'create-sale': CreateSaleView,
  'sale-bills': SaleBillsView,
  'inventory-adjust': InventoryAdjustView,
  'share-collection': ShareCollectionView,
  profile: ProfileView
}

const currentView = computed(() => views[active.value] || HomeView)

function onLogin(nextToken: string, user?: { id: number; name: string; role: string }) {
  localStorage.setItem('merchant_token', nextToken)
  token.value = nextToken
  if (user) {
    userRole.value = user.role || ''
    localStorage.setItem('merchant_user', JSON.stringify(user))
  }
  active.value = 'home'
}

function onLogout() {
  token.value = ''
  userRole.value = ''
  active.value = 'home'
  localStorage.removeItem('merchant_token')
  localStorage.removeItem('merchant_user')
}

onMounted(() => {
  // 恢复已登录的用户角色
  const savedUser = localStorage.getItem('merchant_user')
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser)
      userRole.value = parsed.role || ''
    } catch {
      // ignore
    }
  }

  window.addEventListener('auth:logout', onLogout)

  window.addEventListener('nav', ((e: CustomEvent) => {
    active.value = e.detail
  }) as EventListener)
})
</script>

<template>
  <LoginView v-if="!token" @login="onLogin" />
  <main v-else class="app-shell">
    <component :is="currentView" />
    <van-tabbar v-model="active" safe-area-inset-bottom>
      <van-tabbar-item
        v-for="tab in visibleTabs"
        :key="tab.name"
        :name="tab.name"
        :icon="tab.icon"
      >
        {{ tab.label }}
      </van-tabbar-item>
    </van-tabbar>
  </main>
</template>
