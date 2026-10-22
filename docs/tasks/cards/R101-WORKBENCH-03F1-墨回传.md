# 【汇报 WORKBENCH-03F1】人工动作与 AI 能力双向对等覆盖

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-23
执行通道：WorkBuddy
工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-03F1`（分支 `workbench/WORKBENCH-03F1-parity-coverage`，基线 `45b8cf15`）

交付物（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/src/shared/workbench/capability-types.ts` | 扩展能力模型：`manualRouteNames[]` / `manualActionIds[]` / `experienceGain` / `manualFallback` / `aiOnly` | `728fed18` |
| 2 | `admin-web/scripts/gen-parity-registry.mjs` | 生成器：解析 30 矩阵 + route-manifest，产出动作台账、人工台账、域标签与 `parity-report.json` | `728fed18` |
| 3 | `admin-web/src/shared/workbench/parity-actions-gen.ts` | 生成物：254 条写动作台账（镜像 `30-action-permission-matrix.md` 全部 W/R 行） | `728fed18` |
| 4 | `admin-web/src/shared/workbench/parity-manual-gen.ts` | 生成物：80 条人工入口台账（12 组 71 项 + 收银 9 项） | `728fed18` |
| 5 | `admin-web/src/shared/workbench/parity-domains.ts` | 生成物：66 个业务域中文标签与归属 | `728fed18` |
| 6 | `admin-web/src/shared/workbench/parity-ledger.ts` | 双向对等台账：状态派生、原因/责任域/人工回退、`validateParity` 门禁、UI 摘要 | `728fed18` |
| 7 | `admin-web/src/components/workbench/AiFeedContainer.vue` | 台账顶部对等摘要 +「按业务域查看（66 域）」展开 + 只读入口单列（仅 +165/−2，四区与 19 项列表未改） | `728fed18` |
| 8 | `admin-web/tests/parity-coverage.spec.mjs` | 新增 16 条断言（含三类 mutation），接入 `npm test` | `728fed18` |
| 9 | `admin-web/package.json` | test 链追加 `node tests/parity-coverage.spec.mjs`（原 4 条 spec 保留） | `728fed18` |
| 10 | `docs/evidence/WORKBENCH-03F1/{parity-probe.mjs,parity-report.json,README.md}` | 真实探针（替换凌舟硬编码版）、机器可读对等报告、口径说明 | `728fed18` |
| 11 | `docs/evidence/WORKBENCH-03F1/{test-final.log,probe.log,redtest-a.log,redtest-b.log,redtest-c.log,build.log,buildcheck.log}` | 证据包 | `728fed18` |
| 12 | 8 个源码文件行尾 CRLF→LF | 消除整文件 EOL 噪声，使净 diff 可审（19 files，+3180/−7） | `4cf03032` |

证据（可复跑）：

```powershell
node docs/evidence/WORKBENCH-03F1/parity-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-03F1
npm --workspace admin-web run test          # 72 passed / 0 failed（含既有 56 条）
npm --workspace admin-web run build:check   # EXIT=0
npm --workspace admin-web run build         # EXIT=0
```

原始输出：

- 探针（`probe.log`）：
  `{"manualEntries":80,"capabilityEntries":19,"capabilitiesWithRouteName":156,"capabilitiesWithActionId":255,"missingManualMappings":0,"pass":true,"actionRows":254,"actionAnchors":254,"statusCounts":{"LIVE":26,"PARTIAL":0,"PLANNED":213,"BLOCKED":15},"manifestRoutes":79,"capabilityRoutes":46,"unionRoutes":79,"missingRoutes":[],"extraRoutes":[],"danglingActionRefs":[],"unsafeLive":[],"plannedMissingThreeElements":[],"orphanCapabilities":[],"domains":66,"summary":"人工入口覆盖 80/80 · 动作覆盖 254/254"}`
  对比凌舟原探针：`capabilitiesWithRouteName 0 / capabilitiesWithActionId 0 / missingManualMappings 80`。
- `test-final.log`：5 个小结 `3 / 30 / 11 / 12 / 16`，合计 **72 passed / 0 failed**（既有 56 条一条未减，新增 16 条）。
- `build.log`：`✓ built in 5m 52s`，`# EXIT=0`；`buildcheck.log`：`✓ built in 6m`，`# EXIT=0`；`error TS` 计数 0；唯一提示为 `(!) Some chunks are larger than 500 kB`（非阻断，与 WB-02/WB-03 一致）。

验收自评（对应任务卡「三、硬验收」6 条）：

