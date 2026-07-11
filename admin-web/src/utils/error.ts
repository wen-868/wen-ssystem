import { ElMessage } from "element-plus";

export function handleError(error: unknown, fallback: string): void {
  const axiosError = error as { response?: { status?: number; data?: { msg?: string; message?: string } }; message?: string; code?: string };

  if (axiosError?.code === "ECONNABORTED" || axiosError?.message?.includes("timeout")) {
    ElMessage.error("请求超时，请重试");
    return;
  }

  if (!axiosError?.response) {
    ElMessage.error("网络连接失败，请检查网络");
    return;
  }

  const { status, data } = axiosError.response;
  const msg = data?.msg || data?.message || fallback;

  switch (status) {
    case 401:
      break;
    case 403:
      ElMessage.error("无权限访问");
      break;
    case 404:
      ElMessage.error("请求的资源不存在");
      break;
    case 500:
      ElMessage.error("服务器内部错误，请稍后重试");
      break;
    default:
      ElMessage.error(msg);
      break;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  if (axiosError && typeof axiosError === "object" && "response" in axiosError) {
    return axiosError.response?.data?.msg || axiosError.response?.data?.message || fallback;
  }
  return fallback;
}