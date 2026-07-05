<template>
  <div class="page">
    <PageCard title="批量价格调整">
      <template #extra>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </template>

      <!-- 搜索区 -->
      <div class="search-bar">
        <el-input v-model="keyword" placeholder="搜索商品名称/编码" clearable style="width: 240px" @clear="searchProducts" @keyup.enter="searchProducts" />
        <el-select v-model="filterCategory" placeholder="选择分类" clearable style="width: 180px; margin-left: 12px" @change="searchProducts">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchProducts">搜索</el-button>
      </div>

      <!-- 商品选择表格 -->
      <el-table
        ref="productTableRef"
        :data="products"
        v-loading="productLoading"
        stripe
        class="product-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column prop="barcode" label="商品编码" width="140" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column label="零售价" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.retailPrice) }}
          </template>
        </el-table-column>
        <el-table-column label="批发价" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.wholesalePrice) }}
          </template>
        </el-table-column>
        <el-table-column label="小程序价" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.miniappPrice) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="productTotal"
          :page-size="productPageSize"
          :current-page="productPage"
          @size-change="(s: number) => { productPageSize = s; searchProducts(); }"
          @current-change="(p: number) => { productPage = p; searchProducts(); }"
        />
      </div>
    </PageCard>

    <!-- 价格调整面板 -->
    <PageCard v-if="selectedProducts.length > 0" title="价格调整">
      <div class="adjust-panel">
        <div class="adjust-config">
          <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="100px" inline>
            <el-form-item label="调整方式" prop="adjustMethod">
              <el-select v-model="adjustForm.adjustMethod" style="width: 180px" @change="onAdjustMethodChange">
                <el-option label="固定金额调整" value="fixed" />
                <el-option label="百分比调整" value="percent" />
                <el-option label="单商品调整" value="single" />
                <el-option label="按参考价调整" value="reference" />
              </el-select>
            </el-form-item>
            <el-form-item label="价格类型" prop="adjustPriceType">
              <el-select v-model="adjustForm.adjustPriceType" style="width: 150px">
                <el-option label="零售价" value="retailPrice" />
                <el-option label="批发价" value="wholesalePrice" />
                <el-option label="小程序价" value="miniappPrice" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="adjustForm.adjustMethod === 'fixed'" label="调整金额" prop="adjustValue">
              <el-input-number v-model="adjustForm.adjustValue" :min="-999999" :precision="2" style="width: 160px" />
            </el-form-item>
            <el-form-item v-if="adjustForm.adjustMethod === 'percent'" label="调整比例(%)" prop="adjustPercent">
              <el-input-number v-model="adjustForm.adjustPercent" :min="-100" :max="100" :precision="1" style="width: 160px" />
            </el-form-item>
            <el-form-item v-if="adjustForm.adjustMethod === 'reference'" label="参考价类型" prop="referencePriceType">
              <el-select v-model="adjustForm.referencePriceType" style="width: 150px">
                <el-option label="零售价" value="retailPrice" />
                <el-option label="批发价" value="wholesalePrice" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <!-- 预览表格 -->
        <el-table :data="previewData" stripe class="preview-table">
          <el-table-column prop="name" label="商品名称" min-width="160" />
          <el-table-column label="原价格" width="140" align="right">
            <template #default="{ row }">
              {{ formatYuan(row.oldPrice) }}
            </template>
          </el-table-column>
          <el-table-column label="新价格" width="140" align="right">
            <template #default="{ row }">
              <span :style="{ color: row.newPrice !== row.oldPrice ? '#e6a23c' : '' }">
                {{ formatYuan(row.newPrice) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="变动" width="120" align="right">
            <template #default="{ row }">
              <span :style="{ color: row.diff > 0 ? '#67c23a' : row.diff < 0 ? '#f56c6c' : '' }">
                {{ row.diff > 0 ? '+' : '' }}{{ formatYuan(row.diff) }}
              </span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>

        <div style="margin-top: 16px; text-align: right">
          <el-popconfirm title="确认执行价格调整？" @confirm="executeAdjust">
            <template #reference>
              <el-button type="warning" :loading="adjustLoading">确认执行调整</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </PageCard>

    <!-- 调整历史 -->
    <PageCard title="调整历史">
      <el-table :data="historyLogs" v-loading="historyLoading" stripe>
        <el-table-column prop="productName" label="商品名称" min-width="160" />
        <el-table-column label="原价格" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.oldPrice) }}
          </template>
        </el-table-column>
        <el-table-column label="新价格" width="120" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.newPrice) }}
          </template>
        </el-table-column>
        <el-table-column prop="priceType" label="价格类型" width="100" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="操作时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="historyTotal"
          :page-size="historyPageSize"
          :current-page="historyPage"
          @size-change="(s: number) => { historyPageSize = s; loadHistory(); }"
          @current-change="(p: number) => { historyPage = p; loadHistory(); }"
        />
      </div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatYuan } from "../utils/format";
