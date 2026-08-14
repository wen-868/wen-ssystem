<template>
  <div class="login-page">
    <!-- 左侧品牌区（对标设计稿 p02） -->
    <div class="brand-panel">
      <div class="brand-glow brand-glow--a" />
      <div class="brand-glow brand-glow--b" />
      <div class="brand-grid" />
      <div class="brand-inner">
        <div class="brand-logo">
          <div class="logo-mark">智</div>
          <span class="logo-name">智享全链</span>
        </div>

        <h1 class="brand-title">批零一体 SaaS 即时零售中台</h1>
        <p class="brand-subtitle">一个账号，工作台与收银台一体贯通</p>

        <div class="brand-features">
          <div class="feature-item">
            <div class="feature-icon"><el-icon><Goods /></el-icon></div>
            <div>
              <div class="feature-title">批零一体营销</div>
              <div class="feature-desc">批发、零售、线上商城一套系统打通，库存订单实时同步</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><el-icon><Van /></el-icon></div>
            <div>
              <div class="feature-title">即时零售履约</div>
              <div class="feature-desc">对接美团、达达、顺丰，最快 30 分钟送达门店周边</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><el-icon><ChatDotRound /></el-icon></div>
            <div>
              <div class="feature-title">本地 AI 轻营助手</div>
              <div class="feature-desc">本地推理、数据不出店，开口即办对账、发券、查欠</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><el-icon><OfficeBuilding /></el-icon></div>
            <div>
              <div class="feature-title">多门店连锁管控</div>
              <div class="feature-desc">连锁总部与门店统一管控，权限按岗位精细分配</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 玻璃拟态经营数据卡（视觉装饰） -->
      <div class="float-card float-card--sales">
        <div class="float-card-label">今日销售额</div>
        <div class="float-card-value">¥ 12,860</div>
        <div class="float-card-trend up">↑ 12.5%</div>
      </div>
      <div class="float-card float-card--orders">
        <div class="float-card-label">待处理订单</div>
        <div class="float-card-value">18 单</div>
        <div class="float-card-trend">实时同步中</div>
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
          <div class="demo-login-divider">
            <span class="demo-divider-line" />
            <span class="demo-divider-text">或</span>
            <span class="demo-divider-line" />
          </div>
          <el-button
            size="large"
            class="demo-login-btn"
            :loading="loading"
            @click="handleDemoLogin"
          >
            <el-icon class="demo-login-icon"><Van /></el-icon>
            演示账号登录（免密体验）
          </el-button>
          <p class="demo-login-tip">无需注册，一键进入工作台，自动填充演示数据</p>
        </el-form>

        <div class="register-hint">
          还没账号？<span class="register-link" @click="router.push('/register')">立即注册</span>
        </div>
        <div class="icp-line">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="nofollow noopener">
            粤ICP备2026103101号-1
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
import { ChatDotRound, Goods, OfficeBuilding, Van } from "@element-plus/icons-vue";
import { adminLogin, demoLogin, seedDemoData } from "../api";
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

/** 演示账号登录：免密进入工作台，自动初始化演示数据 */
async function handleDemoLogin() {
  loading.value = true;
  try {
    const res = await demoLogin();
    const token = res.token;
    if (token) {
      const userInfo: any = { ...(res.user || {}), demo: true };
      auth.setAuth(token, userInfo, res.csrfToken);
      ElMessage.success("已进入演示模式");
      // 幂等初始化演示数据（失败不阻塞进入）
      seedDemoData().catch(() => {});
      router.push("/dashboard");
    } else {
      ElMessage.error("演示登录失败：未获取到 token");
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "演示登录失败，请稍后再试");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: var(--gray-0);
}

/* ─── 左侧品牌区 ─── */
.brand-panel {
  flex: 1.2;
  background:
    radial-gradient(900px 500px at 85% -10%, rgba(90, 190, 255, 0.45), transparent 60%),
    radial-gradient(700px 420px at -10% 110%, rgba(90, 220, 255, 0.32), transparent 55%),
    linear-gradient(150deg, #3F6FEF 0%, #2F5BD6 55%, #2451C4 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  min-width: 520px;
}

/* 品牌区装饰：光晕 + 网格 + 大号 logo 字 */
.brand-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  pointer-events: none;
}

.brand-glow--a {
  width: 420px;
  height: 420px;
  left: -140px;
  top: -120px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 65%);
}

.brand-glow--b {
  width: 360px;
  height: 360px;
  right: -110px;
  top: 32%;
  background: radial-gradient(circle, rgba(130, 220, 255, 0.22), transparent 62%);
}

.brand-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.8), transparent 90%);
  pointer-events: none;
}

/* 品牌区装饰：大号半透明 logo 字（克制、仅此一处允许的装饰） */
.brand-panel::after {
  content: "智";
  position: absolute;
  right: -70px;
  bottom: -90px;
  font-size: 320px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.06);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

/* 玻璃拟态数据卡 */
.float-card {
  position: absolute;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(20, 40, 110, 0.25);
  color: #fff;
  animation: float-in 0.8s ease-out both;
  pointer-events: none;
}

.float-card--sales {
  right: 40px;
  bottom: 12%;
  animation-delay: 0.15s;
}

.float-card--orders {
  left: 32px;
  bottom: 6%;
  animation-delay: 0.3s;
}

.float-card-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.float-card-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.float-card-trend {
  margin-top: 3px;
  font-size: 12px;
  opacity: 0.85;
}

.float-card-trend.up {
  color: #9ff3c6;
}

@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.brand-inner {
  max-width: 460px;
  color: var(--gray-0);
  position: relative;
  z-index: 1;
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
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-icon :deep(svg) {
  width: 13px;
  height: 13px;
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
  background: var(--gray-0);
  border: 1px solid rgba(63, 111, 239, 0.16);
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: var(--shadow-modal);
  position: relative;
  overflow: hidden;
}

/* 登录卡片顶部高光条 */
.login-box::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3F6FEF, #4FB8FF, #6BE0FF);
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
  border: none;
  background: linear-gradient(135deg, #3F6FEF 0%, #2F5BD6 100%);
  box-shadow: 0 8px 18px rgba(47, 91, 214, 0.28);
}

.login-submit:hover {
  background: linear-gradient(135deg, #4C7DF5 0%, #3663DE 100%);
  box-shadow: 0 10px 22px rgba(47, 91, 214, 0.34);
}

.demo-login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 14px;
}

.demo-divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-light);
}

.demo-divider-text {
  font-size: 12px;
  color: var(--text-placeholder);
}

.demo-login-btn {
  width: 100%;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  border: 1px dashed var(--color-primary);
  color: var(--color-primary);
  background: rgba(63, 111, 239, 0.04);
}

.demo-login-btn:hover {
  background: rgba(63, 111, 239, 0.1);
  border: 1px dashed var(--color-primary);
  color: var(--color-primary);
}

.demo-login-icon {
  margin-right: 4px;
}

.demo-login-tip {
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  /* WCAG AA 修复：原 #cccccc 对比度 1.6:1 不达标，改 #595959（≥4.5:1） */
  color: #595959;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.register-hint {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
  /* WCAG AA 修复：原 #999999 对比度 2.84:1 不达标，改 #595959（≥4.5:1） */
  color: #595959;
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
