<template>
  <div>
    <h2 style="margin-bottom: 24px;">财务结算管理</h2>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">本月收入</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: #10b981;">
                ¥{{ formatMoney(stats.monthlyRevenue) }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #ecfdf5;">
              <el-icon :size="24" color="#10b981"><Money /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">待结算</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: #f59e0b;">
                ¥{{ formatMoney(stats.pendingAmount) }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fffbeb;">
              <el-icon :size="24" color="#f59e0b"><Clock /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">已结算</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: #2563eb;">
                ¥{{ formatMoney(stats.settledAmount) }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #eff6ff;">
              <el-icon :size="24" color="#2563eb"><CircleCheck /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">结算单数</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: #8b5cf6;">
                {{ stats.totalCount }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #f5f3ff;">
              <el-icon :size="24" color="#8b5cf6"><Tickets /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索结算单号/租户"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="结算状态"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="待结算" value="PENDING" />
          <el-option label="结算中" value="PROCESSING" />
          <el-option label="已结算" value="SETTLED" />
          <el-option label="已驳回" value="REJECTED" />
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
        <el-button type="success" @click="handleExport">导出报表</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="reconciliationNo" label="结算单号" width="180" />
        <el-table-column prop="tenantName" label="租户" width="140" show-overflow-tooltip />
        <el-table-column prop="period" label="结算周期" width="140" />
        <el-table-column label="订单金额" width="120" align="right">
          <template #default="{ row }">¥{{ formatMoney(row.orderAmount) }}</template>
        </el-table-column>
        <el-table-column label="平台佣金" width="120" align="right">
          <template #default="{ row }">¥{{ formatMoney(row.commissionAmount) }}</template>
        </el-table-column>
        <el-table-column label="结算金额" width="120" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600;">¥{{ formatMoney(row.settleAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ row.createdAt || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" link type="success" size="small" @click="handleSettle(row)">结算</el-button>
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

    <el-dialog v-model="detailVisible" title="结算详情" width="680px">
      <div v-if="currentDetail">
        <el-descriptions :column="2" border style="margin-bottom: 20px;">
          <el-descriptions-item label="结算单号">{{ currentDetail.reconciliationNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(currentDetail.status)" size="small">{{ statusLabel(currentDetail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="租户">{{ currentDetail.tenantName }}</el-descriptions-item>
          <el-descriptions-item label="结算周期">{{ currentDetail.period }}</el-descriptions-item>
          <el-descriptions-item label="订单数">{{ currentDetail.orderCount }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">¥{{ formatMoney(currentDetail.orderAmount) }}</el-descriptions-item>
          <el-descriptions-item label="平台佣金率">{{ currentDetail.commissionRate }}%</el-descriptions-item>
          <el-descriptions-item label="平台佣金">¥{{ formatMoney(currentDetail.commissionAmount) }}</el-descriptions-item>
          <el-descriptions-item label="结算金额" :span="2">
            <span style="font-size: 18px; font-weight: 700; color: #10b981;">¥{{ formatMoney(currentDetail.settleAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{ currentDetail.createdAt }}</el-descriptions-item>
        </el-descriptions>

        <el-divider>订单明细</el-divider>
        <el-table :data="currentDetail.items || []" size="small" border stripe max-height="300">
          <el-table-column prop="orderNo" label="订单号" width="160" />
          <el-table-column prop="productName" label="商品" min-width="150" show-overflow-tooltip />
          <el-table-column prop="amount" label="金额" width="100" align="right">
            <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="commission" label="佣金" width="100" align="right">
            <template #default="{ row }">¥{{ formatMoney(row.commission) }}</template>
          </el-table-column>
          <el-table-column label="下单时间" width="160">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Money, Clock, CircleCheck, Tickets } from "@element-plus/icons-vue";
import { getPlatformReconciliations, getPlatformReconciliationDetail, getReconciliationStats, settleReconciliation } from "../api";

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchForm = reactive({
  keyword: "",
  status: "",
  dateRange: [] as string[]
});

const stats = reactive({
  monthlyRevenue: 0,
  pendingAmount: 0,
  settledAmount: 0,
  totalCount: 0
});

const detailVisible = ref(false);
const currentDetail = ref<any>(null);

function formatMoney(value: number | string | undefined): string {
  if (!value) return "0.00";
  const num = Number(value);
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待结算",
    PROCESSING: "结算中",
    SETTLED: "已结算",
    REJECTED: "已驳回"
  };
  return map[status] || status || "-";
}

function statusTag(status: string): string {
  const map: Record<string, string> = {
    PENDING: "warning",
    PROCESSING: "primary",
    SETTLED: "success",
    REJECTED: "danger"
  };
  return map[status] || "";
}

async function fetchStats() {
  try {
    const res = await getReconciliationStats();
    const data = res.data?.data || (res as any).data || res;
    stats.monthlyRevenue = data.monthlyRevenue || 0;
    stats.pendingAmount = data.pendingAmount || 0;
    stats.settledAmount = data.settledAmount || 0;
    stats.totalCount = data.totalCount || 0;
  } catch {
    // stats remain at 0 on error
  }
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getPlatformReconciliations({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
    list.value = [];
    total.value = 0;
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
  searchForm.dateRange = [];
  page.value = 1;
  fetchList();
}

async function handleView(row: any) {
  try {
    const res = await getPlatformReconciliationDetail(row.id);
    const data = res.data?.data || (res as any).data || res;
    currentDetail.value = data;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载详情失败");
    currentDetail.value = row;
  }
  detailVisible.value = true;
}

async function handleSettle(row: any) {
  try {
    await settleReconciliation(row.id);
    ElMessage.success("结算成功");
    fetchList();
    fetchStats();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "结算失败");
  }
}

function handleExport() {
  ElMessage.info("导出功能待后端API支持");
}

onMounted(() => {
  fetchStats();
  fetchList();
});
</script>
