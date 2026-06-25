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
        <!-- 1. 工作台 -->
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>

        <!-- 2. 销售管理 -->
        <el-sub-menu index="sales">
          <template #title>
            <el-icon><ShoppingCart /></el-icon>
            <span>销售管理</span>
          </template>
          <el-menu-item index="/sales/create">销售开单</el-menu-item>
          <el-menu-item index="/sale-bills">销售单据</el-menu-item>
          <el-menu-item index="/sale-returns">销售退货</el-menu-item>
          <el-menu-item index="/collection">收款管理</el-menu-item>
        </el-sub-menu>

        <!-- 3. 订单管理 -->
        <el-sub-menu index="orders">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>订单管理</span>
          </template>
          <el-menu-item index="/orders">订单列表</el-menu-item>
          <el-menu-item index="/order-board">泳道看板</el-menu-item>
          <el-menu-item index="/order-timeout">超时处理</el-menu-item>
        </el-sub-menu>

        <!-- 4. 采购管理 -->
        <el-sub-menu index="purchase">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>采购管理</span>
          </template>
          <el-menu-item index="/purchase-orders">采购订单</el-menu-item>
          <el-menu-item index="/purchase-in-stocks">采购入库</el-menu-item>
          <el-menu-item index="/purchase-returns">采购退货</el-menu-item>
          <el-menu-item index="/purchase-payments">采购付款</el-menu-item>
          <el-menu-item index="/suppliers">供应商</el-menu-item>
        </el-sub-menu>

        <!-- 5. 库存管理 -->
        <el-sub-menu index="inventory">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>库存管理</span>
          </template>
          <el-menu-item index="/inventory">库存查询</el-menu-item>
          <el-menu-item index="/inventory-check">库存盘点</el-menu-item>
          <el-menu-item index="/inventory-transfer">库存调拨</el-menu-item>
          <el-menu-item index="/inventory-batch">批次追溯</el-menu-item>
          <el-menu-item index="/inventory-alerts">库存预警</el-menu-item>
        </el-sub-menu>

        <!-- 6. 客户管理 -->
        <el-sub-menu index="customers">
          <template #title>
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </template>
          <el-menu-item index="/customers">客户列表</el-menu-item>
          <el-menu-item index="/credit">授信管理</el-menu-item>
        </el-sub-menu>

        <!-- 7. 商品中心 -->
        <el-sub-menu index="products">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品中心</span>
          </template>
          <el-menu-item index="/products">商品列表</el-menu-item>
          <el-menu-item index="/products/categories">商品分类</el-menu-item>
          <el-menu-item index="/prices">价格管理</el-menu-item>
        </el-sub-menu>

        <!-- 8. 即时零售（开发中） -->
        <el-sub-menu index="instant-retail" disabled>
          <template #title>
            <el-icon><Shop /></el-icon>
            <span>即时零售</span>
          </template>
          <el-menu-item index="/instant-retail/shop">商城配置</el-menu-item>
          <el-menu-item index="/instant-retail/orders">客户下单</el-menu-item>
          <el-menu-item index="/instant-retail/payment">在线支付</el-menu-item>
          <el-menu-item index="/instant-retail/delivery">配送管理</el-menu-item>
          <el-menu-item index="/instant-retail/report">零售报表</el-menu-item>
        </el-sub-menu>

        <!-- 9. 财务管理 -->
        <el-sub-menu index="finance">
          <template #title>
            <el-icon><Coin /></el-icon>
            <span>财务管理</span>
          </template>
          <el-menu-item index="/payments">资金流水</el-menu-item>
          <el-menu-item index="/finance/collection">收款链接</el-menu-item>
          <el-menu-item index="/customer-statements">客户对账</el-menu-item>
          <el-menu-item index="/finance/profit">经营利润</el-menu-item>
        </el-sub-menu>

        <!-- 10. 数据报表 -->
        <el-sub-menu index="reports">
          <template #title>
            <el-icon><DataAnalysis /></el-icon>
            <span>数据报表</span>
          </template>
          <el-menu-item index="/reports">销售统计</el-menu-item>
          <el-menu-item index="/reports/products">商品排行</el-menu-item>
          <el-menu-item index="/reports/employees">员工业绩</el-menu-item>
          <el-menu-item index="/reports/stores">门店对比</el-menu-item>
        </el-sub-menu>

        <!-- 11. 营销推广 -->
        <el-sub-menu index="marketing">
          <template #title>
            <el-icon><Present /></el-icon>
            <span>营销推广</span>
          </template>
          <el-menu-item index="/marketing">优惠券管理</el-menu-item>
          <el-menu-item index="/marketing/promotion">促销活动</el-menu-item>
          <el-menu-item index="/aftersale">售后管理</el-menu-item>
        </el-sub-menu>

        <!-- 12. 系统管理（含门店管理） -->
        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/employees">员工管理</el-menu-item>
          <el-menu-item index="/stores">门店管理</el-menu-item>
          <el-menu-item index="/system/roles">角色权限</el-menu-item>
          <el-menu-item index="/audit-log">操作日志</el-menu-item>
          <el-menu-item index="/system">系统配置</el-menu-item>
        </el-sub-menu>
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
          <h2 class="cashier-title">快速收银台</h2>
          <div class="cashier-date">{{ formatDate(new Date()) }}</div>
        </div>
        <div class="cashier-main">
          <router-view v-if="isCashierMode" />
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
import { HomeFilled, Goods, Document, ShoppingCart, Box, User, Files, Shop, Coin, Present, DataAnalysis, Setting, Expand, Fold } from "@element-plus/icons-vue";
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
    "/sales/create": "销售开单",
    "/sale-bills": "销售单据",
    "/sale-returns": "销售退货",
    "/collection": "收款管理",
    "/orders": "订单列表",
    "/order-board": "泳道看板",
    "/order-timeout": "超时处理",
    "/purchase-orders": "采购订单",
    "/purchase-in-stocks": "采购入库",
    "/purchase-returns": "采购退货",
    "/purchase-payments": "采购付款",
    "/suppliers": "供应商",
    "/inventory": "库存查询",
    "/inventory-check": "库存盘点",
    "/inventory-transfer": "库存调拨",
    "/inventory-batch": "批次追溯",
    "/inventory-alerts": "库存预警",
    "/customers": "客户列表",
    "/credit": "授信管理",
    "/products": "商品列表",
    "/products/categories": "商品分类",
    "/prices": "价格管理",
    "/payments": "资金流水",
    "/finance/collection": "收款链接",
    "/customer-statements": "客户对账",
    "/finance/profit": "经营利润",
    "/reports": "销售统计",
    "/reports/products": "商品排行",
    "/reports/employees": "员工业绩",
    "/reports/stores": "门店对比",
    "/marketing": "优惠券管理",
    "/marketing/promotion": "促销活动",
    "/aftersale": "售后管理",
    "/employees": "员工管理",
    "/stores": "门店管理",
    "/system/roles": "角色权限",
    "/audit-log": "操作日志",
    "/system": "系统配置"
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
