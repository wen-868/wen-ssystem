<template>
  <div class="page">
    <div class="shelf-layout">
      <div class="category-sidebar">
        <el-card class="sidebar-card">
          <div class="sidebar-header">
            <span class="sidebar-title">商品分类</span>
          </div>
          <el-tree
            :data="categoryTree"
            :props="{ label: 'name', children: 'children' }"
            :highlight-current="true"
            :expand-on-click-node="false"
            default-expand-all
            node-key="id"
            @node-click="handleCategoryClick"
            class="category-tree"
          >
            <template #default="{ node, data }">
              <span class="custom-tree-node">
                <el-image v-if="data.icon" :src="data.icon" fit="cover" class="tree-icon" />
                <span class="node-label">{{ data.name }}</span>
                <span class="node-count">({{ data.count || 0 }})</span>
              </span>
            </template>
          </el-tree>
        </el-card>
      </div>

      <div class="main-content">
        <el-card>
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input
                v-model="keyword"
                placeholder="搜索商品名称/SKU"
                clearable
                style="width: 240px; margin-right: 12px"
                @clear="loadData"
                @keyup.enter="loadData"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
                <el-option label="已上架" value="ON" />
                <el-option label="已下架" value="OFF" />
              </el-select>
              <el-select v-model="tagFilter" placeholder="标签" clearable style="width: 120px; margin-right: 12px" @change="loadData">
                <el-option label="推荐" value="RECOMMEND" />
                <el-option label="热销" value="HOT" />
                <el-option label="新品" value="NEW" />
              </el-select>
            </div>
            <div class="toolbar-right">
              <el-button type="primary" @click="openAddDialog">
                <el-icon style="margin-right: 4px"><Plus /></el-icon>
                添加商品
              </el-button>
              <el-button @click="loadData">
                <el-icon style="margin-right: 4px"><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </div>

          <div class="batch-actions" v-if="selectedIds.length > 0">
            <span class="batch-tip">已选择 {{ selectedIds.length }} 件商品</span>
            <el-button size="small" type="success" @click="batchOnShelf">批量上架</el-button>
            <el-button size="small" type="warning" @click="batchOffShelf">批量下架</el-button>
            <el-button size="small" type="primary" @click="openBatchPriceDialog">批量改价</el-button>
            <el-button size="small" @click="openBatchCategoryDialog">改分类</el-button>
            <el-button size="small" @click="openBatchTagDialog">设标签</el-button>
            <el-button size="small" link @click="clearSelection">取消选择</el-button>
          </div>

          <el-table
            :data="products"
            v-loading="loading"
            stripe
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column label="商品图片" width="90">
              <template #default="{ row }">
                <el-image
                  v-if="row.productImage" lazy
                  :src="row.productImage"
                  fit="cover"
                  style="width: 60px; height: 60px; border-radius: 6px"
                  :preview-src-list="[row.productImage]"
                  preview-teleported
                />
                <div v-else class="no-image">暂无图</div>
              </template>
            </el-table-column>
            <el-table-column label="商品信息" min-width="220">
              <template #default="{ row }">
                <div class="product-info">
                  <div class="product-name">{{ row.productName }}</div>
                  <div class="product-sku">SKU: {{ row.sku }}</div>
                  <div class="product-tags">
                    <el-tag v-if="row.tags?.includes('RECOMMEND')" type="danger" size="small" effect="dark">推荐</el-tag>
                    <el-tag v-if="row.tags?.includes('HOT')" type="warning" size="small" effect="dark">热销</el-tag>
                    <el-tag v-if="row.tags?.includes('NEW')" type="success" size="small" effect="dark">新品</el-tag>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="零售价" width="110">
              <template #default="{ row }">
                <span class="price-text">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="原价" width="110">
              <template #default="{ row }">
                <span class="original-price">¥{{ Number(row.originalPrice || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="stock" label="库存" width="80" align="center" />
            <el-table-column prop="sales" label="销量" width="80" align="center" />
            <el-table-column prop="sort" label="排序" width="80" align="center" />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.shelfStatus === 'ON'" type="success" size="small">已上架</el-tag>
                <el-tag v-else type="info" size="small">已下架</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openEditDialog(row)">编辑</el-button>
                <el-button v-if="row.shelfStatus === 'ON'" size="small" link type="warning" @click="toggleShelf(row, 'OFF')">下架</el-button>
                <el-button v-else size="small" link type="success" @click="toggleShelf(row, 'ON')">上架</el-button>
                <el-button size="small" link type="danger" @click="handleRemove(row)">移除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无商品" />
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
      </div>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加商品到货架" width="900px" class="add-product-dialog">
      <div class="add-product-search">
        <el-input
          v-model="addKeyword"
          placeholder="搜索商品名称/SKU"
          clearable
          style="width: 300px; margin-right: 12px"
          @clear="loadSelectableProducts"
          @keyup.enter="loadSelectableProducts"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="loadSelectableProducts">搜索</el-button>
      </div>
      <el-table
        :data="selectableProducts"
        v-loading="selectableLoading"
        height="360"
        @selection-change="handleSelectableChange"
        ref="selectableTableRef"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="商品图片" width="70">
          <template #default="{ row }">
            <el-image
              v-if="row.productImage" lazy
              :src="row.productImage"
              fit="cover"
              style="width: 48px; height: 48px; border-radius: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品名称" min-width="180" />
        <el-table-column prop="sku" label="SKU" width="140" />
        <el-table-column label="零售价" width="100">
          <template #default="{ row }">
            <span class="price-text">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="70" align="center" />
      </el-table>
      <div class="batch-setting">
        <el-divider content-position="left">批量设置</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="统一分类">
              <el-select v-model="batchCategory" placeholder="选择分类" clearable style="width: 100%">
                <el-option v-for="cat in flatCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="统一标签">
              <el-select v-model="batchTags" multiple placeholder="选择标签" style="width: 100%">
                <el-option label="推荐" value="RECOMMEND" />
                <el-option label="热销" value="HOT" />
                <el-option label="新品" value="NEW" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="统一排序">
              <el-input-number v-model="batchSort" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" :disabled="selectedProductIds.length === 0" @click="handleAddProducts">
          添加选中的 {{ selectedProductIds.length }} 件商品
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑货架商品" width="480px">
      <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="100px">
        <el-form-item label="商品名称">
          <el-input v-model="editForm.productName" disabled />
        </el-form-item>
        <el-form-item label="SKU">
          <el-input v-model="editForm.sku" disabled />
        </el-form-item>
        <el-form-item label="零售价" prop="retailPrice">
          <el-input-number v-model="editForm.retailPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="原价" prop="originalPrice">
          <el-input-number v-model="editForm.originalPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="editForm.stock" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="商品分类" prop="categoryId">
          <el-select v-model="editForm.categoryId" placeholder="选择分类" style="width: 100%">
            <el-option v-for="cat in flatCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品标签" prop="tags">
          <el-select v-model="editForm.tags" multiple placeholder="选择标签" style="width: 100%">
            <el-option label="推荐" value="RECOMMEND" />
            <el-option label="热销" value="HOT" />
            <el-option label="新品" value="NEW" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="editForm.sort" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="shelfStatus">
          <el-radio-group v-model="editForm.shelfStatus">
            <el-radio value="ON">上架</el-radio>
            <el-radio value="OFF">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchPriceVisible" title="批量改价" width="480px">
      <el-form :model="batchPriceForm" :rules="batchPriceRules" ref="batchPriceFormRef" label-width="100px">
        <el-form-item label="改价方式">
          <el-radio-group v-model="batchPriceForm.type">
            <el-radio value="FIXED">固定价格</el-radio>
            <el-radio value="DISCOUNT">折扣比例</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="batchPriceForm.type === 'FIXED'" label="统一价格" prop="fixedPrice">
          <el-input-number v-model="batchPriceForm.fixedPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item v-else label="折扣比例" prop="discountRate">
          <el-input-number v-model="batchPriceForm.discountRate" :min="0.1" :max="10" :step="0.1" :precision="1" style="width: 100%" />
          <span class="form-tip">折扣范围：0.1-10折，如：8.5折</span>
        </el-form-item>
        <el-form-item label="应用到">
          <el-radio-group v-model="batchPriceForm.applyTo">
            <el-radio value="RETAIL">零售价</el-radio>
            <el-radio value="ORIGINAL">原价</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchPriceVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchPriceLoading" @click="handleBatchPrice">确认改价</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchCategoryVisible" title="批量修改分类" width="480px">
      <el-form label-width="100px">
        <el-form-item label="选择分类">
          <el-tree-select
            v-model="batchCategoryTarget"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            check-strictly
            :render-after-expand="false"
            placeholder="请选择目标分类"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchCategoryVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchCategoryLoading" @click="handleBatchCategory">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchTagVisible" title="批量设置标签" width="480px">
      <el-form label-width="100px">
        <el-form-item label="操作方式">
          <el-radio-group v-model="batchTagAction">
            <el-radio value="ADD">添加标签</el-radio>
            <el-radio value="REMOVE">移除标签</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择标签">
          <el-checkbox-group v-model="batchTagValues">
            <el-checkbox value="RECOMMEND">推荐</el-checkbox>
            <el-checkbox value="HOT">热销</el-checkbox>
            <el-checkbox value="NEW">新品</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchTagVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchTagLoading" @click="handleBatchTag">确认设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";

const loading = ref(false);
const products = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const tagFilter = ref("");
const currentCategoryId = ref<number | null>(null);
const selectedIds = ref<number[]>([]);

const categoryTree = ref<any[]>([]);

const flatCategories = computed(() => {
  const result: any[] = [];
  function flatten(list: any[]) {
    for (const item of list) {
      result.push(item);
      if (item.children?.length) {
        flatten(item.children);
      }
    }
  }
  flatten(categoryTree.value);
  return result;
});

const mockCategories = [
  {
    id: 1,
    name: "生鲜果蔬",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vegetable%20icon%20simple&image_size=square",
    count: 128,
    children: [
      { id: 11, name: "时令蔬菜", count: 45, children: [] },
      { id: 12, name: "新鲜水果", count: 52, children: [] },
      { id: 13, name: "菌菇类", count: 31, children: [] }
    ]
  },
  {
    id: 2,
    name: "零食饮料",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=snack%20icon%20simple&image_size=square",
    count: 256,
    children: [
      { id: 21, name: "休闲零食", count: 98, children: [] },
      { id: 22, name: "饼干糕点", count: 76, children: [] },
      { id: 23, name: "饮料冲调", count: 82, children: [] }
    ]
  },
  {
    id: 3,
    name: "日用百货",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=daily%20necessities%20icon%20simple&image_size=square",
    count: 189,
    children: [
      { id: 31, name: "纸品湿巾", count: 67, children: [] },
      { id: 32, name: "家居清洁", count: 54, children: [] }
    ]
  },
  {
    id: 4,
    name: "乳品烘焙",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=milk%20bread%20icon%20simple&image_size=square",
    count: 78,
    children: []
  },
  {
    id: 5,
    name: "酒水冲调",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=drink%20icon%20simple&image_size=square",
    count: 92,
    children: []
  }
];

const mockProducts = Array.from({ length: 35 }, (_, i) => ({
  id: i + 1,
  productName: [
    "有机西红柿 500g",
    "富士苹果 约1kg",
    "伊利纯牛奶 250ml*12盒",
    "乐事薯片 原味 75g",
    "农夫山泉 550ml*24瓶",
    "清风抽纸 3层100抽*6包",
    "金龙鱼调和油 5L",
    "海天酱油 500ml",
    "双汇火腿肠 30g*10支",
    "奥利奥饼干 原味 116g"
  ][i % 10] + (i >= 10 ? ` (${Math.floor(i / 10) + 1}号)` : ""),
  sku: `SKU${String(i + 1).padStart(6, '0')}`,
  productImage: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=product%20photo%20${encodeURIComponent(['tomato', 'apple', 'milk', 'chips', 'water', 'tissue', 'oil', 'soy%20sauce', 'sausage', 'cookie'][i % 10])}&image_size=square`,
  retailPrice: [5.99, 12.9, 45.0, 6.5, 28.8, 15.9, 69.9, 9.9, 12.5, 8.9][i % 10],
  originalPrice: [7.99, 15.9, 52.0, 8.5, 32.0, 18.9, 79.9, 12.9, 15.0, 11.9][i % 10],
  stock: Math.floor(Math.random() * 500) + 10,
  sales: Math.floor(Math.random() * 2000) + 50,
  sort: i + 1,
  shelfStatus: i % 7 === 0 ? 'OFF' : 'ON',
  tags: [
    [],
    ['RECOMMEND'],
    ['HOT'],
    ['NEW'],
    ['RECOMMEND', 'HOT'],
    ['HOT', 'NEW'],
    ['RECOMMEND', 'NEW'],
    ['RECOMMEND', 'HOT', 'NEW']
  ][i % 8],
  categoryId: [1, 1, 4, 2, 2, 3, 3, 3, 2, 2][i % 10]
}));

function loadCategories() {
  categoryTree.value = JSON.parse(JSON.stringify(mockCategories));
}

function handleCategoryClick(data: any) {
  currentCategoryId.value = data.id;
  page.value = 1;
  loadData();
}

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockProducts];
    
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(p => 
        p.productName.toLowerCase().includes(kw) || 
        p.sku.toLowerCase().includes(kw)
      );
    }
    if (statusFilter.value) {
      filtered = filtered.filter(p => p.shelfStatus === statusFilter.value);
    }
    if (tagFilter.value) {
      filtered = filtered.filter(p => p.tags?.includes(tagFilter.value));
    }
    if (currentCategoryId.value) {
      filtered = filtered.filter(p => p.categoryId === currentCategoryId.value);
    }
    
    const start = (page.value - 1) * pageSize.value;
    products.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
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

function handleSelectionChange(selection: any[]) {
  selectedIds.value = selection.map(s => s.id);
}

function clearSelection() {
  selectedIds.value = [];
  const table = document.querySelector('.el-table');
  if (table) {
    const checkbox = table.querySelector('.el-checkbox__input') as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
  }
}

function toggleShelf(row: any, status: string) {
  ElMessageBox.confirm(`确定要${status === 'ON' ? '上架' : '下架'}「${row.productName}」吗？`, "确认操作", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    const item = products.value.find(p => p.id === row.id);
    if (item) item.shelfStatus = status;
    ElMessage.success(status === 'ON' ? '已上架' : '已下架');
  }).catch(() => {});
}

function handleRemove(row: any) {
  ElMessageBox.confirm(`确定要从货架移除「${row.productName}」吗？`, "移除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    products.value = products.value.filter(p => p.id !== row.id);
    total.value--;
    ElMessage.success("已从货架移除");
  }).catch(() => {});
}

function batchOnShelf() {
  ElMessageBox.confirm(`确定要上架选中的 ${selectedIds.value.length} 件商品吗？`, "批量上架", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    products.value.forEach(p => {
      if (selectedIds.value.includes(p.id)) p.shelfStatus = 'ON';
    });
    ElMessage.success("批量上架成功");
    clearSelection();
  }).catch(() => {});
}

function batchOffShelf() {
  ElMessageBox.confirm(`确定要下架选中的 ${selectedIds.value.length} 件商品吗？`, "批量下架", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    products.value.forEach(p => {
      if (selectedIds.value.includes(p.id)) p.shelfStatus = 'OFF';
    });
    ElMessage.success("批量下架成功");
    clearSelection();
  }).catch(() => {});
}

// ==================== 添加商品 ====================
const addDialogVisible = ref(false);
const addKeyword = ref("");
const selectableLoading = ref(false);
const selectableProducts = ref<any[]>([]);
const selectedProductIds = ref<number[]>([]);
const addLoading = ref(false);
const batchCategory = ref<number | null>(null);
const batchTags = ref<string[]>([]);
const batchSort = ref(0);

const mockSelectableProducts = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i,
  productName: [
    "康师傅方便面 红烧牛肉味",
    "统一冰红茶 500ml",
    "旺旺雪饼 84g",
    "洽洽瓜子 原味 160g",
    "蒙牛酸酸乳 250ml*12盒",
    "达利园蛋黄派 230g",
    "盼盼法式小面包 200g",
    "白象大骨面 五连包",
    "今麦郎凉白开 550ml*24",
    "喜之郎果冻 360g",
    "上好佳虾条 80g",
    "可比克薯片 番茄味 60g",
    "娃哈哈AD钙奶 220ml*20",
    "三元酸奶 100g*8杯",
    "古船面粉 5kg",
    "福临门大米 5kg",
    "鲁花花生油 1.8L",
    "李锦记蚝油 255g",
    "老干妈辣椒酱 280g",
    "王致和豆腐乳 340g"
  ][i],
  sku: `SKU${String(100 + i).padStart(6, '0')}`,
  productImage: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=food%20product%20${i}&image_size=square`,
  retailPrice: [3.5, 3.0, 5.5, 8.9, 36.0, 6.8, 5.9, 12.5, 29.9, 7.5, 4.5, 4.9, 45.0, 18.9, 29.9, 39.9, 45.0, 7.9, 10.5, 8.5][i],
  originalPrice: [4.5, 4.0, 7.0, 10.9, 42.0, 8.5, 7.5, 15.0, 35.0, 9.0, 5.5, 6.0, 52.0, 22.0, 35.0, 45.0, 52.0, 9.9, 12.9, 10.0][i],
  stock: Math.floor(Math.random() * 300) + 20,
  categoryId: 2
}));

function loadSelectableProducts() {
  selectableLoading.value = true;
  setTimeout(() => {
    let list = [...mockSelectableProducts];
    if (addKeyword.value) {
      const kw = addKeyword.value.toLowerCase();
      list = list.filter(p => 
        p.productName.toLowerCase().includes(kw) || 
        p.sku.toLowerCase().includes(kw)
      );
    }
    selectableProducts.value = list;
    selectableLoading.value = false;
  }, 300);
}

function openAddDialog() {
  addKeyword.value = "";
  selectedProductIds.value = [];
  batchCategory.value = null;
  batchTags.value = [];
  batchSort.value = 0;
  addDialogVisible.value = true;
  loadSelectableProducts();
}

function handleSelectableChange(selection: any[]) {
  selectedProductIds.value = selection.map(s => s.id);
}

function handleAddProducts() {
  if (selectedProductIds.value.length === 0) return;
  addLoading.value = true;
  setTimeout(() => {
    const newProducts = mockSelectableProducts
      .filter(p => selectedProductIds.value.includes(p.id))
      .map(p => ({
        ...p,
        shelfStatus: 'ON',
        sort: batchSort.value || products.value.length + 1,
        tags: [...batchTags.value],
        categoryId: batchCategory.value || p.categoryId
      }));
    products.value = [...newProducts, ...products.value];
    total.value += newProducts.length;
    ElMessage.success(`成功添加 ${newProducts.length} 件商品`);
    addLoading.value = false;
    addDialogVisible.value = false;
  }, 500);
}

// ==================== 编辑商品 ====================
const editDialogVisible = ref(false);
const editFormRef = ref<FormInstance>();
const editLoading = ref(false);
const editingId = ref<number | null>(null);

const editForm = reactive({
  productName: "",
  sku: "",
  retailPrice: 0,
  originalPrice: 0,
  stock: 0,
  categoryId: null as number | null,
  tags: [] as string[],
  sort: 0,
  shelfStatus: "ON"
});

const editRules: FormRules = {
  retailPrice: [{ required: true, message: "请输入零售价", trigger: "blur" }],
  stock: [{ required: true, message: "请输入库存", trigger: "blur" }]
};

function openEditDialog(row: any) {
  editingId.value = row.id;
  editForm.productName = row.productName;
  editForm.sku = row.sku;
  editForm.retailPrice = row.retailPrice;
  editForm.originalPrice = row.originalPrice;
  editForm.stock = row.stock;
  editForm.categoryId = row.categoryId;
  editForm.tags = [...(row.tags || [])];
  editForm.sort = row.sort;
  editForm.shelfStatus = row.shelfStatus;
  editDialogVisible.value = true;
}

function handleEditSubmit() {
  if (!editFormRef.value || !editingId.value) return;
  editFormRef.value.validate((valid) => {
    if (!valid) return;
    editLoading.value = true;
    setTimeout(() => {
      const index = products.value.findIndex(p => p.id === editingId.value);
      if (index > -1) {
        products.value[index] = {
          ...products.value[index],
          retailPrice: editForm.retailPrice,
          originalPrice: editForm.originalPrice,
          stock: editForm.stock,
          categoryId: editForm.categoryId,
          tags: editForm.tags,
          sort: editForm.sort,
          shelfStatus: editForm.shelfStatus
        };
      }
      ElMessage.success("商品信息已更新");
      editLoading.value = false;
      editDialogVisible.value = false;
    }, 500);
  });
}

// ==================== 批量改价 ====================
const batchPriceVisible = ref(false);
const batchPriceFormRef = ref<FormInstance>();
const batchPriceLoading = ref(false);

const batchPriceForm = reactive({
  type: "FIXED",
  fixedPrice: 0,
  discountRate: 9,
  applyTo: "RETAIL"
});

const batchPriceRules: FormRules = {
  fixedPrice: [{ required: true, message: "请输入价格", trigger: "blur" }],
  discountRate: [{ required: true, message: "请输入折扣", trigger: "blur" }]
};

function openBatchPriceDialog() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择商品");
    return;
  }
  batchPriceForm.type = "FIXED";
  batchPriceForm.fixedPrice = 0;
  batchPriceForm.discountRate = 9;
  batchPriceForm.applyTo = "RETAIL";
  batchPriceVisible.value = true;
}

function handleBatchPrice() {
  if (!batchPriceFormRef.value) return;
  batchPriceFormRef.value.validate((valid) => {
    if (!valid) return;
    batchPriceLoading.value = true;
    setTimeout(() => {
      products.value.forEach(p => {
        if (selectedIds.value.includes(p.id)) {
          if (batchPriceForm.type === 'FIXED') {
            if (batchPriceForm.applyTo === 'RETAIL') {
              p.retailPrice = batchPriceForm.fixedPrice;
            } else {
              p.originalPrice = batchPriceForm.fixedPrice;
            }
          } else {
            const rate = batchPriceForm.discountRate / 10;
            if (batchPriceForm.applyTo === 'RETAIL') {
              p.retailPrice = Math.round(p.originalPrice * rate * 100) / 100;
            } else {
              p.originalPrice = Math.round(p.originalPrice * rate * 100) / 100;
            }
          }
        }
      });
      ElMessage.success("批量改价成功");
      batchPriceLoading.value = false;
      batchPriceVisible.value = false;
      clearSelection();
    }, 500);
  });
}

// ==================== 批量改分类 ====================
const batchCategoryVisible = ref(false);
const batchCategoryLoading = ref(false);
const batchCategoryTarget = ref<number | null>(null);

function openBatchCategoryDialog() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择商品");
    return;
  }
  batchCategoryTarget.value = null;
  batchCategoryVisible.value = true;
}

