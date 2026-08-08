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
        </template>
      </DataTable>
    </PageCard>

    <el-dialog v-model="dialogVisible" title="提交审批" width="720px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="submitForm" :rules="rules" label-width="100px">
        <el-form-item label="业务类型" prop="businessType">
          <el-select v-model="submitForm.businessType" style="width: 100%" placeholder="请选择业务类型">
            <el-option
              v-for="bt in businessTypeOptions"
              :key="bt.value"
              :label="bt.label"
              :value="bt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="业务单号" prop="businessNo">
          <el-input v-model="submitForm.businessNo" placeholder="请输入业务单号（如采购单号/退货单号）" />
        </el-form-item>
        <el-form-item label="标题" prop="businessTitle">
          <el-input v-model="submitForm.businessTitle" placeholder="请输入审批标题" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="submitForm.remark" type="textarea" :rows="4" placeholder="请输入审批备注（可选）" />
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
import { ElMessage } from "element-plus";
import { useAuthStore } from "../../stores/auth";
import { fetchMyApplications, submitApproval } from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";

const router = useRouter();
const authStore = useAuthStore();

// 与后端 t_approval_rule / t_approval_instance 的 business_type 枚举对齐
const businessTypeOptions = [
  { value: "PURCHASE_ORDER", label: "采购审批" },
  { value: "SALE_RETURN", label: "销售退货审批" },
  { value: "PRICE_CHANGE", label: "价格变更" },
  { value: "CREDIT_LIMIT", label: "信用额度" }
];

function businessTypeLabel(v: string) {
  return businessTypeOptions.find(t => t.value === v)?.label || v;
}

function businessTypeTagType(v: string) {
  const map: Record<string, string> = {
    PURCHASE_ORDER: "", SALE_RETURN: "warning", PRICE_CHANGE: "", CREDIT_LIMIT: ""
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
  { prop: "instanceNo", label: "审批编号", width: 160 },
  { prop: "businessTitle", label: "标题", minWidth: 140 },
  { prop: "businessType", label: "业务类型", width: 130, slot: "businessType" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "currentLevel", label: "当前审批节点", width: 120 },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 120, fixed: "right", slot: "actions" }
];

const dialogVisible = ref(false);
const submitLoading = ref(false);
const submitForm = reactive({
  businessType: "",
  businessNo: "",
  businessTitle: "",
  remark: ""
});

const formRef = ref();
const rules = {
  businessType: [{ required: true, message: "请选择业务类型", trigger: "change" }],
  businessNo: [{ required: true, message: "请输入业务单号", trigger: "blur" }],
  businessTitle: [{ required: true, message: "请输入标题", trigger: "blur" }]
};

async function search() {
  loading.value = true;
  try {
    const data = await fetchMyApplications({
      page: page.value,
      pageSize: pageSize.value,
      businessType: searchForm.businessType || undefined,
      status: searchForm.status || undefined,
      applicantId: authStore.user?.id
    });
    records.value = data.records || data.list || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function showSubmitDialog() {
  submitForm.businessType = "";
  submitForm.businessNo = "";
  submitForm.businessTitle = "";
  submitForm.remark = "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  submitLoading.value = true;
  try {
    await submitApproval({
      businessType: submitForm.businessType,
      businessNo: submitForm.businessNo,
      businessTitle: submitForm.businessTitle,
      remark: submitForm.remark || undefined
    });
    ElMessage.success("提交成功");
    dialogVisible.value = false;
    search();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "提交失败");
  } finally {
    submitLoading.value = false;
  }
}

function viewDetail(row: any) {
  router.push(`/system/approval/detail/${row.instanceNo}`);
}

onMounted(() => { search(); });
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
