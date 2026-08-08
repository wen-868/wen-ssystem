<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">会员体系</h2>
        <p class="page-desc">会员注册与等级权益配置</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 会员注册（表单页骨架） -->
      <el-tab-pane label="会员注册" name="register">
        <div class="form-card form-card--narrow">
          <div class="form-card-header">会员注册</div>
          <div class="form-card-body">
            <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" label-width="100px">
              <el-form-item label="姓名" prop="name">
                <el-input v-model="registerForm.name" placeholder="请输入会员姓名" />
              </el-form-item>
              <el-form-item label="手机号" prop="mobile">
                <el-input v-model="registerForm.mobile" placeholder="请输入手机号" />
              </el-form-item>
              <el-form-item label="初始密码">
                <el-input v-model="registerForm.password" show-password />
              </el-form-item>
              <el-form-item label="推荐人">
                <el-input v-model="registerForm.referrerId" placeholder="选填，推荐人ID" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="registerSubmitLoading" @click="handleRegister">注册会员</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>

      <!-- 会员权益（列表页骨架） -->
      <el-tab-pane label="会员权益" name="benefits">
        <div class="filter-bar">
          <div class="filter-bar-spacer" />
          <el-button type="primary" @click="handleEditBenefits">批量编辑权益</el-button>
        </div>
        <div class="table-card">
          <el-table :data="benefits" v-loading="benefitsLoading" stripe>
            <el-table-column prop="levelName" label="等级" width="120" />
            <el-table-column prop="benefitCode" label="权益编码" width="160" />
            <el-table-column prop="benefitName" label="权益名称" min-width="140" />
            <el-table-column prop="enabled" label="启用" width="80">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="configValue" label="配置值" min-width="120" />
            <template #empty>
              <el-empty description="暂无会员权益数据" :image-size="80" />
            </template>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 权益编辑弹窗 -->
    <el-dialog v-model="benefitsDialogVisible" title="编辑会员权益" width="720px">
      <el-table :data="benefitsEditList" stripe empty-text="暂无数据">
        <el-table-column prop="levelName" label="等级" width="120" />
        <el-table-column prop="benefitName" label="权益名称" min-width="140" />
        <el-table-column prop="enabled" label="启用" width="100">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column prop="configValue" label="配置值" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.configValue" size="small" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="benefitsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="benefitsSubmitLoading" @click="handleBenefitsSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  registerMember, fetchMemberBenefits, updateMemberBenefits, fetchLevelConfigs
} from "../../api";

const activeTab = ref("register");

// ── 会员注册 ──
const registerFormRef = ref<FormInstance>();
const registerSubmitLoading = ref(false);
const mobilePattern = /^1[3-9]\d{9}$/;

const registerForm = reactive({
  name: "",
  mobile: "",
  password: "123456",
  referrerId: ""
});

const registerRules: FormRules = {
  name: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  mobile: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "手机号格式不正确", trigger: "blur" }
  ]
};

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.msg || e?.message || fallback;
}

async function handleRegister() {
  if (!registerFormRef.value) return;
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return;
    registerSubmitLoading.value = true;
    try {
      await registerMember({ ...registerForm, referrerId: Number(registerForm.referrerId) || undefined });
      ElMessage.success("会员注册成功");
      registerForm.name = "";
      registerForm.mobile = "";
      registerForm.password = "123456";
      registerForm.referrerId = "";
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "注册失败"));
    } finally {
      registerSubmitLoading.value = false;
    }
  });
}

// ── 会员权益 ──
const benefits = ref<any[]>([]);
const benefitsLoading = ref(false);
const benefitsDialogVisible = ref(false);
const benefitsSubmitLoading = ref(false);
const benefitsEditList = ref<any[]>([]);

async function loadBenefits() {
  benefitsLoading.value = true;
  try {
    const data = await fetchMemberBenefits();
    benefits.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载会员权益失败"));
  } finally {
    benefitsLoading.value = false;
  }
}

async function handleEditBenefits() {
  benefitsEditList.value = benefits.value.map((b: any) => ({ ...b }));
  benefitsDialogVisible.value = true;
}

async function handleBenefitsSubmit() {
  benefitsSubmitLoading.value = true;
  try {
    await updateMemberBenefits(0, { benefits: benefitsEditList.value });
    ElMessage.success("权益已更新");
    benefitsDialogVisible.value = false;
    loadBenefits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "更新权益失败"));
  } finally {
    benefitsSubmitLoading.value = false;
  }
}

function handleTabChange(name: string) {
  if (name === "benefits") loadBenefits();
}

onMounted(() => {
  // 默认加载注册 tab
});
</script>

<style scoped>
.page {
  padding: 0;
}
.form-card--narrow {
  max-width: 560px;
}
.form-card--narrow .el-form {
  max-width: 480px;
}
</style>
