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
        <el-form-item label="到期时间">
          <el-date-picker v-model="form.expireAt" type="date" value-format="YYYY-MM-DD" placeholder="选择到期时间" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleCreate">创建</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 一次性初始口令交付（MS-SECURITY-BASELINE-01F1）：
         后端随机生成的 adminInitialPassword 仅在创建响应里返回一次，
         操作者点"我已妥善保存"确认前对话框不可被关闭/跳过，确认后才允许离开 -->
    <el-dialog
      v-model="initialPasswordVisible"
      title="请保存租户管理员初始口令"
      width="460px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <el-alert type="warning" :closable="false" title="该初始口令仅展示这一次，确认保存后无法再次查看" />
      <div class="initial-password-row">
        <span class="initial-password-value">{{ initialPasswordValue }}</span>
        <el-button size="small" @click="copyInitialPassword">复制</el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="confirmInitialPasswordDelivered">我已妥善保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createTenantApi, extractInitialPassword } from '../../api/tenant'

const router = useRouter()
const saving = ref(false)
const formRef = ref()

const form = reactive({
  tenantName: '',
  contactName: '',
  contactMobile: '',
  contactEmail: '',
  adminUsername: '',
  expireAt: '',
})

const rules = {
  tenantName: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactMobile: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  adminUsername: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
}

/* 一次性初始口令交付（MS-SECURITY-BASELINE-01F1） */
const initialPasswordVisible = ref(false)
const initialPasswordValue = ref('')

async function copyInitialPassword() {
  try {
    await navigator.clipboard.writeText(initialPasswordValue.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选中口令复制')
  }
}

async function confirmInitialPasswordDelivered() {
  initialPasswordVisible.value = false
  initialPasswordValue.value = ''
  ElMessage.success('创建成功')
  router.push('/tenants')
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    // MS-SECURITY-BASELINE-01F1：不再提交操作者手输的管理员口令（旧实现后端忽略该值）；
    // 后端随机生成 adminInitialPassword 并仅在创建响应里返回一次，必须交付到操作者。
    const resp: any = await createTenantApi(form)
    let initialPassword: string
    try {
      initialPassword = extractInitialPassword(resp?.data, 'adminInitialPassword')
    } catch (e: any) {
      // 未取得 adminInitialPassword 时不得静默跳转
      ElMessage.error(e?.message || '租户已写入但未取得一次性初始口令（adminInitialPassword），已阻止创建成功跳转，请重置该账号密码后交付')
      return
    }
    initialPasswordValue.value = initialPassword
    initialPasswordVisible.value = true
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.initial-password-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.initial-password-value { flex: 1; font-family: monospace; font-size: 16px; font-weight: 600; user-select: all; }
</style>
