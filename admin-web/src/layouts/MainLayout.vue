<template>
  <div class="layout" :class="{ 'is-cashier': isCashierMode, 'side-collapsed': isMenuCollapsed && !isCashierMode }">
    <!-- 通栏顶栏（横跨全宽：门店 · 面包屑 | 搜索 · 后台/收银切换 · 通知 · 用户） -->
    <header class="global-header">
      <div class="header-left">
        <!-- 门店信息（对标设计稿：门店名 · 营业状态） -->
        <div class="store-status">
          <span class="store-status-dot"></span>
          <span class="store-name">{{ storeDisplayName }}</span>
          <span class="store-state">营业中</span>
        </div>
        <el-tag v-if="currentUser?.demo" size="small" type="warning" effect="light" class="demo-mode-tag">
          演示模式
        </el-tag>
        <span class="breadcrumb">{{ isCashierMode ? "快速收银台" : pageTitle }}</span>
      </div>
      <div class="header-right">
        <div v-if="!isCashierMode" class="header-search">
          <el-icon><Search /></el-icon>
          <span>搜索商品、订单...</span>
          <kbd>⌘K</kbd>
        </div>

        <!-- 工作台 / 收银台 模式切换（对标设计稿） -->
        <div class="mode-switch">
          <span
            class="mode-switch-item"
            :class="{ active: !isCashierMode }"
            @click="exitCashierMode"
          >工作台</span>
          <span
            class="mode-switch-item"
            :class="{ active: isCashierMode }"
            @click="toggleCashierMode"
          >收银台</span>
        </div>

        <!-- 真实通知：未读数 + 最近通知 -->
        <el-popover v-if="!isCashierMode" v-model:visible="notifyVisible" placement="bottom-end" :width="330" trigger="click" popper-class="notify-popper">
          <template #reference>
            <el-badge :value="notifyCount" :max="99" :hidden="notifyCount === 0" class="header-badge">
              <el-button circle size="small">
                <el-icon><Bell /></el-icon>
              </el-button>
            </el-badge>
          </template>
          <div class="notify-pop">
            <div class="notify-head">
              <span class="notify-title">消息通知</span>
              <el-link type="primary" :underline="false" @click="goMessages">全部消息</el-link>
            </div>
            <div v-if="notifyList.length === 0" class="notify-empty">暂无通知</div>
            <div v-else class="notify-list">
              <div v-for="n in notifyList.slice(0, 6)" :key="n.id" class="notify-item" @click="goMessages">
                <div class="notify-item-head">
                  <span class="notify-dot" :class="{ unread: !n.isRead }"></span>
                  <span class="notify-item-title">{{ n.title || "系统通知" }}</span>
                </div>
                <div class="notify-item-desc">{{ n.content || "" }}</div>
                <div class="notify-item-time">{{ formatNotifyTime(n.sentAt || n.createdAt) }}</div>
              </div>
            </div>
          </div>
        </el-popover>
        <el-dropdown trigger="click">
          <span class="user-info">
            <el-avatar :size="28" class="user-avatar-icon" style="background: var(--color-primary)">
              <el-icon><User /></el-icon>
            </el-avatar>
            <span class="user-name">{{ currentUser?.realName || "管理员" }}</span>
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

    <!-- 侧边栏：深色磨砂 + 胶囊导航 -->
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header" :title="isMenuCollapsed ? '展开导航' : '收起导航'" @click="isMenuCollapsed = !isMenuCollapsed">
        <div class="sidebar-logo">
          <img class="sidebar-logo-img" src="@/assets/logo.png" alt="智享全链" />
          <h1 v-show="!isMenuCollapsed">智享全链</h1>
        </div>
      </div>

      <!-- 自定义胶囊导航（按产品规划v6.1的12个一级模块顺序） -->
      <nav class="sidebar-nav">
        <!-- 1. 工作台 -->
        <div class="nav-group">
          <div class="nav-item" :class="{ active: isActive('/dashboard') }" @click="navTo('/dashboard')">
            <el-icon class="nav-icon"><HomeFilled /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">工作台</span>
          </div>
        </div>

        <!-- 业务 -->
        <div v-show="!isMenuCollapsed" class="nav-section-label">业务</div>

        <!-- 2. 订单管理（设计稿业务分组第一位） -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.orders }" @click="toggleGroup('orders')">
            <el-icon class="nav-icon"><Document /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">订单管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.orders && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/orders') }" @click="navTo('/orders')">订单列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-board') }" @click="navTo('/order-board')">订单看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-aftersale') }" @click="navTo('/order-aftersale')">订单售后</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-exception') }" @click="navTo('/order-exception')">订单异常</div>
          </div>
        </div>

        <!-- 3. 销售管理 -->
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
            <div class="nav-sub-item" :class="{ active: isActive('/sales/customer-prices') }" @click="navTo('/sales/customer-prices')">客户价格</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/commission/rules') }" @click="navTo('/sales/commission/rules')">提成规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/reports') }" @click="navTo('/sales/reports')">销售报表</div>
          </div>
        </div>

        <!-- 4. 商品中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.products }" @click="toggleGroup('products')">
            <el-icon class="nav-icon"><Goods /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">商品中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.products && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/products') }" @click="navTo('/products')">商品列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/categories') }" @click="navTo('/products/categories')">商品分类</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/brands') }" @click="navTo('/products/brands')">品牌管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/prices') }" @click="navTo('/prices')">价格管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/import') }" @click="navTo('/products/import')">商品导入</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/combo') }" @click="navTo('/products/combo')">套装与组合品</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/reviews') }" @click="navTo('/products/reviews')">商品审核</div>
          </div>
        </div>

        <!-- 4. 库存中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.inventory }" @click="toggleGroup('inventory')">
            <el-icon class="nav-icon"><Files /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">库存中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.inventory && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/inventory') }" @click="navTo('/inventory')">库存查询</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-check') }" @click="navTo('/inventory-check')">库存盘点</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-transfer') }" @click="navTo('/inventory-transfer')">库存调拨</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-alerts') }" @click="navTo('/inventory-alerts')">库存预警</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-batch-price') }" @click="navTo('/inventory-batch-price')">批量调价</div>
          </div>
        </div>

        <!-- 5. 客户会员 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.customers }" @click="toggleGroup('customers')">
            <el-icon class="nav-icon"><User /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">客户会员</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.customers && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/customers') }" @click="navTo('/customers')">客户列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/member-system') }" @click="navTo('/member-system')">会员体系</div>
            <div class="nav-sub-item" :class="{ active: isActive('/store-value-cards') }" @click="navTo('/store-value-cards')">储值卡</div>
            <div class="nav-sub-item" :class="{ active: isActive('/credit') }" @click="navTo('/credit')">信用管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/points-rules') }" @click="navTo('/points-rules')">积分规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/level-config') }" @click="navTo('/level-config')">等级配置</div>
          </div>
        </div>

        <!-- 6. 财务中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.finance }" @click="toggleGroup('finance')">
            <el-icon class="nav-icon"><Money /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">财务中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.finance && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/payments') }" @click="navTo('/payments')">收付款管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/receivables-payables') }" @click="navTo('/finance/receivables-payables')">应收应付</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-statements') }" @click="navTo('/customer-statements')">客户对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/reconciliation') }" @click="navTo('/finance/reconciliation')">财务对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/profit') }" @click="navTo('/finance/profit')">利润核算</div>
            <div class="nav-sub-item" :class="{ active: isActive('/fund-report') }" @click="navTo('/fund-report')">资金报表</div>
          </div>
        </div>

        <!-- 功能 -->
        <div v-show="!isMenuCollapsed" class="nav-section-label">功能</div>

        <!-- 7. 采购管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.purchase }" @click="toggleGroup('purchase')">
            <el-icon class="nav-icon"><Van /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">采购管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.purchase && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-orders') }" @click="navTo('/purchase-orders')">采购订单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-in-stocks') }" @click="navTo('/purchase-in-stocks')">采购入库</div>
            <div class="nav-sub-item" :class="{ active: isActive('/suppliers') }" @click="navTo('/suppliers')">供应商管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-payments') }" @click="navTo('/purchase-payments')">采购付款</div>
          </div>
        </div>

        <!-- 8. 即时零售 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.instant }" @click="toggleGroup('instant')">
            <el-icon class="nav-icon"><Shop /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">即时零售</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.instant && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/config') }" @click="navTo('/instant-retail/config')">平台配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/pickup') }" @click="navTo('/instant-retail/pickup')">接单工作台</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/orders') }" @click="navTo('/instant-retail/orders')">小程序订单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/order-board') }" @click="navTo('/instant-retail/order-board')">订单看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/shelf') }" @click="navTo('/instant-retail/shelf')">商品货架</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/sync') }" @click="navTo('/instant-retail/sync')">库存同步</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/delivery') }" @click="navTo('/instant-retail/delivery')">配送管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/platform') }" @click="navTo('/instant-retail/platform')">平台管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/payment') }" @click="navTo('/instant-retail/payment')">平台对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/announcements') }" @click="navTo('/instant-retail/announcements')">平台公告</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/dashboard') }" @click="navTo('/instant-retail/dashboard')">零售看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/instant-retail/report') }" @click="navTo('/instant-retail/report')">零售报表</div>
          </div>
        </div>

        <!-- 9. 营销中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.marketing }" @click="toggleGroup('marketing')">
            <el-icon class="nav-icon"><Discount /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">营销中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.marketing && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/marketing') }" @click="navTo('/marketing')">营销活动</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/coupon') }" @click="navTo('/marketing/coupon')">优惠券管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/limited-discount') }" @click="navTo('/marketing/limited-discount')">限时折扣</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/flash-sale') }" @click="navTo('/marketing/flash-sale')">秒杀活动</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/full-reduction') }" @click="navTo('/marketing/full-reduction')">满减满赠</div>
            <div class="nav-sub-item" :class="{ active: isActive('/aftersale') }" @click="navTo('/aftersale')">售后管理</div>
          </div>
        </div>

        <!-- 10. 数据报表 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.reports }" @click="toggleGroup('reports')">
            <el-icon class="nav-icon"><DataAnalysis /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">数据报表</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.reports && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/reports') }" @click="navTo('/reports')">销售统计</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/sales-analysis') }" @click="navTo('/reports/sales-analysis')">销售分析</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/products') }" @click="navTo('/reports/products')">商品排行</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/employees') }" @click="navTo('/reports/employees')">员工业绩</div>
          </div>
        </div>

        <!-- 系统 -->
        <div v-show="!isMenuCollapsed" class="nav-section-label">系统</div>

        <!-- 11. 系统设置 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.system }" @click="toggleGroup('system')">
            <el-icon class="nav-icon"><Setting /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">系统设置</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.system && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/organization') }" @click="navTo('/organization')">组织架构</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/config') }" @click="navTo('/system/config')">系统配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/print') }" @click="navTo('/system/print')">打印模板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/approval/manage') }" @click="navTo('/system/approval/manage')">审批管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/report-permissions') }" @click="navTo('/report-permissions')">报表权限</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/payment') }" @click="navTo('/system/payment')">支付配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/miniapp') }" @click="navTo('/system/miniapp')">小程序配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/monitor-manage') }" @click="navTo('/monitor-manage')">日志与反馈</div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main v-loading="pageLoading" class="main">
      <!-- 收银台模式 -->
      <div v-if="isCashierMode" class="cashier-container">
        <!-- 功能导航栏（对标移动端功能中心：收银/单据/挂单/交班/退货/会员等一级入口） -->
        <nav class="cashier-nav">
          <div
            v-for="item in cashierNavItems"
            :key="item.path"
            class="cashier-nav-item"
            :class="{ active: isCashierNavActive(item.path) }"
            @click="handleCashierNavClick(item)"
          >
            <el-icon class="cashier-nav-icon"><component :is="item.icon" /></el-icon>
            <span class="cashier-nav-label">{{ item.label }}</span>
          </div>
        </nav>
        <div class="cashier-main">
          <router-view v-if="isCashierMode" />
        </div>
      </div>

      <!-- 常规内容 -->
      <div v-else class="page-content">
        <el-alert
          v-if="isMockPage"
          type="warning"
          :closable="false"
          show-icon
          class="mock-page-alert"
        >
          <template #title>
            功能建设中：当前页面为演示占位数据，正在接入真实业务数据，暂不建议用于正式经营
          </template>
        </el-alert>
        <router-view />
      </div>
    </main>

    <!-- 最右侧固定整栏 AI 经营助手（非收银台模式显示） -->
    <!-- 全屏页面（如打印设计器）隐藏 AI 面板，让画布占满工作区 -->
    <AiSidePanel v-if="!isCashierMode && !route.meta.fullscreen" />

    <!-- 本机打印设置（收银台导航入口） -->
    <PrintSettingsPanel v-model="printSettingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref } from "vue";
