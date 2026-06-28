<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的申请</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleOpenSubmit">提交审批</el-button>
          </div>
        </div>
      </template>

      <el-table :data="instances" v-loading="loading" stripe @row-click="handleRowClick" style="cursor: pointer">
        <el-table-column prop="title" label="审批标题" min-width="180" />
        <el-table-column prop="ruleName" label="审批规则" width="150" />
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">审批中</el-tag>
            <el-tag v-else-if="row.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
            <el-tag v-else-if="row.status === 'REJECTED'" type="danger" size="small">已拒绝</el-tag>
            <el-tag v-else size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前步骤" width="150">
          <template #default="{ row }">
            {{ row.currentStep || '-' }}
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

    <!-- 提交审批弹窗 -->
    <el-dialog v-model="submitDialogVisible" title="提交审批" width="550px">
      <el-form ref="submitFormRef" :model="submitForm" :rules="submitRules" label-width="100px">
        <el-form-item label="审批规则" prop="ruleId">
          <el-select v-model="submitForm.ruleId" placeholder="请选择审批规则" style="width: 100%">
            <el-option
              v-for="rule in ruleOptions"
              :key="rule.id"
              :label="rule.name"
              :value="rule.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审批标题" prop="title">
          <el-input v-model="submitForm.title" placeholder="请输入审批标题" />
        </el-form-item>
        <el-form-item label="审批内容" prop="content">
          <el-input v-model="submitForm.content" type="textarea" :rows="4" placeholder="请输入审批内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleConfirmSubmit">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { fetchApprovalInstances, submitApproval, fetchApprovalRules } from "../api";
import { formatDate } from "../utils/format";

const router = useRouter();

const loading = ref(false);
const instances = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const submitDialogVisible = ref(false);
const submitFormRef = ref<FormInstance>();
const submitLoading = ref(false);
const ruleOptions = ref<any[]>([]);

const submitForm = reactive({
  ruleId: null as number | null,
  title: "",
  content: ""
});

const submitRules: FormRules = {
  ruleId: [{ required: true, message: "请选择审批规则", trigger: "change" }],
  title: [{ required: true, message: "请填写审批标题", trigger: "blur" }],
  content: [{ required: true, message: "请填写审批内容", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadInstances() {
  loading.value = true;
  try {
    const data = await fetchApprovalInstances({ page: page.value, pageSize: pageSize.value });
    instances.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载审批列表失败"));
  } finally {
    loading.value = false;
  }
}

async function loadRules() {
  try {
    const data = await fetchApprovalRules({ page: 1, pageSize: 100 });
    ruleOptions.value = data.records || [];
  } catch {
    // ignore
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadInstances();
}

function handlePageChange(p: number) {
  page.value = p;
  loadInstances();
}

function handleRowClick(row: any) {
  router.push(`/approval/${row.instanceNo}`);
}

function handleOpenSubmit() {
  submitForm.ruleId = null;
  submitForm.title = "";
  submitForm.content = "";
  submitDialogVisible.value = true;
  loadRules();
}

async function handleConfirmSubmit() {
  if (!submitFormRef.value) return;
  await submitFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await submitApproval({
        ruleId: submitForm.ruleId!,
        title: submitForm.title,
        content: submitForm.content
      });
      ElMessage.success("审批已提交");
      submitDialogVisible.value = false;
      loadInstances();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "提交审批失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadInstances();
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
</style>