/**
 * 运行 / 构建环境配置
 *
 * - H5 端：经 Vite 开发代理，默认使用相对路径 `/api`（可由构建环境变量 VITE_API_BASE 覆盖）。
 * - App / 小程序端：使用生产 API 域名，由构建环境变量 VITE_API_BASE 注入；未配置时回退占位地址。
 *
 * ⚠️ 请勿在本文件硬编码真实生产域名。真实值通过 CI / .env（VITE_API_BASE）在构建时注入。
 * 注：src/utils/pin-ssl.ts 的证书固定（PINNED_CERTS）**当前未接线**（全仓零调用点）；在册指纹为 2026-10-21 采集的
 *     现网 Let's Encrypt 值（api.onepan.cn 叶子 2026-11-11 到期、m.onepan.cn 叶子 2026-12-22 到期，均在有效期内），
 *     未接线的原因是"原生层证书回调可用"这一前置尚未满足，**不是**指纹已过期。
 *     PINNED_CERTS 按域名登记，故换 API 域名或叶子证书轮换时都**必须**同步更新在册叶子指纹；
 *     维护口径与接线前置见 docs/tasks/cards/R101-QODER-5-回传.md（S3-247）。
 */

export const API_BASE_H5: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) || '/api'

export const API_BASE_NATIVE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined) || 'https://api.onepan.cn/api'
