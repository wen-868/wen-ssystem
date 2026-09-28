import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles/tokens.css";
import "./styles/components.css";
import App from "./App.vue";
import router from "./router";

// ==================== 前端错误捕获上报 ====================
let isReportingError = false;
let lastReportTime = 0;

function reportFrontendError(payload: {
  error_type: string;
  message: string;
  stack?: string;
  url?: string;
}) {
  const now = Date.now();
  if (isReportingError || now - lastReportTime < 1000) return;
  isReportingError = true;
  lastReportTime = now;
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      source: "saas-admin",
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {}).finally(() => {
    isReportingError = false;
  });
}

const app = createApp(App);

app.config.errorHandler = (err, _vm, info) => {
  console.error("[Vue Error]", err, info);
  reportFrontendError({
    error_type: "vue",
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    url: window.location.href,
  });
};

window.addEventListener("error", (event) => {
  console.error("[Window Error]", event.error || event.message);
  reportFrontendError({
    error_type: "window_error",
    message: event.message || "未知错误",
    stack: event.error?.stack,
    url: window.location.href,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Rejection]", event.reason);
  const reason = event.reason;
  reportFrontendError({
    error_type: "unhandled_rejection",
    message: reason?.message || String(reason) || "未处理的 Promise 拒绝",
    stack: reason?.stack,
    url: window.location.href,
  });
});

app.use(createPinia());
app.use(ElementPlus);
app.use(router);
app.mount("#app");

/* ═══════════════════════════════════════════════════════════════
   S3-137-F1 · 无障碍收口：Element Plus 下拉的「可访问名」兜底
   ───────────────────────────────────────────────────────────────
   现象（CI 实测，run 36479274432 的 a11y job）：/subscriptions 报
     axe `label` **critical** ×3 —— 三个 `<input class="el-select__input" role="combobox">`
     没有任何可访问名（两个筛选下拉 + 分页内置 sizes 下拉）。

   根因（Element Plus 上游，可照路径复核）：
     · el-select 只在调用方显式传 aria-label 时才给内部输入框可访问名
       —— node_modules/element-plus/es/components/select/src/select2.mjs:217/303（_ctx.ariaLabel）；
     · el-pagination 的内置 sizes 下拉**根本没有透传 aria-label 的入口**
       —— node_modules/element-plus/es/components/pagination/src/components/
          sizes.vue_vue_type_script_setup_true_lang.mjs:36-42（只传 model-value/disabled/… 8 个 prop）。
   ⇒ 本仓库 8 个 saas-admin 页面用 `layout="…, sizes, …"`，每个都会命中同一缺陷；
     逐页补 aria-label 只能覆盖写到的页面，故这里在**应用层统一收口**（全站生效）。

   规则（保守，只补不加害）：
     1) 已有可访问名（aria-label / aria-labelledby / 关联 <label>）⇒ 一律不碰；
     2) 分页内置 sizes 下拉 ⇒ 固定名「每页条数」；
     3) 其余下拉 ⇒ 取**正在显示的占位文案**（EP 用 .el-select__placeholder.is-transparent
        标记「当前显示的是占位符」，即界面上唯一的可见标签）作为可访问名；
     4) 取不到文案就不动它（不猜）。
   退出条件：Element Plus 提供配置入口、或全站下拉都已显式声明 aria-label 后，删掉本段即可。
   ═══════════════════════════════════════════════════════════════ */
function nameElementPlusSelect(input: HTMLInputElement): void {
  if (input.getAttribute("aria-label") || input.getAttribute("aria-labelledby")) return;
  if (input.labels && input.labels.length > 0) return;
  const root = input.closest(".el-select");
  if (!root) return;
  if (root.closest(".el-pagination__sizes")) {
    input.setAttribute("aria-label", "每页条数");
    return;
  }
  const placeholder = root.querySelector(".el-select__placeholder.is-transparent");
  const text = (placeholder?.textContent ?? "").trim();
  if (text) input.setAttribute("aria-label", text);
}

function sweepElementPlusSelects(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLInputElement>(".el-select__input")
    .forEach(nameElementPlusSelect);
}

sweepElementPlusSelects();
new MutationObserver((records) => {
  for (const record of records) {
    record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(".el-select__input")) nameElementPlusSelect(node as HTMLInputElement);
      else sweepElementPlusSelects(node);
    });
  }
}).observe(document.body, { childList: true, subtree: true });
