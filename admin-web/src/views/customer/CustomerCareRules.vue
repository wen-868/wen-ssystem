<template>
  <div class="page">
    <PageCard title="客户关怀规则">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增规则</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input v-model="searchForm.keyword" placeholder="规则名称" clearable style="width: 180px" />
        <el-select v-model="searchForm.triggerType" placeholder="触发类型" clearable style="width: 150px; margin-left: 12px">
          <el-option v-for="t in triggerTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>

      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column prop="name" label="规则名称" min-width="140" />
        <el-table-column prop="triggerType" label="触发类型" width="120" align="center">
          <template #default="{ row }">{{ triggerTypeLabel(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column prop="rewardPoints" label="奖励积分" width="100" align="center" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastExecutedAt" label="上次执行" width="180">
          <template #default="{ row }">{{ formatDate(row.lastExecutedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="success" @click="handleExecute(row)">执行</el-button>
            <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; search(); }" @current-change="(p: number) => { page = p; search(); }" />
      </div>
    </PageCard>

    <!-- 关怀记录 -->
    <PageCard title="关怀记录">
      <el-table :data="logs" v-loading="logLoading" stripe>
        <el-table-column prop="ruleName" label="规则名称" min-width="120" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="triggerType" label="触发类型" width="100" align="center">
          <template #default="{ row }">{{ triggerTypeLabel(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SUCCESS' ? 'success' : row.status === 'FAILED' ? 'danger' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无记录" :image-size="60" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="logTotal" :page-size="logPageSize" :current-page="logPage" @size-change="(s: number) => { logPageSize = s; loadLogs(); }" @current-change="(p: number) => { logPage = p; loadLogs(); }" />
      </div>
    </PageCard>

    <!-- 规则表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑规则' : '新增规则'" width="540px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="触发类型" prop="triggerType">
          <el-select v-model="form.triggerType" style="width: 100%">
            <el-option v-for="t in triggerTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容模板">
          <el-input v-model="form.contentTemplate" type="textarea" :rows="4" placeholder="如：尊敬的{name}，祝您生日快乐！" />
        </el-form-item>
        <el-form-item label="奖励积分" prop="rewardPoints">
          <el-input-number v-model="form.rewardPoints" :min="0" :max="99999" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import { fetchCareRules, createCareRule, updateCareRule, deleteCareRule, executeCareRule, fetchCareLogs } from "../../api";

const triggerTypes = [
  { value: "BIRTHDAY", label: "生日" },
  { value: "FESTIVAL", label: "节日" },
  { value: "DORMANT", label: "沉睡唤醒" },
  { value: "LEVEL_UP", label: "等级升级" }
];
function triggerTypeLabel(v: string) { return triggerTypes.find(t => t.value === v)?.label || v; }

const rules = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchForm = reactive({ keyword: "", triggerType: "" });

const dialogVisible = ref(false);
const editing = ref(false);
const editingItem = ref<any>(null);
const formRef = ref();
const submitLoading = ref(false);
const form = reactive({ name: "", triggerType: "", contentTemplate: "", rewardPoints: 0 });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入规则名称' }],
  triggerType: [{ required: true, message: '请选择触发类型' }],
  rewardPoints: [{ required: true, message: '请输入奖励积分' }]
};

const logs = ref<any[]>([]);
const logLoading = ref(false);
const logTotal = ref(0);
const logPage = ref(1);
const logPageSize = ref(20);

async function search() {
  loading.value = true;
  try {
    const res = await fetchCareRules();
    rules.value = res.records || res.list || [];
    total.value = res.total || 0;
  } catch { ElMessage.error("加载规则失败"); }
  finally { loading.value = false; }
}

async function loadLogs() {
  logLoading.value = true;
  try {
    const res = await fetchCareLogs({ page: logPage.value, pageSize: logPageSize.value });
    logs.value = res.records || res.list || [];
    logTotal.value = res.total || 0;
  } catch { ElMessage.error("加载关怀记录失败"); }
  finally { logLoading.value = false; }
}

async function loadData() { await search(); await loadLogs(); }

function openDialog(row?: any) {
  editingItem.value = row || null;
  editing.value = !!row;
  if (row) {
    form.name = row.name; form.triggerType = row.triggerType;
    form.contentTemplate = row.contentTemplate || ""; form.rewardPoints = row.rewardPoints || 0;
  } else {
    form.name = ""; form.triggerType = ""; form.contentTemplate = ""; form.rewardPoints = 0;
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (editing.value) {
      await updateCareRule(editingItem.value.id, { name: form.name, triggerType: form.triggerType, contentTemplate: form.contentTemplate, rewardPoints: form.rewardPoints });
      ElMessage.success("更新成功");
    } else {
      await createCareRule({ name: form.name, triggerType: form.triggerType, contentTemplate: form.contentTemplate, rewardPoints: form.rewardPoints });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    await search();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function handleDelete(id: number) {
  try { await deleteCareRule(id); ElMessage.success("删除成功"); await search(); }
  catch { ElMessage.error("删除失败"); }
}

async function handleExecute(row: any) {
  try {
    const res = await executeCareRule(row.id);
    ElMessage.success(`执行成功，触发了 ${res.count || 0} 条关怀`);
    await loadLogs();
  } catch { ElMessage.error("执行失败"); }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>