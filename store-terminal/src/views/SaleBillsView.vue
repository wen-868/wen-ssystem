<template>
  <el-card style="margin-top: 20px">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
        <span>销售单列表</span>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
          <el-input v-model="saleBillKeyword" placeholder="搜索销售单号/客户名" clearable size="small" style="width: 200px" @keyup.enter="handleSearchSaleBills" />
          <el-select v-model="saleBillStatusFilter" placeholder="收款状态" clearable size="small" style="width: 120px" @change="handleSearchSaleBills">
            <el-option label="全部" value="" />
            <el-option label="待收款" value="UNPAID" />
            <el-option label="部分收款" value="PARTIAL" />
            <el-option label="已收款" value="PAID" />
          </el-select>
          <el-button size="small" @click="handleSearchSaleBills">搜索</el-button>
          <el-button size="small" @click="saleBillKeyword = ''; saleBillStatusFilter = ''; saleBillPage = 1; loadSaleBills()">刷新</el-button>
        </div>
      </div>
    </template>
    <el-table :data="saleBills">
      <el-table-column prop="billNo" label="销售单号" width="220" />
      <el-table-column prop="customerName" label="客户" />
      <el-table-column prop="businessStatus" label="业务状态" width="120" />
      <el-table-column prop="collectionStatus" label="收款状态" width="120" />
      <el-table-column label="应收金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.receivableAmount) }}</template>
      </el-table-column>
      <el-table-column label="未收金额" width="120">
        <template #default="{ row }">{{ formatYuan(row.unreceivedAmount) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="openSaleBillDetail(row.billNo)">详情</el-button>
          <el-button size="small" type="primary" @click="shareExistingBill(row)">分享收款</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="saleBillTotal > saleBillPageSize" style="display: flex; justify-content: flex-end; margin-top: 12px">
      <el-pagination
        v-model:current-page="saleBillPage"
        :page-size="saleBillPageSize"
        :total="saleBillTotal"
        layout="prev, pager, next"
        size="small"
        @current-change="handleSaleBillPageChange"
      />
    </div>
  </el-card>

  <el-drawer v-model="detailVisible" title="销售单详情" size="520px">
    <template v-if="saleBillDetail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="销售单号">{{ saleBillDetail.billNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ saleBillDetail.customerName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="业务状态">{{ saleBillDetail.businessStatus }}</el-descriptions-item>
        <el-descriptions-item label="收款状态">{{ saleBillDetail.collectionStatus }}</el-descriptions-item>
        <el-descriptions-item label="应收金额">{{ formatYuan(saleBillDetail.receivableAmount) }}</el-descriptions-item>
        <el-descriptions-item label="未收金额">{{ formatYuan(saleBillDetail.unreceivedAmount) }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="saleBillDetail.items || []" style="margin-top: 16px">
        <el-table-column prop="skuName" label="商品" />
        <el-table-column prop="totalBottleQty" label="数量" width="80" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="小计" width="100">
          <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
        </el-table-column>
      </el-table>
      <el-alert v-if="detailShareUrl" type="warning" show-icon :closable="false" style="margin-top: 16px">
        <template #title>{{ detailShareUrl }}</template>
      </el-alert>
      <el-button type="primary" style="margin-top: 16px" @click="shareExistingBill(saleBillDetail)">
        生成分享收款
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchSaleBills,
  fetchSaleBillDetail,
  createCollectionLink
} from "../api";
import { formatYuan } from "../utils/format";

const saleBills = ref<any[]>([]);
const saleBillTotal = ref(0);
const saleBillPage = ref(1);
const saleBillPageSize = ref(20);
const saleBillKeyword = ref("");
const saleBillStatusFilter = ref("");
const saleBillDetail = ref<any | null>(null);
const detailVisible = ref(false);
const detailShareUrl = ref("");

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadSaleBills(params?: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number }) {
  try {
    const data = await fetchSaleBills(params);
    saleBills.value = data.records || [];
    saleBillTotal.value = Number(data.total || 0);
  } catch {
    ElMessage.warning("销售单接口暂不可用，请确认后端和数据库已启动");
  }
}

function handleSearchSaleBills() {
  saleBillPage.value = 1;
  const params: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number } = {
    page: saleBillPage.value,
    pageSize: saleBillPageSize.value
  };
  if (saleBillKeyword.value.trim()) params.keyword = saleBillKeyword.value.trim();
  if (saleBillStatusFilter.value) params.collectionStatus = saleBillStatusFilter.value;
  loadSaleBills(params);
}

function handleSaleBillPageChange(page: number) {
  saleBillPage.value = page;
  const params: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number } = {
    page: saleBillPage.value,
    pageSize: saleBillPageSize.value
  };
  if (saleBillKeyword.value.trim()) params.keyword = saleBillKeyword.value.trim();
  if (saleBillStatusFilter.value) params.collectionStatus = saleBillStatusFilter.value;
  loadSaleBills(params);
}

async function openSaleBillDetail(billNo: string) {
  try {
    saleBillDetail.value = await fetchSaleBillDetail(billNo);
    detailShareUrl.value = "";
    detailVisible.value = true;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载销售单详情失败，请重试"));
  }
}

async function shareExistingBill(row: any) {
  const amount = Number(row.unreceivedAmount || row.receivableAmount || 0);
  if (!row.billNo || amount <= 0) {
    ElMessage.warning("当前销售单没有可收金额");
    return;
  }
  try {
    const result = await createCollectionLink(row.billNo, amount);
    const url = `${location.origin}${result.shareUrl}`;
    if (detailVisible.value) {
      detailShareUrl.value = url;
    }
    ElMessage.success("分享收款链接已生成");
    await loadSaleBills();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "生成分享收款失败，请重试"));
  }
}

onMounted(() => {
  loadSaleBills();
});
</script>
