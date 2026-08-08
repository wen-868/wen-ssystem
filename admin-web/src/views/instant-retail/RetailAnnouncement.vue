<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">小程序公告管理</h2>
    <p class="page-desc">小程序公告发布与维护</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="openDialog()">新增公告</el-button>
    <el-button @click="loadData">刷新</el-button>
  </div>
</div>

      

      <div class="filter-bar">
        <el-input v-model="searchForm.keyword" placeholder="公告标题" clearable style="width: 200px" />
        <el-button type="primary" style="margin-left: 12px" @click="searchAnnouncements">搜索</el-button>
      </div>

      <div class="table-card">
<el-table :data="announcements" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="storeName" label="门店" min-width="120" />
        <el-table-column prop="isTop" label="是否置顶" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isTop ? 'danger' : 'info'" size="small">{{ row.isTop ? '置顶' : '普通' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="展示时间" min-width="240">
          <template #default="{ row }">
            <span>{{ formatDate(row.startTime) }} ~ {{ formatDate(row.endTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" size="small">{{ row.status === 'ENABLED' ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link :type="row.status === 'ENABLED' ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'ENABLED' ? '禁用' : '启用' }}
            </el-button>
            <el-popconfirm title="确定删除？" @confirm="deleteItem(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
      </el-table>

      <div class="table-card-footer">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; searchAnnouncements(); }" @current-change="(p: number) => { page = p; searchAnnouncements(); }" />
      </div>
</div>
    

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑公告' : '新增公告'" width="720px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="所属门店" prop="storeId">
          <el-select v-model="form.storeId" placeholder="请选择门店" style="width: 100%" filterable>
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入公告标题" />
        </el-form-item>
        <el-form-item label="公告内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入公告内容" />
        </el-form-item>
        <el-form-item label="是否置顶">
          <el-switch v-model="form.isTop" active-text="置顶" inactive-text="普通" />
        </el-form-item>
        <el-form-item label="展示时间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
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
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { formatDate } from "../../utils/format";
import {
  fetchRetailAnnouncements,
  createRetailAnnouncement,
  updateRetailAnnouncement,
  deleteRetailAnnouncement,
  fetchStores
} from "../../api";

const announcements = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const dialogVisible = ref(false);
const editing = ref(false);
const formRef = ref();
const submitLoading = ref(false);
const editingItem = ref<any>(null);
const storeList = ref<any[]>([]);

const searchForm = reactive({ keyword: "" });
const form = reactive({
  storeId: null as number | null,
  title: "",
  content: "",
  isTop: false,
  dateRange: [] as string[]
});

const formRules: FormRules = {
  storeId: [{ required: true, message: '请选择门店' }],
  title: [{ required: true, message: '请输入公告标题' }],
  content: [{ required: true, message: '请输入公告内容' }],
  dateRange: [{ required: true, message: '请选择展示时间' }]
};

async function loadStores() {
  try {
    const res = await fetchStores();
    storeList.value = Array.isArray(res) ? res : (res?.records || res?.list || []);
  } catch { /* ignore */ }
}

async function searchAnnouncements() {
  loading.value = true;
  try {
    const res = await fetchRetailAnnouncements({
      keyword: searchForm.keyword || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    announcements.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error("加载公告列表失败");
  } finally {
    loading.value = false;
  }
}

function loadData() {
  searchAnnouncements();
}

function openDialog(row?: any) {
  editingItem.value = row || null;
  editing.value = !!row;
  if (row) {
    form.storeId = row.storeId;
    form.title = row.title;
    form.content = row.content;
    form.isTop = !!row.isTop;
    form.dateRange = [row.startTime, row.endTime];
  } else {
    form.storeId = null;
    form.title = "";
    form.content = "";
    form.isTop = false;
    form.dateRange = [];
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    const payload = {
      storeId: form.storeId!,
      title: form.title,
      content: form.content,
      isTop: form.isTop,
      startTime: form.dateRange[0],
      endTime: form.dateRange[1]
    };
    if (editingItem.value) {
      await updateRetailAnnouncement(editingItem.value.id, payload);
      ElMessage.success("公告已更新");
    } else {
      await createRetailAnnouncement(payload);
      ElMessage.success("公告已创建");
    }
    dialogVisible.value = false;
    await searchAnnouncements();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    submitLoading.value = false;
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === "ENABLED" ? "DISABLED" : "ENABLED";
  const actionText = newStatus === "ENABLED" ? "启用" : "禁用";
  try {
    await ElMessageBox.confirm(`确定要${actionText}该公告吗？`, "操作确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await updateRetailAnnouncement(row.id, { status: newStatus });
    ElMessage.success(`公告已${actionText}`);
    await searchAnnouncements();
  } catch {
    /* user cancelled or error */
  }
}

async function deleteItem(id: number) {
  try {
    await deleteRetailAnnouncement(id);
    ElMessage.success("公告已删除");
    await searchAnnouncements();
  } catch {
    ElMessage.error("删除失败");
  }
}

onMounted(() => {
  loadStores();
  searchAnnouncements();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>