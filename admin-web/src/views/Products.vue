<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>商品中心</span>
          <div class="header-actions">
            <el-input
              v-model="keyword" placeholder="搜索商品名称/SKU编码/条码" size="default"
              style="width: 260px; margin-right: 10px" clearable @clear="search" @keyup.enter="search"
            />
            <el-button type="primary" @click="openCreateDialog">
              <el-icon><Plus /></el-icon> 新增商品
            </el-button>
            <el-button @click="search">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="spuList" v-loading="loading" stripe row-key="spuId"
        @expand-change="onExpandChange" :expand-row-keys="expandKeys"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <h4>SKU 列表 ({{ row._skus?.length || 0 }} 个规格)</h4>
              <el-table :data="row._skus" size="small" stripe>
                <el-table-column prop="skuCode" label="SKU编码" width="140" />
                <el-table-column prop="skuName" label="规格名称" min-width="140" />
                <el-table-column prop="barcode" label="条码" width="130" />
                <el-table-column prop="retailPrice" label="零售价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.retailPrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="wholesalePrice" label="批发价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.wholesalePrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="miniappPrice" label="小程序价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.miniappPrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="boxRatio" label="箱瓶比" width="80" />
                <el-table-column prop="temperature" label="温层" width="80">
                  <template #default="{ row: s }">{{ s.temperature === 'CHILLED' ? '冷藏' : '常温' }}</template>
                </el-table-column>
                <el-table-column prop="warningThreshold" label="库存预警" width="90" />
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row: s }">
                    <el-button size="small" link type="primary" @click="viewSkuPriceHistory(s)">价格历史</el-button>
                    <el-button size="small" link type="warning" @click="openSkuPriceDialog(s)">改价</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="主图" width="70">
          <template #default="{ row }">
            <el-image
              v-if="row.mainImage" :src="row.mainImage" :preview-src-list="[row.mainImage]"
              style="width: 40px; height: 40px; border-radius: 4px" fit="cover"
            />
            <span v-else style="color: #ccc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="spuCode" label="SPU编码" width="130" />
        <el-table-column prop="name" label="商品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column prop="brandName" label="品牌" width="100" />
        <el-table-column prop="alcoholContent" label="酒精度" width="90" align="center">
          <template #default="{ row }">{{ row.alcoholContent ? row.alcoholContent + '%vol' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="origin" label="产地" width="100" />
        <el-table-column label="销售渠道" width="120">
          <template #default="{ row }">
            <template v-if="row.saleChannels">
              <el-tag v-for="ch in parseChannels(row.saleChannels)" :key="ch" size="small" style="margin: 1px">
                {{ ch === 'MINIAPP' ? '小程序' : ch === 'STORE' ? '门店' : ch }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="SKU数" width="70" align="center">
          <template #default="{ row }">{{ row._skus?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="零售价" width="100">
          <template #default="{ row }">¥{{ Number(row._firstRetailPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="批发价" width="100">
          <template #default="{ row }">¥{{ Number(row._firstWholesalePrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ON_SALE'" type="success">上架</el-tag>
            <el-tag v-else-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else type="danger">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button size="small" link type="success" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              size="small" link :type="row.status === 'ON_SALE' ? 'danger' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ON_SALE' ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="(s: number) => { pageSize = s; page = 1; search(); }"
          @current-change="(p: number) => { page = p; search(); }"
        />
      </div>
    </el-card>

    <!-- 新增/编辑 SPU -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商品' : '新增商品'" width="800px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px" ref="formRef" :rules="rules">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类" prop="categoryId">
              <el-tree-select
                v-model="form.categoryId" :data="categoryTree" check-strictly
                :props="{ label: 'name', value: 'id', children: 'children' }"
                placeholder="选择分类" style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品主图">
              <el-input v-model="form.mainImage" placeholder="图片URL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌">
              <el-select v-model="form.brandId" placeholder="选择品牌" clearable style="width: 100%">
                <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="酒精度(%vol)">
              <el-input-number v-model="form.alcoholContent" :min="0" :max="100" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产地">
              <el-input v-model="form.origin" placeholder="产地" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="销售渠道">
              <el-select v-model="form.saleChannels" multiple placeholder="选择渠道" style="width: 100%">
                <el-option label="小程序" value="MINIAPP" />
                <el-option label="门店" value="STORE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">SKU 信息 (至少添加一个)</el-divider>
        <div v-for="(sku, idx) in form.skus" :key="idx" class="sku-row">
          <div class="sku-header">
            <span>SKU #{{ idx + 1 }}</span>
            <el-button v-if="form.skus.length > 1" size="small" type="danger" link @click="removeSku(idx)">移除</el-button>
          </div>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="规格名称" :prop="'skus.' + idx + '.skuName'" :rules="[{ required: true, message: '必填', trigger: 'blur' }]">
                <el-input v-model="sku.skuName" placeholder="如: 500ml/瓶" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="条码">
                <el-input v-model="sku.barcode" placeholder="商品条码" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="箱瓶比">
                <el-input-number v-model="sku.boxRatio" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="零售价" :prop="'skus.' + idx + '.retailPrice'" :rules="[{ required: true, message: '必填', trigger: 'blur' }]">
                <el-input-number v-model="sku.retailPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="批发价">
                <el-input-number v-model="sku.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="小程序价">
                <el-input-number v-model="sku.miniappPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="温层">
                <el-select v-model="sku.temperature" style="width: 100%">
                  <el-option label="常温" value="NORMAL" />
                  <el-option label="冷藏" value="CHILLED" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="库存预警">
                <el-input-number v-model="sku.warningThreshold" :min="0" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="追溯">
                <el-switch v-model="sku.traceEnabled" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>
        <el-button type="primary" link @click="addSku">+ 添加SKU</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 (3 Tab) -->
    <el-drawer v-model="detailVisible" :title="'商品详情 - ' + (detailSpu?.name || '')" size="650px">
      <template v-if="detailSpu">
        <el-tabs v-model="detailTab">
          <el-tab-pane label="基本信息" name="basic">
            <div class="detail-main-image" v-if="detailSpu.mainImage">
              <el-image :src="detailSpu.mainImage" style="width: 100%; max-height: 300px" fit="contain" />
            </div>
            <el-descriptions :column="2" border style="margin-top: 16px">
              <el-descriptions-item label="SPU编码">{{ detailSpu.spuCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ detailSpu.name }}</el-descriptions-item>
              <el-descriptions-item label="分类">{{ detailSpu.categoryName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="品牌">{{ detailSpu.brandName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="酒精度">{{ detailSpu.alcoholContent ? detailSpu.alcoholContent + '%vol' : '-' }}</el-descriptions-item>
              <el-descriptions-item label="产地">{{ detailSpu.origin || '-' }}</el-descriptions-item>
              <el-descriptions-item label="销售渠道">
                <template v-if="detailSpu.saleChannels">
                  <el-tag v-for="ch in parseChannels(detailSpu.saleChannels)" :key="ch" size="small" style="margin: 1px">
                    {{ ch === 'MINIAPP' ? '小程序' : ch === 'STORE' ? '门店' : ch }}
                  </el-tag>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag v-if="detailSpu.status === 'ON_SALE'" type="success">上架</el-tag>
                <el-tag v-else-if="detailSpu.status === 'DRAFT'" type="info">草稿</el-tag>
                <el-tag v-else type="danger">下架</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(detailSpu.createdAt) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatDate(detailSpu.updatedAt) }}</el-descriptions-item>
            </el-descriptions>
            <el-divider content-position="left">主图</el-divider>
            <el-input v-model="detailSpu.mainImage" placeholder="主图URL，修改后自动保存" @change="saveDetailField('mainImage', detailSpu.mainImage)" />
            <el-divider content-position="left">商品详情 (富文本)</el-divider>
            <div style="border: 1px solid #dcdfe6; border-radius: 4px">
              <Toolbar style="border-bottom: 1px solid #dcdfe6" :editor="richEditor" :defaultConfig="toolbarConfig" mode="default" />
              <Editor v-model="detailSpu.detail" :defaultConfig="editorConfig" mode="default" style="height: 300px; overflow-y: hidden" @onCreated="onRichEditorCreated" @onChange="onRichEditorChange" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="SKU列表" name="skus">
            <el-table :data="detailSpu._skus" size="small" stripe>
              <el-table-column prop="skuCode" label="SKU编码" width="130" />
              <el-table-column prop="skuName" label="规格名称" min-width="130" />
              <el-table-column prop="barcode" label="条码" width="120" />
              <el-table-column prop="retailPrice" label="零售价" width="90">
                <template #default="{ row }">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column prop="wholesalePrice" label="批发价" width="90">
                <template #default="{ row }">¥{{ Number(row.wholesalePrice || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column prop="miniappPrice" label="小程序价" width="90">
                <template #default="{ row }">¥{{ Number(row.miniappPrice || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column prop="boxRatio" label="箱瓶比" width="70" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="商品标签" name="tags">
            <el-tabs v-model="tagTypeTab" type="card">
              <el-tab-pane v-for="group in tagGroups" :key="group" :label="tagTypeLabel(group)" :name="group">
                <el-checkbox-group v-model="detailTagIds" class="tag-cb-group">
                  <el-checkbox v-for="tag in tagsByType[group]" :key="tag.id" :label="tag.id" :value="tag.id">{{ tag.name }}</el-checkbox>
                </el-checkbox-group>
              </el-tab-pane>
            </el-tabs>
            <el-button type="primary" :loading="tagSubmitLoading" @click="saveDetailTags" style="margin-top: 12px">保存标签</el-button>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- SKU 价格历史 -->
    <el-dialog v-model="priceHistoryVisible" title="价格历史" width="700px">
      <el-table :data="priceHistory" size="small" stripe v-loading="priceHistoryLoading">
        <el-table-column prop="priceType" label="价格类型" width="100" />
        <el-table-column prop="oldPrice" label="旧价格" width="100">
          <template #default="{ row }">¥{{ Number(row.oldPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="newPrice" label="新价格" width="100">
          <template #default="{ row }">¥{{ Number(row.newPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="actionType" label="操作" width="80" />
        <el-table-column prop="createdAt" label="时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- SKU 改价 -->
    <el-dialog v-model="skuPriceVisible" title="改价" width="450px">
      <template v-if="skuPriceTarget">
        <el-form label-width="100px">
          <el-form-item label="SKU名称"><span>{{ skuPriceTarget.skuName }}</span></el-form-item>
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
      </template>
      <template #footer>
        <el-button @click="skuPriceVisible = false">取消</el-button>
        <el-button type="primary" :loading="skuPriceLoading" @click="handleSkuPriceUpdate">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import "@wangeditor/editor/dist/css/style.css";
import { api } from "../api";
import { formatDate } from "../utils/format";

// ---------- State ----------
const loading = ref(false);
const submitLoading = ref(false);
const tagSubmitLoading = ref(false);
const priceHistoryLoading = ref(false);
const skuPriceLoading = ref(false);
const spuList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const detailVisible = ref(false);
const priceHistoryVisible = ref(false);
const skuPriceVisible = ref(false);
const isEdit = ref(false);
const editSpuId = ref<number | null>(null);
const expandKeys = ref<number[]>([]);
const detailTab = ref("basic");
const tagTypeTab = ref("");
const formRef = ref<FormInstance>();

const categoryTree = ref<any[]>([]);
const brandList = ref<any[]>([]);
const detailSpu = ref<any>(null);
const priceHistory = ref<any[]>([]);
const skuPriceTarget = ref<any>(null);
const tagGroups = ref<string[]>([]);
const tagsByType = ref<Record<string, any[]>>({});
const detailTagIds = ref<number[]>([]);

const TAG_LABELS: Record<string, string> = {
  aroma: "香型", alcohol_level: "度数段", region: "产区", scene: "场景", vintage: "年份"
};
function tagTypeLabel(t: string) { return TAG_LABELS[t] || t; }

// ---------- Rich Text Editor ----------
const richEditor = shallowRef();
const toolbarConfig = { excludeKeys: ["group-video"] };
const editorConfig = { placeholder: "请输入商品详情..." };
let richEditorSaveTimer: any = null;

function onRichEditorCreated(editor: any) { richEditor.value = editor; }
function onRichEditorChange() {
  if (richEditorSaveTimer) clearTimeout(richEditorSaveTimer);
  richEditorSaveTimer = setTimeout(() => {
    if (detailSpu.value && detailSpu.value.spuId) {
      saveDetailField("detail", detailSpu.value.detail);
    }
  }, 1500);
}

// ---------- Default Form ----------
const defaultForm = {
  name: "",
  categoryId: null as number | null,
  mainImage: "",
  brandId: null as number | null,
  alcoholContent: null as number | null,
  origin: "",
  saleChannels: ["MINIAPP", "STORE"] as string[],
  skus: [{ skuName: "", barcode: "", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 0, retailPrice: 0, wholesalePrice: null as number | null, miniappPrice: null as number | null }]
};
const form = reactive(JSON.parse(JSON.stringify(defaultForm)));

const rules: FormRules = {
  name: [{ required: true, message: "请输入商品名称", trigger: "blur" }],
  categoryId: [{ required: true, message: "请选择分类", trigger: "change" }]
};

const skuPriceForm = reactive({ retailPrice: 0, wholesalePrice: 0, miniappPrice: 0 });

// ---------- Group raw backend rows into SPU + nested SKUs ----------
function groupSpus(raw: any[]): any[] {
  const map = new Map<number, any>();
  for (const r of raw) {
    let spu = map.get(r.spuId);
    if (!spu) {
      spu = {
        spuId: r.spuId, spuCode: r.spuCode, name: r.name, mainImage: r.mainImage,
        alcoholContent: r.alcoholContent, origin: r.origin, saleChannels: r.saleChannels,
        detail: r.detail, imageUrls: r.imageUrls,
        categoryName: r.categoryName, brandName: r.brandName,
        status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
        _skus: [] as any[]
      };
      map.set(r.spuId, spu);
    }
    spu._skus.push({
      skuId: r.skuId, skuCode: r.skuCode, skuName: r.skuName, barcode: r.barcode,
      retailPrice: r.retailPrice, wholesalePrice: r.wholesalePrice,
      miniappPrice: r.miniappPrice, storePrice: r.storePrice, costPrice: r.costPrice,
      boxRatio: r.boxRatio, temperature: r.temperature, traceEnabled: r.traceEnabled,
      warningThreshold: r.warningThreshold
    });
  }
  for (const [_, spu] of map) {
    spu._firstRetailPrice = spu._skus[0]?.retailPrice;
    spu._firstWholesalePrice = spu._skus[0]?.wholesalePrice;
  }
  return Array.from(map.values());
}

function parseChannels(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

// ---------- API ----------
async function search() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/products", {
      params: { keyword: keyword.value, page: page.value, pageSize: pageSize.value }
    });
    const res = data.data || {};
    spuList.value = groupSpus(res.records || []);
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally { loading.value = false; }
}

function onExpandChange(row: any, expandedRows: any[]) {
  expandKeys.value = expandedRows.map(r => r.spuId);
}

function openCreateDialog() {
  isEdit.value = false;
  editSpuId.value = null;
  Object.assign(form, JSON.parse(JSON.stringify(defaultForm)));
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  isEdit.value = true;
  editSpuId.value = row.spuId;
  form.name = row.name;
  form.categoryId = row.categoryId || null;
  form.mainImage = row.mainImage || "";
  form.brandId = row.brandId || null;
  form.alcoholContent = row.alcoholContent || null;
  form.origin = row.origin || "";
  form.saleChannels = parseChannels(row.saleChannels);
  form.skus = (row._skus || []).map((s: any) => ({
    skuName: s.skuName, barcode: s.barcode, boxRatio: s.boxRatio || 1,
    temperature: s.temperature || "NORMAL", traceEnabled: !!s.traceEnabled,
    warningThreshold: s.warningThreshold || 0,
    retailPrice: s.retailPrice || 0, wholesalePrice: s.wholesalePrice || null,
    miniappPrice: s.miniappPrice || null
  }));
  if (form.skus.length === 0) {
    form.skus = [JSON.parse(JSON.stringify(defaultForm.skus[0]))];
  }
  dialogVisible.value = true;
}

function addSku() {
  form.skus.push({ skuName: "", barcode: "", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 0, retailPrice: 0, wholesalePrice: null, miniappPrice: null });
}
function removeSku(idx: number) { form.skus.splice(idx, 1); }

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value && editSpuId.value) {
        await api.put(`/admin/products/${editSpuId.value}`, {
          name: form.name, category: form.categoryId, brand: form.brandId,
          alcoholContent: form.alcoholContent, origin: form.origin
        });
        ElMessage.success("更新成功");
      } else {
        await api.post("/admin/products", {
          name: form.name, categoryId: form.categoryId, mainImage: form.mainImage || undefined,
          saleChannels: form.saleChannels,
          skus: form.skus.map((s: any) => ({
            skuName: s.skuName, barcode: s.barcode, boxRatio: s.boxRatio,
            temperature: s.temperature, traceEnabled: s.traceEnabled,
            warningThreshold: s.warningThreshold,
            costPrice: 0, retailPrice: s.retailPrice,
            wholesalePrice: s.wholesalePrice, miniappPrice: s.miniappPrice
          }))
        });
        ElMessage.success("创建成功");
      }
      dialogVisible.value = false;
      search();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || "保存失败");
    } finally { submitLoading.value = false; }
  });
}

