<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">订单异常</h2>
      <p class="page-desc">异常订单监控与处理</p>
    </div>
  </div>
<!-- 异常统计区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="待处理异常" :value="exceptionStats.pendingCount" value-style="color: var(--color-danger)">
            <template #prefix><el-icon><WarningFilled /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="今日新增异常" :value="exceptionStats.todayNewCount" value-style="color: var(--color-warning)">
            <template #prefix><el-icon><Plus /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="本周解决异常" :value="exceptionStats.weekResolvedCount" value-style="color: var(--color-success)">
            <template #prefix><el-icon><CircleCheckFilled /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="平均处理时长" :value="exceptionStats.avgHandleHours" value-style="color: var(--color-primary)">
            <template #suffix>小时</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="8">
        <el-card>
          <template #header><span>异常类型分布</span></template>
          <div ref="exceptionTypeChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header><span>渠道异常率</span></template>
          <div ref="channelExceptionChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>异常趋势</span>
            <el-radio-group v-model="trendMode" size="small" style="margin-left: 12px" @change="renderExceptionTrendChart">
              <el-radio-button label="day">日</el-radio-button>
              <el-radio-button label="week">周</el-radio-button>
              <el-radio-button label="month">月</el-radio-button>
            </el-radio-group>
          </template>
          <div ref="exceptionTrendChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <el-card style="margin-bottom: 16px">
      <div class="filter-bar" style="margin-bottom: 0; border: none; padding: 0; box-shadow: none">
        <el-select v-model="filters.exceptionTypes" multiple placeholder="异常类型" clearable style="width: 180px">
          <el-option v-for="t in exceptionTypes" :key="t.type" :label="t.name" :value="t.type" />
        </el-select>
        <el-select v-model="filters.exceptionLevel" placeholder="异常级别" clearable style="width: 130px">
          <el-option label="WARNING" value="WARNING" />
          <el-option label="ERROR" value="ERROR" />
          <el-option label="CRITICAL" value="CRITICAL" />
        </el-select>
        <el-select v-model="filters.handleStatus" placeholder="处理状态" clearable style="width: 130px">
          <el-option label="待处理" value="PENDING" />
          <el-option label="处理中" value="PROCESSING" />
          <el-option label="已解决" value="RESOLVED" />
          <el-option label="已关闭" value="CLOSED" />
        </el-select>
        <el-select v-model="filters.channel" placeholder="渠道" clearable style="width: 120px">
          <el-option label="微信" value="WECHAT" />
          <el-option label="美团" value="MEITUAN" />
          <el-option label="饿了么" value="ELEME" />
          <el-option label="京东" value="JD" />
          <el-option label="抖音" value="DOUYIN" />
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
        <el-input v-model="filters.keyword" placeholder="搜索订单号" clearable style="width: 200px" />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 异常列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>异常列表</span>
          <el-button @click="handleRefresh">刷新</el-button>
        </div>
      </template>
      <div class="table-card">
