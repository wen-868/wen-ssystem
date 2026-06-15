<template>
  <div class="layout">
    <aside class="side">
      <h1>智享营销系统管理后台</h1>
      <div v-for="item in nav" :key="item" class="nav-item" :class="{ active: item === nav[0] }">
        {{ item }}
      </div>
    </aside>
    <main class="main">
      <section class="dashboard-hero">
        <h2>智享营销系统管理后台工作台</h2>
        <p class="muted">围绕销售、库存、客户和收款，快速判断门店经营状态。</p>
      </section>
      <el-card v-if="!token" style="margin-bottom: 20px">
        <template #header>管理员登录</template>
        <el-form :inline="true" @submit.prevent>
          <el-form-item label="账号">
            <el-input v-model="loginForm.username" placeholder="admin" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleLogin">登录并加载数据</el-button>
          </el-form-item>
        </el-form>
      </el-card>
      <el-alert v-else type="success" show-icon :closable="false" style="margin-bottom: 20px">
        <template #title>已登录，Token 已保存到浏览器本地存储。</template>
      </el-alert>
      <section class="cards">
        <div class="card" v-for="card in cards" :key="card.label">
          <div class="metric">{{ card.value }}</div>
          <div>{{ card.label }}</div>
          <p class="muted">{{ card.desc }}</p>
        </div>
      </section>
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>商品列表</span>
            <div>
              <el-button size="small" @click="loadProducts">刷新商品</el-button>
              <el-button size="small" type="primary" @click="productDialogVisible = true">新增演示商品</el-button>
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
          <el-table-column prop="retailPrice" label="零售价" width="100" />
          <el-table-column prop="wholesalePrice" label="批发价" width="100" />
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
      <el-card v-if="inventoryAlerts.length > 0" style="margin-top: 20px; border-left: 4px solid #e6a23c">
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
      <el-card style="margin-top: 20px">
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
        </el-table>
      </el-card>
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>客户管理</span>
            <div>
              <el-button size="small" @click="loadMembers">刷新客户</el-button>
              <el-button size="small" type="primary" @click="memberDialogVisible = true">新增客户</el-button>
            </div>
          </div>
        </template>
        <el-table :data="members" empty-text="暂无客户">
          <el-table-column prop="memberId" label="客户ID" width="90" />
          <el-table-column prop="name" label="客户名称" />
          <el-table-column prop="mobile" label="手机号" width="140" />
          <el-table-column prop="customerType" label="客户类型" width="120" />
          <el-table-column prop="staffName" label="归属销售员" width="140" />
          <el-table-column label="操作" width="210">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="handleAssignMember(row)">分配给管理员</el-button>
              <el-button size="small" link @click="handleShowPriceHistory(row)">价格参考</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-alert v-if="priceHistoryTip" type="info" show-icon :closable="false" style="margin-top: 12px">
          <template #title>{{ priceHistoryTip }}</template>
        </el-alert>
      </el-card>
      <el-card style="margin-top: 20px">
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
          <el-table-column prop="payableAmount" label="金额" width="100" />
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
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>销售单</span>
            <el-button size="small" @click="loadSaleBills">刷新</el-button>
          </div>
        </template>
        <el-table :data="saleBills" empty-text="暂无销售单">
          <el-table-column prop="billNo" label="销售单号" width="200" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column prop="receivableAmount" label="应收" width="100" />
          <el-table-column prop="receivedAmount" label="已收" width="100" />
          <el-table-column prop="unreceivedAmount" label="未收" width="100" />
          <el-table-column prop="collectionStatus" label="收款" width="120" />
          <el-table-column prop="businessStatus" label="履约" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
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
          <el-table-column prop="shareChannel" label="分享渠道" width="120" />
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
          <el-table-column prop="createdAt" label="创建时间" width="170" />
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
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card style="margin-top: 20px">
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
      <el-card style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>近七天销售趋势</span>
            <el-button size="small" @click="loadDailySales">刷新</el-button>
          </div>
        </template>
        <canvas ref="barCanvas" style="width: 100%; height: 220px" />
        <div v-if="dailySales.length === 0" style="text-align: center; padding: 20px; color: #999">暂无销售数据</div>
      </el-card>
      <div style="display: flex; gap: 20px; margin-top: 20px">
        <el-card style="flex: 1">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>订单状态分布</span>
              <el-button size="small" @click="loadOrderStats">刷新</el-button>
            </div>
          </template>
          <canvas ref="pieCanvas" style="width: 100%; height: 180px" />
        </el-card>
        <el-card style="flex: 1">
          <template #header><span>门店业绩</span></template>
          <el-table :data="storePerf" size="small" empty-text="暂无数据">
            <el-table-column prop="storeName" label="门店" />
            <el-table-column prop="billCount" label="销售单数" width="100" />
            <el-table-column label="销售金额" width="120">
              <template #default="{ row }">¥{{ Number(row.totalSales || 0).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
      <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
        <template v-if="orderDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ orderDetail.customerType }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ orderDetail.orderStatus }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ orderDetail.payStatus }}</el-descriptions-item>
            <el-descriptions-item label="应付金额">¥{{ Number(orderDetail.payableAmount || 0).toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ orderDetail.receiverMobile || "-" }}</el-descriptions-item>
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
      <el-dialog v-model="productDialogVisible" title="新增演示商品" width="520px">
        <el-form label-width="110px">
          <el-form-item label="商品名称">
            <el-input v-model="productForm.name" />
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model="productForm.mainImage" placeholder="可填写商品图片链接" />
          </el-form-item>
          <el-form-item label="SKU名称">
            <el-input v-model="productForm.skuName" />
          </el-form-item>
          <el-form-item label="条码">
            <el-input v-model="productForm.barcode" />
          </el-form-item>
          <el-form-item label="箱瓶换算">
            <el-input-number v-model="productForm.boxRatio" :min="1" />
          </el-form-item>
          <el-form-item label="零售价">
            <el-input-number v-model="productForm.retailPrice" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="批发价">
            <el-input-number v-model="productForm.wholesalePrice" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="productDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateProduct">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="storeDialogVisible" title="新增门店" width="480px">
        <el-form label-width="100px">
          <el-form-item label="门店编码">
            <el-input v-model="storeForm.code" />
          </el-form-item>
          <el-form-item label="门店名称">
            <el-input v-model="storeForm.name" />
          </el-form-item>
          <el-form-item label="门店地址">
            <el-input v-model="storeForm.address" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="storeForm.phone" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="storeDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateStore">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="memberDialogVisible" title="新增客户" width="480px">
        <el-form label-width="100px">
          <el-form-item label="客户名称">
            <el-input v-model="memberForm.name" />
          </el-form-item>
          <el-form-item label="手机号">
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
        <el-form label-width="100px">
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
          <el-form-item label="新价格">
            <el-input-number v-model="priceForm.price" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="priceDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleUpdatePrice">保存</el-button>
        </template>
      </el-dialog>
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminLogin, assignMember, createMember, createProduct, createStore, exportOrdersCsv, fetchCollectionLinks, fetchDailySales, fetchDashboard, fetchInventoryAlerts, fetchInventoryBalances, fetchInventoryLogs, fetchMemberPriceHistory, fetchMembers, fetchOrderDetail, fetchOrders, fetchOrderStats, fetchPaymentOrders, fetchPriceLogs, fetchProducts, fetchRefundOrders, fetchSaleBills, fetchStorePerformance, fetchStores, updateProductPrice, updateProductStatus } from "./api";