async function toggleStatus(row: any) {
  const newStatus = row.status === "ON_SALE" ? "OFF_SALE" : "ON_SALE";
  try {
    await api.patch(`/admin/products/${row.spuId}/status`, { status: newStatus });
    ElMessage.success(newStatus === "ON_SALE" ? "已上架" : "已下架");
    search();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || "操作失败"); }
}

// ---------- Detail Drawer ----------
async function openDetail(row: any) {
  detailSpu.value = { ...row, _skus: row._skus || [] };
  detailVisible.value = true;
  detailTab.value = "basic";
  // 加载标签
  try {
    const { data: td } = await api.get(`/admin/products/${row.spuId}/tags`);
    detailTagIds.value = (td.data || []).map((t: any) => t.id);
    const { data: r1 } = await api.get("/product-tags/by-type");
    const grouped = r1.data || {};
    tagsByType.value = grouped;
    tagGroups.value = Object.keys(grouped);
    if (tagGroups.value.length > 0) tagTypeTab.value = tagGroups.value[0];
  } catch { /* ignore */ }
}

async function saveDetailField(field: string, value: any) {
  if (!detailSpu.value?.spuId) return;
  try {
    await api.put(`/admin/products/${detailSpu.value.spuId}`, { [field]: value });
  } catch { /* silent */ }
}

