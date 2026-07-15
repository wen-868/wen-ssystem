<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台评价管理</h2>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6" v-for="stat in stats" :key="stat.key">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">{{ stat.label }}</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: var(--brand-primary);">
                {{ stat.value }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;" :style="{ background: stat.bg }">
              <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索评价内容/用户"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="待回复" value="PENDING" />
          <el-option label="已回复" value="REPLIED" />
          <el-option label="已隐藏" value="HIDDEN" />
        </el-select>
        <el-select
          v-model="searchForm.rating"
          placeholder="评分"
          clearable
          style="width: 120px;"
          @change="handleSearch"
        >
          <el-option label="5星" :value="5" />
          <el-option label="4星" :value="4" />
          <el-option label="3星" :value="3" />
          <el-option label="2星" :value="2" />
          <el-option label="1星" :value="1" />
        </el-select>
        <el-date-picker
          v-model="searchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px;"
          @change="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="tenantName" label="租户" width="140" show-overflow-tooltip />
        <el-table-column prop="userName" label="评价人" width="100" />
        <el-table-column label="评分" width="140">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled show-score text-color="#ff9900" score-template="{value}分" />
          </template>
        </el-table-column>
        <el-table-column prop="content" label="评价内容" min-width="240" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评价时间" width="180">
          <template #default="{ row }">{{ row.createdAt || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleReply(row)">回复</el-button>
            <el-button link type="warning" size="small" @click="handleToggleHide(row)">
              {{ row.status === 'HIDDEN' ? '显示' : '隐藏' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="replyVisible" title="回复评价" width="560px" :close-on-click-modal="false">
      <div v-if="currentReview" style="margin-bottom: 20px;">
        <div style="color: #909399; font-size: 13px; margin-bottom: 8px;">
          {{ currentReview.userName }} 评价道：
        </div>
        <div style="padding: 12px; background: #f5f7fa; border-radius: 4px; line-height: 1.6;">
          {{ currentReview.content }}
        </div>
      </div>
      <el-form :model="replyForm" label-width="80px">
        <el-form-item label="回复内容">
          <el-input
            v-model="replyForm.reply"
            type="textarea"
            :rows="5"
            placeholder="请输入回复内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReply">提交回复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { getPlatformReviews, getPlatformReviewStats, replyPlatformReview } from "../api";

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchForm = reactive({
  keyword: "",
  status: "",
  rating: null as number | null,
  dateRange: [] as string[]
});

const stats = ref([
  { key: "total", label: "总评价数", value: 0, icon: "ChatDotSquare", color: "#2563eb", bg: "#eff6ff" },
  { key: "avgRating", label: "平均评分", value: "0.0", icon: "Star", color: "#f59e0b", bg: "#fffbeb" },
  { key: "pending", label: "待回复", value: 0, icon: "Clock", color: "#ef4444", bg: "#fef2f2" },
  { key: "replied", label: "已回复", value: 0, icon: "CircleCheck", color: "#10b981", bg: "#ecfdf5" }
]);

const replyVisible = ref(false);
const currentReview = ref<any>(null);
const saving = ref(false);
const replyForm = reactive({
  reply: ""
});

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待回复",
    REPLIED: "已回复",
    HIDDEN: "已隐藏"
  };
  return map[status] || status || "-";
}

function statusTag(status: string): string {
  const map: Record<string, string> = {
    PENDING: "warning",
    REPLIED: "success",
    HIDDEN: "info"
  };
  return map[status] || "";
}

async function fetchStats() {
  try {
    const res = await getPlatformReviewStats();
    const data = res.data?.data || (res as any).data || res;
    if (data) {
      stats.value[0].value = data.totalCount || 0;
      stats.value[1].value = data.avgRating ? data.avgRating.toFixed(1) : "0.0";
      stats.value[2].value = data.pendingCount || 0;
      stats.value[3].value = data.repliedCount || 0;
    }
  } catch {
    // ignore
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getPlatformReviews({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      rating: searchForm.rating || undefined
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.rating = null;
  searchForm.dateRange = [];
  page.value = 1;
  fetchList();
}

function handleReply(row: any) {
  currentReview.value = row;
  replyForm.reply = row.replyContent || "";
  replyVisible.value = true;
}

async function submitReply() {
  if (!replyForm.reply.trim()) {
    ElMessage.warning("请输入回复内容");
    return;
  }
  saving.value = true;
  try {
    await replyPlatformReview(currentReview.value.id, replyForm.reply);
    ElMessage.success("回复成功");
    replyVisible.value = false;
    fetchList();
    fetchStats();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "回复失败");
  } finally {
    saving.value = false;
  }
}

function handleToggleHide(row: any) {
  ElMessage.info("隐藏/显示功能待后端API支持");
}

onMounted(() => {
  fetchStats();
  fetchList();
});
</script>
