<template>
  <div class="page">
    <PageCard title="商品标签关联">
      <div class="search-bar">
        <el-input v-model="keyword" placeholder="搜索商品名称" clearable style="width: 220px" @keyup.enter="searchProducts" />
        <el-button type="primary" style="margin-left: 12px" @click="searchProducts">搜索</el-button>
      </div>

      <el-table :data="products" v-loading="loading" stripe @row-click="selectProduct" highlight-current-row>
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column prop="skuCode" label="SKU编码" width="140" />
        <el-table-column label="已关联标签" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="tag in (row._tags || [])" :key="tag.id" size="small" style="margin: 2px">
              {{ tag.name }}
            </el-tag>
            <span v-if="!row._tags || row._tags.length === 0" style="color: #ccc">未关联</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="openTagDialog(row)">设置标签</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="(s: number) => { pageSize = s; page = 1; searchProducts(); }"
          @current-change="(p: number) => { page = p; searchProducts(); }"
        />
      </div>
    </PageCard>

    <!-- 标签设置弹窗 -->
    <el-dialog v-model="tagDialogVisible" title="设置商品标签" width="720px">
      <template v-if="tagProduct">
        <p style="margin-bottom: 12px; color: #666">商品: {{ tagProduct.name }} ({{ tagProduct.skuCode }})</p>
        <el-tabs v-model="tagTypeTab">
          <el-tab-pane v-for="group in tagGroups" :key="group" :label="tagTypeLabel(group)" :name="group">
            <el-checkbox-group v-model="selectedTagIds" class="tag-cb-group">
              <el-checkbox v-for="tag in tagsByType[group]" :key="tag.id" :label="tag.id" :value="tag.id">
                {{ tag.name }}
              </el-checkbox>
            </el-checkbox-group>
          </el-tab-pane>
        </el-tabs>
      </template>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagSubmitLoading" @click="handleSaveTags">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { api } from "../../api";

const loading = ref(false);
const tagSubmitLoading = ref(false);
const products = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const tagDialogVisible = ref(false);
const tagProduct = ref<any>(null);
const tagTypeTab = ref("");
const tagGroups = ref<string[]>([]);
const tagsByType = ref<Record<string, any[]>>({});
const selectedTagIds = ref<number[]>([]);

const TAG_TYPE_LABELS: Record<string, string> = {
  aroma: "香型", alcohol_level: "度数段", region: "产区", scene: "场景", vintage: "年份"
};
function tagTypeLabel(t: string) { return TAG_TYPE_LABELS[t] || t; }

async function searchProducts() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/products", {
      params: { keyword: keyword.value, page: page.value, pageSize: pageSize.value }
    });
    const res = data.data || {};
    products.value = res.records || [];
    total.value = res.total || 0;
    // 加载每个商品的标签
    for (const p of products.value) {
      try {
        const { data: td } = await api.get(`/admin/products/${p.spuId}/tags`);
        p._tags = td.data || [];
      } catch { p._tags = []; }
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function selectProduct(row: any) { /* highlight only */ }

async function openTagDialog(row: any) {
  tagProduct.value = row;
  tagDialogVisible.value = true;
  selectedTagIds.value = (row._tags || []).map((t: any) => t.id);
  try {
    const { data } = await api.get("/product-tags/by-type");
    const grouped = data.data || {};
    tagsByType.value = grouped;
    tagGroups.value = Object.keys(grouped);
    if (tagGroups.value.length > 0) tagTypeTab.value = tagGroups.value[0];
  } catch { /* ignore */ }
}

async function handleSaveTags() {
  if (!tagProduct.value) return;
  tagSubmitLoading.value = true;
  try {
    await api.put(`/admin/products/${tagProduct.value.spuId}/tags`, { tagIds: selectedTagIds.value });
    ElMessage.success("标签已保存");
    tagDialogVisible.value = false;
    tagProduct.value._tags = selectedTagIds.value.map((id: number) => {
      for (const tags of Object.values(tagsByType.value)) {
        const found = tags.find((t: any) => t.id === id);
        if (found) return found;
      }
      return { id, name: "" };
    });
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    tagSubmitLoading.value = false;
  }
}

onMounted(() => { searchProducts(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.tag-cb-group { display: flex; flex-direction: column; gap: 8px; }
</style>