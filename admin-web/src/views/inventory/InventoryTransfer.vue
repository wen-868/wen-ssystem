<template>
  <div class="transfer-page">
    <div class="page-header">
      <h2>多店调拨</h2>
      <p class="page-desc">管理门店间库存调拨，支持提交、审批、发货、收货全流程</p>
    </div>

    <!-- 搜索筛选区 -->
    <PageCard>
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="调拨单号">
          <el-input
            v-model="filterForm.keyword"
            placeholder="请输入调拨单号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="调出门店">
          <el-select
            v-model="filterForm.fromStoreId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="s in storeList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调入门店">
          <el-select
            v-model="filterForm.toStoreId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="s in storeList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><RefreshLeft /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <!-- 列表区 -->
    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建调拨
        </el-button>
        <el-button @click="loadTransfers">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>

      <!-- Tab 切换 -->
      <el-tabs v-model="activeTab" class="status-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane label="待审核" name="PENDING" />
        <el-tab-pane label="调拨中" name="TRANSFERRING" />
        <el-tab-pane label="已完成" name="COMPLETED" />
        <el-tab-pane label="已驳回" name="REJECTED" />
      </el-tabs>

      <DataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="pagination.total"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        @update:page="loadTransfers"
        @update:page-size="loadTransfers"
      >
        <template #status="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>

        <template #fromStore="{ row }">
          <span>{{ row.fromStoreName || '-' }}</span>
        </template>

        <template #toStore="{ row }">
          <span>{{ row.toStoreName || '-' }}</span>
        </template>

        <template #actions="{ row }">
          <el-button link type="primary" size="small" @click="handleView(row)">查看</el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="success"
            size="small"
            @click="handleSubmit(row)"
          >
            提交审核
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="warning"
            size="small"
            @click="handleEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="success"
            size="small"
            @click="handleApprove(row)"
          >
            审核通过
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="danger"
            size="small"
            @click="handleReject(row)"
          >
            驳回
          </el-button>
          <el-button
            v-if="row.status === 'APPROVED'"
            link
            type="primary"
            size="small"
            @click="handleShip(row)"
          >
            确认出库
          </el-button>
          <el-button
            v-if="row.status === 'SHIPPED'"
            link
            type="success"
            size="small"
            @click="handleReceive(row)"
          >
            确认入库
          </el-button>
          <el-button
            v-if="['DRAFT', 'PENDING'].includes(row.status)"
            link
            type="danger"
            size="small"
            @click="handleCancel(row)"
          >
            取消
          </el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 新建调拨弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="新建调拨单"
      width="900px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
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
          <el-col :span="12">
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
        </el-row>

        <el-form-item label="商品明细" prop="items">
          <div class="dialog-table-wrap">
            <el-table :data="form.items" border stripe size="small">
              <el-table-column label="商品名称" min-width="180">
                <template #default="{ row }">
                  <span v-if="row.skuName">{{ row.skuName }}</span>
                  <el-button v-else link type="primary" size="small" @click="openProductDialog">选择商品</el-button>
                </template>
              </el-table-column>
              <el-table-column label="规格" width="120">
                <template #default="{ row }">
                  {{ row.specs || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="箱数" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.boxQty"
                    :min="0"
                    size="small"
                    style="width: 100%"
                    @change="onBoxQtyChange(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="瓶数" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.bottleQty"
                    :min="0"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.unitPrice"
                    :min="0"
                    :precision="2"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="小计(元)" width="120" align="right">
                <template #default="{ row }">
                  <span class="subtotal-text">¥{{ computeSubtotal(row).toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center" fixed="right">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="removeItem($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="dialog-table-actions">
              <el-button size="small" type="primary" plain @click="openProductDialog">
                <el-icon><Plus /></el-icon> 添加商品
              </el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息（选填）"
          />
        </el-form-item>

        <el-form-item label="合计金额">
          <div class="dialog-total-wrap">
            <span class="dialog-total-label">
              共 <b>{{ form.items.length }}</b> 种商品，
              箱数 <b>{{ totalBoxQty }}</b>，
              瓶数 <b>{{ totalBottleQty }}</b>
            </span>
            <span class="dialog-total-amount">¥{{ totalAmount.toFixed(2) }}</span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" plain :loading="saveLoading" @click="handleSaveDraft">保存草稿</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmitCreate">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 商品选择弹窗 -->
    <el-dialog
      v-model="productDialogVisible"
      title="选择商品"
      width="780px"
      :close-on-click-modal="false"
      append-to-body
      destroy-on-close
    >
      <div class="product-search-bar">
        <el-input
          v-model="productSearchKey"
          placeholder="搜索商品名称/条码"
          clearable
          style="width: 260px"
          @keyup.enter="searchProducts"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" style="margin-left: 12px" @click="searchProducts">搜索</el-button>
      </div>

      <el-table
        :data="productList"
        border
        stripe
        height="380"
        @selection-change="onProductSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="商品名称" min-width="180" prop="name" />
        <el-table-column label="规格" width="120" prop="specs" />
        <el-table-column label="条码" width="140" prop="barcode" />
        <el-table-column label="库存" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.stock > 0" type="success" size="small">{{ row.stock }}</el-tag>
            <el-tag v-else type="danger" size="small">无货</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.price || 0).toFixed(2) }}</template>
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
        <el-button @click="productDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="selectedProducts.length === 0"
          @click="confirmAddProducts"
        >
          确认添加 ({{ selectedProducts.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh, RefreshLeft } from "@element-plus/icons-vue";
import {
  fetchTransfers,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  shipTransfer,
  receiveTransfer,
  fetchStores,
  fetchProducts,
  createTransfer
} from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";

const router = useRouter();

const loading = ref(false);
const tableData = ref<any[]>([]);
const storeList = ref<any[]>([]);
const activeTab = ref("all");

// ===== 新建调拨弹窗状态 =====
const dialogVisible = ref(false);
const productDialogVisible = ref(false);
const saveLoading = ref(false);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = () => ({
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  remark: "",
  items: [] as any[]
});

const form = reactive(defaultForm());

const formRules: FormRules = {
  fromStoreId: [{ required: true, message: "请选择调出门店", trigger: "change" }],
  toStoreId: [{ required: true, message: "请选择调入门店", trigger: "change" }],
  items: [{
    validator: (_rule: any, value: any[], callback: any) => {
      if (!value || value.length === 0) {
        callback(new Error("请至少添加一种商品"));
      } else {
        callback();
      }
    },
    trigger: "change"
  }]
};

// 商品选择相关
const productList = ref<any[]>([]);
const productSearchKey = ref("");
const productPage = ref(1);
const productTotal = ref(0);
const selectedProducts = ref<any[]>([]);

const availableToStores = computed(() => {
  if (!form.fromStoreId) return storeList.value;
  return storeList.value.filter((s: any) => s.id !== form.fromStoreId);
});

const totalBoxQty = computed(() => {
  return form.items.reduce((sum: number, item: any) => sum + Number(item.boxQty || 0), 0);
});

const totalBottleQty = computed(() => {
  return form.items.reduce((sum: number, item: any) => sum + Number(item.bottleQty || 0), 0);
});

const totalAmount = computed(() => {
  return form.items.reduce((sum: number, item: any) => sum + computeSubtotal(item), 0);
});

function computeSubtotal(row: any): number {
  const box = Number(row.boxQty || 0);
  const bottle = Number(row.bottleQty || 0);
  const price = Number(row.unitPrice || 0);
  return (box + bottle) * price;
}

function onFromStoreChange() {
  if (form.toStoreId === form.fromStoreId) {
    form.toStoreId = null;
  }
}

function onBoxQtyChange(_row: any) {
  // 箱数变化时的处理（预留，可在此实现箱瓶自动换算）
}

function resetCreateForm() {
  Object.assign(form, defaultForm());
  if (formRef.value) {
    formRef.value.clearValidate();
  }
}

function openProductDialog() {
  productSearchKey.value = "";
  productPage.value = 1;
  productDialogVisible.value = true;
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
    // mock 商品数据（前端独立开发）
    const mockProducts = [
      { id: 1, skuId: 1, name: "飞天茅台53度500ml", specs: "53度/500ml", barcode: "6902952880011", stock: 120, price: 2899 },
      { id: 2, skuId: 2, name: "五粮液普五52度500ml", specs: "52度/500ml", barcode: "6901382100015", stock: 200, price: 1099 },
      { id: 3, skuId: 3, name: "剑南春水晶剑52度500ml", specs: "52度/500ml", barcode: "6901434888886", stock: 150, price: 458 },
      { id: 4, skuId: 4, name: "泸州老窖特曲52度500ml", specs: "52度/500ml", barcode: "6901798111220", stock: 80, price: 328 },
      { id: 5, skuId: 5, name: "青岛啤酒经典500ml", specs: "500ml/罐", barcode: "6903252710017", stock: 500, price: 6.5 },
      { id: 6, skuId: 6, name: "百威啤酒500ml", specs: "500ml/罐", barcode: "6901236341005", stock: 400, price: 8.9 },
      { id: 7, skuId: 7, name: "拉菲传奇波尔多干红", specs: "750ml/瓶", barcode: "3201720000013", stock: 60, price: 168 },
      { id: 8, skuId: 8, name: "人头马VSOP700ml", specs: "700ml/瓶", barcode: "3024489000010", stock: 40, price: 528 }
    ];
    productList.value = mockProducts;
    productTotal.value = mockProducts.length;
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

function onProductSelectionChange(selection: any[]) {
  selectedProducts.value = selection;
}

function confirmAddProducts() {
  const existingIds = new Set(form.items.map((i: any) => i.skuId));
  let added = 0;
  for (const p of selectedProducts.value) {
    const skuId = p.skuId || p.id;
    if (existingIds.has(skuId)) continue;
    form.items.push({
      skuId,
      skuName: p.name || p.skuName,
      specs: p.specs || p.spec || "",
      barcode: p.barcode || "",
      boxQty: 0,
      bottleQty: 1,
      unitPrice: p.price || p.retailPrice || 0
    });
    added++;
  }
  if (added === 0 && selectedProducts.value.length > 0) {
    ElMessage.warning("选中的商品已在列表中");
  } else {
    ElMessage.success(`已添加 ${added} 种商品`);
  }
  productDialogVisible.value = false;
  selectedProducts.value = [];
  if (formRef.value) {
    formRef.value.validateField("items").catch(() => {});
  }
}

function removeItem(index: number) {
  form.items.splice(index, 1);
  if (formRef.value) {
    formRef.value.validateField("items").catch(() => {});
  }
}

async function handleSaveDraft() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    ElMessage.warning("请填写完整的调拨信息");
    return;
  }
  if (form.fromStoreId === form.toStoreId) {
    ElMessage.warning("调出门店和调入门店不能相同");
    return;
  }
  if (form.items.length === 0) {
    ElMessage.warning("请至少添加一种商品");
    return;
  }
  saveLoading.value = true;
  try {
    await createTransfer({ ...form, status: "DRAFT" });
    ElMessage.success("草稿保存成功");
    dialogVisible.value = false;
    loadTransfers();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

async function handleSubmitCreate() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    ElMessage.warning("请填写完整的调拨信息");
    return;
  }
  if (form.fromStoreId === form.toStoreId) {
    ElMessage.warning("调出门店和调入门店不能相同");
    return;
  }
  const invalid = form.items.some((i: any) => (Number(i.boxQty || 0) + Number(i.bottleQty || 0)) <= 0);
  if (invalid) {
    ElMessage.warning("商品数量必须大于0");
    return;
  }
  submitLoading.value = true;
  try {
    await createTransfer({ ...form, status: "PENDING" });
    ElMessage.success("提交审核成功");
    dialogVisible.value = false;
    loadTransfers();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "提交失败");
  } finally {
    submitLoading.value = false;
  }
}

const filterForm = reactive({
  keyword: "",
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  dateRange: [] as string[]
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "transferNo", label: "调拨单号", width: 180 },
  { label: "调出门店", minWidth: 140, slot: "fromStore" },
  { label: "调入门店", minWidth: 140, slot: "toStore" },
  { prop: "skuCount", label: "商品种类数", width: 110, align: "center" },
  { prop: "totalQty", label: "总数量", width: 100, align: "right" },
  { prop: "status", label: "状态", width: 110, slot: "status" },
  { prop: "creatorName", label: "创建人", width: 100 },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 320, fixed: "right", slot: "actions" }
];

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: "草稿", type: "info" },
  PENDING: { text: "待审核", type: "warning" },
  APPROVED: { text: "已通过", type: "success" },
  REJECTED: { text: "已驳回", type: "danger" },
  SHIPPED: { text: "调拨中", type: "primary" },
  RECEIVED: { text: "已完成", type: "success" },
  CANCELLED: { text: "已取消", type: "info" }
};

