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
        <el-col v-for="i in 6" :key="i" :xs="24" :sm="12" style="margin-bottom: 16px">
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

      <!-- ========== 销售统计模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">销售统计</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 销售趋势 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>销售趋势</span>
                  <el-radio-group v-model="trendRange" size="small" @change="onTrendRangeChange">
                    <el-radio-button value="7">近7天</el-radio-button>
                    <el-radio-button value="30">近30天</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div v-if="salesTrendData.length === 0" class="chart-empty">
                <el-empty description="暂无销售数据" :image-size="80" />
              </div>
              <div v-else ref="salesTrendChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 品类占比 -->
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
              <div v-else ref="categoryPieChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 销售排行 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>销售排行</span>
                  <el-radio-group v-model="rankingType" size="small" @change="onRankingTypeChange">
                    <el-radio-button value="product">商品</el-radio-button>
                    <el-radio-button value="customer">客户</el-radio-button>
                    <el-radio-button value="employee">员工</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div v-if="topData.length === 0" class="chart-empty">
                <el-empty description="暂无排行数据" :image-size="80" />
              </div>
              <div v-else ref="topChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 客户分类统计 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户分类统计</span>
                </div>
              </template>
              <div v-if="customerCategoryData.length === 0" class="chart-empty">
                <el-empty description="暂无客户数据" :image-size="80" />
              </div>
              <div v-else ref="customerCategoryChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 库存分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">库存分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 库存统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">库存总量</div>
                <div class="stat-value">{{ formatNum(inventoryStats.totalQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">可用库存</div>
                <div class="stat-value">{{ formatNum(inventoryStats.availableQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">锁定库存</div>
                <div class="stat-value">{{ formatNum(inventoryStats.lockedQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">库存价值</div>
                <div class="stat-value">¥{{ formatNum(inventoryStats.totalValue) }}</div>
              </div>
            </el-card>
          </el-col>

          <!-- 库存周转率 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>库存周转率</span>
                </div>
              </template>
              <div v-if="inventoryTurnoverData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="inventoryTurnoverChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 库存价值分析 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>库存价值分析</span>
                </div>
              </template>
              <div v-if="inventoryValueData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="inventoryValueChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 库存预警列表 -->
          <el-col :xs="24" style="margin-bottom: 16px">
            <el-card>
              <template #header>
                <div class="chart-card-header">
                  <span>库存预警</span>
                  <el-badge
                    :value="inventoryWarningData.length"
                    :hidden="inventoryWarningData.length === 0"
                    type="warning"
                    style="margin-left: 8px"
                  />
                </div>
              </template>
              <el-table :data="inventoryWarningData" size="small" empty-text="暂无库存预警">
                <el-table-column prop="skuName" label="商品名称" min-width="160" />
                <el-table-column prop="storeName" label="门店" width="120" />
                <el-table-column prop="currentStock" label="当前库存" width="100" />
                <el-table-column prop="warningThreshold" label="预警阈值" width="100" />
                <el-table-column prop="warningLevel" label="预警级别" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.warningLevel === 'URGENT' ? 'danger' : 'warning'">
                      {{ row.warningLevel === 'URGENT' ? '紧急' : row.warningLevel === 'WARNING' ? '警告' : '提示' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 客户分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">客户分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 客户统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">客户总数</div>
                <div class="stat-value">{{ customerStats.totalCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">今日新增</div>
                <div class="stat-value">{{ customerStats.todayNewCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">活跃客户</div>
                <div class="stat-value">{{ customerStats.activeCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">客户留存率</div>
                <div class="stat-value">{{ customerActivity.retentionRate }}%</div>
              </div>
            </el-card>
          </el-col>

          <!-- 客户增长趋势 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户增长趋势</span>
                </div>
              </template>
              <div v-if="customerGrowthData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="customerGrowthChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 客户活跃度 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户活跃度分析</span>
                </div>
              </template>
              <div v-if="customerActivity.active30DaysCount === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="customerActivityChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 供应商分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">供应商分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 供应商统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">供应商总数</div>
                <div class="stat-value">{{ supplierStats.totalCount }}家</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月新增</div>
                <div class="stat-value">{{ supplierStats.monthlyNewCount }}家</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月采购金额</div>
                <div class="stat-value">¥{{ formatNum(supplierStats.totalPurchaseAmount) }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月采购订单</div>
                <div class="stat-value">{{ supplierStats.purchaseOrderCount }}单</div>
              </div>
            </el-card>
          </el-col>

          <!-- 供应商采购排行 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商采购排行</span>
                </div>
              </template>
              <div v-if="supplierPurchaseRanking.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierPurchaseChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 供应商准时率 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商交货准时率</span>
                </div>
              </template>
              <div v-if="supplierOnTimeRateData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierOnTimeRateChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 供应商合作趋势 -->
          <el-col :xs="24" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商合作趋势</span>
                </div>
              </template>
              <div v-if="supplierTrendData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierTrendChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 预警区 -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">预警中心</h3>
        </div>
        <el-collapse v-model="activeAlerts" style="margin-top: 8px">
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
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import echarts from '@/utils/echarts';
import {
  fetchDashboardOverview,
  fetchDashboardSalesTrend,
  fetchDashboardCategoryPie,
  fetchDashboardTopProducts,
  fetchDashboardTopCustomers,
  fetchDashboardRecentAlerts,
  fetchDashboardTopEmployees,
  fetchDashboardInventoryStats,
  fetchDashboardInventoryTurnover,
  fetchDashboardInventoryWarning,
  fetchDashboardInventoryValueAnalysis,
  fetchDashboardCustomerStats,
  fetchDashboardCustomerGrowthTrend,
  fetchDashboardCustomerActivity,
  fetchDashboardCustomerCategoryStats,
  fetchDashboardSupplierStats,
  fetchDashboardSupplierPurchaseRanking,
  fetchDashboardSupplierOnTimeRate,
  fetchDashboardSupplierTrend,
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

interface TopEmployeeItem {
  employeeName: string;
  totalAmount: number;
  orderCount: number;
}

interface AlertData {
  inventoryAlerts: any[];
  expiryAlerts: any[];
  overdueReceivables: any[];
  pendingOrders: any[];
}

interface InventoryStats {
  totalQty: number;
  availableQty: number;
  lockedQty: number;
  skuCount: number;
  storeCount: number;
  totalValue: number;
}

interface InventoryTurnoverItem {
  month: string;
  soldQty: number;
  soldAmount: number;
  turnoverRate: number;
}

interface InventoryWarningItem {
  skuName: string;
  currentStock: number;
  warningThreshold: number;
  warningLevel: string;
  storeName: string;
}

interface InventoryValueItem {
  categoryName: string;
  skuCount: number;
  totalQty: number;
  totalValue: number;
  percentage: number;
}

interface CustomerStats {
  totalCount: number;
  todayNewCount: number;
  monthlyNewCount: number;
  wholesaleCount: number;
  retailCount: number;
  activeCount: number;
}

interface CustomerGrowthItem {
  month: string;
  newCustomers: number;
  activeCustomers: number;
}

interface CustomerActivity {
  active30DaysCount: number;
  active60DaysCount: number;
  avgOrderAmount: number;
  retentionRate: number;
}

interface CustomerCategoryItem {
  customerType: string;
  customerTypeLabel: string;
  customerCount: number;
  totalAmount: number;
  orderCount: number;
}

interface SupplierStats {
  totalCount: number;
  monthlyNewCount: number;
  activeCount: number;
  activeSupplierCount: number;
  totalPurchaseAmount: number;
  purchaseOrderCount: number;
}

interface SupplierPurchaseItem {
  supplierName: string;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
}

interface SupplierOnTimeRateItem {
  supplierName: string;
  totalOrders: number;
  onTimeOrders: number;
  delayedOrders: number;
  onTimeRate: number;
}

interface SupplierTrendItem {
  month: string;
  activeSupplierCount: number;
  totalAmount: number;
  orderCount: number;
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
const topEmployeesData = ref<TopEmployeeItem[]>([]);
const alertData = ref<AlertData>({
  inventoryAlerts: [],
  expiryAlerts: [],
  overdueReceivables: [],
  pendingOrders: [],
});

// 库存分析数据
const inventoryStats = ref<InventoryStats>({
  totalQty: 0,
  availableQty: 0,
  lockedQty: 0,
  skuCount: 0,
  storeCount: 0,
  totalValue: 0,
});
const inventoryTurnoverData = ref<InventoryTurnoverItem[]>([]);
const inventoryWarningData = ref<InventoryWarningItem[]>([]);
const inventoryValueData = ref<InventoryValueItem[]>([]);

// 客户分析数据
const customerStats = ref<CustomerStats>({
  totalCount: 0,
  todayNewCount: 0,
  monthlyNewCount: 0,
  wholesaleCount: 0,
  retailCount: 0,
  activeCount: 0,
});
const customerGrowthData = ref<CustomerGrowthItem[]>([]);
const customerActivity = ref<CustomerActivity>({
  active30DaysCount: 0,
  active60DaysCount: 0,
  avgOrderAmount: 0,
  retentionRate: 0,
});
const customerCategoryData = ref<CustomerCategoryItem[]>([]);

// 供应商分析数据
const supplierStats = ref<SupplierStats>({
  totalCount: 0,
  monthlyNewCount: 0,
  activeCount: 0,
  activeSupplierCount: 0,
  totalPurchaseAmount: 0,
  purchaseOrderCount: 0,
});
const supplierPurchaseRanking = ref<SupplierPurchaseItem[]>([]);
const supplierOnTimeRateData = ref<SupplierOnTimeRateItem[]>([]);
const supplierTrendData = ref<SupplierTrendItem[]>([]);

// 图表控制
const trendRange = ref('7');
const rankingType = ref('product');
const activeAlerts = ref<string[]>([]);

// 当前排行数据（根据 rankingType 动态切换）
const topData = computed(() => {
  switch (rankingType.value) {
    case 'product':
      return topProductsData.value;
    case 'customer':
      return topCustomersData.value;
    case 'employee':
      return topEmployeesData.value;
    default:
      return [];
  }
});

// ==================== 图表 DOM refs ====================
const salesTrendChartRef = ref<HTMLElement | null>(null);
const categoryPieChartRef = ref<HTMLElement | null>(null);
const topChartRef = ref<HTMLElement | null>(null);
const customerCategoryChartRef = ref<HTMLElement | null>(null);
const inventoryTurnoverChartRef = ref<HTMLElement | null>(null);
const inventoryValueChartRef = ref<HTMLElement | null>(null);
const customerGrowthChartRef = ref<HTMLElement | null>(null);
const customerActivityChartRef = ref<HTMLElement | null>(null);
const supplierPurchaseChartRef = ref<HTMLElement | null>(null);
const supplierOnTimeRateChartRef = ref<HTMLElement | null>(null);
const supplierTrendChartRef = ref<HTMLElement | null>(null);

// Spark 图表 DOM refs（动态绑定）
const sparkRefs: Record<string, HTMLElement | null> = {};
function setSparkRef(key: string, el: HTMLElement | null) {
  sparkRefs[key] = el;
}

// ==================== ECharts 实例管理 ====================
let salesTrendChart: echarts.ECharts | null = null;
let categoryPieChart: echarts.ECharts | null = null;
let topChart: echarts.ECharts | null = null;
let customerCategoryChart: echarts.ECharts | null = null;
let inventoryTurnoverChart: echarts.ECharts | null = null;
let inventoryValueChart: echarts.ECharts | null = null;
let customerGrowthChart: echarts.ECharts | null = null;
let customerActivityChart: echarts.ECharts | null = null;
let supplierPurchaseChart: echarts.ECharts | null = null;
let supplierOnTimeRateChart: echarts.ECharts | null = null;
let supplierTrendChart: echarts.ECharts | null = null;
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

// ==================== 排行类型切换 ====================
function onRankingTypeChange() {
  if (rankingType.value === 'product') {
    loadTopProducts();
  } else if (rankingType.value === 'customer') {
    loadTopCustomers();
  } else if (rankingType.value === 'employee') {
    loadTopEmployees();
  }
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
      loadTopEmployees(),
      loadAlerts(),
      loadInventoryData(),
      loadCustomerData(),
      loadSupplierData(),
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
    const data = await fetchDashboardOverview();
    overview.value = data || {};
  } catch (e) {
    console.error('加载概览数据失败', e);
  }
}

async function loadSalesTrend() {
  try {
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
    if (rankingType.value === 'product') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载商品排行失败', e);
  }
}

async function loadTopCustomers() {
  try {
    const data = await fetchDashboardTopCustomers();
    topCustomersData.value = Array.isArray(data) ? data : [];
    if (rankingType.value === 'customer') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载客户排行失败', e);
  }
}

async function loadTopEmployees() {
  try {
    const data = await fetchDashboardTopEmployees();
    topEmployeesData.value = Array.isArray(data) ? data : [];
    if (rankingType.value === 'employee') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载员工排行失败', e);
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

// 库存分析数据加载
async function loadInventoryData() {
  try {
    const [stats, turnover, warning, value] = await Promise.all([
      fetchDashboardInventoryStats(),
      fetchDashboardInventoryTurnover(),
      fetchDashboardInventoryWarning(),
      fetchDashboardInventoryValueAnalysis(),
    ]);
    inventoryStats.value = stats || { totalQty: 0, availableQty: 0, lockedQty: 0, skuCount: 0, storeCount: 0, totalValue: 0 };
    inventoryTurnoverData.value = Array.isArray(turnover) ? turnover : [];
    inventoryWarningData.value = Array.isArray(warning) ? warning : [];
    inventoryValueData.value = Array.isArray(value) ? value : [];
    await nextTick();
    renderInventoryTurnoverChart();
    renderInventoryValueChart();
  } catch (e) {
    console.error('加载库存分析数据失败', e);
  }
}

// 客户分析数据加载
async function loadCustomerData() {
  try {
    const [stats, growth, activity, category] = await Promise.all([
      fetchDashboardCustomerStats(),
      fetchDashboardCustomerGrowthTrend(),
      fetchDashboardCustomerActivity(),
      fetchDashboardCustomerCategoryStats(),
    ]);
    customerStats.value = stats || { totalCount: 0, todayNewCount: 0, monthlyNewCount: 0, wholesaleCount: 0, retailCount: 0, activeCount: 0 };
    customerGrowthData.value = Array.isArray(growth) ? growth : [];
    customerActivity.value = activity || { active30DaysCount: 0, active60DaysCount: 0, avgOrderAmount: 0, retentionRate: 0 };
    customerCategoryData.value = Array.isArray(category) ? category : [];
    await nextTick();
    renderCustomerGrowthChart();
    renderCustomerActivityChart();
    renderCustomerCategoryChart();
  } catch (e) {
    console.error('加载客户分析数据失败', e);
  }
}

// 供应商分析数据加载
async function loadSupplierData() {
  try {
    const [stats, purchaseRanking, onTimeRate, trend] = await Promise.all([
      fetchDashboardSupplierStats(),
      fetchDashboardSupplierPurchaseRanking(),
      fetchDashboardSupplierOnTimeRate(),
      fetchDashboardSupplierTrend(),
    ]);
    supplierStats.value = stats || { totalCount: 0, monthlyNewCount: 0, activeCount: 0, activeSupplierCount: 0, totalPurchaseAmount: 0, purchaseOrderCount: 0 };
    supplierPurchaseRanking.value = Array.isArray(purchaseRanking) ? purchaseRanking : [];
    supplierOnTimeRateData.value = Array.isArray(onTimeRate) ? onTimeRate : [];
    supplierTrendData.value = Array.isArray(trend) ? trend : [];
    await nextTick();
    renderSupplierPurchaseChart();
    renderSupplierOnTimeRateChart();
    renderSupplierTrendChart();
  } catch (e) {
    console.error('加载供应商分析数据失败', e);
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['销售额', '订单数'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: { rotate: dates.length > 14 ? 45 : 0 },
      },
      yAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
        },
        { type: 'value', name: '订单数', axisLabel: { formatter: (v: