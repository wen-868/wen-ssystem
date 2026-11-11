<template>
  <el-dialog
    :model-value="modelValue"
    width="860px"
    top="6vh"
    align-center
    :show-close="false"
    class="wb-settings-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="sw-hd">
        <span class="sw-title">设置中心</span>
        <span class="sw-sub">系统接入 · AI 模型 · 打印 · 外观 · 账号与安全 · 运营 · 系统配置</span>
        <el-button text class="sw-close" aria-label="关闭设置" @click="emit('update:modelValue', false)">✕</el-button>
      </div>
    </template>

    <div class="sw-bd">
      <nav class="sw-nav" aria-label="设置分区">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="sw-nav-item"
          :class="{ on: active === tab.key }"
          :data-setting-tab="tab.key"
          @click="selectTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="tab.capability === 'unavailable'" class="sw-badge">暂不可用</span>
        </button>
      </nav>

      <section class="sw-body">
        <p v-if="tabs.length === 0" class="sw-empty" data-testid="sw-no-tab">
          当前账号没有任何可见的设置分区（权限未命中）。
        </p>

        <!-- 系统接入 / 运营：无端点 ⇒ 结构保留 + 待接入 + 重试 -->
        <template v-else-if="activeTab && isPlaceholderPane">
          <div class="pane" :data-pane="activeTab.key">
            <div class="ad-note">管理员专属</div>
            <div class="cap-state cap-unavailable" data-testid="sw-unavailable">
              <b>{{ activeTab.label }} · 暂不可用</b>
              <p>{{ activeTab.note }}</p>
              <el-button size="small" :loading="retrying" @click="retryCapability">重试</el-button>
              <span v-if="retryHint" class="retry-hint">{{ retryHint }}</span>
            </div>
          </div>
        </template>

        <!-- AI 模型：真实枚举端点 -->
        <template v-else-if="active === 'model'">
          <div class="pane" data-pane="model">
            <div class="ad-note">管理员专属</div>
            <div class="dr-sec">模型与推理</div>
            <div v-if="modelState === 'loading'" class="cap-state" data-testid="sw-model-loading">
              <span class="sk sk-row" v-for="n in 3" :key="n"></span>
            </div>
            <div v-else-if="modelState === 'error'" class="cap-state cap-error" data-testid="sw-model-error">
              <b>模型清单加载失败</b>
              <p>{{ modelError }}</p>
              <el-button size="small" @click="loadModels">重试</el-button>
            </div>
            <div v-else-if="models.length === 0" class="cap-state" data-testid="sw-model-empty">
              当前租户未返回任何可用模型。
            </div>
            <template v-else>
              <div class="dr-row">
                <span class="k">默认模型</span>
                <span class="v">{{ modelDefault || "未指定" }}</span>
              </div>
              <div v-for="m in models" :key="m.value" class="dr-row" data-testid="sw-model-row">
                <span class="k">{{ m.label }}</span>
                <span class="v">{{ m.value }}</span>
                <span class="tag" :class="m.type === 'builtin' ? 'tag-ok' : 'tag-info'">
                  {{ m.type === "builtin" ? "内置" : "外部" }}
                </span>
              </div>
            </template>
            <div class="dr-sec">可代办工具</div>
            <div v-if="toolsState === 'loading'" class="cap-state" data-testid="sw-tools-loading">
              <span class="sk sk-row" v-for="n in 2" :key="n"></span>
            </div>
            <div v-else-if="toolsState === 'error'" class="cap-state cap-error" data-testid="sw-tools-error">
              <b>工具清单加载失败</b>
              <p>{{ toolsError }}</p>
              <el-button size="small" @click="loadTools">重试</el-button>
            </div>
            <div v-else-if="tools.length === 0" class="cap-state" data-testid="sw-tools-empty">
              当前租户未返回可用工具。
            </div>
            <div v-else class="tool-grid">
              <span v-for="t in tools" :key="t.name" class="tool-chip" data-testid="sw-tool-chip">
                {{ t.name }}<em v-if="t.isWriteOperation">写</em>
              </span>
            </div>
          </div>
        </template>

        <!-- 打印：本机真实配置 + 跳既有打印面板 -->
        <template v-else-if="active === 'print'">
          <div class="pane" data-pane="print">
            <div class="ad-note">管理员专属</div>
            <div class="dr-sec">打印设置（本机）</div>
            <div class="dr-row"><span class="k">本地打印助手</span><span class="v">{{ printSummary.agent }}</span></div>
            <div class="dr-row"><span class="k">默认纸张</span><span class="v">{{ printSummary.paper }}</span></div>
            <div class="dr-row"><span class="k">默认份数</span><span class="v">{{ printSummary.copies }}</span></div>
            <div class="dr-row">
              <span class="k">完整打印设置</span>
              <span class="v">打印机选择、模板与测试打印在打印设置面板内</span>
              <el-button size="small" @click="emit('open-print-settings')">打开打印设置</el-button>
            </div>
          </div>
        </template>

        <!-- 外观：明暗切换与恢复 -->
        <template v-else-if="active === 'appear'">
          <div class="pane" data-pane="appear">
            <div class="dr-sec">外观</div>
            <div class="theme-seg" role="group" aria-label="主题">
              <button
                type="button"
                class="ts"
                :class="{ on: theme === 'light' }"
                data-theme-choice="light"
                @click="chooseTheme('light')"
              >亮色</button>
              <button
                type="button"
                class="ts"
                :class="{ on: theme === 'dark' }"
                data-theme-choice="dark"
                @click="chooseTheme('dark')"
              >暗色</button>
            </div>
            <div class="dr-row">
              <span class="k">当前主题</span>
              <span class="v" data-testid="sw-theme-now">{{ theme === "dark" ? "暗色" : "亮色" }}</span>
              <el-button size="small" data-testid="sw-theme-reset" @click="restoreDefaultTheme">恢复默认</el-button>
            </div>
            <div class="dr-row">
              <span class="k">来源</span>
              <span class="v" data-testid="sw-theme-source">{{ themeSourceLabel }}</span>
            </div>
            <p class="pane-hint">主题保存在本机浏览器，不随账号同步；「恢复默认」清除本地记录后回到系统深浅偏好。</p>
          </div>
        </template>

        <!-- 账号与安全 -->
        <template v-else-if="active === 'acct'">
          <div class="pane" data-pane="acct">
            <div class="dr-sec">账号</div>
            <div class="dr-row">
              <span class="k">当前身份</span>
              <span class="v" data-testid="sw-acct-name">{{ account?.name || "未取到身份信息" }}</span>
            </div>
            <div class="dr-row">
              <span class="k">所属门店</span>
              <span class="v">{{ account?.store || "未取到门店信息" }}</span>
            </div>
            <div class="dr-row">
              <span class="k">角色</span>
              <span class="v">{{ userRoles.length ? userRoles.join(" / ") : "无角色（按 fail-closed 仅见公开分区）" }}</span>
            </div>
            <div class="dr-row">
              <span class="k">退出登录</span>
              <span class="v">结束当前会话并返回登录页</span>
              <el-button size="small" @click="emit('logout')">退出登录</el-button>
            </div>
            <div class="dr-sec">账号安全</div>
            <div class="cap-state cap-unavailable" data-testid="sw-acct-pwd">
              <b>修改登录密码 · 暂不可用</b>
              <p>登录密码由业务系统统一管理，工作台侧无改密端点。</p>
            </div>
          </div>
        </template>

        <!-- 系统配置：跳真实 /system 页，不在弹层内复制真值 -->
        <template v-else-if="active === 'config'">
          <div class="pane" data-pane="config">
            <div class="ad-note">管理员专属</div>
            <div class="dr-sec">系统配置</div>
            <div class="dr-row">
              <span class="k">系统配置页</span>
              <span class="v">参数、组织、角色等配置仍在原配置页维护，避免两处真值分叉</span>
              <el-button size="small" data-testid="sw-open-system" @click="emit('open-system-config')">
                打开系统配置
              </el-button>
            </div>
          </div>
        </template>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  SETTINGS_TABS,
  visibleSettingTabs,
  type RoleResolver,
  type SettingTab,
  type SettingTabKey,
} from "../../shared/workbench/wb-settings";
import {
  clearStoredTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  themeDataAttribute,
  type WbTheme,
} from "../../shared/workbench/wb-theme";
import { fetchAiModels, fetchAiTools, type AiModelOption, type AiToolInfo } from "../../api/ai";
import { getLocalPrintConfig, PAPER_TYPE_LABELS } from "../../modules/print/localConfig";
import { getErrorMessage } from "../../utils/error";

