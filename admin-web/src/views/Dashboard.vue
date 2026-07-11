<template>
  <div class="dashboard">
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <el-skeleton :rows="3" animated />
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col v-for="i in 8" :key="i" :xs="24" :sm="12" :md="6" style="margin-bottom: 16px">
          <el-skeleton animated>
            <template #template>
              <el-card style="min-height: 130px">
                <el-skeleton-item variant="text" style="width: 60%" />
                <el-skeleton-item variant="text" style="width: 40%; margin-top: 8px" />
                <el-skeleton-item variant="text" style="width: 80%; margin-top: 8px" />
              </el-card>
            </template>
          </el-skeleton>
        </el-col>
      </el-row>
      <el-row :gutter="16" style="margin-top: 8px">
        <el-col v-for="i in 4" :key="i" :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-skeleton animated>
            <template #template>
              <el-card style="min-height: 300px">
                <el-skeleton-item variant="h3" style="width: 30%" />
                <el-skeleton-item variant="rect" style="height: 240px; margin-top: 16px" />
              </el-card>
            </template>
          </el-skeleton>
        </el-col>
      </el-row>
    </template>

    <!-- 错误状态 -->
    <template v-else-if="error">
      <el-result icon="error" title="数据加载失败" sub-title="请检查网络连接后重试">
        <template #extra>
          <el-button type="primary" @click="loadAllData">重新加载</el-button>
        </template>
      </el-result>
    </template>

    <!-- 正常内容 -->
    <template v-else>
      <!-- 顶部区域：欢迎语 + 日期 + 门店选择器 -->
      <div class="header-bar">
        <div class="header-left">
          <h2 class="welcome-text">{{ greeting }}，管理员</h2>
          <span class="date-text">{{ formattedDate }}</span>
        </div>
        <div class="header-right">
          <el-select
            v-model="selectedStoreIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全部门店"
            clearable
            style="width: 240px"
            @change="onStoreChange"
          >
            <el-option
              v-for="store in storeList"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </div>
      </div>

      <!-- 指标卡片行 -->
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col
          v-for="card in metricCards"
          :key="card.label"
          :xs="24"
          :sm="12"
          :md="6"
          style="margin-bottom: 16px"
        >
          <el-card class="metric-card" shadow="hover">
            <div class="metric-card-inner">
              <div class="metric-header">
                <span class="metric-label">{{ card.label }}</span>
              </div>
              <div class="metric-value">{{ card.value }}</div>
              <div class="metric-footer">
                <div class="metric-compare">
                  <span class="compare-item" :class="card.momUp ? 'up' : 'down'">
                    <span class="compare-arrow">{{ card.momUp ? '↑' : '↓' }}</span>
                    环比 {{ card.momRate }}
                  </span>
                  <span class="compare-item yoy">
                    同比 {{ card.yoyRate }}
                  </span>
                </div>
              </div>
              <div
                v-if="card.sparkData && card.sparkData.length > 0"
                :ref="(el: any) => setSparkRef(card.key, el as HTMLElement)"
                class="spark-chart"
              />
              <div v-else class="spark-placeholder" />
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 图表区 2x2 网格 -->
      <el-row :gutter="16" style="margin-top: 8px">
        <!-- 左上：销售趋势 -->
        <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-card class="chart-card">
            <template #header>
              <div class="chart-card-header">
                <span>销售趋势</span>
                <el-radio-group
                  v-model="trendRange"
                  size="small"
                  @change="onTrendRangeChange"
                >
                  <el-radio-button value="7">近7天</el-radio-button>
                  <el-radio-button value="30">近30天</el-radio-button>
                </el-radio-group>
              </div>
            </template>
            <div v-if="salesTrendData.length === 0" class="chart-empty">
              <el-empty description="暂无销售数据" :image-size="80" />
            </div>
            <div
              v-else
              ref="salesTrendChartRef"
              class="chart-container"
            />
          </el-card>
        </el-col>

        <!-- 右上：品类占比 -->
        <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-card class="chart-card">
            <template #header>
              <div class="chart-card-header">
                <span>品类销售占比</span>
              </div>
            </template>
            <div v-if="categoryPieData.length === 0" class="chart-empty">
              <el-empty description="暂无品类数据" :image-size="80" />
            </div>
            <div
              v-else
              ref="categoryPieChartRef"
              class="chart-container"
            />
          </el-card>
        </el-col>

        <!-- 左下：Top10 商品排行 -->
        <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-card class="chart-card">
            <template #header>
              <div class="chart-card-header">
                <span>Top10 商品排行</span>
              </div>
            </template>
            <div v-if="topProductsData.length === 0" class="chart-empty">
              <el-empty description="暂无商品数据" :image-size="80" />
            </div>
            <div
              v-else
              ref="topProductsChartRef"
              class="chart-container"
            />
          </el-card>
        </el-col>

        <!-- 右下：Top10 客户排行 -->
        <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-card class="chart-card">
            <template #header>
              <div class="chart-card-header">
                <span>Top10 客户排行</span>
              </div>
            </template>
            <div v-if="topCustomersData.length === 0" class="chart-empty">
              <el-empty description="暂无客户数据" :image-size="80" />
            </div>
            <div
              v-else
              ref="topCustomersChartRef"
              class="chart-container"
            />
          </el-card>
        </el-col>
      </el-row>

      <!-- 预警区 -->
      <el-collapse v-model="activeAlerts" style="margin-top: 16px">
        <!-- 库存预警 -->
        <el-collapse-item name="inventory">
          <template #title>
            <div class="alert-title">
              <span>库存预警</span>
              <el-badge
                :value="alertData.inventoryAlerts.length"
                :hidden="alertData.inventoryAlerts.length === 0"
                type="warning"
                style="margin-left: 8px"
              />
            </div>
          </template>
          <el-table :data="alertData.inventoryAlerts" size="small" empty-text="暂无库存预警">
            <el-table-column prop="skuName" label="商品名称" min-width="160" />
            <el-table-column prop="storeName" label="门店" width="120" />
            <el-table-column prop="currentQty" label="当前库存" width="100" />
            <el-table-column prop="warningThreshold" label="预警阈值" width="100" />
          </el-table>
        </el-collapse-item>

        <!-- 临期预警 -->
        <el-collapse-item name="expiry">
          <template #title>
            <div class="alert-title">
              <span>临期预警</span>
              <el-badge
                :value="alertData.expiryAlerts.length"
                :hidden="alertData.expiryAlerts.length === 0"
                type="danger"
                style="margin-left: 8px"
              />
            </div>
          </template>
          <el-table :data="alertData.expiryAlerts" size="small" empty-text="暂无临期预警">
            <el-table-column prop="skuName" label="商品名称" min-width="160" />
            <el-table-column prop="batchNo" label="批次号" width="140" />
            <el-table-column prop="expiryDate" label="过期日期" width="120" />
          </el-table>
        </el-collapse-item>

        <!-- 应收逾期 -->
        <el-collapse-item name="overdue">
          <template #title>
            <div class="alert-title">
              <span>应收逾期</span>
              <el-badge
                :value="alertData.overdueReceivables.length"
                :hidden="alertData.overdueReceivables.length === 0"
                type="danger"
                style="margin-left: 8px"
              />
            </div>
          </template>
          <el-table :data="alertData.overdueReceivables" size="small" empty-text="暂无应收逾期">
            <el-table-column prop="customerName" label="客户名称" min-width="140" />
            <el-table-column label="应收金额" width="120">
              <template #default="{ row }">¥{{ formatNum(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="overdueDays" label="逾期天数" width="100" />
          </el-table>
        </el-collapse-item>

        <!-- 待处理订单 -->
        <el-collapse-item name="pendingOrders">
          <template #title>
            <div class="alert-title">
              <span>待处理订单</span>
              <el-badge
                :value="alertData.pendingOrders.length"
                :hidden="alertData.pendingOrders.length === 0"
                type="primary"
                style="margin-left: 8px"
              />
            </div>
          </template>
          <el-table :data="alertData.pendingOrders" size="small" empty-text="暂无待处理订单">
            <el-table-column prop="orderNo" label="订单号" width="160" />
            <el-table-column prop="customerName" label="客户" width="120" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">¥{{ formatNum(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import echarts from '@/utils/echarts'
