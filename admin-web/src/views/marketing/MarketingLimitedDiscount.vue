<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">限时折扣</h2>
      <p class="page-desc">限时折扣活动配置</p>
    </div>
  </div>
<!-- 工具栏 -->
    <div class="tab-toolbar">
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="loadData">
        <el-option label="草稿" value="DRAFT" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="进行中" value="ACTIVE" />
        <el-option label="已暂停" value="PAUSED" />
        <el-option label="已结束" value="ENDED" />
        <el-option label="已售罄" value="SOLD_OUT" />
      </el-select>
      <el-button type="primary" @click="openDialog()">新建折扣活动</el-button>
      <el-button @click="loadData">刷新</el-button>
    </div>

    <!-- 表格 -->
    <div class="table-card">
<el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="activityCode" label="活动编码" width="150" />
      <el-table-column prop="activityName" label="活动名称" min-width="140" />
      <el-table-column label="折扣类型" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.discountType === 'PERCENTAGE'" type="warning">百分比</el-tag>
          <el-tag v-else type="primary">固定金额</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="折扣值" width="100">
        <template #default="{ row }">
          <span v-if="row.discountType === 'PERCENTAGE'">{{ row.discountValue }}%</span>
          <span v-else>¥{{ row.discountValue }}</span>
        </template>
      </el-table-column>
      <el-table-column label="时间范围" width="240">
        <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
      </el-table-column>
      <el-table-column prop="productCount" label="适用商品" width="80" />
      <el-table-column label="库存" width="120">
        <template #default="{ row }">{{ row.usedStock }} / {{ row.totalStock }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
          <el-tag v-else-if="row.status === 'PENDING'" type="">待审核</el-tag>
          <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
          <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
          <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
          <el-tag v-else-if="row.status === 'SOLD_OUT'" type="warning">已售罄</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button
            v-if="row.status === 'ACTIVE'"
            size="small" link type="warning"
            @click="toggleStatus(row, 'PAUSED')"
          >停用</el-button>
          <el-button
            v-if="row.status === 'PAUSED' || row.status === 'DRAFT'"
            size="small" link type="success"
            @click="handleEnable(row)"
          >启用</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-card-footer">
      <el-pagination
        background layout="total, sizes, prev, pager, next, jumper"
        :total="total" :page-size="pageSize" :current-page="page"
        @size-change="handleSizeChange" @current-change="handlePageChange"
      />
    </div>
