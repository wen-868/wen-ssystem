<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoginView from './views/LoginView.vue'
import HomeView from './views/HomeView.vue'
import OrdersView from './views/OrdersView.vue'
import InventoryView from './views/InventoryView.vue'
import CustomersView from './views/CustomersView.vue'
import CustomerDetailView from './views/CustomerDetailView.vue'
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

// 快捷胶囊栏配置
const quickCapsules = [
  { key: 'today', label: '今日', icon: '📅' },
  { key: 'week', label: '本周', icon: '📊' },
  { key: 'month', label: '本月', icon: '📈' },
  { key: 'all', label: '全部', icon: '📋' },
]
const activeCapsule = ref('today')

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
  'customer-detail': CustomerDetailView,
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

const currentMemberId = computed(() => {
  const id = localStorage.getItem('merchant_customer_detail_id')
  return id ? Number(id) : 0
})

// 当前页面标题
const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    home: '智享酒仓',
    orders: '订单管理',
    'create-sale': '销售开单',
    inventory: '库存查询',
    customers: '客户管理',
    'customer-detail': '客户详情',
    receivables: '应收管理',
    reports: '数据报表',
    admin: '系统管理',
    'sale-bills': '销售单据',
    'inventory-adjust': '库存调整',
    'share-collection': '分享收款',
    profile: '我的'
  }
  return titles[active.value] || '智享酒仓'
})

// 是否显示快捷胶囊栏
const showCapsuleBar = computed(() => {
  return ['home', 'orders', 'reports', 'receivables'].includes(active.value)
})

// 是否显示 FAB
const showFab = computed(() => {
  return ['customers', 'inventory', 'orders'].includes(active.value)
})

const fabText = computed(() => {
  const map: Record<string, string> = {
    customers: '新增客户',
    inventory: '入库',
    orders: '新建订单'
  }
  return map[active.value] || ''
})

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

function handleFabClick() {
  const map: Record<string, string> = {
    customers: 'customer-detail',
    inventory: 'inventory-adjust',
    orders: 'create-sale'
  }
  const target = map[active.value]
  if (target) {
    window.dispatchEvent(new CustomEvent('nav', { detail: target }))
  }
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
    <!-- 磨砂顶栏 -->
    <header class="app-topbar">
      <div class="topbar-left">
        <div class="topbar-logo" v-if="active === 'home'">智</div>
        <span class="topbar-title">{{ pageTitle }}</span>
      </div>
      <div class="topbar-right">
        <button class="topbar-btn" aria-label="搜索">
          <van-icon name="search" size="18" />
        </button>
        <div class="topbar-badge-wrap">
          <button class="topbar-btn" aria-label="消息">
            <van-icon name="bell" size="18" />
          </button>
          <span class="topbar-badge-dot">3</span>
        </div>
      </div>
    </header>

    <!-- 快捷胶囊栏（横向滚动） -->
    <div v-if="showCapsuleBar" class="capsule-bar">
      <div class="capsule-scroll">
        <div
          v-for="cap in quickCapsules"
          :key="cap.key"
          class="capsule-item"
          :class="{ active: activeCapsule === cap.key }"
          @click="activeCapsule = cap.key"
        >
          <span class="capsule-icon">{{ cap.icon }}</span>
          <span class="capsule-label">{{ cap.label }}</span>
        </div>
      </div>
    </div>

    <!-- 页面内容区 -->
    <div class="page-content" :class="{ 'with-capsule': showCapsuleBar }">
      <component :is="currentView" v-bind="active === 'customer-detail' ? { memberId: currentMemberId } : {}" />
    </div>

    <!-- FAB 浮动操作按钮 -->
    <button v-if="showFab" class="fab-btn" @click="handleFabClick">
      <span class="fab-icon">+</span>
      <span class="fab-text">{{ fabText }}</span>
    </button>

    <!-- 磨砂底部标签栏 -->
    <van-tabbar v-model="active" safe-area-inset-bottom class="app-tabbar">
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

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ========== 磨砂顶栏 ========== */
.app-topbar {
  height: var(--topbar-height);
  background: var(--frost-topbar);
  backdrop-filter: var(--frost-topbar-blur);
  -webkit-backdrop-filter: var(--frost-topbar-blur);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-logo {
  width: 28px;
  height: 28px;
  background: var(--color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.topbar-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--gray-100);
  border: none;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease;
  padding: 0;
}

.topbar-btn:active {
  background: var(--gray-200);
}

.topbar-badge-wrap {
  position: relative;
}

.topbar-badge-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-danger);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
}

/* ========== 快捷胶囊栏 ========== */
.capsule-bar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  padding: 10px 0;
  flex-shrink: 0;
  position: sticky;
  top: var(--topbar-height);
  z-index: 90;
}

.capsule-scroll {
  display: flex;
  gap: var(--capsule-gap);
  padding: 0 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.capsule-scroll::-webkit-scrollbar {
  display: none;
}

.capsule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--capsule-padding);
  border-radius: var(--capsule-radius);
  background: var(--gray-100);
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.capsule-item:hover {
  background: var(--gray-200);
}

.capsule-item.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 500;
}

.capsule-icon {
  font-size: 14px;
}

.capsule-label {
  line-height: 1;
}

/* ========== 页面内容区 ========== */
.page-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(var(--bottombar-height) + env(safe-area-inset-bottom));
  min-height: 0;
}

.page-content.with-capsule {
  padding-bottom: calc(var(--bottombar-height) + env(safe-area-inset-bottom));
}

/* ========== FAB 浮动操作按钮 ========== */
.fab-btn {
  position: fixed;
  right: 16px;
  bottom: calc(var(--bottombar-height) + env(safe-area-inset-bottom) + 16px);
  width: auto;
  min-width: var(--fab-size);
  height: var(--fab-size);
  padding: 0 20px;
  border-radius: 28px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(91, 106, 191, 0.4);
  transition: all 150ms ease;
  z-index: 95;
}

.fab-btn:active {
  transform: scale(0.95);
  background: var(--color-primary-active);
}

.fab-icon {
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
}

.fab-text {
  line-height: 1;
}

/* ========== 磨砂底部标签栏 ========== */
.app-tabbar {
  position: sticky !important;
  bottom: 0 !important;
  z-index: 100;
}
</style>
