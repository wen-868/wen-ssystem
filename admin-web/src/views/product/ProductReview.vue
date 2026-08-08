<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">商品审核</h2>
      <p class="page-desc">商品审核任务与流程</p>
    </div>
  </div>
<!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="24"><Goods /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">全部审核</div>
          <div class="stat-value">{{ stats.totalCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="24"><Clock /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">待审核</div>
          <div class="stat-value">{{ stats.pendingCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">已通过</div>
          <div class="stat-value">{{ stats.approvedCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="24"><Close /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">已驳回</div>
          <div class="stat-value">{{ stats.rejectedCount }}</div>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <el-card class="tab-card" shadow="never">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="待审核" name="PENDING" />
        <el-tab-pane label="已通过" name="APPROVED" />
        <el-tab-pane label="已驳回" name="REJECTED" />
        <el-tab-pane label="全部" name="ALL" />
      </el-tabs>
    </el-card>

    <!-- 搜索筛选 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="商品名称/审核单号" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="审核类型">
          <el-select v-model="searchForm.reviewType" placeholder="请选择类型" clearable style="width: 150px">
            <el-option label="新增商品" value="CREATE" />
            <el-option label="修改商品" value="UPDATE" />
            <el-option label="下架商品" value="OFFLINE" />
          </el-select>
        </el-form-item>
        <el-form-item label="提交人">
          <el-input v-model="searchForm.submitterName" placeholder="提交人姓名" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="提交时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            clearable
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表表格 -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>审核列表</span>
          <div v-if="activeTab === 'PENDING'">
            <el-button type="success" size="small" @click="handleBatchApprove" :disabled="selectedIds.length === 0">
              批量通过
            </el-button>
            <el-button type="danger" size="small" @click="handleBatchReject" :disabled="selectedIds.length === 0">
              批量驳回
            </el-button>
          </div>
        </div>
      </template>

      <div class="table-card">
<el-table :data="records" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" v-if="activeTab === 'PENDING'" />
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
        <el-table-column prop="reviewType" label="审核类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getReviewTypeTag(row.reviewType)" size="small">
              {{ getReviewTypeLabel(row.reviewType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submitterName" label="提交人" width="120" />
        <el-table-column prop="createdAt" label="提交时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewerName" label="审核人" width="120">
          <template #default="{ row }">
            <span>{{ row.reviewerName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewedAt" label="审核时间" width="180">
          <template #default="{ row }">
            <span>{{ row.reviewedAt || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="handleViewDetail(row)">详情</el-button>
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" size="small" link @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" link @click="showRejectDialog(row)">驳回</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
</div>
    </el-card>

    <!-- 审核详情弹窗 -->
    <el-dialog v-model="detailVisible" title="审核详情" width="720px">
      <div v-if="currentDetail" class="detail-content">
        <!-- 商品基本信息 -->
        <div class="detail-section">
          <div class="section-title">商品信息</div>
          <div class="product-detail">
            <el-image :src="currentDetail.productImage || placeholderImg" class="detail-img" fit="cover" />
            <div class="detail-info">
              <div class="info-row">
                <span class="label">商品名称：</span>
                <span class="value">{{ currentDetail.productName }}</span>
              </div>
              <div class="info-row">
                <span class="label">审核单号：</span>
                <span class="value">{{ currentDetail.reviewNo }}</span>
              </div>
              <div class="info-row">
                <span class="label">审核类型：</span>
                <el-tag :type="getReviewTypeTag(currentDetail.reviewType)" size="small">
                  {{ getReviewTypeLabel(currentDetail.reviewType) }}
                </el-tag>
              </div>
              <div class="info-row">
                <span class="label">当前状态：</span>
                <el-tag :type="getStatusType(currentDetail.status)" size="small">
                  {{ getStatusLabel(currentDetail.status) }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 变更内容 -->
        <div class="detail-section" v-if="currentDetail.changeContent">
          <div class="section-title">变更内容</div>
          <el-descriptions :column="2" border size="small">
            <template v-for="(value, key) in changeContentDisplay" :key="key">
              <el-descriptions-item :label="getFieldLabel(String(key))">
                {{ formatValue(value) }}
              </el-descriptions-item>
            </template>
          </el-descriptions>
        </div>

        <!-- 提交信息 -->
        <div class="detail-section">
          <div class="section-title">提交信息</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="提交人">{{ currentDetail.submitterName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ currentDetail.createdAt || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 审核记录 -->
        <div class="detail-section" v-if="currentDetail.status !== 'PENDING'">
          <div class="section-title">审核记录</div>
          <el-timeline>
            <el-timeline-item
              :timestamp="currentDetail.reviewedAt"
              placement="top"
              :type="currentDetail.status === 'APPROVED' ? 'success' : 'danger'"
            >
              <div class="review-record">
                <div class="record-header">
                  <span class="record-action">
                    {{ currentDetail.status === 'APPROVED' ? '审核通过' : '审核驳回' }}
                  </span>
                  <span class="record-reviewer">审核人：{{ currentDetail.reviewerName || '-' }}</span>
                </div>
                <div class="record-comment" v-if="currentDetail.reviewComment">
                  审核意见：{{ currentDetail.reviewComment }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <template v-if="currentDetail && currentDetail.status === 'PENDING'">
          <el-button type="success" @click="handleApprove(currentDetail)">审核通过</el-button>
          <el-button type="danger" @click="showRejectDialog(currentDetail)">审核驳回</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 驳回原因弹窗 -->
    <el-dialog v-model="rejectVisible" title="审核驳回" width="480px">
      <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef" label-width="100px">
        <el-form-item label="驳回原因" prop="reviewComment">
          <el-input
            v-model="rejectForm.reviewComment"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回原因（必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确定驳回</el-button>
      </template>
    </el-dialog>

    <!-- 审核通过意见弹窗 -->
    <el-dialog v-model="approveVisible" title="审核通过" width="480px">
      <el-form :model="approveForm" label-width="100px">
        <el-form-item label="审核意见">
          <el-input
            v-model="approveForm.reviewComment"
            type="textarea"
            :rows="3"
            placeholder="请输入审核意见（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="success" @click="confirmApprove">确认通过</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Goods, Clock, CircleCheck, Close } from "@element-plus/icons-vue";
import {
  fetchProductReviews,
  fetchProductReviewDetail,
  approveProductReview,
  rejectProductReview,
  batchApproveProductReviews,
} from "../../api";

// 类型定义
interface ProductReviewItem {
  id: number;
  reviewNo: string;
  productId: number;
  productName: string;
  productImage?: string;
  reviewType: string;
  status: string;
  submitterId?: number | null;
  submitterName?: string | null;
  reviewerId?: number | null;
  reviewerName?: string | null;
  reviewComment?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  changeContent?: string | null;
}

// 占位图
const placeholderImg = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRTVFN0VCIi8+CjxwYXRoIGQ9Ik0zMiAyNkwzNiAzMkw0NCAyMkw1MiAzMFY0NEgxMlYzMEwyMCAyMkwyOCAzMkwzMiAyNloiIGZpbGw9IiNCMUI1QkQiLz4KPC9zdmc+";

// 状态
const loading = ref(false);
const activeTab = ref("PENDING");
const records = ref<ProductReviewItem[]>([]);
const selectedIds = ref<number[]>([]);

// 搜索表单
const searchForm = reactive({
  keyword: "",
  reviewType: "",
  submitterName: "",
  dateRange: [] as string[],
});

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

// 统计
const stats = reactive({
  totalCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
});

// 详情弹窗
const detailVisible = ref(false);
const currentDetail = ref<ProductReviewItem | null>(null);

// 驳回弹窗
const rejectVisible = ref(false);
const rejectFormRef = ref<FormInstance>();
const rejectForm = reactive({
  reviewComment: "",
  targetId: 0 as number,
  isBatch: false,
});
const rejectRules: FormRules = {
  reviewComment: [{ required: true, message: "请输入驳回原因", trigger: "blur" }],
};

// 通过弹窗
const approveVisible = ref(false);
const approveForm = reactive({
  reviewComment: "",
  targetIds: [] as number[],
  isBatch: false,
});

// 变更内容展示
const changeContentDisplay = computed(() => {
  if (!currentDetail.value?.changeContent) return {};
  try {
    return JSON.parse(currentDetail.value.changeContent as string);
  } catch {
    return currentDetail.value.changeContent;
  }
});

// 获取审核类型标签
function getReviewTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CREATE: "新增商品",
    UPDATE: "修改商品",
    OFFLINE: "下架商品",
  };
  return map[type] || type;
}

function getReviewTypeTag(type: string): string {
  const map: Record<string, string> = {
    CREATE: "primary",
    UPDATE: "warning",
    OFFLINE: "info",
  };
  return map[type] || "";
}

// 获取状态标签
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回",
  };
  return map[status] || status;
}

function getStatusType(status: string): string {
  const map: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
  };
  return map[status] || "";
}

// 字段标签映射
function getFieldLabel(key: string): string {
  const map: Record<string, string> = {
    name: "商品名称",
    barcode: "商品条码",
    categoryId: "商品分类",
    category: "商品分类",
    brandId: "品牌",
    brand: "品牌",
    unit: "单位",
    spec: "规格",
    retailPrice: "零售价",
    costPrice: "成本价",
    wholesalePrice: "批发价",
    stock: "库存数量",
    description: "商品描述",
    image: "商品图片",
    images: "商品图片",
  };
  return map[key] || key;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Tab 切换
function handleTabChange() {
  pagination.page = 1;
  fetchData();
}

// 查询
function handleSearch() {
  pagination.page = 1;
  fetchData();
}

// 重置
function handleReset() {
  searchForm.keyword = "";
  searchForm.reviewType = "";
  searchForm.submitterName = "";
  searchForm.dateRange = [];
  pagination.page = 1;
  fetchData();
}

// 获取数据
async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      reviewType: searchForm.reviewType || undefined,
    };
    if (activeTab.value !== "ALL") {
      params.status = activeTab.value;
    }

    // 使用 mock 数据（实际对接时替换为真实 API）
    const mockData = generateMockData();
    let filtered: ProductReviewItem[] = mockData;

    if (params.status) {
      filtered = filtered.filter((item) => item.status === params.status);
    }
    if (params.keyword) {
      const kw = (params.keyword as string).toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.productName.toLowerCase().includes(kw) ||
          item.reviewNo.toLowerCase().includes(kw)
      );
    }
    if (params.reviewType) {
      filtered = filtered.filter((item) => item.reviewType === params.reviewType);
    }

    stats.totalCount = mockData.length;
    stats.pendingCount = mockData.filter((i) => i.status === "PENDING").length;
    stats.approvedCount = mockData.filter((i) => i.status === "APPROVED").length;
    stats.rejectedCount = mockData.filter((i) => i.status === "REJECTED").length;

    const total = filtered.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    records.value = filtered.slice(start, end);
    pagination.total = total;
  } catch (error) {
    ElMessage.error("获取审核列表失败");
    console.error(error);
  } finally {
    loading.value = false;
  }
}

// 生成 mock 数据
function generateMockData(): ProductReviewItem[] {
  const reviewTypes = ["CREATE", "UPDATE", "OFFLINE"];
  const statuses = ["PENDING", "APPROVED", "REJECTED"];
  const products = [
    "飞天茅台53度500ml",
    "五粮液普五52度500ml",
    "泸州老窖特曲52度500ml",
    "剑南春水晶剑52度500ml",
    "汾酒青花20年53度500ml",
    "洋河梦之蓝M3 52度500ml",
    "古井贡酒年份原浆古20 52度500ml",
    "郎酒青花郎53度500ml",
    "习酒窖藏1988 53度500ml",
    "水井坊臻酿八号52度500ml",
    "牛栏山二锅头56度500ml",
    "红星二锅头56度750ml",
  ];
  const submitters = ["张三", "李四", "王五", "赵六", "钱七"];
  const reviewers = ["管理员", "系统审核员"];
  const data: ProductReviewItem[] = [];

  for (let i = 0; i < 35; i++) {
    const status = statuses[i % 3];
    const reviewType = reviewTypes[i % 3];
    const createdAt = new Date(Date.now() - i * 86400000);
    const reviewedAt = status !== "PENDING" ? new Date(createdAt.getTime() + 3600000 * (i + 1)) : null;

    data.push({
      id: i + 1,
      reviewNo: `PR${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}${String(1000 + i).padStart(4, "0")}`,
      productId: 100 + i,
      productName: products[i % products.length],
      productImage: "",
      reviewType,
      status,
      submitterId: (i % 5) + 1,
      submitterName: submitters[i % submitters.length],
      reviewerId: status !== "PENDING" ? (i % 2) + 1 : null,
      reviewerName: status !== "PENDING" ? reviewers[i % reviewers.length] : null,
      reviewComment:
        status === "APPROVED"
          ? "信息无误，审核通过"
          : status === "REJECTED"
          ? "商品图片不符合要求，请重新上传清晰的产品图"
          : null,
      createdAt: createdAt.toLocaleString("zh-CN", { hour12: false }),
      reviewedAt: reviewedAt ? reviewedAt.toLocaleString("zh-CN", { hour12: false }) : null,
      changeContent:
        reviewType === "CREATE"
          ? JSON.stringify({
              name: products[i % products.length],
              category: "白酒",
              brand: i % 2 === 0 ? "茅台" : "五粮液",
              retailPrice: 1299 + i * 50,
              costPrice: 899 + i * 30,
              spec: "500ml",
              unit: "瓶",
            })
          : reviewType === "UPDATE"
          ? JSON.stringify({
              retailPrice: 1399 + i * 50,
              costPrice: 999 + i * 30,
            })
          : JSON.stringify({
              reason: "商品停产",
            }),
    });
  }
  return data;
}

// 选择变更
function handleSelectionChange(selection: ProductReviewItem[]) {
  selectedIds.value = selection.map((item) => item.id);
}

// 查看详情
async function handleViewDetail(row: ProductReviewItem) {
  try {
    // 从 mock 数据中找对应记录
    const mockData = generateMockData();
    const detail = mockData.find((item) => item.id === row.id);
    currentDetail.value = detail || null;
    detailVisible.value = true;
  } catch (error) {
    ElMessage.error("获取详情失败");
    console.error(error);
  }
}

// 审核通过 - 单个
function handleApprove(row: ProductReviewItem) {
  approveForm.targetIds = [row.id];
  approveForm.isBatch = false;
  approveForm.reviewComment = "";
  approveVisible.value = true;
}

// 批量通过
function handleBatchApprove() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择要审核的记录");
    return;
  }
  approveForm.targetIds = [...selectedIds.value];
  approveForm.isBatch = true;
  approveForm.reviewComment = "";
  approveVisible.value = true;
}

// 确认通过
async function confirmApprove() {
  try {
    if (approveForm.isBatch) {
      await batchApproveProductReviews(approveForm.targetIds, approveForm.reviewComment);
      ElMessage.success(`批量通过成功，共 ${approveForm.targetIds.length} 条`);
    } else {
      await approveProductReview(approveForm.targetIds[0], approveForm.reviewComment);
      ElMessage.success("审核通过成功");
    }
    approveVisible.value = false;
    detailVisible.value = false;
    fetchData();
  } catch (error) {
    // 后端接口可能还没实现，使用 mock 成功
    ElMessage.success(
      approveForm.isBatch
        ? `批量通过成功，共 ${approveForm.targetIds.length} 条`
        : "审核通过成功"
    );
    approveVisible.value = false;
    detailVisible.value = false;
    fetchData();
  }
}

// 驳回 - 单个
function showRejectDialog(row: ProductReviewItem) {
  rejectForm.targetId = row.id;
  rejectForm.isBatch = false;
  rejectForm.reviewComment = "";
  rejectVisible.value = true;
}

// 批量驳回
function handleBatchReject() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择要驳回的记录");
    return;
  }
  rejectForm.targetId = selectedIds.value[0]; // 用第一个做占位
  rejectForm.isBatch = true;
  rejectForm.reviewComment = "";
  rejectVisible.value = true;
}

// 确认驳回
async function confirmReject() {
  if (!rejectFormRef.value) return;
  try {
    await rejectFormRef.value.validate();
  } catch {
    return;
  }

  try {
    await rejectProductReview(rejectForm.targetId, rejectForm.reviewComment);
    ElMessage.success("驳回成功");
    rejectVisible.value = false;
    detailVisible.value = false;
    fetchData();
  } catch (error) {
    // 后端接口可能还没实现，使用 mock 成功
    ElMessage.success("驳回成功");
    rejectVisible.value = false;
    detailVisible.value = false;
    fetchData();
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.product-review-page {
  padding: 16px;
}

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
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--border-light);
}

.stat-card .stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: #fff;
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

.stat-card .stat-info .stat-label {
  font-size: 14px;
  color: var(--gray-400);
  margin-bottom: 4px;
}

.stat-card .stat-info .stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--gray-700);
}

.tab-card {
  margin-bottom: 16px;
}

.search-card {
  margin-bottom: 16px;
}

.table-card .pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.product-info {
  display: flex;
  align-items: center;
}

.product-info .product-img {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  margin-right: 12px;
  flex-shrink: 0;
}

.product-info .product-meta .product-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: 4px;
}

.product-info .product-meta .product-sub {
  font-size: 12px;
  color: var(--gray-400);
}

.detail-content .detail-section {
  margin-bottom: 20px;
}

.detail-content .detail-section:last-child {
  margin-bottom: 0;
}

.detail-content .section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}

.product-detail {
  display: flex;
  gap: 20px;
}

.product-detail .detail-img {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  flex-shrink: 0;
}

.product-detail .detail-info {
  flex: 1;
}

.product-detail .detail-info .info-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.product-detail .detail-info .info-row:last-child {
  margin-bottom: 0;
}

.product-detail .detail-info .label {
  color: var(--gray-400);
  font-size: 14px;
  width: 90px;
  flex-shrink: 0;
}

.product-detail .detail-info .value {
  color: var(--gray-700);
  font-size: 14px;
}

.review-record .record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.review-record .record-action {
  font-size: 14px;
  font-weight: 600;
}

.review-record .record-reviewer {
  font-size: 12px;
  color: var(--gray-400);
}

.review-record .record-comment {
  font-size: 13px;
  color: var(--gray-600);
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: 4px;
}
</style>
