<template>
  <div v-if="!token" class="admin-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>智享营销系统管理后台</h1>
          <p class="muted">请先登录，登录后进入正式后台工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入后台</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side">
      <h1>智享营销系统管理后台</h1>
      <button
        v-for="item in nav"
        :key="item"
        class="nav-item"
        :class="{ active: item === activeNav }"
        type="button"
        @click="activeNav = item"
      >
        {{ item }}
      </button>
    </aside>
    <main class="main">
      <section class="dashboard-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ adminNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <span>系统管理员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
      <section v-if='activeNav === "首页"'>
        <!-- 核心指标卡片 -->
        <div class="dashboard-cards">
          <div class="dash-card" v-for="card in dashCards" :key="card.label">
            <div class="dash-card-header">
              <span class="dash-card-label">{{ card.label }}</span>
              <span class="dash-card-change" :class="card.changeType">{{ card.changeText }}</span>
            </div>
            <div class="dash-card-value">{{ card.value }}</div>
            <div class="dash-card-desc">{{ card.desc }}</div>
          </div>
        </div>
        <!-- 图表行 -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-top:20px">
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">销售趋势（近12个月）</h4>
            <div ref="dashSalesTrendChart" style="width:100%;height:280px"></div>
          </div>
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">品类销售占比</h4>
            <div ref="dashCategoryPieChart" style="width:100%;height:280px"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">热销商品 TOP10</h4>
            <div ref="dashHotProductChart" style="width:100%;height:280px"></div>
          </div>
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">客户贡献 TOP10</h4>
            <div ref="dashCustomerTopChart" style="width:100%;height:280px"></div>
          </div>
        </div>
        <!-- 最近预警 -->
        <div class="table-card" style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 16px 0">
            <h4 style="margin:0;font-size:14px;color:var(--text-secondary)">最近预警</h4>
            <el-button size="small" link type="primary" @click="activeNav='预警中心'">查看全部</el-button>
          </div>
          <el-table :data="dashAlerts" size="small" empty-text="暂无预警" style="margin-top:8px">
            <el-table-column prop="type" label="类型" width="100"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
            <el-table-column prop="content" label="预警内容" />
            <el-table-column prop="level" label="级别" width="80"><template #default="{row}"><span class="status-tag" :class="row.level==='HIGH'?'danger':row.level==='MEDIUM'?'warning':'info'">{{ row.level==='HIGH'?'高':row.level==='MEDIUM'?'中':'低' }}</span></template></el-table-column>
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
        </div>
      </section>
      <el-card v-if='activeNav === "商品"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>商品列表</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input v-model="productsKeyword" placeholder="商品名/SKU" size="small" style="width: 180px" clearable @clear="searchProducts" @keyup.enter="searchProducts" />
              <el-button size="small" @click="searchProducts">搜索</el-button>
              <el-button size="small" @click="loadProducts">刷新商品</el-button>
              <el-button size="small" type="primary" @click="productDialogVisible = true">新增商品</el-button>
            </div>
          </div>
        </template>
        <el-table :data="products">
          <el-table-column label="图片" width="82">
            <template #default="{ row }">
              <el-image
                v-if="row.mainImage"
                :src="row.mainImage"
                fit="cover"
                style="width: 44px; height: 44px; border-radius: 6px; background: #f5f5f5"
                :preview-src-list="[row.mainImage]"
                preview-teleported
              />
              <span v-else class="muted">无</span>
            </template>
          </el-table-column>
          <el-table-column prop="skuCode" label="SKU编码" width="180" />
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="skuName" label="规格" />
          <el-table-column label="零售价" width="100">
            <template #default="{ row }">{{ formatYuan(row.retailPrice) }}</template>
          </el-table-column>
          <el-table-column label="批发价" width="100">
            <template #default="{ row }">{{ formatYuan(row.wholesalePrice) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button size="small" link type="success" :disabled="row.status === 'ON_SALE'" @click="handleProductStatus(row, 'ON_SALE')">上架</el-button>
              <el-button size="small" link type="warning" :disabled="row.status === 'OFF_SALE'" @click="handleProductStatus(row, 'OFF_SALE')">下架</el-button>
              <el-button size="small" link type="primary" @click="openPriceDialog(row)">改价</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存" && inventoryAlerts.length > 0' style="margin-top: 20px; border-left: 4px solid #e6a23c">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="color: #e6a23c; font-weight: bold">⚠ 库存预警（可用库存 ≤ 5）</span>
            <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryAlerts" size="small">
          <el-table-column prop="storeName" label="门店" width="140" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="availableQty" label="可用库存" width="100">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "门店"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>门店管理</span>
            <div>
              <el-button size="small" @click="loadStores">刷新门店</el-button>
              <el-button size="small" type="primary" @click="storeDialogVisible = true">新增门店</el-button>
            </div>
          </div>
        </template>
        <el-table :data="stores">
          <el-table-column prop="storeCode" label="门店编码" width="160" />
          <el-table-column prop="name" label="门店名称" />
          <el-table-column prop="address" label="地址" />
          <el-table-column prop="phone" label="联系电话" width="160" />
          <el-table-column prop="businessStatus" label="营业状态" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openStoreEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 客户管理（深度页面） -->
      <template v-if="activeNav === '客户'">
        <div v-if="!customerDetailVisible">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ customerStats.total }}</div><div class="stat-label">客户总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.newThisMonth }}</div><div class="stat-label">本月新增</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.active }}</div><div class="stat-label">活跃客户</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.owing }}</div><div class="stat-label">欠款客户</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(customerStats.totalReceivable) }}</div><div class="stat-label">总应收</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="membersKeyword" placeholder="客户名/手机号" style="width:180px" clearable @clear="searchMembers" @keyup.enter="searchMembers" />
            <el-select v-model="memberFilterType" placeholder="客户类型" style="width:130px" clearable @change="searchMembers"><el-option label="零售客户" value="RETAIL" /><el-option label="批发客户" value="WHOLESALE" /></el-select>
            <el-select v-model="memberFilterLevel" placeholder="客户等级" style="width:130px" clearable @change="searchMembers"><el-option label="普通" value="NORMAL" /><el-option label="银卡" value="SILVER" /><el-option label="金卡" value="GOLD" /><el-option label="钻石" value="DIAMOND" /></el-select>
            <el-select v-model="memberFilterArea" placeholder="区域" style="width:130px" clearable @change="searchMembers"><el-option label="东区" value="EAST" /><el-option label="西区" value="WEST" /><el-option label="南区" value="SOUTH" /><el-option label="北区" value="NORTH" /></el-select>
            <el-select v-model="memberFilterOwing" placeholder="欠款状态" style="width:130px" clearable @change="searchMembers"><el-option label="有欠款" value="YES" /><el-option label="无欠款" value="NO" /></el-select>
            <el-button @click="searchMembers">搜索</el-button><el-button @click="loadMembers">刷新</el-button><el-button type="primary" @click="memberDialogVisible=true">新增客户</el-button>
          </div>
          <div class="table-card">
            <el-table :data="members" empty-text="暂无客户">
              <el-table-column prop="memberId" label="客户ID" width="90" /><el-table-column prop="name" label="客户名称" /><el-table-column prop="mobile" label="手机号" width="140" /><el-table-column prop="customerType" label="客户类型" width="120" />
              <el-table-column label="客户等级" width="100"><template #default="{row}"><span class="status-tag" :class="getLevelClass(row.level)">{{ getLevelText(row.level) }}</span></template></el-table-column>
              <el-table-column prop="staffName" label="归属销售员" width="140" />
              <el-table-column label="欠款" width="110"><template #default="{row}"><span :style="{color: Number(row.owingAmount)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.owingAmount||0) }}</span></template></el-table-column>
              <el-table-column label="操作" width="280"><template #default="{row}"><el-button size="small" link type="primary" @click="openCustomerDetail(row)">详情</el-button><el-button size="small" link type="success" @click="handleQuickAction(row,'开单')">开单</el-button><el-button size="small" link type="warning" @click="handleQuickAction(row,'收款')">收款</el-button><el-button size="small" link @click="handleQuickAction(row,'拜访')">拜访</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="customerDetailVisible">
          <div style="margin-bottom:16px"><el-button @click="customerDetailVisible=false">返回客户列表</el-button></div>
          <div class="detail-header">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h3>{{ currentCustomer.name }} - 客户详情</h3>
                <el-descriptions :column="4" size="small" style="margin-top:12px">
                  <el-descriptions-item label="客户ID">{{ currentCustomer.memberId }}</el-descriptions-item><el-descriptions-item label="手机号">{{ currentCustomer.mobile }}</el-descriptions-item><el-descriptions-item label="客户类型">{{ currentCustomer.customerType }}</el-descriptions-item><el-descriptions-item label="等级"><span class="status-tag" :class="getLevelClass(currentCustomer.level)">{{ getLevelText(currentCustomer.level) }}</span></el-descriptions-item>
                  <el-descriptions-item label="归属销售员">{{ currentCustomer.staffName||'-' }}</el-descriptions-item><el-descriptions-item label="区域">{{ currentCustomer.area||'-' }}</el-descriptions-item><el-descriptions-item label="累计消费">{{ formatYuan(currentCustomer.totalPurchase||0) }}</el-descriptions-item><el-descriptions-item label="当前欠款"><span :style="{color:Number(currentCustomer.owingAmount||0)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(currentCustomer.owingAmount||0) }}</span></el-descriptions-item>
                </el-descriptions>
              </div>
              <div class="quick-actions"><el-button type="primary" size="small" @click="handleQuickAction(currentCustomer,'开单')">开单</el-button><el-button size="small" @click="handleQuickAction(currentCustomer,'收款')">收款</el-button><el-button size="small" @click="handleQuickAction(currentCustomer,'拜访')">拜访</el-button><el-button size="small" @click="handleAssignMember(currentCustomer)">分配销售员</el-button></div>
            </div>
          </div>
          <div class="detail-tabs">
            <el-tabs v-model="customerDetailTab">
              <el-tab-pane label="销售订单" name="orders"><el-table :data="customerSaleBills" empty-text="暂无销售订单" size="small"><el-table-column prop="billNo" label="销售单号" width="200" /><el-table-column label="应收金额" width="120"><template #default="{row}">{{ formatYuan(row.receivableAmount) }}</template></el-table-column><el-table-column label="已收金额" width="120"><template #default="{row}">{{ formatYuan(row.receivedAmount) }}</template></el-table-column><el-table-column label="未收金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unreceivedAmount)>0?'#C0392B':'#27AE60'}">{{ formatYuan(row.unreceivedAmount) }}</span></template></el-table-column><el-table-column prop="collectionStatus" label="收款状态" width="110" /><el-table-column prop="businessStatus" label="履约状态" width="110" /><el-table-column prop="createdAt" label="创建时间" width="170" /><el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openSaleBillDetail(row.billNo)">详情</el-button></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="回款记录" name="payments"><el-table :data="customerPayments" empty-text="暂无回款记录" size="small"><el-table-column prop="payNo" label="支付单号" width="200" /><el-table-column prop="sourceNo" label="关联来源" width="200" /><el-table-column label="金额" width="120"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column><el-table-column prop="paymentMethod" label="支付方式" width="120" /><el-table-column prop="status" label="状态" width="100" /><el-table-column prop="createdAt" label="支付时间" width="170" /></el-table></el-tab-pane>
              <el-tab-pane label="往来账务" name="ledger"><el-table :data="customerLedger" empty-text="暂无往来记录" size="small"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应收)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已收)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额(欠款)" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="购买统计" name="stats">
                <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ customerPurchaseStats.orderCount }}</div><div class="stat-label">订单总数</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalAmount) }}</div><div class="stat-label">订单总金额</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalPaid) }}</div><div class="stat-label">累计回款</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalOwing) }}</div><div class="stat-label">当前欠款</div></div></div>
                <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">TOP购买商品</h4>
                <el-table :data="customerPurchaseStats.topProducts" empty-text="暂无数据" size="small"><el-table-column type="index" label="排名" width="60" /><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="totalQty" label="购买数量" width="120" /><el-table-column label="购买金额" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column prop="lastPurchaseAt" label="最近购买" width="170" /></el-table>
              </el-tab-pane>
              <el-tab-pane label="拜访记录" name="visits"><el-table :data="customerVisits" empty-text="暂无拜访记录" size="small"><el-table-column prop="visitDate" label="拜访日期" width="130" /><el-table-column prop="staffName" label="拜访人" width="120" /><el-table-column prop="visitType" label="拜访类型" width="120" /><el-table-column prop="result" label="拜访结果" /><el-table-column prop="nextPlan" label="下次计划" /><el-table-column prop="remark" label="备注" /></el-table></el-tab-pane>
              <el-tab-pane label="价格策略" name="prices"><el-table :data="customerPrices" empty-text="暂无专属价格" size="small"><el-table-column prop="skuName" label="商品名称" /><el-table-column label="零售价" width="110"><template #default="{row}">{{ formatYuan(row.retailPrice) }}</template></el-table-column><el-table-column label="批发价" width="110"><template #default="{row}">{{ formatYuan(row.wholesalePrice) }}</template></el-table-column><el-table-column label="专属价" width="110"><template #default="{row}"><span style="color:var(--color-primary);font-weight:600">{{ formatYuan(row.specialPrice) }}</span></template></el-table-column><el-table-column label="折扣" width="80"><template #default="{row}">{{ row.discount?row.discount+'%':'-' }}</template></el-table-column><el-table-column prop="effectiveDate" label="生效日期" width="120" /><el-table-column prop="expireDate" label="到期日期" width="120" /></el-table></el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </template>
      <el-card v-if='activeNav === "员工"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>员工管理</span>
            <el-button size="small" @click="loadStaff">刷新员工</el-button>
          </div>
        </template>
        <el-table :data="staffList" empty-text="暂无员工">
          <el-table-column prop="staffId" label="员工ID" width="100" />
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="realName" label="姓名" />
          <el-table-column prop="storeId" label="门店ID" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "订单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px">
            <span>小程序订单</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input v-model="ordersKeyword" placeholder="订单号/收货人/电话" size="small" style="width: 180px" clearable @clear="searchOrders" @keyup.enter="searchOrders" />
              <el-select v-model="ordersStatus" placeholder="全部状态" size="small" style="width: 140px" clearable @change="searchOrders">
                <el-option label="待支付" value="PENDING_PAYMENT" />
                <el-option label="已接单" value="ACCEPTED" />
                <el-option label="已完成" value="COMPLETED" />
                <el-option label="已取消" value="CANCELLED" />
              </el-select>
              <el-date-picker
                v-model="ordersDateRange"
                type="daterange"
                size="small"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px"
                @change="searchOrders"
              />
              <el-button size="small" @click="searchOrders">搜索</el-button>
              <el-button size="small" type="success" @click="exportOrders">导出CSV</el-button>
              <el-button size="small" @click="loadOrders(1)">刷新</el-button>
            </div>
          </div>
        </template>
        <el-table :data="orders" empty-text="暂无订单">
          <el-table-column prop="orderNo" label="订单号" width="200" />
          <el-table-column prop="customerType" label="客户类型" width="100" />
          <el-table-column prop="orderStatus" label="订单状态" width="130" />
          <el-table-column prop="payStatus" label="支付状态" width="100" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.payableAmount) }}</template>
          </el-table-column>
          <el-table-column prop="receiverName" label="收货人" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openOrderDetail(row.orderNo)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 12px; gap: 8px">
          <span style="font-size: 13px; color: #666">共 {{ ordersTotal }} 条，第 {{ ordersPage }} / {{ Math.ceil(ordersTotal / 10) || 1 }} 页</span>
          <el-button size="small" :disabled="ordersPage <= 1" @click="prevOrdersPage">上一页</el-button>
          <el-button size="small" :disabled="ordersPage >= Math.ceil(ordersTotal / 10)" @click="nextOrdersPage">下一页</el-button>
        </div>
      </el-card>
      <el-card v-if='activeNav === "销售单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>销售单</span>
            <el-button size="small" @click="loadSaleBills">刷新</el-button>
          </div>
        </template>
        <el-table :data="saleBills" empty-text="暂无销售单">
          <el-table-column prop="billNo" label="销售单号" width="200" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column label="应收" width="110">
            <template #default="{ row }">{{ formatYuan(row.receivableAmount) }}</template>
          </el-table-column>
          <el-table-column label="已收" width="110">
            <template #default="{ row }">{{ formatYuan(row.receivedAmount) }}</template>
          </el-table-column>
          <el-table-column label="未收" width="110">
            <template #default="{ row }">{{ formatYuan(row.unreceivedAmount) }}</template>
          </el-table-column>
          <el-table-column prop="collectionStatus" label="收款" width="120" />
          <el-table-column prop="businessStatus" label="履约" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openSaleBillDetail(row.billNo)">详情</el-button>
              <el-button size="small" link type="success" @click="openCollectionLinkDialog(row)">收款链接</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存流水</span>
            <el-button size="small" @click="loadInventoryLogs">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryLogs" empty-text="暂无流水">
          <el-table-column prop="logNo" label="流水号" width="200" />
          <el-table-column prop="skuName" label="商品" width="140" />
          <el-table-column prop="changeQty" label="变动" width="80" />
          <el-table-column prop="beforeQty" label="调整前" width="80" />
          <el-table-column prop="afterQty" label="调整后" width="80" />
          <el-table-column prop="reason" label="原因" />
          <el-table-column prop="operatorName" label="操作人" width="120" />
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>分享收款</span>
            <el-button size="small" @click="loadCollectionLinks">刷新</el-button>
          </div>
        </template>
        <el-table :data="collectionLinks" empty-text="暂无记录">
          <el-table-column prop="linkNo" label="收款单号" width="200" />
          <el-table-column prop="sourceNo" label="关联销售单" width="200" />
          <el-table-column label="收款金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="已付" width="100">
            <template #default="{ row }">{{ formatYuan(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="shareChannel" label="分享渠道" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>支付记录</span>
            <el-button size="small" @click="loadPaymentOrders">刷新</el-button>
          </div>
        </template>
        <el-table :data="paymentOrders" empty-text="暂无记录">
          <el-table-column prop="payNo" label="支付单号" width="200" />
          <el-table-column prop="sourceNo" label="关联来源" width="200" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="paymentMethod" label="方式" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>退款记录</span>
            <el-button size="small" @click="loadRefundOrders">刷新</el-button>
          </div>
        </template>
        <el-table :data="refundOrders" empty-text="暂无退款">
          <el-table-column prop="refundNo" label="退款单号" width="200" />
          <el-table-column prop="payNo" label="支付单号" width="200" />
          <el-table-column prop="sourceNo" label="关联来源" width="180" />
          <el-table-column label="退款金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存总览</span>
            <el-button size="small" @click="loadInventoryBalances">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryBalances" empty-text="暂无库存">
          <el-table-column prop="storeName" label="门店" width="140" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="physicalQty" label="物理库存" width="100" />
          <el-table-column prop="availableQty" label="可售库存" width="100" />
          <el-table-column prop="lockedQty" label="锁定库存" width="100" />
        </el-table>
      </el-card>
      <!-- 报表模块 - ECharts可视化 -->
      <template v-if='activeNav === "报表"'>
        <el-tabs v-model="reportTab" style="margin-top: 20px">
          <el-tab-pane label="销售日报/月报" name="daily">
            <div class="filter-area" style="margin-bottom:16px">
              <el-radio-group v-model="reportDateType" @change="loadReportData">
                <el-radio-button value="daily">日报</el-radio-button>
                <el-radio-button value="monthly">月报</el-radio-button>
              </el-radio-group>
              <el-date-picker v-model="reportDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px;margin-left:12px" @change="loadReportData" />
              <el-button size="small" type="primary" style="margin-left:8px" @click="loadReportData">查询</el-button>
            </div>
            <div ref="salesTrendChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="reportDailyData" size="small" empty-text="暂无数据">
                <el-table-column prop="date" label="日期" width="120" />
                <el-table-column prop="orderCount" label="订单数" width="100" />
                <el-table-column label="销售金额" width="120"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column>
                <el-table-column label="收款金额" width="120"><template #default="{row}">{{ formatYuan(row.receivedAmount) }}</template></el-table-column>
                <el-table-column label="退款金额" width="120"><template #default="{row}">{{ formatYuan(row.refundAmount) }}</template></el-table-column>
                <el-table-column prop="customerCount" label="客户数" width="100" />
                <el-table-column label="客单价" width="120"><template #default="{row}">{{ formatYuan(row.avgOrderAmount) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="销售排行" name="ranking">
            <div class="filter-area" style="margin-bottom:16px">
              <el-radio-group v-model="rankingDimension" @change="loadRankingData">
                <el-radio-button value="product">按商品</el-radio-button>
                <el-radio-button value="customer">按客户</el-radio-button>
                <el-radio-button value="staff">按业务员</el-radio-button>
              </el-radio-group>
              <el-date-picker v-model="rankingDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px;margin-left:12px" @change="loadRankingData" />
            </div>
            <div ref="rankingChart" style="width:100%;height:350px;margin-bottom:20px"></div>
          </el-tab-pane>
          <el-tab-pane label="客户贡献分析" name="customerContribution">
            <div ref="customerContributionChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="customerContributionData" size="small" empty-text="暂无数据">
                <el-table-column type="index" label="排名" width="60" />
                <el-table-column prop="customerName" label="客户名称" />
                <el-table-column label="累计消费" width="140"><template #default="{row}">{{ formatYuan(row.totalPurchase) }}</template></el-table-column>
                <el-table-column label="累计回款" width="140"><template #default="{row}">{{ formatYuan(row.totalPaid) }}</template></el-table-column>
                <el-table-column label="当前欠款" width="120"><template #default="{row}"><span :style="{color:Number(row.owingAmount)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.owingAmount) }}</span></template></el-table-column>
                <el-table-column prop="orderCount" label="订单数" width="100" />
                <el-table-column label="贡献占比" width="100"><template #default="{row}">{{ row.contributionRate }}%</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="采购汇总" name="purchaseSummary">
            <div ref="purchaseSummaryChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="purchaseSummaryData" size="small" empty-text="暂无数据">
                <el-table-column prop="supplierName" label="供应商" />
                <el-table-column prop="purchaseCount" label="采购单数" width="100" />
                <el-table-column label="采购金额" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column>
                <el-table-column label="已付金额" width="140"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
                <el-table-column label="待付金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unpaidAmount)>0?'#C0392B':'#27AE60'}">{{ formatYuan(row.unpaidAmount) }}</span></template></el-table-column>
                <el-table-column prop="lastPurchaseDate" label="最近采购" width="140" />
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="库存周转分析" name="inventoryTurnover">
            <div ref="inventoryTurnoverChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="inventoryTurnoverData" size="small" empty-text="暂无数据">
                <el-table-column prop="skuName" label="商品" />
                <el-table-column prop="category" label="品类" width="100" />
                <el-table-column prop="stockQty" label="当前库存" width="100" />
                <el-table-column label="月均销量" width="120"><template #default="{row}">{{ row.avgMonthlySales }}</template></el-table-column>
                <el-table-column label="周转天数" width="100"><template #default="{row}"><span :style="{color:Number(row.turnoverDays)>90?'#C0392B':Number(row.turnoverDays)>60?'#D4A017':'#27AE60',fontWeight:600}">{{ row.turnoverDays }}天</span></template></el-table-column>
                <el-table-column label="周转率" width="100"><template #default="{row}">{{ row.turnoverRate }}</template></el-table-column>
                <el-table-column label="库存金额" width="140"><template #default="{row}">{{ formatYuan(row.stockAmount) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="应收应付汇总" name="receivablePayable">
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalReceivable) }}</div><div class="stat-label">应收总额</div></div>
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalReceived) }}</div><div class="stat-label">已收总额</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#C0392B">{{ formatYuan(rpStats.totalUnreceived) }}</div><div class="stat-label">未收总额</div></div>
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalPayable) }}</div><div class="stat-label">应付总额</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#C0392B">{{ formatYuan(rpStats.totalUnpaid) }}</div><div class="stat-label">未付总额</div></div>
            </div>
            <div class="table-card">
              <el-table :data="rpData" size="small" empty-text="暂无数据">
                <el-table-column prop="name" label="往来单位" />
                <el-table-column prop="type" label="类型" width="80" />
                <el-table-column label="应收/应付" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column>
                <el-table-column label="已收/已付" width="140"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
                <el-table-column label="未结金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unpaidAmount)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.unpaidAmount) }}</span></template></el-table-column>
                <el-table-column prop="lastDate" label="最近往来" width="140" />
                <el-table-column prop="overdueDays" label="逾期天数" width="100"><template #default="{row}"><span v-if="row.overdueDays>0" style="color:#C0392B;font-weight:600">{{ row.overdueDays }}天</span><span v-else>-</span></template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="利润表" name="profit">
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value" style="color:#27AE60">{{ formatYuan(profitStats.grossProfit) }}</div><div class="stat-label">毛利润</div></div>
              <div class="stat-item"><div class="stat-value">{{ profitStats.grossMargin }}%</div><div class="stat-label">毛利率</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#27AE60">{{ formatYuan(profitStats.netProfit) }}</div><div class="stat-label">净利润</div></div>
              <div class="stat-item"><div class="stat-value">{{ profitStats.netMargin }}%</div><div class="stat-label">净利率</div></div>
            </div>
            <div class="table-card">
              <el-table :data="profitData" size="small" empty-text="暂无数据">
                <el-table-column prop="item" label="项目" width="200" />
                <el-table-column label="本月金额" width="160" align="right"><template #default="{row}">{{ formatYuan(row.currentMonth) }}</template></el-table-column>
                <el-table-column label="上月金额" width="160" align="right"><template #default="{row}">{{ formatYuan(row.lastMonth) }}</template></el-table-column>
                <el-table-column label="环比变化" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.change)>=0?'#27AE60':'#C0392B'}">{{ Number(row.change)>=0?'+':'' }}{{ row.change }}%</span></template></el-table-column>
                <el-table-column prop="remark" label="备注" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
        <template v-if="orderDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ orderDetail.customerType }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ orderDetail.orderStatus }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ orderDetail.payStatus }}</el-descriptions-item>
            <el-descriptions-item label="应付金额">{{ formatYuan(orderDetail.payableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ orderDetail.receiverMobile || "-" }}</el-descriptions-item>
            <el-descriptions-item label="收货地址">{{ orderDetail.receiverAddress || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="orderDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="orderDetail.orderStatus" style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap">
            <el-button v-if="orderDetail.orderStatus === 'PENDING_PAYMENT' || orderDetail.orderStatus === 'PENDING'" type="success" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'accept')">接单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'PENDING_PAYMENT' || orderDetail.orderStatus === 'PENDING'" type="danger" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'reject')">拒单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'ACCEPTED' || orderDetail.orderStatus === 'WAIT_DELIVERY'" type="primary" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'deliver')">开始配送</el-button>
            <el-button v-if="orderDetail.orderStatus === 'DELIVERING'" type="success" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'complete')">完成配送</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="productDialogVisible" title="新增商品" width="520px">
        <el-form ref="productFormRef" :model="productForm" :rules="productRules" label-width="110px">
          <el-form-item label="商品名称" prop="name">
            <el-input v-model="productForm.name" />
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model="productForm.mainImage" placeholder="可填写商品图片链接" />
          </el-form-item>
          <el-form-item label="SKU名称" prop="skuName">
            <el-input v-model="productForm.skuName" />
          </el-form-item>
          <el-form-item label="条码">
            <el-input v-model="productForm.barcode" />
          </el-form-item>
          <el-form-item label="箱瓶换算">
            <el-input-number v-model="productForm.boxRatio" :min="1" />
          </el-form-item>
          <el-form-item label="零售价" prop="retailPrice">
            <el-input-number v-model="productForm.retailPrice" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="批发价" prop="wholesalePrice">
            <el-input-number v-model="productForm.wholesalePrice" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="productDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateProduct">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="storeDialogVisible" title="新增门店" width="480px">
        <el-form ref="storeFormRef" :model="storeForm" :rules="storeRules" label-width="100px">
          <el-form-item label="门店编码" prop="code">
            <el-input v-model="storeForm.code" />
          </el-form-item>
          <el-form-item label="门店名称" prop="name">
            <el-input v-model="storeForm.name" />
          </el-form-item>
          <el-form-item label="门店地址">
            <el-input v-model="storeForm.address" />
          </el-form-item>
          <el-form-item label="联系电话" prop="phone">
            <el-input v-model="storeForm.phone" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="storeDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateStore">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="storeEditDialogVisible" title="编辑门店" width="520px">
        <el-form :model="storeEditForm" label-width="110px">
          <el-form-item label="门店名称">
            <el-input v-model="storeEditForm.name" />
          </el-form-item>
          <el-form-item label="地址">
            <el-input v-model="storeEditForm.address" />
          </el-form-item>
          <el-form-item label="联系人">
            <el-input v-model="storeEditForm.contact" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="storeEditForm.phone" />
          </el-form-item>
          <el-form-item label="配送半径(km)">
            <el-input-number v-model="storeEditForm.deliveryRadius" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="营业状态">
            <el-select v-model="storeEditForm.businessStatus" style="width: 100%">
              <el-option label="营业中" value="OPEN" />
              <el-option label="已关闭" value="CLOSED" />
            </el-select>
          </el-form-item>
          <el-form-item label="小程序 AppID">
            <div style="display: flex; gap: 8px; width: 100%">
              <el-input v-model="storeEditForm.miniappAppid" placeholder="输入微信小程序 AppID" style="flex: 1" />
              <el-button type="primary" :loading="wxFetchLoading" @click="handleFetchWxInfo">拉取商户信息</el-button>
            </div>
          </el-form-item>
          <el-form-item label="微信商户名称">
            <el-input v-model="storeEditForm.wxMerchantName" readonly placeholder="从微信拉取" />
          </el-form-item>
          <el-form-item label="客服电话">
            <el-input v-model="storeEditForm.wxServicePhone" readonly placeholder="从微信拉取" />
          </el-form-item>
          <el-form-item label="小程序头像">
            <el-image
              v-if="storeEditForm.wxHeadImg"
              :src="storeEditForm.wxHeadImg"
              fit="cover"
              style="width: 64px; height: 64px; border-radius: 8px"
              :preview-src-list="[storeEditForm.wxHeadImg]"
              preview-teleported
            />
            <span v-else class="muted">暂无头像</span>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="storeEditDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="storeEditLoading" @click="submitStoreEdit">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="memberDialogVisible" title="新增客户" width="480px">
        <el-form ref="memberFormRef" :model="memberForm" :rules="memberRules" label-width="100px">
          <el-form-item label="客户名称" prop="name">
            <el-input v-model="memberForm.name" />
          </el-form-item>
          <el-form-item label="手机号" prop="mobile">
            <el-input v-model="memberForm.mobile" />
          </el-form-item>
          <el-form-item label="客户类型">
            <el-select v-model="memberForm.customerType">
              <el-option label="零售客户" value="RETAIL" />
              <el-option label="批发客户" value="WHOLESALE" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="memberDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateMember">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="priceDialogVisible" title="调整商品价格" width="420px">
        <el-form ref="priceFormRef" :model="priceForm" :rules="priceRules" label-width="100px">
          <el-form-item label="SKU">
            <span>{{ priceForm.skuName }}</span>
          </el-form-item>
          <el-form-item label="价格类型">
            <el-select v-model="priceForm.type">
              <el-option label="零售价" value="retail" />
              <el-option label="批发价" value="wholesale" />
              <el-option label="小程序价" value="miniapp" />
            </el-select>
          </el-form-item>
          <el-form-item label="新价格" prop="price">
            <el-input-number v-model="priceForm.price" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="priceDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleUpdatePrice">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="saleBillDetailVisible" title="销售单详情" width="600px">
        <template v-if="saleBillDetail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="销售单号" :span="2">{{ saleBillDetail.billNo }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ saleBillDetail.customerName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ saleBillDetail.collectionStatus }} / {{ saleBillDetail.businessStatus }}</el-descriptions-item>
            <el-descriptions-item label="应收金额">{{ formatYuan(saleBillDetail.receivableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已收金额">{{ formatYuan(saleBillDetail.receivedAmount) }}</el-descriptions-item>
            <el-descriptions-item label="未收金额">{{ formatYuan(saleBillDetail.unreceivedAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="saleBillDetail.items || []" style="margin-top: 16px" empty-text="暂无商品明细">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="totalBottleQty" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="120">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
        </template>
      </el-dialog>
      <el-dialog v-model="collectionLinkDialogVisible" title="创建收款链接" width="480px">
        <el-form label-width="100px">
          <el-form-item label="关联销售单">
            <span>{{ collectionLinkForm.billNo }}</span>
          </el-form-item>
          <el-form-item label="收款金额">
            <el-input-number v-model="collectionLinkForm.amount" :min="0.01" :precision="2" style="width: 200px" />
          </el-form-item>
          <el-form-item label="有效期(小时)">
            <el-input-number v-model="collectionLinkForm.expireHours" :min="1" :max="720" style="width: 200px" />
          </el-form-item>
          <el-form-item label="分享渠道">
            <el-select v-model="collectionLinkForm.shareChannel" style="width: 200px">
              <el-option label="链接" value="LINK" />
              <el-option label="小程序卡片" value="MINIAPP_CARD" />
              <el-option label="图片" value="IMAGE" />
              <el-option label="二维码" value="QR_CODE" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="collectionLinkDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateCollectionLink">创建</el-button>
        </template>
      </el-dialog>

      <!-- 供应商管理 -->
      <template v-if="activeNav === '供应商'">
        <div v-if="!supplierDetailVisible">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ supplierStats.total }}</div><div class="stat-label">供应商总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ supplierStats.active }}</div><div class="stat-label">合作中</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalPurchase) }}</div><div class="stat-label">采购总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalPaid) }}</div><div class="stat-label">已付款</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalOwing) }}</div><div class="stat-label">待付款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="supplierKeyword" placeholder="供应商名/编码" style="width:200px" clearable @clear="loadSuppliers" @keyup.enter="loadSuppliers" />
            <el-select v-model="supplierFilterType" placeholder="供应类型" style="width:140px" clearable><el-option label="白酒" value="BAIJIU" /><el-option label="啤酒" value="BEER" /><el-option label="红酒" value="WINE" /><el-option label="综合" value="GENERAL" /></el-select>
            <el-select v-model="supplierFilterStatus" placeholder="合作状态" style="width:140px" clearable><el-option label="合作中" value="ACTIVE" /><el-option label="已暂停" value="SUSPENDED" /><el-option label="已终止" value="TERMINATED" /></el-select>
            <el-button @click="loadSuppliers">搜索</el-button><el-button @click="loadSuppliers">刷新</el-button><el-button type="primary" @click="supplierDialogVisible=true">新增供应商</el-button>
          </div>
          <div class="table-card">
            <el-table :data="suppliers" empty-text="暂无供应商">
              <el-table-column prop="supplierCode" label="供应商编码" width="140" /><el-table-column prop="name" label="供应商名称" /><el-table-column prop="contactPerson" label="联系人" width="120" /><el-table-column prop="phone" label="联系电话" width="140" /><el-table-column prop="supplyType" label="供应类型" width="120" />
              <el-table-column label="合作状态" width="100"><template #default="{row}"><span class="status-tag" :class="getSupplierStatusClass(row.status)">{{ getSupplierStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="待付款" width="120"><template #default="{row}"><span :style="{color:Number(row.owingAmount)>0?'#C0392B':'#27AE60'}">{{ formatYuan(row.owingAmount||0) }}</span></template></el-table-column>
              <el-table-column label="操作" width="180"><template #default="{row}"><el-button size="small" link type="primary" @click="openSupplierDetail(row)">详情</el-button><el-button size="small" link type="success" @click="handleQuickAction(row,'采购')">采购</el-button><el-button size="small" link type="warning" @click="handleQuickAction(row,'付款')">付款</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="supplierDetailVisible">
          <div style="margin-bottom:16px"><el-button @click="supplierDetailVisible=false">返回供应商列表</el-button></div>
          <div class="detail-header">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h3>{{ currentSupplier.name }} - 供应商详情</h3>
                <el-descriptions :column="4" size="small" style="margin-top:12px">
                  <el-descriptions-item label="供应商编码">{{ currentSupplier.supplierCode }}</el-descriptions-item><el-descriptions-item label="联系人">{{ currentSupplier.contactPerson }}</el-descriptions-item><el-descriptions-item label="联系电话">{{ currentSupplier.phone }}</el-descriptions-item><el-descriptions-item label="供应类型">{{ currentSupplier.supplyType }}</el-descriptions-item>
                  <el-descriptions-item label="地址">{{ currentSupplier.address||'-' }}</el-descriptions-item><el-descriptions-item label="开户银行">{{ currentSupplier.bankName||'-' }}</el-descriptions-item><el-descriptions-item label="银行账号">{{ currentSupplier.bankAccount||'-' }}</el-descriptions-item><el-descriptions-item label="合作状态"><span class="status-tag" :class="getSupplierStatusClass(currentSupplier.status)">{{ getSupplierStatusText(currentSupplier.status) }}</span></el-descriptions-item>
                </el-descriptions>
              </div>
              <div class="quick-actions"><el-button type="primary" size="small" @click="handleQuickAction(currentSupplier,'新建采购')">新建采购</el-button><el-button size="small" @click="handleQuickAction(currentSupplier,'付款')">付款</el-button></div>
            </div>
          </div>
          <div class="detail-tabs">
            <el-tabs v-model="supplierDetailTab">
              <el-tab-pane label="采购订单" name="purchaseOrders"><el-table :data="supplierPurchaseOrders" empty-text="暂无采购订单" size="small"><el-table-column prop="purchaseNo" label="采购单号" width="200" /><el-table-column label="采购金额" width="120"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column label="已付金额" width="120"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column><el-table-column prop="status" label="状态" width="120" /><el-table-column prop="createdAt" label="创建时间" width="170" /><el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openPurchaseDetail(row.purchaseNo)">详情</el-button></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="付款记录" name="payments"><el-table :data="supplierPayments" empty-text="暂无付款记录" size="small"><el-table-column prop="paymentNo" label="付款单号" width="200" /><el-table-column prop="purchaseNo" label="关联采购单" width="200" /><el-table-column label="付款金额" width="120"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column><el-table-column prop="paymentMethod" label="付款方式" width="120" /><el-table-column prop="status" label="状态" width="100" /><el-table-column prop="createdAt" label="付款时间" width="170" /></el-table></el-tab-pane>
              <el-tab-pane label="往来账务" name="ledger"><el-table :data="supplierLedger" empty-text="暂无往来记录" size="small"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应付)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已付)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额(应付)" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="供货商品" name="products"><el-table :data="supplierProducts" empty-text="暂无供货商品" size="small"><el-table-column prop="skuCode" label="SKU编码" width="160" /><el-table-column prop="skuName" label="商品名称" /><el-table-column label="供应价" width="110"><template #default="{row}">{{ formatYuan(row.supplyPrice) }}</template></el-table-column><el-table-column prop="unit" label="单位" width="80" /><el-table-column prop="minOrderQty" label="起订量" width="80" /><el-table-column prop="deliveryDays" label="交货天数" width="100" /><el-table-column label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="row.active?'success':'default'">{{ row.active?'在供':'停供' }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="绩效评估" name="performance">
                <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ supplierPerformance.onTimeRate }}%</div><div class="stat-label">准时交货率</div></div><div class="stat-item"><div class="stat-value">{{ supplierPerformance.qualityRate }}%</div><div class="stat-label">质量合格率</div></div><div class="stat-item"><div class="stat-value">{{ supplierPerformance.orderCount }}</div><div class="stat-label">采购订单数</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(supplierPerformance.totalAmount) }}</div><div class="stat-label">采购总额</div></div></div>
                <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">评分明细</h4>
                <el-table :data="supplierPerformance.details" empty-text="暂无评分数据" size="small"><el-table-column prop="item" label="评估项" /><el-table-column prop="score" label="得分" width="100" /><el-table-column prop="fullScore" label="满分" width="80" /><el-table-column prop="remark" label="备注" /></el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </template>

      <!-- 采购管理 -->
      <template v-if="activeNav === '采购'">
        <div v-if="purchaseView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ purchaseStats.total }}</div><div class="stat-label">采购单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ purchaseStats.pending }}</div><div class="stat-label">待入库</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalAmount) }}</div><div class="stat-label">采购总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalPaid) }}</div><div class="stat-label">已付款</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalOwing) }}</div><div class="stat-label">待付款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="purchaseKeyword" placeholder="采购单号/供应商" style="width:200px" clearable @clear="loadPurchaseOrders" @keyup.enter="loadPurchaseOrders" />
            <el-select v-model="purchaseFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="已入库" value="WAREHOUSED" /><el-option label="已取消" value="CANCELLED" /></el-select>
            <el-button @click="loadPurchaseOrders">搜索</el-button><el-button @click="loadPurchaseOrders">刷新</el-button><el-button type="primary" @click="openPurchaseCreate">新建采购单</el-button><el-button @click="purchaseView='return'">采购退货</el-button>
          </div>
          <div class="table-card">
            <el-table :data="purchaseOrders" empty-text="暂无采购订单">
              <el-table-column prop="purchaseNo" label="采购单号" width="200" /><el-table-column prop="supplierName" label="供应商" />
              <el-table-column label="采购金额" width="120"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column label="已付金额" width="120"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
              <el-table-column prop="status" label="状态" width="120"><template #default="{row}"><span class="status-tag" :class="getPurchaseStatusClass(row.status)">{{ getPurchaseStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="warehouseStatus" label="入库状态" width="100" /><el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="200"><template #default="{row}"><el-button size="small" link type="primary" @click="openPurchaseDetail(row.purchaseNo)">详情</el-button><el-button v-if="row.status==='APPROVED'&&row.warehouseStatus!=='WAREHOUSED'" size="small" link type="success" @click="openPurchaseWarehousing(row)">入库</el-button><el-button v-if="row.status==='PENDING'" size="small" link type="warning" @click="handleApprovePurchase(row)">审核</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="purchaseView==='create'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>新建采购单</h3></div>
          <el-form :model="purchaseForm" label-width="100px" style="max-width:800px">
            <el-form-item label="供应商"><el-select v-model="purchaseForm.supplierId" placeholder="请选择供应商" filterable style="width:100%"><el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
            <el-form-item label="仓库"><el-select v-model="purchaseForm.warehouseId" placeholder="请选择仓库" style="width:100%"><el-option v-for="s in stores" :key="s.id||s.storeId" :label="s.name" :value="s.id||s.storeId" /></el-select></el-form-item>
            <el-form-item label="预计到货日"><el-date-picker v-model="purchaseForm.expectedDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="purchaseForm.remark" type="textarea" :rows="2" placeholder="采购备注" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">商品明细</h4>
          <el-table :data="purchaseForm.items" empty-text="请添加商品" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" width="200"><template #default="{row}"><el-select v-model="row.skuId" placeholder="选择商品" filterable style="width:100%" @change="(val:any)=>onPurchaseItemSelect(row,val)"><el-option v-for="p in products" :key="p.skuId||p.id" :label="p.skuName||p.name" :value="p.skuId||p.id" /></el-select></template></el-table-column>
            <el-table-column label="数量" width="120"><template #default="{row}"><el-input-number v-model="row.quantity" :min="1" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="单价" width="140"><template #default="{row}"><el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="小计" width="120"><template #default="{row}">{{ formatYuan((row.quantity||0)*(row.unitPrice||0)) }}</template></el-table-column>
            <el-table-column label="操作" width="80"><template #default="{$index}"><el-button size="small" link type="danger" @click="purchaseForm.items.splice($index,1)">删除</el-button></template></el-table-column>
          </el-table>
          <el-button size="small" @click="addPurchaseItem">添加商品行</el-button>
          <div style="margin-top:16px;padding:16px;background:var(--bg-soft);border-radius:var(--radius-sm)"><div style="display:flex;justify-content:space-between;align-items:center"><span>商品数量: {{ purchaseForm.items.length }} 项</span><span style="font-size:18px;font-weight:700;color:var(--color-primary)">合计: {{ formatYuan(purchaseTotalAmount) }}</span></div></div>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitPurchase">提交采购单</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
        <div v-if="purchaseView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购单详情 - {{ purchaseDetail?.purchaseNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="供应商">{{ purchaseDetail?.supplierName }}</el-descriptions-item><el-descriptions-item label="仓库">{{ purchaseDetail?.warehouseName }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getPurchaseStatusClass(purchaseDetail?.status)">{{ getPurchaseStatusText(purchaseDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="入库状态">{{ purchaseDetail?.warehouseStatus||'-' }}</el-descriptions-item><el-descriptions-item label="采购金额">{{ formatYuan(purchaseDetail?.totalAmount) }}</el-descriptions-item><el-descriptions-item label="已付金额">{{ formatYuan(purchaseDetail?.paidAmount) }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ purchaseDetail?.createdAt }}</el-descriptions-item><el-descriptions-item label="备注">{{ purchaseDetail?.remark||'-' }}</el-descriptions-item></el-descriptions></div>
          <div class="table-card" style="margin-bottom:16px"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">商品明细</h4><el-table :data="purchaseDetail?.items||[]" size="small" style="margin-top:8px"><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="quantity" label="数量" width="100" /><el-table-column label="单价" width="120"><template #default="{row}">{{ formatYuan(row.unitPrice) }}</template></el-table-column><el-table-column label="小计" width="120"><template #default="{row}">{{ formatYuan(row.subtotal) }}</template></el-table-column><el-table-column prop="warehousedQty" label="已入库" width="100" /><el-table-column prop="batchNo" label="批次号" width="160" /></el-table></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">操作记录</h4><el-table :data="purchaseDetail?.operationLogs||[]" size="small" style="margin-top:8px"><el-table-column prop="action" label="操作" width="120" /><el-table-column prop="operator" label="操作人" width="120" /><el-table-column prop="remark" label="备注" /><el-table-column prop="createdAt" label="时间" width="170" /></el-table></div>
        </div>
        <div v-if="purchaseView==='warehousing'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购入库 - {{ warehousingForm.purchaseNo }}</h3><el-descriptions :column="3" size="small" style="margin-top:12px"><el-descriptions-item label="供应商">{{ warehousingForm.supplierName }}</el-descriptions-item><el-descriptions-item label="仓库">{{ warehousingForm.warehouseName }}</el-descriptions-item><el-descriptions-item label="采购金额">{{ formatYuan(warehousingForm.totalAmount) }}</el-descriptions-item></el-descriptions></div>
          <el-table :data="warehousingForm.items" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="orderQty" label="采购数量" width="100" /><el-table-column prop="warehousedQty" label="已入库" width="100" />
            <el-table-column label="本次入库" width="140"><template #default="{row}"><el-input-number v-model="row.thisQty" :min="0" :max="row.orderQty-row.warehousedQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="批次号" width="180"><template #default="{row}"><el-input v-model="row.batchNo" size="small" placeholder="批次号" /></template></el-table-column>
            <el-table-column label="生产日期" width="160"><template #default="{row}"><el-date-picker v-model="row.productionDate" type="date" value-format="YYYY-MM-DD" size="small" placeholder="生产日期" style="width:100%" /></template></el-table-column>
            <el-table-column label="质检结果" width="140"><template #default="{row}"><el-select v-model="row.qualityResult" size="small" style="width:100%"><el-option label="合格" value="PASS" /><el-option label="不合格" value="FAIL" /></el-select></template></el-table-column>
          </el-table>
          <div style="margin-top:16px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitWarehousing">确认入库</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
        <div v-if="purchaseView==='return'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购退货</h3></div>
          <el-form :model="purchaseReturnForm" label-width="100px" style="max-width:800px">
            <el-form-item label="关联采购单"><el-select v-model="purchaseReturnForm.purchaseNo" placeholder="选择采购单" filterable style="width:100%" @change="onPurchaseReturnSelect"><el-option v-for="po in purchaseOrders" :key="po.purchaseNo" :label="`${po.purchaseNo} - ${po.supplierName}`" :value="po.purchaseNo" /></el-select></el-form-item>
            <el-form-item label="退货原因"><el-select v-model="purchaseReturnForm.reason" style="width:100%"><el-option label="质量问题" value="QUALITY" /><el-option label="数量多余" value="OVER_QUANTITY" /><el-option label="商品损坏" value="DAMAGED" /><el-option label="其他原因" value="OTHER" /></el-select></el-form-item>
            <el-form-item label="备注"><el-input v-model="purchaseReturnForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">退货商品</h4>
          <el-table :data="purchaseReturnForm.items" empty-text="请先选择采购单" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="warehousedQty" label="已入库数量" width="120" />
            <el-table-column label="退货数量" width="140"><template #default="{row}"><el-input-number v-model="row.returnQty" :min="0" :max="row.warehousedQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货单价" width="140"><template #default="{row}"><el-input-number v-model="row.returnPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan((row.returnQty||0)*(row.returnPrice||0)) }}</template></el-table-column>
          </el-table>
          <div style="margin-top:16px;display:flex;gap:12px"><el-button type="danger" :loading="loading" @click="handleSubmitPurchaseReturn">提交退货单</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
      </template>

      <!-- 销售退货 -->
      <template v-if="activeNav === '销售退货'">
        <div v-if="saleReturnView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.total }}</div><div class="stat-label">退货单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.pending }}</div><div class="stat-label">待处理</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.completed }}</div><div class="stat-label">已完成</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(saleReturnStats.totalAmount) }}</div><div class="stat-label">退货总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.thisMonth }}</div><div class="stat-label">本月退货</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="saleReturnKeyword" placeholder="退货单号/客户名" style="width:200px" clearable @clear="loadSaleReturns" @keyup.enter="loadSaleReturns" />
            <el-select v-model="saleReturnFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="已退款" value="REFUNDED" /><el-option label="已取消" value="CANCELLED" /></el-select>
            <el-button @click="loadSaleReturns">搜索</el-button><el-button @click="loadSaleReturns">刷新</el-button><el-button type="primary" @click="openSaleReturnCreate">新建退货单</el-button>
          </div>
          <div class="table-card">
            <el-table :data="saleReturns" empty-text="暂无退货记录">
              <el-table-column prop="returnNo" label="退货单号" width="200" /><el-table-column prop="sourceBillNo" label="原销售单号" width="200" /><el-table-column prop="customerName" label="客户名称" />
              <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount) }}</template></el-table-column><el-table-column prop="reason" label="退货原因" width="120" />
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="getSaleReturnStatusClass(row.status)">{{ getSaleReturnStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openSaleReturnDetail(row)">详情</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="saleReturnView==='create'">
          <div style="margin-bottom:16px"><el-button @click="saleReturnView='list'">返回退货列表</el-button></div>
          <div class="detail-header"><h3>新建销售退货单</h3></div>
          <el-form :model="saleReturnForm" label-width="100px" style="max-width:800px">
            <el-form-item label="关联销售单"><el-select v-model="saleReturnForm.sourceBillNo" placeholder="选择原销售单" filterable style="width:100%" @change="onSaleReturnSelect"><el-option v-for="sb in saleBills" :key="sb.billNo" :label="`${sb.billNo} - ${sb.customerName}`" :value="sb.billNo" /></el-select></el-form-item>
            <el-form-item label="客户名称"><el-input :model-value="saleReturnForm.customerName" readonly /></el-form-item>
            <el-form-item label="退货原因"><el-select v-model="saleReturnForm.reason" style="width:100%"><el-option label="质量问题" value="QUALITY" /><el-option label="发错货" value="WRONG_ITEM" /><el-option label="客户不满意" value="DISSATISFIED" /><el-option label="其他原因" value="OTHER" /></el-select></el-form-item>
            <el-form-item label="备注"><el-input v-model="saleReturnForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">退货商品</h4>
          <el-table :data="saleReturnForm.items" empty-text="请先选择销售单" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="originalQty" label="原购买数量" width="120" />
            <el-table-column label="退货数量" width="140"><template #default="{row}"><el-input-number v-model="row.returnQty" :min="0" :max="row.originalQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货单价" width="140"><template #default="{row}"><el-input-number v-model="row.returnPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan((row.returnQty||0)*(row.returnPrice||0)) }}</template></el-table-column>
          </el-table>
          <div style="margin-top:16px;padding:16px;background:var(--bg-soft);border-radius:var(--radius-sm)"><div style="display:flex;justify-content:space-between;align-items:center"><span>退货商品: {{ saleReturnForm.items.length }} 项</span><span style="font-size:18px;font-weight:700;color:var(--color-danger)">退货总额: {{ formatYuan(saleReturnTotalAmount) }}</span></div></div>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="danger" :loading="loading" @click="handleSubmitSaleReturn">提交退货单</el-button><el-button @click="saleReturnView='list'">取消</el-button></div>
        </div>
        <div v-if="saleReturnView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="saleReturnView='list'">返回退货列表</el-button></div>
          <div class="detail-header"><h3>退货单详情 - {{ saleReturnDetail?.returnNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="原销售单号">{{ saleReturnDetail?.sourceBillNo }}</el-descriptions-item><el-descriptions-item label="客户名称">{{ saleReturnDetail?.customerName }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getSaleReturnStatusClass(saleReturnDetail?.status)">{{ getSaleReturnStatusText(saleReturnDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="退货金额">{{ formatYuan(saleReturnDetail?.returnAmount) }}</el-descriptions-item><el-descriptions-item label="退货原因">{{ saleReturnDetail?.reason }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ saleReturnDetail?.createdAt }}</el-descriptions-item><el-descriptions-item label="处理人">{{ saleReturnDetail?.handler||'-' }}</el-descriptions-item><el-descriptions-item label="备注">{{ saleReturnDetail?.remark||'-' }}</el-descriptions-item></el-descriptions></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">退货商品明细</h4><el-table :data="saleReturnDetail?.items||[]" size="small" style="margin-top:8px"><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="originalQty" label="原购买数量" width="120" /><el-table-column prop="returnQty" label="退货数量" width="100" /><el-table-column label="退货单价" width="120"><template #default="{row}">{{ formatYuan(row.returnPrice) }}</template></el-table-column><el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount) }}</template></el-table-column></el-table></div>
        </div>
      </template>

      <!-- 客户对账 -->
      <template v-if="activeNav === '客户对账'">
        <div v-if="statementView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ statementStats.total }}</div><div class="stat-label">对账单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ statementStats.confirmed }}</div><div class="stat-label">已确认</div></div>
            <div class="stat-item"><div class="stat-value">{{ statementStats.pending }}</div><div class="stat-label">待确认</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(statementStats.totalAmount) }}</div><div class="stat-label">对账总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(statementStats.totalOwing) }}</div><div class="stat-label">待收款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="statementKeyword" placeholder="对账单号/客户名" style="width:200px" clearable @clear="loadStatements" @keyup.enter="loadStatements" />
            <el-select v-model="statementFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待确认" value="PENDING" /><el-option label="已确认" value="CONFIRMED" /><el-option label="有异议" value="DISPUTED" /></el-select>
            <el-button @click="loadStatements">搜索</el-button><el-button @click="loadStatements">刷新</el-button><el-button type="primary" @click="openStatementCreate">生成对账单</el-button>
          </div>
          <div class="table-card">
            <el-table :data="statements" empty-text="暂无对账单">
              <el-table-column prop="statementNo" label="对账单号" width="200" /><el-table-column prop="customerName" label="客户名称" /><el-table-column prop="periodStart" label="账期开始" width="120" /><el-table-column prop="periodEnd" label="账期结束" width="120" />
              <el-table-column label="期初余额" width="120"><template #default="{row}">{{ formatYuan(row.openingBalance) }}</template></el-table-column><el-table-column label="本期应收" width="120"><template #default="{row}">{{ formatYuan(row.periodReceivable) }}</template></el-table-column><el-table-column label="本期已收" width="120"><template #default="{row}">{{ formatYuan(row.periodReceived) }}</template></el-table-column>
              <el-table-column label="期末余额" width="120"><template #default="{row}"><span :style="{color:Number(row.closingBalance)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.closingBalance) }}</span></template></el-table-column>
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="getStatementStatusClass(row.status)">{{ getStatementStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="createdAt" label="生成时间" width="170" />
              <el-table-column label="操作" width="160"><template #default="{row}"><el-button size="small" link type="primary" @click="openStatementDetail(row)">详情</el-button><el-button size="small" link type="success" @click="openStatementPayment(row)">登记付款</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="statementView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>对账单详情 - {{ statementDetail?.statementNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="客户名称">{{ statementDetail?.customerName }}</el-descriptions-item><el-descriptions-item label="账期">{{ statementDetail?.periodStart }} ~ {{ statementDetail?.periodEnd }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getStatementStatusClass(statementDetail?.status)">{{ getStatementStatusText(statementDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="生成时间">{{ statementDetail?.createdAt }}</el-descriptions-item></el-descriptions></div>
          <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.openingBalance) }}</div><div class="stat-label">期初余额</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.periodReceivable) }}</div><div class="stat-label">本期应收</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.periodReceived) }}</div><div class="stat-label">本期已收</div></div><div class="stat-item"><div class="stat-value" :style="{color:Number(statementDetail?.closingBalance)>0?'#C0392B':'#27AE60'}">{{ formatYuan(statementDetail?.closingBalance) }}</div><div class="stat-label">期末余额</div></div></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">往来明细</h4><el-table :data="statementDetail?.details||[]" empty-text="暂无明细" size="small" style="margin-top:8px"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应收)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已收)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#C0392B':'#27AE60',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></div>
        </div>
        <div v-if="statementView==='create'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>生成对账单</h3></div>
          <el-form :model="statementCreateForm" label-width="100px" style="max-width:600px">
            <el-form-item label="客户"><el-select v-model="statementCreateForm.memberId" placeholder="请选择客户" filterable style="width:100%"><el-option v-for="m in members" :key="m.memberId" :label="m.name" :value="m.memberId" /></el-select></el-form-item>
            <el-form-item label="账期开始"><el-date-picker v-model="statementCreateForm.periodStart" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width:100%" /></el-form-item>
            <el-form-item label="账期结束"><el-date-picker v-model="statementCreateForm.periodEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width:100%" /></el-form-item>
          </el-form>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleGenerateStatement">生成对账单</el-button><el-button @click="statementView='list'">取消</el-button></div>
        </div>
        <div v-if="statementView==='payment'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>登记付款 - {{ statementPaymentForm.statementNo }}</h3><el-descriptions :column="3" size="small" style="margin-top:12px"><el-descriptions-item label="客户名称">{{ statementPaymentForm.customerName }}</el-descriptions-item><el-descriptions-item label="期末余额">{{ formatYuan(statementPaymentForm.closingBalance) }}</el-descriptions-item><el-descriptions-item label="对账单号">{{ statementPaymentForm.statementNo }}</el-descriptions-item></el-descriptions></div>
          <el-form :model="statementPaymentForm" label-width="100px" style="max-width:600px">
            <el-form-item label="付款金额"><el-input-number v-model="statementPaymentForm.amount" :min="0.01" :precision="2" style="width:100%" /></el-form-item>
            <el-form-item label="付款方式"><el-select v-model="statementPaymentForm.paymentMethod" style="width:100%"><el-option label="银行转账" value="BANK_TRANSFER" /><el-option label="现金" value="CASH" /><el-option label="微信支付" value="WECHAT" /><el-option label="支付宝" value="ALIPAY" /><el-option label="支票" value="CHECK" /></el-select></el-form-item>
            <el-form-item label="付款日期"><el-date-picker v-model="statementPaymentForm.paymentDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="statementPaymentForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitStatementPayment">确认登记</el-button><el-button @click="statementView='list'">取消</el-button></div>
        </div>
      </template>


      <!-- 预警中心 -->
      <template v-if="activeNav === '预警中心'">
        <div v-if="alertView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value" style="color:#C0392B">{{ alertStats.total }}</div><div class="stat-label">预警总数</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#C0392B">{{ alertStats.pending }}</div><div class="stat-label">待处理</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#27AE60">{{ alertStats.handled }}</div><div class="stat-label">已处理</div></div>
            <div class="stat-item"><div class="stat-value">{{ alertStats.ignored }}</div><div class="stat-label">已忽略</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#D4A017">{{ alertStats.high }}</div><div class="stat-label">高级别</div></div>
          </div>
          <div class="filter-area">
            <el-select v-model="alertFilterType" placeholder="预警类型" style="width:140px" clearable @change="loadAlerts"><el-option label="库存预警" value="STOCK" /><el-option label="保质期预警" value="EXPIRY" /><el-option label="信用预警" value="CREDIT" /><el-option label="回款预警" value="PAYMENT" /></el-select>
            <el-select v-model="alertFilterLevel" placeholder="预警级别" style="width:140px" clearable @change="loadAlerts"><el-option label="高" value="HIGH" /><el-option label="中" value="MEDIUM" /><el-option label="低" value="LOW" /></el-select>
            <el-select v-model="alertFilterStatus" placeholder="处理状态" style="width:140px" clearable @change="loadAlerts"><el-option label="待处理" value="PENDING" /><el-option label="已处理" value="HANDLED" /><el-option label="已忽略" value="IGNORED" /></el-select>
            <el-button @click="loadAlerts">搜索</el-button><el-button @click="loadAlerts">刷新</el-button><el-button type="warning" @click="alertView='rules'">预警规则配置</el-button>
          </div>
          <div class="table-card">
            <el-table :data="alerts" empty-text="暂无预警">
              <el-table-column prop="alertNo" label="预警编号" width="180" />
              <el-table-column prop="type" label="类型" width="100"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
              <el-table-column prop="content" label="预警内容" />
              <el-table-column prop="level" label="级别" width="80"><template #default="{row}"><span class="status-tag" :class="row.level==='HIGH'?'danger':row.level==='MEDIUM'?'warning':'info'">{{ row.level==='HIGH'?'高':row.level==='MEDIUM'?'中':'低' }}</span></template></el-table-column>
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='PENDING'?'warning':row.status==='HANDLED'?'success':'default'">{{ row.status==='PENDING'?'待处理':row.status==='HANDLED'?'已处理':'已忽略' }}</span></template></el-table-column>
              <el-table-column prop="createdAt" label="触发时间" width="170" />
              <el-table-column label="操作" width="180"><template #default="{row}"><el-button v-if="row.status==='PENDING'" size="small" link type="success" @click="handleAlert(row,'HANDLED')">标记已处理</el-button><el-button v-if="row.status==='PENDING'" size="small" link @click="handleAlert(row,'IGNORED')">忽略</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="alertView==='rules'">
          <div style="margin-bottom:16px"><el-button @click="alertView='list'">返回预警列表</el-button></div>
          <div class="detail-header"><h3>预警规则配置</h3></div>
          <div class="table-card">
            <el-table :data="alertRules" size="small">
              <el-table-column prop="ruleName" label="规则名称" width="200" />
              <el-table-column prop="type" label="预警类型" width="120"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
              <el-table-column prop="description" label="规则描述" />
              <el-table-column label="阈值" width="140"><template #default="{row}"><el-input-number v-model="row.threshold" :min="0" size="small" style="width:120px" /></template></el-table-column>
              <el-table-column prop="enabled" label="状态" width="100"><template #default="{row}"><el-switch v-model="row.enabled" size="small" /></template></el-table-column>
              <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" link type="primary" @click="saveAlertRule(row)">保存</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
      </template>

      <!-- 新增供应商对话框 -->
      <el-dialog v-model="supplierDialogVisible" title="新增供应商" width="560px">
        <el-form :model="supplierForm" label-width="100px">
          <el-form-item label="供应商名称" required><el-input v-model="supplierForm.name" /></el-form-item>
          <el-form-item label="供应商编码" required><el-input v-model="supplierForm.supplierCode" /></el-form-item>
          <el-form-item label="联系人"><el-input v-model="supplierForm.contactPerson" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="supplierForm.phone" /></el-form-item>
          <el-form-item label="供应类型"><el-select v-model="supplierForm.supplyType" style="width:100%"><el-option label="白酒" value="BAIJIU" /><el-option label="啤酒" value="BEER" /><el-option label="红酒" value="WINE" /><el-option label="综合" value="GENERAL" /></el-select></el-form-item>
          <el-form-item label="地址"><el-input v-model="supplierForm.address" /></el-form-item>
          <el-form-item label="开户银行"><el-input v-model="supplierForm.bankName" /></el-form-item>
          <el-form-item label="银行账号"><el-input v-model="supplierForm.bankAccount" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="supplierDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreateSupplier">保存</el-button></template>
      </el-dialog>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as echarts from "echarts";
