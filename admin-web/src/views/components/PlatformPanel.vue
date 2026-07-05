<template>
  <div class="platform-panel">
    <el-card class="status-card" shadow="never">
      <div class="status-bar">
        <div class="status-left">
          <span class="platform-icon" :style="{ background: platform.color + '20', color: platform.color }">
            {{ platform.icon }}
          </span>
          <span class="platform-name">{{ platform.name }}</span>
          <span class="status-dot" :class="statusClass"></span>
          <span class="status-text" :class="statusClass">{{ statusText }}</span>
        </div>
        <div class="status-right">
          <el-switch v-model="localPlatform.enabled" active-text="启用" inactive-text="停用" @change="handleEnableChange" />
          <div class="status-info">
            <span class="info-label">最后连接：</span>
            <span class="info-value">{{ platform.lastConnectTime }}</span>
          </div>
          <div class="status-info">
            <span class="info-label">Token过期：</span>
            <span class="info-value" :class="{ 'expire-warning': isTokenExpiringSoon }">{{ platform.tokenExpireTime }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="section-header">
          <span class="section-title">密钥配置</span>
        </div>
      </template>
      <el-form ref="configFormRef" :model="localPlatform" :rules="configRules" label-width="100px" class="config-form">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="App Key" prop="appKey">
              <el-input v-model="localPlatform.appKey" placeholder="请输入App Key" show-password />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="App Secret" prop="appSecret">
              <el-input v-model="localPlatform.appSecret" type="password" placeholder="请输入App Secret" show-password />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商户ID" prop="merchantId">
              <el-input v-model="localPlatform.merchantId" placeholder="请输入商户ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="绑定门店" prop="storeId">
              <el-select v-model="localPlatform.storeId" placeholder="请选择门店" style="width: 100%">
                <el-option label="旗舰店（总店）" value="store_001" />
                <el-option label="美团专属店" value="store_002" />
                <el-option label="饿了么优选店" value="store_003" />
                <el-option label="社区店" value="store_004" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-collapse class="advanced-collapse">
          <el-collapse-item title="高级配置（JSON）" name="advanced">
            <el-input
              v-model="localPlatform.advancedConfig"
              type="textarea"
              :rows="6"
              placeholder='{"key": "value"}'
              class="json-textarea"
            />
          </el-collapse-item>
        </el-collapse>
        <div class="action-buttons">
          <el-button type="primary" :loading="saveLoading" @click="handleSave">保存配置</el-button>
          <el-button :loading="testLoading" @click="handleTestConnection">测试连接</el-button>
          <el-alert
            v-if="testResult !== null"
            :title="testResult.success ? '连接成功' : '连接失败'"
            :type="testResult.success ? 'success' : 'error'"
            :description="testResult.message"
            show-icon
            class="test-result"
          />
        </div>
      </el-form>
    </el-card>

    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="section-header">
          <span class="section-title">Webhook 配置</span>
        </div>
      </template>
      <el-form label-width="100px">
        <el-form-item label="回调URL">
          <el-input :value="platform.webhookUrl" readonly>
            <template #append>
              <el-button @click="copyWebhookUrl">复制</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="验签说明">
          <div class="sign-desc">
            <p>1. 平台回调时会在 Header 中携带签名参数</p>
            <p>2. 请使用下方签名密钥进行验签，确保回调来源可信</p>
            <p>3. 建议定期更换签名密钥以保障安全</p>
          </div>
        </el-form-item>
        <el-form-item label="签名密钥">
          <el-input :value="localPlatform.signSecret" readonly show-password>
            <template #append>
              <el-button @click="regenerateSignSecret">重新生成</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="section-header">
          <span class="section-title">同步操作</span>
          <div class="section-actions">
            <el-button size="small" :loading="syncOrderLoading" @click="handleSyncOrders">手动同步订单</el-button>
            <el-button size="small" :loading="syncProductLoading" @click="handleSyncProducts">手动同步商品</el-button>
          </div>
        </div>
      </template>
      <el-table :data="localPlatform.syncLogs" stripe style="width: 100%">
        <el-table-column prop="type" label="同步类型" width="120" />
        <el-table-column prop="time" label="同步时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '成功' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="同步数量" width="120" />
        <el-table-column prop="remark" label="备注" />
        <template #empty>
          <el-empty description="暂无同步记录" :image-size="60" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, type FormRules } from "element-plus";

interface PlatformData {
  key: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  status: string;
  lastConnectTime: string;
  tokenExpireTime: string;
  appKey: string;
  appSecret: string;
  merchantId: string;
  storeId: string;
  storeName: string;
  advancedConfig: string;
  webhookUrl: string;
  signSecret: string;
  syncLogs: Array<{
    id: number;
    type: string;
    time: string;
    status: string;
    count: number;
    remark?: string;
  }>;
}