<el-table :data="filteredExceptions" stripe>
        <el-table-column label="异常级别" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.exceptionLevel === 'WARNING'" type="warning" effect="dark">
              <el-icon style="margin-right: 4px"><Warning /></el-icon>WARNING
            </el-tag>
            <el-tag v-else-if="row.exceptionLevel === 'ERROR'" type="danger" effect="dark">
              <el-icon style="margin-right: 4px"><CircleClose /></el-icon>ERROR
            </el-tag>
            <el-tag v-else type="danger" effect="dark">
              <el-icon style="margin-right: 4px"><CircleCloseFilled /></el-icon>CRITICAL
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channelOrderNo" label="订单号" width="160" />
        <el-table-column label="渠道" width="90">
          <template #default="{ row }">
            <el-tag :type="channelTagType(row.channelType)" size="small">{{ channelName(row.channelType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常类型" width="120">
          <template #default="{ row }">
            <el-tag :type="exceptionTypeTag(row.exceptionType)" size="small">{{ exceptionTypeName(row.exceptionType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常详情" min-width="160">
          <template #default="{ row }">
            <el-popover placement="top" :width="300" trigger="hover">
              <template #reference>
                <span class="detail-summary">{{ row.exceptionDetail }}</span>
              </template>
              <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.6">{{ row.exceptionDetail }}</div>
            </el-popover>
          </template>
        </el-table-column>
        <el-table-column label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.handleStatus === 'PENDING'" type="warning">待处理</el-tag>
            <el-tag v-else-if="row.handleStatus === 'PROCESSING'" type="primary">处理中</el-tag>
            <el-tag v-else-if="row.handleStatus === 'RESOLVED'" type="success">已解决</el-tag>
            <el-tag v-else type="info">已关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handlerName" label="处理人" width="100">
          <template #default="{ row }">{{ row.handlerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleException(row)">处理</el-button>
            <el-button size="small" link type="primary" @click="viewDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-card-footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredExceptions.length"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
</div>
    </el-card>

    <!-- 异常详情弹窗 -->
    <el-dialog v-model="detailVisible" title="异常详情" width="900px" top="5vh">
      <template v-if="currentException">
        <el-row :gutter="24">
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">异常基本信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="异常级别">
                <el-tag v-if="currentException.exceptionLevel === 'WARNING'" type="warning">WARNING</el-tag>
                <el-tag v-else-if="currentException.exceptionLevel === 'ERROR'" type="danger">ERROR</el-tag>
                <el-tag v-else type="danger">CRITICAL</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="订单号">{{ currentException.channelOrderNo }}</el-descriptions-item>
              <el-descriptions-item label="渠道">{{ channelName(currentException.channelType) }}</el-descriptions-item>
              <el-descriptions-item label="异常类型">{{ exceptionTypeName(currentException.exceptionType) }}</el-descriptions-item>
              <el-descriptions-item label="处理状态">
                <el-tag v-if="currentException.handleStatus === 'PENDING'" type="warning">待处理</el-tag>
                <el-tag v-else-if="currentException.handleStatus === 'PROCESSING'" type="primary">处理中</el-tag>
                <el-tag v-else-if="currentException.handleStatus === 'RESOLVED'" type="success">已解决</el-tag>
                <el-tag v-else type="info">已关闭</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="处理人">{{ currentException.handlerName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ currentException.createdAt }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin: 16px 0 8px">异常详情</h4>
            <div style="background: var(--bg-page); padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap">
              {{ currentException.exceptionDetail }}
            </div>
            <h4 style="margin: 16px 0 8px">关联订单信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="关联订单号">{{ currentException.channelOrderNo }}</el-descriptions-item>
              <el-descriptions-item label="订单金额">¥{{ (Math.random() * 300 + 50).toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="下单时间">2026-07-01 09:30:00</el-descriptions-item>
            </el-descriptions>
          </el-col>
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">处理记录</h4>
            <el-timeline>
              <el-timeline-item
                v-for="(log, idx) in resolutionLogs"
                :key="idx"
                :timestamp="log.createdAt"
                placement="top"
                :type="idx === resolutionLogs.length - 1 ? 'success' : 'primary'"
              >
                <div><strong>{{ log.handlerName }}</strong> - {{ log.action }}</div>
                <div v-if="log.result" style="color: var(--text-muted); font-size: 13px; margin-top: 4px">{{ log.result }}</div>
              </el-timeline-item>
            </el-timeline>
          </el-col>
        </el-row>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-normal); display: flex; gap: 12px; align-items: center">
          <el-select v-model="assignHandler" placeholder="分配处理人" clearable style="width: 160px">
            <el-option label="张三" value="张三" />
            <el-option label="李四" value="李四" />
            <el-option label="王五" value="王五" />
          </el-select>
          <el-input v-model="handlePlan" type="textarea" placeholder="处理方案" :rows="2" style="flex: 1" />
          <el-button type="success" @click="markResolved">标记已解决</el-button>
          <el-button type="danger" @click="closeException">关闭异常</el-button>
        </div>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { fetchOrderExceptions, fetchOrderExceptionStats, handleOrderException, fetchOrderExceptionLogs } from "../../api";
import { ElMessage, ElMessageBox } from "element-plus";
import { WarningFilled, Plus, CircleCheckFilled, Warning, CircleClose, CircleCloseFilled } from "@element-plus/icons-vue";
import echarts from '@/utils/echarts'
import { CHART_COLORS } from "@/styles/theme";

// ── Mock 数据 ──
const exceptionStats = ref({ pendingCount: 0, todayNewCount: 0, weekResolvedCount: 0, avgHandleHours: 0 });

const exceptionTypes = ref<any[]>([])

const channelException = ref<any[]>([])

const exceptionTrend = ref<any[]>([])

const exceptions = ref<any[]>([])

const resolutionLogs = ref<any[]>([])

// ── 图表 ref ──
const exceptionTypeChartRef = ref<HTMLDivElement | null>(null);
const channelExceptionChartRef = ref<HTMLDivElement | null>(null);
const exceptionTrendChartRef = ref<HTMLDivElement | null>(null);

let exceptionTypeChart: echarts.ECharts | null = null;
let channelExceptionChart: echarts.ECharts | null = null;
let exceptionTrendChart: echarts.ECharts | null = null;

// ── 筛选 ──
const trendMode = ref("day");
const filters = ref({
  exceptionTypes: [] as string[],
  exceptionLevel: "",
  handleStatus: "",
  channel: "",
  dateRange: [] as string[],
  keyword: "",
});

const page = ref(1);
const pageSize = ref(10);

const filteredExceptions = computed(() => {
  let list = [...exceptions.value];
  if (filters.value.exceptionTypes.length > 0) {
    list = list.filter((e) => filters.value.exceptionTypes.includes(e.exceptionType));
  }
  if (filters.value.exceptionLevel) {
    list = list.filter((e) => e.exceptionLevel === filters.value.exceptionLevel);
  }
  if (filters.value.handleStatus) {
    list = list.filter((e) => e.handleStatus === filters.value.handleStatus);
  }
  if (filters.value.channel) {
    list = list.filter((e) => e.channelType === filters.value.channel);
  }
  if (filters.value.keyword) {
    const kw = filters.value.keyword.toLowerCase();
    list = list.filter((e) => e.channelOrderNo.toLowerCase().includes(kw));
  }
  return list;
});

// ── 详情弹窗 ──
const detailVisible = ref(false);
const currentException = ref<any>(null);
const assignHandler = ref("");
const handlePlan = ref("");

// ── 工具函数 ──
const channelMap: Record<string, string> = { WECHAT: "微信", MEITUAN: "美团", ELEME: "饿了么", JD: "京东", DOUYIN: "抖音" };
const channelTagMap: Record<string, string> = { WECHAT: "success", MEITUAN: "warning", ELEME: "primary", JD: "danger", DOUYIN: "" };
const exceptionTypeMap: Record<string, string> = { DELAY: "配送延迟", CANCEL: "订单取消", PRICE_MISMATCH: "价格不匹配", STOCK_MISMATCH: "库存不匹配", PAYMENT_FAIL: "支付失败", SYNC_FAIL: "同步失败", OTHER: "其他" };
const exceptionTypeTagMap: Record<string, string> = { DELAY: "warning", CANCEL: "info", PRICE_MISMATCH: "danger", STOCK_MISMATCH: "", PAYMENT_FAIL: "danger", SYNC_FAIL: "primary", OTHER: "info" };

function channelName(type: string) { return channelMap[type] || type; }
function channelTagType(type: string) { return (channelTagMap[type] || "info") as any; }
function exceptionTypeName(type: string) { return exceptionTypeMap[type] || type; }
function exceptionTypeTag(type: string) { return (exceptionTypeTagMap[type] || "info") as any; }

// ── 图表渲染 ──
function renderExceptionTypeChart() {
  if (!exceptionTypeChartRef.value) return;
  if (!exceptionTypeChart) {
    exceptionTypeChart = echarts.init(exceptionTypeChartRef.value);
  }
  exceptionTypeChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "50%"],
        label: { show: true, formatter: "{b}\n{d}%" },
        data: exceptionTypes.value.map((t) => ({ name: t.name, value: t.count })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  });
}

function renderChannelExceptionChart() {
  if (!channelExceptionChartRef.value) return;
  if (!channelExceptionChart) {
    channelExceptionChart = echarts.init(channelExceptionChartRef.value);
  }
  channelExceptionChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: channelException.value.map((c) => c.name),
      axisLabel: { fontSize: 12 },
    },
    yAxis: { type: "value", name: "异常率(%)", axisLabel: { formatter: "{value}%" } },
    series: [
      {
        type: "bar",
        data: channelException.value.map((c) => c.rate),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CHART_COLORS.danger },
            { offset: 1, color: "rgba(192,57,43,0.4)" },
          ]),
        },
        barWidth: 32,
        label: { show: true, position: "top", formatter: "{c}%", fontSize: 12 },
      },
    ],
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
  });
}