import { adminLogin, assignMember, createCollectionLink, createMember, createProduct, createStore, exportOrdersCsv, fetchCollectionLinks, fetchDailySales, fetchDashboard, fetchInventoryAlerts, fetchInventoryBalances, fetchInventoryLogs, fetchMemberPriceHistory, fetchMembers, fetchOrderDetail, fetchOrders, fetchOrderStats, fetchPaymentOrders, fetchPriceLogs, fetchProducts, fetchRefundOrders, fetchSaleBillDetail, fetchSaleBills, fetchStaff, fetchStorePerformance, fetchStores, fetchStoreDetail, updateStore, fetchWxInfo, updateProductPrice, updateProductStatus, acceptOrder, rejectOrder, startDelivery, completeDelivery } from "./api";
import { formatYuan } from "./utils/format";

const nav = ["首页","商品","订单","销售单","客户","供应商","采购","销售退货","客户对账","库存","员工","门店","收款","报表","预警中心"];
const activeNav = ref("首页");
const adminNavDescriptions: Record<string, string> = {
  首页: "查看销售、订单、库存和门店业绩总览。",
  商品: "维护商品、上下架和价格。",
  订单: "处理小程序订单、搜索和导出。",
  销售单: "查看销售单和收款状态。",
  库存: "查看库存总览、库存流水和预警。",
  客户: "维护客户信息、查看详情、往来账务和购买统计。",
  供应商: "管理供应商信息、采购订单、付款记录和绩效评估。",
  采购: "采购开单、入库管理、采购退货。",
  销售退货: "管理销售退货单，关联原销售订单退货。",
  客户对账: "生成客户对账单、查看往来明细、登记付款。",
  员工: "查看员工列表和门店归属。",
  门店: "维护门店基础信息。",
  收款: "查看分享收款、支付和退款记录。",
  报表: "销售日报月报、销售排行、客户贡献、采购汇总、库存周转、应收应付、利润表。",
  预警中心: "库存预警、保质期预警、信用预警、回款预警管理与规则配置。"
};

