<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台公告管理</h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索公告标题"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="草稿" value="DRAFT" />
          <el-option label="已发布" value="PUBLISHED" />
          <el-option label="已过期" value="EXPIRED" />
        </el-select>
        <el-select
          v-model="searchForm.type"
          placeholder="类型"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="普通" value="NORMAL" />
          <el-option label="紧急" value="ALERT" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="showCreateDialog">新建公告</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'ALERT' ? 'danger' : 'info'" size="small">
              {{ row.type === 'ALERT' ? '紧急' : '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="180">
          <template #default="{ row }">{{ row.startTime || row.createdAt || '-' }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="180">
          <template #default="{ row }">{{ row.endTime || '-' }}</template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览量" width="100" align="center" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">查看</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑公告' : '新建公告'" width="640px" :close-on-click-modal="false">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入公告标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="NORMAL">普通</el-radio>
            <el-radio value="ALERT">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="DRAFT">草稿</el-radio>
            <el-radio value="PUBLISHED">发布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker
            v-model="form.endTime"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="请输入公告内容"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewVisible" title="公告详情" width="640px">
      <div v-if="currentView" style="padding: 10px 0;">
        <h3 style="margin-bottom: 16px;">{{ currentView.title }}</h3>
        <div style="color: #909399; font-size: 13px; margin-bottom: 20px;">
          <span>类型：{{ currentView.type === 'ALERT' ? '紧急' : '普通' }}</span>
          <span style="margin-left: 20px;">状态：{{ statusLabel(currentView.status) }}</span>
          <span style="margin-left: 20px;">浏览量：{{ currentView.viewCount || 0 }}</span>
        </div>
        <div style="line-height: 1.8; white-space: pre-wrap;">{{ currentView.content }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../api";

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchForm = reactive({
  keyword: "",
  status: "",
  type: ""
});

const dialogVisible = ref(false);
const viewVisible = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const currentView = ref<any>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  title: "",
  content: "",
  type: "NORMAL",
  status: "DRAFT",
  startTime: "",
  endTime: ""
});

const rules: FormRules = {
  title: [{ required: true, message: "请输入公告标题", trigger: "blur" }],
  content: [{ required: true, message: "请输入公告内容", trigger: "blur" }]
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "草稿",
    PUBLISHED: "已发布",
    EXPIRED: "已过期"
  };
  return map[status] || status || "-";
}

function statusTag(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "info",
    PUBLISHED: "success",
    EXPIRED: "warning"
  };
  return map[status] || "";
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getAnnouncements({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.type = "";
  page.value = 1;
  fetchList();
}

function showCreateDialog() {
  editingId.value = null;
  Object.assign(form, {
    title: "",
    content: "",
    type: "NORMAL",
    status: "DRAFT",
    startTime: "",
    endTime: ""
  });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  editingId.value = row.id;
  Object.assign(form, {
    title: row.title,
    content: row.content,
    type: row.type || "NORMAL",
    status: row.status || "DRAFT",
    startTime: row.startTime || "",
    endTime: row.endTime || ""
  });
  dialogVisible.value = true;
}

function handleView(row: any) {
  currentView.value = row;
  viewVisible.value = true;
}

async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await updateAnnouncement(editingId.value, { ...form });
      ElMessage.success("更新成功");
    } else {
      await createAnnouncement({ ...form });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除这条公告吗？", "确认删除", {
      type: "warning"
    });
  } catch {
    return;
  }
  try {
    await deleteAnnouncement(row.id);
    ElMessage.success("删除成功");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "删除失败");
  }
}

onMounted(() => {
  fetchList();
});
</script>
