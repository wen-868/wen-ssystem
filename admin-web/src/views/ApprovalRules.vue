<template>
  <div class="page">
    <PageCard title="审批规则管理">
      <template #extra>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showAddDialog">新增规则</el-button>
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
        <template #businessType="{ row }">
          <el-tag :type="businessTypeTagType(row.businessType)">{{ businessTypeLabel(row.businessType) }}</el-tag>
        </template>
        <template #slaHours="{ row }">
          <span v-if="row.slaHours">{{ row.slaHours }}小时</span>
          <span v-else>-</span>
        </template>
        <template #status="{ row }">
          <el-switch
            :model-value="row.status === 'ACTIVE'"
            active-text="启用"
            inactive-text="禁用"
            @change="(val: boolean) => handleToggleStatus(row, val)"
          />
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </DataTable>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑规则' : '新增规则'" width="680px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-select v-model="form.businessType" style="width: 100%" placeholder="请选择业务类型">
            <el-option
              v-for="bt in businessTypeOptions"
              :key="bt.value"
              :label="bt.label"
              :value="bt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审批链配置">
          <div class="chain-config">
            <div v-for="(level, index) in form.approvalChain" :key="index" class="chain-level">
              <span class="level-index">第{{ index + 1 }}级</span>
              <el-select v-model="level.role" placeholder="审批人角色" style="width: 200px">
                <el-option label="部门经理" value="DEPT_MANAGER" />
                <el-option label="财务主管" value="FINANCE_DIRECTOR" />
                <el-option label="总经理" value="GENERAL_MANAGER" />
                <el-option label="区域经理" value="REGION_MANAGER" />
                <el-option label="运营总监" value="OPERATION_DIRECTOR" />
              </el-select>
              <el-button size="small" :disabled="index === 0" @click="moveLevel(index, -1)">上移</el-button>
              <el-button size="small" :disabled="index === form.approvalChain.length - 1" @click="moveLevel(index, 1)">下移</el-button>
              <el-button size="small" type="danger" link @click="removeLevel(index)">删除</el-button>
            </div>
            <el-button size="small" type="primary" link @click="addLevel">+ 添加审批级别</el-button>
          </div>
        </el-form-item>
        <el-form-item label="SLA时效">
          <el-input-number v-model="form.slaHours" :min="1" :max="720" style="width: 160px" />
          <span style="margin-left: 8px; color: #909399">小时</span>
        </el-form-item>
        <el-form-item label="升级级别">
          <el-input-number v-model="form.escalationLevel" :min="0" :max="10" style="width: 160px" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入规则描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-value="ACTIVE" inactive-value="INACTIVE" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchApprovalRules, createApprovalRule, updateApprovalRule, deleteApprovalRule } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const businessTypeOptions = [
  { value: "PURCHASE", label: "采购审批", color: "#409eff" },
  { value: "SALE", label: "销售审批", color: "#67c23a" },
  { value: "REFUND", label: "退款审批", color: "#e6a23c" },
  { value: "EXPENSE", label: "费用审批", color: "#909399" },
  { value: "PRICE_CHANGE", label: "价格变更", color: "#9b59b6" },
  { value: "CREDIT_LIMIT", label: "信用额度", color: "#00bcd4" }
];

function businessTypeLabel(v: string) {
  return businessTypeOptions.find(t => t.value === v)?.label || v;
}

function businessTypeTagType(v: string) {
  const map: Record<string, string> = {
    PURCHASE: "",
    SALE: "success",
    REFUND: "warning",
    PRICE_CHANGE: "",
    CREDIT_LIMIT: ""
  };
  return map[v] || "";
}

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref();
const rules = {
  ruleName: [{ required: true, message: "请输入规则名称", trigger: "blur" }]
};
const form = ref({
  ruleName: "",
  businessType: "",
  approvalChain: [] as { role: string }[],
  slaHours: 24,
  escalationLevel: 0,
  description: "",
  status: "ACTIVE"
});

const columns = [
  { prop: "ruleName", label: "规则名称", minWidth: 140 },
  { prop: "businessType", label: "业务类型", width: 120, slot: "businessType" },
  { prop: "chainSummary", label: "审批链", minWidth: 180 },
  { prop: "slaHours", label: "SLA时效", width: 100, slot: "slaHours" },
  { prop: "status", label: "状态", width: 120, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 140, fixed: "right", slot: "actions" }
];

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchApprovalRules({ page: page.value, pageSize: pageSize.value });
    records.value = (data.records || data.list || []).map((r: any) => {
      if (r.approvalChain && typeof r.approvalChain === "string") {
        r.approvalChain = JSON.parse(r.approvalChain);
      }
      return r;
    });
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
  form.value = {
    ruleName: "",
    businessType: "",
    approvalChain: [{ role: "" }],
    slaHours: 24,
    escalationLevel: 0,
    description: "",
    status: "ACTIVE"
  };
  dialogVisible.value = true;
}

function showEditDialog(row: any) {
  isEdit.value = true;
  editId.value = row.id;
  const chain = row.approvalChain && typeof row.approvalChain === "string"
    ? JSON.parse(row.approvalChain)
    : (row.approvalChain || []);
  form.value = {
    ruleName: row.ruleName || "",
    businessType: row.businessType || "",
    approvalChain: chain.length ? chain.map((c: any) => ({ role: c.role || "" })) : [{ role: "" }],
    slaHours: row.slaHours || 24,
    escalationLevel: row.escalationLevel || 0,
    description: row.description || "",
    status: row.status || "ACTIVE"
  };
  dialogVisible.value = true;
}

function addLevel() {
  form.value.approvalChain.push({ role: "" });
}

function removeLevel(index: number) {
  if (form.value.approvalChain.length <= 1) {
    ElMessage.warning("至少保留一个审批级别");
    return;
  }
  form.value.approvalChain.splice(index, 1);
}

function moveLevel(index: number, direction: number) {
  const arr = form.value.approvalChain;
  const target = index + direction;
  if (target < 0 || target >= arr.length) return;
  const temp = arr[index];
  arr[index] = arr[target];
  arr[target] = temp;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (!form.value.businessType) { ElMessage.warning("请选择业务类型"); return; }
  submitLoading.value = true;
  try {
    const payload = {
      ruleName: form.value.ruleName,
      businessType: form.value.businessType,
      approvalChain: form.value.approvalChain.map((level, index) => ({
        role: level.role,
        order: index + 1
      })),
      slaHours: form.value.slaHours,
      escalationLevel: form.value.escalationLevel,
      description: form.value.description,
      status: form.value.status
    };
    if (isEdit.value && editId.value) {
      await updateApprovalRule(editId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createApprovalRule(payload);
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

async function handleToggleStatus(row: any, val: boolean) {
  try {
    await updateApprovalRule(row.id, { status: val ? "ACTIVE" : "INACTIVE" });
    ElMessage.success(val ? "已启用" : "已禁用");
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "操作失败");
  }
}

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm(`确定删除规则 "${row.ruleName}" 吗？`, "确认删除", { type: "warning" }); } catch { return; }
  try {
    await deleteApprovalRule(row.id);
    ElMessage.success("已删除");
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || "删除失败"); }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.page { padding: 0; }
.chain-config {
  width: 100%;
}
.chain-level {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.level-index {
  font-size: 13px;
  color: #909399;
  min-width: 50px;
}
</style>