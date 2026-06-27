<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售订单</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索订单号/客户"
              size="default"
              style="width: 200px; margin-right: 8px"
              clearable
              @clear="loadData"
              @keyup.enter="loadData"
            />
            <el-select v-model="statusFilter" placeholder="订单状态" size="default" style="width: 130px; margin-right: 8px" clearable @change="loadData">
              <el-option label="待确认" value="PENDING" />
              <el-option label="已确认" value="CONFIRMED" />
              <el-option label="备货中" value="PREPARING" />
              <el-option label="配送中" value="DELIVERING" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已取消" value="CANCELLED" />
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

      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="customer" label="客户" min-width="120" />
        <el-table-column prop="totalAmount" label="订单金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="订单状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="row.status === 'CONFIRMED'" type="primary">已确认</el-tag>
            <el-tag v-else-if="row.status === 'PREPARING'" type="info">备货中</el-tag>
            <el-tag v-else-if="row.status === 'DELIVERING'" type="">配送中</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="row.status === 'CANCELLED'" type="info">已取消</el-tag>
            <el-tag v-else-if="row.status === 'REFUNDED'" type="danger">已退款</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paymentStatus" label="支付状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.paymentStatus === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'UNPAID'" type="danger">未支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'REFUNDED'" type="warning">已退款</el-tag>
            <el-tag v-else>{{ row.paymentStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deliveryType" label="配送方式" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.deliveryType === 'SELF'" type="success">自提</el-tag>
            <el-tag v-else-if="row.deliveryType === 'DELIVERY'" type="primary">配送</el-tag>
            <el-tag v-else>{{ row.deliveryType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleConfirm(row)">确认</el-button>
            <el-button v-if="row.status === 'PENDING' || row.status === 'CONFIRMED'" size="small" link type="danger" @click="handleCancel(row)">取消</el-button>
            <el-button v-if="row.status === 'COMPLETED' && row.paymentStatus === 'PAID'" size="small" link type="warning" @click="handleRefund(row)">退款</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无订单数据" />
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

    <el-dialog v-model="detailVisible" title="订单详情" width="600px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customer }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">¥{{ Number(detail.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag v-if="detail.status === 'PENDING'" type="warning">待确认</el-tag>
          <el-tag v-else-if="detail.status === 'CONFIRMED'" type="primary">已确认</el-tag>
          <el-tag v-else-if="detail.status === 'PREPARING'" type="info">备货中</el-tag>
          <el-tag v-else-if="detail.status === 'DELIVERING'" type="">配送中</el-tag>
          <el-tag v-else-if="detail.status === 'COMPLETED'" type="success">已完成</el-tag>
          <el-tag v-else-if="detail.status === 'CANCELLED'" type="info">已取消</el-tag>
          <el-tag v-else-if="detail.status === 'REFUNDED'" type="danger">已退款</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="支付状态">{{ detail.paymentStatus }}</el-descriptions-item>
        <el-descriptions-item label="配送方式">{{ detail.deliveryType }}</el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ detail.address || "-" }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ detail.phone || "-" }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || "-" }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { cancelInstantOrder, confirmInstantOrder, fetchInstantOrderDetail, fetchInstantOrders, refundInstantOrder } from "../api";

const loading = ref(false);
const orders = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const detail = ref<any>(null);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchInstantOrders({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
      page: page.value,
      pageSize: pageSize.value
    });
    orders.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载订单列表失败"));
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
    detail.value = await fetchInstantOrderDetail(row.orderNo);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "获取订单详情失败"));
  }
}

async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm(`确定要确认订单「${row.orderNo}」吗？`, "确认订单", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await confirmInstantOrder(row.orderNo);
    ElMessage.success("订单已确认");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "确认订单失败"));
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm(`确定要取消订单「${row.orderNo}」吗？`, "取消订单", {
      confirmButtonText: "确定取消",
      cancelButtonText: "返回",
      type: "warning"
    });
    await cancelInstantOrder(row.orderNo);
    ElMessage.success("订单已取消");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "取消订单失败"));
    }
  }
}

async function handleRefund(row: any) {
  try {
    await ElMessageBox.confirm(`确定要对订单「${row.orderNo}」进行退款吗？`, "退款确认", {
      confirmButtonText: "确定退款",
      cancelButtonText: "取消",
      type: "warning"
    });
    await refundInstantOrder(row.orderNo);
    ElMessage.success("退款已处理");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "退款失败"));
    }
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
  flex-wrap: wrap;
  gap: 0;
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