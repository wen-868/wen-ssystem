<template>
  <div class="platform-reconciliation-page">
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="对账单号">
          <el-input v-model="searchForm.reconciliationNo" placeholder="请输入对账单号" clearable />
        </el-form-item>
        <el-form-item label="平台名称">
          <el-input v-model="searchForm.platformName" placeholder="请输入平台名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="初始" :value="0" />
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="showCreateDialog">新建对账</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="records" border v-loading="loading">
        <el-table-column prop="reconciliationNo" label="对账单号" width="200" />
        <el-table-column prop="platformName" label="平台名称" width="150" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 1 ? 'primary' : 'warning'">
              {{ row.type === 1 ? '订单' : '退款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="150">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordedAt" label="记录时间" width="180" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="showDetail(row)">详情</el-button>
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="500px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="对账单号" prop="reconciliationNo" v-if="!isEdit">
          <el-input v-model="form.reconciliationNo" placeholder="请输入对账单号" />
        </el-form-item>
        <el-form-item label="平台编号" prop="platformNo">
          <el-input v-model="form.platformNo" placeholder="请输入平台编号" />
        </el-form-item>
        <el-form-item label="平台名称" prop="platformName">
          <el-input v-model="form.platformName" placeholder="请输入平台名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择类型">
            <el-option label="订单" :value="1" />
            <el-option label="退款" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status" v-if="isEdit">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="初始" :value="0" />
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="记录时间" prop="recordedAt">
          <el-date-picker v-model="form.recordedAt" type="datetime" placeholder="选择记录时间" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog title="对账详情" v-model="detailVisible" width="500px">
      <el-descriptions :column="1" border v-if="detail">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="对账单号">{{ detail.reconciliationNo }}</el-descriptions-item>
        <el-descriptions-item label="平台编号">{{ detail.platformNo }}</el-descriptions-item>
        <el-descriptions-item label="平台名称">{{ detail.platformName }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ detail.type === 1 ? '订单' : '退款' }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ detail.amount }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detail.status)">{{ getStatusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="记录时间">{{ detail.recordedAt }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import {
  fetchPlatformReconciliations, createPlatformReconciliation,
  updatePlatformReconciliation, fetchPlatformReconciliationDetail,
} from "@/api";

const records = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const detail = ref<any>(null);

const searchForm = reactive({
  reconciliationNo: "",
  platformName: "",
  status: undefined as number | undefined,
});

const form = reactive({
  reconciliationNo: "",
  platformNo: "",
  platformName: "",
  type: 1,
  amount: 0,
  status: 0,
  recordedAt: null as string | null,
});

const formRef = ref();
const formRules: FormRules = {
  reconciliationNo: [{ required: true, message: "请输入对账单号", trigger: "blur" }],
  platformNo: [{ required: true, message: "请输入平台编号", trigger: "blur" }],
  platformName: [{ required: true, message: "请输入平台名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择类型", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  recordedAt: [{ required: true, message: "请选择记录时间", trigger: "change" }],
};

const statusMap: Record<number, { label: string; type: string }> = {
  0: { label: "初始", type: "info" },
  1: { label: "成功", type: "success" },
  2: { label: "失败", type: "danger" },
};

const getStatusType = (status: number) => statusMap[status]?.type || "info";
const getStatusLabel = (status: number) => statusMap[status]?.label || "未知";

const dialogTitle = ref("新建对账");

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await fetchPlatformReconciliations({
      page: currentPage.value,
      pageSize: pageSize.value,
      reconciliationNo: searchForm.reconciliationNo || undefined,
      platformName: searchForm.platformName || undefined,
      status: searchForm.status,
    });
    records.value = res.records || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error("获取对账列表失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.reconciliationNo = "";
  searchForm.platformName = "";
  searchForm.status = undefined;
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const showCreateDialog = () => {
  isEdit.value = false;
  editId.value = null;
  dialogTitle.value = "新建对账";
  resetForm();
  dialogVisible.value = true;
};

const showEditDialog = async (row: any) => {
  isEdit.value = true;
  editId.value = row.id;
  dialogTitle.value = "编辑对账";
  try {
    const detail = await fetchPlatformReconciliationDetail(row.id);
    form.platformNo = detail.platformNo || "";
    form.platformName = detail.platformName || "";
    form.type = detail.type;
    form.amount = detail.amount;
    form.status = detail.status;
    form.recordedAt = detail.recordedAt || null;
  } catch {
    ElMessage.error("获取对账详情失败");
  }
  dialogVisible.value = true;
};

const showDetail = async (row: any) => {
  try {
    detail.value = await fetchPlatformReconciliationDetail(row.id);
    detailVisible.value = true;
  } catch {
    ElMessage.error("获取对账详情失败");
  }
};

const resetForm = () => {
  form.reconciliationNo = "";
  form.platformNo = "";
  form.platformName = "";
  form.type = 1;
  form.amount = 0;
  form.status = 0;
  form.recordedAt = null;
};

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    if (isEdit.value && editId.value) {
      await updatePlatformReconciliation(editId.value, {
        status: form.status,
        amount: form.amount,
      });
      ElMessage.success("更新成功");
    } else {
      await createPlatformReconciliation({
        reconciliationNo: form.reconciliationNo,
        platformNo: form.platformNo,
        platformName: form.platformName,
        type: form.type,
        amount: form.amount,
        status: 0,
        recordedAt: form.recordedAt || undefined,
      });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    ElMessage.error(isEdit.value ? "更新失败" : "创建失败");
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.platform-reconciliation-page {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
}
.table-card {
  margin-bottom: 20px;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>