import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
// element-plus 按需导入：由 unplugin-vue-components 和 unplugin-auto-import 自动处理
// ElMessage/ElMessageBox 等函数式组件和样式由 AutoImport + ElementPlusResolver 自动导入
// ElTable/ElForm 等 UI 组件由 Components + ElementPlusResolver 自动注册
import "./styles.css";
import App from "./App.vue";
import router from "./router";
import { reportFrontendError } from "./api";

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
app.mount("#app");