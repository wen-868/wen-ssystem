<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <div class="toolbar-left">
          <el-select v-model="statusFilter" placeholder="活动状态" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="未开始" value="PENDING" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已结束" value="ENDED" />
            <el-option label="已售罄" value="SOLD_OUT" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="搜索活动名称"
            clearable
            style="width: 200px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
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
          <template #default="{ row }">{{ row.perLimit }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">未开始</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
            <el-tag v-else-if="row.status === 'SOLD_OUT'" type="warning">已售罄</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="handleEnd(row)">结束</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="handleSizeChange" @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑秒杀活动' : '新建秒杀活动'"
      width="700px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="秒杀商品" prop="productName">
          <div class="product-select">
            <el-input v-model="form.productName" placeholder="点击选择商品" readonly style="width: 300px" />
            <el-button type="primary" @click="productPickerVisible = true">选择商品</el-button>
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
    <el-dialog v-model="productPickerVisible" title="选择秒杀商品" width="600px">
      <div class="picker-toolbar">
        <el-input v-model="productSearch" placeholder="搜索商品" clearable style="width: 200px" />
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
import { Search, Plus, Refresh } from "@element-plus/icons-vue";

const loading = ref(false);
const activities = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
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

const mockProducts = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  productName: ["茅台飞天 53度 500ml", "五粮液 52度 500ml", "国窖1573 52度 500ml", "剑南春 52度 500ml", "洋河梦之蓝 M6 52度", "汾酒青花30 53度", "古井贡酒年份原浆 50度", "水井坊臻酿八号 52度", "舍得酒品味舍得 52度", "酒鬼酒内参 52度"][i % 10],
  sku: `SKU${String(i + 1).padStart(6, "0")}`,
  retailPrice: [1499, 1099, 999, 468, 788, 598, 358, 298, 458, 888][i % 10],
  stock: Math.floor(Math.random() * 500) + 50
}));

const allProducts = ref([...mockProducts]);

function handleProductSelect(row: any) {
  if (!row) return;
  form.productId = row.id;
  form.productName = row.productName;
  form.originalPrice = row.retailPrice;
  form.seckillPrice = Math.round(row.retailPrice * 0.6 * 100) / 100;
  form.totalStock = Math.min(row.stock, 100);
  productPickerVisible.value = false;
}

// ==================== Mock ====================
const mockActivities = Array.from({ length: 12 }, (_, i) => {
  const statuses = ["PENDING", "ACTIVE", "ACTIVE", "ENDED", "SOLD_OUT"];
  const totalStock = Math.floor(Math.random() * 200) + 50;
  const status = statuses[i % 5];
  return {
    id: i + 1,
    name: `秒杀活动-${i + 1}`,
    productId: i + 1,
    productName: ["茅台飞天 53度", "五粮液 52度", "国窖1573", "剑南春"][i % 4],
    seckillPrice: [999, 699, 599, 299][i % 4],
    originalPrice: [1499, 1099, 999, 468][i % 4],
    discountRate: (6.7).toFixed(1),
    totalStock,
    soldCount: status === "SOLD_OUT" ? totalStock : Math.floor(Math.random() * totalStock),
    perLimit: Math.floor(Math.random() * 3) + 1,
    startTime: "2026-07-06 10:00:00",
    endTime: "2026-07-06 22:00:00",
    status,
    description: ""
  };
});

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockActivities];
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(kw));
    }
    if (statusFilter.value) {
      filtered = filtered.filter(a => a.status === statusFilter.value);
    }
    const start = (page.value - 1) * pageSize.value;
    activities.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleSizeChange(size: number) { pageSize.value = size; page.value = 1; loadData(); }
function handlePageChange(p: number) { page.value = p; loadData(); }

function openDialog(row?: any) {
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    form.name = row.name;
    form.productId = row.productId;
    form.productName = row.productName;
    form.seckillPrice = row.seckillPrice;
    form.originalPrice = row.originalPrice;
    form.timeRange = [row.startTime, row.endTime];
    form.totalStock = row.totalStock;
    form.perLimit = row.perLimit;
    form.preheatMinutes = 30;
    form.description = row.description || "";
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
  setTimeout(() => {
    const base = {
      name: form.name,
      productId: form.productId,
      productName: form.productName,
      seckillPrice: form.seckillPrice,
      originalPrice: form.originalPrice,
      discountRate: (form.seckillPrice / form.originalPrice * 10).toFixed(1),
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      totalStock: form.totalStock,
      perLimit: form.perLimit,
      description: form.description
    };
    if (isEdit.value && editingId.value) {
      const idx = mockActivities.findIndex(a => a.id === editingId.value);
      if (idx > -1) Object.assign(mockActivities[idx], base);
      ElMessage.success("修改成功");
    } else {
      const newId = Math.max(...mockActivities.map(a => a.id), 0) + 1;
      mockActivities.unshift({ id: newId, ...base, soldCount: 0, status: "PENDING" });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
    submitLoading.value = false;
  }, 500);
}

async function handleEnd(row: any) {
  await ElMessageBox.confirm(`确认结束秒杀活动「${row.name}」？`, "确认结束", { type: "warning" });
  row.status = "ENDED";
  ElMessage.success("活动已结束");
  loadData();
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确认删除秒杀活动「${row.name}」？`, "确认删除", { type: "warning" });
  const idx = mockActivities.findIndex(a => a.id === row.id);
  if (idx > -1) mockActivities.splice(idx, 1);
  ElMessage.success("已删除");
  loadData();
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.form-hint { margin-left: 8px; font-size: 12px; color: #9ca3af; }
.price-text { color: var(--el-color-danger); font-weight: 600; font-size: 15px; }
.original-price { color: var(--el-text-color-secondary); text-decoration: line-through; font-size: 13px; }
.product-select { display: flex; align-items: center; gap: 8px; }
.picker-toolbar { margin-bottom: 12px; }
</style>