1. **通过** — `missingManualMappings=0`：80 项人工入口（`MANUAL_GROUPS` 71 + `CASHIER_ITEMS` 9）逐项登记归属，`missingManualMappingCodes=[]`；台账对 80 项全部给出状态、责任域与人工回退。
2. **通过** — 矩阵行数守恒：独立重解析 `30-action-permission-matrix.md` 得 254 行，台账锚点 254、`actionAnchors=254`、四态和 `26+0+213+15=254`；测试另用一套不依赖生成器的解析器逐行复核（漂移必红）。
3. **通过** — 反向无静默孤儿：19 项 AI 能力中 `ai-08` 有 26 条真实动作锚点，其余 18 项显式 `AI_ONLY`；`orphanCapabilities=[]`。
4. **通过** — UI 可读：台账顶部显示「人工入口覆盖 80/80 · 动作覆盖 254/254」+ 四态计数 + 人工入口四态计数，可展开 66 个业务域查看该域全部入口及 AI 状态（`data-testid="parity-domains"`），只读页/本地弹窗动作单列原因；文案明确「未实现 AI 的入口不会消失：人工仍可从左侧导航进入并操作」。
5. **通过** — 测试只增不减：56 → 72；新增 16 条覆盖双向差集、80/80 守恒、79 routeName 并集（能力侧 46 条 + 入口自身 routeName）、254↔254 锚点、PLANNED/BLOCKED 三要素、66 域汇总、report 一致、UI 接线、业务冻结与三类 mutation。
6. **通过** — `build:check` / `build` 全绿；`git diff --name-only 45b8cf15..HEAD -- admin-web/src/views backend` 为空；工作树 clean（`git status --porcelain` 为空）；未 push、未开 PR；提交均逐文件 `git add`（未用 `-A`）。

反测（mutation，全部点名变红后复原，SHA256 一致并复绿 16/16）：

| 用例 | 篡改 | 变红断言 | 结果 |
| --- | --- | --- | --- |
| A | 删除 `web.order.aftersale` 一条动作映射 | `人工入口守恒 … ← web.order.aftersale 动作计数应与锚点一致`、`MISSING_ACTION_MAPPING` | 15 passed / 1 failed（`redtest-a.log`） |
| B | 把某入口 `routeName` 改为 `null` | 2 条点名该入口的路由覆盖断言 | 14 passed / 2 failed（`redtest-b.log`） |
| C | 把 `aftersale.approve_create` 由 PLANNED 洗成 LIVE | 5 条：状态守恒、矩阵对账、LIVE 依据、`UNSAFE_LIVE` 点名 | 11 passed / 5 failed（`redtest-c.log`） |

未完成与阻塞：

- 无。

风险与自我报备：

1. **凌舟原探针不可用（建议作废重发）**：`docs/evidence/WORKBENCH-03/凌舟验收-20261023/parity-probe.mjs` 第 53–63 行把 `missingManualMappings` 硬编码为 `manualEntries.length`、`pass:false`、`process.exit(1)`，任何实现都无法通过。本轮在 `docs/evidence/WORKBENCH-03F1/parity-probe.mjs` 重写为真实计算版，schema 保持兼容并新增 `actionRows/statusCounts/unionRoutes/domains` 等字段。
2. **34 个入口为只读页或本地弹窗动作**：打印设置 `routeName=null` 已显式登记而非跳过；这些入口无写动作可挂，单列原因与人工回退，不靠「名称相似」冒充映射（`extraRoutes=[]`、`danglingActionRefs=[]`）。
3. **99 行动作为 off-menu 写动作**：254 行中 `onMenu 155 / offMenu 99`，off-menu 行以 `act:<actionId>` 自身为锚点并在 README 披露口径，不对应任何菜单入口，不计入 80 项覆盖率分母。
4. **生成物禁手改**：`parity-*-gen.ts` / `parity-domains.ts` 由 `gen-parity-registry.mjs` 产出；改矩阵或 route-manifest 后须复跑生成器，否则 `parity-coverage.spec.mjs` 因逐行对账不一致而变红（预期护栏）。
5. **跨仓台账未统一**：AI 底座线 `AI-P0-3` 的跨仓 `parity-ledger.json` 尚未交付，本单只落兼容 schema 与 80 项全覆盖，**不宣称双仓台账已统一**；待 `AI-P0-3` 交付后按字段做兼容映射。
6. **工作树依赖复用**：工作树无独立 `node_modules`，通过目录联接复用主仓 `wen-ssystem/node_modules`（被 `.gitignore` 忽略，不入库、不影响提交）。
7. **行尾归一单独提交**：仓库存在 index LF / 工作副本 CRLF 混存，首提交产生整文件 diff 噪声；已用 `4cf03032` 仅做 EOL 归一（内容零变化），净 diff 回到 19 files / +3180 / −7 以便逐行审阅。

回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-03F1-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-03F1-parity-coverage.md；上轮验收卡 `docs/tasks/cards/R101-WORKBENCH-03-凌舟验收与裁定-20261023.md`
