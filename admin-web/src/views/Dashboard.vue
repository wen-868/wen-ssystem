<template>
  <div class="dashboard">
    <section class="hero">
      <h2>智享营销系统管理后台</h2>
      <p class="muted">围绕销售、库存、客户和收款，快速判断门店经营状态。</p>
    </section>

    <section class="cards">
      <div class="card" v-for="card in cards" :key="card.label">
        <div class="metric">{{ card.value }}</div>
        <div>{{ card.label }}</div>
        <p class="muted">{{ card.desc }}</p>
      </div>
    </section>

    <div class="row">
      <el-card style="flex: 1">
        <template #header>
          <div class="card-header">
            <span>库存预警</span>
            <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryAlerts" size="small" empty-text="暂无预警">
          <el-table-column prop="storeName" label="门店" width="120" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="类型" width="80" />
          <el-table-column prop="availableQty" label="可用库存" width="100">
            <template #default="{ row }">
              <span class="warning-text">{{ row.availableQty }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card style="flex: 1; margin-left: 20px">
        <template #header>
          <div class="card-header">
            <span>门店业绩</span>
            <el-button size="small" @click="loadStorePerformance">刷新</el-button>
          </div>
        </template>
        <el-table :data="storePerf" size="small" empty-text="暂无数据">
          <el-table-column prop="storeName" label="门店" />
          <el-table-column prop="billCount" label="销售单数" width="100" />
          <el-table-column label="销售金额" width="120">
            <template #default="{ row }">¥{{ Number(row.totalSales || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>近七天销售趋势</span>
          <el-button size="small" @click="loadDailySales">刷新</el-button>
        </div>
      </template>
      <canvas ref="barCanvas" style="width: 100%; height: 240px" />
      <div v-if="dailySales.length === 0" class="empty-tip">暂无销售数据</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { fetchDashboard, fetchDailySales, fetchInventoryAlerts, fetchStorePerformance } from "../api";

const cards = ref([
  { label: "今日销售额", value: "¥0.00", desc: "销售单实收金额" },
  { label: "待收款", value: "¥0.00", desc: "销售单分享收款" },
  { label: "待处理订单", value: "0", desc: "小程序订单履约" },
  { label: "库存预警", value: "0", desc: "低库存提醒" }
]);

const inventoryAlerts = ref<any[]>([]);
const storePerf = ref<any[]>([]);
const dailySales = ref<any[]>([]);
const barCanvas = ref<HTMLCanvasElement | null>(null);

async function loadDashboard() {
  try {
    const data = await fetchDashboard();
    cards.value = [
      { label: "今日销售额", value: `¥${Number(data.salesAmount || 0).toFixed(2)}`, desc: "销售单实收金额" },
      { label: "待收款", value: `¥${Number(data.pendingCollectionAmount || 0).toFixed(2)}`, desc: "销售单分享收款" },
      { label: "待处理订单", value: String(data.pendingOrderCount || 0), desc: "小程序订单履约" },
      { label: "库存预警", value: String(data.inventoryWarningCount || 0), desc: "低库存提醒" }
    ];
  } catch (e) {
    console.error("加载仪表盘失败", e);
  }
}

async function loadInventoryAlerts() {
  try {
    inventoryAlerts.value = await fetchInventoryAlerts();
  } catch (e) {
    console.error("加载库存预警失败", e);
  }
}

async function loadStorePerformance() {
  try {
    storePerf.value = await fetchStorePerformance();
  } catch (e) {
    console.error("加载门店业绩失败", e);
  }
}

async function loadDailySales() {
  try {
    dailySales.value = await fetchDailySales();
    await nextTick();
    drawBarChart();
  } catch (e) {
    console.error("加载销售趋势失败", e);
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
  canvas.height = 240 * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 220, pad = 20;
  ctx.clearRect(0, 0, w, 240);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(24, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const barH = (val / maxVal) * (h - 40);
    const y = h - barH;
    const gradient = ctx.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0, "#409eff");
    gradient.addColorStop(1, "#79bbff");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
    if (barH > 20) {
      ctx.fillStyle = "#fff";
      ctx.fillText(`¥${val.toFixed(0)}`, x + barW / 2, y + 16);
    }
  });
}

onMounted(() => {
  Promise.all([loadDashboard(), loadInventoryAlerts(), loadStorePerformance(), loadDailySales()]).catch(() => {});
});
</script>

<style scoped>
.dashboard .hero h2 {
  margin: 0 0 8px;
  font-size: 22px;
}
.cards {
  display: flex;
  gap: 16px;
  margin: 20px 0;
}
.card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.card .metric {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}
.muted {
  color: #909399;
  font-size: 13px;
  margin: 4px 0 0;
}
.row {
  display: flex;
  margin-top: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.warning-text {
  color: #e6a23c;
  font-weight: 600;
}
.empty-tip {
  text-align: center;
  padding: 20px;
  color: #909399;
  font-size: 13px;
}
</style>
