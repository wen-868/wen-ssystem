import { createApp } from "vue";
import ElementPlus from "element-plus";
import { ElMessage } from "element-plus";
import "element-plus/dist/index.css";
import "./styles.css";
import "./register-sw";
import App from "./App.vue";
import router from "./router";
import { reportFrontendError } from "./api";

const app = createApp(App);
app.use(ElementPlus);
app.use(router);

// Vue 全局错误处理器
app.config.errorHandler = (err: unknown, _instance, info: string) => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error("[store-terminal] Vue 错误:", error.message, info);
  ElMessage.error(`系统错误: ${error.message}`);
  reportFrontendError({
    error_type: "vue_error",
    message: error.message,
    stack: error.stack?.slice(0, 2000) || undefined,
    url: window.location.href,
  });
};

// 未捕获 Promise 拒绝
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason || "未处理的 Promise 拒绝");
  console.error("[store-terminal] 未处理的 Promise 拒绝:", reason);
  ElMessage.error(`操作异常: ${message}`);
  reportFrontendError({
    error_type: "unhandledrejection",
    message,
    stack: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
    url: window.location.href,
  });
});

// 全局未捕获异常（window.onerror）
window.addEventListener("error", (event: ErrorEvent) => {
  const { message, filename, lineno, colno, error } = event;
  console.error(`[store-terminal] 全局错误: ${message} at ${filename}:${lineno}:${colno}`);
  reportFrontendError({
    error_type: "global_error",
    message: `${message} (${filename}:${lineno}:${colno})`,
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
    url: window.location.href,
  });
});

app.mount("#app");
