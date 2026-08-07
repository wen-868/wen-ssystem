<template>
  <div class="miniapp-config">
    <PageCard title="小程序配置">
      <!-- 平台Tab -->
      <el-tabs v-model="activePlatform" type="card" class="platform-tabs" @tab-change="handlePlatformChange">
        <el-tab-pane v-for="platform in platforms" :key="platform.key" :label="platform.label" :name="platform.key">
          <!-- 加载骨架屏 -->
          <el-skeleton v-if="configLoading" :rows="6" animated />

          <template v-else>
            <!-- 微信发布限制提示 -->
            <el-alert
              type="info"
              show-icon
              :closable="false"
              class="config-alert"
              title="一键发布后为「体验版」；提交审核与发布上线是微信公众平台强制流程，系统会在发布成功后提供提交审核入口"
              :description="platformAlertText(platform.key)"
            />

            <!-- ① 模板选择 -->
            <el-card class="section-card" shadow="never">
              <template #header>
                <span class="section-title"><span class="step-no">1</span>选择模板</span>
              </template>

              <el-skeleton v-if="templateLoading" :rows="3" animated />

              <template v-else>
                <el-empty v-if="templates.length === 0" description="暂无可用模板，请先执行模板种子迁移" />
                <el-row v-else :gutter="20">
                  <el-col v-for="tpl in templates" :key="tpl.id" :span="8">
                    <div
                      class="template-card"
                      :class="{ selected: selectedTemplate?.id === tpl.id }"
                      @click="selectTemplate(tpl)"
                    >
                      <div class="template-thumb" :style="templateGradient(tpl)">
                        <span class="template-icon">{{ themeIcon(tpl.theme) }}</span>
                        <span class="template-thumb-name">{{ tpl.name }}</span>
                      </div>
                      <div class="template-info">
                        <div class="template-name">
                          {{ tpl.name }}
                          <el-icon v-if="selectedTemplate?.id === tpl.id" class="check-icon"><Check /></el-icon>
                        </div>
                        <div class="template-desc">{{ tpl.description }}</div>
                        <div class="template-colors">
                          <span class="color-dot" :style="{ background: stylePrimary(tpl) }" title="主色" />
                          <span class="color-dot" :style="{ background: styleGradientTo(tpl) }" title="渐变终点" />
                          <span class="color-dot" :style="{ background: styleBackground(tpl) }" title="页面背景" />
                        </div>
                      </div>
                    </div>
                  </el-col>
                </el-row>
              </template>
            </el-card>

            <!-- ② 基础信息 -->
            <el-card class="section-card" shadow="never">
              <template #header>
                <span class="section-title"><span class="step-no">2</span>基础信息（AppID + 商城名称）</span>
              </template>

              <el-form
                :ref="(el: any) => setFormRef(platform.key, el)"
                :model="currentConfig"
                :rules="configRules"
                label-width="130px"
                class="config-form"
              >
                <el-form-item label="小程序AppID" prop="appId">
                  <el-input v-model="currentConfig.appId" placeholder="mp.weixin.qq.com 的小程序 AppID（wx 开头）" />
                </el-form-item>

                <el-form-item label="商城名称" prop="appName">
                  <el-input v-model="currentConfig.appName" placeholder="写入小程序导航栏标题" maxlength="20" show-word-limit />
                </el-form-item>

                <!-- 更多设置（折叠，保留原有可选字段） -->
                <el-collapse class="more-settings">
                  <el-collapse-item title="更多设置（AppSecret / 联系人 / 版本号，选填）">
                    <el-form-item label="小程序AppSecret">
                      <el-input
                        v-model="currentConfig.appSecret"
                        type="password"
                        show-password
                        placeholder="选填（已保存时显示 ***）"
                      />
                    </el-form-item>
                    <el-form-item label="版本号">
                      <el-input v-model="packageVersion" placeholder="如 1.2.0，留空默认 1.0.0" />
                    </el-form-item>
                    <el-form-item label="联系人姓名">
                      <el-input v-model="currentConfig.contactName" placeholder="选填" />
                    </el-form-item>
                    <el-form-item label="联系人电话">
                      <el-input v-model="currentConfig.contactPhone" placeholder="选填" />
                    </el-form-item>
                    <el-form-item label="联系人邮箱">
                      <el-input v-model="currentConfig.contactEmail" placeholder="选填" />
                    </el-form-item>
                  </el-collapse-item>
                </el-collapse>
              </el-form>
            </el-card>

            <!-- ③ 上传密钥 -->
            <el-card class="section-card" shadow="never">
              <template #header>
                <span class="section-title"><span class="step-no">3</span>上传密钥（.key 文件，一次性配置）</span>
              </template>

              <div class="key-area">
                <el-upload
                  :auto-upload="false"
                  :limit="1"
                  accept=".key"
                  :file-list="keyFileList"
                  :on-change="handleKeyChange"
                  :on-remove="handleKeyRemove"
                  class="key-upload"
                >
                  <el-button :icon="Key">{{ keyFile ? "已选择：" + keyFile.name : "选择 .key 上传密钥" }}</el-button>
                  <template #tip>
                    <div class="upload-tip">
                      微信公众平台 → 开发管理 → 开发设置 → 代码上传密钥，下载 .key 文件后上传；已配置时二次发布无需重复上传
                    </div>
                  </template>
                </el-upload>

                <div class="key-status">
                  <template v-if="keyStatusLoading">
                    <el-tag type="info" effect="plain">正在检查密钥状态...</el-tag>
                  </template>
                  <template v-else-if="keyStatus.configured">
                    <el-tag type="success" class="key-status-tag">已配置（{{ keyStatus.fileName || ".key" }} · {{ formatTime(keyStatus.configuredAt) }}）</el-tag>
                    <span class="key-overwrite-tip">重新选择文件上传可覆盖</span>
                  </template>
                  <template v-else>
                    <el-tag type="warning" effect="plain">未配置上传密钥，发布前需上传</el-tag>
                  </template>
                </div>

                <el-form-item label="私钥密码" class="key-password-item">
                  <el-input v-model="keyPassword" type="password" show-password placeholder="上传密钥设置了密码时填写，无密码留空" style="max-width: 320px" />
                </el-form-item>
              </div>
            </el-card>

            <!-- 一键发布主按钮 -->
            <el-card class="section-card publish-card" shadow="never">
              <div class="publish-area">
                <el-button
                  type="primary"
                  size="large"
                  class="publish-btn"
                  :loading="publishing"
                  :disabled="!canPublish"
                  @click="handlePublish"
                >
                  <el-icon v-if="!publishing" class="publish-icon"><Promotion /></el-icon>
                  {{ publishing ? stepText : "🚀 一键生成并发布" }}
                </el-button>
                <div class="publish-tip">
                  系统自动完成：生成代码包 → 上传微信体验版 → 给出提交审核入口
                </div>

                <!-- 高级选项：仅生成代码包下载 -->
                <el-collapse class="advance-collapse">
                  <el-collapse-item title="高级选项：仅生成代码包（zip）下载，不上传">
                    <div class="package-area">
                      <el-button :loading="generating" :disabled="!canGenerate" @click="handleGenerate">
                        {{ generating ? "生成中..." : "生成代码包" }}
                      </el-button>
                      <el-button @click="guideVisible = true">发布指引</el-button>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </el-card>
          </template>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 发布记录 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">发布记录</span>
      </template>

      <el-table :data="publishLogs" v-loading="logsLoading" stripe class="history-table">
        <el-table-column prop="createdAt" label="时间" min-width="170" />
        <el-table-column prop="actionText" label="操作" width="100" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="resultText" label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'">{{ row.resultText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="statusText" label="状态" width="130" />
        <el-table-column prop="remark" label="备注 / 文件" min-width="220" show-overflow-tooltip />
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

    <!-- 一键发布结果弹窗 -->
    <el-dialog v-model="publishResultVisible" :title="publishSuccess ? '发布成功' : '发布失败'" width="560px" :close-on-click-modal="false">
      <div class="publish-result">
        <template v-if="publishSuccess">
          <el-result icon="success" title="体验版已上传微信" :sub-title="publishResultData.message" />
          <el-descriptions :column="1" border class="result-desc">
            <el-descriptions-item label="版本号">{{ publishResultData.version || "-" }}</el-descriptions-item>
            <el-descriptions-item label="发布状态">{{ publishResultData.status || "uploaded" }}</el-descriptions-item>
          </el-descriptions>
          <div class="audit-row">
            <el-alert
              type="warning"
              show-icon
              :closable="false"
              title="上传的是体验版：正式上线需在微信公众平台提交审核，审核通过后点击发布"
            />
            <el-button type="primary" class="audit-btn" @click="openMpUrl">
              前往微信公众平台提交审核
              <el-icon class="el-icon--right"><Link /></el-icon>
            </el-button>
          </div>
        </template>
        <template v-else>
          <el-result icon="error" title="一键发布失败" :sub-title="publishResultData.errorMsg" />
        </template>
      </div>
      <template #footer>
        <el-button type="primary" @click="publishResultVisible = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 生成结果弹窗（高级选项） -->
    <el-dialog v-model="packageResultVisible" :title="packageSuccess ? '代码包生成成功' : '生成失败'" width="500px" :close-on-click-modal="false">
      <div class="package-result">
        <template v-if="packageSuccess">
          <el-result icon="success" title="代码包已生成" :sub-title="`文件：${packageResultData.fileName}`" />
          <div class="download-row">
            <el-link type="primary" :href="packageResultData.downloadUrl" target="_blank" :underline="false">
              <el-icon class="download-icon"><Download /></el-icon>
              点击下载代码包（zip）
            </el-link>
            <p class="download-tip">下载后用微信开发者工具导入，校验 AppID 后即可上传代码。</p>
          </div>
        </template>
        <template v-else>
          <el-result icon="error" title="生成失败" :sub-title="packageResultData.errorMsg" />
        </template>
      </div>
      <template #footer>
        <el-button type="primary" @click="packageResultVisible = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 发布指引弹窗 -->
    <el-dialog v-model="guideVisible" title="发布指引" width="640px">
      <el-steps direction="vertical" :active="6" class="guide-steps">
        <el-step title="一键生成并发布" description="点击「🚀 一键生成并发布」，系统自动生成代码包并上传微信体验版" />
        <el-step title="登录微信公众平台" description="打开 mp.weixin.qq.com → 版本管理，可看到已上传的体验版" />
        <el-step title="提交审核" description="在版本管理中将体验版提交审核（微信平台强制流程）" />
        <el-step title="发布上线" description="审核通过后点击「发布」，小程序即可对用户可见" />
      </el-steps>
      <template #footer>
        <el-button type="primary" @click="guideVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  fetchMiniappConfig,
  fetchMiniappKeyStatus,
  fetchMiniappPackageDownloadUrl,
  fetchMiniappPublishLogs,
  fetchMiniappTemplates,
  generateMiniappPackage,
  publishMiniapp,
  saveMiniappConfig,
  uploadMiniappKey,
} from "../../api";
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from "element-plus";
import { Check, Download, Key, Link, Promotion } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";

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

