<template>
  <div class="layout">
    <!-- 侧边栏：深色磨砂 + 胶囊导航 -->
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">智</div>
          <h1 v-show="!isMenuCollapsed">智享酒仓</h1>
          <h1 v-show="isMenuCollapsed" class="logo-text-collapsed">智</h1>
        </div>
        <el-button
          v-if="!isMenuCollapsed"
          class="collapse-btn"
          :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
          @click="isMenuCollapsed = !isMenuCollapsed"
          size="small"
          text
        />
      </div>

      <!-- 自定义胶囊导航 -->
      <nav class="sidebar-nav">
        <!-- 一级：工作台 -->
        <div class="nav-group">
          <div
            class="nav-item"
            :class="{ active: isActive('/dashboard') }"
            @click="navTo('/dashboard')"
          >
            <el-icon class="nav-icon"><HomeFilled /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">工作台</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: isActive('/todo-list') }"
            @click="navTo('/todo-list')"
          >
            <el-icon class="nav-icon"><Bell /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">待办提醒</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: isActive('/quick-entries') }"
            @click="navTo('/quick-entries')"
          >
            <el-icon class="nav-icon"><Grid /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">快捷入口</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: isActive('/messages') }"
            @click="navTo('/messages')"
          >
            <el-icon class="nav-icon"><ChatDotRound /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">消息中心</span>
          </div>
        </div>

        <!-- 一级：销售管理（展开子菜单） -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.sales }" @click="toggleGroup('sales')">
            <el-icon class="nav-icon"><ShoppingCart /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">销售管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.sales && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/sales/create') }" @click="navTo('/sales/create')">销售开单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sale-bills') }" @click="navTo('/sale-bills')">销售单据</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sale-returns') }" @click="navTo('/sale-returns')">销售退货</div>
            <div class="nav-sub-item" :class="{ active: isActive('/collection') }" @click="navTo('/collection')">收款管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/reports') }" @click="navTo('/sales/reports')">销售报表</div>
          </div>
        </div>

        <!-- 一级：订单管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.orders }" @click="toggleGroup('orders')">
            <el-icon class="nav-icon"><Document /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">订单管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.orders && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/orders') }" @click="navTo('/orders')">订单列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-board') }" @click="navTo('/order-board')">泳道看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-center') }" @click="navTo('/order-center')">全渠道订单</div>
          </div>
        </div>

        <!-- 一级：库存管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.inventory }" @click="toggleGroup('inventory')">
            <el-icon class="nav-icon"><Files /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">库存管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.inventory && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/inventory') }" @click="navTo('/inventory')">库存查询</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-check') }" @click="navTo('/inventory-check')">库存盘点</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-alerts') }" @click="navTo('/inventory-alerts')">库存预警</div>
          </div>
        </div>

        <!-- 一级：商品中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.products }" @click="toggleGroup('products')">
            <el-icon class="nav-icon"><Goods /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">商品中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.products && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/products') }" @click="navTo('/products')">商品列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/categories') }" @click="navTo('/products/categories')">商品分类</div>
            <div class="nav-sub-item" :class="{ active: isActive('/prices') }" @click="navTo('/prices')">价格管理</div>
          </div>
        </div>

        <!-- 一级：客户管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.customers }" @click="toggleGroup('customers')">
            <el-icon class="nav-icon"><User /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">客户管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.customers && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/customers') }" @click="navTo('/customers')">客户列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/member-system') }" @click="navTo('/member-system')">会员体系</div>
            <div class="nav-sub-item" :class="{ active: isActive('/store-value-cards') }" @click="navTo('/store-value-cards')">储值卡</div>
          </div>
        </div>

        <!-- 一级：即时零售 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.instant }" @click="toggleGroup('instant')">
            <el-icon class="nav-icon"><Shop /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">即时零售</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.instant && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/orders') }" @click="navTo('/instant-retail/orders')">小程序订单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/shelf') }" @click="navTo('/instant-retail/shelf')">商品货架</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/report') }" @click="navTo('/instant-retail/report')">零售报表</div>
          </div>
        </div>

        <!-- 一级：数据报表 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.reports }" @click="toggleGroup('reports')">
            <el-icon class="nav-icon"><DataAnalysis /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">数据报表</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.reports && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/reports') }" @click="navTo('/reports')">销售统计</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/products') }" @click="navTo('/reports/products')">商品排行</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/employees') }" @click="navTo('/reports/employees')">员工业绩</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/online-payment') }" @click="navTo('/reports/online-payment')">在线收款分析</div>
          </div>
        </div>

        <!-- 一级：财务管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.finance }" @click="toggleGroup('finance')">
            <el-icon class="nav-icon"><Money /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">财务管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.finance && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/bank-accounts') }" @click="navTo('/bank-accounts')">银行账户</div>
            <div class="nav-sub-item" :class="{ active: isActive('/fund-report') }" @click="navTo('/fund-report')">资金报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/bill-management') }" @click="navTo('/bill-management')">票据管理</div>
          </div>
        </div>

        <!-- 一级：系统设置 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.system }" @click="toggleGroup('system')">
            <el-icon class="nav-icon"><Setting /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">系统设置</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.system && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/department-manage') }" @click="navTo('/department-manage')">部门管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/position-manage') }" @click="navTo('/position-manage')">岗位管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/employees') }" @click="navTo('/employees')">员工管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/stores') }" @click="navTo('/stores')">门店管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/roles') }" @click="navTo('/system/roles')">角色权限</div>
            <div class="nav-sub-item" :class="{ active: isActive('/audit-log') }" @click="navTo('/audit-log')">操作日志</div>
            <div class="nav-sub-item" :class="{ active: isActive('/error-log') }" @click="navTo('/error-log')">错误日志</div>
          </div>
        </div>

        <!-- 一级：营销推广 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.marketing }" @click="toggleGroup('marketing')">
            <el-icon class="nav-icon"><Discount /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">营销推广</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.marketing && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/marketing') }" @click="navTo('/marketing')">营销活动</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/tags') }" @click="navTo('/marketing/tags')">营销标签</div>
          </div>
        </div>

        <!-- 一级：SaaS 平台 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.saas }" @click="toggleGroup('saas')">
            <el-icon class="nav-icon"><OfficeBuilding /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">SaaS 平台</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.saas && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/saas/dashboard') }" @click="navTo('/saas/dashboard')">平台看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/saas/plans') }" @click="navTo('/saas/plans')">套餐管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/saas/tenants') }" @click="navTo('/saas/tenants')">租户管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/saas/subscriptions') }" @click="navTo('/saas/subscriptions')">订阅管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/saas/tenant-review') }" @click="navTo('/saas/tenant-review')">入驻审核</div>
            <div class="nav-sub-item" :class="{ active: isActive('/saas/config') }" @click="navTo('/saas/config')">平台配置</div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main" v-loading="pageLoading">
      <!-- 顶栏：磨砂半透明 -->
      <header class="main-header" v-if="!isCashierMode">
        <div class="header-left">
          <el-button
            v-if="isMenuCollapsed"
            class="menu-toggle-btn"
            :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
            @click="isMenuCollapsed = !isMenuCollapsed"
            size="small"
            text
          />
          <span class="breadcrumb">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <div class="header-search">
            <el-icon><Search /></el-icon>
            <span>搜索商品、订单...</span>
            <kbd>⌘K</kbd>
          </div>
          <el-button
            type="primary"
            size="small"
            @click="toggleCashierMode"
          >
            <el-icon><ShoppingCart /></el-icon>
            切换收银台
          </el-button>
          <el-badge :value="3" :max="99" class="header-badge">
            <el-button circle size="small">
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
          <el-dropdown trigger="click">
            <span class="user-info">
              <el-avatar :size="28" style="background: var(--color-primary)">{{ avatarText }}</el-avatar>
              <span class="user-name">{{ currentUser?.realName || '管理员' }}</span>
              <el-icon><CaretBottom /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 收银台模式 -->
      <div v-if="isCashierMode" class="cashier-container">
        <div class="cashier-header">
          <el-button
            v-if="!isCashierUser"
            type="default"
            size="small"
            @click="toggleCashierMode"
          >
            <el-icon><ArrowLeft /></el-icon>
            返回工作台
          </el-button>
          <h2 class="cashier-title">快速收银台</h2>
          <div class="cashier-date">{{ formatDate(new Date()) }}</div>
        </div>
        <div class="cashier-main">
          <router-view v-if="isCashierMode" />
        </div>
      </div>

      <!-- 常规内容 -->
      <div v-else class="page-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  HomeFilled, Goods, Document, ShoppingCart, User, Files, Shop,
  DataAnalysis, Setting, Bell, Grid, ChatDotRound, Search,
  ArrowDown, CaretBottom, ArrowLeft, OfficeBuilding, Coin, Checked, Money, Discount
} from "@element-plus/icons-vue";
import { formatDate } from "../utils/format";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isMenuCollapsed = ref(false);
const isCashierMode = ref(false);
const pageLoading = ref(false);
const currentUser = computed(() => auth.user);

