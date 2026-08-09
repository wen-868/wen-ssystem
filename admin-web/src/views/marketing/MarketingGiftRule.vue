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
import { fetchGiftRules, createGiftRule, updateGiftRule, deleteGiftRule, fetchProducts } from '../../api'

// ==================== Mock 数据 ====================
const giftRules = ref<any[]>([])

const giftProducts = ref<any[]>([])

// ==================== 列表 ====================
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const statusFilter = ref('')

async function loadData() {
  loading.value = true
  try {
    const data = await fetchGiftRules({ page: page.value, pageSize: pageSize.value, status: statusFilter.value || undefined })
    const rows = data?.list || data?.records || []
    list.value = rows.map((r: any) => ({
      id: r.id,
      ruleCode: r.rule_code || '',
      ruleName: r.rule_name || '',
      giftType: r.threshold_type === 'QUANTITY' ? 'QTY' : 'AMOUNT',
      productCount: r.product_count || 0,
      giftStock: r.gift_stock_limit || 0,
      giftedCount: r.gifted_count || 0,
      status: r.status || 'DRAFT',
      startTime: r.start_time || '',
      endTime: r.end_time || '',
      description: r.rule_desc || '',
      scopeType: r.applicable_scope || 'ALL',
      tiers: r.levels || []
    }))
    total.value = data?.total || 0
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载赠品规则失败')
    list.value = []
    total.value = 0
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
  try {
    await updateGiftRule(row.id, { status: newStatus })
    ElMessage.success(`已${text}`)
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '操作失败')
  }
}

async function handleDelete(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除规则 ${row.ruleName}？`, '确认删除', { type: 'warning' }).catch(() => null)
  if (!confirmed) return
  try {
    await deleteGiftRule(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
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
    const payload: Record<string, unknown> = {
      rule_name: form.ruleName,
      rule_desc: form.description,
      threshold_type: form.giftType === 'QTY' ? 'QUANTITY' : 'AMOUNT',
      threshold_amount: form.tiers[0]?.thresholdAmount || 0,
      start_time: form.timeRange[0] || '',
      end_time: form.timeRange[1] || '',
      applicable_scope: form.scopeType,
      gift_stock_limit: sortedTiers.value.reduce((sum, t) => sum + (t.stockQty || 0), 0),
      levels: sortedTiers.value.map((t, idx) => ({
        gift_product_id: t.giftProductId,
        gift_sku_id: t.giftProductId,
        gift_quantity: t.giftQty,
        sort_order: idx + 1
      }))
    }
    if (isEdit.value && editingId.value) {
      await updateGiftRule(editingId.value, payload)
      ElMessage.success('修改成功')
    } else {
      await createGiftRule(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    submitLoading.value = false
  }
}

// 初始化
loadData()
loadGiftProducts()

async function loadGiftProducts() {
  try {
    const data = await fetchProducts({ page: 1, pageSize: 50 })
    giftProducts.value = (data.records || data.list || []).map((p: any) => ({
      id: p.skuId || p.id,
      productName: p.name || p.skuName,
      skuCode: p.skuCode || p.barcode || '',
      stockQty: p.stock || 0,
      imageUrl: p.mainImage || ''
    }))
  } catch {
    giftProducts.value = []
  }
}
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
