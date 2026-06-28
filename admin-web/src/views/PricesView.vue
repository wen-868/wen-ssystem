<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>价格中心</span>
          <div class="header-actions">
            <el-button @click="refreshCurrent">刷新</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="价格等级" name="levels">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="levelDialogVisible = true">新增价格等级</el-button>
          </div>
          <el-table :data="priceLevels" v-loading="loading" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="等级名称" min-width="140" />
            <el-table-column prop="code" label="等级编码" width="140" />
            <el-table-column prop="description" label="描述" min-width="200" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
                <el-tag v-else type="info">禁用</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openLevelEdit(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="deleteLevel(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="SKU 价格" name="sku-prices">
          <div class="tab-toolbar">
            <el-input
              v-model="skuKeyword"
              placeholder="搜索 SKU 编码/名称"
              size="small"
              style="width: 220px; margin-right: 10px"
              clearable
            />
            <el-button size="small" @click="loadSkuPrices">搜索</el-button>
          </div>
          <el-table :data="skuPrices" v-loading="loading" stripe>
            <el-table-column prop="skuCode" label="SKU 编码" width="160" />
            <el-table-column prop="skuName" label="商品名称" min-width="160" />
            <el-table-column label="零售价" width="120">
              <template #default="{ row }">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="批发价" width="120">
              <template #default="{ row }">¥{{ Number(row.wholesalePrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="小程序价" width="120">
              <template #default="{ row }">¥{{ Number(row.miniappPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openSkuPriceEdit(row)">编辑价格</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="客户价格绑定" name="bindings">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="bindingDialogVisible = true">新增绑定</el-button>
          </div>
          <el-table :data="customerBindings" v-loading="loading" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="customerName" label="客户名称" min-width="140" />
            <el-table-column prop="skuName" label="商品" min-width="160" />
            <el-table-column prop="priceLevelName" label="价格等级" width="140" />
            <el-table-column label="协议价" width="120">
              <template #default="{ row }">¥{{ Number(row.price || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'APPROVED'" type="success">已批准</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">待审批</el-tag>
                <el-tag v-else-if="row.status === 'REJECTED'" type="danger">已拒绝</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click="approveBinding(row)">批准</el-button>
                <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="rejectBinding(row)">拒绝</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="价格变更日志" name="logs">
          <el-table :data="priceLogs" v-loading="loading" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="skuName" label="商品" min-width="160" />
            <el-table-column prop="priceType" label="价格类型" width="120" />
            <el-table-column label="变更前" width="120">
              <template #default="{ row }">¥{{ Number(row.oldPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="变更后" width="120">
              <template #default="{ row }">¥{{ Number(row.newPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="operatorName" label="操作人" width="120" />
            <el-table-column prop="createdAt" label="变更时间" width="170" />
            <el-table-column prop="remark" label="备注" min-width="140" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>

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

    <el-dialog v-model="levelDialogVisible" :title="isLevelEdit ? '编辑价格等级' : '新增价格等级'" width="480px">
      <el-form ref="levelFormRef" :model="levelForm" :rules="levelRules" label-width="100px">
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="levelForm.name" />
        </el-form-item>
        <el-form-item label="等级编码" prop="code">
          <el-input v-model="levelForm.code" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="levelForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="levelForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="禁用" value="INACTIVE" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="levelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleLevelSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="skuPriceDialogVisible" title="编辑 SKU 价格" width="480px">
      <el-form :model="skuPriceForm" label-width="100px">
        <el-form-item label="商品名称">
          <span>{{ skuPriceForm.skuName }}</span>
        </el-form-item>
        <el-form-item label="零售价">
          <el-input-number v-model="skuPriceForm.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="批发价">
          <el-input-number v-model="skuPriceForm.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="小程序价">
          <el-input-number v-model="skuPriceForm.miniappPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="skuPriceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSkuPriceSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bindingDialogVisible" title="新增客户价格绑定" width="480px">
      <el-form :model="bindingForm" label-width="100px">
        <el-form-item label="客户">
          <el-select v-model="bindingForm.customerId" style="width: 100%" filterable>
            <el-option
              v-for="c in customerOptions"
              :key="c.memberId || c.id"
              :label="c.name"
              :value="c.memberId || c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="商品">
          <el-select v-model="bindingForm.skuId" style="width: 100%" filterable>
            <el-option
              v-for="p in productOptions"
              :key="p.skuId || p.id"
              :label="p.name || p.skuName"
              :value="p.skuId || p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="协议价">
          <el-input-number v-model="bindingForm.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleBindingSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import {
  approveCustomerBinding,
  createCustomerBinding,
  createPriceLevel,
  createSkuPrice,
  deletePriceLevel,
  fetchCustomerBindings,
  fetchMembers,
  fetchPriceChangeLogs,
  fetchPriceLevels,
  fetchProducts,
  rejectCustomerBinding,
  updatePriceLevel,
  updateProductPrice
} from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const activeTab = ref("levels");
const priceLevels = ref<any[]>([]);
const skuPrices = ref<any[]>([]);
const customerBindings = ref<any[]>([]);
const priceLogs = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const productOptions = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const skuKeyword = ref("");

const levelDialogVisible = ref(false);
const isLevelEdit = ref(false);
const levelFormRef = ref<FormInstance>();
const skuPriceDialogVisible = ref(false);
const bindingDialogVisible = ref(false);

const defaultLevelForm = {
  id: 0,
  name: "",
  code: "",
  description: "",
  status: "ACTIVE"
};

const levelForm = reactive({ ...defaultLevelForm });

const skuPriceForm = reactive({
  skuId: 0,
  skuName: "",
  retailPrice: 0,
  wholesalePrice: 0,
  miniappPrice: 0
});

