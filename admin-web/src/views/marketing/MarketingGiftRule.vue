<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">赠品规则</h2>
      <p class="page-desc">赠品规则配置与维护</p>
    </div>
  </div>
<!-- 工具栏 -->
    <div class="tab-toolbar">
      <el-input
        v-model="keyword"
        placeholder="规则名称/编码"
        clearable
        style="width: 200px"
        @clear="loadData"
        @keyup.enter="loadData"
      />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="loadData">
        <el-option label="草稿" value="DRAFT" />
        <el-option label="进行中" value="ACTIVE" />
        <el-option label="已暂停" value="PAUSED" />
        <el-option label="已结束" value="ENDED" />
      </el-select>
      <el-button type="primary" @click="openDialog()">新建满赠规则</el-button>
      <el-button @click="loadData">刷新</el-button>
    </div>

    <!-- 表格 -->
    <div class="table-card">
<el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="ruleCode" label="规则编码" width="150" />
      <el-table-column prop="ruleName" label="规则名称" min-width="140" />
      <el-table-column label="满赠类型" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.giftType === 'AMOUNT'" type="warning">满金额</el-tag>
          <el-tag v-else-if="row.giftType === 'QTY'" type="primary">满件数</el-tag>
          <el-tag v-else type="success">两者</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间范围" width="200">
        <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
      </el-table-column>
      <el-table-column prop="productCount" label="适用商品" width="80" />
      <el-table-column prop="giftStock" label="赠品库存" width="90" />
      <el-table-column prop="giftedCount" label="已赠数量" width="90" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
          <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
          <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
          <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button
            v-if="row.status === 'DRAFT' || row.status === 'PAUSED'"
            size="small" link type="success"
            @click="toggleStatus(row, 'ACTIVE')"
          >启用</el-button>
          <el-button
            v-if="row.status === 'ACTIVE'"
            size="small" link type="warning"
            @click="toggleStatus(row, 'PAUSED')"
          >停用</el-button>
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
      :title="isEdit ? '编辑满赠规则' : '新建满赠规则'"
      width="900px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="规则描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入规则描述" />
        </el-form-item>
        <el-form-item label="时间范围" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="满赠条件" prop="giftType">
          <el-radio-group v-model="form.giftType">
            <el-radio value="AMOUNT">满金额</el-radio>
            <el-radio value="QTY">满件数</el-radio>
            <el-radio value="BOTH">两者</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="适用范围">
          <el-radio-group v-model="form.scopeType">
            <el-radio value="ALL">全部商品</el-radio>
            <el-radio value="CATEGORY">指定分类</el-radio>
            <el-radio value="PRODUCT">指定商品</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 多级满赠配置 -->
        <el-form-item label="满赠层级" prop="tiers" class="tier-form-item">
          <div class="tier-section">
            <div class="tier-header">
              <span class="tier-title">满赠层级配置</span>
              <el-button size="small" type="primary" @click="addTier">+ 添加层级</el-button>
            </div>
            <el-table :data="sortedTiers" size="small" border>
              <el-table-column label="层级" width="60">
                <template #default="{ $index }">第{{ $index + 1 }}级</template>
              </el-table-column>
              <el-table-column label="满足金额" width="160">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.thresholdAmount"
                    :min="0.01"
                    :precision="2"
                    size="small"
                    style="width: 130px"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="赠品商品" min-width="180">
                <template #default="{ row }">
                  <el-select
                    v-model="row.giftProductId"
                    placeholder="选择赠品"
                    filterable
                    size="small"
                    style="width: 100%"
                    @change="(val: number) => onGiftProductChange(row, val)"
                  >
                    <el-option
                      v-for="g in giftProducts"
                      :key="g.id"
                      :label="`${g.productName} (${g.skuCode})`"
                      :value="g.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="赠送数量" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.giftQty"
                    :min="1"
                    size="small"
                    style="width: 90px"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="当前库存" width="90">
                <template #default="{ row }">
                  <span :class="{ 'stock-warning': row.stockQty !== undefined && row.stockQty < row.giftQty }">
                    {{ row.stockQty !== undefined ? row.stockQty : '-' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70">
                <template #default="{ $index }">
                  <el-button size="small" link type="danger" @click="removeTier($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <div v-if="form.tiers.length === 0" class="tier-empty">暂无层级，请点击"添加层级"配置满赠规则</div>

            <!-- 层级预览 -->
            <div v-if="sortedTiers.length > 0" class="tier-preview">
              <div class="preview-title">层级预览：</div>
              <div v-for="(t, i) in sortedTiers" :key="i" class="preview-item">
                <span class="preview-badge">{{ i + 1 }}</span>
                满¥{{ t.thresholdAmount }} 赠
                <span class="preview-product">{{ getGiftProductName(t.giftProductId) }}</span>
                {{ t.giftQty }}件
              </div>
            </div>
          </div>
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
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

// ==================== Mock 数据 ====================
const mockGiftRules = ref(Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  ruleCode: `GR202606${String(i + 1).padStart(3, '0')}`,
  ruleName: `满赠活动${i + 1}`,
  giftType: (['AMOUNT', 'QTY', 'BOTH'] as const)[i % 3],
  productCount: Math.floor(Math.random() * 30 + 5),
  giftStock: Math.floor(Math.random() * 500 + 100),
  giftedCount: Math.floor(Math.random() * 200),
  status: (['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'] as const)[i % 4],
  startTime: '2026-06-01',
  endTime: '2026-12-31',
  description: '',
  scopeType: 'ALL',
  tiers: [] as any[]
})))

