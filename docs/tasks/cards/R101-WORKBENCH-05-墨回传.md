# 【汇报 WORKBENCH-05】全量回归、灰度与回滚

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-24
执行通道：WorkBuddy
工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-05`（分支 `workbench/WORKBENCH-05-full-regression`，基线 `6b0a87c3`）

交付物（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/tests/rollout-rollback.spec.mjs` | 新增 8 条：开关语义、灰度双向 1→0→1→0 与清除回落、切换不丢 `admin_auth`、壳层渲染互斥（含源码护栏）、三类角色落地自洽无循环重定向、关键路由回归（命名路由 163 / POS 15）、构建级回退护栏、收银 9 项 = 8 路由 + 1 动作 | `4cd22e2e` |
| 2 | `admin-web/package.json` | `test` 链末尾追加 `node tests/rollout-rollback.spec.mjs`，既有 6 个 spec 顺序与参数不变 | `4cd22e2e` |
| 3 | `docs/evidence/WORKBENCH-05/runtime-regression.mjs` | 运行态取证脚本（`normal` / `menu-fault` / `ai-fault` / `build-shell` 四阶段，Playwright Chromium，不拦截不改写接口） | 证据提交 |
| 4 | `docs/evidence/WORKBENCH-05/README.md` | 环境真实形态、菜单空集口径、复跑命令、结果摘要、灰度口径表、未验项、目录结构 | 证据提交 |
| 5 | `docs/evidence/WORKBENCH-05/logs/` | `full-regression` / `normal` / `menu-fault` / `ai-fault` / `build-check` / `build` / `build-rollback` / `vue-tsc` / `build-shell-new` / `build-shell-old` / `frozen-surface` 共 11 份原始日志 | 证据提交 |
| 6 | `docs/evidence/WORKBENCH-05/redtest/` | A/B/C 三类反测日志 + A、C 复原后复绿日志 | 证据提交 |
| 7 | `docs/evidence/WORKBENCH-05/reports/` | 4 份阶段明细 JSON + 4 份 summary（含真实网络请求与灰度 sequence） | 证据提交 |
| 8 | `docs/evidence/WORKBENCH-05/screenshots/` | 15 张截图：1280/1440/1920 人工台、AI 面板、收银、菜单失败态 3 张、AI 故障 2 张、灰度旧壳、角色注入 2 张、构建产物 2 张 | 证据提交 |
| 9 | `docs/tasks/cards/R101-WORKBENCH-05-墨回传.md` | 本回传卡 | 本次提交 |

提交为 3 个本地提交（代码+测试链 / 证据包 / 回传卡），全部逐文件 `git add`，未使用 `-A`，未 push、未开 PR。

证据（可复跑）：

```powershell
# 全量自动化回归（104 = 既有 96 + 新增 8）
npm --workspace admin-web run test

# 构建门禁
npm --workspace admin-web run build:check
npm --workspace admin-web run build
npx vue-tsc -b

# 运行态（需先起 backend USE_MOCK_DB + admin-web dev）
node docs/evidence/WORKBENCH-05/runtime-regression.mjs normal
node docs/evidence/WORKBENCH-05/runtime-regression.mjs menu-fault   # 先精确停掉 8080 后端
node docs/evidence/WORKBENCH-05/runtime-regression.mjs ai-fault     # 后端在跑、3016 不启动

# 构建级回退与产物校验
$env:VITE_WORKBENCH_SHELL_V2="0"; npx vite build --outDir dist-rollback
npx vite preview --outDir dist --port 4173
npx vite preview --outDir dist-rollback --port 4174
$env:WB_BASE_URL="http://[::1]:4173"; $env:WB_EXPECT_SHELL="new"; node docs/evidence/WORKBENCH-05/runtime-regression.mjs build-shell
$env:WB_BASE_URL="http://[::1]:4174"; $env:WB_EXPECT_SHELL="old"; node docs/evidence/WORKBENCH-05/runtime-regression.mjs build-shell
```

原始输出摘要：

- `logs/full-regression.log` 末行：`小结：8 passed / 0 failed`；`npm test` 七段小结 3 / 30 / 11 / 12 / 16 / 24 / 8 = **104 passed / 0 failed**（既有 96 条一条未减）。
- `logs/normal.log`：`小结[normal]：21 passed / 0 failed`（真实登录 200、新壳 1/旧壳 0、空集侧栏 0 组 0 项、1280/1440/1920 均 `body=宽度 sidebarWidth=209`、AI rail 组数 = 侧栏组数、对等摘要「运行时可见 0/80 … 服务端未返回任何可见菜单」、AI 代办 `visible=false`、收银 9 项、灰度 0/1/0/1 四连 + 清除回落均 `newShell/oldShell` 正确且 `hasAuth=true`、三角色注入收银 9）。
- `logs/menu-fault.log`：`小结[menu-fault]：5 passed / 0 failed`（真实失败横幅 `等待=1883ms 失败=11`、侧栏 `groups=0`、重试 `重试前=1 重试后=2 仍失败=true`、STORE_OPERATOR 收银 `count=9`）。`reports/menu-fault.json` 的 `net.errors` 含两条 `net::ERR_CONNECTION_REFUSED`（`/api/admin/menus/user`）。
- `logs/ai-fault.log`：`小结[ai-fault]：4 passed / 0 failed`（`net.aiRequests=["http://localhost:3016/api/chat"]` + `net::ERR_CONNECTION_REFUSED` → 横幅 → 一键切人工 → 仍在 `/dashboard` → 收银可访问）。
- `logs/build-shell-new.log` / `build-shell-old.log`：各 `1 passed / 0 failed`；`{"newShell":1,"oldShell":0,"cashier":true}` vs `{"newShell":0,"oldShell":1,"cashier":true}`。
- `logs/build-check.log`：`✓ built in 18m 57s`，`error TS` 计数 0；`logs/vue-tsc.log`：`EXIT=0`；`logs/build.log`：`EXIT=0` + `✓ built in 17m 12s`；`logs/build-rollback.log`：`EXIT=0` + `✓ built in 18m 39s`。
- `logs/frozen-surface.log`：`git diff --name-only 6b0a87c3 -- admin-web/src/views backend` 与 `-- admin-web/src` 均为空；SHA256 `shell-mode.ts 4EE82328…B02B`、`WorkbenchShell.vue 22A20B60…07D5`、`menu-access.ts 6C268312…7279`（本轮前后一致）。