import { checkWebUpdate } from "../modules/update/checker";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  HomeFilled, Goods, Document, ShoppingCart, User, Files, Shop,
  DataAnalysis, Setting, Bell, Grid, ChatDotRound, Search,
  ArrowDown, CaretBottom, Money, Discount, Van,
  Edit, FolderOpened, Clock, RefreshRight, Share, Checked, Printer
} from "@element-plus/icons-vue";
import { formatDate } from "../utils/format";
import { useAuthStore } from "../stores/auth";
import { api } from "../api";
import PrintSettingsPanel from "../modules/print/PrintSettingsPanel.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** 尚为 mock 演示数据的页面（商用化接入中，标识提示） */
const MOCK_PAGES: string[] = [];
const isMockPage = computed(() => MOCK_PAGES.some((p) => route.path === p || route.path.startsWith(p + "/")));

/** 收银台模式功能导航（一级入口，对应 /pos/* 版块） */
const cashierNavItems = [
  { path: "/pos/cashier", label: "快速收银", icon: Edit },
  { path: "/pos/sale-bills", label: "销售单据", icon: Document },
  { path: "/pos/hold-order", label: "挂单管理", icon: FolderOpened },
  { path: "/pos/shift", label: "交接班", icon: Clock },
  { path: "/pos/sale-return", label: "销售退货", icon: RefreshRight },
  { path: "/pos/member", label: "会员识别", icon: User },
  { path: "/pos/collection", label: "分享收款", icon: Share },
  { path: "/pos/daily-settle", label: "日结管理", icon: Checked },
  { path: "/pos/print-settings", label: "打印设置", icon: Printer, action: "print-settings" }
];

