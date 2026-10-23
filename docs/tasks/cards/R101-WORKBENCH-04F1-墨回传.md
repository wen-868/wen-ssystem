# 【汇报 WORKBENCH-04F1】角色运行时裁剪与收银保底

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-23
执行通道：WorkBuddy
工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-04F1`（分支 `workbench/WORKBENCH-04F1-role-runtime-cashier`，基线 `84effa41`）

交付物（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/src/shared/workbench/menu-access.ts` | 两层可见集：`businessVisibleRouteNames`（服务端 menuCode ∩ 静态白名单，仅诊断）与 `visibleRouteNames`（再经 `auth.userRoles` + 路由 `meta.roles`，即最终角色集）；无角色/无解析器时角色层空集（fail-closed）；`restrictManifestItems` 改为收银保底恒等实现 | `a73217a9` |
| 2 | `admin-web/src/layouts/WorkbenchShell.vue` | `resolveMenuAccess` 传 `auth.userRoles` + `resolveRoles`；人工侧栏、AI rail、AI 代办按钮、`projectParityRuntime`、UI 覆盖摘要共用同一最终角色集；收银改 `filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles)`，不再走 `/menus/user` | `a73217a9` |
| 3 | `admin-web/tests/menu-ai-bridge.spec.mjs` | 既有断言补角色上下文；新增 6 条 F1 用例（收银 9/9 两态、业务 8 与角色 1 分离、SUPER_ADMIN 不回退、非超管看不到无权动作、无角色 fail-closed、源码护栏） | `a73217a9` |
| 4 | `docs/evidence/WORKBENCH-04F1/{runtime-role-probe.mjs,role-probe.log,test-final.log,buildcheck.log,build.log,redtest-a.log,redtest-b.log,README.md}` | 带角色上下文探针 + 全量证据包 | `aebaa61c` |
| 5 | `docs/tasks/cards/R101-WORKBENCH-04F1-墨回传.md` | 本回传卡 | 本次提交 |

提交为 3 个本地提交（代码 / 证据 / 回传卡），全部逐文件 `git add`，未使用 `-A`，未 push、未开 PR。

证据（可复跑）：

```powershell
node docs/evidence/WORKBENCH-04F1/runtime-role-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-04F1
node D:\Users\ZXQL\ZXQL-MS\wen-ssystem\docs\evidence\WORKBENCH-04\凌舟验收-20261023\runtime-permission-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-04F1
npm --workspace admin-web run test
npm --workspace admin-web run build:check
npm --workspace admin-web run build
```

原始输出：

- 本包角色探针（`role-probe.log`）：
  `{"serverVisibleRoutes":[8 条],"businessVisible":8,"storeOperator":{"visibleRoutes":[],"cashierBeforeMenu":9,"cashierAfterMenu":9,"cashierOnMenuError":9,"parityManual":0,"parityActions":0},"storeManager":{"visibleRoutes":["dashboard"],"cashier":9,"parityManual":1,"parityActions":0},"superAdmin":{"parityManual":8,"parityActions":27},"noRoles":{"businessVisible":8,"visibleRoutes":[]},"staticLedger":{"manualCovered":80,"manualTotal":80,"actionCovered":254,"actionTotal":254,"statusCounts":{"LIVE":26,"PARTIAL":0,"PLANNED":213,"BLOCKED":15}},"checks":{全 true},"pass":true}`，`EXIT=0`
- 凌舟探针：`{"serverVisibleRoutes":[],"storeOperatorCashierBefore":9,"storeOperatorCashierAfter":9,"storeManagerRoleRoutes":[],"rawParityManual":0,"roleParityManual":0,"rawParityActions":0,"roleParityActions":0,"pass":true}`，`EXIT=0`
- `test-final.log`：小结 `3 / 30 / 11 / 12 / 16 / 24`，合计 **96 passed / 0 failed**（既有 90 条一条未减）
- `buildcheck.log`：`✓ built in 15m 31s`，`# EXIT=0`；`build.log`：`✓ built in 3m 23s`，`# EXIT=0`；`error TS` 计数 0；唯一提示为 chunk > 500 kB（非阻断，与 02/03/04 轮一致）
- 冻结校验：`git diff --name-only 84effa41..HEAD -- admin-web/src/views backend` 为空

验收自评（对应任务卡「三、硬验收」5 条）：

