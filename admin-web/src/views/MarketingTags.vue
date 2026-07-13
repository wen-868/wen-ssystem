<template>
  <div class="page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 标签管理 -->
      <el-tab-pane label="标签管理" name="tags">
        <PageCard title="营销标签管理">
          <template #extra>
            <el-button type="primary" @click="openDialog()">新增标签</el-button>
            <el-button @click="loadData">刷新</el-button>
          </template>

          <div class="search-bar">
            <el-input v-model="searchForm.keyword" placeholder="标签名称" clearable style="width: 180px" />
            <el-select v-model="searchForm.tagType" placeholder="标签类型" clearable style="width: 150px; margin-left: 12px">
              <el-option v-for="t in tagTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
            <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 120px; margin-left: 12px">
              <el-option label="启用" value="active" />
              <el-option label="停用" value="inactive" />
            </el-select>
            <el-button type="primary" style="margin-left: 12px" @click="searchTags">搜索</el-button>
          </div>

          <el-table :data="tags" v-loading="loading" stripe>
            <el-table-column prop="name" label="标签名称" min-width="120">
              <template #default="{ row }">
                <el-tag :color="row.color" effect="dark" style="border: none">{{ row.name }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="tagType" label="标签类型" width="120" align="center">
              <template #default="{ row }">{{ tagTypeLabel(row.tagType) }}</template>
            </el-table-column>
            <el-table-column prop="color" label="颜色" width="100" align="center">
              <template #default="{ row }">
                <div class="color-dot" :style="{ background: row.color }" />
                <span style="font-size: 12px; color: #999">{{ row.color }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="sortNo" label="排序" width="80" align="center" />
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteItem(row.id)">
                  <template #reference><el-button size="small" link type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="total"
              :page-size="pageSize"
              :current-page="page"
              @size-change="(s: number) => { pageSize = s; searchTags(); }"
              @current-change="(p: number) => { page = p; searchTags(); }"
            />
          </div>
        </PageCard>
      </el-tab-pane>

      <!-- 商品标签关联 -->
      <el-tab-pane label="商品关联" name="relation">
        <el-row :gutter="16">
          <!-- 左侧：商品列表 -->
          <el-col :span="10">
            <PageCard title="商品列表">
              <template #extra>
                <el-button size="small" @click="loadProducts">刷新</el-button>
              </template>
              <el-input
                v-model="productKeyword"
                placeholder="搜索商品名称"
                clearable
                style="margin-bottom: 12px"
                @keyup.enter="loadProducts"
                @clear="loadProducts"
              >
                <template #append>
                  <el-button @click="loadProducts">搜索</el-button>
                </template>
              </el-input>
              <el-table
                :data="products"
                v-loading="productLoading"
                stripe
                size="small"
                highlight-current-row
                @current-change="handleProductSelect"
                style="max-height: 500px; overflow-y: auto"
              >
                <el-table-column prop="name" label="商品名称" min-width="160">
                  <template #default="{ row }">{{ row.name || row.spuName || '-' }}</template>
                </el-table-column>
                <el-table-column prop="spec" label="规格" width="100">
                  <template #default="{ row }">{{ row.spec || row.skuSpec || '-' }}</template>
                </el-table-column>
                <el-table-column label="标签" width="120" align="center">
                  <template #default="{ row }">
                    <el-tag
                      v-if="productTagMap[row.id || row.spuId]"
                      size="small"
                      type="success"
                    >{{ productTagMap[row.id || row.spuId].length }}个</el-tag>
                    <span v-else style="color: #ccc; font-size: 12px">未设置</span>
                  </template>
                </el-table-column>
                <template #empty><el-empty description="暂无商品" :image-size="60" /></template>
              </el-table>
              <div class="pagination">
                <el-pagination
                  background
                  small
                  layout="total, prev, pager, next"
                  :total="productTotal"
                  :page-size="productPageSize"
                  :current-page="productPage"
                  @current-change="(p: number) => { productPage = p; loadProducts(); }"
                />
              </div>
            </PageCard>
          </el-col>

          <!-- 右侧：标签关联管理 -->
          <el-col :span="14">
            <PageCard title="标签关联">
              <template #extra>
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!selectedProduct"
                  :loading="relationSaving"
                  @click="handleSaveRelation"
                >保存关联</el-button>
              </template>
              <el-empty v-if="!selectedProduct" description="请从左侧选择一个商品" :image-size="100" />
              <div v-else v-loading="relationLoading">
                <el-alert
                  :title="`当前商品：${selectedProduct.name || selectedProduct.spuName || ''}`"
                  type="info"
                  :closable="false"
                  style="margin-bottom: 16px"
                />
                <div class="tag-group-section" v-for="group in tagGroups" :key="group.type">
                  <div class="tag-group-title">{{ group.label }}</div>
                  <div class="tag-checkbox-group">
                    <el-check-tag
                      v-for="tag in group.tags"
                      :key="tag.id"
                      :checked="selectedTagIds.includes(tag.id)"
                      @change="toggleTag(tag.id)"
                      style="margin-right: 8px; margin-bottom: 8px"
                    >
                      <el-tag
                        :color="tag.color"
                        effect="dark"
                        size="small"
                        style="border: none; margin-right: 4px"
                      >{{ tag.name }}</el-tag>
                    </el-check-tag>
                    <span v-if="group.tags.length === 0" class="empty-hint">暂无此类型标签</span>
                  </div>
                </div>
              </div>
            </PageCard>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑标签对话框 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑营销标签' : '新增营销标签'" width="480px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="标签名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签类型" prop="tagType">
          <el-select v-model="form.tagType" placeholder="请选择标签类型" style="width: 100%">
            <el-option v-for="t in tagTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="颜色">
          <div class="color-picker-row">
            <el-color-picker v-model="form.color" />
            <span class="color-preview" :style="{ background: form.color }" />
            <el-input v-model="form.color" placeholder="#409EFF" style="width: 120px; margin-left: 8px" />
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { api, fetchProducts, fetchProductMarketingTags, setProductMarketingTags } from "../api";

const activeTab = ref("tags");

const tagTypes = [
  { value: "new_arrival", label: "新品" },
  { value: "hot_sale", label: "爆款" },
  { value: "best_seller", label: "热销" },
  { value: "recommended", label: "推荐" },
  { value: "flash_deal", label: "限时特价" },
  { value: "clearance", label: "清仓" }
];
function tagTypeLabel(v: string) { return tagTypes.find(t => t.value === v)?.label || v; }

// ==================== 标签管理 ====================
const tags = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const dialogVisible = ref(false);
const editing = ref(false);
const formRef = ref();
const submitLoading = ref(false);
const editingItem = ref<any>(null);

const searchForm = reactive({ keyword: "", tagType: "", status: "" });
const form = reactive({ name: "", tagType: "", color: "#409EFF", sortNo: 0, remark: "" });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入标签名称' }],
  tagType: [{ required: true, message: '请选择标签类型' }]
};

async function searchTags() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/marketing/tags", {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: searchForm.keyword || undefined,
        tagType: searchForm.tagType || undefined,
        status: searchForm.status || undefined
      }
    });
    const res = data.data || {};
    tags.value = res.records || res.list || [];
    total.value = res.total || 0;
  } catch {
    ElMessage.error("加载营销标签失败");
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  editingItem.value = row || null;
  editing.value = !!row;
  if (row) {
    form.name = row.name;
    form.tagType = row.tagType;
    form.color = row.color || "#409EFF";
    form.sortNo = row.sortNo || 0;
    form.remark = row.remark || "";
  } else {
    form.name = "";
    form.tagType = "";
    form.color = "#409EFF";
    form.sortNo = 0;
    form.remark = "";
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (editing.value) {
      await api.put(`/admin/marketing/tags/${editingItem.value.id}`, {
        name: form.name, tagType: form.tagType, color: form.color, sortNo: form.sortNo, remark: form.remark
      });
      ElMessage.success("标签更新成功");
    } else {
      await api.post("/admin/marketing/tags", {
        name: form.name, tagType: form.tagType, color: form.color, sortNo: form.sortNo, remark: form.remark
      });
      ElMessage.success("标签创建成功");
    }
    dialogVisible.value = false;
    await searchTags();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    submitLoading.value = false;
  }
}

