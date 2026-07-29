<template>
  <div>
    <h2 style="margin-bottom: 24px;">SPU 管理</h2>

    <!-- 搜索区 -->
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索 SPU 名称"
          clearable
          style="width: 200px;"
          @change="handleSearch"
        />
        <el-input
          v-model="searchForm.barcode"
          placeholder="搜索条码"
          clearable
          style="width: 200px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="审核状态"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="已下线" value="OFFLINE" />
        </el-select>
        <el-select
          v-model="searchForm.brandId"
          placeholder="品牌"
          clearable
          filterable
          style="width: 160px;"
          @change="handleSearch"
        >
          <el-option
            v-for="b in brandOptions"
            :key="b.id"
            :label="b.name"
            :value="b.id"
          />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="showCreateDialog">新增 SPU</el-button>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 8px 24px 16px 48px; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; font-size: 14px;">SKU 列表</h4>
                <el-button size="small" type="primary" plain @click="openSkuManage(row)">
                  管理 SKU
                </el-button>
              </div>
              <el-table :data="row._skus || []" border size="small" style="width: 100%;" empty-text="暂无 SKU，点击『管理 SKU』添加">
                <el-table-column prop="skuName" label="规格名称" width="140" />
                <el-table-column prop="barcode" label="条码" width="160" />
                <el-table-column prop="volume" label="容量(ml)" width="100" align="right" />
                <el-table-column prop="packaging" label="包装" width="100" />
                <el-table-column prop="baseUnit" label="基本单位" width="90" />
                <el-table-column prop="boxUnit" label="箱单位" width="80" />
                <el-table-column prop="boxRatio" label="装箱比" width="80" align="right" />
                <el-table-column prop="suggestedRetailPrice" label="建议零售价" width="110" align="right">
                  <template #default="{ row: s }">
                    <span style="color: #f56c6c; font-weight: 600;">{{ s.suggestedRetailPrice ? '¥' + s.suggestedRetailPrice : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row: s }">
                    <el-tag :type="!s.status || s.status === 'ACTIVE' ? 'success' : 'info'" size="small">
                      {{ !s.status || s.status === 'ACTIVE' ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="spuCode" label="SPU 编码" width="150" />
        <el-table-column prop="name" label="SPU 名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="brandName" label="品牌" width="120" />
        <el-table-column prop="specs" label="规格" width="100" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hitCount" label="扫码命中" width="100" align="center" />
        <el-table-column prop="source" label="来源" width="80">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="success" size="small"
              @click="handleApprove(row)"
            >通过</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="warning" size="small"
              @click="handleReject(row)"
            >拒绝</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑 SPU' : '新增 SPU'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-divider content-position="left">基础信息（必填）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="SPU 名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入 SPU 名称" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌" prop="brandId">
              <el-select v-model="form.brandId" placeholder="选择品牌" clearable filterable style="width: 100%;">
                <el-option
                  v-for="b in brandOptions"
                  :key="b.id"
                  :label="b.name"
                  :value="b.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规格" prop="specs">
              <el-input v-model="form.specs" placeholder="如：500ml * 12瓶/箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="如：瓶、箱、盒" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">扩展信息（建议填写）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主图 URL">
              <el-input v-model="form.mainImage" placeholder="主图图片链接" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="酒精度">
              <el-input v-model="form.alcoholContent" placeholder="如：53%vol、42°" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产地">
              <el-input v-model="form.origin" placeholder="如：贵州茅台镇、四川宜宾" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="香型">
              <el-input v-model="form.aromaType" placeholder="如：酱香型、浓香型、清香型" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="商品简介，最多 200 字" maxlength="200" show-word-limit />
        </el-form-item>

        <el-divider content-position="left">SKU 规格管理</el-divider>
        <div style="margin-bottom: 12px;">
          <el-button type="primary" plain size="small" @click="addSkuRow">+ 添加 SKU 行</el-button>
          <span style="margin-left: 12px; color: #909399; font-size: 12px;">
            提示：至少添加 1 条 SKU，条码不可重复
          </span>
        </div>
        <el-table :data="form.skus" border size="small" style="width: 100%;">
          <el-table-column label="规格名称" width="140">
            <template #default="{ row }">
              <el-input v-model="row.skuName" placeholder="如：单瓶、整箱" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="条码" width="170">
            <template #default="{ row }">
              <el-input v-model="row.barcode" placeholder="商品条形码 EAN13" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="容量(ml)" width="100">
            <template #default="{ row }">
              <el-input-number v-model="row.volume" :min="0" :step="50" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="包装" width="100">
            <template #default="{ row }">
              <el-select v-model="row.packaging" size="small" placeholder="选择" style="width: 100%;">
                <el-option label="瓶装" value="瓶装" />
                <el-option label="罐装" value="罐装" />
                <el-option label="盒装" value="盒装" />
                <el-option label="袋装" value="袋装" />
                <el-option label="箱装" value="箱装" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="基本单位" width="90">
            <template #default="{ row }">
              <el-input v-model="row.baseUnit" placeholder="瓶" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="箱单位" width="80">
            <template #default="{ row }">
              <el-input v-model="row.boxUnit" placeholder="箱" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="装箱比" width="90">
            <template #default="{ row }">
              <el-input-number v-model="row.boxRatio" :min="1" :step="1" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="建议零售价" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.suggestedRetailPrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeSkuRow($index)">删</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 独立 SKU 管理对话框（行内展开快捷入口） -->
    <el-dialog
      v-model="skuDialogVisible"
      :title="`SKU 管理 - ${currentSpu?.name || ''}`"
      width="900px"
      :close-on-click-modal="false"
    >
      <div style="margin-bottom: 12px;">
        <el-button type="primary" plain size="small" @click="addManageSkuRow">+ 添加 SKU</el-button>
      </div>
      <el-table :data="manageSkus" border size="small" style="width: 100%;">
        <el-table-column label="规格名称" width="140">
          <template #default="{ row }">
            <el-input v-model="row.skuName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="条码" width="170">
          <template #default="{ row }">
            <el-input v-model="row.barcode" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="容量(ml)" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.volume" :min="0" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="包装" width="100">
          <template #default="{ row }">
            <el-input v-model="row.packaging" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="基本单位" width="90">
          <template #default="{ row }">
            <el-input v-model="row.baseUnit" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="箱单位" width="80">
          <template #default="{ row }">
            <el-input v-model="row.boxUnit" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="装箱比" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.boxRatio" :min="1" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="建议零售价" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.suggestedRetailPrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="(!row.status || row.status === 'ACTIVE') ? 'success' : 'info'">
              {{ !row.status || row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeManageSkuRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="skuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="skuSaving" @click="handleSaveSkus">保存 SKU</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectVisible" title="拒绝审核" width="480px" :close-on-click-modal="false">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因（建议详细说明以便商户修改）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listSpusApi, getSpuApi, createSpuApi, updateSpuApi,
  approveSpuApi, rejectSpuApi, deleteSpuApi,
  listBrandOptionsApi, batchCreateSkusApi,
  type SpuListItem, type SpuDetail, type SkuItem,
} from '../../api/library'

// ========== 列表状态 ==========
const loading = ref(false)
const list = ref<(SpuListItem & { _skus?: SkuItem[] })[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const brandOptions = ref<{ id: number; name: string }[]>([])

const searchForm = reactive({
  keyword: '',
  barcode: '',
  status: '',
  brandId: null as number | null,
})

// ========== 对话框状态 ==========
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formRef = ref<FormInstance>()

type SpuFormState = {
  name: string
  brandId: number | null
  specs: string
  unit: string
  mainImage: string
  alcoholContent: string
  origin: string
  aromaType: string
  description: string
  suggestedRetailPrice: string | number
  skus: Partial<SkuItem>[]
}

const form = reactive<SpuFormState>({
  name: '',
  brandId: null,
  specs: '',
  unit: '',
  mainImage: '',
  alcoholContent: '',
  origin: '',
  aromaType: '',
  description: '',
  suggestedRetailPrice: '',
  skus: [],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入 SPU 名称', trigger: 'blur' }],
  specs: [{ required: true, message: '请输入规格', trigger: 'blur' }],
}

// ========== SKU 独立管理对话框 ==========
const skuDialogVisible = ref(false)
const skuSaving = ref(false)
const currentSpu = ref<SpuListItem | null>(null)
const manageSkus = ref<Partial<SkuItem>[]>([])

// ========== 拒绝对话框 ==========
const rejectVisible = ref(false)
const rejectingId = ref<number | null>(null)
const rejectForm = reactive({ reason: '' })

// ========== 工具函数 ==========
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    OFFLINE: '已下线',
  }
  return map[status] || status || '-'
}
function statusTagType(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    OFFLINE: 'info',
  }
  return map[status] || ''
}
function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    MANUAL: '手动',
    IMPORT: '导入',
    OPEN_API: 'API',
  }
  return map[source] || source || '-'
}
function formatTime(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').substring(0, 19)
}
function emptySkuRow(): Partial<SkuItem> {
  return {
    skuName: '',
    barcode: '',
    volume: '',
    packaging: '瓶装',
    baseUnit: '瓶',
    boxUnit: '箱',
    boxRatio: 1,
    suggestedRetailPrice: 0,
    status: 'ACTIVE',
  }
}

// ========== 加载数据 ==========
async function fetchList() {
  loading.value = true
  try {
    const res: any = await listSpusApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      barcode: searchForm.barcode || undefined,
      status: searchForm.status || undefined,
      brandId: searchForm.brandId || undefined,
    })
    const data = res.data || res
    const records = (data.records || data.list || []) as any[]
    list.value = records.map((r) => ({ ...r, _skus: r.skus || [] }))
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function fetchBrands() {
  try {
    const res: any = await listBrandOptionsApi()
    const data = res.data || res
    brandOptions.value = (data.records || data.list || []).map((b: any) => ({
      id: b.id,
      name: b.name,
    }))
  } catch {
    /* ignore */
  }
}

function handleSearch() {
  page.value = 1
  fetchList()
}
function handleReset() {
  searchForm.keyword = ''
  searchForm.barcode = ''
  searchForm.status = ''
  searchForm.brandId = null
  page.value = 1
  fetchList()
}

// ========== 新增/编辑 SPU ==========
function showCreateDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function resetForm() {
  form.name = ''
  form.brandId = null
  form.specs = ''
  form.unit = ''
  form.mainImage = ''
  form.alcoholContent = ''
  form.origin = ''
  form.aromaType = ''
  form.description = ''
  form.suggestedRetailPrice = ''
  form.skus = [emptySkuRow()]
}

async function handleEdit(row: SpuListItem) {
  try {
    const res: any = await getSpuApi(row.id)
    const data: SpuDetail = (res.data || res) as SpuDetail
    editingId.value = row.id
    form.name = data.name || ''
    form.brandId = data.brandId || null
    form.specs = data.specs || ''
    form.unit = data.unit || ''
    form.mainImage = data.mainImage || ''
    form.alcoholContent = data.alcoholContent || ''
    form.origin = data.origin || ''
    form.aromaType = data.aromaType || ''
    form.description = data.description || ''
    form.suggestedRetailPrice = data.suggestedRetailPrice || ''
    form.skus = (data.skus || []).map((s) => ({ ...s }))
    if (form.skus.length === 0) form.skus.push(emptySkuRow())
    dialogVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '获取详情失败')
  }
}