import {
  fetchDashboardOverview,
  fetchDashboardSalesTrend,
  fetchDashboardCategoryPie,
  fetchDashboardTopProducts,
  fetchDashboardTopCustomers,
  fetchDashboardRecentAlerts,
  fetchStores,
} from '../api';

// ==================== 类型定义 ====================
interface MetricCard {
  key: string;
  label: string;
  value: string;
  momUp: boolean;
  momRate: string;
  yoyRate: string;
  sparkData: number[];
}

interface StoreItem {
  id: number;
  name: string;
}

interface SalesTrendItem {
  date: string;
  amount: number;
  orderCount: number;
}

interface CategoryPieItem {
  name: string;
  value: number;
}

interface TopProductItem {
  name: string;
  salesAmount: number;
  salesQty: number;
}

interface TopCustomerItem {
  name: string;
  amount: number;
}

interface AlertData {
  inventoryAlerts: any[];
  expiryAlerts: any[];
  overdueReceivables: any[];
  pendingOrders: any[];
}

// ==================== 状态 ====================
const loading = ref(true);
const error = ref(false);

// 门店
const storeList = ref<StoreItem[]>([]);
const selectedStoreIds = ref<number[]>([]);

// 概览数据
const overview = ref<any>({});

// 图表数据
const salesTrendData = ref<SalesTrendItem[]>([]);
const categoryPieData = ref<CategoryPieItem[]>([]);
const topProductsData = ref<TopProductItem[]>([]);
const topCustomersData = ref<TopCustomerItem[]>([]);
const alertData = ref<AlertData>({
  inventoryAlerts: [],
  expiryAlerts: [],
  overdueReceivables: [],
  pendingOrders: [],
});

