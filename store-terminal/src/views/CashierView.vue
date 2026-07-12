<template>
  <div class="cashier">
    <!-- 顶栏 -->
    <header class="cashier-topbar">
      <div class="topbar-left">
        <div class="store-logo">酒</div>
        <div class="store-info">
          <div class="store-name">智享酒仓</div>
          <div class="store-sub">收银台 v1.0</div>
        </div>
      </div>
      <div class="topbar-center">
        <div class="search-bar">
          <el-icon><Search /></el-icon>
          <input
            v-model="productKeyword"
            class="search-input"
            placeholder="搜索商品名称 / 条码 / 拼音首字母"
            @keyup.enter="handleSearchProducts"
          />
        </div>
      </div>
      <div class="topbar-right">
        <div class="cashier-status" :class="statusType">
          <span class="status-dot"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <div class="cashier-date">{{ formatDate(new Date()) }}</div>
        <div class="cashier-user">
          <el-avatar :size="28" style="background: var(--color-primary)">收</el-avatar>
          <span>{{ cashierName }}</span>
        </div>
      </div>
    </header>

    <div class="cashier-body">
      <!-- 左侧：分类导航（80px 胶囊导航） -->
      <aside class="cashier-sidebar">
        <div class="category-list">
          <div
            v-for="(cat, idx) in categories"
            :key="cat.id"
            class="category-item"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            <div class="cat-icon">{{ cat.icon }}</div>
            <span class="cat-name">{{ cat.shortName || cat.name }}</span>
          </div>
        </div>
        <div class="sidebar-actions">
          <el-button class="action-btn" @click="holdDialogVisible = true; loadHoldOrders()">
            <el-icon><Timer /></el-icon>
            <span>挂单</span>
            <el-tag size="small">{{ holdOrders.length }}</el-tag>
          </el-button>
        </div>
      </aside>

      <!-- 中间：商品区（3列卡片） -->
      <main class="cashier-main">
        <div class="products-area">
          <div v-if="productOptions.length === 0" class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-text">输入关键词搜索商品</div>
            <div class="empty-hint">支持商品名称、条码、拼音首字母</div>
          </div>
          <div v-else class="product-grid">
            <div
              v-for="product in productOptions"
              :key="product.skuId || product.id"
              class="product-card"
              @click="addCartItem(product)"
            >
              <div class="product-img">
                <span>{{ (product.productName || product.skuName || '?').charAt(0) }}</span>
              </div>
              <div class="product-info">
                <div class="product-name">{{ product.productName || product.skuName }}</div>
                <div class="product-spec">库存：{{ product.availableQty || 0 }}</div>
                <div class="product-price">¥{{ (product.storePrice || product.retailPrice || 0).toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- 右侧：购物车 + 结算（280px 磨砂） -->
      <aside class="cashier-right">
        <div class="cart-header">
          <div class="cart-title">
            <el-icon><ShoppingCart /></el-icon>
            <span>购物车</span>
            <el-tag size="small" type="primary">{{ cartItems.length }}件</el-tag>
          </div>
          <el-button link type="danger" @click="cartItems = []" v-if="cartItems.length > 0">清空</el-button>
        </div>

        <!-- 会员信息 -->
        <div class="member-section">
          <div class="section-label">会员信息</div>
          <div v-if="saleForm.customerName" class="member-selected">
            <el-avatar :size="28" style="background: var(--color-warning)">会</el-avatar>
            <div class="member-info">
              <div class="member-name">{{ saleForm.customerName }}</div>
              <div class="member-phone">{{ saleForm.customerMobile }}</div>
            </div>
            <el-button link type="primary" @click="clearMember">更换</el-button>
          </div>
          <div v-else class="member-search">
            <el-input
              v-model="memberKeyword"
              placeholder="输入手机号/姓名搜索会员"
              size="small"
              clearable
              @keyup.enter="handleSearchMembers"
            >
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
            <div v-if="memberOptions.length > 0" class="member-dropdown">
              <div
                v-for="m in memberOptions"
                :key="m.memberId || m.id"
                class="member-option"
                @click="selectMember(m)"
              >
                <div class="m-name">{{ m.name }}</div>
                <div class="m-phone">{{ m.mobile }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 购物车列表 -->
        <div class="cart-list">
          <div v-if="cartItems.length === 0" class="cart-empty">
            <div class="cart-empty-icon">🛒</div>
            <div>购物车为空</div>
            <div class="cart-empty-hint">点击左侧商品添加</div>
          </div>
          <div v-else class="cart-items">
            <div v-for="(item, index) in cartItems" :key="index" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ item.skuName || item.productName }}</div>
                <div class="cart-item-price">¥{{ item.unitPrice.toFixed(2) }} × {{ item.quantity }}</div>
              </div>
              <div class="cart-item-right">
                <div class="cart-item-subtotal">¥{{ (item.unitPrice * item.quantity).toFixed(2) }}</div>
                <div class="cart-item-qty">
                  <el-button size="small" circle @click="decreaseQty(index)">-</el-button>
                  <span class="qty-num">{{ item.quantity }}</span>
                  <el-button size="small" circle type="primary" @click="increaseQty(index)">+</el-button>
                </div>
              </div>
              <el-button class="cart-item-del" link type="danger" @click="removeCartItem(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <!-- 金额汇总 -->
        <div class="cart-summary">
          <div class="summary-row">
            <span>商品数量</span>
            <span>{{ totalQty }} 件</span>
          </div>
          <div class="summary-row total">
            <span>应收金额</span>
            <span class="total-amount">¥{{ cartAmount.toFixed(2) }}</span>
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="pay-methods">
          <div
            class="pay-method"
            :class="{ active: paymentMethod === 'CASH' }"
            @click="paymentMethod = 'CASH'"
          >
            💵 现金
          </div>
          <div
            class="pay-method"
            :class="{ active: paymentMethod === 'WECHAT' }"
            @click="paymentMethod = 'WECHAT'"
          >
            💚 微信
          </div>
          <div
            class="pay-method"
            :class="{ active: paymentMethod === 'ALIPAY' }"
            @click="paymentMethod = 'ALIPAY'"
          >
            💙 支付宝
          </div>
        </div>

        <!-- 结算按钮 -->
        <div class="checkout-section">
          <el-button
            size="large"
            type="primary"
            class="checkout-btn"
            @click="handleQuickPay"
            :loading="loading"
          >
            快捷收款 ¥{{ cartAmount.toFixed(2) }}
          </el-button>
          <el-button
            size="default"
            class="secondary-btn"
            @click="handleCreateSaleBill"
            :loading="loading"
          >
            生成订单
          </el-button>
        </div>

        <div v-if="currentBillNo" class="order-info">
          <el-alert type="success" :closable="false">
            <template #title>
              订单号：{{ currentBillNo }}
              <span v-if="shareUrl">
                · <el-link type="primary" @click="copyLink">复制收款链接</el-link>
              </span>
            </template>
          </el-alert>
        </div>
      </aside>
    </div>

    <!-- 挂单弹窗 -->
    <el-dialog v-model="holdDialogVisible" title="挂单列表" width="500px">
      <el-table :data="holdOrders" style="width: 100%" size="small">
        <el-table-column prop="holdNo" label="挂单号" width="140" />
        <el-table-column prop="customerName" label="客户" width="100" />
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleRestoreHoldOrder(row.holdNo)">取单</el-button>
            <el-button size="small" type="danger" link @click="handleDeleteHoldOrder(row.holdNo)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import {
  Search, ShoppingCart, User, Delete, Timer
} from "@element-plus/icons-vue";
import {
  searchStoreProducts,
  searchStoreMembers,
  createSaleBill,
  createOfflinePayment,
  createCollectionLink,
  createHoldOrder,
  fetchHoldOrders,
  restoreHoldOrder,
  deleteHoldOrder
} from "../api";

