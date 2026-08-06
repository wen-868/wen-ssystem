<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>营销活动总览</span>
          <div class="header-actions">
            <el-button type="primary" @click="showCreateDialog">新建活动</el-button>
          </div>
        </div>
      </template>

      <!-- 统一筛选器 -->
      <div class="filter-bar">
        <div class="filter-group">
          <el-input
            v-model="keyword"
            placeholder="搜索活动名称"
            size="default"
            style="width: 220px; margin-right: 10px"
            clearable
            @keyup.enter="loadActivities"
          />
          <el-select v-model="activityType" placeholder="活动类型" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadActivities">
            <el-option label="优惠券" value="coupon" />
            <el-option label="满减" value="fullReduction" />
            <el-option label="秒杀" value="flashSale" />
            <el-option label="拼团" value="groupBuy" />
          </el-select>
          <el-select v-model="status" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadActivities">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="default"
            style="margin-right: 10px"
            @change="loadActivities"
          />
          <el-button @click="loadActivities">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <!-- 活动列表 -->
      <el-table :data="activities" v-loading="loading" stripe>
        <el-table-column prop="name" label="活动名称" min-width="160" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeTag(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优惠内容" min-width="180">
          <template #default="{ row }">
            <span v-if="row.type === 'coupon'">
              <template v-if="row.typeDetail?.couponType === 'FIXED'">满{{ row.typeDetail?.minAmount }}减{{ row.typeDetail?.discountAmount }}</template>
              <template v-else-if="row.typeDetail?.couponType === 'PERCENT'">{{ row.typeDetail?.discountRate }}%</template>
              <template v-else-if="row.typeDetail?.couponType === 'SHIPPING'">免邮</template>
              <template v-else-if="row.typeDetail?.couponType === 'FREE_GIFT'">买赠</template>
              <template v-else>-</template>
            </span>
            <span v-else-if="row.type === 'fullReduction'">
              <span v-for="(rule, idx) in (row.typeDetail?.rules || [])" :key="idx">
                满{{ rule.minAmount }}减{{ rule.discountAmount }}<span v-if="idx < ((row.typeDetail?.rules?.length || 0) - 1)">、</span>
              </span>
            </span>
            <span v-else-if="row.type === 'flashSale'">{{ row.typeDetail?.discountRate }}折</span>
            <span v-else-if="row.type === 'groupBuy'">拼团价 ¥{{ row.typeDetail?.groupPrice }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="participantCount" label="参与人数" width="100">
          <template #default="{ row }">{{ row.participantCount?.toLocaleString() || 0 }}</template>
        </el-table-column>
        <el-table-column prop="verifiedRate" label="核销率" width="100">
          <template #default="{ row }">
            <el-progress :percentage="row.verifiedRate || 0" :color="getProgressColor(row.verifiedRate || 0)" :show-text="true" :stroke-width="12" />
          </template>
        </el-table-column>
        <el-table-column prop="salesIncrease" label="销售额提升" width="120">
          <template #default="{ row }">
            <span :class="(row.salesIncrease || 0) >= 0 ? 'text-green' : 'text-red'">
              {{ (row.salesIncrease || 0) >= 0 ? '+' : '' }}{{ row.salesIncrease || 0 }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="startTime" label="开始时间" width="170" />
        <el-table-column prop="endTime" label="结束时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="activateActivity(row)">启用</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseActivity(row)">暂停</el-button>
            <el-button v-if="row.status !== 'DRAFT'" size="small" link type="primary" @click="viewEffect(row)">效果分析</el-button>
            <el-button size="small" link type="danger" @click="deleteActivity(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
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
    </el-card>

    <!-- 新建活动对话框 -->
    <el-dialog v-model="createDialogVisible" title="新建活动" width="720px">
      <el-form ref="formRef" :model="createForm" :rules="rules" label-width="100px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="活动类型">
          <el-select v-model="createForm.type" style="width: 100%" @change="onTypeChange">
            <el-option label="优惠券" value="coupon" />
            <el-option label="满减活动" value="fullReduction" />
            <el-option label="秒杀活动" value="flashSale" />
            <el-option label="拼团活动" value="groupBuy" />
          </el-select>
        </el-form-item>
        <!-- 优惠券类型 -->
        <template v-if="createForm.type === 'coupon'">
          <el-form-item label="优惠券类型">
            <el-select v-model="createForm.couponType" style="width: 100%">
              <el-option label="满减券" value="FIXED" />
              <el-option label="折扣券" value="PERCENT" />
              <el-option label="免邮券" value="SHIPPING" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="createForm.couponType === 'FIXED'" label="最低消费">
            <el-input-number v-model="createForm.minAmount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item v-if="createForm.couponType === 'FIXED'" label="减免金额">
            <el-input-number v-model="createForm.discountAmount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item v-if="createForm.couponType === 'PERCENT'" label="折扣率">
            <el-input-number v-model="createForm.discountRate" :min="0" :max="10" :precision="1" style="width: 100%" />
          </el-form-item>
        </template>
        <!-- 满减活动类型 -->
        <template v-if="createForm.type === 'fullReduction'">
          <el-form-item label="优惠规则">
            <el-table :data="createForm.fullReductionRules" border>
              <el-table-column prop="minAmount" label="满" width="100">
                <template #default="{ row }"><el-input-number v-model="row.minAmount" :min="0" :precision="2" style="width: 100%" /></template>
              </el-table-column>
              <el-table-column prop="discountAmount" label="减" width="100">
                <template #default="{ row }"><el-input-number v-model="row.discountAmount" :min="0" :precision="2" style="width: 100%" /></template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row }">
                  <el-button size="small" link type="danger" @click="createForm.fullReductionRules = createForm.fullReductionRules.filter(r => r !== row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button type="primary" size="small" @click="createForm.fullReductionRules.push({ minAmount: 0, discountAmount: 0 })">添加规则</el-button>
          </el-form-item>
        </template>
        <!-- 通用字段 -->
        <el-form-item label="发放数量">
          <el-input-number v-model="createForm.totalCount" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="createForm.validRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitActivity">创建</el-button>
      </template>
    </el-dialog>

    <!-- 效果分析对话框 -->
    <el-dialog v-model="effectDialogVisible" title="活动效果分析" width="900px" append-to-body>
      <div v-if="effectData" class="effect-analysis">
        <el-row :gutter="20" style="margin-bottom: 20px">
          <el-col :span="6">
            <el-statistic title="参与人数" :value="effectData.participantCount" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="核销率" :value="effectData.verifiedRate" suffix="%" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="销售额提升" :value="effectData.salesIncrease" suffix="%" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="ROI" :value="effectData.roi" />
          </el-col>
        </el-row>
        <div ref="effectChartRef" class="effect-chart"></div>
      </div>
      <el-empty v-else description="暂无效果数据" :image-size="80" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, onBeforeUnmount } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage, ElMessageBox, ElStatistic } from "element-plus";
import echarts from '@/utils/echarts';
import {
  fetchCouponTemplates,
  fetchFullReductions,
  fetchFlashSales,
  fetchGroupBuys,
  createCouponTemplate,
  createFullReduction,
  activateCouponTemplate,
  activateFullReduction,
  activateFlashSale,
  activateGroupBuy,
  pauseCouponTemplate,
  pauseFullReduction,
  pauseFlashSale,
  deleteCouponTemplate,
  deleteFullReduction,
  deleteFlashSale,
  deleteGroupBuy,
  getActivityEffectAnalysis,
  getActivityConversionTrend,
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const activities = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const activityType = ref("");
const status = ref("");
const dateRange = ref<any[]>([]);

const createDialogVisible = ref(false);
const effectDialogVisible = ref(false);
const effectData = ref<any>(null);
const conversionTrend = ref<any[]>([]);
const effectChartRef = ref<HTMLDivElement>();
let effectChartInstance: echarts.ECharts | null = null;

const formRef = ref();
const rules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }]
};

