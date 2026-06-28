<template>
  <div class="page">
    <div style="margin-bottom: 16px">
      <el-button @click="router.back()" icon="ArrowLeft">返回</el-button>
    </div>

    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>租户详情</span>
          <div class="header-actions">
            <el-button type="success" v-if="tenant.status === 'ACTIVE'" @click="handleToggleStatus('INACTIVE')">停用</el-button>
            <el-button type="primary" v-else @click="handleToggleStatus('ACTIVE')">启用</el-button>
            <el-button type="primary" @click="openEditDialog">编辑</el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="租户名称">{{ tenant.name || "-" }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ tenant.contactName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ tenant.contactPhone || "-" }}</el-descriptions-item>
        <el-descriptions-item label="地址">{{ tenant.address || "-" }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="tenant.status === 'ACTIVE'" type="success">启用</el-tag>
          <el-tag v-else-if="tenant.status === 'INACTIVE'" type="info">停用</el-tag>
          <el-tag v-else-if="tenant.status === 'SUSPENDED'" type="danger">已停用</el-tag>
          <el-tag v-else>{{ tenant.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(tenant.createTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top: 16px" v-loading="modulesLoading">
      <template #header>
        <div class="card-header">
          <span>模块管理</span>
          <el-button type="primary" size="small" :loading="modulesSaving" @click="handleSaveModules">保存模块</el-button>
        </div>
      </template>

      <el-checkbox-group v-model="selectedModules" v-if="allModules.length > 0">
        <el-checkbox v-for="mod in allModules" :key="mod" :value="mod" :label="mod" style="margin-right: 24px; margin-bottom: 12px" />
      </el-checkbox-group>
      <el-empty v-else description="暂无可用模块" :image-size="80" />
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑租户" width="520px">
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
import { useRoute, useRouter } from "vue-router";
import { formatDate } from "../utils/format";
import { fetchTenantDetail, updateTenant, changeTenantStatus, fetchTenantModules, setTenantModules } from "../api";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const modulesLoading = ref(false);
const submitLoading = ref(false);
const modulesSaving = ref(false);
const tenant = ref<any>({});
const allModules = ref<string[]>([]);
const selectedModules = ref<string[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const tenantId = route.params.tenantId as string;

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

async function loadTenantDetail() {
  loading.value = true;
  try {
    const data = await fetchTenantDetail(tenantId);
    tenant.value = data;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载租户详情失败"));
  } finally {
    loading.value = false;
  }
}

async function loadModules() {
  modulesLoading.value = true;
  try {
    const data = await fetchTenantModules(tenantId);
    allModules.value = data.available || data.allModules || [];
    selectedModules.value = data.enabled || data.currentModules || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载模块信息失败"));
  } finally {
    modulesLoading.value = false;
  }
}

async function handleToggleStatus(newStatus: string) {
  const action = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确定要${action}该租户吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await changeTenantStatus(tenantId, { status: newStatus });
    ElMessage.success(`租户已${action}`);
    loadTenantDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${action}租户失败`));
    }
  }
}

function openEditDialog() {
  form.name = tenant.value.name || "";
  form.contactName = tenant.value.contactName || "";
  form.contactPhone = tenant.value.contactPhone || "";
  form.address = tenant.value.address || "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await updateTenant(tenantId, { ...form });
      ElMessage.success("租户已更新");
      dialogVisible.value = false;
      loadTenantDetail();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "更新租户失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleSaveModules() {
  modulesSaving.value = true;
  try {
    await setTenantModules(tenantId, { modules: selectedModules.value });
    ElMessage.success("模块配置已保存");
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "保存模块配置失败"));
  } finally {
    modulesSaving.value = false;
  }
}

onMounted(() => {
  loadTenantDetail();
  loadModules();
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
  gap: 8px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>