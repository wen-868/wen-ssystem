<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">日结对账</h2>
    <p class="page-desc">日结对账</p>
  </div>
</div>

      <div v-if="!dailySettleResult" class="empty-tip">请选择日期范围后点击"生成日结单"</div>
      <div v-else>
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="日结期间" :span="2">
            {{ dailySettleResult.periodStart }} ~ {{ dailySettleResult.periodEnd }}
          </el-descriptions-item>
          <el-descriptions-item label="操作员">{{ dailySettleResult.operatorName || "-" }}</el-descriptions-item>
        </el-descriptions>

        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">{{ dailySettleResult.orderCount }}</div>
            <div class="metric-label">订单数</div>
          </div>
          <div class="metric-card">
            <div class="metric-value success">¥{{ Number(dailySettleResult.totalSales || 0).toFixed(2) }}</div>
            <div class="metric-label">销售金额</div>
          </div>
          <div class="metric-card">
            <div class="metric-value primary">¥{{ Number(dailySettleResult.totalReceived || 0).toFixed(2) }}</div>
            <div class="metric-label">收款金额</div>
          </div>
          <div class="metric-card">
            <div class="metric-value danger">¥{{ Number(dailySettleResult.totalRefund || 0).toFixed(2) }}</div>
            <div class="metric-label">退款金额</div>
          </div>
        </div>

        <h4 class="section-title">收款明细</h4>
        <div class="table-card">
<el-table :data="dailySettleResult.paymentBreakdown" size="small" style="margin-bottom: 16px">
          <el-table-column prop="method" label="收款方式" />
          <el-table-column label="金额" width="140">
            <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="count" label="笔数" width="100" />
        </el-table>
</div>

        <h4 class="section-title">现金对账</h4>
        <el-form label-width="100px" size="small" style="max-width: 500px; margin-bottom: 16px">
          <el-form-item label="系统应收现金">
            <span class="cash-amount">¥{{ Number(dailySettleResult.systemCash || 0).toFixed(2) }}</span>
          </el-form-item>
          <el-form-item label="实际点钞">
            <el-input-number v-model="dailySettleActualCash" :min="0" :precision="2" style="width: 200px" />
          </el-form-item>
          <el-form-item label="差异">
            <span :style="{ fontWeight: 600, color: cashDifference === 0 ? '#0EA879' : '#C0392B' }">
              ¥{{ Number(cashDifference).toFixed(2) }}
            </span>
          </el-form-item>
        </el-form>

        <div class="action-buttons">
          <el-button type="primary" @click="handlePrintDailySettle">打印日结单</el-button>
          <el-button @click="dailySettleResult = null">关闭</el-button>
        </div>
      </div>
    

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>日结历史</span>
          <el-button size="small" @click="loadDailySettleHistory">刷新</el-button>
        </div>
      </template>
      <div class="table-card">
<el-table :data="dailySettleHistory" size="small" empty-text="暂无日结记录">
        <el-table-column prop="settleDate" label="日结日期" width="120" />
        <el-table-column label="总销售" width="120">
          <template #default="{ row }">¥{{ Number(row.totalSales || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="总收款" width="120">
          <template #default="{ row }">¥{{ Number(row.totalReceived || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="现金" width="120">
          <template #default="{ row }">¥{{ Number(row.cashAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="微信" width="120">
          <template #default="{ row }">¥{{ Number(row.wechatAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="支付宝" width="120">
          <template #default="{ row }">¥{{ Number(row.alipayAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="转账" width="120">
          <template #default="{ row }">¥{{ Number(row.transferAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作员" width="120" />
        <el-table-column prop="createdAt" label="创建时间" width="170" />
      </el-table>
</div>
    </el-card>
</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { submitStoreDailySettle, fetchStoreDailySettleHistory, getErrorMessage } from "../../api";

interface DailySettleResult {
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  totalSales: number;
  totalReceived: number;
  totalRefund: number;
  systemCash: number;
  wechatAmount: number;
  alipayAmount: number;
  transferAmount: number;
  otherAmount: number;
  operatorName: string;
  paymentBreakdown: Array<{ method: string; amount: number; count: number }>;
}