验收自评（对应任务卡「二、硬验收」6 条）：

1. **通过** — `npm test` 104 passed / 0 failed，既有 96 条一条未减（新增 8 条）。
2. **通过** — `build` EXIT=0、`vue-tsc -b` EXIT=0、`error TS` = 0；`build:check` 串联命令因单次耗时超工具 10 分钟上限被转入后台，日志缺 `EXIT=` 行，已由 `build` 与 `vue-tsc` 两段分别 EXIT=0 佐证（见「风险与自我报备 1」）。
3. **通过** — 三态均为真实浏览器运行证据：正常态真实登录 + 真实 `/api/admin/menus/user` 200；菜单失败态精确停掉后端后真实 `ERR_CONNECTION_REFUSED`；AI 故障态真实 `localhost:3016` 拒连。无 mock、无接口改写（`runtime-regression.mjs` 仅监听不拦截）。
4. **通过** — 运行时双向 `wb.shell.v2` 0/1 往返 4 次 + 清除回落全部 `newShell/oldShell` 正确、URL 与 `admin_auth` 不变；构建级 `VITE_WORKBENCH_SHELL_V2=0` 产物在 4174 渲染旧壳、`dist` 在 4173 渲染新壳。三类反测均点名变红后复原复绿（见反测表）。
5. **通过** — `views`、`backend`、权限码零改动（diff 为空）；未新增任何写链或 AI 直写路径，新增用例只读断言。
6. **通过** — 工作树 clean；未 push、未开 PR；提交逐文件 `git add`。

反测（mutation，点名变红后复原并校验 SHA256）：

| 用例 | 篡改 | 变红断言 | 结果 |
| --- | --- | --- | --- |
| A | `shell-mode.ts` 把 `stored === "0"` 分支返回值取反 | 「灰度旧壳 / 新壳」2 条 | 6 passed / 2 failed（`redtest/A-shell-switch-inverted.log`） |
| B | `shell-mode.ts` 的 `readFlag` 后插入 `localStorage.removeItem("admin_auth")` | 「切换不丢登录态：灰度往返后 admin_auth 原值不变」1 条 | 7 passed / 1 failed（`redtest/B-switch-clears-session.log`） |
| C | 删除 `WorkbenchShell.vue` 的 `  <MainLayout v-if="!shellEnabled" />` 回退分支 | 「壳层渲染互斥 … 新壳文件缺少旧壳回退分支」1 条 | 7 passed / 1 failed（`redtest/C-remove-old-shell-branch.log`） |

复原后：`redtest/A-after-restore.log`、`redtest/C-after-restore.log` 均 `8 passed / 0 failed`；两个源文件 SHA256 与反测前一致；`git status` 无 `src` 改动。

未完成与阻塞：

- 无。

风险与自我报备：

1. **`build:check` 缺独立 EXIT 行**：该命令为 `vue-tsc -b && vite build`，整条耗时 >10 分钟被工具转后台，日志保留 `✓ built in 18m 57s` 与 `error TS` 0、未保留 `EXIT=`；另跑 `npm run build`（EXIT=0）与 `npx vue-tsc -b`（EXIT=0）分别佐证两段通过。未以构建成功替代浏览器运行态。
2. **菜单集合在 mock DB 下恒为空**：`/api/admin/menus/user` 真实 200 但 `data: []`，故正常态的侧栏分组数、AI rail 组数、对等计数运行态数值均为 0（fail-closed 的真实表现），非伪造。非空菜单的运行时渲染未验（需真实 MySQL 与角色/菜单行），由 04F1 单测/探针覆盖，本卡不重复声明为运行态已验证。
3. **STORE_OPERATOR / STORE_MANAGER 渲染为会话注入**：用真实登录 token + 覆盖 `user.roles`，只证 UI 渲染与收银 9 项，不证服务端权限边界（mock DB 无角色行，`store_operator` 登录返回 400）。
4. **未验项**：Electron 客户端、1280 以下宽度/移动端 H5、AI 底座在线（3016 未启动，仅验证故障态）均不在本轮范围，已写入 `README.md` 第 5 节。
5. **工作树依赖复用**：无独立 `node_modules`，通过目录联接复用主仓（被 `.gitignore` 忽略，不入库）；`dist`、`dist-rollback` 与临时日志已在收尾时删除，工作树 clean。
6. **反测备份不入库**：`redtest/*.bak` 命中根 `.gitignore` 的 `*.bak*`，未入库；一致性以反测日志与 SHA256 为证。

回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-05-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-05-full-regression-rollout.md；前置验收 `docs/tasks/cards/R101-WORKBENCH-04F1-凌舟验收与裁定-20261024.md`