/** 本机打印设置弹窗 */
const printSettingsVisible = ref(false);

/** 收银台功能导航点击：打印设置为本地弹窗，其余路由跳转 */
function handleCashierNavClick(item: { path: string; action?: string }) {
  if (item.action === "print-settings") {
    printSettingsVisible.value = true;
    return;
  }
  navTo(item.path);
}

/** 判断功能导航高亮：路由前缀匹配（含详情页如 /pos/shift/:id） */
function isCashierNavActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const AiSidePanel = defineAsyncComponent(
  () => import("../components/AiChat/AiSidePanel.vue"),
);

const isMenuCollapsed = ref(false);
const pageLoading = ref(false);
const notifyVisible = ref(false);
const notifyCount = ref(0);
const notifyList = ref<any[]>([]);
const currentUser = computed(() => auth.user);
/** 收银台模式：由路由驱动（/pos/*），刷新后状态不丢失 */
const isCashierMode = computed(() => route.path.startsWith("/pos/"));

/** 门店显示名：优先当前用户门店，无则默认 */
const storeDisplayName = computed(() => {
  const u: any = currentUser.value;
  return u?.storeName || u?.store?.name || "智享全链";
});

const openGroups = reactive({
  sales: false,
  orders: false,
  inventory: false,
  products: false,
  customers: false,
  finance: false,
  purchase: false,
  instant: false,
  marketing: false,
  reports: false,
  system: true,
});

