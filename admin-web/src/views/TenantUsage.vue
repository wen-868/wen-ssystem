<template>
  <div class="tenant-usage-page">
    <!-- 顶部统计 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card stat-primary">
          <div class="stat-icon">
            <el-icon><OfficeBuilding /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.activeTenants }}</div>
            <div class="stat-label">活跃租户</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-success">
          <div class="stat-icon">
            <el-icon><Tickets /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalOrders }}</div>
            <div class="stat-label">总订单数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-warning">
          <div class="stat-icon">
            <el-icon><Money /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥{{ formatAmount(stats.totalSales) }}</div>
            <div class="stat-label">总销售额</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-info">
          <div class="stat-icon">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalLogins }}</div>
            <div class="stat-label">总登录次数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选区域 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" inline>
        <el-form-item label="时间范围">
          <el-radio-group v-model="filterForm.granularity" size="default" @change="fetchTrendData">
            <el-radio-button value="day">按日</el-radio-button>
            <el-radio-button value="week">按周</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="统计周期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
            @change="fetchAllData"
          />
        </el-form-item>
        <el-form-item label="租户搜索">
          <el-input
            v-model="filterForm.tenantKeyword"
            placeholder="请输入租户名称"
            clearable
            style="width: 200px"
            @keyup.enter="fetchRanking"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchAllData">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 趋势图表 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>租户登录次数趋势</span>
          </template>
          <div ref="loginTrendChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>订单量趋势</span>
          </template>
          <div ref="orderTrendChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <span>销售额趋势</span>
          </template>
          <div ref="salesTrendChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span>模块使用占比</span>
          </template>
          <div ref="modulePieChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 租户活跃度排行榜 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>租户活跃度排行榜</span>
          <el-button type="primary" size="small" @click="fetchRanking">刷新</el-button>
        </div>
      </template>
      <el-table :data="rankingList" border stripe v-loading="rankingLoading">
        <el-table-column type="index" label="排名" width="80" align="center">
          <template #default="{ $index }">
            <el-tag v-if="$index < 3" :type="getRankTagType($index)" size="small">{{ $index + 1 }}</el-tag>
            <span v-else>{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="tenantName" label="租户名称" min-width="160" />
        <el-table-column prop="loginCount" label="登录次数" width="120" align="right" sortable />
        <el-table-column prop="orderCount" label="订单数" width="120" align="right" sortable />
        <el-table-column prop="salesAmount" label="销售额" width="140" align="right" sortable>
          <template #default="{ row }">¥{{ formatAmount(row.salesAmount) }}</template>
        </el-table-column>
        <el-table-column prop="lastActiveAt" label="最后活跃时间" width="180" />
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="rankingPage"
          v-model:page-size="rankingPageSize"
          :total="rankingTotal"
          layout="total, prev, pager, next"
          @current-change="fetchRanking"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import { OfficeBuilding, Tickets, Money, User } from "@element-plus/icons-vue";
import echarts from "@/utils/echarts";
import {
  fetchTenantUsageStats,
  fetchTenantUsageTrend,
  fetchTenantUsageRanking,
  fetchTenantModuleUsage,
} from "@/api";

const stats = reactive({
  activeTenants: 0,
  totalOrders: 0,
  totalSales: 0,
  totalLogins: 0,
});

const filterForm = reactive({
  granularity: "day",
  tenantKeyword: "",
});

const dateRange = ref<string[]>([]);
const rankingList = ref<any[]>([]);
const rankingPage = ref(1);
const rankingPageSize = ref(10);
const rankingTotal = ref(0);
const rankingLoading = ref(false);

const formatAmount = (val: number | string | undefined) => {
  const num = Number(val) || 0;
  return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getRankTagType = (index: number) => {
  if (index === 0) return "danger";
  if (index === 1) return "warning";
  return "success";
};

// 图表引用
const loginTrendChartRef = ref<HTMLDivElement>();
const orderTrendChartRef = ref<HTMLDivElement>();
const salesTrendChartRef = ref<HTMLDivElement>();
const modulePieChartRef = ref<HTMLDivElement>();

let loginTrendInstance: echarts.ECharts | null = null;
let orderTrendInstance: echarts.ECharts | null = null;
let salesTrendInstance: echarts.ECharts | null = null;
let modulePieInstance: echarts.ECharts | null = null;

const fetchStats = async () => {
  try {
    const res = await fetchTenantUsageStats({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    });
    if (res) {
      stats.activeTenants = res.activeTenants || 0;
      stats.totalOrders = res.totalOrders || 0;
      stats.totalSales = res.totalSales || 0;
      stats.totalLogins = res.totalLogins || 0;
    }
  } catch {
    /* ignore */
  }
};

const fetchTrendData = async () => {
  try {
    const res = await fetchTenantUsageTrend({
      granularity: filterForm.granularity,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    });
    const list = res?.records || res?.data || [];
    await nextTick();
    renderLoginTrendChart(list);
    renderOrderTrendChart(list);
    renderSalesTrendChart(list);
  } catch {
    /* ignore */
  }
};

const fetchModuleData = async () => {
  try {
    const res = await fetchTenantModuleUsage({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    });
    const list = res?.records || res?.data || [];
    await nextTick();
    renderModulePieChart(list);
  } catch {
    /* ignore */
  }
};

const fetchRanking = async () => {
  rankingLoading.value = true;
  try {
    const res = await fetchTenantUsageRanking({
      page: rankingPage.value,
      pageSize: rankingPageSize.value,
      keyword: filterForm.tenantKeyword || undefined,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    });
    const list = res.records || res.list || [];
    rankingList.value = list;
    rankingTotal.value = res.total || list.length;
  } catch {
    ElMessage.error("获取排行榜失败");
  } finally {
    rankingLoading.value = false;
  }
};

const fetchAllData = () => {
  fetchStats();
  fetchTrendData();
  fetchModuleData();
  fetchRanking();
};

const resetFilter = () => {
  filterForm.granularity = "day";
  filterForm.tenantKeyword = "";
  dateRange.value = [];
  rankingPage.value = 1;
  fetchAllData();
};

// 登录趋势图
const renderLoginTrendChart = (data: any[]) => {
  if (!loginTrendChartRef.value) return;
  if (loginTrendInstance) loginTrendInstance.dispose();

  const labels = data.map((d) => d.date || d.label || d.period || "");
  const loginData = data.map((d) => Number(d.loginCount) || 0);

  loginTrendInstance = echarts.init(loginTrendChartRef.value);
  loginTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: labels },
    yAxis: { type: "value" },
    series: [
      {
        name: "登录次数",
        type: "line",
        data: loginData,
        smooth: true,
        itemStyle: { color: "#409eff" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64,158,255,0.4)" },
            { offset: 1, color: "rgba(64,158,255,0.05)" },
          ]),
        },
      },
    ],
  });
};