async function deleteItem(id: number) {
  try {
    await api.delete(`/admin/marketing/tags/${id}`);
    ElMessage.success("删除成功");
    await searchTags();
  } catch {
    ElMessage.error("删除失败");
  }
}

async function loadData() { await searchTags(); }

// ==================== 商品标签关联 ====================
const products = ref<any[]>([]);
const productLoading = ref(false);
const productTotal = ref(0);
const productPage = ref(1);
const productPageSize = ref(20);
const productKeyword = ref("");
const selectedProduct = ref<any>(null);
const relationLoading = ref(false);
const relationSaving = ref(false);
const selectedTagIds = ref<number[]>([]);
const productTagMap = ref<Record<number, number[]>>({});

const tagGroups = computed(() => {
  return tagTypes.map(t => ({
    type: t.value,
    label: t.label,
    tags: tags.value.filter((tag: any) => tag.tagType === t.value)
  }));
});

async function loadProducts() {
  productLoading.value = true;
  try {
    const data = await fetchProducts({
      keyword: productKeyword.value || undefined,
      page: productPage.value,
      pageSize: productPageSize.value
    });
    const list = data?.records || data?.list || [];
    products.value = list;
    productTotal.value = data?.total || list.length;
    // 预加载每个商品的标签数
    for (const p of list) {
      const pid = p.id || p.spuId;
      if (pid && !productTagMap.value[pid]) {
        loadProductTags(pid);
      }
    }
  } catch {
    ElMessage.error("加载商品列表失败");
  } finally {
    productLoading.value = false;
  }
}