const isCashierUser = computed(() => {
  return currentUser.value?.roles?.includes("CASHIER") ?? false;
});

onMounted(() => {
  // 启动检查更新（有新版本提示刷新）
  checkWebUpdate();
  const path = route.path;
  // 2. 销售管理
  if (path.startsWith('/sales') || path.startsWith('/sale-') || path.startsWith('/collection')) openGroups.sales = true;
  // 3. 订单管理
  if (path.startsWith('/order')) openGroups.orders = true;
  // 4. 商品中心
  if (path.startsWith('/products') || path.startsWith('/prices')) openGroups.products = true;
  // 4. 库存中心
  if (path.startsWith('/inventory')) openGroups.inventory = true;
  // 5. 客户会员
  if (path.startsWith('/customers') || path.startsWith('/member') || path.startsWith('/store-value') || path.startsWith('/credit') || path.startsWith('/points') || path.startsWith('/level') || path.startsWith('/customer-')) openGroups.customers = true;
  // 6. 财务中心
  if (path.startsWith('/finance') || path.startsWith('/payments') || path.startsWith('/customer-statements') || path.startsWith('/bank-accounts') || path.startsWith('/fund-report') || path.startsWith('/bill-management')) openGroups.finance = true;
  // 7. 采购管理
  if (path.startsWith('/purchase') || path.startsWith('/suppliers')) openGroups.purchase = true;
  // 8. 即时零售
  if (path.startsWith('/instant-retail')) openGroups.instant = true;
  // 9. 营销中心
  if (path.startsWith('/marketing') || path.startsWith('/aftersale')) openGroups.marketing = true;
  // 10. 数据报表
  if (path.startsWith('/reports')) openGroups.reports = true;
  // 11. 系统设置
  if (path.startsWith('/system') || path.startsWith('/employees') || path.startsWith('/stores') || path.startsWith('/department-manage') || path.startsWith('/position-manage') || path.startsWith('/audit') || path.startsWith('/error-log') || path.startsWith('/monitor') || path.startsWith('/report-permissions')) openGroups.system = true;
  loadNotifications();
  // 每 60 秒刷新通知
  window.setInterval(loadNotifications, 60000);
});

