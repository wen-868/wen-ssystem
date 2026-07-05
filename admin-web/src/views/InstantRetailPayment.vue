<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售支付</span>
          <div class="header-actions">
            <el-input
              v-model="orderNoFilter"
              placeholder="搜索订单号"
              size="default"
              style="width: 200px; margin-right: 8px"
              clearable
              @clear="loadData"
              @keyup.enter="loadData"
            />
            <el-select v-model="methodFilter" placeholder="支付方式" size="default" style="width: 130px; margin-right: 8px" clearable @change="loadData">
              <el-option label="微信支付" value="WECHAT" />
              <el-option label="支付宝" value="ALIPAY" />
              <el-option label="余额支付" value="BALANCE" />
            </el-select>
            <el-select v-model="statusFilter" placeholder="支付状态" size="default" style="width: 130px; margin-right: 8px" clearable @change="loadData">
              <el-option label="已支付" value="PAID" />
              <el-option label="未支付" value="UNPAID" />
              <el-option label="已退款" value="REFUNDED" />
            </el-select>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 8px"
              value-format="YYYY-MM-DD"
              @change="loadData"
            />
            <el-button @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="payments" v-loading="loading" stripe>
        <el-table-column prop="paymentNo" label="支付单号" width="200" />
        <el-table-column prop="orderNo" label="关联订单号" width="200" />
        <el-table-column prop="amount" label="支付金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="method" label="支付方式" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.method === 'WECHAT'" type="success">微信支付</el-tag>
            <el-tag v-else-if="row.method === 'ALIPAY'" type="primary">支付宝</el-tag>
            <el-tag v-else-if="row.method === 'BALANCE'" type="info">余额支付</el-tag>
            <el-tag v-else>{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="支付状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else-if="row.status === 'UNPAID'" type="danger">未支付</el-tag>
            <el-tag v-else-if="row.status === 'REFUNDED'" type="warning">已退款</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paidAt" label="支付时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无支付记录" />
        </template>
      </el-table>

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
    </el-card>

    <el-dialog v-model="detailVisible" title="支付详情" width="560px">
      <el-descriptions v-if="paymentDetail" :column="2" border>
        <el-descriptions-item label="支付单号">{{ paymentDetail.paymentNo }}</el-descriptions-item>
        <el-descriptions-item label="关联订单号">{{ paymentDetail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="支付金额">¥{{ Number(paymentDetail.amount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="支付方式">
          <el-tag v-if="paymentDetail.method === 'WECHAT'" type="success">微信支付</el-tag>
          <el-tag v-else-if="paymentDetail.method === 'ALIPAY'" type="primary">支付宝</el-tag>
          <el-tag v-else-if="paymentDetail.method === 'BALANCE'" type="info">余额支付</el-tag>
          <el-tag v-else>{{ paymentDetail.method }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="支付状态">
          <el-tag v-if="paymentDetail.status === 'PAID'" type="success">已支付</el-tag>
          <el-tag v-else-if="paymentDetail.status === 'UNPAID'" type="danger">未支付</el-tag>
          <el-tag v-else-if="paymentDetail.status === 'REFUNDED'" type="warning">已退款</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="交易流水号">{{ paymentDetail.transactionNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ paymentDetail.paidAt || "-" }}</el-descriptions-item>
        <el-descriptions-item label="退款时间">{{ paymentDetail.refundedAt || "-" }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ paymentDetail.createdAt || "-" }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ paymentDetail.remark || "-" }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchInstantPaymentDetail, fetchInstantPayments } from "../api";

const loading = ref(false);
const payments = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const orderNoFilter = ref("");
const methodFilter = ref("");
const statusFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const paymentDetail = ref<any>(null);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchInstantPayments({
      orderNo: orderNoFilter.value || undefined,
      paymentMethod: methodFilter.value || undefined,
      status: statusFilter.value || undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
      page: page.value,
      pageSize: pageSize.value
    });
    payments.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载支付记录失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

async function viewDetail(row: any) {
  try {
    paymentDetail.value = await fetchInstantPaymentDetail(row.paymentNo);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "获取支付详情失败"));
  }
}

onMounted(() => {
  loadData();
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
  font-weight: 500;
}
</style>