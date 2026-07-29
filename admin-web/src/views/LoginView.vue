<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>智享全链管理系统</h1>
          <p class="muted">请先登录，登录后进入工作台。</p>
        </div>
      </template>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-width="72px" @submit.prevent>
        <el-form-item label="账号" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item prop="rememberMe">
          <el-button type="primary" :loading="loading" @click="handleLogin" style="width:100%">登录进入后台</el-button>
        </el-form-item>
        <el-form-item>
          <div class="register-link">
            还没有账号？<router-link to="/register">立即注册</router-link>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
    <div style="text-align:center;color:#999;font-size:12px;padding:20px 0;">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="nofollow noopener" style="color:#999;text-decoration:none;">粤ICP备2026103101号</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { adminLogin } from "../api";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const loginFormRef = ref<FormInstance>();
const loading = ref(false);

const loginForm = reactive({
  username: "",
  password: ""
});

const loginRules: FormRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, message: "密码至少8个字符", trigger: "blur" },
    { max: 32, message: "密码不能超过32个字符", trigger: "blur" }
  ]
};

async function handleLogin() {
  try {
    await loginFormRef.value?.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    const res: any = await adminLogin(loginForm.username, loginForm.password);
    const token = res.token || res.data?.token || res;
    if (token) {
      const csrfToken = res.csrfToken || res.data?.csrfToken;
      const userInfo = res.data?.user || res.user || { realName: loginForm.username };
      auth.setAuth(token, userInfo, csrfToken);
      ElMessage.success("登录成功");
      router.push("/dashboard");
    } else {
      ElMessage.error("登录失败：未获取到 token");
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
}

.login-card :deep(.el-card__header) h1 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.register-link {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
}

.register-link a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.register-link a:hover {
  text-decoration: underline;
}
</style>
