<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>分享收款</span>
        <el-button size="small" @click="loadCollectionLinks">刷新</el-button>
      </div>
    </template>
    <el-table :data="collectionLinks" empty-text="暂无记录">
      <el-table-column prop="linkNo" label="收款单号" width="200" />
      <el-table-column prop="sourceNo" label="关联销售单" width="200" />
      <el-table-column label="收款金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="已付" width="100">
        <template #default="{ row }">{{ formatYuan(row.paidAmount) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="createdAt" label="创建时间" width="170" />
    </el-table>
  </el-card>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>支付记录</span>
        <el-button size="small" @click="loadPaymentOrders">刷新</el-button>
      </div>
    </template>
    <el-table :data="paymentOrders" empty-text="暂无记录">
      <el-table-column prop="payNo" label="支付单号" width="200" />
      <el-table-column prop="sourceNo" label="关联来源" width="200" />
      <el-table-column label="金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="paymentMethod" label="方式" width="100" />
      <el-table-column prop="createdAt" label="时间" width="170" />
    </el-table>
  </el-card>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>退款记录</span>
        <el-button size="small" @click="loadRefundOrders">刷新</el-button>
      </div>
    </template>
    <el-table :data="refundOrders" empty-text="暂无退款">
      <el-table-column prop="refundNo" label="退款单号" width="200" />
      <el-table-column prop="payNo" label="支付单号" width="200" />
      <el-table-column prop="sourceNo" label="关联来源" width="180" />
      <el-table-column label="退款金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="createdAt" label="时间" width="170" />
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchStoreCollectionLinks,
  fetchStorePaymentOrders,
  fetchStoreRefundOrders
} from "../api";
import { formatYuan } from "../utils/format";

const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);

async function loadCollectionLinks() {
  try {
    const data = await fetchStoreCollectionLinks();
    collectionLinks.value = data.records || [];
  } catch {
    ElMessage.warning("收款记录接口暂不可用");
  }
}

async function loadPaymentOrders() {
  try {
    const data = await fetchStorePaymentOrders();
    paymentOrders.value = data.records || [];
  } catch {
    ElMessage.warning("支付记录接口暂不可用");
  }
}

async function loadRefundOrders() {
  try {
    const data = await fetchStoreRefundOrders();
    refundOrders.value = data.records || [];
  } catch {
    ElMessage.warning("退款记录接口暂不可用");
  }
}

onMounted(() => {
  loadCollectionLinks();
  loadPaymentOrders();
  loadRefundOrders();
});
</script>
