# R101-QODER-7-回传 · S3-242 收口：16 条漂移修复 + employees 下线 + 离线链整删 + 漂移机进 CI

> 执行人：**Qoder（移动端）**｜回传日期：2026-10-19
> 任务书：`docs/tasks/inbox/QODER-7-漂移修复与零消费件下线.md`｜工作树 `D:\Users\ZXQL\wt-agents\QODER-7`｜分支 `fix/qoder-7-drift-and-orphans`
> ⚠️ 本卡是**执行方回传**，不含任何「凌舟裁定 / 验收结论」；四件事按任务书已裁口径执行，执行中发现的**口径偏差**如实报备（§五）。

## 〇、基线与提交

- 按任务书「栈于 QODER-6 尖端」：基线 = `033a74a6`（卡 6 回传位）。合并顺序：**卡1 → 卡2 → 卡4 → 卡5 → 卡6 → 卡7**（单线栈）。
- `git merge-base origin/main HEAD` = `3fa138e7`；`backend/` 于 `merge-base..HEAD` **0 文件 0 行**（`backend-zero-diff-mergebase.log`）。
- 提交（本地，未 push、未开 PR、未 `git add -A`）：实现/证据一笔、回传一笔，哈希见 §九。

## 一、16 条 × 修法 × 复跑读数总表（任务书 §四点名必交）

前端出处 = `app-mobile/src/config/permission-gates.ts`（注册表 `island-instant-retail-admin`）；后端 `plat:` = `backend/src/routes/instant-retail-admin-platform.routes.ts`，`ops:` = `backend/src/routes/instant-retail-admin-ops.routes.ts`。复跑读数 = `check-contract-drift.mjs --json` 逐行 `hit`（`drift-after-fix.json`）。

| # | 行 | 修法 | 复跑读数（全部 OK） |
|:--|:--|:--|:--|
| 1 | :641 | `POST`→`PUT` | OK `PUT …/deliveries/:deliveryId/status` → `ops:61` |
| 2 | :644 | 删 `/platform` 段 | OK `POST …/configs` → `plat:16` |
| 3 | :645 | 同上 | OK `POST …/configs/:platform/test` → `plat:17` |
| 4 | :646 | 同上 | OK `POST …/configs/:platform/sync-orders` → `plat:18` |
| 5 | :647 | 同上 | OK `POST …/configs/:platform/sync-products` → `plat:19` |
| 6 | :648 | 同上 | OK `DELETE …/configs/:platform` → `plat:20` |
| 7 | :649 | 同上 | OK `POST …/shop-config` → `plat:24` |
| 8 | :650 | 同上 | OK `POST …/categories` → `plat:28` |
| 9 | :651 | 同上 | OK `PUT …/categories/:id` → `plat:29` |
| 10 | :652 | 同上 | OK `DELETE …/categories/:id` → `plat:30` |
| 11 | :653 | 同上 | OK `POST …/products` → `plat:34` |
| 12 | :654 | 同上 | OK `PUT …/products/:id` → `plat:35` |
| 13 | :655 | 同上 | OK `DELETE …/products/:id` → `plat:36` |
| 14 | :656 | 同上 | OK `POST …/banners` → `plat:47` |
| 15 | :657 | 同上 | OK `PUT …/banners/:id` → `plat:48` |
| 16 | :658 | 同上 | OK `DELETE …/banners/:id` → `plat:49` |

注册表 note 同步更新（"路由前缀待核"→ 收口说明）；entry-gate-consistency.spec.ts 只断言 gated 门（island 为 registered），**53 用例零改动全过**。

**employees（+1，任务书 ②）**：删 `admin-web/src/api/system.ts` 5 个 wrapper（原 :41-61），墓碑注释按任务书字面保留 staff 指引（`GET/POST /api/admin/staff`、`PUT /api/admin/staff/:id`、`:id/status`），并**刻意避开** `employees 路径字面量与函数名` 等 token，防止污染任何口径的 rg；`resetEmployeePassword`（真调用、走 `/admin/sys-users/:id/reset-password`）保留未动。

