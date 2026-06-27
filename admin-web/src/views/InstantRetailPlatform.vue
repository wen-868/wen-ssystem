<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>平台设置</span>
          <el-button type="primary" :loading="saveLoading" @click="handleSave">保存设置</el-button>
        </div>
      </template>

      <el-form ref="platformFormRef" :model="platformForm" :rules="platformRules" label-width="130px" style="max-width: 600px">
        <el-form-item label="平台名称" prop="platformName">
          <el-input v-model="platformForm.platformName" placeholder="请输入平台名称" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="platformForm.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="服务时间" prop="serviceHours">
          <el-input v-model="platformForm.serviceHours" placeholder="如：09:00-22:00" />
        </el-form-item>
        <el-form-item label="配送范围(km)" prop="deliveryRange">
          <el-input-number v-model="platformForm.deliveryRange" :min="0.1" :max="100" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="默认配送费" prop="defaultDeliveryFee">
          <el-input-number v-model="platformForm.defaultDeliveryFee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>参与门店管理</span>
          <el-button type="primary" @click="openAddStoreDialog">添加门店</el-button>
        </div>
      </template>

      <el-table :data="storeList" v-loading="storeLoading" stripe>
        <el-table-column prop="storeCode" label="门店编码" width="140" />
        <el-table-column prop="storeName" label="门店名称" min-width="160" />
        <el-table-column prop="address" label="门店地址" min-width="200" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="danger" @click="handleRemoveStore(row)">移除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无参与门店" />
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="addStoreDialogVisible" title="添加参与门店" width="420px">
      <el-form ref="addStoreFormRef" :model="addStoreForm" :rules="addStoreRules" label-width="100px">
        <el-form-item label="门店编码" prop="storeCode">
          <el-input v-model="addStoreForm.storeCode" placeholder="请输入门店编码" />
        </el-form-item>
        <el-form-item label="门店名称" prop="storeName">
          <el-input v-model="addStoreForm.storeName" placeholder="请输入门店名称" />
        </el-form-item>
        <el-form-item label="门店地址">
          <el-input v-model="addStoreForm.address" placeholder="请输入门店地址" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="addStoreForm.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addStoreDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addStoreLoading" @click="handleAddStore">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { fetchInstantPlatformConfig, updateInstantPlatformConfig } from "../api";

const saveLoading = ref(false);
const storeLoading = ref(false);
const addStoreLoading = ref(false);
const platformFormRef = ref<FormInstance>();
const addStoreFormRef = ref<FormInstance>();
const addStoreDialogVisible = ref(false);

const platformForm = reactive({
  platformName: "",
  contactPhone: "",
  serviceHours: "",
  deliveryRange: 5,
  defaultDeliveryFee: 0
});

const platformRules: FormRules = {
  platformName: [{ required: true, message: "请填写平台名称", trigger: "blur" }],
  contactPhone: [{ required: true, message: "请填写联系电话", trigger: "blur" }],
  serviceHours: [{ required: true, message: "请填写服务时间", trigger: "blur" }],
  deliveryRange: [{ required: true, message: "请填写配送范围", trigger: "blur" }],
  defaultDeliveryFee: [{ required: true, message: "请填写默认配送费", trigger: "blur" }]
};

const storeList = ref<any[]>([]);

const addStoreForm = reactive({
  storeCode: "",
  storeName: "",
  address: "",
  contactPhone: ""
});

const addStoreRules: FormRules = {
  storeCode: [{ required: true, message: "请填写门店编码", trigger: "blur" }],
  storeName: [{ required: true, message: "请填写门店名称", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  storeLoading.value = true;
  try {
    const data = await fetchInstantPlatformConfig();
    if (data) {
      platformForm.platformName = data.platformName || "";
      platformForm.contactPhone = data.contactPhone || "";
      platformForm.serviceHours = data.serviceHours || "";
      platformForm.deliveryRange = data.deliveryRange || 5;
      platformForm.defaultDeliveryFee = data.defaultDeliveryFee || 0;
      storeList.value = data.stores || [];
    }
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载平台配置失败"));
  } finally {
    storeLoading.value = false;
  }
}

async function handleSave() {
  if (!platformFormRef.value) return;
  await platformFormRef.value.validate(async (valid) => {
    if (!valid) return;
    saveLoading.value = true;
    try {
      await updateInstantPlatformConfig({
        ...platformForm,
        stores: storeList.value
      });
      ElMessage.success("平台设置已保存");
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "保存平台设置失败"));
    } finally {
      saveLoading.value = false;
    }
  });
}

function openAddStoreDialog() {
  addStoreForm.storeCode = "";
  addStoreForm.storeName = "";
  addStoreForm.address = "";
  addStoreForm.contactPhone = "";
  addStoreDialogVisible.value = true;
}

async function handleAddStore() {
  if (!addStoreFormRef.value) return;
  await addStoreFormRef.value.validate(async (valid) => {
    if (!valid) return;
    addStoreLoading.value = true;
    try {
      storeList.value.push({ ...addStoreForm });
      ElMessage.success("门店已添加");
      addStoreDialogVisible.value = false;
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "添加门店失败"));
    } finally {
      addStoreLoading.value = false;
    }
  });
}

async function handleRemoveStore(row: any) {
  try {
    await ElMessageBox.confirm(`确定要移除门店「${row.storeName}」吗？`, "移除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    const idx = storeList.value.findIndex((s: any) => s.storeCode === row.storeCode);
    if (idx > -1) {
      storeList.value.splice(idx, 1);
    }
    ElMessage.success("门店已移除");
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "移除门店失败"));
    }
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
</style>