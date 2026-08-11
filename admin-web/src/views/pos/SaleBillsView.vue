<template>
  <div class="pos-sale-bills">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">销售单据</h2>
        <p class="page-desc">销售单收款状态与收款链接</p>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索单号/客户" clearable @keyup.enter="loadList" />
      <el-select v-model="collectionStatus" placeholder="收款状态" clearable @change="loadList">
        <el-option label="未收款" value="UNPAID" />
        <el-option label="部分收款" value="PARTIAL" />
        <el-option label="已收款" value="PAID" />
      </el-select>
      <el-button type="primary" @click="loadList">查询</el-button>
      <div class="filter-bar-spacer" />
    </div>

    <!-- 表格 -->
    <div class="table-card">
      <el-table :data="records" v-loading="loading" stripe @row-click="openDetail" class="clickable-table">
        <el-table-column prop="billNo" label="单号" width="160" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="receivableAmount" label="应收" width="100">
          <template #default="{ row }"><span class="amount-text">¥{{ Number(row.receivableAmount || 0).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已收" width="100">
          <template #default="{ row }"><span class="amount-text">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column prop="collectionStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.collectionStatus)" size="small">
              {{ getStatusText(row.collectionStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" min-width="120">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="openDetail(row)">详情</el-button>
            <el-button size="small" link type="success" @click.stop="sharePay(row)">分享收款</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无销售单据" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          v-if="total > 0"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadList"
        />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  fetchStoreSaleBills,
  createStoreCollectionLink
} from "../../api";

const loading = ref(false);
const keyword = ref("");
const collectionStatus = ref("");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const router = useRouter();

function getStatusType(status: string) {
  const map: Record<string, string> = { PAID: "success", PARTIAL: "warning", UNPAID: "danger" };
  return map[status] || "info";
}

function getStatusText(status: string) {
  const map: Record<string, string> = { PAID: "已收款", PARTIAL: "部分收款", UNPAID: "未收款" };
  return map[status] || status || "未知";
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchStoreSaleBills({
      keyword: keyword.value || undefined,
      collectionStatus: collectionStatus.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载销售单失败");
  } finally {
    loading.value = false;
  }
}

function openDetail(row: any) {
  router.push(`/sale-bills/${encodeURIComponent(row.billNo)}`);
}

async function sharePay(row: any) {
  try {
    const result = await createStoreCollectionLink(row.billNo, Number(row.receivableAmount || 0));
    if (result.shareUrl) {
      navigator.clipboard.writeText(result.shareUrl);
      ElMessage.success("收款链接已复制");
    } else {
      ElMessage.success("已生成收款链接");
    }
  } catch {
    ElMessage.error("生成收款链接失败");
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-sale-bills {
  padding: 0;
}
.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.clickable-table :deep(.el-table__row) {
  cursor: pointer;
}
</style>