const openGroups = reactive({
  sales: false,
  orders: false,
  inventory: false,
  products: false,
  customers: false,
  instant: false,
  reports: false,
  finance: false,
  system: false,
  saas: false,
  marketing: false,
});

const avatarText = computed(() => {
  const name = currentUser.value?.realName || '管理员';
  return name.charAt(0);
});

const isCashierUser = computed(() => {
  return currentUser.value?.role === "CASHIER";
});

onMounted(() => {
  if (currentUser.value?.role === "CASHIER") {
    isCashierMode.value = true;
    isMenuCollapsed.value = true;
  }
  const path = route.path;
  if (path.startsWith('/sales') || path.startsWith('/sale-') || path.startsWith('/collection')) openGroups.sales = true;
  if (path.startsWith('/order')) openGroups.orders = true;
  if (path.startsWith('/inventory')) openGroups.inventory = true;
  if (path.startsWith('/products') || path.startsWith('/prices')) openGroups.products = true;
  if (path.startsWith('/customers') || path.startsWith('/member') || path.startsWith('/store-value') || path.startsWith('/credit') || path.startsWith('/points') || path.startsWith('/level') || path.startsWith('/customer-')) openGroups.customers = true;
  if (path.startsWith('/instant-retail')) openGroups.instant = true;
  if (path.startsWith('/reports')) openGroups.reports = true;
  if (path.startsWith('/bank-accounts') || path.startsWith('/fund-report') || path.startsWith('/bill-management')) openGroups.finance = true;
  if (path.startsWith('/system') || path.startsWith('/employees') || path.startsWith('/department-manage') || path.startsWith('/position-manage') || path.startsWith('/stores') || path.startsWith('/audit') || path.startsWith('/error-log') || path.startsWith('/monitor')) openGroups.system = true;
  if (path.startsWith('/saas')) openGroups.saas = true;
  if (path.startsWith('/marketing') || path.startsWith('/aftersale')) openGroups.marketing = true;
});