function renderExceptionTrendChart() {
  if (!exceptionTrendChartRef.value) return;
  if (!exceptionTrendChart) {
    exceptionTrendChart = echarts.init(exceptionTrendChartRef.value);
  }
  let data = exceptionTrend.value;
  if (trendMode.value === "week") {
    data = exceptionTrend.value.filter((_, i) => i % 7 === 0);
  } else if (trendMode.value === "month") {
    data = exceptionTrend.value.filter((_, i) => i % 10 === 0);
  }
  exceptionTrendChart.setOption({
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 11, rotate: 30 } },
    yAxis: { type: "value", name: "异常数" },
    series: [
      {
        type: "line",
        data: data.map((d) => d.count),
        smooth: true,
        lineStyle: { color: CHART_COLORS.primary, width: 2 },
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(63,111,239,0.25)" },
            { offset: 1, color: "rgba(63,111,239,0.02)" },
          ]),
        },
      },
    ],
    grid: { left: 45, right: 15, top: 15, bottom: 40 },
  });
}

// ── 操作 ──
function handleSearch() {
  page.value = 1;
}

function handleReset() {
  filters.value = { exceptionTypes: [], exceptionLevel: "", handleStatus: "", channel: "", dateRange: [], keyword: "" };
  page.value = 1;
}

