<template>
  <PageCard title="支付配置">
    <div class="payment-config-wrapper">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- Tab 1: 微信支付 -->
        <el-tab-pane label="微信支付" name="wechat">
          <el-skeleton :loading="wechatLoading" animated>
            <template #template>
              <div class="skeleton-form">
                <el-skeleton-item variant="text" style="width: 30%; margin-bottom: 16px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
              </div>
            </template>
            <template #default>
              <div class="tab-header">
                <div class="switch-row">
                  <span class="switch-label">启用微信支付</span>
                  <el-switch v-model="wechatConfig.enabled" />
                </div>
              </div>
              <el-alert
                title="注意：此处填写的是微信「支付」AppID，来自 pay.weixin.qq.com（商户平台），不是小程序 AppID"
                type="warning"
                show-icon
                :closable="false"
                style="margin-bottom: 20px"
              />
              <el-form label-width="160px" class="config-form">
                <el-form-item label="商户号(mchId)">
                  <el-input v-model="wechatConfig.mchId" placeholder="请输入商户号" />
                </el-form-item>
                <el-form-item label="支付AppID(appId)">
                  <el-input v-model="wechatConfig.appId" placeholder="请输入支付AppID" />
                </el-form-item>
                <el-form-item label="API v3密钥(apiV3Key)">
                  <el-input
                    v-model="wechatConfig.apiV3Key"
                    :type="wechatShowApiV3Key ? 'text' : 'password'"
                    placeholder="请输入API v3密钥"
                    show-password
                  />
                </el-form-item>
                <el-form-item label="商户私钥(privateKey)">
                  <div class="secret-field">
                    <el-input
                      v-model="wechatDisplayPrivateKey"
                      type="textarea"
                      :rows="4"
                      placeholder="请输入商户私钥"
                      @input="onWechatPrivateKeyInput"
                    />
                    <el-button
                      class="toggle-btn"
                      link
                      @click="toggleWechatPrivateKey"
                    >
                      {{ wechatShowPrivateKey ? '🙈' : '👁' }}
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item label="证书序列号(serialNo)">
                  <el-input v-model="wechatConfig.serialNo" placeholder="请输入证书序列号" />
                </el-form-item>
                <el-form-item label="回调地址(notifyUrl)">
                  <el-input v-model="wechatConfig.notifyUrl" placeholder="请输入回调地址" />
                </el-form-item>
              </el-form>
              <div class="action-bar">
                <el-button type="info" :loading="wechatTesting" @click="handleTestConnection('wechat')">
                  测试连接
                </el-button>
                <el-button type="primary" :loading="wechatSaving" @click="handleSaveConfig('wechat')">
                  保存配置
                </el-button>
              </div>
            </template>
          </el-skeleton>
        </el-tab-pane>

        <!-- Tab 2: 支付宝 -->
        <el-tab-pane label="支付宝" name="alipay">
          <el-skeleton :loading="alipayLoading" animated>
            <template #template>
              <div class="skeleton-form">
                <el-skeleton-item variant="text" style="width: 30%; margin-bottom: 16px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
                <el-skeleton-item variant="text" style="width: 100%; margin-bottom: 12px" />
              </div>
            </template>
            <template #default>
              <div class="tab-header">
                <div class="switch-row">
                  <span class="switch-label">启用支付宝</span>
                  <el-switch v-model="alipayConfig.enabled" />
                </div>
              </div>
              <el-form label-width="180px" class="config-form">
                <el-form-item label="应用AppID(appId)">
                  <el-input v-model="alipayConfig.appId" placeholder="请输入应用AppID" />
                </el-form-item>
                <el-form-item label="商户私钥(privateKey)">
                  <div class="secret-field">
                    <el-input
                      v-model="alipayDisplayPrivateKey"
                      type="textarea"
                      :rows="4"
                      placeholder="请输入商户私钥"
                      @input="onAlipayPrivateKeyInput"
                    />
                    <el-button
                      class="toggle-btn"
                      link
                      @click="toggleAlipayPrivateKey"
                    >
                      {{ alipayShowPrivateKey ? '🙈' : '👁' }}
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item label="支付宝公钥(alipayPublicKey)">
                  <div class="secret-field">
                    <el-input
                      v-model="alipayDisplayPublicKey"
                      type="textarea"
                      :rows="4"
                      placeholder="请输入支付宝公钥"
                      @input="onAlipayPublicKeyInput"
                    />
                    <el-button
                      class="toggle-btn"
                      link
                      @click="toggleAlipayPublicKey"
                    >
                      {{ alipayShowPublicKey ? '🙈' : '👁' }}
                    </el-button>
                  </div>
                </el-form-item>
                <el-form-item label="回调地址(notifyUrl)">
                  <el-input v-model="alipayConfig.notifyUrl" placeholder="请输入回调地址" />
                </el-form-item>
              </el-form>
              <div class="action-bar">
                <el-button type="info" :loading="alipayTesting" @click="handleTestConnection('alipay')">
                  测试连接
                </el-button>
                <el-button type="primary" :loading="alipaySaving" @click="handleSaveConfig('alipay')">
                  保存配置
                </el-button>
              </div>
            </template>
          </el-skeleton>
        </el-tab-pane>

        <!-- Tab 3: 银行账号 -->
        <el-tab-pane label="银行账号" name="bank">
          <div class="bank-header">
            <el-button type="primary" @click="handleAddBankAccount">添加银行账号</el-button>
          </div>
          <el-table :data="bankAccounts" v-loading="bankLoading" stripe style="width: 100%">
            <el-table-column prop="bankName" label="银行名称" min-width="120" />
            <el-table-column prop="accountNo" label="账号" min-width="180">
              <template #default="{ row }">
                {{ maskAccountNo(row.accountNo) }}
              </template>
            </el-table-column>
            <el-table-column prop="accountName" label="开户名" min-width="120" />
            <el-table-column prop="branchName" label="开户行" min-width="160" />
            <el-table-column label="是否默认" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag>
                <span v-else style="color: #9CA3AF">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleEditBankAccount(row)">
                  编辑
                </el-button>
                <el-button
                  v-if="!row.isDefault"
                  link
                  type="warning"
                  size="small"
                  @click="handleSetDefault(row)"
                >
                  设为默认
                </el-button>
                <el-button link type="danger" size="small" @click="handleDeleteBankAccount(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 银行账号新增/编辑弹窗 -->
    <el-dialog
      v-model="bankDialogVisible"
      :title="isBankEdit ? '编辑银行账号' : '添加银行账号'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="bankFormRef"
        :model="bankForm"
        label-width="100px"
        :rules="bankFormRules"
      >
        <el-form-item label="银行名称" prop="bankName">
          <el-input v-model="bankForm.bankName" placeholder="请输入银行名称" />
        </el-form-item>
        <el-form-item label="账号" prop="accountNo">
          <el-input v-model="bankForm.accountNo" placeholder="请输入银行账号" />
        </el-form-item>
        <el-form-item label="开户名" prop="accountName">
          <el-input v-model="bankForm.accountName" placeholder="请输入开户名" />
        </el-form-item>
        <el-form-item label="开户行" prop="branchName">
          <el-input v-model="bankForm.branchName" placeholder="请输入开户行" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="bankForm.isDefault" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bankDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bankSubmitting" @click="handleBankSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { api } from "../api";

