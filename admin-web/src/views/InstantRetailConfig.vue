<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售配置</span>
          <div class="header-actions">
            <el-button type="primary" @click="openCreateDialog">新增配置</el-button>
            <el-button @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="configName" label="配置名称" min-width="150" />
        <el-table-column prop="store" label="适用门店" min-width="150" />
        <el-table-column prop="deliveryRadius" label="配送半径(km)" width="120" />
        <el-table-column prop="deliveryFee" label="配送费" width="100">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.deliveryFee || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="minOrderAmount" label="起送金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.minOrderAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ENABLED'" type="success">已启用</el-tag>
            <el-tag v-else-if="row.status === 'DISABLED'" type="danger">已禁用</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'ENABLED'" size="small" link type="warning" @click="toggleStatus(row, 'DISABLED')">禁用</el-button>
            <el-button v-else size="small" link type="success" @click="toggleStatus(row, 'ENABLED')">启用</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无配置数据" />
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑配置' : '新增配置'" width="520px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="配置名称" prop="configName">
          <el-input v-model="form.configName" placeholder="请输入配置名称" />
        </el-form-item>
        <el-form-item label="适用门店" prop="store">
          <el-input v-model="form.store" placeholder="请输入适用门店" />
        </el-form-item>
        <el-form-item label="配送半径(km)" prop="deliveryRadius">
          <el-input-number v-model="form.deliveryRadius" :min="0.1" :max="100" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="配送费" prop="deliveryFee">
          <el-input-number v-model="form.deliveryFee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="起送金额" prop="minOrderAmount">
          <el-input-number v-model="form.minOrderAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="营业时间" prop="businessHours">
          <el-input v-model="form.businessHours" placeholder="如：09:00-22:00" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ENABLED" />
            <el-option label="禁用" value="DISABLED" />
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
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { createInstantRetailConfig, fetchInstantRetailConfigs, updateInstantRetailConfig } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref<number | null>(null);

const form = reactive({
  configName: "",
  store: "",
  deliveryRadius: 3,
  deliveryFee: 0,
  minOrderAmount: 0,
  businessHours: "",
  status: "ENABLED"
});

const formRules: FormRules = {
  configName: [{ required: true, message: "请填写配置名称", trigger: "blur" }],
  store: [{ required: true, message: "请填写适用门店", trigger: "blur" }],
  deliveryRadius: [{ required: true, message: "请填写配送半径", trigger: "blur" }],
  deliveryFee: [{ required: true, message: "请填写配送费", trigger: "blur" }],
  minOrderAmount: [{ required: true, message: "请填写起送金额", trigger: "blur" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchInstantRetailConfigs({ page: page.value, pageSize: pageSize.value });
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载配置列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

function openCreateDialog() {
  isEdit.value = false;
  editingId.value = null;
  form.configName = "";
  form.store = "";
  form.deliveryRadius = 3;
  form.deliveryFee = 0;
  form.minOrderAmount = 0;
  form.businessHours = "";
  form.status = "ENABLED";
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  isEdit.value = true;
  editingId.value = row.id;
  form.configName = row.configName || "";
  form.store = row.store || "";
  form.deliveryRadius = row.deliveryRadius || 3;
  form.deliveryFee = row.deliveryFee || 0;
  form.minOrderAmount = row.minOrderAmount || 0;
  form.businessHours = row.businessHours || "";
  form.status = row.status || "ENABLED";
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value && editingId.value) {
        await updateInstantRetailConfig(editingId.value, { ...form });
        ElMessage.success("配置已更新");
      } else {
        await createInstantRetailConfig({ ...form });
        ElMessage.success("配置已创建");
      }
      dialogVisible.value = false;
      loadData();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新配置失败" : "创建配置失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function toggleStatus(row: any, status: string) {
  try {
    await updateInstantRetailConfig(row.id, { ...row, status });
    ElMessage.success(status === "ENABLED" ? "已启用" : "已禁用");
    loadData();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "切换状态失败"));
  }
}

onMounted(() => {
  loadData();
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
.amount-text {
  font-weight: 500;
}
</style>