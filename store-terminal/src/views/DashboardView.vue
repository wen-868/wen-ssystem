<template>
  <section class="cards">
    <div class="card" v-for="card in cards" :key="card.label">
      <div class="metric">{{ card.value }}</div>
      <div>{{ card.label }}</div>
      <p class="muted">{{ card.desc }}</p>
    </div>
  </section>
  <el-card v-if="inventoryAlerts.length > 0" style="margin-top: 20px; border-left: 4px solid #e6a23c">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span style="color: #e6a23c; font-weight: bold">⚠ 库存预警（可用库存 ≤ 5）</span>
        <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
      </div>
    </template>
    <el-table :data="inventoryAlerts" size="small">
      <el-table-column prop="skuName" label="商品" />
      <el-table-column prop="stockType" label="库存类型" width="100" />
      <el-table-column prop="availableQty" label="可用库存" width="100">
        <template #default="{ row }">
          <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>近七日销售趋势</span>
        <el-button size="small" @click="loadDailySales">刷新</el-button>
      </div>
    </template>
    <canvas ref="barCanvas" style="width: 100%; height: 180px" />
    <div v-if="dailySales.length === 0" style="text-align: center; padding: 20px; color: #999">暂无销售数据</div>
  </el-card>
  <el-card style="margin-top: 20px; border-left: 4px solid #8B4513">
    <div style="display: flex; justify-content: space-between; align-items: center">
      <div>
        <div style="font-size: 16px; font-weight: 600; color: #8B4513">日结对账</div>
        <div class="muted" style="margin-top: 4px">选择日期范围，查看销售汇总并进行现金对账</div>
      </div>
      <el-button type="primary" @click="goToDailySettle">进入日结</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  fetchStoreDashboard,
  fetchDashboardOverview,
  fetchStoreDailySales,
  fetchStoreInventoryAlerts
} from "../api";
import { formatYuan } from "../utils/format";

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
const barCanvas = ref<HTMLCanvasElement | null>(null);

const cards = computed(() => [
  { label: "今日销售额", value: formatYuan(dashboard.value.todaySalesAmount), desc: "销售单汇总" },
  { label: "待收款", value: formatYuan(dashboard.value.unReceivedAmount), desc: "未收销售单金额" },
  { label: "待处理订单", value: String(dashboard.value.pendingOrderCount || 0), desc: "待接单小程序订单" },
  { label: "今日订单", value: String(dashboard.value.todayOrderCount || 0), desc: "今日小程序订单数" },
  { label: "本月累计销售", value: formatYuan(dashboardOverview.value.monthSalesAmount), desc: "本月销售单汇总" },
  { label: "本月累计订单", value: String(dashboardOverview.value.monthOrderCount), desc: "本月小程序订单数" }
]);

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
    const data = await fetchDashboardOverview();
    if (data) {
      dashboardOverview.value = {
        monthSalesAmount: Number(data.monthSalesAmount || data.monthSales || 0),
        monthOrderCount: Number(data.monthOrderCount || data.monthOrders || 0)
      };
    }
  } catch {
    // 静默失败，不影响主仪表盘
  }
}

async function loadDailySales() {
  try {
    const data = await fetchStoreDailySales();
    dailySales.value = data;
    drawBarChart();
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

function drawBarChart() {
  const canvas = barCanvas.value;
  if (!canvas || dailySales.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 160, pad = 20;
  ctx.clearRect(0, 0, w, 180);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(25, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  const barColor = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim() || "#9b1c31";
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const y = h - (val / maxVal) * (h - 20);
    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barW, h - y);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
  });
}

function goToDailySettle() {
  router.push("/daily-settle");
}

onMounted(() => {
  Promise.allSettled([loadDashboard(), loadDashboardOverview(), loadDailySales(), loadInventoryAlerts()]);
});
</script>
