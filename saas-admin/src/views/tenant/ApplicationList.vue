<template>
  <div class="application-list">
    <div class="page-header">
      <h2>租户注册审核</h2>
    </div>

    <el-card>
      <div class="filter-bar">
        <el-select v-model="statusFilter" placeholder="全部状态" clearable @change="handleFilterChange">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
      </div>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="申请编号" width="120" />
        <el-table-column prop="company_name" label="公司名称" min-width="180" />
        <el-table-column prop="contact_person" label="联系人" width="100" />
        <el-table-column prop="contact_mobile" label="手机号" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="申请时间" width="170">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { listApplications, type TenantApplication } from '../../api/tenant-application'

const router = useRouter()
const loading = ref(false)
const tableData = ref<TenantApplication[]>([])
const statusFilter = ref<'PENDING' | 'APPROVED' | 'REJECTED' | undefined>()

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

async function loadData() {
  loading.value = true
  try {
    const res = await listApplications({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: statusFilter.value
    })
    tableData.value = res.data?.items || []
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

function handleView(row: TenantApplication) {
  router.push(`/applications/${row.id}`)
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回'
  }
  return map[status] || status
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger'
  }
  return map[status] || 'info'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.application-list { padding: 20px; }
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.filter-bar { margin-bottom: 16px; display: flex; gap: 12px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
