<template>
  <div class="page">
    <!-- 统计卡片行 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="28"><Goods /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">兑换商品总数</div>
          <div class="stat-value">{{ stats.totalProducts }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="28"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">上架商品数</div>
          <div class="stat-value">{{ stats.onlineProducts }}</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="28"><ShoppingCart /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">总兑换量</div>
          <div class="stat-value">{{ stats.totalExchanges.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="28"><Coin /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">总消耗积分</div>
          <div class="stat-value">{{ stats.totalPoints.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <el-card>
      <el-tabs v-model="activeTab">
        <!-- 兑换商品管理 Tab -->
        <el-tab-pane label="兑换商品管理" name="products">
          <div class="tab-toolbar">
            <el-input
              v-model="productKeyword"
              placeholder="搜索商品名称"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadProducts"
              @keyup.enter="loadProducts"
            />
            <el-select v-model="productStatus" placeholder="状态" style="width: 120px; margin-right: 10px" clearable @change="loadProducts">
              <el-option label="上架" value="ON" />
              <el-option label="下架" value="OFF" />
            </el-select>
            <el-button @click="loadProducts">搜索</el-button>
            <el-button type="primary" @click="openProductDialog()">新建商品</el-button>
            <el-button @click="loadProducts">刷新</el-button>
          </div>

          <el-row :gutter="16">
            <el-col v-for="product in products" :key="product.id" :xs="24" :sm="12" :md="8" :lg="6" style="margin-bottom: 16px">
              <div class="product-card" :class="{ 'product-sold-out': product.remainingStock === 0 }">
                <div class="product-image-wrap">
                  <el-image
                    lazy
                    :src="product.productImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjdmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2MwYzRjYyIgZm9udC1zaXplPSIxNiI+5ZWG5ZOB5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='"
                    fit="cover"
                    style="width: 100%; height: 140px"
                    :preview-src-list="product.productImage ? [product.productImage] : []"
                  />
                  <div v-if="product.remainingStock === 0" class="sold-out-mask">
                    <span>已兑完</span>
                  </div>
                  <el-tag
                    :type="product.status === 'ON' ? 'success' : 'info'"
                    size="small"
                    class="product-status-tag"
                  >
                    {{ product.status === 'ON' ? '上架' : '下架' }}
                  </el-tag>
                </div>
                <div class="product-card-body">
                  <div class="product-name">{{ product.productName }}</div>
                  <div class="product-points">
                    <span class="points-value">{{ product.pointsRequired }}</span>
                    <span class="points-unit">积分</span>
                  </div>
                  <div class="product-market-price">
                    <span class="market-price-label">参考价</span>
                    <span class="market-price-value">¥{{ product.marketPrice }}</span>
                  </div>
                  <div class="product-stock">
                    库存：{{ product.remainingStock }}/{{ product.totalStock }}
                  </div>
                  <div class="product-exchange-count">
                    已兑 {{ product.exchangeCount }} 次
                  </div>
                </div>
                <div class="product-card-actions">
                  <el-button size="small" type="primary" @click="openProductDialog(product)">编辑</el-button>
                  <el-button
                    size="small"
                    :type="product.status === 'ON' ? 'warning' : 'success'"
                    @click="toggleProductStatus(product)"
                  >
                    {{ product.status === 'ON' ? '下架' : '上架' }}
                  </el-button>
                  <el-popconfirm title="确认删除该商品？" @confirm="deleteProduct(product)">
                    <template #reference>
                      <el-button size="small" type="danger">删除</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
            </el-col>
          </el-row>

          <div v-if="products.length === 0" style="text-align: center; padding: 40px; color: var(--gray-400)">
            <el-empty description="暂无商品" />
          </div>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="productTotal"
              :page-size="productPageSize"
              :current-page="productPage"
              @size-change="handleProductSizeChange"
              @current-change="handleProductPageChange"
            />
          </div>
        </el-tab-pane>

        <!-- 兑换记录 Tab -->
        <el-tab-pane label="兑换记录" name="records">
          <div class="tab-toolbar">
            <el-date-picker
              v-model="recordDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="margin-right: 10px"
              @change="loadExchangeRecords"
            />
            <el-select v-model="recordStatus" placeholder="状态" style="width: 120px; margin-right: 10px" clearable @change="loadExchangeRecords">
              <el-option label="全部" value="" />
              <el-option label="待确认" value="PENDING" />
              <el-option label="已确认" value="CONFIRMED" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-button @click="loadExchangeRecords">搜索</el-button>
            <el-button @click="exportRecords">导出兑换记录</el-button>
          </div>

          <el-table :data="exchangeRecords" stripe>
            <el-table-column prop="exchangeCode" label="兑换编号" width="160" />
            <el-table-column label="用户信息" min-width="160">
              <template #default="{ row }">
                {{ row.memberName }} / {{ row.memberPhone }}
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="140" />
            <el-table-column prop="pointsUsed" label="消耗积分" width="110" />
            <el-table-column prop="exchangeQty" label="兑换数量" width="100" />
            <el-table-column prop="createdAt" label="兑换时间" width="170" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
                <el-tag v-else-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
                <el-tag v-else-if="row.status === 'CANCELLED'" type="info">已取消</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-popconfirm
                  v-if="row.status === 'PENDING'"
                  title="确认兑换？"
                  @confirm="confirmExchange(row)"
                >
                  <template #reference>
                    <el-button size="small" link type="success">确认兑换</el-button>
                  </template>
                </el-popconfirm>
                <el-popconfirm
                  v-if="row.status === 'PENDING'"
                  title="取消兑换将退回积分，确认取消？"
                  @confirm="cancelExchange(row)"
                >
                  <template #reference>
                    <el-button size="small" link type="danger">取消兑换</el-button>
                  </template>
                </el-popconfirm>
                <span v-if="row.status !== 'PENDING'" style="color: var(--gray-400)">-</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="recordTotal"
              :page-size="recordPageSize"
              :current-page="recordPage"
              @size-change="handleRecordSizeChange"
              @current-change="handleRecordPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新建/编辑商品对话框 -->
    <el-dialog
      v-model="productDialogVisible"
      :title="editingProduct ? '编辑商品' : '新建商品'"
      width="720px"
      @close="resetProductForm"
    >
      <el-form ref="productFormRef" :model="productForm" :rules="productRules" label-width="100px">
        <el-form-item label="商品图片">
          <el-upload
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :file-list="productImageList"
            :on-change="handleProductImageChange"
            :on-remove="handleProductImageRemove"
            :limit="1"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="productForm.productName" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="商品描述">
          <el-input v-model="productForm.productDesc" type="textarea" :rows="3" placeholder="请输入商品描述" />
        </el-form-item>
        <el-form-item label="所需积分">
          <el-input-number v-model="productForm.pointsRequired" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="市场参考价">
          <el-input-number v-model="productForm.marketPrice" :min="0" :precision="2" style="width: 200px" />
        </el-form-item>
        <el-form-item label="总库存">
          <el-input-number v-model="productForm.totalStock" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="每人限兑次数">
          <el-input-number v-model="productForm.limitPerPerson" :min="1" :max="99" style="width: 200px" />
        </el-form-item>
        <el-form-item label="总限兑次数">
          <el-input-number v-model="productForm.limitTotal" :min="1" :max="9999" style="width: 200px" />
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="productForm.sortOrder" :min="0" :max="999" style="width: 200px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitProduct">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import { Goods, CircleCheck, ShoppingCart, Coin, Plus } from "@element-plus/icons-vue";

// ==================== Mock 数据 ====================
const mockStats = {
  totalProducts: 45,
  onlineProducts: 28,
  totalExchanges: 12580,
  totalPoints: 2560000,
};

const mockProducts = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  productName: `积分商品${i + 1}`,
  productDesc: `这是积分商品${i + 1}的描述`,
  productImage: "",
  pointsRequired: Math.floor(Math.random() * 5000 + 500),
  marketPrice: Math.floor(Math.random() * 200 + 50),
  remainingStock: Math.floor(Math.random() * 100),
  totalStock: Math.floor(Math.random() * 200 + 100),
  status: i % 3 === 0 ? "OFF" : "ON",
  sortOrder: i + 1,
  exchangeCount: Math.floor(Math.random() * 500 + 50),
}));

const mockExchangeRecords = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  exchangeCode: `EX202606${String(i + 1).padStart(4, "0")}`,
  memberName: `用户${i + 1}`,
  memberPhone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
  productName: `积分商品${Math.floor(Math.random() * 20) + 1}`,
  pointsUsed: Math.floor(Math.random() * 3000 + 500),
  exchangeQty: Math.floor(Math.random() * 3) + 1,
  status: ["PENDING", "CONFIRMED", "CANCELLED"][i % 3],
  createdAt: `2026-06-${String(Math.floor(Math.random() * 30) + 1).padStart(2, "0")} ${String(
    Math.floor(Math.random() * 24)
  ).padStart(2, "0")}:00:00`,
}));

