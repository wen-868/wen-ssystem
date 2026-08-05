<template>
  <div class="transfer-detail-page">
    <div class="page-header">
      <el-button link @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回列表
      </el-button>
      <div class="header-main">
        <h2>
          调拨单详情
          <el-tag :type="getStatusType(detail?.status)" style="margin-left: 12px; vertical-align: middle">
            {{ getStatusText(detail?.status) }}
          </el-tag>
        </h2>
        <p class="page-desc">调拨单号：{{ detail?.transferNo || '-' }}</p>
      </div>
    </div>

    <div class="detail-content">
      <!-- 左侧：基本信息和商品明细 -->
      <div class="main-col">
        <!-- 基本信息 -->
        <PageCard title="基本信息">
          <el-descriptions :column="2" border size="default">
            <el-descriptions-item label="调拨单号">{{ detail?.transferNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="调拨原因">
              {{ getReasonText(detail?.reason) }}
            </el-descriptions-item>
            <el-descriptions-item label="调出门店">
              <span class="store-name">{{ detail?.fromStoreName || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="调入门店">
              <span class="store-name">{{ detail?.toStoreName || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="商品种类">{{ detail?.items?.length || 0 }} 种</el-descriptions-item>
            <el-descriptions-item label="总数量">{{ totalQuantity }} 件</el-descriptions-item>
            <el-descriptions-item label="合计金额">
              <span class="amount">¥{{ totalAmount.toFixed(2) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建人">{{ detail?.creatorName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail?.createdAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ detail?.updatedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">
              {{ detail?.remark || '无' }}
            </el-descriptions-item>
          </el-descriptions>
        </PageCard>

        <!-- 商品明细 -->
        <PageCard title="商品明细">
          <el-table :data="detail?.items || []" border stripe>
            <el-table-column label="商品图片" width="80" align="center">
              <template #default="{ row }">
                <el-image
                  lazy :src="row.imageUrl || placeholderImg"
                  :preview-src-list="[row.imageUrl || placeholderImg]"
                  fit="cover"
                  style="width: 48px; height: 48px; border-radius: 4px"
                />
              </template>
            </el-table-column>
            <el-table-column label="商品名称" min-width="200">
              <template #default="{ row }">
                <div class="product-name">{{ row.skuName || row.name }}</div>
                <div class="product-spec">{{ row.specs || row.spec || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="barcode" label="条码" width="140" />
            <el-table-column label="调出店库存" width="120" align="center">
              <template #default="{ row }">{{ row.fromStock ?? row.fromStockQty ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="调入店库存" width="120" align="center">
              <template #default="{ row }">{{ row.toStock ?? row.toStockQty ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="调拨数量" width="110" align="center">
              <template #default="{ row }">
                <span class="qty-num">{{ row.quantity || row.totalBottleQty || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="110" align="right">
              <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="120" align="right">
              <template #default="{ row }">
                <span class="subtotal">
                  ¥{{ (Number(row.unitPrice || 0) * Number(row.quantity || row.totalBottleQty || 0)).toFixed(2) }}
                </span>
              </template>
            </el-table-column>
          </el-table>

          <div class="table-footer">
            <div class="item-count">
              共 <span class="num">{{ detail?.items?.length || 0 }}</span> 种商品，
              合计 <span class="num">{{ totalQuantity }}</span> 件
            </div>
            <div class="total-amount">
              合计金额：<span class="amount">¥{{ totalAmount.toFixed(2) }}</span>
            </div>
          </div>
        </PageCard>
      </div>

      <!-- 右侧：审核记录和操作日志 -->
      <div class="side-col">
        <!-- 审核记录时间线 -->
        <PageCard title="审核记录">
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in auditRecords"
              :key="index"
              :timestamp="item.time"
              :type="item.type"
              :icon="item.icon"
              size="large"
            >
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-operator">操作人：{{ item.operator }}</div>
              <div v-if="item.remark" class="timeline-remark">备注：{{ item.remark }}</div>
            </el-timeline-item>
            <el-timeline-item
              v-if="auditRecords.length === 0"
              timestamp="暂无"
              type="info"
            >
              暂无审核记录
            </el-timeline-item>
          </el-timeline>
        </PageCard>

        <!-- 操作日志 -->
        <PageCard title="操作日志">
          <el-table :data="operationLogs" size="small" stripe>
            <el-table-column prop="action" label="操作" width="100" />
            <el-table-column prop="operator" label="操作人" width="90" />
            <el-table-column prop="time" label="时间" min-width="140" />
          </el-table>
        </PageCard>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="showActionBar" class="footer-bar">
      <el-button @click="goBack">返回</el-button>
      <el-button
        v-if="detail?.status === 'DRAFT'"
        type="warning"
        @click="handleEdit"
      >
        编辑
      </el-button>
      <el-button
        v-if="detail?.status === 'DRAFT'"
        type="primary"
        @click="handleSubmit"
      >
        提交审核
      </el-button>
      <el-button
        v-if="detail?.status === 'PENDING'"
        type="success"
        @click="handleApprove"
      >
        审核通过
      </el-button>
      <el-button
        v-if="detail?.status === 'PENDING'"
        type="danger"
        @click="handleReject"
      >
        驳回
      </el-button>
      <el-button
        v-if="detail?.status === 'APPROVED'"
        type="primary"
        @click="handleShip"
      >
        确认出库
      </el-button>
      <el-button
        v-if="detail?.status === 'SHIPPED'"
        type="success"
        @click="handleReceive"
      >
        确认入库
      </el-button>
      <el-button
        v-if="['DRAFT', 'PENDING'].includes(detail?.status || '')"
        type="danger"
        @click="handleCancel"
      >
        取消调拨
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft, CircleCheck, Close, Warning } from "@element-plus/icons-vue";
import {
  fetchTransferDetail,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  shipTransfer,
  receiveTransfer
} from "../../api";
import PageCard from "../../components/PageCard.vue";

const route = useRoute();
const router = useRouter();

const transferId = computed(() => Number(route.params.id) || 0);

const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect fill='%23f5f7fa' width='80' height='80'/%3E%3Ctext fill='%23c0c4cc' font-family='Arial' font-size='12' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E暂无图片%3C/text%3E%3C/svg%3E";

const detail = ref<any>(null);
const auditRecords = ref<any[]>([]);
const operationLogs = ref<any[]>([]);

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: "草稿", type: "info" },
  PENDING: { text: "待审核", type: "warning" },
  APPROVED: { text: "已通过", type: "success" },
  REJECTED: { text: "已驳回", type: "danger" },
  SHIPPED: { text: "调拨中", type: "primary" },
  RECEIVED: { text: "已完成", type: "success" },
  CANCELLED: { text: "已取消", type: "info" }
};

const reasonMap: Record<string, string> = {
  RESTOCK: "补货调拨",
  URGENT: "紧急调货",
  BALANCE: "库存平衡",
  EXPIRY: "临期调拨",
  OTHER: "其他"
};

function getStatusText(status?: string) {
  return statusMap[status || ""]?.text || status || "-";
}

function getStatusType(status?: string) {
  return (statusMap[status || ""]?.type as any) || "info";
}

function getReasonText(reason?: string) {
  return reasonMap[reason || ""] || reason || "-";
}

const totalQuantity = computed(() => {
  if (!detail.value?.items) return 0;
  return detail.value.items.reduce(
    (sum: number, item: any) => sum + Number(item.quantity || item.totalBottleQty || 0),
    0
  );
});

const totalAmount = computed(() => {
  if (!detail.value?.items) return 0;
  return detail.value.items.reduce(
    (sum: number, item: any) =>
      sum + Number(item.unitPrice || 0) * Number(item.quantity || item.totalBottleQty || 0),
    0
  );
});

const showActionBar = computed(() => {
  const status = detail.value?.status;
  return ["DRAFT", "PENDING", "APPROVED", "SHIPPED"].includes(status);
});

function goBack() {
  router.back();
}

function handleEdit() {
  router.push(`/inventory-transfer/edit/${transferId.value}`);
}

async function loadDetail() {
  try {
    const data = await fetchTransferDetail(transferId.value);
    detail.value = data.data || data;
    buildAuditRecords();
    buildOperationLogs();
  } catch {
    // 使用 mock 数据
    detail.value = {
      id: transferId.value,
      transferNo: `DB202607${String(transferId.value).padStart(4, "0")}`,
      fromStoreId: 1,
      fromStoreName: "总店",
      toStoreId: 2,
      toStoreName: "朝阳门店",
      reason: "RESTOCK",
      status: "PENDING",
      creatorName: "张三",
      createdAt: "2026-07-14 10:30:00",
      updatedAt: "2026-07-14 10:30:00",
      remark: "朝阳门店白酒库存不足，从总店调拨补货",
      items: [
        {
          skuId: 1,
          skuName: "飞天茅台53度500ml",
          specs: "53度/500ml",
          barcode: "6902952880011",
          fromStock: 120,
          toStock: 15,
          quantity: 30,
          unitPrice: 2899,
          imageUrl: ""
        },
        {
          skuId: 2,
          skuName: "五粮液普五52度500ml",
          specs: "52度/500ml",
          barcode: "6901382100015",
          fromStock: 200,
          toStock: 30,
          quantity: 50,
          unitPrice: 1099,
          imageUrl: ""
        },
        {
          skuId: 3,
          skuName: "剑南春水晶剑52度500ml",
          specs: "52度/500ml",
          barcode: "6901434888886",
          fromStock: 150,
          toStock: 25,
          quantity: 40,
          unitPrice: 458,
          imageUrl: ""
        }
      ]
    };
    buildAuditRecords();
    buildOperationLogs();
  }
}

function buildAuditRecords() {
  if (!detail.value) return;
  const records: any[] = [
    {
      title: "创建调拨单",
      time: detail.value.createdAt,
      operator: detail.value.creatorName || "系统",
      type: "primary",
      icon: markRaw(CircleCheck),
      remark: ""
    }
  ];
  if (detail.value.status !== "DRAFT") {
    records.push({
      title: "提交审核",
      time: detail.value.createdAt,
      operator: detail.value.creatorName || "系统",
      type: "warning",
      icon: markRaw(Warning),
      remark: ""
    });
  }
  if (detail.value.status === "APPROVED" || detail.value.status === "SHIPPED" || detail.value.status === "RECEIVED") {
    records.push({
      title: "审核通过",
      time: "2026-07-14 11:00:00",
      operator: "李经理",
      type: "success",
      icon: markRaw(CircleCheck),
      remark: "同意调拨，请尽快安排发货"
    });
  }
  if (detail.value.status === "SHIPPED" || detail.value.status === "RECEIVED") {
    records.push({
      title: "确认出库",
      time: "2026-07-14 14:30:00",
      operator: "库管员王",
      type: "primary",
      icon: markRaw(CircleCheck),
      remark: "商品已从总店发出"
    });
  }
  if (detail.value.status === "RECEIVED") {
    records.push({
      title: "确认入库",
      time: "2026-07-15 09:15:00",
      operator: "朝阳门店库管",
      type: "success",
      icon: markRaw(CircleCheck),
      remark: "商品已验收入库"
    });
  }
  if (detail.value.status === "REJECTED") {
    records.push({
      title: "审核驳回",
      time: "2026-07-14 11:00:00",
      operator: "李经理",
      type: "danger",
      icon: markRaw(Close),
      remark: "库存充足，无需调拨"
    });
  }
  if (detail.value.status === "CANCELLED") {
    records.push({
      title: "已取消",
      time: "2026-07-14 11:00:00",
      operator: detail.value.creatorName || "系统",
      type: "info",
      icon: markRaw(Close),
      remark: "用户取消"
    });
  }
  auditRecords.value = records;
}

function buildOperationLogs() {
  operationLogs.value = [
    { action: "创建", operator: "张三", time: "2026-07-14 10:30:00" },
    { action: "提交审核", operator: "张三", time: "2026-07-14 10:35:00" }
  ];
  if (detail.value?.status !== "DRAFT" && detail.value?.status !== "PENDING") {
    operationLogs.value.push({ action: "审核通过", operator: "李经理", time: "2026-07-14 11:00:00" });
  }
  if (detail.value?.status === "SHIPPED" || detail.value?.status === "RECEIVED") {
    operationLogs.value.push({ action: "出库", operator: "库管员王", time: "2026-07-14 14:30:00" });
  }
  if (detail.value?.status === "RECEIVED") {
    operationLogs.value.push({ action: "入库", operator: "朝阳门店库管", time: "2026-07-15 09:15:00" });
  }
}

async function handleSubmit() {
  try {
    await ElMessageBox.confirm("确定提交该调拨单审核吗？", "提示", { type: "warning" });
    await submitTransfer(transferId.value);
    ElMessage.success("提交成功");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleApprove() {
  try {
    await ElMessageBox.confirm("确定通过该调拨申请吗？", "审核通过", { type: "warning" });
    await approveTransfer(transferId.value);
    ElMessage.success("审核通过");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReject() {
  try {
    const { value } = await ElMessageBox.prompt("请输入驳回原因", "驳回调拨", {
      type: "warning",
      inputPlaceholder: "请输入驳回原因",
      confirmButtonText: "确定驳回"
    });
    await rejectTransfer(transferId.value);
    ElMessage.success("已驳回");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleShip() {
  try {
    await ElMessageBox.confirm(
      "确定执行出库操作吗？出库后库存将从调出门店扣减。",
      "确认出库",
      { type: "warning" }
    );
    await shipTransfer(transferId.value);
    ElMessage.success("出库成功");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReceive() {
  try {
    await ElMessageBox.confirm(
      "确定执行入库操作吗？入库后库存将增加到调入门店。",
      "确认入库",
      { type: "warning" }
    );
    await receiveTransfer(transferId.value, {});
    ElMessage.success("入库成功");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm("确定取消该调拨单吗？", "提示", { type: "warning" });
    await cancelTransfer(transferId.value);
    ElMessage.success("已取消");
    loadDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<style scoped>
.transfer-detail-page {
  padding: 20px 20px 80px;
}

.page-header {
  margin-bottom: 16px;
}

.header-main {
  margin-top: 8px;
}

.header-main h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  display: inline-block;
}

.page-desc {
  margin: 0;
  color: var(--gray-400);
  font-size: 14px;
}

.detail-content {
  display: flex;
  gap: 16px;
}

.main-col {
  flex: 1;
  min-width: 0;
}

.side-col {
  width: 360px;
  flex-shrink: 0;
}

.side-col .page-card + .page-card {
  margin-top: 16px;
}

.store-name {
  font-weight: 500;
  color: var(--gray-700);
}

.amount {
  color: var(--color-danger);
  font-weight: 600;
  font-size: 16px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);
}

.product-spec {
  font-size: 12px;
  color: var(--gray-400);
  margin-top: 4px;
}

.qty-num {
  font-weight: 600;
  color: var(--color-primary);
}

.subtotal {
  font-weight: 600;
  color: var(--color-danger);
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
  margin-top: 0;
}

.item-count {
  color: var(--gray-600);
  font-size: 14px;
}

.item-count .num {
  color: var(--color-primary);
  font-weight: 600;
  margin: 0 4px;
}

.total-amount {
  font-size: 14px;
  color: var(--gray-600);
}

.total-amount .amount {
  color: var(--color-danger);
  font-size: 20px;
  font-weight: 700;
  margin-left: 8px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);
}

.timeline-operator {
  font-size: 12px;
  color: var(--gray-400);
  margin-top: 4px;
}

.timeline-remark {
  font-size: 12px;
  color: var(--gray-600);
  margin-top: 4px;
  background: var(--bg-page);
  padding: 6px 10px;
  border-radius: 4px;
}

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid var(--border-light);
  text-align: right;
  z-index: 100;
}

.footer-bar .el-button {
  margin-left: 12px;
}
</style>
