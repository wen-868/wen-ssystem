<template>
  <div class="pos-shift-detail">
    <!-- 头部：返回 + 标题 + 班次 + 状态 + 提交交班（对标设计稿 p13） -->
    <div class="recon-header">
      <div class="recon-header-left">
        <el-button @click="goBack" size="small">← 返回列表</el-button>
        <h2 class="recon-heading">交接班对账</h2>
        <span v-if="shift" class="recon-shift-badge">
          {{ getShiftTypeName(shift.shiftType) }} {{ shiftTimeRange }}
        </span>
        <el-tag v-if="shift" :type="getStatusTagType(shift.status)" size="small">
          {{ getStatusName(shift.status) }}
        </el-tag>
      </div>
      <el-button
        v-if="shift && shift.status === 'IN_PROGRESS'"
        type="primary"
        size="small"
        @click="handleSubmitShift"
      >
        提交交班
      </el-button>
    </div>

    <!-- 本班概况 -->
    <el-card shadow="never" class="recon-card">
      <template #header><span class="recon-card-title">本班概况</span></template>
      <div class="recon-stat-grid">
        <div class="recon-stat">
          <div class="recon-stat-value">{{ shift?.totalOrders || 0 }}</div>
          <div class="recon-stat-label">订单数（笔）</div>
        </div>
        <div class="recon-stat">
          <div class="recon-stat-value">¥{{ Number(salesStats?.totalAmount || 0).toFixed(2) }}</div>
          <div class="recon-stat-label">订单总额</div>
        </div>
        <div class="recon-stat">
          <div class="recon-stat-value">{{ refundCount }}</div>
          <div class="recon-stat-label">退款（笔）</div>
        </div>
        <div class="recon-stat">
          <div class="recon-stat-value">-</div>
          <div class="recon-stat-label">会员消费（笔）</div>
        </div>
      </div>
    </el-card>

    <!-- 现金对账 -->
    <el-card shadow="never" class="recon-card">
      <template #header><span class="recon-card-title">现金对账</span></template>
      <div class="recon-stat-grid">
        <div class="recon-stat">
          <div class="recon-stat-value">¥{{ Number(shift?.openingCash || 0).toFixed(2) }}</div>
          <div class="recon-stat-label">初备现金</div>
        </div>
        <div class="recon-stat">
          <div class="recon-stat-value">¥{{ Number(salesStats?.cashAmount || 0).toFixed(2) }}</div>
          <div class="recon-stat-label">现金收入</div>
        </div>
        <div class="recon-stat">
          <div class="recon-stat-value">¥{{ expectedCash.toFixed(2) }}</div>
          <div class="recon-stat-label">应交现金</div>
        </div>
        <div class="recon-stat">
          <div
            class="recon-stat-value"
            :class="cashDiff === 0 ? 'recon-value-ok' : 'recon-value-warn'"
          >
            ¥{{ cashDiff.toFixed(2) }}
          </div>
          <div class="recon-stat-label">差异</div>
        </div>
      </div>
    </el-card>

    <!-- 支付方式分布 + 热销 TOP3 -->
    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="recon-card">
          <template #header><span class="recon-card-title">支付方式分布</span></template>
          <div v-if="payDist.length" class="pay-dist">
            <div v-for="p in payDist" :key="p.label" class="pay-dist-row">
              <span class="pay-dist-label">{{ p.label }}</span>
              <div class="pay-dist-bar">
                <div class="pay-dist-fill" :style="{ width: p.percent + '%' }"></div>
              </div>
              <span class="pay-dist-value">{{ p.percent.toFixed(1) }}%</span>
            </div>
          </div>
          <div v-else class="empty-tip">暂无支付数据</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="recon-card">
          <template #header><span class="recon-card-title">热销 TOP3</span></template>
          <div v-if="hotProducts.length" class="hot-list">
            <div v-for="(item, idx) in hotProducts" :key="idx" class="hot-item">
              <span class="hot-rank" :class="'hot-rank--' + (idx + 1)">{{ idx + 1 }}</span>
              <span class="hot-name">{{ item.skuName }}</span>
              <span class="hot-qty">{{ item.quantity }} 件</span>
            </div>
          </div>
          <div v-else class="empty-tip">暂无热销数据</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 库存盘点核对 -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>库存盘点核对</span>
          <el-button
            v-if="shift && shift.status === 'IN_PROGRESS' && !stockCheckSubmitted"
            type="primary"
            size="small"
            @click="showStockCheckDialog = true"
          >
            提交盘点
          </el-button>
        </div>
      </template>
      <el-table :data="stockCheckItems" size="small" v-loading="stockCheckLoading">
        <el-table-column prop="skuName" label="商品名称" />
        <el-table-column prop="skuCode" label="商品编码" width="120" />
        <el-table-column prop="bookQty" label="账面数量" width="100" />
        <el-table-column prop="actualQty" label="实际数量" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.diffQty !== 0 ? '#e6a23c' : '#67c23a' }">
              {{ row.actualQty ?? "-" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="diffQty" label="差异数量" width="100">
          <template #default="{ row }">
            <span v-if="row.diffQty !== 0" :style="{ color: row.diffQty > 0 ? '#67c23a' : '#f56c6c' }">
              {{ row.diffQty > 0 ? "+" : "" }}{{ row.diffQty }}
            </span>
            <span v-else style="color: #67c23a">无差异</span>
          </template>
        </el-table-column>
        <el-table-column prop="diffReason" label="差异原因" />
      </el-table>
      <div v-if="stockCheckItems.length === 0 && !stockCheckLoading" class="empty-tip">暂无盘点数据</div>
    </el-card>

    <!-- 库存盘点编辑弹窗 -->
    <el-dialog v-model="showStockCheckDialog" title="库存盘点核对" width="720px">
      <el-table :data="stockCheckItems" size="small">
        <el-table-column prop="skuName" label="商品名称" />
        <el-table-column prop="skuCode" label="商品编码" width="120" />
        <el-table-column prop="bookQty" label="账面数量" width="100" />
        <el-table-column label="实际数量" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.actualQty" :min="0" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="差异原因" width="200">
          <template #default="{ row }">
            <el-input v-model="row.diffReason" placeholder="如有差异请填写原因" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showStockCheckDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitStockCheck">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  fetchStoreShiftDetail,
  getStoreShiftSalesStats,
  getStoreShiftStockCheck,
  submitStoreShiftStockCheck
} from "../../api";

const route = useRoute();
const router = useRouter();

const shift = ref<any>(null);
const salesStats = ref<any>(null);
const stockCheckItems = ref<any[]>([]);
const stockCheckLoading = ref(false);
const stockCheckSubmitted = ref(false);
const showStockCheckDialog = ref(false);

/** 班次时间范围（如 "09:00-18:00"） */
const shiftTimeRange = computed(() => {
  const s = shift.value?.startTime;
  const e = shift.value?.endTime;
  const fmt = (t: string) => (t ? String(t).slice(11, 16) : "--:--");
  return `${fmt(s)}-${fmt(e)}`;
});

/** 退款笔数（当前无独立字段，先按 0 展示，避免编造） */
const refundCount = computed(() => 0);

/** 应交现金 = 初备现金 + 现金收入 */
const expectedCash = computed(() => {
  return Number(shift.value?.openingCash || 0) + Number(salesStats.value?.cashAmount || 0);
});

/** 现金差异（应交 - 实收；无实收字段时为 0） */
const cashDiff = computed(() => 0);

/** 支付方式占比分布 */
const payDist = computed(() => {
  const stats = salesStats.value;
  if (!stats) return [];
  const items = [
    { label: "现金", value: Number(stats.cashAmount || 0) },
    { label: "微信支付", value: Number(stats.wechatAmount || 0) },
    { label: "支付宝", value: Number(stats.alipayAmount || 0) },
  ];
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0) return [];
  return items
    .filter((i) => i.value > 0)
    .map((i) => ({ label: i.label, percent: (i.value / total) * 100 }));
});