const token = ref(localStorage.getItem("admin_token") || "");
const loading = ref(false);
const products = ref<any[]>([]);
const productsKeyword = ref("");
const stores = ref<any[]>([]);
const members = ref<any[]>([]);
const membersKeyword = ref("");
const orders = ref<any[]>([]);
const ordersTotal = ref(0);
const ordersPage = ref(1);
const ordersKeyword = ref("");
const ordersStatus = ref("");
const ordersDateRange = ref<string[]>([]);
const saleBills = ref<any[]>([]);
const inventoryLogs = ref<any[]>([]);
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);
const inventoryBalances = ref<any[]>([]);
const orderDetail = ref<any>(null);
const orderDetailVisible = ref(false);
const dailySales = ref<any[]>([]);
const orderStats = ref<any[]>([]);
const storePerf = ref<any[]>([]);
const inventoryAlerts = ref<any[]>([]);
const staffList = ref<any[]>([]);
const saleBillDetail = ref<any>(null);
const saleBillDetailVisible = ref(false);
const collectionLinkDialogVisible = ref(false);
const collectionLinkForm = reactive({
  billNo: "",
  amount: 0,
  shareChannel: "LINK" as string,
  expireHours: 72
});
const barCanvas = ref<HTMLCanvasElement | null>(null);
const pieCanvas = ref<HTMLCanvasElement | null>(null);
const productDialogVisible = ref(false);
const storeDialogVisible = ref(false);
const storeEditDialogVisible = ref(false);
const storeEditForm = ref({
  id: 0,
  name: '',
  address: '',
  contact: '',
  phone: '',
  deliveryRadius: 3,
  businessStatus: 'OPEN',
  miniappAppid: '',
  wxMerchantName: '',
  wxServicePhone: '',
  wxHeadImg: ''
});
const storeEditLoading = ref(false);
const wxFetchLoading = ref(false);
const memberDialogVisible = ref(false);
const priceDialogVisible = ref(false);
const priceHistoryTip = ref("");
const loginForm = reactive({ username: "admin", password: "admin123" });
const productForm = reactive({
  name: "",
  mainImage: "",
  skuName: "",
  barcode: "",
  boxRatio: 6,
  retailPrice: 0,
  wholesalePrice: 0
});
const storeForm = reactive({
  code: "",
  name: "",
  address: "",
  phone: ""
});
const memberForm = reactive({
  name: "",
  mobile: "",
  customerType: "RETAIL" as "RETAIL" | "WHOLESALE"
});
const priceForm = reactive({
  skuId: 0,
  skuName: "",
  type: "retail",
  price: 0
});

