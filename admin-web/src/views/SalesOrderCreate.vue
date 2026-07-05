<template>
  <div class="page">
    <PageCard title="销售开单">
      <template #extra>
        <el-button @click="handleSaveDraft">保存草稿</el-button>
        <el-button type="primary" @click="handleSubmit">提交订单</el-button>
      </template>

      <el-row :gutter="16">
        <!-- 左侧：基础信息 + 商品明细 -->
        <el-col :span="16">
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
                <el-col :span="12">
                  <el-form-item label="销售类型">
                    <el-radio-group v-model="form.saleType">
                      <el-radio value="CASH">现销</el-radio>
                      <el-radio value="CREDIT">赊销</el-radio>
                    </el-radio-group>
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
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="交货方式">
                    <el-select v-model="form.deliveryType" style="width:100%">
                      <el-option label="自提" value="SELF" />
                      <el-option label="配送" value="DELIVERY" />
                      <el-option label="快递" value="EXPRESS" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="备注">
                    <el-input v-model="form.remark" placeholder="订单备注" />
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
                    <el-option v-for="p in productOptions[$index] || []" :key="p.id" :label="p.name" :value="p.id" />
                  </el-select>
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
              <el-table-column label="单价" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.price" :min="0" :precision="2" size="small" controls-position="right" @change="calcRow(row)" />
                </template>
              </el-table-column>
              <el-table-column label="折扣" width="100">
                <template #default="{ row }">
                  <el-input-number v-model="row.discount" :min="0" :max="100" size="small" controls-position="right" @change="calcRow(row)">
                    <template #suffix>%</template>
                  </el-input-number>
                </template>
              </el-table-column>
              <el-table-column label="小计" width="120">
                <template #default="{ row }">
                  <span class="money-text">¥{{ row.subtotal.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="60">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" link @click="removeProductRow($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <!-- 右侧：金额汇总 -->
        <el-col :span="8">
          <el-card shadow="never" class="summary-card">
            <template #header><span class="card-title">金额汇总</span></template>
            <div class="summary-row">
              <span>商品金额</span>
              <span class="money-text">¥{{ totalAmount.toFixed(2) }}</span>
            </div>
            <div class="summary-row">
              <span>整单折扣</span>
              <el-input-number v-model="form.orderDiscount" :min="0" :max="100" size="small" style="width:100px">
                <template #suffix>%</template>
              </el-input-number>
            </div>
            <div class="summary-row">
              <span>优惠金额</span>
              <el-input-number v-model="form.discountAmount" :min="0" :precision="2" size="small" style="width:120px" />
            </div>
            <div class="summary-row">
              <span>抹零金额</span>
              <el-input-number v-model="form.wipeAmount" :min="0" :precision="2" size="small" style="width:120px" />
            </div>
            <el-divider />
            <div class="summary-row total">
              <span>应收金额</span>
              <span class="total-money">¥{{ receivableAmount.toFixed(2) }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { api } from "../api";

const form = reactive({
  customerId: null as number | null,
  saleType: "CASH",
  dueDate: null as string | null,
  deliveryType: "SELF",
  remark: "",
  items: [] as any[],
  orderDiscount: 0,
  discountAmount: 0,
  wipeAmount: 0
});

const formRef = ref();
const rules = {
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

const customerOptions = ref<any[]>([]);
const customerLoading = ref(false);
const productOptions = ref<Record<number, any[]>>({});

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
    units: ["瓶"],
    unit: "瓶",
    qty: 1,
    price: 0,
    discount: 0,
    subtotal: 0
  });
}

function removeProductRow(index: number) {
  form.items.splice(index, 1);
}

async function searchCustomers(query: string) {
  if (!query || query.length < 1) return;
  customerLoading.value = true;
  try {
    const res = await api.get("/members", { params: { keyword: query, pageSize: 20 } });
    customerOptions.value = res.data?.data || res.data?.list || [];
  } catch (e) {
    console.error("搜索客户失败", e);
  }
  customerLoading.value = false;
}

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
    form.items[index].price = product.retailPrice || product.price || 0;
    form.items[index].units = product.units || ["瓶"];
    form.items[index].unit = product.defaultUnit || "瓶";
    calcRow(form.items[index]);
  }
}

async function handleSaveDraft() {
  ElMessage.info("草稿保存功能开发中");
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (form.items.length === 0) {
    ElMessage.warning("请添加至少一个商品");
    return;
  }
  try {
    const payload = {
      customerId: form.customerId,
      saleType: form.saleType,
      dueDate: form.dueDate,
      deliveryType: form.deliveryType,
      remark: form.remark,
      items: form.items.map((item: any) => ({
        productId: item.productId,
        unit: item.unit,
        qty: item.qty,
        price: item.price,
        discount: item.discount
      })),
      orderDiscount: form.orderDiscount,
      discountAmount: form.discountAmount,
      wipeAmount: form.wipeAmount
    };
    const res = await api.post("/sale-bills", payload);
    ElMessage.success("订单创建成功！");
    // 重置表单
    form.customerId = null;
    form.items = [];
    form.orderDiscount = 0;
    form.discountAmount = 0;
    form.wipeAmount = 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "创建订单失败");
  }
}
</script>

<style scoped>
.page { padding: 20px; }
.info-card { margin-bottom: 0; }
.card-title { font-weight: 600; color: var(--text-primary); }
.summary-card { position: sticky; top: 20px; }
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}
.summary-row.total { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.money-text { font-weight: 600; color: var(--text-primary); }
.total-money { font-size: 22px; font-weight: 700; color: #e53935; }
</style>