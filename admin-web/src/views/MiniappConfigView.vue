<template>
  <div class="miniapp-config">
    <PageCard title="小程序配置">
      <!-- 平台Tab -->
      <el-tabs v-model="activePlatform" type="card" class="platform-tabs" @tab-change="handlePlatformChange">
        <el-tab-pane v-for="platform in platforms" :key="platform.key" :label="platform.label" :name="platform.key">
          <!-- 加载骨架屏 -->
          <el-skeleton v-if="configLoading" :rows="6" animated />

          <template v-else>
            <!-- 提示信息 -->
            <el-alert
              type="warning"
              show-icon
              :closable="false"
              class="config-alert"
            >
              {{ platformAlertText(platform.key) }}
            </el-alert>

            <!-- 凭证表单 -->
            <el-form
              :ref="(el: any) => setFormRef(platform.key, el)"
              :model="currentConfig"
              :rules="configRules"
              label-width="140px"
              class="config-form"
            >
              <el-form-item label="小程序AppID" prop="appId">
                <el-input v-model="currentConfig.appId" placeholder="请输入小程序AppID" />
              </el-form-item>

              <el-form-item label="小程序AppSecret" prop="appSecret">
                <el-input
                  v-model="currentConfig.appSecret"
                  type="password"
                  show-password
                  placeholder="请输入小程序AppSecret"
                />
              </el-form-item>

              <el-form-item label="小程序名称" prop="appName">
                <el-input v-model="currentConfig.appName" placeholder="请输入小程序名称" />
              </el-form-item>

              <el-form-item label="小程序版本" prop="appVersion">
                <el-input v-model="currentConfig.appVersion" placeholder="请输入小程序版本号" />
              </el-form-item>

              <el-form-item label="小程序描述" prop="appDescription">
                <el-input v-model="currentConfig.appDescription" placeholder="请输入小程序描述" />
              </el-form-item>

              <el-form-item label="小程序图标" prop="appIcon">
                <el-input v-model="currentConfig.appIcon" placeholder="请输入图标URL" />
              </el-form-item>

              <el-form-item label="状态">
                <el-select v-model="currentConfig.status" style="width: 200px">
                  <el-option label="草稿" value="draft" />
                  <el-option label="已发布" value="published" />
                </el-select>
              </el-form-item>

              <el-form-item>
                <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
              </el-form-item>
            </el-form>
          </template>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 模板选择 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">小程序模板</span>
      </template>

      <el-skeleton v-if="templateLoading" :rows="3" animated />

      <template v-else>
        <el-row :gutter="20">
          <el-col
            v-for="tpl in templates"
            :key="tpl.id"
            :span="8"
          >
            <div
              class="template-card"
              :class="{ selected: selectedTemplate?.id === tpl.id }"
              @click="selectTemplate(tpl)"
            >
              <div class="template-thumb" :style="{ background: tpl.bgColor }">
                <span class="template-icon">{{ tpl.icon }}</span>
              </div>
              <div class="template-info">
                <div class="template-name">
                  {{ tpl.name }}
                  <el-icon v-if="selectedTemplate?.id === tpl.id" class="check-icon"><Check /></el-icon>
                </div>
                <div class="template-desc">{{ tpl.description }}</div>
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 模板预览弹窗 -->
        <el-dialog v-model="previewVisible" title="模板预览" width="800px">
          <div class="preview-placeholder">
            <div class="preview-bg" :style="{ background: selectedTemplate?.bgColor }">
              <span class="preview-icon">{{ selectedTemplate?.icon }}</span>
              <p class="preview-name">{{ selectedTemplate?.name }}</p>
              <p class="preview-desc">{{ selectedTemplate?.description }}</p>
            </div>
          </div>
        </el-dialog>
      </template>
    </el-card>

    <!-- 一键发布 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">一键发布</span>
      </template>

      <div class="publish-area">
        <div class="publish-version">
          <span class="publish-label">发布版本（选填）：</span>
          <el-input
            v-model="publishVersion"
            placeholder="例如：1.2.0，留空则自动生成"
            style="width: 260px"
            clearable
          />
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="publishing"
          :disabled="!currentConfig.appId"
          @click="handlePublish"
        >
          {{ publishing ? '发布中...' : '一键发布' }}
        </el-button>
      </div>

      <!-- 发布结果弹窗 -->
      <el-dialog v-model="publishResultVisible" :title="publishSuccess ? '发布成功' : '发布失败'" width="480px" :close-on-click-modal="false">
        <div class="publish-result">
          <div class="result-icon" :class="publishSuccess ? 'success' : 'failed'">
            <el-icon :size="48">
              <CircleCheck v-if="publishSuccess" />
              <CircleClose v-else />
            </el-icon>
          </div>
          <template v-if="publishSuccess">
            <p class="result-version">版本号：{{ publishResultData.version }}</p>
            <p class="result-time">发布时间：{{ publishResultData.publishedAt }}</p>
          </template>
          <template v-else>
            <p class="result-error">{{ publishResultData.errorMsg }}</p>
          </template>
        </div>
        <template #footer>
          <el-button type="primary" @click="publishResultVisible = false">确定</el-button>
        </template>
      </el-dialog>
    </el-card>

    <!-- 发布历史 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">发布历史</span>
      </template>

      <el-table
        :data="publishLogs"
        v-loading="logsLoading"
        stripe
        class="history-table"
      >
        <el-table-column prop="createdAt" label="时间" min-width="180" />
        <el-table-column prop="version" label="版本" width="120" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'success'" type="success">发布成功</el-tag>
            <el-tag v-else-if="row.status === 'failed'" type="danger">发布失败</el-tag>
            <el-tag v-else-if="row.status === 'publishing'" type="primary">
              <el-icon class="is-loading"><Loading /></el-icon>
              发布中
            </el-tag>
            <el-tag v-else type="info">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" min-width="200" show-overflow-tooltip />
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="logsPage"
          v-model:page-size="logsPageSize"
          :total="logsTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadPublishLogs"
          @current-change="loadPublishLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../api";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Check, CircleCheck, CircleClose, Loading } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";