## 二、判据读数（任务书 §二 逐条）

1. **漂移机**：`注册表抽取 27 行：OK 27 / D1 0 / D2 0`；`employees（+1）：定义 0 行 … ⇒ D4`（sites=0 时脚本按任务书口径转"已删除"说明，读数保持 D4=1）；`debt（D1+D2）= 0`，基线 `contractDrift` 同步 16→**0**（只准降留痕），EXIT=0。
2. **反测**：见 §四。
3. **四门 + 构建**：`test` 5 文件/53 用例全过不劣化；`type-check` vue-tsc **0=0**；`check:contract` EXIT=0（差集 0/豁免 1 不变——注册表行本就在其盲区）；`lint` error 20=20 / warning 12872=12872（删链三文件实测**零贡献** warning：console 仅 1 处且在注释 ⇒ 无需调平，见 §五④）；`build:h5` **EXIT=0**（`build-h5.log`，Build complete）；`guard:logout` GREEN。
4. **rg 三组零命中**（`MSYS2_ARG_CONV_EXCL='*'` 态，命令与 exit 原样落盘）：① `rg -n '/platform/' app-mobile/src` ⇒ EXIT=1；② `rg -n 'admin/system/employees|fetchEmployees|…|toggleEmployeeStatus' admin-web/src` ⇒ EXIT=1；③ `rg -n 'local-db|api/sync|sqlite' app-mobile/src app-mobile/package.json` ⇒ EXIT=1；**判据原式** `rg … app-mobile` 命中仅剩审计文档 2 行历史叙述（见 §五③，档案未改写）。
5. **backend 零改动**：merge-base `3fa138e7`..HEAD backend **0 文件**（本卡改动全集：`app-mobile/**`、`admin-web/src/api/system.ts`、`.github/workflows/ci.yml`、docs 证据/回传）。

## 三、④ 漂移机进 CI（阻断）

`ci.yml` 在 `App mobile contract gate` 之后新增步骤 `App mobile cross-layer drift gate (check-contract-drift)`，**从仓库根直跑** `node app-mobile/scripts/check-contract-drift.mjs`（脚本自解析 REPO_ROOT，零依赖，无 `continue-on-error`）；YAML 已用 js-yaml 现场 parse 通过。注释写明它检的是门 4 盲区（注册表 `/api/` 前缀数组行）。

## 四、反测（门必须能红）+ 一轮口径事故报备

- 注入 :644 加回 `/platform` ⇒ 漂移机（CI 同款命令、仓库根执行）**EXIT=1**、`debt=1 > 基线 0` 并点名该条；复原 ⇒ EXIT=0。
- **首轮 SHA 不一致的根因（主动报备）**：前序 Edit 工具把 17 行写成 CRLF，`sed -i` 全文件重写时归一为 LF——**内容等价、非语义差**；文件规范为纯 LF 后**次轮重跑**：注入前/复原后 sha256 `8740f174…` **BYTE_IDENTICAL_RESTORE**，复跑 GREEN。两轮原始输出均在 `drift-counter-test-red.log`，说明见 `drift-counter-test.note.txt`。
- 缺 `contractDrift` 段 ⇒ 直接红（QODER-6 已证，脚本逻辑未变）。

## 五、口径偏差报备（任务书文字 vs 仓库事实，均按事实执行）

