<template>
  <div class="page-container">
    <h2 class="page-title">消息配置</h2>
    <p class="page-desc">总台统一管理短信与邮件通道，商户端无需重复配置</p>

    <el-tabs v-model="activeTab">
      <!-- 短信配置 -->
      <el-tab-pane label="短信配置" name="sms">
        <el-form :model="smsConfig" label-width="150px" style="max-width: 720px; padding: 16px 0">
          <el-form-item label="短信验证开关">
            <el-switch v-model="smsConfig.sms_verify_enabled" active-value="1" inactive-value="0" />
            <span class="tip">开启后租户注册需短信验证码；短信平台未就绪前保持关闭</span>
          </el-form-item>
          <el-form-item label="短信服务商">
            <el-select v-model="smsConfig.sms_provider" style="width: 240px">
              <el-option label="阿里云" value="aliyun" />
              <el-option label="腾讯云" value="tencent" />
            </el-select>
          </el-form-item>
          <el-form-item label="AccessKey ID">
            <el-input v-model="smsConfig.sms_access_key" style="width: 360px" placeholder="AccessKey ID" />
          </el-form-item>
          <el-form-item label="AccessKey Secret">
            <el-input v-model="smsConfig.sms_secret_key" type="password" show-password style="width: 360px" placeholder="AccessKey Secret" />
          </el-form-item>
          <el-form-item label="短信签名">
            <el-input v-model="smsConfig.sms_sign_name" style="width: 360px" placeholder="短信签名（平台审核）" />
          </el-form-item>
          <el-form-item v-if="smsConfig.sms_provider === 'tencent'" label="SdkAppId">
            <el-input v-model="smsConfig.sms_sdk_app_id" style="width: 360px" placeholder="腾讯云短信 SdkAppId" />
          </el-form-item>
        </el-form>

        <el-divider content-position="left">短信模板</el-divider>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px">
          <el-button type="primary" size="small" @click="openTemplate()">新增模板</el-button>
        </div>
        <el-table :data="templates" border size="small" style="max-width: 960px">
          <el-table-column prop="name" label="模板名称" width="140" />
          <el-table-column prop="code" label="模板编码" width="160" />
          <el-table-column prop="content" label="模板内容" min-width="260" />
          <el-table-column prop="purpose" label="用途" width="120" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" size="small">
                {{ row.status === 'ENABLED' ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openTemplate(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="removeTemplate(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 邮件配置 -->
      <el-tab-pane label="邮件配置" name="mail">
        <el-form :model="mailConfig" label-width="150px" style="max-width: 720px; padding: 16px 0">
          <el-form-item label="SMTP服务器">
            <el-input v-model="mailConfig.smtp_host" style="width: 360px" placeholder="如 smtp.qq.com" />
          </el-form-item>
          <el-form-item label="SMTP端口">
            <el-input-number v-model="mailConfig.smtp_port" :min="1" :max="65535" style="width: 200px" />
          </el-form-item>
          <el-form-item label="邮箱账号">
            <el-input v-model="mailConfig.smtp_username" style="width: 360px" placeholder="发件邮箱账号" />
          </el-form-item>
          <el-form-item label="邮箱密码">
            <el-input v-model="mailConfig.smtp_password" type="password" show-password style="width: 360px" />
          </el-form-item>
          <el-form-item label="发件人地址">
            <el-input v-model="mailConfig.mail_from_address" style="width: 360px" placeholder="如 service@example.com" />
          </el-form-item>
          <el-form-item label="发件人名称">
            <el-input v-model="mailConfig.mail_from_name" style="width: 360px" placeholder="发件人名称" />
          </el-form-item>
          <el-form-item label="SSL">
            <el-switch v-model="mailConfig.smtp_ssl" active-value="1" inactive-value="0" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div style="margin-top: 16px">
      <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
    </div>

    <!-- 模板弹窗 -->
    <el-dialog v-model="templateVisible" :title="templateForm.id ? '编辑模板' : '新增模板'" width="560px">
      <el-form :model="templateForm" label-width="90px">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="模板名称" />
        </el-form-item>
        <el-form-item label="模板编码">
          <el-input v-model="templateForm.code" placeholder="服务商模板CODE" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="templateForm.purpose" placeholder="如 REGISTER" />
        </el-form-item>
        <el-form-item label="模板内容">
          <el-input v-model="templateForm.content" type="textarea" :rows="4" placeholder="短信模板内容，变量用 ${code} 表示" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import request from "../utils/request";

const activeTab = ref("sms");
const saving = ref(false);

const smsConfig = reactive<Record<string, string>>({
  sms_verify_enabled: "0",
  sms_provider: "",
  sms_access_key: "",
  sms_secret_key: "",
  sms_sign_name: "",
  sms_sdk_app_id: "",
});

const mailConfig = reactive<Record<string, string>>({
  smtp_host: "",
  smtp_port: "465",
  smtp_username: "",
  smtp_password: "",
  mail_from_address: "",
  mail_from_name: "",
  smtp_ssl: "1",
});

const templates = ref<any[]>([]);
const templateVisible = ref(false);
const templateForm = reactive<any>({ id: 0, name: "", code: "", content: "", purpose: "" });

async function loadConfig() {
  try {
    const res: any = await request.get("/platform/msg-config");
    const cfg = res.data || {};
    Object.assign(smsConfig, { ...smsConfig, ...cfg });
    Object.assign(mailConfig, { ...mailConfig, ...cfg });
    const tplRes: any = await request.get("/platform/sms-templates");
    templates.value = tplRes.data || [];
  } catch {
    /* 忽略加载失败 */
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const items = [
      ...Object.entries(smsConfig).map(([k, v]) => ({ config_key: k, config_value: String(v) })),
      ...Object.entries(mailConfig).map(([k, v]) => ({ config_key: k, config_value: String(v) })),
    ];
    await request.put("/platform/msg-config", items);
    ElMessage.success("配置已保存");
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    saving.value = false;
  }
}

function openTemplate(row?: any) {
  Object.assign(templateForm, {
    id: row?.id || 0,
    name: row?.name || "",
    code: row?.code || "",
    content: row?.content || "",
    purpose: row?.purpose || "",
  });
  templateVisible.value = true;
}

async function handleSaveTemplate() {
  saving.value = true;
  try {
    const payload = {
      name: templateForm.name,
      code: templateForm.code,
      content: templateForm.content,
      purpose: templateForm.purpose,
      status: "ENABLED",
    };
    if (templateForm.id) {
      await request.put(`/platform/sms-templates/${templateForm.id}`, payload);
    } else {
      await request.post("/platform/sms-templates", payload);
    }
    ElMessage.success("保存成功");
    templateVisible.value = false;
    const tplRes: any = await request.get("/platform/sms-templates");
    templates.value = tplRes.data || [];
  } catch {
    /* 拦截器提示 */
  } finally {
    saving.value = false;
  }
}

async function removeTemplate(row: any) {
  try {
    await request.delete(`/platform/sms-templates/${row.id}`);
    templates.value = templates.value.filter((t) => t.id !== row.id);
    ElMessage.success("已删除");
  } catch {
    /* 拦截器提示 */
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-title {
  margin: 0 0 4px;
}
.page-desc {
  margin: 0 0 16px;
  color: #909399;
  font-size: 13px;
}
.tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}
</style>