async function saveDetailTags() {
  if (!detailSpu.value?.spuId) return;
  tagSubmitLoading.value = true;
  try {
    await api.put(`/admin/products/${detailSpu.value.spuId}/tags`, { tagIds: detailTagIds.value });
    ElMessage.success("标签已保存");
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "保存失败");
  } finally { tagSubmitLoading.value = false; }
}

// ---------- SKU Price ----------
function viewSkuPriceHistory(sku: any) {
  priceHistoryLoading.value = true;
  priceHistoryVisible.value = true;
  api.get(`/admin/products/${sku.skuId}/price-history`)
    .then(({ data }) => { priceHistory.value = (data.data?.records || data.data || []); })
    .catch(() => ElMessage.error("加载价格历史失败"))
    .finally(() => { priceHistoryLoading.value = false; });
}

function openSkuPriceDialog(sku: any) {
  skuPriceTarget.value = sku;
  skuPriceForm.retailPrice = sku.retailPrice || 0;
  skuPriceForm.wholesalePrice = sku.wholesalePrice || 0;
  skuPriceForm.miniappPrice = sku.miniappPrice || 0;
  skuPriceVisible.value = true;
}

async function handleSkuPriceUpdate() {
  if (!skuPriceTarget.value) return;
  skuPriceLoading.value = true;
  try {
    await api.put(`/admin/products/${skuPriceTarget.value.skuId}/price`, {
      retailPrice: skuPriceForm.retailPrice,
      wholesalePrice: skuPriceForm.wholesalePrice,
      miniappPrice: skuPriceForm.miniappPrice
    });
    ElMessage.success("改价成功");
    skuPriceVisible.value = false;
    search();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "改价失败");
  } finally { skuPriceLoading.value = false; }
}

// ---------- Ref Data ----------
async function loadRefData() {
  try {
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      api.get("/admin/products/categories"),
      api.get("/admin/brands", { params: { pageSize: 999 } })
    ]);
    const list = d1.data || [];
    categoryTree.value = buildTree(list);
    brandList.value = (d2.data?.records || d2.data || []);
  } catch { /* ignore */ }
}

function buildTree(list: any[]): any[] {
  if (!list || list.length === 0) return [];
  const map = new Map<number, any>();
  const roots: any[] = [];
  list.forEach((item: any) => map.set(item.id, { ...item, children: [] }));
  list.forEach((item: any) => {
    const node = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(node);
    } else { roots.push(node); }
  });
  return roots;
}

onMounted(() => { search(); loadRefData(); });
</script>

<style scoped>
.page { padding: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-actions { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.expand-content { padding: 8px 20px; background: #fafafa; }
.expand-content h4 { margin: 0 0 8px; font-size: 14px; color: #303133; }
.detail-main-image { text-align: center; background: #f5f7fa; border-radius: 8px; padding: 12px; }
.tag-cb-group { display: flex; flex-direction: column; gap: 8px; }
.sku-row { background: #fafafa; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.sku-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 500; }
</style>