<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>小程序订单</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索订单号/收货人"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadOrders"
              @keyup.enter="loadOrders"
            />
            <el-select v-model="orderStatus" placeholder="订单状态" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadOrders">
              <el-option label="待付款" value="PENDING_PAY" />
              <el-option label="待发货" value="PENDING_SHIP" />
              <el-option label="待收货" value="PENDING_RECEIVE" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已取消" value="CANCELLED" />
              <el-option label="已退款" value="REFUNDED" />
            </el-select>
            <el-select v-model="payStatus" placeholder="支付状态" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadOrders">
              <el-option label="未支付" value="UNPAID" />
              <el-option label="已支付" value="PAID" />
              <el-option label="已退款" value="REFUNDED" />
            </el-select>
            <el-button @click="loadOrders">刷新</el-button>
          </div>
        </div>
      </template>

      <TableSkeleton v-if="loading" />
      <el-table v-else :data="orders" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="customerType" label="客户类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.customerType === 'RETAIL'" type="primary">零售</el-tag>
            <el-tag v-else-if="row.customerType === 'WHOLESALE'" type="success">批发</el-tag>
            <el-tag v-else>{{ row.customerType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="订单状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.orderStatus === 'PENDING_PAY'" type="warning">待付款</el-tag>
            <el-tag v-else-if="row.orderStatus === 'PENDING_SHIP'" type="primary">待发货</el-tag>
            <el-tag v-else-if="row.orderStatus === 'PENDING_RECEIVE'" type="info">待收货</el-tag>
            <el-tag v-else-if="row.orderStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="row.orderStatus === 'CANCELLED'" type="info">已取消</el-tag>
            <el-tag v-else-if="row.orderStatus === 'REFUNDED'" type="danger">已退款</el-tag>
            <el-tag v-else>{{ row.orderStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="payStatus" label="支付状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.payStatus === 'UNPAID'" type="danger">未支付</el-tag>
            <el-tag v-else-if="row.payStatus === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else-if="row.payStatus === 'REFUNDED'" type="warning">已退款</el-tag>
            <el-tag v-else>{{ row.payStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="receiverName" label="收货人" width="100" />
        <el-table-column prop="receiverPhone" label="联系电话" width="130" />
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
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
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="订单详情" size="600px">
      <template v-if="currentOrder">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ currentOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="客户类型">
            <el-tag v-if="currentOrder.customerType === 'RETAIL'" type="primary">零售</el-tag>
            <el-tag v-else-if="currentOrder.customerType === 'WHOLESALE'" type="success">批发</el-tag>
            <el-tag v-else>{{ currentOrder.customerType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag v-if="currentOrder.orderStatus === 'PENDING_PAY'" type="warning">待付款</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PENDING_SHIP'" type="primary">待发货</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PENDING_RECEIVE'" type="info">待收货</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ currentOrder.orderStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付状态">
            <el-tag v-if="currentOrder.payStatus === 'UNPAID'" type="danger">未支付</el-tag>
            <el-tag v-else-if="currentOrder.payStatus === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else>{{ currentOrder.payStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商品金额">¥{{ Number(currentOrder.goodsAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="运费">¥{{ Number(currentOrder.shippingFee || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">
            <span class="amount-text">¥{{ Number(currentOrder.totalAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="实付金额">¥{{ Number(currentOrder.paidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="收货人">{{ currentOrder.receiverName }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.receiverPhone }}</el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="2">{{ currentOrder.receiverAddress }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentOrder.createTime }}</el-descriptions-item>
          <el-descriptions-item label="支付时间">{{ currentOrder.payTime || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentOrder.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品明细</h4>
        <el-table :data="currentOrder.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="skuCode" label="SKU编码" width="140" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotalAmount" label="小计" width="100">
            <template #default="{ row }">¥{{ Number(row.subtotalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import TableSkeleton from "../components/TableSkeleton.vue";
import { fetchOrderDetail, fetchOrders } from "../api";

const loading = ref(false);
const orders = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const orderStatus = ref("");
const payStatus = ref("");
const detailVisible = ref(false);
const currentOrder = ref<any>(null);

async function loadOrders() {
  loading.value = true;
  try {
    const data = await fetchOrders({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: orderStatus.value || undefined
    });
    orders.value = Array.isArray(data) ? data : (data.records || []);
    total.value = data.total || orders.value.length;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadOrders();
}

function handlePageChange(p: number) {
  page.value = p;
  loadOrders();
}

async function viewDetail(row: any) {
  try {
    currentOrder.value = await fetchOrderDetail(row.orderNo);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载详情失败");
  }
}

onMounted(() => {
  loadOrders();
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