import { fetchProducts, updateProductPrice, fetchPriceChangeLogs } from "../api";

const keyword = ref("");
const filterCategory = ref("");
const categories = ref<string[]>([]);

const products = ref<any[]>([]);
const productLoading = ref(false);
const productTotal = ref(0);
const productPage = ref(1);
const productPageSize = ref(20);
const productTableRef = ref();

const selectedProducts = ref<any[]>([]);

const adjustFormRef = ref();
const adjustLoading = ref(false);
const adjustForm = reactive({
  adjustMethod: "fixed",
  adjustPriceType: "retailPrice",
  adjustValue: 0,
  adjustPercent: 0,
  referencePriceType: "retailPrice"
});
const adjustRules: FormRules = {
  adjustMethod: [{ required: true, message: "请选择调整方式", trigger: "change" }],
  adjustPriceType: [{ required: true, message: "请选择价格类型", trigger: "change" }],
  adjustValue: [{ required: true, message: "请输入调整金额", trigger: "blur" }],
  adjustPercent: [{ required: true, message: "请输入调整比例", trigger: "blur" }],
  referencePriceType: [{ required: true, message: "请选择参考价类型", trigger: "change" }]
};

const historyLogs = ref<any[]>([]);
const historyLoading = ref(false);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyPageSize = ref(20);

const previewData = computed(() => {
  return selectedProducts.value.map((p) => {
    const oldPrice = Number(p[adjustForm.adjustPriceType]) || 0;
    let newPrice = oldPrice;

    if (adjustForm.adjustMethod === "fixed") {
      newPrice = oldPrice + adjustForm.adjustValue;
    } else if (adjustForm.adjustMethod === "percent") {
      newPrice = oldPrice * (1 + adjustForm.adjustPercent / 100);
    } else if (adjustForm.adjustMethod === "reference") {
      newPrice = Number(p[adjustForm.referencePriceType]) || 0;
    }

    newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

    return {
      id: p.id,
      name: p.name,
      oldPrice,
      newPrice,
      diff: Math.round((newPrice - oldPrice) * 100) / 100
    };
  });
});

function handleSelectionChange(rows: any[]) {
  selectedProducts.value = rows;
}

function onAdjustMethodChange() {
  adjustForm.adjustValue = 0;
  adjustForm.adjustPercent = 0;
}

async function searchProducts() {
  productLoading.value = true;
  try {
    const res = await fetchProducts({
      keyword: keyword.value || undefined,
      page: productPage.value,
      pageSize: productPageSize.value
    });
    products.value = res?.records || res?.list || [];
    productTotal.value = res?.total || 0;
    if (res?.categories) {
      categories.value = res.categories;
    }
  } catch {
    ElMessage.error("加载商品列表失败");
  } finally {
    productLoading.value = false;
  }
}

async function executeAdjust() {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning("请先选择商品");
    return;
  }
  const valid = await adjustFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  adjustLoading.value = true;
  try {
    let failCount = 0;
    for (const item of previewData.value) {
      try {
        await updateProductPrice(item.id, {
          [adjustForm.adjustPriceType]: item.newPrice
        });
      } catch {
        failCount++;
      }
    }
    if (failCount > 0) {
      ElMessage.warning(`调整完成，${failCount} 个商品调整失败`);
    } else {
      ElMessage.success(`成功调整 ${previewData.value.length} 个商品价格`);
    }
    selectedProducts.value = [];
    productTableRef.value?.clearSelection();
    await loadHistory();
    await searchProducts();
  } catch {
    ElMessage.error("价格调整失败");
  } finally {
    adjustLoading.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const res = await fetchPriceChangeLogs({
      page: historyPage.value,
      pageSize: historyPageSize.value
    });
    historyLogs.value = res?.records || res?.list || [];
    historyTotal.value = res?.total || 0;
  } catch {
    ElMessage.error("加载调整历史失败");
  } finally {
    historyLoading.value = false;
  }
}

async function loadData() {
  searchProducts();
  loadHistory();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.product-table {
  margin-bottom: 0;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.adjust-panel {
  padding: 0;
}

.adjust-config {
  margin-bottom: 16px;
}

.preview-table {
  margin-top: 0;
}
</style>