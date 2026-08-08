<template>
  <div class="page-header">

    <div class="page-header-main">

      <h2 class="page-title">积分管理</h2>

      <p class="page-desc">积分规则与明细</p>

    </div>

  </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="积分规则" name="rules">
        <div class="filter-bar">
          <el-button type="primary" @click="handleAddRule">新建规则</el-button>
        </div>
        <div class="table-card">
<el-table :data="rules" v-loading="rulesLoading" stripe empty-text="暂无规则">
          <el-table-column prop="name" label="规则名称" min-width="140" />
          <el-table-column prop="earnType" label="获取方式" width="120">
            <template #default="{ row }">
              <el-tag>{{ earnTypeLabel(row.earnType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="earnRatio" label="积分比例" width="100" />
          <el-table-column prop="dailyLimit" label="每日上限" width="100">
            <template #default="{ row }">{{ row.dailyLimit === 0 ? '不限制' : row.dailyLimit }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="handleEditRule(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
</div>
      </el-tab-pane>

      <el-tab-pane label="积分记录" name="records">
        <div class="filter-bar">
          <el-input v-model="recordSearch.customerId" placeholder="客户ID" clearable style="width: 200px" />
          <el-button @click="loadRecords">搜索</el-button>
          <el-button type="primary" @click="adjustDialogVisible = true">手动调整</el-button>
        </div>
        <div class="table-card">
<el-table :data="records" v-loading="recordsLoading" stripe empty-text="暂无记录">
          <el-table-column prop="customerName" label="客户名称" min-width="120" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.type === 'earn' ? 'success' : row.type === 'consume' ? 'danger' : 'warning'">
                {{ row.type === 'earn' ? '获取' : row.type === 'consume' ? '消费' : '调整' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="points" label="变动积分" width="100">
            <template #default="{ row }">{{ row.points > 0 ? '+' + row.points : row.points }}</template>
          </el-table-column>
          <el-table-column prop="balance" label="余额" width="100" />
          <el-table-column prop="source" label="来源" min-width="120" />
          <el-table-column prop="remark" label="备注" min-width="140" />
          <el-table-column prop="createdAt" label="时间" width="170">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <div class="table-card-footer">
          <el-pagination
            background layout="total, sizes, prev, pager, next, jumper"
            :total="recordsTotal" :page-size="recordsPageSize" :current-page="recordsPage"
            @size-change="handleRecordsSizeChange" @current-change="handleRecordsPageChange"
          />
        </div>
</div>
      </el-tab-pane>
    </el-tabs>

    <!-- 规则弹窗 -->
    <el-dialog v-model="ruleDialogVisible" :title="editingRule ? '编辑规则' : '新建规则'" width="480px">
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleRules" label-width="100px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item label="获取方式" prop="earnType">
          <el-select v-model="ruleForm.earnType" style="width: 100%">
            <el-option label="消费" value="purchase" />
            <el-option label="签到" value="signin" />
            <el-option label="生日" value="birthday" />
            <el-option label="推荐" value="referral" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分比例" prop="earnRatio">
          <el-input-number v-model="ruleForm.earnRatio" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每日上限">
          <el-input-number v-model="ruleForm.dailyLimit" :min="0" style="width: 100%" />
          <span style="font-size: 12px; color: #999; margin-left: 8px">0=不限制</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="ruleSubmitLoading" @click="handleRuleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 调整积分弹窗 -->
    <el-dialog v-model="adjustDialogVisible" title="手动调整积分" width="480px">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="100px">
        <el-form-item label="客户ID" prop="customerId">
          <el-input v-model="adjustForm.customerId" />
        </el-form-item>
        <el-form-item label="积分数量" prop="points">
          <el-input-number v-model="adjustForm.points" style="width: 100%" />
          <span style="font-size: 12px; color: #999; margin-left: 8px">正数=增加 / 负数=扣减</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="adjustForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitLoading" @click="handleAdjustSubmit">保存</el-button>
      </template>
    </el-dialog>
  
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { formatDate } from "../../utils/format";
import {
  fetchPointsRules, createPointsRule, updatePointsRule, deletePointsRule,
  fetchPointsRecords, adjustCustomerPoints
} from "../../api";

const activeTab = ref("rules");

// ── 积分规则 ──
const rules = ref<any[]>([]);
const rulesLoading = ref(false);
const ruleDialogVisible = ref(false);
const ruleSubmitLoading = ref(false);
const ruleFormRef = ref<FormInstance>();
const editingRule = ref<any>(null);

const ruleForm = reactive({
  name: "",
  earnType: "purchase",
  earnRatio: 1,
  dailyLimit: 0
});

const ruleRules: FormRules = {
  name: [{ required: true, message: "请输入规则名称", trigger: "blur" }],
  earnType: [{ required: true, message: "请选择获取方式", trigger: "change" }],
  earnRatio: [{ required: true, message: "请输入积分比例", trigger: "blur" }]
};

function earnTypeLabel(type: string) {
  const map: Record<string, string> = { purchase: "消费", signin: "签到", birthday: "生日", referral: "推荐" };
  return map[type] || type;
}

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.msg || e?.message || fallback;
}

async function loadRules() {
  rulesLoading.value = true;
  try {
    const data = await fetchPointsRules();
    rules.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载积分规则失败"));
  } finally {
    rulesLoading.value = false;
  }
}

function handleAddRule() {
  editingRule.value = null;
  ruleForm.name = "";
  ruleForm.earnType = "purchase";
  ruleForm.earnRatio = 1;
  ruleForm.dailyLimit = 0;
  ruleDialogVisible.value = true;
}

function handleEditRule(row: any) {
  editingRule.value = row;
  ruleForm.name = row.name;
  ruleForm.earnType = row.earnType;
  ruleForm.earnRatio = row.earnRatio;
  ruleForm.dailyLimit = row.dailyLimit;
  ruleDialogVisible.value = true;
}

async function handleRuleSubmit() {
  if (!ruleFormRef.value) return;
  await ruleFormRef.value.validate(async (valid) => {
    if (!valid) return;
    ruleSubmitLoading.value = true;
    try {
      if (editingRule.value) {
        await updatePointsRule(editingRule.value.id, ruleForm);
        ElMessage.success("规则已更新");
      } else {
        await createPointsRule(ruleForm);
        ElMessage.success("规则已创建");
      }
      ruleDialogVisible.value = false;
      loadRules();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "操作失败"));
    } finally {
      ruleSubmitLoading.value = false;
    }
  });
}

async function handleDeleteRule(row: any) {
  try {
    await deletePointsRule(row.id);
    ElMessage.success("规则已删除");
    loadRules();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ── 积分记录 ──
const records = ref<any[]>([]);
const recordsLoading = ref(false);
const recordsTotal = ref(0);
const recordsPage = ref(1);
const recordsPageSize = ref(20);
const recordSearch = reactive({ customerId: "" });

const adjustDialogVisible = ref(false);
const adjustSubmitLoading = ref(false);
const adjustFormRef = ref<FormInstance>();
const adjustForm = reactive({
  customerId: "",
  points: 0,
  remark: ""
});

const adjustRules: FormRules = {
  customerId: [{ required: true, message: "请输入客户ID", trigger: "blur" }],
  points: [{ required: true, message: "请输入积分数量", trigger: "blur" }]
};

async function loadRecords() {
  recordsLoading.value = true;
  try {
    const data = await fetchPointsRecords({
      customerId: Number(recordSearch.customerId) || undefined,
      page: recordsPage.value,
      pageSize: recordsPageSize.value
    });
    records.value = data.records || [];
    recordsTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载积分记录失败"));
  } finally {
    recordsLoading.value = false;
  }
}

function handleRecordsSizeChange(size: number) {
  recordsPageSize.value = size;
  recordsPage.value = 1;
  loadRecords();
}

function handleRecordsPageChange(p: number) {
  recordsPage.value = p;
  loadRecords();
}

async function handleAdjustSubmit() {
  if (!adjustFormRef.value) return;
  await adjustFormRef.value.validate(async (valid) => {
    if (!valid) return;
    adjustSubmitLoading.value = true;
    try {
      await adjustCustomerPoints(Number(adjustForm.customerId), { points: adjustForm.points, remark: adjustForm.remark });
      ElMessage.success("积分调整成功");
      adjustDialogVisible.value = false;
      adjustForm.customerId = "";
      adjustForm.points = 0;
      adjustForm.remark = "";
      loadRecords();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "调整失败"));
    } finally {
      adjustSubmitLoading.value = false;
    }
  });
}

function handleTabChange(name: string) {
  if (name === "records") loadRecords();
}

onMounted(() => {
  loadRules();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>