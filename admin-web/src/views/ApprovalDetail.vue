<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审批详情</span>
          <div class="header-actions">
            <el-button @click="goBack">返回列表</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <template v-if="detail">
          <el-descriptions :column="2" border style="margin-bottom: 24px">
            <el-descriptions-item label="审批标题">{{ detail.title }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag v-if="detail.status === 'PENDING'" type="warning">审批中</el-tag>
              <el-tag v-else-if="detail.status === 'APPROVED'" type="success">已通过</el-tag>
              <el-tag v-else-if="detail.status === 'REJECTED'" type="danger">已拒绝</el-tag>
              <el-tag v-else>{{ detail.status }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="申请人">{{ detail.applicant }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="审批内容" :span="2">{{ detail.content }}</el-descriptions-item>
          </el-descriptions>

          <h3 style="margin-bottom: 16px; font-size: 16px; font-weight: 600">审批历史</h3>
          <el-timeline v-if="detail.steps && detail.steps.length">
            <el-timeline-item
              v-for="(step, index) in detail.steps"
              :key="index"
              :timestamp="formatDate(step.createdAt)"
              placement="top"
              :color="step.status === 'APPROVED' ? '#67c23a' : step.status === 'REJECTED' ? '#f56c6c' : '#409eff'"
            >
              <el-card shadow="never">
                <div class="step-header">
                  <span class="step-approver">{{ step.approver }}</span>
                  <el-tag v-if="step.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
                  <el-tag v-else-if="step.status === 'REJECTED'" type="danger" size="small">已拒绝</el-tag>
                  <el-tag v-else-if="step.status === 'PENDING'" type="warning" size="small">待审批</el-tag>
                  <el-tag v-else size="small">{{ step.status }}</el-tag>
                </div>
                <div v-if="step.comment" class="step-comment">审批意见：{{ step.comment }}</div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无审批记录" :image-size="80" />
        </template>
        <el-empty v-else-if="!loading" description="暂无数据" :image-size="80" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { fetchApprovalInstanceDetail } from "../api";
import { formatDate } from "../utils/format";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detail = ref<any>(null);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadDetail() {
  const instanceNo = route.params.instanceNo as string;
  if (!instanceNo) return;
  loading.value = true;
  try {
    detail.value = await fetchApprovalInstanceDetail(instanceNo);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载审批详情失败"));
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push("/approval");
}

onMounted(() => {
  loadDetail();
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
  align-items: center;
}
.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-approver {
  font-weight: 600;
}
.step-comment {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>