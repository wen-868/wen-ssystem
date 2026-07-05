<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>售后管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索售后单号/订单号/客户"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadAfterSales"
              @keyup.enter="loadAfterSales"
            />
            <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadAfterSales">
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已拒绝" value="REJECTED" />
              <el-option label="待收货" value="WAIT_RECEIPT" />
              <el-option label="待质检" value="WAIT_INSPECT" />
              <el-option label="已完成" value="COMPLETED" />
            </el-select>
            <el-select v-model="typeFilter" placeholder="类型" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadAfterSales">
              <el-option label="退货退款" value="RETURN_REFUND" />
              <el-option label="仅退款" value="REFUND_ONLY" />
              <el-option label="换货" value="EXCHANGE" />
              <el-option label="维修" value="REPAIR" />
            </el-select>
            <el-button @click="loadAfterSales">搜索</el-button>
            <el-button @click="loadAfterSales">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="6">
          <el-statistic title="售后总数" :value="statistics.total || 0" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="待处理" :value="statistics.pending || 0" value-style="color: #e6a23c" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="处理中" :value="statistics.processing || 0" value-style="color: #409eff" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已完成" :value="statistics.completed || 0" value-style="color: #67c23a" />
        </el-col>
      </el-row>

      <el-table :data="aftersales" v-loading="loading" stripe>
        <el-table-column prop="aftersaleNo" label="售后单号" width="180" />
        <el-table-column prop="orderNo" label="关联订单" width="180" />
        <el-table-column prop="customerName" label="客户" min-width="100" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'RETURN_REFUND'" type="warning">退货退款</el-tag>
            <el-tag v-else-if="row.type === 'REFUND_ONLY'" type="danger">仅退款</el-tag>
            <el-tag v-else-if="row.type === 'EXCHANGE'" type="primary">换货</el-tag>
            <el-tag v-else-if="row.type === 'REPAIR'" type="info">维修</el-tag>
            <el-tag v-else>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退款金额" width="110">
          <template #default="{ row }">
            <span class="refund-amount">-¥{{ Number(row.refundAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.status === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="row.status === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="row.status === 'WAIT_RECEIPT'" type="info">待收货</el-tag>
            <el-tag v-else-if="row.status === 'WAIT_INSPECT'" type="warning">待质检</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleApprove(row)">通过</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="handleReject(row)">拒绝</el-button>
            <el-button v-if="row.status === 'WAIT_RECEIPT'" size="small" link type="primary" @click="handleConfirmReceipt(row)">确认收货</el-button>
            <el-button v-if="row.status === 'WAIT_INSPECT'" size="small" link type="warning" @click="handleInspect(row)">质检</el-button>
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

    <el-drawer v-model="detailVisible" title="售后详情" size="560px">
      <template v-if="currentAftersale">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="售后单号">{{ currentAftersale.aftersaleNo }}</el-descriptions-item>
          <el-descriptions-item label="关联订单">{{ currentAftersale.orderNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentAftersale.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="售后类型">
            <el-tag v-if="currentAftersale.type === 'RETURN_REFUND'" type="warning">退货退款</el-tag>
            <el-tag v-else-if="currentAftersale.type === 'REFUND_ONLY'" type="danger">仅退款</el-tag>
            <el-tag v-else-if="currentAftersale.type === 'EXCHANGE'" type="primary">换货</el-tag>
            <el-tag v-else-if="currentAftersale.type === 'REPAIR'" type="info">维修</el-tag>
            <el-tag v-else>{{ currentAftersale.type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="退款金额">
            <span class="refund-amount">-¥{{ Number(currentAftersale.refundAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentAftersale.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="currentAftersale.status === 'APPROVED'" type="primary">已通过</el-tag>
            <el-tag v-else-if="currentAftersale.status === 'REJECTED'" type="danger">已拒绝</el-tag>
            <el-tag v-else-if="currentAftersale.status === 'WAIT_RECEIPT'" type="info">待收货</el-tag>
            <el-tag v-else-if="currentAftersale.status === 'WAIT_INSPECT'" type="warning">待质检</el-tag>
            <el-tag v-else-if="currentAftersale.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else>{{ currentAftersale.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请原因">{{ currentAftersale.reason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ currentAftersale.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">售后商品</h4>
        <el-table :data="currentAftersale.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="120">
            <template #default="{ row }">-¥{{ Number(row.subtotal || 0).toFixed(2) }}</template>
          </el-table-column>
        <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>
      </template>
    </el-drawer>

    <el-dialog v-model="inspectDialogVisible" title="质检处理" width="480px">
      <el-form ref="inspectFormRef" :model="inspectForm" :rules="inspectRules" label-width="100px">
        <el-form-item label="质检结果">
          <el-radio-group v-model="inspectForm.result">
            <el-radio value="PASS">通过</el-radio>
            <el-radio value="FAIL">不通过</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="质检备注">
          <el-input v-model="inspectForm.remark" type="textarea" :rows="3" placeholder="请输入质检备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="inspectLoading" @click="submitInspect">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import {
  fetchAfterSales,
  fetchAfterSaleStatistics,
  approveAfterSale,
  rejectAfterSale,
  confirmReceiptAfterSale,
  inspectAfterSale,
} from "../api";

const loading = ref(false);
const inspectLoading = ref(false);
const aftersales = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const typeFilter = ref("");
const detailVisible = ref(false);
const inspectDialogVisible = ref(false);
const currentAftersale = ref<any>(null);
const statistics = ref<any>({});

const inspectForm = reactive({
  result: "PASS",
  remark: "",
});

const inspectFormRef = ref();
const inspectRules: FormRules = {
  result: [{ required: true, message: "请选择质检结果", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadStatistics() {
  try {
    const data = await fetchAfterSaleStatistics();
    statistics.value = data || {};
  } catch (e) {
    // ignore
  }
}

async function loadAfterSales() {
  loading.value = true;
  try {
    const data = await fetchAfterSales({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      type: typeFilter.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    aftersales.value = data.records || [];
    total.value = data.total || aftersales.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载售后列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadAfterSales();
}

function handlePageChange(p: number) {
  page.value = p;
  loadAfterSales();
}

function viewDetail(row: any) {
  currentAftersale.value = row;
  detailVisible.value = true;
}

async function handleApprove(row: any) {
  const confirmed = await ElMessageBox.confirm(
    `确认通过售后单 ${row.aftersaleNo}?`,
    "确认通过",
    { type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;
  try {
    await approveAfterSale(row.id);
    ElMessage.success("已通过");
    loadAfterSales();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function handleReject(row: any) {
  const confirmed = await ElMessageBox.confirm(
    `确认拒绝售后单 ${row.aftersaleNo}?`,
    "确认拒绝",
    { type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;
  try {
    await rejectAfterSale(row.id);
    ElMessage.success("已拒绝");
    loadAfterSales();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function handleConfirmReceipt(row: any) {
  const confirmed = await ElMessageBox.confirm(
    `确认已收到售后单 ${row.aftersaleNo} 的退货商品?`,
    "确认收货",
    { type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;
  try {
    await confirmReceiptAfterSale(row.id);
    ElMessage.success("已确认收货");
    loadAfterSales();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

function handleInspect(row: any) {
  currentAftersale.value = row;
  inspectForm.result = "PASS";
  inspectForm.remark = "";
  inspectDialogVisible.value = true;
}

async function submitInspect() {
  if (!currentAftersale.value) return;
  const valid = await inspectFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  inspectLoading.value = true;
  try {
    await inspectAfterSale(currentAftersale.value.id, inspectForm);
    ElMessage.success("质检完成");
    inspectDialogVisible.value = false;
    loadAfterSales();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  } finally {
    inspectLoading.value = false;
  }
}

onMounted(() => {
  loadStatistics();
  loadAfterSales();
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
.refund-amount {
  color: #f56c6c;
  font-weight: 600;
}
</style>
