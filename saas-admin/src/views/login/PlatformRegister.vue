<template>
  <div class="register-wrapper">
    <el-card class="register-card">
      <h2>注册商户账号</h2>
      <p class="register-sub">用老板手机号即可注册，仅需手机号与密码</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
        <el-form-item prop="mobile">
          <el-input v-model="form.mobile" placeholder="老板手机号" maxlength="11" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="设置密码（8-32位）" show-password />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password @keyup.enter="handleRegister" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="handleRegister">注册</el-button>
        </el-form-item>
      </el-form>
      <div class="login-link">
        <span>已有账号？</span>
        <el-link type="primary" @click="goLogin">立即登录</el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const router = useRouter()
const loading = ref(false)
const formRef = ref()

const form = reactive({ mobile: '', password: '', confirmPassword: '' })

const rules = {
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 32, message: '密码长度为8-32位', trigger: 'blur' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/, message: '密码需包含字母、数字和特殊字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (e?: Error) => void) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res: any = await request.post('/tenant/register', {
      companyName: form.mobile,
      contactMobile: form.mobile,
      contactPerson: form.mobile,
      adminUsername: form.mobile,
      adminPassword: form.password,
      adminRealName: form.mobile,
    })
    ElMessage.success(res?.data?.msg || '注册申请已提交，等待平台审核')
    setTimeout(() => router.push('/login'), 1500)
  } catch {
    // 错误由拦截器统一提示
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/login')
}
</script>

<style scoped>
.register-wrapper { display: flex; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5; }
.register-card { width: 400px; }
.register-card h2 { text-align: center; margin-bottom: 8px; color: #303133; }
.register-sub { text-align: center; margin-bottom: 20px; color: #909399; font-size: 13px; }
.login-link { text-align: center; margin-top: 4px; color: #606266; font-size: 14px; }
</style>
