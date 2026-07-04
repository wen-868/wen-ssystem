import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles.css";
import App from "./App.vue";
import router from "./router";
import { reportFrontendError } from "./api";

const app = createApp(App);

app.config.errorHandler = (err, vm, info) => {
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

app.use(ElementPlus);
app.use(router);
app.mount("#app");