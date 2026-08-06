<template>
  <div class="page">
    <PageCard title="审批详情">
      <template #extra>
        <el-button @click="router.back()">返回</el-button>
      </template>

      <el-descriptions :column="2" border style="margin-bottom: 20px">
        <el-descriptions-item label="审批编号">{{ detail.approvalNo }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">
          <el-tag :type="businessTypeTagType(detail.businessType)">{{ businessTypeLabel(detail.businessType) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicant }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-card shadow="never" style="margin-bottom: 20px">
        <template #header><span class="card-title">审批内容</span></template>
        <pre class="content-json">{{ formatJson(detail.approvalContent) }}</pre>
      </el-card>

      <el-card shadow="never" style="margin-bottom: 20px">
        <template #header><span class="card-title">审批时间线</span></template>
        <el-timeline v-if="detail.approvalNodes && detail.approvalNodes.length">
          <el-timeline-item
            v-for="(node, index) in detail.approvalNodes"
            :key="index"
            :timestamp="formatDate(node.approvalTime)"
            :color="timelineColor(node.result)"
            placement="top"
          >
            <div class="timeline-node">
              <div class="node-header">
                <span class="node-approver">{{ node.approver }}</span>
                <el-tag :type="nodeResultTagType(node.result)" size="small">{{ nodeResultLabel(node.result) }}</el-tag>
              </div>
              <div v-if="node.opinion" class="node-opinion">{{ node.opinion }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无审批记录" :image-size="60" />
      </el-card>

      <div class="action-bar">
        <template v-if="isCurrentApprover && detail.status === 'PENDING'">
          <el-button type="success" @click="handleApprove">通过</el-button>
          <el-button type="danger" @click="handleReject">拒绝</el-button>
        </template>
        <template v-if="isApplicant && detail.status === 'PENDING'">
          <el-button type="warning" @click="handleCancel">撤销</el-button>
        </template>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchApprovalDetail, approveApproval, rejectApproval, cancelApproval } from "../../api";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";

const route = useRoute();
const router = useRouter();

const businessTypeOptions = [
  { value: "PURCHASE", label: "采购审批" },
  { value: "SALE", label: "销售审批" },
  { value: "REFUND", label: "退款审批" },
  { value: "PRICE_CHANGE", label: "价格变更" },
  { value: "CREDIT_LIMIT", label: "信用额度" }
];

function businessTypeLabel(v: string) {
  return businessTypeOptions.find(t => t.value === v)?.label || v;
}

function businessTypeTagType(v: string) {
  const map: Record<string, string> = {
    PURCHASE: "", SALE: "success", REFUND: "warning", PRICE_CHANGE: "", CREDIT_LIMIT: ""
  };
  return map[v] || "";
}

function statusLabel(v: string) {
  const map: Record<string, string> = {
    PENDING: "审批中", APPROVED: "已通过", REJECTED: "已拒绝", CANCELLED: "已撤销"
  };
  return map[v] || v;
}

function statusTagType(v: string) {
  const map: Record<string, string> = {
    PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "info"
  };
  return map[v] || "";
}

function timelineColor(result: string) {
  const map: Record<string, string> = {
    APPROVED: CHART_COLORS.success, REJECTED: CHART_COLORS.danger, PENDING: CHART_COLORS.warning, CANCELLED: CHART_COLORS.textMuted
  };
  return map[result] || CHART_COLORS.textMuted;
}

function nodeResultLabel(result: string) {
  const map: Record<string, string> = {
    APPROVED: "通过", REJECTED: "拒绝", PENDING: "待审批", CANCELLED: "已撤销"
  };
  return map[result] || result;
}

function nodeResultTagType(result: string) {
  const map: Record<string, string> = {
    APPROVED: "success", REJECTED: "danger", PENDING: "warning", CANCELLED: "info"
  };
  return map[result] || "info";
}

function formatJson(content: any) {
  if (!content) return "-";
  if (typeof content === "string") {
    try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
  }
  return JSON.stringify(content, null, 2);
}

const detail = ref<any>({});
const isCurrentApprover = ref(false);
const isApplicant = ref(false);

async function loadDetail() {
  const id = Number(route.params.id);
  if (!id) { ElMessage.error("缺少审批ID"); router.back(); return; }
  try {
    const data = await fetchApprovalDetail(id);
    detail.value = data;
    isCurrentApprover.value = data.isCurrentApprover || false;
    isApplicant.value = data.isApplicant || false;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载详情失败");
    router.back();
  }
}

async function handleApprove() {
  try {
    const { value: opinion } = await ElMessageBox.prompt("请输入审批意见", "审批通过", {
      confirmButtonText: "确认通过",
      type: "success"
    });
    await approveApproval(detail.value.id, { opinion: opinion || "" });
    ElMessage.success("审批通过");
    loadDetail();
  } catch { /* 取消操作 */ }
}

async function handleReject() {
  try {
    const { value: opinion } = await ElMessageBox.prompt("请输入拒绝原因", "审批拒绝", {
      confirmButtonText: "确认拒绝",
      type: "error"
    });
    await rejectApproval(detail.value.id, { opinion: opinion || "" });
    ElMessage.success("已拒绝");
    loadDetail();
  } catch { /* 取消操作 */ }
}

async function handleCancel() {
  try { await ElMessageBox.confirm("确定撤销该审批吗？", "确认撤销", { type: "warning" }); } catch { return; }
  try {
    await cancelApproval(detail.value.id);
    ElMessage.success("已撤销");
    loadDetail();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "撤销失败"); }
}

onMounted(() => { loadDetail(); });
</script>

<style scoped>
.page { padding: 0; }
.card-title {
  font-weight: 600;
  font-size: 15px;
}
.content-json {
  background: var(--bg-page);
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.timeline-node {
  padding-bottom: 4px;
}
.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.node-approver {
  font-weight: 500;
}
.node-opinion {
  margin-top: 6px;
  color: var(--gray-600);
  font-size: 13px;
}
.action-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>