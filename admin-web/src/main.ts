import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
// element-plus 按需导入：由 unplugin-vue-components 和 unplugin-auto-import 自动处理
// ElTable/ElForm 等 UI 组件由 Components + ElementPlusResolver 自动注册
// ⚠️ 但**函数式组件不在其列**：`import { ElMessage } from "element-plus"` 是显式导入，
//    resolver 只给模板里自动注册的组件补样式 ⇒ 不补 message 样式，`.el-message` 就以静态块
//    落到文档末尾（top = 视口高），屏幕上看不见提示（WORKBENCH-13-F1 三视口实测：top 1000/768/844）。
//    骨架意图未命中的「可重试告警」必须真的可见（卡 §三.8），所以这里显式补它的样式。
// F2 收口（卡 §三.1/§三.2）：确认框与通知同样是显式导入的函数式组件，resolver 一样不补样式。
// 此前 `.el-message-box` 的 CSS 只是 `ZxElTable.vue` 的副作用 ⇒ 不渲染表格的页面（如 /messages）
// 里确认框会退化成无遮罩、无背景、静态定位的裸块；`.el-notification` 更是全仓无人引入。
// 三类样式统一在应用入口加载，业务页面不再靠碰巧挂载某个组件才拿到弹窗 CSS。
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/notification/style/css";
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