function isActive(path: string): boolean {
  return route.path === path;
}

function navTo(path: string) {
  // 收起态点击主菜单：先展开导航再跳转
  if (isMenuCollapsed.value) {
    isMenuCollapsed.value = false;
  }
  router.push(path);
}

/** 加载真实通知：未读数 + 最近通知列表 */
async function loadNotifications() {
  try {
    const [uc, list] = await Promise.allSettled([
      api.get("/admin/wb-notifications/unread-count"),
      api.get("/admin/wb-notifications", { params: { page: 1, pageSize: 6 } }),
    ]);
    if (uc.status === "fulfilled") {
      const d = uc.value.data?.data ?? uc.value.data ?? {};
      notifyCount.value = typeof d === "object" ? Number(d.count ?? d.total ?? 0) : Number(d || 0);
    }
    if (list.status === "fulfilled") {
      const d = list.value.data?.data ?? list.value.data ?? {};
      notifyList.value = d.records || d.list || [];
    }
  } catch { /* 忽略 */ }
}

function goMessages() {
  notifyVisible.value = false;
  navTo("/messages");
}

function formatNotifyTime(v: any): string {
  if (!v) return "";
  const d = new Date(String(v).replace("T", " ").replace("Z", "").trim().slice(0, 19));
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toggleGroup(group: keyof typeof openGroups) {
  // 收起态点击主菜单：先展开导航并直接打开该分组
  if (isMenuCollapsed.value) {
    isMenuCollapsed.value = false;
    openGroups[group] = true;
    return;
  }
  openGroups[group] = !openGroups[group];
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    // 1. 工作总台
    "/dashboard": "工作总台",
    "/todo-list": "待办提醒",
    "/quick-entries": "快捷入口",
    "/messages": "消息中心",
    // 2. 销售管理
    "/sales/create": "销售开单",
    "/sale-bills": "销售单据",
    "/sale-returns": "销售退货",
    "/collection": "收款管理",
    "/sales/collection-links": "收款关联",
    "/sales/customer-prices": "客户价格",
    "/sales/commission/rules": "提成规则",
    "/sales/commission/records": "提成记录",
    "/sales/reports": "销售报表",
    // 3. 订单管理
    "/orders": "订单列表",
    "/order-board": "订单看板",
    "/order-timeout": "订单超时",
    "/order-center": "订单中心",
    "/order-routing": "订单路由",
    "/order-sync": "订单同步",
    "/order-exception": "订单异常",
    "/order-product-map": "订单商品映射",
    "/order-aftersale": "订单售后",
    // 4. 采购管理
    "/purchase-orders": "采购订单",
    "/purchase-in-stocks": "采购入库",
    "/purchase-returns": "采购退货",
    "/purchase-contracts": "采购合同",
    "/suppliers": "供应商管理",
    "/purchase/supplier-statements": "供应商对账",
    "/purchase/plans": "采购计划",
    "/purchase-payments": "采购付款",
    // 5. 库存管理
    "/inventory": "库存查询",
    "/inventory-check": "库存盘点",
    "/inventory-transfer": "库存调拨",
    "/inventory-batch": "库存批次",
    "/inventory-share-config": "库存共享设置",
    "/inventory-batch-price": "批量调价",
    "/inventory-price-quote": "报价管理",
    "/inventory-cost": "库存成本",
    "/inventory-alerts": "库存预警",
    "/inventory-alert-config": "预警配置",
    "/inventory-reports": "库存报表",
    // 6. 客户管理
    "/customers": "客户列表",
    "/member-system": "会员体系",
    "/store-value-cards": "储值卡",
    "/customer-tags": "客户标签",
    "/customer-profile": "客户画像",
    "/customer-care": "客户关怀",
    "/customer-visits": "拜访记录",
    "/customer-lifecycle": "客户生命周期",
    "/customer-segments": "客户分群",
    "/credit": "信用管理",
    "/points-rules": "积分规则",
    "/level-config": "等级配置",
    // 7. 商品中心
    "/products": "商品列表",
    "/products/categories": "商品分类",
    "/products/brands": "品牌管理",
    "/products/units": "单位管理",
    "/products/import": "商品导入",
    "/products/tags": "商品标签",
    "/products/tag-groups": "标签分组",
    "/products/tag-relation": "标签关联",
    "/products/reviews": "商品审核",
    "/products/review-workflow": "审核流程配置",
    "/products/review-tasks": "审核任务",
    "/products/review-delegation": "审核委托",
    "/products/combo": "套装与组合品",
    "/prices": "价格管理",
    // 8. 即时零售
    "/instant-retail/config": "平台配置",
    "/instant-retail/pickup": "接单工作台",
    "/instant-retail/orders": "小程序订单",
    "/instant-retail/order-board": "订单看板",
    "/instant-retail/shelf": "商品货架",
    "/instant-retail/sync": "库存同步",
    "/instant-retail/delivery": "配送管理",
    "/instant-retail/platform": "平台管理",
    "/instant-retail/payment": "平台对账",
    "/instant-retail/announcements": "平台公告",
    "/instant-retail/dashboard": "零售看板",
    "/instant-retail/report": "零售报表",
    // 9. 财务往来
    "/payments": "收付款管理",
    "/finance/receipts": "收款单",
    "/finance/payments": "付款单",
    "/finance/collection": "回款管理",
    "/customer-statements": "客户对账",
    "/finance/receivables-payables": "应收应付",
    "/finance/profit": "利润核算",
    "/finance/expenses": "费用管理",
    "/finance/reconciliation": "财务对账",
    "/finance/dashboard": "财务看板",
    "/bank-accounts": "银行账户管理",
    "/fund-report": "资金报表",
    "/bill-management": "票据管理",
    // 10. 数据报表
    "/reports": "销售统计",
    "/reports/sales-analysis": "销售分析",
    "/reports/collection-analysis": "回款分析",
    "/reports/products": "商品排行",
    "/reports/purchase": "采购报表",
    "/reports/stores": "门店报表",
    "/reports/customers": "客户分析",
    "/reports/inventory": "库存报表",
    "/reports/transfer": "调拨统计",
    "/reports/custom-report": "自定义报表",
    "/reports/employees": "员工业绩",
    "/reports/online-payment": "在线收款分析",
    // 11. 营销中心
    "/marketing": "营销活动",
    "/marketing/tags": "营销标签",
    "/marketing/coupon": "优惠券管理",
    "/marketing/limited-discount": "限时折扣",
    "/marketing/flash-sale": "秒杀活动",
    "/marketing/full-reduction": "满减满赠",
    "/marketing/gift-rule": "赠品规则",
    "/marketing/points-mall": "积分商城",
    "/marketing/dashboard": "营销看板",
    "/marketing/materials": "营销素材",
    "/aftersale": "售后管理",
    // 12. 系统设置
    "/department-manage": "部门管理",
    "/position-manage": "岗位管理",
    "/employees": "员工管理",
    "/stores": "门店管理",
    "/system/roles": "角色权限",
    "/system/config": "系统配置",
    "/system/approval/rules": "审批规则",
    "/system/approval/my": "我的审批",
    "/report-permissions": "报表权限",
    "/system/payment": "支付配置",
    "/system/miniapp": "小程序配置",
    "/monitor": "系统监控",
    "/system/feedback": "反馈管理",
    "/audit-log": "操作日志",
    "/error-log": "错误日志",
  };
  return titles[route.path] || "智享全链管理系统";
});