async function loadProductTags(productId: number) {
  try {
    const data = await fetchProductMarketingTags(productId);
    const tagIds = Array.isArray(data) ? data.map((t: any) => t.id) : [];
    productTagMap.value[productId] = tagIds;
  } catch {
    productTagMap.value[productId] = [];
  }
}

async function handleProductSelect(row: any) {
  if (!row) return;
  selectedProduct.value = row;
  relationLoading.value = true;
  try {
    const productId = row.id || row.spuId;
    const data = await fetchProductMarketingTags(productId);
    selectedTagIds.value = Array.isArray(data) ? data.map((t: any) => t.id) : [];
  } catch {
    selectedTagIds.value = [];
  } finally {
    relationLoading.value = false;
  }
}

function toggleTag(tagId: number) {
  const idx = selectedTagIds.value.indexOf(tagId);
  if (idx >= 0) {
    selectedTagIds.value.splice(idx, 1);
  } else {
    selectedTagIds.value.push(tagId);
  }
}

async function handleSaveRelation() {
  if (!selectedProduct.value) return;
  relationSaving.value = true;
  try {
    const productId = selectedProduct.value.id || selectedProduct.value.spuId;
    await setProductMarketingTags(productId, selectedTagIds.value);
    productTagMap.value[productId] = [...selectedTagIds.value];
    ElMessage.success("标签关联已保存");
  } catch {
    ElMessage.error("保存标签关联失败");
  } finally {
    relationSaving.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "relation") {
    if (tags.value.length === 0) {
      searchTags();
    }
    if (products.value.length === 0) {
      loadProducts();
    }
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.color-dot { display: inline-block; width: 16px; height: 16px; border-radius: 50%; vertical-align: middle; margin-right: 6px; border: 1px solid #ddd; }
.color-picker-row { display: flex; align-items: center; }
.color-preview { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #ddd; margin-left: 8px; }
.tag-group-section { margin-bottom: 20px; }
.tag-group-title { font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 10px; padding-left: 8px; border-left: 3px solid #409EFF; }
.tag-checkbox-group { display: flex; flex-wrap: wrap; align-items: center; padding-left: 4px; }
.empty-hint { font-size: 13px; color: #c0c4cc; }
</style>
