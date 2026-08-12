<template>
  <div class="sale-bill-detail">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <el-button text class="back-btn" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>&nbsp;返回
        </el-button>
        <div>
          <h2 class="page-title">销售单详情</h2>
          <p class="page-desc">{{ detail.billNo || "加载中..." }}</p>
        </div>
      </div>
      <div class="page-header-actions">
        <el-tag v-if="detail.collectionStatus" :type="getStatusType(detail.collectionStatus)" size="large">
          {{ getStatusText(detail.collectionStatus) }}
        </el-tag>
        <el-button type="primary" :icon="Printer" @click="handlePrint">打印</el-button>
      </div>
    </div>

    <el-card shadow="never" v-loading="loading" class="detail-card print-area">
      <!-- 打印抬头 -->
      <div class="print-header">
        <h1 class="print-title">销 售 单</h1>
      </div>

      <!-- 单据头 -->
      <el-descriptions :column="3" border class="bill-head">
        <el-descriptions-item label="单号">{{ detail.billNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customerName }}</el-descriptions-item>
        <el-descriptions-item label="门店">{{ detail.storeName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="销售类型">
          {{ detail.saleType === "CREDIT" ? "赊销" : "现销" }}
        </el-descriptions-item>
        <el-descriptions-item v-if="!(detail.auditorName || detail.salesmanName)" label="收银员">{{ detail.operatorName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 商品明细 -->
      <div class="section-title">商品明细</div>
      <el-table :data="detail.items || []" border stripe>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="skuName" label="商品名称" min-width="160" />
        <el-table-column prop="spec" label="规格" width="120">
          <template #default="{ row }">{{ row.spec || row.skuSpec || "-" }}</template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80">
          <template #default="{ row }">{{ row.unit || "瓶" }}</template>
        </el-table-column>
        <el-table-column label="数量" width="100">
          <template #default="{ row }">{{ row.totalBottleQty ?? row.bottleQty ?? row.quantity ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="unitPrice" label="单价" width="120">
          <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }">
            <span class="money-text">¥{{ (Number(row.unitPrice || 0) * Number(row.totalBottleQty ?? row.bottleQty ?? row.quantity ?? 0)).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="追溯码" min-width="160">
          <template #default="{ row }">
            <span class="trace-codes">{{ formatTraceCodes(row.traceCodes || row.trace_codes) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120">
          <template #default="{ row }">{{ row.remark || "-" }}</template>
        </el-table-column>
      </el-table>

      <!-- 金额汇总（底部） -->
      <div class="summary-bar">
        <div class="summary-left">
          <div class="summary-item">
            <span class="summary-label">应收金额</span>
            <span class="summary-value">¥{{ Number(detail.totalAmount ?? detail.receivableAmount ?? 0).toFixed(2) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">优惠金额</span>
            <span class="summary-value">-¥{{ Number(detail.discountAmount || 0).toFixed(2) }}</span>
          </div>
        </div>
        <div class="summary-right">
          <div class="summary-item">
            <span class="summary-label">实收金额</span>
            <span class="summary-total">¥{{ Number(detail.receivableAmount || 0).toFixed(2) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">已收金额</span>
            <span class="summary-value">¥{{ Number(detail.receivedAmount ?? detail.paidAmount ?? 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
      <div class="amount-chinese">
        <span class="amount-chinese-label">金额（大写）：</span>
        <span class="amount-chinese-value">{{ amountToChinese(detail.receivableAmount || 0) }}</span>
      </div>

      <!-- 备注 -->
      <el-descriptions v-if="detail.remark || detail.internalRemark" :column="1" border class="bill-remark">
        <el-descriptions-item v-if="detail.remark" label="客户备注">{{ detail.remark }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.internalRemark" label="内部备注">{{ detail.internalRemark }}</el-descriptions-item>
      </el-descriptions>

      <!-- 签章区 -->
      <div class="print-sign">
        <!-- 收银台单据只显示收银员；工作台单据显示 制单/审核/业务 -->
        <span v-if="detail.auditorName || detail.salesmanName">制单人：{{ detail.operatorName || "-" }}</span>
        <span v-if="detail.auditorName || detail.salesmanName">审核人：{{ detail.auditorName || "-" }}</span>
        <span v-if="detail.auditorName || detail.salesmanName">业务员：{{ detail.salesmanName || "-" }}</span>
        <span>客户签收：____________</span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Printer } from "@element-plus/icons-vue";
import { fetchStoreSaleBillDetail } from "../../api";
import { amountToChinese } from "../../utils/money";
import { formatDate } from "../../utils/format";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<any>({});

function getStatusType(status: string) {
  const map: Record<string, string> = { PAID: "success", PARTIAL: "warning", UNPAID: "danger" };
  return map[status] || "info";
}

function getStatusText(status: string) {
  const map: Record<string, string> = { PAID: "已收款", PARTIAL: "部分收款", UNPAID: "未收款" };
  return map[status] || status || "未知";
}

function goBack() {
  // 收银台模式：返回收银台销售单据列表，不跳出
  const listPath = route.path.startsWith("/pos/") ? "/pos/sale-bills" : "/sale-bills";
  router.push(listPath);
}

function handlePrint() {
  window.print();
}

function formatTraceCodes(codes: unknown): string {
  if (!codes) return "-";
  if (Array.isArray(codes)) {
    return codes.filter(Boolean).join("、") || "-";
  }
  return String(codes) || "-";
}

async function loadDetail() {
  const billNo = String(route.params.billNo || "");
  if (!billNo) return;
  loading.value = true;
  try {
    detail.value = await fetchStoreSaleBillDetail(billNo);
  } catch (e) {
    console.error("加载销售单详情失败", e);
  }
  loading.value = false;
}

onMounted(() => {
  loadDetail();
  // 提交并打印：进入详情后自动调起打印
  if (route.query.print === "1") {
    setTimeout(() => handlePrint(), 800);
  }
});
</script>

<style scoped>
.sale-bill-detail { padding: 20px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-header-main { display: flex; align-items: flex-start; gap: 12px; }
.back-btn { padding: 0; font-size: 14px; margin-top: 2px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: 4px 0 0; color: var(--text-secondary, #909399); font-size: 13px; }
.detail-card { border-radius: 8px; }
.bill-head { margin-bottom: 20px; }
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 12px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary, #409eff);
}
.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 20px;
  padding: 16px 20px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 8px;
}
.summary-left, .summary-right { display: flex; gap: 32px; }
.summary-item { display: flex; flex-direction: column; gap: 4px; }
.summary-label { font-size: 13px; color: var(--text-secondary, #909399); }
.summary-value { font-size: 15px; font-weight: 600; }
.summary-total { font-size: 24px; font-weight: 700; color: var(--color-primary, #409eff); }
.money-text { font-weight: 600; color: var(--color-primary, #409eff); }
.bill-remark { margin-top: 16px; }
.print-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #333;
}
.print-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #000;
}
.print-meta {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: #333;
}
.amount-chinese {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fafafa;
  border: 1px dashed #ddd;
  border-radius: 4px;
  font-size: 14px;
}
.amount-chinese-label { color: var(--text-secondary, #909399); }
.amount-chinese-value { font-weight: 600; letter-spacing: 1px; }
.print-sign {
  display: flex;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 16px;
  font-size: 13px;
  color: #333;
}
</style>

<!-- 打印样式：仅输出销售单内容，隐藏系统框架 -->
<style>
@media print {
  body {
    background: #fff !important;
  }
  .side,
  .main-header,
  .el-drawer,
  .page-header,
  .ai-fab,
  .ai-panel {
    display: none !important;
  }
  .layout-main,
  .main-content,
  .sale-bill-detail {
    margin: 0 !important;
    padding: 0 !important;
  }
  .print-area {
    border: none !important;
    box-shadow: none !important;
  }
  .detail-card {
    box-shadow: none !important;
  }
  @page {
    size: A4;
    margin: 12mm;
  }
}
</style>
