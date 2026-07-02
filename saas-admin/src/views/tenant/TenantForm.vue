<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>新增租户</span>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="租户名称" prop="tenantName">
          <el-input v-model="form.tenantName" placeholder="请输入租户名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactName">
          <el-input v-model="form.contactName" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactMobile">
          <el-input v-model="form.contactMobile" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="邮箱" prop="contactEmail">
          <el-input v-model="form.contactEmail" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="管理员账号" prop="adminUsername">
          <el-input v-model="form.adminUsername" placeholder="请输入管理员账号" />
        </el-form-item>
        <el-form-item label="管理员密码" prop="adminPassword">
          <el-input v-model="form.adminPassword" type="password" show-password placeholder="请输入管理员密码" />
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker v-model="form.expireAt" type="date" value-format="YYYY-MM-DD" placeholder="选择到期时间" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleCreate">创建</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createTenantApi } from '../../api/tenant'

const router = useRouter()
const saving = ref(false)
const formRef = ref()

const form = reactive({
  tenantName: '',
  contactName: '',
  contactMobile: '',
  contactEmail: '',
  adminUsername: '',
  adminPassword: '',
  expireAt: '',
})

const rules = {
  tenantName: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactMobile: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  adminUsername: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  adminPassword: [{ required: true, message: '请输入管理员密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await createTenantApi(form)
    ElMessage.success('创建成功')
    router.push('/tenants')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>