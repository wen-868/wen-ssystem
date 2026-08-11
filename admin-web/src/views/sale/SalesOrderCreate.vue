<template>
  <div class="page">
    <PageCard title="销售开单">
      <el-row :gutter="16">
        <!-- 主区域：基础信息 + 商品明细 + 底部结算 -->
        <el-col :span="24">
          <!-- 基础信息 -->
          <el-card shadow="never" class="info-card">
            <template #header><span class="card-title">基础信息</span></template>
            <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" size="default">
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="客户" required prop="customerId">
                    <el-select
                      v-model="form.customerId"
                      filterable
                      remote
                      placeholder="搜索客户名称/手机号"
                      :remote-method="searchCustomers"
                      :loading="customerLoading"
                      style="width:100%"
                      @change="onCustomerChange"
                    >
                      <el-option
                        v-for="c in customerOptions"
                        :key="c.id"
                        :label="`${c.name} (${c.mobile})`"
                        :value="c.id"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col v-if="storeOptions.length > 1" :span="12">
                  <el-form-item label="门店" required prop="storeId">
                    <el-select v-model="form.storeId" placeholder="请选择门店" style="width:100%">
                      <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="联系人" prop="customerName">
                    <el-input v-model="form.customerName" placeholder="联系人姓名" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="联系电话" prop="customerMobile">
                    <el-input v-model="form.customerMobile" placeholder="联系电话" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="销售类型">
                    <el-radio-group v-model="form.saleType">
                      <el-radio value="CASH">现销</el-radio>
                      <el-radio value="CREDIT">赊销</el-radio>
                    </el-radio-group>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="16">
                  <el-form-item label="客户地址" prop="customerAddress">
                    <el-input v-model="form.customerAddress" placeholder="客户地址" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="交货方式">
                    <el-select v-model="form.deliveryType" style="width:100%">
                      <el-option label="自提" value="SELF" />
                      <el-option label="配送" value="DELIVERY" />
                      <el-option label="快递" value="EXPRESS" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16" v-if="form.saleType === 'CREDIT'">
                <el-col :span="12">
                  <el-form-item label="应收截止日期" required prop="dueDate">
                    <el-date-picker v-model="form.dueDate" type="date" placeholder="选择日期" style="width:100%" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </el-card>

          <!-- 商品明细 -->
          <el-card shadow="never" class="info-card" style="margin-top:12px">
            <template #header>
              <span class="card-title">商品明细</span>
              <el-button type="primary" size="small" link style="float:right" @click="addProductRow">+ 添加商品</el-button>
            </template>
            <el-table :data="form.items" border stripe>
              <el-table-column label="条码" width="130">
                <template #default="{ row }">
                  <span class="barcode-text">{{ row.barcode || "-" }}</span>
                </template>
              </el-table-column>
              <el-table-column label="商品" min-width="180">
                <template #default="{ row, $index }">
                  <el-select
                    v-model="row.productId"
                    filterable
                    remote
                    placeholder="搜索商品"
                    :remote-method="(q:string) => searchProducts(q, $index)"
                    style="width:100%"
                    @change="(val:any) => onProductChange(val, $index)"
                  >
                    <el-option v-for="p in productOptions[$index] || []" :key="p.id" :value="p.id" :label="formatProductLabel(p)" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="规格" width="110">
                <template #default="{ row }">{{ row.spec || "-" }}</template>
              </el-table-column>
              <el-table-column label="单价" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.price" :min="0" :precision="2" size="small" controls-position="right" @change="calcRow(row)" />
                </template>
              </el-table-column>
              <el-table-column label="单位" width="100">
                <template #default="{ row }">
                  <el-select v-model="row.unit" size="small">
                    <el-option v-for="u in row.units || ['瓶']" :key="u" :label="u" :value="u" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="数量" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.qty" :min="0.001" :precision="3" size="small" controls-position="right" @change="calcRow(row)" />
                </template>
              </el-table-column>
              <el-table-column label="折扣" width="100">
                <template #default="{ row }">
                  <el-input-number v-model="row.discount" :min="0" :max="100" size="small" controls-position="right" @change="calcRow(row)">
                    <template #suffix>%</template>
                  </el-input-number>
                </template>
              </el-table-column>
              <el-table-column label="合计金额" width="120">
                <template #default="{ row }">
                  <span class="money-text">¥{{ row.subtotal.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="追溯码" min-width="150">
                <template #default="{ row }">
                  <el-input
                    v-model="row.traceCodes"
                    size="small"
                    placeholder="扫码/输入，多个用逗号分隔"
                    clearable
                  />
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.remark" size="small" placeholder="行备注" clearable />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="60">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeProductRow($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 底部结算栏：金额信息置于商品明细下方 -->
          <el-card shadow="never" class="settlement-card" style="margin-top:12px">
            <div class="settlement-inner">
              <div class="settlement-left">
                <div class="settlement-item">
                  <span class="settlement-label">应收金额</span>
                  <span class="settlement-value">¥{{ totalAmount.toFixed(2) }}</span>
                </div>
                <div class="settlement-item">
                  <span class="settlement-label">整单折扣</span>
                  <el-input-number v-model="form.orderDiscount" :min="0" :max="100" size="small" style="width:100px">
                    <template #suffix>%</template>
                  </el-input-number>
                </div>
                <div class="settlement-item">
                  <span class="settlement-label">优惠金额</span>
                  <el-input-number v-model="form.discountAmount" :min="0" :precision="2" size="small" style="width:110px" />
                </div>
                <div class="settlement-item">
                  <span class="settlement-label">抹零金额</span>
                  <el-input-number v-model="form.wipeAmount" :min="0" :precision="2" size="small" style="width:110px" />
                </div>
              </div>
              <div class="settlement-right">
                <span class="settlement-label">实收金额</span>
                <span class="settlement-total">¥{{ receivableAmount.toFixed(2) }}</span>
              </div>
            </div>
          </el-card>

          <!-- 单据备注：位于结算区下方 -->
          <el-card shadow="never" class="info-card" style="margin-top:12px">
            <template #header><span class="card-title">单据备注</span></template>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="客户可见" prop="customerRemark">
                  <el-input
                    v-model="form.customerRemark"
                    type="textarea"
                    :rows="3"
                    maxlength="255"
                    show-word-limit
                    placeholder="客户可见的订单备注，将出现在销售单据上"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="internalRemark">
                  <template #label>
                    <span>仅内部可见</span>
                  </template>
                  <el-input
                    v-model="form.internalRemark"
                    type="textarea"
                    :rows="3"
                    maxlength="255"
                    show-word-limit
                    placeholder="仅内部可见的备注，客户无法查看"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>

          <!-- 单据信息：制单/审核/业务（结算区下方，按账号角色默认填充可手动选择） -->
          <el-card shadow="never" class="info-card role-card" style="margin-top:12px">
            <el-form label-width="80px">
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="制单人" prop="operatorId">
                    <el-select v-model="form.operatorId" filterable placeholder="制单人（默认当前账号）" style="width:100%" @change="onOperatorChange">
                      <el-option v-for="s in roleStaffOptions" :key="'o-' + s.id" :label="s.realName || s.username" :value="s.id" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="审核人" prop="auditorId">
                    <el-select v-model="form.auditorId" filterable placeholder="审核人" style="width:100%" @change="onAuditorChange">
                      <el-option v-for="s in roleStaffOptions" :key="'a-' + s.id" :label="s.realName || s.username" :value="s.id" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="业务员" prop="salesmanId">
                    <el-select v-model="form.salesmanId" filterable placeholder="业务员" style="width:100%" @change="onSalesmanChange">
                      <el-option v-for="s in roleStaffOptions" :key="'s-' + s.id" :label="s.realName || s.username" :value="s.id" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </el-card>

          <!-- 底部操作栏：保存草稿 / 提交订单 / 提交并打印 -->
          <el-card shadow="never" class="bill-actions-card" style="margin-top:12px">
            <div class="bill-actions">
              <el-button @click="handleSaveDraft">保存草稿</el-button>
              <el-button type="primary" @click="handleSubmit()">提交订单</el-button>
              <el-button type="success" @click="handleSubmit(true)">提交并打印</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { api, fetchStores, fetchMemberDetail, fetchStaff } from "../../api";
import { useAuthStore } from "../../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const form = reactive({
  storeId: null as number | null,
  customerId: null as number | null,
  customerName: "",
  customerMobile: "",
  customerAddress: "",
  saleType: "CASH",
  dueDate: null as string | null,
  deliveryType: "SELF",
  // 客户可见备注（对应后端 sale_bill.remark 列，注释为"客户可见备注"）
  customerRemark: "",
  // 内部备注（对应后端 sale_bill.internal_remark 列，仅内部可见）
  internalRemark: "",
  operatorId: null as number | null,
  operatorName: "",
  auditorId: null as number | null,
  auditorName: "",
  salesmanId: null as number | null,
  salesmanName: "",
  items: [] as any[],
  orderDiscount: 0,
  discountAmount: 0,
  wipeAmount: 0
});

