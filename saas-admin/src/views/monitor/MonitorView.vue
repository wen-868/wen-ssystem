<template>
  <div class="monitor-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ data.uptime }}</div>
          <div class="stat-label">运行时长 (秒)</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ data.connections }}</div>
          <div class="stat-label">活跃连接数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ data.qps }}</div>
          <div class="stat-label">QPS</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ data.nodeVersion }}</div>
          <div class="stat-label">Node 版本</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <el-card header="内存使用">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="RSS">{{ data.memory?.rss }}</el-descriptions-item>
            <el-descriptions-item label="堆总量">{{ data.memory?.heapTotal }}</el-descriptions-item>
            <el-descriptions-item label="堆已用">{{ data.memory?.heapUsed }}</el-descriptions-item>
            <el-descriptions-item label="外部">{{ data.memory?.external }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card header="CPU 使用">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户态">{{ data.cpu?.user }}%</el-descriptions-item>
            <el-descriptions-item label="系统态">{{ data.cpu?.system }}%</el-descriptions-item>
            <el-descriptions-item label="平台">{{ data.platform }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="data.lastError" style="margin-top:20px" header="最近错误">
      <el-alert type="error" :closable="false" show-icon>
        {{ data.lastError }}
      </el-alert>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchMonitorData, type MonitorData } from '@/api/monitor'

const data = ref<MonitorData>({
  uptime: 0,
  connections: 0,
  qps: 0,
  memory: { rss: '0', heapTotal: '0', heapUsed: '0', external: '0' },
  cpu: { user: 0, system: 0 },
  nodeVersion: '',
  platform: '',
  lastError: null,
})

onMounted(async () => {
  try {
    const res = await fetchMonitorData()
    data.value = res.data
  } catch {
    ElMessage.error('获取监控数据失败')
  }
})
</script>

<style scoped>
.monitor-page { padding: 20px; }
.stat-card { text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #409eff; }
.stat-label { font-size: 14px; color: #909399; margin-top: 8px; }
</style>