// ==================== 平台定义 ====================
const platforms = [
  { key: "wechat", label: "微信小程序" },
  { key: "alipay", label: "支付宝小程序" },
  { key: "douyin", label: "抖音小程序" },
  { key: "kuaishou", label: "快手小程序" },
];

function platformAlertText(key: string): string {
  const map: Record<string, string> = {
    wechat: "注意：此处填写的是微信「小程序」AppID，来自 mp.weixin.qq.com（公众平台），不是支付 AppID",
    alipay: "注意：此处填写的是支付宝「小程序」AppID，来自 open.alipay.com（开放平台），不是支付 AppID",
    douyin: "注意：此处填写的是抖音「小程序」AppID，来自 developer.open-douyin.com（开放平台），不是支付 AppID",
    kuaishou: "注意：此处填写的是快手「小程序」AppID，来自 open.kuaishou.com（开放平台），不是支付 AppID",
  };
  return map[key] || "";
}

// ==================== Phase B：小程序配置 ====================
const activePlatform = ref("wechat");
const configLoading = ref(false);
const saving = ref(false);

const configs = reactive<Record<string, { appId: string; appSecret: string; appName: string; appVersion: string; appDescription: string; appIcon: string; status: string }>>({
  wechat: { appId: "", appSecret: "", appName: "", appVersion: "", appDescription: "", appIcon: "", status: "draft" },
  alipay: { appId: "", appSecret: "", appName: "", appVersion: "", appDescription: "", appIcon: "", status: "draft" },
  douyin: { appId: "", appSecret: "", appName: "", appVersion: "", appDescription: "", appIcon: "", status: "draft" },
  kuaishou: { appId: "", appSecret: "", appName: "", appVersion: "", appDescription: "", appIcon: "", status: "draft" },
});

const currentConfig = computed(() => configs[activePlatform.value]);

const configRules: FormRules = {
  appId: [{ required: true, message: "请输入小程序AppID", trigger: "blur" }],
  appSecret: [{ required: true, message: "请输入小程序AppSecret", trigger: "blur" }],
  appName: [{ required: true, message: "请输入小程序名称", trigger: "blur" }],
};

const formRefs: Record<string, FormInstance | null> = {
  wechat: null,
  alipay: null,
  douyin: null,
  kuaishou: null,
};

function setFormRef(platform: string, el: any) {
  formRefs[platform] = el;
}

async function loadConfig(platform: string) {
  configLoading.value = true;
  try {
    const { data: res } = await api.get(`/admin/miniapp/configs/${platform}`);
    if (res?.data) {
      configs[platform] = {
        appId: res.data.appId || "",
        appSecret: res.data.appSecret || "",
        appName: res.data.appName || "",
        appVersion: res.data.appVersion || "",
        appDescription: res.data.appDescription || "",
        appIcon: res.data.appIcon || "",
        status: res.data.status || "draft",
      };
    }
  } catch {
    // 首次加载可能无配置，使用默认空值
  } finally {
    configLoading.value = false;
  }
}

function handlePlatformChange(platform: string) {
  loadConfig(platform);
}

async function saveConfig() {
  const formRef = formRefs[activePlatform.value];
  if (!formRef) return;

  formRef.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await api.put(`/admin/miniapp/configs/${activePlatform.value}`, {
        ...currentConfig.value,
      });
      ElMessage.success("保存成功");
    } catch {
      ElMessage.error("保存失败，请稍后重试");
    } finally {
      saving.value = false;
    }
  });
}

// ==================== Phase C：模板选择 ====================
interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  bgColor: string;
}

