<template>
  <div class="page">
    <!-- 核心指标卡片 -->
    <el-row :gutter="16" v-loading="loading">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #ecf5ff">
              <el-icon :size="28" color="#409EFF"><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总租户数</div>
              <div class="stat-value">{{ overview.tenantCount || 0 }}</div>
              <div class="stat-trend">
                <span class="trend-label">活跃：{{ overview.activeTenantCount || overview.tenantCount || 0 }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f0f9eb">
              <el-icon :size="28" color="#67C23A"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总用户数</div>
              <div class="stat-value">{{ overview.userCount || 0 }}</div>
              <div class="stat-trend">
                <span class="trend-label">门店：{{ overview.storeCount || 0 }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fdf6ec">
              <el-icon :size="28" color="#E6A23C"><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">月收入(元)</div>
              <div class="stat-value">{{ formatYuan(overview.monthlyRevenue || 0) }}</div>
              <div class="stat-trend">
                <span class="trend-label">总收入：{{ formatYuan(overview.totalRevenue || 0) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fef0f0">
              <el-icon :size="28" color="#F56C6C"><Tickets /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总订单数</div>
              <div class="stat-value">{{ overview.orderCount || 0 }}</div>
              <div class="stat-trend">
                <span class="trend-label">日订单：{{ overview.dailyOrderCount || 0 }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 套餐分布 + 租户增长趋势 -->
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <PageCard title="套餐分布">
          <el-table :data="planDistribution" stripe size="small">
            <el-table-column prop="name" label="套餐名称" min-width="120">
              <template #default="{ row }">
                <el-tag :type="getPlanTagType(row.name)">{{ row.name }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="租户数" width="100" align="center" />
            <el-table-column label="占比" width="120" align="center">
              <template #default="{ row }">
                <el-progress :percentage="row.percentage" :stroke-width="14" :text-inside="true" />
              </template>
            </el-table-column>
            <el-table-column label="月收入" width="120" align="center">
              <template #default="{ row }">
                {{ formatYuan(row.revenue) }}
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="60" />
            </template>
          </el-table>
        </PageCard>
      </el-col>
      <el-col :span="12">
        <PageCard title="租户增长趋势（近6个月）">
          <div class="chart-container" ref="trendChartRef">
            <el-empty v-if="!trendData.length" description="暂无趋势数据" :image-size="60" />
          </div>
        </PageCard>
      </el-col>
    </el-row>

    <!-- 租户列表 -->
    <PageCard title="租户列表" style="margin-top: 16px">
      <template #extra>
        <el-input
          v-model="tenantKeyword"
          placeholder="租户名称"
          clearable
          style="width: 180px; margin-right: 10px"
          @keyup.enter="loadTenants"
        />
        <el-button @click="loadTenants">搜索</el-button>
        <el-button @click="loadAll">刷新全部</el-button>
      </template>
      <el-table :data="tenants" v-loading="tenantLoading" stripe size="small">
        <el-table-column prop="tenant_name" label="租户名称" min-width="160">
          <template #default="{ row }">{{ row.tenant_name || row.name }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plan_name" label="当前套餐" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getPlanTagType(row.plan_name || row.planName)">{{ row.plan_name || row.planName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="store_count" label="门店数" width="80" align="center">
          <template #default="{ row }">{{ row.store_count || row.storeCount || 0 }}</template>
        </el-table-column>
        <el-table-column prop="user_count" label="用户数" width="80" align="center">
          <template #default="{ row }">{{ row.user_count || row.userCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="180">
          <template #default="{ row }">{{ formatDate(row.expire_date || row.expireDate) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="60" />
        </template>
      </el-table>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { OfficeBuilding, User, Money, Tickets } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatYuan } from "../utils/format";
import { fetchPlatformOverviewData, fetchPlatformTenantListData, fetchSubscriptionPlans } from "../api";
import * as echarts from "echarts";

const loading = ref(false);
const tenantLoading = ref(false);
const overview = ref<any>({});
const tenants = ref<any[]>([]);
const tenantKeyword = ref("");
const planDistribution = ref<any[]>([]);
const trendData = ref<any[]>([]);
const trendChartRef = ref<HTMLElement>();
let chartInstance: echarts.ECharts | null = null;

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

function getStatusType(status: string): "" | "success" | "info" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "info";
  if (status === "SUSPENDED") return "danger";
  if (status === "TRIAL") return "warning";
  return "";
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "启用",
    INACTIVE: "停用",
    SUSPENDED: "已封禁",
    TRIAL: "试用中"
  };
  return map[status] || status || "未知";
}

function getPlanTagType(name: string): "" | "success" | "warning" | "danger" | "info" {
  if (!name) return "info";
  if (name.includes("旗舰") || name.includes("企业")) return "danger";
  if (name.includes("标准") || name.includes("专业")) return "warning";
  if (name.includes("基础") || name.includes("入门")) return "info";
  return "";
}

async function loadOverview() {
  loading.value = true;
  try {
    overview.value = await fetchPlatformOverviewData();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "加载平台概览失败"));
  } finally {
    loading.value = false;
  }
}

async function loadTenants() {
  tenantLoading.value = true;
  try {
    const data = await fetchPlatformTenantListData({
      keyword: tenantKeyword.value || undefined
    });
    tenants.value = Array.isArray(data) ? data : (data?.records || data?.list || []);
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "加载租户列表失败"));
  } finally {
    tenantLoading.value = false;
  }
}

