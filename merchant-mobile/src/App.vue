<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import ProductsView from './views/ProductsView.vue'
import CreateSaleView from './views/CreateSaleView.vue'
import FunctionCenterView from './views/FunctionCenterView.vue'
import ProfileView from './views/ProfileView.vue'
import OrdersView from './views/OrdersView.vue'
import InventoryView from './views/InventoryView.vue'
import CustomersView from './views/CustomersView.vue'
import CustomerDetailView from './views/CustomerDetailView.vue'
import ReceivablesView from './views/ReceivablesView.vue'
import ReportsView from './views/ReportsView.vue'
import SaleBillsView from './views/SaleBillsView.vue'
import InventoryAdjustView from './views/InventoryAdjustView.vue'
import AdminView from './views/AdminView.vue'
import ShareCollectionView from './views/ShareCollectionView.vue'

const token = ref(localStorage.getItem('merchant_token') || '')
const active = ref('home')
const userRole = ref('')

const tabs = [
  { name: 'home', icon: 'wap-home-o', label: '首页' },
  { name: 'products', icon: 'goods-collect-o', label: '商品' },
  { name: 'create-sale', icon: 'edit', label: '开单', isCenter: true },
  { name: 'function-center', icon: 'apps-o', label: '功能' },
  { name: 'profile', icon: 'manager-o', label: '我的' }
]

const tabViews: Record<string, unknown> = {
  home: HomeView,
  products: ProductsView,
  'create-sale': CreateSaleView,
  'function-center': FunctionCenterView,
  profile: ProfileView
}

const subPageViews: Record<string, unknown> = {
  orders: OrdersView,
  inventory: InventoryView,
  customers: CustomersView,
  'customer-detail': CustomerDetailView,
  receivables: ReceivablesView,
  reports: ReportsView,
  'sale-bills': SaleBillsView,
  'inventory-adjust': InventoryAdjustView,
  admin: AdminView,
  'share-collection': ShareCollectionView
}

const isTabView = computed(() => active.value in tabViews)
const currentView = computed(() => tabViews[active.value] || HomeView)
const isSubPage = computed(() => active.value in subPageViews)
const subPageView = computed(() => subPageViews[active.value])

const currentMemberId = computed(() => {
  const id = localStorage.getItem('merchant_customer_detail_id')
  return id ? Number(id) : 0
})

function navigateTo(page: string) {
  active.value = page
}

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
    <!-- Tab 页面：显示 tabbar 上方的内容 -->
    <template v-if="isTabView">
      <component :is="currentView" @navigate="navigateTo" />
    </template>

    <!-- 子页面：全屏显示，无 tabbar -->
    <template v-else-if="isSubPage">
      <component
        :is="subPageView"
        v-bind="active === 'customer-detail' ? { memberId: currentMemberId } : {}"
      />
    </template>

    <!-- 自定义底部导航栏 -->
    <nav class="custom-tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.name"
        class="tabbar-item"
        :class="{
          active: active === tab.name,
          center: tab.isCenter
        }"
        @click="active = tab.name"
      >
        <template v-if="tab.isCenter">
          <div class="center-btn">
            <van-icon :name="tab.icon" size="24" color="#fff" />
          </div>
          <span class="tabbar-label center-label">{{ tab.label }}</span>
        </template>
        <template v-else>
          <van-icon
            :name="tab.icon"
            size="22"
            :color="active === tab.name ? 'var(--color-primary)' : 'var(--text-muted)'"
          />
          <span class="tabbar-label">{{ tab.label }}</span>
        </template>
      </div>
    </nav>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding-bottom: 72px;
}

/* ===== 自定义底部导航 ===== */
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  padding-bottom: env(safe-area-inset-bottom, 0);
  background: var(--bg-card);
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.tabbar-label {
  font-size: 10px;
  margin-top: 2px;
  color: var(--text-muted);
  line-height: 1;
}

.tabbar-item.active .tabbar-label {
  color: var(--color-primary);
  font-weight: 500;
}

/* 中间凸起按钮 */
.tabbar-item.center {
  justify-content: flex-start;
  align-items: center;
  padding-top: 0;
  overflow: visible;
}

.center-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-active));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -14px;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.4);
  transition: transform 0.15s ease;
}

.center-btn:active {
  transform: scale(0.92);
}

.center-label {
  margin-top: 4px !important;
  color: var(--color-primary) !important;
  font-weight: 500;
}
</style>
