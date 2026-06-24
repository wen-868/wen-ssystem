<template>
  <el-card style="margin-top: 20px">
    <el-tabs v-model="storeTransferTab">
      <el-tab-pane label="我收到的" name="received">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:600">在途调拨单（调入）</span>
          <el-button size="small" @click="loadStoreInTransit">刷新</el-button>
        </div>
        <el-table :data="storeInTransitList" size="small" empty-text="暂无在途调拨单">
          <el-table-column prop="transferNo" label="调拨单号" width="180" />
          <el-table-column prop="fromStoreName" label="调出门店" width="120" />
          <el-table-column label="状态" width="90">
            <template #default="{row}"><el-tag size="small" :type="row.status==='TRANSIT'?'warning':'success'">{{row.status==='TRANSIT'?'在途':'已收货'}}</el-tag></template>
          </el-table-column>
          <el-table-column label="总金额" width="100"><template #default="{row}">{{formatYuan(row.totalAmount)}}</template></el-table-column>
          <el-table-column prop="expectedDate" label="期望日期" width="110" />
          <el-table-column label="操作" width="100">
            <template #default="{row}">
              <el-button v-if="row.status==='TRANSIT'" size="small" type="primary" @click="openReceiveDialog(row)">收货确认</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="我发出的" name="shipped">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:600">已发货调拨单（调出）</span>
          <el-button size="small" @click="loadStoreMyShipments">刷新</el-button>
        </div>
        <el-table :data="storeMyShipmentList" size="small" empty-text="暂无已发货调拨单">
          <el-table-column prop="transferNo" label="调拨单号" width="180" />
          <el-table-column prop="toStoreName" label="调入门店" width="120" />
          <el-table-column label="状态" width="90">
            <template #default="{row}"><el-tag size="small" :type="row.status==='TRANSIT'?'warning':'success'">{{row.status==='TRANSIT'?'在途':'已收货'}}</el-tag></template>
          </el-table-column>
          <el-table-column label="总金额" width="100"><template #default="{row}">{{formatYuan(row.totalAmount)}}</template></el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>

  <el-dialog v-model="receiveDialogVisible" title="收货确认" width="600px">
    <el-table :data="receiveDialogItems" size="small" empty-text="暂无明细">
      <el-table-column prop="skuName" label="商品" />
      <el-table-column prop="quantity" label="调拨数量" width="90" />
      <el-table-column prop="receivedQty" label="已收货" width="80" />
      <el-table-column label="本次收货" width="120">
        <template #default="{row}">
          <el-input-number v-model="row.thisReceiveQty" :min="0" :max="row.quantity - row.receivedQty" size="small" style="width:100%" />
        </template>
      </el-table-column>
    </el-table>
    <template #footer><el-button @click="receiveDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleReceiveTransfer">确认收货</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchStoreInTransitTransfers,
  fetchStoreMyShipments,
  receiveStoreTransfer
} from "../api";
import { formatYuan } from "../utils/format";

const loading = ref(false);
const storeTransferTab = ref("received");
const storeInTransitList = ref<any[]>([]);
const storeMyShipmentList = ref<any[]>([]);
const receiveDialogVisible = ref(false);
const receiveDialogItems = ref<any[]>([]);
const receiveTransferId = ref(0);

async function loadStoreInTransit() {
  try { storeInTransitList.value = (await fetchStoreInTransitTransfers()) || []; } catch { storeInTransitList.value = []; }
}

async function loadStoreMyShipments() {
  try { storeMyShipmentList.value = (await fetchStoreMyShipments()) || []; } catch { storeMyShipmentList.value = []; }
}

async function openReceiveDialog(row: any) {
  receiveTransferId.value = row.id;
  receiveDialogItems.value = (row.items || []).map((item: any) => ({
    ...item,
    thisReceiveQty: item.quantity - item.receivedQty
  }));
  receiveDialogVisible.value = true;
}

async function handleReceiveTransfer() {
  const items = receiveDialogItems.value
    .filter((item: any) => item.thisReceiveQty > 0)
    .map((item: any) => ({ itemId: item.id, receivedQty: item.thisReceiveQty }));
  if (items.length === 0) {
    ElMessage.warning("请输入收货数量");
    return;
  }
  try {
    await receiveStoreTransfer(receiveTransferId.value, { items });
    ElMessage.success("收货确认成功");
    receiveDialogVisible.value = false;
    loadStoreInTransit();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "收货失败");
  }
}

onMounted(() => {
  loadStoreInTransit();
  loadStoreMyShipments();
});
</script>