// ==================== 统计 ====================
const stats = reactive({ ...mockStats });

// ==================== Tab 切换 ====================
const activeTab = ref("products");

// ==================== 商品管理 ====================
const productKeyword = ref("");
const productStatus = ref("");
const products = ref<any[]>([...mockProducts]);
const productTotal = ref(mockProducts.length);
const productPage = ref(1);
const productPageSize = ref(20);

function loadProducts() {
  let filtered = [...mockProducts];
  if (productKeyword.value) {
    filtered = filtered.filter((p) => p.productName.includes(productKeyword.value));
  }
  if (productStatus.value) {
    filtered = filtered.filter((p) => p.status === productStatus.value);
  }
  productTotal.value = filtered.length;
  const start = (productPage.value - 1) * productPageSize.value;
  products.value = filtered.slice(start, start + productPageSize.value);
}

function handleProductSizeChange(size: number) {
  productPageSize.value = size;
  productPage.value = 1;
  loadProducts();
}

function handleProductPageChange(p: number) {
  productPage.value = p;
  loadProducts();
}

async function toggleProductStatus(product: any) {
  const newStatus = product.status === "ON" ? "OFF" : "ON";
  product.status = newStatus;
  ElMessage.success(`已${newStatus === "ON" ? "上架" : "下架"}`);
  loadProducts();
}

