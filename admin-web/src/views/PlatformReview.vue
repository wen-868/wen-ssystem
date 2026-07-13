<template>
  <div class="platform-review-page">
    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="24"><Star /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">评价总数</div>
          <div class="stat-value">{{ stats.totalCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">好评率</div>
          <div class="stat-value">{{ stats.positiveRate }}%</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="24"><Clock /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">待审核</div>
          <div class="stat-value">{{ stats.pendingCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="24"><Message /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">已回复</div>
          <div class="stat-value">{{ stats.repliedCount }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>评价趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>评分分布</span>
            </div>
          </template>
          <div ref="ratingChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="平台名称">
          <el-input v-model="searchForm.platformName" placeholder="请输入平台名称" clearable />
        </el-form-item>
        <el-form-item label="审核类型">
          <el-select v-model="searchForm.reviewType" placeholder="请选择类型" clearable>
            <el-option label="商品" :value="1" />
            <el-option label="店铺" :value="2" />
            <el-option label="会员" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="待审核" :value="0" />
            <el-option label="审核通过" :value="1" />
            <el-option label="审核拒绝" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分">
          <el-select v-model="searchForm.rating" placeholder="请选择评分" clearable>
            <el-option label="1星" :value="1" />
            <el-option label="2星" :value="2" />
            <el-option label="3星" :value="3" />
            <el-option label="4星" :value="4" />
            <el-option label="5星" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>评价列表</span>
          <el-button type="danger" size="small" @click="handleBatchReject" :disabled="selectedIds.length === 0">
            批量拒绝
          </el-button>
        </div>
      </template>
      <el-table :data="records" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="platformName" label="平台名称" width="150" />
        <el-table-column prop="platformNo" label="平台编号" width="150" />
        <el-table-column prop="reviewType" label="审核类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getReviewTypeTag(row.reviewType)">
              {{ getReviewTypeLabel(row.reviewType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rating" label="评分" width="80">
          <template #default="{ row }">
            <span class="rating-stars">
              <el-icon v-for="i in 5" :key="i" :class="{ active: i <= row.rating }"><Star /></el-icon>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewContent" label="评价内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewResult" label="审核结果" min-width="150" show-overflow-tooltip />
        <el-table-column prop="reviewAt" label="审核时间" width="180" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 0">
              <el-button type="success" size="small" @click="handleApprove(row.id)">通过</el-button>
              <el-button type="danger" size="small" @click="showRejectDialog(row)">拒绝</el-button>
            </template>
            <template v-else>
              <el-button type="primary" size="small" @click="showReplyDialog(row)">回复</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 回复对话框 -->
    <el-dialog title="回复评价" v-model="replyDialogVisible" width="500px">
      <el-form ref="replyFormRef" :model="replyForm" :rules="replyRules" label-width="80px">
        <el-form-item label="平台名称">
          <span>{{ replyForm.platformName }}</span>
        </el-form-item>
        <el-form-item label="评价内容">
          <p style="color: #606266">{{ replyForm.reviewContent }}</p>
        </el-form-item>
        <el-form-item label="回复内容" prop="replyContent">
          <el-input v-model="replyForm.replyContent" type="textarea" :rows="4" placeholder="请输入回复内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReply" :loading="replying">提交</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝对话框 -->
    <el-dialog title="拒绝评价" v-model="rejectDialogVisible" width="500px">
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules" label-width="80px">
        <el-form-item label="平台名称">
          <span>{{ rejectForm.platformName }}</span>
        </el-form-item>
        <el-form-item label="拒绝原因" prop="reason">
          <el-input v-model="rejectForm.reason" type="textarea" :rows="4" placeholder="请输入拒绝原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject" :loading="rejecting">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import { Star, CircleCheck, Clock, Message } from "@element-plus/icons-vue";
import echarts from '@/utils/echarts';
import {
  fetchPlatformReviews,
  replyPlatformReview,
  fetchPlatformReviewStats,
  reviewApproval,
  batchReviewApproval,
  getReviewById
} from "@/api";

const records = ref<any[]>([]);
const selectedIds = ref<number[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const replying = ref(false);
const rejecting = ref(false);
const replyDialogVisible = ref(false);
const rejectDialogVisible = ref(false);
const replyId = ref<number | null>(null);
const rejectId = ref<number | null>(null);

const trendChartRef = ref<HTMLDivElement>();
const ratingChartRef = ref<HTMLDivElement>();
let trendChartInstance: echarts.ECharts | null = null;
let ratingChartInstance: echarts.ECharts | null = null;

const stats = reactive({
  totalCount: 0,
  positiveRate: 0,
  pendingCount: 0,
  repliedCount: 0,
});

const searchForm = reactive({
  platformName: "",
  reviewType: undefined as number | undefined,
  status: undefined as number | undefined,
  rating: undefined as number | undefined,
  dateRange: [] as any[],
});

const replyForm = reactive({
  platformName: "",
  reviewContent: "",
  replyContent: "",
});

const rejectForm = reactive({
  platformName: "",
  reason: "",
});

const replyFormRef = ref();
const rejectFormRef = ref();

const replyRules: FormRules = {
  replyContent: [{ required: true, message: "请输入回复内容", trigger: "blur" }],
};

const rejectRules: FormRules = {
  reason: [{ required: true, message: "请输入拒绝原因", trigger: "blur" }],
};

const reviewTypeMap: Record<number, { label: string; tag: string }> = {
  1: { label: "商品", tag: "primary" },
  2: { label: "店铺", tag: "success" },
  3: { label: "会员", tag: "warning" },
};

const statusMap: Record<number, { label: string; type: string }> = {
  0: { label: "待审核", type: "warning" },
  1: { label: "审核通过", type: "success" },
  2: { label: "审核拒绝", type: "danger" },
};

const getReviewTypeLabel = (type: number) => reviewTypeMap[type]?.label || "未知";
const getReviewTypeTag = (type: number) => reviewTypeMap[type]?.tag || "info";
const getStatusType = (status: number) => statusMap[status]?.type || "info";
const getStatusLabel = (status: number) => statusMap[status]?.label || "未知";

const fetchStats = async () => {
  try {
    const res = await fetchPlatformReviewStats();
    stats.totalCount = res.totalCount || 0;
    stats.positiveRate = res.positiveRate || 0;
    stats.pendingCount = res.pendingCount || 0;
    stats.repliedCount = res.repliedCount || 0;
    
    // 渲染图表
    nextTick(() => {
      renderTrendChart(res.trend || []);
      renderRatingChart(res.ratingDistribution || []);
    });
  } catch { /* ignore */ }
};

function renderTrendChart(data: any[]) {
  if (!trendChartRef.value) return;
  if (trendChartInstance) trendChartInstance.dispose();

  trendChartInstance = echarts.init(trendChartRef.value);
  trendChartInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["评价数"], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date?.slice(5) || d.date || ""),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: { type: "value", name: "评价数" },
    series: [
      {
        name: "评价数",
        type: "bar",
        data: data.map((d) => d.count || 0),
        itemStyle: { color: "#409eff" },
        barWidth: "60%",
      },
    ],
  });
}

function renderRatingChart(data: any[]) {
  if (!ratingChartRef.value) return;
  if (ratingChartInstance) ratingChartInstance.dispose();

  ratingChartInstance = echarts.init(ratingChartRef.value);
  ratingChartInstance.setOption({
    tooltip: {
      trigger: "item",
      formatter: "{b}星：{c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold",
          },
        },
        data: data.map((d: any) => ({
          name: d.rating || d.name || "",
          value: d.count || d.value || 0,
        })),
        color: ["#f56c6c", "#e6a23c", "#e6a23c", "#67c23a", "#67c23a"],
      },
    ],
  });
}

const fetchData = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      platformName: searchForm.platformName || undefined,
      reviewType: searchForm.reviewType,
      status: searchForm.status,
      rating: searchForm.rating,
    };
    if (searchForm.dateRange.length === 2) {
      params.dateStart = searchForm.dateRange[0];
      params.dateEnd = searchForm.dateRange[1];
    }
    const res = await fetchPlatformReviews(params);
    records.value = res.records || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error("获取评价列表失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.platformName = "";
  searchForm.reviewType = undefined;
  searchForm.status = undefined;
  searchForm.rating = undefined;
  searchForm.dateRange = [];
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const handleSelectionChange = (val: any[]) => {
  selectedIds.value = val.map((item) => item.id);
};

const showReplyDialog = async (row: any) => {
  replyId.value = row.id;
  replyForm.platformName = row.platformName;
  replyForm.reviewContent = row.reviewContent || "";
  replyForm.replyContent = "";
  replyDialogVisible.value = true;
};

const handleReply = async () => {
  const valid = await replyFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  replying.value = true;
  try {
    await replyPlatformReview(replyId.value!, replyForm.replyContent);
    ElMessage.success("回复成功");
    replyDialogVisible.value = false;
    fetchData();
    fetchStats();
  } catch (e: any) {
    ElMessage.error("回复失败");
  } finally {
    replying.value = false;
  }
};

const showRejectDialog = (row: any) => {
  rejectId.value = row.id;
  rejectForm.platformName = row.platformName;
  rejectForm.reason = "";
  rejectDialogVisible.value = true;
};

const handleReject = async () => {
  const valid = await rejectFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  rejecting.value = true;
  try {
    await reviewApproval(rejectId.value!, 2, rejectForm.reason);
    ElMessage.success("拒绝成功");
    rejectDialogVisible.value = false;
    fetchData();
    fetchStats();
  } catch (e: any) {
    ElMessage.error("拒绝失败");
  } finally {
    rejecting.value = false;
  }
};

const handleApprove = async (id: number) => {
  try {
    await reviewApproval(id, 1);
    ElMessage.success("审核通过");
    fetchData();
    fetchStats();
  } catch (e: any) {
    ElMessage.error("审核失败");
  }
};

const handleBatchReject = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await batchReviewApproval(selectedIds.value, 2);
    ElMessage.success("批量拒绝成功");
    selectedIds.value = [];
    fetchData();
    fetchStats();
  } catch (e: any) {
    ElMessage.error("批量拒绝失败");
  }
};

function handleResize() {
  trendChartInstance?.resize();
  ratingChartInstance?.resize();
}

onMounted(() => {
  fetchStats();
  fetchData();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  trendChartInstance?.dispose();
  ratingChartInstance?.dispose();
});
</script>

<style scoped>
.platform-review-page {
  padding: 20px;
}

/* 统计卡片 */
.stat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  color: #fff;
}

.stat-card.stat-primary {
  background: linear-gradient(135deg, #409eff, #337ecc);
}
.stat-card.stat-success {
  background: linear-gradient(135deg, #67c23a, #529b2e);
}
.stat-card.stat-warning {
  background: linear-gradient(135deg, #e6a23c, #c98a2e);
}
.stat-card.stat-danger {
  background: linear-gradient(135deg, #f56c6c, #d94f4f);
}

.stat-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
}

/* 图表 */
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-body {
  width: 100%;
  height: 280px;
}

/* 评分星星 */
.rating-stars {
  color: #e6a23c;
}
.rating-stars .el-icon {
  opacity: 0.3;
}
.rating-stars .el-icon.active {
  opacity: 1;
}

.search-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>