<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">审核任务</h2>
      <p class="page-desc">商品审核任务处理</p>
    </div>
  </div>
<!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-primary" @click="activeTab = 'pending'" style="cursor: pointer">
        <div class="stat-icon"><el-icon :size="24"><Clock /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">待我审核</div>
          <div class="stat-value">{{ stats.pendingCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="24"><Warning /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">紧急待办</div>
          <div class="stat-value">{{ stats.urgentCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">我已通过</div>
          <div class="stat-value">{{ stats.approvedCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="24"><Close /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">我已驳回</div>
          <div class="stat-value">{{ stats.rejectedCount }}</div>
        </div>
      </div>
    </div>

    <PageCard>
      <template #header>
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="待我审核" name="pending" />
          <el-tab-pane label="我已审核" name="reviewed" />
          <el-tab-pane label="我发起的" name="submitted" />
        </el-tabs>
      </template>

      <!-- 搜索筛选 -->
      <div class="filter-bar">
        <el-input v-model="searchForm.keyword" placeholder="商品名称/审核单号" clearable style="width: 220px" :prefix-icon="Search" />
        <el-select v-model="searchForm.reviewType" placeholder="审核类型" clearable style="width: 160px; margin-left: 12px">
          <el-option label="新增商品" value="CREATE" />
          <el-option label="修改商品" value="UPDATE" />
          <el-option label="下架商品" value="OFFLINE" />
          <el-option label="价格变更" value="PRICE_CHANGE" />
        </el-select>
        <el-select v-if="activeTab === 'pending'" v-model="searchForm.urgent" placeholder="紧急程度" clearable style="width: 140px; margin-left: 12px">
          <el-option label="普通" value="NORMAL" />
          <el-option label="紧急" value="URGENT" />
          <el-option label="特急" value="CRITICAL" />
        </el-select>
        <el-select v-if="activeTab === 'reviewed'" v-model="searchForm.result" placeholder="审核结果" clearable style="width: 140px; margin-left: 12px">
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-date-picker
          v-model="searchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 260px; margin-left: 12px"
        />
        <el-button type="primary" style="margin-left: 12px" @click="loadList">查询</el-button>
        <el-button style="margin-left: 8px" @click="handleReset">重置</el-button>
      </div>

      <!-- 列表 -->
      <div class="table-card">
<el-table :data="records" border v-loading="loading">
        <el-table-column label="商品信息" min-width="220">
          <template #default="{ row }">
            <div class="product-info">
              <el-image lazy :src="row.productImage || placeholderImg" class="product-img" fit="cover" />
              <div class="product-meta">
                <div class="product-name">{{ row.productName }}</div>
                <div class="product-sub">审核单号：{{ row.reviewNo }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="reviewType" label="审核类型" width="110">
          <template #default="{ row }">
            <el-tag :type="getReviewTypeTag(row.reviewType)" size="small">
              {{ getReviewTypeLabel(row.reviewType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'pending'" prop="urgent" label="紧急程度" width="100">
          <template #default="{ row }">
            <el-tag :type="getUrgentTag(row.urgent)" size="small" effect="dark">
              {{ getUrgentLabel(row.urgent) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submitterName" label="提报人" width="100" />
        <el-table-column v-if="activeTab !== 'pending'" prop="reviewerName" label="审核人" width="100">
          <template #default="{ row }">
            <span>{{ row.reviewerName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'pending'" label="当前节点" width="120">
          <template #default="{ row }">
            <el-tag type="warning" size="small">{{ row.currentLevelName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'reviewed'" prop="result" label="审核结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.result === 'APPROVED' ? 'success' : 'danger'" size="small">
              {{ row.result === 'APPROVED' ? '通过' : '驳回' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'submitted'" prop="status" label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'pending'" label="剩余时限" width="110">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.remainingHours < 24 }">
              {{ formatRemaining(row.remainingHours) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="activeTab === 'pending'" prop="submittedAt" label="提报时间" width="170" />
        <el-table-column v-if="activeTab === 'reviewed'" prop="reviewedAt" label="审核时间" width="170" />
        <el-table-column v-if="activeTab === 'submitted'" prop="createdAt" label="提交时间" width="170" />
        <el-table-column v-if="activeTab === 'reviewed'" label="审核意见" min-width="150">
          <template #default="{ row }">
            <span>{{ row.reviewOpinion || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
            <template v-if="activeTab === 'pending'">
              <el-button type="success" size="small" link @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" link @click="showRejectDialog(row)">驳回</el-button>
            </template>
            <template v-if="activeTab === 'submitted' && row.status === 'PENDING'">
              <el-button type="warning" size="small" link @click="handleRevoke(row)">撤销</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadList"
          @size-change="loadList"
        />
      </div>
</div>
    </PageCard>

    <!-- 审核详情弹窗 -->
    <el-dialog v-model="detailVisible" title="审核详情" width="720px" :close-on-click-modal="false">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="审核单号">{{ detail.reviewNo }}</el-descriptions-item>
        <el-descriptions-item label="审核类型">
          <el-tag :type="getReviewTypeTag(detail.reviewType)" size="small">
            {{ getReviewTypeLabel(detail.reviewType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="商品名称" :span="2">{{ detail.productName }}</el-descriptions-item>
        <el-descriptions-item label="提报人">{{ detail.submitterName }}</el-descriptions-item>
        <el-descriptions-item label="提报时间">{{ detail.submittedAt }}</el-descriptions-item>
        <el-descriptions-item label="紧急程度">
          <el-tag :type="getUrgentTag(detail.urgent)" size="small" effect="dark">
            {{ getUrgentLabel(detail.urgent) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核状态">
          <el-tag :type="getStatusType(detail.status)" size="small">
            {{ getStatusLabel(detail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="变更说明" :span="2">{{ detail.changeReason || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">审核流程</el-divider>
      <WorkflowFlowChart
        :levels="detail.levels"
        :current-level="detail.currentLevel"
        :approved-levels="detail.approvedLevels"
        :rejected-level="detail.rejectedLevel"
      />

      <el-divider content-position="left">审核记录</el-divider>
      <el-timeline v-if="detail.reviewLogs && detail.reviewLogs.length">
        <el-timeline-item
          v-for="(log, idx) in detail.reviewLogs"
          :key="idx"
          :timestamp="log.reviewedAt"
          :color="log.result === 'APPROVED' ? 'var(--color-success)' : log.result === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-warning)'"
          placement="top"
        >
          <div class="timeline-node">
            <div class="node-header">
              <span class="node-approver">{{ log.reviewerName }}（{{ log.levelName }}）</span>
              <el-tag :type="log.result === 'APPROVED' ? 'success' : 'danger'" size="small">
                {{ log.result === 'APPROVED' ? '通过' : '驳回' }}
              </el-tag>
            </div>
            <div v-if="log.opinion" class="node-opinion">意见：{{ log.opinion }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无审核记录" :image-size="60" />

      <template #footer>
        <template v-if="activeTab === 'pending' && detail.status === 'PENDING' && detail.canReview">
          <el-button type="success" @click="handleApprove(detail)">审核通过</el-button>
          <el-button type="danger" @click="showRejectDialog(detail)">审核驳回</el-button>
        </template>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 驳回弹窗 -->
    <el-dialog v-model="rejectVisible" title="审核驳回" width="480px" :close-on-click-modal="false">
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules" label-width="100px">
        <el-form-item label="驳回意见" prop="opinion">
          <el-input v-model="rejectForm.opinion" type="textarea" :rows="4" placeholder="请输入驳回意见（必填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitLoading" @click="handleRejectConfirm">确定驳回</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Clock, Warning, CircleCheck, Close } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";
import WorkflowFlowChart from "../components/WorkflowFlowChart.vue";
import { fetchProductReviews, fetchProductReviewDetail } from "../../api/product";

const placeholderImg = "https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png";

// ==================== Mock 数据 ====================
const mockPendingList = []

const mockReviewedList = []

const mockSubmittedList = []

const mockDetail = {}

// ==================== 数据状态 ====================
const activeTab = ref("pending");
const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const searchForm = reactive({
  keyword: "",
  reviewType: "",
  urgent: "",
  result: "",
  dateRange: null as string[] | null
});

const stats = reactive({
  pendingCount: 4,
  urgentCount: 2,
  approvedCount: 128,
  rejectedCount: 12
});

const detailVisible = ref(false);
const detail = ref<any>({});
const rejectVisible = ref(false);
const rejectFormRef = ref();
const submitLoading = ref(false);
const rejectForm = reactive({
  opinion: "",
  reviewId: null as number | null
});

const rejectRules = {
  opinion: [{ required: true, message: "请输入驳回意见", trigger: "blur" }]
};

// ==================== 方法 ====================
function getReviewTypeLabel(type: string) {
  const map: Record<string, string> = {
    CREATE: "新增商品",
    UPDATE: "修改商品",
    OFFLINE: "下架商品",
    PRICE_CHANGE: "价格变更"
  };
  return map[type] || type;
}

function getReviewTypeTag(type: string) {
  const map: Record<string, string> = {
    CREATE: "success",
    UPDATE: "",
    OFFLINE: "warning",
    PRICE_CHANGE: "danger"
  };
  return map[type] || "";
}

function getUrgentLabel(urgent: string) {
  const map: Record<string, string> = {
    NORMAL: "普通",
    URGENT: "紧急",
    CRITICAL: "特急"
  };
  return map[urgent] || urgent;
}

function getUrgentTag(urgent: string) {
  const map: Record<string, string> = {
    NORMAL: "info",
    URGENT: "warning",
    CRITICAL: "danger"
  };
  return map[urgent] || "info";
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: "审核中",
    APPROVED: "已通过",
    REJECTED: "已驳回",
    REVOKED: "已撤销"
  };
  return map[status] || status;
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    REVOKED: "info"
  };
  return map[status] || "";
}

function formatRemaining(hours: number) {
  if (hours < 1) return `${Math.floor(hours * 60)}分钟`;
  if (hours < 24) return `${hours}小时`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
}

function handleTabChange() {
  page.value = 1;
  loadList();
}

async function loadList() {
  loading.value = true;
  try {
    const statusMap: Record<string, string | undefined> = { pending: "PENDING", reviewed: "APPROVED", submitted: undefined }
    const data = await fetchProductReviews({
      page: page.value,
      pageSize: pageSize.value,
      status: statusMap[activeTab.value],
      keyword: searchForm.keyword || undefined,
      reviewType: searchForm.reviewType || undefined,
    })
    records.value = (data?.records || []).map((r: any) => ({
      ...r,
      reviewNo: r.reviewNo || '',
      productName: r.productName || '',
      urgent: 0,
      result: r.status,
      submittedAt: r.createdAt || '',
      reviewOpinion: r.reviewComment || '',
      status: r.status || 'PENDING',
      reviewerName: r.reviewerName || ''
    }))
    total.value = data?.total || 0
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载审核任务失败')
    records.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.reviewType = "";
  searchForm.urgent = "";
  searchForm.result = "";
  searchForm.dateRange = null;
  loadList();
}

async function viewDetail(row: any) {
  try {
    const d = await fetchProductReviewDetail(row.id)
    detail.value = { ...(d || {}), ...row }
    detailVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载详情失败')
  }
}

function handleApprove(row: any) {
  ElMessageBox.confirm("确定要审核通过该商品吗？", "审核通过", {
    confirmButtonText: "通过",
    cancelButtonText: "取消",
    type: "success"
  }).then(() => {
    ElMessage.success("审核通过成功");
    detailVisible.value = false;
    loadList();
    // 更新统计
    stats.pendingCount--;
    stats.approvedCount++;
  }).catch(() => {});
}

function showRejectDialog(row: any) {
  rejectForm.reviewId = row.id;
  rejectForm.opinion = "";
  rejectVisible.value = true;
}

function handleRejectConfirm() {
  rejectFormRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    submitLoading.value = true;
    setTimeout(() => {
      ElMessage.success("已驳回");
      submitLoading.value = false;
      rejectVisible.value = false;
      detailVisible.value = false;
      loadList();
      stats.pendingCount--;
      stats.rejectedCount++;
    }, 400);
  });
}

function handleRevoke(row: any) {
  ElMessageBox.confirm("确定要撤销该审核申请吗？", "撤销申请", {
    confirmButtonText: "撤销",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    ElMessage.success("已撤销");
    loadList();
  }).catch(() => {});
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.stat-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-right: 16px;
}

.stat-primary .stat-icon {
  background: linear-gradient(135deg, var(--color-primary), rgba(63, 111, 239, 0.4));
}

.stat-warning .stat-icon {
  background: linear-gradient(135deg, var(--color-warning), rgba(212, 139, 58, 0.4));
}

.stat-success .stat-icon {
  background: linear-gradient(135deg, var(--color-success), rgba(14, 168, 121, 0.4));
}

.stat-danger .stat-icon {
  background: linear-gradient(135deg, var(--color-danger), rgba(192, 57, 43, 0.4));
}

.stat-info .stat-icon {
  background: linear-gradient(135deg, var(--gray-400), rgba(153, 153, 153, 0.4));
}

.stat-label {
  font-size: 14px;
  color: var(--gray-400);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--gray-700);
}

.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.product-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-img {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  flex-shrink: 0;
}

.product-meta {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 14px;
  color: var(--gray-700);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sub {
  font-size: 12px;
  color: var(--gray-400);
}

.text-danger {
  color: var(--color-danger);
  font-weight: 500;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.timeline-node .node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.node-approver {
  font-weight: 500;
  color: var(--gray-700);
}

.node-opinion {
  font-size: 13px;
  color: var(--gray-600);
}
</style>
