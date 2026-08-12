<template>
  <div class="pos-cashier">
    <!-- 工作区：分类 | 商品 | 购物车（对标设计稿收银台左右布局） -->
    <div class="cashier-workspace">
      <!-- 左侧：商品分类（固定可见，彩色分类标识） -->
      <aside class="category-panel">
        <div class="category-panel-title">商品分类</div>
        <div
          class="category-item"
          :class="{ active: activeCategory === 0 }"
          @click="selectCategory(0)"
        >
          <span class="category-dot category-dot--all"></span>
          <span class="category-name">全部</span>
          <span class="category-count">{{ productOptions.length }}</span>
        </div>
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="category-item"
          :class="{ active: activeCategory === cat.id }"
          @click="selectCategory(cat.id)"
        >
          <span class="category-dot" :style="{ background: categoryColor(cat.id) }"></span>
          <span class="category-name">{{ cat.name }}</span>
          <span class="category-count">{{ categoryCount(cat.id) }}</span>
        </div>
      </aside>

      <!-- 中间：商品搜索与列表 -->
      <section class="product-panel">
        <div class="product-searchbar">
          <el-input
            ref="productSearchRef"
            v-model="productKeyword"
            class="product-search-input"
            placeholder="搜索商品名称 / 条码 / 拼音首字母，扫码枪直接扫描"
            clearable
            @keyup.enter="handleSearchProducts"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button class="scan-button" :loading="loading" @click="handleScan">
            <el-icon class="btn-icon"><FullScreen /></el-icon>
            扫码
          </el-button>
          <el-button type="primary" class="search-button" :loading="loading" @click="handleSearchProducts">
            搜索
          </el-button>
        </div>

        <div v-if="productOptions.length === 0" class="empty-state">
          <el-empty description="输入关键词搜索商品，或点击分类浏览" />
        </div>
        <div v-else class="product-grid">
          <div
            v-for="product in filteredProducts"
            :key="product.skuId || product.id"
            class="product-card"
            :class="{ 'is-out': Number(product.availableQty ?? 0) <= 0 }"
            @click="addCartItem(product)"
          >
            <div class="product-card-top">
              <span class="product-cat-dot" :style="{ background: categoryColor(product.categoryId) }"></span>
              <span class="product-stock" :class="stockClass(product.availableQty ?? 0)">
                {{ stockText(product.availableQty ?? 0) }}
              </span>
            </div>
            <div class="product-name">{{ product.productName || product.skuName }}</div>
            <div class="product-spec">{{ product.skuName || "标准规格" }}</div>
            <div class="product-card-bottom">
              <div class="product-price">
                <span class="price-symbol">¥</span>
                <span class="price-value">{{ Number(product.storePrice || product.retailPrice || 0).toFixed(2) }}</span>
              </div>
              <button
                class="add-btn"
                :disabled="Number(product.availableQty ?? 0) <= 0"
                @click.stop="addCartItem(product)"
              >
                <el-icon><Plus /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：购物车与结算 -->
      <section class="cart-panel">
        <!-- 会员信息 -->
        <div class="member-section">
          <div class="member-selected">
            <span class="member-avatar"><el-icon><User /></el-icon></span>
            <div class="member-meta">
              <div class="member-name">{{ saleForm.customerName || "散户" }}</div>
              <div class="member-phone">{{ saleForm.customerId > 0 ? (saleForm.customerMobile || "会员") : "散户" }}</div>
            </div>
            <!-- 会员选择框：默认散户，下拉直接选择会员，选中即切换为会员 -->
            <el-select
              v-model="selectedMemberId"
              filterable
              remote
              clearable
              size="small"
              placeholder="识别 / 选择会员"
              :remote-method="handleSearchMembers"
              :loading="memberLoading"
              class="member-select"
              @change="onMemberSelect"
              @clear="useWalkInCustomer"
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
              <el-option
                v-for="m in memberOptions"
                :key="m.memberId || m.id"
                :label="`${m.name} ${m.mobile || ''}`"
                :value="m.memberId || m.id"
              />
            </el-select>
          </div>
        </div>

        <!-- 购物车列表 -->
        <div class="cart-list" :class="{ empty: cartItems.length === 0 }">
          <template v-if="cartItems.length > 0">
            <div v-for="(item, index) in cartItems" :key="item.skuId" class="cart-row">
              <div class="cart-row-main">
                <div class="cart-row-name">{{ item.skuName }}</div>
                <div v-if="editingPriceIdx === index" class="cart-row-price">
                  <span class="cart-row-price-symbol">¥</span>
                  <el-input-number
                    v-model="item.unitPrice"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    size="small"
                    class="cart-row-price-input"
                    :ref="(el: any) => priceInputRefs[index] = el"
                    @change="confirmPriceEdit(index)"
                    @blur="confirmPriceEdit(index)"
                    @keyup.enter="confirmPriceEdit(index)"
                  />
                </div>
                <div v-else class="cart-row-price cart-row-price--static" @click="startPriceEdit(index)">
                  <span class="cart-row-price-symbol">¥</span>
                  <span class="cart-row-price-text">{{ Number(item.unitPrice).toFixed(2) }}</span>
                </div>
              </div>
              <div class="cart-row-qty">
                <button class="qty-btn" @click="decreaseQty(index)">−</button>
                <span class="qty-value">{{ item.quantity }}</span>
                <button class="qty-btn" @click="increaseQty(index)">+</button>
              </div>
              <div class="cart-row-amount">¥{{ (item.unitPrice * item.quantity).toFixed(2) }}</div>
              <button class="cart-row-del" @click="removeCartItem(index)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </template>
          <div v-else class="cart-empty">
            <el-icon class="cart-empty-icon"><ShoppingCart /></el-icon>
            <span>点击左侧商品加入购物车</span>
          </div>
        </div>

        <!-- 金额汇总 -->
        <div class="cart-summary">
          <div class="summary-row">
            <span>商品件数</span>
            <span class="summary-num">{{ totalQty }} 件</span>
          </div>
          <div class="summary-row total">
            <span>应收金额</span>
            <span class="total-amount">
              <span class="price-symbol">¥</span>{{ cartAmount.toFixed(2) }}
            </span>
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="pay-methods">
          <button
            v-for="m in payMethodOptions"
            :key="m.value"
            class="pay-method-btn"
            :class="{ active: paymentMethod === m.value }"
            @click="paymentMethod = m.value"
          >
            <span
              class="pay-method-icon"
              :class="payIconClass(m.value)"
            >
              <PayMethodLogo :method="m.value" />
            </span>
            <span class="pay-method-name">{{ m.label }}</span>
          </button>
        </div>

        <!-- 功能导航 + 结算：结算占右侧两列并跨两行（填充原清空/打印位） -->
        <div class="cart-action-grid">
          <button class="action-btn" @click="handleCreateHoldOrder">
            <span class="action-kbd">F2</span>
            <span class="action-label">挂单</span>
          </button>
          <button class="action-btn" @click="holdDialogVisible = true">
            <span class="action-kbd">F4</span>
            <span class="action-label">取单</span>
          </button>
          <button class="action-btn" @click="cartItems = []">
            <span class="action-label">清空</span>
          </button>
          <button class="action-btn" @click="handlePrint">
            <span class="action-kbd">F9</span>
            <span class="action-label">打印</span>
          </button>
          <button class="checkout-btn" :disabled="cartItems.length === 0 || loading" @click="openPayDialog">
            <span class="checkout-label">结算</span>
            <span class="checkout-amount">
              <span class="price-symbol">¥</span>{{ cartAmount.toFixed(2) }}
            </span>
          </button>
        </div>

        <el-alert
          v-if="currentBillNo"
          type="success"
          :closable="false"
          class="bill-alert"
        >
          订单号：{{ currentBillNo }}
        </el-alert>
      </section>
    </div>

    <!-- 结算弹窗（对标设计稿 p12：应收 / 支付方式 / 实收 / 找零 / 确认收款 + 数字键盘） -->
    <el-dialog
      v-model="payDialogVisible"
      title="收款结算"
      width="680px"
      :close-on-click-modal="false"
      align-center
      class="pay-dialog"
    >
      <div class="pay-dialog-body">
        <div class="pay-amount-row">
          <span class="pay-amount-label">应收金额</span>
          <span class="pay-amount-value">¥{{ cartAmount.toFixed(2) }}</span>
        </div>
        <div class="pay-items-info">
          {{ totalQty }} 件商品 · {{ saleForm.customerName || "散客" }}
          <template v-if="paymentMethod === 'BALANCE'"> · 可用余额 ¥{{ memberBalance.toFixed(2) }}</template>
        </div>

        <div class="pay-method-title">支付方式</div>
        <div class="pay-method-grid">
          <button
            v-for="m in payMethodOptions"
            :key="m.value"
            class="pay-method-card"
            :class="{ active: paymentMethod === m.value }"
            @click="paymentMethod = m.value"
          >
            <span
              class="pay-method-icon"
              :class="payIconClass(m.value)"
            >
              <PayMethodLogo :method="m.value" />
            </span>
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div class="pay-received-row">
          <span class="pay-received-label">实收金额</span>
          <span class="pay-received-value">¥{{ receivedAmount.toFixed(2) }}</span>
        </div>

        <!-- 数字键盘：快速收银输入 -->
        <div class="numpad">
          <button v-for="key in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']" :key="key" class="numpad-key" @click="numpadPress(key)">
            {{ key }}
          </button>
          <button class="numpad-key numpad-clear" @click="receivedAmount = 0">C</button>
          <button class="numpad-key numpad-equal" @click="receivedAmount = Number(cartAmount.toFixed(2))">应收</button>
        </div>

        <div v-if="changeAmount > 0" class="pay-change-row">
          <span>应找零</span>
          <span class="pay-change-value">¥{{ changeAmount.toFixed(2) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" size="large" :loading="loading" @click="confirmPayment">
          确认收款
        </el-button>
      </template>
    </el-dialog>

    <!-- 挂单弹窗 -->
    <el-dialog v-model="holdDialogVisible" title="挂单列表" width="720px">
      <el-button type="primary" style="margin-bottom: 12px" @click="handleCreateHoldOrder">挂当前购物车</el-button>
      <el-table :data="holdOrders" size="small">
        <el-table-column prop="holdNo" label="挂单号" width="160" />
        <el-table-column prop="customerName" label="客户" width="120" />
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
import { computed, reactive, ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import {
  Search, User, Plus, Close, FullScreen, ShoppingCart
} from "@element-plus/icons-vue";
import PayMethodLogo from "../../components/pos/PayMethodLogo.vue";
import {
  searchStoreProducts,
  searchStoreMembers,
  fetchProductCategories,
  createStoreSaleBill,
  createStoreOfflinePayment,
  createStoreHoldOrder,
  fetchStoreHoldOrders,
  restoreStoreHoldOrder,
  deleteStoreHoldOrder
} from "../../api";
import { getLocalPrintConfig } from "../../modules/print/localConfig";
import { openPrintWindow, printBill } from "../../modules/print/printClient";
import { buildTableHtml, fmtMoney, rawHtml } from "../../modules/print/renderer";

const loading = ref(false);
const productKeyword = ref("");
const productSearchRef = ref();
const productOptions = ref<any[]>([]);
const categories = ref<any[]>([]);
const activeCategory = ref(0);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const selectedMemberId = ref<number | null>(null);
const memberLoading = ref(false);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const saleForm = reactive({
  customerId: 0,
  customerName: "散户",
  customerMobile: ""
});
const currentBillNo = ref("");
const currentAmount = ref(0);
const holdDialogVisible = ref(false);
const holdOrders = ref<any[]>([]);
const payDialogVisible = ref(false);
const receivedAmount = ref(0);
/** 会员可用余额（选中会员且有数据时展示，无则 0） */
const memberBalance = ref(0);

/** 支付方式配置：图标 + 文案（现金/微信/支付宝/余额） */
const payMethodOptions = [
  { value: "CASH", label: "现金" },
  { value: "WECHAT", label: "微信" },
  { value: "ALIPAY", label: "支付宝" },
  { value: "BALANCE", label: "余额" }
];

function payIconClass(value: string): string {
  const map: Record<string, string> = {
    CASH: "pay-method-icon--cash",
    WECHAT: "pay-method-icon--wechat",
    ALIPAY: "pay-method-icon--alipay",
    BALANCE: "pay-method-icon--balance",
  };
  return map[value] || "";
}

/** 分类色板：按 categoryId 循环取色，商品与分类颜色一致 */
const CATEGORY_COLORS = ["#3F6FEF", "#0EA879", "#D48B3A", "#C0392B", "#8B5CF6", "#06B6D4", "#E67E22", "#16A085"];

function categoryColor(id?: number): string {
  if (!id) return "#CCCCCC";
  const idx = Math.abs(Number(id)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[idx];
}

const totalQty = computed(() => cartItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

/** 应找零 = 实收 - 应收 */
const changeAmount = computed(() => {
  return Math.max(0, receivedAmount.value - cartAmount.value);
});

/** 按分类过滤后的商品列表（前端过滤，无需重复请求） */
const filteredProducts = computed(() => {
  if (activeCategory.value === 0) return productOptions.value;
  return productOptions.value.filter(
    (p) => Number(p.categoryId) === activeCategory.value
  );
});

/** 分类商品数量 */
function categoryCount(catId: number): number {
  return productOptions.value.filter((p) => Number(p.categoryId) === catId).length;
}

/** 库存状态：0 缺货红 / ≤10 告急橙 / 其余正常灰 */
function stockClass(stock: number): string {
  if (stock <= 0) return 'stock-out'
  if (stock <= 10) return 'stock-low'
  return 'stock-ok'
}

function stockText(stock: number): string {
  if (stock <= 0) return "缺货"
  if (stock <= 10) return `库存 ${stock}`
  return `库存 ${stock}`
}

onMounted(() => {
  loadHoldOrders();
  loadCategories();
  loadAllProducts();
  window.addEventListener("keydown", handleHotkey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleHotkey);
});

/** 键盘快捷键：F2 挂单 / F3 扫码 / F4 取单 / F8 结算 / F9 打印 */
function handleHotkey(e: KeyboardEvent) {
  if (e.key === "F2") {
    e.preventDefault();
    handleCreateHoldOrder();
  } else if (e.key === "F3") {
    e.preventDefault();
    handleScan();
  } else if (e.key === "F4") {
    e.preventDefault();
    holdDialogVisible.value = true;
    loadHoldOrders();
  } else if (e.key === "F8") {
    e.preventDefault();
    openPayDialog();
  } else if (e.key === "F9") {
    e.preventDefault();
    handlePrint();
  }
}

/** 加载商品分类 */
async function loadCategories() {
  try {
    const list = await fetchProductCategories();
    categories.value = Array.isArray(list) ? list : (list?.records || list?.list || []);
  } catch (e) {
    console.error("加载商品分类失败", e);
  }
}

/** 默认加载全部在售商品（对标 POS 效率优先：进入即见商品） */
async function loadAllProducts() {
  loading.value = true;
  try {
    const data = await searchStoreProducts();
    productOptions.value = data.records || [];
  } catch (e) {
    console.error("加载商品失败", e);
  } finally {
    loading.value = false;
  }
}

/** 选择分类 */
function selectCategory(id: number) {
  activeCategory.value = id;
}

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function getLoginUserStoreId(): number {
  try {
    const raw = localStorage.getItem("admin_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed;
      if (user?.storeId) return Number(user.storeId);
    }
  } catch { /* ignore */ }
  return 1;
}

function getLoginUserRealName(): string {
  try {
    const raw = localStorage.getItem("admin_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed;
      return user?.realName || user?.username || "";
    }
  } catch { /* ignore */ }
  return "";
}

async function handleSearchProducts() {
  if (!productKeyword.value.trim()) {
    loadAllProducts();
    return;
  }
  loading.value = true;
  try {
    const data = await searchStoreProducts({ keyword: productKeyword.value.trim() });
    productOptions.value = data.records || [];
    // 搜索结果展示全部匹配商品，重置分类过滤
    activeCategory.value = 0;
    if (productOptions.value.length === 0) {
      ElMessage.info("未找到匹配商品");
    } else if (productOptions.value.length === 1) {
      // 扫码/精确搜索命中唯一商品：自动加入购物车（数量默认 1）
      addCartItem(productOptions.value[0]);
    }
  } finally {
    loading.value = false;
  }
}

/** 会员下拉远程搜索（el-select remote-method） */
async function handleSearchMembers(query?: string) {
  memberKeyword.value = (query ?? memberKeyword.value ?? "").trim();
  if (!memberKeyword.value) {
    memberOptions.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    const data = await searchStoreMembers(memberKeyword.value.trim());
    memberOptions.value = data.records || [];
  } catch {
    memberOptions.value = [];
  } finally {
    memberLoading.value = false;
  }
}

/** 选择会员：散户直接切换为所选会员 */
function onMemberSelect(id: number) {
  const m = memberOptions.value.find((x) => Number(x.memberId || x.id) === Number(id));
  saleForm.customerId = Number(id || 0);
  saleForm.customerName = m?.name || "";
  saleForm.customerMobile = m?.mobile || "";
  memberOptions.value = [];
  memberKeyword.value = "";
  ElMessage.success(`已选择客户：${saleForm.customerName || "散户"}`);
}

/** 清空/切换回散户 */
function useWalkInCustomer() {
  saleForm.customerId = 0;
  saleForm.customerName = "散户";
  saleForm.customerMobile = "";
  selectedMemberId.value = null;
}

function addCartItem(row: any) {
  const skuId = Number(row.skuId || row.id);
  if (!skuId) {
    ElMessage.warning("当前商品缺少 SKU ID");
    return;
  }
  const unitPrice = Number(row.storePrice || row.retailPrice || 0);
  if (unitPrice <= 0) {
    ElMessage.warning("该商品单价为 0，请确认价格");
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
  cartItems.value[index].quantity = Number(cartItems.value[index].quantity || 0) + 1;
}

/** 改价：点击价格才进入编辑框，改完自动回到文本显示 */
const editingPriceIdx = ref(-1);
const priceInputRefs = ref<any[]>([]);

function startPriceEdit(index: number) {
  editingPriceIdx.value = index;
  nextTick(() => {
    priceInputRefs.value[index]?.focus?.();
  });
}

function confirmPriceEdit(index: number) {
  if (editingPriceIdx.value !== index) return;
  const item = cartItems.value[index];
  if (item) onPriceChange(item);
  editingPriceIdx.value = -1;
}

/** 改价：谈好价后直接修改行单价，金额自动重算 */
function onPriceChange(item: any) {
  item.unitPrice = Math.max(0, Number(item.unitPrice || 0));
}

function decreaseQty(index: number) {
  const item = cartItems.value[index];
  const next = Number(item.quantity || 0) - 1;
  if (next <= 0) {
    cartItems.value.splice(index, 1);
    return;
  }
  item.quantity = next;
}

function removeCartItem(index: number) {
  cartItems.value.splice(index, 1);
}

/** 扫码：聚焦商品搜索框（扫码枪输入条码后回车即搜） */
function handleScan() {
  productSearchRef.value?.focus?.();
  ElMessage.info("请扫码或输入条码后回车");
}

/** 数字键盘输入 */
function numpadPress(key: string) {
  if (key === "⌫") {
    const s = String(receivedAmount.value);
    receivedAmount.value = Number(s.slice(0, -1) || 0);
    return;
  }
  if (key === ".") {
    const s = String(receivedAmount.value);
    if (!s.includes(".")) receivedAmount.value = Number(s + ".");
    return;
  }
  const s = String(receivedAmount.value);
  if (s.includes(".") && s.split(".")[1].length >= 2) return;
  const next = Number(s + key);
  receivedAmount.value = Number(next.toFixed(2));
}

/** 打印小票：加载模板 → 渲染 → 输出（本机配置优先本地助手，其次浏览器） */
function handlePrint() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("购物车为空，无可打印内容");
    return;
  }
  const cfg = getLocalPrintConfig();
  const items = buildTableHtml(
    cartItems.value.map((item) => ({
      name: item.skuName || item.productName || "-",
      qty: `x${item.quantity}`,
      amount: `¥${fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1))}`,
    })),
    [
      { key: "name", label: "品名", align: "left" },
      { key: "qty", label: "数量" },
      { key: "amount", label: "金额", align: "right" },
    ]
  );
  const payLabel =
    payMethodOptions.find((m) => m.value === paymentMethod.value)?.label ??
    paymentMethod.value;
  // 同步开窗防弹窗拦截，模板异步加载后写入
  const win = openPrintWindow();
  printBill({
    billType: "SALE_RECEIPT",
    billNo: currentBillNo.value || `POS${Date.now()}`,
    title: "销售小票",
    win,
    copies: cfg.copies,
    vars: {
      headerName: cfg.headerName,
      storePhone: cfg.headerPhone,
      storeAddressLine: rawHtml(cfg.headerAddress ? `<br>${cfg.headerAddress}` : ""),
      billNo: currentBillNo.value || "-",
      billDate: new Date().toLocaleString(),
      operatorName: getLoginUserRealName() || "收银员",
      customerName: saleForm.customerName || "散客",
      items: rawHtml(items),
      totalAmount: fmtMoney(cartAmount.value),
      paidAmount: fmtMoney(cartAmount.value),
      changeAmount: fmtMoney(changeAmount.value),
      paymentMethod: payLabel,
      memberBalanceRow: rawHtml(
        selectedMemberId.value
          ? `<div class="row"><span>会员余额</span><span>¥${fmtMoney(memberBalance.value)}</span></div>`
          : ""
      ),
      memberBalance: fmtMoney(memberBalance.value),
      remarkBlock: "",
      footerText: cfg.footerText,
    },
  }).catch((error) => {
    ElMessage.error(getErrorMessage(error, "打印失败"));
  });
}

async function handleCreateSaleBill() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createStoreSaleBill({
      storeId: getLoginUserStoreId(),
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
    ElMessage.success("销售单创建成功");
  } finally {
    loading.value = false;
  }
}

/** 打开结算弹窗：默认实收 = 应收 */
function openPayDialog() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  receivedAmount.value = cartAmount.value;
  memberBalance.value = 0;
  payDialogVisible.value = true;
}

async function confirmPayment() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createStoreSaleBill({
      storeId: getLoginUserStoreId(),
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

    await createStoreOfflinePayment(currentBillNo.value, currentAmount.value, paymentMethod.value);
    ElMessage.success("收款成功");
    // 本机配置：结算后自动打印小票（先取号再清空购物车）
    const printedBillNo = currentBillNo.value;
    const printedAmount = currentAmount.value;
    if (getLocalPrintConfig().autoPrint && printedBillNo) {
      const cfg = getLocalPrintConfig();
      const items = buildTableHtml(
        cartItems.value.map((item) => ({
          name: item.skuName || item.productName || "-",
          qty: `x${item.quantity}`,
          amount: `¥${fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1))}`,
        })),
        [
          { key: "name", label: "品名", align: "left" },
          { key: "qty", label: "数量" },
          { key: "amount", label: "金额", align: "right" },
        ]
      );
      const payLabel =
        payMethodOptions.find((m) => m.value === paymentMethod.value)?.label ??
        paymentMethod.value;
      printBill({
        billType: "SALE_RECEIPT",
        billNo: printedBillNo,
        title: "销售小票",
        copies: cfg.copies,
        vars: {
          headerName: cfg.headerName,
          storePhone: cfg.headerPhone,
          storeAddressLine: rawHtml(cfg.headerAddress ? `<br>${cfg.headerAddress}` : ""),
          billNo: printedBillNo,
          billDate: new Date().toLocaleString(),
          operatorName: getLoginUserRealName() || "收银员",
          customerName: saleForm.customerName || "散客",
          items: rawHtml(items),
          totalAmount: fmtMoney(printedAmount),
          paidAmount: fmtMoney(printedAmount),
          changeAmount: fmtMoney(changeAmount.value),
          paymentMethod: payLabel,
          memberBalanceRow: "",
          memberBalance: fmtMoney(memberBalance.value),
          remarkBlock: "",
          footerText: cfg.footerText,
        },
      }).catch(() => {
        // 自动打印失败不阻断收款流程，用户可手动点打印
      });
    }
    currentAmount.value = 0;
    currentBillNo.value = "";
    cartItems.value = [];
    payDialogVisible.value = false;
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
    const result = await createStoreHoldOrder({
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
    ElMessage.error(getErrorMessage(error, "挂单失败"));
  }
}

async function loadHoldOrders() {
  try {
    const data = await fetchStoreHoldOrders();
    holdOrders.value = data.records || [];
  } catch {
    // ignore
  }
}

async function handleRestoreHoldOrder(holdNo: string) {
  try {
    const data = await restoreStoreHoldOrder(holdNo);
    saleForm.customerName = data.customerName || "";
    saleForm.customerMobile = data.customerMobile || "";
    saleForm.customerId = Number(data.customerId || 0);
    cartItems.value = (data.items || []).map((item: any) => ({
      skuId: Number(item.skuId || 0),
      skuName: item.skuName || `SKU-${item.skuId}`,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      availableQty: 0
    }));
    holdDialogVisible.value = false;
    ElMessage.success(`已取单：${holdNo}`);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "取单失败"));
  }
}

async function handleDeleteHoldOrder(holdNo: string) {
  try {
    await deleteStoreHoldOrder(holdNo);
    ElMessage.success("挂单已删除");
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "删除挂单失败"));
  }
}
</script>

<style scoped>
.pos-cashier {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
}
.cashier-workspace {
  display: grid;
  grid-template-columns: clamp(130px, 10vw, 160px) minmax(0, 1fr) clamp(360px, 30vw, 430px);
  gap: 10px;
  height: 100%;
}

/* ─── 左侧分类栏 ─── */
.category-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 10px;
  box-shadow: var(--shadow-card);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.category-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 4px 8px 10px;
  letter-spacing: 0.5px;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
  user-select: none;
}
.category-item:hover {
  background: var(--gray-50);
}
.category-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.category-dot--all {
  background: linear-gradient(135deg, #3F6FEF 0%, #8B5CF6 100%);
}
.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--gray-50);
  border-radius: 10px;
  padding: 1px 7px;
}
.category-item.active .category-count {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

/* ─── 中间商品区 ─── */
.product-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.product-searchbar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.product-search-input {
  flex: 1;
}
.product-search-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--border-normal) inset;
}
.product-search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-primary) inset;
}
.scan-button {
  border-radius: var(--radius-md);
}
.btn-icon {
  margin-right: 3px;
}
.search-button {
  border-radius: var(--radius-md);
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  align-content: start;
}
.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 10px 12px;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.product-card:hover {
  border-color: var(--color-primary-soft);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
.product-card:active {
  transform: scale(0.98);
}
.product-card.is-out {
  opacity: 0.55;
}
.product-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.product-cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.product-stock {
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 7px;
}
.product-stock.stock-out {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.product-stock.stock-low {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.product-stock.stock-ok {
  color: var(--text-muted);
  background: var(--gray-50);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.product-price {
  display: flex;
  align-items: baseline;
  color: var(--text-primary);
}
.price-symbol {
  font-size: 12px;
  font-weight: 600;
  margin-right: 1px;
}
.price-value {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.add-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
}
.add-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.08);
}
.add-btn:disabled {
  background: var(--gray-300);
  cursor: not-allowed;
}
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── 右侧购物车 ─── */
.cart-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 12px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}
.member-section {
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 10px;
  position: relative;
}
.member-selected {
  display: flex;
  align-items: center;
  gap: 8px;
}
.member-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.member-meta {
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
}
.member-select {
  width: 220px;
  flex-shrink: 0;
}
.member-select :deep(.el-select__wrapper) {
  border-radius: var(--radius-md);
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}

/* 购物车列表 */
.cart-list {
  flex: 1;
  overflow-y: auto;
  min-height: 120px;
}
.cart-list.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.cart-empty-icon {
  font-size: 30px;
  color: var(--gray-300);
}
.cart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-light);
}
.cart-row:last-child {
  border-bottom: none;
}
.cart-row-main {
  flex: 1;
  min-width: 0;
}
.cart-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cart-row-price {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}
.cart-row-price-symbol {
  font-size: 11px;
  color: var(--text-secondary);
}
.cart-row-price--static {
  cursor: pointer;
}
.cart-row-price-text {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cart-row-price-input {
  width: 86px;
}
.cart-row-price-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-sm);
  box-shadow: none;
  transition: none;
}
.cart-row-price-input :deep(.el-input__inner) {
  font-size: 12px;
  padding: 0 6px;
}
.cart-row-qty {
  display: flex;
  align-items: center;
  gap: 2px;
}
.qty-btn {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-normal);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 120ms;
}
.qty-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.qty-value {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cart-row-amount {
  min-width: 66px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cart-row-del {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 2px;
  border-radius: 4px;
}
.cart-row-del:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

/* 金额汇总 */
.cart-summary {
  border-top: 1px dashed var(--border-normal);
  padding-top: 8px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.summary-num {
  font-variant-numeric: tabular-nums;
}
.summary-row.total {
  margin-top: 2px;
}
.total-amount {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* 支付方式 */
.pay-methods {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.pay-method-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 2px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 150ms;
}
.pay-method-btn:hover {
  border-color: var(--color-primary-soft);
}
.pay-method-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.pay-method-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
}
/* 微信/支付宝使用官方徽标（自带品牌底色），容器透明只保留形状 */
.pay-method-icon--wechat,
.pay-method-icon--alipay {
  background: transparent;
}
.pay-method-icon--cash {
  background: var(--gray-400, #999999);
  color: #fff;
}
.pay-method-icon--balance {
  background: var(--gray-400, #999999);
  color: #fff;
}
.pay-logo {
  width: 24px;
  height: 24px;
  display: block;
}
.pay-logo--wechat {
  width: 28px;
  height: 28px;
}
.pay-logo--alipay {
  width: 28px;
  height: 28px;
}
.pay-logo--balance {
  width: 20px;
  height: 20px;
}
/* 无状态灰阶：未选中时微信/支付宝徽标置灰，选中恢复品牌色 */
.pay-method-btn:not(.active) .pay-logo--wechat,
.pay-method-btn:not(.active) .pay-logo--alipay,
.pay-method-card:not(.active) .pay-logo--wechat,
.pay-method-card:not(.active) .pay-logo--alipay {
  filter: grayscale(1);
  opacity: 0.85;
}
/* 选中点亮：现金绿、余额橙（收银台与结算弹窗一致） */
.pay-method-btn.active .pay-method-icon--cash,
.pay-method-card.active .pay-method-icon--cash {
  background: #16a34a;
}
.pay-method-btn.active .pay-method-icon--balance,
.pay-method-card.active .pay-method-icon--balance {
  background: #fa8c16;
}
.pay-method-btn.active .pay-method-icon {
  color: var(--color-primary);
}
.pay-method-btn.active .pay-method-icon--wechat,
.pay-method-btn.active .pay-method-icon--alipay,
.pay-method-btn.active .pay-method-icon--cash,
.pay-method-btn.active .pay-method-icon--balance {
  color: #fff;
}
.pay-method-name {
  font-size: 11px;
  color: var(--text-secondary);
}
.pay-method-btn.active .pay-method-name {
  color: var(--color-primary);
  font-weight: 600;
}

/* 功能导航 + 结算网格：结算占右侧两列并跨两行 */
.cart-action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}
.cart-action-grid .checkout-btn {
  grid-column: 3 / 5;
  grid-row: 1 / 3;
  height: 100%;
  min-height: 96px;
}
.action-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--gray-50);
  cursor: pointer;
  transition: all 150ms;
}
.action-btn:hover {
  background: var(--color-primary-bg);
  border-color: var(--color-primary-soft);
  color: var(--color-primary);
}
.action-kbd {
  position: absolute;
  top: 3px;
  right: 5px;
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 3px;
  padding: 0 3px;
}
.action-label {
  font-size: 12px;
  font-weight: 500;
}

/* 结算按钮 */
.checkout-btn {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  padding: 0 18px;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
  box-shadow: 0 4px 12px rgba(63, 111, 239, 0.28);
}
.checkout-btn:hover {
  background: var(--color-primary-hover);
}
.checkout-btn:active {
  transform: scale(0.99);
}
.checkout-btn:disabled {
  background: var(--gray-300);
  box-shadow: none;
  cursor: not-allowed;
}
.checkout-label {
  font-size: 16px;
  font-weight: 600;
}
.checkout-amount {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bill-alert {
  margin-top: 0;
}

/* ─── 结算弹窗 ─── */
.pay-dialog :deep(.el-dialog) {
  border-radius: var(--radius-xl);
}
.pay-dialog-body {
  padding: 10px 16px;
}
.pay-amount-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0 10px;
  border-bottom: 1px solid var(--border-light);
}
.pay-amount-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-amount-value {
  font-size: 40px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.pay-items-info {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
.pay-method-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 14px 0 8px;
}
.pay-method-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pay-method-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
}
.pay-method-card:hover {
  border-color: var(--color-primary-soft);
}
.pay-method-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.pay-method-card .pay-method-icon {
  font-size: 15px;
}
.pay-received-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}
.pay-received-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-received-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.numpad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.numpad-key {
  height: 40px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all 120ms;
}
.numpad-key:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
}
.numpad-key:active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.numpad-clear {
  color: var(--color-danger);
}
.numpad-equal {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  font-size: 13px;
}
.numpad-equal:hover {
  background: var(--color-primary-hover);
}
.pay-change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--color-success-soft);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-success);
}
.pay-change-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ═══ 屏幕适配（置于基础样式之后，保证覆盖生效） ═══ */

