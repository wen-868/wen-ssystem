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
            :model-value="Number(row.status) === 1"
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑规则' : '新增规则'" width="720px" :close-on-click-modal="false">
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
              <el-select v-model="level.approverType" placeholder="审批人类型" style="width: 120px">
                <el-option label="角色" value="ROLE" />
                <el-option label="用户" value="USER" />
                <el-option label="部门" value="DEPARTMENT" />
              </el-select>
              <el-select
                v-if="level.approverType === 'ROLE'"
                v-model="level.approverValue"
                placeholder="选择审批角色"
                style="width: 200px"
              >
                <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
              </el-select>
              <el-input
                v-else
                v-model="level.approverValue"
                :placeholder="level.approverType === 'USER' ? '请输入用户ID' : '请输入部门ID'"
                style="width: 200px"
              />
              <el-button size="small" :disabled="index === 0" @click="moveLevel(index, -1)">上移</el-button>
              <el-button size="small" :disabled="index === form.approvalChain.length - 1" @click="moveLevel(index, 1)">下移</el-button>
              <el-button size="small" type="danger" link @click="removeLevel(index)">删除</el-button>
            </div>
            <el-button size="small" type="primary" link @click="addLevel">+ 添加审批级别</el-button>
          </div>
        </el-form-item>
        <el-form-item label="SLA时效">
          <el-input-number v-model="form.slaHours" :min="1" :max="720" style="width: 160px" />
          <span style="margin-left: 8px; color: var(--gray-400)">小时</span>
        </el-form-item>
        <el-form-item label="升级级别">
          <el-input-number v-model="form.escalationLevel" :min="1" :max="3" style="width: 160px" />
          <span style="margin-left: 8px; color: var(--gray-400)">1-3</span>
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
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
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchApprovalRules, createApprovalRule, updateApprovalRule, deleteApprovalRule } from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";

/** 后端 zod 业务类型枚举：PURCHASE_ORDER/SALE_RETURN/PRICE_CHANGE/CREDIT_LIMIT/EXPENSE */
const businessTypeOptions = [
  { value: "PURCHASE_ORDER", label: "采购订单审批", color: CHART_COLORS.primary },
  { value: "SALE_RETURN", label: "销售退货审批", color: CHART_COLORS.success },
  { value: "PRICE_CHANGE", label: "价格变更审批", color: CHART_COLORS.purple },
  { value: "CREDIT_LIMIT", label: "信用额度审批", color: CHART_COLORS.cyan },
  { value: "EXPENSE", label: "费用审批", color: CHART_COLORS.warning }
];

/** 审批人角色选项：与 t_approval_approver 种子数据保持一致 */
const roleOptions = [
  { value: "PURCHASE_MANAGER", label: "采购经理" },
  { value: "FINANCE_MANAGER", label: "财务经理" },
  { value: "STORE_MANAGER", label: "门店经理" },
  { value: "SALES_MANAGER", label: "销售经理" },
  { value: "GENERAL_MANAGER", label: "总经理" }
];

function businessTypeLabel(v: string) {
  return businessTypeOptions.find(t => t.value === v)?.label || v;
}

function businessTypeTagType(v: string) {
  const map: Record<string, string> = {
    PURCHASE_ORDER: "",
    SALE_RETURN: "success",
    PRICE_CHANGE: "warning",
    CREDIT_LIMIT: "info",
    EXPENSE: "warning"
  };
  return map[v] || "";
}

function approverTypeLabel(t: string) {
  const map: Record<string, string> = { ROLE: "角色", USER: "用户", DEPARTMENT: "部门" };
  return map[t] || t;
}

interface ChainLevel {
  level: number;
  approverType: string;
  approverValue: string;
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
  approvalChain: [] as ChainLevel[],
  slaHours: 24,
  escalationLevel: 1,
  status: 1
});

const columns = [
  { prop: "ruleName", label: "规则名称", minWidth: 140 },
  { prop: "businessType", label: "业务类型", width: 130, slot: "businessType" },
  { prop: "chainSummary", label: "审批链", minWidth: 220 },
  { prop: "slaHours", label: "SLA时效", width: 100, slot: "slaHours" },
  { prop: "status", label: "状态", width: 120, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 140, fixed: "right", slot: "actions" }
];

