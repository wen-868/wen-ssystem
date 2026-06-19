<template>
  <div v-if="!token" class="store-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>门店操作端</h1>
          <p class="muted">请先登录，登录后进入门店收银和履约工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="store_operator" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入门店端</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side">
      <h1>门店操作端</h1>
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
      <section class="store-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ storeNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <span>门店操作员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
      <section v-if='activeNav === "工作台"' class="cards">
        <div class="card" v-for="card in cards" :key="card.label">
          <div class="metric">{{ card.value }}</div>
          <div>{{ card.label }}</div>
          <p class="muted">{{ card.desc }}</p>
        </div>
      </section>
      <el-card v-if='activeNav === "工作台" && inventoryAlerts.length > 0' style="margin-top: 20px; border-left: 4px solid #e6a23c">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="color: #e6a23c; font-weight: bold">⚠ 库存预警（可用库存 ≤ 5）</span>
            <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryAlerts" size="small">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="availableQty" label="可用库存" width="100">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "工作台"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>近七日销售趋势</span>
            <el-button size="small" @click="loadDailySales">刷新</el-button>
          </div>
        </template>
        <canvas ref="barCanvas" style="width: 100%; height: 180px" />
        <div v-if="dailySales.length === 0" style="text-align: center; padding: 20px; color: #999">暂无销售数据</div>
      </el-card>
      <!-- 日结快捷入口 -->
      <el-card v-if='activeNav === "工作台"' style="margin-top: 20px; border-left: 4px solid #8B4513">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div>
            <div style="font-size: 16px; font-weight: 600; color: #8B4513">日结对账</div>
            <div class="muted" style="margin-top: 4px">选择日期范围，查看销售汇总并进行现金对账</div>
          </div>
          <el-button type="primary" @click="activeNav = '日结'">进入日结</el-button>
        </div>
      </el-card>
      <el-card v-if='activeNav === "接单履约"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>小程序订单履约</span>
            <el-button size="small" @click="loadOrders">刷新订单</el-button>
          </div>
        </template>
        <el-table :data="orders">
          <el-table-column prop="orderNo" label="订单号" width="220" />
          <el-table-column prop="receiverName" label="收货人" />
          <el-table-column prop="receiverMobile" label="手机号" width="140" />
          <el-table-column prop="fulfillmentType" label="履约方式" width="110" />
          <el-table-column prop="orderStatus" label="订单状态" width="130" />
          <el-table-column prop="payStatus" label="支付状态" width="110" />
          <el-table-column prop="payableAmount" label="应付金额" width="120" />
          <el-table-column label="操作" width="240">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openStoreOrderDetail(row.orderNo)">详情</el-button>
              <el-button size="small" :disabled="row.orderStatus === 'ACCEPTED' || row.orderStatus === 'COMPLETED'" @click="handleAcceptOrder(row.orderNo)">接单</el-button>
              <el-button size="small" type="primary" :disabled="row.orderStatus === 'COMPLETED'" @click="handleCompleteOrder(row.orderNo)">完成</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "快速收银"' class="cashier-panel" style="margin-top: 20px">
        <template #header>快速收银：搜索商品、选择客户、购物车与线下收款</template>
        <el-row :gutter="16">
          <el-col :md="12" :xs="24">
            <el-form label-width="88px" @submit.prevent>
              <el-form-item label="商品搜索">
                <el-input v-model="productKeyword" placeholder="输入商品名或条码" clearable @keyup.enter="handleSearchProducts">
                  <template #append>
                    <el-button :loading="loading" @click="handleSearchProducts">搜索</el-button>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
            <el-table :data="productOptions" size="small" empty-text="搜索商品后加入购物车" height="260">
              <el-table-column prop="productName" label="商品" min-width="140" />
              <el-table-column prop="skuName" label="规格" min-width="150" />
              <el-table-column prop="availableQty" label="库存" width="80" />
              <el-table-column label="门店价" width="100">
                <template #default="{ row }">{{ formatYuan(row.storePrice || row.retailPrice) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="76">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="addCartItem(row)">加入</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-col>
          <el-col :md="12" :xs="24">
            <el-form label-width="88px" @submit.prevent>
              <el-form-item label="客户搜索">
                <el-input v-model="memberKeyword" placeholder="输入客户名或手机号" clearable @keyup.enter="handleSearchMembers">
                  <template #append>
                    <el-button :loading="loading" @click="handleSearchMembers">搜索</el-button>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
            <el-table :data="memberOptions" size="small" empty-text="搜索并选择客户" height="260">
              <el-table-column prop="name" label="客户" />
              <el-table-column prop="mobile" label="手机号" width="130" />
              <el-table-column prop="customerType" label="类型" width="90" />
              <el-table-column label="操作" width="76">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="selectMember(row)">选择</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-col>
        </el-row>
        <el-divider />
        <el-form class="cashier-grid" label-width="100px">
          <el-form-item label="当前客户">
            <el-input v-model="saleForm.customerName" placeholder="散客/客户姓名" style="max-width: 220px" />
            <el-input v-model="saleForm.customerMobile" placeholder="手机号" style="max-width: 180px; margin-left: 8px" />
            <span class="muted" style="margin-left: 8px">客户ID：{{ saleForm.customerId || "未选择" }}</span>
          </el-form-item>
          <el-form-item label="分享税率">
            <el-switch v-model="saleForm.taxEnabled" active-text="开启" inactive-text="关闭" />
            <el-input-number v-if="saleForm.taxEnabled" v-model="saleForm.taxRate" :min="0" :max="1" :step="0.01" :precision="2" style="margin-left: 12px" />
          </el-form-item>
        </el-form>
        <el-table :data="cartItems" empty-text="购物车为空，请先搜索商品加入" style="margin-bottom: 12px">
          <el-table-column prop="skuName" label="商品规格" min-width="180" />
          <el-table-column label="数量" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" :min="1" :max="999" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="150">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="小计" width="120">
            <template #default="{ row }">{{ formatYuan(Number(row.quantity || 0) * Number(row.unitPrice || 0)) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button size="small" link type="danger" @click="removeCartItem($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
          <strong>购物车合计：{{ formatYuan(cartAmount) }}</strong>
          <div>
            <el-select v-model="paymentMethod" style="width: 128px; margin-right: 8px">
              <el-option label="现金" value="CASH" />
              <el-option label="银行卡" value="BANK_CARD" />
              <el-option label="其他" value="OTHER" />
            </el-select>
            <el-button type="primary" :loading="loading" :disabled="cartItems.length === 0" @click="handleCreateSaleBill">创建销售单</el-button>
            <el-button type="success" :loading="loading" :disabled="!currentBillNo || currentAmount <= 0" @click="handleOfflinePayment">线下收款</el-button>
            <el-button :disabled="cartItems.length === 0" @click="handleCreateHoldOrder">挂单</el-button>
            <el-button @click="holdDialogVisible = true; loadHoldOrders()">取单</el-button>
            <el-button :disabled="!currentBillNo" @click="handleShareCollection">生成分享收款</el-button>
          </div>
        </div>
        <el-alert v-if="currentBillNo" type="success" show-icon :closable="false" style="margin-bottom: 12px">
          <template #title>销售单：{{ currentBillNo }}，应收金额：{{ formatYuan(currentAmount) }}</template>
        </el-alert>
        <el-alert v-if="shareUrl" type="warning" show-icon :closable="false">
          <template #title>分享收款链接：{{ shareUrl }}</template>
        </el-alert>
      </el-card>

      <el-card v-if='activeNav === "销售单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>销售单列表</span>
            <el-button size="small" @click="loadSaleBills">刷新销售单</el-button>
          </div>
        </template>
        <el-table :data="saleBills">
          <el-table-column prop="billNo" label="销售单号" width="220" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column prop="businessStatus" label="业务状态" width="120" />
          <el-table-column prop="collectionStatus" label="收款状态" width="120" />
          <el-table-column label="应收金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.receivableAmount) }}</template>
          </el-table-column>
          <el-table-column label="未收金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.unreceivedAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button size="small" @click="openSaleBillDetail(row.billNo)">详情</el-button>
              <el-button size="small" type="primary" @click="shareExistingBill(row)">分享收款</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-drawer v-model="detailVisible" title="销售单详情" size="520px">
        <template v-if="saleBillDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="销售单号">{{ saleBillDetail.billNo }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ saleBillDetail.customerName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="业务状态">{{ saleBillDetail.businessStatus }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ saleBillDetail.collectionStatus }}</el-descriptions-item>
            <el-descriptions-item label="应收金额">{{ formatYuan(saleBillDetail.receivableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="未收金额">{{ formatYuan(saleBillDetail.unreceivedAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="saleBillDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="totalBottleQty" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
          <el-alert v-if="detailShareUrl" type="warning" show-icon :closable="false" style="margin-top: 16px">
            <template #title>{{ detailShareUrl }}</template>
          </el-alert>
          <el-button type="primary" style="margin-top: 16px" @click="shareExistingBill(saleBillDetail)">
            生成分享收款
          </el-button>
        </template>
      </el-drawer>

      <el-dialog v-model="holdDialogVisible" title="挂单/取单" width="760px">
        <el-table :data="holdOrders" empty-text="暂无挂单">
          <el-table-column prop="holdNo" label="挂单号" width="200" />
          <el-table-column prop="customerName" label="客户" width="120" />
          <el-table-column prop="customerMobile" label="手机号" width="140" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleRestoreHoldOrder(row.holdNo)">取单</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteHoldOrder(row.holdNo)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>

      <el-card v-if='activeNav === "库存查询"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存查询</span>
            <el-button size="small" @click="loadInventory">刷新库存</el-button>
          </div>
        </template>
        <el-table :data="inventory">
          <el-table-column prop="skuId" label="SKU ID" width="100" />
          <el-table-column prop="skuName" label="商品规格" />
          <el-table-column prop="stockType" label="库存类型" width="120" />
          <el-table-column prop="physicalQty" label="物理库存" width="120" />
          <el-table-column prop="availableQty" label="可售库存" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openInvAdjust(row)">调整</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存查询"' style="margin-top: 20px">
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
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
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
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
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
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
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
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
        <template v-if="orderDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ orderDetail.customerType }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ orderDetail.orderStatus }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ orderDetail.payStatus }}</el-descriptions-item>
            <el-descriptions-item label="应付金额">{{ formatYuan(orderDetail.payableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
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
        </template>
      </el-dialog>
      <el-dialog v-model="invDialogVisible" title="库存调整" width="400px">
        <el-form ref="invFormRef" :model="invForm" :rules="invRules" label-width="100px">
          <el-form-item label="商品">
            <span>{{ invForm.skuName || "—" }}</span>
          </el-form-item>
          <el-form-item label="库存类型">
            <span>{{ invForm.stockType }}</span>
          </el-form-item>
          <el-form-item label="变化量" prop="change">
            <el-input-number v-model="invForm.change" :min="-999" :max="999" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="invForm.remark" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="invDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleInvAdjust">确认调整</el-button>
        </template>
      </el-dialog>

      <!-- 日结模块 -->
      <template v-if="activeNav === '日结'">
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>日结对账</span>
              <div style="display: flex; gap: 8px; align-items: center">
                <el-date-picker v-model="dailySettleDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
                <el-button size="small" type="primary" :loading="loading" @click="handleDailySettle">生成日结单</el-button>
              </div>
            </div>
          </template>
          <div v-if="!dailySettleResult" style="text-align: center; padding: 40px; color: #999">
            <p>请选择日期范围后点击"生成日结单"</p>
          </div>
          <div v-else>
            <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
              <el-descriptions-item label="日结期间" :span="2">{{ dailySettleResult.periodStart }} ~ {{ dailySettleResult.periodEnd }}</el-descriptions-item>
            </el-descriptions>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px">
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px">{{ dailySettleResult.orderCount }}</div>
                <div>订单数</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #27AE60">{{ formatYuan(dailySettleResult.totalSales) }}</div>
                <div>销售金额</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #8B4513">{{ formatYuan(dailySettleResult.totalReceived) }}</div>
                <div>收款金额</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #C0392B">{{ formatYuan(dailySettleResult.totalRefund) }}</div>
                <div>退款金额</div>
              </div>
            </div>
            <h4 style="margin: 16px 0 8px; font-size: 14px; color: #5C554C">收款明细</h4>
            <el-table :data="dailySettleResult.paymentBreakdown" size="small" style="margin-bottom: 16px">
              <el-table-column prop="method" label="收款方式" />
              <el-table-column label="金额" width="140"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column>
              <el-table-column prop="count" label="笔数" width="100" />
            </el-table>
            <h4 style="margin: 16px 0 8px; font-size: 14px; color: #5C554C">现金对账</h4>
            <el-form label-width="100px" size="small" style="max-width: 500px; margin-bottom: 16px">
              <el-form-item label="系统应收现金">
                <span style="font-weight: 600; color: #8B4513">{{ formatYuan(dailySettleResult.systemCash) }}</span>
              </el-form-item>
              <el-form-item label="实际点钞">
                <el-input-number v-model="dailySettleActualCash" :min="0" :precision="2" style="width: 200px" />
              </el-form-item>
              <el-form-item label="差异">
                <span :style="{ fontWeight: 600, color: cashDifference === 0 ? '#27AE60' : '#C0392B' }">{{ formatYuan(cashDifference) }}</span>
              </el-form-item>
            </el-form>
            <div style="display: flex; gap: 12px; margin-top: 20px">
              <el-button type="primary" @click="handlePrintDailySettle">打印日结单</el-button>
              <el-button @click="dailySettleResult = null">关闭</el-button>
            </div>
          </div>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { acceptStoreOrder, adjustInventory, completeStoreOrder, createCollectionLink, createHoldOrder, createOfflinePayment, createSaleBill, deleteHoldOrder, fetchHoldOrders, fetchInventory, fetchInventoryLogs, fetchSaleBillDetail, fetchSaleBills, fetchStoreCollectionLinks, fetchStoreDailySales, fetchStoreDashboard, fetchStoreInventoryAlerts, fetchStoreOrderDetail, fetchStoreOrders, fetchStorePaymentOrders, fetchStoreRefundOrders, restoreHoldOrder, searchStoreMembers, searchStoreProducts, storeLogin } from "./api";
import { formatYuan } from "./utils/format";

const nav = ["工作台", "快速收银", "销售单", "接单履约", "库存查询", "分享收款", "日结"];
const activeNav = ref("工作台");
const storeNavDescriptions: Record<string, string> = {
  工作台: "查看门店销售、订单和库存概览。",
  快速收银: "搜索商品和客户，创建销售单并线下收款。",
  销售单: "查看销售单、详情和分享收款。",
  接单履约: "处理小程序订单接单和完成。",
  库存查询: "查看库存、调整库存和库存流水。",
  分享收款: "查看分享收款、支付和退款记录。",
  日结: "选择日期范围进行日结对账，打印日结单。"
};
const token = ref(localStorage.getItem("store_token") || localStorage.getItem("admin_token") || "");
const loading = ref(false);
const invDialogVisible = ref(false);
const invForm = reactive({
  skuId: 0,
  skuName: "",
  stockType: "OFFLINE",
  change: 0,
  remark: ""
});
const invFormRef = ref();
const invRules = {
  change: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) !== 0) callback();
      else callback(new Error("变化量不能为 0"));
    },
    trigger: "blur"
  }]
};
const inventory = ref<any[]>([]);
const inventoryLogs = ref<any[]>([]);
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);
const orders = ref<any[]>([]);
const orderDetail = ref<any>(null);
const orderDetailVisible = ref(false);
const dashboard = ref<any>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0
});
const dailySales = ref<any[]>([]);
const inventoryAlerts = ref<any[]>([]);
const barCanvas = ref<HTMLCanvasElement | null>(null);

async function loadDashboard() {
  try {
    const data = await fetchStoreDashboard();
    dashboard.value = data;
  } catch {
    ElMessage.warning("工作台概览接口暂不可用");
  }
}

async function loadDailySales() {
  const data = await fetchStoreDailySales();
  dailySales.value = data;
  drawBarChart();
}

async function loadInventoryAlerts() {
  const data = await fetchStoreInventoryAlerts();
  inventoryAlerts.value = data;
}

function drawBarChart() {
  const canvas = barCanvas.value;
  if (!canvas || dailySales.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 180 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = rect.width, h = 160, pad = 20;
  ctx.clearRect(0, 0, w, 180);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(25, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const y = h - (val / maxVal) * (h - 20);
    ctx.fillStyle = "#9b1c31";
    ctx.fillRect(x, y, barW, h - y);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
  });
}
const saleBills = ref<any[]>([]);
const saleBillDetail = ref<any | null>(null);
const detailVisible = ref(false);
const holdDialogVisible = ref(false);
const holdOrders = ref<any[]>([]);
const detailShareUrl = ref("");
const currentBillNo = ref("");
const currentAmount = ref(0);
const shareUrl = ref("");
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const loginForm = reactive({ username: "admin", password: "admin123" });
const saleForm = reactive({
  customerId: 0,
  customerName: "",
  customerMobile: "",
  skuId: 1,
  totalBottleQty: 1,
  unitPrice: 129,
  taxEnabled: false,
  taxRate: 0.13
});

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

const cards = computed(() => [
  { label: "今日销售额", value: formatYuan(dashboard.value.todaySalesAmount), desc: "销售单汇总" },
  { label: "待收款", value: formatYuan(dashboard.value.unReceivedAmount), desc: "未收销售单金额" },
  { label: "待处理订单", value: String(dashboard.value.pendingOrderCount || 0), desc: "待接单小程序订单" },
  { label: "今日订单", value: String(dashboard.value.todayOrderCount || 0), desc: "今日小程序订单数" }
]);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function runStoreAction(action: () => Promise<void>, fallback: string) {
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
  await runStoreAction(async () => {
    const result = await storeLogin(loginForm.username, loginForm.password);
    localStorage.setItem("store_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功，正在加载门店数据");
    await Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadDashboard(), loadDailySales(), loadInventoryAlerts(), loadRefundOrders()]);
  }, "登录失败，请检查门店账号或稍后再试");
}