const formRef = ref<FormInstance>();
const rules: FormRules = {
  storeId: [{ required: true, message: "请选择门店", trigger: "change" }],
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }],
  dueDate: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (form.saleType === "CREDIT" && !form.dueDate) {
          callback(new Error("请选择应收截止日期"));
        } else {
          callback();
        }
      },
      trigger: "change"
    }
  ]
};

const storeOptions = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);
const productOptions = ref<Record<number, any[]>>({});
const staffOptions = ref<any[]>([]);

/** 制单/审核/业务 可选人员：当前账号 + 员工列表（去重） */
const roleStaffOptions = computed(() => {
  const me = auth.user;
  const list: any[] = [];
  const seen = new Set<number>();
  if (me?.id) {
    list.push({ id: me.id, realName: me.realName || me.username || "管理员", username: me.username });
    seen.add(me.id);
  }
  for (const s of staffOptions.value) {
    if (!seen.has(s.id)) {
      list.push(s);
      seen.add(s.id);
    }
  }
  return list;
});

/** 按账号角色默认填充 制单人/审核人/业务员 */
function applyDefaultRoles() {
  const all = roleStaffOptions.value;
  if (!all.length) return;
  const me = auth.user;
  const myId = me?.id ?? null;
  const myName = me?.realName || me?.username || "";
  const roles = auth.userRoles || [];
  const isManager = roles.some((r) => ["SUPER_ADMIN", "STORE_MANAGER"].includes(r));
  const isSales = roles.some((r) => ["SUPER_ADMIN", "STORE_MANAGER", "SALES_STAFF"].includes(r));
  // 制单人：默认当前账号
  form.operatorId = myId;
  form.operatorName = myName;
  // 审核人：当前账号有审核权限则默认自己，否则默认主管/管理员
  if (isManager) {
    form.auditorId = myId;
    form.auditorName = myName;
  } else {
    const auditor = all.find((s) => ["SUPER_ADMIN", "STORE_MANAGER"].includes(s.role)) || all[0];
    form.auditorId = auditor?.id ?? null;
    form.auditorName = auditor?.realName || auditor?.username || "";
  }
  // 业务员：当前账号有销售角色则默认自己，否则默认销售岗
  if (isSales) {
    form.salesmanId = myId;
    form.salesmanName = myName;
  } else {
    const seller = all.find((s) => ["SALES_STAFF", "STORE_MANAGER"].includes(s.role)) || all[0];
    form.salesmanId = seller?.id ?? null;
    form.salesmanName = seller?.realName || seller?.username || "";
  }
}

