<template>
  <div class="layout">
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header">
        <h1 v-show="!isMenuCollapsed">智享全链管理系统</h1>
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
        <el-menu-item index="/todo-list">
          <el-icon><Bell /></el-icon>
          <template #title>待办提醒</template>
        </el-menu-item>
        <el-menu-item index="/quick-entries">
          <el-icon><Grid /></el-icon>
          <template #title>快捷入口</template>
        </el-menu-item>
        <el-menu-item index="/messages">
          <el-icon><ChatDotRound /></el-icon>
          <template #title>消息中心</template>
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
          <el-menu-item index="/sales/collection-links">分享链接</el-menu-item>
          <el-menu-item index="/sales/customer-prices">价格策略</el-menu-item>
          <el-menu-item index="/sales/commission/rules">提成规则</el-menu-item>
          <el-menu-item index="/sales/commission/records">提成记录</el-menu-item>
          <el-menu-item index="/sales/reports">销售报表</el-menu-item>
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
          <el-menu-item index="/order-center">全渠道订单聚合</el-menu-item>
          <el-menu-item index="/order-routing">订单分发与路由</el-menu-item>
          <el-menu-item index="/order-sync">订单状态同步</el-menu-item>
          <el-menu-item index="/order-exception">订单异常处理</el-menu-item>
          <el-menu-item index="/order-product-map">全渠道商品映射</el-menu-item>
          <el-menu-item index="/order-aftersale">订单售后聚合</el-menu-item>
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
          <el-menu-item index="/purchase/supplier-statements">供应商对账</el-menu-item>
          <el-menu-item index="/purchase/plans">采购计划</el-menu-item>
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
          <el-menu-item index="/inventory-cost">成本核算</el-menu-item>
          <el-menu-item index="/inventory-alert-config">预警配置</el-menu-item>
          <el-menu-item index="/inventory-reports">库存报表</el-menu-item>
        </el-sub-menu>

        <!-- 6. 客户管理 -->
        <el-sub-menu index="customers">
          <template #title>
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </template>
          <el-menu-item index="/customers">客户列表</el-menu-item>
          <el-menu-item index="/credit">授信管理</el-menu-item>
          <el-menu-item index="/points-rules">积分规则</el-menu-item>
          <el-menu-item index="/level-config">等级配置</el-menu-item>
          <el-menu-item index="/store-value-cards">储值卡</el-menu-item>
          <el-menu-item index="/member-system">会员体系</el-menu-item>
          <el-menu-item index="/customer-tags">客户标签</el-menu-item>
          <el-menu-item index="/customer-profile">客户画像</el-menu-item>
          <el-menu-item index="/customer-care">关怀规则</el-menu-item>
          <el-menu-item index="/customer-lifecycle">生命周期</el-menu-item>
          <el-menu-item index="/customer-segments">客户分群</el-menu-item>
        </el-sub-menu>

        <!-- 7. 商品中心 -->
        <el-sub-menu index="products">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品中心</span>
          </template>
          <el-menu-item index="/products">商品列表</el-menu-item>
          <el-menu-item index="/products/categories">商品分类</el-menu-item>
          <el-menu-item index="/products/brands">品牌管理</el-menu-item>
          <el-menu-item index="/products/units">单位管理</el-menu-item>
          <el-menu-item index="/products/import">商品导入</el-menu-item>
          <el-menu-item index="/products/tags">商品标签</el-menu-item>
          <el-menu-item index="/products/tag-groups">标签分组</el-menu-item>
          <el-menu-item index="/products/tag-relation">标签关联</el-menu-item>
          <el-menu-item index="/prices">价格管理</el-menu-item>
        </el-sub-menu>

        <!-- 8. 即时零售 -->
        <el-sub-menu index="instant-retail">
          <template #title>
            <el-icon><Shop /></el-icon>
            <span>即时零售</span>
          </template>
          <el-menu-item index="/instant-retail/config">小程序配置</el-menu-item>
          <el-menu-item index="/instant-retail/shelf">商品货架</el-menu-item>
          <el-menu-item index="/instant-retail/orders">小程序订单</el-menu-item>
          <el-menu-item index="/instant-retail/payment">在线支付</el-menu-item>
          <el-menu-item index="/instant-retail/delivery">配送管理</el-menu-item>
          <el-menu-item index="/instant-retail/report">零售报表</el-menu-item>
          <el-menu-item index="/instant-retail/platform">平台对接</el-menu-item>
          <el-menu-item index="/instant-retail/order-board">60秒接单</el-menu-item>
        </el-sub-menu>

        <!-- 9. 财务往来 -->
        <el-sub-menu index="finance">
          <template #title>
            <el-icon><Coin /></el-icon>
            <span>财务往来</span>
          </template>
          <el-menu-item index="/payments">资金流水</el-menu-item>
          <el-menu-item index="/finance/collection">收款链接</el-menu-item>
          <el-menu-item index="/customer-statements">客户对账</el-menu-item>
          <el-menu-item index="/finance/profit">经营利润</el-menu-item>
          <el-menu-item index="/finance/receipts">收款管理</el-menu-item>
          <el-menu-item index="/finance/payments">付款管理</el-menu-item>
          <el-menu-item index="/finance/receivables-payables">应收应付</el-menu-item>
          <el-menu-item index="/finance/expenses">费用管理</el-menu-item>
          <el-menu-item index="/finance/reconciliation">对账中心</el-menu-item>
          <el-menu-item index="/finance/dashboard">财务驾驶舱</el-menu-item>
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
          <el-menu-item index="/reports/purchase">采购报表</el-menu-item>
          <el-menu-item index="/reports/sales-analysis">销售分析</el-menu-item>
          <el-menu-item index="/reports/collection-analysis">收款分析</el-menu-item>
          <el-menu-item index="/reports/customers">客户分析</el-menu-item>
          <el-menu-item index="/reports/inventory">库存分析</el-menu-item>
        </el-sub-menu>

        <!-- 11. 营销中心 -->
        <el-sub-menu index="marketing">
          <template #title>
            <el-icon><Present /></el-icon>
            <span>营销中心</span>
          </template>
          <el-menu-item index="/marketing">营销中心</el-menu-item>
          <el-menu-item index="/marketing/tags">营销标签</el-menu-item>
          <el-menu-item index="/marketing/limited-discount">限时折扣</el-menu-item>
          <el-menu-item index="/marketing/gift-rule">满赠管理</el-menu-item>
          <el-menu-item index="/marketing/points-mall">积分商城</el-menu-item>
          <el-menu-item index="/marketing/dashboard">营销看板</el-menu-item>
          <el-menu-item index="/marketing/materials">素材库</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/aftersale">售后管理</el-menu-item>

        <!-- 12. 系统设置（含门店管理） -->
        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </template>
          <el-menu-item index="/employees">员工管理</el-menu-item>
          <el-menu-item index="/stores">门店管理</el-menu-item>
          <el-menu-item index="/system/roles">角色权限</el-menu-item>
          <el-menu-item index="/audit-log">操作日志</el-menu-item>
          <el-menu-item index="/error-log">错误日志</el-menu-item>
          <el-menu-item index="/system/config">参数配置</el-menu-item>
          <el-menu-item index="/system/approval/rules">审批规则</el-menu-item>
          <el-menu-item index="/system/approval/my">我的申请</el-menu-item>
          <el-menu-item index="/system/payment">支付配置</el-menu-item>
          <el-menu-item index="/system/miniapp">小程序配置</el-menu-item>
          <el-menu-item index="/monitor">监控告警</el-menu-item>
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
            v-if="!isCashierUser"
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
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { HomeFilled, Goods, Document, ShoppingCart, Box, User, Files, Shop, Coin, Present, DataAnalysis, Setting, Expand, Fold, Bell, Grid, ChatDotRound } from "@element-plus/icons-vue";
import { formatDate } from "../utils/format";