</div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑折扣活动' : '新建折扣活动'"
      width="900px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="活动名称" prop="activityName">
          <el-input v-model="form.activityName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="活动描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入活动描述" />
        </el-form-item>
        <el-form-item label="时间范围" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="折扣类型" prop="discountType">
          <el-radio-group v-model="form.discountType">
            <el-radio value="PERCENTAGE">百分比</el-radio>
            <el-radio value="FIXED">固定金额</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="折扣值" prop="discountValue">
          <el-input-number v-model="form.discountValue" :min="0.01" :precision="2" style="width: 200px" />
          <span class="form-hint">{{ form.discountType === 'PERCENTAGE' ? '%' : '元' }}</span>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="总库存" prop="totalStock">
              <el-input-number v-model="form.totalStock" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="每人限购" prop="perLimit">
              <el-input-number v-model="form.perLimit" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- 适用商品 -->
        <el-form-item label="适用商品">
          <div class="product-section">
            <div class="product-header">
              <span class="product-count">已选 {{ form.selectedProducts.length }} 个商品</span>
              <el-button size="small" type="primary" @click="openProductPicker">选择商品</el-button>
            </div>
            <el-table v-if="form.selectedProducts.length > 0" :data="form.selectedProducts" size="small" max-height="240">
              <el-table-column prop="productName" label="商品名称" min-width="120" />
              <el-table-column prop="skuCode" label="SKU编码" width="120" />
              <el-table-column label="原价" width="100">
                <template #default="{ row }">¥{{ row.originalPrice }}</template>
              </el-table-column>
              <el-table-column label="折扣价" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.discountPrice"
                    :min="0.01"
                    :precision="2"
                    size="small"
                    style="width: 100px"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="70">
                <template #default="{ row }">{{ row.stockQty }}</template>
              </el-table-column>
              <el-table-column label="已售" width="70">
                <template #default="{ row }">{{ row.soldQty || 0 }}</template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ $index }">
                  <el-button size="small" link type="danger" @click="form.selectedProducts.splice($index, 1)">移除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="form.selectedProducts.length > 0" class="batch-discount">
              <el-button size="small" @click="batchSetDiscountByRate">按原价*折扣率批量设置</el-button>
              <el-input-number
                v-model="batchDiscountRate"
                :min="0.1"
                :max="9.9"
                :precision="1"
                size="small"
                style="width: 100px"
                controls-position="right"
              />
              <span class="form-hint">折</span>
              <el-divider direction="vertical" />
              <el-button size="small" @click="batchSetDiscountByPrice">统一折扣价</el-button>
              <el-input-number
                v-model="batchDiscountPrice"
                :min="0.01"
                :precision="2"
                size="small"
                style="width: 100px"
                controls-position="right"
              />
              <span class="form-hint">元</span>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <!-- 启用前校验 -->
      <div v-if="enableWarnings.length > 0" class="enable-warnings">
        <el-alert
          v-for="(w, i) in enableWarnings"
          :key="i"
          :title="w"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 6px"
        />
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 商品选择器弹窗 -->
    <el-dialog v-model="productPickerVisible" title="选择适用商品" width="720px">
      <div class="picker-toolbar">
        <el-input v-model="productSearchKeyword" placeholder="搜索商品名称" clearable style="width: 200px" />
        <el-select v-model="productCategoryFilter" placeholder="分类筛选" clearable style="width: 140px">
          <el-option label="白酒" value="白酒" />
          <el-option label="红酒" value="红酒" />
          <el-option label="啤酒" value="啤酒" />
          <el-option label="洋酒" value="洋酒" />
        </el-select>
        <el-button @click="loadAllProducts">搜索</el-button>
      </div>
      <el-table
        ref="pickerTableRef"
        :data="filteredAllProducts"
        max-height="400"
        @selection-change="handlePickerSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="productName" label="商品名称" min-width="120" />
        <el-table-column prop="skuCode" label="SKU编码" width="120" />
        <el-table-column prop="categoryName" label="分类" width="80" />
        <el-table-column label="原价" width="100">
          <template #default="{ row }">¥{{ row.originalPrice }}</template>
        </el-table-column>
        <el-table-column prop="stockQty" label="库存" width="80" />
      </el-table>
      <template #footer>
        <el-button @click="productPickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmProductSelection">确认选择 ({{ tempSelectedProducts.length }})</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  fetchLimitedDiscounts,
  fetchLimitedDiscountDetail,
  createLimitedDiscount,
  updateLimitedDiscount,
  deleteLimitedDiscount,
  activateLimitedDiscount,
  pauseLimitedDiscount,
  addLimitedDiscountProducts,
  fetchProducts,
  getErrorMessage
} from '../../api'

// ==================== 列表 ====================
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('')

/** 后端 snake_case 行转页面展示结构 */
function mapDiscountRow(item: any) {
  const totalStock = Number(item.total_stock ?? 0)
  const availableStock = Number(item.available_stock ?? 0)
  return {
    id: Number(item.id),
    activityCode: item.activity_code,
    activityName: item.activity_name,
    description: item.activity_desc || '',
    discountType: item.discount_type,
    discountValue: Number(item.discount_value),
    minAmount: Number(item.min_purchase || 0),
    startTime: item.start_time,
    endTime: item.end_time,
    totalStock,
    usedStock: Math.max(totalStock - availableStock, 0),
    perLimit: item.limit_per_user,
    status: item.status,
    productCount: 0
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (statusFilter.value) params.status = statusFilter.value
    const data = await fetchLimitedDiscounts(params)
    const rows = data.list || data.records || []
    list.value = rows.map(mapDiscountRow)
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, '加载限时折扣失败'))
  } finally {
    loading.value = false
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadData()
}

