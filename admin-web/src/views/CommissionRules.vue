<template>
  <div class="page">
    <PageCard title="提成规则">
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
        <template #ruleType="{ row }">
          <el-tag v-if="row.ruleType === 'FIXED'" type="warning">固定金额</el-tag>
          <el-tag v-else-if="row.ruleType === 'RATIO'" type="primary">按比例</el-tag>
          <el-tag v-else-if="row.ruleType === 'TIERED'" type="success">阶梯式</el-tag>
          <el-tag v-else>{{ row.ruleType }}</el-tag>
        </template>
        <template #config="{ row }">
          <template v-if="row.ruleType === 'FIXED'">¥{{ (row.config?.amount || 0) }}/单</template>
          <template v-else-if="row.ruleType === 'RATIO'">{{ row.config?.rate || 0 }}%</template>
          <template v-else-if="row.ruleType === 'TIERED'">
            <span v-for="(t, i) in (row.config?.tiers || [])" :key="i">
              <el-tag size="small" style="margin: 1px">{{ t.min }}-{{ t.max || '∞' }}: {{ t.rate }}%</el-tag>
            </span>
          </template>
        </template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'ACTIVE'" type="success">生效中</el-tag>
          <el-tag v-else type="info">已停用</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </DataTable>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑规则' : '新增规则'" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="规则名称">
          <el-input v-model="form.name" placeholder="如：基础提成规则" />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="form.ruleType" style="width: 100%" @change="onRuleTypeChange">
            <el-option label="固定金额" value="FIXED" />
            <el-option label="按比例" value="RATIO" />
            <el-option label="阶梯式" value="TIERED" />
          </el-select>
        </el-form-item>
        <!-- 固定金额 -->
        <el-form-item v-if="form.ruleType === 'FIXED'" label="每单金额">
          <el-input-number v-model="form.config.amount" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <!-- 按比例 -->
        <el-form-item v-if="form.ruleType === 'RATIO'" label="提成比例(%)">
          <el-input-number v-model="form.config.rate" :precision="1" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <!-- 阶梯式 -->
        <template v-if="form.ruleType === 'TIERED'">
          <el-form-item v-for="(tier, i) in form.config.tiers" :key="i" :label="`阶梯${i + 1}`">
            <el-input-number v-model="tier.min" :min="0" :precision="2" placeholder="最低" style="width: 120px" />
            <span style="margin: 0 6px">~</span>
            <el-input-number v-model="tier.max" :min="0" :precision="2" placeholder="最高(空=不限)" style="width: 120px" />
            <span style="margin: 0 6px">提成</span>
            <el-input-number v-model="tier.rate" :min="0" :max="100" :precision="1" placeholder="%" style="width: 80px" />
            <span style="margin: 0 4px">%</span>
            <el-button size="small" type="danger" link @click="removeTier(i)">删除</el-button>
          </el-form-item>
          <el-button size="small" @click="addTier">+ 添加阶梯</el-button>
        </template>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
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
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { fetchCommissionRules, createCommissionRule, updateCommissionRule, deleteCommissionRule } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const submitLoading = ref(false);
const form = ref({ name: "", ruleType: "RATIO", config: { rate: 5 } as any, dateRange: null as [string, string] | null, remark: "" });

const formRef = ref();
const rules: FormRules = {
  name: [{ required: true, message: "请输入规则名称", trigger: "blur" }],
  ruleType: [{ required: true, message: "请选择规则类型", trigger: "change" }]
};

const columns = [
  { prop: "name", label: "规则名称", minWidth: 150 },
  { prop: "ruleType", label: "类型", width: 100, slot: "ruleType" },
  { prop: "config", label: "配置", minWidth: 200, slot: "config" },
  { prop: "startDate", label: "开始日期", width: 110 },
  { prop: "endDate", label: "结束日期", width: 110 },
  { prop: "status", label: "状态", width: 80, slot: "status" },
  { label: "操作", width: 140, fixed: "right", slot: "actions" }
];

function onRuleTypeChange(type: string) {
  if (type === "FIXED") form.value.config = { amount: 0 };
  else if (type === "RATIO") form.value.config = { rate: 5 };
  else if (type === "TIERED") form.value.config = { tiers: [{ min: 0, max: 1000, rate: 3 }, { min: 1000, max: 0, rate: 5 }] };
}

function addTier() {
  if (!Array.isArray(form.value.config.tiers)) form.value.config.tiers = [];
  form.value.config.tiers.push({ min: 0, max: 0, rate: 0 });
}

function removeTier(i: number) {
  form.value.config.tiers.splice(i, 1);
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchCommissionRules({ page: page.value, pageSize: pageSize.value });
    records.value = (data.records || []).map((r: any) => {
      r.config = typeof r.config === "string" ? JSON.parse(r.config) : r.config;
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
  form.value = { name: "", ruleType: "RATIO", config: { rate: 5 }, dateRange: null, remark: "" };
  dialogVisible.value = true;
}

function showEditDialog(row: any) {
  isEdit.value = true;
  editId.value = row.id;
  form.value = {
    name: row.name,
    ruleType: row.ruleType,
    config: JSON.parse(JSON.stringify(row.config)),
    dateRange: row.startDate ? [row.startDate, row.endDate] : null,
    remark: row.remark || ""
  };
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    const payload = {
      name: form.value.name,
      ruleType: form.value.ruleType,
      config: form.value.config,
      startDate: form.value.dateRange?.[0] || undefined,
      endDate: form.value.dateRange?.[1] || undefined,
      remark: form.value.remark
    };
    if (isEdit.value && editId.value) {
      await updateCommissionRule(editId.value, payload);
      ElMessage.success("更新成功");
    } else {
      await createCommissionRule(payload);
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

async function handleDelete(row: any) {
  try { await ElMessageBox.confirm(`确定删除规则 "${row.name}" 吗？`, "确认删除", { type: "warning" }); } catch { return; }
  try {
    await deleteCommissionRule(row.id);
    ElMessage.success("已删除");
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "删除失败"); }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.page { padding: 0; }
</style>