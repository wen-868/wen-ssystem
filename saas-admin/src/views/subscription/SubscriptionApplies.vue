<template>
  <div class="subscription-apply-page">
    <div class="page-header">
      <h2>订阅申请审核</h2>
      <span class="page-tip">平台小程序提交的套餐订阅意向，PENDING 优先展示</span>
    </div>

    <el-card>
      <div class="filter-bar">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable @change="handleFilterChange">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-button :loading="loading" @click="loadData">刷新</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="申请编号" width="110" />
        <el-table-column prop="company" label="公司名称" min-width="180" />
        <el-table-column prop="planName" label="订阅套餐" min-width="130" />
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="mobile" label="手机号" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" width="170">
          <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button text size="small" @click="handleView(scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 详情 + 审核弹窗 -->
    <el-dialog v-model="detailVisible" title="订阅申请详情" width="560px" :close-on-click-modal="false">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请编号">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(detail.status)">{{ getStatusText(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="公司名称" :span="2">{{ detail.company }}</el-descriptions-item>
          <el-descriptions-item label="订阅套餐">{{ detail.planName }}</el-descriptions-item>
          <el-descriptions-item label="套餐ID">{{ detail.planId }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detail.contact }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail.mobile }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="申请时间" :span="2">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
          <template v-if="detail.status !== 'PENDING'">
            <el-descriptions-item label="审核意见" :span="2">{{ detail.auditRemark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间" :span="2">{{ formatDate(detail.auditedAt) }}</el-descriptions-item>
          </template>
        </el-descriptions>

        <div v-if="detail.status === 'PENDING'" class="audit-box">
          <div class="audit-title">审核处理</div>
          <el-input
            v-model="auditRemark"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
            placeholder="审核备注（选填，驳回时建议填写原因）"
          />
          <div class="audit-actions">
            <el-button type="danger" :loading="auditing" @click="handleAudit('REJECTED')">驳回</el-button>
            <el-button type="success" :loading="auditing" @click="handleAudit('APPROVED')">通过</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listSubscriptionApplies,
  auditSubscriptionApply,
  type SubscriptionApply
} from '../../api/subscription-apply'

const loading = ref(false)
const tableData = ref<SubscriptionApply[]>([])
const statusFilter = ref<'PENDING' | 'APPROVED' | 'REJECTED' | undefined>()

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const detailVisible = ref(false)
const detail = ref<SubscriptionApply | null>(null)
const auditRemark = ref('')
const auditing = ref(false)

async function loadData() {
  loading.value = true
  try {
    const res = await listSubscriptionApplies({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: statusFilter.value
    })
    tableData.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  pagination.page = 1
  loadData()
}

function handleSizeChange(val: number) {
  pagination.pageSize = val
  pagination.page = 1
  loadData()
}

function handlePageChange(val: number) {
  pagination.page = val
  loadData()
}

function handleView(row: SubscriptionApply) {
  detail.value = { ...row }
  auditRemark.value = ''
  detailVisible.value = true
}

async function handleAudit(action: 'APPROVED' | 'REJECTED') {
  if (!detail.value) return
  const tip = action === 'APPROVED' ? '通过' : '驳回'
  if (action === 'REJECTED' && !auditRemark.value.trim()) {
    ElMessage.warning('驳回时请填写审核备注')
    return
  }
  auditing.value = true
  try {
    const updated = await auditSubscriptionApply(detail.value.id, action, auditRemark.value.trim())
    ElMessage.success(`已${tip}`)
    detail.value = updated.data
    detailVisible.value = false
    loadData()
  } finally {
    auditing.value = false
  }
}

function getStatusText(status: string) {
  const map: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }
  return map[status] || status
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
  return map[status] || 'info'
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.subscription-apply-page { padding: 20px; }
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.page-tip { margin-left: 12px; font-size: 13px; color: #909399; }
.filter-bar { margin-bottom: 16px; display: flex; gap: 12px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.audit-box { margin-top: 20px; padding: 16px; background: #f5f7fa; border-radius: 6px; }
.audit-title { margin-bottom: 10px; font-weight: 600; }
.audit-actions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 12px; }
</style>