const templateLoading = ref(false);
const templates = ref<Template[]>([]);
const selectedTemplate = ref<Template | null>(null);
const previewVisible = ref(false);

async function loadTemplates() {
  templateLoading.value = true;
  try {
    const { data: res } = await api.get("/admin/miniapp/templates");
    if (res?.data) {
      templates.value = res.data;
    }
  } catch {
    // 接口不可用时使用默认模板
    templates.value = [
      { id: "standard", name: "标准模板", description: "简洁布局，适合零售门店", icon: "🏪", bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
      { id: "featured", name: "精选模板", description: "图文混排，适合品牌展示", icon: "✨", bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
      { id: "premium", name: "高级模板", description: "全屏轮播，适合高端酒水", icon: "🥂", bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
    ];
  } finally {
    templateLoading.value = false;
  }
}

function selectTemplate(tpl: Template) {
  selectedTemplate.value = tpl;
  previewVisible.value = true;
}

// ==================== Phase C：一键发布 ====================
const publishing = ref(false);
const publishVersion = ref("");
const publishResultVisible = ref(false);
const publishSuccess = ref(false);
const publishResultData = reactive({
  version: "",
  publishedAt: "",
  errorMsg: "",
});

async function handlePublish() {
  publishing.value = true;
  try {
    const { data: res } = await api.post("/admin/miniapp/publish", {
      platform: activePlatform.value,
      templateId: selectedTemplate.value?.id || "",
      version: publishVersion.value || undefined,
    });
    publishSuccess.value = true;
    publishResultData.version = res?.data?.version || publishVersion.value || "1.0.0";
    publishResultData.publishedAt = res?.data?.publishedAt || new Date().toLocaleString("zh-CN");
    publishResultData.errorMsg = "";
    ElMessage.success("发布成功");
    publishVersion.value = "";
    loadPublishLogs();
  } catch (err: any) {
    publishSuccess.value = false;
    publishResultData.errorMsg = err?.response?.data?.message || err?.message || "发布失败，请稍后重试";
    publishResultData.version = "";
    publishResultData.publishedAt = "";
    ElMessage.error("发布失败");
  } finally {
    publishing.value = false;
    publishResultVisible.value = true;
  }
}

// ==================== Phase C：发布历史 ====================
const logsLoading = ref(false);
const publishLogs = ref<any[]>([]);
const logsPage = ref(1);
const logsPageSize = ref(10);
const logsTotal = ref(0);

async function loadPublishLogs() {
  logsLoading.value = true;
  try {
    const { data: res } = await api.get("/admin/miniapp/publish-logs", {
      params: {
        page: logsPage.value,
        pageSize: logsPageSize.value,
      },
    });
    if (res?.data) {
      publishLogs.value = res.data.list || res.data.records || [];
      logsTotal.value = res.data.total || 0;
    }
  } catch {
    // 接口不可用时展示空列表
    publishLogs.value = [];
    logsTotal.value = 0;
  } finally {
    logsLoading.value = false;
  }
}

// ==================== 初始化 ====================
onMounted(() => {
  loadConfig(activePlatform.value);
  loadTemplates();
  loadPublishLogs();
});
</script>

<style scoped>
.miniapp-config {
  padding: 20px;
}

.platform-tabs {
  --el-tabs-header-height: 48px;
}

.config-alert {
  margin-bottom: 24px;
  max-width: 600px;
}

.config-form {
  max-width: 600px;
  padding-top: 8px;
}

.section-card {
  margin-bottom: 16px;
}

.section-title {
  font-weight: 600;
  font-size: 16px;
}

/* 模板卡片 */
.template-card {
  border: 2px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  min-height: 200px;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.template-card.selected {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.25);
}

.template-thumb {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-icon {
  font-size: 48px;
}

.template-info {
  padding: 16px;
  background: #fff;
}

.template-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.check-icon {
  color: #409eff;
  font-size: 18px;
}

.template-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

/* 模板预览 */
.preview-placeholder {
  width: 100%;
}

.preview-bg {
  width: 100%;
  height: 400px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.preview-icon {
  font-size: 80px;
  margin-bottom: 16px;
}

.preview-name {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.preview-desc {
  font-size: 16px;
  margin: 0;
  opacity: 0.9;
}

/* 发布区域 */
.publish-area {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 0;
}

.publish-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.publish-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

/* 发布结果 */
.publish-result {
  text-align: center;
  padding: 20px 0;
}

.result-icon {
  margin-bottom: 16px;
}

.result-icon.success {
  color: #67c23a;
}

.result-icon.failed {
  color: #f56c6c;
}

.result-version {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.result-time {
  font-size: 14px;
  margin: 0;
  color: var(--el-text-color-secondary);
}

.result-error {
  font-size: 14px;
  margin: 0;
  color: #f56c6c;
}

/* 发布历史 */
.history-table {
  margin-bottom: 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>