<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">采购退货</h2>
    <p class="page-desc">采购退货单登记与处理</p>
  </div>
</div>
<div class="filter-bar">
  <el-input
  v-model="keyword"
  placeholder="搜索退货单号/供应商"
  size="default"
  style="width: 200px; margin-right: 10px"
  clearable
  @clear="loadReturns"
  @keyup.enter="loadReturns"
  />
  <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadReturns">
  <el-option label="待审核" value="PENDING" />
  <el-option label="已通过" value="APPROVED" />
  <el-option label="已拒绝" value="REJECTED" />
  <el-option label="已完成" value="COMPLETED" />
  </el-select>
  <el-button @click="loadReturns">搜索</el-button>
  <el-button type="primary" @click="dialogVisible = true">新增退货</el-button>
  <el-button @click="loadReturns">刷新</el-button>
</div>


      <div class="table-card">
<el-table :data="returns" v-loading="loading" stripe>
        <el-table-column prop="returnNo" label="退货单号" width="200" />
        <el-table-column prop="purchaseBillNo" label="关联采购单" width="200" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="type" label="退货类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'FULL'" type="warning">全额退货</el-tag>
            <el-tag v-else-if="row.type === 'PARTIAL'" type="primary">部分退货</el-tag>
            <el-tag v-else>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退货金额" width="120">
          <template #default="{ row }">
            <span class="return-amount">-¥{{ Number(row.returnAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.status === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="row.status === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="approveReturn(row)">通过</el-button>
          </template>
        </el-table-column>
      </el-table>
</div>

      <el-pagination
        v-if="total > 0"
        style="margin-top: 16px; justify-content: flex-end"
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
      />
    

    <el-dialog v-model="detailVisible" title="退货详情" width="720px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="退货单号">{{ detail.returnNo }}</el-descriptions-item>
        <el-descriptions-item label="关联采购单">{{ detail.purchaseBillNo }}</el-descriptions-item>
        <el-descriptions-item label="退货类型">{{ detail.type }}</el-descriptions-item>
        <el-descriptions-item label="退货金额">¥{{ Number(detail.returnAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchPurchaseReturns, approvePurchaseReturn } from "../../api";

const loading = ref(false);
const returns = ref<any[]>([]);
const keyword = ref("");
const statusFilter = ref("");
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const detail = ref<any>({});

onMounted(() => loadReturns());

async function loadReturns() {
  loading.value = true;
  try {
    const res = await fetchPurchaseReturns({ keyword: keyword.value, status: statusFilter.value, page: page.value, pageSize: pageSize.value });
    returns.value = res.list || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  loadReturns();
}

function viewDetail(row: any) {
  detail.value = row;
  detailVisible.value = true;
}

async function approveReturn(row: any) {
  try {
    await ElMessageBox.confirm("确定审核通过该退货单吗？", "提示", { type: "warning" });
    await approvePurchaseReturn(row.returnNo);
    ElMessage.success("审核通过");
    loadReturns();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e?.response?.data?.msg || "审核失败");
    }
  }
}
</script>

<style scoped>
.page {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.return-amount {
  color: var(--color-danger);
  font-weight: 500;
}
</style>