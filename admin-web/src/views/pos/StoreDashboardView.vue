<template>
  <div class="pos-dashboard">
    <el-row :gutter="16">
      <el-col v-for="card in cards" :key="card.label" :span="4">
        <el-card shadow="hover">
          <div class="metric">{{ card.value }}</div>
          <div class="label">{{ card.label }}</div>
          <div class="desc muted">{{ card.desc }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="inventoryAlerts.length > 0" style="margin-top: 16px; border-left: 4px solid #e6a23c">
      <template #header>
        <div class="card-header">
          <span style="color: #e6a23c; font-weight: bold">库存预警（可用库存 ≤ 5）</span>
          <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
        </div>
      </template>
      <el-table :data="inventoryAlerts" size="small">
        <el-table-column prop="skuName" label="商品" />
        <el-table-column prop="stockType" label="库存类型" width="120" />
        <el-table-column prop="availableQty" label="可用库存" width="100">
          <template #default="{ row }">
            <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>近七日销售趋势</span>
          <el-button size="small" @click="loadDailySales">刷新</el-button>
        </div>
      </template>
      <div v-if="dailySales.length === 0" class="empty-state">
        <el-empty description="暂无销售数据" />
      </div>
      <div v-else class="chart-bars">
        <div v-for="d in dailySales" :key="d.date" class="bar-item">
          <div class="bar-fill" :style="{ height: getBarHeight(d.amount) + '%' }"></div>
          <div class="bar-label">{{ (d.date || '').slice(5) }}</div>
          <div class="bar-value">¥{{ Number(d.amount || 0).toFixed(0) }}</div>
        </div>
      </div>
    </el-card>

    <el-card style="margin-top: 16px; border-left: 4px solid #8B4513">
      <div class="daily-settle-entry">
        <div>
          <div style="font-size: 16px; font-weight: 600; color: #8B4513">日结对账</div>
          <div class="muted" style="margin-top: 4px">选择日期范围，查看销售汇总并进行现金对账</div>
        </div>
        <el-button type="primary" @click="goToDailySettle">进入日结</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  fetchStoreDashboard,
  fetchStoreDashboardOverview,
  fetchStoreDailySales,
  fetchStoreInventoryAlerts
} from "../../api";

const router = useRouter();

const dashboard = ref<any>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0
});
const dashboardOverview = ref<any>({
  monthSalesAmount: 0,
  monthOrderCount: 0
});
const dailySales = ref<any[]>([]);
const inventoryAlerts = ref<any[]>([]);

const cards = computed(() => [
  { label: "今日销售额", value: formatYuan(dashboard.value.todaySalesAmount), desc: "销售单汇总" },
  { label: "待收款", value: formatYuan(dashboard.value.unReceivedAmount), desc: "未收销售单金额" },
  { label: "待处理订单", value: String(dashboard.value.pendingOrderCount || 0), desc: "待接单小程序订单" },
  { label: "今日订单", value: String(dashboard.value.todayOrderCount || 0), desc: "今日小程序订单数" },
  { label: "本月累计销售", value: formatYuan(dashboardOverview.value.monthSalesAmount), desc: "本月销售单汇总" },
  { label: "本月累计订单", value: String(dashboardOverview.value.monthOrderCount || 0), desc: "本月小程序订单数" }
]);

function formatYuan(val: any): string {
  const n = Number(val || 0);
  return "¥" + n.toFixed(2);
}

function getBarHeight(amount: number): number {
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount || 0)), 1);
  return (Number(amount || 0) / maxVal) * 100;
}

async function loadDashboard() {
  try {
    const data = await fetchStoreDashboard();
    dashboard.value = data;
  } catch {
    ElMessage.warning("工作台概览接口暂不可用");
  }
}

async function loadDashboardOverview() {
  try {
    const data = await fetchStoreDashboardOverview();
    if (data) {
      dashboardOverview.value = {
        monthSalesAmount: Number(data.monthSalesAmount || data.monthSales || 0),
        monthOrderCount: Number(data.monthOrderCount || data.monthOrders || 0)
      };
    }
  } catch {
    // 静默失败
  }
}

async function loadDailySales() {
  try {
    const data = await fetchStoreDailySales();
    dailySales.value = data;
  } catch {
    ElMessage.warning("销售趋势数据加载失败");
  }
}

async function loadInventoryAlerts() {
  try {
    const data = await fetchStoreInventoryAlerts();
    inventoryAlerts.value = data;
  } catch {
    ElMessage.warning("库存预警加载失败");
  }
}

function goToDailySettle() {
  router.push("/pos/daily-settle");
}

onMounted(() => {
  Promise.allSettled([loadDashboard(), loadDashboardOverview(), loadDailySales(), loadInventoryAlerts()]);
});
</script>

<style scoped>
.pos-dashboard {
  padding: 16px;
}
.metric {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.label {
  font-size: 13px;
  font-weight: 600;
  margin-top: 6px;
}
.desc {
  font-size: 12px;
  margin-top: 4px;
}
.muted {
  color: #999;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chart-bars {
  display: flex;
  gap: 16px;
  height: 200px;
  align-items: flex-end;
  padding: 16px 0;
}
.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}
.bar-fill {
  width: 60%;
  background: var(--el-color-primary);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}
.bar-label {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
}
.bar-value {
  font-size: 11px;
  color: #999;
}
.daily-settle-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.empty-state {
  padding: 40px 0;
}
</style>