// 图表控制
const trendRange = ref('7');
const activeAlerts = ref<string[]>([]);

// ==================== 图表 DOM refs ====================
const salesTrendChartRef = ref<HTMLElement | null>(null);
const categoryPieChartRef = ref<HTMLElement | null>(null);
const topProductsChartRef = ref<HTMLElement | null>(null);
const topCustomersChartRef = ref<HTMLElement | null>(null);

// Spark 图表 DOM refs（动态绑定）
const sparkRefs: Record<string, HTMLElement | null> = {};
function setSparkRef(key: string, el: HTMLElement | null) {
  sparkRefs[key] = el;
}

// ==================== ECharts 实例管理 ====================
let salesTrendChart: echarts.ECharts | null = null;
let categoryPieChart: echarts.ECharts | null = null;
let topProductsChart: echarts.ECharts | null = null;
let topCustomersChart: echarts.ECharts | null = null;
const sparkCharts: Record<string, echarts.ECharts> = {};

// ==================== 计算属性 ====================
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const formattedDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[now.getDay()];
  return `${year}年${month}月${day}日 ${weekDay}`;
});

const metricCards = computed<MetricCard[]>(() => {
  const d = overview.value;
  const getRate = (val: any, defaultVal = '--') => {
    if (val === undefined || val === null) return defaultVal;
    return val;
  };
  const getBool = (val: any) => {
    if (val === undefined || val === null) return false;
    return Number(val) >= 0;
  };
  const getSpark = (val: any) => {
    if (Array.isArray(val) && val.length > 0) return val;
    return [];
  };
  return [
    {
      key: 'sales',
      label: '今日销售额',
      value: d.todaySalesAmount !== undefined ? `¥${formatNum(d.todaySalesAmount)}` : '¥0',
      momUp: getBool(d.salesMomRate),
      momRate: getRate(d.salesMomRate),
      yoyRate: getRate(d.salesYoyRate),
      sparkData: getSpark(d.salesSparkline),
    },
    {
      key: 'orders',
      label: '今日订单数',
      value: d.todayOrderCount !== undefined ? `${d.todayOrderCount}单` : '0单',
      momUp: getBool(d.ordersMomRate),
      momRate: getRate(d.ordersMomRate),
      yoyRate: getRate(d.ordersYoyRate),
      sparkData: getSpark(d.ordersSparkline),
    },
    {
      key: 'profit',
      label: '今日毛利',
      value: d.todayGrossProfit !== undefined ? `¥${formatNum(d.todayGrossProfit)}` : '¥0',
      momUp: getBool(d.profitMomRate),
      momRate: getRate(d.profitMomRate),
      yoyRate: getRate(d.profitYoyRate),
      sparkData: getSpark(d.profitSparkline),
    },
    {
      key: 'avgOrder',
      label: '客单价',
      value: d.avgOrderValue !== undefined ? `¥${formatNum(d.avgOrderValue)}` : '¥0',
      momUp: getBool(d.avgOrderMomRate),
      momRate: getRate(d.avgOrderMomRate),
      yoyRate: getRate(d.avgOrderYoyRate),
      sparkData: getSpark(d.avgOrderSparkline),
    },
    {
      key: 'collection',
      label: '待收款',
      value: d.pendingCollection !== undefined ? `¥${formatNum(d.pendingCollection)}` : '¥0',
      momUp: getBool(d.collectionMomRate),
      momRate: getRate(d.collectionMomRate),
      yoyRate: getRate(d.collectionYoyRate),
      sparkData: getSpark(d.collectionSparkline),
    },
    {
      key: 'inventory',
      label: '库存预警数',
      value: d.inventoryWarningCount !== undefined ? `${d.inventoryWarningCount}个` : '0个',
      momUp: getBool(d.inventoryMomRate),
      momRate: getRate(d.inventoryMomRate),
      yoyRate: getRate(d.inventoryYoyRate),
      sparkData: getSpark(d.inventorySparkline),
    },
    {
      key: 'pendingOrder',
      label: '待处理订单',
      value: d.pendingOrderCount !== undefined ? `${d.pendingOrderCount}个` : '0个',
      momUp: getBool(d.pendingOrderMomRate),
      momRate: getRate(d.pendingOrderMomRate),
      yoyRate: getRate(d.pendingOrderYoyRate),
      sparkData: getSpark(d.pendingOrderSparkline),
    },
    {
      key: 'newCustomer',
      label: '今日新增客户',
      value: d.todayNewCustomers !== undefined ? `${d.todayNewCustomers}个` : '0个',
      momUp: getBool(d.newCustomerMomRate),
      momRate: getRate(d.newCustomerMomRate),
      yoyRate: getRate(d.newCustomerYoyRate),
      sparkData: getSpark(d.newCustomerSparkline),
    },
  ];
});

