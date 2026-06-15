<template>
  <div class="layout">
    <aside class="side">
      <h1>门店操作端</h1>
      <div v-for="item in nav" :key="item" class="nav-item" :class="{ active: item === nav[0] }">
        {{ item }}
      </div>
    </aside>
    <main class="main">
      <section class="store-hero">
        <h2>门店操作端工作台</h2>
        <p class="muted">面向收银、开单、挂单、库存和分享收款的门店高频操作台。</p>
      </section>
      <el-card v-if="!token" style="margin-bottom: 20px">
        <template #header>门店账号登录</template>
        <el-form :inline="true" @submit.prevent>
          <el-form-item label="账号">
            <el-input v-model="loginForm.username" placeholder="admin" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleLogin">登录</el-button>
          </el-form-item>
        </el-form>
      </el-card>
      <section class="cards">
        <div class="card" v-for="card in cards" :key="card.label">
          <div class="metric">{{ card.value }}</div>
          <div>{{ card.label }}</div>
          <p class="muted">{{ card.desc }}</p>
        </div>
      </section>
      <el-card v-if="inventoryAlerts.length > 0" style="margin-top: 20px; border-left: 4px solid #e6a23c">
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
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>近七日销售趋势</span>
            <el-button size="small" @click="loadDailySales">刷新</el-button>
          </div>
        </template>
        <canvas ref="barCanvas" style="width: 100%; height: 180px" />
        <div v-if="dailySales.length === 0" style="text-align: center; padding: 20px; color: #999">暂无销售数据</div>
      </el-card>
      <el-card style="margin-top: 20px">
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
      <el-card class="cashier-panel" style="margin-top: 20px">
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
              <el-table-column label="门店价" width="90">
                <template #default="{ row }">¥{{ Number(row.storePrice || row.retailPrice || 0).toFixed(2) }}</template>
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
          <el-table-column label="小计" width="110">
            <template #default="{ row }">¥{{ (Number(row.quantity || 0) * Number(row.unitPrice || 0)).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button size="small" link type="danger" @click="removeCartItem($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
          <strong>购物车合计：¥{{ cartAmount.toFixed(2) }}</strong>
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
          <template #title>销售单：{{ currentBillNo }}，应收金额：¥{{ currentAmount.toFixed(2) }}</template>
        </el-alert>
        <el-alert v-if="shareUrl" type="warning" show-icon :closable="false">
          <template #title>分享收款链接：{{ shareUrl }}</template>
        </el-alert>
      </el-card>

      <el-card style="margin-top: 20px">
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
          <el-table-column prop="receivableAmount" label="应收金额" width="120" />
          <el-table-column prop="unreceivedAmount" label="未收金额" width="120" />
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
            <el-descriptions-item label="应收金额">¥{{ Number(saleBillDetail.receivableAmount || 0).toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="未收金额">¥{{ Number(saleBillDetail.unreceivedAmount || 0).toFixed(2) }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="saleBillDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="totalBottleQty" label="数量" width="80" />
            <el-table-column prop="unitPrice" label="单价" width="90" />
            <el-table-column prop="subtotalAmount" label="小计" width="90" />
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
          <el-table-column prop="amount" label="金额" width="100" />
          <el-table-column prop="remark" label="备注" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleRestoreHoldOrder(row.holdNo)">取单</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteHoldOrder(row.holdNo)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>

      <el-card style="margin-top: 20px">
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
      <el-card style="margin-top: 20px">
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
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>分享收款</span>
            <el-button size="small" @click="loadCollectionLinks">刷新</el-button>
          </div>
        </template>
        <el-table :data="collectionLinks" empty-text="暂无记录">
          <el-table-column prop="linkNo" label="收款单号" width="200" />
          <el-table-column prop="sourceNo" label="关联销售单" width="200" />
          <el-table-column prop="amount" label="收款金额" width="100" />
          <el-table-column prop="paidAmount" label="已付" width="80" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>支付记录</span>
            <el-button size="small" @click="loadPaymentOrders">刷新</el-button>
          </div>
        </template>
        <el-table :data="paymentOrders" empty-text="暂无记录">
          <el-table-column prop="payNo" label="支付单号" width="200" />
          <el-table-column prop="sourceNo" label="关联来源" width="200" />
          <el-table-column prop="amount" label="金额" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="paymentMethod" label="方式" width="100" />
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-card style="margin-top: 20px">
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
          <el-table-column prop="amount" label="退款金额" width="100" />
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
            <el-descriptions-item label="应付金额">¥{{ Number(orderDetail.payableAmount || 0).toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="收货地址">{{ orderDetail.receiverAddress || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="orderDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column prop="unitPrice" label="单价" width="90" />
            <el-table-column prop="subtotalAmount" label="小计" width="90" />
          </el-table>
        </template>
      </el-dialog>
      <el-dialog v-model="invDialogVisible" title="库存调整" width="400px">
        <el-form label-width="100px">
          <el-form-item label="商品">
            <span>{{ invForm.skuName || "—" }}</span>
          </el-form-item>
          <el-form-item label="库存类型">
            <span>{{ invForm.stockType }}</span>
          </el-form-item>
          <el-form-item label="变化量">
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { acceptStoreOrder, adjustInventory, completeStoreOrder, createCollectionLink, createHoldOrder, createOfflinePayment, createSaleBill, deleteHoldOrder, fetchHoldOrders, fetchInventory, fetchInventoryLogs, fetchSaleBillDetail, fetchSaleBills, fetchStoreCollectionLinks, fetchStoreDailySales, fetchStoreDashboard, fetchStoreInventoryAlerts, fetchStoreOrderDetail, fetchStoreOrders, fetchStorePaymentOrders, fetchStoreRefundOrders, restoreHoldOrder, searchStoreMembers, searchStoreProducts, storeLogin } from "./api";

const nav = ["工作台", "快速收银", "销售单", "接单履约", "库存查询", "分享收款"];
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
  customerName: "演示客户",
  customerMobile: "13900000000",
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
  { label: "今日销售额", value: "¥" + Number(dashboard.value.todaySalesAmount || 0).toFixed(2), desc: "销售单汇总" },
  { label: "待收款", value: "¥" + Number(dashboard.value.unReceivedAmount || 0).toFixed(2), desc: "未收销售单金额" },
  { label: "待处理订单", value: String(dashboard.value.pendingOrderCount || 0), desc: "待接单小程序订单" },
  { label: "今日订单", value: String(dashboard.value.todayOrderCount || 0), desc: "今日小程序订单数" }
]);

async function handleLogin() {
  loading.value = true;
  try {
    const result = await storeLogin(loginForm.username, loginForm.password);
    localStorage.setItem("store_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功");
    await Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadDashboard(), loadDailySales(), loadInventoryAlerts(), loadRefundOrders()]);
  } finally {
    loading.value = false;
  }
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
  if (token.value) {
    Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadInventoryLogs(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDashboard(), loadDailySales(), loadInventoryAlerts()]).catch(() => {
      ElMessage.warning("接口暂不可用，请确认后端和数据库已启动");
    });
  }
});
</script>
