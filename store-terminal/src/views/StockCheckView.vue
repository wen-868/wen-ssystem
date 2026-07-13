<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>盘点结果</span>
        <el-button size="small" @click="loadStoreStockChecks">刷新</el-button>
      </div>
    </template>
    <el-table :data="storeStockCheckList" size="small" empty-text="暂无盘点单">
      <el-table-column prop="checkNo" label="盘点单号" width="180" />
      <el-table-column label="状态" width="90">
        <template #default="{row}"><el-tag size="small" :type="row.status==='CHECKING'?'warning':row.status==='COMPLETED'?'success':'info'">{{row.status==='CHECKING'?'盘点中':row.status==='COMPLETED'?'已完成':row.status==='DRAFT'?'草稿':'已取消'}}</el-tag></template>
      </el-table-column>
      <el-table-column prop="totalSku" label="SKU数" width="80" />
      <el-table-column prop="diffSku" label="差异数" width="80" />
      <el-table-column label="差异金额" width="100"><template #default="{row}">{{formatYuan(row.diffAmount)}}</template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="200">
        <template #default="{row}">
          <el-button v-if="row.status==='CHECKING'" size="small" type="primary" @click="openScInputDialog(row)">录入实盘</el-button>
          <el-button v-if="row.status==='CHECKING'" size="small" type="success" @click="handleSubmitStockCheck(row)">提交</el-button>
          <el-button v-if="row.status==='COMPLETED'" size="small" link type="primary" @click="openDiffDetailDialog(row)">差异详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="scInputDialogVisible" title="录入实盘数量" width="700px">
    <el-table :data="scInputItems" size="small" empty-text="暂无明细" max-height="400">
      <el-table-column prop="skuName" label="商品" />
      <el-table-column prop="batchNo" label="批次号" width="120" />
      <el-table-column prop="systemQty" label="系统数量" width="90" />
      <el-table-column label="实盘数量" width="120">
        <template #default="{row}">
          <el-input-number v-model="row.actualQty" :min="0" size="small" style="width:100%" />
        </template>
      </el-table-column>
    </el-table>
    <template #footer><el-button @click="scInputDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveScItems">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="diffDetailDialogVisible" title="盘点差异详情" width="800px">
    <el-descriptions :column="3" border size="small" style="margin-bottom: 16px">
      <el-descriptions-item label="盘点单号">{{ diffDetail.checkNo }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ diffDetail.status === 'COMPLETED' ? '已完成' : diffDetail.status === 'CHECKING' ? '盘点中' : '草稿' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ diffDetail.createdAt }}</el-descriptions-item>
      <el-descriptions-item label="总SKU数">{{ diffDetail.totalSku }}</el-descriptions-item>
      <el-descriptions-item label="差异SKU数">{{ diffDetail.diffSku }}</el-descriptions-item>
      <el-descriptions-item label="差异金额">{{ formatYuan(diffDetail.diffAmount) }}</el-descriptions-item>
    </el-descriptions>
    <el-table :data="diffDetailItems" size="small" empty-text="暂无差异明细" max-height="400">
      <el-table-column prop="skuId" label="SKU ID" width="100" />
      <el-table-column prop="skuName" label="商品名称" />
      <el-table-column prop="batchNo" label="批次号" width="120" />
      <el-table-column prop="systemQty" label="系统数量" width="100" />
      <el-table-column prop="actualQty" label="实盘数量" width="100" />
      <el-table-column label="差异数量" width="100">
        <template #default="{row}">
          <span :style="{ color: row.diffQty > 0 ? '#67C23A' : row.diffQty < 0 ? '#F56C6C' : '#909399' }">
            {{ row.diffQty > 0 ? '+' : '' }}{{ row.diffQty }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="差异金额" width="120">
        <template #default="{row}">
          <span :style="{ color: row.diffAmount > 0 ? '#67C23A' : row.diffAmount < 0 ? '#F56C6C' : '#909399' }">
            {{ row.diffAmount > 0 ? '+' : '' }}{{ formatYuan(row.diffAmount) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="diffReason" label="差异原因" />
    </el-table>
    <template #footer><el-button @click="diffDetailDialogVisible=false">关闭</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchStoreStockChecks,
  fetchStoreStockCheckDetail,
  updateStockCheckItem,
  submitStoreStockCheck
} from "../api";
import { formatYuan } from "../utils/format";

const loading = ref(false);
const storeStockCheckList = ref<any[]>([]);
const scInputDialogVisible = ref(false);
const scInputItems = ref<any[]>([]);
const scInputCheckId = ref(0);
const diffDetailDialogVisible = ref(false);
const diffDetail = reactive({
  checkNo: "",
  status: "",
  createdAt: "",
  totalSku: 0,
  diffSku: 0,
  diffAmount: 0
});
const diffDetailItems = ref<any[]>([]);

async function loadStoreStockChecks() {
  try { storeStockCheckList.value = (await fetchStoreStockChecks()) || []; } catch { storeStockCheckList.value = []; }
}

async function openScInputDialog(row: any) {
  scInputCheckId.value = row.id;
  try {
    const detail = await fetchStoreStockCheckDetail(row.id);
    scInputItems.value = (detail.items || []).map((item: any) => ({ ...item }));
    scInputDialogVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "获取详情失败");
  }
}

async function handleSaveScItems() {
  try {
    for (const item of scInputItems.value) {
      await updateStockCheckItem(scInputCheckId.value, item.id, { actualQty: item.actualQty });
    }
    ElMessage.success("实盘数量已保存");
    scInputDialogVisible.value = false;
    loadStoreStockChecks();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  }
}

async function handleSubmitStockCheck(row: any) {
  try {
    await submitStoreStockCheck(row.id);
    ElMessage.success("盘点已提交");
    loadStoreStockChecks();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "提交失败");
  }
}

async function openDiffDetailDialog(row: any) {
  try {
    const detail = await fetchStoreStockCheckDetail(row.id);
    diffDetail.checkNo = detail.checkNo || "";
    diffDetail.status = detail.status || "";
    diffDetail.createdAt = detail.createdAt || "";
    diffDetail.totalSku = detail.totalSku || 0;
    diffDetail.diffSku = detail.diffSku || 0;
    diffDetail.diffAmount = detail.diffAmount || 0;
    diffDetailItems.value = (detail.items || []).filter((item: any) => item.diffQty !== 0);
    diffDetailDialogVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "获取详情失败");
  }
}

onMounted(() => {
  loadStoreStockChecks();
});
</script>