// ==================== 工具函数 ====================
function formatNum(num: number): string {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==================== 门店变更 ====================
function onStoreChange() {
  loadAllData();
}

// ==================== 趋势范围切换 ====================
function onTrendRangeChange() {
  loadSalesTrend();
}

// ==================== 数据加载 ====================
async function loadAllData() {
  loading.value = true;
  error.value = false;
  try {
    await Promise.all([
      loadOverview(),
      loadSalesTrend(),
      loadCategoryPie(),
      loadTopProducts(),
      loadTopCustomers(),
      loadAlerts(),
    ]);
    loading.value = false;
  } catch (e) {
    console.error('加载仪表盘数据失败', e);
    loading.value = false;
    error.value = true;
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data?.records || data?.list || []);
  } catch (e) {
    console.error('加载门店列表失败', e);
  }
}

async function loadOverview() {
  try {
    const storeIds = selectedStoreIds.value.length > 0 ? selectedStoreIds.value : undefined;
    const data = await fetchDashboardOverview();
    overview.value = data || {};
  } catch (e) {
    console.error('加载概览数据失败', e);
  }
}

async function loadSalesTrend() {
  try {
    const storeIds = selectedStoreIds.value.length > 0 ? selectedStoreIds.value : undefined;
    const data = await fetchDashboardSalesTrend();
    salesTrendData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderSalesTrendChart();
  } catch (e) {
    console.error('加载销售趋势失败', e);
  }
}

async function loadCategoryPie() {
  try {
    const data = await fetchDashboardCategoryPie();
    categoryPieData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderCategoryPieChart();
  } catch (e) {
    console.error('加载品类占比失败', e);
  }
}

