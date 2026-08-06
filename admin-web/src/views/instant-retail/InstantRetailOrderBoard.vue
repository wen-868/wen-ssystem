<template>
  <div class="page">
    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="toolbar-title">60秒接单看板</span>
          <el-tag v-if="autoAccept" type="success" effect="dark">自动接单</el-tag>
          <el-tag v-else type="warning" effect="dark">手动接单</el-tag>
        </div>
        <div class="toolbar-right">
          <el-tooltip content="新订单音效">
            <el-button :icon="soundEnabled ? 'Bell' : 'BellOff'" circle @click="toggleSound" />
          </el-tooltip>
          <el-switch v-model="autoAccept" active-text="自动接单" inactive-text="手动接单" />
          <el-select v-model="refreshInterval" style="width: 140px" @change="handleIntervalChange">
            <el-option label="30秒刷新" :value="30" />
            <el-option label="60秒刷新" :value="60" />
            <el-option label="2分钟刷新" :value="120" />
            <el-option label="5分钟刷新" :value="300" />
          </el-select>
          <el-button :icon="Refresh" @click="loadData">手动刷新</el-button>
          <el-dropdown @command="handleBatchCommand">
            <el-button type="primary">
              批量操作
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="selectAll">全选待接单</el-dropdown-item>
                <el-dropdown-item command="acceptAll" divided>批量接单</el-dropdown-item>
                <el-dropdown-item command="rejectAll">批量拒单</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-card>

    <transition name="popup">
      <el-dialog
        v-model="newOrderPopupVisible"
        :close-on-click-modal="false"
        :show-close="false"
        width="480px"
        class="new-order-dialog"
      >
        <div class="popup-header">
          <div class="popup-countdown">
            <div class="countdown-bar">
              <div
                class="countdown-progress"
                :style="{
                  width: (countdown / 60) * 100 + '%',
                  background: countdownGradient
                }"
              ></div>
            </div>
            <span class="countdown-text" :class="countdownClass">{{ countdown }}s</span>
          </div>
          <el-tag :type="popupOrder?.platform === 'jd' ? 'danger' : popupOrder?.platform === 'meituan' ? 'warning' : 'primary'">
            {{ getPlatformName(popupOrder?.platform) }}
          </el-tag>
        </div>
        <div class="popup-body" v-if="popupOrder">
          <div class="order-row">
            <span class="order-label">订单号：</span>
            <span class="order-value">{{ popupOrder.orderNo }}</span>
          </div>
          <div class="order-row">
            <span class="order-label">用户：</span>
            <span class="order-value">{{ popupOrder.customer }}</span>
          </div>
          <div class="order-row">
            <span class="order-label">金额：</span>
            <span class="order-amount">¥{{ popupOrder.amount.toFixed(2) }}</span>
          </div>
          <div class="order-items-section">
            <div class="order-label">商品明细：</div>
            <div class="order-items-list">
              <div v-for="item in popupOrder.items" :key="item.id" class="order-item">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-qty">x{{ item.qty }}</span>
              </div>
            </div>
          </div>
          <div class="order-remark" v-if="popupOrder.remark">
            <span class="order-label">备注：</span>
            <span class="remark-text">{{ popupOrder.remark }}</span>
          </div>
        </div>
        <template #footer>
          <div class="popup-footer">
            <el-select v-model="rejectReason" placeholder="拒单原因" style="width: 180px" v-if="showRejectReasons">
              <el-option label="商品已售罄" value="sold_out" />
              <el-option label="配送范围外" value="out_of_range" />
              <el-option label="门店已打烊" value="closed" />
              <el-option label="其他原因" value="other" />
            </el-select>
            <el-button type="danger" @click="showRejectReasons = !showRejectReasons">
              {{ showRejectReasons ? '取消拒单' : '拒单' }}
            </el-button>
            <el-button type="primary" @click="acceptPopupOrder">接单</el-button>
          </div>
        </template>
      </el-dialog>
    </transition>

    <div class="kanban-board">
      <div class="kanban-column pending-column">
        <div class="column-header">
          <span class="column-title">待接单</span>
          <el-badge :value="pendingOrders.length" class="column-badge" />
        </div>
        <div class="column-body" ref="pendingBodyRef">
          <el-empty v-if="pendingOrders.length === 0" description="暂无待接单" :image-size="60" />
          <div
            v-for="order in pendingOrders"
            :key="order.id"
            class="order-card pending-card"
            :class="{ 'card-selected': selectedOrders.includes(order.id) }"
            draggable="true"
            @dragstart="handleDragStart($event, order, 'pending')"
            @dragover.prevent
            @drop="handleDrop($event, 'pending')"
          >
            <div class="card-checkbox">
              <el-checkbox v-model="selectedOrders" :value="order.id" @change.stop />
            </div>
            <div class="card-top">
              <span class="order-no">{{ order.orderNo }}</span>
              <el-tag size="small" :type="order.platform === 'jd' ? 'danger' : order.platform === 'meituan' ? 'warning' : 'primary'">
                {{ getPlatformName(order.platform) }}
              </el-tag>
            </div>
            <div class="card-body">
              <div class="card-line">
                <el-icon><User /></el-icon>
                <span>{{ order.customer }}</span>
              </div>
              <div class="card-line">
                <el-icon><Goods /></el-icon>
                <span>{{ order.itemCount }}件商品</span>
              </div>
            </div>
            <div class="card-bottom">
              <span class="card-amount">¥{{ order.amount.toFixed(2) }}</span>
              <span class="card-countdown" :class="getCountdownClass(order)">
                {{ getOrderCountdown(order) }}s
              </span>
            </div>
            <div class="card-time">
              <el-icon><Clock /></el-icon>
              <span>{{ order.createTime }}</span>
            </div>
            <div class="card-actions">
              <el-button size="small" type="primary" @click="acceptOrder(order)">接单</el-button>
              <el-button size="small" type="danger" @click="rejectOrder(order)">拒单</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="kanban-column processing-column">
        <div class="column-header">
          <span class="column-title">进行中</span>
          <el-badge :value="processingOrders.length" class="column-badge" />
        </div>
        <div class="column-body" ref="processingBodyRef" @dragover.prevent @drop="handleDrop($event, 'processing')">
          <el-empty v-if="processingOrders.length === 0" description="暂无进行中订单" :image-size="60" />
          <div
            v-for="order in processingOrders"
            :key="order.id"
            class="order-card processing-card"
            draggable="true"
            @dragstart="handleDragStart($event, order, 'processing')"
          >
            <div class="card-top">
              <span class="order-no">{{ order.orderNo }}</span>
              <el-tag size="small" type="warning">{{ order.statusText }}</el-tag>
            </div>
            <div class="card-body">
              <div class="card-line">
                <el-icon><User /></el-icon>
                <span>{{ order.customer }}</span>
              </div>
              <div class="card-line rider-line" v-if="order.rider">
                <el-icon><Van /></el-icon>
                <span>{{ order.rider.name }} ({{ order.rider.phone }})</span>
              </div>
            </div>
            <div class="card-bottom">
              <span class="card-amount">¥{{ order.amount.toFixed(2) }}</span>
            </div>
            <div class="card-actions">
              <el-button size="small" type="success" @click="completeOrder(order)">标记完成</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="kanban-column completed-column">
        <div class="column-header">
          <span class="column-title">已完成</span>
          <el-badge :value="completedOrders.length" class="column-badge" />
        </div>
        <div class="column-body" ref="completedBodyRef" @dragover.prevent @drop="handleDrop($event, 'completed')">
          <el-empty v-if="completedOrders.length === 0" description="暂无已完成订单" :image-size="60" />
          <div
            v-for="order in completedOrders"
            :key="order.id"
            class="order-card completed-card"
            draggable="true"
            @dragstart="handleDragStart($event, order, 'completed')"
          >
            <div class="card-top">
              <span class="order-no">{{ order.orderNo }}</span>
              <el-tag size="small" type="success">已完成</el-tag>
            </div>
            <div class="card-body">
              <div class="card-line">
                <el-icon><User /></el-icon>
                <span>{{ order.customer }}</span>
              </div>
              <div class="card-line">
                <el-icon><Clock /></el-icon>
                <span>{{ order.completeTime }}</span>
              </div>
            </div>
            <div class="card-bottom">
              <span class="card-amount">¥{{ order.amount.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh, ArrowDown, User, Goods, Clock, Van } from "@element-plus/icons-vue";

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

interface Order {
  id: string;
  orderNo: string;
  platform: string;
  customer: string;
  amount: number;
  itemCount: number;
  items: OrderItem[];
  remark?: string;
  createTime: string;
  createTimestamp: number;
  status: "pending" | "processing" | "completed";
  statusText?: string;
  rider?: { name: string; phone: string };
  completeTime?: string;
}

const soundEnabled = ref(true);
const autoAccept = ref(false);
const refreshInterval = ref(60);
const newOrderPopupVisible = ref(false);
const popupOrder = ref<Order | null>(null);
const countdown = ref(60);
const showRejectReasons = ref(false);
const rejectReason = ref("");
const selectedOrders = ref<string[]>([]);

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let orderCountdownTimer: ReturnType<typeof setInterval> | null = null;

const pendingBodyRef = ref<HTMLElement>();
const processingBodyRef = ref<HTMLElement>();
const completedBodyRef = ref<HTMLElement>();

const orders = ref<Order[]>([
  {
    id: "1",
    orderNo: "JD20240115001",
    platform: "jd",
    customer: "张先生 138****5678",
    amount: 89.5,
    itemCount: 3,
    items: [
      { id: "i1", name: "农夫山泉 550ml", qty: 2, price: 2.5 },
      { id: "i2", name: "乐事薯片 原味", qty: 1, price: 8.5 }
    ],
    remark: "请尽快送达，谢谢！",
    createTime: "10:30:00",
    createTimestamp: Date.now() - 15000,
    status: "pending"
  },
  {
    id: "2",
    orderNo: "MT20240115002",
    platform: "meituan",
    customer: "李女士 139****1234",
    amount: 156.8,
    itemCount: 5,
    items: [
      { id: "i3", name: "可口可乐 330ml", qty: 3, price: 3.5 },
      { id: "i4", name: "康师傅方便面", qty: 2, price: 5.5 }
    ],
    createTime: "10:28:00",
    createTimestamp: Date.now() - 45000,
    status: "pending"
  },
  {
    id: "3",
    orderNo: "JD20240115003",
    platform: "jd",
    customer: "王先生 137****9876",
    amount: 220.0,
    itemCount: 8,
    items: [
      { id: "i5", name: "伊利纯牛奶 250ml", qty: 6, price: 3.5 },
      { id: "i6", name: "奥利奥饼干", qty: 2, price: 12.5 }
    ],
    createTime: "10:25:00",
    createTimestamp: Date.now() - 120000,
    status: "processing",
    statusText: "备货中",
    rider: { name: "张师傅", phone: "138****1111" }
  },
  {
    id: "4",
    orderNo: "MT20240115004",
    platform: "meituan",
    customer: "赵女士 136****5555",
    amount: 45.9,
    itemCount: 2,
    items: [
      { id: "i7", name: "脉动 青柠味", qty: 2, price: 6.0 }
    ],
    createTime: "10:20:00",
    createTimestamp: Date.now() - 180000,
    status: "processing",
    statusText: "配送中",
    rider: { name: "李师傅", phone: "139****2222" }
  },
  {
    id: "5",
    orderNo: "JD20240115005",
    platform: "jd",
    customer: "孙先生 135****7777",
    amount: 128.0,
    itemCount: 4,
    items: [
      { id: "i8", name: "三只松鼠坚果", qty: 1, price: 59.9 },
      { id: "i9", name: "百草味果干", qty: 1, price: 35.9 }
    ],
    createTime: "10:15:00",
    createTimestamp: Date.now() - 300000,
    status: "completed",
    completeTime: "10:45:00"
  }
]);

const pendingOrders = computed(() => orders.value.filter((o) => o.status === "pending"));
const processingOrders = computed(() => orders.value.filter((o) => o.status === "processing"));
const completedOrders = computed(() => orders.value.filter((o) => o.status === "completed"));

const countdownClass = computed(() => {
  if (countdown.value > 40) return "countdown-green";
  if (countdown.value > 20) return "countdown-yellow";
  return "countdown-red";
});

const countdownGradient = computed(() => {
  if (countdown.value > 40) return CHART_COLORS.success;
  if (countdown.value > 20) return CHART_COLORS.warning;
  return CHART_COLORS.danger;
});

function getPlatformName(platform?: string) {
  const map: Record<string, string> = {
    jd: "京东秒送",
    meituan: "美团外卖",
    eleme: "饿了么"
  };
  return map[platform || ""] || platform;
}

function getOrderCountdown(order: Order) {
  const elapsed = (Date.now() - order.createTimestamp) / 1000;
  const remaining = Math.max(0, 60 - elapsed);
  return Math.floor(remaining);
}

function getCountdownClass(order: Order) {
  const remaining = getOrderCountdown(order);
  if (remaining > 40) return "countdown-green";
  if (remaining > 20) return "countdown-yellow";
  return "countdown-red";
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value;
  ElMessage.info(soundEnabled.value ? "新订单音效已开启" : "新订单音效已关闭");
}

function handleIntervalChange(val: number) {
  stopRefreshTimer();
  startRefreshTimer();
}

function loadData() {
  ElMessage.success("数据已刷新");
}

function handleBatchCommand(cmd: string) {
  if (cmd === "selectAll") {
    if (selectedOrders.value.length === pendingOrders.value.length) {
      selectedOrders.value = [];
    } else {
      selectedOrders.value = pendingOrders.value.map((o) => o.id);
    }
  } else if (cmd === "acceptAll") {
    if (selectedOrders.value.length === 0) {
      ElMessage.warning("请先选择要接单的订单");
      return;
    }
    ElMessage.success(`已批量接单 ${selectedOrders.value.length} 单`);
    selectedOrders.value.forEach((id) => {
      const order = orders.value.find((o) => o.id === id);
      if (order) {
        order.status = "processing";
        order.statusText = "备货中";
      }
    });
    selectedOrders.value = [];
  } else if (cmd === "rejectAll") {
    if (selectedOrders.value.length === 0) {
      ElMessage.warning("请先选择要拒单的订单");
      return;
    }
    ElMessageBox.confirm(`确定要批量拒单 ${selectedOrders.value.length} 单吗？`, "批量拒单确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    })
      .then(() => {
        orders.value = orders.value.filter((o) => !selectedOrders.value.includes(o.id));
        selectedOrders.value = [];
        ElMessage.success("批量拒单成功");
      })
      .catch(() => {});
  }
}

function acceptOrder(order: Order) {
  order.status = "processing";
  order.statusText = "备货中";
  ElMessage.success(`订单 ${order.orderNo} 已接单`);
  if (popupOrder.value?.id === order.id) {
    newOrderPopupVisible.value = false;
    stopCountdown();
  }
}

function acceptPopupOrder() {
  if (popupOrder.value) {
    acceptOrder(popupOrder.value);
  }
}

function rejectOrder(order: Order) {
  ElMessageBox.confirm(`确定要拒单吗？订单号：${order.orderNo}`, "拒单确认", {
    confirmButtonText: "确定拒单",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      const idx = orders.value.findIndex((o) => o.id === order.id);
      if (idx > -1) {
        orders.value.splice(idx, 1);
      }
      ElMessage.success("已拒单");
      if (popupOrder.value?.id === order.id) {
        newOrderPopupVisible.value = false;
        stopCountdown();
      }
    })
    .catch(() => {});
}

function completeOrder(order: Order) {
  order.status = "completed";
  order.completeTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  ElMessage.success(`订单 ${order.orderNo} 已完成`);
}

let draggedOrder: Order | null = null;
let dragSource = "";

function handleDragStart(e: DragEvent, order: Order, source: string) {
  draggedOrder = order;
  dragSource = source;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", order.id);
  }
}

function handleDrop(e: DragEvent, target: string) {
  if (!draggedOrder || dragSource === target) return;
  const order = orders.value.find((o) => o.id === draggedOrder!.id);
  if (!order) return;

  if (target === "pending") {
    order.status = "pending";
    order.statusText = undefined;
    order.rider = undefined;
  } else if (target === "processing") {
    order.status = "processing";
    order.statusText = "备货中";
  } else if (target === "completed") {
    order.status = "completed";
    order.completeTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  draggedOrder = null;
  dragSource = "";
}

function startCountdown() {
  stopCountdown();
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      stopCountdown();
      newOrderPopupVisible.value = false;
      if (autoAccept.value && popupOrder.value) {
        acceptOrder(popupOrder.value);
      }
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startRefreshTimer() {
  stopRefreshTimer();
  refreshTimer = setInterval(() => {
    loadData();
  }, refreshInterval.value * 1000);
}

function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startOrderCountdown() {
  orderCountdownTimer = setInterval(() => {}, 1000);
}

function stopOrderCountdown() {
  if (orderCountdownTimer) {
    clearInterval(orderCountdownTimer);
    orderCountdownTimer = null;
  }
}

onMounted(() => {
  startRefreshTimer();
  startOrderCountdown();
  if (pendingOrders.value.length > 0) {
    popupOrder.value = pendingOrders.value[0];
    newOrderPopupVisible.value = true;
    startCountdown();
  }
});

onBeforeUnmount(() => {
  stopCountdown();
  stopRefreshTimer();
  stopOrderCountdown();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.toolbar-card {
  margin-bottom: 16px;
  border: 1px solid var(--border-light);
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.toolbar-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-700);
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.kanban-board {
  display: flex;
  gap: 16px;
  min-height: 600px;
}
.kanban-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  border-radius: 8px;
  overflow: hidden;
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  color: #fff;
}
.pending-column .column-header {
  background: linear-gradient(135deg, var(--color-primary) 0%, rgba(63, 111, 239, 0.4) 100%);
}
.processing-column .column-header {
  background: linear-gradient(135deg, var(--color-warning) 0%, rgba(212, 139, 58, 0.4) 100%);
}
.completed-column .column-header {
  background: linear-gradient(135deg, var(--color-success) 0%, rgba(14, 168, 121, 0.4) 100%);
}
.column-title {
  font-size: 15px;
}
.column-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
}
.order-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: grab;
  transition: all 0.2s;
  position: relative;
}
.order-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}
.order-card:active {
  cursor: grabbing;
}
.card-selected {
  border: 2px solid var(--color-primary);
}
.card-checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}
.pending-card {
  border-left: 4px solid var(--color-primary);
}
.processing-card {
  border-left: 4px solid var(--color-warning);
}
.completed-card {
  border-left: 4px solid var(--color-success);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.order-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
}
.card-body {
  margin-bottom: 8px;
}
.card-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gray-600);
  margin-bottom: 4px;
}
.rider-line {
  color: var(--color-warning);
}
.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-danger);
}
.card-countdown {
  font-size: 14px;
  font-weight: 600;
  font-family: "Courier New", monospace;
}
.card-countdown.countdown-green {
  color: var(--color-success);
}
.card-countdown.countdown-yellow {
  color: var(--color-warning);
}
.card-countdown.countdown-red {
  color: var(--color-danger);
}
.card-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--gray-400);
  margin-bottom: 10px;
}
.card-actions {
  display: flex;
  gap: 8px;
}
.card-actions .el-button {
  flex: 1;
}