/** 热销 TOP3（当前无接口字段，空态展示） */
/** 热销 TOP3（当前为预留空数据，类型显式声明避免 never[] 推断） */
const hotProducts = computed<{ skuName: string; quantity: number }[]>(() => []);

/** 提交交班 */
function handleSubmitShift() {
  ElMessage.info("交班提交功能待班次接口完善");
}

function goBack() {
  router.push("/pos/shifts");
}

function getShiftTypeName(type: string) {
  const map: Record<string, string> = {
    MORNING: "早班",
    AFTERNOON: "中班",
    EVENING: "晚班"
  };
  return map[type] || type;
}

function getShiftTypeTagType(type: string) {
  const map: Record<string, string> = {
    MORNING: "success",
    AFTERNOON: "warning",
    EVENING: "info"
  };
  return map[type] || "info";
}

function getStatusName(status: string) {
  const map: Record<string, string> = {
    PENDING: "待开始",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
    VOIDED: "已作废"
  };
  return map[status] || status;
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    PENDING: "info",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    VOIDED: "danger"
  };
  return map[status] || "info";
}

async function loadShiftDetail() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  try {
    const data = await fetchStoreShiftDetail(shiftId);
    shift.value = data;
  } catch {
    ElMessage.warning("交接班详情加载失败");
  }
}