// 订单趋势图
const renderOrderTrendChart = (data: any[]) => {
  if (!orderTrendChartRef.value) return;
  if (orderTrendInstance) orderTrendInstance.dispose();

  const labels = data.map((d) => d.date || d.label || d.period || "");
  const orderData = data.map((d) => Number(d.orderCount) || 0);

  orderTrendInstance = echarts.init(orderTrendChartRef.value);
  orderTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: labels },
    yAxis: { type: "value" },
    series: [
      {
        name: "订单量",
        type: "bar",
        data: orderData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#67c23a" },
            { offset: 1, color: "rgba(103,194,58,0.3)" },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: "50%",
      },
    ],
  });
};

// 销售额趋势图
const renderSalesTrendChart = (data: any[]) => {
  if (!salesTrendChartRef.value) return;
  if (salesTrendInstance) salesTrendInstance.dispose();

  const labels = data.map((d) => d.date || d.label || d.period || "");
  const salesData = data.map((d) => Number(d.salesAmount) || 0);

  salesTrendInstance = echarts.init(salesTrendChartRef.value);
  salesTrendInstance.setOption({
    tooltip: { trigger: "axis", formatter: (params: any) => {
      const p = params[0];
      return `${p.name}<br/>销售额: ¥${Number(p.value).toLocaleString()}`;
    }},
    grid: { left: 70, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: labels },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => (v >= 10000 ? (v / 10000).toFixed(1) + "万" : v) },
    },
    series: [
      {
        name: "销售额",
        type: "line",
        data: salesData,
        smooth: true,
        itemStyle: { color: "#e6a23c" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(230,162,60,0.4)" },
            { offset: 1, color: "rgba(230,162,60,0.05)" },
          ]),
        },
      },
    ],
  });
};

// 模块使用占比饼图
const renderModulePieChart = (data: any[]) => {
  if (!modulePieChartRef.value) return;
  if (modulePieInstance) modulePieInstance.dispose();

  const pieData = data.length
    ? data.map((d) => ({ name: d.moduleName || d.name, value: d.useCount || d.value }))
    : [
        { name: "销售管理", value: 3420 },
        { name: "采购管理", value: 1860 },
        { name: "库存管理", value: 2680 },
        { name: "财务管理", value: 1240 },
        { name: "会员管理", value: 980 },
        { name: "系统设置", value: 520 },
      ];

  modulePieInstance = echarts.init(modulePieChartRef.value);
  modulePieInstance.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center" },
    series: [
      {
        type: "pie",
        radius: ["45%", "75%"],
        center: ["35%", "50%"],
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: "bold" },
        },
        data: pieData,
        color: ["#409eff", "#67c23a", "#e6a23c", "#f56c6c", "#909399", "#9b59b6"],
      },
    ],
  });
};

const handleResize = () => {
  loginTrendInstance?.resize();
  orderTrendInstance?.resize();
  salesTrendInstance?.resize();
  modulePieInstance?.resize();
};

onMounted(() => {
  fetchAllData();
  window.addEventListener("resize", handleResize);
});
</script>

<style scoped>
.tenant-usage-page {
  padding: 20px;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-card {
  border: none;
  border-radius: 8px;
}
.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  padding: 20px;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 16px;
  color: #fff;
}
.stat-primary .stat-icon {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}
.stat-success .stat-icon {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}
.stat-warning .stat-icon {
  background: linear-gradient(135deg, #e6a23c, #ebb563);
}
.stat-info .stat-icon {
  background: linear-gradient(135deg, #909399, #a6a9ad);
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
  color: #303133;
}
.stat-label {
  font-size: 14px;
  color: #909399;
}
.filter-card {
  margin-bottom: 20px;
  border-radius: 8px;
}
.chart-row {
  margin-bottom: 20px;
}
.chart-card {
  border-radius: 8px;
}
.chart-body {
  height: 300px;
  width: 100%;
}
.table-card {
  border-radius: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
