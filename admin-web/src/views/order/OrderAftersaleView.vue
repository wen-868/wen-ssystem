<template>
  <div class="page">
    <!-- 售后统计区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="售后总数" :value="mockStats.totalCount">
            <template #prefix><el-icon><Document /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="待审核" :value="mockStats.pendingCount" value-style="color: #F59E0B">
            <template #prefix><el-icon><Clock /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="今日新增" :value="mockStats.todayNewCount" value-style="color: #1677FF">
            <template #prefix><el-icon><Plus /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="售后率" :value="mockStats.aftersaleRate" value-style="color: #EF4444">
            <template #suffix>%</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="8">
        <el-card>
          <template #header><span>售后类型分布</span></template>
          <div ref="aftersaleTypeChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header><span>渠道售后率</span></template>
          <div ref="channelAftersaleChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header><span>退款金额趋势</span></template>
          <div ref="refundTrendChartRef" style="width: 100%; height: 280px"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <el-card style="margin-bottom: 16px">
      <div class="filter-area" style="margin-bottom: 0; border: none; padding: 0; box-shadow: none">
        <el-select v-model="filters.channel" placeholder="渠道" clearable style="width: 120px">
          <el-option label="微信" value="WECHAT" />
          <el-option label="美团" value="MEITUAN" />
          <el-option label="饿了么" value="ELEME" />
          <el-option label="京东" value="JD" />
          <el-option label="抖音" value="DOUYIN" />
        </el-select>
        <el-select v-model="filters.aftersaleType" placeholder="售后类型" clearable style="width: 130px">
          <el-option label="仅退款" value="REFUND_ONLY" />
          <el-option label="退货退款" value="RETURN_REFUND" />
          <el-option label="换货" value="EXCHANGE" />
          <el-option label="维修" value="REPAIR" />
        </el-select>
        <el-select v-model="filters.aftersaleStatus" placeholder="售后状态" clearable style="width: 120px">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="待收货" value="AWAITING_GOODS" />
          <el-option label="待质检" value="QC" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已关闭" value="CLOSED" />
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
        <el-input v-model="filters.keyword" placeholder="搜索售后单号/订单号" clearable style="width: 220px" />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 售后列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>售后列表</span>
          <el-button @click="handleRefresh">刷新</el-button>
        </div>
      </template>
      <el-table :data="filteredAftersales" stripe>
        <el-table-column label="渠道" width="90">
          <template #default="{ row }">
            <el-tag :type="channelTagType(row.channelType)" size="small">{{ channelName(row.channelType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="aftersaleNo" label="售后单号" width="150" />
        <el-table-column prop="channelOrderNo" label="关联订单号" width="150" />
        <el-table-column label="售后类型" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.aftersaleType === 'REFUND_ONLY'" type="primary">仅退款</el-tag>
            <el-tag v-else-if="row.aftersaleType === 'RETURN_REFUND'" type="warning">退货退款</el-tag>
            <el-tag v-else-if="row.aftersaleType === 'EXCHANGE'" type="success">换货</el-tag>
            <el-tag v-else type="info">维修</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因摘要" min-width="140" />
        <el-table-column label="退款金额" width="110">
          <template #default="{ row }">
            <span v-if="row.aftersaleType !== 'EXCHANGE'" style="color: #EF4444">¥{{ Number(row.refundAmount || 0).toFixed(2) }}</span>
            <span v-else style="color: #9CA3AF">-</span>
          </template>
        </el-table-column>
        <el-table-column label="售后状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.aftersaleStatus === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.aftersaleStatus === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="row.aftersaleStatus === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="row.aftersaleStatus === 'AWAITING_GOODS'" type="info">待收货</el-tag>
            <el-tag v-else-if="row.aftersaleStatus === 'QC'" type="warning">待质检</el-tag>
            <el-tag v-else-if="row.aftersaleStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else type="info">已关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handlerName" label="处理人" width="100">
          <template #default="{ row }">{{ row.handlerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.aftersaleStatus === 'PENDING'" size="small" link type="primary" @click="openReview(row)">审核</el-button>
            <el-button size="small" link type="primary" @click="viewDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredAftersales.length"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 售后详情弹窗 -->
    <el-dialog v-model="detailVisible" title="售后详情" width="800px" top="5vh">
      <template v-if="currentAftersale">
        <el-row :gutter="24">
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">售后基本信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="售后单号">{{ currentAftersale.aftersaleNo }}</el-descriptions-item>
              <el-descriptions-item label="关联订单号">{{ currentAftersale.channelOrderNo }}</el-descriptions-item>
              <el-descriptions-item label="渠道">{{ channelName(currentAftersale.channelType) }}</el-descriptions-item>
              <el-descriptions-item label="售后类型">
                <el-tag v-if="currentAftersale.aftersaleType === 'REFUND_ONLY'" type="primary">仅退款</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleType === 'RETURN_REFUND'" type="warning">退货退款</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleType === 'EXCHANGE'" type="success">换货</el-tag>
                <el-tag v-else type="info">维修</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="原因">{{ currentAftersale.reason }}</el-descriptions-item>
              <el-descriptions-item label="售后状态">
                <el-tag v-if="currentAftersale.aftersaleStatus === 'PENDING'" type="warning">待审核</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleStatus === 'APPROVED'" type="primary">已通过</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleStatus === 'REJECTED'" type="danger">已拒绝</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleStatus === 'AWAITING_GOODS'" type="info">待收货</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleStatus === 'QC'" type="warning">待质检</el-tag>
                <el-tag v-else-if="currentAftersale.aftersaleStatus === 'COMPLETED'" type="success">已完成</el-tag>
                <el-tag v-else type="info">已关闭</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="处理人">{{ currentAftersale.handlerName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ currentAftersale.createdAt }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin: 16px 0 8px">商品信息</h4>
            <el-table :data="currentAftersaleItems" border size="small">
              <el-table-column prop="productName" label="商品" />
              <el-table-column prop="quantity" label="数量" width="60" />
              <el-table-column label="单价" width="90">
                <template #default="{ row }">¥{{ Number(row.price || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="小计" width="90">
                <template #default="{ row }">¥{{ Number(row.subtotal || 0).toFixed(2) }}</template>
              </el-table-column>
            </el-table>
            <div style="text-align: right; margin-top: 8px; font-size: 14px; font-weight: 600">
              退款金额：<span style="color: #EF4444; font-size: 16px">¥{{ Number(currentAftersale.refundAmount || 0).toFixed(2) }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <h4 style="margin: 0 0 12px">处理记录</h4>
            <el-timeline>
              <el-timeline-item
                v-for="(log, idx) in mockAftersaleLogs"
                :key="idx"
                :timestamp="log.createdAt"
                placement="top"
                :type="idx === mockAftersaleLogs.length - 1 ? 'success' : 'primary'"
              >
                <div><strong>{{ log.handlerName }}</strong> - {{ log.action }}</div>
                <div v-if="log.result" style="color: #9CA3AF; font-size: 13px; margin-top: 4px">{{ log.result }}</div>
              </el-timeline-item>
            </el-timeline>
            <h4 style="margin: 16px 0 8px">物流信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="快递公司">顺丰速运</el-descriptions-item>
              <el-descriptions-item label="快递单号">SF1234567890</el-descriptions-item>
              <el-descriptions-item label="退货地址">北京市朝阳区xxx路xxx号</el-descriptions-item>
              <el-descriptions-item label="收货人">张三</el-descriptions-item>
              <el-descriptions-item label="联系电话">138****1234</el-descriptions-item>
            </el-descriptions>
          </el-col>
        </el-row>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E5E7EB; display: flex; gap: 12px; align-items: center">
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
          <el-button type="primary" @click="handleComplete">完成售后</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 拒绝原因弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝原因" width="480px" append-to-body>
      <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请输入拒绝原因" />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleRejectConfirm">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Document, Clock, Plus } from "@element-plus/icons-vue";
import echarts from '@/utils/echarts'

// ── Mock 数据 ──
const mockStats = { totalCount: 86, pendingCount: 12, todayNewCount: 5, aftersaleRate: 3.2 };

const mockAftersaleTypes = [
  { type: "REFUND_ONLY", name: "仅退款", count: 35 },
  { type: "RETURN_REFUND", name: "退货退款", count: 30 },
  { type: "EXCHANGE", name: "换货", count: 15 },
  { type: "REPAIR", name: "维修", count: 6 },
];

const mockChannelAftersale = [
  { channel: "MEITUAN", name: "美团", rate: 4.2 },
  { channel: "ELEME", name: "饿了么", rate: 3.5 },
  { channel: "WECHAT", name: "微信", rate: 2.1 },
  { channel: "JD", name: "京东", rate: 2.8 },
  { channel: "DOUYIN", name: "抖音", rate: 5.0 },
];

const mockRefundTrend = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 2).padStart(2, "0")}`,
  amount: Math.floor(Math.random() * 3000 + 500),
}));

const mockAftersales = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  channelType: ["WECHAT", "MEITUAN", "ELEME", "JD", "DOUYIN"][i % 5] as string,
  aftersaleNo: `AS${String(i + 1).padStart(6, "0")}`,
  channelOrderNo: `CH${String(i + 1).padStart(6, "0")}`,
  aftersaleType: ["REFUND_ONLY", "RETURN_REFUND", "EXCHANGE", "REPAIR"][i % 4] as string,
  reason: `原因描述${i + 1}`,
  refundAmount: i % 4 !== 2 ? Math.floor(Math.random() * 300 + 50) : 0,
  aftersaleStatus: ["PENDING", "APPROVED", "REJECTED", "AWAITING_GOODS", "QC", "COMPLETED", "CLOSED"][i % 7] as string,
  handlerName: i % 3 === 0 ? "" : `处理人${i}`,
  createdAt: `2026-07-01 ${String(i + 8).padStart(2, "0")}:00:00`,
}));

const mockAftersaleLogs = [
  { handlerName: "系统", action: "创建售后", result: "", createdAt: "2026-07-01 10:00:00" },
  { handlerName: "李四", action: "审核通过", result: "同意退款", createdAt: "2026-07-01 10:30:00" },
  { handlerName: "李四", action: "完成售后", result: "已退款到原支付方式", createdAt: "2026-07-01 11:00:00" },
];

const currentAftersaleItems = [
  { productName: "商品A - 大号红色", quantity: 1, price: 128.0, subtotal: 128.0 },
  { productName: "商品B - 标准款", quantity: 2, price: 49.0, subtotal: 98.0 },
];

// ── 图表 ref ──
const aftersaleTypeChartRef = ref<HTMLDivElement | null>(null);
const channelAftersaleChartRef = ref<HTMLDivElement | null>(null);
const refundTrendChartRef = ref<HTMLDivElement | null>(null);

let aftersaleTypeChart: echarts.ECharts | null = null;
let channelAftersaleChart: echarts.ECharts | null = null;
let refundTrendChart: echarts.ECharts | null = null;

// ── 筛选 ──
const filters = ref({
  channel: "",
  aftersaleType: "",
  aftersaleStatus: "",
  dateRange: [] as string[],
  keyword: "",
});

const page = ref(1);
const pageSize = ref(10);

const filteredAftersales = computed(() => {
  let list = [...mockAftersales];
  if (filters.value.channel) {
    list = list.filter((a) => a.channelType === filters.value.channel);
  }
  if (filters.value.aftersaleType) {
    list = list.filter((a) => a.aftersaleType === filters.value.aftersaleType);
  }
  if (filters.value.aftersaleStatus) {
    list = list.filter((a) => a.aftersaleStatus === filters.value.aftersaleStatus);
  }
  if (filters.value.keyword) {
    const kw = filters.value.keyword.toLowerCase();
    list = list.filter((a) => a.aftersaleNo.toLowerCase().includes(kw) || a.channelOrderNo.toLowerCase().includes(kw));
  }
  return list;
});

// ── 详情弹窗 ──
const detailVisible = ref(false);
const currentAftersale = ref<any>(null);

// ── 拒绝弹窗 ──
const rejectDialogVisible = ref(false);
const rejectReason = ref("");

// ── 工具函数 ──
const channelMap: Record<string, string> = { WECHAT: "微信", MEITUAN: "美团", ELEME: "饿了么", JD: "京东", DOUYIN: "抖音" };
const channelTagMap: Record<string, string> = { WECHAT: "success", MEITUAN: "warning", ELEME: "primary", JD: "danger", DOUYIN: "" };

function channelName(type: string) { return channelMap[type] || type; }
function channelTagType(type: string) { return (channelTagMap[type] || "info") as any; }

// ── 图表渲染 ──
function renderAftersaleTypeChart() {
  if (!aftersaleTypeChartRef.value) return;
  if (!aftersaleTypeChart) {
    aftersaleTypeChart = echarts.init(aftersaleTypeChartRef.value);
  }
  aftersaleTypeChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "50%"],
        label: { show: true, formatter: "{b}\n{d}%" },
        data: mockAftersaleTypes.map((t) => ({ name: t.name, value: t.count })),
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  });
}

function renderChannelAftersaleChart() {
  if (!channelAftersaleChartRef.value) return;
  if (!channelAftersaleChart) {
    channelAftersaleChart = echarts.init(channelAftersaleChartRef.value);
  }
  channelAftersaleChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: mockChannelAftersale.map((c) => c.name),
      axisLabel: { fontSize: 12 },
    },
    yAxis: { type: "value", name: "售后率(%)", axisLabel: { formatter: "{value}%" } },
    series: [
      {
        type: "bar",
        data: mockChannelAftersale.map((c) => c.rate),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#F59E0B" },
            { offset: 1, color: "#FDE68A" },
          ]),
        },
        barWidth: 32,
        label: { show: true, position: "top", formatter: "{c}%", fontSize: 12 },
      },
    ],
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
  });
}

function renderRefundTrendChart() {
  if (!refundTrendChartRef.value) return;
  if (!refundTrendChart) {
    refundTrendChart = echarts.init(refundTrendChartRef.value);
  }
  refundTrendChart.setOption({
    tooltip: { trigger: "axis", formatter: (params: any) => `${params[0].axisValue}<br/>退款金额: ¥${params[0].value}` },
    xAxis: { type: "category", data: mockRefundTrend.map((d) => d.date), axisLabel: { fontSize: 11, rotate: 30 } },
    yAxis: { type: "value", name: "元", axisLabel: { formatter: "¥{value}" } },
    series: [
      {
        type: "line",
        data: mockRefundTrend.map((d) => d.amount),
        smooth: true,
        lineStyle: { color: "#10B981", width: 2 },
        itemStyle: { color: "#10B981" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(16,185,129,0.25)" },
            { offset: 1, color: "rgba(16,185,129,0.02)" },
          ]),
        },
      },
    ],
    grid: { left: 60, right: 15, top: 15, bottom: 40 },
  });
}

// ── 操作 ──
function handleSearch() { page.value = 1; }

function handleReset() {
  filters.value = { channel: "", aftersaleType: "", aftersaleStatus: "", dateRange: [], keyword: "" };
  page.value = 1;
}

function handleRefresh() { ElMessage.success("刷新成功"); }

function handleSizeChange(size: number) { pageSize.value = size; }
function handlePageChange(p: number) { page.value = p; }

function openReview(row: any) {
  currentAftersale.value = row;
  detailVisible.value = true;
}

function viewDetail(row: any) {
  currentAftersale.value = row;
  detailVisible.value = true;
}

function handleApprove() {
  ElMessageBox.confirm("确认通过此售后申请？退款金额将原路返回。", "二次确认", { confirmButtonText: "确认通过", cancelButtonText: "取消", type: "success" })
    .then(() => {
      ElMessage.success("售后申请已通过");
      detailVisible.value = false;
    })
    .catch(() => {});
}

function showRejectReasonDialog() {
  rejectReason.value = "";
  rejectDialogVisible.value = true;
}

function handleRejectConfirm() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning("请输入拒绝原因");
    return;
  }
  ElMessage.success("售后申请已拒绝");
  rejectDialogVisible.value = false;
  detailVisible.value = false;
}

function handleComplete() {
  ElMessageBox.confirm("确认完成售后？", "确认", { confirmButtonText: "确定", cancelButtonText: "取消", type: "success" })
    .then(() => {
      ElMessage.success("售后已完成");
      detailVisible.value = false;
    })
    .catch(() => {});
}

// ── 响应式 resize ──
function handleResize() {
  aftersaleTypeChart?.resize();
  channelAftersaleChart?.resize();
  refundTrendChart?.resize();
}

onMounted(() => {
  nextTick(() => {
    renderAftersaleTypeChart();
    renderChannelAftersaleChart();
    renderRefundTrendChart();
  });
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  aftersaleTypeChart?.dispose();
  channelAftersaleChart?.dispose();
  refundTrendChart?.dispose();
});
</script>

<style scoped>
.page {
  padding: 20px;
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