async function deleteProduct(product: any) {
  const idx = mockProducts.findIndex((p) => p.id === product.id);
  if (idx > -1) mockProducts.splice(idx, 1);
  ElMessage.success("已删除");
  loadProducts();
}

// ==================== 商品表单 ====================
const productDialogVisible = ref(false);
const editingProduct = ref<any>(null);
const productImageList = ref<any[]>([]);

const productForm = reactive({
  productName: "",
  productDesc: "",
  productImage: "",
  pointsRequired: 100,
  marketPrice: 0,
  totalStock: 100,
  limitPerPerson: 1,
  limitTotal: 100,
  sortOrder: 1,
});

const productFormRef = ref();
const productRules: FormRules = {
  productName: [{ required: true, message: "请输入商品名称", trigger: "blur" }],
  pointsRequired: [{ required: true, message: "请输入所需积分", trigger: "blur" }],
  totalStock: [{ required: true, message: "请输入总库存", trigger: "blur" }]
};

function openProductDialog(product?: any) {
  if (product) {
    editingProduct.value = product;
    productForm.productName = product.productName;
    productForm.productDesc = product.productDesc;
    productForm.productImage = product.productImage;
    productForm.pointsRequired = product.pointsRequired;
    productForm.marketPrice = product.marketPrice;
    productForm.totalStock = product.totalStock;
    productForm.limitPerPerson = product.limitPerPerson || 1;
    productForm.limitTotal = product.limitTotal || 100;
    productForm.sortOrder = product.sortOrder;
    if (product.productImage) {
      productImageList.value = [{ url: product.productImage, name: "image" }];
    }
  } else {
    editingProduct.value = null;
    resetProductForm();
  }
  productDialogVisible.value = true;
}

function resetProductForm() {
  productForm.productName = "";
  productForm.productDesc = "";
  productForm.productImage = "";
  productForm.pointsRequired = 100;
  productForm.marketPrice = 0;
  productForm.totalStock = 100;
  productForm.limitPerPerson = 1;
  productForm.limitTotal = 100;
  productForm.sortOrder = 1;
  productImageList.value = [];
  editingProduct.value = null;
}

