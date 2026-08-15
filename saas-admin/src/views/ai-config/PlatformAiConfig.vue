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
            <el-option v-for="p in providerOptions" :key="p.value" :label="p.label" :value="p.value" />
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

    <el-card v-loading="modelsLoading" style="margin-top: 16px;">
      <div class="page-title">
        <div>
          <h2 style="margin: 0; font-size: 18px;">外部大模型管理</h2>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            添加任意 OpenAI 兼容外部大模型（自定义 API 地址 + 密钥 + 模型名），保存后可在上方默认服务商或租户配置中选择
          </div>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">添加外部模型</el-button>
      </div>

      <el-table :data="models" border stripe style="margin-top: 12px;">
        <el-table-column prop="displayName" label="名称" min-width="120" />
        <el-table-column prop="name" label="标识" min-width="130" />
        <el-table-column prop="modelName" label="模型" min-width="140" />
        <el-table-column prop="providerBaseUrl" label="API 地址" min-width="220" show-overflow-tooltip />
        <el-table-column label="API Key" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.apiKeySet" type="success" size="small">{{ row.apiKeyMasked }}</el-tag>
            <el-tag v-else type="info" size="small">未设置</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{ row.enabled === 1 ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" text type="warning" @click="handleTest(row)">测试</el-button>
            <el-button size="small" text type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 外部模型编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑外部模型' : '添加外部模型'" width="560px">
      <el-form ref="modelFormRef" :model="modelForm" :rules="modelRules" label-width="120px">
        <el-form-item label="名称" prop="displayName">
          <el-input v-model="modelForm.displayName" placeholder="如：Kimi" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="标识" prop="name">
          <el-input v-model="modelForm.name" placeholder="如：custom_kimi（唯一，字母数字下划线）" :disabled="!!editingId" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="API 地址" prop="providerBaseUrl">
          <el-input v-model="modelForm.providerBaseUrl" placeholder="如：https://api.moonshot.cn/v1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="模型名称" prop="modelName">
          <el-input v-model="modelForm.modelName" placeholder="如：moonshot-v1-8k" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="modelForm.apiKey" type="password" show-password :placeholder="modelKeyPlaceholder" autocomplete="new-password" style="width: 100%;" />
          <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            新增时必填；编辑时留空表示不修改
          </div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="modelForm.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :loading="testing" @click="handleTestDialog">测试连接</el-button>
        <el-button type="primary" :loading="savingModel" @click="handleSaveModel">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  getPlatformAiConfig,
  updatePlatformAiConfig,
  listExternalModels,
  listExternalModelOptions,
  createExternalModel,
  updateExternalModel,
  deleteExternalModel,
  testExternalModel,
  testExternalModelById,
  type PlatformConfigView,
  type UpdatePlatformAiConfigPayload,
  type ExternalModelView,
  type ExternalModelOption,
  type ExternalModelPayload,
} from "../../api/ai-config";

/** 内置 AI 服务商（后端 ProviderFactory 已注册） */
const BUILTIN_PROVIDERS = [
  { value: "glm", label: "智谱 GLM（免费）" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "ollama", label: "本地 Ollama" },
];

/** 服务商选项 = 内置 + 外部大模型（动态加载） */
const providerOptions = computed<Array<{ value: string; label: string }>>(() => [
  ...BUILTIN_PROVIDERS,
  ...externalOptions.value.map((m) => ({
    value: m.name,
    label: `${m.displayName}（外部模型）`,
  })),
]);

/** 常见模型名（可自由输入） */
const MODEL_OPTIONS = ["deepseek-chat", "qwen-plus", "glm-4-flash", "qwen2.5:3b"];