const route = useRoute();
const router = useRouter();

const isMenuCollapsed = ref(false);
const isCashierMode = ref(false);
const pageLoading = ref(false);
const currentUser = ref<any>(null);

const isCashierUser = computed(() => {
  return currentUser.value?.role === "CASHIER";
});

onMounted(() => {
  try {
    const raw = localStorage.getItem("admin_user");
    if (raw) {
      currentUser.value = JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  if (currentUser.value?.role === "CASHIER") {
    isCashierMode.value = true;
    isMenuCollapsed.value = true;
  }
});

const activeMenu = computed(() => route.path);

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    "/dashboard": "工作总台",
    "/todo-list": "待办提醒",
    "/quick-entries": "快捷入口",
    "/messages": "消息中心",
    "/sales/create": "销售开单",
    "/sale-bills": "销售单据",
    "/sale-returns": "销售退货",
    "/collection": "收款管理",
    "/sales/collection-links": "分享链接",
    "/sales/customer-prices": "价格策略",
    "/sales/commission/rules": "提成规则",
    "/sales/commission/records": "提成记录",
    "/sales/reports": "销售报表",
    "/orders": "订单列表",
    "/order-board": "泳道看板",
    "/order-timeout": "超时处理",
    "/order-center": "全渠道订单聚合",
    "/order-routing": "订单分发与路由",
    "/order-sync": "订单状态同步",
    "/order-exception": "订单异常处理",
    "/order-product-map": "全渠道商品映射",
    "/order-aftersale": "订单售后聚合",
    "/purchase-orders": "采购订单",
    "/purchase-in-stocks": "采购入库",
    "/purchase-returns": "采购退货",
    "/purchase/supplier-statements": "供应商对账",
    "/purchase/plans": "采购计划",
    "/purchase-payments": "采购付款",
    "/suppliers": "供应商",
    "/inventory": "库存查询",
    "/inventory-check": "库存盘点",
    "/inventory-transfer": "库存调拨",
    "/inventory-batch": "批次追溯",
    "/inventory-alerts": "库存预警",
    "/inventory-cost": "成本核算",
    "/inventory-alert-config": "预警配置",
    "/inventory-reports": "库存报表",
    "/customers": "客户列表",
    "/credit": "授信管理",
    "/points-rules": "积分规则",
    "/level-config": "等级配置",
    "/store-value-cards": "储值卡",
    "/member-system": "会员体系",
    "/customer-tags": "客户标签",
    "/customer-profile": "客户画像",
    "/customer-care": "关怀规则",
    "/customer-lifecycle": "生命周期",
    "/customer-segments": "客户分群",
    "/products": "商品列表",
    "/products/categories": "商品分类",
    "/products/brands": "品牌管理",
    "/products/units": "单位管理",
    "/products/import": "商品导入",
    "/products/tags": "商品标签",
    "/products/tag-groups": "标签分组",
    "/products/tag-relation": "标签关联",
    "/prices": "价格管理",
    "/payments": "资金流水",
    "/finance/collection": "收款链接",
    "/customer-statements": "客户对账",
    "/finance/profit": "经营利润",
    "/finance/receipts": "收款管理",
    "/finance/payments": "付款管理",
    "/finance/receivables-payables": "应收应付",
    "/finance/expenses": "费用管理",
    "/finance/reconciliation": "对账中心",
    "/finance/dashboard": "财务驾驶舱",
    "/reports": "销售统计",
    "/reports/products": "商品排行",
    "/reports/employees": "员工业绩",
    "/reports/stores": "门店对比",
    "/reports/purchase": "采购报表",
    "/reports/sales-analysis": "销售分析",
    "/reports/collection-analysis": "收款分析",
    "/reports/customers": "客户分析",
    "/reports/inventory": "库存分析",
    "/marketing": "营销中心",
    "/marketing/tags": "营销标签",
    "/marketing/limited-discount": "限时折扣",
    "/marketing/gift-rule": "满赠管理",
    "/marketing/points-mall": "积分商城",
    "/marketing/dashboard": "营销看板",
    "/marketing/materials": "素材库",
    "/aftersale": "售后管理",
    "/employees": "员工管理",
    "/stores": "门店管理",
    "/system/roles": "角色权限",
    "/audit-log": "操作日志",
    "/error-log": "错误日志",
    "/system": "系统配置",
    "/system/config": "参数配置",
    "/system/approval/rules": "审批规则",
    "/system/approval/detail": "审批详情",
    "/system/approval/my": "我的申请",
    "/system/payment": "支付配置",
      "/system/miniapp": "小程序配置",
      "/monitor": "监控告警",
      "/instant-retail/config": "小程序配置",
    "/instant-retail/shelf": "商品货架",
    "/instant-retail/orders": "小程序订单",
    "/instant-retail/payment": "在线支付",
    "/instant-retail/delivery": "配送管理",
    "/instant-retail/report": "零售报表",
    "/instant-retail/platform": "平台对接",
    "/instant-retail/order-board": "接单工作台"
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