const props = defineProps<{
  modelValue: boolean;
  userRoles: readonly string[];
  resolveRoles: RoleResolver;
  account: { name: string; store: string } | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  logout: [];
  "open-print-settings": [];
  "open-system-config": [];
}>();

const tabs = computed(() => visibleSettingTabs(props.userRoles, props.resolveRoles));
const active = ref<SettingTabKey>("appear");
const activeTab = computed<SettingTab | undefined>(
  () => tabs.value.find((tab) => tab.key === active.value) ?? tabs.value[0],
);

/** 打开时若当前选中项已不可见（角色变化），回落到首个可见分区 */
watch(
  () => [props.modelValue, tabs.value.length] as const,
  () => {
    if (!props.modelValue) return;
    if (!tabs.value.some((tab) => tab.key === active.value)) {
      active.value = tabs.value[0]?.key ?? "appear";
    }
  },
  { immediate: true },
);

function selectTab(key: SettingTabKey): void {
  active.value = key;
  if (key === "model") {
    void loadModels();
    void loadTools();
  }
  if (key === "print") printSummary.value = readPrintSummary();
}

const isPlaceholderPane = computed(
  () => activeTab.value !== undefined && PLACEHOLDER_KEYS.has(activeTab.value.key),
);
const PLACEHOLDER_KEYS: ReadonlySet<SettingTabKey> = new Set(["conn", "ops"]);

