<template>
  <div class="pickup-page">
    <!-- 顶部状态栏 -->
    <el-card class="stats-card" shadow="never">
      <div class="stats-bar">
        <div class="stat-item pending-stat">
          <div class="stat-icon"><el-icon :size="28"><Bell /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">待接单</div>
          </div>
        </div>
        <div class="stat-item accepted-stat">
          <div class="stat-icon"><el-icon :size="28"><Check /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ acceptedCount }}</div>
            <div class="stat-label">已接单</div>
          </div>
        </div>
        <div class="stat-item today-stat">
          <div class="stat-icon"><el-icon :size="28"><Tickets /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ todayOrderCount }}</div>
            <div class="stat-label">今日订单</div>
          </div>
        </div>
        <div class="stat-item avg-stat">
          <div class="stat-icon"><el-icon :size="28"><Timer /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ avgResponseTime }}s</div>
            <div class="stat-label">平均响应</div>
          </div>
        </div>
        <div class="stats-actions">
          <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
        </div>
      </div>
    </el-card>

    <div class="main-content">
      <!-- 左侧筛选 -->
      <el-card class="filter-card" shadow="never">
        <div class="filter-section">
          <div class="filter-title">平台筛选</div>
          <div class="filter-options">
            <el-tag
              v-for="p in platformOptions"
              :key="p.value"
              :type="selectedPlatforms.includes(p.value) ? '' : 'info'"
              :effect="selectedPlatforms.includes(p.value) ? 'dark' : 'plain'"
              class="filter-tag"
              @click="togglePlatform(p.value)"
            >
              {{ p.label }}
            </el-tag>
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-title">配送方式</div>
          <div class="filter-options">
            <el-tag
              v-for="d in deliveryOptions"
              :key="d.value"
              :type="selectedDelivery.includes(d.value) ? '' : 'info'"
              :effect="selectedDelivery.includes(d.value) ? 'dark' : 'plain'"
              class="filter-tag"
              @click="toggleDelivery(d.value)"
            >
              {{ d.label }}
            </el-tag>
          </div>
        </div>
      </el-card>

      <!-- 中间主区域 -->
      <div class="order-area">
        <el-tabs v-model="activeTab" class="order-tabs" stretch>
          <!-- 新订单 Tab -->
          <el-tab-pane label="新订单" name="new">
            <div class="new-orders-section">
              <div v-if="filteredNewOrders.length === 0" class="empty-state">
                <el-empty description="暂无新订单" :image-size="100" />
                <div class="empty-tip">所有订单已处理，保持关注~</div>
              </div>
              <div v-else class="order-cards-row">
                <div
                  v-for="order in filteredNewOrders.slice(0, maxVisibleCards)"
                  :key="order.id"
                  class="order-card-new"
                  :class="{ 'urgent': getRemainingSeconds(order) <= 10 }"
                >
                  <!-- 顶部倒计时进度条 -->
                  <div class="countdown-bar-top">
                    <div
                      class="countdown-progress-top"
                      :style="{
                        width: (getRemainingSeconds(order) / 60) * 100 + '%',
                        background: getCountdownColor(order)
                      }"
                    ></div>
                  </div>

                  <div class="card-header">
                    <el-tag
                      size="small"
                      :type="getPlatformTagType(order.platform)"
                      effect="dark"
                    >
                      {{ getPlatformName(order.platform) }}
                    </el-tag>
                    <div class="countdown-display" :class="getCountdownClass(order)">
                      <el-icon><Clock /></el-icon>
                      <span class="countdown-num">{{ getRemainingSeconds(order) }}s</span>
                    </div>
                  </div>

                  <div class="card-body">
                    <div class="order-no-row">
                      <span class="order-no-text">{{ order.orderNo }}</span>
                      <span class="order-amount">¥{{ order.amount.toFixed(2) }}</span>
                    </div>

                    <div class="goods-list">
                      <div v-for="item in order.items" :key="item.id" class="goods-item">
                        <span class="goods-name">{{ item.name }}</span>
                        <span class="goods-qty">x{{ item.qty }}</span>
                      </div>
                      <div v-if="order.items.length > 3" class="goods-more">
                        还有 {{ order.items.length - 3 }} 件商品...
                      </div>
                    </div>

                    <div class="receiver-info">
                      <div class="info-line">
                        <el-icon><User /></el-icon>
                        <span>{{ order.receiverName }}</span>
                        <span class="receiver-phone">{{ order.receiverPhone }}</span>
                      </div>
                      <div class="info-line">
                        <el-icon><Location /></el-icon>
                        <span class="address-text">{{ order.address }}</span>
                      </div>
                      <div class="info-line">
                        <el-icon><Van /></el-icon>
                        <span>{{ getDeliveryName(order.deliveryType) }}</span>
                        <span class="distance">{{ order.distance }}km</span>
                      </div>
                    </div>

                    <div v-if="order.remark" class="order-remark-box">
                      <el-icon><ChatDotRound /></el-icon>
                      <span class="remark-text">{{ order.remark }}</span>
                    </div>
                  </div>

                  <div class="card-actions">
                    <el-button type="danger" plain @click="openRejectDialog(order)">拒单</el-button>
                    <el-button type="success" class="accept-btn" @click="acceptOrder(order)">
                      <span class="btn-text">接单</span>
                    </el-button>
                  </div>
                </div>
              </div>

              <div v-if="filteredNewOrders.length > maxVisibleCards" class="more-orders-tip">
                还有 {{ filteredNewOrders.length - maxVisibleCards }} 个新订单等待处理
              </div>
            </div>
          </el-tab-pane>

          <!-- 已接单 Tab -->
          <el-tab-pane :label="`已接单 (${acceptedOrders.length})`" name="accepted">
            <div class="order-list-section">
              <el-table :data="acceptedOrders" stripe style="width: 100%">
                <el-table-column prop="orderNo" label="订单号" width="200" />
                <el-table-column label="平台" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getPlatformTagType(row.platform)">
                      {{ getPlatformName(row.platform) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="receiverName" label="收货人" width="120" />
                <el-table-column prop="itemCount" label="商品数" width="80" align="center" />
                <el-table-column label="金额" width="120" align="right">
                  <template #default="{ row }">
                    <span style="color: #f56c6c; font-weight: 600">¥{{ row.amount.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="statusText" label="状态" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" type="warning">{{ row.statusText }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="acceptTime" label="接单时间" width="180" />
                <el-table-column label="操作" width="150" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" link @click="completeOrder(row)">
                      标记完成
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <!-- 已完成 Tab -->
          <el-tab-pane :label="`已完成 (${completedOrders.length})`" name="completed">
            <div class="order-list-section">
              <el-table :data="completedOrders" stripe style="width: 100%">
                <el-table-column prop="orderNo" label="订单号" width="200" />
                <el-table-column label="平台" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getPlatformTagType(row.platform)">
                      {{ getPlatformName(row.platform) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="receiverName" label="收货人" width="120" />
                <el-table-column prop="itemCount" label="商品数" width="80" align="center" />
                <el-table-column label="金额" width="120" align="right">
                  <template #default="{ row }">
                    <span style="color: #f56c6c; font-weight: 600">¥{{ row.amount.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="responseTime" label="响应时间" width="120" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" type="success">{{ row.responseTime }}s</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="completeTime" label="完成时间" width="180" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 右侧边栏 -->
      <el-card class="sidebar-card" shadow="never">
        <div class="sidebar-section">
          <div class="sidebar-title">操作设置</div>
          <div class="setting-item">
            <div class="setting-label">
              <el-icon><Bell /></el-icon>
              <span>语音提示</span>
            </div>
            <el-switch v-model="voiceEnabled" active-text="开" inactive-text="关" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <el-icon><Switch /></el-icon>
              <span>自动接单</span>
            </div>
            <el-switch v-model="autoAcceptEnabled" active-text="开" inactive-text="关" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <el-icon><Timer /></el-icon>
              <span>超时自动接单</span>
            </div>
            <el-switch v-model="timeoutAutoAccept" active-text="开" inactive-text="关" />
          </div>
        </div>

        <el-divider />

        <div class="sidebar-section">
          <div class="sidebar-title">今日接单统计</div>
          <div class="stat-ring">
            <svg viewBox="0 0 100 100" class="ring-svg">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#ebeef5" stroke-width="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#67c23a"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="2 * Math.PI * 42"
                :stroke-dashoffset="2 * Math.PI * 42 * (1 - acceptRate / 100)"
                transform="rotate(-90 50 50)"
                class="ring-progress"
              />
            </svg>
            <div class="ring-content">
              <div class="ring-value">{{ acceptRate }}%</div>
              <div class="ring-label">接单率</div>
            </div>
          </div>
          <div class="stat-detail-list">
            <div class="stat-detail-item">
              <span class="detail-label">总订单</span>
              <span class="detail-value">{{ todayOrderCount }}</span>
            </div>
            <div class="stat-detail-item">
              <span class="detail-label">已接单</span>
              <span class="detail-value success">{{ acceptedTodayCount }}</span>
            </div>
            <div class="stat-detail-item">
              <span class="detail-label">已拒单</span>
              <span class="detail-value danger">{{ rejectedTodayCount }}</span>
            </div>
            <div class="stat-detail-item">
              <span class="detail-label">平均响应</span>
              <span class="detail-value">{{ avgResponseTime }}s</span>
            </div>
          </div>
        </div>

        <el-divider />

        <div class="sidebar-section">
          <div class="sidebar-title">平台分布</div>
          <div class="platform-bar-list">
            <div v-for="p in platformStats" :key="p.platform" class="platform-bar-item">
              <div class="platform-bar-label">
                <el-tag size="small" :type="getPlatformTagType(p.platform)">
                  {{ getPlatformName(p.platform) }}
                </el-tag>
                <span class="platform-count">{{ p.count }}单</span>
              </div>
              <div class="platform-bar-bg">
                <div
                  class="platform-bar-fill"
                  :style="{
                    width: p.percent + '%',
                    background: getPlatformColor(p.platform)
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 拒单弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="拒单原因" width="480px">
      <el-form :model="rejectForm" label-width="100px">
        <el-form-item label="订单号">
          <span>{{ rejectOrder?.orderNo }}</span>
        </el-form-item>
        <el-form-item label="拒单原因" required>
          <el-radio-group v-model="rejectForm.reason">
            <el-radio label="sold_out">商品已售罄</el-radio>
            <el-radio label="out_of_range">配送范围外</el-radio>
            <el-radio label="closed">门店已打烊</el-radio>
            <el-radio label="other">其他原因</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" v-if="rejectForm.reason === 'other'">
          <el-input
            v-model="rejectForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入拒单原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认拒单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Bell,
  Check,
  Tickets,
  Timer,
  Refresh,
  Clock,
  User,
  Location,
  Van,
  Switch,
  ChatDotRound
} from "@element-plus/icons-vue";

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
  receiverName: string;
  receiverPhone: string;
  address: string;
  deliveryType: string;
  distance: number;
  amount: number;
  itemCount: number;
  items: OrderItem[];
  remark?: string;
  createTime: string;
  createTimestamp: number;
  acceptTimestamp?: number;
  status: "pending" | "accepted" | "completed" | "rejected";
  statusText?: string;
  acceptTime?: string;
  completeTime?: string;
  responseTime?: number;
}

// 配置
const maxVisibleCards = 3;

// 状态
const activeTab = ref("new");
const voiceEnabled = ref(true);
const autoAcceptEnabled = ref(false);
const timeoutAutoAccept = ref(true);
const selectedPlatforms = ref<string[]>([]);
const selectedDelivery = ref<string[]>([]);
const rejectDialogVisible = ref(false);
const rejectOrder = ref<Order | null>(null);
const rejectForm = ref({
  reason: "",
  remark: ""
});

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let nowTimestamp = ref(Date.now());

// Mock 数据
const orders = ref<Order[]>([
  {
    id: "1",
    orderNo: "JD202607160001",
    platform: "jd",
    receiverName: "张先生",
    receiverPhone: "138****5678",
    address: "北京市朝阳区建国路88号SOHO现代城A座1201",
    deliveryType: "platform",
    distance: 1.2,
    amount: 89.5,
    itemCount: 3,
    items: [
      { id: "i1", name: "农夫山泉 550ml", qty: 2, price: 2.5 },
      { id: "i2", name: "乐事薯片 原味 75g", qty: 1, price: 8.5 }
    ],
    remark: "请尽快送达，谢谢！",
    createTime: "10:30:00",
    createTimestamp: Date.now() - 15000,
    status: "pending"
  },
  {
    id: "2",
    orderNo: "MT202607160002",
    platform: "meituan",
    receiverName: "李女士",
    receiverPhone: "139****1234",
    address: "北京市海淀区中关村大街1号海龙大厦5层",
    deliveryType: "self",
    distance: 0.8,
    amount: 156.8,
    itemCount: 5,
    items: [
      { id: "i3", name: "可口可乐 330ml", qty: 3, price: 3.5 },
      { id: "i4", name: "康师傅红烧牛肉面", qty: 2, price: 5.5 }
    ],
    createTime: "10:28:00",
    createTimestamp: Date.now() - 45000,
    status: "pending"
  },
  {
    id: "3",
    orderNo: "ELM202607160003",
    platform: "eleme",
    receiverName: "王先生",
    receiverPhone: "137****9876",
    address: "北京市西城区金融街7号英蓝国际金融中心B1层",
    deliveryType: "platform",
    distance: 2.5,
    amount: 220.0,
    itemCount: 8,
    items: [
      { id: "i5", name: "伊利纯牛奶 250ml", qty: 6, price: 3.5 },
      { id: "i6", name: "奥利奥原味饼干 116g", qty: 2, price: 12.5 }
    ],
    createTime: "10:25:00",
    createTimestamp: Date.now() - 8000,
    status: "pending"
  },
  {
    id: "4",
    orderNo: "JD202607160004",
    platform: "jd",
    receiverName: "赵女士",
    receiverPhone: "136****5555",
    address: "北京市东城区王府井大街138号新东安市场3层",
    deliveryType: "platform",
    distance: 1.8,
    amount: 45.9,
    itemCount: 2,
    items: [{ id: "i7", name: "脉动青柠味 600ml", qty: 2, price: 6.0 }],
    createTime: "10:20:00",
    createTimestamp: Date.now() - 600000,
    acceptTimestamp: Date.now() - 540000,
    status: "accepted",
    statusText: "备货中",
    acceptTime: "10:21:30",
    responseTime: 30
  },
  {
    id: "5",
    orderNo: "MT202607160005",
    platform: "meituan",
    receiverName: "孙先生",
    receiverPhone: "135****7777",
    address: "北京市丰台区丰台路5号",
    deliveryType: "self",
    distance: 3.2,
    amount: 128.0,
    itemCount: 4,
    items: [
      { id: "i8", name: "三只松鼠每日坚果 750g", qty: 1, price: 59.9 },
      { id: "i9", name: "百草味芒果干 120g", qty: 1, price: 35.9 }
    ],
    createTime: "10:15:00",
    createTimestamp: Date.now() - 1800000,
    acceptTimestamp: Date.now() - 1740000,
    status: "completed",
    acceptTime: "10:16:00",
    completeTime: "10:45:00",
    responseTime: 25
  },
  {
    id: "6",
    orderNo: "ELM202607160006",
    platform: "eleme",
    receiverName: "周女士",
    receiverPhone: "134****8888",
    address: "北京市朝阳区三里屯太古里南区",
    deliveryType: "platform",
    distance: 1.5,
    amount: 68.5,
    itemCount: 3,
    items: [{ id: "i10", name: "元气森林白桃味 480ml", qty: 3, price: 6.5 }],
    createTime: "09:50:00",
    createTimestamp: Date.now() - 2400000,
    acceptTimestamp: Date.now() - 2340000,
    status: "completed",
    acceptTime: "09:51:00",
    completeTime: "10:20:00",
    responseTime: 18
  }
]);

// 平台选项
const platformOptions = [
  { value: "jd", label: "京东秒送" },
  { value: "meituan", label: "美团外卖" },
  { value: "eleme", label: "饿了么" }
];

// 配送方式选项
const deliveryOptions = [
  { value: "platform", label: "平台配送" },
  { value: "self", label: "商家自配" }
];

// 计算属性
const newOrders = computed(() => orders.value.filter((o) => o.status === "pending"));
const acceptedOrders = computed(() => orders.value.filter((o) => o.status === "accepted"));
const completedOrders = computed(() => orders.value.filter((o) => o.status === "completed"));

const pendingCount = computed(() => newOrders.value.length);
const acceptedCount = computed(() => acceptedOrders.value.length);
const todayOrderCount = computed(() => orders.value.length);
const acceptedTodayCount = computed(
  () => orders.value.filter((o) => o.status === "accepted" || o.status === "completed").length
);
const rejectedTodayCount = computed(
  () => orders.value.filter((o) => o.status === "rejected").length
);

const avgResponseTime = computed(() => {
  const completed = orders.value.filter((o) => o.responseTime);
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, o) => sum + (o.responseTime || 0), 0);
  return Math.round(total / completed.length);
});

const acceptRate = computed(() => {
  const total = acceptedTodayCount.value + rejectedTodayCount.value;
  if (total === 0) return 0;
  return Math.round((acceptedTodayCount.value / total) * 100);
});

const platformStats = computed(() => {
  const stats: Record<string, number> = {};
  orders.value.forEach((o) => {
    stats[o.platform] = (stats[o.platform] || 0) + 1;
  });
  const max = Math.max(...Object.values(stats), 1);
  return Object.entries(stats).map(([platform, count]) => ({
    platform,
    count,
    percent: Math.round((count / max) * 100)
  }));
});

const filteredNewOrders = computed(() => {
  let list = [...newOrders.value];
  if (selectedPlatforms.value.length > 0) {
    list = list.filter((o) => selectedPlatforms.value.includes(o.platform));
  }
  if (selectedDelivery.value.length > 0) {
    list = list.filter((o) => selectedDelivery.value.includes(o.deliveryType));
  }
  // 按剩余时间升序，紧急的在前
  list.sort((a, b) => getRemainingSeconds(a) - getRemainingSeconds(b));
  return list;
});

// 方法
function getPlatformName(platform: string) {
  const map: Record<string, string> = {
    jd: "京东秒送",
    meituan: "美团外卖",
    eleme: "饿了么"
  };
  return map[platform] || platform;
}

function getPlatformTagType(platform: string) {
  const map: Record<string, "danger" | "warning" | "primary" | "success"> = {
    jd: "danger",
    meituan: "warning",
    eleme: "primary"
  };
  return map[platform] || "info";
}

function getPlatformColor(platform: string) {
  const map: Record<string, string> = {
    jd: "#f56c6c",
    meituan: "#e6a23c",
    eleme: "#409eff"
  };
  return map[platform] || "#909399";
}

function getDeliveryName(type: string) {
  const map: Record<string, string> = {
    platform: "平台配送",
    self: "商家自配"
  };
  return map[type] || type;
}

function getRemainingSeconds(order: Order) {
  const elapsed = (nowTimestamp.value - order.createTimestamp) / 1000;
  return Math.max(0, Math.floor(60 - elapsed));
}

function getCountdownClass(order: Order) {
  const remaining = getRemainingSeconds(order);
  if (remaining > 40) return "countdown-green";
  if (remaining > 20) return "countdown-yellow";
  return "countdown-red";
}

function getCountdownColor(order: Order) {
  const remaining = getRemainingSeconds(order);
  if (remaining > 40) return "#67c23a";
  if (remaining > 20) return "#e6a23c";
  return "#f56c6c";
}

function togglePlatform(platform: string) {
  const idx = selectedPlatforms.value.indexOf(platform);
  if (idx > -1) {
    selectedPlatforms.value.splice(idx, 1);
  } else {
    selectedPlatforms.value.push(platform);
  }
}

function toggleDelivery(delivery: string) {
  const idx = selectedDelivery.value.indexOf(delivery);
  if (idx > -1) {
    selectedDelivery.value.splice(idx, 1);
  } else {
    selectedDelivery.value.push(delivery);
  }
}

function handleRefresh() {
  nowTimestamp.value = Date.now();
  ElMessage.success("数据已刷新");
}

function acceptOrder(order: Order) {
  const target = orders.value.find((o) => o.id === order.id);
  if (!target) return;
  target.status = "accepted";
  target.statusText = "备货中";
  target.acceptTimestamp = Date.now();
  target.acceptTime = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  target.responseTime = Math.round((Date.now() - target.createTimestamp) / 1000);
  ElMessage.success(`订单 ${target.orderNo} 已接单`);
  if (voiceEnabled.value) {
    // 语音提示模拟
  }
}

function openRejectDialog(order: Order) {
  rejectOrder.value = order;
  rejectForm.value = { reason: "", remark: "" };
  rejectDialogVisible.value = true;
}

function confirmReject() {
  if (!rejectForm.value.reason) {
    ElMessage.warning("请选择拒单原因");
    return;
  }
  const target = orders.value.find((o) => o.id === rejectOrder.value?.id);
  if (target) {
    target.status = "rejected";
  }
  rejectDialogVisible.value = false;
  ElMessage.success("已拒单");
}

function completeOrder(order: Order) {
  const target = orders.value.find((o) => o.id === order.id);
  if (!target) return;
  target.status = "completed";
  target.completeTime = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  ElMessage.success(`订单 ${target.orderNo} 已完成`);
}

// 启动倒计时
function startCountdown() {
  countdownTimer = setInterval(() => {
    nowTimestamp.value = Date.now();

    // 检查超时自动接单
    if (timeoutAutoAccept.value) {
      newOrders.value.forEach((order) => {
        if (getRemainingSeconds(order) <= 0) {
          acceptOrder(order);
          ElMessage.warning(`订单 ${order.orderNo} 超时已自动接单`);
        }
      });
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

onMounted(() => {
  startCountdown();
});

onBeforeUnmount(() => {
  stopCountdown();
});
</script>

<style scoped>
.pickup-page {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
}

/* 顶部状态栏 */
.stats-card {
  margin-bottom: 16px;
  border-radius: 12px;
  border: none;
}
.stats-bar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 4px 0;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.pending-stat .stat-icon {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
}
.accepted-stat .stat-icon {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}
.today-stat .stat-icon {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
}
.avg-stat .stat-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
}
.stat-info {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.stats-actions {
  margin-left: auto;
}

/* 主内容区 */
.main-content {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

/* 左侧筛选 */
.filter-card {
  width: 200px;
  flex-shrink: 0;
  border-radius: 12px;
  border: none;
}
.filter-section {
  margin-bottom: 8px;
}
.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-tag {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.filter-tag:hover {
  transform: translateY(-1px);
}

/* 中间订单区 */
.order-area {
  flex: 1;
  min-width: 0;
}
.order-tabs {
  background: #fff;
  border-radius: 12px;
  padding: 0 16px;
  border: none;
}
.order-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.new-orders-section {
  min-height: 400px;
}
.empty-state {
  text-align: center;
  padding: 60px 0;
}
.empty-tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px;
}

/* 订单卡片 */
.order-cards-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.order-card-new {
  flex: 1;
  min-width: 300px;
  max-width: calc(33.33% - 11px);
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
  position: relative;
  border: 1px solid #ebeef5;
}
.order-card-new:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}
.order-card-new.urgent {
  animation: urgentPulse 1s infinite;
}
@keyframes urgentPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(245, 108, 108, 0);
  }
}

/* 顶部倒计时进度条 */
.countdown-bar-top {
  height: 6px;
  background: #ebeef5;
  overflow: hidden;
}
.countdown-progress-top {
  height: 100%;
  transition: width 1s linear, background 0.5s;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}
.countdown-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-family: "Courier New", monospace;
  font-size: 15px;
}
.countdown-green {
  color: #67c23a;
}
.countdown-yellow {
  color: #e6a23c;
}
.countdown-red {
  color: #f56c6c;
}

.card-body {
  padding: 16px;
}
.order-no-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.order-no-text {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.order-amount {
  font-size: 20px;
  font-weight: 700;
  color: #f56c6c;
}

.goods-list {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.goods-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  padding: 3px 0;
}
.goods-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.goods-qty {
  color: #909399;
  margin-left: 8px;
}
.goods-more {
  font-size: 12px;
  color: #909399;
  text-align: center;
  padding-top: 4px;
  border-top: 1px dashed #e4e7ed;
  margin-top: 4px;
}

.receiver-info {
  margin-bottom: 12px;
}
.info-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}
.info-line .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: #909399;
}
.receiver-phone {
  color: #909399;
  margin-left: 8px;
}
.address-text {
  flex: 1;
  line-height: 1.4;
}
.distance {
  color: #409eff;
  margin-left: auto;
}

.order-remark-box {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  background: #fdf6ec;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: #e6a23c;
}
.order-remark-box .el-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.remark-text {
  line-height: 1.4;
}

.card-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #f0f2f5;
}
.card-actions .el-button {
  flex: 1;
  height: 38px;
  font-size: 14px;
}
.accept-btn {
  animation: btnBlink 2s ease-in-out infinite;
}
@keyframes btnBlink {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(103, 194, 58, 0.3);
  }
  50% {
    box-shadow: 0 2px 16px rgba(103, 194, 58, 0.6);
  }
}
.btn-text {
  font-weight: 600;
}

.more-orders-tip {
  text-align: center;
  padding: 16px;
  color: #909399;
  font-size: 13px;
  margin-top: 8px;
  background: #f5f7fa;
  border-radius: 8px;
}

/* 已接单/已完成列表 */
.order-list-section {
  padding-bottom: 16px;
}

/* 右侧边栏 */
.sidebar-card {
  width: 260px;
  flex-shrink: 0;
  border-radius: 12px;
  border: none;
}
.sidebar-section {
  padding: 4px 0;
}
.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}
.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}
.setting-label .el-icon {
  color: #409eff;
}

/* 环形图 */
.stat-ring {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 16px;
}
.ring-svg {
  width: 100%;
  height: 100%;
}
.ring-progress {
  transition: stroke-dashoffset 0.5s ease;
}
.ring-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.ring-value {
  font-size: 24px;
  font-weight: 700;
  color: #67c23a;
}
.ring-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.stat-detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.detail-label {
  color: #909399;
}
.detail-value {
  font-weight: 600;
  color: #303133;
}
.detail-value.success {
  color: #67c23a;
}
.detail-value.danger {
  color: #f56c6c;
}

/* 平台分布条 */
.platform-bar-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.platform-bar-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.platform-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.platform-count {
  color: #606266;
  font-weight: 500;
}
.platform-bar-bg {
  height: 6px;
  background: #ebeef5;
  border-radius: 3px;
  overflow: hidden;
}
.platform-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
</style>
