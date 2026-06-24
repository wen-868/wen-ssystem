<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>商品中心</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索SKU编码/商品名称"
              size="default"
              style="width: 240px; margin-right: 10px"
              clearable
              @clear="loadProducts"
              @keyup.enter="loadProducts"
            />
            <el-button type="primary" @click="dialogVisible = true">
              <el-icon><Plus /></el-icon> 新增商品
            </el-button>
            <el-button @click="loadProducts">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="products" v-loading="loading" stripe>
        <el-table-column prop="skuCode" label="SKU编码" width="160" />
        <el-table-column prop="productName" label="商品名称" min-width="180" />
        <el-table-column prop="spec" label="规格" width="120" />
        <el-table-column prop="retailPrice" label="零售价" width="120">
          <template #default="{ row }">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="wholesalePrice" label="批发价" width="120">
          <template #default="{ row }">¥{{ Number(row.wholesalePrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ACTIVE'" type="success">上架</el-tag>
            <el-tag v-else type="info">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link type="warning" @click="openPriceDialog(row)">改价</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商品' : '新增商品'" width="640px">
      <el-form :model="form" label-width="100px" :rules="rules" ref="formRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="SKU编码" prop="skuCode">
              <el-input v-model="form.skuCode" placeholder="请输入SKU编码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品名称" prop="productName">
              <el-input v-model="form.productName" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="规格">
              <el-input v-model="form.spec" placeholder="请输入规格" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="请输入单位" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="零售价" prop="retailPrice">
              <el-input-number v-model="form.retailPrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="批发价" prop="wholesalePrice">
              <el-input-number v-model="form.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="小程序价">
              <el-input-number v-model="form.miniappPrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="上架" value="ACTIVE" />
                <el-option label="下架" value="INACTIVE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="priceDialogVisible" title="改价" width="480px">
      <el-form :model="priceForm" label-width="100px">
        <el-form-item label="商品名称">
          <span>{{ priceForm.productName }}</span>
        </el-form-item>
        <el-form-item label="零售价">
          <el-input-number v-model="priceForm.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="批发价">
          <el-input-number v-model="priceForm.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="小程序价">
          <el-input-number v-model="priceForm.miniappPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="priceSubmitLoading" @click="handleUpdatePrice">确认修改</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="商品详情" size="500px">
      <template v-if="currentProduct">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="SKU编码">{{ currentProduct.skuCode }}</el-descriptions-item>
          <el-descriptions-item label="商品名称">{{ currentProduct.productName }}</el-descriptions-item>
          <el-descriptions-item label="规格">{{ currentProduct.spec || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ currentProduct.unit || '-' }}</el-descriptions-item>
          <el-descriptions-item label="零售价">¥{{ Number(currentProduct.retailPrice || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="批发价">¥{{ Number(currentProduct.wholesalePrice || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="小程序价">¥{{ Number(currentProduct.miniappPrice || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentProduct.status === 'ACTIVE'" type="success">上架</el-tag>
            <el-tag v-else type="info">下架</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentProduct.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { createProduct, fetchProducts, updateProductPrice } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const priceSubmitLoading = ref(false);
const products = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const priceDialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const currentProduct = ref<any>(null);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  skuCode: "",
  productName: "",
  spec: "",
  unit: "",
  retailPrice: 0,
  wholesalePrice: 0,
  miniappPrice: 0,
  status: "ACTIVE",
  remark: ""
};

const form = reactive({ ...defaultForm });

const priceForm = reactive({
  id: 0,
  productName: "",
  retailPrice: 0,
  wholesalePrice: 0,
  miniappPrice: 0
});

const rules: FormRules = {
  skuCode: [{ required: true, message: "请输入SKU编码", trigger: "blur" }],
  productName: [{ required: true, message: "请输入商品名称", trigger: "blur" }]
};

async function loadProducts() {
  loading.value = true;
  try {
    const data = await fetchProducts();
    let list = Array.isArray(data) ? data : (data.records || []);
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.skuCode && item.skuCode.toLowerCase().includes(kw)) ||
        (item.productName && item.productName.toLowerCase().includes(kw))
      );
    }
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    products.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadProducts();
}

function handlePageChange(p: number) {
  page.value = p;
  loadProducts();
}

function viewDetail(row: any) {
  currentProduct.value = row;
  detailVisible.value = true;
}

function openPriceDialog(row: any) {
  priceForm.id = row.id;
  priceForm.productName = row.productName;
  priceForm.retailPrice = row.retailPrice || 0;
  priceForm.wholesalePrice = row.wholesalePrice || 0;
  priceForm.miniappPrice = row.miniappPrice || 0;
  priceDialogVisible.value = true;
}

async function handleUpdatePrice() {
  priceSubmitLoading.value = true;
  try {
    await updateProductPrice(priceForm.id, {
      retailPrice: priceForm.retailPrice,
      wholesalePrice: priceForm.wholesalePrice,
      miniappPrice: priceForm.miniappPrice
    });
    ElMessage.success("改价成功");
    priceDialogVisible.value = false;
    loadProducts();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "改价失败");
  } finally {
    priceSubmitLoading.value = false;
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createProduct(form);
      ElMessage.success("创建成功");
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadProducts();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || "保存失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadProducts();
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
</style>