async function loadTopProducts() {
  try {
    const data = await fetchDashboardTopProducts();
    topProductsData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderTopProductsChart();
  } catch (e) {
    console.error('加载商品排行失败', e);
  }
}

async function loadTopCustomers() {
  try {
    const data = await fetchDashboardTopCustomers();
    topCustomersData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderTopCustomersChart();
  } catch (e) {
    console.error('加载客户排行失败', e);
  }
}

async function loadAlerts() {
  try {
    const data = await fetchDashboardRecentAlerts();
    alertData.value = {
      inventoryAlerts: Array.isArray(data?.inventoryAlerts) ? data.inventoryAlerts : [],
      expiryAlerts: Array.isArray(data?.expiryAlerts) ? data.expiryAlerts : [],
      overdueReceivables: Array.isArray(data?.overdueReceivables) ? data.overdueReceivables : [],
      pendingOrders: Array.isArray(data?.pendingOrders) ? data.pendingOrders : [],
    };
  } catch (e) {
    console.error('加载预警数据失败', e);
  }
}

// ==================== 图表渲染 ====================
function initChart(container: HTMLElement | null): echarts.ECharts | null {
  if (!container) return null;
  const instance = echarts.init(container);
  return instance;
}

function renderSalesTrendChart() {
  if (!salesTrendChartRef.value) return;
  if (!salesTrendChart) {
    salesTrendChart = initChart(salesTrendChartRef.value);
  }
  if (!salesTrendChart || salesTrendData.value.length === 0) return;

  const dates = salesTrendData.value.map((d: SalesTrendItem) => d.date);
  const amounts = salesTrendData.value.map((d: SalesTrendItem) => d.amount);
  const orders = salesTrendData.value.map((d: SalesTrendItem) => d.orderCount);

  salesTrendChart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['销售额', '订单数'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          rotate: dates.length > 14 ? 45 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: {
            formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()),
          },
        },
        {
          type: 'value',
          name: '订单数',
          axisLabel: {
            formatter: (v: number) => v.toString(),
          },
        },
      ],
      series: [
        {
          name: '销售额',
          type: 'line',
          data: amounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#409eff' },
          itemStyle: { color: '#409eff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,158,255,0.3)' },
              { offset: 1, color: 'rgba(64,158,255,0.05)' },
            ]),
          },
        },
        {
          name: '订单数',
          type: 'line',
          yAxisIndex: 1,
          data: orders,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#67c23a' },
          itemStyle: { color: '#67c23a' },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderCategoryPieChart() {
  if (!categoryPieChartRef.value) return;
  if (!categoryPieChart) {
    categoryPieChart = initChart(categoryPieChartRef.value);
  }
  if (!categoryPieChart || categoryPieData.value.length === 0) return;

  categoryPieChart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data: categoryPieData.value,
        },
      ],
    },
    { notMerge: true }
  );
}