const giftProducts = ref(Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  productName: `赠品${i + 1}`,
  skuCode: `GP${String(i + 1).padStart(4, '0')}`,
  stockQty: Math.floor(Math.random() * 100 + 20),
  imageUrl: ''
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
    let filtered = [...mockGiftRules.value]
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      filtered = filtered.filter(r => r.ruleName.toLowerCase().includes(kw) || r.ruleCode.toLowerCase().includes(kw))
    }
    if (statusFilter.value) {
      filtered = filtered.filter(r => r.status === statusFilter.value)
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
  const text = newStatus === 'ACTIVE' ? '启用' : '停用'
  const confirmed = await ElMessageBox.confirm(`确认${text}规则 ${row.ruleName}？`, `确认${text}`, { type: 'warning' }).catch(() => null)
  if (!confirmed) return
  row.status = newStatus
  ElMessage.success(`已${text}`)
  loadData()
}

async function handleDelete(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除规则 ${row.ruleName}？`, '确认删除', { type: 'warning' }).catch(() => null)
  if (!confirmed) return
  const idx = mockGiftRules.value.findIndex(r => r.id === row.id)
  if (idx > -1) mockGiftRules.value.splice(idx, 1)
  ElMessage.success('已删除')
  loadData()
}

// ==================== 表单 ====================
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

interface TierItem {
  thresholdAmount: number
  giftProductId: number | null
  giftQty: number
  stockQty?: number
}

const form = reactive({
  ruleName: '',
  description: '',
  timeRange: [] as any[],
  giftType: 'AMOUNT',
  scopeType: 'ALL',
  tiers: [] as TierItem[]
})

const formRules: FormRules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  timeRange: [{ required: true, message: '请选择时间范围', trigger: 'change' }],
  giftType: [{ required: true, message: '请选择满赠条件', trigger: 'change' }]
}

const sortedTiers = computed(() => {
  return [...form.tiers].sort((a, b) => a.thresholdAmount - b.thresholdAmount)
})

function getGiftProductName(productId: number | null): string {
  if (!productId) return '未选择'
  const p = giftProducts.value.find(g => g.id === productId)
  return p ? p.productName : '未知'
}

function onGiftProductChange(row: TierItem, productId: number) {
  const p = giftProducts.value.find(g => g.id === productId)
  row.stockQty = p ? p.stockQty : 0
}

function addTier() {
  form.tiers.push({
    thresholdAmount: 0,
    giftProductId: null,
    giftQty: 1,
    stockQty: undefined
  })
}

function removeTier(index: number) {
  form.tiers.splice(index, 1)
}

function openDialog(row?: any) {
  if (row) {
    isEdit.value = true
    editingId.value = row.id
    form.ruleName = row.ruleName
    form.description = row.description || ''
    form.timeRange = [row.startTime, row.endTime]
    form.giftType = row.giftType
    form.scopeType = row.scopeType || 'ALL'
    form.tiers = (row.tiers || []).map((t: any) => ({ ...t }))
  } else {
    isEdit.value = false
    editingId.value = null
    resetForm()
  }
  dialogVisible.value = true
}

function resetForm() {
  form.ruleName = ''
  form.description = ''
  form.timeRange = []
  form.giftType = 'AMOUNT'
  form.scopeType = 'ALL'
  form.tiers = []
  formRef.value?.resetFields()
}

function validateTiers(): boolean {
  if (form.tiers.length === 0) {
    ElMessage.warning('请至少配置一个满赠层级')
    return false
  }
  for (let i = 0; i < form.tiers.length; i++) {
    const t = form.tiers[i]
    if (!t.thresholdAmount || t.thresholdAmount <= 0) {
      ElMessage.warning(`第${i + 1}级满赠条件金额必须大于0`)
      return false
    }
    if (!t.giftProductId) {
      ElMessage.warning(`第${i + 1}级请选择赠品商品`)
      return false
    }
    if (!t.giftQty || t.giftQty < 1) {
      ElMessage.warning(`第${i + 1}级赠送数量必须大于0`)
      return false
    }
    if (t.stockQty !== undefined && t.stockQty < t.giftQty) {
      ElMessage.warning(`第${i + 1}级赠品「${getGiftProductName(t.giftProductId)}」库存不足`)
      return false
    }
  }
  return true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!validateTiers()) return

  submitLoading.value = true
  try {
    const baseData = {
      ruleName: form.ruleName,
      description: form.description,
      startTime: form.timeRange[0] || '',
      endTime: form.timeRange[1] || '',
      giftType: form.giftType,
      scopeType: form.scopeType,
      tiers: sortedTiers.value.map(t => ({
        thresholdAmount: t.thresholdAmount,
        giftProductId: t.giftProductId,
        giftQty: t.giftQty,
        stockQty: t.stockQty
      })),
      giftStock: sortedTiers.value.reduce((sum, t) => sum + (t.stockQty || 0), 0),
      productCount: Math.floor(Math.random() * 30 + 5)
    }

    if (isEdit.value && editingId.value) {
      const idx = mockGiftRules.value.findIndex(r => r.id === editingId.value)
      if (idx > -1) Object.assign(mockGiftRules.value[idx], baseData)
      ElMessage.success('修改成功')
    } else {
      const newId = Math.max(...mockGiftRules.value.map(r => r.id), 0) + 1
      mockGiftRules.value.unshift({
        id: newId,
        ruleCode: `GR202606${String(newId).padStart(3, '0')}`,
        ...baseData,
        giftedCount: 0,
        status: 'DRAFT'
      } as any)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } finally {
    submitLoading.value = false
  }
}

// 初始化
loadData()
</script>

<style scoped>
.gift-rule {
  /* 嵌入在父页面中 */
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

/* 满赠层级 */
.tier-form-item {
  display: block;
}

.tier-section {
  width: 100%;
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tier-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-500);
}

.tier-empty {
  text-align: center;
  padding: 24px;
  color: var(--gray-400);
  font-size: 13px;
  border: 1px dashed var(--gray-300);
  border-radius: 6px;
}

.stock-warning {
  color: var(--color-danger);
  font-weight: 600;
}

/* 层级预览 */
.tier-preview {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--color-success-soft);
  border: 1px solid rgba(14,168,121,0.35);
  border-radius: 8px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-success);
  margin-bottom: 8px;
}

.preview-item {
  font-size: 13px;
  color: var(--gray-600);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--color-success);
  color: var(--text-inverse);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.preview-product {
  color: var(--color-primary);
  font-weight: 500;
}
</style>