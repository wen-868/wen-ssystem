<template>
  <div class="page">
    <PageCard title="价格策略">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索客户/商品"
          size="default"
          style="width: 220px"
          clearable
          @clear="loadList"
          @keyup.enter="loadList"
        />
        <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 110px" clearable @change="loadList">
          <el-option label="生效中" value="ACTIVE" />
          <el-option label="已过期" value="EXPIRED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showAddDialog">新增</el-button>
        <el-button @click="showBatchDialog">批量设置</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
      >
        <template #standardPrice="{ row }">¥{{ Number(row.standardPrice || 0).toFixed(2) }}</template>
        <template #customPrice="{ row }">¥{{ Number(row.customPrice || 0).toFixed(2) }}</template>
        <template #discountRate="{ row }">{{ row.discountRate != null ? row.discountRate + '%' : '-' }}</template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'ACTIVE'" type="success">生效中</el-tag>
          <el-tag v-else-if="row.status === 'EXPIRED'" type="info">已过期</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑专属价格' : '新增专属价格'" width="500px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="form.customerId" filterable placeholder="请选择客户" style="width: 100%" :disabled="isEdit" @change="onCustomerChange">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品">
          <el-select v-model="form.skuId" filterable placeholder="搜索商品" style="width: 100%" :disabled="isEdit" @change="onSkuChange">
            <el-option v-for="p in products" :key="p.id" :label="`${p.name} (¥${Number(p.price || 0).toFixed(2)})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标准价">
          <el-input-number v-model="form.standardPrice" :precision="2" :min="0" style="width: 100%" disabled />
        </el-form-item>
        <el-form-item label="专属价">
          <el-input-number v-model="form.customPrice" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>

    <!-- 批量设置弹窗 -->
    <el-dialog v-model="batchVisible" title="批量设置专属价格" width="600px" :close-on-click-modal="false">
      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="选择客户">
          <el-select v-model="batchForm.customerId" filterable placeholder="请选择客户" style="width: 100%" @change="onBatchCustomerChange">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择商品">
          <el-select
            v-model="batchForm.skuIds"
            multiple
            filterable
            placeholder="请选择商品"
            style="width: 100%"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="`${p.name} (¥${Number(p.price || 0).toFixed(2)})`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="折扣率(%)">
          <el-input-number v-model="batchForm.discountRate" :min="1" :max="100" :precision="1" style="width: 100%" />
          <span style="color: #909399; font-size: 12px; margin-left: 8px">如 90 表示按标准价 9 折</span>
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="batchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="handleBatchSubmit">确认设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchCustomerPrices, createCustomerPrice, updateCustomerPrice, deleteCustomerPrice, batchSetCustomerPrices, fetchMembers, fetchProducts } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");

const customers = ref<any[]>([]);
const products = ref<any[]>([]);

const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref();
const rules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }]
};
const form = ref({ customerId: null as number | null, customerName: "" as string, skuId: null as number | null, skuName: "" as string, standardPrice: 0, customPrice: 0, dateRange: null as [string, string] | null, remark: "" });

const batchVisible = ref(false);
const batchLoading = ref(false);
const batchForm = ref({ customerId: null as number | null, customerName: "" as string, skuIds: [] as number[], discountRate: 90, dateRange: null as [string, string] | null });

const columns = [
  { prop: "customerName", label: "客户", minWidth: 120 },
  { prop: "skuName", label: "商品", minWidth: 160 },
  { prop: "standardPrice", label: "标准价", width: 100, slot: "standardPrice" },
  { prop: "customPrice", label: "专属价", width: 100, slot: "customPrice" },
  { prop: "discountRate", label: "折扣率", width: 80, slot: "discountRate" },
  { prop: "startDate", label: "有效期开始", width: 110 },
  { prop: "endDate", label: "有效期结束", width: 110 },
  { prop: "status", label: "状态", width: 80, slot: "status" },
  { label: "操作", width: 140, fixed: "right", slot: "actions" }
];

async function loadCustomers() {
  try {
    const data = await fetchMembers();
    customers.value = (Array.isArray(data) ? data : (data.records || [])).map((m: any) => ({ id: m.id, name: m.name || m.realName || m.mobile }));
  } catch { /* ignore */ }
}

