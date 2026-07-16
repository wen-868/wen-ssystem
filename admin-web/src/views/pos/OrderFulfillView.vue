<template>
  <div class="pos-order-fulfill">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>接单履约</span>
          <div class="filter-area">
            <el-select v-model="statusFilter" placeholder="订单状态" size="small" style="width: 140px" clearable @change="loadList">
              <el-option label="待接单" value="PENDING" />
              <el-option label="已接单" value="ACCEPTED" />
              <el-option label="配送中" value="DELIVERING" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已拒绝" value="REJECTED" />
            </el-select>
            <el-button size="small" type="primary" @click="loadList">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="records" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="160" />
        <el-table-column prop="customerName" label="客户" width="100" />
        <el-table-column prop="totalAmount" label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deliveryType" label="配送方式" width="100" />
        <el-table-column prop="createdAt" label="下单时间" width="160" />
        <el-table-column label="操作" min-width="180">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" size="small" type="primary" @click="handleAccept(row.orderNo)">接单</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" type="danger" @click="handleReject(row.orderNo)">拒单</el-button>
            <el-button v-if="row.status === 'ACCEPTED'" size="small" type="success" @click="handleComplete(row.orderNo)">完成</el-button>
            <el-button size="small" link @click="viewDetail(row.orderNo)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px"
        @current-change="loadList"
      />
    </el-card>

    <el-dialog v-model="detailVisible" title="订单详情" width="700px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customerName }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ Number(detail.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ getStatusText(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="配送方式">{{ detail.deliveryType }}</el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ detail.address }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="detail.items || []" size="small" style="margin-top: 16px">
        <el-table-column prop="skuName" label="商品" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="小计" width="100">
          <template #default="{ row }">¥{{ Number(row.subtotalAmount || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchStoreOrders,
  fetchStoreOrderDetail,
  acceptStoreOrder,
  rejectStoreOrder,
  completeStoreOrder
} from "../../api";

const loading = ref(false);
const statusFilter = ref("");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const detailVisible = ref(false);
const detail = ref<any>({});

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    ACCEPTED: "primary",
    DELIVERING: "primary",
    COMPLETED: "success",
    REJECTED: "danger"
  };
  return map[status] || "info";
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待接单",
    ACCEPTED: "已接单",
    DELIVERING: "配送中",
    COMPLETED: "已完成",
    REJECTED: "已拒绝"
  };
  return map[status] || status || "未知";
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchStoreOrders({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载订单失败");
  } finally {
    loading.value = false;
  }
}

async function viewDetail(orderNo: string) {
  try {
    const data = await fetchStoreOrderDetail(orderNo);
    detail.value = data;
    detailVisible.value = true;
  } catch {
    ElMessage.error("加载详情失败");
  }
}

async function handleAccept(orderNo: string) {
  try {
    await ElMessageBox.confirm("确认接单？", "提示", { type: "warning" });
    await acceptStoreOrder(orderNo);
    ElMessage.success("接单成功");
    await loadList();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("接单失败");
    }
  }
}

async function handleReject(orderNo: string) {
  try {
    await ElMessageBox.confirm("确认拒单？", "提示", { type: "warning" });
    await rejectStoreOrder(orderNo);
    ElMessage.success("已拒单");
    await loadList();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("拒单失败");
    }
  }
}

async function handleComplete(orderNo: string) {
  try {
    await ElMessageBox.confirm("确认完成订单？", "提示", { type: "warning" });
    await completeStoreOrder(orderNo);
    ElMessage.success("订单已完成");
    await loadList();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("完成订单失败");
    }
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-order-fulfill {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-area {
  display: flex;
  gap: 8px;
}
</style>
