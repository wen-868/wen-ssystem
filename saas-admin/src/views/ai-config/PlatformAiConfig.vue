<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div class="page-title">
        <div>
          <h2 style="margin: 0; font-size: 18px;">平台默认 AI 配置</h2>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            所有租户的默认 AI 设置，租户未单独配置时按此兜底；API Key 加密存储，读取时脱敏
          </div>
        </div>
        <el-tag v-if="configLoaded" :type="form.apiKeySet ? 'success' : 'info'" size="small">
          {{ form.apiKeySet ? "已设置 API Key" : "未设置 API Key" }}
        </el-tag>
      </div>
    </el-card>

    <el-card v-loading="loading">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" style="max-width: 720px;">
        <el-form-item label="默认 AI 服务商" prop="defaultProvider">
          <el-select v-model="form.defaultProvider" placeholder="请选择默认服务商" style="width: 100%;">
            <el-option v-for="p in PROVIDER_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="默认模型" prop="defaultModel">
          <el-select
            v-model="form.defaultModel"
            placeholder="请选择或输入模型名称"
            filterable
            allow-create
            default-first-option
            style="width: 100%;"
          >
            <el-option v-for="m in MODEL_OPTIONS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>

        <el-form-item label="默认 API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="apiKeyPlaceholder"
            autocomplete="new-password"
            style="width: 100%;"
          />
          <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            留空表示不修改；输入新 Key 后加密存储，保存后不再展示明文
          </div>
        </el-form-item>

        <el-form-item label="自定义 Endpoint">
          <el-input v-model="form.defaultEndpoint" placeholder="选填，如 https://api.deepseek.com/v1" clearable style="width: 100%;" />
        </el-form-item>

        <el-form-item label="默认温度" prop="defaultTemperature">
          <el-input-number v-model="form.defaultTemperature" :min="0" :max="2" :step="0.1" :precision="1" style="width: 100%;" />
          <div style="font-size: 12px; color: var(--text-muted);">取值范围 0 ~ 2，数值越低回答越稳定</div>
        </el-form-item>

        <el-form-item label="默认最大 Token" prop="defaultMaxTokens">
          <el-input-number v-model="form.defaultMaxTokens" :min="1" :step="256" style="width: 100%;" />
        </el-form-item>

        <el-form-item label="默认系统提示词">
          <el-input
            v-model="form.defaultSystemPrompt"
            type="textarea"
            :rows="5"
            placeholder="选填，覆盖 AI 助手默认系统提示词（可为空）"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
          <el-button @click="loadConfig">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  getPlatformAiConfig,
  updatePlatformAiConfig,
  type PlatformConfigView,
  type UpdatePlatformAiConfigPayload,
} from "../../api/ai-config";

/** AI 服务商选项（对齐架构文档 5.3 节 Provider 实现对照） */
const PROVIDER_OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "通义千问" },
  { value: "zhipu", label: "智谱AI" },
  { value: "ollama", label: "本地 Ollama" },
];

/** 常见模型名（可自由输入） */
const MODEL_OPTIONS = ["deepseek-chat", "qwen-plus", "glm-4-flash", "qwen2.5:3b"];

const loading = ref(false);
const saving = ref(false);
const configLoaded = ref(false);
const formRef = ref<FormInstance>();

const form = reactive<UpdatePlatformAiConfigPayload & { apiKeySet: boolean; apiKeyMasked: string | null }>({
  defaultProvider: "deepseek",
  defaultModel: "deepseek-chat",
  apiKey: "",
  defaultEndpoint: "",
  defaultTemperature: 0.3,
  defaultMaxTokens: 2048,
  defaultSystemPrompt: "",
  apiKeySet: false,
  apiKeyMasked: null,
});

const rules: FormRules = {
  defaultProvider: [{ required: true, message: "请选择默认 AI 服务商", trigger: "change" }],
  defaultModel: [{ required: true, message: "请填写默认模型", trigger: "change" }],
};

const apiKeyPlaceholder = computed(() => {
  if (form.apiKeySet) return `已设置（${form.apiKeyMasked ?? "****"}），留空表示不修改`;
  return "请输入默认 API Key（选填）";
});

/** 加载平台默认配置 */
async function loadConfig() {
  loading.value = true;
  try {
    const config = await getPlatformAiConfig();
    applyConfig(config);
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    loading.value = false;
  }
}

function applyConfig(config: PlatformConfigView) {
  form.defaultProvider = config.defaultProvider;
  form.defaultModel = config.defaultModel;
  form.defaultEndpoint = config.defaultEndpoint ?? "";
  form.defaultTemperature = config.defaultTemperature;
  form.defaultMaxTokens = config.defaultMaxTokens;
  form.defaultSystemPrompt = config.defaultSystemPrompt ?? "";
  form.apiKey = "";
  form.apiKeySet = config.apiKeySet;
  form.apiKeyMasked = config.apiKeyMasked;
  configLoaded.value = true;
}

async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const payload: UpdatePlatformAiConfigPayload = {
      defaultProvider: form.defaultProvider,
      defaultModel: form.defaultModel,
      defaultEndpoint: form.defaultEndpoint || undefined,
      defaultTemperature: form.defaultTemperature,
      defaultMaxTokens: form.defaultMaxTokens,
      defaultSystemPrompt: form.defaultSystemPrompt || undefined,
    };
    // apiKey 留空表示不改动，不提交该字段（对齐后端 dto：空字符串表示不改动）
    if (form.apiKey) payload.apiKey = form.apiKey;

    const saved = await updatePlatformAiConfig(payload);
    applyConfig(saved);
    ElMessage.success("平台默认 AI 配置已保存");
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.page-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
</style>
