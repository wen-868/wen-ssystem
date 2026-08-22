<template>
  <div class="login-wrapper">
    <!-- 品牌区（移动端登录风格） -->
    <div class="brand-panel">
      <div class="brand-glow brand-glow--a" />
      <div class="brand-glow brand-glow--b" />
      <div class="brand-inner">
        <div class="brand-logo">
          <div class="logo-mark">智</div>
          <span class="logo-name">智享全链</span>
        </div>
        <h1 class="brand-title">智享平台总后台</h1>
        <p class="brand-subtitle">一个账号，管理全平台租户与应用</p>
      </div>
    </div>

    <!-- 登录表单 -->
    <div class="login-panel">
      <div class="login-box">
        <h2 class="login-title">登录</h2>
        <el-form ref="formRef" :model="form" :rules="rules" size="large" class="login-form" @keyup.enter="handleLogin">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名" clearable>
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" show-password>
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">登录</el-button>
          <div class="register-hint">
            还没有账号？<span class="register-link" @click="router.push('/register')">立即注册</span>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { User, Lock } from "@element-plus/icons-vue";
import { useAuthStore } from "../../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const formRef = ref();

const form = reactive({ username: "", password: "" });
const rules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await authStore.login(form.username, form.password);
    router.push("/");
  } catch {
    // 错误由拦截器统一提示
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrapper { display: flex; min-height: 100vh; background: #f0f2f5; }
.brand-panel {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%);
  overflow: hidden;
  padding: 40px;
}
.brand-glow { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .5; }
.brand-glow--a { width: 300px; height: 300px; background: rgba(255,255,255,.18); top: -60px; left: -40px; }
.brand-glow--b { width: 260px; height: 260px; background: rgba(255,255,255,.12); bottom: -40px; right: -60px; }
.brand-inner { position: relative; z-index: 1; color: #fff; max-width: 420px; }
.brand-logo { display: flex; align-items: center; gap: 12px; }
.logo-mark { width: 44px; height: 44px; border-radius: 12px; background: #fff; color: #4f46e5; font-size: 24px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.logo-name { font-size: 22px; font-weight: 700; }
.brand-title { font-size: 34px; font-weight: 800; margin: 24px 0 12px; }
.brand-subtitle { font-size: 16px; opacity: .9; line-height: 1.6; }
.login-panel { width: 420px; display: flex; align-items: center; justify-content: center; padding: 40px; }
.login-box { width: 100%; }
.login-title { font-size: 26px; font-weight: 700; color: #303133; margin-bottom: 24px; text-align: center; }
.login-form .el-input__wrapper { height: 46px; }
.login-btn { width: 100%; height: 44px; }
.register-hint { text-align: center; margin-top: 16px; color: #606266; font-size: 14px; }
.register-link { color: #4f46e5; cursor: pointer; }
</style>
