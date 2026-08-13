<template>
  <div class="register-page">
    <el-card class="register-card">
      <template #header>
        <div>
          <h1>智享全链管理系统</h1>
          <p class="muted">租户注册 - 填写企业信息，开通工作台账号</p>
        </div>
      </template>

      <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" label-width="100px" @submit.prevent>
        <el-divider content-position="left">公司信息</el-divider>

        <el-form-item label="公司名称" prop="company_name">
          <el-input v-model="registerForm.company_name" placeholder="请输入公司全称" />
        </el-form-item>

        <el-form-item label="公司简称" prop="company_short_name">
          <el-input v-model="registerForm.company_short_name" placeholder="请输入公司简称（选填）" />
        </el-form-item>

        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="registerForm.contact_person" placeholder="请输入联系人姓名" />
        </el-form-item>

        <el-form-item label="联系电话" prop="contact_mobile">
          <el-input v-model="registerForm.contact_mobile" placeholder="请输入手机号码" />
        </el-form-item>

        <el-form-item v-if="smsVerifyEnabled" label="短信验证码" prop="sms_code">
          <div class="sms-code-row">
            <el-input v-model="registerForm.sms_code" placeholder="请输入短信验证码" />
            <el-button :disabled="smsCountdown > 0" :loading="smsSending" @click="handleSendSmsCode">
              {{ smsCountdown > 0 ? `${smsCountdown}s 后重发` : "获取验证码" }}
            </el-button>
          </div>
          <div class="sms-code-tip">短信平台申请完成后需输入验证码；未开启时无需验证可直接提交</div>
        </el-form-item>

        <el-form-item label="联系邮箱" prop="contact_email">
          <el-input v-model="registerForm.contact_email" placeholder="请输入邮箱地址（选填）" />
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="省份" prop="province">
              <el-input v-model="registerForm.province" placeholder="省份" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="城市" prop="city">
              <el-input v-model="registerForm.city" placeholder="城市" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区县" prop="district">
              <el-input v-model="registerForm.district" placeholder="区县" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="详细地址" prop="address">
          <el-input v-model="registerForm.address" placeholder="请输入详细地址（选填）" />
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="营业执照号" prop="business_license">
              <el-input v-model="registerForm.business_license" placeholder="请输入营业执照号（选填）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人代表" prop="legal_person">
              <el-input v-model="registerForm.legal_person" placeholder="请输入法人代表（选填）" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="所属行业" prop="industry">
              <el-select v-model="registerForm.industry" placeholder="请选择行业（选填）">
                <el-option label="酒水批发" value="liquor_wholesale" />
                <el-option label="酒水零售" value="liquor_retail" />
                <el-option label="餐饮" value="catering" />
                <el-option label="商超" value="supermarket" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司规模" prop="company_scale">
              <el-select v-model="registerForm.company_scale" placeholder="请选择公司规模（选填）">
                <el-option label="1-10人" value="small" />
                <el-option label="10-50人" value="medium" />
                <el-option label="50-200人" value="large" />
                <el-option label="200人以上" value="enterprise" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">管理员账号</el-divider>

        <el-form-item label="登录账号" prop="admin_username">
          <el-input v-model="registerForm.admin_username" placeholder="请输入登录账号（4-64字符）" />
        </el-form-item>

        <el-form-item label="真实姓名" prop="admin_real_name">
          <el-input v-model="registerForm.admin_real_name" placeholder="请输入真实姓名" />
        </el-form-item>

        <el-form-item label="登录密码" prop="admin_password">
          <el-input v-model="registerForm.admin_password" type="password" placeholder="请输入登录密码" show-password />
        </el-form-item>

        <div v-if="registerForm.admin_password" class="password-strength">
          <div class="strength-bar">
            <div :class="['strength-segment', getStrengthClass(1)]"></div>
            <div :class="['strength-segment', getStrengthClass(2)]"></div>
            <div :class="['strength-segment', getStrengthClass(3)]"></div>
            <div :class="['strength-segment', getStrengthClass(4)]"></div>
          </div>
          <span class="strength-text">{{ passwordStrengthText }}</span>
        </div>

        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="registerForm.confirm_password" type="password" placeholder="请再次输入登录密码" show-password />
        </el-form-item>

        <el-form-item prop="agreement">
          <el-checkbox v-model="registerForm.agreement">
            我已阅读并同意<a href="#" class="link">《用户服务协议》</a>和<a href="#" class="link">《隐私政策》</a>
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleRegister" style="width:100%">提交注册申请</el-button>
        </el-form-item>

        <el-form-item>
          <div class="login-link">
            已有账号？<router-link to="/login">立即登录</router-link>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="showSuccess" class="success-modal">
      <el-card class="success-card">
        <div class="success-content">
          <el-icon :size="48" class="success-icon"><Check /></el-icon>
          <h2>注册申请提交成功</h2>
          <p>您的注册申请已提交，平台管理员将在1-3个工作日内审核。</p>
          <p>审核通过后，我们将通过短信通知您。</p>
          <el-button type="primary" @click="goToLogin">返回登录页</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Check } from "@element-plus/icons-vue";
import { tenantRegister, tenantRegisterSmsCode, tenantRegisterConfig } from "../api";

const router = useRouter();
const registerFormRef = ref<FormInstance>();
const loading = ref(false);
const showSuccess = ref(false);
const smsSending = ref(false);
const smsCountdown = ref(0);
const smsVerifyEnabled = ref(true);
let smsTimer: ReturnType<typeof setInterval> | null = null;

