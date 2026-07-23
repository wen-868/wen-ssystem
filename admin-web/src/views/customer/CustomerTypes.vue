<template>
  <div class="page">
    <el-card shadow="never">
      <div class="header">
        <div class="title">客户类型管理</div>
        <div class="actions">
          <el-input
            v-model="keyword"
            placeholder="搜索类型名称/编码"
            clearable
            style="width: 220px"
            @keyup.enter="loadList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="openCreate">
            <el-icon><Plus /></el-icon> 新增类型
          </el-button>
        </div>
      </div>

      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column type="index" label="序号" width="70" />
        <el-table-column prop="name" label="类型名称" min-width="140" />
        <el-table-column prop="code" label="编码" min-width="140" />
        <el-table-column prop="sortNo" label="排序" width="90" sortable />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ENABLED' || row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 'ENABLED' || row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              size="small"
              link
              :type="row.status === 'ENABLED' || row.status === 1 ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ENABLED' || row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
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
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑客户类型' : '新增客户类型'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="类型名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入类型名称" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码，如：RETAIL" />
        </el-form-item>
        <el-form-item label="排序" prop="sortNo">
          <el-input-number v-model="form.sortNo" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="ENABLED">启用</el-radio>
            <el-radio value="DISABLED">禁用</el-radio>
          </el-radio-group>
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
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus } from "@element-plus/icons-vue";
import {
  fetchCustomerTypes,
  createCustomerType,
  updateCustomerType,
  deleteCustomerType
} from "../../api/customer";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  name: "",
  code: "",
  sortNo: 0,
  status: "ENABLED"
};

const form = reactive({ ...defaultForm });

const rules: FormRules = {
  name: [{ required: true, message: "请输入类型名称", trigger: "blur" }],
  code: [{ required: true, message: "请输入编码", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchCustomerTypes({ page: page.value, pageSize: pageSize.value });
    let list = data.records || data || [];
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.name && item.name.toLowerCase().includes(kw)) ||
        (item.code && item.code.toLowerCase().includes(kw))
      );
    }
    total.value = data.total || list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    tableData.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户类型失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}

function handlePageChange(p: number) {
  page.value = p;
  loadList();
}

function openCreate() {
  isEdit.value = false;
  Object.assign(form, defaultForm);
  dialogVisible.value = true;
}

function openEdit(row: any) {
  isEdit.value = true;
  form.id = row.id;
  form.name = row.name || "";
  form.code = row.code || "";
  form.sortNo = row.sortNo ?? 0;
  form.status = row.status === 1 ? "ENABLED" : row.status === 0 ? "DISABLED" : (row.status || "ENABLED");
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value) {
        await updateCustomerType(form.id, {
          name: form.name,
          code: form.code,
          sortNo: form.sortNo,
          status: form.status
        });
        ElMessage.success("更新成功");
      } else {
        await createCustomerType({
          name: form.name,
          code: form.code,
          sortNo: form.sortNo,
          status: form.status
        });
        ElMessage.success("新增成功");
      }
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadList();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新失败" : "新增失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function toggleStatus(row: any) {
  const currentStatus = row.status === 'ENABLED' || row.status === 1 ? 'ENABLED' : 'DISABLED';
  const newStatus = currentStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED';
  const actionText = newStatus === 'ENABLED' ? '启用' : '禁用';
  const confirmed = await ElMessageBox.confirm(`确认${actionText}「${row.name}」?`, `确认${actionText}`, { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await updateCustomerType(row.id, { status: newStatus });
    ElMessage.success(`${actionText}成功`);
    loadList();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, `${actionText}失败`));
  }
}

async function handleDelete(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除「${row.name}」?删除后不可恢复。`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteCustomerType(row.id);
    ElMessage.success("删除成功");
    loadList();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.page { padding: 0; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { font-size: 16px; font-weight: 600; color: #303133; }
.actions { display: flex; gap: 12px; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