function getStatusText(status: string) {
  return statusMap[status]?.text || status;
}

function getStatusType(status: string) {
  return (statusMap[status]?.type as any) || "info";
}

async function loadTransfers() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (filterForm.keyword) params.keyword = filterForm.keyword;
    if (filterForm.fromStoreId) params.fromStoreId = filterForm.fromStoreId;
    if (filterForm.toStoreId) params.toStoreId = filterForm.toStoreId;
    if (activeTab.value !== "all") {
      if (activeTab.value === "TRANSFERRING") {
        params.status = "APPROVED,SHIPPED";
      } else if (activeTab.value === "COMPLETED") {
        params.status = "RECEIVED";
      } else {
        params.status = activeTab.value;
      }
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }

    const data = await fetchTransfers(params);
    const records = data.records || data.list || [];
    tableData.value = records.map((item: any) => ({
      ...item,
      skuCount: item.items?.length || item.skuCount || 0,
      totalQty: item.totalQty || item.items?.reduce((sum: number, it: any) => sum + (it.quantity || it.totalBottleQty || 0), 0) || 0
    }));
    pagination.total = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
    // 使用 mock 数据（前端独立开发）
    tableData.value = generateMockData();
    pagination.total = tableData.value.length;
  } finally {
    loading.value = false;
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data.records || data.list || []);
  } catch {
    // mock 门店数据
    storeList.value = [
      { id: 1, name: "总店" },
      { id: 2, name: "朝阳门店" },
      { id: 3, name: "海淀门店" },
      { id: 4, name: "丰台门店" }
    ];
  }
}

