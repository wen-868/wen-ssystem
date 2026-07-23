<template>
  <div class="limited-discount">
    <!-- 工具栏 -->
    <div class="tab-toolbar">
      <el-input
        v-model="keyword"
        placeholder="活动名称/编码"
        clearable
        style="width: 200px"
        @clear="loadData"
        @keyup.enter="loadData"
      />
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
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="activityCode" label="活动编码" width="150" />
      <el-table-column prop="activityName" label="活动名称" min-width="140" />
      <el-table-column label="折扣类型" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.discountType === 'PERCENT'" type="warning">百分比</el-tag>
          <el-tag v-else type="primary">固定金额</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="折扣值" width="100">
        <template #default="{ row }">
          <span v-if="row.discountType === 'PERCENT'">{{ row.discountValue }}%</span>
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

    <div class="pagination">
      <el-pagination
        background layout="total, sizes, prev, pager, next, jumper"
        :total="total" :page-size="pageSize" :current-page="page"
        @size-change="handleSizeChange" @current-change="handlePageChange"
      />
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑折扣活动' : '新建折扣活动'"
      width="800px"
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
            <el-radio value="PERCENT">百分比</el-radio>
            <el-radio value="AMOUNT">固定金额</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="折扣值" prop="discountValue">
          <el-input-number v-model="form.discountValue" :min="0.01" :precision="2" style="width: 200px" />
          <span class="form-hint">{{ form.discountType === 'PERCENT' ? '%' : '元' }}</span>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="最低消费" prop="minAmount">
              <el-input-number v-model="form.minAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
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
        <el-form-item label="每单限购">
          <el-input-number v-model="form.orderLimit" :min="1" style="width: 200px" />
        </el-form-item>

        <!-- 适用商品 -->
        <el-form-item label="适用商品">
          <div class="product-section">
            <div class="product-header">
              <span class="product-count">已选 {{ form.selectedProducts.length }} 个商品</span>
              <el-button size="small" type="primary" @click="productPickerVisible = true">选择商品</el-button>
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
    <el-dialog v-model="productPickerVisible" title="选择适用商品" width="700px">
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

// ==================== Mock 数据 ====================
const mockDiscounts = ref(Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  activityCode: `LD202606${String(i + 1).padStart(3, '0')}`,
  activityName: `限时折扣${i + 1}`,
  discountType: (i % 2 === 0 ? 'PERCENT' : 'AMOUNT') as string,
  discountValue: i % 2 === 0 ? Math.floor(Math.random() * 30 + 20) : Math.floor(Math.random() * 50 + 10),
  startTime: '2026-06-01 00:00',
  endTime: '2026-07-15 23:59',
  productCount: Math.floor(Math.random() * 20 + 5),
  usedStock: Math.floor(Math.random() * 500),
  totalStock: 1000,
  status: (['DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'ENDED', 'SOLD_OUT'] as const)[i % 6],
  description: '',
  minAmount: 0,
  perLimit: 1,
  orderLimit: 1,
  selectedProducts: [] as any[]
})))

const mockProducts = ref(Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  productName: `商品${i + 1}`,
  skuCode: `SKU${String(i + 1).padStart(4, '0')}`,
  categoryName: (['白酒', '红酒', '啤酒', '洋酒'] as const)[i % 4],
  originalPrice: Math.floor(Math.random() * 500 + 100),
  stockQty: Math.floor(Math.random() * 200 + 50)
})))

// ==================== 列表 ====================
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const statusFilter = ref('')

function loadData() {
  loading.value = true
  try {
    let filtered = [...mockDiscounts.value]
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      filtered = filtered.filter(d => d.activityName.toLowerCase().includes(kw) || d.activityCode.toLowerCase().includes(kw))
    }
    if (statusFilter.value) {
      filtered = filtered.filter(d => d.status === statusFilter.value)
    }
    total.value = filtered.length
    const start = (page.value - 1) * pageSize.value
    list.value = filtered.slice(start, start + pageSize.value)
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
  const confirmed = await ElMessageBox.confirm(`确认${text}活动 ${row.activityName}？`, `确认${text}`, { type: 'warning' }).catch(() => null)
  if (!confirmed) return
  row.status = newStatus
  ElMessage.success(`已${text}`)
  loadData()
}

async function handleEnable(row: any) {
  if (row.totalStock <= row.usedStock) {
    ElMessage.warning('库存不足，无法启用')
    return
  }
  await toggleStatus(row, 'ACTIVE')
}

async function handleDelete(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除活动 ${row.activityName}？`, '确认删除', { type: 'warning' }).catch(() => null)
  if (!confirmed) return
  const idx = mockDiscounts.value.findIndex(d => d.id === row.id)
  if (idx > -1) mockDiscounts.value.splice(idx, 1)
  ElMessage.success('已删除')
  loadData()
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
  discountType: 'PERCENT',
  discountValue: 0,
  minAmount: 0,
  totalStock: 100,
  perLimit: 1,
  orderLimit: 1,
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
  minAmount: [{ required: true, message: '请输入最低消费', trigger: 'blur' }],
  totalStock: [
    { required: true, message: '请输入总库存', trigger: 'blur' },
    { type: 'number', min: 0, message: '库存不能为负数', trigger: 'blur' }
  ],
  perLimit: [{ required: true, message: '请输入每人限购', trigger: 'blur' }]
}

function openDialog(row?: any) {
  enableWarnings.value = []
  if (row) {
    isEdit.value = true
    editingId.value = row.id
    form.activityName = row.activityName
    form.description = row.description || ''
    form.timeRange = [row.startTime, row.endTime]
    form.discountType = row.discountType
    form.discountValue = row.discountValue
    form.minAmount = row.minAmount || 0
    form.totalStock = row.totalStock
    form.perLimit = row.perLimit || 1
    form.orderLimit = row.orderLimit || 1
    form.selectedProducts = [...(row.selectedProducts || [])]
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
  form.discountType = 'PERCENT'
  form.discountValue = 0
  form.minAmount = 0
  form.totalStock = 100
  form.perLimit = 1
  form.orderLimit = 1
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
      activityName: form.activityName,
      description: form.description,
      startTime: form.timeRange[0] || '',
      endTime: form.timeRange[1] || '',
      discountType: form.discountType,
      discountValue: form.discountValue,
      minAmount: form.minAmount,
      totalStock: form.totalStock,
      perLimit: form.perLimit,
      orderLimit: form.orderLimit,
      productCount: form.selectedProducts.length,
      selectedProducts: [...form.selectedProducts]
    }

    if (isEdit.value && editingId.value) {
      const idx = mockDiscounts.value.findIndex(d => d.id === editingId.value)
      if (idx > -1) Object.assign(mockDiscounts.value[idx], baseData)
      ElMessage.success('修改成功')
    } else {
      const newId = Math.max(...mockDiscounts.value.map(d => d.id), 0) + 1
      mockDiscounts.value.unshift({
        id: newId,
        activityCode: `LD202606${String(newId).padStart(3, '0')}`,
        ...baseData,
        usedStock: 0,
        status: 'DRAFT'
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
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

const allProducts = ref([...mockProducts.value])

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

function loadAllProducts() {
  // mock - no-op
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
  color: #9ca3af;
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
  color: #6b7280;
}

.batch-discount {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: #f5f7fa;
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