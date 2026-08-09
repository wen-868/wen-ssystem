<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">订单路由</h2>
      <p class="page-desc">订单路由规则与日志</p>
    </div>
  </div>
<el-tabs v-model="activeTab" type="border-card">
      <!-- Tab 1: 路由规则管理 -->
      <el-tab-pane label="路由规则管理" name="rules">
        <!-- 分发看板 -->
        <el-row :gutter="16" class="board-row">
          <el-col :span="8" v-for="store in storeLoad" :key="store.storeName">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>{{ store.storeName }}</span>
                  <el-tag :type="store.loadRate > 60 ? 'danger' : store.loadRate > 40 ? 'warning' : 'success'" size="small">
                    {{ store.loadRate > 60 ? '高负载' : store.loadRate > 40 ? '正常' : '空闲' }}
                  </el-tag>
                </div>
              </template>
              <div class="store-load-info">
                <div class="load-item">
                  <span>当前订单量</span>
                  <strong>{{ store.orderCount }}</strong>
                </div>
                <div class="load-item">
                  <span>接单能力</span>
                  <strong>{{ store.capacity }}</strong>
                </div>
              </div>
              <el-progress :percentage="store.loadRate" :stroke-width="12" :color="store.loadRate > 60 ? 'var(--color-danger)' : store.loadRate > 40 ? 'var(--color-warning)' : 'var(--color-success)'" />
            </el-card>
          </el-col>
        </el-row>

        <!-- 操作栏 -->
        <div class="filter-bar">
          <el-button type="primary" @click="openRuleDialog()">新增规则</el-button>
          <el-button @click="handleRefreshRules">刷新</el-button>
        </div>

        <!-- 规则表格 -->
        <div class="table-card">
