<template>
  <div class="return-page">
    <div class="page-header">
      <h2>采购退货</h2>
      <p class="page-desc">管理采购退货申请，选择采购订单创建退货</p>
    </div>

    <PageCard>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="关键字">
          <el-input
            v-model="filterForm.keyword"
            placeholder="退货单号"
            clearable
            style="width: 200px"
            @clear="loadReturns"
            @keyup.enter="loadReturns"
          />
        </el-form-item>
        <el-form-item label="供应商">
          <el-select
            v-model="filterForm.supplierId"
            placeholder="全部供应商"
            clearable
            filterable
            style="width: 180px"
            @change="loadReturns"
          >
            <el-option
              v-for="s in supplierList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="loadReturns"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filterForm.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
            @change="loadReturns"
          >
            <el-option label="草稿" value="DRAFT" />
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
            <el-option label="已完成" value="COMPLETED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadReturns">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建退货单
        </el-button>
        <el-button @click="loadReturns">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="pagination.total"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        @update:page="loadReturns"
        @update:page-size="loadReturns"
      >
        <template #status="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
          <el-tag v-else-if="row.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
          <el-tag v-else-if="row.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
          <el-tag v-else-if="row.status === 'REJECTED'" type="danger" size="small">已驳回</el-tag>
          <el-tag v-else-if="row.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
          <el-tag v-else size="small">{{ row.status }}</el-tag>
        </template>

        <template #totalAmount="{ row }">
          <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
        </template>

        <template #actions="{ row }">
          <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="success"
            size="small"
            @click="handleApprove(row)"
          >
            通过
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="danger"
            size="small"
            @click="handleReject(row)"
          >
            驳回
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT' || row.status === 'PENDING'"
            link
            type="danger"
            size="small"
            @click="handleCancel(row)"
          >
            取消
          </el-button>
        </template>
      </DataTable>
    </PageCard>

    <el-dialog
      v-model="dialogVisible"
      title="新建退货单"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="采购订单" prop="purchaseOrderId">
          <el-select
            v-model="form.purchaseOrderId"
            placeholder="请选择采购订单"
            filterable
            style="width: 100%"
            @change="onOrderChange"
          >
            <el-option
              v-for="po in purchaseOrders"
              :key="po.id"
              :label="`${po.orderNo} - ${po.supplierName || ''}`"
              :value="po.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="退货原因" prop="reason">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入退货原因"
          />
        </el-form-item>
        <el-form-item label="退货商品">
          <el-table :data="form.items" size="small" border>
            <el-table-column label="商品名称" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.skuName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column label="退货数量" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="1"
                  :max="row.maxQty || 99999"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :precision="2"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">
                ¥{{ Number((row.quantity || 0) * (row.unitPrice || 0)).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" @click="removeItem($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" plain style="margin-top: 10px" @click="addItem">
            + 添加商品
          </el-button>
        </el-form-item>
        <el-form-item label="退款金额">
          <span class="total-amount">¥{{ totalAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">创建</el-button>
      </template>
    </el-dialog>

    <DetailDrawer v-model="detailVisible" title="退货单详情" width="560px">
      <template v-if="currentReturn">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="退货单号">{{ currentReturn.returnNo }}</el-descriptions-item>
          <el-descriptions-item label="采购订单">{{ currentReturn.purchaseOrderNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentReturn.supplierName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentReturn.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
            <el-tag v-else-if="currentReturn.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
            <el-tag v-else-if="currentReturn.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
            <el-tag v-else-if="currentReturn.status === 'REJECTED'" type="danger" size="small">已驳回</el-tag>
            <el-tag v-else-if="currentReturn.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
            <el-tag v-else size="small">{{ currentReturn.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="退货金额">¥{{ Number(currentReturn.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="退货原因" :span="2">{{ currentReturn.reason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentReturn.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentReturn.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">退货商品</h4>
        <el-table :data="currentReturn.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="100">
            <template #default="{ row }">¥{{ Number((row.quantity || 0) * (row.unitPrice || 0)).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import { createPurchaseReturn, fetchPurchaseOrders, fetchSuppliers, api } from "../../api";
import { formatDate } from "../../utils/format";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";
import DetailDrawer from "../../components/DetailDrawer.vue";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const supplierList = ref<any[]>([]);
const purchaseOrders = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentReturn = ref<any>(null);
const formRef = ref<FormInstance>();

const filterForm = reactive({
  keyword: "",
  supplierId: null as number | null,
  dateRange: [] as string[],
  status: ""
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "returnNo", label: "退货单号", width: 180 },
  { prop: "supplierName", label: "供应商", minWidth: 160 },
  { prop: "totalAmount", label: "退货金额", width: 120, slot: "totalAmount" },
  { prop: "status", label: "状态", width: 100, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 200, fixed: "right", slot: "actions" }
];

const defaultForm = {
  purchaseOrderId: null as number | null,
  reason: "",
  remark: "",
  items: [{ skuName: "", quantity: 1, unitPrice: 0, maxQty: 99999 }] as any[]
};

const form = reactive(JSON.parse(JSON.stringify(defaultForm)));

const formRules: FormRules = {
  purchaseOrderId: [{ required: true, message: "请选择采购订单", trigger: "change" }],
  reason: [{ required: true, message: "请输入退货原因", trigger: "blur" }]
};

const totalAmount = computed(() => {
  return form.items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
});

async function loadReturns() {
  loading.value = true;
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize };
    if (filterForm.keyword) params.keyword = filterForm.keyword;
    if (filterForm.supplierId) params.supplierId = filterForm.supplierId;
    if (filterForm.status) params.status = filterForm.status;
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }
    const { data } = await api.get("/admin/purchase-returns", { params });
    tableData.value = data.data?.records || [];
    pagination.total = data.data?.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    const data = await fetchSuppliers({ page: 1, pageSize: 100 });
    supplierList.value = data.records || data || [];
  } catch {
    supplierList.value = [];
  }
}

async function loadPurchaseOrders() {
  try {
    const data = await fetchPurchaseOrders({ page: 1, pageSize: 100, status: "APPROVED" });
    purchaseOrders.value = data.records || [];
  } catch {
    purchaseOrders.value = [];
  }
}

function resetFilter() {
  filterForm.keyword = "";
  filterForm.supplierId = null;
  filterForm.dateRange = [];
  filterForm.status = "";
  pagination.page = 1;
  loadReturns();
}

function handleCreate() {
  Object.assign(form, JSON.parse(JSON.stringify(defaultForm)));
  dialogVisible.value = true;
  loadPurchaseOrders();
}

function onOrderChange(orderId: number) {
  const po = purchaseOrders.value.find((p: any) => p.id === orderId);
  if (po && po.items && po.items.length > 0) {
    form.items = po.items.map((item: any) => ({
      skuName: item.skuName || "",
      quantity: item.bottleQty || 1,
      unitPrice: item.unitPrice || 0,
      maxQty: item.bottleQty || 99999,
      skuId: item.skuId || 0
    }));
  }
}

function addItem() {
  form.items.push({ skuName: "", quantity: 1, unitPrice: 0, maxQty: 99999 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

function handleView(row: any) {
  currentReturn.value = row;
  detailVisible.value = true;
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm("确定通过该退货单吗？", "提示", { type: "warning" });
    await api.post(`/admin/purchase-returns/${row.id}/approve`);
    ElMessage.success("已通过");
    loadReturns();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReject(row: any) {
  try {
    await ElMessageBox.prompt("请输入驳回原因", "驳回退货单", { type: "warning" });
    ElMessage.success("已驳回");
    loadReturns();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该退货单吗？", "提示", { type: "warning" });
    await api.post(`/admin/purchase-returns/${row.id}/cancel`);
    ElMessage.success("已取消");
    loadReturns();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createPurchaseReturn(form);
      ElMessage.success("创建成功");
      dialogVisible.value = false;
      loadReturns();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "创建失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadReturns();
  loadSuppliers();
});
</script>

<style scoped>
.return-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.amount-text {
  color: #f56c6c;
  font-weight: 600;
}

.total-amount {
  color: #f56c6c;
  font-size: 18px;
  font-weight: 600;
}
</style>
