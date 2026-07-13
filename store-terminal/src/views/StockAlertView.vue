<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>库存预警</span>
        <el-button size="small" @click="loadAlerts">刷新</el-button>
      </div>
    </template>
    <el-table :data="alerts" empty-text="暂无库存预警商品">
      <el-table-column prop="skuId" label="SKU ID" width="100" />
      <el-table-column prop="skuName" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="spec" label="规格" width="120" />
      <el-table-column label="预警阈值" width="100"><template #default="{ row }">{{ row.alertThreshold }}</template></el-table-column>
      <el-table-column label="当前库存" width="100">
        <template #default="{ row }">
          <span :style="{ color: row.availableQty <= row.alertThreshold ? '#F56C6C' : '#67C23A' }">{{ row.availableQty }}</span>
        </template>
      </el-table-column>
      <el-table-column label="差异" width="80">
        <template #default="{ row }">
          <span :style="{ color: row.diff < 0 ? '#F56C6C' : '#67C23A' }">{{ row.diff < 0 ? row.diff : '+' + row.diff }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openThresholdDialog(row)">设置阈值</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="thresholdDialogVisible" title="设置预警阈值" width="400px">
    <el-form ref="thresholdFormRef" :model="thresholdForm" :rules="thresholdRules" label-width="120px">
      <el-form-item label="商品名称">
        <span>{{ thresholdForm.skuName || "—" }}</span>
      </el-form-item>
      <el-form-item label="当前库存">
        <span>{{ thresholdForm.currentQty }}</span>
      </el-form-item>
      <el-form-item label="预警阈值" prop="threshold">
        <el-input-number v-model="thresholdForm.threshold" :min="0" :max="9999" placeholder="请输入预警阈值" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="thresholdDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSaveThreshold">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchStoreInventoryAlerts, updateStoreProductAlertThreshold } from "../api";

const loading = ref(false);
const alerts = ref<any[]>([]);
const thresholdDialogVisible = ref(false);
const thresholdForm = reactive({
  skuId: 0,
  skuName: "",
  currentQty: 0,
  threshold: 0
});
const thresholdFormRef = ref();
const thresholdRules = {
  threshold: [{
    validator: (_: any, value: number, callback: any) => {
      if (value >= 0) callback();
      else callback(new Error("预警阈值不能为负数"));
    },
    trigger: "blur"
  }]
};

async function loadAlerts() {
  try {
    const data = await fetchStoreInventoryAlerts();
    alerts.value = data.records || data || [];
  } catch {
    alerts.value = [];
    ElMessage.warning("库存预警接口暂不可用");
  }
}

function openThresholdDialog(row: any) {
  thresholdForm.skuId = row.skuId;
  thresholdForm.skuName = row.skuName;
  thresholdForm.currentQty = row.availableQty;
  thresholdForm.threshold = row.alertThreshold || 10;
  thresholdDialogVisible.value = true;
}

async function handleSaveThreshold() {
  if (!thresholdForm.skuId) return;
  await thresholdFormRef.value?.validate();
  loading.value = true;
  try {
    await updateStoreProductAlertThreshold(thresholdForm.skuId, thresholdForm.threshold);
    ElMessage.success("预警阈值已更新");
    thresholdDialogVisible.value = false;
    await loadAlerts();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "更新失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadAlerts();
});
</script>
