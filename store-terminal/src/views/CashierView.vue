<template>
  <div class="cashier">
    <!-- 左侧：分类导航 -->
    <aside class="cashier-sidebar">
      <div class="sidebar-header">
        <div class="store-info">
          <div class="store-logo">酒</div>
          <div class="store-detail">
            <div class="store-name">智享酒仓</div>
            <div class="store-sub">收银台 v1.0</div>
          </div>
        </div>
      </div>
      <div class="category-list">
        <div
          v-for="(cat, idx) in categories"
          :key="cat.id"
          class="category-item"
          :class="{ active: activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          <div class="cat-icon">{{ cat.icon }}</div>
          <span>{{ cat.name }}</span>
        </div>
      </div>
      <div class="sidebar-footer">
        <div class="cashier-info">
          <el-avatar :size="32" style="background: var(--color-primary)">收</el-avatar>
          <div class="cashier-detail">
            <div class="cashier-name">{{ cashierName }}</div>
            <div class="cashier-role">收银员</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 中间：商品区 -->
    <main class="cashier-main">
      <div class="main-topbar">
        <div class="search-bar">
          <el-icon><Search /></el-icon>
          <input
            v-model="productKeyword"
            class="search-input"
            placeholder="搜索商品名称 / 条码 / 拼音首字母"
            @keyup.enter="handleSearchProducts"
          />
          <el-button type="primary" size="default" @click="handleSearchProducts" :loading="loading">
            搜索
          </el-button>
        </div>
        <div class="topbar-actions">
          <el-button @click="holdDialogVisible = true; loadHoldOrders()">
            <el-icon><Timer /></el-icon>
            挂单 ({{ holdOrders.length }})
          </el-button>
          <el-button type="warning" @click="handleCreateHoldOrder">
            <el-icon><Promotion /></el-icon>
            挂起当前单
          </el-button>
        </div>
      </div>

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

    <!-- 右侧：购物车 + 结算 -->
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
          <el-avatar :size="32" style="background: var(--color-warning)">会</el-avatar>
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
          <span>{{ cartItems.length }} 件</span>
        </div>
        <div class="summary-row total">
          <span>应收金额</span>
          <span class="total-amount">¥{{ cartAmount.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 结算按钮 -->
      <div class="checkout-section">
        <el-radio-group v-model="paymentMethod" size="large" class="pay-methods">
          <el-radio-button value="CASH">现金</el-radio-button>
          <el-radio-button value="WECHAT">微信</el-radio-button>
          <el-radio-button value="ALIPAY">支付宝</el-radio-button>
        </el-radio-group>

        <div class="checkout-buttons">
          <el-button size="large" class="btn-secondary" @click="handleCreateSaleBill" :loading="loading">
            生成订单
          </el-button>
          <el-button size="large" type="primary" class="btn-primary" @click="handleQuickPay" :loading="loading">
            快捷收款 ¥{{ cartAmount.toFixed(2) }}
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
      </div>
    </aside>

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
  Search, ShoppingCart, User, Delete, Timer, Promotion
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
import { formatYuan } from "../utils/format";

const categories = [
  { id: 'all', name: '全部商品', icon: '📦' },
  { id: 'baijiu', name: '白酒', icon: '🍶' },
  { id: 'hongjiu', name: '红酒', icon: '🍷' },
  { id: 'pijiu', name: '啤酒', icon: '🍺' },
  { id: 'yanjiu', name: '洋酒', icon: '🥃' },
  { id: 'yinliao', name: '饮料', icon: '🥤' },
];

const activeCategory = ref('all');
const loading = ref(false);
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
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

const cashierName = computed(() => {
  try {
    const raw = localStorage.getItem("store_user");
    if (raw) return JSON.parse(raw).realName || "收银员";
  } catch {}
  return "收银员";
});

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

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
  display: flex;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

/* 左侧分类栏 */
.cashier-sidebar {
  width: 180px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-normal);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px 14px;
  border-bottom: 1px solid var(--border-normal);
}

.store-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.store-logo {
  width: 38px;
  height: 38px;
  background: var(--color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
}

.store-detail {
  flex: 1;
  min-width: 0;
}

.store-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.store-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.category-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.category-item:hover {
  background: var(--gray-100);
  color: var(--text-primary);
}

.category-item.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.cat-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-normal);
}

.cashier-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
}

.cashier-detail {
  flex: 1;
  min-width: 0;
}

.cashier-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cashier-role {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 中间商品区 */
.cashier-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-topbar {
  height: 64px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-normal);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  flex-shrink: 0;
}

.search-bar {
  flex: 1;
  max-width: 520px;
  height: 40px;
  background: var(--gray-50);
  border: 1px solid var(--border-normal);
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 6px 0 14px;
  gap: 8px;
  transition: border-color 0.15s ease;
}

.search-bar:focus-within {
  border-color: var(--color-primary);
  background: #fff;
}

.search-bar .el-icon {
  color: var(--text-muted);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.topbar-actions {
  display: flex;
  gap: 10px;
}

.products-area {
  flex: 1;
  padding: 20px;
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
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  margin-top: 6px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-color: var(--color-primary);
}

.product-img {
  height: 100px;
  background: linear-gradient(135deg, var(--gray-100), var(--gray-200));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  color: var(--text-muted);
}

.product-info {
  padding: 10px 12px;
}

.product-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-spec {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

.product-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-danger);
  margin-top: 6px;
}

/* 右侧结算栏 */
.cashier-right {
  width: 380px;
  background: var(--bg-card);
  border-left: 1px solid var(--border-normal);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.cart-header {
  height: 64px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-normal);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.member-section {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-normal);
  flex-shrink: 0;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.member-selected {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.member-phone {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.member-option {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-normal);
}

.member-option:last-child {
  border-bottom: none;
}

.member-option:hover {
  background: var(--gray-50);
}

.m-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.m-phone {
  font-size: 12px;
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
  height: 200px;
  color: var(--text-muted);
  font-size: 14px;
}

.cart-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.cart-empty-hint {
  font-size: 12px;
  margin-top: 4px;
}

.cart-items {
  padding: 8px 16px;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-normal);
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
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cart-item-price {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.cart-item-right {
  text-align: right;
  flex-shrink: 0;
}

.cart-item-subtotal {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-danger);
}

.cart-item-qty {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.qty-num {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
}

.cart-item-del {
  position: absolute;
  top: 10px;
  right: 0;
}

.cart-summary {
  padding: 16px 20px;
  border-top: 1px solid var(--border-normal);
  flex-shrink: 0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.summary-row.total {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-normal);
}

.total-amount {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-danger);
}

.checkout-section {
  padding: 16px 20px 20px;
  border-top: 1px solid var(--border-normal);
  flex-shrink: 0;
}

.pay-methods {
  width: 100%;
  display: flex;
  margin-bottom: 14px;
}

.pay-methods :deep(.el-radio-button) {
  flex: 1;
}

.pay-methods :deep(.el-radio-button__inner) {
  width: 100%;
  text-align: center;
}

.checkout-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.btn-secondary {
  flex: 1;
}

.btn-primary {
  flex: 2;
  font-weight: 600;
  font-size: 15px;
}

.order-info {
  margin-top: 10px;
}
</style>
