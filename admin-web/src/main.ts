import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
// element-plus 按需导入：由 unplugin-vue-components 和 unplugin-auto-import 自动处理
// ElMessage/ElMessageBox 等函数式组件和样式由 AutoImport + ElementPlusResolver 自动导入
// ElTable/ElForm 等 UI 组件由 Components + ElementPlusResolver 自动注册
import "./styles/tokens.css";
import "./styles.css";
import App from "./App.vue";
import router from "./router";
import { reportFrontendError } from "./api";
import { useAuthStore } from "./stores/auth";
import { installGlobalRowClick } from "./plugins/globalRowClick";

const app = createApp(App);

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

app.config.errorHandler = (err, vm, info) => {
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.error("[Vue Error]", err, info);
  reportFrontendError({
    error_type: "vue",
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    url: window.location.href,
  });
};

window.addEventListener("error", (event) => {
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.error("[Window Error]", event.error || event.message);
  reportFrontendError({
    error_type: "window_error",
    message: event.message || "未知错误",
    stack: event.error?.stack,
    url: window.location.href,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.error("[Unhandled Rejection]", event.reason);
  const reason = event.reason;
  reportFrontendError({
    error_type: "unhandled_rejection",
    message: reason?.message || String(reason) || "未处理的 Promise 拒绝",
    stack: reason?.stack,
    url: window.location.href,
  });
});

// element-plus 组件由 unplugin-vue-components 自动注册，无需 app.use(ElementPlus)
app.use(router);

// 统一门户 SSO 注入（P2：本地门户 iframe 透传管理系统登录态）
window.addEventListener("message", (event) => {
  const allowedOrigins = ["http://127.0.0.1:8080", "http://localhost:8080"];
  if (!allowedOrigins.includes(event.origin)) return;
  const data = event.data;
  if (!data || data.type !== "ops-portal-login" || !data.token) return;
  const auth = useAuthStore();
  auth.setAuth(data.token, data.user || {}, data.csrfToken || "");
  if (window.location.pathname === "/login") {
    window.location.href = "/";
  }
});

// 全局表格整行点击直达明细（所有列表页生效）
installGlobalRowClick();

app.mount("#app");