const categories = [
  { id: 'all', name: '全部商品', shortName: '全部', icon: '📦' },
  { id: 'baijiu', name: '白酒', shortName: '白酒', icon: '🍶' },
  { id: 'hongjiu', name: '红酒', shortName: '红酒', icon: '🍷' },
  { id: 'pijiu', name: '啤酒', shortName: '啤酒', icon: '🍺' },
  { id: 'yanjiu', name: '洋酒', shortName: '洋酒', icon: '🥃' },
  { id: 'yinliao', name: '饮料', shortName: '饮料', icon: '🥤' },
];

const activeCategory = ref('all');
const loading = ref(false);
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const statusType = ref<'online' | 'offline' | 'settling'>('online');
const saleForm = reactive({
  customerId: 0,
  customerName: "",
  customerMobile: "",
  taxEnabled: false,
  taxRate: 0.13
});
const currentBillNo = ref("");
const currentAmount = ref(0);
const shareUrl = ref("");
const holdDialogVisible = ref(false);
const holdOrders = ref<any[]>([]);

const statusText = computed(() => {
  const map = { online: '在线', offline: '离线', settling: '日结中' };
  return map[statusType.value];
});

const cashierName = computed(() => {
  try {
    const raw = localStorage.getItem("store_user");
    if (raw) return JSON.parse(raw).realName || "收银员";
  } catch {}
  return "收银员";
});

