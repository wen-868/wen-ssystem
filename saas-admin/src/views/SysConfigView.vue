<template>
  <div>
    <h2 style="margin-bottom: 24px;">系统配置</h2>

    <el-card style="margin-bottom: 16px;">
      <template #header>
        <span>系统配置项</span>
      </template>
      <el-table :data="configList" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="configKey" label="配置键" width="200" />
        <el-table-column prop="configValue" label="配置值" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.configValue === 'true'" type="success">是</el-tag>
            <el-tag v-else-if="row.configValue === 'false'" type="info">否</el-tag>
            <span v-else>{{ row.configValue }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editConfig(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="configList.length === 0 && !loading" description="暂无配置项" style="margin: 20px 0;" />
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑配置" width="480px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="100px" v-if="editForm">
        <el-form-item label="配置键">
          <el-input :model-value="editForm.configKey" disabled />
        </el-form-item>
        <el-form-item label="配置值" required>
          <el-input v-model="editForm.configValue" :placeholder="editForm.description" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input :model-value="editForm.description" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'

interface ConfigItem {
  configKey: string
  configValue: string
  description: string
}

const loading = ref(false)
const saving = ref(false)
const configList = ref<ConfigItem[]>([])
const dialogVisible = ref(false)
const editForm = ref<ConfigItem | null>(null)

async function fetchConfigs() {
  loading.value = true
  try {
    const res = await api.get('/admin/sys-config')
    const data = res.data?.data || (res as any).data || res
    configList.value = Array.isArray(data) ? data : (data.records || [])
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function editConfig(row: ConfigItem) {
  editForm.value = { ...row }
  dialogVisible.value = true
}

async function saveConfig() {
  if (!editForm.value) return
  saving.value = true
  try {
    await api.put('/admin/sys-config', { configs: [editForm.value] })
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchConfigs()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fetchConfigs)
</script>