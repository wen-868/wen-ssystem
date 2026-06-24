<template>
  <div class="store-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>门店操作端</h1>
          <p class="muted">请先登录，登录后进入门店收银和履约工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="store_operator" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入门店端</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { storeLogin } from "../api";

const router = useRouter();
const loading = ref(false);
const loginForm = reactive({ username: "", password: "" });

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function handleLogin() {
  loading.value = true;
  try {
    const result = await storeLogin(loginForm.username, loginForm.password);
    localStorage.setItem("store_token", result.token);
    localStorage.setItem("login_response", JSON.stringify(result));
    ElMessage.success("登录成功，正在进入工作台");
    router.push("/");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "登录失败，请检查门店账号或稍后再试"));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.store-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 420px;
}
.login-card h1 {
  margin: 0 0 4px;
  font-size: 22px;
}
.muted {
  color: var(--text-muted);
  margin: 0;
  font-size: 13px;
}
</style>