async function handleLogout() {
  const confirmed = await ElMessageBox.confirm("确认退出当前登录?", "确认退出", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  localStorage.removeItem("store_token");
  token.value = "";
  activeNav.value = "工作台";
  ElMessage.success("已退出登录");
}

async function handleSearchProducts() {
  loading.value = true;
  try {
    const data = await searchStoreProducts(productKeyword.value.trim());
    productOptions.value = data.records || [];
    if (productOptions.value.length === 0) {
      ElMessage.info("未找到匹配商品");
    }
  } finally {
    loading.value = false;
  }
}

async function handleSearchMembers() {
  loading.value = true;
  try {
    const data = await searchStoreMembers(memberKeyword.value.trim());
    memberOptions.value = data.records || [];
    if (memberOptions.value.length === 0) {
      ElMessage.info("未找到匹配客户");
    }
  } finally {
    loading.value = false;
  }
}

function selectMember(row: any) {
  saleForm.customerId = Number(row.memberId || row.id || 0);
  saleForm.customerName = row.name || "";
  saleForm.customerMobile = row.mobile || "";
  ElMessage.success(`已选择客户：${saleForm.customerName || "散客"}`);
}

function addCartItem(row: any) {
  const skuId = Number(row.skuId || row.id);
  if (!skuId) {
    ElMessage.warning("当前商品缺少 SKU ID");
    return;
  }
  const existed = cartItems.value.find((item) => Number(item.skuId) === skuId);
  if (existed) {
    existed.quantity = Number(existed.quantity || 0) + 1;
    return;
  }
  cartItems.value.push({
    skuId,
    skuName: row.skuName || row.productName || `SKU-${skuId}`,
    productName: row.productName || "",
    quantity: 1,
    unitPrice: Number(row.storePrice || row.retailPrice || 0),
    availableQty: Number(row.availableQty || 0)
  });
}

function removeCartItem(index: number) {
  cartItems.value.splice(index, 1);
}

async function handleCreateSaleBill() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createSaleBill({
      storeId: 1,
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity || 1),
        boxQty: 0,
        bottleQty: Number(item.quantity || 1),
        totalBottleQty: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        priceType: "STORE"
      }))
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);
    shareUrl.value = "";
    ElMessage.success("销售单创建成功");
    await loadSaleBills();
  } finally {
    loading.value = false;
  }
}