function generateMockData() {
  const statuses = ["DRAFT", "PENDING", "APPROVED", "SHIPPED", "RECEIVED", "REJECTED", "CANCELLED"];
  const fromStores = ["总店", "朝阳门店", "海淀门店"];
  const toStores = ["朝阳门店", "海淀门店", "丰台门店"];
  const creators = ["张三", "李四", "王五", "赵六"];
  const data: any[] = [];
  for (let i = 1; i <= 25; i++) {
    const status = statuses[i % statuses.length];
    data.push({
      id: i,
      transferNo: `DB202607${String(i).padStart(4, "0")}`,
      fromStoreId: (i % 3) + 1,
      fromStoreName: fromStores[i % fromStores.length],
      toStoreId: ((i + 1) % 3) + 2,
      toStoreName: toStores[i % toStores.length],
      skuCount: Math.floor(Math.random() * 10) + 1,
      totalQty: Math.floor(Math.random() * 100) + 10,
      status,
      creatorName: creators[i % creators.length],
      createdAt: `2026-07-${String(15 - (i % 10)).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:${String(i * 3 % 60).padStart(2, "0")}:00`,
      items: [
        { skuId: 1, skuName: "飞天茅台53度500ml", quantity: 10, unit: "瓶" },
        { skuId: 2, skuName: "五粮液普五52度500ml", quantity: 20, unit: "瓶" }
      ],
      remark: "常规补货调拨"
    });
  }
  return data;
}

