<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>员工管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索用户名/姓名"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadStaff"
              @keyup.enter="loadStaff"
            />
            <el-button type="primary" @click="dialogVisible = true">新增员工</el-button>
            <el-button @click="loadStaff">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="staffList" v-loading="loading" stripe empty-text="暂无员工">
        <el-table-column prop="staffId" label="员工ID" width="100" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="realName" label="姓名" min-width="120" />
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.role === 'ADMIN'" type="danger">管理员</el-tag>
            <el-tag v-else-if="row.role === 'MANAGER'" type="warning">店长</el-tag>
            <el-tag v-else-if="row.role === 'STAFF'" type="primary">员工</el-tag>
            <el-tag v-else>{{ row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="storeName" label="所属门店" min-width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1 || row.status === 'ACTIVE'" type="success">在职</el-tag>
            <el-tag v-else type="info">离职</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link :type="row.status === 1 || row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 1 || row.status === 'ACTIVE' ? '禁用' : '启用' }}
            </el-button>
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
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑员工' : '新增员工'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="form.mobile" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="管理员" value="ADMIN" />
            <el-option label="店长" value="MANAGER" />
            <el-option label="员工" value="STAFF" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属门店">
          <el-select v-model="form.storeId" style="width: 100%" clearable>
            <el-option
              v-for="store in storeOptions"
              :key="store.id || store.storeId"
              :label="store.name"
              :value="store.id || store.storeId"
            />
          </el-select>
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
import { createStaff, fetchStaff, fetchStores, toggleStaffStatus, updateStaff } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const staffList = ref<any[]>([]);
const storeOptions = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const mobilePattern = /^1[3-9]\d{9}$/;

const defaultForm = {
  id: 0,
  username: "",
  realName: "",
  mobile: "",
  role: "STAFF",
  storeId: null as number | null
};

const form = reactive({ ...defaultForm });

const rules: FormRules = {
  username: [{ required: true, message: "请填写用户名", trigger: "blur" }],
  realName: [{ required: true, message: "请填写姓名", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "请填写正确的手机号", trigger: "blur" }
  ],
  role: [{ required: true, message: "请选择角色", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadStaff() {
  loading.value = true;
  try {
    const data = await fetchStaff();
    let list = data.records || [];
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.username && item.username.toLowerCase().includes(kw)) ||
        (item.realName && item.realName.toLowerCase().includes(kw))
      );
    }
    total.value = data.total || list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    staffList.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载员工列表失败"));
  } finally {
    loading.value = false;
  }
}

async function loadStoreOptions() {
  try {
    const data = await fetchStores();
    storeOptions.value = data.records || [];
  } catch (e) {
    // ignore
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadStaff();
}

function handlePageChange(p: number) {
  page.value = p;
  loadStaff();
}

function openEdit(row: any) {
  isEdit.value = true;
  form.id = row.staffId || row.id;
  form.username = row.username || "";
  form.realName = row.realName || "";
  form.mobile = row.mobile || "";
  form.role = row.role || "STAFF";
  form.storeId = row.storeId || null;
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value) {
        await updateStaff(form.id, {
          realName: form.realName,
          mobile: form.mobile,
          role: form.role,
          storeId: form.storeId || undefined
        });
        ElMessage.success("员工信息已更新");
      } else {
        await createStaff({
          username: form.username,
          realName: form.realName,
          mobile: form.mobile,
          role: form.role,
          storeId: form.storeId || undefined
        });
        ElMessage.success("员工已新增");
      }
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadStaff();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新员工失败" : "新增员工失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function toggleStatus(row: any) {
  const id = row.staffId || row.id;
  const currentStatus = row.status === 1 || row.status === 'ACTIVE' ? 1 : 0;
  const newStatus = currentStatus === 1 ? 0 : 1;
  const actionText = newStatus === 1 ? '启用' : '禁用';
  const confirmed = await ElMessageBox.confirm(`确认${actionText} ${row.realName || row.username}?`, `确认${actionText}`, { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await toggleStaffStatus(id, newStatus);
    ElMessage.success(`${actionText}成功`);
    loadStaff();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, `${actionText}失败`));
  }
}

onMounted(() => {
  loadStaff();
  loadStoreOptions();
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
