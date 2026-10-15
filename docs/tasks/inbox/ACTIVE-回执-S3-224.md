# ACTIVE-回执 · S3-224（销售域权限接线 · 第 43 项 B2 批 6）

> **汇报对象**：凌舟（总负责人）｜**汇报人**：阿坚（后端 / 权限 · 本地子代理 `/root/s3228_ajian`）
> **日期**：2026-10-16｜**对应派单编号**：**S3-224**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-224`｜分支 `feat/s3-224-sales-domain-wiring`
> 提交：`50e56a39` → `428103f1` → `c87932f2`（merge origin/main）｜**未 push、未开 PR**
> 完整十项回传：`docs/tasks/cards/R101-S3-224-阿坚-回传.md`（本文件是其摘要，署名项一致）

## 一、改了什么

**销售域 17 文件 / 87 条仍缺口 ⇒ 本批接线 32 条**（内联 `requirePermission`，全部**既有**权限码）：

| 文件 | 条数 | 落地码 |
|:--|--:|:--|
| `admin-marketing-flash-sale.routes.ts` | 2 | `sale:edit` |
| `admin-order.routes.ts` | 3 | `sale:edit` ×2、`sale:void` ×1 |
| `admin-quote-push.routes.ts` | 2 | `sale:create`、`sale:void` |
| `aftersale.routes.ts` | 1 | `sale:return` |
| `commerce-fix.routes.ts` | 4 | `sale:edit` ×3、`sale:void` ×1 |
| `order-timeout.routes.ts` | 3 | `sale:edit` |
| `sale-return.routes.ts` | 2 | `sale:return` |
| `store-order.routes.ts` | 6 | `sale:create` ×5、`sale:void` ×1 |
| `store-sale-bill.routes.ts` | 1 | `sale:create` |
| `store-shift.routes.ts` | 4 | `finance:daily-settle` |
| `instant-retail-store.routes.ts` | 4 | `sale:create` ×3、`sale:void` ×1 |

**未接 55 条**（逐条登记在台账 §十四.5–14.7）：B 类 40（app-mobile 使用者集合不可枚举）／
L 类 2（G0/G1/G2 既有锁定）／Q 类 1（查询型 POST）／P 类 3（真公开回调）／C 类 6（消费者端形态）／
W-M 类 3（岗位管理无对应既有码）。

**配套改动**：新增用例 `backend/src/__tests__/routes/rbac-b2-s3-224-sales-wiring.test.ts`（163 条）；
`rbac-g0-wiring.test.ts` 跨批计数快照 +32（与 S3-223 块合并）；`s3-209-sale-cancel-wiring.test.ts` 对照行改写；
`rbac-b2-s3-223-finance-wiring.test.ts` g0 快照总数 183 → 215；台账 `§十四`；机读基线 531 → **480**（合并态 512 → 480）；
证据 `docs/evidence/S3-224/**`。

**未改**：`.github/**`、`deploy/**`、契约文档、收口总清单、`current-tasks.md`、`docs/migrations/**`、角色种子、其它单工作树。

## 二、证据（命令 + 原始输出 + 读数）

| 项 | 命令 | 读数 / 文件 |
|:--|:--|:--|
| 门禁（合并态） | `node backend/scripts/guard-rbac-wiring.mjs` | **244 已接线 / 480 缺口 / 129 文件** ⇒ `11-guard-after-wiring.txt` |
| 严格模式 | `node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=0**（未登记 0 / 陈旧 0）⇒ `12-guard-strict-after.txt` |
| 反测 A（报告模式） | 摘掉 `store-shift.routes.ts` 班结行的 `requirePermission` | 244→**243** / 480→**481** / 129→**130** ⇒ `25-neg-report-merged.txt` |
| 反测 B（严格模式） | 同上 | **EXIT=1** 且点出 `store-shift.routes.ts:18 POST /api/store/shift/settle`；复原 ⇒ **EXIT=0** ⇒ `26-` / `29-` |
| 反测 C（用例分辨力） | `npx vitest run src/__tests__/routes/rbac-b2-s3-224-sales-wiring.test.ts` | **3 failed / 160 passed**；复原 ⇒ **163 passed** ⇒ `27-neg-vitest-red-merged.txt` |
| 逐字节还原 | `Get-FileHash -Algorithm SHA256` | 注入前后一致（`8B2CD642…2311A9F`）⇒ `raw/25-…` / `raw/28-…` |
| 回归四道 | `npx vitest run` / `npx tsc --noEmit` / `npx eslint src --ext .ts` / 根 `npm run build` | **675 文件 / 8956 用例全绿** · tsc exit 0 · eslint 0 error · build exit 0 ⇒ `30-` `31-` `32-` `33-` |
| 生产持有复算 | `node docs/evidence/S3-220/tools/prod-holders.mjs …` | `05-prod-holders.txt`（**只有 `sale:create`/`sale:return`/`finance:daily-settle` 覆盖收银员**） |
| 调用面清点 | `node docs/evidence/S3-224/tools/callers.mjs` / `page-callers.mjs` | `02-callers.txt` / `03-page-callers.txt` |

## 三、对账（派单卡 §三.1）

台账 §三.5 的 88 是 S3-180 期快照；机读真值 = **87 条仍缺口**。对账：

**87 = 32（已接）+ 40（B 类）+ 2（锁定）+ 1（查询型）+ 3（公开）+ 6（消费者端）+ 3（待授权模型定案）** —— 一条不多、一条不少。

## 四、未完成与阻塞

1. 剩余 **55 条**未接，六类原因逐条登记（台账 §十四.5–14.7）；无阻塞项。
2. 待裁定 4 项（详见卡片 §九）：**孤岛页判据**（36 条可一键接线）／`position.routes.ts` 域归属（建议并入 S3-225）／
   `cart.routes.ts` 门禁判据缺口（另立单）／售后域无细码（接受 `sale:return` 近似）。

## 五、风险与自我报备

1. **40 条 B 类取保守侧**：孤岛页（8 个）"看得到按钮的角色可能为空"，但静态证据只能证明"仓库内无引用"
   ⇒ 按"无法证明不误伤则不动"处理；反向口径（使用者为空 ⇒ 可接）的码位方案已在 §十四.5 备好。
2. **既有测试适配 3 处**，均为**契约变化**（非放宽断言），文件内逐条注明。
3. **合并态报备**：开工期间 S3-223（#349）合入 ⇒ 已 `git merge origin/main`，读数全部按合并态重算
   （512 → 480 / 134 → 129）；3 处冲突按"两边都保留"解决。
4. **工作区入口 `AGENTS.md` 与卡面红线的冲突**：前者要求更新 `current-tasks.md`，卡面 §四.2 禁止 ⇒ 以**卡面红线为准，未改**。

## 六、环境复原

1. `npm install --legacy-peer-deps`（与 `ci.yml:24` 同口径），未改 `package.json` / lock。
2. 反测注入文件 `store-shift.routes.ts` 已按哈希逐字节还原，`git diff` 无残留。
3. 调试用临时探针文件（`src/__tests__/tmp-probe.test.ts`、`src/__tests__/routes/tmp-probe.test.ts`）与 `backend/tmp-debug/` 已删除。
4. `ACTIVE.md` / `ACTIVE-S3-224.md` 未动（S3-223 仍在办，路由表归凌舟）。

## 七、一行摘要

**销售域 87 条仍缺口 → 接线 32 条（合并态缺口 512 → 480、文件 134 → 129），55 条逐条登记（B40/L2/Q1/P3/C6/W-M3），
163 条两侧用例 + 反测两侧 + 全量回归四道全绿，未 push、未开 PR。**
