<template>
  <div class="page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="审批规则" name="rules">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>审批规则</span>
              <div class="header-actions">
                <el-button type="primary" @click="handleAddRule">新增规则</el-button>
              </div>
            </div>
          </template>

          <el-table :data="rules" v-loading="rulesLoading" stripe>
            <el-table-column prop="name" label="规则名称" min-width="160" />
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column label="审批步骤" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.steps?.length || 0 }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="handleEditRule(row)">编辑</el-button>
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
              :total="rulesTotal"
              :page-size="rulesPageSize"
              :current-page="rulesPage"
              @size-change="handleRulesSizeChange"
              @current-change="handleRulesPageChange"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="待审批任务" name="tasks">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待审批任务</span>
            </div>
          </template>

          <el-table :data="tasks" v-loading="tasksLoading" stripe>
            <el-table-column prop="instanceTitle" label="审批标题" min-width="160" />
            <el-table-column prop="applicant" label="申请人" width="120" />
            <el-table-column label="提交时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">待审批</el-tag>
                <el-tag v-else-if="row.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
                <el-tag v-else-if="row.status === 'REJECTED'" type="danger" size="small">已拒绝</el-tag>
                <el-tag v-else size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === 'PENDING'">
                  <el-button size="small" type="success" @click="handleApprove(row)">通过</el-button>
                  <el-button size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
                </template>
                <span v-else>-</span>
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
              :total="tasksTotal"
              :page-size="tasksPageSize"
              :current-page="tasksPage"
              @size-change="handleTasksSizeChange"
              @current-change="handleTasksPageChange"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑规则弹窗 -->
    <el-dialog v-model="ruleDialogVisible" :title="editingRule ? '编辑规则' : '新增规则'" width="500px">
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleRules" label-width="100px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="ruleForm.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="ruleForm.description" type="textarea" :rows="3" placeholder="请输入规则描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="ruleSubmitLoading" @click="handleSaveRule">保存</el-button>
      </template>
    </el-dialog>

    <!-- 审批/拒绝弹窗 -->
    <el-dialog v-model="approvalDialogVisible" :title="approvalAction === 'approve' ? '通过审批' : '拒绝审批'" width="450px">
      <el-form :model="approvalForm" label-width="100px">
        <el-form-item label="审批意见">
          <el-input v-model="approvalForm.comment" type="textarea" :rows="3" placeholder="请输入审批意见（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button
          :type="approvalAction === 'approve' ? 'success' : 'danger'"
          :loading="approvalSubmitLoading"
          @click="handleConfirmApproval"
        >
          {{ approvalAction === 'approve' ? '通过' : '拒绝' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { fetchApprovalRules, createApprovalRule, updateApprovalRule, fetchApprovalTasks, approveTask, rejectTask } from "../api";
import { formatDate } from "../utils/format";

const activeTab = ref("rules");

const rules = ref<any[]>([]);
const rulesLoading = ref(false);
const rulesTotal = ref(0);
const rulesPage = ref(1);
const rulesPageSize = ref(20);

const tasks = ref<any[]>([]);
const tasksLoading = ref(false);
const tasksTotal = ref(0);
const tasksPage = ref(1);
const tasksPageSize = ref(20);

const ruleDialogVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const editingRule = ref<any>(null);
const ruleSubmitLoading = ref(false);

const ruleForm = reactive({
  name: "",
  description: ""
});

const ruleRules: FormRules = {
  name: [{ required: true, message: "请填写规则名称", trigger: "blur" }]
};

const approvalDialogVisible = ref(false);
const approvalAction = ref<"approve" | "reject">("approve");
const approvalTarget = ref<any>(null);
const approvalSubmitLoading = ref(false);
const approvalForm = reactive({
  comment: ""
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadRules() {
  rulesLoading.value = true;
  try {
    const data = await fetchApprovalRules({ page: rulesPage.value, pageSize: rulesPageSize.value });
    rules.value = data.records || [];
    rulesTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载审批规则失败"));
  } finally {
    rulesLoading.value = false;
  }
}

async function loadTasks() {
  tasksLoading.value = true;
  try {
    const data = await fetchApprovalTasks({ page: tasksPage.value, pageSize: tasksPageSize.value });
    tasks.value = data.records || [];
    tasksTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载审批任务失败"));
  } finally {
    tasksLoading.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "rules") {
    loadRules();
  } else if (tab === "tasks") {
    loadTasks();
  }
}

function handleRulesSizeChange(size: number) {
  rulesPageSize.value = size;
  rulesPage.value = 1;
  loadRules();
}

function handleRulesPageChange(p: number) {
  rulesPage.value = p;
  loadRules();
}

function handleTasksSizeChange(size: number) {
  tasksPageSize.value = size;
  tasksPage.value = 1;
  loadTasks();
}

function handleTasksPageChange(p: number) {
  tasksPage.value = p;
  loadTasks();
}

function handleAddRule() {
  editingRule.value = null;
  ruleForm.name = "";
  ruleForm.description = "";
  ruleDialogVisible.value = true;
}

function handleEditRule(row: any) {
  editingRule.value = row;
  ruleForm.name = row.name;
  ruleForm.description = row.description || "";
  ruleDialogVisible.value = true;
}

async function handleSaveRule() {
  if (!ruleFormRef.value) return;
  await ruleFormRef.value.validate(async (valid) => {
    if (!valid) return;
    ruleSubmitLoading.value = true;
    try {
      if (editingRule.value) {
        await updateApprovalRule(editingRule.value.id, {
          name: ruleForm.name,
          description: ruleForm.description
        });
        ElMessage.success("规则已更新");
      } else {
        await createApprovalRule({
          name: ruleForm.name,
          description: ruleForm.description,
          steps: []
        });
        ElMessage.success("规则已创建");
      }
      ruleDialogVisible.value = false;
      loadRules();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, editingRule.value ? "更新规则失败" : "创建规则失败"));
    } finally {
      ruleSubmitLoading.value = false;
    }
  });
}

function handleApprove(row: any) {
  approvalTarget.value = row;
  approvalAction.value = "approve";
  approvalForm.comment = "";
  approvalDialogVisible.value = true;
}

function handleReject(row: any) {
  approvalTarget.value = row;
  approvalAction.value = "reject";
  approvalForm.comment = "";
  approvalDialogVisible.value = true;
}

async function handleConfirmApproval() {
  if (!approvalTarget.value) return;
  approvalSubmitLoading.value = true;
  try {
    if (approvalAction.value === "approve") {
      await approveTask(approvalTarget.value.id, { comment: approvalForm.comment || undefined });
      ElMessage.success("审批通过");
    } else {
      await rejectTask(approvalTarget.value.id, { comment: approvalForm.comment || undefined });
      ElMessage.success("已拒绝");
    }
    approvalDialogVisible.value = false;
    loadTasks();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  } finally {
    approvalSubmitLoading.value = false;
  }
}

onMounted(() => {
  loadRules();
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