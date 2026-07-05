<template>
  <div class="page">
    <PageCard title="我的申请">
      <template #extra>
        <el-button type="primary" @click="showSubmitDialog">提交审批</el-button>
        <el-button @click="search">刷新</el-button>
      </template>

      <div class="filter-bar">
        <el-select v-model="searchForm.businessType" placeholder="业务类型" clearable style="width: 160px">
          <el-option
            v-for="bt in businessTypeOptions"
            :key="bt.value"
            :label="bt.label"
            :value="bt.value"
          />
        </el-select>
        <el-select v-model="searchForm.status" placeholder="审批状态" clearable style="width: 160px; margin-left: 12px">
          <el-option label="全部" value="" />
          <el-option label="审批中" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="已撤销" value="CANCELLED" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="search"
        @update:page-size="search"
      >
        <template #businessType="{ row }">
          <el-tag :type="businessTypeTagType(row.businessType)">{{ businessTypeLabel(row.businessType) }}</el-tag>
        </template>
        <template #status="{ row }">
          <el-tag :type="approvalStatusTagType(row.status)">{{ approvalStatusLabel(row.status) }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="viewDetail(row)">查看详情</el-button>
          <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="handleCancel(row)">撤销</el-button>
        </template>
      </DataTable>
    </PageCard>

    <el-dialog v-model="dialogVisible" title="提交审批" width="560px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="submitForm" :rules="rules" label-width="100px">
        <el-form-item label="审批规则" prop="ruleId">
          <el-select v-model="submitForm.ruleId" style="width: 100%" placeholder="请选择审批规则" @change="onRuleChange">
            <el-option
              v-for="r in ruleOptions"
              :key="r.id"
              :label="r.ruleName + ' (' + businessTypeLabel(r.businessType) + ')'"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="submitForm.title" placeholder="请输入审批标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="submitForm.content" type="textarea" :rows="4" placeholder="请输入审批内容" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-input :model-value="submitForm.businessTypeLabel" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchMyApplications, submitApproval, cancelApproval, fetchApprovalRules } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const router = useRouter();

const businessTypeOptions = [
  { value: "PURCHASE", label: "采购审批" },
  { value: "SALE", label: "销售审批" },
  { value: "REFUND", label: "退款审批" },
  { value: "PRICE_CHANGE", label: "价格变更" },
  { value: "CREDIT_LIMIT", label: "信用额度" }
];

function businessTypeLabel(v: string) {
  return businessTypeOptions.find(t => t.value === v)?.label || v;
}

function businessTypeTagType(v: string) {
  const map: Record<string, string> = {
    PURCHASE: "", SALE: "success", REFUND: "warning", PRICE_CHANGE: "", CREDIT_LIMIT: ""
  };
  return map[v] || "";
}

function approvalStatusLabel(v: string) {
  const map: Record<string, string> = {
    PENDING: "审批中", APPROVED: "已通过", REJECTED: "已拒绝", CANCELLED: "已撤销"
  };
  return map[v] || v;
}

function approvalStatusTagType(v: string) {
  const map: Record<string, string> = {
    PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "info"
  };
  return map[v] || "info";
}

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchForm = reactive({ businessType: "", status: "" });

const columns = [
  { prop: "approvalNo", label: "审批编号", width: 160 },
  { prop: "title", label: "标题", minWidth: 140 },
  { prop: "businessType", label: "业务类型", width: 110, slot: "businessType" },
  { prop: "ruleName", label: "审批规则", minWidth: 140 },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "currentLevel", label: "当前审批节点", width: 120 },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 160, fixed: "right", slot: "actions" }
];

const dialogVisible = ref(false);
const submitLoading = ref(false);
const formRef = ref();
const rules = {
  ruleId: [{ required: true, message: "请选择审批规则", trigger: "change" }]
};
const ruleOptions = ref<any[]>([]);
const submitForm = reactive({
  ruleId: null as number | null,
  title: "",
  content: "",
  businessTypeLabel: ""
});

async function search() {
  loading.value = true;
  try {
    const data = await fetchMyApplications({
      page: page.value,
      pageSize: pageSize.value,
      businessType: searchForm.businessType || undefined,
      status: searchForm.status || undefined
    });
    records.value = data.records || data.list || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadRules() {
  try {
    const data = await fetchApprovalRules({ page: 1, pageSize: 100 });
    ruleOptions.value = (data.records || data.list || []).filter((r: any) => r.status === "ACTIVE");
  } catch { /* ignore */ }
}

function onRuleChange(val: number | null) {
  if (!val) {
    submitForm.businessTypeLabel = "";
    return;
  }
  const rule = ruleOptions.value.find(r => r.id === val);
  submitForm.businessTypeLabel = rule ? businessTypeLabel(rule.businessType) : "";
}

function showSubmitDialog() {
  submitForm.ruleId = null;
  submitForm.title = "";
  submitForm.content = "";
  submitForm.businessTypeLabel = "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!submitForm.ruleId) { ElMessage.warning("请选择审批规则"); return; }
  if (!submitForm.title) { ElMessage.warning("请输入标题"); return; }
  submitLoading.value = true;
  try {
    await submitApproval({
      ruleId: submitForm.ruleId,
      title: submitForm.title,
      content: submitForm.content
    });
    ElMessage.success("提交成功");
    dialogVisible.value = false;
    search();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "提交失败");
  } finally {
    submitLoading.value = false;
  }
}

function viewDetail(row: any) {
  router.push(`/approval/detail/${row.id}`);
}

async function handleCancel(row: any) {
  try { await ElMessageBox.confirm("确定撤销该审批申请吗？", "确认撤销", { type: "warning" }); } catch { return; }
  try {
    await cancelApproval(row.id);
    ElMessage.success("已撤销");
    search();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || "撤销失败"); }
}

onMounted(() => { search(); loadRules(); });
</script>

<style scoped>
.page { padding: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
</style>