const bindingForm = reactive({
  customerId: null as number | null,
  skuId: null as number | null,
  price: 0
});

const levelRules: FormRules = {
  name: [{ required: true, message: "请填写等级名称", trigger: "blur" }],
  code: [{ required: true, message: "请填写等级编码", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadPriceLevels() {
  loading.value = true;
  try {
    const data = await fetchPriceLevels({ page: page.value, pageSize: pageSize.value });
    priceLevels.value = data.records || [];
    total.value = data.total || priceLevels.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载价格等级失败"));
  } finally {
    loading.value = false;
  }
}

async function loadSkuPrices() {
  loading.value = true;
  try {
    const data = await fetchProducts({ keyword: skuKeyword.value || undefined, page: page.value, pageSize: pageSize.value });
    const list = data.records || [];
    skuPrices.value = list;
    total.value = data.total || list.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载 SKU 价格失败"));
  } finally {
    loading.value = false;
  }
}

async function loadCustomerBindings() {
  loading.value = true;
  try {
    const data = await fetchCustomerBindings({ page: page.value, pageSize: pageSize.value });
    customerBindings.value = data.records || [];
    total.value = data.total || customerBindings.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户价格绑定失败"));
  } finally {
    loading.value = false;
  }
}

async function loadPriceLogs() {
  loading.value = true;
  try {
    const data = await fetchPriceChangeLogs({ page: page.value, pageSize: pageSize.value });
    priceLogs.value = data.records || [];
    total.value = data.total || priceLogs.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载价格变更日志失败"));
  } finally {
    loading.value = false;
  }
}

async function loadCustomerOptions() {
  try {
    const data = await fetchMembers({ pageSize: 100 });
    customerOptions.value = data.records || [];
  } catch (e) {
    // ignore
  }
}

async function loadProductOptions() {
  try {
    const data = await fetchProducts({ pageSize: 100 });
    productOptions.value = data.records || [];
  } catch (e) {
    // ignore
  }
}

function handleTabChange() {
  page.value = 1;
  refreshCurrent();
}

function refreshCurrent() {
  if (activeTab.value === "levels") {
    loadPriceLevels();
  } else if (activeTab.value === "sku-prices") {
    loadSkuPrices();
  } else if (activeTab.value === "bindings") {
    loadCustomerBindings();
  } else if (activeTab.value === "logs") {
    loadPriceLogs();
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  refreshCurrent();
}

function handlePageChange(p: number) {
  page.value = p;
  refreshCurrent();
}

function openLevelEdit(row: any) {
  isLevelEdit.value = true;
  levelForm.id = row.id;
  levelForm.name = row.name;
  levelForm.code = row.code;
  levelForm.description = row.description || "";
  levelForm.status = row.status || "ACTIVE";
  levelDialogVisible.value = true;
}

async function handleLevelSubmit() {
  if (!levelFormRef.value) return;
  await levelFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isLevelEdit.value) {
        await updatePriceLevel(levelForm.id, levelForm);
        ElMessage.success("价格等级已更新");
      } else {
        await createPriceLevel(levelForm);
        ElMessage.success("价格等级已新增");
      }
      levelDialogVisible.value = false;
      Object.assign(levelForm, defaultLevelForm);
      loadPriceLevels();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isLevelEdit.value ? "更新价格等级失败" : "新增价格等级失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function deleteLevel(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除价格等级 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deletePriceLevel(row.id);
    ElMessage.success("删除成功");
    loadPriceLevels();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

function openSkuPriceEdit(row: any) {
  skuPriceForm.skuId = row.skuId || row.id;
  skuPriceForm.skuName = row.name || row.skuName || "";
  skuPriceForm.retailPrice = row.retailPrice || 0;
  skuPriceForm.wholesalePrice = row.wholesalePrice || 0;
  skuPriceForm.miniappPrice = row.miniappPrice || 0;
  skuPriceDialogVisible.value = true;
}

async function handleSkuPriceSubmit() {
  if (!skuPriceForm.skuId) return;
  submitLoading.value = true;
  try {
    await updateProductPrice(skuPriceForm.skuId, {
      retailPrice: skuPriceForm.retailPrice,
      wholesalePrice: skuPriceForm.wholesalePrice,
      miniappPrice: skuPriceForm.miniappPrice
    });
    ElMessage.success("价格已更新");
    skuPriceDialogVisible.value = false;
    loadSkuPrices();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "更新价格失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function handleBindingSubmit() {
  if (!bindingForm.customerId || !bindingForm.skuId) {
    ElMessage.warning("请选择客户和商品");
    return;
  }
  submitLoading.value = true;
  try {
    await createCustomerBinding(bindingForm);
    ElMessage.success("绑定已提交，等待审批");
    bindingDialogVisible.value = false;
    bindingForm.customerId = null;
    bindingForm.skuId = null;
    bindingForm.price = 0;
    loadCustomerBindings();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "创建绑定失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function approveBinding(row: any) {
  const confirmed = await ElMessageBox.confirm("确认批准该价格绑定?", "确认批准", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await approveCustomerBinding(row.id);
    ElMessage.success("已批准");
    loadCustomerBindings();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "批准失败"));
  }
}

async function rejectBinding(row: any) {
  const confirmed = await ElMessageBox.confirm("确认拒绝该价格绑定?", "确认拒绝", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await rejectCustomerBinding(row.id);
    ElMessage.success("已拒绝");
    loadCustomerBindings();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "拒绝失败"));
  }
}

onMounted(() => {
  loadPriceLevels();
  loadCustomerOptions();
  loadProductOptions();
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
.tab-toolbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