const nav = ["首页", "商品", "订单", "销售单", "库存", "收款", "报表", "系统"];

const token = ref(localStorage.getItem("admin_token") || "");
const loading = ref(false);
const products = ref<any[]>([]);
const stores = ref<any[]>([]);
const members = ref<any[]>([]);
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
const barCanvas = ref<HTMLCanvasElement | null>(null);
const pieCanvas = ref<HTMLCanvasElement | null>(null);
const productDialogVisible = ref(false);
const storeDialogVisible = ref(false);
const memberDialogVisible = ref(false);
const priceDialogVisible = ref(false);
const priceHistoryTip = ref("");
const loginForm = reactive({ username: "admin", password: "admin123" });
const productForm = reactive({
  name: "演示新品白酒",
  mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=Wine",
  skuName: "演示新品白酒 500ml",
  barcode: `69${Date.now()}`,
  boxRatio: 6,
  retailPrice: 128,
  wholesalePrice: 98
});
const storeForm = reactive({
  code: `STORE${Date.now().toString().slice(-4)}`,
  name: "演示新门店",
  address: "示例地址",
  phone: "13800000001"
});
const memberForm = reactive({
  name: "演示新客户",
  mobile: `139${Date.now().toString().slice(-8)}`,
  customerType: "RETAIL" as "RETAIL" | "WHOLESALE"
});
const priceForm = reactive({
  skuId: 0,
  skuName: "",
  type: "retail",
  price: 0
});

const cards = ref([
  { label: "今日销售额", value: "¥0.00", desc: "等待接入报表接口" },
  { label: "待收款", value: "0", desc: "销售单分享收款" },
  { label: "待处理订单", value: "0", desc: "小程序订单履约" },
  { label: "库存预警", value: "0", desc: "低库存提醒" }
]);

async function handleLogin() {
  loading.value = true;
  try {
    const result = await adminLogin(loginForm.username, loginForm.password);
    localStorage.setItem("admin_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功");
    await Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts()]);
  } finally {
    loading.value = false;
  }
}

async function loadDashboard() {
  const data = await fetchDashboard();
  cards.value = [
    { label: "今日销售额", value: `¥${Number(data.salesAmount || 0).toFixed(2)}`, desc: "销售单实收金额" },
    { label: "待收款", value: `¥${Number(data.pendingCollectionAmount || 0).toFixed(2)}`, desc: "销售单分享收款" },
    { label: "待处理订单", value: String(data.pendingOrderCount || 0), desc: "小程序订单履约" },
    { label: "库存预警", value: String(data.inventoryWarningCount || 0), desc: "低库存提醒" }
  ];
}

async function loadProducts() {
  const data = await fetchProducts();
  products.value = data.records || [];
}

async function loadStores() {
  const data = await fetchStores();
  stores.value = data.records || [];
}

async function loadMembers() {
  const data = await fetchMembers();
  members.value = data.records || [];
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
    ctx.fillStyle = "#409eff";
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
  const colors = ["#409eff", "#67c23a", "#e6a23c", "#f56c6c", "#909399"];
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

async function handleCreateMember() {
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

onMounted(() => {
  if (token.value) {
    Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts()]).catch(() => {
      ElMessage.warning("接口暂不可用，请确认后端和数据库已启动");
    });
  }
});
</script>
