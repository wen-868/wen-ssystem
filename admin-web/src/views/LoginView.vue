<template>
  <div class="login-page">
    <!-- 左侧品牌区（对标设计稿 p02） -->
    <div class="brand-panel">
      <div class="brand-inner">
        <div class="brand-logo">
          <div class="logo-mark">智</div>
          <span class="logo-name">智享全链</span>
        </div>

        <h1 class="brand-title">批零一体 SaaS 即时零售中台</h1>
        <p class="brand-subtitle">一个账号，管理后台与收银台一体贯通</p>

        <div class="brand-features">
          <div class="feature-item">
            <div class="feature-icon">✓</div>
            <div>
              <div class="feature-title">批零一体营销</div>
              <div class="feature-desc">批发、零售、线上商城一套系统打通，库存订单实时同步</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✓</div>
            <div>
              <div class="feature-title">即时零售履约</div>
              <div class="feature-desc">对接美团、达达、顺丰，最快 30 分钟送达门店周边</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✓</div>
            <div>
              <div class="feature-title">本地 AI 轻营助手</div>
              <div class="feature-desc">本地推理、数据不出店，开口即办对账、发券、查欠</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">✓</div>
            <div>
              <div class="feature-title">多门店连锁管控</div>
              <div class="feature-desc">连锁总部与门店统一管控，权限按岗位精细分配</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录表单 -->
    <div class="login-panel">
      <div class="login-box">
        <h2 class="login-title">登录工作台</h2>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          size="large"
          class="login-form"
          @submit.prevent
        >
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="账号"
              autocomplete="username"
              clearable
            >
              <template #prefix><span class="input-prefix">账 号</span></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="密码"
              show-password
              autocomplete="current-password"
            >
              <template #prefix><span class="input-prefix">密 码</span></template>
            </el-input>
          </el-form-item>
          <div class="login-options">
            <el-checkbox v-model="loginForm.rememberMe">记住账号</el-checkbox>
            <span class="forgot-link">忘记密码？</span>
          </div>
          <el-button
            type="primary"
            size="large"
            class="login-submit"
            :loading="loading"
            @click="handleLogin"
          >
            立即登录
          </el-button>
        </el-form>

        <div class="register-hint">
          还没账号？<span class="register-link">立即注册</span>
        </div>
        <div class="icp-line">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="nofollow noopener">
            粤ICP备2026103101号
          </a>
        </div>
      </div>
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
  password: "",
  rememberMe: false
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
  background: #ffffff;
}

/* ─── 左侧品牌区 ─── */
.brand-panel {
  flex: 1.2;
  background: linear-gradient(160deg, #3F6FEF 0%, #2F5BD6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  min-width: 520px;
}

.brand-inner {
  max-width: 460px;
  color: #ffffff;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 48px;
}

.logo-mark {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.92);
  color: #2F5BD6;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}

.logo-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-title {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 12px;
}

.brand-subtitle {
  font-size: 15px;
  opacity: 0.85;
  margin: 0 0 44px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.feature-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.feature-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 13px;
  opacity: 0.78;
  line-height: 1.6;
}

/* ─── 右侧登录区 ─── */
.login-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F7F8FA;
  padding: 32px;
}

.login-box {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 40px 36px 28px;
  box-shadow: var(--shadow-sm);
}

.login-title {
  margin: 0 0 28px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.input-prefix {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -6px 0 24px;
}

.login-options :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--text-secondary);
}

.forgot-link {
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}

.forgot-link:hover {
  color: var(--color-primary);
}

.login-submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
}

.register-hint {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

.register-link {
  color: var(--color-primary);
  cursor: pointer;
}

.icp-line {
  text-align: center;
  margin-top: 20px;
  font-size: 12px;
}

.icp-line a {
  color: var(--text-placeholder);
  text-decoration: none;
}
</style>
