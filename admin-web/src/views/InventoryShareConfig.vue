<template>
  <div class="share-config-page">
    <div class="page-header">
      <h2>库存共享设置</h2>
      <p class="page-desc">配置跨店库存共享规则，实现门店间库存智能调配</p>
    </div>

    <!-- 共享总开关 -->
    <PageCard>
      <div class="share-switch-row">
        <div>
          <div class="switch-title">库存共享总开关</div>
          <div class="switch-desc">开启后，符合条件的商品可在共享门店间自动调配</div>
        </div>
        <el-switch
          v-model="globalEnabled"
          :active-text="globalEnabled ? '已开启' : '已关闭'"
          size="large"
          @change="onGlobalSwitchChange"
        />
      </div>
    </PageCard>

    <!-- Tab 切换 -->
    <PageCard>
      <el-tabs v-model="activeTab">
        <!-- 共享商品 -->
        <el-tab-pane label="共享商品" name="products">
          <div class="tab-toolbar">
            <el-input
              v-model="productSearch"
              placeholder="搜索商品名称/条码"
              clearable
              style="width: 260px"
              @keyup.enter="loadShareProducts"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-select v-model="productCategory" placeholder="分类" clearable style="width: 140px; margin-left: 12px">
              <el-option label="全部" value="" />
              <el-option label="白酒" value="baijiu" />
              <el-option label="啤酒" value="beer" />
              <el-option label="红酒" value="wine" />
            </el-select>
            <el-button type="primary" style="margin-left: 12px" @click="loadShareProducts">
              <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button type="success" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon> 添加共享商品
            </el-button>
            <el-button @click="loadShareProducts">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>

          <el-table :data="shareProducts" border stripe v-loading="productLoading">
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
                <div class="product-name">{{ row.name || row.skuName }}</div>
                <div class="product-spec">{{ row.specs || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="barcode" label="条码" width="140" />
            <el-table-column label="共享库存" width="120" align="center">
              <template #default="{ row }">
              <el-tag type="success" size="small">{{ row.shareStock || 0 }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="共享比例" width="120" align="center">
              <template #default="{ row }">
                {{ row.shareRatio || 50 }}%
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.priority === 1 ? 'danger' : row.priority === 2 ? 'warning' : 'info'" size="small">
                  P{{ row.priority || 3 }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="自动调拨阈值" width="140" align="center">
              <template #default="{ row }">
                ≤ {{ row.autoTransferThreshold || 10 }} 件
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" size="small" @change="toggleProductShare(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="editProductConfig(row)">配置</el-button>
                <el-button link type="danger" size="small" @click="removeShareProduct(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="productTotal"
              :page-size="productPageSize"
              :current-page="productPage"
              @size-change="onProductPageSizeChange"
              @current-change="onProductPageChange"
            />
          </div>
        </el-tab-pane>

        <!-- 共享规则 -->
        <el-tab-pane label="共享规则" name="rules">
          <el-form :model="ruleForm" label-width="140px" style="max-width: 600px; padding: 20px 0">
            <el-form-item label="共享比例">
              <el-input-number v-model="ruleForm.defaultShareRatio" :min="0" :max="100" style="width: 150px" />
              <span style="margin-left: 8px; color: #909399">%</span>
              <div class="form-tip">默认共享比例，即门店可共享给其他门店的库存占总库存的比例</div>
            </el-form-item>
            <el-form-item label="自动调拨阈值">
              <el-input-number v-model="ruleForm.autoTransferThreshold" :min="1" :max="999" style="width: 150px" />
              <span style="margin-left: 8px; color: #909399">件</span>
              <div class="form-tip">当调入门店该商品库存低于此值时，自动触发调拨</div>
            </el-form-item>
            <el-form-item label="自动调拨优先级">
              <el-radio-group v-model="ruleForm.priorityStrategy">
                <el-radio value="nearest">就近优先</el-radio>
                <el-radio value="stock">库存最多优先</el-radio>
                <el-radio value="cost">成本最低优先</el-radio>
              </el-radio-group>
              <div class="form-tip">自动调拨时选择调出店的优先策略</div>
            </el-form-item>
            <el-form-item label="调拨审核方式">
              <el-radio-group v-model="ruleForm.approvalMode">
                <el-radio value="auto">自动执行（无需审核）</el-radio>
                <el-radio value="manual">人工审核</el-radio>
              </el-radio-group>
              <div class="form-tip">自动调拨生成的调拨单是否需要人工审核</div>
            </el-form-item>
            <el-form-item label="调拨时间窗口">
              <el-time-picker
                v-model="ruleForm.transferTime"
                is-range
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 300px"
              />
              <div class="form-tip">自动调拨仅在此时间范围内执行</div>
            </el-form-item>
            <el-form-item label="单日最大调拨量">
              <el-input-number v-model="ruleForm.dailyMaxTransfer" :min="0" :max="99999" style="width: 150px" />
              <span style="margin-left: 8px; color: #909399">件</span>
              <div class="form-tip">单个门店单日最大调入量上限，0表示不限制</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveRules">保存规则</el-button>
              <el-button @click="resetRules">重置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 共享门店 -->
        <el-tab-pane label="共享门店" name="stores">
          <div class="tab-toolbar">
            <span style="color: #606266">选择参与库存共享的门店，选中的门店之间可互相调拨库存</span>
          </div>
          <el-table :data="storeList" border stripe>
            <el-table-column type="selection" width="55" />
            <el-table-column prop="name" label="门店名称" min-width="160" />
            <el-table-column prop="address" label="门店地址" min-width="200" />
            <el-table-column label="共享状态" width="120" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.shareEnabled" size="small" @change="toggleStoreShare(row)" />
              </template>
            </el-table-column>
            <el-table-column label="库存总量" width="120" align="right">
              <template #default="{ row }">{{ row.totalStock || 0 }} 件</template>
            </el-table-column>
            <el-table-column label="可共享库存" width="130" align="right">
              <template #default="{ row }">
                <span style="color: #67c23a; font-weight: 600">{{ row.shareableStock || 0 }} 件</span>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 16px; text-align: right">
            <el-button type="primary" @click="saveStoreConfig">保存配置</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 添加共享商品对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加共享商品"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="product-search">
        <el-input
        v-model="addProductSearch"
        placeholder="搜索商品名称/条码"
        clearable
        style="width: 260px"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" style="margin-left: 12px" @click="searchAddProducts">搜索</el-button>
    </div>
    <el-table
      :data="addProductList"
      border
      height="350px"
      @selection-change="onAddProductSelectionChange"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column label="商品图片" width="60" align="center">
        <template #default="{ row }">
          <el-image
            :src="row.imageUrl || placeholderImg"
            fit="cover"
            style="width: 36px; height: 36px; border-radius: 4px"
          />
        </template>
      </el-table-column>
      <el-table-column label="商品名称" min-width="160">
        <template #default="{ row }">
          <div class="product-name-sm">{{ row.name }}</div>
          <div class="product-spec-sm">{{ row.specs || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="barcode" label="条码" width="130" />
      <el-table-column label="当前库存" width="100" align="right">
        <template #default="{ row }">{{ row.stock || 0 }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="showAddDialog = false">取消</el-button>
      <el-button type="primary" :disabled="addSelectedProducts.length === 0" @click="confirmAddProducts">
        确认添加 ({{ addSelectedProducts.length }})
      </el-button>
    </template>
  </el-dialog>

  <!-- 配置商品对话框 -->
  <el-dialog
    v-model="showConfigDialog"
    title="共享配置"
    width="500px"
    :close-on-click-modal="false"
  >
    <el-form :model="configForm" label-width="120px">
      <el-form-item label="商品名称">
        <span>{{ configProduct?.name }}</span>
      </el-form-item>
      <el-form-item label="共享比例">
        <el-input-number v-model="configForm.shareRatio" :min="0" :max="100" style="width: 150px" />
        <span style="margin-left: 8px">%</span>
      </el-form-item>
      <el-form-item label="优先级">
        <el-radio-group v-model="configForm.priority">
          <el-radio :value="1">P1（最高）</el-radio>
          <el-radio :value="2">P2</el-radio>
          <el-radio :value="3">P3（普通）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="自动调拨阈值">
        <el-input-number v-model="configForm.autoTransferThreshold" :min="1" :max="999" style="width: 150px" />
        <span style="margin-left: 8px">件</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showConfigDialog = false">取消</el-button>
      <el-button type="primary" @click="saveProductConfig">保存</el-button>
    </template>
  </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import { fetchStores, fetchProducts } from "../api";
import PageCard from "../components/PageCard.vue";

const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect fill='%23f5f7fa' width='80' height='80'/%3E%3Ctext fill='%23c0c4cc' font-family='Arial' font-size='12' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E暂无图片%3C/text%3E%3C/svg%3E";

const activeTab = ref("products");
const globalEnabled = ref(true);

// 共享商品
const productLoading = ref(false);
const productSearch = ref("");
const productCategory = ref("");
const productPage = ref(1);
const productPageSize = ref(10);
const productTotal = ref(0);
const shareProducts = ref<any[]>([]);

// 共享规则
const ruleForm = reactive({
  defaultShareRatio: 50,
  autoTransferThreshold: 10,
  priorityStrategy: "nearest",
  approvalMode: "manual",
  transferTime: ["09:00", "18:00"] as [string, string] | null,
  dailyMaxTransfer: 100
});

// 共享门店
const storeList = ref<any[]>([]);

// 添加商品弹窗
const showAddDialog = ref(false);
const addProductSearch = ref("");
const addProductList = ref<any[]>([]);
const addSelectedProducts = ref<any[]>([]);

// 配置弹窗
const showConfigDialog = ref(false);
const configProduct = ref<any>(null);
const configForm = reactive({
  shareRatio: 50,
  priority: 3,
  autoTransferThreshold: 10
});

async function loadShareProducts() {
  productLoading.value = true;
  try {
    const data = await fetchProducts({
      keyword: productSearch.value || undefined,
      page: productPage.value,
      pageSize: productPageSize.value
    });
    const records = data.records || data.list || [];
    shareProducts.value = records.map((p: any) => ({
      ...p,
      name: p.name || p.skuName,
      shareStock: Math.floor((p.stock || 100) * 0.5),
      shareRatio: 50,
      priority: (p.id % 3) + 1,
      autoTransferThreshold: 10 + (p.id % 20),
      enabled: true
    }));
    productTotal.value = data.total || 0;
  } catch {
    // mock 数据
    shareProducts.value = [
      { id: 1, skuId: 1, name: "飞天茅台53度500ml", specs: "53度/500ml", barcode: "6902952880011", stock: 120, shareStock: 60, shareRatio: 50, priority: 1, autoTransferThreshold: 20, enabled: true, imageUrl: "" },
      { id: 2, skuId: 2, name: "五粮液普五52度500ml", specs: "52度/500ml", barcode: "6901382100015", stock: 200, shareStock: 100, shareRatio: 50, priority: 1, autoTransferThreshold: 30, enabled: true, imageUrl: "" },
      { id: 3, skuId: 3, name: "剑南春水晶剑52度500ml", specs: "52度/500ml", barcode: "6901434888886", stock: 150, shareStock: 75, shareRatio: 50, priority: 2, autoTransferThreshold: 15, enabled: true, imageUrl: "" },
      { id: 4, skuId: 4, name: "泸州老窖特曲52度500ml", specs: "52度/500ml", barcode: "6901798111220", stock: 80, shareStock: 40, shareRatio: 50, priority: 2, autoTransferThreshold: 10, enabled: false, imageUrl: "" },
      { id: 5, skuId: 5, name: "青岛啤酒经典500ml", specs: "500ml/罐", barcode: "6903252710017", stock: 500, shareStock: 250, shareRatio: 50, priority: 3, autoTransferThreshold: 50, enabled: true, imageUrl: "" }
    ];
    productTotal.value = shareProducts.value.length;
  } finally {
    productLoading.value = false;
  }
}

function onProductPageChange(page: number) {
  productPage.value = page;
  loadShareProducts();
}

function onProductPageSizeChange(size: number) {
  productPageSize.value = size;
  productPage.value = 1;
  loadShareProducts();
}

function toggleProductShare(row: any) {
  ElMessage.success(row.enabled ? "已开启共享" : "已关闭共享");
}

function editProductConfig(row: any) {
  configProduct.value = row;
  configForm.shareRatio = row.shareRatio || 50;
  configForm.priority = row.priority || 3;
  configForm.autoTransferThreshold = row.autoTransferThreshold || 10;
  showConfigDialog.value = true;
}

function saveProductConfig() {
  if (configProduct.value) {
    configProduct.value.shareRatio = configForm.shareRatio;
    configProduct.value.priority = configForm.priority;
    configProduct.value.autoTransferThreshold = configForm.autoTransferThreshold;
  }
  ElMessage.success("配置已保存");
  showConfigDialog.value = false;
}

function removeShareProduct(row: any) {
  ElMessageBox.confirm(`确定移除共享商品「${row.name}」吗？`, "提示", {
    type: "warning"
  }).then(() => {
    const idx = shareProducts.value.findIndex((p: any) => p.id === row.id);
    if (idx > -1) shareProducts.value.splice(idx, 1);
    ElMessage.success("已移除");
  }).catch(() => {});
}

function searchAddProducts() {
  // mock 搜索
  addProductList.value = [
    { id: 10, name: "洋河蓝色经典52度500ml", specs: "52度/500ml", barcode: "6901234567890", stock: 60, imageUrl: "" },
    { id: 11, name: "古井贡酒52度500ml", specs: "52度/500ml", barcode: "6902345678901", stock: 80, imageUrl: "" },
    { id: 12, name: "汾酒青花20年53度500ml", specs: "53度/500ml", barcode: "6903456789012", stock: 45, imageUrl: "" },
    { id: 13, name: "百威啤酒500ml", specs: "500ml/罐", barcode: "6904567890123", stock: 300, imageUrl: "" }
  ];
}

function onAddProductSelectionChange(selection: any[]) {
  addSelectedProducts.value = selection;
}

function confirmAddProducts() {
  const existingIds = new Set(shareProducts.value.map((p: any) => p.id));
  let added = 0;
  for (const p of addSelectedProducts.value) {
    if (existingIds.has(p.id)) continue;
    shareProducts.value.unshift({
      ...p,
      shareStock: Math.floor((p.stock || 0) * 0.5),
      shareRatio: ruleForm.defaultShareRatio,
      priority: 3,
      autoTransferThreshold: ruleForm.autoTransferThreshold,
      enabled: true
    });
    added++;
  }
  if (added === 0 && addSelectedProducts.value.length > 0) {
    ElMessage.warning("选中的商品已在共享列表中");
  } else {
    ElMessage.success(`已添加 ${added} 种共享商品`);
  }
  showAddDialog.value = false;
  addSelectedProducts.value = [];
}

function saveRules() {
  ElMessage.success("共享规则保存成功");
}

function resetRules() {
  ruleForm.defaultShareRatio = 50;
  ruleForm.autoTransferThreshold = 10;
  ruleForm.priorityStrategy = "nearest";
  ruleForm.approvalMode = "manual";
  ruleForm.transferTime = ["09:00", "18:00"];
  ruleForm.dailyMaxTransfer = 100;
}

async function loadStores() {
  try {
    const data = await fetchStores();
    const stores = Array.isArray(data) ? data : (data.records || data.list || []);
    storeList.value = stores.map((s: any, i: number) => ({
      ...s,
      shareEnabled: i < 3,
      totalStock: Math.floor(Math.random() * 500) + 100,
      shareableStock: Math.floor(Math.random() * 200) + 50
    }));
  } catch {
    storeList.value = [
      { id: 1, name: "总店", address: "北京市朝阳区建国路88号", shareEnabled: true, totalStock: 1200, shareableStock: 600 },
      { id: 2, name: "朝阳门店", address: "北京市朝阳区朝阳门外大街1号", shareEnabled: true, totalStock: 800, shareableStock: 400 },
      { id: 3, name: "海淀门店", address: "北京市海淀区中关村大街1号", shareEnabled: true, totalStock: 650, shareableStock: 325 },
      { id: 4, name: "丰台门店", address: "北京市丰台区丰台路5号", shareEnabled: false, totalStock: 450, shareableStock: 0 }
    ];
  }
}

function toggleStoreShare(row: any) {
  ElMessage.success(row.shareEnabled ? row.name + " 已加入共享" : row.name + " 已退出共享");
}

function saveStoreConfig() {
  ElMessage.success("门店配置保存成功");
}

function onGlobalSwitchChange(val: boolean) {
  ElMessage.success(val ? "库存共享已开启" : "库存共享已关闭");
}

onMounted(() => {
  loadShareProducts();
  loadStores();
});
</script>

<style scoped>
.share-config-page {
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

.share-switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.switch-desc {
  font-size: 13px;
  color: #909399;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.product-search {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
</style>
