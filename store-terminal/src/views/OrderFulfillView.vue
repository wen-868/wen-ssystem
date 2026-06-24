<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>小程序订单履约</span>
        <el-button size="small" @click="loadOrders">刷新订单</el-button>
      </div>
    </template>
    <el-table :data="orders">
      <el-table-column prop="orderNo" label="订单号" width="220" />
      <el-table-column prop="receiverName" label="收货人" />
      <el-table-column prop="receiverMobile" label="手机号" width="140" />
      <el-table-column prop="fulfillmentType" label="履约方式" width="110" />
      <el-table-column prop="orderStatus" label="订单状态" width="130" />
      <el-table-column prop="payStatus" label="支付状态" width="110" />
      <el-table-column prop="payableAmount" label="应付金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.payableAmount) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openStoreOrderDetail(row.orderNo)">详情</el-button>
          <el-button v-if="row.orderStatus === 'NEW'" size="small" type="success" @click="handleAcceptOrder(row.orderNo)">接单</el-button>
          <el-button v-if="row.orderStatus === 'NEW'" size="small" type="danger" @click="handleRejectOrder(row.orderNo)">拒单</el-button>
          <el-button v-if="row.orderStatus === 'ACCEPTED'" size="small" type="primary" @click="handleStartDelivery(row.orderNo)">开始配送</el-button>
          <el-button v-if="row.orderStatus === 'DELIVERING'" size="small" type="primary" @click="handleCompleteOrder(row.orderNo)">完成配送</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
    <template v-if="orderDetail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="客户类型">{{ orderDetail.customerType }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">{{ orderDetail.orderStatus }}</el-descriptions-item>
        <el-descriptions-item label="支付状态">{{ orderDetail.payStatus }}</el-descriptions-item>
        <el-descriptions-item label="应付金额">{{ formatYuan(orderDetail.payableAmount) }}</el-descriptions-item>
        <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ orderDetail.receiverAddress || "-" }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="orderDetail.items || []" style="margin-top: 16px">
        <el-table-column prop="skuName" label="商品" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="小计" width="100">
          <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
        </el-table-column>
      </el-table>
      <div style="display: flex; gap: 8px; margin-top: 16px">
        <el-button v-if="orderDetail.orderStatus === 'NEW'" type="success" :loading="loading" @click="handleAcceptOrder(orderDetail.orderNo); orderDetailVisible = false">接单</el-button>
        <el-button v-if="orderDetail.orderStatus === 'NEW'" type="danger" :loading="loading" @click="handleRejectOrder(orderDetail.orderNo); orderDetailVisible = false">拒单</el-button>
        <el-button v-if="orderDetail.orderStatus === 'ACCEPTED'" type="primary" :loading="loading" @click="handleStartDelivery(orderDetail.orderNo); orderDetailVisible = false">开始配送</el-button>
        <el-button v-if="orderDetail.orderStatus === 'DELIVERING'" type="primary" :loading="loading" @click="handleCompleteOrder(orderDetail.orderNo); orderDetailVisible = false">完成配送</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchStoreOrders,
  fetchStoreOrderDetail,
  acceptStoreOrder,
  rejectStoreOrder,
  startDelivery,
  completeStoreOrder
} from "../api";
import { formatYuan } from "../utils/format";

const loading = ref(false);
const orders = ref<any[]>([]);
const orderDetail = ref<any>(null);
const orderDetailVisible = ref(false);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadOrders() {
  try {
    const data = await fetchStoreOrders();
    orders.value = data.records || [];
  } catch {
    ElMessage.warning("订单接口暂不可用，请确认后端和数据库已启动");
  }
}

async function openStoreOrderDetail(orderNo: string) {
  loading.value = true;
  try {
    orderDetail.value = await fetchStoreOrderDetail(orderNo);
    orderDetailVisible.value = true;
  } finally {
    loading.value = false;
  }
}

async function handleAcceptOrder(orderNo: string) {
  try {
    await acceptStoreOrder(orderNo);
    ElMessage.success("已接单");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "接单失败，请重试"));
  }
}

async function handleRejectOrder(orderNo: string) {
  const confirmed = await ElMessageBox.confirm("确认拒单？拒单后不可撤销。", "确认拒单", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await rejectStoreOrder(orderNo);
    ElMessage.success("已拒单");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "拒单失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function handleStartDelivery(orderNo: string) {
  loading.value = true;
  try {
    await startDelivery(orderNo);
    ElMessage.success("已开始配送");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "开始配送失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function handleCompleteOrder(orderNo: string) {
  loading.value = true;
  try {
    await completeStoreOrder(orderNo);
    ElMessage.success("订单已完成");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "完成配送失败，请重试"));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadOrders();
});
</script>
