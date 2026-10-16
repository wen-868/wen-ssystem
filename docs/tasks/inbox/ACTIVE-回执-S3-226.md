# ACTIVE-回执 · S3-226（营销域权限接线 · 第 43 项 B2 批 8）

> **汇报对象**：凌舟（总负责人）｜**汇报人**：阿坚（后端 / 权限 · 本地子代理 `/root/s3231_ajian`）
> **日期**：2026-10-16｜**对应派单编号**：**S3-226**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-226`｜分支 `feat/s3-226-marketing-domain-wiring`｜基线 `ea29ee1f`
> 完整十项回传：`docs/tasks/cards/R101-S3-226-阿坚-回传.md`（本文件是其摘要，署名项一致）
> **未 push、未开 PR、未动 `ACTIVE.md` / `current-tasks.md`**

## 一、改了什么

**营销域 18 文件 / 89 条写端点 ⇒ 本批接线 65 条**（内联 `requirePermission`，全部**既有**权限码）：

| 文件 | 条数 | 落地码 |
|:--|--:|:--|
| `admin-marketing-coupon.routes.ts` | 3 | `marketing:create` |
| `admin-marketing-full-reduction.routes.ts` | 2 | `marketing:create` |
| `admin-marketing-group-buy.routes.ts` | 6 | `marketing:create` |
| `admin-marketing-points.routes.ts` | 1 | `marketing:points` |
| `admin-marketing-stack-rule.routes.ts` | 3 | `marketing:create` |
| `marketing-asset.routes.ts` | 3 | `marketing:create` |
| `marketing-gift-rule.routes.ts` | 8 | `marketing:create` |
| `marketing-limited-discount.routes.ts` | 7 | `marketing:create` |
| `marketing-material.routes.ts` | 8 | `marketing:create` |
| `marketing-points-mall.routes.ts` | 7 | `marketing:points` |
| `points-mall.routes.ts` | 6 | `marketing:points` |
| `points.routes.ts` | 2 | `marketing:create` |
| `retail-announcement.routes.ts` | 3 | `marketing:create` |
| `retail-announcements-admin.routes.ts` | 3 | `marketing:create` |
| `seckill.routes.ts` | 3 | `marketing:create` |

**未接 24 条**（逐条登记在台账 §十五.4–15.6）：
**Q 1**（`POST /admin/marketing/calculate` 是查询型 POST，service 只读不写）／
**B 9**（app-mobile 写调用点落在推送深链 / 首页快捷入口 / 孤岛页 / 菜单码零映射的页）／
**W 14**（页面可见角色含 `READONLY` / 旧词表 `STORE_ADMIN` / 店长 / 销售 / 客服 ⇒ 接线即 403，属授权模型口径）。

**配套改动**：新增用例 `rbac-b2-s3-226-marketing-wiring.test.ts`（305 条）；
`rbac-g0-wiring.test.ts` 计数快照 +65（215 → 280，G0 名单行一字未动）；
`rbac-b2-s3-223-finance-wiring.test.ts` 跨批对照行同步 215 → 280（已报备，见 §五.4）；
台账 §十五；机读基线 480 → **415**（文件 129 → **118**）；证据 `docs/evidence/S3-226/**`。
行尾自检：5 个路由文件在 HEAD 上末行无换行，编辑后一度补上 ⇒ 已按哈希/字节还原为原状（`tools/check-final-newline.mjs`，复检 ✅）。

**未改**：`.github/**`、`deploy/**`、契约文档、收口总清单、`current-tasks.md`、`docs/migrations/**`、角色种子、其它单工作树。

## 二、证据（命令 + 原始输出 + 读数）

| 项 | 读数 / 文件 |
|:--|:--|
| 门禁（合并态前后） | 已接线 **244 → 309**、缺口 **480 → 415**、文件 **129 → 118** ⇒ `11-guard-after-wiring.txt` |
| 严格模式 | **EXIT=0**（未登记 0 / 陈旧登记 0）⇒ `12-guard-strict-after.txt` |
| 反测 A（报告） | 摘 1 条接线 ⇒ 309→308 / 415→416 / 118→119 ⇒ `25-neg-report.txt` |
| 反测 B（严格） | 同上 ⇒ **EXIT=1** 点出 `points-mall.routes.ts:22`；复原 ⇒ EXIT=0 ⇒ `26-` / `29-` |
| 反测 C（用例） | **3 failed / 302 passed**；复原 ⇒ **305 passed** ⇒ `27-neg-vitest-red.txt` |
| 逐字节还原 | SHA256 前后一致（`F851C15F…9882F`）⇒ `raw/25-` / `raw/28-` |
| 回归四道 | 全量 **676 文件 / 9261 用例全绿**、tsc EXIT=0、eslint 0 error、根 build EXIT=0 ⇒ `30~33-*.txt` |
| 判定留档 / 调用面 | `01-plan-and-judgements.md`（含工具两处缺陷的修正留档）／`02-callers.txt` |

## 三、对账（派单卡 §三.1）

**89 = 65（已接） + 9（B） + 14（W） + 1（Q）** —— 一条不多、一条不少（测试内有机器复算用例）。

## 四、未完成与阻塞

1. 剩余 **24 条**未接，三类原因逐条登记（台账 §十五.4–15.6 + `UNWIRED.note` 的码位方案）。
2. **阻塞一条生产读数**：判定"页面可见角色"的菜单映射证据是**菜单 64 行时期**的导出，而底稿显示菜单已 **89 行**
   且**未给"角色×菜单码"矩阵** ⇒ 无法核实 `marketing:*` 是否已授予工作角色。复核 SQL 见台账 §十五.9-6。
   若结论为"仍未授予"，本批 23 条 B/W 类可批量接线（码位已备）。
3. `git fetch origin` 两次被重置（网络）⇒ 基线取本地 `origin/main` = `ea29ee1f`。

## 五、风险与自我报备

1. **32 条"无有效调用点"的取舍**（含 6 组前端路径/方法错配 ⇒ 今天即 404）：按批 4 §12.2 先例接线；若口径改为"错配未修不接"，可整批回退。
2. **同域两套码**（flash-sale 用 `sale:*`、本批用 `marketing:*`）：未擅自统一，已登记待裁定（`marketing:*` 更严）。
3. **`marketing:points` 用于积分商城 CRUD** 属语义借用（仓库无积分域细写码；另立即"新立权限点"，本单禁止）。
4. **改了他人批次的测试文件 1 处**（`rbac-b2-s3-223-finance-wiring.test.ts` 跨批计数对照行）：只同步期望值、未放宽断言，
   **请裁定是否追认**；不追认则本单整体回退。
5. **反测顺序教训**：台账未更新时摘接线只产生"已登记缺口"⇒ `--strict` 仍绿（假绿）；必须先跑 `update-baseline.mjs` 再注入。
6. **工作区 `AGENTS.md` 与卡面红线冲突**（前者要求移 `ACTIVE.md` 到 `archive/` 并更新 `current-tasks.md`）：
   以**卡面红线为准，两处均未动**（`ACTIVE.md` 是多单并行路由表）。

## 六、环境复原

1. `npm install --legacy-peer-deps --no-audit --no-fund`（与 `ci.yml:24` 同口径），未改 `package.json` / lock。
2. 反测注入文件已按哈希逐字节还原，`git diff` 无残留；无遗留调试文件。
3. `ACTIVE.md` / `ACTIVE-S3-225.md` / `ACTIVE-S3-226.md` 未动（路由表归凌舟）。

## 七、一行摘要

**营销域 89 条 → 接线 65 条（缺口 480 → 415、文件 129 → 118），24 条逐条登记（Q1/B9/W14），
305 条两侧用例 + 反测两侧 + 全量回归四道全绿（676 文件 / 9261 用例），未 push、未开 PR。**
