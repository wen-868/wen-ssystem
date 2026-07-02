<template>
  <div>
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>租户详情</span>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <el-form v-if="form" :model="form" label-width="120px">
        <el-form-item label="租户名称">
          <el-input v-model="form.tenantName" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contactName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactMobile" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.contactEmail" />
        </el-form-item>
        <el-form-item label="状态">
          <el-tag :type="form.status === 'ACTIVE' ? 'success' : 'danger'">{{ form.status === 'ACTIVE' ? '启用' : '禁用' }}</el-tag>
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker v-model="form.expireAt" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="创建时间">
          <span>{{ form.createdAt }}</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getTenantApi, updateTenantApi } from '../../api/tenant'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const form = ref<any>(null)

async function fetchDetail() {
  loading.value = true
  try {
    const res: any = await getTenantApi(Number(route.params.id))
    form.value = res.data
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await updateTenantApi(Number(route.params.id), form.value)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

onMounted(fetchDetail)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>