function pickRoleName(id: number | null): string {
  const hit = roleStaffOptions.value.find((s) => s.id === id);
  return hit ? (hit.realName || hit.username || "") : "";
}
function onOperatorChange(v: number | null) { form.operatorName = pickRoleName(v); }
function onAuditorChange(v: number | null) { form.auditorName = pickRoleName(v); }
function onSalesmanChange(v: number | null) { form.salesmanName = pickRoleName(v); }

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
});

const receivableAmount = computed(() => {
  let amount = totalAmount.value * (1 - form.orderDiscount / 100);
  amount -= form.discountAmount;
  amount -= form.wipeAmount;
  return Math.max(0, amount);
});

function calcRow(row: any) {
  const price = row.price || 0;
  const qty = row.qty || 0;
  const discount = row.discount || 0;
  row.subtotal = price * qty * (1 - discount / 100);
}

function addProductRow() {
  form.items.push({
    productId: null,
    productName: "",
    barcode: "",
    spec: "",
    units: ["瓶"],
    unit: "瓶",
    qty: 1,
    price: 0,
    discount: 0,
    remark: "",
    traceCodes: "",
    subtotal: 0
  });
}

function removeProductRow(index: number) {
  form.items.splice(index, 1);
}

async function searchCustomers(query: string) {
  customerLoading.value = true;
  try {
    const res = await api.get("/members", {
      params: query ? { keyword: query, pageSize: 20 } : { pageSize: 50 }
    });
    customerOptions.value = res.data?.data || res.data?.list || [];
  } catch (e) {
    console.error("搜索客户失败", e);
  }
  customerLoading.value = false;
}

async function onCustomerChange(customerId: number) {
  if (!customerId) {
    form.customerName = "";
    form.customerMobile = "";
    form.customerAddress = "";
    return;
  }
  try {
    const customer = customerOptions.value.find(c => c.id === customerId);
    if (customer) {
      form.customerName = customer.name || "";
      form.customerMobile = customer.mobile || "";
      form.customerAddress = customer.address || "";
    } else {
      const detail = await fetchMemberDetail(customerId);
      form.customerName = detail.name || "";
      form.customerMobile = detail.mobile || "";
      form.customerAddress = detail.address || "";
    }
  } catch (e) {
    console.error("获取客户详情失败", e);
  }
}