/* 中屏：收窄侧栏与购物车，商品区保持可用 */
@media (max-width: 1280px) {
  .cashier-workspace {
    grid-template-columns: 120px minmax(0, 1fr) 300px;
    gap: 10px;
  }
  .pos-cashier {
    padding: 10px;
  }
}

/* 小屏：分类栏改为顶部横向滚动标签，商品+购物车两栏布局 */
@media (max-width: 1100px) {
  .cashier-workspace {
    grid-template-columns: minmax(0, 1fr) 300px;
    grid-template-areas:
      "cats cats"
      "products cart";
    grid-template-rows: auto minmax(0, 1fr);
  }
  .category-panel {
    grid-area: cats;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 10px;
    min-height: 44px;
  }
  .category-panel-title {
    padding: 0 10px 0 0;
    flex-shrink: 0;
  }
  .category-item {
    flex-shrink: 0;
    padding: 7px 12px;
    margin-bottom: 0;
  }
  .product-panel {
    grid-area: products;
  }
  .cart-panel {
    grid-area: cart;
  }
}

@media (max-width: 900px) {
  .cashier-workspace {
    grid-template-columns: minmax(0, 1fr) 280px;
  }
}

/* 极窄屏：保证右侧购物车完整可见，工作区整体可横向滚动 */
@media (max-width: 760px) {
  .pos-cashier {
    overflow-x: auto;
  }
  .cashier-workspace {
    min-width: 700px;
  }
}
</style>