function isActive(path: string): boolean {
  return route.path === path;
}

function navTo(path: string) {
  router.push(path);
}

function toggleGroup(group: keyof typeof openGroups) {
  openGroups[group] = !openGroups[group];
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    "/dashboard": "工作台",
    "/todo-list": "待办提醒",
    "/quick-entries": "快捷入口",
    "/messages": "消息中心",
    "/sales/create": "销售开单",
    "/sale-bills": "销售单据",
    "/sale-returns": "销售退货",
    "/collection": "收款管理",
    "/orders": "订单列表",
    "/order-board": "泳道看板",
    "/order-center": "全渠道订单聚合",
    "/inventory": "库存查询",
    "/inventory-check": "库存盘点",
    "/inventory-alerts": "库存预警",
    "/products": "商品列表",
    "/products/categories": "商品分类",
    "/prices": "价格管理",
    "/customers": "客户列表",
    "/member-system": "会员体系",
    "/store-value-cards": "储值卡",
    "/instant-retail/orders": "小程序订单",
    "/instant-retail/shelf": "商品货架",
    "/instant-retail/report": "零售报表",
    "/reports": "销售统计",
    "/reports/products": "商品排行",
    "/reports/employees": "员工业绩",
    "/department-manage": "部门管理",
    "/position-manage": "岗位管理",
    "/employees": "员工管理",
    "/stores": "门店管理",
    "/system/roles": "角色权限",
    "/bank-accounts": "银行账户管理",
    "/fund-report": "资金报表",
    "/bill-management": "票据管理",
    "/audit-log": "操作日志",
    "/error-log": "错误日志",
    "/marketing": "营销活动",
    "/marketing/tags": "营销标签管理",
    "/saas/dashboard": "平台经营看板",
    "/saas/plans": "SaaS 套餐管理",
    "/saas/tenants": "租户管理",
    "/saas/subscriptions": "订阅管理",
    "/saas/tenant-review": "入驻审核",
    "/saas/config": "平台配置",
    "/reports/online-payment": "在线收款分析",
  };
  return titles[route.path] || "智享全链管理系统";
});

