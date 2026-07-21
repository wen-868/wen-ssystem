<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>采购订单</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索订单号"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadOrders"
              @keyup.enter="loadOrders"
            />
            <el-select v-model="orderStatus" placeholder="全部状态" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadOrders">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="待确认" value="PENDING" />
              <el-option label="已确认" value="APPROVED" />
              <el-option label="部分入库" value="PARTIAL" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-button type="primary" @click="dialogVisible = true">
              <el-icon><Plus /></el-icon> 新建采购单
            </el-button>
            <el-button @click="loadOrders">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="supplierName" label="供应商" width="160" />
        <el-table-column prop="storeId" label="门店ID" width="100" />
        <el-table-column prop="goodsAmount" label="商品金额" width="120">
          <template #default="{ row }">¥{{ Number(row.goodsAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="taxAmount" label="税额" width="100">
          <template #default="{ row }">¥{{ Number(row.taxAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="payableAmount" label="应付金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.payableAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已付金额" width="100">
          <template #default="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="订单状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.orderStatus === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="row.orderStatus === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="row.orderStatus === 'APPROVED'" type="success">已确认</el-tag>
            <el-tag v-else-if="row.orderStatus === 'PARTIAL'" type="warning">部分入库</el-tag>
            <el-tag v-else-if="row.orderStatus === 'CANCELLED'" type="danger">已取消</el-tag>
            <el-tag v-else>{{ row.orderStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.orderStatus === 'DRAFT' || row.orderStatus === 'PENDING'" size="small" link type="success" @click="handleConfirm(row)">确认</el-button>
            <el-button v-if="row.orderStatus === 'DRAFT' || row.orderStatus === 'PENDING'" size="small" link type="danger" @click="handleCancel(row)">取消</el-button>
            <el-button v-if="row.orderStatus === 'APPROVED' || row.orderStatus === 'PARTIAL'" size="small" link type="primary" @click="handleInStock(row)">入库</el-button>
          </template>
        </el-table-column>
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

    <el-dialog v-model="dialogVisible" title="新建采购订单" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId">
              <el-select v-model="form.supplierId" placeholder="请选择供应商" style="width: 100%">
                <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门店" prop="storeId">
              <el-select v-model="form.storeId" style="width: 100%">
                <el-option label="默认门店" :value="1" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="预计到货日期" prop="expectedDate">
              <el-date-picker
                v-model="form.expectedDate"
                type="date"
                placeholder="请选择预计到货日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="商品明细">
          <el-table :data="form.items" size="small" border>
            <el-table-column prop="skuName" label="商品名称" width="160">
              <template #default="{ row }">
                <el-input v-model="row.skuName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column prop="bottleQty" label="数量(瓶)" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.bottleQty" :min="0" size="small" style="width: 100%" @change="updateTotalBottleQty(row)" />
              </template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价(元)" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="110">
              <template #default="{ row }">¥{{ Number((row.totalBottleQty || 0) * (row.unitPrice || 0)).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" @click="removeItem($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" plain style="margin-top: 10px" @click="addItem">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="合计金额">
          <span class="total-amount">¥{{ totalAmount.toFixed(2) }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="采购订单详情" size="600px">
      <template v-if="currentOrder">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ currentOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentOrder.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="门店ID">{{ currentOrder.storeId }}</el-descriptions-item>
          <el-descriptions-item label="预计到货日期">{{ currentOrder.expectedDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag v-if="currentOrder.orderStatus === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PENDING'" type="warning">待确认</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'APPROVED'" type="success">已确认</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'PARTIAL'" type="warning">部分入库</el-tag>
            <el-tag v-else-if="currentOrder.orderStatus === 'CANCELLED'" type="danger">已取消</el-tag>
            <el-tag v-else>{{ currentOrder.orderStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商品金额">¥{{ Number(currentOrder.goodsAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="税额">¥{{ Number(currentOrder.taxAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="应付金额">¥{{ Number(currentOrder.payableAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ Number(currentOrder.paidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="未付金额">¥{{ Number(currentOrder.unpaidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentOrder.createdAt }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品明细</h4>
        <el-table :data="currentOrder.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="bottleQty" label="瓶数" width="80" />
          <el-table-column prop="totalBottleQty" label="总瓶数" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotalAmount" label="小计" width="100">
            <template #default="{ row }">¥{{ Number(row.subtotalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  fetchPurchaseOrderDetail,
  fetchPurchaseOrders,
  fetchSuppliers
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const orders = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const orderStatus = ref("");
const suppliers = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentOrder = ref<any>(null);

const defaultForm = {
  supplierId: 0,
  storeId: 1,
  expectedDate: "",
  remark: "",
  items: [{ skuId: 0, skuName: "", bottleQty: 1, totalBottleQty: 1, unitPrice: 0 }]
};

const form = reactive({ ...defaultForm, items: [{ ...defaultForm.items[0] }] });

const formRef = ref();
const rules: FormRules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }],
  storeId: [{ required: true, message: "请选择门店", trigger: "change" }]
};

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + (item.totalBottleQty || 0) * (item.unitPrice || 0), 0);
});

function updateTotalBottleQty(row: any) {
  row.totalBottleQty = row.bottleQty || 0;
}

async function loadOrders() {
  loading.value = true;
  try {
    const data = await fetchPurchaseOrders({
      page: page.value,
      pageSize: pageSize.value,
      status: orderStatus.value || undefined
    });
    orders.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    const data = await fetchSuppliers({ page: 1, pageSize: 100 });
    suppliers.value = data.records || data || [];
  } catch (e) {
    console.error("加载供应商失败", e);
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

function addItem() {
  form.items.push({ skuId: 0, skuName: "", bottleQty: 1, totalBottleQty: 1, unitPrice: 0 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

async function viewDetail(row: any) {
  try {
    currentOrder.value = await fetchPurchaseOrderDetail(row.id);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载详情失败");
  }
}

async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm("确定确认该采购订单吗？", "提示", { type: "warning" });
    await confirmPurchaseOrder(row.id);
    ElMessage.success("确认成功");
    loadOrders();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "确认失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该采购订单吗？", "提示", { type: "warning" });
    await cancelPurchaseOrder(row.id);
    ElMessage.success("取消成功");
    loadOrders();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "取消失败");
    }
  }
}

function handleInStock(row: any) {
  ElMessage.info("入库功能待实现");
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (form.items.length === 0 || !form.items.some(i => i.skuName && i.totalBottleQty > 0)) {
    ElMessage.warning("请添加有效的商品明细");
    return;
  }
  submitLoading.value = true;
  try {
    await createPurchaseOrder(form);
    ElMessage.success("创建成功");
    dialogVisible.value = false;
    Object.assign(form, { ...defaultForm, items: [{ skuId: 0, skuName: "", bottleQty: 1, totalBottleQty: 1, unitPrice: 0 }] });
    loadOrders();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "创建失败");
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  loadOrders();
  loadSuppliers();
});
</script>

<style scoped>
.page { padding: 0; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions { display: flex; align-items: center; }
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.amount-text { color: #f56c6c; font-weight: 600; }
.total-amount { color: #f56c6c; font-size: 18px; font-weight: 600; }
</style>