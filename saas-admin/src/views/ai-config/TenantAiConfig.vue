<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <el-input
            v-model="searchForm.tenantId"
            placeholder="按租户 ID 过滤"
            clearable
            style="width: 240px;"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          租户未配置或未启用时自动降级使用平台默认配置
        </div>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="tenantId" label="租户 ID" min-width="140" show-overflow-tooltip />
        <el-table-column label="服务商" width="120">
          <template #default="{ row }">
            <span>{{ providerLabel(row.provider) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="模型" min-width="140" show-overflow-tooltip />
        <el-table-column label="API Key" width="180">
          <template #default="{ row }">
            <el-tag v-if="row.apiKeySet" type="success" size="small" style="margin-right: 6px;">已设置</el-tag>
            <el-tag v-else type="info" size="small" style="margin-right: 6px;">未设置</el-tag>
            <span v-if="row.apiKeyMasked" class="mono" style="font-size: 12px; color: var(--text-secondary);">{{ row.apiKeyMasked }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="temperature" label="温度" width="80" align="center" />
        <el-table-column prop="maxTokens" label="最大Token" width="100" align="right" />
        <el-table-column label="启用状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled === 1"
              @change="(val: string | number | boolean) => handleToggleEnabled(row as TenantConfigView, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row as TenantConfigView)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无租户 AI 配置" />

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchList"
        />
      </div>
    </el-card>

    <!-- 编辑租户 AI 配置 -->
    <el-dialog v-model="showEditDialog" :title="`编辑 AI 配置 - ${editTarget?.tenantId ?? ''}`" width="560px" :close-on-click-modal="false">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="120px">
        <el-form-item label="启用 AI 助手">
          <el-switch v-model="editForm.enabled" active-value="1" inactive-value="0" />
        </el-form-item>
        <el-form-item label="AI 服务商" prop="provider">
          <el-select v-model="editForm.provider" placeholder="请选择服务商" style="width: 100%;">
            <el-option v-for="p in PROVIDER_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型" prop="model">
          <el-select
            v-model="editForm.model"
            placeholder="请选择或输入模型名称"
            filterable
            allow-create
            default-first-option
            style="width: 100%;"
          >
            <el-option v-for="m in modelOptions" :key="m.name" :label="m.displayName || m.name" :value="m.name" />
          </el-select>
          <div v-if="modelOptions.length === 0" style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            模型选项接口未返回，可手动输入模型名称
          </div>
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="editForm.apiKey"
            type="password"
            show-password
            :placeholder="editApiKeyPlaceholder"
            autocomplete="new-password"
            style="width: 100%;"
          />
          <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            留空表示不修改；输入新 Key 后加密存储，保存后不再展示明文
          </div>
        </el-form-item>
        <el-form-item label="自定义 Endpoint">
          <el-input v-model="editForm.apiEndpoint" placeholder="选填，如 https://api.deepseek.com/v1" clearable style="width: 100%;" />
        </el-form-item>
        <el-form-item label="温度" prop="temperature">
          <el-input-number v-model="editForm.temperature" :min="0" :max="2" :step="0.1" :precision="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="最大 Token" prop="maxTokens">
          <el-input-number v-model="editForm.maxTokens" :min="1" :step="256" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="自定义系统提示词">
          <el-input
            v-model="editForm.systemPrompt"
            type="textarea"
            :rows="4"
            placeholder="选填，覆盖默认系统提示词（可为空）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  listTenantAiConfigs,
  updateTenantAiConfig,
  listExternalModelOptions,
  getPlatformAiConfig,
  type TenantConfigView,
  type UpdateTenantAiConfigPayload,
} from "../../api/ai-config";

/** AI 服务商选项 */
const PROVIDER_OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "通义千问" },
  { value: "zhipu", label: "智谱AI" },
  { value: "ollama", label: "本地 Ollama" },
];

/**
 * 模型选项：原写死 4 个模型名 → 改为从 listExternalModelOptions() 取（契约 §七 D）。
 * 接口不可用 → 空数组（select 仍可 allow-create 手动输入），不回落写死数组。
 */
const modelOptions = ref<{ name: string; displayName?: string; modelName?: string }[]>([]);

function providerLabel(provider: string): string {
  const found = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return found ? found.label : provider || "未配置";
}

