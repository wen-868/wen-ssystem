<template>
  <div class="platform-review-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="item in stats" :key="item.platformName">
        <el-card class="stat-card">
          <div class="stat-value">{{ item.cnt }}</div>
          <div class="stat-label">{{ item.platformName }}</div>
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
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="records" border v-loading="loading">
        <el-table-column prop="platformName" label="平台名称" width="150" />
        <el-table-column prop="platformNo" label="平台编号" width="150" />
        <el-table-column prop="reviewType" label="审核类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getReviewTypeTag(row.reviewType)">
              {{ getReviewTypeLabel(row.reviewType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewResult" label="审核结果" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reviewAt" label="审核时间" width="180" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="showReplyDialog(row)">回复</el-button>
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
    <el-dialog title="回复审核" v-model="dialogVisible" width="500px">
      <el-form ref="replyFormRef" :model="replyForm" :rules="replyRules" label-width="80px">
        <el-form-item label="平台名称">
          <span>{{ replyForm.platformName }}</span>
        </el-form-item>
        <el-form-item label="审核类型">
          <el-tag :type="getReviewTypeTag(replyForm.reviewType)">
            {{ getReviewTypeLabel(replyForm.reviewType) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="回复内容" prop="replyContent">
          <el-input v-model="replyForm.replyContent" type="textarea" :rows="4" placeholder="请输入回复内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReply" :loading="replying">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import { fetchPlatformReviews, replyPlatformReview, fetchPlatformReviewStats } from "@/api";

const records = ref<any[]>([]);
const stats = ref<{ platformName: string; cnt: number }[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const replying = ref(false);
const dialogVisible = ref(false);
const replyId = ref<number | null>(null);

const searchForm = reactive({
  platformName: "",
  reviewType: undefined as number | undefined,
  status: undefined as number | undefined,
});

const replyForm = reactive({
  platformName: "",
  reviewType: 0,
  replyContent: "",
});

const replyFormRef = ref();
const replyRules: FormRules = {
  replyContent: [{ required: true, message: "请输入回复内容", trigger: "blur" }],
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
    stats.value = res.stats || [];
  } catch { /* ignore */ }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await fetchPlatformReviews({
      page: currentPage.value,
      pageSize: pageSize.value,
      platformName: searchForm.platformName || undefined,
      reviewType: searchForm.reviewType,
      status: searchForm.status,
    });
    records.value = res.records || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error("获取审核列表失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.platformName = "";
  searchForm.reviewType = undefined;
  searchForm.status = undefined;
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const showReplyDialog = (row: any) => {
  replyId.value = row.id;
  replyForm.platformName = row.platformName;
  replyForm.reviewType = row.reviewType;
  replyForm.replyContent = "";
  dialogVisible.value = true;
};

const handleReply = async () => {
  const valid = await replyFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  replying.value = true;
  try {
    await replyPlatformReview(replyId.value!, replyForm.replyContent);
    ElMessage.success("回复成功");
    dialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    ElMessage.error("回复失败");
  } finally {
    replying.value = false;
  }
};

onMounted(() => {
  fetchStats();
  fetchData();
});
</script>

<style scoped>
.platform-review-page {
  padding: 20px;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-card {
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
}
.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
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