function handleSearch() {
  pagination.page = 1;
  loadTransfers();
}

function handleReset() {
  filterForm.keyword = "";
  filterForm.fromStoreId = null;
  filterForm.toStoreId = null;
  filterForm.dateRange = [];
  activeTab.value = "all";
  pagination.page = 1;
  loadTransfers();
}

function handleTabChange() {
  pagination.page = 1;
  loadTransfers();
}

function handleCreate() {
  resetCreateForm();
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  router.push(`/inventory-transfer/edit/${row.id}`);
}

function handleView(row: any) {
  router.push(`/inventory-transfer/${row.id}`);
}

async function handleSubmit(row: any) {
  try {
    await ElMessageBox.confirm("确定提交该调拨单审核吗？", "提示", { type: "warning" });
    await submitTransfer(row.id);
    ElMessage.success("提交成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm("确定通过该调拨申请吗？", "审核通过", { type: "warning" });
    await approveTransfer(row.id);
    ElMessage.success("审核通过");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReject(row: any) {
  try {
    const { value } = await ElMessageBox.prompt("请输入驳回原因", "驳回调拨", {
      type: "warning",
      inputPlaceholder: "请输入驳回原因",
      confirmButtonText: "确定驳回"
    });
    await rejectTransfer(row.id);
    ElMessage.success("已驳回");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleShip(row: any) {
  try {
    await ElMessageBox.confirm("确定执行出库操作吗？出库后库存将从调出门店扣减。", "确认出库", { type: "warning" });
    await shipTransfer(row.id);
    ElMessage.success("出库成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReceive(row: any) {
  try {
    await ElMessageBox.confirm("确定执行入库操作吗？入库后库存将增加到调入门店。", "确认入库", { type: "warning" });
    await receiveTransfer(row.id, {});
    ElMessage.success("入库成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该调拨单吗？", "提示", { type: "warning" });
    await cancelTransfer(row.id);
    ElMessage.success("已取消");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

onMounted(() => {
  loadTransfers();
  loadStores();
});
</script>

<style scoped>
.transfer-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-form {
  margin: 0;
}

.status-tabs {
  margin-bottom: 16px;
}

.status-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.dialog-table-wrap {
  width: 100%;
}

.dialog-table-actions {
  margin-top: 10px;
}

.subtotal-text {
  color: #f56c6c;
  font-weight: 600;
}

.dialog-total-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.dialog-total-label {
  color: #606266;
  font-size: 14px;
}

.dialog-total-label b {
  color: #409eff;
  margin: 0 4px;
  font-weight: 600;
}

.dialog-total-amount {
  color: #f56c6c;
  font-size: 20px;
  font-weight: 700;
}

.product-search-bar {
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