const retrying = ref(false);
const retryHint = ref("");
async function retryCapability(): Promise<void> {
  retrying.value = true;
  retryHint.value = "";
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // 端点仍不存在：如实回读，不把它翻成 ready
    retryHint.value = "重试后仍无法取得对接状态";
  } finally {
    retrying.value = false;
  }
}

/* ── AI 模型 ── */
type PaneState = "idle" | "loading" | "ready" | "error";
const modelState = ref<PaneState>("idle");
const models = ref<AiModelOption[]>([]);
const modelDefault = ref("");
const modelError = ref("");
async function loadModels(): Promise<void> {
  modelState.value = "loading";
  modelError.value = "";
  try {
    const resp = await fetchAiModels();
    models.value = resp.models ?? [];
    modelDefault.value = resp.default ?? "";
    modelState.value = "ready";
  } catch (error) {
    models.value = [];
    modelDefault.value = "";
    modelError.value = getErrorMessage(error, "接口不可用");
    modelState.value = "error";
  }
}

const toolsState = ref<PaneState>("idle");
const tools = ref<AiToolInfo[]>([]);
const toolsError = ref("");
async function loadTools(): Promise<void> {
  toolsState.value = "loading";
  toolsError.value = "";
  try {
    tools.value = await fetchAiTools();
    toolsState.value = "ready";
  } catch (error) {
    tools.value = [];
    toolsError.value = getErrorMessage(error, "接口不可用");
    toolsState.value = "error";
  }
}

/* ── 打印：读本机真实配置 ── */
function readPrintSummary() {
  const cfg = getLocalPrintConfig();
  return {
    agent: cfg.useLocalAgent ? `开启（${cfg.agentBaseUrl || "默认地址"}）` : "关闭",
    paper: PAPER_TYPE_LABELS[cfg.paperType] ?? cfg.paperType,
    copies: String(cfg.copies),
  };
}
const printSummary = ref(readPrintSummary());

/* ── 外观：切换 + 持久化 + 恢复 ── */
const systemPrefersDark =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
const storage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

