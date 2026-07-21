<template>
  <div class="page">
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
      <el-table :data="records" border v-loading="loading">
        <el-table-column label="商品信息" min-width="220">
          <template #default="{ row }">
            <div class="product-info">
              <el-image :src="row.productImage || placeholderImg" class="product-img" fit="cover" />
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
        <el-table-column label="操作" width="200" fixed="right">
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

      <div class="pagination-wrap">
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
          :color="log.result === 'APPROVED' ? '#67c23a' : log.result === 'REJECTED' ? '#f56c6c' : '#e6a23c'"
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
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules" label-width="80px">
        <el-form-item label="驳回意见" prop="opinion">
          <el-input v-model="rejectForm.opinion" type="textarea" :rows="4" placeholder="请输入驳回意见（必填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitLoading" @click="handleRejectConfirm">确认驳回</el-button>
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

const placeholderImg = "https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png";

// ==================== Mock 数据 ====================
const mockPendingList = [
  {
    id: 1,
    reviewNo: "PR202607150001",
    productName: "飞天茅台53度500ml",
    productImage: "",
    reviewType: "CREATE",
    urgent: "URGENT",
    submitterName: "张经理",
    currentLevelName: "一级审核",
    remainingHours: 18,
    submittedAt: "2026-07-15 09:30:00",
    status: "PENDING",
    canReview: true
  },
  {
    id: 2,
    reviewNo: "PR202607150002",
    productName: "五粮液普五52度500ml",
    productImage: "",
    reviewType: "UPDATE",
    urgent: "NORMAL",
    submitterName: "李业务员",
    currentLevelName: "二级审核",
    remainingHours: 42,
    submittedAt: "2026-07-14 14:20:00",
    status: "PENDING",
    canReview: true
  },
  {
    id: 3,
    reviewNo: "PR202607150003",
    productName: "青岛啤酒经典500ml*12",
    productImage: "",
    reviewType: "PRICE_CHANGE",
    urgent: "CRITICAL",
    submitterName: "王店长",
    currentLevelName: "一级审核",
    remainingHours: 5,
    submittedAt: "2026-07-15 08:00:00",
    status: "PENDING",
    canReview: true
  },
  {
    id: 4,
    reviewNo: "PR202607150004",
    productName: "张裕解百纳干红750ml",
    productImage: "",
    reviewType: "OFFLINE",
    urgent: "NORMAL",
    submitterName: "赵库管",
    currentLevelName: "一级审核",
    remainingHours: 20,
    submittedAt: "2026-07-15 10:15:00",
    status: "PENDING",
    canReview: true
  }
];

const mockReviewedList = [
  {
    id: 11,
    reviewNo: "PR202607140001",
    productName: "洋河蓝色经典天之蓝480ml",
    productImage: "",
    reviewType: "CREATE",
    submitterName: "张经理",
    reviewerName: "我（店长）",
    result: "APPROVED",
    reviewedAt: "2026-07-14 16:30:00",
    reviewOpinion: "信息完整，同意上架",
    status: "APPROVED"
  },
  {
    id: 12,
    reviewNo: "PR202607140002",
    productName: "农夫山泉550ml*24",
    productImage: "",
    reviewType: "PRICE_CHANGE",
    submitterName: "李业务员",
    reviewerName: "我（店长）",
    result: "REJECTED",
    reviewedAt: "2026-07-14 11:20:00",
    reviewOpinion: "价格调整幅度过大，请确认进价后重新提交",
    status: "REJECTED"
  },
  {
    id: 13,
    reviewNo: "PR202607130001",
    productName: "红牛维生素功能饮料250ml*24",
    productImage: "",
    reviewType: "UPDATE",
    submitterName: "王店长",
    reviewerName: "我（店长）",
    result: "APPROVED",
    reviewedAt: "2026-07-13 15:45:00",
    reviewOpinion: "",
    status: "APPROVED"
  }
];

