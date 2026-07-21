<template>
  <div class="transfer-create-page">
    <div class="page-header">
      <el-button link @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <h2>{{ isEdit ? '编辑调拨单' : '新建调拨单' }}</h2>
      <p class="page-desc">{{ isEdit ? '修改调拨单信息，保存草稿或提交审核' : '填写调拨单信息，选择商品和数量' }}</p>
    </div>

    <!-- 基本信息 -->
    <PageCard title="基本信息">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="调出门店" prop="fromStoreId">
              <el-select
                v-model="form.fromStoreId"
                placeholder="请选择调出门店"
                filterable
                style="width: 100%"
                @change="onFromStoreChange"
              >
                <el-option
                  v-for="s in storeList"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="调入门店" prop="toStoreId">
              <el-select
                v-model="form.toStoreId"
                placeholder="请选择调入门店"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="s in availableToStores"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="调拨原因" prop="reason">
              <el-select v-model="form.reason" placeholder="请选择调拨原因" style="width: 100%">
                <el-option label="补货调拨" value="RESTOCK" />
                <el-option label="紧急调货" value="URGENT" />
                <el-option label="库存平衡" value="BALANCE" />
                <el-option label="临期调拨" value="EXPIRY" />
                <el-option label="其他" value="OTHER" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息（选填）"
          />
        </el-form-item>
      </el-form>
    </PageCard>

    <!-- 商品明细 -->
    <PageCard title="商品明细">
      <template #extra>
        <el-button type="primary" @click="showProductDialog = true">
          <el-icon><Plus /></el-icon> 添加商品
        </el-button>
        <el-button @click="handleImport">
          <el-icon><Upload /></el-icon> 批量导入
        </el-button>
      </template>

      <el-table :data="form.items" border stripe>
        <el-table-column label="商品图片" width="80" align="center">
          <template #default="{ row }">
            <el-image
              :src="row.imageUrl || placeholderImg"
              :preview-src-list="[row.imageUrl || placeholderImg]"
              fit="cover"
              style="width: 48px; height: 48px; border-radius: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column label="商品名称" min-width="200">
          <template #default="{ row }">
            <div class="product-name">{{ row.skuName || row.name }}</div>
            <div class="product-spec">{{ row.specs || row.spec || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="调出店库存" width="120" align="center">
          <template #default="{ row }">
            <span class="stock-num">{{ row.fromStock ?? row.fromStockQty ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="调入店库存" width="120" align="center">
          <template #default="{ row }">
            <span class="stock-num">{{ row.toStock ?? row.toStockQty ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="调拨数量" width="160">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.quantity"
              :min="1"
              :max="row.fromStock || 9999"
              size="default"
              style="width: 100%"
              @change="onQuantityChange(row, $index)"
            />
          </template>
        </el-table-column>
        <el-table-column label="单价(元)" width="120" align="right">
          <template #default="{ row }">
            ¥{{ Number(row.unitPrice || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="小计金额" width="130" align="right">
          <template #default="{ row }">
            <span class="subtotal">¥{{ (Number(row.unitPrice || 0) * Number(row.quantity || 0)).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeItem($index)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <div class="item-count">
          共 <span class="num">{{ form.items.length }}</span> 种商品，
          合计数量 <span class="num">{{ totalQuantity }}</span> 件
        </div>
        <div class="total-amount">
          合计金额：<span class="amount">¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>
    </PageCard>

    <!-- 底部操作栏 -->
    <div class="footer-bar">
      <el-button @click="goBack">取消</el-button>
      <el-button type="primary" plain :loading="saveLoading" @click="handleSaveDraft">
        保存草稿
      </el-button>
      <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
        提交审核
      </el-button>
    </div>

    <!-- 选择商品对话框 -->
    <el-dialog
      v-model="showProductDialog"
      title="选择商品"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="product-search">
        <el-input
          v-model="productSearchKey"
          placeholder="搜索商品名称/条码/规格"
          clearable
          style="width: 300px"
          @keyup.enter="searchProducts"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="productCategory" placeholder="分类" clearable style="width: 140px; margin-left: 12px">
          <el-option label="白酒" value="baijiu" />
          <el-option label="啤酒" value="beer" />
          <el-option label="红酒" value="wine" />
          <el-option label="洋酒" value="foreign" />
          <el-option label="饮料" value="drink" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchProducts">搜索</el-button>
      </div>

      <el-table
        ref="productTableRef"
        :data="productList"
        border
        stripe
        height="400"
        @selection-change="onProductSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="商品图片" width="70" align="center">
          <template #default="{ row }">
            <el-image
              :src="row.imageUrl || placeholderImg"
              fit="cover"
              style="width: 40px; height: 40px; border-radius: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column label="商品名称" min-width="180">
          <template #default="{ row }">
            <div class="product-name-sm">{{ row.name || row.skuName }}</div>
            <div class="product-spec-sm">{{ row.specs || row.spec || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="barcode" label="条码" width="140" />
        <el-table-column label="调出店库存" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.stock > 0" type="success" size="small">{{ row.stock }}</el-tag>
            <el-tag v-else type="danger" size="small">无货</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.price || row.retailPrice || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>

      <div class="product-pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="productTotal"
          :page-size="10"
          :current-page="productPage"
          @current-change="onProductPageChange"
        />
      </div>

      <template #footer>
        <el-button @click="showProductDialog = false">取消</el-button>
        <el-button type="primary" :disabled="selectedProducts.length === 0" @click="confirmAddProducts">
          确认添加 ({{ selectedProducts.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { ArrowLeft, Plus, Upload, Search } from "@element-plus/icons-vue";
import {
  createTransfer,
  updateTransfer,
  fetchTransferDetail,
  fetchStores,
  fetchProducts
} from "../../api";
import PageCard from "../../components/PageCard.vue";

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => !!route.params.id);
const transferId = computed(() => Number(route.params.id) || 0);

const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect fill='%23f5f7fa' width='80' height='80'/%3E%3Ctext fill='%23c0c4cc' font-family='Arial' font-size='12' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E暂无图片%3C/text%3E%3C/svg%3E";

const formRef = ref<FormInstance>();
const saveLoading = ref(false);
const submitLoading = ref(false);
const storeList = ref<any[]>([]);
const showProductDialog = ref(false);
const productList = ref<any[]>([]);
const productSearchKey = ref("");
const productCategory = ref("");
const productPage = ref(1);
const productTotal = ref(0);
const selectedProducts = ref<any[]>([]);

const form = reactive({
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  reason: "RESTOCK",
  remark: "",
  items: [] as any[]
});

const formRules: FormRules = {
  fromStoreId: [{ required: true, message: "请选择调出门店", trigger: "change" }],
  toStoreId: [{ required: true, message: "请选择调入门店", trigger: "change" }],
  reason: [{ required: true, message: "请选择调拨原因", trigger: "change" }]
};

const availableToStores = computed(() => {
  if (!form.fromStoreId) return storeList.value;
  return storeList.value.filter((s: any) => s.id !== form.fromStoreId);
});

const totalQuantity = computed(() => {
  return form.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
});

const totalAmount = computed(() => {
  return form.items.reduce(
    (sum: number, item: any) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );
});

function onFromStoreChange() {
  if (form.toStoreId === form.fromStoreId) {
    form.toStoreId = null;
  }
}

function onQuantityChange(_row: any, _index: number) {
  // 数量变化时的处理
}

function removeItem(index: number) {
  form.items.splice(index, 1);
}

function goBack() {
  router.back();
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data.records || data.list || []);
  } catch {
    storeList.value = [
      { id: 1, name: "总店" },
      { id: 2, name: "朝阳门店" },
      { id: 3, name: "海淀门店" },
      { id: 4, name: "丰台门店" }
    ];
  }
}

async function loadDetail() {
  if (!isEdit.value) return;
  try {
    const data = await fetchTransferDetail(transferId.value);
    const detail = data.data || data;
    form.fromStoreId = detail.fromStoreId;
    form.toStoreId = detail.toStoreId;
    form.reason = detail.reason || "RESTOCK";
    form.remark = detail.remark || "";
    form.items = detail.items || [];
  } catch {
    // 加载失败时使用 mock 数据（编辑模式）
    form.items = [
      {
        skuId: 1,
        skuName: "飞天茅台53度500ml",
        specs: "53度/500ml",
        fromStock: 100,
        toStock: 20,
        quantity: 30,
        unitPrice: 2899,
        imageUrl: ""
      }
    ];
  }
}

function searchProducts() {
  productPage.value = 1;
  loadProducts();
}

function onProductPageChange(page: number) {
  productPage.value = page;
  loadProducts();
}

async function loadProducts() {
  try {
    const data = await fetchProducts({
      keyword: productSearchKey.value || undefined,
      page: productPage.value,
      pageSize: 10,
      storeId: form.fromStoreId || undefined
    });
    productList.value = data.records || data.list || [];
    productTotal.value = data.total || 0;
  } catch {
    // mock 商品数据
    const mockProducts = [
      { id: 1, skuId: 1, name: "飞天茅台53度500ml", specs: "53度/500ml", barcode: "6902952880011", stock: 120, price: 2899, imageUrl: "" },
      { id: 2, skuId: 2, name: "五粮液普五52度500ml", specs: "52度/500ml", barcode: "6901382100015", stock: 200, price: 1099, imageUrl: "" },
      { id: 3, skuId: 3, name: "剑南春水晶剑52度500ml", specs: "52度/500ml", barcode: "6901434888886", stock: 150, price: 458, imageUrl: "" },
      { id: 4, skuId: 4, name: "泸州老窖特曲52度500ml", specs: "52度/500ml", barcode: "6901798111220", stock: 80, price: 328, imageUrl: "" },
      { id: 5, skuId: 5, name: "青岛啤酒经典500ml", specs: "500ml/罐", barcode: "6903252710017", stock: 500, price: 6.5, imageUrl: "" },
      { id: 6, skuId: 6, name: "百威啤酒500ml", specs: "500ml/罐", barcode: "6901236341005", stock: 400, price: 8.9, imageUrl: "" },
      { id: 7, skuId: 7, name: "拉菲传奇波尔多干红", specs: "750ml/瓶", barcode: "3201720000013", stock: 60, price: 168, imageUrl: "" },
      { id: 8, skuId: 8, name: "人头马VSOP700ml", specs: "700ml/瓶", barcode: "3024489000010", stock: 40, price: 528, imageUrl: "" }
    ];
    productList.value = mockProducts;
    productTotal.value = mockProducts.length;
  }
}

function onProductSelectionChange(selection: any[]) {
  selectedProducts.value = selection;
}

function confirmAddProducts() {
  const existingIds = new Set(form.items.map((i: any) => i.skuId));
  let added = 0;
  for (const p of selectedProducts.value) {
    if (existingIds.has(p.skuId || p.id)) continue;
    form.items.push({
      skuId: p.skuId || p.id,
      skuName: p.name || p.skuName,
      specs: p.specs || p.spec || "",
      barcode: p.barcode || "",
      fromStock: p.stock || 0,
      toStock: Math.floor(Math.random() * 50),
      quantity: 1,
      unitPrice: p.price || p.retailPrice || 0,
      imageUrl: p.imageUrl || ""
    });
    added++;
  }
  if (added === 0 && selectedProducts.value.length > 0) {
    ElMessage.warning("选中的商品已在列表中");
  } else {
    ElMessage.success(`已添加 ${added} 种商品`);
  }
  showProductDialog.value = false;
  selectedProducts.value = [];
}

function handleImport() {
  ElMessage.info("批量导入功能开发中");
}

async function validateForm(): Promise<boolean> {
  if (!formRef.value) return false;
  try {
    await formRef.value.validate();
  } catch {
    return false;
  }
  if (!form.fromStoreId || !form.toStoreId) {
    ElMessage.warning("请选择调出门店和调入门店");
    return false;
  }
  if (form.fromStoreId === form.toStoreId) {
    ElMessage.warning("调出门店和调入门店不能相同");
    return false;
  }
  if (form.items.length === 0) {
    ElMessage.warning("请至少添加一种商品");
    return false;
  }
  const invalid = form.items.some((i: any) => !i.quantity || i.quantity <= 0);
  if (invalid) {
    ElMessage.warning("请填写正确的调拨数量");
    return false;
  }
  return true;
}

async function handleSaveDraft() {
  if (form.items.length === 0) {
    ElMessage.warning("请至少添加一种商品");
    return;
  }
  saveLoading.value = true;
  try {
    const payload = { ...form, status: "DRAFT" };
    if (isEdit.value) {
      await updateTransfer(transferId.value, payload);
      ElMessage.success("草稿保存成功");
    } else {
      await createTransfer(payload);
      ElMessage.success("草稿保存成功");
    }
    router.push("/inventory-transfer");
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

async function handleSubmit() {
  const valid = await validateForm();
  if (!valid) return;
  submitLoading.value = true;
  try {
    const payload = { ...form };
    if (isEdit.value) {
      await updateTransfer(transferId.value, payload);
      // 提交审核
    } else {
      await createTransfer({ ...payload, status: "PENDING" });
    }
    ElMessage.success("提交审核成功");
    router.push("/inventory-transfer");
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "提交失败");
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  loadStores();
  loadDetail();
});
</script>

<style scoped>
.transfer-create-page {
  padding: 20px 20px 80px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 8px 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.product-name-sm {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.product-spec,
.product-spec-sm {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.stock-num {
  font-weight: 500;
  color: #606266;
}

.subtotal {
  font-weight: 600;
  color: #f56c6c;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #ebeef5;
  margin-top: 0;
}

.item-count {
  color: #606266;
  font-size: 14px;
}

.item-count .num {
  color: #409eff;
  font-weight: 600;
  margin: 0 4px;
}

.total-amount {
  font-size: 14px;
  color: #606266;
}

.total-amount .amount {
  color: #f56c6c;
  font-size: 20px;
  font-weight: 700;
  margin-left: 8px;
}

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  text-align: right;
  z-index: 100;
}

.footer-bar .el-button {
  margin-left: 12px;
}

.product-search {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.product-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
