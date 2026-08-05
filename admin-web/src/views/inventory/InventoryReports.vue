<template>
  <div class="page">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 周转率报表 -->
      <el-tab-pane label="库存周转率" name="turnover">
        <div class="search-bar">
          <el-select v-model="tFilter.storeId" placeholder="门店" clearable filterable style="width: 150px">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-button type="primary" style="margin-left: 12px" @click="loadTurnover">查询</el-button>
        </div>
        <el-table :data="turnover.list" v-loading="turnover.loading" stripe>
          <el-table-column prop="skuName" label="商品名称" min-width="140" />
          <el-table-column prop="productName" label="SPU" min-width="120" />
          <el-table-column prop="categoryName" label="分类" width="100" />
          <el-table-column prop="monthOutQty" label="月出库量" width="90" align="right" />
          <el-table-column prop="avgStock" label="平均库存" width="90" align="right">
            <template #default="{ row }">{{ Math.round(row.avgStock) }}</template>
          </el-table-column>
          <el-table-column prop="turnoverRate" label="周转率" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.turnoverRate >= 3 ? 'success' : row.turnoverRate >= 1 ? 'warning' : 'danger'" size="small">
                {{ row.turnoverRate }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="turnoverDays" label="周转天数" width="90" align="center">
            <template #default="{ row }">{{ row.turnoverDays }}天</template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination background layout="total, sizes, prev, pager, next, jumper"
            :total="turnover.total" :page-size="tPageSize" :current-page="tPage"
            @size-change="(s: number) => { tPageSize = s; loadTurnover(); }"
            @current-change="(p: number) => { tPage = p; loadTurnover(); }" />
        </div>
      </el-tab-pane>

      <!-- 库龄报表 -->
      <el-tab-pane label="库龄分布" name="age">
        <div class="search-bar">
          <el-select v-model="ageFilter.storeId" placeholder="门店" clearable filterable style="width: 150px">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-button type="primary" style="margin-left: 12px" @click="loadAge">查询</el-button>
        </div>

        <!-- 库龄分布图 -->
        <div ref="ageChartRef" style="width:100%;height:300px;margin-bottom:20px"></div>

        <!-- 库龄汇总 -->
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-item"><div class="stat-label">30天内</div><div class="stat-value">{{ ageData?.distribution?.age0_30 || 0 }}</div></div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-warning">
              <div class="stat-item"><div class="stat-label">30-60天</div><div class="stat-value">{{ ageData?.distribution?.age30_60 || 0 }}</div></div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-danger">
              <div class="stat-item"><div class="stat-label">60-90天</div><div class="stat-value">{{ ageData?.distribution?.age60_90 || 0 }}</div></div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-danger">
              <div class="stat-item"><div class="stat-label">90天以上</div><div class="stat-value">{{ ageData?.distribution?.age90plus || 0 }}</div></div>
            </el-card>
          </el-col>
        </el-row>

        <el-table :data="ageData?.details || []" stripe size="small">
          <el-table-column prop="batchNo" label="批次号" width="140" />
          <el-table-column prop="skuName" label="商品" min-width="120" />
          <el-table-column prop="productName" label="SPU" min-width="100" />
          <el-table-column prop="storeName" label="门店" width="100" />
          <el-table-column prop="quantity" label="数量" width="70" align="right" />
          <el-table-column prop="ageDays" label="库龄(天)" width="90" align="center" />
          <el-table-column prop="ageRange" label="库龄区间" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.ageRange === '30天内'" type="success" size="small">30天内</el-tag>
              <el-tag v-else-if="row.ageRange === '30-60天'" type="warning" size="small">30-60天</el-tag>
              <el-tag v-else type="danger" size="small">{{ row.ageRange }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="入库时间" width="150">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ABC 分类 -->
      <el-tab-pane label="ABC 分析" name="abc">
        <div class="search-bar">
          <el-select v-model="abcFilter.storeId" placeholder="门店" clearable filterable style="width: 150px">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-button type="primary" style="margin-left: 12px" @click="loadABC">查询</el-button>
        </div>

        <!-- ABC 汇总 -->
        <el-row :gutter="16" class="stat-row">
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card stat-success">
              <div class="stat-item">
                <div class="stat-label">A类（70%销售额）</div>
                <div class="stat-value">{{ abcData?.summary?.A_count || 0 }}种</div>
                <div style="color:#999999;font-size:12px">¥{{ formatNum(abcData?.summary?.A_amount) }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card stat-warning">
              <div class="stat-item">
                <div class="stat-label">B类（20%销售额）</div>
                <div class="stat-value">{{ abcData?.summary?.B_count || 0 }}种</div>
                <div style="color:#999999;font-size:12px">¥{{ formatNum(abcData?.summary?.B_amount) }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-item">
                <div class="stat-label">C类（10%销售额）</div>
                <div class="stat-value">{{ abcData?.summary?.C_count || 0 }}种</div>
                <div style="color:#999999;font-size:12px">¥{{ formatNum(abcData?.summary?.C_amount) }}</div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-table :data="abcData?.items || []" stripe max-height="500">
          <el-table-column type="index" label="#" width="60" align="center" />
          <el-table-column prop="skuName" label="商品名称" min-width="140" />
          <el-table-column prop="productName" label="SPU" min-width="120" />
          <el-table-column prop="outQty" label="出库量" width="80" align="right" />
          <el-table-column prop="outAmount" label="销售额" width="110" align="right">
            <template #default="{ row }">¥{{ formatNum(row.outAmount) }}</template>
          </el-table-column>
          <el-table-column prop="pct" label="占比" width="70" align="center">
            <template #default="{ row }">{{ row.pct }}%</template>
          </el-table-column>
          <el-table-column prop="cumPct" label="累计占比" width="80" align="center">
            <template #default="{ row }">{{ row.cumPct }}%</template>
          </el-table-column>
          <el-table-column prop="cls" label="分类" width="70" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.cls === 'A'" type="success" size="small">A</el-tag>
              <el-tag v-else-if="row.cls === 'B'" type="warning" size="small">B</el-tag>
              <el-tag v-else type="info" size="small">C</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import { fetchInventoryTurnover, fetchInventoryAge, fetchInventoryABC, fetchStores } from "../../api";

const activeTab = ref("turnover");
const storeList = ref<any[]>([]);

const tPage = ref(1);
const tPageSize = ref(20);
const tFilter = reactive({ storeId: null as number | null });
const turnover = reactive({ list: [] as any[], total: 0, loading: false });

const ageFilter = reactive({ storeId: null as number | null });
const ageData = ref<any>(null);
const ageChartRef = ref<HTMLElement>();
let ageChart: echarts.ECharts | null = null;

const abcFilter = reactive({ storeId: null as number | null });
const abcData = ref<any>(null);

function formatNum(n: any) { return Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function loadTurnover() {
  turnover.loading = true;
  try {
    const res = await fetchInventoryTurnover({
      page: tPage.value, pageSize: tPageSize.value,
      storeId: tFilter.storeId || undefined
    });
    turnover.list = res?.records || [];
    turnover.total = res?.total || 0;
  } catch {
    ElMessage.error("加载周转率失败");
  } finally {
    turnover.loading = false;
  }
}

async function loadAge() {
  try {
    const res = await fetchInventoryAge({ storeId: ageFilter.storeId || undefined });
    ageData.value = res;
    await nextTick();
    renderAgeChart();
  } catch {
    ElMessage.error("加载库龄失败");
  }
}

function renderAgeChart() {
  if (!ageChartRef.value || !ageData.value?.distribution) return;
  const d = ageData.value.distribution;
  const option: any = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0 },
    series: [{
      type: "pie", radius: ["40%", "70%"],
      data: [
        { value: Number(d.age0_30 || 0), name: "30天内", itemStyle: { color: "#0EA879" } },
        { value: Number(d.age30_60 || 0), name: "30-60天", itemStyle: { color: "#D48B3A" } },
        { value: Number(d.age60_90 || 0), name: "60-90天", itemStyle: { color: "#C0392B" } },
        { value: Number(d.age90plus || 0), name: "90天以上", itemStyle: { color: "#999999" } },
      ]
    }]
  };
  if (!ageChart) ageChart = echarts.init(ageChartRef.value);
  ageChart.setOption(option);
}

async function loadABC() {
  try {
    const res = await fetchInventoryABC({ storeId: abcFilter.storeId || undefined });
    abcData.value = res;
  } catch {
    ElMessage.error("加载ABC分析失败");
  }
}

async function loadData() {
  await loadTurnover();
  await loadAge();
  await loadABC();
  try {
    const stores = await fetchStores();
    storeList.value = stores?.records || stores?.list || stores || [];
  } catch { /* ignore */ }
}

onMounted(() => loadData());
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; }
.stat-row { margin-bottom: 16px; }
.stat-card { border-radius: 8px; }
.stat-item { text-align: center; padding: 8px 0; }
.stat-label { color: var(--gray-400); font-size: 13px; margin-bottom: 8px; }
.stat-value { font-size: 26px; font-weight: 600; color: var(--gray-700); }
.stat-warning .stat-value { color: var(--color-warning); }
.stat-danger .stat-value { color: var(--color-danger); }
.stat-success .stat-value { color: var(--color-success); }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>