const mockSubmittedList = [
  {
    id: 21,
    reviewNo: "PR202607150010",
    productName: "泸州老窖特曲52度500ml",
    productImage: "",
    reviewType: "CREATE",
    submitterName: "我",
    status: "PENDING",
    currentLevelName: "一级审核",
    createdAt: "2026-07-15 09:00:00"
  },
  {
    id: 22,
    reviewNo: "PR202607140015",
    productName: "怡宝纯净水555ml*24",
    productImage: "",
    reviewType: "PRICE_CHANGE",
    submitterName: "我",
    status: "APPROVED",
    createdAt: "2026-07-14 10:00:00"
  },
  {
    id: 23,
    reviewNo: "PR202607130008",
    productName: "康师傅冰红茶500ml*15",
    productImage: "",
    reviewType: "UPDATE",
    submitterName: "我",
    status: "REJECTED",
    createdAt: "2026-07-13 14:30:00"
  }
];

const mockDetail = {
  id: 1,
  reviewNo: "PR202607150001",
  productName: "飞天茅台53度500ml",
  productImage: "",
  reviewType: "CREATE",
  urgent: "URGENT",
  submitterName: "张经理",
  submittedAt: "2026-07-15 09:30:00",
  status: "PENDING",
  changeReason: "新品上架，供应商直供，价格有优势",
  currentLevel: 0,
  approvedLevels: [] as number[],
  rejectedLevel: -1,
  canReview: true,
  levels: [
    { name: "一级审核", role: "MGR", approverName: "张经理", timeLimitHours: 24 },
    { name: "二级审核", role: "FIN", approverName: "李财务", timeLimitHours: 48 },
    { name: "三级审核", role: "BOSS", approverName: "王老板", timeLimitHours: 72 }
  ],
  reviewLogs: [
    { levelName: "提交申请", reviewerName: "张经理", result: "APPROVED", opinion: "提交商品新增审核", reviewedAt: "2026-07-15 09:30:00" }
  ]
};

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

function loadList() {
  loading.value = true;
  setTimeout(() => {
    let source: any[] = [];
    if (activeTab.value === "pending") source = mockPendingList;
    else if (activeTab.value === "reviewed") source = mockReviewedList;
    else source = mockSubmittedList;

    let filtered = [...source];
    if (searchForm.keyword) {
      filtered = filtered.filter(r =>
        r.productName.includes(searchForm.keyword!) || r.reviewNo.includes(searchForm.keyword!)
      );
    }
    if (searchForm.reviewType) {
      filtered = filtered.filter(r => r.reviewType === searchForm.reviewType);
    }
    if (searchForm.urgent && activeTab.value === "pending") {
      filtered = filtered.filter(r => r.urgent === searchForm.urgent);
    }
    if (searchForm.result && activeTab.value === "reviewed") {
      filtered = filtered.filter(r => r.result === searchForm.result);
    }

    records.value = filtered;
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.reviewType = "";
  searchForm.urgent = "";
  searchForm.result = "";
  searchForm.dateRange = null;
  loadList();
}

function viewDetail(row: any) {
  detail.value = {
    ...mockDetail,
    ...row,
    levels: mockDetail.levels,
    approvedLevels: row.status === "APPROVED" ? [0, 1, 2] : row.status === "REJECTED" ? [0] : [],
    rejectedLevel: row.status === "REJECTED" ? 1 : -1,
    currentLevel: row.status === "PENDING" ? 0 : -1,
    reviewLogs: row.status === "PENDING"
      ? [{ levelName: "提交申请", reviewerName: row.submitterName, result: "APPROVED", opinion: "提交审核", reviewedAt: row.submittedAt }]
      : [{ levelName: "审核", reviewerName: row.reviewerName || row.submitterName, result: row.result || row.status, opinion: row.reviewOpinion || "", reviewedAt: row.reviewedAt || row.createdAt }]
  };
  detailVisible.value = true;
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
  background: linear-gradient(135deg, #409eff, #66b1ff);
}

.stat-warning .stat-icon {
  background: linear-gradient(135deg, #e6a23c, #f0c36d);
}

.stat-success .stat-icon {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.stat-danger .stat-icon {
  background: linear-gradient(135deg, #f56c6c, #f78989);
}

.stat-info .stat-icon {
  background: linear-gradient(135deg, #909399, #a6a9ad);
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
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
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sub {
  font-size: 12px;
  color: #909399;
}

.text-danger {
  color: #f56c6c;
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
  color: #303133;
}

.node-opinion {
  font-size: 13px;
  color: #606266;
}
</style>