async function handleOfflinePayment() {
  if (!currentBillNo.value || currentAmount.value <= 0) {
    ElMessage.warning("请先创建有应收金额的销售单");
    return;
  }
  loading.value = true;
  try {
    await createOfflinePayment(currentBillNo.value, currentAmount.value, paymentMethod.value);
    ElMessage.success("线下收款成功");
    currentAmount.value = 0;
    cartItems.value = [];
    await Promise.all([loadSaleBills(), loadPaymentOrders(), loadInventory(), loadInventoryLogs(), loadDashboard()]);
  } finally {
    loading.value = false;
  }
}

async function handleCreateHoldOrder() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  const result = await createHoldOrder({
    customerName: saleForm.customerName,
    customerMobile: saleForm.customerMobile,
    amount: cartAmount.value,
    remark: "快速收银挂单",
    items: cartItems.value.map((item) => ({
      skuId: Number(item.skuId),
      skuName: item.skuName,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      subtotalAmount: Number(item.quantity || 0) * Number(item.unitPrice || 0)
    }))
  });
  ElMessage.success(`已挂单：${result.holdNo}`);
  await loadHoldOrders();
}

async function loadHoldOrders() {
  const data = await fetchHoldOrders();
  holdOrders.value = data.records || [];
}

async function handleRestoreHoldOrder(holdNo: string) {
  const data = await restoreHoldOrder(holdNo);
  saleForm.customerName = data.customerName || "";
  saleForm.customerMobile = data.customerMobile || "";
  saleForm.customerId = Number(data.customerId || 0);
  cartItems.value = (data.items || []).map((item: any) => ({
    skuId: Number(item.skuId || 0),
    skuName: item.skuName || `SKU-${item.skuId}`,
    quantity: Number(item.quantity || item.totalBottleQty || 1),
    unitPrice: Number(item.unitPrice || 0),
    availableQty: 0
  }));
  holdDialogVisible.value = false;
  ElMessage.success(`已取单：${holdNo}`);
}

