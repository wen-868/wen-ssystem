<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单看板</span>
          <div class="header-actions">
            <el-tag v-if="autoRefresh" type="success" effect="dark">自动刷新中（30s）</el-tag>
            <el-tag v-else type="info" effect="dark">自动刷新已暂停</el-tag>
            <el-button :type="autoRefresh ? 'warning' : 'primary'" size="small" @click="toggleAutoRefresh">
              {{ autoRefresh ? "暂停" : "开始" }}
            </el-button>
            <el-button size="small" @click="loadData">手动刷新</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="board-container">
        <el-row :gutter="16">
          <el-col :span="6">
            <div class="kanban-column">
              <div class="kanban-header pending-header">
                <span>新订单</span>
                <el-badge :value="newOrders.length" class="column-badge" />
              </div>
              <div class="kanban-body">
                <div v-if="newOrders.length === 0" class="kanban-empty">
                  <el-empty description="暂无新订单" :image-size="60" />
                </div>
                <div
                  v-for="order in newOrders"
                  :key="'new-' + order.orderNo"
                  class="order-card"
                  @click="viewDetail(order)"
                >
                  <div class="order-card-header">
                    <span class="order-no">{{ order.orderNo }}</span>
                    <el-tag size="small" type="warning">待确认</el-tag>
                  </div>
                  <div class="order-card-body">
                    <div class="order-customer">{{ order.customer }}</div>
                    <div class="order-items">{{ order.items || "-" }}</div>
                  </div>
                  <div class="order-card-footer">
                    <span class="order-amount">¥{{ Number(order.amount || 0).toFixed(2) }}</span>
                    <span class="order-time">{{ order.time || order.createdAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="kanban-column">
              <div class="kanban-header preparing-header">
                <span>备货中</span>
                <el-badge :value="preparingOrders.length" class="column-badge" />
              </div>
              <div class="kanban-body">
                <div v-if="preparingOrders.length === 0" class="kanban-empty">
                  <el-empty description="暂无备货订单" :image-size="60" />
                </div>
                <div
                  v-for="order in preparingOrders"
                  :key="'prep-' + order.orderNo"
                  class="order-card"
                  @click="viewDetail(order)"
                >
                  <div class="order-card-header">
                    <span class="order-no">{{ order.orderNo }}</span>
                    <el-tag size="small" type="info">备货中</el-tag>
                  </div>
                  <div class="order-card-body">
                    <div class="order-customer">{{ order.customer }}</div>
                    <div class="order-items">{{ order.items || "-" }}</div>
                  </div>
                  <div class="order-card-footer">
                    <span class="order-amount">¥{{ Number(order.amount || 0).toFixed(2) }}</span>
                    <span class="order-time">{{ order.time || order.createdAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="kanban-column">
              <div class="kanban-header delivering-header">
                <span>配送中</span>
                <el-badge :value="deliveringOrders.length" class="column-badge" />
              </div>
              <div class="kanban-body">
                <div v-if="deliveringOrders.length === 0" class="kanban-empty">
                  <el-empty description="暂无配送订单" :image-size="60" />
                </div>
                <div
                  v-for="order in deliveringOrders"
                  :key="'deliv-' + order.orderNo"
                  class="order-card"
                  @click="viewDetail(order)"
                >
                  <div class="order-card-header">
                    <span class="order-no">{{ order.orderNo }}</span>
                    <el-tag size="small" type="primary">配送中</el-tag>
                  </div>
                  <div class="order-card-body">
                    <div class="order-customer">{{ order.customer }}</div>
                    <div class="order-items">{{ order.items || "-" }}</div>
                  </div>
                  <div class="order-card-footer">
                    <span class="order-amount">¥{{ Number(order.amount || 0).toFixed(2) }}</span>
                    <span class="order-time">{{ order.time || order.createdAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="kanban-column">
              <div class="kanban-header completed-header">
                <span>已完成</span>
                <el-badge :value="completedOrders.length" class="column-badge" />
              </div>
              <div class="kanban-body">
                <div v-if="completedOrders.length === 0" class="kanban-empty">
                  <el-empty description="暂无完成订单" :image-size="60" />
                </div>
                <div
                  v-for="order in completedOrders"
                  :key="'comp-' + order.orderNo"
                  class="order-card"
                  @click="viewDetail(order)"
                >
                  <div class="order-card-header">
                    <span class="order-no">{{ order.orderNo }}</span>
                    <el-tag size="small" type="success">已完成</el-tag>
                  </div>
                  <div class="order-card-body">
                    <div class="order-customer">{{ order.customer }}</div>
                    <div class="order-items">{{ order.items || "-" }}</div>
                  </div>
                  <div class="order-card-footer">
                    <span class="order-amount">¥{{ Number(order.amount || 0).toFixed(2) }}</span>
                    <span class="order-time">{{ order.time || order.createdAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="订单详情" width="560px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customer }}</el-descriptions-item>
        <el-descriptions-item label="商品">{{ detail.items || "-" }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">¥{{ Number(detail.amount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag v-if="detail.status === 'PENDING'" type="warning">待确认</el-tag>
          <el-tag v-else-if="detail.status === 'PREPARING'" type="info">备货中</el-tag>
          <el-tag v-else-if="detail.status === 'DELIVERING'" type="primary">配送中</el-tag>
          <el-tag v-else-if="detail.status === 'COMPLETED'" type="success">已完成</el-tag>
          <el-tag v-else>{{ detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ detail.address || "-" }}</el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ detail.time || detail.createdAt || "-" }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ detail.phone || "-" }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || "-" }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchOrderBoardData } from "../api";

const loading = ref(false);
const autoRefresh = ref(true);
const orders = ref<any[]>([]);
const detailVisible = ref(false);
const detail = ref<any>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const newOrders = computed(() => orders.value.filter((o: any) => o.status === "PENDING"));
const preparingOrders = computed(() => orders.value.filter((o: any) => o.status === "PREPARING"));
const deliveringOrders = computed(() => orders.value.filter((o: any) => o.status === "DELIVERING"));
const completedOrders = computed(() => orders.value.filter((o: any) => o.status === "COMPLETED"));

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchOrderBoardData();
    orders.value = Array.isArray(data) ? data : data?.orders || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载订单看板数据失败"));
  } finally {
    loading.value = false;
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value;
  if (autoRefresh.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  timer = setInterval(() => {
    loadData();
  }, 30000);
}

function stopAutoRefresh() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function viewDetail(order: any) {
  detail.value = order;
  detailVisible.value = true;
}

onMounted(() => {
  loadData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
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
.board-container {
  min-height: 400px;
}
.kanban-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px 6px 0 0;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}
.pending-header {
  background: #e6a23c;
}
.preparing-header {
  background: #909399;
}
.delivering-header {
  background: #409eff;
}
.completed-header {
  background: #67c23a;
}
.column-badge {
  margin-top: -2px;
}
.kanban-body {
  flex: 1;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 8px;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
}
.kanban-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
.order-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s;
}
.order-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.order-no {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.order-card-body {
  margin-bottom: 6px;
}
.order-customer {
  font-size: 13px;
  color: #606266;
  margin-bottom: 2px;
}
.order-items {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.order-amount {
  font-size: 14px;
  font-weight: 600;
  color: #f56c6c;
}
.order-time {
  font-size: 12px;
  color: #c0c4cc;
}
</style>