function handlePageChange(p: number) {
  page.value = p
  loadData()
}

async function toggleStatus(row: any, newStatus: string) {
  const text = newStatus === 'PAUSED' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${text}活动 ${row.activityName}？`, `确认${text}`, { type: 'warning' })
    if (newStatus === 'ACTIVE') {
      await activateLimitedDiscount(row.id)
    } else {
      await pauseLimitedDiscount(row.id)
    }
    ElMessage.success(`已${text}`)
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(getErrorMessage(e, `${text}失败`))
    }
  }
}

async function handleEnable(row: any) {
  if (row.totalStock <= row.usedStock) {
    ElMessage.warning('库存不足，无法启用')
    return
  }
  await toggleStatus(row, 'ACTIVE')
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除活动 ${row.activityName}？`, '确认删除', { type: 'warning' })
    await deleteLimitedDiscount(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(getErrorMessage(e, '删除失败'))
    }
  }
}

// ==================== 表单 ====================
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()
const enableWarnings = ref<string[]>([])

const form = reactive({
  activityName: '',
  description: '',
  timeRange: [] as any[],
  discountType: 'PERCENTAGE',
  discountValue: 0,
  totalStock: 100,
  perLimit: 1,
  selectedProducts: [] as any[]
})

const formRules: FormRules = {
  activityName: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  timeRange: [{ required: true, message: '请选择时间范围', trigger: 'change' }],
  discountType: [{ required: true, message: '请选择折扣类型', trigger: 'change' }],
  discountValue: [
    { required: true, message: '请输入折扣值', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '折扣值必须大于0', trigger: 'blur' }
  ],
  totalStock: [
    { required: true, message: '请输入总库存', trigger: 'blur' },
    { type: 'number', min: 0, message: '库存不能为负数', trigger: 'blur' }
  ],
  perLimit: [{ required: true, message: '请输入每人限购', trigger: 'blur' }]
}

async function openDialog(row?: any) {
  enableWarnings.value = []
  if (row) {
    isEdit.value = true
    editingId.value = row.id
    form.activityName = row.activityName
    form.description = row.description || ''
    form.timeRange = [row.startTime, row.endTime]
    form.discountType = row.discountType
    form.discountValue = row.discountValue
    form.totalStock = row.totalStock
    form.perLimit = row.perLimit || 1
    form.selectedProducts = []
    // 编辑时加载详情商品（后端无商品名，用商品列表解析名称展示）
    try {
      const [detail, productsData] = await Promise.all([
        fetchLimitedDiscountDetail(row.id),
        fetchProducts({ page: 1, pageSize: 100 })
      ])
      const productMap = new Map<number, any>((productsData.records || []).map((p: any) => [Number(p.skuId), p]))
      form.selectedProducts = (detail?.products || []).map((p: any) => {
        const skuId = Number(p.sku_id)
        const info = productMap.get(skuId)
        return {
          id: skuId,
          skuId,
          productName: info?.name || `商品#${skuId}`,
          skuCode: info?.skuCode || `SKU-${skuId}`,
          categoryName: info?.categoryName || '',
          originalPrice: Number(p.original_price),
          discountPrice: Number(p.discount_price),
          stockQty: Number(p.stock || 0),
          soldQty: 0
        }
      })
    } catch {
      form.selectedProducts = []
    }
  } else {
    isEdit.value = false
    editingId.value = null
    resetForm()
  }
  dialogVisible.value = true
}