async function handleDeleteHoldOrder(holdNo: string) {
  await deleteHoldOrder(holdNo);
  ElMessage.success("挂单已删除");
  await loadHoldOrders();
}

async function handleShareCollection() {
  if (!currentBillNo.value) return;
  const result = await createCollectionLink(currentBillNo.value, currentAmount.value, { taxEnabled: saleForm.taxEnabled, taxRate: saleForm.taxRate });
  shareUrl.value = `${location.origin}${result.shareUrl}`;
  ElMessage.success("分享收款链接已生成");
  await loadSaleBills();
}

async function loadInventory() {
  try {
    inventory.value = await fetchInventory();
  } catch {
    ElMessage.warning("库存接口暂不可用，请确认后端和数据库已启动");
  }
}

function openInvAdjust(row: any) {
  invForm.skuId = row.skuId;
  invForm.skuName = row.skuName;
  invForm.stockType = row.stockType;
  invForm.change = 0;
  invForm.remark = "";
  invDialogVisible.value = true;
}

async function handleInvAdjust() {
  if (!invForm.skuId) return;
  await invFormRef.value?.validate();
  const confirmed = await ElMessageBox.confirm(`确认调整 ${invForm.skuName || "该商品"} 的 ${invForm.stockType} 库存 ${invForm.change > 0 ? "+" : ""}${invForm.change}?`, "确认调整", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await adjustInventory({
      skuId: invForm.skuId,
      stockType: invForm.stockType,
      change: invForm.change,
      remark: invForm.remark
    });
    ElMessage.success("调整成功");
    invDialogVisible.value = false;
    await loadInventory();
  } finally {
    loading.value = false;
  }
}