/* ── 当前激活 Tab ── */
const activeTab = ref("wechat");

/* ── 微信支付配置 ── */
const wechatLoading = ref(false);
const wechatSaving = ref(false);
const wechatTesting = ref(false);
const wechatShowApiV3Key = ref(false);
const wechatShowPrivateKey = ref(false);
const wechatRawPrivateKey = ref("");

interface WechatConfig {
  enabled: boolean;
  mchId: string;
  appId: string;
  apiV3Key: string;
  serialNo: string;
  notifyUrl: string;
}

const wechatConfig = reactive<WechatConfig>({
  enabled: false,
  mchId: "",
  appId: "",
  apiV3Key: "",
  serialNo: "",
  notifyUrl: ""
});

const wechatDisplayPrivateKey = computed({
  get: () => {
    if (wechatShowPrivateKey.value) return wechatRawPrivateKey.value;
    return maskValue(wechatRawPrivateKey.value);
  },
  set: (_val: string) => {
    // handled by @input
  }
});

function onWechatPrivateKeyInput(val: string) {
  if (wechatShowPrivateKey.value) {
    wechatRawPrivateKey.value = val;
  } else {
    // When masked, don't allow editing
  }
}

function toggleWechatPrivateKey() {
  wechatShowPrivateKey.value = !wechatShowPrivateKey.value;
}

/* ── 支付宝配置 ── */
const alipayLoading = ref(false);
const alipaySaving = ref(false);
const alipayTesting = ref(false);
const alipayShowPrivateKey = ref(false);
const alipayShowPublicKey = ref(false);
const alipayRawPrivateKey = ref("");
const alipayRawPublicKey = ref("");

interface AlipayConfig {
  enabled: boolean;
  appId: string;
  notifyUrl: string;
}

const alipayConfig = reactive<AlipayConfig>({
  enabled: false,
  appId: "",
  notifyUrl: ""
});

const alipayDisplayPrivateKey = computed({
  get: () => {
    if (alipayShowPrivateKey.value) return alipayRawPrivateKey.value;
    return maskValue(alipayRawPrivateKey.value);
  },
  set: (_val: string) => {}
});