function toggleCashierMode() {
  // 工作台 → 收银台
  isMenuCollapsed.value = true;
  router.push("/pos/cashier");
}

function exitCashierMode() {
  // 收银台 → 工作台
  isMenuCollapsed.value = false;
  router.push("/dashboard");
}

function handleLogout() {
  auth.clearAuth();
  ElMessage.success("已退出登录");
  router.push("/login");
}
</script>

<style scoped>
.mock-page-alert {
  margin-bottom: 16px;
}

.layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr auto;
  grid-template-rows: var(--topbar-height) 1fr;
  min-height: 100vh;
  background: var(--bg-page);
}
.layout.side-collapsed {
  grid-template-columns: var(--sidebar-width-collapsed) 1fr auto;
}

/* 收银台模式：侧栏与 AI 面板隐藏，内容占满 */
.layout.is-cashier {
  grid-template-columns: 1fr;
  grid-template-rows: var(--topbar-height) 1fr;
}
.layout.is-cashier .main {
  grid-column: 1;
  grid-row: 2;
}

/* 通栏顶栏：横跨全宽 */
.global-header {
  grid-column: 1 / -1;
  grid-row: 1;
  height: var(--topbar-height);
  background: #ffffff;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 60;
}

/* ========== 侧边栏：深色磨砂 ========== */
.side {
  grid-row: 2;
  width: var(--sidebar-width);
  box-sizing: border-box;
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
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 200ms ease;
}
.sidebar-header:hover {
  background: rgba(0, 0, 0, 0.03);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.sidebar-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
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

/* ========== 胶囊导航 ========== */
.sidebar-nav {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 导航分组标签（业务/功能/系统） */
.nav-section-label {
  font-size: 11px;
  color: var(--text-placeholder);
  padding: 10px 12px 4px;
  letter-spacing: 1px;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: rgba(0, 0, 0, 0.04);
}

.nav-item.active {
  background: var(--color-primary-soft);
  color: var(--sidebar-text-active);
  font-weight: 500;
}

.nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--color-primary);
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
  position: absolute;
  right: 8px;
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
  position: relative;
  transition: all 200ms ease;
}

