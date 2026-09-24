<template>
  <!-- 登录页为独立全屏页（无后台框架），严格对齐设计稿 sec-login（行 1902~1942） -->
  <div class="login">
    <!-- 左：品牌区（logo + slogan + 抽象网格装饰） -->
    <div class="lg-brand">
      <svg class="deco" viewBox="0 0 600 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g stroke="#ffffff" stroke-opacity=".14" stroke-width="1">
          <path d="M-20,120 L620,60" />
          <path d="M-20,240 L620,180" />
          <path d="M-20,360 L620,300" />
          <path d="M-20,480 L620,420" />
          <path d="M80,-20 L240,580" />
          <path d="M220,-20 L380,580" />
          <path d="M360,-20 L520,580" />
          <path d="M500,-20 L660,580" />
        </g>
        <g fill="#ffffff" fill-opacity=".1">
          <circle cx="470" cy="120" r="70" />
          <circle cx="120" cy="430" r="46" />
          <circle cx="380" cy="330" r="24" />
        </g>
        <!-- 六边形链路符号：描边色取 --chart-1-soft（#93c5fd） -->
        <g :stroke="decoStroke" stroke-width="2" fill="none" stroke-opacity=".8">
          <polyline points="300,140 400,200 400,320 300,380 200,320 200,200 300,140" />
          <polyline points="300,180 364,218 364,302 300,340 236,302 236,218 300,180" />
        </g>
        <circle cx="300" cy="260" r="10" fill="#fff" fill-opacity=".9" />
        <g stroke="#fff" stroke-width="2" stroke-opacity=".65" stroke-linecap="round">
          <line x1="300" y1="140" x2="300" y2="90" />
          <line x1="400" y1="200" x2="448" y2="176" />
          <line x1="400" y1="320" x2="448" y2="344" />
          <line x1="300" y1="380" x2="300" y2="430" />
          <line x1="200" y1="320" x2="152" y2="344" />
          <line x1="200" y1="200" x2="152" y2="176" />
        </g>
      </svg>

      <div class="lg-logo">
        <span class="lg">智</span>
        <span>
          <b>智享全链</b>
          <i>ZHIXIANG QUANLIAN</i>
        </span>
      </div>

      <div class="lg-slogan">
        <p class="lg-sl">让批零生意，<br />全链路智能运转。</p>
        <p>进销存 × 线下批零 × 小程序商城 × 即时零售 —— 一个平台，四端协同，为中小批零商户而生。</p>
        <div class="lg-feats">
          <span>多租户安全隔离</span>
          <span>配额硬拦截引擎</span>
          <span>AI 全链路赋能</span>
        </div>
      </div>
    </div>

    <!-- 右：登录表单 -->
    <div class="lg-form">
      <div class="lg-box">
        <div class="pt4">欢迎登录总后台</div>
        <p class="ls">智享全链 · 平台运营中枢（仅限平台管理员）</p>

        <el-form ref="formRef" :model="form" :rules="rules" class="lg-form-el" @keyup.enter="handleLogin">
          <div class="lg-fld">
            <label>管理员账号</label>
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="请输入邮箱 / 管理员账号" clearable />
            </el-form-item>
          </div>

          <div class="lg-fld">
            <label>密码</label>
            <el-form-item prop="password">
              <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
            </el-form-item>
          </div>

          <div class="lg-fld">
            <label>图形验证码</label>
            <div class="cap-row">
              <el-form-item prop="captcha">
                <el-input v-model="form.captcha" placeholder="请输入右侧验证码" />
              </el-form-item>
              <!-- 验证码图：后端 GET /platform/auth/captcha 下发（5 分钟有效、一次性），点击可刷新 -->
              <img
                v-if="captchaImage"
                class="cap cap-img"
                :src="captchaImage"
                alt="图形验证码"
                title="点击刷新验证码"
                @click="loadCaptcha"
              />
              <span v-else class="cap" title="点击加载验证码" @click="loadCaptcha">加载中…</span>
            </div>
          </div>

          <div class="lg-meta">
            <span class="lg-remember" @click="remember = !remember">
              <span class="ck" :class="{ on: remember }"></span>记住此设备
            </span>
            <span class="lk" @click="onForgot">忘记密码？</span>
          </div>

          <el-button class="lg-btn" type="primary" :loading="loading" @click="handleLogin">登 录</el-button>
        </el-form>

        <p class="small lg-tip">登录即代表同意《平台管理员安全协议》· 首次登录将强制修改初始密码</p>
      </div>

      <div class="lg-foot">© 2026 智享全链 · 京ICP备2026XXXXXX号 · 京公网安备 XXXXXXXXXXXXX号</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { getCaptchaApi } from '../../api/auth'

/* 装饰描边色：读设计令牌 --chart-1-soft，避免在组件内写死色值 */
const decoStroke = getComputedStyle(document.documentElement).getPropertyValue('--chart-1-soft').trim()

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const remember = ref(false)
const formRef = ref()

const form = reactive({ username: '', password: '', captcha: '', captchaId: '' })
const rules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, message: '请输入图形验证码', trigger: 'blur' }],
}

/**
 * 图形验证码（R101-S2-01 裁定 4.1）
 * 后端 GET /platform/auth/captcha 下发 { captchaId, image(SVG data URI), expiresIn }，
 * 5 分钟有效、一次性；点击图片刷新。此处不伪造验证码，拉取失败即留空并提示。
 */
const captchaImage = ref('')

async function loadCaptcha() {
  try {
    const res = await getCaptchaApi()
    form.captchaId = res.data?.captchaId || ''
    captchaImage.value = res.data?.image || ''
  } catch {
    // 拉取失败由请求拦截器统一提示；清空以免展示已失效的旧图
    form.captchaId = ''
    captchaImage.value = ''
  }
}

