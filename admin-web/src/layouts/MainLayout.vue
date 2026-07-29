<template>
  <div class="layout">
    <!-- 侧边栏：深色磨砂 + 胶囊导航 -->
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">智</div>
          <h1 v-show="!isMenuCollapsed">智享全链</h1>
          <h1 v-show="isMenuCollapsed" class="logo-text-collapsed">智</h1>
        </div>
        <el-button
          v-if="!isMenuCollapsed"
          class="collapse-btn"
          :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
          size="small"
          text
          @click="isMenuCollapsed = !isMenuCollapsed"
        />
      </div>

      <!-- 自定义胶囊导航（按产品规划v6.1的12个一级模块顺序） -->
      <nav class="sidebar-nav">
        <!-- 1. 工作总台 -->
        <div class="nav-group">
          <div
            class="nav-item"
            :class="{ active: isActive('/dashboard') }"
            @click="navTo('/dashboard')"
          >
            <el-icon class="nav-icon"><HomeFilled /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">工作总台</span>
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

        <!-- 2. 销售管理 -->
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
            <div class="nav-sub-item" :class="{ active: isActive('/sales/collection-links') }" @click="navTo('/sales/collection-links')">收款关联</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/customer-prices') }" @click="navTo('/sales/customer-prices')">客户价格</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/commission/rules') }" @click="navTo('/sales/commission/rules')">提成规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/commission/records') }" @click="navTo('/sales/commission/records')">提成记录</div>
            <div class="nav-sub-item" :class="{ active: isActive('/sales/reports') }" @click="navTo('/sales/reports')">销售报表</div>
          </div>
        </div>

        <!-- 3. 订单管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.orders }" @click="toggleGroup('orders')">
            <el-icon class="nav-icon"><Document /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">订单管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.orders && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/orders') }" @click="navTo('/orders')">订单列表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-board') }" @click="navTo('/order-board')">订单看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-timeout') }" @click="navTo('/order-timeout')">订单超时</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-center') }" @click="navTo('/order-center')">订单中心</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-routing') }" @click="navTo('/order-routing')">订单路由</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-sync') }" @click="navTo('/order-sync')">订单同步</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-exception') }" @click="navTo('/order-exception')">订单异常</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-product-map') }" @click="navTo('/order-product-map')">订单商品映射</div>
            <div class="nav-sub-item" :class="{ active: isActive('/order-aftersale') }" @click="navTo('/order-aftersale')">订单售后</div>
          </div>
        </div>

        <!-- 4. 采购管理（新增） -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.purchase }" @click="toggleGroup('purchase')">
            <el-icon class="nav-icon"><Van /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">采购管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.purchase && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-orders') }" @click="navTo('/purchase-orders')">采购订单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-in-stocks') }" @click="navTo('/purchase-in-stocks')">采购入库</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-returns') }" @click="navTo('/purchase-returns')">采购退货</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-contracts') }" @click="navTo('/purchase-contracts')">采购合同</div>
            <div class="nav-sub-item" :class="{ active: isActive('/suppliers') }" @click="navTo('/suppliers')">供应商管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase/supplier-statements') }" @click="navTo('/purchase/supplier-statements')">供应商对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase/plans') }" @click="navTo('/purchase/plans')">采购计划</div>
            <div class="nav-sub-item" :class="{ active: isActive('/purchase-payments') }" @click="navTo('/purchase-payments')">采购付款</div>
          </div>
        </div>

        <!-- 5. 库存管理 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.inventory }" @click="toggleGroup('inventory')">
            <el-icon class="nav-icon"><Files /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">库存管理</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.inventory && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/inventory') }" @click="navTo('/inventory')">库存查询</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-check') }" @click="navTo('/inventory-check')">库存盘点</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-transfer') }" @click="navTo('/inventory-transfer')">库存调拨</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-batch') }" @click="navTo('/inventory-batch')">库存批次</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-share-config') }" @click="navTo('/inventory-share-config')">库存共享设置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-batch-price') }" @click="navTo('/inventory-batch-price')">批量调价</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-price-quote') }" @click="navTo('/inventory-price-quote')">报价管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-cost') }" @click="navTo('/inventory-cost')">库存成本</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-alerts') }" @click="navTo('/inventory-alerts')">库存预警</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-alert-config') }" @click="navTo('/inventory-alert-config')">预警配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/inventory-reports') }" @click="navTo('/inventory-reports')">库存报表</div>
          </div>
        </div>

        <!-- 6. 客户管理 -->
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
            <div class="nav-sub-item" :class="{ active: isActive('/customer-tags') }" @click="navTo('/customer-tags')">客户标签</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-profile') }" @click="navTo('/customer-profile')">客户画像</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-care') }" @click="navTo('/customer-care')">客户关怀</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-visits') }" @click="navTo('/customer-visits')">拜访记录</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-lifecycle') }" @click="navTo('/customer-lifecycle')">客户生命周期</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-segments') }" @click="navTo('/customer-segments')">客户分群</div>
            <div class="nav-sub-item" :class="{ active: isActive('/credit') }" @click="navTo('/credit')">信用管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/points-rules') }" @click="navTo('/points-rules')">积分规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/level-config') }" @click="navTo('/level-config')">等级配置</div>
          </div>
        </div>

        <!-- 7. 商品中心 -->
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
            <div class="nav-sub-item" :class="{ active: isActive('/products/units') }" @click="navTo('/products/units')">单位管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/import') }" @click="navTo('/products/import')">商品导入</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/tags') }" @click="navTo('/products/tags')">商品标签</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/tag-groups') }" @click="navTo('/products/tag-groups')">标签分组</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/tag-relation') }" @click="navTo('/products/tag-relation')">标签关联</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/reviews') }" @click="navTo('/products/reviews')">商品审核</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/review-workflow') }" @click="navTo('/products/review-workflow')">审核流程配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/review-tasks') }" @click="navTo('/products/review-tasks')">审核任务</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/review-delegation') }" @click="navTo('/products/review-delegation')">审核委托</div>
            <div class="nav-sub-item" :class="{ active: isActive('/products/combo') }" @click="navTo('/products/combo')">套装与组合品</div>
            <div class="nav-sub-item" :class="{ active: isActive('/prices') }" @click="navTo('/prices')">价格管理</div>
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

        <!-- 9. 财务往来 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.finance }" @click="toggleGroup('finance')">
            <el-icon class="nav-icon"><Money /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">财务往来</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.finance && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/payments') }" @click="navTo('/payments')">收付款管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/receipts') }" @click="navTo('/finance/receipts')">收款单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/payments') }" @click="navTo('/finance/payments')">付款单</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/collection') }" @click="navTo('/finance/collection')">回款管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/customer-statements') }" @click="navTo('/customer-statements')">客户对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/receivables-payables') }" @click="navTo('/finance/receivables-payables')">应收应付</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/profit') }" @click="navTo('/finance/profit')">利润核算</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/expenses') }" @click="navTo('/finance/expenses')">费用管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/reconciliation') }" @click="navTo('/finance/reconciliation')">财务对账</div>
            <div class="nav-sub-item" :class="{ active: isActive('/finance/dashboard') }" @click="navTo('/finance/dashboard')">财务看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/bank-accounts') }" @click="navTo('/bank-accounts')">银行账户</div>
            <div class="nav-sub-item" :class="{ active: isActive('/fund-report') }" @click="navTo('/fund-report')">资金报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/bill-management') }" @click="navTo('/bill-management')">票据管理</div>
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
            <div class="nav-sub-item" :class="{ active: isActive('/reports/collection-analysis') }" @click="navTo('/reports/collection-analysis')">回款分析</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/products') }" @click="navTo('/reports/products')">商品排行</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/purchase') }" @click="navTo('/reports/purchase')">采购报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/stores') }" @click="navTo('/reports/stores')">门店报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/customers') }" @click="navTo('/reports/customers')">客户分析</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/inventory') }" @click="navTo('/reports/inventory')">库存报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/transfer') }" @click="navTo('/reports/transfer')">调拨统计</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/custom-report') }" @click="navTo('/reports/custom-report')">自定义报表</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/employees') }" @click="navTo('/reports/employees')">员工业绩</div>
            <div class="nav-sub-item" :class="{ active: isActive('/reports/online-payment') }" @click="navTo('/reports/online-payment')">在线收款分析</div>
          </div>
        </div>

        <!-- 11. 营销中心 -->
        <div class="nav-group">
          <div class="nav-item has-sub" :class="{ open: openGroups.marketing }" @click="toggleGroup('marketing')">
            <el-icon class="nav-icon"><Discount /></el-icon>
            <span v-show="!isMenuCollapsed" class="nav-label">营销中心</span>
            <el-icon v-show="!isMenuCollapsed" class="nav-arrow"><ArrowDown /></el-icon>
          </div>
          <div v-show="openGroups.marketing && !isMenuCollapsed" class="nav-sub">
            <div class="nav-sub-item" :class="{ active: isActive('/marketing') }" @click="navTo('/marketing')">营销活动</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/tags') }" @click="navTo('/marketing/tags')">营销标签</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/coupon') }" @click="navTo('/marketing/coupon')">优惠券管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/limited-discount') }" @click="navTo('/marketing/limited-discount')">限时折扣</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/flash-sale') }" @click="navTo('/marketing/flash-sale')">秒杀活动</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/full-reduction') }" @click="navTo('/marketing/full-reduction')">满减满赠</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/gift-rule') }" @click="navTo('/marketing/gift-rule')">赠品规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/points-mall') }" @click="navTo('/marketing/points-mall')">积分商城</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/dashboard') }" @click="navTo('/marketing/dashboard')">营销看板</div>
            <div class="nav-sub-item" :class="{ active: isActive('/marketing/materials') }" @click="navTo('/marketing/materials')">营销素材</div>
            <div class="nav-sub-item" :class="{ active: isActive('/aftersale') }" @click="navTo('/aftersale')">售后管理</div>
          </div>
        </div>

        <!-- 12. 系统设置 -->
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
            <div class="nav-sub-item" :class="{ active: isActive('/system/config') }" @click="navTo('/system/config')">系统配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/approval/rules') }" @click="navTo('/system/approval/rules')">审批规则</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/approval/my') }" @click="navTo('/system/approval/my')">我的审批</div>
            <div class="nav-sub-item" :class="{ active: isActive('/report-permissions') }" @click="navTo('/report-permissions')">报表权限</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/payment') }" @click="navTo('/system/payment')">支付配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/miniapp') }" @click="navTo('/system/miniapp')">小程序配置</div>
            <div class="nav-sub-item" :class="{ active: isActive('/monitor') }" @click="navTo('/monitor')">系统监控</div>
            <div class="nav-sub-item" :class="{ active: isActive('/system/feedback') }" @click="navTo('/system/feedback')">反馈管理</div>
            <div class="nav-sub-item" :class="{ active: isActive('/audit-log') }" @click="navTo('/audit-log')">操作日志</div>
            <div class="nav-sub-item" :class="{ active: isActive('/error-log') }" @click="navTo('/error-log')">错误日志</div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main v-loading="pageLoading" class="main">
      <!-- 顶栏：磨砂半透明 -->
      <header v-if="!isCashierMode" class="main-header">
        <div class="header-left">
          <el-button
            v-if="isMenuCollapsed"
            class="menu-toggle-btn"
            :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
            size="small"
            text
            @click="isMenuCollapsed = !isMenuCollapsed"
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
              <el-avatar :size="28" class="user-avatar-icon" style="background: var(--color-primary)">
                <el-icon><User /></el-icon>
              </el-avatar>
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
  ArrowDown, CaretBottom, ArrowLeft, Money, Discount, Van
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
  purchase: false,
  inventory: false,
  products: false,
  customers: false,
  instant: false,
  reports: false,
  finance: false,
  system: false,
  marketing: false,
});

