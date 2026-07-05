import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles.css";
import "./register-sw";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(ElementPlus);
app.use(router);

// 全局 Vue 错误捕获
app.config.errorHandler = (err, _instance, info) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[Vue Error] ${info}: ${message}`, stack);
  // 上报到后端错误日志
  fetch("/api/error-log/frontend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "vue",
      severity: "ERROR",
      message: `[${info}] ${message}`,
      stack: stack || "",
      source: "frontend",
      timestamp: new Date().toISOString()
    }),
  }).catch(() => {});
};

// 全局未捕获 Promise 错误
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  const stack = event.reason instanceof Error ? event.reason.stack : undefined;
  console.error(`[Unhandled Promise Rejection] ${message}`, stack);
  fetch("/api/error-log/frontend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "promise",
      severity: "ERROR",
      message,
      stack: stack || "",
      source: "frontend",
      timestamp: new Date().toISOString()
    }),
  }).catch(() => {});
});

// 全局未捕获异常
window.addEventListener("error", (event) => {
  const { message, filename, lineno, colno, error } = event;
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[Global Error] ${message} at ${filename}:${lineno}:${colno}`, stack);
  fetch("/api/error-log/frontend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "global",
      severity: "FATAL",
      message: `${message} (${filename}:${lineno}:${colno})`,
      stack: stack || "",
      source: "frontend",
      timestamp: new Date().toISOString()
    }),
  }).catch(() => {});
});

app.mount("#app");