function renderTopProductsChart() {
  if (!topProductsChartRef.value) return;
  if (!topProductsChart) {
    topProductsChart = initChart(topProductsChartRef.value);
  }
  if (!topProductsChart || topProductsData.value.length === 0) return;

  const names = topProductsData.value.map((d: TopProductItem) => d.name).reverse();
  const amounts = topProductsData.value.map((d: TopProductItem) => d.salesAmount).reverse();
  const qtys = topProductsData.value.map((d: TopProductItem) => d.salesQty).reverse();

  topProductsChart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: ['销售额', '销量'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '4%',
        containLabel: true,
      },
      xAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: {
            formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()),
          },
        },
        {
          type: 'value',
          name: '销量',
        },
      ],
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          width: 100,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: '销售额',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#409eff' },
              { offset: 1, color: '#79bbff' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
        {
          name: '销量',
          type: 'bar',
          xAxisIndex: 1,
          data: qtys,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#67c23a' },
              { offset: 1, color: '#95d475' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderTopCustomersChart() {
  if (!topCustomersChartRef.value) return;
  if (!topCustomersChart) {
    topCustomersChart = initChart(topCustomersChartRef.value);
  }
  if (!topCustomersChart || topCustomersData.value.length === 0) return;

  const names = topCustomersData.value.map((d: TopCustomerItem) => d.name).reverse();
  const amounts = topCustomersData.value.map((d: TopCustomerItem) => d.amount).reverse();

  topCustomersChart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '4%',
        top: '4%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: '金额 (¥)',
        axisLabel: {
          formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()),
        },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          width: 100,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: '消费金额',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#e6a23c' },
              { offset: 1, color: '#f3d19e' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    },
    { notMerge: true }
  );
}

// ==================== Spark 迷你折线图 ====================
function renderSparkCharts() {
  Object.keys(sparkCharts).forEach((key) => {
    sparkCharts[key]?.dispose();
    delete sparkCharts[key];
  });
  nextTick(() => {
    metricCards.value.forEach((card: MetricCard) => {
      const el = sparkRefs[card.key];
      if (!el || !card.sparkData || card.sparkData.length === 0) return;
      const instance = echarts.init(el);
      sparkCharts[card.key] = instance;
      instance.setOption({
        grid: {
          left: 0,
          right: 0,
          top: 2,
          bottom: 0,
        },
        xAxis: { show: false, data: card.sparkData.map((_: number, i: number) => i) },
        yAxis: { show: false, min: (v: { min: number }) => v.min * 0.9, max: (v: { max: number }) => v.max * 1.1 },
        series: [
          {
            type: 'line',
            data: card.sparkData,
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 1.5, color: card.momUp ? '#f56c6c' : '#67c23a' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: card.momUp ? 'rgba(245,108,108,0.2)' : 'rgba(103,194,58,0.2)' },
                { offset: 1, color: 'rgba(255,255,255,0)' },
              ]),
            },
          },
        ],
      });
    });
  });
}

// 监听 metricCards 变化后重绘 spark
watch(metricCards, () => {
  renderSparkCharts();
}, { deep: true });

// ==================== 窗口大小响应 ====================
function handleResize() {
  salesTrendChart?.resize();
  categoryPieChart?.resize();
  topProductsChart?.resize();
  topCustomersChart?.resize();
  Object.values(sparkCharts).forEach((c) => c?.resize());
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await loadStores();
  await loadAllData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  salesTrendChart?.dispose();
  categoryPieChart?.dispose();
  topProductsChart?.dispose();
  topCustomersChart?.dispose();
  Object.values(sparkCharts).forEach((c) => c?.dispose());
});
</script>

<style scoped>
.dashboard {
  padding: 4px;
}

/* 顶部栏 */
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.welcome-text {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.date-text {
  font-size: 14px;
  color: #909399;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 指标卡片 */
.metric-card {
  cursor: pointer;
  transition: transform 0.2s;
}
.metric-card:hover {
  transform: translateY(-2px);
}
.metric-card :deep(.el-card__body) {
  padding: 16px 20px 12px;
}
.metric-card-inner {
  display: flex;
  flex-direction: column;
}
.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.metric-label {
  font-size: 13px;
  color: #909399;
}
.metric-value {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  margin: 6px 0 4px;
  line-height: 1.2;
}
.metric-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.metric-compare {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.compare-item {
  display: flex;
  align-items: center;
  gap: 2px;
}
.compare-item.up {
  color: #f56c6c;
}
.compare-item.down {
  color: #67c23a;
}
.compare-item.yoy {
  color: #909399;
}
.compare-arrow {
  font-size: 12px;
}
.spark-chart {
  width: 100%;
  height: 40px;
  margin-top: 6px;
}
.spark-placeholder {
  height: 40px;
  margin-top: 6px;
}

/* 图表卡片 */
.chart-card {
  min-height: 360px;
}
.chart-card :deep(.el-card__body) {
  padding: 12px 16px;
}
.chart-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.chart-container {
  width: 100%;
  height: 300px;
}
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
}

/* 预警区 */
.alert-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

/* 响应式 */
@media (max-width: 768px) {
  .header-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .metric-value {
    font-size: 22px;
  }
  .chart-container {
    height: 260px;
  }
  .chart-empty {
    height: 260px;
  }
}
</style>