1. **路径**：任务书写 `app-mobile/src/utils/local-db.ts`——该文件不存在，真实位置 `app-mobile/src/api/local-db.ts`（QODER-5 记忆里的"utils"是笔误），已删。
2. **"sqlite 相关依赖（package.json 同步移除）"**：四个 package.json **从未有 sqlite npm 依赖**（sqlite 是 uni 原生 `plus.sqlite` 运行时 API 的本地封装 `src/native/sqlite.ts`）⇒ package.json/lockfile **零改动**；整链删除对象 = `api/local-db.ts`(−949) + `api/sync.ts`(−321) + `native/sqlite.ts`(−1114)，链内自闭环、链外零 import（`initDatabase` 无外部消费，实测 rg 0 命中）。
3. **判据③原式**：`rg "local-db|api/sync|sqlite" app-mobile` 会命中 `app-mobile/docs/移动端全面审查清单与修复方案-2026-10-18.md:65/:162`——**带日期的审计档案历史叙述**，改写档案=篡改记录，故保留原样；代码口径（src + package.json）0 命中，两份输出都落盘（`rg3-offline-chain-0hit.log` / `rg3-criterion-fullform.log`）。若凌舟验收按原式打，请以此口径裁定这两行是否豁免。
4. **`npm install` 前置**：依赖与 lockfile 零变化 ⇒ `npm install` 为 no-op（且工作树 node_modules 是指向主仓的 junction，禁重装防污染）；判据等效改为直接 `build:h5`（§二.3 读数）。
5. **lint warning**：预期"删码调平"未发生——三个被删文件实测对 12872 贡献为 0（唯一 console 在注释），基线不动，读数以原始日志为准。

## 六、红线对照

改动全集 = `app-mobile/**`（注册表 17 行 + 脚本 employees 读数分支 + 基线 contractDrift 段 + 删三文件）+ `admin-web/src/api/system.ts`（仅删 5 wrapper + 注释）+ `ci.yml`（仅加一阻断步）+ `docs/evidence/qoder-7/**` + 本卡 + 回执。**后端零改动、无新造权限码**；逐文件 add、未 push、未开 PR；0 字节证据配 `.note.txt`（3 份 rg + 反测 note）。

## 七、未完成与阻塞

无阻塞。遗留（均在他卡口径，非本单缺口）：`security.ts` 的 B3-6 另一半（任务书未列，未动）；卡 1/2/4/5/6/7 合并落地前 origin/main 无这些门禁。

## 八、风险与自我报备

- 注册表 16 行是"以后端为准"修的（凌舟裁定①），运行时行为零影响（这 15 条孤岛端点无调用方，漂移机/门 4 双向复核）。
- employees 墓碑若将来被"复活"（重新加回 `/admin/system/employees` 字面量），漂移机按 caller 数自动 D2/D4、debt>0 即 CI 红——无需人工盯。
- Git Bash MSYS 路径转换坑（`/` 开头参数被转成 Windows 路径 ⇒ 假 0 命中）：本轮全部 rg 证据在排除态复跑；**既往卡带 `/…` 起头模式的 0-hit 证据建议复核**。
- §五③④两处口径偏差未擅自"修报告迎合判据"，以事实+原始输出报备。

## 九、交付物与证据清单

- 提交：`<实现>`（注册表 16 修 + 5 文件删/改 + ci.yml + 基线 debt 0）+ `<回传>`（本卡 + `ACTIVE-回执-QODER-7.md` + 证据）——哈希见分支尖端。
- 证据：`drift-after-fix.log`/`.json`（27 OK/0/0、D4 说明、debt=0）、`drift-counter-test-red.log` + note（两轮 + CRLF 事故）、`registry-after-fix-27lines.log`、`rg1/rg2/rg3` 零命中三组 + `rg3-criterion-fullform.log`（各配 note）、`gates/gate-{type-check,lint,test,check-contract,drift}.log`、`guard-logout.log`、`build-h5.log`、`backend-zero-diff-mergebase.log`、`impl-diff-stat.log`、`ci-yml.diff`、`system-ts.diff`。

## 十、一行摘要

16 条漂移按注册表层修至 **OK 27/D1 0/D2 0/debt 0**（基线同步降 0、反测能红且字节复原一致）、employees 5 wrapper 下线留 D3 指引注释、离线链三文件 −2384 行整删（代码口径 rg 0 命中、package.json 本无 sqlite 依赖属口径偏差已报备）、漂移机以阻断步进 ci.yml；后端零改动。
