# WORKBENCH-05 证据包 · 全量回归、灰度与回滚

> 负责人：墨（工作台负责人）｜2026-10-24
> 基线：`6b0a87c3dcf048d3319058780531cc0b6b8cd84c`
> 分支：`workbench/WORKBENCH-05-full-regression`
> 工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-05`

## 1. 环境与前置（真实运行，非模拟）

| 组件 | 实际形态 | 备注 |
| --- | --- | --- |
| 后端 | 本仓 `backend` 以 `NODE_ENV=development USE_MOCK_DB=true npx tsx src/server.ts` 监听 `127.0.0.1:8080` | `/api/platform/health` 返回 `mode:"mock-db"`；`/api/admin/auth/login` 真实签发 JWT |
| 前端 | `npm --workspace admin-web run dev`，`http://localhost:5173` | 真实 Vite dev + 真实 axios 请求链路 |
| 数据库 | 未安装 MySQL（3306 未监听） | mock DB 无菜单/角色行，见「未验项」 |
| AI 底座 | 未启动（3016 无监听） | 用于制造真实的 AI 连接失败 |
| 浏览器 | Playwright Chromium（本仓根 `node_modules`） | 不拦截、不改写任何接口响应 |

### 菜单集合的真实形态（重要）

mock DB 下 `/api/admin/menus/user` 真实返回 `data: []`。因此：

- 「正常态」= 菜单接口真实 200 + **空集** ⇒ 新壳走 fail-closed：侧栏 0 组 0 项、明示无可见菜单、不回退全量；
- 「菜单失败态」= 停掉 8080 后端后重新加载 ⇒ 真实 `net::ERR_CONNECTION_REFUSED`；
- 两者都不是伪造数据。

## 2. 复跑命令

在工作树根目录执行：

```powershell
# ① 全量自动化回归（104 条 = 既有 96 + 新增 8）
npm --workspace admin-web run test

# ② 仅新增的灰度/回滚与关键路由回归
cd admin-web; node tests/rollout-rollback.spec.mjs

# ③ 构建门禁（类型检查 + 产物）
npm --workspace admin-web run build:check
npm --workspace admin-web run build

# ④ 运行态取证（需先起后端与 vite dev）
node docs/evidence/WORKBENCH-05/runtime-regression.mjs normal

# ⑤ 菜单失败态（先精确停掉后端 PID，再执行；脚本不会自己停进程）
node docs/evidence/WORKBENCH-05/runtime-regression.mjs menu-fault

# ⑥ AI 故障态（后端在跑、3016 不启动）
node docs/evidence/WORKBENCH-05/runtime-regression.mjs ai-fault

# ⑦ 构建级回退产物校验（两端口分别起 preview）
$env:VITE_WORKBENCH_SHELL_V2="0"; npx vite build --outDir dist-rollback
npx vite preview --outDir dist            --port 4173
npx vite preview --outDir dist-rollback   --port 4174
$env:WB_BASE_URL="http://localhost:4173"; $env:WB_EXPECT_SHELL="new"; node docs/evidence/WORKBENCH-05/runtime-regression.mjs build-shell
$env:WB_BASE_URL="http://localhost:4174"; $env:WB_EXPECT_SHELL="old"; node docs/evidence/WORKBENCH-05/runtime-regression.mjs build-shell
```

脚本会写入 `reports/*.json` 与 `screenshots/*.png`；会话缓存在系统临时目录 `wb05-session.json`（不入库）。

## 3. 结果摘要（原始日志见 `logs/`）

- `npm test`：**104 passed / 0 failed**（3 + 30 + 11 + 12 + 16 + 24 + 8），既有 96 条一条未减。
- `build:check`：`vue-tsc -b` 通过（`logs/vue-tsc.log` 单独记录 `EXIT=0`），`vite build` ✓ built in 18m 57s，`error TS` = 0（见 `logs/build-check.log`）。
  - 说明：`build:check` 由 `vue-tsc -b && vite build` 串联，整条命令耗时超过工具单次 10 分钟上限而被转入后台，原始日志只保留了末尾 `✓ built in 18m 57s`、未带 `EXIT=` 行；因此另以 `logs/build.log`（`npm run build`，`EXIT=0`、✓ built in 17m 12s）与 `logs/vue-tsc.log`（`npx vue-tsc -b`，`EXIT=0`）分别佐证两段均通过。
