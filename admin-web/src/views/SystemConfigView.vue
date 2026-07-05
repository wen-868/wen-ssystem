<template>
  <PageCard title="参数配置">
    <div class="config-wrapper">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="通用配置" name="general">
          <el-form ref="formRef" :model="configs" :rules="rules" label-width="140px" class="config-form">
            <el-form-item label="公司名称" prop="company_name">
              <div class="config-field">
                <el-input v-model="configs.company_name" placeholder="请输入公司名称" style="width: 320px" />
                <span class="tip-text">用于系统头部及报表展示</span>
              </div>
            </el-form-item>
            <el-form-item label="公司Logo">
              <div class="config-field">
                <div class="logo-upload">
                  <el-upload
                    class="logo-uploader"
                    action="#"
                    :show-file-list="false"
                    :before-upload="handleLogoBeforeUpload"
                    :http-request="() => {}"
                  >
                    <img v-if="configs.company_logo" :src="configs.company_logo" class="logo-preview" />
                    <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
                  </el-upload>
                  <span class="tip-text">建议尺寸 200x60px，支持 PNG/JPG</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="联系电话">
              <div class="config-field">
                <el-input v-model="configs.contact_phone" placeholder="请输入联系电话" style="width: 320px" />
                <span class="tip-text">用于客户联系及售后热线展示</span>
              </div>
            </el-form-item>
            <el-form-item label="系统主题色">
              <div class="config-field">
                <el-color-picker v-model="configs.theme_color" show-alpha />
                <span class="tip-text">设置系统全局主题色，默认 #1677FF</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="订单配置" name="order">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="自动接单">
              <div class="config-field">
                <el-switch v-model="configs.auto_accept_order" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后新订单将自动确认接单</span>
              </div>
            </el-form-item>
            <el-form-item label="订单超时时间">
              <div class="config-field">
                <el-input-number v-model="configs.order_timeout_minutes" :min="1" :max="1440" style="width: 160px" />
                <span class="suffix-text">分钟后</span>
                <span class="tip-text">订单超过此时间未处理将自动提醒</span>
              </div>
            </el-form-item>
            <el-form-item label="订单自动取消时间">
              <div class="config-field">
                <el-input-number v-model="configs.auto_cancel_minutes" :min="1" :max="10080" style="width: 160px" />
                <span class="suffix-text">分钟后</span>
                <span class="tip-text">订单超过此时间未支付将自动取消</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="支付配置" name="payment">
          <el-form label-width="140px" class="config-form">
            <el-form-item label="微信支付">
              <div class="config-field">
                <el-switch v-model="configs.wechat_pay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持微信扫码支付</span>
              </div>
            </el-form-item>
            <el-form-item label="支付宝">
              <div class="config-field">
                <el-switch v-model="configs.alipay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持支付宝扫码支付</span>
              </div>
            </el-form-item>
            <el-form-item label="线下支付">
              <div class="config-field">
                <el-switch v-model="configs.offline_pay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持现金及线下转账支付</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="库存配置" name="inventory">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="低库存预警阈值">
              <div class="config-field">
                <el-input-number v-model="configs.low_stock_threshold" :min="1" :max="99999" style="width: 160px" />
                <span class="tip-text">库存低于此数量时触发预警通知</span>
              </div>
            </el-form-item>
            <el-form-item label="保质期预警天数">
              <div class="config-field">
                <el-input-number v-model="configs.expiry_warning_days" :min="1" :max="365" style="width: 160px" />
                <span class="tip-text">距保质期不足此天数时触发预警</span>
              </div>
            </el-form-item>
            <el-form-item label="自动补货">
              <div class="config-field">
                <el-switch v-model="configs.auto_replenish" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后库存不足时自动生成采购建议</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="通知配置" name="notification">
          <el-form label-width="140px" class="config-form">
            <el-form-item label="短信通知">
              <div class="config-field">
                <el-switch v-model="configs.sms_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过短信发送订单及库存预警通知</span>
              </div>
            </el-form-item>
            <el-form-item label="微信通知">
              <div class="config-field">
                <el-switch v-model="configs.wechat_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过微信公众号发送相关通知</span>
              </div>
            </el-form-item>
            <el-form-item label="站内信">
              <div class="config-field">
                <el-switch v-model="configs.site_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过系统站内信发送通知</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="action-bar">
        <el-button type="primary" :loading="saveLoading" @click="handleSave">保存</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { api } from "../api";

const activeTab = ref("general");
const saveLoading = ref(false);
const formRef = ref();
const rules = {
  company_name: [{ required: true, message: "请输入公司名称", trigger: "blur" }]
};

/* ── 默认配置值 ── */
const defaultConfigs: Record<string, string> = {
  company_name: "",
  company_logo: "",
  contact_phone: "",
  theme_color: "#1677FF",
  auto_accept_order: "0",
  order_timeout_minutes: "30",
  auto_cancel_minutes: "120",
  wechat_pay: "1",
  alipay: "1",
  offline_pay: "1",
  low_stock_threshold: "10",
  expiry_warning_days: "7",
  auto_replenish: "0",
  sms_notify: "1",
  wechat_notify: "1",
  site_notify: "1"
};

const configs = reactive<Record<string, string>>({ ...defaultConfigs });

/* ── 分组与 Tab 名映射 ── */
const tabGroupMap: Record<string, string> = {
  general: "general",
  order: "order",
  payment: "payment",
  inventory: "inventory",
  notification: "notification"
};

/* ── 加载指定分组配置 ── */
async function loadConfigGroup(group: string) {
  try {
    const { data } = await api.get(`/admin/system/configs/${group}`);
    const items = data.data || data || [];
    const list = Array.isArray(items) ? items : (items.records || items || []);
    for (const item of list) {
      if (item.config_key && item.config_key in configs) {
        configs[item.config_key] = String(item.config_value ?? "");
      }
    }
  } catch {
    // 加载失败时使用默认值
  }
}

/* ── 加载所有分组配置 ── */
async function loadAllConfigs() {
  await Promise.all(Object.values(tabGroupMap).map((g) => loadConfigGroup(g)));
}

/* ── Tab 切换时加载当前分组 ── */
function handleTabChange(tab: string) {
  const group = tabGroupMap[tab];
  if (group) {
    loadConfigGroup(group);
  }
}

/* ── 保存所有配置 ── */
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  saveLoading.value = true;
  try {
    const payload = Object.entries(configs).map(([key, value]) => ({
      config_key: key,
      config_value: String(value)
    }));
    await api.put("/admin/system/configs/batch", payload);
    ElMessage.success("配置保存成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

/* ── 重置为默认值 ── */
function handleReset() {
  Object.assign(configs, defaultConfigs);
}

/* ── Logo 上传前处理 ── */
function handleLogoBeforeUpload(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    configs.company_logo = (e.target?.result as string) || "";
  };
  reader.readAsDataURL(file);
  return false;
}

onMounted(() => {
  loadAllConfigs();
});
</script>

<style scoped>
.config-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.config-form {
  padding: 16px 0 0;
}

.config-form .el-form-item {
  margin-bottom: 22px;
}

.config-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tip-text {
  color: #9CA3AF;
  font-size: 13px;
  white-space: nowrap;
}

.suffix-text {
  color: #4B5563;
  font-size: 14px;
}

.logo-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-uploader {
  width: 200px;
  height: 60px;
  border: 1px dashed #D1D5DB;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s;
}

.logo-uploader:hover {
  border-color: #1677FF;
}

.logo-uploader-icon {
  font-size: 24px;
  color: #9CA3AF;
}

.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.action-bar {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>