const totalQty = computed(() => cartItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

onMounted(() => {
  loadHoldOrders();
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function getLoginUserStoreId(): number {
  try {
    const raw = localStorage.getItem("login_response");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user?.storeId) return Number(parsed.user.storeId);
      if (parsed?.storeId) return Number(parsed.storeId);
    }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem("store_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.storeId) return Number(parsed.storeId);
    }
  } catch { /* ignore */ }
  throw new Error("无法获取当前门店ID，请重新登录");
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
  try {
    const data = await searchStoreMembers(memberKeyword.value.trim());
    memberOptions.value = data.records || [];
  } catch {
    memberOptions.value = [];
  }
}

function selectMember(row: any) {
  saleForm.customerId = Number(row.memberId || row.id || 0);
  saleForm.customerName = row.name || "";
  saleForm.customerMobile = row.mobile || "";
  memberOptions.value = [];
  memberKeyword.value = "";
  ElMessage.success(`已选择客户：${saleForm.customerName || "散客"}`);
}

function clearMember() {
  saleForm.customerId = 0;
  saleForm.customerName = "";
  saleForm.customerMobile = "";
}

function addCartItem(row: any) {
  const skuId = Number(row.skuId || row.id);
  if (!skuId) {
    ElMessage.warning("当前商品缺少 SKU ID");
    return;
  }
  const unitPrice = Number(row.storePrice || row.retailPrice || 0);
  if (unitPrice <= 0) {
    ElMessage.warning("该商品单价为 0，请确认价格后再加入购物车");
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
    unitPrice,
    availableQty: Number(row.availableQty || 0)
  });
}

function increaseQty(index: number) {
  cartItems.value[index].quantity++;
}

function decreaseQty(index: number) {
  if (cartItems.value[index].quantity > 1) {
    cartItems.value[index].quantity--;
  } else {
    cartItems.value.splice(index, 1);
  }
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
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity || 1),
        boxQty: Number(item.boxQty || 0),
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
  } finally {
    loading.value = false;
  }
}

async function handleQuickPay() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createSaleBill({
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity || 1),
        boxQty: Number(item.boxQty || 0),
        bottleQty: Number(item.quantity || 1),
        totalBottleQty: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        priceType: "STORE"
      }))
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);

    await createOfflinePayment(currentBillNo.value, currentAmount.value, paymentMethod.value);
    ElMessage.success("收款成功");
    currentAmount.value = 0;
    currentBillNo.value = "";
    shareUrl.value = "";
    cartItems.value = [];
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "收款失败"));
  } finally {
    loading.value = false;
  }
}

async function handleCreateHoldOrder() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  try {
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
    cartItems.value = [];
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "挂单失败，请重试"));
  }
}

async function loadHoldOrders() {
  try {
    const data = await fetchHoldOrders();
    holdOrders.value = data.records || [];
  } catch {
    // ignore
  }
}

async function handleRestoreHoldOrder(holdNo: string) {
  try {
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
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "取单失败，请重试"));
  }
}

async function handleDeleteHoldOrder(holdNo: string) {
  try {
    await deleteHoldOrder(holdNo);
    ElMessage.success("挂单已删除");
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "删除挂单失败"));
  }
}

function copyLink() {
  if (shareUrl.value) {
    navigator.clipboard.writeText(shareUrl.value);
    ElMessage.success("链接已复制");
  }
}
</script>