function parseChain(raw: any): ChainLevel[] {
  let chain = raw;
  if (typeof chain === "string") {
    try { chain = JSON.parse(chain); } catch { chain = []; }
  }
  if (!Array.isArray(chain)) return [];
  return chain.map((c: any) => ({
    level: Number(c.level ?? 0),
    approverType: c.approverType || "ROLE",
    approverValue: c.approverValue || ""
  }));
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchApprovalRules({ page: page.value, pageSize: pageSize.value });
    records.value = (data.records || data.list || []).map((r: any) => {
      const chain = parseChain(r.approvalChain);
      r.approvalChain = chain;
      r.chainSummary = chain.length
        ? chain.map((c: ChainLevel) => `${c.level}级:${approverTypeLabel(c.approverType)}-${c.approverValue}`).join(" → ")
        : "-";
      return r;
    });
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
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
    approvalChain: [{ level: 1, approverType: "ROLE", approverValue: "" }],
    slaHours: 24,
    escalationLevel: 1,
    status: 1
  };
  dialogVisible.value = true;
}

function showEditDialog(row: any) {
  isEdit.value = true;
  editId.value = row.id;
  const chain = parseChain(row.approvalChain);
  form.value = {
    ruleName: row.ruleName || "",
    businessType: row.businessType || "",
    approvalChain: chain.length ? chain : [{ level: 1, approverType: "ROLE", approverValue: "" }],
    slaHours: row.slaHours || 24,
    escalationLevel: row.escalationLevel || 1,
    status: Number(row.status ?? 1)
  };
  dialogVisible.value = true;
}

function addLevel() {
  form.value.approvalChain.push({
    level: form.value.approvalChain.length + 1,
    approverType: "ROLE",
    approverValue: ""
  });
}

function removeLevel(index: number) {
  if (form.value.approvalChain.length <= 1) {
    ElMessage.warning("至少保留一个审批级别");
    return;
  }
  form.value.approvalChain.splice(index, 1);
  form.value.approvalChain.forEach((item, i) => { item.level = i + 1; });
}

function moveLevel(index: number, direction: number) {
  const arr = form.value.approvalChain;
  const target = index + direction;
  if (target < 0 || target >= arr.length) return;
  const temp = arr[index];
  arr[index] = arr[target];
  arr[target] = temp;
  arr.forEach((item, i) => { item.level = i + 1; });
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (!form.value.businessType) { ElMessage.warning("请选择业务类型"); return; }
  const invalidLevel = form.value.approvalChain.find(l => !l.approverType || !l.approverValue);
  if (invalidLevel) { ElMessage.warning("请完整填写每一级审批人"); return; }
  submitLoading.value = true;
  try {
    const payload: Record<string, unknown> = {
      ruleName: form.value.ruleName,
      businessType: form.value.businessType,
      triggerCondition: {},
      approvalChain: form.value.approvalChain.map((level, index) => ({
        level: level.level || index + 1,
        approverType: level.approverType,
        approverValue: level.approverValue
      })),
      slaHours: form.value.slaHours,
      escalationLevel: form.value.escalationLevel
    };
    if (isEdit.value && editId.value) {
      payload.status = form.value.status;
      await updateApprovalRule(editId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createApprovalRule(payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    submitLoading.value = false;
  }
}

async function handleToggleStatus(row: any, val: boolean) {
  try {
    await updateApprovalRule(row.id, { status: val ? 1 : 0 });
    ElMessage.success(val ? "已启用" : "已禁用");
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "操作失败");
  }
}

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm(`确定删除规则 "${row.ruleName}" 吗？`, "确认删除", { type: "warning" }); } catch { return; }
  try {
    await deleteApprovalRule(row.id);
    ElMessage.success("已删除");
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "删除失败"); }
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
  color: var(--gray-400);
  min-width: 50px;
}
</style>
