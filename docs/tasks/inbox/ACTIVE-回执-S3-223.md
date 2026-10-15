# ACTIVE-回执 · S3-223（财务域权限接线 · B2 批 5）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**｜对应派单编号：**S3-223**
> 认领依据：`docs/tasks/inbox/ACTIVE.md` 路由表 `/root/s3227_ajian`（已复读确认本行仍在）+ 卡 `ACTIVE-S3-223.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-223`｜分支：`feat/s3-223-finance-domain-wiring`｜**未 push、未开 PR**
> 完整十项回传：`docs/tasks/cards/R101-S3-223-阿坚-回传.md`（本回执为其摘要 + 回执口径）

## 一、改了什么

1. **接线 19 条**（财务域 9 文件 / 28 写端点中的 19 条），全部挂**既有**权限码，不新立码、不改角色种子、不动迁移：

| 文件 | 条数 | 落地码 | 端点 |
|:--|--:|:--|:--|
| `bank-account.routes.ts` | 1 | `finance:create` | `PUT /:id` |
| `commission.routes.ts` | 2 | `sale:commission` | `PUT|DELETE /rules/:id` |
| `credit.routes.ts` | 5 | `customer:credit` | `PUT /collections/:id`、`POST /collections/auto-generate`、`POST /collections/batch-remind`、`PUT /:customerId/limit`、`PUT /:customerId/term` |
| `expense.routes.ts` | 3 | `finance:create` | `PUT /:expenseNo`、`POST /:expenseNo/approve`、`POST /:expenseNo/void` |
| `payment-config.routes.ts` | 6 | `finance:create` | `PUT /configs/:provider`、`POST /configs/:provider/test`、`POST|PUT|DELETE /bank-accounts(/:id)`、`POST /bank-accounts/:id/default` |
| `payment-new.routes.ts` | 1 | `finance:payment` | `POST /:paymentNo/void` |
| `receipt.routes.ts` | 1 | `finance:receipt:create` | `POST /:receiptNo/void` |

2. **不接 9 条**（逐条登记，见回传卡 §十三 / §五）：
   - **B 类 5 条**（app-mobile 写调用点所在页的角色集不可枚举）——`POST /admin/bank-accounts/`、`POST /admin/bank-accounts/:id/close`、
     `POST /admin/receipts/`、`POST /admin/reconciliation/{customer,supplier}/.../confirm`；沿用 `rbac-g1-wiring.test.ts` / `rbac-g2-wiring.test.ts` 既有「待裁」锁定，**未改两个文件一个字**；
   - **G0 范围控制锁定 3 条**——`POST /admin/credits/collections`、`POST /admin/commission/calculate`、`POST /admin/payments-new/`；接线必改 `rbac-g0-wiring.test.ts` 的 `NOT_IN_G0` 断言，本批未获授权；
   - **公开回调 1 条**——`POST /api/pay/wx/callback`，保持免鉴权（挂 CSRF 会把正常回调打成 403）。
3. **测试**：新增 `rbac-b2-s3-223-finance-wiring.test.ts`（154 用例：形状断言 + 逐行 403/200 + 非持有人逐账号反证 + 页面角色同源断言 + 范围控制）；
   `rbac-g0-wiring.test.ts` 仅同步"总数 + 逐文件计数"快照（新增 `S3_223_WIRED_FILES`，总数 164 → 183），**G0 名单行与其逐行断言一字未动**。
4. **台账**：机读 `rbac-wiring-baseline.json` 仅移除本域 19 条 + `_counts` 重算 + 两条 note；人读 `R101-RBAC接线缺口清单.md` 新增 **§十三**。
5. **证据**：`docs/evidence/S3-223/**`（判定留档 `01-plan-and-judgements.md`、门禁前后、反测、哈希、其余 6 条门禁复核）。

**提交**：代码 `b75318f0`｜合并 origin/main `f18bb1bb`（HEAD）。

## 二、证据（读数）

