/**
 * 运行 / 构建环境配置
 *
 * - H5 端：经 Vite 开发代理，默认使用相对路径 `/api`（可由构建环境变量 VITE_API_BASE 覆盖）。
 * - App / 小程序端：使用生产 API 域名，由构建环境变量 VITE_API_BASE 注入；未配置时回退占位地址。
 *
 * ⚠️ 请勿在本文件硬编码真实生产域名。真实值通过 CI / .env（VITE_API_BASE）在构建时注入。
 * 域名变更时，同步更新 src/utils/pin-ssl.ts 的证书固定指纹（PINNED_CERTS）。
 */

export const API_BASE_H5: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) || '/api'

export const API_BASE_NATIVE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) || 'https://api.onepan.cn/api'
