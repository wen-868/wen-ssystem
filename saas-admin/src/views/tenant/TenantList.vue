<template>
  <div>
    <el-card>
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索租户名称" clearable style="width: 240px" @clear="fetchList" @keyup.enter="fetchList" />
        <el-button type="primary" @click="$router.push('/tenants/create')">新增租户</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="tenantName" label="租户名称" min-width="160" />
        <el-table-column prop="contactName" label="联系人" width="120" />
        <el-table-column prop="contactMobile" label="联系电话" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'">{{ row.status === 'ACTIVE' ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="$router.push(`/tenants/${row.id}`)">详情</el-button>
            <el-button text :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="handleToggle(row)">
              {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchList"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listTenantsApi, toggleTenantApi } from '../../api/tenant'

const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listTenantsApi({ page: page.value, pageSize: pageSize.value, keyword: keyword.value })
    list.value = res.data?.records || res.data?.list || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

async function handleToggle(row: any) {
  const newStatus = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  const action = newStatus === 'ACTIVE' ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定${action}该租户？`, '提示')
    await toggleTenantApi(row.id, newStatus)
    ElMessage.success(`${action}成功`)
    fetchList()
  } catch { /* cancelled */ }
}

onMounted(fetchList)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; margin-bottom: 16px; }
</style>