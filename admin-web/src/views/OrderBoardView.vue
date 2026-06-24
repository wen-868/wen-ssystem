<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单泳道</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索订单号/收货人"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadAllOrders"
              @keyup.enter="loadAllOrders"
            />
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="width: 280px; margin-right: 10px"
              value-format="YYYY-MM-DD"
            />
            <el-button @click="loadAllOrders">搜索</el-button>
            <el-button @click="loadAllOrders">刷新</el-button>
          </div>
        </div>
      </template>

      <div class="board-container" v-loading="loading">
        <div class="board-column" v-for="column in columns" :key="column.status">
          <div class="column-header" :class="column.class">
            <span class="column-title">{{ column.title }}</span>
            <el-tag :type="column.tagType" size="small">{{ getColumnOrders(column.status).length }}</el-tag>
          </div>
          <div class="column-body">
            <div
              v-for="order in getColumnOrders(column.status)"
              :key="order.id || order.orderNo"
              class="order-card"
              @click="viewDetail(order)"
            >
              <div class="card-header-row">
                <span class="order-no">{{ order.orderNo }}</span>
                <el-tag :type="column.tagType" size="small">{{ column.title }}</el-tag>
              </div>
              <div class="card-customer">
                <span>{{ order.receiverName || order.customerName || '未知客户' }}</span>
                <span v-if="order.receiverPhone || order.mobile">{{ order.receiverPhone || order.mobile }}</span>
              </div>
              <div class="card-items" v-if="order.items && order.items.length > 0">
                <span v-for="(item, idx) in order.items.slice(0, 2)" :key="idx" class="item-name">
                  {{ item.skuName || item.productName }} x{{ item.quantity }}
                </span>
                <span v-if="order.items.length > 2" class="item-more">等{{ order.items.length }}件</span>
              </div>
              <div class="card-footer">
                <span class="order-amount">¥{{ Number(order.totalAmount || 0).toFixed(2) }}</span>
                <span class="order-time">{{ formatTime(order.createTime || order.createdAt) }}</span>
              </div>
            </div>
            <div v-if="getColumnOrders(column.status).length === 0" class="empty-column">
              <el-empty description="暂无订单" :image-size="60" />
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="订单详情" size="600px">
      <template v-if="currentOrder">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订单号">{{ currentOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag v-if="currentOrder.orderStatus === 'PENDING_PAY'" type="warning">待付款</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PENDING_SHIP'" type="primary">待发货</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PENDING_RECEIVE'" type="info">待收货</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'CANCELLED'" type="info">已取消</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'REFUNDED'" type="danger">已退款</el-tag>
            <el-tag v-else>{{ currentOrder.orderStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付状态">
            <el-tag v-if="currentOrder.payStatus === 'UNPAID'" type="danger">未支付</el-tag>
            <el-tag v-else-if="currentOrder.payStatus === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else-if="currentOrder.payStatus === 'REFUNDED'" type="warning">已退款</el-tag>
            <el-tag v-else>{{ currentOrder.payStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="订单金额">
            <span class="amount-text">¥{{ Number(currentOrder.totalAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="收货人">{{ currentOrder.receiverName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.receiverPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="收货地址">{{ currentOrder.receiverAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ currentOrder.createTime || currentOrder.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品清单</h4>
        <el-table :data="currentOrder.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="120">
            <template #default="{ row }">¥{{ Number(row.subtotal || row.unitPrice * row.quantity || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchOrders } from "../api";

const loading = ref(false);
const allOrders = ref<any[]>([]);
const keyword = ref("");
const dateRange = ref<string[]>([]);
const detailVisible = ref(false);
const currentOrder = ref<any>(null);

const columns = [
  { status: "PENDING_PAY", title: "待付款", class: "col-pending-pay", tagType: "warning" },
  { status: "PENDING_SHIP", title: "待发货", class: "col-pending-ship", tagType: "primary" },
  { status: "PENDING_RECEIVE", title: "待收货", class: "col-pending-receive", tagType: "info" },
  { status: "COMPLETED", title: "已完成", class: "col-completed", tagType: "success" },
  { status: "CANCELLED", title: "已取消", class: "col-cancelled", tagType: "info" },
];

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function getColumnOrders(status: string) {
  return allOrders.value.filter(o => (o.orderStatus || o.status) === status);
}

function formatTime(time: string) {
  if (!time) return '';
  return time.substring(5, 16);
}

async function loadAllOrders() {
  loading.value = true;
  try {
    const params: any = {
      page: 1,
      pageSize: 100,
    };
    if (keyword.value) params.keyword = keyword.value;
    if (dateRange.value && dateRange.value.length === 2) {
      params.dateStart = dateRange.value[0];
      params.dateEnd = dateRange.value[1];
    }
    const data = await fetchOrders(params);
    allOrders.value = data.records || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载订单失败"));
  } finally {
    loading.value = false;
  }
}

function viewDetail(row: any) {
  currentOrder.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  loadAllOrders();
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
}
.board-container {
  display: flex;
  gap: 12px;
  min-height: 600px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.board-column {
  flex: 1;
  min-width: 260px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}
.column-header {
  padding: 12px 16px;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.col-pending-pay {
  background: #fdf6ec;
  color: #e6a23c;
}
.col-pending-ship {
  background: #ecf5ff;
  color: #409eff;
}
.col-pending-receive {
  background: #f4f4f5;
  color: #909399;
}
.col-completed {
  background: #f0f9eb;
  color: #67c23a;
}
.col-cancelled {
  background: #f4f4f5;
  color: #909399;
}
.column-title {
  font-size: 14px;
}
.column-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 320px);
}
.order-card {
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: all 0.2s;
}
.order-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.order-no {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  font-family: monospace;
}
.card-customer {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
}
.card-items {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  line-height: 1.6;
}
.item-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-more {
  color: #c0c4cc;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
.order-amount {
  color: #f56c6c;
  font-weight: 600;
  font-size: 14px;
}
.order-time {
  color: #c0c4cc;
}
.amount-text {
  color: #f56c6c;
  font-weight: 600;
  font-size: 16px;
}
.empty-column {
  padding: 20px 0;
}
</style>