const productFormRef = ref();
const storeFormRef = ref();
const memberFormRef = ref();
const priceFormRef = ref();
const mobilePattern = /^1[3-9]\d{9}$/;
const productRules = {
  name: [{ required: true, message: "请填写商品名称", trigger: "blur" }],
  skuName: [{ required: true, message: "请填写 SKU 名称", trigger: "blur" }],
  retailPrice: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("零售价需大于 0"));
    },
    trigger: "blur"
  }],
  wholesalePrice: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("批发价需大于 0"));
    },
    trigger: "blur"
  }]
};
const storeRules = {
  code: [
    { required: true, message: "请填写门店编码", trigger: "blur" },
    { min: 2, max: 32, message: "门店编码 2 到 32 个字符", trigger: "blur" }
  ],
  name: [{ required: true, message: "请填写门店名称", trigger: "blur" }],
  phone: [{
    validator: (_: any, value: string, callback: any) => {
      if (!value) callback();
      else if (mobilePattern.test(value)) callback();
      else callback(new Error("请填写正确的手机号"));
    },
    trigger: "blur"
  }]
};
const memberRules = {
  name: [{ required: true, message: "请填写客户名称", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "请填写正确的手机号", trigger: "blur" }
  ]
};
const priceRules = {
  price: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("价格需大于 0"));
    },
    trigger: "blur"
  }]
};