async function loadStores() {
  try {
    storeOptions.value = await fetchStores() || [];
    if (storeOptions.value.length > 0 && !form.storeId) {
      form.storeId = storeOptions.value[0].id;
    }
  } catch (e) {
    console.error("加载门店列表失败", e);
  }
}

onMounted(() => {
  loadStores();
  searchCustomers("");
  fetchStaff()
    .then((list) => {
      staffOptions.value = list || [];
      applyDefaultRoles();
    })
    .catch(() => applyDefaultRoles());
});

async function searchProducts(query: string, index: number) {
  if (!query || query.length < 1) return;
  try {
    const res = await api.get("/products", { params: { keyword: query, pageSize: 20 } });
    productOptions.value[index] = res.data?.data || res.data?.list || [];
  } catch (e) {
    console.error("搜索商品失败", e);
  }
}

function onProductChange(productId: any, index: number) {
  const products = productOptions.value[index] || [];
  const product = products.find((p: any) => p.id === productId);
  if (product) {
    form.items[index].productName = product.name;
    form.items[index].barcode = product.barcode || product.skuCode || "";
    form.items[index].spec = product.spec || product.skuSpec || "";
    form.items[index].price = product.retailPrice || product.price || 0;
    form.items[index].units = product.units || ["瓶"];
    form.items[index].unit = product.defaultUnit || "瓶";
    calcRow(form.items[index]);
  }
}

/** 商品下拉展示：名称 + 规格 + 条码 */
function formatProductLabel(p: any) {
  const parts = [p.name];
  if (p.spec || p.skuSpec) parts.push(p.spec || p.skuSpec);
  if (p.barcode || p.skuCode) parts.push(p.barcode || p.skuCode);
  return parts.join(" / ");
}

async function handleSaveDraft() {
  ElMessage.info("草稿保存功能开发中");
}

async function handleSubmit(print = false) {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (form.items.length === 0) {
    ElMessage.warning("请添加至少一个商品");
    return;
  }
  try {
    const payload = {
      storeId: form.storeId,
      customerId: form.customerId,
      customerName: form.customerName,
      customerMobile: form.customerMobile,
      customerAddress: form.customerAddress,
      saleType: form.saleType,
      dueDate: form.dueDate,
      deliveryType: form.deliveryType,
      // 客户可见备注 → 后端 sale_bill.remark 列
      remark: form.customerRemark,
      // 内部备注 → 后端 sale_bill.internal_remark 列
      internalRemark: form.internalRemark,
      operatorId: form.operatorId,
      operatorName: form.operatorName,
      auditorId: form.auditorId,
      auditorName: form.auditorName,
      salesmanId: form.salesmanId,
      salesmanName: form.salesmanName,
      items: form.items.map((item: any) => ({
        skuId: item.skuId || item.productId,
        quantity: item.qty,
        boxQty: 0,
        bottleQty: item.qty,
        totalBottleQty: item.qty,
        unitPrice: item.price,
        discount: item.discount
      })),
      traceCodes: form.items.map((item: any) => item.traceCodes || ""),
      orderDiscount: form.orderDiscount,
      discountAmount: form.discountAmount,
      roundingAmount: form.wipeAmount
    };
    const res = await api.post("/sale-bills", payload);
    const billNo = res.data?.data?.billNo || res.data?.billNo;
    ElMessage.success(`销售单 ${billNo || ""} 创建成功`);
    // 创建完成直接跳转到当前销售单详情页
    if (billNo) {
      router.push({ path: `/sale-bills/${encodeURIComponent(billNo)}`, query: print ? { print: "1" } : {} });
    } else {
      router.push("/sale-bills");
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "创建订单失败");
  }
}
</script>

<style scoped>
.page { padding: 0; }
.info-card { margin-bottom: 0; }
.card-title { font-weight: 600; color: var(--text-primary); }
.settlement-card :deep(.el-card__body) { padding: 16px 20px; }
.bill-actions-card :deep(.el-card__body) { padding: 14px 20px; }
.bill-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.settlement-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.settlement-left {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}
.settlement-item { display: flex; align-items: center; gap: 8px; }
.settlement-label { font-size: 14px; color: var(--text-secondary); }
.settlement-value { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.settlement-right { display: flex; align-items: baseline; gap: 10px; }
.settlement-total {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.money-text {
  font-weight: 600;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.barcode-text {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: var(--text-secondary);
}
.internal-tag { margin-left: 6px; vertical-align: middle; }
</style>