// ==================== 小程序配置 ====================
const activePlatform = ref("wechat");
const configLoading = ref(false);

interface PlatformConfig {
  appId: string;
  appSecret: string;
  appName: string;
  appVersion: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

function emptyConfig(): PlatformConfig {
  return { appId: "", appSecret: "", appName: "", appVersion: "", contactName: "", contactEmail: "", contactPhone: "" };
}

const configs = reactive<Record<string, PlatformConfig>>({
  wechat: emptyConfig(),
  alipay: emptyConfig(),
  douyin: emptyConfig(),
  kuaishou: emptyConfig(),
});

const currentConfig = computed(() => configs[activePlatform.value]);

const configRules: FormRules = {
  appId: [{ required: true, message: "请输入小程序AppID", trigger: "blur" }],
  appName: [{ required: true, message: "请输入商城名称", trigger: "blur" }],
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
    const { data: res } = await fetchMiniappConfig(platform);
    const row = res?.data;
    if (row) {
      configs[platform] = {
        appId: row.appId || "",
        appSecret: row.appSecret || "",
        appName: row.appName || "",
        appVersion: row.appVersion || "",
        contactName: row.contactName || "",
        contactEmail: row.contactEmail || "",
        contactPhone: row.contactPhone || "",
      };
      packageVersion.value = row.appVersion || packageVersion.value;
      // 配置里已选模板时回显选中态
      if (row.templateId && templates.value.length) {
        const tpl = templates.value.find((t) => String(t.id) === String(row.templateId));
        if (tpl) selectedTemplate.value = tpl;
      }
    }
  } catch {
    // 首次加载可能无配置，使用默认空值
  } finally {
    configLoading.value = false;
  }
}

