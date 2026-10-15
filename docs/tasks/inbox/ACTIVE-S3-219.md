# ACTIVE-S3-219 · 平台侧 4 域目录扩 + 28 条写端点接线（收口总清单第 67 项落地单）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树（**本单唯一允许写的工作树**）：`D:\Users\ZXQL\wt-agents\S3-219`｜分支 `feat/s3-219-platform-domain-wiring`
> 卡名（认领用）：`/root/s3221_platform`（见 `docs/tasks/inbox/ACTIVE.md` 路由表）
> 依据（先读）：`docs/tasks/cards/R101-S3-213-第67项平台RBAC后继-凌舟裁定.md`（裁定 ②③）、`docs/tasks/R101-平台RBAC接线台账.md`（105 端点台账）

---

## 一、一句话目标

把台账里 **`library`(15) / `open`(10) / `review`(3) = 28 条"需先扩目录"的平台写端点**接线，
办法是**只在平台侧目录扩 3 个域码**，逐域分批、先做生产角色核对，最后台账守恒 + 门禁全绿。

## 二、为什么这样做（裁定已定，不要另起炉灶）

- **不建**平台独立绑定表（一管理员一角色够用，属"按需启动"）；
- **不在商家侧 `PERMISSION_CATALOG` 扩**（会动"18 条 / 8 域"既有契约 + 8 条断言 + saas-admin 角色矩阵页）；
- **改在平台侧目录扩**：`backend/src/middleware/platform-rbac.ts` 的 `PLATFORM_PERMISSIONS`
  （`PlatformPermissionSpec.moduleCode` 与迁移 179 的 `t_platform_role_permission.module_code` 对齐）。

## 三、交付物（三块，缺一不可）

1. **① 目录扩**：在 `platform-rbac.ts` 的 `PLATFORM_PERMISSIONS` 新增
   `library:manage` / `open:manage` / `review:manage`（命名沿用既有 `<moduleCode>:<action>`；
   若该文件已有其它平台的域码，形态与它们逐字对齐）。
   ⚠️ **商家侧 `backend/src/shared/user-permissions.ts` 的 `PERMISSION_CATALOG` 一行都不许动**。
2. **② 28 条接线**：逐域分批（顺序：`library` → `open` → `review`），一律用 `routeConfig` **声明式** `requirePlatformPermission`
   （与 S3-193 试点域同一形态；不要写端点内联鉴权、不要 `auth:"none"`+自造校验）。
   ⚠️ 与 S3-190/S3-196/S3-210 已处置的三类写法（CSRF 与鉴权挂载顺序）保持一致：声明式 routeConfig 会由 `auto-routes` 统一挂鉴权 + CSRF。
3. **③ 台账与门禁**：
   - `docs/tasks/R101-平台RBAC接线台账.md`：28 条状态由「需先扩目录 / 待接线」→「已接线」，并更新 §一 汇总计数；
   - `node backend/scripts/s3-193-platform-rbac-ledger.mjs --check` **EXIT=0**（计数守恒 + 逐条映射断言）；
   - `node backend/scripts/guard-rbac-wiring.mjs --strict` **EXIT=0**（若本域端点落在该基线内，按流程更新 `backend/scripts/rbac-wiring-baseline.json`，不许只改数不改台账）。

## 四、开工前必须先做的一件事（**生产角色核对**，批 1 的教训）

批 1（S3-198）在**追溯域**接线时差点造成 403 回归，根因是"页面允许角色 ⊉ 码持有者"。
因此**每个域接线前**，先在生产只读通道核对"平台侧角色 × module_code"：

```sql
-- 平台角色清单与其已持有 module_code（生产只读；表结构见迁移 179）
SELECT r.role_code, p.module_code, p.can_menu, p.can_page_btn
FROM t_platform_role r JOIN t_platform_role_permission p ON p.role_id = r.id
ORDER BY r.role_code, p.module_code;
```

把结果写进证据（`docs/evidence/S3-219/`），并据此回答：
"新增 `library:manage` 后，**今天能打开商品库页面的平台角色**会不会因为不持有该码而 403？"
若会 ⇒ **停下来在回执 §六 报备**，不要自行扩角色权限（扩权限属产品决策）。

## 五、验收判据（逐条给原始输出）

1. **目录扩**：3 个新码在 `PLATFORM_PERMISSIONS` 中可解析（给出 `hasPermission`/枚举的实证，例如一个小脚本或单测）；
2. **接线**：28 条逐条列出（文件:行 + 端点 + 权限点），且 **`rg -n 'auth:\s*"none"' <本批文件>` = 0 新增**；
3. **两侧反测**：① 无该码的平台令牌 ⇒ **403**；② 有该码 ⇒ 通过；③ **摘掉中间件 ⇒ 用例必红**（证明用例有分辨力）；
4. **回归**：全量 `npx vitest run` 0 failed、`npx tsc --noEmit` 0、`npm run build` 0；
5. **两份台账一致**：`--check` EXIT=0 且 28 条状态位全部更新；
6. **未触碰项自证**：给出 `git diff --name-only origin/main HEAD`，并逐条说明**为什么每个文件都在卡内范围**（商家侧目录/断言/saas-admin 契约/saas-admin 页面必须 0 改动）。

## 六、红线（违反即作废）

1. **不得**动商家侧 `PERMISSION_CATALOG`（`backend/src/shared/user-permissions.ts`）与其断言，**不得**动 saas-admin 角色矩阵页契约；
2. **不得**新增商家侧权限码、**不得**改角色种子权限、**不得**动 `docs/migrations/**`；
3. **不得**改 `.github/**`、`deploy/**`、契约文档、收口总清单；
4. **不得**碰其它单的工作树（`wt-agents/S3-214`、`wt-agents/S3-211`、`wt-agents/S3-212`）；
5. **不得** push、**不得**开 PR、**不得** `git add -A`；
6. 证据与日志里**不得出现口令/密钥明文**（第 69 项，2026-10-16 立）；
7. 回传卡**不得**出现「凌舟裁定 / 凌舟验收」字样。

## 七、交付与回传

- 代码：`platform-rbac.ts` + 逐域路由文件 + 用例；
- 证据：`docs/evidence/S3-219/**`（目录扩实证、生产角色核对结果、两侧反测原始输出、门禁输出）；
- 回传：`docs/tasks/cards/R101-S3-219-阿坚-回传.md`（十项格式）+ `docs/tasks/inbox/ACTIVE-回执-S3-219.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据（可复跑命令 + 原始输出）｜ 验收自评（对照 §五 逐条）｜ 未完成与阻塞 ｜
风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡

## 八、卡外纪律

- 发现卡外问题 ⇒ **只登记不动手**，写进回执 §六；
- 逐域分批时，**每完成一个域就先落一次证据**（不要三个域一起攒到最后）；
- 若 2 小时内出不了"第一个域（library 15 条）的最小闭环"，先在回执里报进度与卡点，不要沉默。