.new-order-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  animation: pulse 2s infinite;
}
.new-order-dialog :deep(.el-dialog__header) {
  display: none;
}
.new-order-dialog :deep(.el-dialog__body) {
  padding: 0;
}
.new-order-dialog :deep(.el-dialog__footer) {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light);
}
.popup-header {
  background: linear-gradient(135deg, var(--color-danger) 0%, rgba(192, 57, 43, 0.4) 100%);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.popup-countdown {
  display: flex;
  align-items: center;
  gap: 12px;
}
.countdown-bar {
  width: 120px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}
.countdown-progress {
  height: 100%;
  border-radius: 4px;
  transition: width 1s linear, background 0.5s;
}
.countdown-text {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  font-family: "Courier New", monospace;
}
.popup-body {
  padding: 16px 20px;
}
.order-row {
  display: flex;
  margin-bottom: 10px;
  font-size: 14px;
}
.order-label {
  color: var(--gray-400);
  min-width: 70px;
}
.order-value {
  color: var(--gray-700);
  font-weight: 500;
}
.order-amount {
  color: var(--color-danger);
  font-size: 18px;
  font-weight: 600;
}
.order-items-section {
  margin-top: 12px;
  margin-bottom: 12px;
}
.order-items-list {
  margin-top: 8px;
  background: var(--bg-page);
  padding: 8px 12px;
  border-radius: 4px;
}
.order-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--gray-600);
  padding: 4px 0;
}
.item-name {
  flex: 1;
}
.item-qty {
  color: var(--gray-400);
}
.order-remark {
  margin-top: 10px;
  font-size: 13px;
}
.remark-text {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  padding: 4px 8px;
  border-radius: 4px;
}
.popup-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(245, 108, 108, 0);
  }
}

.popup-enter-active,
.popup-leave-active {
  transition: all 0.3s ease;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}
</style>