const theme = ref<WbTheme>(resolveTheme(storage, systemPrefersDark));
const themeSourceLabel = computed(() =>
  readStoredTheme(storage) ? "本机已记录" : systemPrefersDark ? "跟随系统（深色）" : "跟随系统（浅色）",
);

function applyToDom(value: WbTheme): void {
  if (typeof document === "undefined") return;
  const attr = themeDataAttribute(value);
  if (attr) document.documentElement.setAttribute("data-wb-theme", attr);
  else document.documentElement.removeAttribute("data-wb-theme");
}

function chooseTheme(value: WbTheme): void {
  theme.value = value;
  writeStoredTheme(storage, value);
  applyToDom(value);
}

function restoreDefaultTheme(): void {
  clearStoredTheme(storage);
  theme.value = systemPrefersDark ? "dark" : "light";
  applyToDom(theme.value);
}

/** 打开弹层即回显当前真实主题，避免显示值与 DOM 属性分叉 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    theme.value = resolveTheme(storage, systemPrefersDark);
    applyToDom(theme.value);
  },
);

defineExpose({ active, tabs, theme, SETTINGS_TABS });
</script>

<style scoped>
.sw-hd {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sw-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}
.sw-sub {
  font-size: var(--text-caption);
  color: var(--text-muted);
  margin-left: auto;
}
.sw-bd {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: var(--space-6);
  min-height: 320px;
}
.sw-nav {
  display: flex;
  flex-direction: column;
  gap: var(--nav-item-gap);
  border-right: 1px solid var(--border-light);
  padding-right: var(--space-3);
}
.sw-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: var(--nav-item-padding);
  border: 0;
  border-radius: var(--nav-item-radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-body);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast) ease, color var(--transition-fast) ease;
}
.sw-nav-item:hover {
  background: var(--bg-soft);
}
.sw-nav-item.on {
  background: var(--color-primary-bg);
  color: var(--color-primary-text);
  font-weight: var(--font-semibold);
}
.sw-badge {
  font-size: var(--text-caption);
  color: var(--text-muted);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-pill);
  padding: 0 6px;
}
.sw-body {
  min-width: 0;
}
.sw-empty {
  color: var(--text-muted);
  font-size: var(--text-body);
}
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.ad-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  font-size: var(--text-caption);
  color: var(--text-muted);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
}
.dr-sec {
  font-size: var(--text-caption);
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-top: var(--space-2);
}
.dr-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}
.dr-row .k {
  flex: 0 0 120px;
  font-size: var(--text-body);
  color: var(--text-secondary);
}
.dr-row .v {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--text-body);
  color: var(--text-primary);
}
.tag {
  font-size: var(--text-caption);
  border-radius: var(--tag-radius);
  padding: var(--tag-padding);
}
.tag-ok {
  background: var(--color-success-soft);
  color: var(--color-success-text);
}
.tag-info {
  background: var(--color-info-soft);
  color: var(--text-secondary);
}
.cap-state {
  border: 1px dashed var(--border-normal);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-size: var(--text-body);
  color: var(--text-secondary);
}
.cap-unavailable {
  border-color: var(--border-normal);
}
.cap-error {
  border-color: var(--border-error);
  border-style: solid;
}
.cap-state p {
  margin: 6px 0 10px;
  color: var(--text-muted);
}
.retry-hint {
  margin-left: 10px;
  font-size: var(--text-caption);
  color: var(--text-muted);
}
.tool-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.tool-chip {
  font-size: var(--text-caption);
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
  color: var(--text-secondary);
}
.tool-chip em {
  font-style: normal;
  margin-left: 4px;
  color: var(--color-danger);
}
.theme-seg {
  display: inline-flex;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.ts {
  border: 0;
  background: transparent;
  padding: 5px 16px;
  font-size: var(--text-body);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast) ease;
}
.ts.on {
  background: var(--color-primary);
  color: var(--text-inverse);
}
.pane-hint {
  font-size: var(--text-caption);
  color: var(--text-muted);
  line-height: 1.6;
}
.sk {
  display: block;
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--skeleton-bg);
}
.sk-row {
  margin-bottom: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .sw-nav-item,
  .ts {
    transition: none;
  }
}
</style>