// ==================== 外部大模型管理状态 ====================
const modelsLoading = ref(false);
const models = ref<ExternalModelView[]>([]);
const externalOptions = ref<ExternalModelOption[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const savingModel = ref(false);
const testing = ref(false);
const modelFormRef = ref<FormInstance>();

const modelForm = reactive<ExternalModelPayload & { apiKeySet: boolean; apiKeyMasked: string | null }>({
  name: "",
  displayName: "",
  providerBaseUrl: "",
  apiKey: "",
  modelName: "",
  enabled: 1,
  sortOrder: 0,
  apiKeySet: false,
  apiKeyMasked: null,
});

const modelRules: FormRules = {
  displayName: [{ required: true, message: "请输入名称", trigger: "blur" }],
  name: [{ required: true, message: "请输入标识", trigger: "blur" }],
  providerBaseUrl: [
    { required: true, message: "请输入 API 地址", trigger: "blur" },
    {
      pattern: /^https?:\/\//,
      message: "API 地址必须以 http:// 或 https:// 开头",
      trigger: "blur",
    },
  ],
  modelName: [{ required: true, message: "请输入模型名称", trigger: "blur" }],
};

const modelKeyPlaceholder = computed(() => {
  if (editingId.value && modelForm.apiKeySet) {
    return `已设置（${modelForm.apiKeyMasked ?? "****"}），留空表示不修改`;
  }
  return "请输入 API Key";
});

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

// ==================== 外部大模型管理 ====================

/** 加载外部模型列表与启用选项 */
async function loadModels() {
  modelsLoading.value = true;
  try {
    const [list, options] = await Promise.all([
      listExternalModels(),
      listExternalModelOptions(),
    ]);
    models.value = list;
    externalOptions.value = options;
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    modelsLoading.value = false;
  }
}

/** 打开「添加外部模型」对话框 */
function openCreate() {
  editingId.value = null;
  Object.assign(modelForm, {
    name: "",
    displayName: "",
    providerBaseUrl: "",
    apiKey: "",
    modelName: "",
    enabled: 1,
    sortOrder: 0,
    apiKeySet: false,
    apiKeyMasked: null,
  });
  dialogVisible.value = true;
}

/** 打开「编辑外部模型」对话框 */
function openEdit(row: ExternalModelView) {
  editingId.value = row.id;
  Object.assign(modelForm, {
    name: row.name,
    displayName: row.displayName,
    providerBaseUrl: row.providerBaseUrl,
    apiKey: "",
    modelName: row.modelName,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    apiKeySet: row.apiKeySet,
    apiKeyMasked: row.apiKeyMasked,
  });
  dialogVisible.value = true;
}

/** 保存外部模型（新增/编辑） */
async function handleSaveModel() {
  try {
    await modelFormRef.value?.validate();
  } catch {
    return;
  }
  savingModel.value = true;
  try {
    const payload: ExternalModelPayload = {
      name: modelForm.name,
      displayName: modelForm.displayName,
      providerBaseUrl: modelForm.providerBaseUrl,
      modelName: modelForm.modelName,
      enabled: modelForm.enabled,
      sortOrder: modelForm.sortOrder,
    };
    if (modelForm.apiKey) payload.apiKey = modelForm.apiKey;

    if (editingId.value) {
      await updateExternalModel(editingId.value, payload);
      ElMessage.success("外部模型已更新");
    } else {
      await createExternalModel(payload);
      ElMessage.success("外部模型已添加并启用");
    }
    dialogVisible.value = false;
    await Promise.all([loadModels(), loadConfig()]);
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    savingModel.value = false;
  }
}

/** 删除外部模型 */
async function handleDelete(row: ExternalModelView) {
  try {
    await ElMessageBox.confirm(`确认删除外部模型「${row.displayName}」？删除后立即注销，已选用的配置将不可用`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteExternalModel(row.id);
    ElMessage.success("外部模型已删除");
    await Promise.all([loadModels(), loadConfig()]);
  } catch {
    // 错误提示已由请求拦截器统一处理
  }
}

/** 对已有行发起连通性测试（使用已存配置） */
async function handleTest(row: ExternalModelView) {
  if (!row.apiKeySet) {
    ElMessage.warning("该模型未配置 API Key，无法测试（请编辑后填写密钥）");
    return;
  }
  testing.value = true;
  try {
    const result = await testExternalModelById(row.id);
    if (result.success) {
      ElMessage.success(`连接成功（${result.latencyMs}ms）：${result.message}`);
    } else {
      ElMessage.error(`连接失败：${result.message}`);
    }
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    testing.value = false;
  }
}

/** 测试对话框中的配置（真实明文密钥） */
async function handleTestDialog() {
  if (!modelForm.providerBaseUrl || !modelForm.modelName) {
    ElMessage.warning("请先填写 API 地址与模型名称");
    return;
  }
  if (!modelForm.apiKey && !modelForm.apiKeySet) {
    ElMessage.warning("请先填写 API Key");
    return;
  }
  testing.value = true;
  try {
    const result = await testExternalModel({
      providerBaseUrl: modelForm.providerBaseUrl,
      apiKey: modelForm.apiKey,
      modelName: modelForm.modelName,
    });
    if (result.success) {
      ElMessage.success(`连接成功（${result.latencyMs}ms）：${result.message}`);
    } else {
      ElMessage.error(`连接失败：${result.message}`);
    }
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  loadConfig();
  loadModels();
});
</script>

<style scoped>
.page-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
</style>