function handlePlatformChange(platform: string) {
  loadConfig(platform);
  loadKeyStatus();
}

async function saveConfig() {
  const formRef = formRefs[activePlatform.value];
  if (!formRef) return;

  formRef.validate(async (valid) => {
    if (!valid) return;
    try {
      await saveMiniappConfig(activePlatform.value, {
        ...currentConfig.value,
        appVersion: packageVersion.value || undefined,
        templateId: selectedTemplate.value ? Number(selectedTemplate.value.id) : undefined,
      });
      ElMessage.success("保存成功");
    } catch (err: any) {
      ElMessage.error(err?.response?.data?.msg || err?.message || "保存失败，请稍后重试");
    }
  });
}

// ==================== 模板选择 ====================
interface Template {
  id: string | number;
  name: string;
  description: string;
  theme: string;
  styleConfig: Record<string, any>;
}

const templateLoading = ref(false);
const templates = ref<Template[]>([]);
const selectedTemplate = ref<Template | null>(null);

function templateGradient(tpl: Template): Record<string, string> {
  const from = tpl.styleConfig?.gradientFrom || tpl.styleConfig?.primaryColor || "#2563eb";
  const to = tpl.styleConfig?.gradientTo || tpl.styleConfig?.primaryColor || "#1e40af";
  return { background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` };
}

function stylePrimary(tpl: Template): string {
  return tpl.styleConfig?.primaryColor || "#1e40af";
}

function styleGradientTo(tpl: Template): string {
  return tpl.styleConfig?.gradientTo || tpl.styleConfig?.primaryColor || "#1e40af";
}

function styleBackground(tpl: Template): string {
  return tpl.styleConfig?.backgroundColor || "#f5f5f5";
}

function themeIcon(theme: string): string {
  const map: Record<string, string> = { a: "🌊", b: "🍷", c: "🌿" };
  return map[theme] || "📱";
}

async function loadTemplates() {
  templateLoading.value = true;
  try {
    const { data: res } = await fetchMiniappTemplates();
    if (Array.isArray(res?.data)) {
      templates.value = res.data.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || "",
        theme: t.theme || t.styleConfig?.theme || "a",
        styleConfig: t.styleConfig || {},
      }));
      // 默认选中第一套
      if (templates.value.length && !selectedTemplate.value) {
        selectedTemplate.value = templates.value[0];
      }
    }
  } catch {
    ElMessage.warning("模板列表加载失败，请确认后端已部署 130 迁移");
    templates.value = [];
  } finally {
    templateLoading.value = false;
  }
}

function selectTemplate(tpl: Template) {
  selectedTemplate.value = tpl;
}

// ==================== 上传密钥 ====================
const keyStatusLoading = ref(false);
const keyStatus = ref<{ configured: boolean; configuredAt: string | null; fileName: string }>({
  configured: false,
  configuredAt: null,
  fileName: "",
});
const keyFile = ref<File | null>(null);
const keyFileList = ref<UploadFile[]>([]);
const keyPassword = ref("");

function handleKeyChange(file: UploadFile) {
  keyFile.value = file.raw || null;
  keyFileList.value = [file];
}

function handleKeyRemove() {
  keyFile.value = null;
  keyFileList.value = [];
}

async function loadKeyStatus() {
  keyStatusLoading.value = true;
  try {
    const { data: res } = await fetchMiniappKeyStatus(activePlatform.value);
    keyStatus.value = {
      configured: Boolean(res?.data?.configured),
      configuredAt: res?.data?.configuredAt || null,
      fileName: res?.data?.fileName || "",
    };
  } catch {
    keyStatus.value = { configured: false, configuredAt: null, fileName: "" };
  } finally {
    keyStatusLoading.value = false;
  }
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ==================== 一键生成并发布 ====================
const publishing = ref(false);
const stepText = ref("正在保存配置...");
const packageVersion = ref("");
const publishResultVisible = ref(false);
const publishSuccess = ref(false);
const publishResultData = reactive({
  version: "",
  status: "",
  message: "",
  mpUrl: "",
  errorMsg: "",
});

const canPublish = computed(() => {
  const cfg = currentConfig.value;
  return !!selectedTemplate.value && !!cfg.appId && !!cfg.appName && (keyStatus.value.configured || !!keyFile.value);
});

async function handlePublish() {
  const cfg = currentConfig.value;
  if (!selectedTemplate.value) {
    ElMessage.warning("请先选择模板");
    return;
  }
  if (!cfg.appId) {
    ElMessage.warning("请填写小程序 AppID");
    return;
  }
  if (!cfg.appName) {
    ElMessage.warning("请填写商城名称");
    return;
  }
  if (!keyStatus.value.configured && !keyFile.value) {
    ElMessage.warning("请先上传 .key 上传密钥（微信公众平台 → 开发管理 → 开发设置 → 代码上传密钥）");
    return;
  }

  publishing.value = true;
  try {
    // 1. 保存配置（保证后端 publish 读到最新 AppID/名称/模板）
    stepText.value = "正在保存配置...";
    await saveMiniappConfig(activePlatform.value, {
      appId: cfg.appId,
      appSecret: cfg.appSecret || undefined,
      appName: cfg.appName,
      appVersion: packageVersion.value || undefined,
      templateId: Number(selectedTemplate.value.id),
      contactName: cfg.contactName || undefined,
      contactEmail: cfg.contactEmail || undefined,
      contactPhone: cfg.contactPhone || undefined,
    });

    // 2. 首次上传密钥（已配置时跳过）
    if (keyFile.value) {
      stepText.value = "正在上传密钥...";
      await uploadMiniappKey(activePlatform.value, keyFile.value, keyPassword.value || undefined);
      keyFile.value = null;
      keyFileList.value = [];
      keyPassword.value = "";
      await loadKeyStatus();
    }

    // 3. 一键生成代码包并上传微信体验版
    stepText.value = "正在生成代码包并上传微信（通常需 1-3 分钟）...";
    const { data: res } = await publishMiniapp({
      platform: activePlatform.value,
      version: packageVersion.value || undefined,
    });
    publishSuccess.value = true;
    publishResultData.version = res?.data?.version || "";
    publishResultData.status = res?.data?.status || "uploaded";
    publishResultData.message = res?.data?.message || "体验版上传成功";
    publishResultData.mpUrl = res?.data?.mpUrl || "";
    publishResultData.errorMsg = "";
    ElMessage.success("发布成功，体验版已上传微信");
    packageVersion.value = "";
    loadPublishLogs();
  } catch (err: any) {
    publishSuccess.value = false;
    publishResultData.version = "";
    publishResultData.status = "";
    publishResultData.message = "";
    publishResultData.mpUrl = "";
    publishResultData.errorMsg = err?.response?.data?.msg || err?.message || "发布失败，请稍后重试";
    ElMessage.error("一键发布失败");
  } finally {
    publishing.value = false;
    publishResultVisible.value = true;
  }
}

function openMpUrl() {
  const url = publishResultData.mpUrl;
  if (url) window.open(url, "_blank");
}

// ==================== 高级选项：仅生成代码包 ====================
const generating = ref(false);
const packageResultVisible = ref(false);
const packageSuccess = ref(false);
const packageResultData = reactive({
  fileName: "",
  downloadUrl: "",
  errorMsg: "",
});

const canGenerate = computed(
  () => !!selectedTemplate.value && !!currentConfig.value.appId && !!currentConfig.value.appName
);

async function handleGenerate() {
  generating.value = true;
  try {
    const { data: res } = await generateMiniappPackage({
      platform: activePlatform.value,
      templateId: Number(selectedTemplate.value!.id),
      appId: currentConfig.value.appId,
      appName: currentConfig.value.appName,
      version: packageVersion.value || undefined,
    });
    packageSuccess.value = true;
    packageResultData.fileName = res?.data?.fileName || "";
    packageResultData.downloadUrl = res?.data?.id
      ? fetchMiniappPackageDownloadUrl(res.data.id)
      : "";
    packageResultData.errorMsg = "";
    ElMessage.success("代码包生成成功");
    loadPublishLogs();
  } catch (err: any) {
    packageSuccess.value = false;
    packageResultData.errorMsg =
      err?.response?.data?.msg || err?.message || "生成失败，请检查模板产物是否已构建";
    packageResultData.fileName = "";
    packageResultData.downloadUrl = "";
    ElMessage.error("代码包生成失败");
  } finally {
    generating.value = false;
    packageResultVisible.value = true;
  }
}

// ==================== 发布记录 ====================
const logsLoading = ref(false);
const publishLogs = ref<any[]>([]);
const logsPage = ref(1);
const logsPageSize = ref(10);
const logsTotal = ref(0);

const ACTION_TEXT: Record<string, string> = {
  package: "生成代码包",
  publish: "发布",
  update: "更新",
  offline: "下架",
  rollback: "回滚",
  audit_submit: "提交审核",
};

const STATUS_TEXT: Record<string, string> = {
  uploaded: "已上传体验版",
  submitted: "已提交审核",
  package_ready: "代码包就绪",
  failed: "失败",
};

async function loadPublishLogs() {
  logsLoading.value = true;
  try {
    const { data: res } = await fetchMiniappPublishLogs({
      page: logsPage.value,
      pageSize: logsPageSize.value,
    });
    const list = res?.data?.list || res?.data?.records || [];
    publishLogs.value = list.map((row: any) => ({
      createdAt: row.created_at || row.createdAt || "",
      actionText: ACTION_TEXT[row.action] || row.action || "",
      version: row.version || "",
      status: row.status || "",
      statusText: STATUS_TEXT[row.status] || row.status || "",
      result: row.result || "",
      resultText: row.result === "success" ? "成功" : row.result === "failed" ? "失败" : row.result || "",
      remark: row.remark || row.error_msg || "",
    }));
    logsTotal.value = res?.data?.total || 0;
  } catch {
    publishLogs.value = [];
    logsTotal.value = 0;
  } finally {
    logsLoading.value = false;
  }
}

// ==================== 发布指引 ====================
const guideVisible = ref(false);

// ==================== 初始化 ====================
onMounted(async () => {
  await loadTemplates();
  await loadConfig(activePlatform.value);
  loadKeyStatus();
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
  margin-bottom: 20px;
  max-width: 860px;
}

.config-form {
  max-width: 680px;
  padding-top: 8px;
}

.section-card {
  margin-bottom: 16px;
}

.section-title {
  font-weight: 600;
  font-size: 16px;
}

.step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  margin-right: 8px;
}

.more-settings {
  margin-top: 4px;
  border: none;
  --el-collapse-header-height: 40px;
}

.more-settings :deep(.el-collapse-item__header) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

/* 模板卡片 */
.template-card {
  border: 2px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  min-height: 210px;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.template-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.25);
}

.template-thumb {
  height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.template-icon {
  font-size: 44px;
}

.template-thumb-name {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.template-info {
  padding: 14px 16px;
  background: var(--bg-card, #fff);
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
  color: var(--color-primary);
  font-size: 18px;
}

.template-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}

.template-colors {
  display: flex;
  gap: 6px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* 上传密钥 */
.key-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.key-upload {
  max-width: 480px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-top: 4px;
}

.key-status {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.key-overwrite-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.key-password-item {
  max-width: 480px;
  margin-bottom: 0;
}

/* 一键发布 */
.publish-card {
  background: linear-gradient(180deg, #f8faff 0%, #ffffff 60%);
}

.publish-area {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.publish-btn {
  min-width: 300px;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
}

.publish-icon {
  margin-right: 6px;
  font-size: 18px;
}

.publish-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.advance-collapse {
  width: 100%;
  border: none;
  --el-collapse-header-height: 40px;
}

.advance-collapse :deep(.el-collapse-item__header) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.package-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

/* 发布结果 */
.publish-result {
  padding: 4px 0;
}

.result-desc {
  margin-bottom: 16px;
}

.audit-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-btn {
  align-self: flex-start;
}

.package-result {
  padding: 4px 0;
}

.download-row {
  text-align: center;
  margin-top: 8px;
}

.download-icon {
  margin-right: 6px;
}

.download-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

/* 发布记录 */
.history-table {
  margin-bottom: 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.guide-steps {
  margin-top: 8px;
}
</style>
