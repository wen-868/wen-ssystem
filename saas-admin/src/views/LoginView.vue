<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>智享平台总后台</h1>
          <p class="muted">请使用平台管理员账号登录</p>
        </div>
      </template>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin" style="width:100%">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { saasLogin } from "../api";

const router = useRouter();
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
    { min: 6, message: "密码至少6个字符", trigger: "blur" }
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
    const res: any = await saasLogin(loginForm.username, loginForm.password);
    const token = res.token || res.data?.token || res;
    if (token) {
      localStorage.setItem("saas_token", token);
      localStorage.setItem("saas_user", JSON.stringify(res.data?.user || res.user || { realName: loginForm.username }));
      ElMessage.success("登录成功");
      router.push("/dashboard");
    } else {
      ElMessage.error("登录失败：未获取到 token");
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "登录失败");
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
  background: linear-gradient(135deg, #1a1a2e 0%, #2563eb 50%, #06b6d4 100%);
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
</style>