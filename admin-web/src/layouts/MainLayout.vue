<template>
  <div class="layout">
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header">
        <h1 v-show="!isMenuCollapsed">智享营销系统</h1>
        <h1 v-show="isMenuCollapsed">智享</h1>
        <el-button
          class="collapse-btn"
          :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
          @click="isMenuCollapsed = !isMenuCollapsed"
          size="small"
        />
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isMenuCollapsed"
        :collapse-transition="false"
        class="sidebar-menu"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>

        <el-sub-menu index="products">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品管理</span>
          </template>
          <el-menu-item index="/products">商品列表</el-menu-item>
          <el-menu-item index="/prices">价格中心</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="orders">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>订单管理</span>
          </template>
          <el-menu-item index="/orders">订单列表</el-menu-item>
          <el-menu-item index="/order-board">泳道看板</el-menu-item>
          <el-menu-item index="/order-timeout">超时处理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="sales">
          <template #title>
            <el-icon><ShoppingCart /></el-icon>
            <span>销售管理</span>
          </template>
          <el-menu-item index="/sale-bills">销售单</el-menu-item>
          <el-menu-item index="/sale-returns">销售退货</el-menu-item>
          <el-menu-item index="/payments">收款记录</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="purchase">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>采购管理</span>
          </template>
          <el-menu-item index="/purchase-orders">采购订单</el-menu-item>
          <el-menu-item index="/purchase-in-stocks">采购入库</el-menu-item>
          <el-menu-item index="/suppliers">供应商</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="customers">
          <template #title>
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </template>
          <el-menu-item index="/customers">客户列表</el-menu-item>
          <el-menu-item index="/customer-statements">客户对账</el-menu-item>
          <el-menu-item index="/credit">授信管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="inventory">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>库存管理</span>
          </template>
          <el-menu-item index="/inventory">库存总览</el-menu-item>
          <el-menu-item index="/inventory-alerts">预警中心</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="stores">
          <template #title>
            <el-icon><OfficeBuilding /></el-icon>
            <span>门店管理</span>
          </template>
          <el-menu-item index="/stores">门店列表</el-menu-item>
          <el-menu-item index="/employees">员工管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="marketing">
          <template #title>
            <el-icon><Present /></el-icon>
            <span>营销中心</span>
          </template>
          <el-menu-item index="/marketing">营销活动</el-menu-item>
          <el-menu-item index="/aftersale">售后管理</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/reports">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>报表中心</template>
        </el-menu-item>

        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/audit-log">操作日志</el-menu-item>
          <el-menu-item index="/system">系统设置</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/collection">
          <el-icon><Rank /></el-icon>
          <template #title>分享收款</template>
        </el-menu-item>
      </el-menu>
    </aside>
    <main class="main" v-loading="pageLoading">
      <header class="main-header" v-if="!isCashierMode">
        <div class="header-left">
          <span class="header-title">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <el-button
            type="primary"
            size="small"
            icon="ShoppingCart"
            @click="toggleCashierMode"
          >
            切换收银台
          </el-button>
          <el-dropdown trigger="click" style="margin-left: 12px">
            <span class="user-info">
              <el-icon><User /></el-icon>
              <span>{{ currentUser?.realName || '管理员' }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div v-if="isCashierMode" class="cashier-container">
        <div class="cashier-header">
          <el-button
            type="default"
            size="small"
            icon="ArrowLeft"
            @click="toggleCashierMode"
          >
            返回管理后台
          </el-button>
          <h2 class="cashier-title">收银台</h2>
          <div class="cashier-date">{{ formatDate(new Date()) }}</div>
        </div>
        <div class="cashier-main">
          <div style="padding:40px;text-align:center;color:var(--text-secondary)">
            收银台功能迁移中...
          </div>
        </div>
      </div>

      <router-view v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { HomeFilled, Goods, Document, ShoppingCart, Box, User, Files, OfficeBuilding, Present, DataAnalysis, Setting, Expand, Fold, Rank } from "@element-plus/icons-vue";
import { formatDate } from "../utils/format";

const route = useRoute();
const router = useRouter();

const isMenuCollapsed = ref(false);
const isCashierMode = ref(false);
const pageLoading = ref(false);
const currentUser = ref<any>(null);

const activeMenu = computed(() => route.path);

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    "/dashboard": "工作台",
    "/products": "商品列表",
    "/prices": "价格中心",
    "/orders": "订单列表",
    "/order-board": "泳道看板",
    "/order-timeout": "超时处理",
    "/sale-bills": "销售单",
    "/sale-returns": "销售退货",
    "/payments": "收款记录",
    "/purchase-orders": "采购订单",
    "/purchase-in-stocks": "采购入库",
    "/suppliers": "供应商",
    "/customers": "客户列表",
    "/customer-statements": "客户对账",
    "/credit": "授信管理",
    "/inventory": "库存总览",
    "/inventory-alerts": "预警中心",
    "/stores": "门店列表",
    "/employees": "员工管理",
    "/marketing": "营销活动",
    "/aftersale": "售后管理",
    "/reports": "报表中心",
    "/audit-log": "操作日志",
    "/system": "系统设置",
    "/collection": "分享收款"
  };
  return titles[route.path] || "智享营销系统";
});

function toggleCashierMode() {
  isCashierMode.value = !isCashierMode.value;
  if (isCashierMode.value) {
    isMenuCollapsed.value = true;
  }
}

function handleLogout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
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

.side {
  width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  transition: width 0.2s;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.side.is-collapsed {
  width: 64px;
}

.side.is-hidden {
  display: none;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
}

.collapse-btn {
  padding: 4px !important;
}

.sidebar-menu {
  flex: 1;
  border-right: none !important;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
}

.cashier-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

.cashier-header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.cashier-title {
  margin: 0;
  font-size: 16px;
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