const props = defineProps<{
  platform: PlatformData;
}>();

const localPlatform = reactive({ ...props.platform });

const configFormRef = ref();
const configRules: FormRules = {
  appKey: [{ required: true, message: "请输入App Key", trigger: "blur" }],
  appSecret: [{ required: true, message: "请输入App Secret", trigger: "blur" }],
  merchantId: [{ required: true, message: "请输入商户ID", trigger: "blur" }],
  storeId: [{ required: true, message: "请选择绑定门店", trigger: "change" }],
};

const saveLoading = ref(false);
const testLoading = ref(false);
const syncOrderLoading = ref(false);
const syncProductLoading = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const statusClass = computed(() => {
  if (!localPlatform.enabled) return "status-gray";
  if (localPlatform.status === "connected") return "status-green";
  return "status-red";
});

const statusText = computed(() => {
  if (!localPlatform.enabled) return "已停用";
  if (localPlatform.status === "connected") return "已连接";
  return "连接失败";
});

const isTokenExpiringSoon = computed(() => {
  if (localPlatform.tokenExpireTime === "-") return false;
  const expireDate = new Date(localPlatform.tokenExpireTime);
  const now = new Date();
  const diffDays = (expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < 30 && diffDays > 0;
});

function handleEnableChange(val: boolean) {
  ElMessage.info(`${val ? "启用" : "停用"}${localPlatform.name}`);
}

async function handleSave() {
  const valid = await configFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  saveLoading.value = true;
  testResult.value = null;
  setTimeout(() => {
    saveLoading.value = false;
    ElMessage.success("配置保存成功");
  }, 1000);
}

function handleTestConnection() {
  testLoading.value = true;
  testResult.value = null;
  setTimeout(() => {
    testLoading.value = false;
    const success = Math.random() > 0.3;
    testResult.value = {
      success,
      message: success ? "连接成功，API响应正常" : "连接失败，请检查App Key和App Secret是否正确"
    };
  }, 1500);
}

function copyWebhookUrl() {
  navigator.clipboard.writeText(localPlatform.webhookUrl);
  ElMessage.success("已复制到剪贴板");
}

function regenerateSignSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  localPlatform.signSecret = result;
  ElMessage.success("签名密钥已重新生成");
}

function handleSyncOrders() {
  syncOrderLoading.value = true;
  setTimeout(() => {
    syncOrderLoading.value = false;
    const count = Math.floor(Math.random() * 50) + 10;
    localPlatform.syncLogs.unshift({
      id: Date.now(),
      type: "订单",
      time: new Date().toLocaleString("zh-CN"),
      status: "成功",
      count
    });
    ElMessage.success(`订单同步完成，共同步 ${count} 条订单`);
  }, 2000);
}

function handleSyncProducts() {
  syncProductLoading.value = true;
  setTimeout(() => {
    syncProductLoading.value = false;
    const count = Math.floor(Math.random() * 200) + 50;
    localPlatform.syncLogs.unshift({
      id: Date.now(),
      type: "商品",
      time: new Date().toLocaleString("zh-CN"),
      status: "成功",
      count
    });
    ElMessage.success(`商品同步完成，共同步 ${count} 个商品`);
  }, 2500);
}
</script>

<style scoped>
.platform-panel {
  padding: 16px 0;
}
.status-card {
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
}
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.platform-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.platform-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.status-dot.status-green {
  background: #67c23a;
  box-shadow: 0 0 6px #67c23a;
}
.status-dot.status-red {
  background: #f56c6c;
}
.status-dot.status-gray {
  background: #c0c4cc;
}
.status-text {
  font-size: 13px;
}
.status-text.status-green {
  color: #67c23a;
}
.status-text.status-red {
  color: #f56c6c;
}
.status-text.status-gray {
  color: #909399;
}
.status-right {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.status-info {
  display: flex;
  align-items: center;
  font-size: 13px;
}
.info-label {
  color: #909399;
}
.info-value {
  color: #606266;
  margin-left: 4px;
}
.info-value.expire-warning {
  color: #e6a23c;
  font-weight: 500;
}
.section-card {
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.section-actions {
  display: flex;
  gap: 8px;
}
.config-form {
  margin-top: 8px;
}
.advanced-collapse {
  margin: 8px 0 16px;
}
.json-textarea {
  font-family: "Courier New", monospace;
  font-size: 13px;
}
.action-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.test-result {
  flex: 1;
  min-width: 200px;
}
.sign-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
  background: #f5f7fa;
  padding: 12px 16px;
  border-radius: 4px;
}
.sign-desc p {
  margin: 0;
}
</style>
