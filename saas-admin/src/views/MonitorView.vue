<template>
  <div>
    <h2 style="margin-bottom: 24px;">监控告警</h2>

    <!-- 数据库状态 -->
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>数据库状态</span></template>
          <div v-loading="dbLoading">
            <el-statistic title="当前连接数" :value="dbStatus.connections" />
            <el-statistic title="慢查询数" :value="dbStatus.slowQueries" style="margin-top: 12px;" />
            <el-statistic title="运行时间" :value="dbStatus.uptime" :formatter="(v: number) => formatUptime(v)" style="margin-top: 12px;" />
            <el-statistic title="内存使用" :value="dbStatus.memoryUsage" :formatter="(v: number) => formatMemory(v)" style="margin-top: 12px;" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>API 统计</span></template>
          <div v-loading="apiLoading">
            <el-statistic title="QPS (次/秒)" :value="apiStats.qps" />
            <el-statistic title="平均响应时间 (ms)" :value="apiStats.avgResponseTime" style="margin-top: 12px;" />
            <el-statistic title="错误率 (%)" :value="apiStats.errorRate" style="margin-top: 12px;" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>系统信息</span></template>
          <div>
            <el-statistic title="在线租户数" :value="0" />
            <el-statistic title="今日活跃用户" :value="0" style="margin-top: 12px;" />
            <el-statistic title="待处理告警" :value="0" style="margin-top: 12px;" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 到期租户 -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>7天内到期租户</span>
          <el-button
            type="warning"
            :loading="notifying"
            :disabled="expiringTenants.length === 0"
            @click="notifyAll"
          >
            批量通知
          </el-button>
        </div>
      </template>
      <el-table :data="expiringTenants" v-loading="expiringLoading" border stripe style="width: 100%;">
        <el-table-column prop="tenantCode" label="租户编码" width="140" />
        <el-table-column prop="companyName" label="公司名称" min-width="180" />
        <el-table-column prop="expireAt" label="到期时间" width="180" />
        <el-table-column prop="daysRemaining" label="剩余天数" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.daysRemaining <= 3 ? 'danger' : row.daysRemaining <= 5 ? 'warning' : 'info'" size="small">
              {{ row.daysRemaining }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="notifyTenant(row)">发送通知</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="expiringTenants.length === 0 && !expiringLoading" description="暂无即将到期的租户" style="margin: 20px 0;" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'

const dbLoading = ref(false)
const apiLoading = ref(false)
const expiringLoading = ref(false)
const notifying = ref(false)

const dbStatus = reactive({
  connections: 0,
  slowQueries: 0,
  uptime: 0,
  memoryUsage: 0
})

const apiStats = reactive({
  qps: 0,
  avgResponseTime: 0,
  errorRate: '0.00'
})

const expiringTenants = ref<any[]>([])

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时 ${m}分钟`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb.toFixed(1) + ' MB'
}

async function fetchDbStatus() {
  dbLoading.value = true
  try {
    const res = await api.get('/admin/monitor/db-status')
    const data = res.data?.data || (res as any).data || res
    Object.assign(dbStatus, data)
  } catch { /* ignore */ }
  finally { dbLoading.value = false }
}

async function fetchApiStats() {
  apiLoading.value = true
  try {
    const res = await api.get('/admin/monitor/api-stats')
    const data = res.data?.data || (res as any).data || res
    Object.assign(apiStats, data)
  } catch { /* ignore */ }
  finally { apiLoading.value = false }
}

async function fetchExpiringTenants() {
  expiringLoading.value = true
  try {
    const res = await api.get('/admin/monitor/expiring-tenants')
    const data = res.data?.data || (res as any).data || res
    expiringTenants.value = Array.isArray(data) ? data : (data.records || [])
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载失败')
  } finally {
    expiringLoading.value = false
  }
}

async function notifyTenant(row: any) {
  try {
    await api.post('/admin/monitor/notify-expiring', { tenantIds: [row.id] })
    ElMessage.success(`已向 ${row.companyName} 发送通知`)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '发送失败')
  }
}

async function notifyAll() {
  notifying.value = true
  try {
    const ids = expiringTenants.value.map(t => t.id)
    await api.post('/admin/monitor/notify-expiring', { tenantIds: ids })
    ElMessage.success(`已向 ${ids.length} 个租户发送通知`)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '发送失败')
  } finally {
    notifying.value = false
  }
}

onMounted(() => {
  fetchDbStatus()
  fetchApiStats()
  fetchExpiringTenants()
})
</script>