<template>
  <div>
    <h2 style="margin-bottom: 24px;">API 密钥管理</h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center;">
        <el-button type="success" @click="showCreateDialog">创建密钥</el-button>
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="appName" label="应用名称" width="160" />
        <el-table-column label="API Key" width="280">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 13px;">{{ row.apiKey }}</span>
          </template>
        </el-table-column>
        <el-table-column label="IP 白名单" width="160">
          <template #default="{ row }">
            <span>{{ row.allowedIps || '不限制' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="日限额" width="90" align="center">
          <template #default="{ row }">
            <span>{{ row.dailyLimit || '不限' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="今日调用" width="90" align="center">
          <template #default="{ row }">
            <span>{{ row.todayCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '已吊销' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleStats(row)">统计</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleRevoke(row)">吊销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建对话框 -->
    <el-dialog v-model="dialogVisible" title="创建 API 密钥" width="540px" :close-on-click-modal="false">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="应用名称" prop="appName">
          <el-input v-model="form.appName" placeholder="如 商品数据同步系统" maxlength="50" />
        </el-form-item>
        <el-form-item label="IP 白名单" prop="allowedIps">
          <el-input
            v-model="form.allowedIps"
            type="textarea"
            :rows="3"
            placeholder="每行一个 IP，留空表示不限制。支持通配符如 192.168.*"
          />
        </el-form-item>
        <el-form-item label="日限额" prop="dailyLimit">
          <el-input-number v-model="form.dailyLimit" :min="0" :max="100000" />
          <span style="margin-left: 8px; color: #909399; font-size: 13px;">0 表示不限</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="用途说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑密钥" width="540px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="应用名称">
          <el-input :model-value="editForm.appName" disabled />
        </el-form-item>
        <el-form-item label="IP 白名单">
          <el-input v-model="editForm.allowedIps" type="textarea" :rows="3" placeholder="每行一个 IP" />
        </el-form-item>
        <el-form-item label="日限额">
          <el-input-number v-model="editForm.dailyLimit" :min="0" :max="100000" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleUpdate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 统计对话框 -->
    <el-dialog v-model="statsVisible" title="调用统计" width="540px">
      <div v-if="currentStats" style="padding: 10px 0;">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="应用名称">{{ currentStats.appName }}</el-descriptions-item>
          <el-descriptions-item label="API Key">{{ currentStats.apiKey }}</el-descriptions-item>
          <el-descriptions-item label="今日调用">{{ currentStats.todayCount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="日限额">{{ currentStats.dailyLimit || '不限' }}</el-descriptions-item>
          <el-descriptions-item label="总调用次数">{{ currentStats.totalCount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="最后使用">{{ formatTime(currentStats.lastUsedAt) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 密钥创建成功提示 -->
    <el-dialog v-model="secretVisible" title="密钥创建成功" width="540px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px;">
        请立即保存以下密钥信息，API Secret 仅显示一次，关闭后将无法再次查看。
      </el-alert>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="API Key">
          <span style="font-family: monospace;">{{ createdKey?.apiKey }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="API Secret">
          <span style="font-family: monospace; color: #e6a23c;">{{ createdKey?.apiSecret }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="secretVisible = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listApiKeysApi, createApiKeyApi, updateApiKeyApi, deleteApiKeyApi, getApiKeyStatsApi,
} from '../../api/library'

const loading = ref(false)
const list = ref<any[]>([])

const dialogVisible = ref(false)
const editVisible = ref(false)
const statsVisible = ref(false)
const secretVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()

const createdKey = ref<{ apiKey: string; apiSecret: string } | null>(null)
const currentStats = ref<any>(null)

const form = reactive({
  appName: '',
  allowedIps: '',
  dailyLimit: 1000,
  remark: '',
})

const editForm = reactive({
  id: 0,
  appName: '',
  allowedIps: '',
  dailyLimit: 1000,
  status: 1,
  remark: '',
})

const rules: FormRules = {
  appName: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
}

function formatTime(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').substring(0, 19)
}

async function fetchList() {
  loading.value = true
  try {
    const res = await listApiKeysApi()
    const data = (res as any).data || res
    list.value = Array.isArray(data) ? data : (data.records || [])
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function showCreateDialog() {
  Object.assign(form, { appName: '', allowedIps: '', dailyLimit: 1000, remark: '' })
  dialogVisible.value = true
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const res = await createApiKeyApi({ ...form })
    const data = (res as any).data || res
    createdKey.value = { apiKey: data.apiKey, apiSecret: data.apiSecret }
    dialogVisible.value = false
    secretVisible.value = true
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    saving.value = false
  }
}

function handleEdit(row: any) {
  Object.assign(editForm, {
    id: row.id,
    appName: row.appName,
    allowedIps: row.allowedIps || '',
    dailyLimit: row.dailyLimit || 0,
    status: row.status,
    remark: row.remark || '',
  })
  editVisible.value = true
}

async function handleUpdate() {
  saving.value = true
  try {
    await updateApiKeyApi(editForm.id, {
      allowedIps: editForm.allowedIps,
      dailyLimit: editForm.dailyLimit,
      status: editForm.status,
      remark: editForm.remark,
    })
    ElMessage.success('更新成功')
    editVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  } finally {
    saving.value = false
  }
}

async function handleStats(row: any) {
  try {
    const res = await getApiKeyStatsApi(row.id)
    currentStats.value = (res as any).data || res
    if (!currentStats.value.appName) currentStats.value.appName = row.appName
    if (!currentStats.value.apiKey) currentStats.value.apiKey = row.apiKey
    statsVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '获取统计失败')
  }
}

async function handleRevoke(row: any) {
  try {
    await ElMessageBox.confirm('确定要吊销该密钥吗？吊销后使用该密钥的请求将被拒绝。', '确认吊销', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteApiKeyApi(row.id)
    ElMessage.success('已吊销')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

onMounted(() => {
  fetchList()
})
</script>
