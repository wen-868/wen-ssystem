<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>采购入库</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索入库单号/供应商"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadInStocks"
              @keyup.enter="loadInStocks"
            />
            <el-select v-model="status" placeholder="全部状态" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadInStocks">
              <el-option label="待入库" value="PENDING" />
              <el-option label="部分入库" value="PARTIAL" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已作废" value="VOID" />
            </el-select>
            <el-button type="primary" @click="dialogVisible = true">
              <el-icon><Plus /></el-icon> 新建入库
            </el-button>
            <el-button @click="loadInStocks">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="inStocks" v-loading="loading" stripe>
        <el-table-column prop="inStockNo" label="入库单号" width="200" />
        <el-table-column prop="relatedOrderNo" label="关联订单号" width="200" />
        <el-table-column prop="supplierName" label="供应商" min-width="160" />
        <el-table-column prop="storeName" label="入库门店" width="120" />
        <el-table-column prop="totalAmount" label="入库金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">待入库</el-tag>
            <el-tag v-else-if="row.status === 'PARTIAL'" type="warning">部分入库</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="row.status === 'VOID'" type="danger">已作废</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="handleConfirm(row)">确认入库</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="handleVoid(row)">作废</el-button>
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

    <el-dialog v-model="dialogVisible" title="新建采购入库" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="关联采购单" prop="relatedOrderNo">
              <el-input v-model="form.relatedOrderNo" placeholder="请输入关联采购单号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商">
              <el-select v-model="form.supplierId" placeholder="请选择供应商" style="width: 100%" filterable>
                <el-option v-for="s in suppliers" :key="s.id" :label="s.supplierName" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="入库门店">
              <el-select v-model="form.storeId" style="width: 100%">
                <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入库单号">
              <el-input v-model="form.inStockNo" placeholder="系统自动生成，可手动输入" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="商品明细">
          <el-table :data="form.items" size="small" border>
            <el-table-column prop="skuName" label="商品名称" width="180">
              <template #default="{ row }">
                <el-input v-model="row.skuName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column prop="skuCode" label="SKU编码" width="140">
              <template #default="{ row }">
                <el-input v-model="row.skuCode" size="small" placeholder="SKU编码" />
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" :min="0" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价(元)" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="110">
              <template #default="{ row }">¥{{ Number((row.quantity || 0) * (row.unitPrice || 0)).toFixed(2) }}</template>
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

    <el-drawer v-model="detailVisible" title="入库单详情" size="600px">
      <template v-if="currentInStock">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="入库单号">{{ currentInStock.inStockNo }}</el-descriptions-item>
          <el-descriptions-item label="关联订单号">{{ currentInStock.relatedOrderNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentInStock.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="入库门店">{{ currentInStock.storeName }}</el-descriptions-item>
          <el-descriptions-item label="入库金额">¥{{ Number(currentInStock.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentInStock.status === 'PENDING'" type="info">待入库</el-tag>
            <el-tag v-else-if="currentInStock.status === 'PARTIAL'" type="warning">部分入库</el-tag>
            <el-tag v-else-if="currentInStock.status === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="currentInStock.status === 'VOID'" type="danger">已作废</el-tag>
            <el-tag v-else>{{ currentInStock.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentInStock.createTime }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentInStock.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品明细</h4>
        <el-table :data="currentInStock.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="skuCode" label="SKU编码" width="140" />
          <el-table-column prop="quantity" label="数量" width="80" />
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
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { purchaseInStock, fetchPurchaseInStocks, fetchSuppliers, fetchStores } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const inStocks = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const status = ref("");
const suppliers = ref<any[]>([]);
const stores = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const formRef = ref();
const rules = {
  relatedOrderNo: [{ required: true, message: "请输入关联采购单号", trigger: "blur" }]
};
const currentInStock = ref<any>(null);

const defaultForm = {
  relatedOrderNo: "",
  supplierId: 0,
  storeId: 0,
  inStockNo: "",
  remark: "",
  items: [{ skuId: 0, skuName: "", skuCode: "", quantity: 1, unitPrice: 0 }]
};

const form = reactive({ ...defaultForm, items: [{ ...defaultForm.items[0] }] });

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
});

async function loadInStocks() {
  loading.value = true;
  try {
    const data = await fetchPurchaseInStocks({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: status.value || undefined
    });
    inStocks.value = Array.isArray(data) ? data : (data.records || []);
    total.value = data.total || inStocks.value.length;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
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

async function loadStores() {
  try {
    const data = await fetchStores();
    stores.value = Array.isArray(data) ? data : (data.records || data || []);
  } catch (e) {
    console.error("加载门店失败", e);
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadInStocks();
}

function handlePageChange(p: number) {
  page.value = p;
  loadInStocks();
}

function addItem() {
  form.items.push({ skuId: 0, skuName: "", skuCode: "", quantity: 1, unitPrice: 0 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

function viewDetail(row: any) {
  currentInStock.value = row;
  detailVisible.value = true;
}

async function handleConfirm(row: any) {
  try {
    await ElMessageBox.confirm("确定确认该入库单吗？确认后库存将增加。", "提示", { type: "warning" });
    ElMessage.success("确认成功");
    loadInStocks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.message || "操作失败");
    }
  }
}

async function handleVoid(row: any) {
  try {
    await ElMessageBox.confirm("确定作废该入库单吗？", "提示", { type: "warning" });
    ElMessage.success("作废成功");
    loadInStocks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.message || "操作失败");
    }
  }
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!form.supplierId) {
    ElMessage.warning("请选择供应商");
    return;
  }
  if (form.items.length === 0 || !form.items.some(i => i.skuName && i.quantity > 0)) {
    ElMessage.warning("请添加有效的商品明细");
    return;
  }
  submitLoading.value = true;
  try {
    await purchaseInStock(form);
    ElMessage.success("创建成功");
    dialogVisible.value = false;
    Object.assign(form, { ...defaultForm, items: [{ skuId: 0, skuName: "", skuCode: "", quantity: 1, unitPrice: 0 }] });
    loadInStocks();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "创建失败");
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  loadInStocks();
  loadSuppliers();
  loadStores();
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
.total-amount {
  color: #f56c6c;
  font-size: 18px;
  font-weight: 600;
}
</style>
