<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>收款管理</span>
          <div class="header-actions">
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="收款链接" name="collectionLinks">
          <el-table :data="collectionLinks" v-loading="loading" stripe>
            <el-table-column prop="linkNo" label="收款单号" width="200" />
            <el-table-column prop="relatedSource" label="关联来源" min-width="160" />
            <el-table-column prop="customerName" label="客户" width="120" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="{ row }">
                <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PENDING'" type="warning">待支付</el-tag>
                <el-tag v-else-if="row.status === 'PAID'" type="success">已支付</el-tag>
                <el-tag v-else-if="row.status === 'EXPIRED'" type="info">已过期</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="payMethod" label="方式" width="100" />
            <el-table-column prop="createTime" label="创建时间" width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewLinkDetail(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="linkTotal"
              :page-size="pageSize"
              :current-page="page"
              @size-change="handleLinkSizeChange"
              @current-change="handleLinkPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="支付订单" name="paymentOrders">
          <el-table :data="paymentOrders" v-loading="loading" stripe>
            <el-table-column prop="orderNo" label="收款单号" width="200" />
            <el-table-column prop="relatedSource" label="关联来源" min-width="160" />
            <el-table-column prop="customerName" label="客户" width="120" />
            <el-table-column prop="amount" label="金额" width="120">
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
            <el-table-column prop="payMethod" label="方式" width="100" />
            <el-table-column prop="transactionId" label="交易流水号" width="200" />
            <el-table-column prop="createTime" label="创建时间" width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewOrderDetail(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="orderTotal"
              :page-size="orderPageSize"
              :current-page="orderPage"
              @size-change="handleOrderSizeChange"
              @current-change="handleOrderPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-drawer v-model="detailVisible" title="收款详情" size="500px">
      <template v-if="currentItem">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="收款单号">
            {{ currentItem.linkNo || currentItem.orderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="关联来源">{{ currentItem.relatedSource || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentItem.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="金额">
            <span class="amount-text">¥{{ Number(currentItem.amount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentItem.status === 'PAID' || currentItem.status === 'SUCCESS'" type="success">
              {{ currentItem.status === 'PAID' ? '已支付' : '成功' }}
            </el-tag>
            <el-tag v-else-if="currentItem.status === 'PENDING'" type="warning">待支付</el-tag>
            <el-tag v-else-if="currentItem.status === 'EXPIRED'" type="info">已过期</el-tag>
            <el-tag v-else-if="currentItem.status === 'FAILED'" type="danger">失败</el-tag>
            <el-tag v-else>{{ currentItem.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ currentItem.payMethod || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="currentItem.transactionId" label="交易流水号">{{ currentItem.transactionId }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentItem.createTime }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentItem.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { fetchCollectionLinks, fetchPaymentOrders } from "../api";

const loading = ref(false);
const activeTab = ref("collectionLinks");
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const linkTotal = ref(0);
const orderTotal = ref(0);
const page = ref(1);
const pageSize = ref(20);
const orderPage = ref(1);
const orderPageSize = ref(20);
const detailVisible = ref(false);
const currentItem = ref<any>(null);

async function loadCollectionLinks() {
  loading.value = true;
  try {
    const data = await fetchCollectionLinks();
    const list = Array.isArray(data) ? data : (data.records || []);
    linkTotal.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    collectionLinks.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadPaymentOrders() {
  loading.value = true;
  try {
    const data = await fetchPaymentOrders();
    const list = Array.isArray(data) ? data : (data.records || []);
    orderTotal.value = list.length;
    const start = (orderPage.value - 1) * orderPageSize.value;
    const end = start + orderPageSize.value;
    paymentOrders.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "collectionLinks") {
    loadCollectionLinks();
  } else {
    loadPaymentOrders();
  }
}

function loadData() {
  if (activeTab.value === "collectionLinks") {
    loadCollectionLinks();
  } else {
    loadPaymentOrders();
  }
}

function handleLinkSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadCollectionLinks();
}

function handleLinkPageChange(p: number) {
  page.value = p;
  loadCollectionLinks();
}

function handleOrderSizeChange(size: number) {
  orderPageSize.value = size;
  orderPage.value = 1;
  loadPaymentOrders();
}

function handleOrderPageChange(p: number) {
  orderPage.value = p;
  loadPaymentOrders();
}

function viewLinkDetail(row: any) {
  currentItem.value = row;
  detailVisible.value = true;
}

function viewOrderDetail(row: any) {
  currentItem.value = row;
  detailVisible.value = true;
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
  color: #f56c6c;
  font-weight: 600;
}
</style>
