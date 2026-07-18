<template>
  <div>
    <h2 style="margin-bottom: 24px;">监控告警</h2>

    <!-- 数据库状态 -->
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>数据库状态</span></template>
          <div v-loading="dbLoading">
            <el-statistic title="数据库">
              <template #default>
                <el-tag :type="connectionTag(dbStatus.connection)" size="small">{{ dbStatus.database || '-' }}</el-tag>
              </template>
            </el-statistic>
            <el-statistic title="连接状态" style="margin-top: 12px;">
              <template #default>
                <el-tag :type="connectionTag(dbStatus.connection)" size="small">{{ connectionLabel(dbStatus.connection) }}</el-tag>
              </template>
            </el-statistic>
            <el-statistic title="数据表数量" :value="dbStatus.tableCount" style="margin-top: 12px;" />
            <el-statistic title="运行时间" :value="dbStatus.uptime" :formatter="(v: number) => formatUptime(v)" style="margin-top: 12px;" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>API 统计</span></template>
          <div v-loading="apiLoading">
            <el-statistic title="总请求数" :value="apiStats.totalRequests" />
            <el-statistic title="平均响应时间 (ms)" :value="apiStats.avgResponseTime" style="margin-top: 12px;" />
            <el-statistic title="今日错误数" :value="apiStats.todayErrorCount" style="margin-top: 12px;" />
            <el-statistic title="累计错误数" :value="apiStats.errorCount" style="margin-top: 12px;" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>系统信息</span></template>
          <div>
            <el-statistic title="HTTP 状态码分布" style="margin-bottom: 8px;">
              <template #default>
                <div v-if="apiStats.statusCodes && Object.keys(apiStats.statusCodes).length > 0" style="font-size: 13px;">
                  <span v-for="(count, code) in apiStats.statusCodes" :key="code" style="margin-right: 12px;">
                    <el-tag :type="statusCodeTag(String(code))" size="small" effect="plain">{{ code }}: {{ count }}</el-tag>
                  </span>
                </div>
                <span v-else style="color: #909399;">暂无数据</span>
              </template>
            </el-statistic>
            <el-statistic title="周错误趋势" style="margin-top: 12px;">
              <template #default>
                <div v-if="apiStats.weeklyErrorTrend && apiStats.weeklyErrorTrend.length > 0" style="font-size: 13px;">
                  <span v-for="(item, idx) in apiStats.weeklyErrorTrend" :key="idx" style="margin-right: 8px;">
                    <el-tag :type="item.count > 0 ? 'danger' : 'success'" size="small" effect="plain">{{ item.date }}: {{ item.count }}</el-tag>
                  </span>
                </div>
                <span v-else style="color: #909399;">暂无数据</span>
              </template>
            </el-statistic>
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
        <el-table-column prop="daysLeft" label="剩余天数" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.daysLeft <= 3 ? 'danger' : row.daysLeft <= 5 ? 'warning' : 'info'" size="small">
              {{ row.daysLeft }} 天
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
  connection: '',
  database: '',
  tableCount: 0,
  uptime: 0
})

const apiStats = reactive({
  totalRequests: 0,
  avgResponseTime: 0,
  errorCount: 0,
  todayErrorCount: 0,
  statusCodes: {} as Record<string, number>,
  weeklyErrorTrend: [] as { date: string; count: number }[]
})

const expiringTenants = ref<any[]>([])

function connectionTag(status: string): string {
  const map: Record<string, string> = {
    connected: 'success',
    disconnected: 'warning',
    error: 'danger'
  }
  return map[status] || 'info'
}

function connectionLabel(status: string): string {
  const map: Record<string, string> = {
    connected: '已连接',
    disconnected: '已断开',
    error: '连接异常'
  }
  return map[status] || status || '-'
}

function statusCodeTag(code: string): string {
  const num = Number(code)
  if (num >= 200 && num < 300) return 'success'
  if (num >= 300 && num < 400) return 'info'
  if (num >= 400 && num < 500) return 'warning'
  return 'danger'
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时 ${m}分钟`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

async function fetchDbStatus() {
  dbLoading.value = true
  try {
    const res = await api.get('/platform/monitor/db-status')
    const data = res.data?.data || (res as any).data || res
    Object.assign(dbStatus, data)
  } catch { /* ignore */ }
  finally { dbLoading.value = false }
}

async function fetchApiStats() {
  apiLoading.value = true
  try {
    const res = await api.get('/platform/monitor/api-stats')
    const data = res.data?.data || (res as any).data || res
    Object.assign(apiStats, data)
  } catch { /* ignore */ }
  finally { apiLoading.value = false }
}

async function fetchExpiringTenants() {
  expiringLoading.value = true
  try {
    const res = await api.get('/platform/monitor/expiring-tenants')
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
    await api.post('/platform/monitor/notify-expiring', { tenantIds: [row.id] })
    ElMessage.success(`已向 ${row.companyName} 发送通知`)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '发送失败')
  }
}

async function notifyAll() {
  notifying.value = true
  try {
    const ids = expiringTenants.value.map(t => t.id)
    await api.post('/platform/monitor/notify-expiring', { tenantIds: ids })
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