| 项 | 读数 | 原始输出 |
|:--|:--|:--|
| `guard-rbac-wiring`（本批基线 90119ef4） | 已接线 151 → **170**；缺口 **573 → 554**（文件 146 → 144） | `docs/evidence/S3-223/10-guard-before.txt` / `11-guard-after.txt` |
| `guard-rbac-wiring`（**合并 origin/main f2beb109 后**） | 已接线 170 → **212**；缺口 **531 → 512**（文件 136 → **134**） | `11-guard-after-merged.txt` |
| `--strict` | **EXIT=0**；台账 512 / 134；未登记 0、已登记但无缺口 0 | `12-guard-strict-after-merged.txt` |
| 本域用例 / 门禁套件 | **154 passed** ／ **810 passed（6 文件）** | `raw/13-vitest-batch.txt` / `raw/13c-vitest-gates-merged.txt` |
| 全量 vitest | **674 files / 8793 tests / 0 failed** | `13-vitest-full-merged.txt` |
| `tsc --noEmit` / backend `lint` / 根 `build` | **EXIT=0** / **EXIT=0（0 error）** / **EXIT=0** | `15-tsc-merged.txt` / `17-lint-merged.txt` / `16-build-merged.txt` |
| 其余 6 条门禁（route-auth / tenant-status / tenant-injection / evidence-secrets / route-prefix / utf8） | **全 EXIT=0** | `79-other-guards.txt` |
| 反测 A（摘 `credits/:customerId/limit` 接线） | `--strict` **EXIT=1** 点出 `credit.routes.ts:60`；用例 **3 failed / 151 passed** | `21-neg-A-strict.txt` / `22-neg-A-vitest-red.txt` |
| 反测 B（摘 `receipts/:receiptNo/void` 接线） | `--strict` **EXIT=1** 点出 `receipt.routes.ts:21`；用例 **3 failed** | `23-neg-B-strict.txt` / `24-neg-B-vitest-red.txt` |
| 反测 C（判据反测：limit 行改挂 `finance:create`） | 用例 **5 failed**（含「店长 uid=9009 ⇒ 应 200」），证明零回归判据**可红** | `25-neg-C-zero-regression-red.txt` |
| 复原校验 | 11 文件哈希**0 处不一致**；`--strict` 回 EXIT=0 | `raw/30-hash-before-neg.txt` |

## 三、阻塞点

**无阻塞**。两点如实报备：

1. **无生产库访问权** ⇒ 持有核对用"卡面下发生产实值 + 仓库种子"，请凌舟复跑
   `SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;` 复核（同 S3-222 §四.1）。
2. **`ACTIVE.md` 我未改动**（四单并行共用路由表，单任务时代的"移入 archive"写法会毁掉其它三单认领行）；**未改** `current-tasks.md`（卡 §四.2 红线）。
   另：本单**未** `git add -A`、未碰 `wt-agents/S3-221`、`S3-222`。

## 四、与卡面口径的两点差异（需凌舟知悉，已在回传卡 §九 列为待裁定）

1. **催收 3 行**挂 `customer:credit`（同文件同域一致性、持有者含店长），**未照**台账机器建议 `finance:create`（会把店长的额度调整打成 403）；
2. **开工期间 `origin/main` 前进**（S3-222 PR #347 → `f2beb109`）：本单已 `git merge origin/main`，冲突 3 处按"两侧并存"处理，`_counts` 按**合并态真值**重算（512 / 134），主读数以合并态为准（另留本批基线读数 573 → 554）。

## 五、最终态补充（两次合并 + 复验）

- **分支已与 `origin/main` 齐平**：开工基线 `90119ef4` → 期间 main 前进两次
  （`f2beb109` = S3-222 #347；`96b7cee7` = S3-221 #348 结项 + 派 S3-224），本单**两次合并**（`f18bb1bb`、`8f06d9bf`），
  当前 HEAD **`8f06d9bf`**，`git status -sb` = `ahead 5`（**不落后**）。
- **两次合并引入的变更与后端无关**（逐文件核对 `git diff --name-only`：`f2beb109..96b7cee7` 仅
  `admin-web/src/styles/tokens.css`、`scripts/contrast-check.cjs`、`docs/**`；`90119ef4..f2beb109` 含 S3-222 的 11 个客户域路由文件——**与本域文件零重叠**）
  ⇒ 本文档 §二 的后端读数（guard 212 / 512 / 134、vitest 674 文件 / 8793 用例、tsc / lint / build）**逐字节有效**。
- **第二次合并后复验**：`guard --strict` **EXIT=0**（`12-guard-strict-after-final.txt`）；
  门禁套件（G0/G1/G2 + 三个 B2 批用例）**810 passed（6 文件）**（`raw/13d-vitest-gates-final.txt`）。
- **提交清单（最终）**：`b75318f0`（代码+证据+台账）→ `f18bb1bb`（合并 ①）→ `ea5e5274`（回执/回传卡+合并后证据）
  → `0484ebf3`（用例同步合并态总数 141→183）→ `8f06d9bf`（合并 ②）→ `ae23f097`（回执/h回传卡补最终态）
  → `dda83586`（证据补 `99-verify-run.txt` 总表 + tsc 日志自描述）。
  ⚠️ 本文档之后还会有**一笔仅改回执/回传卡自身的 docs 提交** ⇒ **最终 HEAD 以分支 `git log --oneline -1` 为准**（不写死，避免自我指涉过期）。
  **全程未 push、未开 PR**；工作区干净。

---

派单人：**凌舟（总负责人）**｜2026-10-16
汇报人：**阿坚（后端 / 权限）**｜2026-10-16