function addSkuRow() {
  form.skus.push(emptySkuRow())
}
function removeSkuRow(index: number) {
  if (form.skus.length <= 1) {
    ElMessage.warning('至少保留 1 条 SKU 行')
    return
  }
  form.skus.splice(index, 1)
}

// 合并 properties（从独立字段合成 JSON 字符串）
function buildProperties(): string {
  const obj: Record<string, string> = {}
  if (form.alcoholContent) obj.alcoholContent = form.alcoholContent
  if (form.origin) obj.origin = form.origin
  if (form.aromaType) obj.aromaType = form.aromaType
  return Object.keys(obj).length ? JSON.stringify(obj) : ''
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  // SKU 校验：至少1行 + 条码非空
  const cleanSkus = form.skus.filter((s) => s.barcode && s.skuName)
  if (cleanSkus.length === 0) {
    ElMessage.warning('请至少完整填写 1 条 SKU（规格名称 + 条码 必填）')
    return
  }
  const dup = findDuplicate(cleanSkus.map((s) => s.barcode).filter(Boolean) as string[])
  if (dup) {
    ElMessage.warning(`SKU 条码重复：${dup}`)
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name,
      brandId: form.brandId,
      specs: form.specs,
      unit: form.unit,
      mainImage: form.mainImage,
      description: form.description,
      suggestedRetailPrice: form.suggestedRetailPrice,
      alcoholContent: form.alcoholContent,
      origin: form.origin,
      aromaType: form.aromaType,
      properties: buildProperties(),
      skus: cleanSkus,
    }
    if (editingId.value) {
      await updateSpuApi(editingId.value, payload as any)
      ElMessage.success('更新 SPU 成功')
    } else {
      await createSpuApi(payload as any)
      ElMessage.success('创建 SPU 成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function findDuplicate(arr: string[]): string | null {
  const seen = new Set<string>()
  for (const item of arr) {
    if (seen.has(item)) return item
    seen.add(item)
  }
  return null
}

// ========== 审核操作 ==========
async function handleApprove(row: SpuListItem) {
  try {
    await ElMessageBox.confirm('确定通过该 SPU 的审核？通过后将对商户可见。', '审核通过', { type: 'success' })
  } catch {
    return
  }
  saving.value = true
  try {
    await approveSpuApi(row.id)
    ElMessage.success('已通过审核')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

function handleReject(row: SpuListItem) {
  rejectingId.value = row.id
  rejectForm.reason = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!rejectForm.reason.trim()) {
    ElMessage.warning('请填写拒绝原因')
    return
  }
  saving.value = true
  try {
    await rejectSpuApi(rejectingId.value!, { reason: rejectForm.reason })
    ElMessage.success('已拒绝审核')
    rejectVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

// ========== 删除 SPU ==========
async function handleDelete(row: SpuListItem) {
  try {
    await ElMessageBox.confirm('确定删除该 SPU 吗？关联 SKU 将一并删除。', '确认删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteSpuApi(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// ========== SKU 独立管理（行内展开入口） ==========
async function openSkuManage(row: SpuListItem) {
  currentSpu.value = row
  try {
    const res: any = await getSpuApi(row.id)
    const data: SpuDetail = (res.data || res) as SpuDetail
    manageSkus.value = (data.skus || []).map((s) => ({ ...s }))
  } catch {
    manageSkus.value = []
  }
  if (manageSkus.value.length === 0) manageSkus.value.push(emptySkuRow())
  skuDialogVisible.value = true
}
function addManageSkuRow() {
  manageSkus.value.push(emptySkuRow())
}
function removeManageSkuRow(idx: number) {
  if (manageSkus.value.length <= 1) {
    ElMessage.warning('至少保留 1 条 SKU')
    return
  }
  manageSkus.value.splice(idx, 1)
}
async function handleSaveSkus() {
  if (!currentSpu.value) return
  const clean = manageSkus.value.filter((s) => s.barcode && s.skuName)
  if (clean.length === 0) {
    ElMessage.warning('请至少填写 1 条完整 SKU')
    return
  }
  const dup = findDuplicate(clean.map((s) => s.barcode).filter(Boolean) as string[])
  if (dup) {
    ElMessage.warning(`SKU 条码重复：${dup}`)
    return
  }
  skuSaving.value = true
  try {
    await batchCreateSkusApi(currentSpu.value.id, clean)
    ElMessage.success('SKU 保存成功')
    skuDialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    skuSaving.value = false
  }
}

onMounted(() => {
  fetchBrands()
  fetchList()
})
</script>
