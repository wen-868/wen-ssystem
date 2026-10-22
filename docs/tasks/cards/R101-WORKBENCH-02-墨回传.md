# 【汇报 WORKBENCH-02】双模式工作台壳层骨架

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-23
执行通道：本地独立工作树 `D:\Users\ZXQL\wt-agents\WORKBENCH-02`（分支 `workbench/WORKBENCH-02-shell`，基线 `7e12d06c`）
交付物：
逐条（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/src/layouts/WorkbenchShell.vue` | 新增总壳：`human \| ai` 模式切换 + feature flag + 旧壳回退 | `779bcd34` |
| 2 | `admin-web/src/layouts/ManualSidebar.vue` | 新增人工模式二级导航（角色派生后 manifest） | `779bcd34` |
| 3 | `admin-web/src/layouts/AiNavRail.vue` | 新增 AI 模式一级 rail | `779bcd34` |
| 4 | `admin-web/src/components/workbench/AiFeedContainer.vue` | 新增 AI 信息流容器骨架（P2 接入，不造数据） | `779bcd34` |
| 5 | `admin-web/src/components/workbench/AiChatPanel.vue` | 新增 AI 会话面板容器，挂载现有 `AiSidePanel` | `779bcd34` |
| 6 | `admin-web/src/shared/workbench/{types,manifest-manual-a,manifest-manual-b,manifest-pos,route-manifest,shell-mode}.ts` | 静态 route manifest（12 组 71 项 + 收银 9 项）+ 角色可见性 + 模式状态 | `779bcd34` |
| 7 | `admin-web/src/router/index.ts` | 根布局 `MainLayout` → `WorkbenchShell`（仅 2 行） | `779bcd34` |
| 8 | `admin-web/src/components/AiChat/AiSidePanel.vue` | 修复未消费/未挂载问题（清空按钮 + 图标组件化） | `779bcd34` |
| 9 | `admin-web/tests/workbench-shell.spec.mjs` + `admin-web/package.json` | 11 条断言并接入 `npm test` | `779bcd34` |
| 10 | `docs/evidence/WORKBENCH-02/{README.md,test-final.log,redtest.log,build.log,buildcheck.log}` | 证据包 | `779bcd34` |

证据（可复跑）：

```powershell
npm --workspace admin-web run test          # 44 passed / 0 failed（role-guard 3 + landing 30 + workbench-shell 11）
node admin-web/tests/workbench-shell.spec.mjs   # 11 passed / 0 failed
npm --workspace admin-web run build:check   # exit 0（vue-tsc -b && vite build ✓ built）
npm --workspace admin-web run build         # exit 0（vite build，dist 产物正常）
```

原始输出：

- `docs/evidence/WORKBENCH-02/test-final.log`：结构/路由对齐/组件一致/角色可见性/约束/开关/模式共 11 条全 PASS；
  role-guard 3 passed、landing 30 passed。
- `docs/evidence/WORKBENCH-02/redtest.log`：反测红：`FAIL 角色可见性：STORE_MANAGER … 22 !== 23`（10 passed / 1 failed）。
- `docs/evidence/WORKBENCH-02/build.log` / `buildcheck.log`：`build` exit 0（vite build ✓ built in 2m 28s）、`build:check` exit 0（vue-tsc -b && vite build ✓ built in 2m 44s），日志内 `error TS` 计数 0。
- 关键行号：`admin-web/src/shared/workbench/route-manifest.ts` L22-73（角色派生与过滤）；
  `admin-web/src/layouts/WorkbenchShell.vue` L120-135（`resolveRoles` fail-closed）；
  `admin-web/src/router/index.ts` L74、L95（根布局装配）。

验收自评：

1. **通过** — 人工模式既有页面 DOM/路由/表单/表格/弹窗零业务改动：只改根布局装配 2 行；现有 `views/**` 与登录/注册页未触碰。
2. **通过** — `build`、`build:check`、`test` 全绿（见上）。
3. **通过** — 非 SUPER_ADMIN/STORE_MANAGER 角色看不到无权 rail/菜单：SUPER_ADMIN 人工 71 项；STORE_MANAGER 23 项（系统设置 8 项隐藏）；STORE_OPERATOR 人工 0 组、收银 9 项（路由已授权）；READONLY 全不可见；未知 routeName fail-closed。
4. **通过** — 反测：摘掉 `dashboard` 的 `STORE_MANAGER` 角色后测试变红；复原后 11 passed，`git diff --numstat` 路由文件仅 2/2 行（角色映射零差异）。
5. **通过** — 壳层/manifest/路由/测试 12 个文件均无 `/admin/menus/user` 调用；无 `sendChatMessage`/`confirmAiOperation`/`revokeAiOperation`/`cancelAiOperation` 调用。
6. **通过** — 未 push、未开 PR、逐文件 `git add`；提交后 `git status --porcelain` 为空。

未完成与阻塞：

- 无。

风险与自我报备：

1. **AI 模式暂不承载二级页面**：AI 模式为 rail + 信息流骨架 + 会话面板，`router-view` 仅在人工模式渲染；AI 信息流数据与 AI 路由页面按冻结规划留待 P2，本单未伪造数据。
2. **人工模式视觉壳层变化**：新壳人工模式使用 manifest 驱动的 `ManualSidebar` + 顶栏，不复用旧 `MainLayout` 的搜索/通知/门店状态组件（旧壳完整保留为 flag 回退路径），属“布局壳层变化”许可范围；若需保留旧顶栏组件，建议单列样式回归单。
3. **开关读取时机**：`wb.shell.v2` 在壳层 setup 时读取，切换后需刷新页面生效（灰度回退预期行为）。
4. **STORE_MANAGER 可见面收窄**：可见性严格按路由 `meta.roles` 派生，现网若存在依赖“看到但点不进”的旧习惯，会感知为菜单减少；这是硬验收③的直接结果，已在测试中锁定基线 23 项。
5. **收银打印设置**：作为本地弹窗动作保留（`routeName=null`），未新增路由，未改 `PrintSettingsPanel`。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-WORKBENCH-02-墨回传.md`（卡本体随 docs 提交单独入库；代码与证据提交 `779bcd34`）
关联卡：`docs/tasks/inbox/WORKBENCH-02-shell-skeleton.md`
