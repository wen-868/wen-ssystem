<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px">
        <span>库存查询</span>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
          <el-select v-model="selectedCategoryId" placeholder="分类筛选" clearable size="small" style="width: 160px">
            <el-option label="全部分类" :value="0" />
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
          <el-input v-model="inventoryKeyword" placeholder="按商品名/SKU编码/条码搜索" clearable size="small" style="width: 220px" @keyup.enter="handleSearchInventory" />
          <el-button size="small" @click="handleSearchInventory">搜索</el-button>
          <el-button size="small" @click="inventoryKeyword = ''; selectedCategoryId = 0; loadInventory()">刷新库存</el-button>
        </div>
      </div>
    </template>
    <el-table :data="inventory">
      <el-table-column prop="skuId" label="SKU ID" width="100" />
      <el-table-column prop="skuName" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="spec" label="规格" width="120" />
      <el-table-column label="单价" width="100"><template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template></el-table-column>
      <el-table-column prop="stockType" label="库存类型" width="100" />
      <el-table-column prop="physicalQty" label="物理库存" width="100" />
      <el-table-column prop="availableQty" label="可售库存" width="100" />
      <el-table-column label="金额" width="120"><template #default="{ row }">{{ formatYuan((row.availableQty || 0) * (row.unitPrice || 0)) }}</template></el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openInvAdjust(row)">调整</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>库存流水</span>
        <el-button size="small" @click="loadInventoryLogs">刷新</el-button>
      </div>
    </template>
    <el-table :data="inventoryLogs" empty-text="暂无流水">
      <el-table-column prop="logNo" label="流水号" width="200" />
      <el-table-column prop="skuName" label="商品" width="140" />
      <el-table-column prop="changeQty" label="变动" width="80" />
      <el-table-column prop="beforeQty" label="调整前" width="80" />
      <el-table-column prop="afterQty" label="调整后" width="80" />
      <el-table-column prop="reason" label="原因" />
      <el-table-column prop="operatorName" label="操作人" width="120" />
      <el-table-column prop="createdAt" label="时间" width="170" />
    </el-table>
  </el-card>

  <el-dialog v-model="invDialogVisible" title="库存调整" width="400px">
    <el-form ref="invFormRef" :model="invForm" :rules="invRules" label-width="100px">
      <el-form-item label="商品">
        <span>{{ invForm.skuName || "—" }}</span>
      </el-form-item>
      <el-form-item label="库存类型">
        <span>{{ invForm.stockType }}</span>
      </el-form-item>
      <el-form-item label="变化量" prop="change">
        <el-input-number v-model="invForm.change" :min="-999" :max="999" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="invForm.remark" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="invDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleInvAdjust">确认调整</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchInventory,
  fetchInventoryLogs,
  adjustInventory,
  fetchStoreCategories
} from "../api";
import { formatYuan } from "../utils/format";

const loading = ref(false);
const inventory = ref<any[]>([]);
const inventoryKeyword = ref("");
const inventoryLogs = ref<any[]>([]);
const categories = ref<any[]>([]);
const selectedCategoryId = ref(0);
const invDialogVisible = ref(false);
const invForm = reactive({
  skuId: 0,
  skuName: "",
  stockType: "OFFLINE",
  change: 0,
  remark: ""
});
const invFormRef = ref();
const invRules = {
  change: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) !== 0) callback();
      else callback(new Error("变化量不能为 0"));
    },
    trigger: "blur"
  }]
};

async function loadCategories() {
  try {
    const data = await fetchStoreCategories();
    categories.value = data.records || data || [];
  } catch {
    categories.value = [];
  }
}

async function loadInventory(keyword?: string) {
  try {
    const params: Record<string, unknown> = keyword ? { keyword } : {};
    if (selectedCategoryId.value > 0) {
      params.categoryId = selectedCategoryId.value;
    }
    inventory.value = await fetchInventory(params);
  } catch {
    ElMessage.warning("库存接口暂不可用，请确认后端和数据库已启动");
  }
}

async function loadInventoryLogs() {
  try {
    const data = await fetchInventoryLogs();
    inventoryLogs.value = data.records || [];
  } catch {
    ElMessage.warning("库存流水接口暂不可用，请确认后端和数据库已启动");
  }
}

function handleSearchInventory() {
  const keyword = inventoryKeyword.value.trim();
  loadInventory(keyword || undefined);
}

function openInvAdjust(row: any) {
  invForm.skuId = row.skuId;
  invForm.skuName = row.skuName;
  invForm.stockType = row.stockType;
  invForm.change = 0;
  invForm.remark = "";
  invDialogVisible.value = true;
}

async function handleInvAdjust() {
  if (!invForm.skuId) return;
  await invFormRef.value?.validate();
  const confirmed = await ElMessageBox.confirm(`确认调整 ${invForm.skuName || "该商品"} 的 ${invForm.stockType} 库存 ${invForm.change > 0 ? "+" : ""}${invForm.change}?`, "确认调整", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await adjustInventory({
      skuId: invForm.skuId,
      stockType: invForm.stockType,
      change: invForm.change,
      remark: invForm.remark
    });
    ElMessage.success("调整成功");
    invDialogVisible.value = false;
    await loadInventory();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCategories();
  loadInventory();
  loadInventoryLogs();
});
</script>