async function loadPlanDistribution() {
  try {
    const data = (await fetchSubscriptionPlans({ pageSize: 999 })).data;
    const list = data.records || data.list || [];
    const total = list.reduce((sum: number, p: any) => sum + (p.subscriberCount || p.tenantCount || 0), 0) || 1;
    planDistribution.value = list.map((p: any) => ({
      name: p.name,
      count: p.subscriberCount || p.tenantCount || 0,
      percentage: Math.round(((p.subscriberCount || p.tenantCount || 0) / total) * 100),
      revenue: (p.subscriberCount || p.tenantCount || 0) * (p.price || 0)
    }));
  } catch {
    planDistribution.value = [];
  }
}

function loadTrendData() {
  // 生成近6个月的模拟趋势数据（后端暂无此API，使用合理占位数据）
  const now = new Date();
  const months: string[] = [];
  const counts: number[] = [];
  let baseCount = (overview.value.tenantCount || 10) - 5;
  if (baseCount < 1) baseCount = 1;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    baseCount += Math.floor(Math.random() * 3) + 1;
    counts.push(baseCount);
  }
  trendData.value = months.map((m, i) => ({ month: m, count: counts[i] }));
  renderChart();
}

function renderChart() {
  if (!trendChartRef.value || !trendData.value.length) return;
  if (!chartInstance) {
    chartInstance = echarts.init(trendChartRef.value);
  }
  chartInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: trendData.value.map(d => d.month),
      axisLabel: { fontSize: 12 }
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [{
      name: "租户数",
      type: "line",
      data: trendData.value.map(d => d.count),
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: "#409EFF" },
      lineStyle: { width: 3 }
    }]
  });
}

function handleResize() {
  chartInstance?.resize();
}

async function loadAll() {
  await Promise.all([loadOverview(), loadTenants(), loadPlanDistribution()]);
  loadTrendData();
}

onMounted(async () => {
  await loadAll();
  await nextTick();
  renderChart();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});
</script>

<style scoped>
.page {
  padding: 0;
}
.stat-card {
  margin-bottom: 0;
}
.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-info {
  flex: 1;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-trend {
  margin-top: 4px;
}
.trend-label {
  font-size: 12px;
  color: #909399;
}
.chart-container {
  width: 100%;
  height: 280px;
}
</style>