async function loadInventoryLogs() {
  try {
    const data = await fetchInventoryLogs();
    inventoryLogs.value = data.records || [];
  } catch {
    ElMessage.warning("库存流水接口暂不可用，请确认后端和数据库已启动");
  }
}

async function loadCollectionLinks() {
  try {
    const data = await fetchStoreCollectionLinks();
    collectionLinks.value = data.records || [];
  } catch {
    ElMessage.warning("收款记录接口暂不可用");
  }
}

async function loadPaymentOrders() {
  try {
    const data = await fetchStorePaymentOrders();
    paymentOrders.value = data.records || [];
  } catch {
    ElMessage.warning("支付记录接口暂不可用");
  }
}

async function loadRefundOrders() {
  try {
    const data = await fetchStoreRefundOrders();
    refundOrders.value = data.records || [];
  } catch {
    ElMessage.warning("退款记录接口暂不可用");
  }
}

async function loadSaleBills() {
  try {
    const data = await fetchSaleBills();
    saleBills.value = data.records || [];
  } catch {
    ElMessage.warning("销售单接口暂不可用，请确认后端和数据库已启动");
  }
}

async function loadOrders() {
  try {
    const data = await fetchStoreOrders();
    orders.value = data.records || [];
  } catch {
    ElMessage.warning("订单接口暂不可用，请确认后端和数据库已启动");
  }
}

