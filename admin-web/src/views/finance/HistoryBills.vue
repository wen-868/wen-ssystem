<template>
  <div class="page">
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">单据管理</h2>
        <p class="page-desc">销售单、销售订单、采购订单、采购入库单历史单据统一查询</p>
      </div>
    </div>

    <div class="filter-bar">
      <el-select
        v-model="billType"
        placeholder="单据类型"
        clearable
        style="width: 150px; margin-right: 10px"
        @change="loadBills"
      >
        <el-option label="销售单" value="sale_bill" />
        <el-option label="销售订单" value="sale_order" />
        <el-option label="采购订单" value="purchase_order" />
        <el-option label="采购入库" value="purchase_in_stock" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px; margin-right: 10px"
        @change="loadBills"
      />
      <el-input
        v-model="keyword"
        placeholder="搜索单号 / 客户 / 供应商"
        clearable
        style="width: 220px; margin-right: 10px"
        @clear="loadBills"
        @keyup.enter="loadBills"
      />
      <el-button type="primary" @click="loadBills">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <div class="table-card">
      <el-table :data="billList" v-loading="loading" stripe empty-text="暂无历史单据">
        <el-table-column prop="billNo" label="单据号" min-width="180" />
        <el-table-column prop="billType" label="单据类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.billType)">{{ typeLabel(row.billType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="partyName" label="客户 / 供应商" min-width="160">
          <template #default="{ row }">
            {{ row.partyName || "—" }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="140">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTag(row)">{{ statusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="单据日期" width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchHistoryBills } from "../../api";

const loading = ref(false);
const billList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const billType = ref("");
const dateRange = ref<[string, string] | null>(null);
const keyword = ref("");

const BILL_TYPES: Record<string, string> = {
  sale_bill: "销售单",
  sale_order: "销售订单",
  purchase_order: "采购订单",
  purchase_in_stock: "采购入库",
};

function typeLabel(t: string): string {
  return BILL_TYPES[t] || t || "—";
}

function typeTag(t: string): "success" | "primary" | "warning" | "info" | "danger" {
  const map: Record<string, any> = {
    sale_bill: "success",
    sale_order: "primary",
    purchase_order: "warning",
    purchase_in_stock: "info",
  };
  return map[t] || "info";
}

function statusLabel(row: any): string {
  const t = row.billType;
  const s = row.status || "";
  if (t === "sale_bill") {
    const map: Record<string, string> = { PAID: "已收款", PARTIAL: "部分收款", UNPAID: "未收款" };
    return map[s] || s;
  }
  if (t === "sale_order") {
    return "已完成";
  }
  if (t === "purchase_order") {
    const map: Record<string, string> = { APPROVED: "已确认", PARTIAL: "部分入库", COMPLETED: "已完成" };
    return map[s] || s;
  }
  if (t === "purchase_in_stock") {
    return s === "COMPLETED" ? "已完成" : s;
  }
  return s;
}

function statusTag(row: any): any {
  const t = row.billType;
  const s = row.status || "";
  if (t === "sale_bill") {
    return s === "PAID" ? "success" : s === "PARTIAL" ? "warning" : "info";
  }
  if (t === "purchase_order") {
    return s === "COMPLETED" ? "success" : "warning";
  }
  return "success";
}

function formatTime(v: string | Date | null): string {
  if (!v) return "—";
  return String(v).slice(0, 16).replace("T", " ");
}

async function loadBills() {
  loading.value = true;
  try {
    const data = await fetchHistoryBills({
      page: page.value,
      pageSize: pageSize.value,
      billType: billType.value || undefined,
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
      keyword: keyword.value || undefined,
    });
    billList.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  billType.value = "";
  dateRange.value = null;
  keyword.value = "";
  page.value = 1;
  loadBills();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadBills();
}

function handlePageChange(p: number) {
  page.value = p;
  loadBills();
}

onMounted(loadBills);
</script>
