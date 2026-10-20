# ACTIVE-回执-QODER-9 · B3-1 收口（后端 4 条接线 + parity 契约同步 + 反测五步口令）

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-9-B31收口.md`｜回传卡：`docs/tasks/cards/R101-QODER-9-回传.md`（十项齐）
> 分支 `fix/qoder-9-b31-backend-and-parity`｜基线：**#367 尖端 `b32122a1`**（含 1~7 链；与「含 1~8」的偏差及无影响证明见回传卡 §〇）
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 两件事（全部按已裁口径执行）

- ① **后端接 4 条**：`aftersale.routes.ts` approve/reject/inspect/complete（:49/:51/:69/:74）挂**既有码** `sale:return`（与 confirm-receipt 同码族），零新码、零迁移、零角色种子改动。「4 条 × 码 × 行号」对照表在回传卡 §一，**供 S3-250 销项**。
- ② **parity 契约同步（反转非放宽）**：island-aftersale 进已接表，形状断言用真实 `requirePermission` 注册行（非白名单）；按现场真相源重建为 **gated 27 门 64 行 / registered 9 门 38 行 / 已接去重 62**（任务书 10/39 与现场 9/38 的偏差报备回传卡 §五①）；g0 常量块与机读台账（gaps 删 aftersale 键、`_counts` 419+293+45+6=763）为判据绿路径的机械必要联动（证明行号在卡 §三）。

## 验收三查（凌舟口头径）

- **parity 全过 + rbac 0 failed** ✅：135 passed（EXIT=0）；全量 rbac 18 文件 2363 passed（EXIT=0）。任务书「120 例」与现场不符已按事实登记（基线纯态实测 124）。
- **反测（门必须能红）** ✅：按 2026-10-19 凌舟 5 步口令执行——只摘 :49 approve 一条 ⇒ **EXIT=1 且红行点名** `'POST /api/admin/aftersales/:id/approve'（门 'island-aftersale'）` ⇒ cp 复原 **SHA 逐字节一致**（`6bfd3907…`）⇒ 复跑 135 全过。五份原始输出在 `docs/evidence/qoder-9/anti/`；两次自动化拦截 + 授权过程 + 前置 sed/CRLF 事故报备在回传卡 §四。
- **guard --strict EXIT=0 + tsc 0 + app-mobile 53/0=0** ✅（`raw/23/30a/50/51`；台账 4 条陈旧登记系基线既有、非本单引入，卡 §五⑤）。

## 越面未动项（提请后续单处理）

`app-mobile/src/config/permission-gates.ts:585-599` island-aftersale 的 note 仍写「后端 4 条未接 ⇒ 待接白名单」——**已过期**，但该文件在本单改动面红线外，未动；请 S3-250 或台账治理单刷新。
