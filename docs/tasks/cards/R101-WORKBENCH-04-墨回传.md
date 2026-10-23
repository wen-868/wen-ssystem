# 【汇报 WORKBENCH-04】动态菜单与 AI 代办桥接

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-23
执行通道：WorkBuddy
工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-04`（分支 `workbench/WORKBENCH-04-menu-ai-bridge`，基线 `db350f2f`）

交付物（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/src/api/workbench-menu.ts` | 唯一动态菜单消费点：`GET /admin/menus/user` + 载荷校验（`/admin/menus/user` 字面量全仓仅此一处） | `87308494` |
| 2 | `admin-web/src/shared/workbench/menu-access.ts` | fail-closed 状态机：服务端 menuCode ∧ 静态白名单 routeName ∧ `meta.roles` 三重校验；10 条显式桥接表 `SERVER_MENU_BRIDGE`（带证据行号） | `87308494` |
| 3 | `admin-web/src/shared/workbench/ai-bridge.ts` | AI 代办上下文：`selectPageActionRows` + `buildPageDelegation`，只产 prompt/动作清单/PLANNED·BLOCKED 计数，无任何写接口 | `87308494` |
| 4 | `admin-web/src/shared/workbench/route-manifest.ts` | 导出 `ALL_MANIFEST_ITEMS`（71+9）与 `ALL_MANIFEST_ROUTE_NAMES`（79 条去重）供运行时校验 | `87308494` |
| 5 | `admin-web/src/shared/workbench/parity-ledger.ts` | 新增 `projectParityRuntime(visibleRouteNames)`：只裁运行时视图，静态台账常量不变 | `87308494` |
| 6 | `admin-web/src/layouts/WorkbenchShell.vue` | 菜单 loading/失败+重试+联系管理员/空态；顶栏「AI 代办当前页」；可见入口按运行时裁剪 | `87308494` |
| 7 | `admin-web/src/components/workbench/AiFeedContainer.vue` | 接收 `visibleRouteNames` / `menuNotice`，对等摘要改显运行时口径并标注「静态台账不变」 | `87308494` |
| 8 | `admin-web/src/components/workbench/AiChatPanel.vue` | `sendQuickCommand` 面板未就绪时排队，确保代办上下文不丢 | `87308494` |
| 9 | `admin-web/tests/menu-ai-bridge.spec.mjs` | 新增 18 条断言（正常/失败/未知码/未知路由/空菜单、人工=AI 同集、代办只交上下文、三类 mutation） | `87308494` |
| 10 | `admin-web/package.json` | test 链追加 `node tests/menu-ai-bridge.spec.mjs`（原 5 条 spec 全部保留） | `87308494` |
| 11 | `docs/evidence/WORKBENCH-04/{README.md,test-final.log,buildcheck.log,build.log,redtest-a.log,redtest-b.log,redtest-c.log}` | 证据包（口径说明 + 原始输出 + 三类反测） | `b190ad4e` |

证据（可复跑）：

```powershell
npm --workspace admin-web run test          # 90 passed / 0 failed（既有 72 条一条未减）
npm --workspace admin-web run build:check   # EXIT=0
npm --workspace admin-web run build         # EXIT=0
```

原始输出：

- `test-final.log`：6 个小结 `3 / 30 / 11 / 12 / 16 / 18`，合计 **90 passed / 0 failed**。
- `buildcheck.log`：`✓ built in 5m 6s`，`# EXIT=0`；`build.log`：`✓ built in 6m 5s`，`EXIT=0`；`error TS` 计数 0；唯一提示为 `(!) Some chunks are larger than 500 kB`（非阻断，与 WB-02/WB-03 一致）。
- 反测日志 `redtest-a/b/c.log`：注入期点名变红、复原后 SHA256 一致并复绿 18/18。

验收自评（对应任务卡「三、硬验收」6 条）：

