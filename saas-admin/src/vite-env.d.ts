/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** AI 底座服务地址（AI 配置管理端点所在服务，默认 http://localhost:3016） */
  readonly VITE_AI_BASE_URL?: string;
}
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}