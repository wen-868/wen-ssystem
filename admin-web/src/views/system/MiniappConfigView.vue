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
            <el-alert type="warning" show-icon :closable="false" class="config-alert">
              {{ platformAlertText(platform.key) }}
            </el-alert>

            <!-- 凭证表单 -->
            <el-form
              :ref="(el: any) => setFormRef(platform.key, el)"
              :model="currentConfig"
              :rules="configRules"
              label-width="130px"
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
                  placeholder="请输入小程序AppSecret（已保存时显示 ***）"
                />
              </el-form-item>

              <el-form-item label="商城名称" prop="appName">
                <el-input v-model="currentConfig.appName" placeholder="请输入小程序名称（写入导航栏标题）" maxlength="20" show-word-limit />
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
        <span class="section-title">小程序模板（三选一）</span>
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

    <!-- 生成代码包 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">生成代码包</span>
      </template>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        class="package-alert"
        title="生成前请先保存上方配置并选择模板；生成的是微信开发者工具可直接导入的 zip 代码包"
      />

      <div class="package-area">
        <div class="package-version">
          <span class="package-label">版本号（选填）：</span>
          <el-input v-model="packageVersion" placeholder="例如：1.2.0，留空默认 1.0.0" style="width: 240px" clearable />
        </div>

        <el-button type="primary" size="large" :loading="generating" :disabled="!canGenerate" @click="handleGenerate">
          {{ generating ? "生成中..." : "生成代码包" }}
        </el-button>

        <el-button size="large" @click="guideVisible = true">发布指引</el-button>
      </div>
    </el-card>

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
        <el-table-column prop="status" label="状态" width="120" />
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

    <!-- 生成结果弹窗 -->
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
        <el-step title="下载代码包" description="在「生成代码包」处生成并下载 zip 压缩包" />
        <el-step title="导入微信开发者工具" description="打开微信开发者工具 → 导入项目 → 选择解压后的代码包目录" />
        <el-step title="校验 AppID" description="确认 project.config.json 中的 AppID 与你在本页填写的一致" />
        <el-step title="上传代码" description="点击右上角「上传」，填写版本号与备注后上传到微信公众平台" />
        <el-step title="提交审核" description="登录 mp.weixin.qq.com → 版本管理 → 开发版本 → 提交审核" />
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
  fetchMiniappPackageDownloadUrl,
  fetchMiniappPublishLogs,
  fetchMiniappTemplates,
  generateMiniappPackage,
  saveMiniappConfig,
} from "../../api";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Check, Download } from "@element-plus/icons-vue";
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
const saving = ref(false);

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
  appSecret: [{ required: true, message: "请输入小程序AppSecret", trigger: "blur" }],
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
}

async function saveConfig() {
  const formRef = formRefs[activePlatform.value];
  if (!formRef) return;

  formRef.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await saveMiniappConfig(activePlatform.value, {
        ...currentConfig.value,
        templateId: selectedTemplate.value ? Number(selectedTemplate.value.id) : undefined,
      });
      ElMessage.success("保存成功");
    } catch (err: any) {
      ElMessage.error(err?.response?.data?.msg || err?.message || "保存失败，请稍后重试");
    } finally {
      saving.value = false;
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

// ==================== 生成代码包 ====================
const generating = ref(false);
const packageVersion = ref("");
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
    packageVersion.value = "";
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
  max-width: 680px;
}

.config-form {
  max-width: 640px;
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

/* 生成代码包 */
.package-alert {
  margin-bottom: 18px;
}

.package-area {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.package-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.package-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

/* 生成结果 */
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
