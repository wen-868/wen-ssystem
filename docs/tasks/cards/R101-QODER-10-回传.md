# R101-QODER-10-回传 · 移动端收尾三件（dismissBanner 接 × / note 过期刷新 / 4 条陈旧台账清理）

> 派单人：凌舟｜执行：**Qoder（移动端）**｜回传日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-10-移动端收尾三件.md`
> 分支 `chore/qoder-10-mobile-closeout2`｜基线：**#368 尖端 `844515d5`**（含 1~7+9 链）
> ⚠️ 未 push、未开 PR、未 `git add -A`（逐文件 add）；本卡不含任何「凌舟裁定/验收结论」，判据读数均为**自评**。

## 〇、基线与提交

- 基线 `844515d5` = 任务书指定 #368 分支尖端（`fix/qoder-9-b31-backend-and-parity`），工作树 `D:\Users\ZXQL\wt-agents\QODER-10`（junction node_modules ×3，主仓未受扰）。
- 实现提交 **`00a6b76e`**（7 文件，diffstat 见 `raw/11`）；本卡 + 回执 + 证据为第二笔提交。

## 一、三件 × 修法 × 读数总表

| 件 | 动作 | 文件 | 读数 |
|---|---|---|---|
| ① dismissBanner 接 × | 两页横幅在「重试」后各加 `<text class="*-banner-close" @tap="menuStore.dismissBanner()">×</text>` + `.*-banner-close` 样式（`$uni-text-color-grey`）；装置四步用例 +1、两页挂载点静态断言 +2 | `functions.vue:21`、`more-functions.vue:14`、`permission-view-state.spec.ts` | 四步原始输出见 §二.1；store 侧「仅本次会话」本就是内存态（`noticeDismissed` ref + `load()` catch 复位），本件缺的只是 × UI，现补齐并进门禁 |
| ② note 过期 | `permission-gates.ts:598` 改为「后端 4 条**已接** `sale:return`（`aftersale.routes.ts`:49/51/69/74，QODER-9 接线）⇒ 本门为 **gated**」；spec 三处联动：文件头判据 2 段、`PENDING_WIRING` 4 条理由串（旧行号 66/71 修正为 69/74）、`:198` 断言 `toContain('S3-250')` → `toContain('已接')`+`toContain('gated')` | `permission-gates.ts`、`entry-gate-consistency.spec.ts` | 禁词 rg 0 命中（§二.2）；`PENDING_WIRING` 表保留——wired 分支优先命中不再被查，留作回落安全网 + 合成转绿机检/反例自检/orphan 检测三用例锚点 |
| ③ 4 条陈旧清理 | 台账删 4 条（§三逐条判定）；`_counts` 同步 `files 88→87 / endpoints 293→289 / wiredEndpoints 419→423`；加 `_qoder10_note` 留痕 | `backend/scripts/rbac-wiring-baseline.json` | **清理前 293 ／ 清理后 289 ／ 未登记 0 ／ 陈旧 0**（`raw/01/03/09`）；和式 289+45+6+423=**763**=scannedEndpoints 守恒；`wiredPermOccurrences 390` 不动（g0 :775 只数 `requirePermission(`，这 4 条是 `requirePlatformPermission(`） |

## 二、判据读数（任务书 §二逐条，原始输出落盘）

1. **①四步装置** ✅（`raw/05-specs-affected.log:5-10`）：
   - `[步1] ③态 ⇒ bannerText="权限信息未取到，已按最小可见集显示，请下拉刷新重试" showRetry=true status=firstfail`
   - `[步2] 点 × ⇒ bannerText="" 存储键 before=[] after=[]`（**关闭态不落持久存储的机检**：dismiss 前后存储键集合恒等）
   - `[步3] 再次③态 ⇒ bannerText=同文案重现 status=firstfail`（refresh 再失败 ⇒ catch 复位 noticeDismissed）
   - `[步4] 再点 × ⇒ bannerText=""`
   - 该用例常驻 test 门（非一次性脚本），摘 × 即红（§四反测）。
2. **②禁词 0 命中** ✅（`raw/04-note-rg-clean.log`，MSYS 排除态 `export MSYS2_ARG_CONV_EXCL='*'`）：`rg -n "S3-250|未接" app-mobile/src/config/permission-gates.ts` → **RG_EXIT=1（0 命中）**；顺带全 app-mobile `rg "S3-250"` 亦 0 命中。
3. **③清理前后计数** ✅（`raw/01/02/03/09`）：`guard --strict` 清理前「293 / 未登记 0 / 陈旧 4（仅提示）」→ 清理后「**289 / 未登记 0 / 陈旧 0**」，两态 EXIT=0；陈旧 4 条以 `guard --json` × 台账差集机读具名（现况 `authForm=inline`）。
4. **④回归不劣化** ✅：app-mobile test 门 **5 文件 / 56 用例全过**（改动后 `raw/06`，终态基线同步后复跑 `raw/10` EXIT=0）；`type-check` **0 新增 = 基线 0**（`raw/07`）；backend **全量 vitest 192 文件 / 3916 用例 passed**（`raw/08`，含 g0 和式断言与 s3-238 行级形状断言，均不依赖被删登记）。`backend/` 改动 = **单一台账 JSON 4+/9-**（`raw/12`），`backend/src` 零改动——与「零改动」字面矛盾见 §五①。

## 三、4 条陈旧逐条判定（任务书点名必交）

| # | 文件:端点 | 判定 | 理由（现场证据） |
|---|---|---|---|
| 1 | `platform-applications.routes.ts`｜`PUT /api/platform/applications/:id/approve` | **已接线可删 → 删** | `:35-37` 注册行挂 `requirePlatformPermission("tenant:manage")`（S3-238），guard --json 现况 `hasPermission:true, authForm:"inline"`；行级形状断言由 `rbac-b2-s3-238-platform-wiring.test.ts` 独立锁定，不依赖台账 |
| 2 | `platform-applications.routes.ts`｜`PUT /api/platform/applications/:id/reject` | **已接线可删 → 删（整键移除）** | `:44` 同上；该文件缺口清零，键整体删除 |
| 3 | `tenant-register.routes.ts`｜`POST /api/tenant/applications/:id/approve` | **已接线可删 → 删** | `:43-45` `requirePlatformPermission("tenant:manage")`；S3-238 双前缀同业务两侧同批接 |
| 4 | `tenant-register.routes.ts`｜`POST /api/tenant/applications/:id/reject` | **已接线可删 → 删** | `:52` 同上 |
| — | `tenant-register.routes.ts`｜`POST /api/tenant/register`、`POST /api/tenant/register/sms-code` | **仍缺需保留** | 现况 `authForm:"none"`（routeConfig.auth="none" 真公开注册链），是真登记缺口，s3-229 测试以 PUB 类在册 |

## 四、反测（门必须能红）——`anti/` 五件套

按 QODER-9 已验证的口令模式（注入 ⇒ 红 ⇒ **同命令内 cp 复原** ⇒ sha 逐字节一致 ⇒ 复跑绿）：
1. `anti/pre-sha256.txt`：两页注入前 sha（functions.vue `2a594038…`、more-functions.vue `344f0664…`）。
2. 注入点：**只摘 functions.vue** `func-banner-close` 行（模板行+样式选择器共 2 行，node latin1 字节精确过滤，不用 sed 以避 QODER-9 CRLF 事故）。
3. `anti/post-strip-red.txt`：vitest **EXIT=1**，红行点名 `pages/functions/functions.vue：横幅内 × 必须直调 menuStore.dismissBanner()`（29 用例 1 failed）。
4. `anti/post-restore-sha256.txt`：cp 复原 ⇒ sha 与第 1 步**逐字节一致**。
5. `anti/post-restore-green.txt`：复跑 **EXIT=0** 全绿。
②的 note 内容亦已被断言锁死：note 若回退成「待承接」旧口径，`entry-gate-consistency.spec.ts` 的 `toContain('已接')/('gated')` 即红；③的机检=guard 前后对照 + backend 全量（无台账则和式/strict 关系破裂）。

## 五、口径偏差报备（任务书文字 vs 仓库事实，均按事实执行）

1. **判据④「backend/ 零改动（merge-base..HEAD）」与判据③「陈旧=0」内部矛盾**：`--strict` 的陈旧判定直接读 `backend/scripts/rbac-wiring-baseline.json`，不改该文件则陈旧不可能为 0（唯一替代是改 guard 脚本本身，改动面更大且非任务书所指）。本单按 QODER-9 先例（台账=判据绿路径的机械必要联动）执行：backend/ 改动**严格限定**为该单一 JSON 的登记列表与 `_counts`，`backend/src` 零改动（`raw/12` 自证）。
2. **②新 note 比任务书建议文案多两句**：孤岛页口径与「白名单退化为回落安全网」为仓库事实所需（删掉会与实际机制失联）；任务书要求的「已接（:49/51/69/74）；本门为 gated」语义全数在内，禁词全避。
3. **①「仅本次会话记住（不写持久存储）」store 早已满足**：`menu.ts` 的 `noticeDismissed` 是纯内存 ref、`load()` catch 复位，无任何持久写；本件实际缺口是 × 按钮 UI（QODER-8 实测），非行为。用例步 2 以「存储键 before==after」把该口径机械化，防将来误加持久化。
4. **用例数**：任务书未给数字。实测 53→**56**（+3），按 `test-gate.mjs`「升了请把基线同步调高」指令同步 `gates-baseline.json` 并留痕。
5. **三线并行不撞面**：本卡与并行子代理 QODER-11（docs/清单执行记录）、QODER-12（docs+scripts/pin-spki.sh）各在独立工作树独立分支，文件集合与本卡 7 文件零交集。

## 六、红线对照

未 push、未开 PR、未 `git add -A`（逐文件 add）；未写「凌舟裁定/验收结论」；只动本工作树与本分支；证据无零字节文件（`find -size 0` 复核为空，无需 .note.txt 配对）。

## 七、未完成与阻塞

- **无「陈旧>0 即红」的常驻门禁**：本单陈旧清理靠一次性 `guard --json` × 台账差集机读；若要常态红线（陈旧即 CI 红），需给 `guard-rbac-wiring.mjs` 加 `--no-stale` 类开关，属另行单，未擅动。
- **`permission-gates.ts:596` basis 行号仍旧**（confirm-receipt 写 :64，实际 :67）：非任务书点名面、非禁词，未越面修改，提请后续治理单。

## 八、风险与自我报备

- × 为纯模板/样式追加，无 `#ifdef` 交互；两页样式 token（`$uni-text-color-grey`）系 uni.scss 既有。
- 台账删除仅动缺口登记列表：guard「已登记欠账」口径 289 条为**现场真值**（4 条早已接线却不早删，属基线既有陈旧，QODER-9 `raw/23` 已录 293=289+4）。
- `wiredPermOccurrences` 若未来把 `requirePlatformPermission(` 并入口径，g0 :775 与台账需同步——本单未动该口径。

## 九、交付物与证据清单

- 代码 7 文件（实现提交 `00a6b76e`，diffstat `raw/11`）。
- `docs/evidence/qoder-10/raw/`：01 清理前 guard、02 guard --json 快照、03 清理后 guard、04 rg 禁词 0 命中、05 受影响 specs 全绿（含四步装置原始输出）、06 全量 test 门、07 type-check、08 backend 全量 3916、09 前后计数汇总、10 终态 test 门、11 提交 diffstat、12 backend 面自证。
- `docs/evidence/qoder-10/anti/`：pre-sha256.txt、functions.vue.bak、post-strip-red.txt、post-restore-sha256.txt、post-restore-green.txt。
- 本卡 + `docs/tasks/inbox/ACTIVE-回执-QODER-10.md`。

## 十、一行摘要

三件全收口：① 两页横幅 × 接 `dismissBanner`（四步装置常驻门禁，反测摘 × 即红、复原字节一致）；② island-aftersale note 刷新为「4 条已接 sale:return ⇒ gated」（禁词 0 命中，spec 三处联动）；③ 台账 4 条陈旧逐条具名判「已接线可删」并删除（清理前 293/清理后 289/未登记 0/陈旧 0，和式 763 守恒）；回归 app-mobile 56/56、tsc 0=0、backend 全量 3916 全过；backend/ 面=单一台账 JSON（判据内部矛盾已披露 §五①）。
