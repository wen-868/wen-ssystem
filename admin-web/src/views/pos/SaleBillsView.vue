<template>
  <div class="pos-sale-bills">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>销售单据</span>
          <div class="filter-area">
            <el-input v-model="keyword" placeholder="搜索单号/客户" size="small" style="width: 200px" clearable @keyup.enter="loadList" />
            <el-select v-model="collectionStatus" placeholder="收款状态" size="small" style="width: 120px" clearable>
              <el-option label="未收款" value="UNPAID" />
              <el-option label="部分收款" value="PARTIAL" />
              <el-option label="已收款" value="PAID" />
            </el-select>
            <el-button size="small" type="primary" @click="loadList">查询</el-button>
          </div>
        </div>
      </template>

      <el-table :data="records" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="billNo" label="单号" width="160" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="receivableAmount" label="应收" width="100">
          <template #default="{ row }">¥{{ Number(row.receivableAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已收" width="100">
          <template #default="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
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
            <el-button size="small" link type="primary" @click="viewDetail(row.billNo)">详情</el-button>
            <el-button size="small" link type="success" @click="sharePay(row)">分享收款</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px"
        @current-change="loadList"
      />
    </el-card>

    <el-dialog v-model="detailVisible" title="销售单详情" width="720px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="单号">{{ detail.billNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customerName }}</el-descriptions-item>
        <el-descriptions-item label="应收">¥{{ Number(detail.receivableAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="已收">¥{{ Number(detail.paidAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ getStatusText(detail.collectionStatus) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="detail.items || []" size="small" style="margin-top: 16px">
        <el-table-column prop="skuName" label="商品" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="unitPrice" label="单价" width="100">
          <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="小计" width="100">
          <template #default="{ row }">¥{{ (Number(row.unitPrice || 0) * Number(row.quantity || 0)).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchStoreSaleBills,
  fetchStoreSaleBillDetail,
  createStoreCollectionLink
} from "../../api";

const loading = ref(false);
const keyword = ref("");
const collectionStatus = ref("");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const detailVisible = ref(false);
const detail = ref<any>({});

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

async function viewDetail(billNo: string) {
  try {
    const data = await fetchStoreSaleBillDetail(billNo);
    detail.value = data;
    detailVisible.value = true;
  } catch {
    ElMessage.error("加载详情失败");
  }
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
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-area {
  display: flex;
  gap: 8px;
}
</style>