1. **通过** — 凌舟 `runtime-permission-probe` 变 pass（`EXIT=0`），收银 `storeOperatorCashierAfter: 9`。说明：该探针不传角色上下文，`resolveMenuAccess` 对角色层 fail-closed，故 `rawParity`/`roleParity` 同为 0/0 而非「8/27 vs 1/0」；角色真实数值由本包 `runtime-role-probe.mjs` 显式传角色证明：STORE_OPERATOR 收银 9/9、路由 0 → 对等 0/0；STORE_MANAGER 路由 1（`dashboard`）→ 对等 **1/0**（不再是 8/27）；SUPER_ADMIN 路由 8 → 对等 8/27；业务集合恒为 8 且不再驱动 UI。
2. **通过** — 服务失败/空菜单对业务菜单仍 fail-closed（既有「反测点 A」「空菜单」「加载中」三条断言复绿）；`error` 态 `visibleRouteNames=[]` 且 STORE_OPERATOR 收银仍为 9（`cashierOnMenuError: 9`、用例「收银 9/9（菜单 ready 与 error 两态）」）。
3. **通过** — 既有「反测点 C：AI 代办不直接写」复绿；本轮未新增任何写接口或写链，桥模块仍只产上下文。
4. **通过** — 96 条 ≥ 90 条，既有 90 条一条未减，新增 6 条（如实：`menu-ai-bridge.spec.mjs` 18 → 24）。
5. **通过** — views/backend 零改动（上面 diff 为空）；`build:check` / `build` 均 `EXIT=0`；工作树 clean；未 push、未开 PR；提交逐文件 `git add`。

反测（mutation，点名变红后复原并校验 SHA256）：

| 用例 | 篡改 | 变红断言 | 结果 |
| --- | --- | --- | --- |
| A | `restrictManifestItems` 改回按 `/menus/user` 过滤 | `【F1】STORE_OPERATOR：收银 9/9（菜单 ready 与 error 两态），业务路由为空 ← ready 态收银必须保持 9 项`；凌舟探针 `storeOperatorCashierAfter: 0 / pass:false` | 23 passed / 1 failed（`redtest-a.log`） |
| B | Shell 的 `visibleRouteNameList` 改取 `businessVisibleRouteNames` | `【F1】源码护栏 ← AI 容器集合必须取自最终角色集` | 23 passed / 1 failed（`redtest-b.log`） |

复原后 SHA256：`menu-access.ts` = `751788344B57192335E34594A80DD00A389BAC648479AB58D0D6D654BEA4ECA6`；`WorkbenchShell.vue` = `B85DAF49DB875D298D3EE4D5A13030FB27CBFDD38A8F5CBD834939AC85AB8D1E`；复绿 24/24。

未完成与阻塞：

- 无。

风险与自我报备：

1. **命名与任务卡字段名对照**：卡内写 `businessVisibleRoutes` / `roleVisibleRoutes`，实际落为 `businessVisibleRouteNames` / `visibleRouteNames`。后者保留原字段名是为了不破坏凌舟探针对 `access.visibleRouteNames` 的引用（该字段语义已改为「最终角色集」）。如需严格对齐命名，可另立改名卡，改动仅字段别名、不改行为。
2. **凌舟探针无法直接证明角色真实数值**：其脚本未传 `userRoles`，输出 0/0 只能证明「不越权」，不能证明「STORE_MANAGER 为 1/0」。建议复验时以本包 `runtime-role-probe.mjs` 为准（已显式传三角色）。
3. **收银与服务端授权脱钩**：收银 9 项完全由前端静态 `meta.roles` 决定，`/menus/user` 收回收银菜单也不会生效。这是本单「收银保底」的直接后果；若后续要求服务端可收回银入口，需另立卡引入收银 menuCode。
4. **`system`、`finance:expenses` 仍 unroutable**：白名单无对应路由，维持 04 轮已报备项（8/10 可路由）。
5. **`businessVisibleRouteNames` 仅诊断**：源码护栏断言 Shell/AI 容器不得引用该字段，防止后续误接回原始集合（反测 B 守护）。
6. **工作树依赖复用**：无独立 `node_modules`，通过目录联接复用主仓（被 `.gitignore` 忽略，不入库）。

回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-04F1-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-04F1-role-runtime-cashier.md；驳回依据 `docs/tasks/cards/R101-WORKBENCH-04-凌舟验收与裁定-20261023.md`