function resetForm() {
  form.activityName = ''
  form.description = ''
  form.timeRange = []
  form.discountType = 'PERCENTAGE'
  form.discountValue = 0
  form.totalStock = 100
  form.perLimit = 1
  form.selectedProducts = []
  enableWarnings.value = []
  formRef.value?.resetFields()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // 启用校验
  enableWarnings.value = []
  for (const p of form.selectedProducts) {
    if (p.stockQty <= 0) {
      enableWarnings.value.push(`商品「${p.productName}」库存不足`)
    }
  }

  submitLoading.value = true
  try {
    const baseData = {
      name: form.activityName,
      description: form.description,
      discountType: form.discountType,
      discountValue: form.discountValue,
      startTime: form.timeRange[0] || '',
      endTime: form.timeRange[1] || '',
      limitPerUser: form.perLimit,
      totalLimit: form.totalStock,
      status: 'DRAFT',
      applicableScope: 'ALL'
    }

    if (isEdit.value && editingId.value) {
      await updateLimitedDiscount(editingId.value, baseData)
      ElMessage.success('修改成功')
    } else {
      const created = await createLimitedDiscount(baseData)
      const newId = Number(created?.id)
      if (newId && form.selectedProducts.length > 0) {
        await addLimitedDiscountProducts(newId, form.selectedProducts.map((p: any) => Number(p.skuId)))
      }
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, isEdit.value ? '修改失败' : '创建失败'))
  } finally {
    submitLoading.value = false
  }
}

// ==================== 商品选择器 ====================
const productPickerVisible = ref(false)
const productSearchKeyword = ref('')
const productCategoryFilter = ref('')
const tempSelectedProducts = ref<any[]>([])
const pickerTableRef = ref()

const allProducts = ref<any[]>([])

function openProductPicker() {
  productPickerVisible.value = true
  loadAllProducts()
}

const filteredAllProducts = computed(() => {
  let result = [...allProducts.value]
  if (productSearchKeyword.value) {
    const kw = productSearchKeyword.value.toLowerCase()
    result = result.filter(p => p.productName.toLowerCase().includes(kw))
  }
  if (productCategoryFilter.value) {
    result = result.filter(p => p.categoryName === productCategoryFilter.value)
  }
  return result
})

async function loadAllProducts() {
  try {
    const data = await fetchProducts({ page: 1, pageSize: 100 })
    allProducts.value = (data.records || []).map((item: any) => ({
      id: item.skuId,
      skuId: item.skuId,
      productName: item.name,
      skuCode: item.skuCode,
      categoryName: item.categoryName || '',
      originalPrice: Number(item.retailPrice || 0),
      stockQty: Number(item.availableQty || 0)
    }))
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, '加载商品列表失败'))
  }
}

function handlePickerSelectionChange(val: any[]) {
  tempSelectedProducts.value = val
}

function confirmProductSelection() {
  if (tempSelectedProducts.value.length === 0) {
    ElMessage.warning('请至少选择一个商品')
    return
  }
  const existingIds = new Set(form.selectedProducts.map((p: any) => p.id))
  for (const p of tempSelectedProducts.value) {
    if (!existingIds.has(p.id)) {
      form.selectedProducts.push({
        ...p,
        discountPrice: (p.originalPrice * (form.discountType === 'PERCENT' ? form.discountValue / 100 : 1)).toFixed(2),
        soldQty: 0
      })
    }
  }
  productPickerVisible.value = false
  tempSelectedProducts.value = []
}

// 批量设置折扣
const batchDiscountRate = ref(8.0)
const batchDiscountPrice = ref(50)

function batchSetDiscountByRate() {
  form.selectedProducts.forEach((p: any) => {
    p.discountPrice = (p.originalPrice * batchDiscountRate.value / 10).toFixed(2)
  })
}

function batchSetDiscountByPrice() {
  form.selectedProducts.forEach((p: any) => {
    p.discountPrice = batchDiscountPrice.value
  })
}

// 初始化
loadData()
</script>

<style scoped>
.limited-discount {
  /* 嵌入在父页面中，无需额外 page padding */
}

.tab-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.form-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--gray-400);
}

.product-section {
  width: 100%;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.product-count {
  font-size: 13px;
  color: var(--gray-500);
}

.batch-discount {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: 6px;
  flex-wrap: wrap;
}

.enable-warnings {
  margin-top: 12px;
}

.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
</style>