const createForm = reactive({
  name: "",
  type: "coupon",
  couponType: "FIXED",
  minAmount: 0,
  discountAmount: 0,
  discountRate: 0,
  totalCount: 100,
  validRange: [] as any[],
  fullReductionRules: [{ minAmount: 0, discountAmount: 0 }]
});

function onTypeChange() {
  createForm.fullReductionRules = [{ minAmount: 0, discountAmount: 0 }];
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    coupon: "优惠券",
    fullReduction: "满减",
    flashSale: "秒杀",
    groupBuy: "拼团"
  };
  return map[type] || type;
}

function getTypeTag(type: string) {
  const map: Record<string, string> = {
    coupon: "primary",
    fullReduction: "success",
    flashSale: "danger",
    groupBuy: "warning"
  };
  return map[type] || "info";
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "进行中",
    PAUSED: "已暂停",
    ENDED: "已结束"
  };
  return map[status] || status;
}

function getStatusTag(status: string) {
  const map: Record<string, string> = {
    DRAFT: "info",
    ACTIVE: "success",
    PAUSED: "warning",
    ENDED: "danger"
  };
  return map[status] || "info";
}

function getProgressColor(rate: number) {
  if (rate >= 80) return CHART_COLORS.success;
  if (rate >= 50) return CHART_COLORS.primary;
  if (rate >= 30) return CHART_COLORS.warning;
  return CHART_COLORS.danger;
}

