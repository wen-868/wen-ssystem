<template>
  <div class="page">
    <!-- 月度统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">¥{{ Number(stats.monthTotal || 0).toFixed(2) }}</div>
        <div class="stat-label">本月提成总额</div>
      </div>
      <div class="stat-card settled">
        <div class="stat-value">¥{{ Number(stats.monthSettled || 0).toFixed(2) }}</div>
        <div class="stat-label">已结算</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">¥{{ Number(stats.monthPending || 0).toFixed(2) }}</div>
        <div class="stat-label">待结算</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">¥{{ Number(stats.avgPerStaff || 0).toFixed(2) }}</div>
        <div class="stat-label">人均提成</div>
      </div>
    </div>

    <PageCard title="提成记录">
      <template #extra>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="~"
          start-placeholder="开始"
          end-placeholder="结束"
          value-format="YYYY-MM-DD"
          size="default"
          style="width: 250px"
          @change="loadList"
        />
        <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 110px" clearable @change="loadList">
          <el-option label="待结算" value="PENDING" />
          <el-option label="已结算" value="SETTLED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showCalcDialog">计算提成</el-button>
        <el-button @click="handleSettle" :disabled="selectedIds.length === 0">批量结算</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
        @selection-change="onSelectionChange"
        show-selection
      >
        <template #saleAmount="{ row }">¥{{ Number(row.saleAmount || 0).toFixed(2) }}</template>
        <template #commissionAmount="{ row }">
          <span class="commission-amount">¥{{ Number(row.commissionAmount || 0).toFixed(2) }}</span>
        </template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'PENDING'" type="warning">待结算</el-tag>
          <el-tag v-else-if="row.status === 'SETTLED'" type="success">已结算</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
      </DataTable>
    </PageCard>

    <!-- 计算提成弹窗 -->
    <el-dialog v-model="calcVisible" title="计算提成" width="480px" :close-on-click-modal="false">
      <el-form ref="calcFormRef" :model="calcForm" :rules="calcRules" label-width="100px">
        <el-form-item label="日期范围" prop="dateRange">
          <el-date-picker
            v-model="calcForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <p style="color: #909399; font-size: 13px">系统将根据当前生效中的提成规则，自动计算所选日期范围内已结清销售单的提成金额。</p>
      </el-form>
      <template #footer>
        <el-button @click="calcVisible = false">取消</el-button>
        <el-button type="primary" :loading="calcLoading" @click="handleCalc">开始计算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchCommissionRecords, calculateCommission, settleCommission, fetchCommissionStats } from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const stats = ref({ monthTotal: 0, monthSettled: 0, monthPending: 0, avgPerStaff: 0 });

const selectedIds = ref<number[]>([]);

const calcVisible = ref(false);
const calcLoading = ref(false);
const calcFormRef = ref();
const calcForm = ref({ dateRange: null as [string, string] | null });
const calcRules = {
  dateRange: [{ required: true, message: '请选择日期范围', trigger: 'change' }]
};

const columns: any[] = [
  { type: "selection", width: 50 },
  { prop: "staffName", label: "员工", width: 100 },
  { prop: "ruleName", label: "规则", width: 120 },
  { prop: "billNo", label: "关联销售单", width: 180 },
  { prop: "saleAmount", label: "销售金额", width: 110, slot: "saleAmount" },
  { prop: "commissionAmount", label: "提成金额", width: 110, slot: "commissionAmount" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "calcDate", label: "计算日期", width: 110 },
  { prop: "settledAt", label: "结算时间", width: 160 },
  { label: "操作", width: 80, fixed: "right" }
];

function onSelectionChange(rows: any[]) {
  selectedIds.value = rows.map((r: any) => r.id);
}

async function loadStats() {
  try {
    const data = await fetchCommissionStats();
    stats.value = data;
  } catch { /* ignore */ }
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchCommissionRecords({
      page: page.value, pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function showCalcDialog() {
  calcForm.value = { dateRange: null };
  calcVisible.value = true;
}

async function handleCalc() {
  const valid = await calcFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  calcLoading.value = true;
  try {
    const result = await calculateCommission({
      dateStart: calcForm.value.dateRange![0],
      dateEnd: calcForm.value.dateRange![1]
    });
    ElMessage.success(`计算完成，新增 ${result.calculated} 条提成记录`);
    calcVisible.value = false;
    loadList();
    loadStats();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "计算失败");
  } finally {
    calcLoading.value = false;
  }
}

async function handleSettle() {
  if (selectedIds.value.length === 0) { ElMessage.warning("请选择要结算的记录"); return; }
  try {
    await ElMessageBox.confirm(`确定结算选中的 ${selectedIds.value.length} 条提成记录吗？`, "确认结算", { type: "warning" });
  } catch { return; }
  try {
    const result = await settleCommission(selectedIds.value);
    ElMessage.success(`已结算 ${result.settled} 条记录`);
    selectedIds.value = [];
    loadList();
    loadStats();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "结算失败");
  }
}

onMounted(() => {
  loadStats();
  loadList();
});
</script>

<style scoped>
.page { padding: 0; }
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border-left: 4px solid #409eff;
}
.stat-card.settled { border-left-color: #67c23a; }
.stat-card.pending { border-left-color: #e6a23c; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.commission-amount { color: #e6a23c; font-weight: 600; }
</style>
