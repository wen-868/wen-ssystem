<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">收款记录</h2>
    <p class="page-desc">收款与退款记录查询</p>
  </div>
  <div class="page-header-actions">
    <el-button @click="refreshCurrent">刷新</el-button>
  </div>
</div>


      <StatBar :stats="paymentStats" />
      <div class="filter-bar">
        <el-input
          v-model="filterKeyword"
          placeholder="搜索单号/关联单号"
          size="default"
          clearable
          @clear="refreshCurrent"
          @keyup.enter="refreshCurrent"
        />
        <el-select v-model="filterStatus" placeholder="全部状态" size="default" clearable @change="refreshCurrent">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button type="primary" @click="refreshCurrent">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="分享收款" name="collection">
          <div class="table-card">
<el-table class="list-table" :data="collectionLinks" v-loading="loading" stripe empty-text="暂无记录">
            <el-table-column prop="linkNo" label="收款单号" width="200" />
            <el-table-column prop="sourceNo" label="关联销售单" width="200" />
            <el-table-column label="收款金额" width="120">
              <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="已付" width="120">
              <template #default="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PAID'" type="success">已支付</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">待支付</el-tag>
                <el-tag v-else-if="row.status === 'EXPIRED'" type="info">已过期</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="shareChannel" label="分享渠道" width="120" />
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
</div>
        </el-tab-pane>

        <el-tab-pane label="支付记录" name="payment">
          <div class="table-card">
<el-table class="list-table" :data="paymentOrders" v-loading="loading" stripe empty-text="暂无记录">
            <el-table-column prop="payNo" label="支付单号" width="200" />
            <el-table-column prop="sourceNo" label="关联来源" width="200" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">
                <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'SUCCESS'" type="success">成功</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">处理中</el-tag>
                <el-tag v-else-if="row.status === 'FAILED'" type="danger">失败</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="方式" width="100" />
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
</div>
        </el-tab-pane>

        <el-tab-pane label="退款记录" name="refund">
          <div class="table-card">
<el-table class="list-table" :data="refundOrders" v-loading="loading" stripe empty-text="暂无退款">
            <el-table-column prop="refundNo" label="退款单号" width="200" />
            <el-table-column prop="payNo" label="支付单号" width="200" />
            <el-table-column prop="sourceNo" label="关联来源" width="180" />
            <el-table-column label="退款金额" width="120">
              <template #default="{ row }">
                <span class="refund-text">-¥{{ Number(row.amount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="140" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'SUCCESS'" type="success">成功</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">处理中</el-tag>
                <el-tag v-else-if="row.status === 'FAILED'" type="danger">失败</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
</div>
          </el-tab-pane>
        </el-tabs>

      <div class="pagination">
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import StatBar from "../../components/StatBar.vue";
import { fetchCollectionLinks, fetchPaymentOrders, fetchRefundOrders } from "../../api";

const loading = ref(false);
const activeTab = ref("collection");
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);
const total = ref(0);
const filterKeyword = ref("");
const filterStatus = ref("");

/** 财务统计条（对标设计稿 p08） */
const paymentStats = computed(() => {
  return [
    { label: "收款关联", value: collectionLinks.value.length, primary: true },
    { label: "付款单", value: paymentOrders.value.length },
    { label: "退款单", value: refundOrders.value.length },
  ];
});

/** 状态筛选选项（按当前 tab 动态切换，与各 tab 状态枚举一致） */
const statusOptions = computed(() => {
  if (activeTab.value === "collection") {
    return [
      { label: "待支付", value: "PENDING" },
      { label: "已支付", value: "PAID" },
      { label: "已过期", value: "EXPIRED" },
    ];
  }
  return [
    { label: "成功", value: "SUCCESS" },
    { label: "处理中", value: "PENDING" },
    { label: "失败", value: "FAILED" },
  ];
});
const page = ref(1);
const pageSize = ref(20);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

/** 前端过滤：关键词（单号/来源）+ 状态，模式与 Inventory 列表页一致 */
function applyFilters(list: any[], fields: string[]) {
  if (filterKeyword.value) {
    const kw = filterKeyword.value.toLowerCase();
    list = list.filter((item: any) =>
      fields.some((f) => item[f] != null && String(item[f]).toLowerCase().includes(kw))
    );
  }
  if (filterStatus.value) {
    list = list.filter((item: any) => item.status === filterStatus.value);
  }
  return list;
}

function resetFilters() {
  filterKeyword.value = "";
  filterStatus.value = "";
  page.value = 1;
  refreshCurrent();
}

async function loadCollectionLinks() {
  loading.value = true;
  try {
    const data = await fetchCollectionLinks();
    const list = applyFilters(data.records || [], ["linkNo", "sourceNo"]);
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    collectionLinks.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载分享收款记录失败"));
  } finally {
    loading.value = false;
  }
}

async function loadPaymentOrders() {
  loading.value = true;
  try {
    const data = await fetchPaymentOrders();
    const list = applyFilters(data.records || [], ["payNo", "sourceNo"]);
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    paymentOrders.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载支付记录失败"));
  } finally {
    loading.value = false;
  }
}

async function loadRefundOrders() {
  loading.value = true;
  try {
    const data = await fetchRefundOrders();
    const list = applyFilters(data.records || [], ["refundNo", "payNo", "sourceNo"]);
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    refundOrders.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载退款记录失败"));
  } finally {
    loading.value = false;
  }
}

function handleTabChange(tab: string) {
  page.value = 1;
  filterStatus.value = "";
  refreshCurrent();
}

function refreshCurrent() {
  if (activeTab.value === "collection") {
    loadCollectionLinks();
  } else if (activeTab.value === "payment") {
    loadPaymentOrders();
  } else if (activeTab.value === "refund") {
    loadRefundOrders();
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  refreshCurrent();
}

function handlePageChange(p: number) {
  page.value = p;
  refreshCurrent();
}

onMounted(() => {
  loadCollectionLinks();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.amount-text {
  color: var(--color-success);
  font-weight: 600;
}
.refund-text {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
