<template>
  <div class="page">
    <el-card>
      <div class="filter-bar">
        <div class="filter-left">
          <el-select v-model="statusFilter" placeholder="订单状态" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="待确认" value="PENDING" />
            <el-option label="已确认" value="CONFIRMED" />
            <el-option label="备货中" value="PREPARING" />
            <el-option label="配送中" value="DELIVERING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
            <el-option label="已退款" value="REFUNDED" />
          </el-select>
          <el-select v-model="paymentFilter" placeholder="支付状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="未支付" value="UNPAID" />
            <el-option label="已支付" value="PAID" />
            <el-option label="已退款" value="REFUNDED" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 360px; margin-right: 12px"
            @change="loadData"
          />
        </div>
        <div class="filter-right">
          <el-input
            v-model="keyword"
            placeholder="搜索订单号"
            clearable
            style="width: 220px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="loadData">
            <el-icon style="margin-right: 4px"><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="orders" stripe @row-click="viewDetail">
        <el-table-column prop="orderNo" label="订单号" width="200">
          <template #default="{ row }">
            <span class="order-no-text">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="110">
          <template #default="{ row }">
            <el-tag :type="getPlatformTagType(row.platform)" size="small">{{ getPlatformName(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="收货人" min-width="140">
          <template #default="{ row }">
            <div class="user-info">
              <div class="user-name">{{ row.receiverName || '-' }}</div>
              <div class="user-phone">{{ row.receiverPhone || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="110" align="right">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优惠" width="100" align="right">
          <template #default="{ row }">
            <span class="discount-text">-¥{{ Number(row.discountAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="配送费" width="100" align="right">
          <template #default="{ row }">
            <span>¥{{ Number(row.deliveryFee || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实付" width="110" align="right">
          <template #default="{ row }">
            <span class="pay-amount">¥{{ Number(row.payAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="配送方式" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.deliveryType === 'DELIVERY'" type="primary" size="small">配送</el-tag>
            <el-tag v-else type="success" size="small">自提</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.paymentStatus === 'PAID'" type="success" size="small">已支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'UNPAID'" type="danger" size="small">未支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'REFUNDED'" type="warning" size="small">已退款</el-tag>
            <el-tag v-else size="small">{{ row.paymentStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.orderStatus)" size="small">{{ getStatusName(row.orderStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="viewDetail(row)">详情</el-button>
            <el-button v-if="row.orderStatus === 'PENDING'" size="small" link type="success" @click.stop="handleConfirm(row)">确认</el-button>
            <el-button v-if="['PENDING', 'CONFIRMED'].includes(row.orderStatus)" size="small" link type="danger" @click.stop="handleCancel(row)">取消</el-button>
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

    <el-drawer
      v-model="detailVisible"
      title="订单详情"
      size="900px"
      :close-on-click-modal="false"
      class="order-detail-drawer"
    >
      <div v-if="detail" v-loading="detailLoading" class="detail-content">
        <div class="detail-section">
          <div class="section-title">
            <el-icon><InfoFilled /></el-icon>
            订单基本信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="平台">{{ getPlatformName(detail.platform) }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="getStatusTagType(detail.orderStatus)" size="small">{{ getStatusName(detail.orderStatus) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="支付状态">
              <el-tag v-if="detail.paymentStatus === 'PAID'" type="success" size="small">已支付</el-tag>
              <el-tag v-else-if="detail.paymentStatus === 'UNPAID'" type="danger" size="small">未支付</el-tag>
              <el-tag v-else type="warning" size="small">已退款</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="配送方式">{{ detail.deliveryType === 'DELIVERY' ? '配送' : '自提' }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ detail.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ detail.paymentMethod || '-' }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ detail.paymentTime || '-' }}</el-descriptions-item>
            <el-descriptions-item label="平台订单号">{{ detail.platformOrderId || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Location /></el-icon>
            收货信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="收货人">{{ detail.receiverName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.receiverPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货地址" :span="2">{{ detail.deliveryAddress || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div v-if="detail.remark" class="detail-section">
          <div class="section-title">
            <el-icon><ChatDotRound /></el-icon>
            订单备注
          </div>
          <div class="remark-box">{{ detail.remark }}</div>
        </div>

        <div v-if="detail.cancelReason" class="detail-section">
          <div class="section-title">
            <el-icon><CircleClose /></el-icon>
            取消原因
          </div>
          <div class="remark-box">{{ detail.cancelReason }}</div>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Goods /></el-icon>
            商品明细
          </div>
          <el-table :data="detail.items || []" size="small" border>
            <el-table-column label="商品图片" width="70" align="center">
              <template #default="{ row }">
                <el-image
                  v-if="row.productImage" lazy
                  :src="row.productImage"
                  fit="cover"
                  style="width: 48px; height: 48px; border-radius: 4px"
                />
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="200" />
            <el-table-column label="单价" width="100" align="right">
              <template #default="{ row }">
                ¥{{ Number(row.price || 0).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="70" align="center" />
            <el-table-column label="小计" width="110" align="right">
              <template #default="{ row }">
                <span class="amount-text">¥{{ Number(row.subtotal || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Wallet /></el-icon>
            支付信息
          </div>
          <div class="amount-summary">
            <div class="amount-row">
              <span class="amount-label">商品总金额</span>
              <span class="amount-value">¥{{ Number(detail.totalAmount || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">优惠金额</span>
              <span class="amount-value discount-text">-¥{{ Number(detail.discountAmount || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">配送费</span>
              <span class="amount-value">¥{{ Number(detail.deliveryFee || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row total">
              <span class="amount-label">实付金额</span>
              <span class="amount-value pay-amount">¥{{ Number(detail.payAmount || 0).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div v-if="detail.deliveryType === 'DELIVERY'" class="detail-section">
          <div class="section-title">
            <el-icon><Van /></el-icon>
            配送信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="配送地址">{{ detail.deliveryAddress || '-' }}</el-descriptions-item>
            <el-descriptions-item label="配送时间">{{ detail.deliveryTime || '-' }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ detail.completedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="取消时间">{{ detail.cancelledAt || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button v-if="detail?.orderStatus === 'PENDING'" type="success" @click="handleConfirm(detail)">确认订单</el-button>
          <el-button v-if="['PENDING', 'CONFIRMED'].includes(detail?.orderStatus)" type="danger" @click="handleCancel(detail)">取消订单</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="cancelDialogVisible" title="取消订单" width="480px">
      <el-form ref="cancelFormRef" :model="cancelForm" :rules="cancelRules" label-width="100px">
        <el-form-item label="订单号">
          <el-input v-model="cancelForm.orderNo" disabled />
        </el-form-item>
        <el-form-item label="取消原因" prop="reason">
          <el-input v-model="cancelForm.reason" type="textarea" :rows="2" placeholder="请输入取消原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialogVisible = false">返回</el-button>
        <el-button type="danger" :loading="cancelLoading" @click="submitCancel">确定取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, InfoFilled, Location, ChatDotRound, Goods, Wallet, Van, CircleClose } from "@element-plus/icons-vue";
import {
  fetchInstantOrders,
  fetchInstantOrderDetail,
  updateInstantOrderStatus,
  getErrorMessage
} from "../../api";

const loading = ref(false);
const orders = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const paymentFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<any>(null);

const cancelDialogVisible = ref(false);
const cancelFormRef = ref<FormInstance>();
const cancelLoading = ref(false);

const cancelForm = reactive({
  orderNo: "",
  reason: ""
});

const cancelRules: FormRules = {
  reason: [{ required: true, message: "请输入取消原因", trigger: "blur" }]
};

const statusMap: Record<string, { name: string; type: string }> = {
  PENDING: { name: "待确认", type: "primary" },
  CONFIRMED: { name: "已确认", type: "" },
  PREPARING: { name: "备货中", type: "warning" },
  DELIVERING: { name: "配送中", type: "info" },
  COMPLETED: { name: "已完成", type: "success" },
  CANCELLED: { name: "已取消", type: "info" },
  REFUNDED: { name: "已退款", type: "danger" }
};

const platformMap: Record<string, { name: string; type: string }> = {
  MEITUAN: { name: "美团外卖", type: "danger" },
  ELEME: { name: "饿了么", type: "primary" },
  JD: { name: "京东到家", type: "success" },
  MINIAPP: { name: "自有小程序", type: "warning" }
};

function getStatusName(status: string) {
  return statusMap[status]?.name || status;
}

function getStatusTagType(status: string) {
  return statusMap[status]?.type || "info";
}

function getPlatformName(platform: string) {
  return platformMap[platform]?.name || platform || "-";
}

function getPlatformTagType(platform: string) {
  return platformMap[platform]?.type || "info";
}

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    };
    if (statusFilter.value) params.status = statusFilter.value;
    if (paymentFilter.value) params.paymentStatus = paymentFilter.value;
    if (keyword.value) params.orderNo = keyword.value.trim();
    if (dateRange.value?.[0]) params.startDate = dateRange.value[0];
    if (dateRange.value?.[1]) params.endDate = dateRange.value[1];
    const result = await fetchInstantOrders(params);
    const list = result?.list ?? result?.records ?? [];
    orders.value = list.map(mapOrderRow);
    total.value = Number(result?.total ?? 0);
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "加载订单列表失败"));
    orders.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function mapOrderRow(row: any) {
  return {
    ...row,
    orderNo: row.orderNo ?? row.order_no,
    orderStatus: row.orderStatus ?? row.order_status,
    paymentStatus: row.paymentStatus ?? row.payment_status,
    paymentMethod: row.paymentMethod ?? row.payment_method,
    paymentTime: row.paymentTime ?? row.payment_time,
    deliveryType: row.deliveryType ?? row.delivery_type,
    deliveryAddress: row.deliveryAddress ?? row.delivery_address,
    receiverName: row.receiverName ?? row.receiver_name,
    receiverPhone: row.receiverPhone ?? row.receiver_phone,
    totalAmount: row.totalAmount ?? row.total_amount,
    discountAmount: row.discountAmount ?? row.discount_amount,
    deliveryFee: row.deliveryFee ?? row.delivery_fee,
    payAmount: row.payAmount ?? row.pay_amount,
    cancelReason: row.cancelReason ?? row.cancel_reason,
    cancelledAt: row.cancelledAt ?? row.cancelled_at,
    completedAt: row.completedAt ?? row.completed_at,
    platformOrderId: row.platformOrderId ?? row.platform_order_id,
    createdAt: row.createdAt ?? row.created_at
  };
}

function resetFilters() {
  keyword.value = "";
  statusFilter.value = "";
  paymentFilter.value = "";
  dateRange.value = null;
  page.value = 1;
  loadData();
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
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = row;
  try {
    const result = await fetchInstantOrderDetail(row.orderNo);
    detail.value = mapOrderRow(result);
    if (Array.isArray(result.items)) {
      detail.value.items = result.items;
    }
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "加载订单详情失败"));
  } finally {
    detailLoading.value = false;
  }
}

async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm(`确定要确认订单「${row.orderNo}」吗？`, "确认订单", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await updateInstantOrderStatus(row.orderNo, { status: "CONFIRMED" });
    ElMessage.success("订单已确认");
    if (detail.value?.orderNo === row.orderNo) {
      detail.value.orderStatus = "CONFIRMED";
    }
    loadData();
  } catch (e) {
    if (e === "cancel" || e === "close") return;
    ElMessage.error(getErrorMessage(e, "确认订单失败"));
  }
}

function handleCancel(row: any) {
  cancelForm.orderNo = row.orderNo;
  cancelForm.reason = "";
  cancelDialogVisible.value = true;
}

async function submitCancel() {
  if (!cancelFormRef.value) return;
  const valid = await cancelFormRef.value.validate().catch(() => false);
  if (!valid) return;
  cancelLoading.value = true;
  try {
    await updateInstantOrderStatus(cancelForm.orderNo, {
      status: "CANCELLED",
      reason: cancelForm.reason
    });
    ElMessage.success("订单已取消");
    cancelDialogVisible.value = false;
    if (detail.value?.orderNo === cancelForm.orderNo) {
      detail.value.orderStatus = "CANCELLED";
    }
    loadData();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "取消订单失败"));
  } finally {
    cancelLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-left, .filter-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}
.order-no-text {
  font-family: monospace;
  color: var(--el-color-primary);
  cursor: pointer;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-name {
  font-weight: 500;
}
.user-phone {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.amount-text {
  font-weight: 500;
}
.discount-text {
  color: var(--el-color-success);
}
.pay-amount {
  color: var(--el-color-danger);
  font-weight: 600;
  font-size: 15px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-content {
  padding: 0 4px;
}
.detail-section {
  margin-bottom: 24px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
.remark-box {
  padding: 12px 16px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.amount-summary {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px 16px;
}
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.amount-row.total {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 6px;
  padding-top: 12px;
  font-size: 16px;
}
.amount-label {
  color: var(--el-text-color-regular);
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
