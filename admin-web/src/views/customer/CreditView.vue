<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>授信管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索客户名称/手机号"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadCredits"
              @keyup.enter="loadCredits"
            />
            <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadCredits">
              <el-option label="正常" value="NORMAL" />
              <el-option label="冻结" value="FROZEN" />
              <el-option label="逾期" value="OVERDUE" />
            </el-select>
            <el-button @click="loadCredits">搜索</el-button>
            <el-button @click="loadCredits">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="6">
          <el-statistic title="授信总额" :value="stats.totalCredit || 0" :precision="2" prefix="¥" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已用额度" :value="stats.usedCredit || 0" :precision="2" prefix="¥" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="可用额度" :value="stats.availableCredit || 0" :precision="2" prefix="¥" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="逾期金额" :value="stats.overdueAmount || 0" :precision="2" prefix="¥" value-style="color: #f56c6c" />
        </el-col>
      </el-row>

      <el-table :data="credits" v-loading="loading" stripe>
        <el-table-column prop="customerName" label="客户名称" min-width="140" />
        <el-table-column prop="customerType" label="客户类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.customerType === 'WHOLESALE'" type="success">批发</el-tag>
            <el-tag v-else type="primary">零售</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="授信额度" width="130">
          <template #default="{ row }">¥{{ Number(row.creditLimit || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="已用额度" width="130">
          <template #default="{ row }">
            <span class="used-text">¥{{ Number(row.usedAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可用额度" width="130">
          <template #default="{ row }">
            <span class="available-text">¥{{ Number(row.availableAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paymentDays" label="账期(天)" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'NORMAL'" type="success">正常</el-tag>
            <el-tag v-else-if="row.status === 'FROZEN'" type="warning">冻结</el-tag>
            <el-tag v-else-if="row.status === 'OVERDUE'" type="danger">逾期</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link type="warning" @click="openAdjustLimit(row)">调额</el-button>
            <el-button v-if="row.status === 'NORMAL'" size="small" link type="danger" @click="handleFreezeCredit(row)">冻结</el-button>
            <el-button v-if="row.status === 'FROZEN'" size="small" link type="success" @click="handleUnfreezeCredit(row)">解冻</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="授信详情" width="720px">
      <template v-if="currentCredit">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="客户名称">{{ currentCredit.customerName }}</el-descriptions-item>
          <el-descriptions-item label="客户类型">
            <el-tag v-if="currentCredit.customerType === 'WHOLESALE'" type="success">批发</el-tag>
            <el-tag v-else type="primary">零售</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="授信额度">¥{{ Number(currentCredit.creditLimit || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="已用额度">¥{{ Number(currentCredit.usedAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="可用额度">¥{{ Number(currentCredit.availableAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="账期">{{ currentCredit.paymentDays || 0 }} 天</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentCredit.status === 'NORMAL'" type="success">正常</el-tag>
            <el-tag v-else-if="currentCredit.status === 'FROZEN'" type="warning">冻结</el-tag>
            <el-tag v-else-if="currentCredit.status === 'OVERDUE'" type="danger">逾期</el-tag>
            <el-tag v-else>{{ currentCredit.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentCredit.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">授信变更记录</h4>
        <el-table :data="creditLogs" size="small" border>
          <el-table-column prop="changeType" label="变更类型" width="120" />
          <el-table-column label="变更前" width="120">
            <template #default="{ row }">¥{{ Number(row.beforeAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="变更后" width="120">
            <template #default="{ row }">¥{{ Number(row.afterAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="operatorName" label="操作人" width="100" />
          <el-table-column prop="createdAt" label="时间" width="160" />
          <el-table-column prop="remark" label="备注" min-width="120" />
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustDialogVisible" title="调整授信额度" width="480px">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="100px">
        <el-form-item label="客户名称">
          <span>{{ adjustForm.customerName }}</span>
        </el-form-item>
        <el-form-item label="当前额度">
          <span>¥{{ Number(adjustForm.currentLimit || 0).toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="新额度" prop="newLimit">
          <el-input-number v-model="adjustForm.newLimit" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="调整原因">
          <el-input v-model="adjustForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitAdjustLimit">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchCreditDetail,
  fetchCreditLogs,
  fetchCredits,
  freezeCredit,
  unfreezeCredit,
  updateCreditLimit
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const credits = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const detailVisible = ref(false);
const adjustDialogVisible = ref(false);
const adjustFormRef = ref();
const currentCredit = ref<any>(null);
const creditLogs = ref<any[]>([]);

const stats = ref({
  totalCredit: 0,
  usedCredit: 0,
  availableCredit: 0,
  overdueAmount: 0
});

const adjustForm = reactive({
  customerId: 0,
  customerName: "",
  currentLimit: 0,
  newLimit: 0,
  remark: ""
});

const adjustRules = {
  newLimit: [{ required: true, message: '请输入新额度', trigger: 'blur' }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadCredits() {
  loading.value = true;
  try {
    const data = await fetchCredits({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    credits.value = data.records || [];
    total.value = data.total || credits.value.length;

    let totalCredit = 0;
    let usedCredit = 0;
    credits.value.forEach((item: any) => {
      totalCredit += Number(item.creditLimit || 0);
      usedCredit += Number(item.usedAmount || 0);
    });
    stats.value.totalCredit = totalCredit;
    stats.value.usedCredit = usedCredit;
    stats.value.availableCredit = totalCredit - usedCredit;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载授信列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadCredits();
}

function handlePageChange(p: number) {
  page.value = p;
  loadCredits();
}

async function viewDetail(row: any) {
  try {
    currentCredit.value = await fetchCreditDetail(row.customerId || row.id);
    creditLogs.value = await fetchCreditLogs(row.customerId || row.id).catch(() => []);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载详情失败"));
  }
}

function openAdjustLimit(row: any) {
  adjustForm.customerId = row.customerId || row.id;
  adjustForm.customerName = row.customerName;
  adjustForm.currentLimit = Number(row.creditLimit || 0);
  adjustForm.newLimit = Number(row.creditLimit || 0);
  adjustForm.remark = "";
  adjustDialogVisible.value = true;
}

async function submitAdjustLimit() {
  const valid = await adjustFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    await updateCreditLimit(adjustForm.customerId, {
      creditLimit: adjustForm.newLimit,
      remark: adjustForm.remark
    });
    ElMessage.success("额度调整成功");
    adjustDialogVisible.value = false;
    loadCredits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "调整额度失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function handleFreezeCredit(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认冻结 ${row.customerName} 的授信额度?`, "确认冻结", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await freezeCredit(row.customerId || row.id, { reason: "管理员操作" });
    ElMessage.success("已冻结");
    loadCredits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "冻结失败"));
  }
}

async function handleUnfreezeCredit(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认解冻 ${row.customerName} 的授信额度?`, "确认解冻", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await unfreezeCredit(row.customerId || row.id, { reason: "管理员操作" });
    ElMessage.success("已解冻");
    loadCredits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "解冻失败"));
  }
}

onMounted(() => {
  loadCredits();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.used-text {
  color: #e6a23c;
  font-weight: 600;
}
.available-text {
  color: #67c23a;
  font-weight: 600;
}
</style>