async function loadSalesStats() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  try {
    const data = await getStoreShiftSalesStats(shiftId);
    salesStats.value = data;
  } catch {
    ElMessage.warning("销售统计加载失败");
  }
}

async function loadStockCheck() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  stockCheckLoading.value = true;
  try {
    const data = await getStoreShiftStockCheck(shiftId);
    stockCheckItems.value = data?.items || [];
    stockCheckSubmitted.value = data?.submitted || false;
  } catch {
    ElMessage.warning("库存盘点数据加载失败");
  } finally {
    stockCheckLoading.value = false;
  }
}

async function handleSubmitStockCheck() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  const items = stockCheckItems.value.map((item) => ({
    skuId: item.skuId,
    bookQty: item.bookQty,
    actualQty: item.actualQty || 0,
    diffReason: item.diffReason || undefined
  }));
  try {
    await submitStoreShiftStockCheck(shiftId, items);
    ElMessage.success("库存盘点提交成功");
    showStockCheckDialog.value = false;
    stockCheckSubmitted.value = true;
    loadStockCheck();
  } catch {
    ElMessage.error("提交失败");
  }
}

onMounted(() => {
  loadShiftDetail();
  loadSalesStats();
  loadStockCheck();
});
</script>

<style scoped>
.pos-shift-detail {
  padding: 16px;
}

/* ─── 交接班对账（对标设计稿 p13） ─── */
.recon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.recon-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.recon-heading {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.recon-shift-badge {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-soft);
  padding: 3px 10px;
  border-radius: 4px;
}
.recon-card {
  border: 1px solid var(--border-light);
  margin-bottom: 16px;
}
.recon-card :deep(.el-card__header) {
  padding: 12px 16px;
}
.recon-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.recon-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.recon-stat {
  text-align: center;
  padding: 10px 0;
}
.recon-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.recon-stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.recon-value-ok {
  color: var(--color-success);
}
.recon-value-warn {
  color: var(--color-warning);
}
.pay-dist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}
.pay-dist-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pay-dist-label {
  width: 64px;
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-dist-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-soft);
  border-radius: 4px;
  overflow: hidden;
}
.pay-dist-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 400ms ease;
}
.pay-dist-value {
  width: 56px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.hot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
}
.hot-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.hot-rank--1 {
  background: var(--color-warning);
  color: #fff;
}
.hot-rank--2 {
  background: var(--gray-400);
  color: #fff;
}
.hot-rank--3 {
  background: #c68642;
  color: #fff;
}
.hot-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}
.hot-qty {
  font-size: 12px;
  color: var(--text-muted);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-value {
  font-size: 22px;
  font-weight: bold;
  color: #9b1c31;
}
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.empty-tip {
  text-align: center;
  padding: 20px;
  color: #999;
}
</style>