/** 解析后端满减规则 JSON（minAmount/reduceAmount）为展示结构 */
function parseRules(rules: any) {
  let list: any[] = [];
  if (typeof rules === "string") {
    try { list = JSON.parse(rules); } catch { list = []; }
  } else if (Array.isArray(rules)) {
    list = rules;
  }
  return list.map((r: any) => ({ minAmount: r.minAmount, discountAmount: r.reduceAmount }));
}

async function loadActivities() {
  loading.value = true;
  try {
    const params = {
      keyword: keyword.value || undefined,
      status: status.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    };

    const results: any[] = [];

    if (!activityType.value || activityType.value === 'coupon') {
      const couponData = await fetchCouponTemplates(params);
      results.push(...(couponData.records || []).map((item: any) => ({
        ...item,
        type: 'coupon',
        typeDetail: { couponType: item.type, minAmount: item.minAmount, discountAmount: item.value, discountRate: item.value },
        participantCount: item.claimedCount || 0,
        verifiedRate: Number(item.totalCount) > 0 ? Math.round((Number(item.usedCount || 0) / Number(item.totalCount)) * 100) : 0,
        salesIncrease: 0,
        startTime: item.startTime,
        endTime: item.endTime
      })));
    }

    if (!activityType.value || activityType.value === 'fullReduction') {
      const frData = await fetchFullReductions(params);
      results.push(...(frData.records || []).map((item: any) => ({
        ...item,
        type: 'fullReduction',
        typeDetail: { rules: parseRules(item.rules) },
        participantCount: 0,
        verifiedRate: 0,
        salesIncrease: 0,
        startTime: item.startTime,
        endTime: item.endTime
      })));
    }

    if (!activityType.value || activityType.value === 'flashSale') {
      const fsData = await fetchFlashSales(params);
      results.push(...(fsData.records || []).map((item: any) => ({
        ...item,
        type: 'flashSale',
        typeDetail: {
          discountRate: Number(item.originalPrice) > 0 ? (Number(item.flashPrice) / Number(item.originalPrice) * 10).toFixed(1) : "0.0",
          totalStock: item.totalStock,
          soldCount: item.soldCount
        },
        participantCount: item.soldCount || 0,
        verifiedRate: Number(item.totalStock) > 0 ? Math.round((Number(item.soldCount || 0) / Number(item.totalStock)) * 100) : 0,
        salesIncrease: 0,
        startTime: item.startTime,
        endTime: item.endTime
      })));
    }

    if (!activityType.value || activityType.value === 'groupBuy') {
      const gbData = await fetchGroupBuys(params);
      results.push(...(gbData.records || []).map((item: any) => ({
        ...item,
        type: 'groupBuy',
        typeDetail: { groupPrice: item.groupPrice, minGroupSize: item.minGroupSize, totalGroups: 0 },
        participantCount: 0,
        verifiedRate: 0,
        salesIncrease: 0,
        startTime: item.startTime,
        endTime: item.endTime
      })));
    }

    results.sort((a, b) => new Date(b.createdAt || b.startTime || 0).getTime() - new Date(a.createdAt || a.startTime || 0).getTime());
    activities.value = results.slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
    total.value = results.length;
  } catch (e: any) {
    ElMessage.error("加载活动列表失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadActivities();
}

function handlePageChange(p: number) {
  page.value = p;
  loadActivities();
}

function resetFilters() {
  keyword.value = "";
  activityType.value = "";
  status.value = "";
  dateRange.value = [];
  page.value = 1;
  loadActivities();
}

function showCreateDialog() {
  createDialogVisible.value = true;
}

async function submitActivity() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    if (createForm.type === 'coupon') {
      const value = createForm.couponType === 'FIXED'
        ? createForm.discountAmount
        : (createForm.couponType === 'PERCENT' ? Math.round((10 - createForm.discountRate) * 10) : 0);
      await createCouponTemplate({
        name: createForm.name,
        type: createForm.couponType,
        value,
        minAmount: createForm.minAmount,
        totalCount: createForm.totalCount,
        startTime: createForm.validRange[0] || "",
        endTime: createForm.validRange[1] || "",
        description: ""
      });
    } else if (createForm.type === 'fullReduction') {
      await createFullReduction({
        name: createForm.name,
        rules: createForm.fullReductionRules.map((r: any) => ({
          minAmount: Number(r.minAmount),
          reduceAmount: Number(r.discountAmount)
        })),
        applicableScope: "ALL",
        applicableIds: null,
        startTime: createForm.validRange[0],
        endTime: createForm.validRange[1],
        priority: 0,
        stackable: false,
        description: ""
      });
    } else {
      ElMessage.info("秒杀/拼团活动请前往对应活动管理页创建");
      return;
    }
    ElMessage.success("创建成功");
    createDialogVisible.value = false;
    loadActivities();
  } catch (e: any) {
    ElMessage.error("创建失败");
  } finally {
    submitLoading.value = false;
  }
}