function toggleCashierMode() {
  isCashierMode.value = !isCashierMode.value;
  if (isCashierMode.value) {
    isMenuCollapsed.value = true;
  }
}

function handleLogout() {
  auth.clearAuth();
  ElMessage.success("已退出登录");
  router.push("/login");
}
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-page);
}

/* ========== 侧边栏：深色磨砂 ========== */
.side {
  width: var(--sidebar-width);
  background: var(--frost-sidebar);
  backdrop-filter: var(--frost-sidebar-blur);
  -webkit-backdrop-filter: var(--frost-sidebar-blur);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 100;
  transition: width 250ms ease-out;
}

.side.is-collapsed {
  width: var(--sidebar-width-collapsed);
}

.side.is-hidden {
  display: none;
}

.sidebar-header {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.logo-icon {
  width: 30px;
  height: 30px;
  background: var(--color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.sidebar-header h1 {
  font-size: 15px;
  font-weight: 700;
  color: var(--sidebar-text-primary);
  margin: 0;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.logo-text-collapsed {
  font-size: 15px;
  font-weight: 700;
  color: var(--sidebar-text-primary);
  margin: 0 auto;
}

.collapse-btn {
  color: var(--sidebar-text-muted) !important;
}

/* ========== 胶囊导航 ========== */
.sidebar-nav {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--nav-item-radius);
  cursor: pointer;
  color: var(--sidebar-text-secondary);
  font-size: 13px;
  transition: all 250ms ease-out;
  margin-bottom: 2px;
  position: relative;
}

.nav-item:hover {
  color: var(--sidebar-text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.nav-item.active {
  background: rgba(91, 106, 191, 0.20);
  color: #FFFFFF;
  font-weight: 500;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  flex-shrink: 0;
  text-align: center;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-arrow {
  font-size: 12px;
  color: var(--sidebar-text-muted);
  transition: transform 200ms ease;
}

.nav-item.open .nav-arrow {
  transform: rotate(180deg);
}

/* 子菜单 */
.nav-sub {
  padding: 2px 0 2px 32px;
}

.nav-sub-item {
  height: 30px;
  line-height: 30px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--sidebar-text-secondary);
  cursor: pointer;
  border-radius: var(--nav-item-radius);
  margin-bottom: 2px;
  transition: all 200ms ease;
}

.nav-sub-item:hover {
  color: var(--sidebar-text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.nav-sub-item.active {
  color: #FFFFFF;
  background: rgba(91, 106, 191, 0.20);
  font-weight: 500;
}

/* ========== 主内容区 ========== */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ========== 顶栏：磨砂半透明 ========== */
.main-header {
  height: var(--topbar-height);
  background: var(--frost-topbar);
  backdrop-filter: var(--frost-topbar-blur);
  -webkit-backdrop-filter: var(--frost-topbar-blur);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-toggle-btn {
  margin-right: 4px;
}

.breadcrumb {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-search {
  width: 260px;
  height: 32px;
  background: var(--gray-100);
  border: 1px solid transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.header-search:hover {
  background: var(--gray-200);
}

.header-search .el-icon {
  font-size: 14px;
}

.header-search kbd {
  margin-left: auto;
  font-size: 11px;
  padding: 1px 6px;
  background: #fff;
  border: 1px solid var(--border-normal);
  border-radius: 4px;
  font-family: var(--font-mono);
}

.header-badge {
  margin-left: 4px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  padding: 4px 8px 4px 4px;
  border-radius: 20px;
  transition: background 150ms ease;
}

.user-info:hover {
  background: var(--gray-100);
}

.user-name {
  font-size: 13px;
  font-weight: 500;
}

/* 页面内容区 */
.page-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

/* 收银台模式 */
.cashier-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

.cashier-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid var(--border-normal);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.cashier-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  text-align: center;
}

.cashier-date {
  font-size: 13px;
  color: var(--text-secondary);
}

.cashier-main {
  flex: 1;
  overflow: auto;
}
</style>
