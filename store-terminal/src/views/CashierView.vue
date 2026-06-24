<template>
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
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
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

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

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
    ElMessage.warning("挂单列表加载失败");
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
    ElMessage.error(getErrorMessage(error, "删除挂单失败，请重试"));
  }
}

async function handleShareCollection() {
  if (!currentBillNo.value) return;
  try {
    const result = await createCollectionLink(currentBillNo.value, currentAmount.value, { taxEnabled: saleForm.taxEnabled, taxRate: saleForm.taxRate });
    shareUrl.value = `${location.origin}${result.shareUrl}`;
    ElMessage.success("分享收款链接已生成");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "生成分享收款失败，请重试"));
  }
}
</script>