function formatTime(time: string): string {
  if (!time) return "-";
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const loading = ref(false);
const saving = ref(false);
const list = ref<TenantConfigView[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const searchForm = reactive({ tenantId: "" });

async function fetchList() {
  loading.value = true;
  try {
    const res = await listTenantAiConfigs({
      tenantId: searchForm.tenantId || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

/** 行内切换启用状态（失败自动回滚） */
async function handleToggleEnabled(row: TenantConfigView, val: string | number | boolean) {
  const target = val === true || val === "1" || val === 1 ? 1 : 0;
  try {
    const saved = await updateTenantAiConfig(row.tenantId, { enabled: target });
    row.enabled = saved.enabled;
    ElMessage.success(target === 1 ? "已启用" : "已禁用");
  } catch {
    // 请求失败时 switch 依赖 model-value 受控，自动保持原值
  }
}

// ==================== 编辑弹窗 ====================
const showEditDialog = ref(false);
const editFormRef = ref<FormInstance>();
const editTarget = ref<TenantConfigView | null>(null);

/** 编辑弹窗表单模型（enabled 用字符串匹配 el-switch 的 active-value/inactive-value） */
interface TenantEditForm {
  enabled: "1" | "0";
  provider: string;
  model: string;
  apiKey: string;
  apiEndpoint: string;
  temperature: number;
  maxTokens: number | null;
  systemPrompt: string;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
}

/** 平台默认 maxTokens（t_platform_ai_config.default_max_tokens），用于租户未单独配置时回显；未配置则留空（契约 §七 D） */
const platformDefaultMaxTokens = ref<number | null>(null);

const editForm = reactive<TenantEditForm>({
  enabled: "1",
  provider: "deepseek",
  model: "deepseek-chat",
  apiKey: "",
  apiEndpoint: "",
  temperature: 0.3,
  maxTokens: null,
  systemPrompt: "",
  apiKeySet: false,
  apiKeyMasked: null,
});

const editRules: FormRules = {
  provider: [{ required: true, message: "请选择服务商", trigger: "change" }],
  model: [{ required: true, message: "请填写模型", trigger: "change" }],
};

const editApiKeyPlaceholder = computed(() => {
  if (editForm.apiKeySet) return `已设置（${editForm.apiKeyMasked ?? "****"}），留空表示不修改`;
  return "请输入 API Key（选填）";
});

function openEdit(row: TenantConfigView) {
  editTarget.value = row;
  editForm.enabled = row.enabled === 1 ? "1" : "0";
  editForm.provider = row.provider;
  editForm.model = row.model;
  editForm.apiKey = "";
  editForm.apiEndpoint = row.apiEndpoint ?? "";
  editForm.temperature = row.temperature;
  // 租户未单独配置 maxTokens 时回显平台默认；平台默认也未配置则留空（不写死 2048）
  editForm.maxTokens = row.maxTokens != null ? row.maxTokens : platformDefaultMaxTokens.value ?? null;
  editForm.systemPrompt = row.systemPrompt ?? "";
  editForm.apiKeySet = row.apiKeySet;
  editForm.apiKeyMasked = row.apiKeyMasked;
  showEditDialog.value = true;
}

async function handleSave() {
  try {
    await editFormRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const payload: UpdateTenantAiConfigPayload = {
      enabled: editForm.enabled === "1" ? 1 : 0,
      provider: editForm.provider,
      model: editForm.model,
      apiEndpoint: editForm.apiEndpoint || undefined,
      temperature: editForm.temperature,
      systemPrompt: editForm.systemPrompt || undefined,
    };
    // maxTokens 未配置（null）时不上送该字段（对齐后端 dto：空表示不改动），不写死默认值
    if (editForm.maxTokens != null) payload.maxTokens = editForm.maxTokens;
    // apiKey 留空表示不改动，不提交该字段（对齐后端 dto：空字符串表示不改动）
    if (editForm.apiKey) payload.apiKey = editForm.apiKey;

    const saved = await updateTenantAiConfig(editTarget.value!.tenantId, payload);
    ElMessage.success("租户 AI 配置已保存");
    showEditDialog.value = false;
    // 更新本地行（避免整页刷新闪烁）
    const idx = list.value.findIndex((r) => r.tenantId === saved.tenantId);
    if (idx >= 0) list.value[idx] = saved;
    else await fetchList();
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    saving.value = false;
  }
}

/** 加载模型下拉选项（替代写死 MODEL_OPTIONS）；失败保持空态，不回落写死数组 */
async function loadModelOptions() {
  try {
    const res = await listExternalModelOptions();
    const list = (res as any)?.data?.data ?? (res as any)?.data ?? res
    modelOptions.value = Array.isArray(list) ? list : (list?.list ?? [])
  } catch {
    // 接口不可用 → 空态（select allow-create 仍可手动输入），不回落写死数组
    modelOptions.value = []
  }
}

/** 加载平台默认 maxTokens，用于租户未单独配置时回显 */
async function loadPlatformConfig() {
  try {
    const res = await getPlatformAiConfig();
    const d = (res as any)?.data?.data ?? (res as any)?.data ?? res
    platformDefaultMaxTokens.value = d?.defaultMaxTokens != null ? Number(d.defaultMaxTokens) : null
  } catch {
    platformDefaultMaxTokens.value = null
  }
}

onMounted(() => {
  fetchList()
  loadModelOptions()
  loadPlatformConfig()
});
</script>