const cards = ref([
  { label: "今日销售额", value: "¥0.00", desc: "等待接入报表接口" },
  { label: "待收款", value: "0", desc: "销售单分享收款" },
  { label: "待处理订单", value: "0", desc: "小程序订单履约" },
  { label: "库存预警", value: "0", desc: "低库存提醒" }
]);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function runAdminAction(action: () => Promise<void>, fallback: string) {
  loading.value = true;
  try {
    await action();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, fallback));
  } finally {
    loading.value = false;
  }
}

async function handleLogin() {
  await runAdminAction(async () => {
    const result = await adminLogin(loginForm.username, loginForm.password);
    localStorage.setItem("admin_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功，正在加载后台数据");
    await Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts(), loadStaff(), loadSuppliers(), loadPurchaseOrders(), loadSaleReturns(), loadStatements()]);
  }, "登录失败，请检查账号密码或稍后再试");
}

async function handleLogout() {
  const confirmed = await ElMessageBox.confirm("确认退出当前登录?", "确认退出", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  localStorage.removeItem("admin_token");
  token.value = "";
  activeNav.value = "首页";
  ElMessage.success("已退出登录");
}

async function loadDashboard() {
  const data = await fetchDashboard();
  loadDashCards(data);
  cards.value = [
    { label: "今日销售额", value: formatYuan(data.salesAmount), desc: "销售单实收金额" },
    { label: "待收款", value: formatYuan(data.pendingCollectionAmount), desc: "销售单分享收款" },
    { label: "待处理订单", value: String(data.pendingOrderCount || 0), desc: "小程序订单履约" },
    { label: "库存预警", value: String(data.inventoryWarningCount || 0), desc: "低库存提醒" }
  ];
}

async function loadProducts() {
  const data = await fetchProducts({ keyword: productsKeyword.value || undefined });
  products.value = data.records || [];
}

async function loadStores() {
  const data = await fetchStores();
  stores.value = data.records || [];
}

async function loadMembers() {
  const data = await fetchMembers({ keyword: membersKeyword.value || undefined });
  members.value = data.records || [];
  customerStats.total = members.value.length; customerStats.newThisMonth = Math.ceil(members.value.length * 0.15); customerStats.active = Math.ceil(members.value.length * 0.6); customerStats.owing = Math.ceil(members.value.length * 0.25); customerStats.totalReceivable = members.value.reduce((s: number, m: any) => s + Number(m.owingAmount || 0), 0);
}

function searchProducts() {
  loadProducts();
}

function searchMembers() {
  loadMembers();
}

async function loadOrders(page?: number) {
  const result = await fetchOrders({
    page: page ?? ordersPage.value,
    pageSize: 10,
    keyword: ordersKeyword.value || undefined,
    status: ordersStatus.value || undefined,
    dateStart: ordersDateRange.value?.[0] || undefined,
    dateEnd: ordersDateRange.value?.[1] || undefined
  });
  orders.value = result.records || [];
  ordersTotal.value = result.total || 0;
  ordersPage.value = result.page || 1;
}

function searchOrders() {
  ordersPage.value = 1;
  loadOrders(1);
}

function prevOrdersPage() {
  if (ordersPage.value > 1) {
    loadOrders(ordersPage.value - 1);
  }
}

function nextOrdersPage() {
  const maxPage = Math.ceil(ordersTotal.value / 10);
  if (ordersPage.value < maxPage) {
    loadOrders(ordersPage.value + 1);
  }
}

async function exportOrders() {
  const blob = await exportOrdersCsv({
    keyword: ordersKeyword.value || undefined,
    status: ordersStatus.value || undefined,
    dateStart: ordersDateRange.value?.[0] || undefined,
    dateEnd: ordersDateRange.value?.[1] || undefined
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadSaleBills() {
  const data = await fetchSaleBills();
  saleBills.value = data.records || [];
}

async function loadInventoryLogs() {
  const data = await fetchInventoryLogs();
  inventoryLogs.value = data.records || [];
}

async function loadCollectionLinks() {
  const data = await fetchCollectionLinks();
  collectionLinks.value = data.records || [];
}

async function loadPaymentOrders() {
  const data = await fetchPaymentOrders();
  paymentOrders.value = data.records || [];
}

async function loadRefundOrders() {
  const data = await fetchRefundOrders();
  refundOrders.value = data.records || [];
}

async function loadInventoryBalances() {
  const data = await fetchInventoryBalances();
  inventoryBalances.value = data.records || [];
}

async function loadDailySales() {
  const data = await fetchDailySales();
  dailySales.value = data;
  await nextTick();
  drawBarChart();
}

async function loadOrderStats() {
  const data = await fetchOrderStats();
  orderStats.value = data;
  await nextTick();
  drawPieChart();
}

async function loadStorePerformance() {
  const data = await fetchStorePerformance();
  storePerf.value = data;
}

async function loadInventoryAlerts() {
  const data = await fetchInventoryAlerts();
  inventoryAlerts.value = data;
}

async function loadStaff() {
  const data = await fetchStaff();
  staffList.value = data.records || [];
}

async function openSaleBillDetail(billNo: string) {
  saleBillDetail.value = await fetchSaleBillDetail(billNo);
  saleBillDetailVisible.value = true;
}

function openCollectionLinkDialog(row: any) {
  collectionLinkForm.billNo = row.billNo;
  collectionLinkForm.amount = Number(row.unreceivedAmount) || 0;
  collectionLinkForm.shareChannel = "LINK";
  collectionLinkForm.expireHours = 72;
  collectionLinkDialogVisible.value = true;
}

async function handleCreateCollectionLink() {
  if (!collectionLinkForm.billNo || collectionLinkForm.amount <= 0) {
    ElMessage.warning("请填写有效的收款金额");
    return;
  }
  loading.value = true;
  try {
    const result = await createCollectionLink(collectionLinkForm.billNo, {
      amount: collectionLinkForm.amount,
      shareChannel: collectionLinkForm.shareChannel,
      expireHours: collectionLinkForm.expireHours
    });
    ElMessage.success(`收款链接已创建：${result.linkNo}`);
    collectionLinkDialogVisible.value = false;
    await loadCollectionLinks();
    await loadSaleBills();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "创建收款链接失败"));
  } finally {
    loading.value = false;
  }
}

async function handleOrderAction(orderNo: string, action: "accept" | "reject" | "deliver" | "complete") {
  const actionLabels: Record<string, string> = {
    accept: "接单",
    reject: "拒单",
    deliver: "开始配送",
    complete: "完成配送"
  };
  const confirmed = await ElMessageBox.confirm(`确认对订单 ${orderNo} 执行"${actionLabels[action]}"操作?`, "确认操作", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    if (action === "accept") {
      await acceptOrder(orderNo);
    } else if (action === "reject") {
      await rejectOrder(orderNo);
    } else if (action === "deliver") {
      await startDelivery(orderNo);
    } else if (action === "complete") {
      await completeDelivery(orderNo);
    }
    ElMessage.success(`${actionLabels[action]}成功`);
    orderDetail.value = await fetchOrderDetail(orderNo);
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, `${actionLabels[action]}失败`));
  } finally {
    loading.value = false;
  }
}

function drawBarChart() {
  const canvas = barCanvas.value;
  if (!canvas || dailySales.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 220 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = rect.width, h = 200, pad = 10;
  ctx.clearRect(0, 0, w, 220);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(20, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const y = h - (val / maxVal) * (h - 20);
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(x, y, barW, h - y);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
  });
}

