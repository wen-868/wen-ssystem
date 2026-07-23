<template>
  <div class="payment-page">
    <div class="page-header">
      <h2>采购付款</h2>
      <p class="page-desc">管理采购付款记录，支持审批、付款和取消</p>
    </div>

    <PageCard>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="供应商">
          <el-select
            v-model="filterForm.supplierId"
            placeholder="全部供应商"
            clearable
            filterable
            style="width: 200px"
            @change="loadPayments"
          >
            <el-option
              v-for="s in supplierList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filterForm.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
            @change="loadPayments"
          >
            <el-option label="草稿" value="DRAFT" />
            <el-option label="待审核" value="PENDING" />
            <el-option label="已审核" value="APPROVED" />
            <el-option label="已付款" value="PAID" />
            <el-option label="已取消" value="CANCELLED" />
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
            @change="loadPayments"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPayments">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新增付款
        </el-button>
        <el-button @click="loadPayments">
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
        @update:page="loadPayments"
        @update:page-size="loadPayments"
      >
        <template #status="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
          <el-tag v-else-if="row.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
          <el-tag v-else-if="row.status === 'APPROVED'" type="success" size="small">已审核</el-tag>
          <el-tag v-else-if="row.status === 'PAID'" type="primary" size="small">已付款</el-tag>
          <el-tag v-else-if="row.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
          <el-tag v-else size="small">{{ row.status }}</el-tag>
        </template>

        <template #amount="{ row }">
          <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
        </template>

        <template #paidAmount="{ row }">
          <span>¥{{ Number(row.paidAmount || 0).toFixed(2) }}</span>
        </template>

        <template #balance="{ row }">
          <span class="amount-text">¥{{ Number(row.balance || 0).toFixed(2) }}</span>
        </template>

        <template #paymentMethod="{ row }">
          <span v-if="row.paymentMethod === 'BANK_TRANSFER'">银行转账</span>
          <span v-else-if="row.paymentMethod === 'CASH'">现金</span>
          <span v-else-if="row.paymentMethod === 'CHECK'">支票</span>
          <span v-else>{{ row.paymentMethod || '-' }}</span>
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
            审核
          </el-button>
          <el-button
            v-if="row.status === 'APPROVED'"
            link
            type="primary"
            size="small"
            @click="handlePay(row)"
          >
            付款
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
      title="新增付款"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="供应商" prop="supplierId">
          <el-select
            v-model="form.supplierId"
            placeholder="请选择供应商"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="s in supplierList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="付款金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :min="0.01"
            :precision="2"
            style="width: 100%"
            placeholder="请输入付款金额"
          />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="form.paymentMethod" placeholder="请选择付款方式" style="width: 100%">
            <el-option label="银行转账" value="BANK_TRANSFER" />
            <el-option label="现金" value="CASH" />
            <el-option label="支票" value="CHECK" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款日期">
          <el-date-picker
            v-model="form.dueDate"
            type="date"
            placeholder="请选择付款日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <DetailDrawer v-model="detailVisible" title="付款详情" width="480px">
      <template v-if="currentPayment">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="付款单号">{{ currentPayment.paymentNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentPayment.supplierName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="付款金额">¥{{ Number(currentPayment.amount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ Number(currentPayment.paidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="未付余额">¥{{ Number(currentPayment.balance || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentPayment.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
            <el-tag v-else-if="currentPayment.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
            <el-tag v-else-if="currentPayment.status === 'APPROVED'" type="success" size="small">已审核</el-tag>
            <el-tag v-else-if="currentPayment.status === 'PAID'" type="primary" size="small">已付款</el-tag>
            <el-tag v-else-if="currentPayment.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
            <el-tag v-else size="small">{{ currentPayment.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="付款方式">
            <span v-if="currentPayment.paymentMethod === 'BANK_TRANSFER'">银行转账</span>
            <span v-else-if="currentPayment.paymentMethod === 'CASH'">现金</span>
            <span v-else-if="currentPayment.paymentMethod === 'CHECK'">支票</span>
            <span v-else>{{ currentPayment.paymentMethod || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="付款日期">{{ currentPayment.dueDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentPayment.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentPayment.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import {
  fetchPurchasePayments,
  createPurchasePayment,
  approvePurchasePayment,
  payPurchasePayment,
  cancelPurchasePayment,
  fetchSuppliers
} from "../../api";
import { formatDate } from "../../utils/format";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";
import DetailDrawer from "../../components/DetailDrawer.vue";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const supplierList = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentPayment = ref<any>(null);
const formRef = ref<FormInstance>();

const filterForm = reactive({
  supplierId: null as number | null,
  status: "",
  dateRange: [] as string[]
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "paymentNo", label: "付款单号", width: 180 },
  { prop: "supplierName", label: "供应商", minWidth: 160 },
  { prop: "amount", label: "付款金额", width: 120, slot: "amount" },
  { prop: "paidAmount", label: "已付金额", width: 120, slot: "paidAmount" },
  { prop: "balance", label: "未付余额", width: 120, slot: "balance" },
  { prop: "status", label: "状态", width: 100, slot: "status" },
  { prop: "dueDate", label: "付款日期", width: 120 },
  { label: "操作", width: 200, fixed: "right", slot: "actions" }
];

const defaultForm = {
  supplierId: null as number | null,
  amount: 0,
  paymentMethod: "BANK_TRANSFER",
  dueDate: "",
  remark: ""
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }],
  amount: [{ required: true, message: "请输入付款金额", trigger: "blur" }]
};

async function loadPayments() {
  loading.value = true;
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize };
    if (filterForm.supplierId) params.supplierId = filterForm.supplierId;
    if (filterForm.status) params.status = filterForm.status;
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }
    const data = await fetchPurchasePayments(params);
    tableData.value = data.records || [];
    pagination.total = data.total || 0;
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

function resetFilter() {
  filterForm.supplierId = null;
  filterForm.status = "";
  filterForm.dateRange = [];
  pagination.page = 1;
  loadPayments();
}

function handleCreate() {
  Object.assign(form, { ...defaultForm });
  dialogVisible.value = true;
}

function handleView(row: any) {
  currentPayment.value = row;
  detailVisible.value = true;
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm("确定审核通过该付款单吗？", "提示", { type: "warning" });
    await approvePurchasePayment(row.id);
    ElMessage.success("审核通过");
    loadPayments();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handlePay(row: any) {
  try {
    await ElMessageBox.confirm("确定执行付款操作吗？", "提示", { type: "warning" });
    await payPurchasePayment(row.id);
    ElMessage.success("付款成功");
    loadPayments();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该付款单吗？", "提示", { type: "warning" });
    await cancelPurchasePayment(row.id);
    ElMessage.success("已取消");
    loadPayments();
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
      await createPurchasePayment(form);
      ElMessage.success("创建成功");
      dialogVisible.value = false;
      loadPayments();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "创建失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadPayments();
  loadSuppliers();
});
</script>

<style scoped>
.payment-page {
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
</style>
