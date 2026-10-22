# QODER-29 · `uni.request/uploadFile/downloadFile` 全量盘点（MO-29）

> 机检出处：`app-mobile/scripts/guard-request-contract.mjs`（`--json` 落 `raw/30-guard-inventory.json`）。
> 口径：只统计 `app-mobile/src/**/*.ts|vue` 的**非注释行**里的直接网络调用；普通请求经 `request.ts` 的 `get/post/put/del` 走统一入口，**不**计入直接调用。
> 总直接调用点：**8 处**，全部在册且未超额（守卫 A 通过），除统一入口本体外均复用 `buildRequestHeaders`（守卫 B 通过）。

| # | 文件:行 | 类型 | 分类 | 安全头来源 | 超时 | 允许理由 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/api/request.ts:102` | `uni.request` | **统一入口本体** | 入口自身即安全头出处（`buildRequestHeaders`） | 默认 30000，可覆写 | Promise 封装 `uni.request`，是鉴权/租户/CSRF 的唯一出处；所有普通请求经它。 |
| 2 | `src/api/modules/ai.ts:259` | `uni.request` | AI 非 H5 SSE 降级（`streamChatLegacy`） | `buildHeaders()` → `buildRequestHeaders()` | 走 AI 底座，Abort 由 RequestTask.abort | AI 底座是**独立服务基址**（`AI_BASE_URL`），SSE 一次性取回本地 `dispatchSseText` 解析，不能走 Promise 型统一入口；安全头与 request.ts 同源。 |
| 3 | `src/api/modules/ai.ts:383` | `uni.request` | AI 模型列表（非 H5，`fetchAiModels`） | 同上 | — | 同上（独立 AI 基址）。 |
| 4 | `src/api/modules/ai.ts:416` | `uni.request` | AI 写操作确认/取消（`requestConfirmation`） | 同上 | — | 独立 AI 基址、非流式 POST。 |
| 5 | `src/api/modules/ai.ts:457` | `uni.request` | AI TTS（`voiceTts`） | 同上 | 20000 | 独立 AI 基址，返回 mp3 base64。 |
| 6 | `src/api/modules/products.ts:603` | `uni.uploadFile` | 商品主图上传（multipart） | `const header = buildRequestHeaders()` | — | `uni.uploadFile` 是 multipart 上传，非 JSON 请求入口；安全头复用统一构建器。 |
| 7 | `src/api/modules/profile.ts:47` | `uni.uploadFile` | 头像上传（multipart） | `const header = buildRequestHeaders()` | — | 同上；**本卡修复了旧实现漏发 `X-Tenant-Id`** 的缺陷（旧码只拼 token+csrf）。 |
| 8 | `src/utils/update.ts:177` | `uni.downloadFile` | 热更新 `.wgt` 包下载 | `header: buildRequestHeaders()` | — | 二进制流下载，非请求型入口；URL 已过 `decideUpdateAction` 同源/白名单/摘要四闸（QODER-24 口径），本卡补上统一安全头。 |

## 收口动作（普通请求归口统一入口）

- `src/utils/update.ts` 的版本检查 `checkAppUpdate()` 原为**裸 `uni.request`**，本卡改走统一入口 `request<LatestAppVersion | null>({ url, method:'GET', timeout:8000, silent:true })`，经 HTTP 2xx 业务码判定；`resolveBase()` 的取值与 `request.ts` 的 `BASE_URL` 完全等价（native 默认 / H5 覆写），URL 主机不变。

## 守卫登记册（改调用面必须先改本表 = 更新基线）

```json
{
  "src/api/request.ts":        { "count": 1, "reason": "统一请求入口本体" },
  "src/api/modules/ai.ts":     { "count": 4, "reason": "AI 底座独立服务基址 + SSE/写操作确认/TTS" },
  "src/utils/update.ts":       { "count": 1, "reason": "热更新 .wgt 包 uni.downloadFile" },
  "src/api/modules/products.ts":{ "count": 1, "reason": "商品主图 multipart uni.uploadFile" },
  "src/api/modules/profile.ts": { "count": 1, "reason": "头像 multipart uni.uploadFile" }
}
```

> 新增未登记的直接调用 ⇒ 守卫 A 红；任一含直接调用且非 `request.ts` 的文件不再引用 `buildRequestHeaders(` ⇒ 守卫 B 红。反测见 `anti-test-ledger.md` 轮 ② / ④。