function onAlipayPrivateKeyInput(val: string) {
  if (alipayShowPrivateKey.value) {
    alipayRawPrivateKey.value = val;
  }
}

function toggleAlipayPrivateKey() {
  alipayShowPrivateKey.value = !alipayShowPrivateKey.value;
}

const alipayDisplayPublicKey = computed({
  get: () => {
    if (alipayShowPublicKey.value) return alipayRawPublicKey.value;
    return maskValue(alipayRawPublicKey.value);
  },
  set: (_val: string) => {}
});

function onAlipayPublicKeyInput(val: string) {
  if (alipayShowPublicKey.value) {
    alipayRawPublicKey.value = val;
  }
}

function toggleAlipayPublicKey() {
  alipayShowPublicKey.value = !alipayShowPublicKey.value;
}

/* ── 银行账号 ── */
const bankLoading = ref(false);
const bankAccounts = ref<any[]>([]);
const bankDialogVisible = ref(false);
const isBankEdit = ref(false);
const editingBankId = ref<number | null>(null);
const bankSubmitting = ref(false);
const bankFormRef = ref();

interface BankForm {
  bankName: string;
  accountNo: string;
  accountName: string;
  branchName: string;
  isDefault: boolean;
}

const bankForm = reactive<BankForm>({
  bankName: "",
  accountNo: "",
  accountName: "",
  branchName: "",
  isDefault: false
});

const bankFormRules = {
  bankName: [{ required: true, message: "请输入银行名称", trigger: "blur" }],
  accountNo: [{ required: true, message: "请输入银行账号", trigger: "blur" }],
  accountName: [{ required: true, message: "请输入开户名", trigger: "blur" }],
  branchName: [{ required: true, message: "请输入开户行", trigger: "blur" }]
};

/* ── 脱敏显示 ── */
function maskAccountNo(accountNo: string): string {
  if (!accountNo || accountNo.length <= 4) return accountNo || "";
  return "****" + accountNo.slice(-4);
}

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

/* ── 加载配置 ── */
async function loadWechatConfig() {
  wechatLoading.value = true;
  try {
    const { data } = await api.get("/admin/payment/configs/wechat");
    const cfg = data.data || data;
    if (cfg) {
      wechatConfig.enabled = !!cfg.enabled;
      wechatConfig.mchId = cfg.mchId || "";
      wechatConfig.appId = cfg.appId || "";
      wechatConfig.apiV3Key = cfg.apiV3Key || "";
      wechatConfig.serialNo = cfg.serialNo || "";
      wechatConfig.notifyUrl = cfg.notifyUrl || "";
      wechatRawPrivateKey.value = cfg.privateKey || "";
      wechatShowPrivateKey.value = false;
    }
  } catch {
    // 加载失败时使用默认值
  } finally {
    wechatLoading.value = false;
  }
}

async function loadAlipayConfig() {
  alipayLoading.value = true;
  try {
    const { data } = await api.get("/admin/payment/configs/alipay");
    const cfg = data.data || data;
    if (cfg) {
      alipayConfig.enabled = !!cfg.enabled;
      alipayConfig.appId = cfg.appId || "";
      alipayConfig.notifyUrl = cfg.notifyUrl || "";
      alipayRawPrivateKey.value = cfg.privateKey || "";
      alipayRawPublicKey.value = cfg.alipayPublicKey || "";
      alipayShowPrivateKey.value = false;
      alipayShowPublicKey.value = false;
    }
  } catch {
    // 加载失败时使用默认值
  } finally {
    alipayLoading.value = false;
  }
}

async function loadBankAccounts() {
  bankLoading.value = true;
  try {
    const { data } = await api.get("/admin/payment/bank-accounts");
    bankAccounts.value = data.data || data || [];
  } catch {
    bankAccounts.value = [];
  } finally {
    bankLoading.value = false;
  }
}

/* ── Tab 切换 ── */
function handleTabChange(tab: string) {
  if (tab === "wechat") {
    loadWechatConfig();
  } else if (tab === "alipay") {
    loadAlipayConfig();
  } else if (tab === "bank") {
    loadBankAccounts();
  }
}

