<template>
  <PageCard title="岗位管理">
    <div class="position-header">
      <el-input
        v-model="keyword"
        placeholder="搜索岗位名称/描述"
        size="default"
        style="width: 260px; margin-right: 10px"
        clearable
        @clear="loadPositions"
        @keyup.enter="loadPositions"
      />
      <el-select v-model="departmentId" placeholder="选择部门" clearable style="width: 160px; margin-right: 10px">
        <el-option label="全部部门" :value="0" />
        <el-option v-for="dept in departmentOptions" :key="dept.id" :label="dept.name" :value="dept.id" />
      </el-select>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增岗位
      </el-button>
      <el-button @click="loadPositions">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <el-table :data="positionList" v-loading="loading" stripe empty-text="暂无岗位记录">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="岗位名称" min-width="140" />
      <el-table-column prop="departmentName" label="所属部门" width="140" />
      <el-table-column prop="level" label="级别" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.level === 'JUNIOR'" type="info">初级</el-tag>
          <el-tag v-else-if="row.level === 'MIDDLE'" type="primary">中级</el-tag>
          <el-tag v-else-if="row.level === 'SENIOR'" type="success">高级</el-tag>
          <el-tag v-else-if="row.level === 'MANAGER'" type="warning">管理</el-tag>
          <el-tag v-else>{{ row.level }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="salary" label="薪资范围" width="140">
        <template #default="{ row }">
          {{ row.salary || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
          <el-tag v-else type="danger">禁用</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" :type="row.status === 'ACTIVE' ? 'danger' : 'success'" link @click="handleToggleStatus(row)">
            {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @size-change="handleSizeChange"
        @current-page="handlePageChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑岗位' : '新增岗位'" width="480px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="岗位名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入岗位名称" />
        </el-form-item>
        <el-form-item label="所属部门" prop="departmentId">
          <el-select v-model="form.departmentId" style="width: 100%">
            <el-option label="请选择部门" :value="0" />
            <el-option v-for="dept in departmentOptions" :key="dept.id" :label="dept.name" :value="dept.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位级别" prop="level">
          <el-select v-model="form.level" style="width: 100%">
            <el-option label="初级" value="JUNIOR" />
            <el-option label="中级" value="MIDDLE" />
            <el-option label="高级" value="SENIOR" />
            <el-option label="管理" value="MANAGER" />
          </el-select>
        </el-form-item>
        <el-form-item label="薪资范围">
          <el-input v-model="form.salary" placeholder="例如：5000-8000" />
        </el-form-item>
        <el-form-item label="岗位描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入岗位描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="'ACTIVE'" :inactive-value="'INACTIVE'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import {
  fetchPositions,
  createPosition,
  updatePosition,
  togglePositionStatus,
  deletePosition,
  getDepartments
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const positionList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const departmentId = ref(0);
const departmentOptions = ref<any[]>([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  name: "",
  departmentId: 0,
  level: "MIDDLE" as "JUNIOR" | "MIDDLE" | "SENIOR" | "MANAGER",
  salary: "",
  description: "",
  status: "ACTIVE"
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  name: [{ required: true, message: "请输入岗位名称", trigger: "blur" }],
  departmentId: [{ required: true, message: "请选择所属部门", trigger: "change" }],
  level: [{ required: true, message: "请选择岗位级别", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadDepartments() {
  try {
    const data = await getDepartments({ page: 1, pageSize: 100 });
    departmentOptions.value = data.records || [];
  } catch (e) {
    // ignore
  }
}

async function loadPositions() {
  loading.value = true;
  try {
    const data = await fetchPositions({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      departmentId: departmentId.value || undefined
    });
    positionList.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载岗位失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadPositions();
}

function handlePageChange(p: number) {
  page.value = p;
  loadPositions();
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  form.id = row.id;
  form.name = row.name || "";
  form.departmentId = row.departmentId || 0;
  form.level = (row.level as "JUNIOR" | "MIDDLE" | "SENIOR" | "MANAGER") || "MIDDLE";
  form.salary = row.salary || "";
  form.description = row.description || "";
  form.status = row.status || "ACTIVE";
  dialogVisible.value = true;
}

async function handleToggleStatus(row: any) {
  try {
    await togglePositionStatus(row.id);
    ElMessage.success(row.status === "ACTIVE" ? "岗位已禁用" : "岗位已启用");
    loadPositions();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function handleDelete(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除岗位 ${row.name}？`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deletePosition(row.id);
    ElMessage.success("岗位已删除");
    loadPositions();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = {
        name: form.name,
        departmentId: form.departmentId,
        level: form.level,
        salary: form.salary || undefined,
        description: form.description || undefined,
        status: form.status
      };
      if (isEdit.value) {
        await updatePosition(form.id, payload);
        ElMessage.success("岗位已更新");
      } else {
        await createPosition(payload);
        ElMessage.success("岗位已创建");
      }
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadPositions();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新失败" : "创建失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadDepartments();
  loadPositions();
});
</script>

<style scoped>
.position-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>