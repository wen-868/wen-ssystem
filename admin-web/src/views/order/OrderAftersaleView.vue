<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">订单售后</h2>
      <p class="page-desc">订单售后处理与审核</p>
    </div>
  </div>
<!-- 售后统计区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="售后总数" :value="stats.totalCount">
            <template #prefix><el-icon><Document /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="待审核" :value="stats.pendingCount" value-style="color: var(--color-warning)">
            <template #prefix><el-icon><Clock /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="平均处理时长" :value="stats.avgProcessingHours" value-style="color: var(--color-primary)">
            <template #suffix>小时</template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="超时率" :value="stats.overdueRate" value-style="color: var(--color-danger)">
            <template #suffix>%</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card>
          <template #header><span>售后类型分布</span></template>
          <el-empty v-if="!typeStats.length" description="暂无数据" :image-size="80" />
          <div v-else ref="aftersaleTypeChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>售后状态分布</span></template>
          <el-empty v-if="!statusStats.length" description="暂无数据" :image-size="80" />
          <div v-else ref="statusChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <el-card style="margin-bottom: 16px">
      <div class="filter-bar" style="margin-bottom: 0; border: none; padding: 0; box-shadow: none">
        <el-select v-model="filters.status" placeholder="售后状态" clearable style="width: 130px">
          <el-option v-for="item in STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-input v-model="filters.keyword" placeholder="搜索售后单号/订单号" clearable style="width: 220px" @keyup.enter="handleSearch" />
        <el-button type="primary" :loading="loading" @click="handleSearch">搜索</el-button>
        <el-button :loading="loading" @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 售后列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>售后列表</span>
          <el-button :loading="loading" @click="handleRefresh">刷新</el-button>
        </div>
      </template>
      <div class="table-card">