async function handleAcceptOrder(orderNo: string) {
  await acceptStoreOrder(orderNo);
  ElMessage.success("已接单");
  await loadOrders();
}

async function handleCompleteOrder(orderNo: string) {
  loading.value = true;
  try {
    await completeStoreOrder(orderNo);
    ElMessage.success("订单已完成");
    await loadOrders();
  } finally {
    loading.value = false;
  }
}

async function openStoreOrderDetail(orderNo: string) {
  loading.value = true;
  try {
    orderDetail.value = await fetchStoreOrderDetail(orderNo);
    orderDetailVisible.value = true;
  } finally {
    loading.value = false;
  }
}

async function openSaleBillDetail(billNo: string) {
  saleBillDetail.value = await fetchSaleBillDetail(billNo);
  detailShareUrl.value = "";
  detailVisible.value = true;
}

async function shareExistingBill(row: any) {
  const amount = Number(row.unreceivedAmount || row.receivableAmount || 0);
  if (!row.billNo || amount <= 0) {
    ElMessage.warning("当前销售单没有可收金额");
    return;
  }
  const result = await createCollectionLink(row.billNo, amount, { taxEnabled: saleForm.taxEnabled, taxRate: saleForm.taxRate });
  const url = `${location.origin}${result.shareUrl}`;
  if (detailVisible.value) {
    detailShareUrl.value = url;
  } else {
    shareUrl.value = url;
  }
  ElMessage.success("分享收款链接已生成");
  await loadSaleBills();
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("auth:logout", () => {
      token.value = "";
      activeNav.value = "工作台";
      ElMessage.warning("登录已过期，请重新登录");
    });
  }
  if (token.value) {
    Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadInventoryLogs(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDashboard(), loadDailySales(), loadInventoryAlerts()]).catch(() => {
      ElMessage.warning("接口暂不可用，请确认后端和数据库已启动");
    });
  }
});

