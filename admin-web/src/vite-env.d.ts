/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端业务 API 地址（现有 request.ts 使用） */
  readonly VITE_API_BASE?: string;
  /** AI 底座服务地址（SSE 对话 / 确认 / 撤销端点，默认 http://localhost:3016） */
  readonly VITE_AI_BASE_URL?: string;
}
