<template>
  <PageCard title="资金报表">
    <el-tabs v-model="activeTab" type="card" @tab-change="handleTabChange">
      <!-- 资金流水 -->
      <el-tab-pane label="资金流水" name="transactions">
        <div class="tab-header">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px; margin-right: 10px"
          />
          <el-select v-model="transactionType" placeholder="交易类型" clearable style="width: 140px; margin-right: 10px">
            <el-option label="收入" value="INCOME" />
            <el-option label="支出" value="EXPENSE" />
          </el-select>
          <el-select v-model="accountId" placeholder="选择账户" clearable style="width: 180px; margin-right: 10px">
            <el-option v-for="acc in accountOptions" :key="acc.id" :label="acc.bankName + ' - ' + acc.accountName" :value="acc.id" />
          </el-select>
          <el-button type="primary" @click="loadTransactions">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>

        <el-table :data="transactionList" v-loading="loading" stripe empty-text="暂无资金流水">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="transactionNo" label="交易单号" min-width="160" />
          <el-table-column prop="transactionType" label="类型" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.transactionType === 'INCOME'" type="success">收入</el-tag>
              <el-tag v-else type="danger">支出</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="140">
            <template #default="{ row }">
              <span :class="row.transactionType === 'INCOME' ? 'income' : 'expense'">
                {{ row.transactionType === 'INCOME' ? '+' : '-' }}{{ formatMoney(row.amount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="balance" label="余额" width="140">
            <template #default="{ row }">
              {{ formatMoney(row.balance) }}
            </template>
          </el-table-column>
          <el-table-column prop="accountName" label="账户" min-width="160" />
          <el-table-column prop="remark" label="备注" min-width="200" />
          <el-table-column prop="createdAt" label="交易时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="transactionTotal"
            :page-size="pageSize"
            :current-page="page"
            @size-change="handleSizeChange"
            @current-page="handlePageChange"
          />
        </div>
      </el-tab-pane>

      <!-- 收支统计 -->
      <el-tab-pane label="收支统计" name="statistics">
        <div class="tab-header">
          <el-date-picker
            v-model="statsDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px; margin-right: 10px"
          />
          <el-select v-model="statsGroupBy" placeholder="分组方式" style="width: 140px; margin-right: 10px">
            <el-option label="按日" value="day" />
            <el-option label="按周" value="week" />
            <el-option label="按月" value="month" />
          </el-select>
          <el-button type="primary" @click="loadStatistics">查询</el-button>
        </div>

        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-label">总收入</div>
            <div class="stat-value income">{{ formatMoney(statistics.totalIncome) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">总支出</div>
            <div class="stat-value expense">{{ formatMoney(statistics.totalExpense) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">净收入</div>
            <div class="stat-value" :class="statistics.netIncome >= 0 ? 'income' : 'expense'">
              {{ statistics.netIncome >= 0 ? '+' : '' }}{{ formatMoney(statistics.netIncome) }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">交易笔数</div>
            <div class="stat-value">{{ statistics.transactionCount }}</div>
          </div>
        </div>

        <el-table :data="statistics.list" v-loading="statsLoading" stripe empty-text="暂无统计数据">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="income" label="收入" width="140">
            <template #default="{ row }">
              <span class="income">+{{ formatMoney(row.income) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="expense" label="支出" width="140">
            <template #default="{ row }">
              <span class="expense">-{{ formatMoney(row.expense) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="net" label="净额" width="140">
            <template #default="{ row }">
              <span :class="row.net >= 0 ? 'income' : 'expense'">
                {{ row.net >= 0 ? '+' : '' }}{{ formatMoney(row.net) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="count" label="交易笔数" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 资金趋势 -->
      <el-tab-pane label="资金趋势" name="trend">
        <div class="tab-header">
          <el-date-picker
            v-model="trendDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px; margin-right: 10px"
          />
          <el-button type="primary" @click="loadTrend">查询</el-button>
        </div>

        <div class="chart-container">
          <div ref="trendChartRef" class="chart"></div>
        </div>

        <div class="trend-summary">
          <div class="trend-item">
            <span class="trend-label">期初余额</span>
            <span class="trend-value">{{ formatMoney(trendData.startBalance) }}</span>
          </div>
          <div class="trend-item">
            <span class="trend-label">期末余额</span>
            <span class="trend-value">{{ formatMoney(trendData.endBalance) }}</span>
          </div>
          <div class="trend-item">
            <span class="trend-label">期间收入</span>
            <span class="trend-value income">+{{ formatMoney(trendData.totalIncome) }}</span>
          </div>
          <div class="trend-item">
            <span class="trend-label">期间支出</span>
            <span class="trend-value expense">-{{ formatMoney(trendData.totalExpense) }}</span>
          </div>
          <div class="trend-item">
            <span class="trend-label">余额变化</span>
            <span class="trend-value" :class="trendData.balanceChange >= 0 ? 'income' : 'expense'">
              {{ trendData.balanceChange >= 0 ? '+' : '' }}{{ formatMoney(trendData.balanceChange) }}
            </span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, nextTick } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate, formatMoney } from "../../utils/format";
import initECharts from "../../utils/echarts";
import {
  fetchBankAccountsForFinance,
  fetchFundTransactions,
  fetchFundStatistics,
  fetchFundTrend
} from "../../api";

const activeTab = ref("transactions");
const loading = ref(false);
const statsLoading = ref(false);
const trendLoading = ref(false);

// 资金流水
const dateRange = ref<Date[] | null>(null);
const transactionType = ref("");
const accountId = ref<number | null>(null);
const transactionList = ref<any[]>([]);
const transactionTotal = ref(0);
const page = ref(1);
const pageSize = ref(20);
const accountOptions = ref<any[]>([]);

// 收支统计
const statsDateRange = ref<Date[] | null>(null);
const statsGroupBy = ref("month");
const statistics = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netIncome: 0,
  transactionCount: 0,
  list: [] as any[]
});

// 资金趋势
const trendDateRange = ref<Date[] | null>(null);
const trendChartRef = ref<HTMLElement | null>(null);
const trendData = reactive({
  startBalance: 0,
  endBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  balanceChange: 0,
  chartData: [] as any[]
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadAccounts() {
  try {
    const data = await fetchBankAccountsForFinance({ page: 1, pageSize: 100 });
    accountOptions.value = data.records || [];
  } catch (e) {
    // ignore
  }
}

function formatDateRange(range: Date[] | null): { dateStart?: string; dateEnd?: string } {
  if (!range || range.length !== 2) return {};
  return {
    dateStart: formatDate(range[0], "YYYY-MM-DD"),
    dateEnd: formatDate(range[1], "YYYY-MM-DD")
  };
}

async function loadTransactions() {
  loading.value = true;
  try {
    const dateRangeParams = formatDateRange(dateRange.value);
    const data = await fetchFundTransactions({
      page: page.value,
      pageSize: pageSize.value,
      transactionType: transactionType.value || undefined,
      accountId: accountId.value || undefined,
      ...dateRangeParams
    });
    transactionList.value = data.records || [];
    transactionTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载资金流水失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadTransactions();
}

function handlePageChange(p: number) {
  page.value = p;
  loadTransactions();
}

function resetFilters() {
  dateRange.value = null;
  transactionType.value = "";
  accountId.value = null;
  page.value = 1;
  loadTransactions();
}

async function loadStatistics() {
  statsLoading.value = true;
  try {
    const dateRangeParams = formatDateRange(statsDateRange.value);
    const data = await fetchFundStatistics({
      groupBy: statsGroupBy.value,
      ...dateRangeParams
    });
    statistics.totalIncome = data.totalIncome || 0;
    statistics.totalExpense = data.totalExpense || 0;
    statistics.netIncome = (data.totalIncome || 0) - (data.totalExpense || 0);
    statistics.transactionCount = data.transactionCount || 0;
    statistics.list = data.list || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载收支统计失败"));
  } finally {
    statsLoading.value = false;
  }
}

async function loadTrend() {
  trendLoading.value = true;
  try {
    const dateRangeParams = formatDateRange(trendDateRange.value);
    const data = await fetchFundTrend(dateRangeParams);
    trendData.startBalance = data.startBalance || 0;
    trendData.endBalance = data.endBalance || 0;
    trendData.totalIncome = data.totalIncome || 0;
    trendData.totalExpense = data.totalExpense || 0;
    trendData.balanceChange = (data.endBalance || 0) - (data.startBalance || 0);
    trendData.chartData = data.chartData || [];
    await nextTick();
    renderTrendChart();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载资金趋势失败"));
  } finally {
    trendLoading.value = false;
  }
}

function renderTrendChart() {
  if (!trendChartRef.value) return;

  const chart = initECharts.init(trendChartRef.value);
  const dates = trendData.chartData.map((d: any) => d.date);
  const balances = trendData.chartData.map((d: any) => d.balance);
  const income = trendData.chartData.map((d: any) => d.income);
  const expense = trendData.chartData.map((d: any) => d.expense);

  chart.setOption({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#ebeef5",
      borderWidth: 1,
      textStyle: { color: "#606266" },
      axisPointer: { type: "cross" }
    },
    legend: {
      data: ["余额", "收入", "支出"],
      top: 10
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: {
        rotate: dates.length > 10 ? 45 : 0,
        fontSize: 12
      }
    },
    yAxis: [
      {
        type: "value",
        name: "余额",
        position: "left",
        axisLabel: {
          formatter: (value: number) => formatMoney(value)
        }
      },
      {
        type: "value",
        name: "金额",
        position: "right",
        axisLabel: {
          formatter: (value: number) => formatMoney(value)
        }
      }
    ],
    series: [
      {
        name: "余额",
        type: "line",
        smooth: true,
        data: balances,
        yAxisIndex: 0,
        itemStyle: { color: "#409eff" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(64, 158, 255, 0.3)" },
              { offset: 1, color: "rgba(64, 158, 255, 0.05)" }
            ]
          }
        }
      },
      {
        name: "收入",
        type: "bar",
        data: income,
        yAxisIndex: 1,
        itemStyle: { color: "#67c23a" }
      },
      {
        name: "支出",
        type: "bar",
        data: expense,
        yAxisIndex: 1,
        itemStyle: { color: "#f56c6c" }
      }
    ]
  });
}

function handleTabChange(tab: string) {
  if (tab === "statistics") {
    loadStatistics();
  } else if (tab === "trend") {
    loadTrend();
  }
}

onMounted(() => {
  loadAccounts();
  loadTransactions();
});
</script>

<style scoped>
.tab-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.income {
  color: #67c23a;
  font-weight: 600;
}

.expense {
  color: #f56c6c;
  font-weight: 600;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
  display: block;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.chart-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.chart {
  height: 400px;
}

.trend-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
}

.trend-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trend-label {
  font-size: 13px;
  color: #909399;
}

.trend-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
</style>