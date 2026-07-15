<template>
  <div class="platform-announcements-page">
    <!-- 筛选区域 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="公告类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 140px">
            <el-option label="系统通知" value="SYSTEM" />
            <el-option label="活动公告" value="ACTIVITY" />
            <el-option label="更新公告" value="UPDATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option label="已发布" value="PUBLISHED" />
            <el-option label="草稿" value="DRAFT" />
            <el-option label="已撤回" value="REVOKED" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="请输入关键词搜索"
            clearable
            style="width: 240px"
            @keyup.enter="fetchData"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建公告
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 公告列表 -->
    <el-card class="table-card">
      <el-table :data="records" border v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="240">
          <template #default="{ row }">
            <div class="title-cell">
              <el-tag v-if="row.isPinned" type="danger" size="small" effect="dark" class="pin-tag">置顶</el-tag>
              <span class="title-text">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publishedAt" label="发布时间" width="180" />
        <el-table-column prop="viewCount" label="浏览量" width="100" align="center">
          <template #default="{ row }">{{ row.viewCount || 0 }}</template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建人" width="120" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleView(row)">查看</el-button>
            <el-button size="small" link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'PUBLISHED'"
              size="small"
              link
              type="warning"
              @click="handleRevoke(row)"
            >撤回</el-button>
            <el-button
              v-if="!row.isPinned && row.status === 'PUBLISHED'"
              size="small"
              link
              type="danger"
              @click="handlePin(row)"
            >置顶</el-button>
            <el-button
              v-if="row.isPinned"
              size="small"
              link
              type="info"
              @click="handleUnpin(row)"
            >取消置顶</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无公告" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建/编辑公告弹窗 -->
    <el-dialog
      :title="isEdit ? '编辑公告' : '新建公告'"
      v-model="dialogVisible"
      width="700px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入公告标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="公告类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择公告类型" style="width: 100%">
            <el-option label="系统通知" value="SYSTEM" />
            <el-option label="活动公告" value="ACTIVITY" />
            <el-option label="更新公告" value="UPDATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="公告内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="10"
            placeholder="请输入公告内容"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="是否置顶" prop="isPinned">
          <el-switch v-model="form.isPinned" active-text="是" inactive-text="否" />
          <span class="form-tip">置顶公告将显示在公告列表最顶部</span>
        </el-form-item>
        <el-form-item label="发布状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="DRAFT">存为草稿</el-radio>
            <el-radio value="PUBLISHED">立即发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 公告详情弹窗 -->
    <el-dialog title="公告详情" v-model="detailVisible" width="600px">
      <div v-if="detail" class="announcement-detail">
        <div class="detail-header">
          <h3 class="detail-title">
            <el-tag v-if="detail.isPinned" type="danger" size="small" effect="dark" style="margin-right: 8px">置顶</el-tag>
            {{ detail.title }}
          </h3>
          <div class="detail-meta">
            <el-tag :type="getTypeTagType(detail.type)" size="small" style="margin-right: 8px">
              {{ getTypeLabel(detail.type) }}
            </el-tag>
            <el-tag :type="getStatusType(detail.status)" size="small" style="margin-right: 8px">
              {{ getStatusLabel(detail.status) }}
            </el-tag>
            <span class="meta-item">发布人：{{ detail.createdBy || '-' }}</span>
            <span class="meta-item">浏览量：{{ detail.viewCount || 0 }}</span>
          </div>
        </div>
        <div class="detail-divider"></div>
        <div class="detail-content">
          <p style="white-space: pre-wrap; line-height: 1.8; margin: 0">{{ detail.content }}</p>
        </div>
        <div class="detail-footer">
          <span>发布时间：{{ detail.publishedAt || '-' }}</span>
          <span>创建时间：{{ detail.createdAt || '-' }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  fetchPlatformAnnouncements,
  createPlatformAnnouncement,
  updatePlatformAnnouncement,
  deletePlatformAnnouncement,
  revokePlatformAnnouncement,
  pinPlatformAnnouncement,
  unpinPlatformAnnouncement,
} from "@/api";

const records = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const detail = ref<any>(null);
const formRef = ref<FormInstance>();

const searchForm = reactive({
  type: "" as string,
  status: "" as string,
  keyword: "",
});

const form = reactive({
  title: "",
  type: "SYSTEM",
  content: "",
  isPinned: false,
  status: "PUBLISHED",
});

const formRules: FormRules = {
  title: [{ required: true, message: "请输入公告标题", trigger: "blur" }],
  type: [{ required: true, message: "请选择公告类型", trigger: "change" }],
  content: [{ required: true, message: "请输入公告内容", trigger: "blur" }],
  status: [{ required: true, message: "请选择发布状态", trigger: "change" }],
};

const typeMap: Record<string, { label: string; tagType: string }> = {
  SYSTEM: { label: "系统通知", tagType: "primary" },
  ACTIVITY: { label: "活动公告", tagType: "warning" },
  UPDATE: { label: "更新公告", tagType: "success" },
};

const statusMap: Record<string, { label: string; type: string }> = {
  PUBLISHED: { label: "已发布", type: "success" },
  DRAFT: { label: "草稿", type: "info" },
  REVOKED: { label: "已撤回", type: "danger" },
};

const getTypeLabel = (type: string) => typeMap[type]?.label || "未知";
const getTypeTagType = (type: string) => typeMap[type]?.tagType || "info";
const getStatusLabel = (status: string) => statusMap[status]?.label || "未知";
const getStatusType = (status: string) => statusMap[status]?.type || "info";

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await fetchPlatformAnnouncements({
      page: currentPage.value,
      pageSize: pageSize.value,
      type: searchForm.type || undefined,
      status: searchForm.status || undefined,
      keyword: searchForm.keyword || undefined,
    });
    const list = res.records || res.list || [];
    records.value = list;
    total.value = res.total || list.length;
  } catch {
    ElMessage.error("获取公告列表失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.type = "";
  searchForm.status = "";
  searchForm.keyword = "";
  currentPage.value = 1;
  fetchData();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const openCreateDialog = () => {
  isEdit.value = false;
  editId.value = null;
  resetForm();
  dialogVisible.value = true;
};

const openEditDialog = (row: any) => {
  isEdit.value = true;
  editId.value = row.id;
  form.title = row.title || "";
  form.type = row.type || "SYSTEM";
  form.content = row.content || "";
  form.isPinned = !!row.isPinned;
  form.status = row.status || "DRAFT";
  dialogVisible.value = true;
};

const handleView = (row: any) => {
  detail.value = row;
  detailVisible.value = true;
};

const resetForm = () => {
  form.title = "";
  form.type = "SYSTEM";
  form.content = "";
  form.isPinned = false;
  form.status = "PUBLISHED";
  formRef.value?.clearValidate();
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    if (isEdit.value && editId.value) {
      await updatePlatformAnnouncement(editId.value, { ...form });
      ElMessage.success("更新成功");
    } else {
      await createPlatformAnnouncement({ ...form });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    fetchData();
  } catch {
    ElMessage.error(isEdit.value ? "更新失败" : "创建失败");
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除公告「${row.title}」吗？`, "删除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
    await deletePlatformAnnouncement(row.id);
    ElMessage.success("删除成功");
    fetchData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const handleRevoke = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要撤回公告「${row.title}」吗？`, "撤回确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
    await revokePlatformAnnouncement(row.id);
    ElMessage.success("撤回成功");
    fetchData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error("撤回失败");
    }
  }
};

const handlePin = async (row: any) => {
  try {
    await pinPlatformAnnouncement(row.id);
    ElMessage.success("置顶成功");
    fetchData();
  } catch {
    ElMessage.error("置顶失败");
  }
};

const handleUnpin = async (row: any) => {
  try {
    await unpinPlatformAnnouncement(row.id);
    ElMessage.success("取消置顶成功");
    fetchData();
  } catch {
    ElMessage.error("取消置顶失败");
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.platform-announcements-page {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
  border-radius: 8px;
}
.table-card {
  border-radius: 8px;
}
.title-cell {
  display: flex;
  align-items: center;
}
.pin-tag {
  margin-right: 8px;
  flex-shrink: 0;
}
.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}
.announcement-detail {
  padding: 10px 0;
}
.detail-header {
  text-align: center;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #303133;
}
.detail-meta {
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
}
.meta-item {
  margin: 0 4px;
}
.detail-divider {
  height: 1px;
  background: #ebeef5;
  margin: 16px 0;
}
.detail-content {
  min-height: 200px;
  padding: 10px 0;
  color: #606266;
}
.detail-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #909399;
}
</style>