const isCashierUser = computed(() => {
  return currentUser.value?.roles?.includes("CASHIER") ?? false;
});

onMounted(() => {
  if (currentUser.value?.roles?.includes("CASHIER")) {
    isCashierMode.value = true;
    isMenuCollapsed.value = true;
  }
  const path = route.path;
  // 2. 销售管理
  if (path.startsWith('/sales') || path.startsWith('/sale-') || path.startsWith('/collection')) openGroups.sales = true;
  // 3. 订单管理
  if (path.startsWith('/order')) openGroups.orders = true;
  // 4. 采购管理
  if (path.startsWith('/purchase') || path.startsWith('/suppliers')) openGroups.purchase = true;
  // 5. 库存管理
  if (path.startsWith('/inventory')) openGroups.inventory = true;
  // 6. 客户管理
  if (path.startsWith('/customers') || path.startsWith('/member') || path.startsWith('/store-value') || path.startsWith('/credit') || path.startsWith('/points') || path.startsWith('/level') || path.startsWith('/customer-')) openGroups.customers = true;
  // 7. 商品中心
  if (path.startsWith('/products') || path.startsWith('/prices')) openGroups.products = true;
  // 8. 即时零售
  if (path.startsWith('/instant-retail')) openGroups.instant = true;
  // 9. 财务往来
  if (path.startsWith('/finance') || path.startsWith('/payments') || path.startsWith('/customer-statements') || path.startsWith('/bank-accounts') || path.startsWith('/fund-report') || path.startsWith('/bill-management')) openGroups.finance = true;
  // 10. 数据报表
  if (path.startsWith('/reports')) openGroups.reports = true;
  // 11. 营销中心
  if (path.startsWith('/marketing') || path.startsWith('/aftersale')) openGroups.marketing = true;
  // 12. 系统设置
  if (path.startsWith('/system') || path.startsWith('/employees') || path.startsWith('/department-manage') || path.startsWith('/position-manage') || path.startsWith('/stores') || path.startsWith('/audit') || path.startsWith('/error-log') || path.startsWith('/monitor') || path.startsWith('/report-permissions')) openGroups.system = true;
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