function handleBatchCategory() {
  if (!batchCategoryTarget.value) {
    ElMessage.warning("请选择目标分类");
    return;
  }
  batchCategoryLoading.value = true;
  setTimeout(() => {
    products.value.forEach(p => {
      if (selectedIds.value.includes(p.id)) {
        p.categoryId = batchCategoryTarget.value;
      }
    });
    ElMessage.success("批量修改分类成功");
    batchCategoryLoading.value = false;
    batchCategoryVisible.value = false;
    clearSelection();
  }, 500);
}

// ==================== 批量设标签 ====================
const batchTagVisible = ref(false);
const batchTagLoading = ref(false);
const batchTagAction = ref("ADD");
const batchTagValues = ref<string[]>([]);

function openBatchTagDialog() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择商品");
    return;
  }
  batchTagAction.value = "ADD";
  batchTagValues.value = [];
  batchTagVisible.value = true;
}

function handleBatchTag() {
  if (batchTagValues.value.length === 0) {
    ElMessage.warning("请选择标签");
    return;
  }
  batchTagLoading.value = true;
  setTimeout(() => {
    products.value.forEach(p => {
      if (selectedIds.value.includes(p.id)) {
        if (!p.tags) p.tags = [];
        if (batchTagAction.value === 'ADD') {
          batchTagValues.value.forEach(tag => {
            if (!p.tags.includes(tag)) p.tags.push(tag);
          });
        } else {
          p.tags = p.tags.filter((t: string) => !batchTagValues.value.includes(t));
        }
      }
    });
    ElMessage.success("批量设置标签成功");
    batchTagLoading.value = false;
    batchTagVisible.value = false;
    clearSelection();
  }, 500);
}

onMounted(() => {
  loadCategories();
  loadData();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.shelf-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 40px);
}
.category-sidebar {
  width: 220px;
  flex-shrink: 0;
}
.sidebar-card {
  height: 100%;
}
.sidebar-header {
  padding: 4px 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 8px;
}
.sidebar-title {
  font-weight: 600;
  font-size: 15px;
}
.category-tree {
  background: transparent;
}
.custom-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.tree-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
}
.node-label {
  flex: 1;
}
.node-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.main-content {
  flex: 1;
  min-width: 0;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
}
.batch-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  margin-bottom: 16px;
}
.batch-tip {
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 500;
}
.product-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.product-name {
  font-weight: 500;
  line-height: 1.4;
}
.product-sku {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.product-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.price-text {
  color: var(--el-color-danger);
  font-weight: 600;
  font-size: 15px;
}
.original-price {
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
  font-size: 13px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.no-image {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  border-radius: 6px;
  color: var(--gray-400);
  font-size: 11px;
}
.add-product-search {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.batch-setting {
  margin-top: 16px;
  padding-top: 8px;
}
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: block;
  margin-top: 4px;
}
</style>