const loading = ref(false);
const dailySettleDateRange = ref<string[]>([]);
const dailySettleResult = ref<DailySettleResult | null>(null);
const dailySettleActualCash = ref(0);
const dailySettleHistory = ref<any[]>([]);

const cashDifference = computed(() => {
  if (!dailySettleResult.value) return 0;
  return Number(dailySettleActualCash.value) - Number(dailySettleResult.value.systemCash);
});

async function handleDailySettle() {
  if (!dailySettleDateRange.value || dailySettleDateRange.value.length < 2) {
    ElMessage.warning("请选择日期范围");
    return;
  }
  loading.value = true;
  try {
    const result = await submitStoreDailySettle({
      settleDate: dailySettleDateRange.value[0]
    });

    dailySettleResult.value = {
      periodStart: result.periodStart || dailySettleDateRange.value[0],
      periodEnd: result.periodEnd || dailySettleDateRange.value[1],
      orderCount: Number(result.orderCount || 0),
      totalSales: Number(result.totalSales || 0),
      totalReceived: Number(result.totalReceived || 0),
      totalRefund: Number(result.totalRefund || 0),
      systemCash: Number(result.cashAmount || 0),
      wechatAmount: Number(result.wechatAmount || 0),
      alipayAmount: Number(result.alipayAmount || 0),
      transferAmount: Number(result.transferAmount || 0),
      otherAmount: Number(result.otherAmount || 0),
      operatorName: result.operatorName || "",
      paymentBreakdown: [
        { method: "现金", amount: Number(result.cashAmount || 0), count: Number(result.cashCount || 0) },
        { method: "微信支付", amount: Number(result.wechatAmount || 0), count: Number(result.wechatCount || 0) },
        { method: "支付宝", amount: Number(result.alipayAmount || 0), count: Number(result.alipayCount || 0) },
        { method: "转账", amount: Number(result.transferAmount || 0), count: Number(result.transferCount || 0) },
        { method: "其他", amount: Number(result.otherAmount || 0), count: Number(result.otherCount || 0) }
      ]
    };
    dailySettleActualCash.value = dailySettleResult.value.systemCash;

    ElMessage.success("日结单已生成并提交");
    await loadDailySettleHistory();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "日结失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function loadDailySettleHistory() {
  try {
    const data = await fetchStoreDailySettleHistory();
    dailySettleHistory.value = data.records || [];
  } catch {
    // 静默失败
  }
}

function handlePrintDailySettle() {
  if (!dailySettleResult.value) return;
  const r = dailySettleResult.value;
  const content = `
===== 门店日结单 =====
期间: ${r.periodStart} ~ ${r.periodEnd}
订单数: ${r.orderCount}
销售金额: ¥${Number(r.totalSales).toFixed(2)}
收款金额: ¥${Number(r.totalReceived).toFixed(2)}
退款金额: ¥${Number(r.totalRefund).toFixed(2)}
系统应收现金: ¥${Number(r.systemCash).toFixed(2)}
实际点钞: ¥${Number(dailySettleActualCash.value).toFixed(2)}
现金差异: ¥${Number(cashDifference.value).toFixed(2)}
======================
`;
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (printWindow) {
    printWindow.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${content}</pre>`);
    printWindow.document.close();
    printWindow.print();
    ElMessage.success("日结单已发送到打印");
  } else {
    ElMessageBox.alert(
      `<pre style="font-family:monospace;font-size:14px;padding:12px;white-space:pre-wrap">${content}</pre>`,
      "打印内容（请手动复制）",
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: "关闭"
      }
    );
  }
}

onMounted(() => {
  loadDailySettleHistory();
});
</script>

<style scoped>
.pos-daily-settle {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.action-area {
  display: flex;
  gap: 8px;
  align-items: center;
}
.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.metric-card {
  background: var(--bg-page);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.metric-value {
  font-size: 22px;
  font-weight: bold;
  color: var(--gray-700);
}
.metric-value.success {
  color: var(--color-success);
}
.metric-value.primary {
  color: #9b1c31;
}
.metric-value.danger {
  color: var(--color-danger);
}
.metric-label {
  font-size: 12px;
  color: var(--gray-400);
  margin-top: 4px;
}
.section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  color: #5c554c;
}
.cash-amount {
  font-weight: 600;
  color: #8b4513;
}
.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
</style>
