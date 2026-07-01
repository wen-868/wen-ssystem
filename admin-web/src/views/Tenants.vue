<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>租户管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="租户名称"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadTenants"
              @keyup.enter="loadTenants"
            />
            <el-select
              v-model="statusFilter"
              placeholder="状态"
              size="default"
              style="width: 140px; margin-right: 10px"
              clearable
              @change="loadTenants"
            >
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="INACTIVE" />
              <el-option label="已停用" value="SUSPENDED" />
            </el-select>
            <el-button @click="loadTenants">搜索</el-button>
            <el-button type="primary" @click="openCreateDialog">新增租户</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tenants" v-loading="loading" stripe>
        <el-table-column prop="tenantId" label="租户ID" width="120" />
        <el-table-column prop="name" label="租户名称" min-width="140" />
        <el-table-column prop="contactName" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
            <el-tag v-else-if="row.status === 'INACTIVE'" type="info">停用</el-tag>
            <el-tag v-else-if="row.status === 'SUSPENDED'" type="danger">已停用</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleViewDetail(row)">详情</el-button>
            <el-button size="small" link type="success" @click="handleToggleStatus(row)" v-if="row.status === 'ACTIVE'">停用</el-button>
            <el-button size="small" link type="warning" @click="handleToggleStatus(row)" v-else>启用</el-button>
            <el-button size="small" link @click="openEditDialog(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑租户' : '新增租户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="租户名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入租户名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactName">
          <el-input v-model="form.contactName" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入地址" />
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
import { useRouter } from "vue-router";
import { formatDate } from "../utils/format";
import { fetchTenants, createTenant, updateTenant, changeTenantStatus } from "../api";

const router = useRouter();
const loading = ref(false);
const submitLoading = ref(false);
const tenants = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const editingTenantId = ref("");

const form = reactive({
  name: "",
  contactName: "",
  contactPhone: "",
  address: ""
});

const rules: FormRules = {
  name: [{ required: true, message: "请填写租户名称", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadTenants() {
  loading.value = true;
  try {
    const data = (await fetchTenants({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined
    })).data;
    const list = data.records || data.list || [];
    total.value = data.total || list.length;
    tenants.value = list;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载租户列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadTenants();
}

function handlePageChange(p: number) {
  page.value = p;
  loadTenants();
}

function handleViewDetail(row: any) {
  router.push(`/tenants/${row.tenantId}`);
}

function openCreateDialog() {
  isEdit.value = false;
  editingTenantId.value = "";
  form.name = "";
  form.contactName = "";
  form.contactPhone = "";
  form.address = "";
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  isEdit.value = true;
  editingTenantId.value = row.tenantId;
  form.name = row.name || "";
  form.contactName = row.contactName || "";
  form.contactPhone = row.contactPhone || "";
  form.address = row.address || "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value) {
        await updateTenant(Number(editingTenantId.value), { ...form });
        ElMessage.success("租户已更新");
      } else {
        await createTenant({ ...form });
        ElMessage.success("租户已创建");
      }
      dialogVisible.value = false;
      loadTenants();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新租户失败" : "创建租户失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const action = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确定要${action}该租户吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await changeTenantStatus(row.tenantId, newStatus);
    ElMessage.success(`租户已${action}`);
    loadTenants();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${action}租户失败`));
    }
  }
}

onMounted(() => {
  loadTenants();
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