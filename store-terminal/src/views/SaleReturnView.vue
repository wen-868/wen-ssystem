<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <div style="display: flex; gap: 12px">
        <el-date-picker
          v-model="filterDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="待审核" value="PENDING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-button type="primary" @click="loadReturns">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">新建退货</el-button>
    </div>

    <el-card>
      <el-table :data="returns" size="small">
        <el-table-column prop="returnNo" label="退货单号" width="140" />
        <el-table-column prop="sourceBillNo" label="原销售单号" width="140" />
        <el-table-column prop="customerName" label="客户名称" />
        <el-table-column prop="customerMobile" label="客户手机号" width="120" />
        <el-table-column prop="goodsAmount" label="退货金额" width="120">
          <template #default="{ row }">
            {{ formatYuan(row.goodsAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="refundAmount" label="应退金额" width="120">
          <template #default="{ row }">
            {{ formatYuan(row.refundAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="returnStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.returnStatus)" size="small">
              {{ getStatusName(row.returnStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="goToDetail(row.returnNo)">详情</el-button>
            <el-button
              v-if="row.returnStatus === 'PENDING'"
              size="small"
              type="primary"
              @click="handleApprove(row.returnNo)"
            >
              审核通过
            </el-button>
            <el-button
              v-if="row.returnStatus === 'PENDING'"
              size="small"
              type="danger"
              @click="showRejectDialog(row)"
            >
              驳回
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="total > 0"
        style="margin-top: 16px; text-align: right"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        @current-change="handlePageChange"
      />
      <div v-else style="text-align: center; padding: 40px; color: #999">暂无退货记录</div>
    </el-card>

    <!-- 新建退货弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建退货" width="700px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="原销售单号" required>
          <el-input
            v-model="createForm.sourceBillNo"
            placeholder="输入销售单号"
            @blur="loadSourceBill"
          />
        </el-form-item>
        <el-form-item v-if="sourceBill" label="原单信息">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="客户">{{ sourceBill.customerName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="金额">{{ formatYuan(sourceBill.receivableAmount || 0) }}</el-descriptions-item>
          </el-descriptions>
        </el-form-item>
        <el-form-item label="退货商品">
          <el-table :data="createForm.items" size="small">
            <el-table-column prop="skuName" label="商品名称" />
            <el-table-column prop="skuCode" label="商品编码" width="120" />
            <el-table-column prop="originalQty" label="原数量" width="80" />
            <el-table-column label="退货数量" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" :min="1" :max="row.originalQty" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价" width="100">
              <template #default="{ row }">
                {{ formatYuan(row.unitPrice || 0) }}
              </template>
            </el-table-column>
            <el-table-column label="退货原因" width="150">
              <template #default="{ row }">
                <el-input v-model="row.reason" placeholder="退货原因" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60">
              <template #default="{ row, $index }">
                <el-button size="small" type="danger" @click="createForm.items.splice($index, 1)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" @click="addReturnItem" style="margin-top: 12px">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 退货详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="退货详情" width="600px">
      <el-card v-if="returnDetail" style="margin-bottom: 16px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="退货单号">{{ returnDetail.returnNo }}</el-descriptions-item>
          <el-descriptions-item label="原销售单号">{{ returnDetail.sourceBillNo || "-" }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ returnDetail.customerName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="客户手机号">{{ returnDetail.customerMobile || "-" }}</el-descriptions-item>
          <el-descriptions-item label="退货金额">{{ formatYuan(returnDetail.goodsAmount || 0) }}</el-descriptions-item>
          <el-descriptions-item label="应退金额">{{ formatYuan(returnDetail.refundAmount || 0) }}</el-descriptions-item>
          <el-descriptions-item label="已退金额">{{ formatYuan(returnDetail.refundedAmount || 0) }}</el-descriptions-item>
          <el-descriptions-item label="退款方式">{{ getRefundMethodName(returnDetail.refundMethod) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(returnDetail.returnStatus)" size="small">
              {{ getStatusName(returnDetail.returnStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作人">{{ returnDetail.operatorName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ returnDetail.auditorName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="审核时间">{{ returnDetail.auditedAt || "-" }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ returnDetail.remark || "-" }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
      <el-table :data="returnDetail?.items || []" size="small">
        <el-table-column prop="skuName" label="商品名称" />
        <el-table-column prop="skuCode" label="商品编码" width="120" />
        <el-table-column prop="quantity" label="退货数量" width="100" />
        <el-table-column prop="unitPrice" label="单价" width="100">
          <template #default="{ row }">
            {{ formatYuan(row.unitPrice || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="subtotalAmount" label="小计" width="120">
          <template #default="{ row }">
            {{ formatYuan(row.subtotalAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="退货原因" />
      </el-table>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 驳回弹窗 -->
    <el-dialog v-model="showRejectDialogFlag" title="驳回退货" width="400px">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回原因" required>
          <el-input v-model="rejectForm.reason" type="textarea" :rows="3" placeholder="请填写驳回原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRejectDialogFlag = false">取消</el-button>
        <el-button type="danger" @click="handleReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchSaleReturns,
  createSaleReturn,
  fetchSaleReturnDetail,
  approveSaleReturn,
  rejectSaleReturn
} from "../api";
import { fetchSaleBillDetail } from "../api";
import { formatYuan } from "../utils/format";

const returns = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filterDate = ref("");
const filterStatus = ref("");

const showCreateDialog = ref(false);
const createForm = reactive({
  sourceBillNo: "",
  items: [] as Array<{ skuId: number; skuName: string; skuCode: string; originalQty: number; quantity: number; unitPrice: number; reason?: string }>,
  remark: ""
});

const sourceBill = ref<any>(null);

const showDetailDialog = ref(false);
const returnDetail = ref<any>(null);

const showRejectDialogFlag = ref(false);
const rejectingReturnNo = ref("");
const rejectForm = reactive({
  reason: ""
});

function getStatusName(status: string) {
  const map: Record<string, string> = {
    PENDING: "待审核",
    COMPLETED: "已完成",
    REJECTED: "已驳回",
    VOIDED: "已作废"
  };
  return map[status] || status;
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    COMPLETED: "success",
    REJECTED: "danger",
    VOIDED: "info"
  };
  return map[status] || "info";
}

function getRefundMethodName(method?: string) {
  const map: Record<string, string> = {
    CASH: "现金",
    WECHAT: "微信",
    ALIPAY: "支付宝",
    STORE_VALUE: "储值卡"
  };
  return map[method || ""] || "-";
}

async function loadReturns() {
  try {
    const data = await fetchSaleReturns({
      page: page.value,
      pageSize: pageSize.value,
      date: filterDate.value || undefined,
      returnStatus: filterStatus.value || undefined
    });
    returns.value = data?.records || [];
    total.value = data?.total || 0;
  } catch {
    ElMessage.warning("退货列表加载失败");
  }
}

function handlePageChange(newPage: number) {
  page.value = newPage;
  loadReturns();
}

function resetFilter() {
  filterDate.value = "";
  filterStatus.value = "";
  page.value = 1;
  loadReturns();
}

async function loadSourceBill() {
  if (!createForm.sourceBillNo.trim()) {
    sourceBill.value = null;
    createForm.items = [];
    return;
  }
  try {
    const data = await fetchSaleBillDetail(createForm.sourceBillNo.trim());
    sourceBill.value = data;
    if (data?.items) {
      createForm.items = data.items.map((item: any) => ({
        skuId: item.skuId,
        skuName: item.skuName,
        skuCode: item.barcode || "",
        originalQty: item.totalBottleQty || item.bottleQty || 0,
        quantity: 1,
        unitPrice: item.unitPrice || 0,
        reason: ""
      }));
    }
  } catch {
    ElMessage.warning("销售单不存在");
    sourceBill.value = null;
    createForm.items = [];
  }
}

function addReturnItem() {
  createForm.items.push({
    skuId: 0,
    skuName: "",
    skuCode: "",
    originalQty: 0,
    quantity: 1,
    unitPrice: 0,
    reason: ""
  });
}

async function goToDetail(returnNo: string) {
  try {
    const data = await fetchSaleReturnDetail(returnNo);
    returnDetail.value = data;
    showDetailDialog.value = true;
  } catch {
    ElMessage.warning("退货详情加载失败");
  }
}

async function handleCreate() {
  if (!createForm.sourceBillNo.trim()) {
    ElMessage.warning("请填写原销售单号");
    return;
  }
  if (createForm.items.length === 0) {
    ElMessage.warning("请添加退货商品");
    return;
  }
  const validItems = createForm.items.filter((item) => item.quantity > 0 && item.skuId > 0);
  if (validItems.length === 0) {
    ElMessage.warning("请填写有效的退货商品");
    return;
  }
  try {
    await createSaleReturn({
      sourceBillNo: createForm.sourceBillNo.trim(),
      items: validItems.map((item) => ({
        skuId: item.skuId,
        skuName: item.skuName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        reason: item.reason || undefined
      })),
      remark: createForm.remark || undefined
    });
    ElMessage.success("退货单创建成功");
    showCreateDialog.value = false;
    createForm.sourceBillNo = "";
    createForm.items = [];
    createForm.remark = "";
    sourceBill.value = null;
    loadReturns();
  } catch {
    ElMessage.error("创建失败");
  }
}

async function handleApprove(returnNo: string) {
  const confirmed = await ElMessageBox.confirm("确认审核通过该退货单？", "确认审核", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await approveSaleReturn(returnNo);
    ElMessage.success("审核通过");
    loadReturns();
  } catch {
    ElMessage.error("审核失败");
  }
}

function showRejectDialog(row: any) {
  rejectingReturnNo.value = row.returnNo;
  rejectForm.reason = "";
  showRejectDialogFlag.value = true;
}

async function handleReject() {
  if (!rejectForm.reason.trim()) {
    ElMessage.warning("请填写驳回原因");
    return;
  }
  try {
    await rejectSaleReturn(rejectingReturnNo.value, rejectForm.reason.trim());
    ElMessage.success("已驳回");
    showRejectDialogFlag.value = false;
    rejectForm.reason = "";
    loadReturns();
  } catch {
    ElMessage.error("操作失败");
  }
}

loadReturns();
</script>