- `build`：`EXIT=0`，✓ built in 17m 12s；回退构建 `VITE_WORKBENCH_SHELL_V2=0 vite build --outDir dist-rollback`：`EXIT=0`，✓ built in 18m 39s。
- 构建产物运行态 `build-shell`：新壳产物（4173）**1 passed**、旧壳回退产物（4174）**1 passed**，两侧收银页均可访问、登录态保持。
- 运行态 `normal`：**21 passed / 0 failed**（真实登录、新壳、空集 fail-closed、多宽度、灰度 1→0→1→0、角色注入收银 9 项）。
- 运行态 `menu-fault`：**5 passed / 0 failed**（真实 ECONNREFUSED、重试真实再失败、收银 9 项保持可用）。
- 运行态 `ai-fault`：**4 passed / 0 failed**（真实 `localhost:3016` 连接失败 → 横幅 → 一键切人工，业务页不受影响）。
- 三类反测（`redtest/`）：A 开关语义写反、B 切换误清登录态、C 删除旧壳分支 —— 均**点名变红**，复原后 **8 passed / 0 failed**，两个源文件 SHA256 与反测前一致。

## 4. 灰度与回滚口径

| 开关 | 生效层级 | 证据 |
| --- | --- | --- |
| `localStorage["wb.shell.v2"] = "0" / "off"` | 运行时（刷新生效） | `reports/normal.json` 的 `sequence`：旧壳 `.layout` × 1、新壳 `.wb-shell` × 0，URL/登录态不变 |
| `= "1" / "on"` / 清除 | 运行时（刷新生效） | 同上，回到 `.wb-shell`，登录态零变化 |
| `VITE_WORKBENCH_SHELL_V2=0` | 构建级 | `dist-rollback` 产物在 4174 端口渲染 `.layout`；`dist` 产物在 4173 渲染 `.wb-shell` |
| 循环重定向 | 双向 | 单测「无循环重定向」三类角色落点自洽；运行态切换全程 URL 不变且未跳 `/login` |

## 5. 未验项（如实登记，未降级判绿）

1. **非空业务菜单的运行时渲染**：需要真实 MySQL 与角色/菜单行，本轮环境不具备。因此「人工侧栏分组数 / AI rail 分组数 / 对等计数」的运行时数值均为 0（空集 fail-closed 的真实表现）；非空场景由 04F1 的角色探针与单测覆盖，本卡不重复声明为运行态已验证。
2. **STORE_OPERATOR / STORE_MANAGER 的浏览器渲染**采用「真实登录 token + 覆盖 `user.roles` 的会话注入」，只证明 UI 渲染与收银 9 项，不证明服务端权限边界（mock DB 无角色行，`store_operator` 登录返回 400）。
3. **Electron 客户端**、**1280 以下宽度 / 移动端 H5** 未在本轮范围。
4. **AI 正常在线会话**：3016 未启动，仅验证故障态；AI 正常问答链路未在本轮重复验证。

## 6. 目录结构

```text
docs/evidence/WORKBENCH-05/
├── README.md                     # 本文件
├── runtime-regression.mjs        # 运行态取证脚本（normal / menu-fault / ai-fault / build-shell）
├── logs/                         # 原始日志：full-regression / normal / menu-fault / ai-fault /
│                                 #   build-check / build / build-rollback / vue-tsc / build-shell-new|old / frozen-surface
├── redtest/                      # 三类反测日志（A/B/C）+ 复原后复绿日志 + 源文件备份（*.bak 被根 .gitignore 忽略，不入库）
├── reports/                      # 结构化 JSON（网络请求、断言明细、灰度 sequence）
└── screenshots/                  # 15 张：1280/1440/1920、三态、灰度旧壳、角色注入、构建产物
```

反测备份 `redtest/shell-mode.ts.bak`、`redtest/WorkbenchShell.vue.bak` 命中根 `.gitignore` 的 `*.bak*` 规则，不进版本库；反测前后一致性以 `redtest/*.log` 的 8 条断言结果与 `logs/frozen-surface.log` 的 SHA256 为证（复原后哈希与基线一致，`git status` 无 `src` 改动）。