async function handleRefresh() {
  await loadExceptionData();
  ElMessage.success("刷新成功");
}

function handleSizeChange(size: number) {
  pageSize.value = size;
}

function handlePageChange(p: number) {
  page.value = p;
}

async function handleException(row: any) {
  currentException.value = row;
  detailVisible.value = true;
  assignHandler.value = "";
  handlePlan.value = "";
  await loadResolutionLogs(row.id);
}

async function viewDetail(row: any) {
  currentException.value = row;
  detailVisible.value = true;
  assignHandler.value = "";
  handlePlan.value = "";
  await loadResolutionLogs(row.id);
}

async function markResolved() {
  if (!currentException.value?.id) return
  try {
    await ElMessageBox.confirm("确认标记为已解决？", "确认", { confirmButtonText: "确定", cancelButtonText: "取消", type: "success" })
    await handleOrderException(currentException.value.id, { action: "标记已解决", status: "RESOLVED" })
    ElMessage.success("已标记为已解决")
    detailVisible.value = false
    await loadExceptionData()
  } catch {}
}

async function closeException() {
  if (!currentException.value?.id) return
  try {
    await ElMessageBox.confirm("确认关闭此异常？关闭后不可恢复。", "二次确认", { confirmButtonText: "确定关闭", cancelButtonText: "取消", type: "warning" })
    await handleOrderException(currentException.value.id, { action: "关闭异常", status: "CLOSED" })
    ElMessage.success("异常已关闭")
    detailVisible.value = false
    await loadExceptionData()
  } catch {}
}

// ── 响应式 resize ──
function handleResize() {
  exceptionTypeChart?.resize();
  channelExceptionChart?.resize();
  exceptionTrendChart?.resize();
}

async function loadExceptionData() {
  try {
    const [stats, list] = await Promise.all([
      fetchOrderExceptionStats(),
      fetchOrderExceptions({ page: page.value, pageSize: pageSize.value, handleStatus: filters.value.handleStatus || undefined, keyword: filters.value.keyword || undefined }),
    ])
    exceptionStats.value = { pendingCount: stats?.pendingCount ?? 0, todayNewCount: stats?.todayNewCount ?? 0, weekResolvedCount: stats?.weekResolvedCount ?? 0, avgHandleHours: stats?.avgHandleHours ?? 0 }
    exceptionTypes.value = stats?.exceptionTypes || []
    channelException.value = stats?.channelException || []
    exceptionTrend.value = stats?.exceptionTrend || []
    exceptions.value = list?.records || []
  } catch (e: any) {
    ElMessage.warning(e?.response?.data?.msg || '加载异常数据失败')
  }
  nextTick(() => {
    renderExceptionTypeChart();
    renderChannelExceptionChart();
    renderExceptionTrendChart();
  });
}

async function loadResolutionLogs(id: number) {
  try {
    resolutionLogs.value = (await fetchOrderExceptionLogs(id)) || []
  } catch {
    resolutionLogs.value = []
  }
}

onMounted(() => {
  loadExceptionData();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  exceptionTypeChart?.dispose();
  channelExceptionChart?.dispose();
  exceptionTrendChart?.dispose();
});
</script>

<style scoped>
.page { padding: 0;
}
.detail-summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  cursor: pointer;
  color: var(--color-primary);
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
</style>
