<template>
  <div class="pos-cashier">
    <el-row :gutter="16" class="cashier-body">
      <!-- 分类栏（对标设计稿：全部/白酒/红酒/洋酒/啤酒/饮料/礼盒） -->
      <el-col :span="4">
        <div class="category-panel">
          <div
            class="category-item"
            :class="{ active: activeCategory === 0 }"
            @click="selectCategory(0)"
          >
            <span>全部</span>
            <span class="category-count">{{ productOptions.length }}</span>
          </div>
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
            :class="{ active: activeCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <span>{{ cat.name }}</span>
          </div>
        </div>
      </el-col>

      <!-- 左侧：商品搜索与列表 -->
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <el-input
                v-model="productKeyword"
                placeholder="搜索商品名称 / 条码 / 拼音首字母"
                clearable
                style="width: 360px"
                @keyup.enter="handleSearchProducts"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-button type="primary" :loading="loading" @click="handleSearchProducts">搜索</el-button>
            </div>
          </template>
          <div v-if="productOptions.length === 0" class="empty-state">
            <el-empty description="输入关键词搜索商品" />
          </div>
          <div v-else class="product-grid">
            <el-card
              v-for="product in filteredProducts"
              :key="product.skuId || product.id"
              shadow="hover"
              class="product-card"
              @click="addCartItem(product)"
            >
              <div class="product-name">{{ product.productName || product.skuName }}</div>
              <div class="product-spec">
                <span :class="stockClass(product.availableQty ?? 0)">库存 {{ product.availableQty ?? 0 }}</span>
              </div>
              <div class="product-price">¥{{ Number(product.storePrice || product.retailPrice || 0).toFixed(2) }}</div>
            </el-card>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：购物车与结算 -->
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>购物车（{{ cartItems.length }}件）</span>
              <el-button v-if="cartItems.length > 0" link type="danger" @click="cartItems = []">清空</el-button>
            </div>
          </template>

          <!-- 会员信息 -->
          <div class="member-section">
            <div v-if="saleForm.customerName" class="member-selected">
              <el-tag type="warning">{{ saleForm.customerName }}</el-tag>
              <span class="member-phone">{{ saleForm.customerMobile }}</span>
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
              <el-button size="small" @click="handleSearchMembers">搜索</el-button>
              <div v-if="memberOptions.length > 0" class="member-dropdown">
                <div
                  v-for="m in memberOptions"
                  :key="m.memberId || m.id"
                  class="member-option"
                  @click="selectMember(m)"
                >
                  <span>{{ m.name }}</span>
                  <span class="muted">{{ m.mobile }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 购物车列表 -->
          <el-table :data="cartItems" size="small" style="width: 100%" max-height="240">
            <el-table-column prop="skuName" label="商品" min-width="140" />
            <el-table-column label="单价" width="90">
              <template #default="{ row }">¥{{ Number(row.unitPrice).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="数量" width="140">
              <template #default="{ row, $index }">
                <el-input-number v-model="row.quantity" :min="1" size="small" @change="updateQty($index)" />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="90">
              <template #default="{ row }">¥{{ (row.unitPrice * row.quantity).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="60">
              <template #default="{ $index }">
                <el-button link type="danger" @click="removeCartItem($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

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
            <el-radio-group v-model="paymentMethod">
              <el-radio-button label="CASH">现金</el-radio-button>
              <el-radio-button label="WECHAT">微信</el-radio-button>
              <el-radio-button label="ALIPAY">支付宝</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 功能导航栏（对标设计稿：挂单/扫码/结算/打印 快捷键） -->
          <div class="cart-actions">
            <el-button size="small" @click="handleCreateHoldOrder">
              <kbd>F2</kbd> 挂单
            </el-button>
            <el-button size="small" @click="handleScan">
              <kbd>F3</kbd> 扫码
            </el-button>
            <el-button size="small" type="primary" plain @click="openPayDialog">
              <kbd>F8</kbd> 结算
            </el-button>
            <el-button size="small" @click="handlePrint">
              <kbd>F9</kbd> 打印
            </el-button>
          </div>

          <!-- 结算按钮 -->
          <div class="checkout-section">
            <el-button
              size="large"
              type="primary"
              :loading="loading"
              @click="openPayDialog"
            >
              结算 ¥{{ cartAmount.toFixed(2) }}
            </el-button>
            <el-button :loading="loading" @click="handleCreateSaleBill">生成订单</el-button>
          </div>

          <el-alert
            v-if="currentBillNo"
            type="success"
            :closable="false"
            style="margin-top: 12px"
          >
            订单号：{{ currentBillNo }}
          </el-alert>
        </el-card>
      </el-col>
    </el-row>

    <!-- 结算确认弹窗（对标设计稿 p12：应收/支付方式/找零/确认收款） -->
    <el-dialog
      v-model="payDialogVisible"
      title="结算"
      width="460px"
      :close-on-click-modal="false"
      align-center
    >
      <div class="pay-dialog-body">
        <div class="pay-amount-row">
          <span class="pay-amount-label">应收金额</span>
          <span class="pay-amount-value">¥{{ cartAmount.toFixed(2) }}</span>
        </div>
        <div class="pay-items-info">
          商品 {{ totalQty }} 件 · 会员 {{ saleForm.customerName || '散客' }}
        </div>

        <div class="pay-method-title">选择支付方式</div>
        <el-radio-group v-model="paymentMethod" class="pay-method-group">
          <el-radio-button label="CASH">现金</el-radio-button>
          <el-radio-button label="WECHAT">微信支付</el-radio-button>
          <el-radio-button label="ALIPAY">支付宝</el-radio-button>
          <el-radio-button label="BALANCE">会员余额</el-radio-button>
        </el-radio-group>
        <div v-if="paymentMethod === 'BALANCE'" class="pay-balance-row">
          <span class="pay-balance-label">可用余额</span>
          <span class="pay-balance-value">¥{{ memberBalance.toFixed(2) }}</span>
        </div>

        <div class="pay-received-row">
          <span class="pay-received-label">实收金额</span>
          <el-input-number
            v-model="receivedAmount"
            :min="0"
            :precision="2"
            :step="1"
            controls-position="right"
            style="width: 180px"
          />
        </div>
        <div v-if="changeAmount > 0" class="pay-change-row">
          <span>应找零</span>
          <span class="pay-change-value">¥{{ changeAmount.toFixed(2) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="confirmPayment">
          确认收款 ¥{{ cartAmount.toFixed(2) }}
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
import { computed, reactive, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Search, User } from "@element-plus/icons-vue";
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

const loading = ref(false);
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const categories = ref<any[]>([]);
const activeCategory = ref(0);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const saleForm = reactive({
  customerId: 0,
  customerName: "",
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

const totalQty = computed(() => cartItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

/** 应找零 = 实收 - 应收 */
const changeAmount = computed(() => {
  return Math.max(0, receivedAmount.value - cartAmount.value);
});

/** 按分类过滤后的商品列表 */
const filteredProducts = computed(() => {
  if (activeCategory.value === 0) return productOptions.value;
  return productOptions.value.filter(
    (p) => Number(p.categoryId) === activeCategory.value
  );
});

/** 库存状态：0 缺货红 / ≤10 告急橙 / 其余正常灰 */
function stockClass(stock: number): string {
  if (stock <= 0) return 'stock-out'
  if (stock <= 10) return 'stock-low'
  return 'stock-ok'
}

onMounted(() => {
  loadHoldOrders();
  loadCategories();
});

/** 加载商品分类 */
async function loadCategories() {
  try {
    const list = await fetchProductCategories();
    categories.value = Array.isArray(list) ? list : (list?.records || list?.list || []);
  } catch (e) {
    console.error("加载商品分类失败", e);
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

async function handleSearchProducts() {
  if (!productKeyword.value.trim()) {
    ElMessage.warning("请输入搜索关键词");
    return;
  }
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
  if (!memberKeyword.value.trim()) return;
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

function updateQty(_index: number) {
  // 数量变更由 v-model 自动处理
}

function removeCartItem(index: number) {
  cartItems.value.splice(index, 1);
}

/** 扫码：聚焦商品搜索框（配合扫码枪输入） */
function handleScan() {
  ElMessage.info("请使用扫码枪扫描商品条码");
}

/** 打印：小票打印需打印机就绪 */
function handlePrint() {
  ElMessage.info("请确认打印机已就绪");
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
  padding: 16px;
}
.cashier-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 16px;
}
.topbar-stats {
  display: flex;
  gap: 32px;
}
.topbar-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.topbar-label {
  font-size: 13px;
  color: var(--text-muted);
}
.topbar-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.topbar-value--primary {
  color: var(--color-primary);
}
.topbar-shortcuts {
  display: flex;
  gap: 16px;
}
.topbar-exit {
  margin-left: 8px;
  color: var(--text-muted);
}
.topbar-exit:hover {
  color: var(--color-primary);
}
.shortcut-item {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.shortcut-item kbd {
  background: var(--bg-soft);
  border: 1px solid var(--border-normal);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
/* 分类栏 */
.category-panel {
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px;
  height: 100%;
}
.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 2px;
  transition: all 150ms;
}
.category-item:hover {
  background: var(--bg-soft);
}
.category-item.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}
.category-count {
  font-size: 11px;
  color: var(--text-muted);
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.product-card {
  cursor: pointer;
  border: 1px solid var(--border-light);
  transition: box-shadow 150ms ease, border-color 150ms ease;
}
.product-card:hover {
  border-color: var(--color-primary-soft);
  box-shadow: var(--shadow-md);
}
.product-card :deep(.el-card__body) {
  padding: 14px 16px;
}
.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-spec {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.product-spec .stock-out {
  color: var(--color-danger);
  font-weight: 600;
}
.product-spec .stock-low {
  color: var(--color-warning);
  font-weight: 600;
}
.product-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 8px;
}
.member-section {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 12px;
}
.member-selected {
  display: flex;
  align-items: center;
  gap: 8px;
}
.member-phone {
  color: var(--text-muted);
  font-size: 12px;
}
.member-search {
  display: flex;
  gap: 8px;
  position: relative;
}
.member-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 100;
  max-height: 160px;
  overflow-y: auto;
}
.member-option {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
}
.member-option:hover {
  background: #f5f7fa;
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}
.cart-summary {
  margin-top: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
}
.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}
.summary-row.total {
  font-size: 15px;
  font-weight: 600;
  padding-top: 8px;
  border-top: 1px dashed var(--border-normal);
}
.total-amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}
.pay-methods {
  margin-top: 12px;
}
.cart-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}
.cart-actions kbd {
  background: var(--bg-soft);
  border: 1px solid var(--border-normal);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 11px;
  font-family: var(--font-mono);
  margin-right: 2px;
}
.checkout-section {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
.checkout-section .el-button--large {
  height: 44px;
  flex: 1;
}
.empty-state {
  padding: 40px 0;
}

/* ─── 结算弹窗（对标设计稿 p12） ─── */
.pay-dialog-body {
  padding: 4px 8px;
}
.pay-amount-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--border-light);
}
.pay-amount-label {
  font-size: 14px;
  color: var(--text-secondary);
}
.pay-amount-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.pay-items-info {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 10px;
}
.pay-method-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 18px 0 10px;
}
.pay-method-group {
  display: flex;
  width: 100%;
}
.pay-method-group :deep(.el-radio-button) {
  flex: 1;
}
.pay-method-group :deep(.el-radio-button__inner) {
  width: 100%;
}
.pay-balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--color-primary-bg);
  border-radius: 6px;
}
.pay-balance-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-balance-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.pay-received-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
.pay-received-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-change-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-success);
  font-variant-numeric: tabular-nums;
}
</style>
