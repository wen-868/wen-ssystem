<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台评价管理</h2>

    <!-- 统计卡：只消费后端契约 { stats: [{ platform, cnt }] }（按平台分组），总量/平均分无契约 ⇒ 显式空态 -->
    <el-row :gutter="20" style="margin-bottom: 4px;">
      <el-col :span="6" v-for="stat in platformStats" :key="stat.platform">
        <el-card shadow="hover" style="margin-bottom: 12px;">
          <div style="font-size: 13px; color: var(--text-secondary);">{{ textOr(stat.platform, "未知平台") }}</div>
          <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: var(--color-primary);">
            {{ stat.cnt }}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">评价条数</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-bottom: 16px;">
      <el-empty v-if="!platformStats.length" description="暂无平台评价统计" :image-size="60" />
      <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.8;">
        统计口径：按平台分组的评价条数（接口返回 { stats: [{ platform, cnt }] }）。
        总量 / 平均评分：后端暂无对应统计能力，本页暂不展示，也不使用近似值或前端自算冒充。
      </div>
    </el-card>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
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
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="平台" width="120">
          <template #default="{ row }">{{ textOr(row.platform, "未知平台") }}</template>
        </el-table-column>
        <el-table-column label="平台评价ID" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ textOr(row.platformReviewId, "暂无") }}</template>
        </el-table-column>
        <el-table-column label="关联订单号" width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ textOr(row.orderNo, "暂无") }}</template>
        </el-table-column>
        <el-table-column label="评分" width="140">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled show-score text-color="#ff9900" score-template="{value}分" />
          </template>
        </el-table-column>
        <el-table-column label="评价内容" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ textOr(row.content, "无内容") }}</template>
        </el-table-column>
        <el-table-column label="回复内容" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ textOr(row.replyContent, "未回复") }}</template>
        </el-table-column>
        <el-table-column label="回复状态" width="100">
          <template #default="{ row }">
            <el-tag :type="replyState(row).type" size="small">{{ replyState(row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="回复时间" width="180">
          <template #default="{ row }">{{ textOr(row.repliedAt, "未回复") }}</template>
        </el-table-column>
        <el-table-column label="同步时间" width="180">
          <template #default="{ row }">{{ textOr(row.syncedAt, "未同步") }}</template>
        </el-table-column>
        <el-table-column label="评价时间" width="180">
          <template #default="{ row }">{{ textOr(row.createdAt, "暂无") }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleReply(row)">回复</el-button>
            <el-button link type="warning" size="small" @click="handleToggleHide()">隐藏</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无平台评价数据" :image-size="60" />
        </template>
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
          {{ textOr(currentReview.platform, "未知平台") }} · 订单号 {{ textOr(currentReview.orderNo, "暂无") }}
        </div>
        <div style="padding: 12px; background: #f5f7fa; border-radius: 4px; line-height: 1.6;">
          {{ textOr(currentReview.content, "无内容") }}
        </div>
      </div>
      <el-form :model="replyForm" label-width="80px">
        <el-form-item label="回复内容">
          <el-input
            v-model="replyForm.replyContent"
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
  rating: null as number | null
});

/** 统计：后端契约 { stats: [{ platform, cnt }] }（空表为 []） */
const platformStats = ref<Array<{ platform: string; cnt: number }>>([]);

const replyVisible = ref(false);
const currentReview = ref<any>(null);
const saving = ref(false);
const replyForm = reactive({
  replyContent: ""
});

/** 字段为空时的明确文案（不用 "—" 等占位符充数） */
function textOr(value: any, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

/** 回复状态：真实表无状态列，只能由 replyContent / repliedAt 两个真实载体派生 */
function replyState(row: any): { label: string; type: "success" | "warning" } {
  const replied = Boolean(row?.repliedAt || row?.replyContent);
  return replied ? { label: "已回复", type: "success" } : { label: "未回复", type: "warning" };
}

async function fetchStats() {
  try {
    const res = await getPlatformReviewStats();
    const data = res.data?.data || (res as any).data || res;
    platformStats.value = Array.isArray(data?.stats) ? data.stats : [];
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "统计加载失败");
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getPlatformReviews({
      page: page.value,
      pageSize: pageSize.value,
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
  searchForm.rating = null;
  page.value = 1;
  fetchList();
}

function handleReply(row: any) {
  currentReview.value = row;
  replyForm.replyContent = row.replyContent || "";
  replyVisible.value = true;
}

async function submitReply() {
  if (!replyForm.replyContent.trim()) {
    ElMessage.warning("请输入回复内容");
    return;
  }
  saving.value = true;
  try {
    await replyPlatformReview(currentReview.value.id, replyForm.replyContent);
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

/** 隐藏/显示评价：真实表无隐藏字段、后端无该接口（S3-114 已定 501）⇒ 只给明确提示，不做假成功 */
function handleToggleHide() {
  ElMessage.info("后端暂无该能力：平台评价没有隐藏/显示字段与接口，本页不做假成功");
}

onMounted(() => {
  fetchStats();
  fetchList();
});
</script>