const registerForm = reactive({
  company_name: "",
  company_short_name: "",
  contact_person: "",
  contact_mobile: "",
  sms_code: "",
  contact_email: "",
  province: "",
  city: "",
  district: "",
  address: "",
  business_license: "",
  legal_person: "",
  industry: "",
  company_scale: "",
  admin_username: "",
  admin_real_name: "",
  admin_password: "",
  confirm_password: "",
  agreement: false
});

const registerRules: FormRules = {
  company_name: [{ required: true, message: "请输入公司名称", trigger: "blur" }],
  contact_person: [{ required: true, message: "请输入联系人姓名", trigger: "blur" }],
  contact_mobile: [
    { required: true, message: "请输入联系电话", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "请输入有效的手机号码", trigger: "blur" }
  ],
  sms_code: [{ required: true, message: "请输入短信验证码", trigger: "blur" }],
  admin_username: [
    { required: true, message: "请输入登录账号", trigger: "blur" },
    { min: 4, max: 64, message: "账号长度4-64个字符", trigger: "blur" }
  ],
  admin_real_name: [{ required: true, message: "请输入真实姓名", trigger: "blur" }],
  admin_password: [
    { required: true, message: "请输入登录密码", trigger: "blur" },
    { min: 8, message: "密码至少8个字符", trigger: "blur" },
    { max: 32, message: "密码最多32个字符", trigger: "blur" },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/, message: "密码需包含字母、数字和特殊字符", trigger: "blur" }
  ],
  confirm_password: [
    { required: true, message: "请再次输入密码", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value !== registerForm.admin_password) {
          callback(new Error("两次输入的密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  agreement: [{ required: true, message: "请先阅读并同意协议", trigger: "change" }]
};

/** 读取注册配置：短信验证开关关闭时无需验证码 */
onMounted(async () => {
  try {
    const config = await tenantRegisterConfig();
    smsVerifyEnabled.value = config?.smsVerifyEnabled !== false;
  } catch {
    // 查询失败时默认按需要验证码处理（后端兜底校验）
    smsVerifyEnabled.value = true;
  }
});

const passwordStrength = computed(() => {
  const pwd = registerForm.admin_password;
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Za-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[@$!%*?&]/.test(pwd)) score++;
  return Math.min(score, 4);
});

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value;
  if (strength === 0) return "";
  if (strength === 1) return "弱 - 请增加密码长度";
  if (strength === 2) return "中 - 建议添加特殊字符";
  if (strength === 3) return "强 - 密码安全性良好";
  return "非常强 - 密码安全性优秀";
});

function getStrengthClass(level: number) {
  const strength = passwordStrength.value;
  if (strength >= level) {
    if (strength <= 1) return "weak";
    if (strength <= 2) return "medium";
    if (strength <= 3) return "strong";
    return "very-strong";
  }
  return "empty";
}

/** 发送注册短信验证码（60 秒倒计时） */
async function handleSendSmsCode() {
  const mobile = registerForm.contact_mobile;
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    ElMessage.error("请输入有效的手机号码");
    return;
  }
  smsSending.value = true;
  try {
    const res: any = await tenantRegisterSmsCode(mobile);
    ElMessage.success(res?.message || "验证码已发送，请查收短信");
    if (smsTimer) clearInterval(smsTimer);
    smsCountdown.value = 60;
    smsTimer = setInterval(() => {
      smsCountdown.value--;
      if (smsCountdown.value <= 0 && smsTimer) {
        clearInterval(smsTimer);
        smsTimer = null;
      }
    }, 1000);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "验证码发送失败");
  } finally {
    smsSending.value = false;
  }
}

async function handleRegister() {
  try {
    await registerFormRef.value?.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    await tenantRegister({
      company_name: registerForm.company_name,
      company_short_name: registerForm.company_short_name,
      contact_person: registerForm.contact_person,
      contact_mobile: registerForm.contact_mobile,
      contact_email: registerForm.contact_email,
      province: registerForm.province,
      city: registerForm.city,
      district: registerForm.district,
      address: registerForm.address,
      business_license: registerForm.business_license,
      legal_person: registerForm.legal_person,
      industry: registerForm.industry,
      company_scale: registerForm.company_scale,
      admin_username: registerForm.admin_username,
      admin_password: registerForm.admin_password,
      admin_real_name: registerForm.admin_real_name,
      sms_code: registerForm.sms_code
    });
    showSuccess.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "注册失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  router.push("/login");
}

onBeforeUnmount(() => {
  if (smsTimer) clearInterval(smsTimer);
  smsTimer = null;
});
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 600px;
}

.register-card :deep(.el-card__header) h1 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.password-strength {
  margin-top: 8px;
}

.sms-code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.sms-code-row .el-input {
  flex: 1;
}
.sms-code-tip {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.strength-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.strength-segment {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  transition: all 0.3s;
}

.strength-segment.empty {
  background: #E5E7EB;
}

.strength-segment.weak {
  background: var(--color-danger);
}

.strength-segment.medium {
  background: var(--color-warning);
}

.strength-segment.strong {
  background: #3B82F6;
}

.strength-segment.very-strong {
  background: var(--color-success);
}

.strength-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.login-link {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}

.login-link a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}

.link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.success-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.success-card {
  width: 100%;
  max-width: 420px;
}

.success-content {
  text-align: center;
}

.success-icon {
  color: var(--color-success);
  margin-bottom: 16px;
}

.success-content h2 {
  margin: 0 0 12px;
  font-size: 20px;
  color: var(--text-primary);
}

.success-content p {
  margin: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.success-content .el-button {
  margin-top: 24px;
  width: 200px;
}
</style>
