<template>
  <div class="page-header">

    <div class="page-header-main">

      <h2 class="page-title">票据管理</h2>

      <p class="page-desc">票据登记与核销管理</p>

    </div>

  </div>

    <div class="bill-header">
      <el-input
        v-model="keyword"
        placeholder="搜索票据号/金额/备注"
        size="default"
        style="width: 260px; margin-right: 10px"
        clearable
        @clear="loadBills"
        @keyup.enter="loadBills"
      />
      <el-select v-model="billType" placeholder="票据类型" clearable style="width: 140px; margin-right: 10px">
        <el-option label="发票" value="INVOICE" />
        <el-option label="收据" value="RECEIPT" />
        <el-option label="支票" value="CHECK" />
        <el-option label="汇票" value="DRAFT" />
      </el-select>
      <el-select v-model="status" placeholder="状态" clearable style="width: 140px; margin-right: 10px">
        <el-option label="待核销" value="PENDING" />
        <el-option label="已核销" value="VERIFIED" />
        <el-option label="作废" value="VOID" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="出票日期"
        end-placeholder="到期日期"
        style="width: 300px; margin-right: 10px"
      />
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增票据
      </el-button>
      <el-button @click="loadBills">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div class="table-card">
<el-table :data="billList" v-loading="loading" stripe empty-text="暂无票据记录">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="billNo" label="票据号" min-width="160" />
      <el-table-column prop="billType" label="类型" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.billType === 'INVOICE'" type="success">发票</el-tag>
          <el-tag v-else-if="row.billType === 'RECEIPT'" type="info">收据</el-tag>
          <el-tag v-else-if="row.billType === 'CHECK'" type="warning">支票</el-tag>
          <el-tag v-else-if="row.billType === 'DRAFT'" type="danger">汇票</el-tag>
          <el-tag v-else>{{ row.billType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="140">
        <template #default="{ row }">
          <span class="amount-text">{{ formatMoney(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="issueDate" label="出票日期" width="130">
        <template #default="{ row }">
          {{ formatDate(row.issueDate) }}
        </template>
      </el-table-column>
      <el-table-column prop="dueDate" label="到期日期" width="130">
        <template #default="{ row }">
          <span :class="{ 'overdue': isOverdue(row.dueDate) }">{{ formatDate(row.dueDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'PENDING'" type="warning">待核销</el-tag>
          <el-tag v-else-if="row.status === 'VERIFIED'" type="success">已核销</el-tag>
          <el-tag v-else type="danger">作废</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="200" />
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleVerify(row)">核销</el-button>
          <el-button size="small" link type="danger" @click="handleVoid(row)">作废</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-card-footer">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @size-change="handleSizeChange"
        @current-page="handlePageChange"
      />
    </div>
</div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑票据' : '新增票据'" width="720px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="票据号" prop="billNo">
          <el-input v-model="form.billNo" placeholder="请输入票据号" />
        </el-form-item>
        <el-form-item label="票据类型" prop="billType">
          <el-select v-model="form.billType" style="width: 100%">
            <el-option label="发票" value="INVOICE" />
            <el-option label="收据" value="RECEIPT" />
            <el-option label="支票" value="CHECK" />
            <el-option label="汇票" value="DRAFT" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" placeholder="票据金额" />
        </el-form-item>
        <el-form-item label="出票日期" prop="issueDate">
          <el-date-picker v-model="form.issueDate" type="date" style="width: 100%" placeholder="请选择出票日期" />
        </el-form-item>
        <el-form-item label="到期日期" prop="dueDate">
          <el-date-picker v-model="form.dueDate" type="date" style="width: 100%" placeholder="请选择到期日期" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { formatDate, formatMoney } from "../../utils/format";
import {
  fetchBills,
  createBill,
  updateBill,
  verifyBill,
  voidBill
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const billList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const billType = ref("");
const status = ref("");
const dateRange = ref<Date[] | null>(null);
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  billNo: "",
  billType: "INVOICE" as "INVOICE" | "RECEIPT" | "CHECK" | "DRAFT",
  amount: 0,
  issueDate: "",
  dueDate: "",
  remark: ""
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  billNo: [{ required: true, message: "请输入票据号", trigger: "blur" }],
  billType: [{ required: true, message: "请选择票据类型", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  issueDate: [{ required: true, message: "请选择出票日期", trigger: "change" }],
  dueDate: [{ required: true, message: "请选择到期日期", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDateRange(range: Date[] | null): { dateStart?: string; dateEnd?: string } {
  if (!range || range.length !== 2) return {};
  return {
    dateStart: formatDate(range[0], "YYYY-MM-DD"),
    dateEnd: formatDate(range[1], "YYYY-MM-DD")
  };
}

async function loadBills() {
  loading.value = true;
  try {
    const dateRangeParams = formatDateRange(dateRange.value);
    const data = await fetchBills({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      billType: billType.value || undefined,
      status: status.value || undefined,
      ...dateRangeParams
    });
    billList.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载票据失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadBills();
}

function handlePageChange(p: number) {
  page.value = p;
  loadBills();
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  form.id = row.id;
  form.billNo = row.billNo || "";
  form.billType = (row.billType as "INVOICE" | "RECEIPT" | "CHECK" | "DRAFT") || "INVOICE";
  form.amount = row.amount || 0;
  form.issueDate = row.issueDate || "";
  form.dueDate = row.dueDate || "";
  form.remark = row.remark || "";
  dialogVisible.value = true;
}

async function handleVerify(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认核销票据 ${row.billNo}？`, "确认核销", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await verifyBill(row.id);
    ElMessage.success("票据已核销");
    loadBills();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "核销失败"));
  }
}

async function handleVoid(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认作废票据 ${row.billNo}？`, "确认作废", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await voidBill(row.id);
    ElMessage.success("票据已作废");
    loadBills();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "作废失败"));
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = {
        billNo: form.billNo,
        billType: form.billType,
        amount: form.amount,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        remark: form.remark || undefined
      };
      if (isEdit.value) {
        await updateBill(form.id, payload);
        ElMessage.success("票据已更新");
      } else {
        await createBill(payload);
        ElMessage.success("票据已创建");
      }
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadBills();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新失败" : "创建失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadBills();
});
</script>

<style scoped>
.bill-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.amount-text {
  font-weight: 600;
  color: var(--color-primary);
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.overdue {
  color: var(--color-danger);
  font-weight: 600;
}
</style>