<el-table :data="routingRules" stripe border style="width: 100%">
          <el-table-column prop="ruleName" label="规则名称" width="140" />
          <el-table-column label="适用渠道" width="120">
            <template #default="{ row }">
              <el-tag :color="channelColors[row.channelType] || 'var(--color-primary)'" style="color: #fff; border: none" size="small">
                {{ channelNames[row.channelType] || row.channelType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="storeName" label="适用门店" width="120" />
          <el-table-column prop="priority" label="优先级" width="80" align="center" />
          <el-table-column prop="conditionSummary" label="条件摘要" min-width="180" show-overflow-tooltip />
          <el-table-column label="启用状态" width="100" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.isEnabled" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openRuleDialog(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
</div>
      </el-tab-pane>

      <!-- Tab 2: 分发日志 -->
      <el-tab-pane label="分发日志" name="logs">
        <!-- 筛选栏 -->
        <el-card shadow="never" class="filter-card">
          <el-row :gutter="12" align="middle">
            <el-col :span="4">
              <el-select v-model="logFilterStatus" placeholder="分发状态" clearable style="width: 100%">
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
                <el-option label="待处理" value="PENDING" />
              </el-select>
            </el-col>
            <el-col :span="5">
              <el-date-picker
                v-model="logFilterDate"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-col>
            <el-col :span="4">
              <el-input v-model="logFilterKeyword" placeholder="搜索订单号" clearable style="width: 100%" />
            </el-col>
            <el-col :span="3">
              <el-button type="primary" @click="handleLogFilter">查询</el-button>
            </el-col>
          </el-row>
        </el-card>

        <!-- 日志表格 -->
        <div class="table-card">
<el-table :data="filteredDispatchLogs" stripe border style="width: 100%">
          <el-table-column prop="channelOrderNo" label="订单号" width="150" />
          <el-table-column label="渠道" width="80">
            <template #default="{ row }">
              <el-tag :color="channelColors[row.channelType] || 'var(--color-primary)'" style="color: #fff; border: none" size="small">
                {{ channelNames[row.channelType] || row.channelType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ruleName" label="触发规则" width="120" />
          <el-table-column prop="fromStoreName" label="来源门店" width="100" />
          <el-table-column prop="toStoreName" label="目标门店" width="100" />
          <el-table-column label="分发状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.dispatchStatus === 'SUCCESS' ? 'success' : row.dispatchStatus === 'FAILED' ? 'danger' : 'warning'" size="small">
                {{ row.dispatchStatus === 'SUCCESS' ? '成功' : row.dispatchStatus === 'FAILED' ? '失败' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="dispatchReason" label="分发原因" min-width="150" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="分发时间" width="160" />
        </el-table>
</div>
        <el-pagination
          style="margin-top: 16px; justify-content: flex-end"
          background
          layout="total, prev, pager, next"
          :total="filteredDispatchLogs.length"
          v-model:current-page="logPage"
          :page-size="10"
          :pager-count="5"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑规则弹窗 -->
    <el-dialog v-model="ruleDialogVisible" :title="isEditRule ? '编辑路由规则' : '新增路由规则'" width="900px" destroy-on-close>
      <el-form ref="formRef" :model="ruleForm" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="ruleForm.ruleName" placeholder="请输入规则名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-input-number v-model="ruleForm.priority" :min="1" :max="100" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="渠道">
              <el-select v-model="ruleForm.channelTypes" multiple placeholder="选择渠道" style="width: 100%">
                <el-option v-for="ch in ruleChannelOptions" :key="ch.value" :label="ch.label" :value="ch.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用门店">
              <el-select v-model="ruleForm.storeName" placeholder="选择门店" style="width: 100%">
                <el-option v-for="s in storeOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="条件配置">
          <el-card shadow="never" class="condition-card">
            <el-row :gutter="16" style="margin-bottom: 12px">
              <el-col :span="12">
                <div class="condition-label">区域选择</div>
                <el-cascader
                  v-model="ruleForm.region"
                  :options="regionOptions"
                  placeholder="选择区域"
                  style="width: 100%"
                  clearable
                />
              </el-col>
              <el-col :span="12">
                <div class="condition-label">金额范围</div>
                <el-slider
                  v-model="ruleForm.amountRange"
                  range
                  :min="0"
                  :max="1000"
                  :marks="{ 0: '¥0', 500: '¥500', 1000: '¥1000' }"
                />
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <div class="condition-label">商品类别</div>
                <el-tree-select
                  v-model="ruleForm.productCategories"
                  :data="categoryOptions"
                  multiple
                  placeholder="选择商品类别"
                  style="width: 100%"
                  clearable
                  check-strictly
                />
              </el-col>
              <el-col :span="12">
                <div class="condition-label">时间段</div>
                <el-time-picker
                  v-model="ruleForm.timeRange"
                  is-range
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                  value-format="HH:mm:ss"
                  style="width: 100%"
                />
              </el-col>
            </el-row>
          </el-card>
        </el-form-item>
        <el-form-item label="动作配置">
          <el-card shadow="never" class="condition-card">
            <el-row :gutter="16">
              <el-col :span="12">
                <div class="condition-label">动作类型</div>
                <el-select v-model="ruleForm.actionType" placeholder="选择动作" style="width: 100%">
                  <el-option label="分配门店" value="ASSIGN_STORE" />
                  <el-option label="分配仓库" value="ASSIGN_WAREHOUSE" />
                  <el-option label="拆分规则" value="SPLIT" />
                </el-select>
              </el-col>
              <el-col :span="12">
                <div class="condition-label" v-if="ruleForm.actionType === 'ASSIGN_STORE'">目标门店</div>
                <div class="condition-label" v-else-if="ruleForm.actionType === 'ASSIGN_WAREHOUSE'">目标仓库</div>
                <div class="condition-label" v-else>拆分配置</div>
                <el-select v-if="ruleForm.actionType === 'ASSIGN_STORE'" v-model="ruleForm.targetStore" placeholder="选择门店" style="width: 100%">
                  <el-option v-for="s in storeOptions" :key="s" :label="s" :value="s" />
                </el-select>
                <el-select v-else-if="ruleForm.actionType === 'ASSIGN_WAREHOUSE'" v-model="ruleForm.targetWarehouse" placeholder="选择仓库" style="width: 100%">
                  <el-option v-for="w in warehouseOptions" :key="w" :label="w" :value="w" />
                </el-select>
                <el-input v-else v-model="ruleForm.splitConfig" placeholder="拆分规则配置" />
              </el-col>
            </el-row>
          </el-card>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="ruleForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRule">保存</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchRoutingRules, createRoutingRule, updateRoutingRule, deleteRoutingRule, fetchStoreLoad } from '../../api'

// ─── Mock 数据 ───
const channelNames: Record<string, string> = { WECHAT: '微信', DOUYIN: '抖音', MEITUAN: '美团', ELEME: '饿了么', JD: '京东', OFFLINE: '线下' }
const channelColors: Record<string, string> = { WECHAT: 'var(--color-success)', DOUYIN: 'var(--text-primary)', MEITUAN: 'var(--color-warning)', ELEME: 'var(--color-primary)', JD: 'var(--color-danger)', OFFLINE: 'var(--gray-500)' }

const routingRules = ref<any[]>([])

const dispatchLogs = ref<any[]>([])

const storeLoad = ref<any[]>([])

// ─── Tab 状态 ───
const activeTab = ref('rules')

// ─── 规则管理 ───
const ruleChannelOptions = [
  { label: '微信', value: 'WECHAT' },
  { label: '抖音', value: 'DOUYIN' },
  { label: '美团', value: 'MEITUAN' },
  { label: '饿了么', value: 'ELEME' },
  { label: '京东', value: 'JD' }
]

const storeOptions = ['门店1', '门店2', '门店3', '门店4', '门店5']
const warehouseOptions = ['总仓', '分仓A', '分仓B', '分仓C']

const regionOptions = [
  { label: '北京市', value: 'beijing', children: [
    { label: '朝阳区', value: 'chaoyang' },
    { label: '海淀区', value: 'haidian' },
    { label: '丰台区', value: 'fengtai' }
  ]},
  { label: '上海市', value: 'shanghai', children: [
    { label: '浦东新区', value: 'pudong' },
    { label: '徐汇区', value: 'xuhui' }
  ]}
]

const categoryOptions = [
  { label: '饮料', value: 'drink', children: [
    { label: '奶茶', value: 'milktea' },
    { label: '果汁', value: 'juice' }
  ]},
  { label: '食品', value: 'food', children: [
    { label: '主食', value: 'staple' },
    { label: '小吃', value: 'snack' }
  ]}
]

const ruleDialogVisible = ref(false)
const isEditRule = ref(false)
const editingRuleId = ref<number | null>(null)
const formRef = ref()
const rules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }]
}

const ruleForm = ref({
  ruleName: '',
  channelTypes: [] as string[],
  storeName: '',
  priority: 1,
  region: [] as string[],
  amountRange: [100, 500] as [number, number],
  productCategories: [] as string[],
  timeRange: [] as string[],
  actionType: 'ASSIGN_STORE',
  targetStore: '',
  targetWarehouse: '',
  splitConfig: '',
  isEnabled: true
})

function resetRuleForm() {
  ruleForm.value = {
    ruleName: '',
    channelTypes: [],
    storeName: '',
    priority: 1,
    region: [],
    amountRange: [100, 500],
    productCategories: [],
    timeRange: [],
    actionType: 'ASSIGN_STORE',
    targetStore: '',
    targetWarehouse: '',
    splitConfig: '',
    isEnabled: true
  }
}

function openRuleDialog(row?: any) {
  if (row) {
    isEditRule.value = true
    editingRuleId.value = row.id
    ruleForm.value = {
      ruleName: row.ruleName,
      channelTypes: [row.channelType],
      storeName: row.storeName,
      priority: row.priority,
      region: [],
      amountRange: [100, 500],
      productCategories: [],
      timeRange: [],
      actionType: row.actionType || 'ASSIGN_STORE',
      targetStore: row.storeName,
      targetWarehouse: '',
      splitConfig: '',
      isEnabled: row.isEnabled
    }
  } else {
    isEditRule.value = false
    editingRuleId.value = null
    resetRuleForm()
  }
  ruleDialogVisible.value = true
}

async function handleSaveRule() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  if (!ruleForm.value.ruleName) {
    ElMessage.warning('请输入规则名称')
    return
  }
  const channelType = ruleForm.value.channelTypes[0] || 'WECHAT'
  const payload = {
    ruleName: ruleForm.value.ruleName,
    channelType,
    storeName: ruleForm.value.storeName,
    priority: ruleForm.value.priority,
    conditionSummary: `区域: ${ruleForm.value.region.join('/') || '-'}, 金额: ${ruleForm.value.amountRange[0]}-${ruleForm.value.amountRange[1]}`,
    actionType: ruleForm.value.actionType,
    isEnabled: ruleForm.value.isEnabled
  }
  try {
    if (isEditRule.value && editingRuleId.value) {
      await updateRoutingRule(editingRuleId.value, payload)
      ElMessage.success('规则更新成功')
    } else {
      await createRoutingRule(payload)
      ElMessage.success('规则创建成功')
    }
    ruleDialogVisible.value = false
    await loadRules()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  }
}

async function handleDeleteRule(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除规则「${row.ruleName}」吗？`, '提示', { type: 'warning' })
    await deleteRoutingRule(row.id)
    ElMessage.success('删除成功')
    await loadRules()
  } catch {}
}

async function handleRefreshRules() {
  await loadRules()
  ElMessage.success('刷新完成')
}

// ─── 分发日志 ───
const logFilterStatus = ref('')
const logFilterDate = ref<string[]>([])
const logFilterKeyword = ref('')
const logPage = ref(1)

const filteredDispatchLogs = computed(() => {
  let list = dispatchLogs.value
  if (logFilterStatus.value) {
    list = list.filter(l => l.dispatchStatus === logFilterStatus.value)
  }
  if (logFilterKeyword.value) {
    const kw = logFilterKeyword.value.toLowerCase()
    list = list.filter(l => l.channelOrderNo.toLowerCase().includes(kw))
  }
  return list
})

function handleLogFilter() {
  logPage.value = 1
  ElMessage.success('筛选完成')
}

async function loadRules() {
  try {
    const data = await fetchRoutingRules({ page: 1, pageSize: 100 })
    routingRules.value = data?.records || []
  } catch (e: any) {
    ElMessage.warning(e?.response?.data?.msg || '加载路由规则失败')
  }
}

async function loadStoreLoad() {
  try {
    storeLoad.value = (await fetchStoreLoad()) || []
  } catch {}
}

onMounted(() => {
  loadRules()
  loadStoreLoad()
})
</script>

<style scoped>
.page {
  padding: 20px;
}

.board-row {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.store-load-info {
  display: flex;
  justify-content: space-around;
  margin-bottom: 12px;
}

.load-item {
  text-align: center;
}

.load-item span {
  display: block;
  font-size: 12px;
  color: var(--gray-400);
  margin-bottom: 4px;
}

.load-item strong {
  font-size: 20px;
  color: var(--gray-700);
}

.toolbar {
  margin-bottom: 16px;
}

.filter-card {
  margin-bottom: 16px;
}

.condition-card {
  background: var(--gray-50);
}

.condition-label {
  font-size: 13px;
  color: var(--gray-600);
  margin-bottom: 6px;
  font-weight: 500;
}
</style>