function handleProductImageChange(file: any) {
  productImageList.value = [file];
  const reader = new FileReader();
  reader.onload = (e) => {
    productForm.productImage = (e.target?.result as string) || "";
  };
  if (file.raw) {
    reader.readAsDataURL(file.raw);
  }
}

function handleProductImageRemove() {
  productImageList.value = [];
  productForm.productImage = "";
}

async function submitProduct() {
  const valid = await productFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (editingProduct.value) {
    Object.assign(editingProduct.value, productForm);
    ElMessage.success("修改成功");
  } else {
    mockProducts.push({
      id: mockProducts.length + 1,
      ...productForm,
      remainingStock: productForm.totalStock,
      status: "ON",
      exchangeCount: 0,
    });
    ElMessage.success("创建成功");
  }
  productDialogVisible.value = false;
  loadProducts();
}

// ==================== 兑换记录 ====================
const recordDateRange = ref<any[]>([]);
const recordStatus = ref("");
const exchangeRecords = ref<any[]>([...mockExchangeRecords]);
const recordTotal = ref(mockExchangeRecords.length);
const recordPage = ref(1);
const recordPageSize = ref(20);

function loadExchangeRecords() {
  let filtered = [...mockExchangeRecords];
  if (recordStatus.value) {
    filtered = filtered.filter((r) => r.status === recordStatus.value);
  }
  recordTotal.value = filtered.length;
  const start = (recordPage.value - 1) * recordPageSize.value;
  exchangeRecords.value = filtered.slice(start, start + recordPageSize.value);
}

function handleRecordSizeChange(size: number) {
  recordPageSize.value = size;
  recordPage.value = 1;
  loadExchangeRecords();
}

function handleRecordPageChange(p: number) {
  recordPage.value = p;
  loadExchangeRecords();
}

function confirmExchange(row: any) {
  row.status = "CONFIRMED";
  ElMessage.success("兑换已确认");
  loadExchangeRecords();
}

function cancelExchange(row: any) {
  row.status = "CANCELLED";
  ElMessage.success("兑换已取消，积分已退回");
  loadExchangeRecords();
}

function exportRecords() {
  ElMessage.success("兑换记录导出中...");
}
</script>

<style scoped>
.page {
  padding: 20px;
}

/* 统计卡片 */
.stat-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  color: var(--text-inverse);
}

.stat-card.stat-primary {
  background: linear-gradient(135deg, var(--color-primary), rgba(63,111,239,0.4));
}
.stat-card.stat-success {
  background: linear-gradient(135deg, var(--color-success), rgba(14,168,121,0.4));
}
.stat-card.stat-warning {
  background: linear-gradient(135deg, var(--color-warning), rgba(212,139,58,0.4));
}
.stat-card.stat-danger {
  background: linear-gradient(135deg, var(--color-danger), rgba(192,57,43,0.4));
}

.stat-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
}

/* 工具栏 */
.tab-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

/* 商品卡片 */
.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.3s, transform 0.3s;
  position: relative;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.product-card:hover .product-card-actions {
  opacity: 1;
}

.product-image-wrap {
  position: relative;
}

.sold-out-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-inverse);
  font-size: 18px;
  font-weight: 600;
}

.product-status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
}

.product-card-body {
  padding: 12px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-points {
  margin-bottom: 6px;
}

.points-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-danger);
}

.points-unit {
  font-size: 13px;
  color: var(--color-danger);
  margin-left: 2px;
}

.product-market-price {
  font-size: 12px;
  margin-bottom: 6px;
}

.market-price-label {
  color: var(--gray-400);
}

.market-price-value {
  color: var(--gray-400);
  text-decoration: line-through;
  margin-left: 4px;
}

.product-stock {
  font-size: 12px;
  color: var(--gray-600);
  margin-bottom: 4px;
}

.product-exchange-count {
  font-size: 12px;
  color: var(--gray-400);
}

.product-card-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  gap: 6px;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.product-sold-out .product-card-actions {
  opacity: 1;
}

/* 分页 */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