.nav-sub-item:hover {
  color: var(--sidebar-text-primary);
  background: rgba(0, 0, 0, 0.04);
}

.nav-sub-item.active {
  color: var(--sidebar-text-active);
  background: var(--color-primary-soft);
  font-weight: 500;
}

.nav-sub-item.active::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--color-primary);
}

/* ========== 主内容区 ========== */
.main {
  grid-row: 2;
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

/* 门店信息（R74 对标设计稿） */
.store-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 16px;
  margin-right: 16px;
  border-right: 1px solid var(--border-light);
}

.demo-mode-tag {
  margin-left: 4px;
  border-radius: 999px;
  padding: 0 10px;
  flex-shrink: 0;
}

.store-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

.store-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.store-state {
  font-size: 12px;
  color: var(--color-success);
  background: var(--color-success-soft);
  padding: 2px 8px;
  border-radius: 4px;
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
  gap: 16px;
}

/* 工作台 / 收银台 模式切换 */
.mode-switch {
  display: flex;
  background: var(--bg-soft);
  border-radius: 6px;
  padding: 2px;
}
.mode-switch-item {
  font-size: 13px;
  padding: 5px 16px;
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 160ms ease;
}
.mode-switch-item.active {
  background: #ffffff;
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-xs);
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
.notify-pop {
  display: flex;
  flex-direction: column;
}
.notify-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}
.notify-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}
.notify-empty {
  padding: 20px 0;
  text-align: center;
  color: var(--text-placeholder);
  font-size: 13px;
}
.notify-list {
  max-height: 320px;
  overflow-y: auto;
}
.notify-item {
  padding: 10px 2px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.notify-item:last-child {
  border-bottom: none;
}
.notify-item:hover {
  background: var(--bg-soft);
}
.notify-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.notify-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gray-300);
  flex-shrink: 0;
}
.notify-dot.unread {
  background: var(--color-primary);
}
.notify-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.notify-item-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.notify-item-time {
  font-size: 11px;
  color: var(--text-placeholder);
  margin-top: 4px;
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

.user-avatar-icon {
  color: #fff;
}

.user-avatar-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

/* 页面内容区 */
.page-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}

/* 收银台模式 */
.cashier-container {
  flex: 1;
  display: flex;
  flex-direction: row;
  background: var(--bg-page);
}

/* 收银台功能导航栏：最左侧竖排 */
.cashier-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: 76px;
  padding: 12px 8px;
  margin: 10px 0 10px 10px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
  overflow-y: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.cashier-nav::-webkit-scrollbar {
  display: none;
}
.cashier-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 4px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 150ms ease;
  user-select: none;
}
.cashier-nav-item:hover {
  background: var(--gray-50);
  color: var(--text-primary);
}
.cashier-nav-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.cashier-nav-icon {
  font-size: 15px;
}

.cashier-main {
  flex: 1;
  overflow: auto;
}
</style>