/* ── 保存配置 ── */
async function handleSaveConfig(provider: string) {
  if (provider === "wechat") {
    wechatSaving.value = true;
    try {
      await api.put("/admin/payment/configs/wechat", {
        enabled: wechatConfig.enabled ? "1" : "0",
        mchId: wechatConfig.mchId,
        appId: wechatConfig.appId,
        apiV3Key: wechatConfig.apiV3Key,
        privateKey: wechatRawPrivateKey.value,
        serialNo: wechatConfig.serialNo,
        notifyUrl: wechatConfig.notifyUrl
      });
      ElMessage.success("微信支付配置保存成功");
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || "保存失败");
    } finally {
      wechatSaving.value = false;
    }
  } else if (provider === "alipay") {
    alipaySaving.value = true;
    try {
      await api.put("/admin/payment/configs/alipay", {
        enabled: alipayConfig.enabled ? "1" : "0",
        appId: alipayConfig.appId,
        privateKey: alipayRawPrivateKey.value,
        alipayPublicKey: alipayRawPublicKey.value,
        notifyUrl: alipayConfig.notifyUrl
      });
      ElMessage.success("支付宝配置保存成功");
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.message || e?.message || "保存失败");
    } finally {
      alipaySaving.value = false;
    }
  }
}

/* ── 测试连接 ── */
async function handleTestConnection(provider: string) {
  const testingRef = provider === "wechat" ? wechatTesting : alipayTesting;
  testingRef.value = true;

  try {
    const payload: Record<string, unknown> = {
      enabled: provider === "wechat" ? wechatConfig.enabled : alipayConfig.enabled,
      appId: provider === "wechat" ? wechatConfig.appId : alipayConfig.appId,
      notifyUrl: provider === "wechat" ? wechatConfig.notifyUrl : alipayConfig.notifyUrl
    };

    if (provider === "wechat") {
      payload.mchId = wechatConfig.mchId;
      payload.apiV3Key = wechatConfig.apiV3Key;
      payload.privateKey = wechatRawPrivateKey.value;
      payload.serialNo = wechatConfig.serialNo;
    } else {
      payload.privateKey = alipayRawPrivateKey.value;
      payload.alipayPublicKey = alipayRawPublicKey.value;
    }

    await api.post(`/admin/payment/configs/${provider}/test`, payload);
    ElMessage.success(provider === "wechat" ? "微信支付连接测试成功" : "支付宝连接测试成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || "连接测试失败");
  } finally {
    testingRef.value = false;
  }
}

/* ── 银行账号操作 ── */
function handleAddBankAccount() {
  isBankEdit.value = false;
  editingBankId.value = null;
  bankForm.bankName = "";
  bankForm.accountNo = "";
  bankForm.accountName = "";
  bankForm.branchName = "";
  bankForm.isDefault = false;
  bankDialogVisible.value = true;
}

function handleEditBankAccount(row: any) {
  isBankEdit.value = true;
  editingBankId.value = row.id;
  bankForm.bankName = row.bankName || "";
  bankForm.accountNo = row.accountNo || "";
  bankForm.accountName = row.accountName || "";
  bankForm.branchName = row.branchName || "";
  bankForm.isDefault = !!row.isDefault;
  bankDialogVisible.value = true;
}

async function handleBankSubmit() {
  const valid = await bankFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  bankSubmitting.value = true;
  try {
    const payload = {
      bankName: bankForm.bankName,
      accountNo: bankForm.accountNo,
      accountName: bankForm.accountName,
      branchName: bankForm.branchName,
      isDefault: bankForm.isDefault
    };

    if (isBankEdit.value && editingBankId.value) {
      await api.put(`/admin/payment/bank-accounts/${editingBankId.value}`, payload);
      ElMessage.success("银行账号编辑成功");
    } else {
      await api.post("/admin/payment/bank-accounts", payload);
      ElMessage.success("银行账号添加成功");
    }

    bankDialogVisible.value = false;
    await loadBankAccounts();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || "操作失败");
  } finally {
    bankSubmitting.value = false;
  }
}

async function handleDeleteBankAccount(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除银行账号「${row.bankName} - ${maskAccountNo(row.accountNo)}」吗？`,
      "删除确认",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/admin/payment/bank-accounts/${row.id}`);
    ElMessage.success("删除成功");
    await loadBankAccounts();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || "删除失败");
  }
}

async function handleSetDefault(row: any) {
  try {
    await api.put(`/admin/payment/bank-accounts/${row.id}/default`);
    ElMessage.success("设为默认成功");
    await loadBankAccounts();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || "操作失败");
  }
}

/* ── 初始化 ── */
onMounted(() => {
  loadWechatConfig();
});
</script>

<style scoped>
.payment-config-wrapper {
  max-width: 900px;
}

.tab-header {
  margin-bottom: 16px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.switch-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.config-form {
  max-width: 600px;
  padding: 8px 0 0;
}

.config-form .el-form-item {
  margin-bottom: 20px;
}

.skeleton-form {
  padding: 16px 0;
}

.action-bar {
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  gap: 12px;
  max-width: 600px;
}

.bank-header {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-start;
}

.secret-field {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.secret-field .el-input {
  flex: 1;
}

.toggle-btn {
  font-size: 18px;
  padding: 4px;
  margin-top: 2px;
  flex-shrink: 0;
}
</style>