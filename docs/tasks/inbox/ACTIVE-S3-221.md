# ACTIVE-S3-221 · admin-web 文本 token 纳入对比度矩阵（收口总清单第 71 项）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**林夕（前端/门禁）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树（**本单唯一允许写的工作树**）：`D:\Users\ZXQL\wt-agents\S3-221`｜分支 `chore/s3-221-adminweb-token-matrix`
> 卡名（认领用）：`/root/s3224_frontend`（见 `docs/tasks/inbox/ACTIVE.md` 路由表）
> 依据：`docs/tasks/cards/R101-S3-50-CI红测与S3-61取样-凌舟验收结论.md`（第 13 项验收暴露的盲区）+ 收口总清单第 71 项

---

## 一、问题（已被我实测复现，不是推测）

`scripts/contrast-check.cjs` 的对比度矩阵**只读 `saas-admin/src/styles/tokens.css`**（文本 token）+ admin-web 的 `CHART_COLORS`（图表色），
⇒ **`admin-web` 自身的文本 token 不在任何对比度门禁的覆盖清单里**。

实测反例（第 13 项取证，run `38788778207`）：把 `admin-web/src/styles/tokens.css` 的 `--text-muted`（**62 处引用**）由 `#6d6d6d` 改成 `#cccccc`（白底 1.61:1，**远低于 AA 4.5:1**）后：
- 对比度矩阵门禁（required e2e 步 12）：**绿**（因为不覆盖 admin-web 文本 token）；
- a11y 取样 job：**绿**（只扫 4/164 个路由，未覆盖用到它的页面）。
⇒ **该 token 改坏了没有任何门禁会红**。这就是本单要堵的洞。

## 二、目标（把 admin-web 文本 token 纳入矩阵，并有反证）

1. 扩 `scripts/contrast-check.cjs`：**动态读取 `admin-web/src/styles/tokens.css`** 的文本 token（与 saas-admin 同法：**改回坏值必红**，非写死期望值），
   纳入矩阵分组（建议组名 `admin-web token`）；至少覆盖：`--text-primary` / `--text-secondary` / `--text-muted` / `--sidebar-text-*` / `--text-link` / `--text-placeholder`（**以文件里实际存在的为准**，缺哪个就跳过哪个，不许写死一个不存在的 token 凑数）；
   背景集合沿用现有口径（`白底 #FFFFFF` / `#f7f7f7(--g0/--bg-page)` / `#f0f0f0(--bg-soft 最严边界)`）；
   阈值：文本 4.5:1（非文本/边框 3:1 若也在清单内，按现有口径分类）。
2. **不得**放宽 saas-admin 既有行、**不得**删除任何既有断言、**不得**加 `continue-on-error`。
3. **反证（本单的核心验收）**：
   - **红侧**：临时把 `admin-web` 的 `--text-muted` 改成 `#cccccc` ⇒ `node scripts/contrast-check.cjs` **必须 EXIT=1** 且点名该 token；
   - **绿侧**：复原 ⇒ **EXIT=0**（并给出「未改前本来就绿」的对照）；
   - **新值不写死**：把 `--text-muted` 改成 **另一个不达标值**（如 `#bbbbbb`）⇒ 仍 EXIT=1（证明判据读的是真实取值，不是期望值常量）。
4. **顺带核对**：`e2e.yml` 里 `saas-admin a11y gate (contrast matrix)` 那一步跑的就是这个脚本 ⇒ 无需改 workflow（若你发现必须改，先停下来在回执报备，**.github/** 属红线）。

## 三、判据（逐条给原始输出）

1. 扩面后的矩阵**全量输出**（含新增的 `admin-web token` 行，逐行给比值与 PASS/FAIL）；
2. 上述**红侧 / 绿侧 / 换值仍红**三段原始输出；
3. `node --check scripts/contrast-check.cjs` = 0；脚本**零新增依赖**；
4. 既有 saas-admin 行**一条未动**：给出 `git diff` 说明（新增行 vs 修改行分开列）；
5. 全量 `npx vitest run` 0 failed（若本单不涉后台代码，至少给 `npm --workspace admin-web run build` = 0）。

## 四、红线

1. 不得改 `.github/**`、`deploy/**`、`docs/migrations/**`、后端业务代码；
2. **不得**为了让新行变绿而改 `admin-web/src/styles/tokens.css` 的取值（本单只扩门禁覆盖面；若发现**真实不达标**的 token，**只登记**并写进回执 §六 等我裁定）；
3. 不得碰其它单的工作树（`wt-agents/S3-220` 等）；
4. **不得 push、不得开 PR、不得 `git add -A`**；
5. 证据里不得出现口令/密钥明文（第 70 项守卫已接 CI）；
6. 回传卡**不得**出现「凌舟裁定 / 凌舟验收」字样。

## 五、交付物与回传

- 代码：`scripts/contrast-check.cjs`（扩面）；如确需**同批**新增自检夹具，放 `docs/evidence/S3-221/`；
- 证据：`docs/evidence/S3-221/**`（矩阵全量输出、三段反证、diff 说明）；
- 回传：`docs/tasks/cards/R101-S3-221-林夕-回传.md`（十项格式）+ `docs/tasks/inbox/ACTIVE-回执-S3-221.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据（可复跑命令 + 原始输出）｜ 验收自评（对照 §三 逐条）｜ 未完成与阻塞 ｜
风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡

## 六、卡外纪律

- **不要**去"顺手"扩取样 job 的路由面（那是另一条路，属第 71 项的备选方案 B，由我裁定后另派）；
- 若扩面后发现既有 `admin-web` token **本身就不达标** ⇒ 属于新发现，**只登记**（含实测比值），不要自行改值。