function viewDetail(row: any) {
  ElMessage.info("查看详情: " + row.name);
}

async function activateActivity(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认启用活动 ${row.name}?`, "确认启用", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    if (row.type === 'coupon') await activateCouponTemplate(row.id);
    else if (row.type === 'fullReduction') await activateFullReduction(row.id);
    else if (row.type === 'flashSale') await activateFlashSale(row.id);
    else if (row.type === 'groupBuy') await activateGroupBuy(row.id);
    ElMessage.success("已启用");
    loadActivities();
  } catch (e: any) {
    ElMessage.error("操作失败");
  }
}

async function pauseActivity(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认暂停活动 ${row.name}?`, "确认暂停", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    if (row.type === 'coupon') await pauseCouponTemplate(row.id);
    else if (row.type === 'fullReduction') await pauseFullReduction(row.id);
    else if (row.type === 'flashSale') await pauseFlashSale(row.id);
    ElMessage.success("已暂停");
    loadActivities();
  } catch (e: any) {
    ElMessage.error("操作失败");
  }
}

async function deleteActivity(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除活动 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    if (row.type === 'coupon') await deleteCouponTemplate(row.id);
    else if (row.type === 'fullReduction') await deleteFullReduction(row.id);
    else if (row.type === 'flashSale') await deleteFlashSale(row.id);
    else if (row.type === 'groupBuy') await deleteGroupBuy(row.id);
    ElMessage.success("已删除");
    loadActivities();
  } catch (e: any) {
    ElMessage.error("删除失败");
  }
}

async function viewEffect(row: any) {
  effectDialogVisible.value = true;
  effectData.value = null;
  conversionTrend.value = [];

  try {
    const data = await getActivityEffectAnalysis(row.id, { activityType: row.type });
    effectData.value = data ? {
      participantCount: data.totalUsers || 0,
      verifiedRate: data.usedRate || 0,
      salesIncrease: 0,
      roi: data.roi || 0
    } : null;
    const trend = await getActivityConversionTrend(row.id, { period: "day" });
    conversionTrend.value = trend || [];
    nextTick(() => {
      renderEffectChart();
    });
  } catch (e) {
    effectData.value = null;
    conversionTrend.value = [];
    nextTick(() => {
      renderEffectChart();
    });
  }
}

function renderEffectChart() {
  if (!effectChartRef.value) return;
  if (effectChartInstance) effectChartInstance.dispose();

  const trend = conversionTrend.value || [];
  effectChartInstance = echarts.init(effectChartRef.value);
  effectChartInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["发放量", "使用量"], bottom: 0 },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: trend.map((d) => d.period),
    },
    yAxis: [{ type: "value", name: "数量" }],
    series: [
      {
        name: "发放量",
        type: "bar",
        data: trend.map((d) => d.issuedCount || 0),
        itemStyle: { color: CHART_COLORS.primary }
      },
      {
        name: "使用量",
        type: "line",
        data: trend.map((d) => d.usedCount || 0),
        smooth: true,
        itemStyle: { color: CHART_COLORS.success }
      }
    ]
  });
}

onMounted(() => {
  loadActivities();
});

onBeforeUnmount(() => {
  effectChartInstance?.dispose();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.filter-bar {
  margin-bottom: 16px;
}
.filter-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.text-green {
  color: var(--color-success);
}
.text-red {
  color: var(--color-danger);
}
.effect-analysis {
  padding: 10px;
}
.effect-chart {
  width: 100%;
  height: 300px;
}
</style>
