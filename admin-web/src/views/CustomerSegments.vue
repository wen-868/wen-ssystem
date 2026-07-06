<template>
  <div class="page">
    <PageCard title="客户分群">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增分群</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input v-model="searchForm.keyword" placeholder="分群名称" clearable style="width: 220px" />
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="分群名称" min-width="140" />
        <el-table-column prop="conditions" label="条件摘要" min-width="200">
          <template #default="{ row }">
            <span class="condition-text">{{ formatConditions(row.conditions) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="memberCount" label="成员数" width="100" align="center" />
        <el-table-column prop="refreshType" label="更新方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.refreshType === 'AUTO' ? 'success' : ''">{{ row.refreshType === 'AUTO' ? '自动' : '手动' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openMembers(row)">查看成员</el-button>
            <el-button size="small" link type="success" @click="handleRefresh(row)">刷新</el-button>
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
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

    <!-- 分群表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑分群' : '新增分群'" width="520px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="分群名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分群名称" />
        </el-form-item>
        <el-form-item label="条件设置">
          <div class="condition-edit">
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="最低消费金额" label-width="100px">
                  <el-input-number v-model="form.minAmount" :min="0" :step="100" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="最高消费金额" label-width="100px">
                  <el-input-number v-model="form.maxAmount" :min="0" :step="100" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="最低订单数" label-width="100px">
                  <el-input-number v-model="form.minOrders" :min="0" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-form-item>
        <el-form-item label="更新方式">
          <el-select v-model="form.refreshType" style="width: 100%">
            <el-option label="手动" value="MANUAL" />
            <el-option label="自动" value="AUTO" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 查看成员弹窗 -->
    <el-dialog v-model="memberVisible" title="分群成员" width="800px">
      <el-table :data="memberList" v-loading="memberLoading" stripe>
        <el-table-column prop="name" label="客户名称" min-width="120" />
        <el-table-column prop="mobile" label="手机" width="140" />
        <el-table-column prop="levelName" label="等级" width="100" />
        <el-table-column prop="totalConsumeAmount" label="累计消费" width="140" align="right">
          <template #default="{ row }">¥{{ Number(row.totalConsumeAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="lastConsumeDate" label="最后消费" width="180">
          <template #default="{ row }">{{ formatDate(row.lastConsumeDate) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无成员" :image-size="60" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="memberTotal" :page-size="memberPageSize" :current-page="memberPage" @size-change="(s: number) => { memberPageSize = s; loadMembers(); }" @current-change="(p: number) => { memberPage = p; loadMembers(); }" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { fetchSegments, createSegment, updateSegment, deleteSegment, refreshSegment, fetchSegmentMembers } from "../api";

const list = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchForm = reactive({ keyword: "" });

const dialogVisible = ref(false);
const editing = ref(false);
const editingItem = ref<any>(null);
const formRef = ref();
const submitLoading = ref(false);
const form = reactive({ name: "", minAmount: 0, maxAmount: 0, minOrders: 0, refreshType: "MANUAL" });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入分群名称' }]
};

const memberVisible = ref(false);
const memberList = ref<any[]>([]);
const memberLoading = ref(false);
const memberTotal = ref(0);
const memberPage = ref(1);
const memberPageSize = ref(20);
const currentSegmentId = ref<number>(0);

function formatConditions(cond: any) {
  if (!cond) return "-";
  const parts: string[] = [];
  if (cond.minAmount != null) parts.push(`最低消费 ¥${cond.minAmount}`);
  if (cond.maxAmount != null) parts.push(`最高消费 ¥${cond.maxAmount}`);
  if (cond.minOrders != null) parts.push(`最低 ${cond.minOrders} 单`);
  return parts.length ? parts.join("，") : "-";
}

async function search() {
  loading.value = true;
  try {
    const res = await fetchSegments();
    list.value = res.records || res.list || [];
    total.value = res.total || 0;
  } catch { ElMessage.error("加载分群失败"); }
  finally { loading.value = false; }
}

async function loadData() { await search(); }

function openDialog(row?: any) {
  editingItem.value = row || null;
  editing.value = !!row;
  if (row) {
    form.name = row.name;
    form.minAmount = row.conditions?.minAmount || 0;
    form.maxAmount = row.conditions?.maxAmount || 0;
    form.minOrders = row.conditions?.minOrders || 0;
    form.refreshType = row.refreshType || "MANUAL";
  } else {
    form.name = ""; form.minAmount = 0; form.maxAmount = 0; form.minOrders = 0; form.refreshType = "MANUAL";
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  const conditions: Record<string, unknown> = {};
  if (form.minAmount) conditions.minAmount = form.minAmount;
  if (form.maxAmount) conditions.maxAmount = form.maxAmount;
  if (form.minOrders) conditions.minOrders = form.minOrders;
  try {
    if (editing.value) {
      await updateSegment(editingItem.value.id, { name: form.name, conditions, refreshType: form.refreshType });
      ElMessage.success("更新成功");
    } else {
      await createSegment({ name: form.name, conditions, refreshType: form.refreshType });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    await search();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function handleDelete(id: number) {
  try { await deleteSegment(id); ElMessage.success("删除成功"); await search(); }
  catch { ElMessage.error("删除失败"); }
}

async function handleRefresh(row: any) {
  try {
    await refreshSegment(row.id);
    ElMessage.success("刷新成功");
    await search();
  } catch { ElMessage.error("刷新失败"); }
}

function openMembers(row: any) {
  currentSegmentId.value = row.id;
  memberPage.value = 1;
  memberVisible.value = true;
  loadMembers();
}

async function loadMembers() {
  memberLoading.value = true;
  try {
    const res = await fetchSegmentMembers(currentSegmentId.value, { page: memberPage.value, pageSize: memberPageSize.value });
    memberList.value = res.records || res.list || [];
    memberTotal.value = res.total || 0;
  } catch { ElMessage.error("加载成员失败"); }
  finally { memberLoading.value = false; }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.condition-text { color: #606266; font-size: 13px; }
.condition-edit { width: 100%; }
</style>