<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">销售退货</h2>
    <p class="page-desc">退货登记、审核与退款进度跟踪</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="createVisible = true">
      <el-icon><Plus /></el-icon>&nbsp;新建退货单
    </el-button>
  </div>
</div>

      <div class="filter-bar">
        <el-select v-model="returnStatus" placeholder="退货状态" clearable size="small" style="width: 140px">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已批准" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="已完成" value="COMPLETED" />
        </el-select>
        <el-button type="primary" size="small" @click="page = 1; loadList()">查询</el-button>
        <el-button size="small" @click="returnStatus = ''; page = 1; loadList()">重置</el-button>
      </div>

      <div class="table-card">
<el-table v-loading="loading" :data="records" size="small" style="width: 100%">
        <el-table-column prop="return_no" label="退货单号" width="160" />
        <el-table-column prop="source_bill_no" label="原销售单号" width="160" />
        <el-table-column prop="refund_amount" label="退货金额" width="100">
          <template #default="{ row }">¥{{ Number(row.refund_amount ?? 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="return_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.return_status || row.status)" size="small">{{ getStatusText(row.return_status || row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row.return_no || row.returnNo)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
</div>

      <div class="table-card-footer" v-if="total > 0">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadList"
          @size-change="page = 1; loadList()"
        />
      </div>
    

    <el-dialog v-model="detailVisible" title="退货单详情" width="720px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="退货单号">{{ detail.return_no || detail.returnNo || "—" }}</el-descriptions-item>
        <el-descriptions-item label="原销售单号">{{ detail.source_bill_no || detail.sourceBillNo || "—" }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customer_name || detail.customerName || "—" }}</el-descriptions-item>
        <el-descriptions-item label="客户手机">{{ detail.customer_mobile || detail.customerMobile || "—" }}</el-descriptions-item>
        <el-descriptions-item label="商品金额">¥{{ Number(detail.goods_amount ?? detail.goodsAmount ?? 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="优惠金额">¥{{ Number(detail.discount_amount ?? detail.discountAmount ?? 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="应退金额">¥{{ Number(detail.refund_amount ?? detail.refundAmount ?? 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="已退金额">¥{{ Number(detail.refunded_amount ?? detail.refundedAmount ?? 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detail.return_status || detail.returnStatus || detail.status)" size="small">
            {{ getStatusText(detail.return_status || detail.returnStatus || detail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="退款方式">{{ getRefundMethodText(detail.refund_method || detail.refundMethod) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.created_at || detail.createdAt || "—" }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || "—" }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-items-title">商品明细</div>
      <el-table :data="detail.items || []" size="small" empty-text="暂无商品明细">
        <el-table-column prop="sku_name" label="商品" min-width="140" />
        <el-table-column prop="box_qty" label="箱数" width="70" />
        <el-table-column prop="bottle_qty" label="瓶数" width="70" />
        <el-table-column prop="total_bottle_qty" label="合计数量" width="90" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">¥{{ Number(row.unit_price || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="合计金额" width="110">
          <template #default="{ row }">¥{{ Number(row.subtotal_amount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="退货原因" min-width="120" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新建退货单" width="720px">
      <el-form label-width="100px">
        <el-form-item label="原销售单号" required>
          <el-input v-model="createForm.sourceBillNo" placeholder="请输入原销售单号" />
        </el-form-item>
        <el-form-item label="退货商品">
          <div v-for="(item, idx) in createForm.items" :key="idx" class="return-item">
            <el-input v-model="item.skuName" placeholder="商品名称" style="width: 140px" />
            <el-input-number v-model="item.quantity" :min="1" placeholder="数量" style="width: 120px" />
            <el-input-number v-model="item.unitPrice" :min="0" :precision="2" placeholder="单价" style="width: 120px" />
            <el-button link type="danger" @click="createForm.items.splice(idx, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="createForm.items.push({ skuId: 0, skuName: '', quantity: 1, unitPrice: 0 })">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <FormFooter
          :loading="submitting"
          :show-save-and-add="false"
          save-text="提交"
          @cancel="createVisible = false"
          @save="submitCreate"
        />
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { fetchStoreSaleReturns, fetchSaleReturnDetail, createStoreSaleReturn } from "../../api";
import FormFooter from "../../components/FormFooter.vue";

const loading = ref(false);
const submitting = ref(false);
const returnStatus = ref("");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const createVisible = ref(false);
const detailVisible = ref(false);
const detail = ref<any>({});
const createForm = reactive<{ sourceBillNo: string; items: any[]; remark: string }>({
  sourceBillNo: "",
  items: [],
  remark: ""
});

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "primary",
    REJECTED: "danger",
    COMPLETED: "success"
  };
  return map[status] || "info";
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已批准",
    REJECTED: "已拒绝",
    COMPLETED: "已完成"
  };
  return map[status] || status || "未知";
}

function getRefundMethodText(method?: string) {
  const map: Record<string, string> = { CASH: "现金", WECHAT: "微信", BANK: "银行卡" };
  return (method && map[method]) || method || "—";
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchStoreSaleReturns({
      page: page.value,
      pageSize: pageSize.value,
      returnStatus: returnStatus.value || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载退货单失败");
  } finally {
    loading.value = false;
  }
}

async function viewDetail(returnNo: string) {
  if (!returnNo) {
    ElMessage.warning("退货单号为空，无法查看详情");
    return;
  }
  try {
    const data = await fetchSaleReturnDetail(returnNo);
    detail.value = data || {};
    detailVisible.value = true;
  } catch {
    ElMessage.error("加载详情失败");
  }
}

async function submitCreate() {
  if (!createForm.sourceBillNo) {
    ElMessage.warning("请输入原销售单号");
    return;
  }
  if (createForm.items.length === 0) {
    ElMessage.warning("请添加退货商品");
    return;
  }
  submitting.value = true;
  try {
    await createStoreSaleReturn({
      sourceBillNo: createForm.sourceBillNo,
      items: createForm.items.map((item) => ({
        skuId: Number(item.skuId || 0),
        skuName: item.skuName,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0)
      })),
      remark: createForm.remark
    });
    ElMessage.success("退货单已创建");
    createVisible.value = false;
    createForm.sourceBillNo = "";
    createForm.items = [];
    createForm.remark = "";
    await loadList();
  } catch {
    ElMessage.error("创建退货单失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-sale-return {
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
.return-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.detail-items-title {
  margin: 16px 0 8px;
  font-weight: 600;
}
</style>
