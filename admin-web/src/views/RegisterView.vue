<template>
  <div class="register-page">
    <!-- 品牌区（与登录页一致风格） -->
    <div class="brand-panel">
      <div class="brand-glow brand-glow--a" />
      <div class="brand-glow brand-glow--b" />
      <div class="brand-inner">
        <div class="brand-logo">
          <div class="logo-mark">智</div>
          <span class="logo-name">智享全链</span>
        </div>
        <h1 class="brand-title">注册商户账号</h1>
        <p class="brand-subtitle">用老板手机号 + 密码即可开通，无需其他资料</p>
      </div>
    </div>

    <!-- 注册表单 -->
    <div class="login-panel">
      <div class="login-box">
        <h2 class="login-title">注册</h2>
        <el-form ref="formRef" :model="form" :rules="rules" size="large" class="login-form" @submit.prevent>
          <el-form-item prop="mobile">
            <el-input v-model="form.mobile" placeholder="老板手机号" maxlength="11" clearable>
              <template #prefix><span class="input-prefix">手机号</span></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="设置密码（8-32位）" show-password>
              <template #prefix><span class="input-prefix">密 码</span></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="confirmPassword">
            <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password>
              <template #prefix><span class="input-prefix">确认</span></template>
            </el-input>
          </el-form-item>
          <div class="register-agreement">
            <el-checkbox v-model="form.agreement">我已阅读并同意</el-checkbox>
            <a class="agreement-link" @click.prevent>《用户服务协议》与《隐私政策》</a>
          </div>
          <el-button type="primary" :loading="loading" class="submit-btn" @click="handleRegister">注册</el-button>
          <div class="register-hint">
            已有账号？<span class="register-link" @click="router.push('/login')">立即登录</span>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { tenantRegister } from "../api";

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ mobile: "", password: "", confirmPassword: "", agreement: false });

const rules: FormRules = {
  mobile: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "请输入有效的手机号码", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, max: 32, message: "密码长度为8-32位", trigger: "blur" },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/, message: "密码需包含字母、数字和特殊字符", trigger: "blur" },
  ],
  confirmPassword: [
    { required: true, message: "请再次输入密码", trigger: "blur" },
    {
      validator: (_r: unknown, v: string, cb: (e?: Error) => void) => {
        if (v !== form.password) cb(new Error("两次输入的密码不一致"));
        else cb();
      },
      trigger: "blur",
    },
  ],
};

async function handleRegister() {
  if (!form.agreement) {
    ElMessage.warning("请先阅读并同意用户服务协议与隐私政策");
    return;
  }
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await tenantRegister({
      company_name: form.mobile,
      contact_person: form.mobile,
      contact_mobile: form.mobile,
      admin_username: form.mobile,
      admin_password: form.password,
      admin_real_name: form.mobile,
      sms_code: "",
    });
    ElMessage.success("注册申请已提交，等待平台审核");
    setTimeout(() => router.push("/login"), 1500);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "注册失败，请重试");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.register-page { display: flex; min-height: 100vh; background: #f0f2f5; }
.brand-panel {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  overflow: hidden;
  padding: 40px;
}
.brand-glow { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .5; }
.brand-glow--a { width: 300px; height: 300px; background: rgba(255,255,255,.18); top: -60px; left: -40px; }
.brand-glow--b { width: 260px; height: 260px; background: rgba(255,255,255,.12); bottom: -40px; right: -60px; }
.brand-inner { position: relative; z-index: 1; color: #fff; max-width: 420px; }
.brand-logo { display: flex; align-items: center; gap: 12px; }
.logo-mark { width: 44px; height: 44px; border-radius: 12px; background: #fff; color: #2563eb; font-size: 24px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.logo-name { font-size: 22px; font-weight: 700; }
.brand-title { font-size: 34px; font-weight: 800; margin: 24px 0 12px; }
.brand-subtitle { font-size: 16px; opacity: .9; line-height: 1.6; }
.login-panel { width: 440px; display: flex; align-items: center; justify-content: center; padding: 40px; }
.login-box { width: 100%; }
.login-title { font-size: 26px; font-weight: 700; color: #303133; margin-bottom: 24px; text-align: center; }
.login-form .el-input__wrapper { height: 46px; }
.input-prefix { color: #909399; font-size: 14px; margin-right: 6px; }
.register-agreement { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.agreement-link { color: #2563eb; font-size: 13px; }
.submit-btn { width: 100%; height: 44px; }
.register-hint { text-align: center; margin-top: 16px; color: #606266; font-size: 14px; }
.register-link { color: #2563eb; cursor: pointer; }
</style>