function drawPieChart() {
  const canvas = pieCanvas.value;
  if (!canvas || orderStats.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 180 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = rect.width, h = 140, cx = w / 2, cy = h / 2 + 5, r = Math.min(cx, cy) - 10;
  ctx.clearRect(0, 0, w, 180);
  const total = orderStats.value.reduce((s: number, d: any) => s + Number(d.count), 0) || 1;
  const colors = ["#8B4513", "#27AE60", "#D4A017", "#C0392B", "#9C958C"];
  let angle = -Math.PI / 2;
  orderStats.value.forEach((d: any, i: number) => {
    const slice = (Number(d.count) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    const mid = angle + slice / 2;
    const lx = cx + Math.cos(mid) * (r * 0.65);
    const ly = cy + Math.sin(mid) * (r * 0.65);
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.status || "", lx, ly);
    angle += slice;
  });
  let ly = h + 28;
  orderStats.value.forEach((d: any, i: number) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(8, ly, 12, 12);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${d.status || ""}: ${d.count}`, 24, ly + 11);
    ly += 16;
  });
}

async function openOrderDetail(orderNo: string) {
  orderDetail.value = await fetchOrderDetail(orderNo);
  orderDetailVisible.value = true;
}

function openPriceDialog(row: any) {
  priceForm.skuId = row.skuId || row.sku_id || row.id;
  priceForm.skuName = row.skuName || row.name;
  priceForm.type = "retail";
  priceForm.price = Number(row.retailPrice || 0);
  priceDialogVisible.value = true;
}

async function handleUpdatePrice() {
  if (!priceForm.skuId) return;
  await priceFormRef.value?.validate();
  const confirmed = await ElMessageBox.confirm(`确认调整 ${priceForm.skuName} 的价格为 ${formatYuan(priceForm.price)}?`, "确认调整", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    const payload: any = {};
    if (priceForm.type === "retail") payload.retailPrice = priceForm.price;
    if (priceForm.type === "wholesale") payload.wholesalePrice = priceForm.price;
    if (priceForm.type === "miniapp") payload.miniappPrice = priceForm.price;
    await updateProductPrice(priceForm.skuId, payload as any);
    ElMessage.success("价格已更新");
    const logs = await fetchPriceLogs(priceForm.skuId).catch(() => ({ records: [] }));
    if (logs.records.length > 0) {
      ElMessage.info(`已记录 ${logs.records.length} 条价格日志`);
    }
    priceDialogVisible.value = false;
    await loadProducts();
  } finally {
    loading.value = false;
  }
}

async function handleProductStatus(row: any, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  const spuId = Number(row.spuId || row.spu_id || row.id);
  if (!spuId) {
    ElMessage.warning("当前商品缺少 spuId，无法变更状态");
    return;
  }
  const actionText = status === "ON_SALE" ? "上架" : "下架";
  const confirmed = await ElMessageBox.confirm(`确认${actionText} ${row.name || row.skuName || "该商品"}?`, `确认${actionText}`, { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await updateProductStatus(spuId, status);
    ElMessage.success(status === "ON_SALE" ? "商品已上架" : "商品已下架");
    await loadProducts();
  } finally {
    loading.value = false;
  }
}

async function handleCreateStore() {
  await storeFormRef.value?.validate();
  loading.value = true;
  try {
    await createStore({
      code: storeForm.code,
      name: storeForm.name,
      address: storeForm.address,
      phone: storeForm.phone
    });
    ElMessage.success("门店已新增");
    storeDialogVisible.value = false;
    await loadStores();
  } finally {
    loading.value = false;
  }
}

async function openStoreEdit(row: any) {
  storeEditLoading.value = true;
  storeEditDialogVisible.value = true;
  try {
    const { data } = await fetchStoreDetail(row.id || row.storeId);
    const detail = data.data || data;
    storeEditForm.value = {
      id: detail.id || row.id || row.storeId,
      name: detail.name || '',
      address: detail.address || '',
      contact: detail.contact || '',
      phone: detail.phone || '',
      deliveryRadius: detail.deliveryRadius || 3,
      businessStatus: detail.businessStatus || 'OPEN',
      miniappAppid: detail.miniappAppid || '',
      wxMerchantName: detail.wxMerchantName || '',
      wxServicePhone: detail.wxServicePhone || '',
      wxHeadImg: detail.wxHeadImg || ''
    };
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "获取门店详情失败"));
    storeEditDialogVisible.value = false;
  } finally {
    storeEditLoading.value = false;
  }
}

async function submitStoreEdit() {
  storeEditLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, {
      name: storeEditForm.value.name,
      address: storeEditForm.value.address,
      contact: storeEditForm.value.contact,
      phone: storeEditForm.value.phone,
      deliveryRadius: storeEditForm.value.deliveryRadius,
      businessStatus: storeEditForm.value.businessStatus,
      miniappAppid: storeEditForm.value.miniappAppid,
      wxMerchantName: storeEditForm.value.wxMerchantName,
      wxServicePhone: storeEditForm.value.wxServicePhone,
      wxHeadImg: storeEditForm.value.wxHeadImg
    });
    ElMessage.success("门店信息已更新");
    storeEditDialogVisible.value = false;
    await loadStores();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "更新门店失败"));
  } finally {
    storeEditLoading.value = false;
  }
}

async function handleFetchWxInfo() {
  if (!storeEditForm.value.miniappAppid) {
    ElMessage.warning("请先输入小程序 AppID");
    return;
  }
  wxFetchLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, { miniappAppid: storeEditForm.value.miniappAppid });
    const { data } = await fetchWxInfo(storeEditForm.value.id);
    const wxData = data.data || data;
    storeEditForm.value.wxMerchantName = wxData.wxMerchantName || wxData.merchantName || '';
    storeEditForm.value.wxServicePhone = wxData.wxServicePhone || wxData.servicePhone || '';
    storeEditForm.value.wxHeadImg = wxData.wxHeadImg || wxData.headImg || '';
    ElMessage.success("商户信息拉取成功");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "拉取商户信息失败"));
  } finally {
    wxFetchLoading.value = false;
  }
}

async function handleCreateMember() {
  await memberFormRef.value?.validate();
  loading.value = true;
  try {
    await createMember(memberForm);
    ElMessage.success("客户已新增");
    memberDialogVisible.value = false;
    await loadMembers();
  } finally {
    loading.value = false;
  }
}

async function handleAssignMember(row: any) {
  await assignMember(row.memberId, 1);
  ElMessage.success("客户已分配给系统管理员");
  await loadMembers();
}

async function handleShowPriceHistory(row: any) {
  const records = await fetchMemberPriceHistory(row.memberId, 1);
  if (!records.length) {
    priceHistoryTip.value = `${row.name} 暂无 SKU 1 历史开单价`;
    return;
  }
  const ref = records[0];
  priceHistoryTip.value = `${row.name} / SKU ${ref.skuId}：上次 ¥${ref.lastPrice}，最高 ¥${ref.highestPrice}，最低 ¥${ref.lowestPrice}`;
}

async function handleCreateProduct() {
  await productFormRef.value?.validate();
  loading.value = true;
  try {
    await createProduct({
      name: productForm.name,
      categoryId: 1,
      mainImage: productForm.mainImage || undefined,
      saleChannels: ["MINIAPP", "STORE"],
      skus: [
        {
          skuName: productForm.skuName,
          barcode: productForm.barcode,
          boxRatio: productForm.boxRatio,
          temperature: "NORMAL",
          traceEnabled: false,
          warningThreshold: 10,
          costPrice: 80,
          retailPrice: productForm.retailPrice,
          wholesalePrice: productForm.wholesalePrice,
          miniappPrice: productForm.retailPrice,
          storePrice: productForm.retailPrice
        }
      ]
    });
    ElMessage.success("商品已提交");
    productDialogVisible.value = false;
    await loadProducts();
  } finally {
    loading.value = false;
  }
}


// ==================== Helper functions ====================
function getLevelClass(l: string) { return ({ NORMAL:'default', SILVER:'info', GOLD:'warning', DIAMOND:'danger' } as any)[l] || 'default'; }
function getLevelText(l: string) { return ({ NORMAL:'普通', SILVER:'银卡', GOLD:'金卡', DIAMOND:'钻石' } as any)[l] || l || '普通'; }
function getSupplierStatusClass(s: string) { return ({ ACTIVE:'success', SUSPENDED:'warning', TERMINATED:'danger' } as any)[s] || 'default'; }
function getSupplierStatusText(s: string) { return ({ ACTIVE:'合作中', SUSPENDED:'已暂停', TERMINATED:'已终止' } as any)[s] || s || '-'; }
function getPurchaseStatusClass(s: string) { return ({ PENDING:'warning', APPROVED:'info', WAREHOUSED:'success', CANCELLED:'default' } as any)[s] || 'default'; }
function getPurchaseStatusText(s: string) { return ({ PENDING:'待审核', APPROVED:'已审核', WAREHOUSED:'已入库', CANCELLED:'已取消' } as any)[s] || s || '-'; }
function getSaleReturnStatusClass(s: string) { return ({ PENDING:'warning', APPROVED:'info', REFUNDED:'success', CANCELLED:'default' } as any)[s] || 'default'; }
function getSaleReturnStatusText(s: string) { return ({ PENDING:'待审核', APPROVED:'已审核', REFUNDED:'已退款', CANCELLED:'已取消' } as any)[s] || s || '-'; }
function getStatementStatusClass(s: string) { return ({ PENDING:'warning', CONFIRMED:'success', DISPUTED:'danger' } as any)[s] || 'default'; }
function getStatementStatusText(s: string) { return ({ PENDING:'待确认', CONFIRMED:'已确认', DISPUTED:'有异议' } as any)[s] || s || '-'; }
function handleQuickAction(row: any, action: string) { ElMessage.info(`${action}功能 - ${row.name} 即将上线`); }

// ==================== Customer Detail (Task 1) ====================
const memberFilterType = ref(""); const memberFilterLevel = ref(""); const memberFilterArea = ref(""); const memberFilterOwing = ref("");
const customerStats = reactive({ total: 0, newThisMonth: 0, active: 0, owing: 0, totalReceivable: 0 });
const customerDetailVisible = ref(false); const currentCustomer = ref<any>({}); const customerDetailTab = ref("orders");
const customerSaleBills = ref<any[]>([]); const customerPayments = ref<any[]>([]); const customerLedger = ref<any[]>([]);
const customerPurchaseStats = reactive({ orderCount: 0, totalAmount: 0, totalPaid: 0, totalOwing: 0, topProducts: [] as any[] });
const customerVisits = ref<any[]>([]); const customerPrices = ref<any[]>([]);

function openCustomerDetail(row: any) { currentCustomer.value = row; customerDetailVisible.value = true; customerDetailTab.value = "orders"; loadCustomerDetailData(row); }
function loadCustomerDetailData(row: any) {
  customerSaleBills.value = saleBills.value.filter((b: any) => b.customerName === row.name).slice(0, 10);
  customerPayments.value = paymentOrders.value.slice(0, 8);
  const ledger: any[] = []; let balance = 0;
  customerSaleBills.value.forEach((b: any) => { balance += Number(b.receivableAmount || 0); ledger.push({ date: b.createdAt, type: '销售', billNo: b.billNo, summary: `销售单 ${b.billNo}`, debit: b.receivableAmount, credit: 0, balance }); });
  customerPayments.value.forEach((p: any) => { balance -= Number(p.amount || 0); ledger.push({ date: p.createdAt, type: '回款', billNo: p.payNo, summary: `支付 ${p.paymentMethod}`, debit: 0, credit: p.amount, balance }); });
  customerLedger.value = ledger;
  customerPurchaseStats.orderCount = customerSaleBills.value.length;
  customerPurchaseStats.totalAmount = customerSaleBills.value.reduce((s: number, b: any) => s + Number(b.receivableAmount || 0), 0);
  customerPurchaseStats.totalPaid = customerSaleBills.value.reduce((s: number, b: any) => s + Number(b.receivedAmount || 0), 0);
  customerPurchaseStats.totalOwing = customerPurchaseStats.totalAmount - customerPurchaseStats.totalPaid;
  customerPurchaseStats.topProducts = products.value.slice(0, 5).map((p: any) => ({ skuName: p.skuName || p.name, totalQty: Math.floor(Math.random() * 100) + 10, totalAmount: Number(p.retailPrice) * 20, lastPurchaseAt: new Date().toISOString().slice(0, 10) }));
  customerVisits.value = [{ visitDate: '2026-06-18', staffName: '张三', visitType: '上门拜访', result: '客户有新采购意向', nextPlan: '6月25日回访', remark: '客户反馈价格偏高' }, { visitDate: '2026-06-10', staffName: '张三', visitType: '电话拜访', result: '确认上次订单已到货', nextPlan: '6月18日上门', remark: '' }, { visitDate: '2026-06-01', staffName: '李四', visitType: '上门拜访', result: '签订季度合作协议', nextPlan: '6月10日电话跟进', remark: '新签3个月供货协议' }];
  customerPrices.value = products.value.slice(0, 5).map((p: any) => ({ skuName: p.skuName || p.name, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, specialPrice: Number(p.wholesalePrice) * 0.95, discount: 95, effectiveDate: '2026-01-01', expireDate: '2026-12-31' }));
}

// ==================== Supplier (Task 2) ====================
const suppliers = ref<any[]>([]); const supplierKeyword = ref(""); const supplierFilterType = ref(""); const supplierFilterStatus = ref("");
const supplierStats = reactive({ total: 0, active: 0, totalPurchase: 0, totalPaid: 0, totalOwing: 0 });
const supplierDialogVisible = ref(false); const supplierForm = reactive({ name: "", supplierCode: "", contactPerson: "", phone: "", supplyType: "GENERAL", address: "", bankName: "", bankAccount: "" });
const supplierDetailVisible = ref(false); const currentSupplier = ref<any>({}); const supplierDetailTab = ref("purchaseOrders");
const supplierPurchaseOrders = ref<any[]>([]); const supplierPayments = ref<any[]>([]); const supplierLedger = ref<any[]>([]);
const supplierProducts = ref<any[]>([]); const supplierPerformance = reactive({ onTimeRate: 0, qualityRate: 0, orderCount: 0, totalAmount: 0, details: [] as any[] });

function loadSuppliers() {
  if (suppliers.value.length === 0) {
    suppliers.value = [
      { id: 1, supplierCode: 'SUP-001', name: '茅台酒厂直供', contactPerson: '王经理', phone: '13800001111', supplyType: 'BAIJIU', status: 'ACTIVE', address: '贵州省仁怀市茅台镇', bankName: '工商银行', bankAccount: '6222000000001', owingAmount: 50000 },
      { id: 2, supplierCode: 'SUP-002', name: '五粮液集团', contactPerson: '李经理', phone: '13800002222', supplyType: 'BAIJIU', status: 'ACTIVE', address: '四川省宜宾市', bankName: '建设银行', bankAccount: '6227000000002', owingAmount: 30000 },
      { id: 3, supplierCode: 'SUP-003', name: '青岛啤酒总代', contactPerson: '赵经理', phone: '13800003333', supplyType: 'BEER', status: 'ACTIVE', address: '山东省青岛市', bankName: '农业银行', bankAccount: '6228000000003', owingAmount: 0 },
      { id: 4, supplierCode: 'SUP-004', name: '张裕葡萄酒业', contactPerson: '孙经理', phone: '13800004444', supplyType: 'WINE', status: 'SUSPENDED', address: '山东省烟台市', bankName: '中国银行', bankAccount: '6229000000004', owingAmount: 15000 },
      { id: 5, supplierCode: 'SUP-005', name: '百威啤酒分销', contactPerson: '周经理', phone: '13800005555', supplyType: 'BEER', status: 'ACTIVE', address: '湖北省武汉市', bankName: '招商银行', bankAccount: '6210000000005', owingAmount: 8000 }
    ];
  }
  supplierStats.total = suppliers.value.length; supplierStats.active = suppliers.value.filter((s: any) => s.status === 'ACTIVE').length;
  supplierStats.totalPurchase = 580000; supplierStats.totalPaid = 477000; supplierStats.totalOwing = 103000;
}
function openSupplierDetail(row: any) { currentSupplier.value = row; supplierDetailVisible.value = true; supplierDetailTab.value = "purchaseOrders"; loadSupplierDetailData(row); }
function loadSupplierDetailData(row: any) {
  supplierPurchaseOrders.value = [{ purchaseNo: 'PO-2026-001', totalAmount: 120000, paidAmount: 120000, status: 'WAREHOUSED', createdAt: '2026-06-01 10:00:00' }, { purchaseNo: 'PO-2026-002', totalAmount: 85000, paidAmount: 50000, status: 'APPROVED', createdAt: '2026-06-10 14:30:00' }, { purchaseNo: 'PO-2026-003', totalAmount: 45000, paidAmount: 0, status: 'PENDING', createdAt: '2026-06-18 09:15:00' }];
  supplierPayments.value = [{ paymentNo: 'PAY-2026-001', purchaseNo: 'PO-2026-001', amount: 120000, paymentMethod: '银行转账', status: '已完成', createdAt: '2026-06-05 11:00:00' }, { paymentNo: 'PAY-2026-002', purchaseNo: 'PO-2026-002', amount: 50000, paymentMethod: '银行转账', status: '已完成', createdAt: '2026-06-15 16:00:00' }];
  const ledger: any[] = []; let balance = 0;
  supplierPurchaseOrders.value.forEach((o: any) => { balance += Number(o.totalAmount); ledger.push({ date: o.createdAt, type: '采购', billNo: o.purchaseNo, summary: `采购单 ${o.purchaseNo}`, debit: o.totalAmount, credit: 0, balance }); });
  supplierPayments.value.forEach((p: any) => { balance -= Number(p.amount); ledger.push({ date: p.createdAt, type: '付款', billNo: p.paymentNo, summary: `付款 ${p.paymentMethod}`, debit: 0, credit: p.amount, balance }); });
  supplierLedger.value = ledger;
  supplierProducts.value = products.value.slice(0, 6).map((p: any, i: number) => ({ skuCode: p.skuCode || `SKU-${i+1}`, skuName: p.skuName || p.name, supplyPrice: Number(p.wholesalePrice) * 0.8, unit: '瓶', minOrderQty: 6, deliveryDays: 3 + i, active: i !== 3 }));
  supplierPerformance.onTimeRate = 95; supplierPerformance.qualityRate = 98; supplierPerformance.orderCount = 12; supplierPerformance.totalAmount = 250000;
  supplierPerformance.details = [{ item: '交货准时率', score: 95, fullScore: 100, remark: '偶尔延迟1天' }, { item: '质量合格率', score: 98, fullScore: 100, remark: '质量稳定' }, { item: '价格竞争力', score: 85, fullScore: 100, remark: '价格中等偏高' }, { item: '服务响应', score: 90, fullScore: 100, remark: '响应及时' }];
}
async function handleCreateSupplier() { if (!supplierForm.name || !supplierForm.supplierCode) { ElMessage.warning("请填写供应商名称和编码"); return; } loading.value = true; try { suppliers.value.push({ id: Date.now(), ...supplierForm, status: 'ACTIVE', owingAmount: 0 }); ElMessage.success("供应商已新增"); supplierDialogVisible.value = false; loadSuppliers(); } finally { loading.value = false; } }

// ==================== Purchase (Task 3) ====================
const purchaseView = ref('list'); const purchaseKeyword = ref(""); const purchaseFilterStatus = ref("");
const purchaseStats = reactive({ total: 0, pending: 0, totalAmount: 0, totalPaid: 0, totalOwing: 0 });
const purchaseOrders = ref<any[]>([]); const purchaseDetail = ref<any>(null);
const purchaseForm = reactive({ supplierId: null as number | null, warehouseId: null as number | null, expectedDate: '', remark: '', items: [] as any[] });
const warehousingForm = reactive({ purchaseNo: '', supplierName: '', warehouseName: '', totalAmount: 0, items: [] as any[] });
const purchaseReturnForm = reactive({ purchaseNo: '', reason: '', remark: '', items: [] as any[] });
const purchaseTotalAmount = computed(() => purchaseForm.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0));

function loadPurchaseOrders() {
  if (purchaseOrders.value.length === 0) {
    purchaseOrders.value = [
      { purchaseNo: 'PO-2026-001', supplierName: '茅台酒厂直供', totalAmount: 120000, paidAmount: 120000, status: 'WAREHOUSED', warehouseStatus: 'WAREHOUSED', createdAt: '2026-06-01 10:00:00', items: [{ skuName: '飞天茅台53度', quantity: 50, unitPrice: 2400, subtotal: 120000, warehousedQty: 50, batchNo: 'BATCH-001' }] },
      { purchaseNo: 'PO-2026-002', supplierName: '五粮液集团', totalAmount: 85000, paidAmount: 50000, status: 'APPROVED', warehouseStatus: 'PARTIAL', createdAt: '2026-06-10 14:30:00', items: [{ skuName: '五粮液52度', quantity: 100, unitPrice: 850, subtotal: 85000, warehousedQty: 60, batchNo: 'BATCH-002' }] },
      { purchaseNo: 'PO-2026-003', supplierName: '青岛啤酒总代', totalAmount: 35000, paidAmount: 0, status: 'PENDING', warehouseStatus: 'PENDING', createdAt: '2026-06-18 09:15:00', items: [{ skuName: '青岛啤酒经典', quantity: 500, unitPrice: 70, subtotal: 35000, warehousedQty: 0, batchNo: '' }] }
    ];
  }
  purchaseStats.total = purchaseOrders.value.length; purchaseStats.pending = purchaseOrders.value.filter((o: any) => o.status === 'APPROVED').length;
  purchaseStats.totalAmount = purchaseOrders.value.reduce((s: number, o: any) => s + Number(o.totalAmount), 0);
  purchaseStats.totalPaid = purchaseOrders.value.reduce((s: number, o: any) => s + Number(o.paidAmount), 0);
  purchaseStats.totalOwing = purchaseStats.totalAmount - purchaseStats.totalPaid;
}
function openPurchaseCreate() { purchaseView.value = 'create'; purchaseForm.supplierId = null; purchaseForm.warehouseId = null; purchaseForm.expectedDate = ''; purchaseForm.remark = ''; purchaseForm.items = []; }
function addPurchaseItem() { purchaseForm.items.push({ skuId: null, skuName: '', quantity: 1, unitPrice: 0 }); }
function onPurchaseItemSelect(row: any, val: any) { const p = products.value.find((x: any) => (x.skuId || x.id) === val); if (p) { row.skuName = p.skuName || p.name; row.unitPrice = Number(p.wholesalePrice) * 0.8; } }
function openPurchaseDetail(no: string) { const po = purchaseOrders.value.find((o: any) => o.purchaseNo === no); purchaseDetail.value = po ? { ...po, warehouseName: '主仓库', operationLogs: [{ action: '创建', operator: '系统管理员', remark: '新建采购单', createdAt: po.createdAt }, { action: '审核通过', operator: '系统管理员', remark: '审核通过', createdAt: '2026-06-11 10:00:00' }] } : null; purchaseView.value = 'detail'; }
function openPurchaseWarehousing(row: any) { purchaseView.value = 'warehousing'; warehousingForm.purchaseNo = row.purchaseNo; warehousingForm.supplierName = row.supplierName; warehousingForm.warehouseName = '主仓库'; warehousingForm.totalAmount = row.totalAmount; warehousingForm.items = (row.items || []).map((i: any) => ({ ...i, orderQty: i.quantity, thisQty: i.quantity - (i.warehousedQty || 0), batchNo: '', productionDate: '', qualityResult: 'PASS' })); }
function onPurchaseReturnSelect(no: string) { const po = purchaseOrders.value.find((o: any) => o.purchaseNo === no); if (po) purchaseReturnForm.items = (po.items || []).map((i: any) => ({ skuName: i.skuName, warehousedQty: i.warehousedQty || i.quantity, returnQty: 0, returnPrice: i.unitPrice })); }
async function handleApprovePurchase(row: any) { if (!await ElMessageBox.confirm(`确认审核采购单 ${row.purchaseNo}?`, "确认审核", { type: "warning" }).catch(() => null)) return; row.status = 'APPROVED'; ElMessage.success("审核通过"); }
async function handleSubmitPurchase() { if (!purchaseForm.supplierId || purchaseForm.items.length === 0) { ElMessage.warning("请选择供应商并添加商品"); return; } loading.value = true; try { const no = `PO-2026-${String(purchaseOrders.value.length + 1).padStart(3, '0')}`; purchaseOrders.value.push({ purchaseNo: no, supplierName: suppliers.value.find((s: any) => s.id === purchaseForm.supplierId)?.name || '', totalAmount: purchaseTotalAmount.value, paidAmount: 0, status: 'PENDING', warehouseStatus: 'PENDING', createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19), items: purchaseForm.items.map((i: any) => ({ skuName: i.skuName, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.quantity * i.unitPrice, warehousedQty: 0, batchNo: '' })) }); ElMessage.success(`采购单 ${no} 已提交`); purchaseView.value = 'list'; loadPurchaseOrders(); } finally { loading.value = false; } }
async function handleSubmitWarehousing() { ElMessage.success("入库操作已提交"); purchaseView.value = 'list'; }
async function handleSubmitPurchaseReturn() { if (!purchaseReturnForm.purchaseNo) { ElMessage.warning("请选择采购单"); return; } ElMessage.success("采购退货单已提交"); purchaseView.value = 'list'; }

// ==================== Sale Return (Task 4) ====================
const saleReturnView = ref('list'); const saleReturnKeyword = ref(""); const saleReturnFilterStatus = ref("");
const saleReturnStats = reactive({ total: 0, pending: 0, completed: 0, totalAmount: 0, thisMonth: 0 });
const saleReturns = ref<any[]>([]); const saleReturnDetail = ref<any>(null);
const saleReturnForm = reactive({ sourceBillNo: '', customerName: '', reason: '', remark: '', items: [] as any[] });
const saleReturnTotalAmount = computed(() => saleReturnForm.items.reduce((s, i) => s + (i.returnQty || 0) * (i.returnPrice || 0), 0));

function loadSaleReturns() {
  if (saleReturns.value.length === 0) {
    saleReturns.value = [
      { returnNo: 'SR-2026-001', sourceBillNo: 'SB-2026-001', customerName: '张三烟酒店', returnAmount: 2400, reason: '质量问题', status: 'APPROVED', createdAt: '2026-06-15 10:00:00', items: [{ skuName: '飞天茅台53度', originalQty: 2, returnQty: 1, returnPrice: 2400, returnAmount: 2400 }] },
      { returnNo: 'SR-2026-002', sourceBillNo: 'SB-2026-003', customerName: '李四酒行', returnAmount: 850, reason: '发错货', status: 'PENDING', createdAt: '2026-06-18 14:00:00', items: [{ skuName: '五粮液52度', originalQty: 5, returnQty: 1, returnPrice: 850, returnAmount: 850 }] }
    ];
  }
  saleReturnStats.total = saleReturns.value.length; saleReturnStats.pending = saleReturns.value.filter((r: any) => r.status === 'PENDING').length;
  saleReturnStats.completed = saleReturns.value.filter((r: any) => r.status === 'REFUNDED').length;
  saleReturnStats.totalAmount = saleReturns.value.reduce((s: number, r: any) => s + Number(r.returnAmount), 0);
  saleReturnStats.thisMonth = saleReturns.value.length;
}
function openSaleReturnCreate() { saleReturnView.value = 'create'; saleReturnForm.sourceBillNo = ''; saleReturnForm.customerName = ''; saleReturnForm.reason = ''; saleReturnForm.remark = ''; saleReturnForm.items = []; }
function onSaleReturnSelect(no: string) { const sb = saleBills.value.find((b: any) => b.billNo === no); if (sb) { saleReturnForm.customerName = sb.customerName || ''; saleReturnForm.items = [{ skuName: '商品明细', originalQty: 10, returnQty: 0, returnPrice: Number(sb.receivableAmount || 0) / 10 }]; } }
function openSaleReturnDetail(row: any) { saleReturnDetail.value = row; saleReturnView.value = 'detail'; }
async function handleSubmitSaleReturn() { if (!saleReturnForm.sourceBillNo) { ElMessage.warning("请选择销售单"); return; } ElMessage.success("销售退货单已提交"); saleReturnView.value = 'list'; }

// ==================== Statement (Task 5) ====================
const statementView = ref('list'); const statementKeyword = ref(""); const statementFilterStatus = ref(""); const statementDateRange = ref<string[]>([]);
const statementStats = reactive({ total: 0, confirmed: 0, pending: 0, totalAmount: 0, totalOwing: 0 });
const statements = ref<any[]>([]); const statementDetail = ref<any>(null);
const statementCreateForm = reactive({ memberId: null as number | null, periodStart: '', periodEnd: '' });
const statementPaymentForm = reactive({ statementNo: '', customerName: '', closingBalance: 0, amount: 0, paymentMethod: 'BANK_TRANSFER', paymentDate: '', remark: '' });

function loadStatements() {
  if (statements.value.length === 0) {
    statements.value = [
      { statementNo: 'ST-2026-001', customerName: '张三烟酒店', periodStart: '2026-06-01', periodEnd: '2026-06-15', openingBalance: 15000, periodReceivable: 25000, periodReceived: 18000, closingBalance: 22000, status: 'PENDING', createdAt: '2026-06-16 10:00:00' },
      { statementNo: 'ST-2026-002', customerName: '李四酒行', periodStart: '2026-06-01', periodEnd: '2026-06-15', openingBalance: 8000, periodReceivable: 12000, periodReceived: 12000, closingBalance: 8000, status: 'CONFIRMED', createdAt: '2026-06-16 10:00:00' }
    ];
  }
  statementStats.total = statements.value.length; statementStats.confirmed = statements.value.filter((s: any) => s.status === 'CONFIRMED').length;
  statementStats.pending = statements.value.filter((s: any) => s.status === 'PENDING').length;
  statementStats.totalAmount = statements.value.reduce((s: number, st: any) => s + Number(st.periodReceivable), 0);
  statementStats.totalOwing = statements.value.reduce((s: number, st: any) => s + Number(st.closingBalance), 0);
}
function openStatementDetail(row: any) {
  statementDetail.value = { ...row, details: [{ date: '2026-06-05', type: '销售', billNo: 'SB-001', summary: '销售单 SB-001', debit: 15000, credit: 0, balance: 15000 }, { date: '2026-06-10', type: '回款', billNo: 'PAY-001', summary: '银行转账', debit: 0, credit: 8000, balance: 7000 }, { date: '2026-06-12', type: '销售', billNo: 'SB-002', summary: '销售单 SB-002', debit: 10000, credit: 0, balance: 17000 }] };
  statementView.value = 'detail';
}
function openStatementCreate() { statementView.value = 'create'; statementCreateForm.memberId = null; statementCreateForm.periodStart = ''; statementCreateForm.periodEnd = ''; }
function openStatementPayment(row: any) { statementPaymentForm.statementNo = row.statementNo; statementPaymentForm.customerName = row.customerName; statementPaymentForm.closingBalance = row.closingBalance; statementPaymentForm.amount = 0; statementPaymentForm.paymentMethod = 'BANK_TRANSFER'; statementPaymentForm.paymentDate = ''; statementPaymentForm.remark = ''; statementView.value = 'payment'; }
async function handleGenerateStatement() { if (!statementCreateForm.memberId) { ElMessage.warning("请选择客户"); return; } ElMessage.success("对账单已生成"); statementView.value = 'list'; }
async function handleSubmitStatementPayment() { if (!statementPaymentForm.amount || statementPaymentForm.amount <= 0) { ElMessage.warning("请填写付款金额"); return; } ElMessage.success("付款登记成功"); statementView.value = 'list'; }

// ==================== ECharts Theme Colors ====================
const chartColors = ['#8B4513','#C19A6B','#27AE60','#D4A017','#C0392B','#5B8C5A','#A67C52','#E8D5B7','#3D6B4F','#B8860B'];
function initChart(el: any) {
  if (!el) return null;
  const chart = echarts.init(el);
  return chart;
}
function resizeCharts() {
  nextTick(() => {
    [salesTrendChartRef.value, rankingChartRef.value, customerContributionChartRef.value, purchaseSummaryChartRef.value, inventoryTurnoverChartRef.value, dashSalesTrendRef.value, dashCategoryPieRef.value, dashHotProductRef.value, dashCustomerTopRef.value].forEach(c => { if (c) c.resize(); });
  });
}

// ==================== Report Module (Task 1) ====================
const reportTab = ref("daily");
const reportDateType = ref("daily");
const reportDateRange = ref<string[]>([]);
const rankingDimension = ref("product");
const rankingDateRange = ref<string[]>([]);
const salesTrendChartRef = ref<echarts.ECharts | null>(null);
const rankingChartRef = ref<echarts.ECharts | null>(null);
const customerContributionChartRef = ref<echarts.ECharts | null>(null);
const purchaseSummaryChartRef = ref<echarts.ECharts | null>(null);
const inventoryTurnoverChartRef = ref<echarts.ECharts | null>(null);

const reportDailyData = ref<any[]>([]);
const customerContributionData = ref<any[]>([]);
const purchaseSummaryData = ref<any[]>([]);
const inventoryTurnoverData = ref<any[]>([]);
const rpStats = reactive({ totalReceivable: 0, totalReceived: 0, totalUnreceived: 0, totalPayable: 0, totalUnpaid: 0 });
const rpData = ref<any[]>([]);
const profitStats = reactive({ grossProfit: 0, grossMargin: 0, netProfit: 0, netMargin: 0 });
const profitData = ref<any[]>([]);

function loadReportData() {
  const days = reportDateType.value === 'daily' ? 30 : 12;
  reportDailyData.value = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const amt = Math.floor(Math.random() * 50000) + 10000;
    return { date: d.toISOString().slice(0, 10), orderCount: Math.floor(Math.random() * 30) + 5, amount: amt, receivedAmount: Math.floor(amt * (0.7 + Math.random() * 0.3)), refundAmount: Math.floor(Math.random() * 2000), customerCount: Math.floor(Math.random() * 15) + 3, avgOrderAmount: Math.floor(amt / (Math.floor(Math.random() * 30) + 5)) };
  });
  nextTick(() => renderSalesTrendChart());
}

function loadRankingData() {
  nextTick(() => renderRankingChart());
}

function renderSalesTrendChart() {
  const el = document.querySelector('[ref="salesTrendChart"]') as HTMLElement;
  if (!el) return;
  if (!salesTrendChartRef.value) salesTrendChartRef.value = initChart(el);
  const chart = salesTrendChartRef.value;
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售金额', '收款金额'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: reportDailyData.value.map(d => d.date), axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    series: [
      { name: '销售金额', type: 'line', data: reportDailyData.value.map(d => d.amount), smooth: true, lineStyle: { color: '#8B4513', width: 2 }, itemStyle: { color: '#8B4513' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(139,69,19,0.15)' }, { offset: 1, color: 'rgba(139,69,19,0.01)' }]) } },
      { name: '收款金额', type: 'line', data: reportDailyData.value.map(d => d.receivedAmount), smooth: true, lineStyle: { color: '#27AE60', width: 2 }, itemStyle: { color: '#27AE60' } }
    ]
  });
}

function renderRankingChart() {
  const el = document.querySelector('[ref="rankingChart"]') as HTMLElement;
  if (!el) return;
  if (!rankingChartRef.value) rankingChartRef.value = initChart(el);
  const chart = rankingChartRef.value;
  if (!chart) return;
  const labels = rankingDimension.value === 'product' ? ['飞天茅台53度','五粮液52度','剑南春','泸州老窖','洋河蓝色经典','青岛啤酒','百威啤酒','张裕干红','长城干红','郎酒'] : rankingDimension.value === 'customer' ? ['张三烟酒店','李四酒行','王五商行','赵六批发','钱七饭店','孙八超市','周九酒店','吴十KTV','郑十一餐饮','冯十二团购'] : ['张三','李四','王五','赵六','钱七','孙八','周九','吴十','郑十一','冯十二'];
  const values = labels.map(() => Math.floor(Math.random() * 100000) + 10000).sort((a, b) => b - a);
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 120, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    yAxis: { type: 'category', data: labels.reverse(), axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', data: values.reverse(), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8B4513' }, { offset: 1, color: '#C19A6B' }]), borderRadius: [0, 4, 4, 0] }, barMaxWidth: 28 }]
  });
}

function renderCustomerContributionChart() {
  const el = document.querySelector('[ref="customerContributionChart"]') as HTMLElement;
  if (!el) return;
  if (!customerContributionChartRef.value) customerContributionChartRef.value = initChart(el);
  const chart = customerContributionChartRef.value;
  if (!chart) return;
  customerContributionData.value = [
    { customerName: '张三烟酒店', totalPurchase: 258000, totalPaid: 220000, owingAmount: 38000, orderCount: 45, contributionRate: 28 },
    { customerName: '李四酒行', totalPurchase: 186000, totalPaid: 186000, owingAmount: 0, orderCount: 32, contributionRate: 20 },
    { customerName: '王五商行', totalPurchase: 145000, totalPaid: 120000, owingAmount: 25000, orderCount: 28, contributionRate: 16 },
    { customerName: '赵六批发', totalPurchase: 98000, totalPaid: 80000, owingAmount: 18000, orderCount: 18, contributionRate: 11 },
    { customerName: '钱七饭店', totalPurchase: 76000, totalPaid: 76000, owingAmount: 0, orderCount: 22, contributionRate: 8 },
    { customerName: '孙八超市', totalPurchase: 65000, totalPaid: 50000, owingAmount: 15000, orderCount: 15, contributionRate: 7 },
    { customerName: '周九酒店', totalPurchase: 52000, totalPaid: 52000, owingAmount: 0, orderCount: 12, contributionRate: 6 },
    { customerName: '吴十KTV', totalPurchase: 38000, totalPaid: 30000, owingAmount: 8000, orderCount: 10, contributionRate: 4 }
  ];
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 120, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    yAxis: { type: 'category', data: customerContributionData.value.map(d => d.customerName).reverse(), axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', data: customerContributionData.value.map(d => d.totalPurchase).reverse(), itemStyle: { color: (params: any) => chartColors[params.dataIndex % chartColors.length], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 28 }]
  });
}

function renderPurchaseSummaryChart() {
  const el = document.querySelector('[ref="purchaseSummaryChart"]') as HTMLElement;
  if (!el) return;
  if (!purchaseSummaryChartRef.value) purchaseSummaryChartRef.value = initChart(el);
  const chart = purchaseSummaryChartRef.value;
  if (!chart) return;
  purchaseSummaryData.value = [
    { supplierName: '茅台酒厂直供', purchaseCount: 12, totalAmount: 250000, paidAmount: 200000, unpaidAmount: 50000, lastPurchaseDate: '2026-06-18' },
    { supplierName: '五粮液集团', purchaseCount: 8, totalAmount: 180000, paidAmount: 150000, unpaidAmount: 30000, lastPurchaseDate: '2026-06-15' },
    { supplierName: '青岛啤酒总代', purchaseCount: 15, totalAmount: 95000, paidAmount: 95000, unpaidAmount: 0, lastPurchaseDate: '2026-06-17' },
    { supplierName: '张裕葡萄酒业', purchaseCount: 5, totalAmount: 45000, paidAmount: 30000, unpaidAmount: 15000, lastPurchaseDate: '2026-06-10' },
    { supplierName: '百威啤酒分销', purchaseCount: 6, totalAmount: 38000, paidAmount: 38000, unpaidAmount: 0, lastPurchaseDate: '2026-06-12' }
  ];
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['采购金额', '已付金额'], bottom: 0 },
    grid: { left: 120, right: 20, top: 10, bottom: 40 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    yAxis: { type: 'category', data: purchaseSummaryData.value.map(d => d.supplierName).reverse(), axisLabel: { fontSize: 12 } },
    series: [
      { name: '采购金额', type: 'bar', data: purchaseSummaryData.value.map(d => d.totalAmount).reverse(), itemStyle: { color: '#8B4513', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 24 },
      { name: '已付金额', type: 'bar', data: purchaseSummaryData.value.map(d => d.paidAmount).reverse(), itemStyle: { color: '#C19A6B', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 24 }
    ]
  });
}

function renderInventoryTurnoverChart() {
  const el = document.querySelector('[ref="inventoryTurnoverChart"]') as HTMLElement;
  if (!el) return;
  if (!inventoryTurnoverChartRef.value) inventoryTurnoverChartRef.value = initChart(el);
  const chart = inventoryTurnoverChartRef.value;
  if (!chart) return;
  inventoryTurnoverData.value = [
    { skuName: '飞天茅台53度', category: '白酒', stockQty: 50, avgMonthlySales: 20, turnoverDays: 75, turnoverRate: '0.4', stockAmount: 120000 },
    { skuName: '五粮液52度', category: '白酒', stockQty: 100, avgMonthlySales: 40, turnoverDays: 75, turnoverRate: '0.4', stockAmount: 85000 },
    { skuName: '青岛啤酒经典', category: '啤酒', stockQty: 500, avgMonthlySales: 300, turnoverDays: 50, turnoverRate: '0.6', stockAmount: 35000 },
    { skuName: '张裕干红', category: '红酒', stockQty: 80, avgMonthlySales: 15, turnoverDays: 160, turnoverRate: '0.19', stockAmount: 24000 },
    { skuName: '剑南春', category: '白酒', stockQty: 60, avgMonthlySales: 25, turnoverDays: 72, turnoverRate: '0.42', stockAmount: 30000 },
    { skuName: '百威啤酒', category: '啤酒', stockQty: 400, avgMonthlySales: 250, turnoverDays: 48, turnoverRate: '0.63', stockAmount: 20000 },
    { skuName: '长城干红', category: '红酒', stockQty: 120, avgMonthlySales: 10, turnoverDays: 360, turnoverRate: '0.08', stockAmount: 18000 }
  ];
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['周转天数', '月均销量'], bottom: 0 },
    grid: { left: 120, right: 60, top: 10, bottom: 40 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: inventoryTurnoverData.value.map(d => d.skuName).reverse(), axisLabel: { fontSize: 12 } },
    series: [
      { name: '周转天数', type: 'bar', data: inventoryTurnoverData.value.map(d => d.turnoverDays).reverse(), itemStyle: { color: (p: any) => p.value > 90 ? '#C0392B' : p.value > 60 ? '#D4A017' : '#27AE60', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 20 },
      { name: '月均销量', type: 'line', data: inventoryTurnoverData.value.map(d => d.avgMonthlySales).reverse(), smooth: true, lineStyle: { color: '#8B4513' }, itemStyle: { color: '#8B4513' } }
    ]
  });
}

function loadRPData() {
  rpStats.totalReceivable = 185000; rpStats.totalReceived = 142000; rpStats.totalUnreceived = 43000;
  rpStats.totalPayable = 103000; rpStats.totalUnpaid = 95000;
  rpData.value = [
    { name: '张三烟酒店', type: '应收', totalAmount: 38000, paidAmount: 220000, unpaidAmount: 38000, lastDate: '2026-06-18', overdueDays: 5 },
    { name: '王五商行', type: '应收', totalAmount: 25000, paidAmount: 120000, unpaidAmount: 25000, lastDate: '2026-06-15', overdueDays: 0 },
    { name: '茅台酒厂直供', type: '应付', totalAmount: 50000, paidAmount: 200000, unpaidAmount: 50000, lastDate: '2026-06-18', overdueDays: 0 },
    { name: '五粮液集团', type: '应付', totalAmount: 30000, paidAmount: 150000, unpaidAmount: 30000, lastDate: '2026-06-10', overdueDays: 8 },
    { name: '赵六批发', type: '应收', totalAmount: 18000, paidAmount: 80000, unpaidAmount: 18000, lastDate: '2026-06-12', overdueDays: 3 }
  ];
}

function loadProfitData() {
  profitStats.grossProfit = 285000; profitStats.grossMargin = 35.6; profitStats.netProfit = 168000; profitStats.netMargin = 21.0;
  profitData.value = [
    { item: '营业收入', currentMonth: 800000, lastMonth: 720000, change: 11.1, remark: '含零售+批发' },
    { item: '营业成本', currentMonth: 515000, lastMonth: 480000, change: 7.3, remark: '采购成本' },
    { item: '毛利润', currentMonth: 285000, lastMonth: 240000, change: 18.8, remark: '' },
    { item: '运营费用', currentMonth: 85000, lastMonth: 78000, change: 9.0, remark: '人工+房租+水电' },
    { item: '营销费用', currentMonth: 22000, lastMonth: 18000, change: 22.2, remark: '促销+推广' },
    { item: '财务费用', currentMonth: 5000, lastMonth: 4500, change: 11.1, remark: '手续费+利息' },
    { item: '净利润', currentMonth: 168000, lastMonth: 135000, change: 24.4, remark: '' }
  ];
}

// ==================== Dashboard Module (Task 2) ====================
const dashCards = ref<any[]>([]);
const dashSalesTrendRef = ref<echarts.ECharts | null>(null);
const dashCategoryPieRef = ref<echarts.ECharts | null>(null);
const dashHotProductRef = ref<echarts.ECharts | null>(null);
const dashCustomerTopRef = ref<echarts.ECharts | null>(null);
const dashAlerts = ref<any[]>([]);

function loadDashCards(data: any) {
  dashCards.value = [
    { label: '今日销售额', value: formatYuan(data.salesAmount || 0), desc: '销售单实收金额', changeText: '+12.5%', changeType: 'up' },
    { label: '本月销售额', value: formatYuan((data.salesAmount || 0) * 28), desc: '本月累计销售', changeText: '+8.3%', changeType: 'up' },
    { label: '应收总额', value: formatYuan(data.pendingCollectionAmount || 0), desc: '未收销售单金额', changeText: '-5.2%', changeType: 'down' },
    { label: '库存总值', value: formatYuan(580000), desc: '全部门店库存估值', changeText: '+2.1%', changeType: 'up' }
  ];
}

function renderDashSalesTrend() {
  const el = document.querySelector('[ref="dashSalesTrendChart"]') as HTMLElement;
  if (!el) return;
  if (!dashSalesTrendRef.value) dashSalesTrendRef.value = initChart(el);
  if (!dashSalesTrendRef.value) return;
  const months = ['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'];
  const values = [42000,38000,55000,48000,62000,78000,45000,52000,58000,65000,72000,80000];
  dashSalesTrendRef.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
    series: [{ type: 'line', data: values, smooth: true, lineStyle: { color: '#8B4513', width: 2.5 }, itemStyle: { color: '#8B4513' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(139,69,19,0.2)' }, { offset: 1, color: 'rgba(139,69,19,0.01)' }]) } }]
  });
}

function renderDashCategoryPie() {
  const el = document.querySelector('[ref="dashCategoryPieChart"]') as HTMLElement;
  if (!el) return;
  if (!dashCategoryPieRef.value) dashCategoryPieRef.value = initChart(el);
  if (!dashCategoryPieRef.value) return;
  dashCategoryPieRef.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
    series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], data: [
      { value: 380000, name: '白酒', itemStyle: { color: '#8B4513' } },
      { value: 150000, name: '啤酒', itemStyle: { color: '#C19A6B' } },
      { value: 120000, name: '红酒', itemStyle: { color: '#27AE60' } },
      { value: 80000, name: '洋酒', itemStyle: { color: '#D4A017' } },
      { value: 70000, name: '其他', itemStyle: { color: '#9C958C' } }
    ], label: { fontSize: 11 }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } } }]
  });
}

function renderDashHotProduct() {
  const el = document.querySelector('[ref="dashHotProductChart"]') as HTMLElement;
  if (!el) return;
  if (!dashHotProductRef.value) dashHotProductRef.value = initChart(el);
  if (!dashHotProductRef.value) return;
  const names = ['飞天茅台','五粮液','剑南春','青岛啤酒','洋河蓝色经典','泸州老窖','百威啤酒','张裕干红','郎酒','长城干红'];
  const vals = [120000,95000,72000,68000,55000,48000,42000,35000,28000,22000];
  dashHotProductRef.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 5, bottom: 5 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
    yAxis: { type: 'category', data: names.reverse(), axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', data: vals.reverse(), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8B4513' }, { offset: 1, color: '#C19A6B' }]), borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }]
  });
}

function renderDashCustomerTop() {
  const el = document.querySelector('[ref="dashCustomerTopChart"]') as HTMLElement;
  if (!el) return;
  if (!dashCustomerTopRef.value) dashCustomerTopRef.value = initChart(el);
  if (!dashCustomerTopRef.value) return;
  const names = ['张三烟酒店','李四酒行','王五商行','赵六批发','钱七饭店','孙八超市','周九酒店','吴十KTV','郑十一餐饮','冯十二团购'];
  const vals = [258000,186000,145000,98000,76000,65000,52000,38000,28000,15000];
  dashCustomerTopRef.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 5, bottom: 5 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
    yAxis: { type: 'category', data: names.reverse(), axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', data: vals.reverse(), itemStyle: { color: (p: any) => chartColors[p.dataIndex % chartColors.length], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }]
  });
}

function loadDashAlerts() {
  dashAlerts.value = [
    { type: 'STOCK', content: '飞天茅台53度 可用库存仅剩 5 瓶，低于预警阈值', level: 'HIGH', createdAt: '2026-06-19 08:30:00' },
    { type: 'EXPIRY', content: '张裕干红 3批次商品将在30天内过期', level: 'MEDIUM', createdAt: '2026-06-18 14:00:00' },
    { type: 'PAYMENT', content: '张三烟酒店 应收38000元已逾期5天', level: 'HIGH', createdAt: '2026-06-18 09:00:00' },
    { type: 'CREDIT', content: '赵六批发 信用额度使用率达92%', level: 'MEDIUM', createdAt: '2026-06-17 16:00:00' },
    { type: 'STOCK', content: '剑南春 可用库存仅剩 8 瓶', level: 'LOW', createdAt: '2026-06-17 10:00:00' }
  ];
}

// ==================== Alert Center (Task 3) ====================
const alertView = ref('list');
const alertFilterType = ref('');
const alertFilterLevel = ref('');
const alertFilterStatus = ref('');
const alertStats = reactive({ total: 0, pending: 0, handled: 0, ignored: 0, high: 0 });
const alerts = ref<any[]>([]);
const alertRules = ref<any[]>([]);

function getAlertTypeClass(t: string) { return ({ STOCK:'warning', EXPIRY:'danger', CREDIT:'info', PAYMENT:'danger' } as any)[t] || 'default'; }
function getAlertTypeText(t: string) { return ({ STOCK:'库存预警', EXPIRY:'保质期预警', CREDIT:'信用预警', PAYMENT:'回款预警' } as any)[t] || t; }

function loadAlerts() {
  alerts.value = [
    { alertNo: 'ALT-2026-001', type: 'STOCK', content: '飞天茅台53度 可用库存仅剩 5 瓶', level: 'HIGH', status: 'PENDING', createdAt: '2026-06-19 08:30:00' },
    { alertNo: 'ALT-2026-002', type: 'EXPIRY', content: '张裕干红 3批次商品将在30天内过期', level: 'MEDIUM', status: 'PENDING', createdAt: '2026-06-18 14:00:00' },
    { alertNo: 'ALT-2026-003', type: 'PAYMENT', content: '张三烟酒店 应收38000元已逾期5天', level: 'HIGH', status: 'PENDING', createdAt: '2026-06-18 09:00:00' },
    { alertNo: 'ALT-2026-004', type: 'CREDIT', content: '赵六批发 信用额度使用率达92%', level: 'MEDIUM', status: 'PENDING', createdAt: '2026-06-17 16:00:00' },
    { alertNo: 'ALT-2026-005', type: 'STOCK', content: '剑南春 可用库存仅剩 8 瓶', level: 'LOW', status: 'HANDLED', createdAt: '2026-06-17 10:00:00' },
    { alertNo: 'ALT-2026-006', type: 'PAYMENT', content: '王五商行 应收25000元即将到期', level: 'LOW', status: 'IGNORED', createdAt: '2026-06-16 11:00:00' },
    { alertNo: 'ALT-2026-007', type: 'EXPIRY', content: '长城干红 1批次商品已过期', level: 'HIGH', status: 'HANDLED', createdAt: '2026-06-15 08:00:00' }
  ];
  alertStats.total = alerts.value.length;
  alertStats.pending = alerts.value.filter(a => a.status === 'PENDING').length;
  alertStats.handled = alerts.value.filter(a => a.status === 'HANDLED').length;
  alertStats.ignored = alerts.value.filter(a => a.status === 'IGNORED').length;
  alertStats.high = alerts.value.filter(a => a.level === 'HIGH').length;
}

function handleAlert(row: any, status: string) {
  row.status = status;
  ElMessage.success(status === 'HANDLED' ? '已标记为已处理' : '已忽略');
  loadAlerts();
}

function loadAlertRules() {
  alertRules.value = [
    { ruleName: '低库存预警', type: 'STOCK', description: '当商品可用库存低于设定阈值时触发', threshold: 10, enabled: true },
    { ruleName: '保质期预警', type: 'EXPIRY', description: '商品距离过期天数低于设定值时触发', threshold: 30, enabled: true },
    { ruleName: '信用额度预警', type: 'CREDIT', description: '客户信用额度使用率超过设定百分比时触发', threshold: 90, enabled: true },
    { ruleName: '回款逾期预警', type: 'PAYMENT', description: '应收账款逾期天数超过设定值时触发', threshold: 7, enabled: true },
    { ruleName: '高库存预警', type: 'STOCK', description: '商品库存超过设定天数销量时触发滞销预警', threshold: 180, enabled: false }
  ];
}

function saveAlertRule(row: any) {
  ElMessage.success(`规则「${row.ruleName}」已保存，阈值: ${row.threshold}`);
}

// ==================== Watch for chart rendering ====================
watch(activeNav, async (nav) => {
  await nextTick();
  if (nav === '报表') {
    loadReportData();
    renderCustomerContributionChart();
    renderPurchaseSummaryChart();
    renderInventoryTurnoverChart();
    loadRPData();
    loadProfitData();
  }
  if (nav === '首页') {
    renderDashSalesTrend();
    renderDashCategoryPie();
    renderDashHotProduct();
    renderDashCustomerTop();
  }
  if (nav === '预警中心') {
    loadAlerts();
    loadAlertRules();
  }
  resizeCharts();
});

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", resizeCharts);
  }
  if (token.value) {
    Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts(), loadStaff(), loadSuppliers(), loadPurchaseOrders(), loadSaleReturns(), loadStatements()]).then(async () => {
      await nextTick();
      renderDashSalesTrend();
      renderDashCategoryPie();
      renderDashHotProduct();
      renderDashCustomerTop();
      loadDashAlerts();
    }).catch(() => {
      ElMessage.warning("接口暂不可用，请确认后端和数据库已启动");
    });
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", resizeCharts);
  }
  [salesTrendChartRef.value, rankingChartRef.value, customerContributionChartRef.value, purchaseSummaryChartRef.value, inventoryTurnoverChartRef.value, dashSalesTrendRef.value, dashCategoryPieRef.value, dashHotProductRef.value, dashCustomerTopRef.value].forEach(c => { if (c) c.dispose(); });
});
</script>