<el-table v-loading="loading" :data="aftersales" stripe>
        <el-table-column prop="aftersaleNo" label="售后单号" width="160" />
        <el-table-column prop="orderNo" label="关联订单号" width="160" />
        <el-table-column label="售后类型" width="110">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.aftersaleType)" size="small">{{ typeLabel(row.aftersaleType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因摘要" min-width="140" show-overflow-tooltip />
        <el-table-column label="退款金额" width="110">
          <template #default="{ row }">
            <span v-if="row.aftersaleType !== 'EXCHANGE'" class="refund-amount">¥{{ Number(row.refundAmount ?? 0).toFixed(2) }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="售后状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status || row.aftersaleStatus)" size="small">{{ statusLabel(row.status || row.aftersaleStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" size="small" link type="primary" @click="openDetail(row)">审核</el-button>
            <el-button size="small" link type="primary" @click="openDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>
      <div class="table-card-footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
</div>
    </el-card>

    <!-- 售后详情弹窗 -->
    <el-dialog v-model="detailVisible" v-loading="detailLoading" title="售后详情" width="900px" top="5vh">
      <template v-if="currentAftersale">
        <el-row :gutter="24">
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">售后基本信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="售后单号">{{ currentAftersale.aftersale_no || currentAftersale.aftersaleNo }}</el-descriptions-item>
              <el-descriptions-item label="关联订单号">{{ currentAftersale.order_no || currentAftersale.orderNo }}</el-descriptions-item>
              <el-descriptions-item label="售后类型">
                <el-tag :type="typeTag(currentAftersale.aftersale_type || currentAftersale.aftersaleType)" size="small">{{ typeLabel(currentAftersale.aftersale_type || currentAftersale.aftersaleType) }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="申请原因">{{ currentAftersale.reason || currentAftersale.reason_detail || '-' }}</el-descriptions-item>
              <el-descriptions-item label="售后状态">
                <el-tag :type="statusTag(detailStatus)" size="small">{{ statusLabel(detailStatus) }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="处理备注">{{ currentAftersale.process_remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ currentAftersale.created_at || currentAftersale.createdAt }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin: 16px 0 8px">商品信息</h4>
            <el-table :data="detailItems" border size="small">
              <el-table-column prop="skuName" label="商品" />
              <el-table-column prop="qty" label="数量" width="60" />
              <el-table-column label="单价" width="90">
                <template #default="{ row }">¥{{ Number(row.unitPrice ?? 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="合计金额" width="90">
                <template #default="{ row }">¥{{ Number(row.subtotal ?? 0).toFixed(2) }}</template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无商品明细" :image-size="60" />
              </template>
            </el-table>
            <div class="refund-total">
              退款金额：<span class="refund-amount">¥{{ Number(currentAftersale.refundAmount ?? currentAftersale.refund_amount ?? 0).toFixed(2) }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">物流信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="快递公司">{{ currentAftersale.return_logistics_company || '-' }}</el-descriptions-item>
              <el-descriptions-item label="快递单号">{{ currentAftersale.return_logistics_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="收货人">{{ currentAftersale.orderReceiverName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ currentAftersale.orderReceiverMobile || '-' }}</el-descriptions-item>
              <el-descriptions-item label="收货地址">{{ currentAftersale.orderReceiverAddress || '-' }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin: 16px 0 8px">处理信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="最近更新时间">{{ currentAftersale.updated_at || currentAftersale.updatedAt || '-' }}</el-descriptions-item>
              <el-descriptions-item label="处理结果">{{ currentAftersale.inspect_result || currentAftersale.process_remark || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-col>
        </el-row>
        <div class="dialog-actions">
          <template v-if="detailStatus === 'PENDING'">
            <el-popconfirm title="确认通过此售后申请？" confirm-button-text="确认通过" cancel-button-text="取消" @confirm="handleApprove">
              <template #reference>
                <el-button type="success">通过</el-button>
              </template>
            </el-popconfirm>
            <el-popconfirm title="确认拒绝此售后申请？" confirm-button-text="确认拒绝" cancel-button-text="取消" @confirm="showRejectReasonDialog">
              <template #reference>
                <el-button type="danger">拒绝</el-button>
              </template>
            </el-popconfirm>
          </template>
          <el-button v-if="detailStatus === 'APPROVED' || detailStatus === 'INSPECTING'" type="primary" @click="handleComplete">完成售后</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 拒绝原因弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝原因" width="480px" append-to-body>
      <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请输入拒绝原因" />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading" @click="handleRejectConfirm">确定拒绝</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Document, Clock } from "@element-plus/icons-vue";
import echarts from "@/utils/echarts";
import { CHART_COLORS } from "@/styles/theme";
import {
  fetchAfterSales,
  fetchAfterSaleDetail,
  fetchAfterSaleStatistics,
  approveAfterSale,
  rejectAfterSale,
  completeAfterSale,
  getErrorMessage,
} from "@/api";

// ── 状态常量（与后端 t_aftersale.status / aftersale_type 一致）──
const STATUS_OPTIONS = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "RETURNING", label: "退货中" },
  { value: "RECEIVED", label: "已收货" },
  { value: "INSPECTING", label: "验货中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "CANCELLED", label: "已取消" },
  { value: "EXPIRED", label: "已过期" },
  { value: "CLOSED", label: "已关闭" },
];

const TYPE_LABELS: Record<string, string> = {
  REFUND_ONLY: "仅退款",
  RETURN_REFUND: "退货退款",
  EXCHANGE: "换货",
  REPAIR: "维修",
};
const TYPE_TAGS: Record<string, string> = {
  REFUND_ONLY: "primary",
  RETURN_REFUND: "warning",
  EXCHANGE: "success",
  REPAIR: "info",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  RETURNING: "退货中",
  RECEIVED: "已收货",
  INSPECTING: "验货中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
  CLOSED: "已关闭",
};
const STATUS_TAGS: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  RETURNING: "warning",
  RECEIVED: "info",
  INSPECTING: "warning",
  COMPLETED: "success",
  CANCELLED: "info",
  EXPIRED: "info",
  CLOSED: "info",
};

// 图表配色与 tokens.css 图表色保持一致（画布不支持 CSS 变量，使用 token 对应色值）
const CHART_PALETTE = [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.purple, CHART_COLORS.cyan];

function typeLabel(type: string) {
  return TYPE_LABELS[type] || type || "-";
}
function typeTag(type: string) {
  return (TYPE_TAGS[type] || "info") as any;
}
function statusLabel(status: string) {
  return STATUS_LABELS[status] || status || "-";
}
function statusTag(status: string) {
  return (STATUS_TAGS[status] || "info") as any;
}

// ── 数据状态 ──
const loading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const aftersales = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = ref({
  status: "",
  dateRange: [] as string[],
  keyword: "",
});

// ── 统计（GET /admin/aftersales/statistics：typeStats/statusStats/avgProcessingHours/avgSatisfaction/overdueRate）──
const statistics = ref<any>({});
const typeStats = computed(() => statistics.value.typeStats || []);
const statusStats = computed(() => statistics.value.statusStats || []);
const stats = computed(() => {
  const statusArr = statusStats.value as Array<{ status: string; count: number }>;
  const pending = statusArr.find((s) => s.status === "PENDING");
  return {
    totalCount: statusArr.reduce((sum, s) => sum + Number(s.count || 0), 0),
    pendingCount: Number(pending?.count || 0),
    avgProcessingHours: Number(statistics.value.avgProcessingHours || 0),
    overdueRate: Number(statistics.value.overdueRate || 0),
  };
});

// ── 图表 ref ──
const aftersaleTypeChartRef = ref<HTMLDivElement | null>(null);
const statusChartRef = ref<HTMLDivElement | null>(null);

let aftersaleTypeChart: echarts.ECharts | null = null;
let statusChart: echarts.ECharts | null = null;

// ── 数据加载 ──
async function loadStatistics() {
  try {
    statistics.value = (await fetchAfterSaleStatistics()) || {};
  } catch {
    // 统计接口异常时置空，卡片显示零值/空态，不展示编造数字
    statistics.value = {};
  }
  await nextTick();
  renderAftersaleTypeChart();
  renderStatusChart();
}

async function loadAftersales() {
  loading.value = true;
  try {
    const params: {
      keyword?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page: number;
      pageSize: number;
    } = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.dateRange && filters.value.dateRange.length === 2) {
      params.startDate = filters.value.dateRange[0];
      params.endDate = filters.value.dateRange[1];
    }
    if (filters.value.keyword.trim()) params.keyword = filters.value.keyword.trim();
    const data = await fetchAfterSales(params);
    aftersales.value = data?.records || [];
    total.value = data?.total ?? aftersales.value.length;
  } catch (e) {
    aftersales.value = [];
    total.value = 0;
    ElMessage.error(getErrorMessage(e, "加载售后列表失败"));
  } finally {
    loading.value = false;
  }
}

// ── 筛选/分页 ──
function handleSearch() {
  page.value = 1;
  loadAftersales();
}

function handleReset() {
  filters.value = { status: "", dateRange: [], keyword: "" };
  page.value = 1;
  loadAftersales();
}

function handleRefresh() {
  loadAftersales();
  loadStatistics();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadAftersales();
}

function handlePageChange(p: number) {
  page.value = p;
  loadAftersales();
}

// ── 详情弹窗 ──
const detailVisible = ref(false);
const currentAftersale = ref<any>(null);

const detailItems = computed(() => {
  const items = currentAftersale.value?.items;
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  }
  return [];
});

const detailStatus = computed(() =>
  String(currentAftersale.value?.status || currentAftersale.value?.aftersaleStatus || "")
);

async function openDetail(row: any) {
  currentAftersale.value = row;
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const detail = await fetchAfterSaleDetail(row.id);
    if (detail) currentAftersale.value = detail;
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "加载售后详情失败"));
  } finally {
    detailLoading.value = false;
  }
}

// ── 拒绝弹窗 ──
const rejectDialogVisible = ref(false);
const rejectReason = ref("");

function showRejectReasonDialog() {
  rejectReason.value = "";
  rejectDialogVisible.value = true;
}

// ── 审核操作（真实调用后端）──
async function handleApprove() {
  if (!currentAftersale.value) return;
  try {
    await approveAfterSale(currentAftersale.value.id, {
      processRemark: "",
      version: Number(currentAftersale.value.version || 1),
    });
    ElMessage.success("售后申请已通过");
    detailVisible.value = false;
    loadAftersales();
    loadStatistics();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function handleRejectConfirm() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning("请输入拒绝原因");
    return;
  }
  if (!currentAftersale.value) return;
  actionLoading.value = true;
  try {
    await rejectAfterSale(currentAftersale.value.id, {
      processRemark: rejectReason.value.trim(),
      version: Number(currentAftersale.value.version || 1),
    });
    ElMessage.success("售后申请已拒绝");
    rejectDialogVisible.value = false;
    detailVisible.value = false;
    loadAftersales();
    loadStatistics();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  } finally {
    actionLoading.value = false;
  }
}

async function handleComplete() {
  if (!currentAftersale.value) return;
  const confirmed = await ElMessageBox.confirm("确认完成售后？", "确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "success",
  }).catch(() => null);
  if (!confirmed) return;
  try {
    await completeAfterSale(currentAftersale.value.id, {
      processRemark: "",
      version: Number(currentAftersale.value.version || 1),
    });
    ElMessage.success("售后已完成");
    detailVisible.value = false;
    loadAftersales();
    loadStatistics();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

// ── 图表渲染 ──
function renderAftersaleTypeChart() {
  if (!aftersaleTypeChartRef.value || !typeStats.value.length) return;
  if (!aftersaleTypeChart) {
    aftersaleTypeChart = echarts.init(aftersaleTypeChartRef.value);
  }
  aftersaleTypeChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    color: CHART_PALETTE,
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "50%"],
        label: { show: true, formatter: "{b}\n{d}%" },
        data: typeStats.value.map((t: any) => ({ name: t.typeLabel || t.type, value: t.count })),
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  });
}

function renderStatusChart() {
  if (!statusChartRef.value || !statusStats.value.length) return;
  if (!statusChart) {
    statusChart = echarts.init(statusChartRef.value);
  }
  statusChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: statusStats.value.map((s: any) => s.statusLabel || s.status),
      axisLabel: { fontSize: 11, interval: 0, rotate: 30 },
    },
    yAxis: { type: "value", name: "数量", minInterval: 1 },
    series: [
      {
        type: "bar",
        data: statusStats.value.map((s: any) => s.count),
        barWidth: 28,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CHART_COLORS.primary },
            { offset: 1, color: "rgba(63,111,239,0.35)" },
          ]),
        },
        label: { show: true, position: "top", fontSize: 12 },
      },
    ],
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
  });
}

// ── 响应式 resize ──
function handleResize() {
  aftersaleTypeChart?.resize();
  statusChart?.resize();
}

onMounted(() => {
  loadAftersales();
  loadStatistics();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  aftersaleTypeChart?.dispose();
  statusChart?.dispose();
});
</script>

<style scoped>
.page { padding: 0;
}
.chart-box {
  width: 100%;
  height: 280px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.refund-total {
  text-align: right;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
}
.refund-amount {
  color: var(--color-danger);
  font-size: 16px;
}
.text-muted {
  color: var(--text-muted);
}
.dialog-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-normal);
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