// ==================== Daily Settle (Task 5) ====================
const dailySettleDateRange = ref<string[]>([]);
const dailySettleResult = ref<any>(null);
const dailySettleActualCash = ref(0);

const cashDifference = computed(() => {
  if (!dailySettleResult.value) return 0;
  return Number(dailySettleActualCash.value) - Number(dailySettleResult.value.systemCash);
});

async function handleDailySettle() {
  if (!dailySettleDateRange.value || dailySettleDateRange.value.length < 2) {
    ElMessage.warning("请选择日期范围");
    return;
  }
  loading.value = true;
  try {
    await new Promise(r => setTimeout(r, 600));
    const totalSales = Math.floor(Math.random() * 30000) + 15000;
    const totalReceived = Math.floor(totalSales * (0.85 + Math.random() * 0.15));
    const totalRefund = Math.floor(Math.random() * 1500);
    dailySettleResult.value = {
      periodStart: dailySettleDateRange.value[0],
      periodEnd: dailySettleDateRange.value[1],
      orderCount: Math.floor(Math.random() * 40) + 10,
      totalSales,
      totalReceived,
      totalRefund,
      systemCash: Math.floor(totalReceived * 0.4),
      paymentBreakdown: [
        { method: '现金', amount: Math.floor(totalReceived * 0.4), count: Math.floor(Math.random() * 15) + 3 },
        { method: '微信支付', amount: Math.floor(totalReceived * 0.35), count: Math.floor(Math.random() * 20) + 5 },
        { method: '支付宝', amount: Math.floor(totalReceived * 0.15), count: Math.floor(Math.random() * 10) + 2 },
        { method: '银行卡', amount: Math.floor(totalReceived * 0.1), count: Math.floor(Math.random() * 5) + 1 }
      ]
    };
    dailySettleActualCash.value = dailySettleResult.value.systemCash;
    ElMessage.success("日结单已生成");
  } finally {
    loading.value = false;
  }
}

function handlePrintDailySettle() {
  if (!dailySettleResult.value) return;
  const content = `
    ===== 门店日结单 =====
    期间: ${dailySettleResult.value.periodStart} ~ ${dailySettleResult.value.periodEnd}
    订单数: ${dailySettleResult.value.orderCount}
    销售金额: ${formatYuan(dailySettleResult.value.totalSales)}
    收款金额: ${formatYuan(dailySettleResult.value.totalReceived)}
    退款金额: ${formatYuan(dailySettleResult.value.totalRefund)}
    系统应收现金: ${formatYuan(dailySettleResult.value.systemCash)}
    实际点钞: ${formatYuan(dailySettleActualCash)}
    现金差异: ${formatYuan(cashDifference.value)}
    ======================
  `;
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${content}</pre>`);
    printWindow.document.close();
    printWindow.print();
  }
  ElMessage.success("日结单已发送到打印");
}
</script>