onMounted(loadCaptcha)

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await authStore.login(form.username, form.password, form.captchaId, form.captcha)
    router.push('/')
  } catch {
    // 错误由请求拦截器统一提示
    // 验证码一次性：本次登录失败后原图已被消耗，必须换新图，否则重试必然再失败
    form.captcha = ''
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}

function onForgot() {
  // ③-b #3（主行 #2）：找回密码端点属 C6-1A ② 类（零 DDL：Redis 一次性令牌 + UPDATE password_hash），
  // 其后端契约未落地 ⇒ 本卡不接线；文案不再写"待接入流程"（避免暗示已有入口）
  ElMessage.warning('找回密码：待后端接口（C6-1A #2）落地后接入；当前请由超级管理员重置')
}
</script>

<style scoped>
/* 本页为全屏独立页，样式全部引用 design token，不写死字面值 */
.login {
  display: flex;
  min-height: var(--login-min-h);
  height: 100vh;
  background: var(--bg-card);
}

/* ── 左：品牌区 ── */
.lg-brand {
  flex: 1.15;
  background: var(--login-brand-bg);
  color: var(--text-inverse);
  padding: var(--login-brand-padding);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.deco {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: var(--login-deco-opacity);
}
.lg-logo {
  display: flex;
  align-items: center;
  gap: var(--login-brand-gap);
  position: relative;
}
.lg-logo .lg {
  width: var(--login-brand-logo-size);
  height: var(--login-brand-logo-size);
  border-radius: var(--login-brand-logo-radius);
  background: var(--login-logo-bg);
  border: 1px solid var(--login-logo-border);
  display: grid;
  place-items: center;
  font-weight: var(--font-bold);
  font-size: var(--login-brand-logo-font);
}
.lg-logo b {
  font-size: var(--login-brand-name-size);
  letter-spacing: var(--login-brand-name-tracking);
}
.lg-logo i {
  font-style: normal;
  font-size: var(--login-brand-en-size);
  opacity: var(--login-brand-en-opacity);
  display: block;
  letter-spacing: var(--login-brand-en-tracking);
}
.lg-slogan {
  position: relative;
  margin-top: auto;
}
.lg-slogan .lg-sl {
  font-size: var(--login-slogan-size);
  line-height: 1.45;
  font-weight: var(--font-bold);
}
.lg-slogan p {
  opacity: var(--login-slogan-desc-opacity);
  font-size: var(--login-slogan-desc-size);
  margin-top: var(--space-3);
  max-width: var(--login-desc-max-w);
}
.lg-feats {
  position: relative;
  display: flex;
  gap: var(--login-feat-gap);
  margin-top: var(--login-feat-margin);
  flex-wrap: wrap;
}
.lg-feats span {
  background: var(--login-feat-bg);
  border: 1px solid var(--login-feat-border);
  border-radius: var(--radius-full);
  font-size: var(--login-feat-font);
  padding: var(--login-feat-padding);
}

/* ── 右：表单区 ── */
.lg-form {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--login-form-padding);
  position: relative;
}
.lg-box {
  width: var(--login-box-w);
  max-width: 100%;
}
.lg-box .pt4 {
  font-size: var(--login-box-title);
  font-weight: var(--font-bold);
}
.lg-box .ls {
  color: var(--g5);
  font-size: var(--login-box-sub);
  margin: var(--login-box-sub-margin);
}
.lg-fld {
  margin-bottom: var(--login-fld-gap);
}
.lg-fld label {
  display: block;
  font-size: var(--login-label-size);
  color: var(--g6);
  margin-bottom: var(--login-label-margin);
  font-weight: var(--font-medium);
}
.cap-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.cap-row :deep(.el-form-item) {
  flex: 1;
  margin-bottom: 0;
}
.cap {
  flex: none;
  width: var(--login-cap-w);
  height: var(--login-cap-h);
  border-radius: var(--nav-item-radius);
  background: var(--login-cap-bg);
  border: 1px solid var(--color-primary-soft);
  display: grid;
  place-items: center;
  font-size: var(--login-cap-font);
  font-weight: var(--font-bold);
  letter-spacing: var(--login-cap-tracking);
  color: var(--login-cap-color);
  user-select: none;
  cursor: pointer;
}
/* 验证码为后端下发的 SVG 图片：铺满容器、保持比例，点击刷新 */
.cap-img {
  display: block;
  object-fit: contain;
  padding: 0;
}
.lg-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--g5);
  margin: var(--space-1) 0 10px;
}
.lg-remember {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}
.lg-btn {
  width: 100%;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--nav-item-radius);
  padding: var(--login-btn-padding);
  font-size: var(--login-btn-font);
  font-weight: var(--font-semibold);
  margin-top: var(--space-1);
}
.lg-btn:hover {
  background: var(--color-primary-hover);
}
.lg-tip {
  text-align: center;
  margin-top: var(--space-3);
}
.lg-foot {
  position: absolute;
  bottom: var(--login-foot-bottom);
  left: 0;
  right: 0;
  text-align: center;
  font-size: var(--login-foot-size);
  color: var(--g4);
}

/* 表单项间距归零，由 .lg-fld 统一控制 */
.lg-form-el :deep(.el-form-item) {
  margin-bottom: 0;
}
.lg-form-el :deep(.el-input__wrapper) {
  padding: var(--login-ipt-padding);
  font-size: var(--login-ipt-font);
}

@media (max-width: 768px) {
  .lg-brand {
    display: none;
  }
}
</style>