<style scoped>
.cashier {
  width: 1024px;
  height: 768px;
  margin: 0 auto;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ========== 顶栏 ========== */
.cashier-topbar {
  height: var(--topbar-height);
  background: var(--frost-topbar);
  backdrop-filter: var(--frost-topbar-blur);
  -webkit-backdrop-filter: var(--frost-topbar-blur);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.store-logo {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
}

.store-info {
  display: flex;
  flex-direction: column;
}

.store-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.store-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.topbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.search-bar {
  width: 360px;
  height: 32px;
  background: var(--gray-100);
  border: 1px solid transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  transition: all 150ms ease;
}

.search-bar:focus-within {
  border-color: var(--color-primary);
  background: #fff;
}

.search-bar .el-icon {
  color: var(--text-muted);
  font-size: 14px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.cashier-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--gray-100);
  font-size: 12px;
}

.cashier-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cashier-status.online .status-dot {
  background: #0EA879;
  box-shadow: 0 0 6px rgba(14, 168, 121, 0.6);
}

.cashier-status.online .status-text {
  color: #0EA879;
  font-weight: 500;
}

.cashier-status.offline .status-dot {
  background: #C0392B;
  box-shadow: 0 0 6px rgba(192, 57, 43, 0.6);
}

.cashier-status.offline .status-text {
  color: #C0392B;
  font-weight: 500;
}

.cashier-status.settling .status-dot {
  background: #D48B3A;
  box-shadow: 0 0 6px rgba(212, 139, 58, 0.6);
}

.cashier-status.settling .status-text {
  color: #D48B3A;
  font-weight: 500;
}

.cashier-date {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.cashier-user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* ========== 主体 ========== */
.cashier-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ========== 左侧：80px 胶囊导航 ========== */
.cashier-sidebar {
  width: var(--terminal-nav-width);
  background: var(--frost-sidebar);
  backdrop-filter: var(--frost-sidebar-blur);
  -webkit-backdrop-filter: var(--frost-sidebar-blur);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.category-list {
  flex: 1;
  padding: 0 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: var(--nav-item-radius);
  cursor: pointer;
  transition: all 250ms ease-out;
  color: var(--sidebar-text-secondary);
}

.category-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--sidebar-text-primary);
}

.category-item.active {
  background: rgba(91, 106, 191, 0.25);
  color: #FFFFFF;
  font-weight: 500;
}

.cat-icon {
  font-size: 20px;
}

.cat-name {
  font-size: 11px;
  text-align: center;
  line-height: 1.2;
}

.sidebar-actions {
  padding: 8px 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.action-btn {
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
  padding: 10px 4px !important;
  height: auto !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border: none !important;
  color: var(--sidebar-text-secondary) !important;
  border-radius: var(--nav-item-radius) !important;
  font-size: 11px !important;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  color: var(--sidebar-text-primary) !important;
}

.action-btn .el-icon {
  font-size: 18px;
}

.action-btn .el-tag {
  font-size: 10px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
}

/* ========== 中间：商品区 ========== */
.cashier-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
}

.products-area {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 12px;
  margin-top: 4px;
}

/* 3列商品网格 */
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.product-card {
  background: var(--bg-card);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  flex-direction: column;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.product-card:active {
  transform: scale(0.97);
}

.product-img {
  height: 90px;
  background: linear-gradient(135deg, var(--gray-100), var(--gray-200));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-muted);
}

.product-info {
  padding: 8px 10px;
}

.product-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-spec {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}

.product-price {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
  margin-top: 4px;
  font-family: var(--font-mono);
}

/* ========== 右侧：280px 磨砂购物车 ========== */
.cashier-right {
  width: var(--terminal-cart-width);
  background: var(--frost-cart);
  backdrop-filter: var(--frost-cart-blur);
  -webkit-backdrop-filter: var(--frost-cart-blur);
  border-left: 1px solid var(--border-light);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.cart-header {
  height: 44px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cart-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.member-section {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.member-selected {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.member-phone {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

.member-search {
  position: relative;
}

.member-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid var(--border-normal);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
  max-height: 160px;
  overflow-y: auto;
}

.member-option {
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
}

.member-option:last-child {
  border-bottom: none;
}

.member-option:hover {
  background: var(--gray-50);
}

.m-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.m-phone {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.cart-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 160px;
  color: var(--text-muted);
  font-size: 12px;
}

.cart-empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
  opacity: 0.4;
}

.cart-empty-hint {
  font-size: 11px;
  margin-top: 2px;
}

.cart-items {
  padding: 6px 10px;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  position: relative;
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item-info {
  flex: 1;
  min-width: 0;
}

.cart-item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cart-item-price {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  font-family: var(--font-mono);
}

.cart-item-right {
  text-align: right;
  flex-shrink: 0;
}

.cart-item-subtotal {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: var(--font-mono);
}

.cart-item-qty {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}

.qty-num {
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
}

.cart-item-del {
  position: absolute;
  top: 6px;
  right: 0;
}

.cart-summary {
  padding: 10px 14px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.summary-row.total {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-normal);
}

.total-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  font-family: var(--font-mono);
}

.pay-methods {
  display: flex;
  gap: 6px;
  padding: 0 14px 10px;
  flex-shrink: 0;
}

.pay-method {
  flex: 1;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--gray-100);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid transparent;
}

.pay-method:hover {
  background: var(--gray-200);
}

.pay-method.active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 500;
}

.checkout-section {
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkout-btn {
  width: 100% !important;
  height: 52px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
}

.secondary-btn {
  width: 100% !important;
  height: 36px !important;
  font-size: 13px !important;
  border-radius: 6px !important;
}

.order-info {
  padding: 0 14px 12px;
}
</style>
