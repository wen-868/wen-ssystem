<template>
  <div>
    <h2 style="margin-bottom: 24px;">商品库管理</h2>

    <!-- 搜索区 -->
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索商品名称/编码"
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
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
        <el-button type="success" @click="showCreateDialog">新增商品</el-button>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="spuCode" label="商品编码" width="160" />
        <el-table-column prop="name" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="brandName" label="品牌" width="120" />
        <el-table-column prop="specs" label="规格" width="120" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column label="状态" width="100">
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
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="success" size="small"
              @click="handleAudit(row, 'APPROVED')"
            >通过</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="warning" size="small"
              @click="handleAudit(row, 'REJECTED')"
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
      :title="editingId ? '编辑商品' : '新增商品'"
      width="780px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商品名称" maxlength="100" />
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
              <el-input v-model="form.specs" placeholder="如 500ml、整箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-input v-model="form.unit" placeholder="如 瓶、箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主图URL" prop="mainImage">
              <el-input v-model="form.mainImage" placeholder="商品主图链接" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="建议零售价" prop="suggestedRetailPrice">
              <el-input v-model="form.suggestedRetailPrice" placeholder="如 99.00" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="属性" prop="properties">
          <el-input v-model="form.properties" type="textarea" :rows="2" placeholder="JSON 格式，如 {&quot;度数&quot;:&quot;52%&quot;}" />
        </el-form-item>
        <el-form-item label="简述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="商品简述" />
        </el-form-item>
        <el-form-item label="详情" prop="detail">
          <el-input v-model="form.detail" type="textarea" :rows="4" placeholder="商品详情（支持富文本）" />
        </el-form-item>

        <!-- SKU 管理 -->
        <el-divider content-position="left">SKU 规格</el-divider>
        <div style="margin-bottom: 12px;">
          <el-button type="primary" plain size="small" @click="addSkuRow">添加规格</el-button>
        </div>
        <el-table :data="form.skus" border size="small" style="width: 100%;">
          <el-table-column label="规格名称" width="140">
            <template #default="{ row }">
              <el-input v-model="row.skuName" placeholder="如 500ml单瓶" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="条码" width="160">
            <template #default="{ row }">
              <el-input v-model="row.barcode" placeholder="条形码" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="容量" width="100">
            <template #default="{ row }">
              <el-input v-model="row.volume" placeholder="如 500" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="包装" width="100">
            <template #default="{ row }">
              <el-input v-model="row.packaging" placeholder="如 瓶装" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="基本单位" width="90">
            <template #default="{ row }">
              <el-input v-model="row.baseUnit" placeholder="瓶" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="箱单位" width="90">
            <template #default="{ row }">
              <el-input v-model="row.boxUnit" placeholder="箱" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="装箱比" width="90">
            <template #default="{ row }">
              <el-input v-model="row.boxRatio" placeholder="如 12" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeSkuRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="商品详情" width="780px">
      <div v-if="currentDetail" style="padding: 10px 0;">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="商品编码">{{ currentDetail.spuCode }}</el-descriptions-item>
          <el-descriptions-item label="商品名称">{{ currentDetail.name }}</el-descriptions-item>
          <el-descriptions-item label="品牌">{{ currentDetail.brandName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="规格">{{ currentDetail.specs || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ currentDetail.unit || '-' }}</el-descriptions-item>
          <el-descriptions-item label="建议零售价">{{ currentDetail.suggestedRetailPrice || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentDetail.status)" size="small">{{ statusLabel(currentDetail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="扫码命中">{{ currentDetail.hitCount || 0 }} 次</el-descriptions-item>
          <el-descriptions-item label="来源">{{ sourceLabel(currentDetail.source) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(currentDetail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="简述" :span="2">{{ currentDetail.description || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 12px;">SKU 规格列表</h4>
        <el-table :data="currentDetail.skus || []" border size="small" style="width: 100%;">
          <el-table-column prop="skuCode" label="SKU编码" width="160" />
          <el-table-column prop="skuName" label="规格名称" width="140" />
          <el-table-column prop="barcode" label="条码" width="160" />
          <el-table-column prop="volume" label="容量" width="80" />
          <el-table-column prop="packaging" label="包装" width="80" />
          <el-table-column prop="baseUnit" label="基本单位" width="90" />
          <el-table-column prop="boxUnit" label="箱单位" width="80" />
          <el-table-column prop="boxRatio" label="装箱比" width="80" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
                {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listSpusApi, getSpuApi, createSpuApi, updateSpuApi,
  updateSpuStatusApi, deleteSpuApi, listBrandsApi,
  type SpuListItem, type SpuDetail,
} from '../../api/library'

const loading = ref(false)
const list = ref<SpuListItem[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const brandOptions = ref<any[]>([])

const searchForm = reactive({
  keyword: '',
  status: '',
  brandId: null as number | null,
})

const dialogVisible = ref(false)
const detailVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const currentDetail = ref<SpuDetail | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  brandId: null as number | null,
  specs: '',
  unit: '',
  mainImage: '',
  imageUrls: '',
  properties: '',
  description: '',
  detail: '',
  suggestedRetailPrice: '',
  skus: [] as any[],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
}

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

async function fetchList() {
  loading.value = true
  try {
    const res = await listSpusApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      brandId: searchForm.brandId || undefined,
    })
    const data = (res as any).data || res
    list.value = data.records || []
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function fetchBrands() {
  try {
    const res = await listBrandsApi({ page: 1, pageSize: 200 })
    const data = (res as any).data || res
    brandOptions.value = data.records || []
  } catch {
    // 忽略
  }
}

function handleSearch() {
  page.value = 1
  fetchList()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.brandId = null
  page.value = 1
  fetchList()
}

function showCreateDialog() {
  editingId.value = null
  Object.assign(form, {
    name: '', brandId: null, specs: '', unit: '',
    mainImage: '', imageUrls: '', properties: '',
    description: '', detail: '', suggestedRetailPrice: '',
    skus: [],
  })
  dialogVisible.value = true
}

async function handleEdit(row: SpuListItem) {
  try {
    const res = await getSpuApi(row.id)
    const data = (res as any).data || res
    editingId.value = row.id
    Object.assign(form, {
      name: data.name || '',
      brandId: data.brandId || null,
      specs: data.specs || '',
      unit: data.unit || '',
      mainImage: data.mainImage || '',
      imageUrls: data.imageUrls || '',
      properties: data.properties || '',
      description: data.description || '',
      detail: data.detail || '',
      suggestedRetailPrice: data.suggestedRetailPrice || '',
      skus: [],
    })
    dialogVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '获取详情失败')
  }
}

async function handleDetail(row: SpuListItem) {
  try {
    const res = await getSpuApi(row.id)
    currentDetail.value = (res as any).data || res
    detailVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '获取详情失败')
  }
}

function addSkuRow() {
  form.skus.push({
    skuName: '', barcode: '', volume: '', packaging: '',
    baseUnit: '', boxUnit: '', boxRatio: '', skuImage: '',
  })
}

function removeSkuRow(index: number) {
  form.skus.splice(index, 1)
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    if (editingId.value) {
      await updateSpuApi(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await createSpuApi(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleAudit(row: SpuListItem, status: string) {
  const label = status === 'APPROVED' ? '通过' : '拒绝'
  try {
    await ElMessageBox.confirm(`确定要${label}该商品吗？`, '审核确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await updateSpuStatusApi(row.id, status)
    ElMessage.success(`已${label}`)
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleDelete(row: SpuListItem) {
  try {
    await ElMessageBox.confirm('确定要删除该商品吗？仅已下线状态可删除。', '确认删除', { type: 'warning' })
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

onMounted(() => {
  fetchBrands()
  fetchList()
})
</script>