async function loadProducts() {
  try {
    const data = await fetchProducts();
    const list = Array.isArray(data) ? data : (data.records || []);
    products.value = list.map((p: any) => ({
      id: p.id || p.skuId,
      name: p.name || p.skuName || p.productName,
      price: p.retailPrice || p.price || 0
    }));
  } catch { /* ignore */ }
}

function onCustomerChange(val: number) {
  const c = customers.value.find((x: any) => x.id === val);
  if (c) form.value.customerName = c.name;
}

function onSkuChange(val: number) {
  const p = products.value.find((x: any) => x.id === val);
  if (p) { form.value.standardPrice = Number(p.price); form.value.skuName = p.name; }
}

function onBatchCustomerChange(val: number) {
  const c = customers.value.find((x: any) => x.id === val);
  if (c) batchForm.value.customerName = c.name;
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchCustomerPrices({
      page: page.value, pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function showAddDialog() {
  isEdit.value = false;
  editId.value = null;
  form.value = { customerId: null, customerName: "", skuId: null, skuName: "", standardPrice: 0, customPrice: 0, dateRange: null, remark: "" };
  loadCustomers();
  loadProducts();
  dialogVisible.value = true;
}

function showEditDialog(row: any) {
  isEdit.value = true;
  editId.value = row.id;
  form.value = {
    customerId: row.customerId,
    customerName: row.customerName || "",
    skuId: row.skuId,
    skuName: row.skuName || "",
    standardPrice: Number(row.standardPrice || 0),
    customPrice: Number(row.customPrice || 0),
    dateRange: row.startDate ? [row.startDate, row.endDate] : null,
    remark: row.remark || ""
  };
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!form.value.customerId || !form.value.skuId) { ElMessage.warning("请选择客户和商品"); return; }
  submitLoading.value = true;
  try {
    const payload = {
      customerId: form.value.customerId,
      customerName: (customers.value.find((c: any) => c.id === form.value.customerId) || {}).name || "",
      skuId: form.value.skuId,
      skuName: (products.value.find((p: any) => p.id === form.value.skuId) || {}).name || "",
      standardPrice: form.value.standardPrice,
      customPrice: form.value.customPrice,
      startDate: form.value.dateRange?.[0] || undefined,
      endDate: form.value.dateRange?.[1] || undefined,
      remark: form.value.remark
    };
    if (isEdit.value && editId.value) {
      await updateCustomerPrice(editId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createCustomerPrice(payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "保存失败");
  } finally {
    submitLoading.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.customerName} 的 ${row.skuName} 专属价格吗？`, "确认删除", { type: "warning" });
  } catch { return; }
  try {
    await deleteCustomerPrice(row.id);
    ElMessage.success("已删除");
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "删除失败");
  }
}

function showBatchDialog() {
  batchForm.value = { customerId: null, customerName: "", skuIds: [], discountRate: 90, dateRange: null };
  loadCustomers();
  loadProducts();
  batchVisible.value = true;
}

async function handleBatchSubmit() {
  if (!batchForm.value.customerId) { ElMessage.warning("请选择客户"); return; }
  if (batchForm.value.skuIds.length === 0) { ElMessage.warning("请选择至少一个商品"); return; }
  batchLoading.value = true;
  try {
    const selectedProducts = products.value.filter((p: any) => batchForm.value.skuIds.includes(p.id));
    const customer = customers.value.find((c: any) => c.id === batchForm.value.customerId);
    await batchSetCustomerPrices({
      customerId: batchForm.value.customerId,
      customerName: customer?.name || "",
      skuIds: batchForm.value.skuIds,
      skuNames: selectedProducts.map((p: any) => p.name),
      standardPrices: selectedProducts.map((p: any) => Number(p.price)),
      discountRate: batchForm.value.discountRate,
      startDate: batchForm.value.dateRange?.[0] || undefined,
      endDate: batchForm.value.dateRange?.[1] || undefined
    });
    ElMessage.success(`已为 ${selectedProducts.length} 个商品设置 ${batchForm.value.discountRate}% 折扣`);
    batchVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "设置失败");
  } finally {
    batchLoading.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.page { padding: 0; }
</style>