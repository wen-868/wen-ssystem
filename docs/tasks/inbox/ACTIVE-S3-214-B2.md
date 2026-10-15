# ACTIVE-S3-214-B2 · 采购域权限接线（B2 批 2 · 阶段②）= 收口总清单第 43 项（续）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树（**本单唯一允许写的工作树**）：`D:\Users\ZXQL\wt-agents\S3-214`
> 卡名（认领用）：`/root/s3220_ajian`（见 `docs/tasks/inbox/ACTIVE.md` 路由表）
> 开工前先对齐基线：`git -C D:\Users\ZXQL\wt-agents\S3-214 fetch origin`，然后
> `git checkout -B feat/s3-214-batch2-wiring origin/main`。
> ⚠️ 工作树里已有的 `docs/evidence/S3-214/**`（阶段①产物）**尚未入库，必须保留**，不要删、不要覆盖。

---

## 一、一句话目标

把**采购域 31 条"无任何权限码"的写端点**按「该端点真实使用者已持有的模块码」接线，
使 `guard-rbac-wiring` 缺口 **641 → 641 − N**，且**现有页面角色零回归**（不被 403）。

## 二、范围（9 个路由文件 / 31 端点，逐条清单已给）

- 逐条清单：`docs/evidence/S3-214/01-roles-to-verify.md` §二 + §三（每行含：方法/路径/后端 `file:行`/前端调用点/拟用码/页面角色依据）
- 域：`/api/admin/purchase*`、`/api/admin/supplier*` 的 9 个路由文件
- **排除项（本批不接线，只在回执里登记）**：
  1. **移动端「销售开单」采购页签的 4 个创建端点** —— 该页签**无权限门**（`app-mobile/src/pages/sales/create-sale.vue:23`），接线会把店长由"可用"打成 403；
  2. 阶段① §六 中"找不到使用者已持有码、又不宜挂 `purchase:*`"的端点 ⇒ 登记「**待授权模型定案**」。

## 三、阶段②口径（凌舟已用**生产实测**下发，照此执行；**不要**自行统一成 `purchase:*`）

生产只读实测（`t_sys_role.permissions`，`tenant_id='default'`）：

| 角色 | 持有的相关码 | 与本域的关系 |
|:--|:--|:--|
| `SUPER_ADMIN` | `["*"]` | 全通 |
| `STORE_MANAGER` | `store:* sale:* customer:* inventory:* report:* dashboard:* finance:payment goods:price finance:daily-settle` | **无 `purchase:*`、无 `supplier:statement`**；却是采购退货/供应商对账/采购计划三页的允许角色 |
| `WAREHOUSE_STAFF` | `inventory:* trace:* transfer:* stock-check:*` | **无 `purchase:*`**；入库单审核在业务上就是仓管 |
| `FINANCE_STAFF` | `finance:* report:* customer:statement supplier:statement dashboard:view` | **无 `purchase:*`**；"采购付款"页的审核按钮已在页面上 |

据此接线（五条）：

1. **优先挂"该端点真实使用者已持有的模块码"**（零回归）：
   - 采购入库 / 入库审核 ⇒ 用 **`inventory:*`** 域既有码；
   - 采购付款 / 付款审核 ⇒ 用 **`finance:*`** 域既有码；
   - 供应商对账 ⇒ 用 **`supplier:statement`** 或 `report:*`（二选一，回执给理由）；
   - 采购退货（店长页面在用）⇒ 用 **`sale:return`** 或 `store:*` 域既有码。
2. **只有"采购岗专属、且使用者本来就不是上述角色"的端点**（如采购单新增/修改/删除）才挂 **`purchase:*`**，并在回执**注明"该码当前仅 `SUPER_ADMIN` 持有"**。
3. 移动端「销售开单」采购页签 4 个创建端点 ⇒ **本批不接线**，登记「待移动端补权限门后收编」。
4. 找不到"使用者已持有"的码、又不宜挂 `purchase:*` ⇒ **不接线**，登记「待授权模型定案」。
5. 逐端点两侧反测（缺码 ⇒ 403 / 有码 ⇒ 通过 / **摘中间件 ⇒ 用例必红**），台账守恒，门禁全绿。

## 四、验收判据（缺一不可，逐条给原始输出）

1. **对账**：`31 = N（本批接线） + 4（移动端排除） + 待定数`，逐条列出三类的端点名；
2. **两侧反测**：① 缺码 ⇒ 403；② 有码 ⇒ 通过；③ **摘掉中间件 ⇒ 用例红**（证明用例有分辨力，不是恒绿）；
3. **门禁**：`node backend/scripts/guard-rbac-wiring.mjs` 缺口 = **641 − N**；`--strict` **EXIT=0**（新接线必须登记进 baseline，不许只改数不改台账）；
4. **回归**：全量 `npx vitest run` **0 failed**、`npx tsc --noEmit` 0、`npm run build` 0；
5. **零回归论证**：对每个用到的码，列出"生产中有哪些角色持有"并证明这些角色正是该端点页面/按钮的真实使用者（查询 SQL 见阶段① §七）。

## 五、红线（违反即作废）

1. **不得新增权限码、不得改角色种子权限、不得动迁移**（"哪个角色该有哪些码"属产品决策 ⇒ 不在本单）；
2. 不得改 `.github/**`、`deploy/**`、`docs/migrations/**`、契约文档、收口总清单；
3. 不得碰其它单的工作树与分支（尤其 `wt-agents/S3-211`、`wt-agents/S3-212`）；
4. **不得 push、不得开 PR、不得 `git add -A`**（只在自己的分支提交）；
5. 证据与日志里**不得出现口令/密钥明文**（第 69 项，2026-10-16 立）；
6. 回传卡**不得**出现「凌舟裁定 / 凌舟验收」字样。

## 六、交付物

1. **代码**：接线改动 —— 一律用 `routeConfig` 声明式 `requirePermission`（与先例 `backend/src/routes/purchase.routes.ts:13/:18` 同形态）；
2. **测试**：本域两侧用例 + 摘中间件反测用例；
3. **台账**：`backend/scripts/rbac-wiring-baseline.json` 更新 + `docs/tasks/R101-RBAC接线缺口清单.md` 对应行订正；
4. **证据**：`docs/evidence/S3-214/**`（原始输出 + 可复跑脚本）；
5. **回传**：`docs/tasks/cards/R101-S3-214-B2-阿坚-回传.md`（十项格式）+ `docs/tasks/inbox/ACTIVE-回执-S3-214-B2.md`。

## 七、回传十项（缺项即不合格）

交付物 ｜ 改动面（文件 + 行号 + 性质）｜ 证据（可复跑命令 + 原始输出）｜ 验收自评（对照 §四 逐条）｜
未完成与阻塞 ｜ 风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡

## 八、卡外纪律

- 发现卡外问题 ⇒ **只登记不动手**，写进回执 §六。
- 本单预计一个会话内出最小闭环；若 2 小时仍未拿到"接线 N 条 + 两侧反测 + 门禁守恒"，**先在回执里报进度与卡点**，不要沉默、也不要为了凑数放宽判据。
