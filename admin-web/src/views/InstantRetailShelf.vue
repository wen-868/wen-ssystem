<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售货架</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索商品名称"
              size="default"
              style="width: 200px; margin-right: 8px"
              clearable
              @clear="loadData"
              @keyup.enter="loadData"
            />
            <el-select v-model="category" placeholder="商品分类" size="default" style="width: 150px; margin-right: 8px" clearable @change="loadData">
              <el-option label="生鲜果蔬" value="FRESH" />
              <el-option label="零食饮料" value="SNACKS" />
              <el-option label="日用百货" value="DAILY" />
              <el-option label="乳品烘焙" value="DAIRY" />
              <el-option label="酒水冲调" value="BEVERAGE" />
            </el-select>
            <el-button type="primary" @click="openAddDialog">添加商品</el-button>
            <el-button @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="products" v-loading="loading" stripe>
        <el-table-column label="商品图片" width="100">
          <template #default="{ row }">
            <el-image
              v-if="row.productImage"
              :src="row.productImage"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 6px"
              :preview-src-list="[row.productImage]"
              preview-teleported
            />
            <div v-else class="no-image">暂无图片</div>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品名称" min-width="180" />
        <el-table-column prop="price" label="售价" width="100">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.price || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" />
        <el-table-column prop="shelfStatus" label="上架状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.shelfStatus === 'ON'" type="success">已上架</el-tag>
            <el-tag v-else-if="row.shelfStatus === 'OFF'" type="info">已下架</el-tag>
            <el-tag v-else>{{ row.shelfStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openUpdateDialog(row)">更新</el-button>
            <el-button size="small" link type="danger" @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无货架商品" />
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

    <el-dialog v-model="addDialogVisible" title="添加商品到货架" width="480px">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" label-width="100px">
        <el-form-item label="商品名称" prop="productName">
          <el-input v-model="addForm.productName" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="商品图片" prop="productImage">
          <el-input v-model="addForm.productImage" placeholder="请输入图片URL" />
        </el-form-item>
        <el-form-item label="售价" prop="price">
          <el-input-number v-model="addForm.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="addForm.stock" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="商品分类">
          <el-select v-model="addForm.category" style="width: 100%">
            <el-option label="生鲜果蔬" value="FRESH" />
            <el-option label="零食饮料" value="SNACKS" />
            <el-option label="日用百货" value="DAILY" />
            <el-option label="乳品烘焙" value="DAIRY" />
            <el-option label="酒水冲调" value="BEVERAGE" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="handleAddProduct">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="updateDialogVisible" title="更新货架商品" width="480px">
      <el-form ref="updateFormRef" :model="updateForm" :rules="updateFormRules" label-width="100px">
        <el-form-item label="商品名称">
          <el-input v-model="updateForm.productName" disabled />
        </el-form-item>
        <el-form-item label="售价" prop="price">
          <el-input-number v-model="updateForm.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="updateForm.stock" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="上架状态">
          <el-select v-model="updateForm.shelfStatus" style="width: 100%">
            <el-option label="上架" value="ON" />
            <el-option label="下架" value="OFF" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="updateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="updateLoading" @click="handleUpdateProduct">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { addShelfProduct, fetchShelfProducts, removeShelfProduct, updateShelfProduct } from "../api";

const loading = ref(false);
const addLoading = ref(false);
const updateLoading = ref(false);
const products = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const category = ref("");

const addDialogVisible = ref(false);
const updateDialogVisible = ref(false);
const addFormRef = ref<FormInstance>();
const updateFormRef = ref<FormInstance>();
const updatingId = ref<number | null>(null);

const addForm = reactive({
  productName: "",
  productImage: "",
  price: 0,
  stock: 0,
  category: ""
});

const addFormRules: FormRules = {
  productName: [{ required: true, message: "请填写商品名称", trigger: "blur" }],
  price: [{ required: true, message: "请填写售价", trigger: "blur" }],
  stock: [{ required: true, message: "请填写库存", trigger: "blur" }]
};

const updateForm = reactive({
  productName: "",
  price: 0,
  stock: 0,
  shelfStatus: "ON"
});

const updateFormRules: FormRules = {
  price: [{ required: true, message: "请填写售价", trigger: "blur" }],
  stock: [{ required: true, message: "请填写库存", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchShelfProducts({
      keyword: keyword.value || undefined,
      category: category.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    products.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载货架商品失败"));
  } finally {
    loading.value = false;
  }
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

function openAddDialog() {
  addForm.productName = "";
  addForm.productImage = "";
  addForm.price = 0;
  addForm.stock = 0;
  addForm.category = "";
  addDialogVisible.value = true;
}

async function handleAddProduct() {
  if (!addFormRef.value) return;
  await addFormRef.value.validate(async (valid) => {
    if (!valid) return;
    addLoading.value = true;
    try {
      await addShelfProduct({ ...addForm });
      ElMessage.success("商品已添加到货架");
      addDialogVisible.value = false;
      loadData();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "添加商品失败"));
    } finally {
      addLoading.value = false;
    }
  });
}

function openUpdateDialog(row: any) {
  updatingId.value = row.id;
  updateForm.productName = row.productName || "";
  updateForm.price = row.price || 0;
  updateForm.stock = row.stock || 0;
  updateForm.shelfStatus = row.shelfStatus || "ON";
  updateDialogVisible.value = true;
}

async function handleUpdateProduct() {
  if (!updateFormRef.value || !updatingId.value) return;
  await updateFormRef.value.validate(async (valid) => {
    if (!valid) return;
    updateLoading.value = true;
    try {
      await updateShelfProduct(updatingId.value!, {
        price: updateForm.price,
        stock: updateForm.stock,
        shelfStatus: updateForm.shelfStatus
      });
      ElMessage.success("商品信息已更新");
      updateDialogVisible.value = false;
      loadData();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "更新商品失败"));
    } finally {
      updateLoading.value = false;
    }
  });
}

async function handleRemove(row: any) {
  try {
    await ElMessageBox.confirm(`确定要从货架移除「${row.productName}」吗？`, "移除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await removeShelfProduct(row.id);
    ElMessage.success("已从货架移除");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "移除商品失败"));
    }
  }
}

onMounted(() => {
  loadData();
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
  font-weight: 500;
}
.no-image {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 6px;
  color: #909399;
  font-size: 12px;
}
</style>