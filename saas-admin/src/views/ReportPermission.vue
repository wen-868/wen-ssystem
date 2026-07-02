<template>
  <div>
    <h2 style="margin-bottom: 24px;">权限矩阵</h2>

    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>报表权限矩阵（角色 × 报表）</span>
          <el-button type="primary" :loading="saving" @click="savePermissions">保存</el-button>
        </div>
      </template>

      <el-table :data="gridRows" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="roleName" label="角色" width="140" fixed="left" />
        <el-table-column v-for="rc in REPORT_CODES" :key="rc.code" :label="rc.name" min-width="140" align="center">
          <template #default="{ row }">
            <el-select
              :model-value="getAccessLevel(row.roleName, rc.code)"
              @update:model-value="(val: string) => setAccessLevel(row.roleName, rc.code, val)"
              size="small"
              style="width: 110px;"
            >
              <el-option v-for="al in ACCESS_LEVELS" :key="al.value" :label="al.label" :value="al.value" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="gridRows.length === 0 && !loading" description="暂无角色数据，请先创建角色" style="margin: 20px 0;" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'

interface PermissionItem {
  id?: number
  roleId: number
  roleName: string
  reportCode: string
  reportName: string
  accessLevel: string
}

const REPORT_CODES = [
  { code: 'SALES_REPORT', name: '销售报表' },
  { code: 'INVENTORY_REPORT', name: '库存报表' },
  { code: 'FINANCE_REPORT', name: '财务报表' },
  { code: 'CUSTOMER_REPORT', name: '客户报表' },
  { code: 'EMPLOYEE_REPORT', name: '员工报表' },
  { code: 'PRODUCT_REPORT', name: '商品报表' },
  { code: 'STORE_REPORT', name: '门店报表' }
]

const ACCESS_LEVELS = [
  { value: 'SELF', label: '仅自己' },
  { value: 'CHILDREN', label: '下级' },
  { value: 'ALL', label: '全部' }
]

const loading = ref(false)
const saving = ref(false)
const permissions = ref<PermissionItem[]>([])
const grid = ref<Record<string, Record<string, string>>>({})
const roleNames = ref<string[]>([])

const gridRows = computed(() => {
  return roleNames.value.map(name => ({
    roleName: name
  }))
})

async function loadPermissions() {
  loading.value = true
  try {
    const res = await api.get('/admin/report-permissions')
    const data = res.data?.data || (res as any).data || res
    permissions.value = Array.isArray(data) ? data : (data.records || [])

    const g: Record<string, Record<string, string>> = {}
    const rnSet = new Set<string>()
    permissions.value.forEach(p => {
      rnSet.add(p.roleName)
      if (!g[p.roleName]) g[p.roleName] = {}
      g[p.roleName][p.reportCode] = p.accessLevel
    })

    // 补充角色列表（从 /admin/roles 获取所有角色）
    try {
      const roleRes = await api.get('/admin/roles')
      const roles = roleRes.data?.data || (roleRes as any).data || []
      const roleList = Array.isArray(roles) ? roles : (roles.records || [])
      roleList.forEach((r: any) => {
        const name = r.roleName || r.name
        if (name && !rnSet.has(name)) {
          rnSet.add(name)
          if (!g[name]) g[name] = {}
        }
      })
    } catch { /* ignore */ }

    grid.value = g
    roleNames.value = Array.from(rnSet).sort()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function savePermissions() {
  saving.value = true
  try {
    const list: any[] = []
    const roleMap: Record<string, number> = {}

    try {
      const roleRes = await api.get('/admin/roles')
      const roles = roleRes.data?.data || (roleRes as any).data || []
      const roleList = Array.isArray(roles) ? roles : (roles.records || [])
      roleList.forEach((r: any) => { roleMap[r.roleName || r.name] = r.id })
    } catch { /* ignore */ }

    for (const roleName of Object.keys(grid.value)) {
      const roleId = roleMap[roleName] || 0
      for (const reportCode of Object.keys(grid.value[roleName])) {
        list.push({
          roleId,
          reportCode,
          reportName: REPORT_CODES.find(r => r.code === reportCode)?.name || reportCode,
          accessLevel: grid.value[roleName][reportCode] || 'SELF'
        })
      }
    }
    await api.put('/admin/report-permissions', { permissions: list })
    ElMessage.success('保存成功')
    loadPermissions()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function getAccessLevel(roleName: string, reportCode: string): string {
  return grid.value[roleName]?.[reportCode] || 'SELF'
}

function setAccessLevel(roleName: string, reportCode: string, level: string) {
  if (!grid.value[roleName]) grid.value[roleName] = {}
  grid.value[roleName][reportCode] = level
}

onMounted(loadPermissions)
</script>