<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">限时秒杀</h2>
      <p class="page-desc">秒杀活动配置与执行</p>
    </div>
  </div>
<el-card>
      <div class="filter-bar">
        <div class="filter-bar">
          <el-select v-model="statusFilter" placeholder="活动状态" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
            <el-option label="已售罄" value="SOLD_OUT" />
          </el-select>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="openDialog()">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>
            新建秒杀活动
          </el-button>
          <el-button @click="loadData">
            <el-icon style="margin-right: 4px"><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div class="table-card">
<el-table :data="activities" v-loading="loading" stripe>
        <el-table-column prop="name" label="活动名称" min-width="160" />
        <el-table-column label="秒杀价" width="110" align="center">
          <template #default="{ row }">
            <span class="price-text">¥{{ Number(row.seckillPrice || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="原价" width="110" align="center">
          <template #default="{ row }">
            <span class="original-price">¥{{ Number(row.originalPrice || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="折扣" width="80" align="center">
          <template #default="{ row }">
            <el-tag type="danger" size="small">{{ row.discountRate }}折</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="秒杀时间" width="280">
          <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
        </el-table-column>
        <el-table-column label="库存" width="120" align="center">
          <template #default="{ row }">
            {{ row.soldCount }} / {{ row.totalStock }}
            <el-progress
              :percentage="row.totalStock > 0 ? Math.round(row.soldCount / row.totalStock * 100) : 0"
              :stroke-width="4"
              :show-text="false"
              style="margin-top: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column label="每人限购" width="80" align="center">
          <template #default="{ row }">{{ row.limitPerUser }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
            <el-tag v-else-if="row.status === 'SOLD_OUT'" type="warning">已售罄</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="handlePause(row)">停用</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="handleSizeChange" @current-change="handlePageChange"
        />
      </div>
</div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑秒杀活动' : '新建秒杀活动'"
      width="720px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="秒杀商品" prop="productName">
          <div class="product-select">
            <el-input v-model="form.productName" placeholder="点击选择商品" readonly style="width: 300px" />
            <el-button type="primary" @click="openProductPicker">选择商品</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="秒杀价" prop="seckillPrice">
              <el-input-number v-model="form.seckillPrice" :min="0.01" :precision="2" style="width: 100%" />
              <span class="form-hint">元</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原价">
              <el-input-number v-model="form.originalPrice" :min="0" :precision="2" disabled style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="秒杀时间" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="秒杀库存" prop="totalStock">
              <el-input-number v-model="form.totalStock" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="每人限购" prop="perLimit">
              <el-input-number v-model="form.perLimit" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="预热时间">
              <el-input-number v-model="form.preheatMinutes" :min="0" style="width: 100%" />
              <span class="form-hint">分钟</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="活动描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="活动描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 商品选择器 -->
    <el-dialog v-model="productPickerVisible" title="选择秒杀商品" width="720px">
      <div class="picker-toolbar">
        <el-input
          v-model="productSearch"
          placeholder="搜索商品"
          clearable
          style="width: 200px"
          @clear="loadAllProducts"
          @keyup.enter="loadAllProducts"
        />
      </div>
      <el-table
        :data="allProducts"
        max-height="360"
        highlight-current-row
        @current-change="handleProductSelect"
      >
        <el-table-column prop="productName" label="商品名称" min-width="150" />
        <el-table-column prop="sku" label="SKU" width="120" />
        <el-table-column label="零售价" width="100">
          <template #default="{ row }">¥{{ row.retailPrice }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" />
      </el-table>
      <template #footer>
        <el-button @click="productPickerVisible = false">取消</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import {
  fetchFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  pauseFlashSale,
  fetchProducts,
  getErrorMessage
} from "../../api";

const loading = ref(false);
const activities = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref("");

// ==================== 表单 ====================
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: "",
  productName: "",
  productId: null as number | null,
  skuId: null as number | null,
  seckillPrice: 0,
  originalPrice: 0,
  timeRange: [] as any[],
  totalStock: 100,
  perLimit: 1,
  preheatMinutes: 30,
  description: ""
});

const formRules: FormRules = {
  name: [{ required: true, message: "请输入活动名称", trigger: "blur" }],
  productName: [{ required: true, message: "请选择秒杀商品", trigger: "change" }],
  seckillPrice: [
    { required: true, message: "请输入秒杀价", trigger: "blur" },
    { type: "number", min: 0.01, message: "秒杀价必须大于0", trigger: "blur" }
  ],
  timeRange: [{ required: true, message: "请选择秒杀时间", trigger: "change" }],
  totalStock: [
    { required: true, message: "请输入秒杀库存", trigger: "blur" },
    { type: "number", min: 1, message: "库存至少为1", trigger: "blur" }
  ],
  perLimit: [{ required: true, message: "请输入每人限购", trigger: "blur" }]
};

// ==================== 商品选择器 ====================
const productPickerVisible = ref(false);
const productSearch = ref("");

const allProducts = ref<any[]>([]);

async function loadAllProducts() {
  try {
    const data = await fetchProducts({
      keyword: productSearch.value || undefined,
      page: 1,
      pageSize: 100
    });
    allProducts.value = (data.records || []).map((item: any) => ({
      id: item.skuId,
      spuId: item.spuId,
      skuId: item.skuId,
      productName: item.name,
      sku: item.skuCode,
      retailPrice: Number(item.retailPrice || 0),
      stock: Number(item.availableQty || 0)
    }));
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载商品列表失败"));
  }
}

function openProductPicker() {
  productPickerVisible.value = true;
  loadAllProducts();
}

function handleProductSelect(row: any) {
  if (!row) return;
  form.productId = row.spuId ?? row.id;
  form.skuId = row.skuId ?? row.id;
  form.productName = row.productName;
  form.originalPrice = row.retailPrice;
  form.seckillPrice = Math.round(row.retailPrice * 0.6 * 100) / 100;
  form.totalStock = Math.min(row.stock, 100);
  productPickerVisible.value = false;
}

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (statusFilter.value) params.status = statusFilter.value;
    const data = await fetchFlashSales(params);
    activities.value = (data.records || []).map((item: any) => ({
      ...item,
      seckillPrice: Number(item.flashPrice),
      originalPrice: Number(item.originalPrice),
      discountRate: Number(item.originalPrice) > 0 ? (Number(item.flashPrice) / Number(item.originalPrice) * 10).toFixed(1) : "0.0",
      limitPerUser: item.limitPerUser,
      totalStock: Number(item.totalStock),
      soldCount: Number(item.soldCount)
    }));
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载秒杀活动失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) { pageSize.value = size; page.value = 1; loadData(); }
function handlePageChange(p: number) { page.value = p; loadData(); }

async function openDialog(row?: any) {
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    form.name = row.name;
    form.productId = row.productId;
    form.skuId = row.skuId;
    form.productName = row.productName || "";
    form.seckillPrice = row.seckillPrice;
    form.originalPrice = row.originalPrice;
    form.timeRange = [row.startTime, row.endTime];
    form.totalStock = row.totalStock;
    form.perLimit = row.limitPerUser || 1;
    form.preheatMinutes = 30;
    form.description = row.description || "";
    if (!form.productName) {
      try {
        const data = await fetchProducts({ page: 1, pageSize: 100 });
        const found = (data.records || []).find((p: any) => Number(p.skuId) === Number(row.skuId));
        form.productName = found?.name || `商品#${row.skuId}`;
      } catch {
        form.productName = `商品#${row.skuId}`;
      }
    }
  } else {
    isEdit.value = false;
    editingId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.name = "";
  form.productId = null;
  form.skuId = null;
  form.productName = "";
  form.seckillPrice = 0;
  form.originalPrice = 0;
  form.timeRange = [];
  form.totalStock = 100;
  form.perLimit = 1;
  form.preheatMinutes = 30;
  form.description = "";
  formRef.value?.resetFields();
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    const payload = {
      name: form.name,
      productId: form.productId,
      skuId: form.skuId,
      flashPrice: form.seckillPrice,
      originalPrice: form.originalPrice,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      totalStock: form.totalStock,
      limitPerUser: form.perLimit
    };
    if (isEdit.value && editingId.value) {
      await updateFlashSale(editingId.value, payload);
      ElMessage.success("修改成功");
    } else {
      await createFlashSale(payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, isEdit.value ? "修改失败" : "创建失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function handlePause(row: any) {
  try {
    await ElMessageBox.confirm(`确认停用秒杀活动「${row.name}」？`, "确认停用", { type: "warning" });
    await pauseFlashSale(row.id);
    ElMessage.success("活动已停用");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "停用失败"));
    }
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除秒杀活动「${row.name}」？`, "确认删除", { type: "warning" });
    await deleteFlashSale(row.id);
    ElMessage.success("已删除");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "删除失败"));
    }
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.form-hint { margin-left: 8px; font-size: 12px; color: var(--gray-400); }
.price-text { color: var(--el-color-danger); font-weight: 600; font-size: 15px; }
.original-price { color: var(--el-text-color-secondary); text-decoration: line-through; font-size: 13px; }
.product-select { display: flex; align-items: center; gap: 8px; }
.picker-toolbar { margin-bottom: 12px; }
</style>