1. **通过** — 业务冻结：`git diff --name-only db350f2f -- admin-web/src/views backend` 为空；测试内「业务冻结」断言复核。未改登录/注册页。
2. **通过** — 单一真相源与单一写链：`/admin/menus/user` 全仓仅出现在 `src/api/workbench-menu.ts`；代办只调 `chatPanel.sendQuickCommand(prompt)` 走既有 `POST /api/chat`，未接第二套动作目录。
3. **通过** — 失败不白屏、不越权：服务失败/空菜单/未知码/未知路由均为空集并给出 `menu-fault` 重试与「若持续失败请联系管理员」，文案明示「不回退全量菜单」；`menu-fault` 有 `role=alert`。
4. **通过** — PLANNED/BLOCKED 不暗示可执行：`buildPageDelegation` 对 blocked>0 追加「不要给出“已可执行”的暗示」，UI 以 warning 提示 N 项不可代办；只读页仍显示入口。
5. **通过** — 测试只增不减且全绿：72 → 90（新增 18 条），三类 mutation 全部点名变红；`build:check` / `build` 均 EXIT=0。
6. **通过** — 交付纪律：逐文件 `git add`（未用 `-A`）；未 push、未开 PR；工作树最终 clean。

反测（mutation，全部点名变红后复原，SHA256 一致并复绿 18/18）：

| 用例 | 篡改 | 变红断言 | 结果 |
| --- | --- | --- | --- |
| A | `menu-access.ts` error 分支把全量 manifest 塞进 `visibleRouteNames`（服务失败回退全量） | `反测点 A：服务失败 → 空集且不回退全量` | 17 passed / 1 failed（`redtest-a.log`） |
| B | `menu-access.ts` 未映射码直接 `visible.add(code)`（越权菜单透传） | `反测点 B：未知菜单码只登记不渲染` | 17 passed / 1 failed（`redtest-b.log`） |
| C | `WorkbenchShell.vue` 注入 `sendChatMessage(delegation.prompt)`（代办直接写） | `反测点 C：AI 代办不直接写——无写接口调用` | 17 passed / 1 failed（`redtest-c.log`） |

复原校验：`menu-access.ts` SHA256 `AFE58AFD…66BE48B`、`WorkbenchShell.vue` SHA256 `9C6832ED…A0CCD4`，与注入前一致。

未完成与阻塞：

- 无阻断项。本单未接动态后端菜单的写动作确认链（按红线，写仍走既有确认链）。

风险与自我报备：

1. **10 条桥接中 2 条不可路由**：`system`、`finance:expenses` 在服务端菜单存在，但静态白名单 `route-manifest` 无对应路由（`unroutableRouteNames`）。服务端若返回该码，会被登记为「白名单缺失」并隐藏，不会凭空造路由；需产品或路由 owner 补页面后再扩桥接。
2. **桥接为显式白名单，非名称推断**：服务端无 `web.` 前缀、manifest 有，故逐条显式映射（附 `10-route-menu-matrix.md` 行号）。服务端新增菜单码不会自动可见，需人工加桥接，这是 fail-closed 的预期代价。
3. **静态台账不随服务端收缩**：`PARITY` 常量维持 80/80、254/254 与四态 26/0/213/15；运行时视图按可见入口裁剪（示例：8 项入口 → 8/80、27/254），UI 已标注口径，避免把「当前账号可见性」误读为「覆盖缩水」。
4. **菜单仅在 Shell 挂载时加载**：当前无菜单变更推送，角色/菜单调整后需刷新页面；重试按钮只重拉接口，不做本地缓存。
5. **代办只发上下文**：`buildPageDelegation` 生成的首行明示「不要直接执行任何写操作」，且回复需走「预览→确认→执行→撤销」；Shell 侧不消费会话返回，无状态回写。
6. **工作树依赖复用**：仍以目录联接复用主仓 `wen-ssystem/node_modules`（被 `.gitignore` 忽略，不入库）。
7. **非阻断构建提示**：`(!) Some chunks are larger than 500 kB` 与 `@vueuse` PURE 注释提示为既有噪声，与 WB-02/WB-03 一致，不影响 `EXIT=0`。

回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-04-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-04-dynamic-menu-ai-bridge.md；上轮验收卡 `docs/tasks/cards/R101-WORKBENCH-03F1-凌舟验收与裁定-20261023.md`