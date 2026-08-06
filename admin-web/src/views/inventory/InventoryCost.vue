<template>
  <div class="page">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item">
            <div class="stat-label">库存总成本</div>
            <div class="stat-value">¥{{ formatNum(summary.totalInvCost) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-primary">
          <div class="stat-item">
            <div class="stat-label">SKU 数量</div>
            <div class="stat-value">{{ summary.totalSkus }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-warning">
          <div class="stat-item">
            <div class="stat-label">均价</div>
            <div class="stat-value">¥{{ formatNum(avgPrice) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-success">
          <div class="stat-item">
            <div class="stat-label">批次总数</div>
            <div class="stat-value">{{ total }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 成本趋势 -->
    <PageCard title="成本趋势">
      <div class="chart-bar">
        <el-select v-model="trendSkuId" placeholder="选择商品" clearable filterable style="width: 220px">
          <el-option v-for="p in productList" :key="p.skuId" :label="p.skuName" :value="p.skuId" />
        </el-select>
        <el-select v-model="trendDays" style="width: 120px; margin-left: 12px">
          <el-option :value="7" label="近7天" />
          <el-option :value="30" label="近30天" />
          <el-option :value="90" label="近90天" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="loadTrend">查询</el-button>
      </div>
      <div ref="trendChartRef" style="width:100%;height:320px;margin-top:16px"></div>
    </PageCard>

    <!-- 成本明细 -->
    <PageCard title="成本明细">
      <div class="search-bar">
        <el-input v-model="searchForm.keyword" placeholder="商品名称/编码" clearable style="width: 180px" />
        <el-select v-model="searchForm.storeId" placeholder="门店" clearable filterable style="width: 150px; margin-left: 12px">
          <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>
      <el-table :data="records" v-loading="loading" stripe>
        <el-table-column prop="skuName" label="商品名称" min-width="140" />
        <el-table-column prop="productName" label="SPU" min-width="120" />
        <el-table-column prop="storeName" label="门店" width="100" />
        <el-table-column prop="batchNo" label="批次号" width="140" />
        <el-table-column prop="quantity" label="库存数" width="80" align="right" />
        <el-table-column prop="costPrice" label="成本单价" width="100" align="right">
          <template #default="{ row }">¥{{ formatNum(row.costPrice) }}</template>
        </el-table-column>
        <el-table-column prop="retailPrice" label="零售价" width="100" align="right">
          <template #default="{ row }">¥{{ formatNum(row.retailPrice) }}</template>
        </el-table-column>
        <el-table-column prop="totalCost" label="库存成本" width="110" align="right">
          <template #default="{ row }">¥{{ formatNum(row.totalCost) }}</template>
        </el-table-column>
        <el-table-column label="毛利空间" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.retailPrice && row.costPrice" :style="{ color: row.retailPrice > row.costPrice ? 'var(--color-success)' : 'var(--color-danger)' }">
              {{ getMargin(row) }}%
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="productionDate" label="生产日期" width="110">
          <template #default="{ row }">{{ formatDate(row.productionDate) }}</template>
        </el-table-column>
        <el-table-column prop="expiryDate" label="到期日期" width="110">
          <template #default="{ row }">
            <span :style="{ color: isNearExpiry(row.expiryDate) ? 'var(--color-danger)' : '' }">
              {{ formatDate(row.expiryDate) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="(s: number) => { pageSize = s; search(); }"
          @current-change="(p: number) => { page = p; search(); }" />
      </div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import { fetchInventoryCostDetail, fetchInventoryCostTrend, fetchStores, fetchProducts } from "../../api";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const storeList = ref<any[]>([]);
const productList = ref<any[]>([]);
const summary = ref({ totalInvCost: 0, totalSkus: 0 });
const trendChartRef = ref<HTMLElement>();
const trendSkuId = ref<number | null>(null);
const trendDays = ref(30);
let trendChart: echarts.ECharts | null = null;

const searchForm = reactive({ keyword: "", storeId: null as number | null });

const avgPrice = ref(0);

function formatNum(n: any) { return Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function getMargin(row: any) {
  if (!row.retailPrice || !row.costPrice || row.retailPrice <= 0) return 0;
  return Math.round(((row.retailPrice - row.costPrice) / row.retailPrice) * 100);
}

function isNearExpiry(date: string) {
  if (!date) return false;
  return new Date(date).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
}

async function search() {
  loading.value = true;
  try {
    const res = await fetchInventoryCostDetail({
      page: page.value, pageSize: pageSize.value,
      storeId: searchForm.storeId || undefined,
      keyword: searchForm.keyword || undefined
    });
    records.value = res?.records || [];
    total.value = res?.total || 0;
    summary.value = res?.summary || { totalInvCost: 0, totalSkus: 0 };
    if (summary.value.totalSkus > 0) {
      const totalCost = summary.value.totalInvCost;
      avgPrice.value = totalCost / summary.value.totalSkus;
    }
  } catch {
    ElMessage.error("加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadTrend() {
  if (!trendChartRef.value) return;
  try {
    const res = await fetchInventoryCostTrend({
      skuId: trendSkuId.value || undefined,
      days: trendDays.value
    });
    const data = res || [];
    const dates = [...new Set(data.map((d: any) => d.date))] as string[];
    const skuNames = [...new Set(data.map((d: any) => d.skuName))] as string[];
    const series = skuNames.map(name => ({
      name, type: "line", data: dates.map(date => {
        const found = data.find((d: any) => d.date === date && d.skuName === name);
        return found?.avgCost || 0;
      }), smooth: true
    }));
    const option: any = {
      tooltip: { trigger: "axis" },
      legend: { data: skuNames, bottom: 0 },
      xAxis: { type: "category", data: dates },
      yAxis: { type: "value", name: "成本单价" },
      series
    };
    if (!trendChart) {
      trendChart = echarts.init(trendChartRef.value);
    }
    trendChart.setOption(option);
  } catch {
    ElMessage.error("加载趋势失败");
  }
}

async function loadData() {
  await search();
  try {
    const [stores, products] = await Promise.all([fetchStores(), fetchProducts()]);
    storeList.value = stores?.records || stores?.list || stores || [];
    productList.value = products?.records || products?.list || products || [];
  } catch { /* ignore */ }
  await nextTick();
  await loadTrend();
}

onMounted(() => loadData());
</script>

<style scoped>
.stat-row { margin-bottom: 16px; }
.stat-card { border-radius: 8px; }
.stat-item { text-align: center; padding: 8px 0; }
.stat-label { color: var(--gray-400); font-size: 13px; margin-bottom: 8px; }
.stat-value { font-size: 26px; font-weight: 600; color: var(--gray-700); }
.stat-primary .stat-value { color: var(--color-primary); }
.stat-warning .stat-value { color: var(--color-warning); }
.stat-success .stat-value { color: var(--color-success); }
.search-bar { display: flex; align-items: center; margin-bottom: 16px; }
.chart-bar { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
