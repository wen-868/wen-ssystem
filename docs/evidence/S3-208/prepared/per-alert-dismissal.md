# 准备就绪但**未执行**：12 条 `js/path-injection` 的逐条排除清单（方案甲）

> 状态：**未执行**。理由：这是对仓库安全状态（code scanning 告警）的外部写入，超出本单授权
> （卡面与 `ACTIVE.md` 均写明"只动自己的工作树与本分支；不得 push、不得开 PR"）。请凌舟/业主放行后由任一方执行。
> 判定依据与证据：`docs/evidence/S3-208/README.md` §四（含可执行回归 `backend/src/__tests__/security/path-sanitizer-s3-208.test.ts`）。
> 拟执行日期：2026-10-15（若延后执行，请把 `dismissed_comment` 里的日期改为实际执行日）。

## 一、执行命令（逐条，原因固定为 `false positive`）

```powershell
# 12 条误报（理由逐条不同，见 §二）
gh api -X PATCH repos/wen-868/wen-ssystem/code-scanning/alerts/265 -f state=dismissed `
  -f dismissed_reason="false positive" -f dismissed_comment="<见 §二 第 1 行>"
# … 266 … 276 同形，逐条替换编号与理由

# 可选：消费者小程序登录（main #287，不在 23 条内）——业主口径"登录不限流"
gh api -X PATCH repos/wen-868/wen-ssystem/code-scanning/alerts/287 -f state=dismissed `
  -f dismissed_reason="won't fix" -f dismissed_comment="<见 §三>"
```

`dismissed_reason` 取值只能为：`false positive` / `won't fix` / `used in tests`（GitHub 枚举）。
撤销：同一条 `-f state=open`。

## 二、12 条逐条理由（编号＝告警号，位置＝当前 `main 2fe8f109` 的 `most_recent_instance`）

| 告警号 | 位置 | 理由（拟写入 `dismissed_comment`） |
|:--:|:--|:--|
| 265 | `backend/src/controllers/admin/avatar.controller.ts:44` | 误报：落盘名由服务端 JWT 的 tenantId/userId + Date.now() + `path.extname(originalname)` 组成，扩展名必须命中 `.jpg/.jpeg/.png/.gif/.webp` 白名单；用户输入无法贡献路径分隔符。回归：`path-sanitizer-s3-208.test.ts`（穿越载荷落盘在目标目录内）。判定日期 2026-10-15。 |
| 266 | `backend/src/controllers/admin/product-image.controller.ts:41` | 误报：与 265 同形（`ALLOWED_EXT` 白名单 + 服务端 tenantId）。判定日期 2026-10-15。 |
| 267 | `backend/src/services/admin/miniapp-upload.service.ts:132` | 误报：路径经自研 `safeSegment()`（`replace(/[^\w-]/g,"_")`）消解，`/`、`.`、`..` 无法存活；CodeQL 未建模该净化形态。回归：`path-sanitizer-s3-208.test.ts`（穿越租户/平台只落 2 个安全文件）。判定日期 2026-10-15。 |
| 268 | `…miniapp-upload.service.ts:138` | 同上。判定日期 2026-10-15。 |
| 269 | `…miniapp-upload.service.ts:146` | 同上。判定日期 2026-10-15。 |
| 270 | `…miniapp-upload.service.ts:150` | 同上。判定日期 2026-10-15。 |
| 271 | `…miniapp-upload.service.ts:153` | 同上。判定日期 2026-10-15。 |
| 272 | `…miniapp-upload.service.ts:159` | 同上。判定日期 2026-10-15。 |
| 273 | `…miniapp-upload.service.ts:168` | 同上。判定日期 2026-10-15。 |
| 274 | `…miniapp-upload.service.ts:173` | 同上。判定日期 2026-10-15。 |
| 275 | `backend/src/shared/zip.ts:100` | 误报：`zipPath` 由唯一生产调用方 `miniapp-package.service.ts:140` 构造，含 `getStorageDir()` + `safeName(tenantId)` + `THEME_IDS` 白名单主题 + 时间戳，无用户可控分隔符。判定日期 2026-10-15。 |
| 276 | `backend/src/shared/zip.ts:168` | 同上。判定日期 2026-10-15。 |

## 三、可选第 13 条：消费者小程序登录（`main` #287）

| 告警号 | 位置 | 理由 |
|:--:|:--|:--|
| 287 | `backend/src/routes/wechat.routes.ts:22`（`POST /api/miniapp/wechat/auth/login`） | 有意为之：登录路由按业主口径不限流（`server.ts:237` 注释"应用户要求不限流——演示登录/多设备共享IP场景不再触发429"）。它不在第 57 项的 23 条内；全站已有 `server.ts` 的 600 次/分钟/IP 全局限流兜底。判定日期 2026-10-15。 |

## 四、执行后应看到的变化（可核对）

- `gh api 'repos/wen-868/wen-ssystem/code-scanning/alerts?state=open&per_page=100'` 的 `js/path-injection` 计数：**12 → 0**；
  若同时排除 287，`js/missing-rate-limiting` 计数：**141 → 140**（本单已接线 15 条路由，但**未合并** ⇒ 合并前的 open 计数不会因本单变化）。
- 下一次 PR 的 `CodeQL` check 注解数应从 23 降到 **0**（12 条误报被排除、11 条已接线；未合并前仍会报）。
