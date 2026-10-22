# WORKBENCH-03F1 · 人工动作 ↔ AI 能力对等覆盖（证据包）

- 派单：`docs/tasks/inbox/WORKBENCH-03F1-parity-coverage.md`（P0，唯一在办）
- 上轮验收：`docs/tasks/cards/R101-WORKBENCH-03-凌舟验收与裁定-20261023.md`（对等覆盖未通过：80 人工入口 vs 19 AI 能力，routeName/actionId 映射为 0）
- 基线：`45b8cf1507dc6706ce512c1647770555d2da9234`
- 工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-03F1`｜分支：`workbench/WORKBENCH-03F1-parity-coverage`
- 负责人：墨（工作台负责人）

## 1. 本轮结果一览

| 指标 | 数值 | 口径 |
| --- | --- | --- |
| 人工入口覆盖 | **80/80** | 71 人工 + 收银 9，全部登记（状态 / 原因 / 人工回退） |
| 其中映射写动作 | 46 | `actionCount > 0` 的入口 |
| 只读页 / 本地弹窗动作 | 34 | 单独分组给出原因，人工入口保留（不删凑数） |
| 动作覆盖 | **254/254** | 30 矩阵 §2 写动作逐行 |
| 动作状态分布 | LIVE 26 / PARTIAL 0 / PLANNED 213 / BLOCKED 15 | `aiTool && confirmChain` 唯一依据 |
| 入口状态分布 | LIVE 2 / PARTIAL 12 / PLANNED 60 / BLOCKED 6 | 入口所辖动作按 LIVE→PARTIAL→BLOCKED→PLANNED 聚合 |
| AI 能力 | 19（18 项 AI_ONLY + ai-08 锚定 26 条确认链动作） | AI_ONLY 必带显式理由 |
| routeName 并集 | 79/79 | 能力锚点 46 + 入口路由；manifest 非空 routeName 全覆盖 |
| 业务域 | 66（全部中文标签） | 41 域含人工入口，可展开 |
| 探针 | `missingManualMappings = 0`、`pass = true` | `parity-probe.mjs` 真实计算 |

## 2. 对等口径（可机器核对）

### 2.1 动作行（真相源：30 矩阵）

- 章节定位：`## 2. 写动作矩阵` 起、`## 3.` 止。
- 行头：`^\|\s*[a-z0-9][a-z0-9-]*(\.[a-z0-9_]+)+(#[0-9]+)?\s*\|`。
- 多行单元格可能残留 `|`，故**不按 `|` 硬切**，改为逐列正则：
  - 页面：`admin-web/src/(views|layouts)/**.vue`（组件路径原文）；
  - 方法/路径：反引号内 `METHOD PATH`；
  - 权限码：`\|\s*([^|]*?)\s*\|\s*[WR]\s*\|`；
  - AI 工具/确认链：`\|\s*(有：…|无)\s*\|\s*(有（AI 侧…|无（页面直调…)`。
- 状态判定（矩阵列是唯一依据，不做人工归类）：

  | 条件 | 状态 |
  | --- | --- |
  | `aiTool && confirmChain` | LIVE |
  | `aiTool && !confirmChain` | PARTIAL |
  | `!aiTool && permission != UNKNOWN` | PLANNED |
  | `!aiTool && permission == UNKNOWN` | BLOCKED |

### 2.2 人工入口（真相源：route-manifest）

- 80 项 = `MANUAL_GROUPS`（71）+ `CASHIER_ITEMS`（9）。
- 页面归属按**组件路径精确匹配**（`../../views/**.vue` / `../../layouts/**.vue`），禁止名称相似。
- 入口状态聚合：全部 LIVE → LIVE；含 LIVE → PARTIAL；否则含 BLOCKED → BLOCKED；否则 PLANNED；零动作 → PLANNED（只读页）。
- 覆盖口径：80 项全部登记即有状态、缺失原因（非 LIVE）、人工回退；只读页/本地弹窗另列分组，**不删除入口**。
- 打印设置（`web.pos.print-settings`）为本地弹窗，`routeName = null` 显式登记并给原因，未从 manifest 删除。

### 2.3 能力模型（扩展字段）

- `manualRouteNames[]`、`manualActionIds[]`、`experienceGain`、`manualFallback`、`aiOnly`、`aiOnlyReason`、`ownerDomain`。
- 一项 AI 能力可覆盖多个动作（ai-08 → 26 条确认链动作）；一个动作可对应多条路由（矩阵页面多值时按 manifest 展开）。
- 动作能力 ID 空间：`act:<actionId>`，与 AI 矩阵 `ai-xx` 隔离，避免互相冒充。
- 每个能力必须满足：有动作锚点 **或** 路由锚点 **或** 显式 `AI_ONLY`（含理由）。

## 3. 交付物

| 文件 | 性质 |
| --- | --- |
| `admin-web/scripts/gen-parity-registry.mjs` | 生成器：矩阵 + manifest → TS 台账 + report JSON |
| `admin-web/src/shared/workbench/parity-actions-gen.ts` | 生成物：254 行动作原始事实（禁手改） |
| `admin-web/src/shared/workbench/parity-manual-gen.ts` | 生成物：80 项人工入口映射（禁手改） |
| `admin-web/src/shared/workbench/parity-ledger.ts` | 派生层：状态/原因/回退/域汇总/校验器 |
| `admin-web/src/shared/workbench/parity-domains.ts` | 66 域中文标签 + 状态严重度 |
| `admin-web/src/shared/workbench/capability-types.ts` | 能力模型扩展字段 |
| `admin-web/src/components/workbench/AiFeedContainer.vue` | 能力台账顶部覆盖摘要 + 66 域展开 + 只读分组 |
| `admin-web/tests/parity-coverage.spec.mjs` | 16 条断言（含独立重解析与 3 组 mutation） |
| `admin-web/package.json` | `test` 链追加 parity-coverage（既有 4 个 spec 不减少） |
| `docs/evidence/WORKBENCH-03F1/parity-report.json` | 机器可读对等报告 |
| `docs/evidence/WORKBENCH-03F1/parity-probe.mjs` | 真实探针（同凌舟 schema） |

## 4. 复跑命令

```powershell
# 1) 重新生成台账与报告（矩阵或 manifest 变更后必须复跑）
node admin-web/scripts/gen-parity-registry.mjs

# 2) 对等探针（参数为工作树绝对路径）
node docs/evidence/WORKBENCH-03F1/parity-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-03F1

# 3) 全量测试（72 = 既有 56 + 新增 16）
npm --workspace admin-web run test

# 4) 双构建
npm --workspace admin-web run build:check
npm --workspace admin-web run build
```

## 5. 测试与门禁（16 条）

| # | 断言 | 结果 |
| --- | --- | --- |
| 1 | 人工入口守恒：80/80 登记，含本地弹窗显式登记 | PASS |
| 2 | routeName 并集守恒：能力锚点 ∪ 入口路由 == manifest 全部路由（79/79） | PASS |
| 3 | 动作锚点守恒：254 行 ↔ 254 个 `act:<actionId>` | PASS |
| 4 | 状态守恒：动作 26/0/213/15，入口 2/12/60/6 | PASS |
| 5 | 独立重解析 30 矩阵：254 行逐行一致（漂移必红） | PASS |
| 6 | PLANNED/BLOCKED 三要素齐全；LIVE 必须工具+确认链 | PASS |
| 7 | AI 能力 19 项：ai-08 锚定 26 条，其余 18 项显式 AI_ONLY | PASS |
| 8 | 入口状态聚合与能力引用无悬空 | PASS |
| 9 | 业务域汇总：66 域全量中文标签、域内入口可追溯 | PASS |
| 10 | mutation A 删动作映射：`MISSING_ACTION_MAPPING` 点名 | PASS |
| 11 | mutation B 删路由映射：`MISSING_ROUTE_MAPPING` 点名 | PASS |
| 12 | mutation C PLANNED 洗 LIVE：`UNSAFE_LIVE` 点名 | PASS |
| 13 | `parity-report.json` 与运行时一致（missingManualMappings=0、pass=true） | PASS |
| 14 | UI 接线：摘要来自台账计算、66 域展开、不硬编码覆盖数 | PASS |
| 15 | 无 mock：对等台账零随机/模拟数据 | PASS |
| 16 | 业务冻结：views/backend 相对基线零改动、既有 4 个 spec 不减少 | PASS |

全量：`role-guard 3 + landing 30 + workbench-shell 11 + ai-primary 12 + parity-coverage 16 = 72 passed / 0 failed`（既有 56 条未减少）。

## 6. 反测记录（造错必红 → 点名 → 复原 SHA 一致 → 复绿）

| 组 | 造错方式 | 变红断言（点名） | 复原 SHA256 |
| --- | --- | --- | --- |
| A | `parity-manual-gen.ts` 中 `web.order.aftersale` 删去 `actionIds` 首项（删动作映射） | `人工入口守恒 … ← web.order.aftersale 动作计数应与锚点一致`（15 passed / 1 failed） | 一致（见 `redtest-a.log`） |
| B | `web.dashboard` 的 `routeName` 置 null（删路由映射） | `人工入口守恒 … ← web.dashboard routeName 应与 manifest 一致`；`routeName 并集守恒 … ← 漏映射路由：dashboard`（14 passed / 2 failed） | 一致（见 `redtest-b.log`） |
| C | `parity-actions-gen.ts` 将 `aftersale.approve_create` 由 PLANNED 洗成 LIVE | `状态守恒 … 动作状态分布不符合矩阵`；`独立重解析 … aftersale.approve_create 状态被改：LIVE≠PLANNED`；`LIVE 必须工具+确认链 … 被标 LIVE 但矩阵无工具/确认链`；`入口状态聚合 … web.order.aftersale PLANNED≠PARTIAL`；`report 一致`（11 passed / 5 failed） | 一致（见 `redtest-c.log`） |

每组反测均在复原后复跑并通过 16/16（见日志「复原后」段落）。

## 7. 红线核对

| 红线 | 核对方式 | 结果 |
| --- | --- | --- |
| 不重写已通过 UI | 只在能力台账区块内插入摘要/展开；四区、19 项列表、快捷指令、故障回人工未改 | 符合 |
| 不删人工入口凑数 | 80/80 全登记；34 只读/本地动作单列原因 | 符合 |
| 不用名称相似冒充映射 | 路由按组件路径精确匹配；动作引用矩阵 actionId 原文；`extraRoutes = []` | 符合 |
| 不接 WT-04 写链路 | 无新增 confirm/cancel/revoke 调用；PARTIAL 明确拒绝直接执行写操作 | 符合 |
| 不 push / 不开 PR | 仅本地 commit，逐文件 `git add`（未用 `-A`） | 符合 |

## 8. 已知事项与风险

1. **凌舟验收探针存在硬编码缺陷**：`docs/evidence/WORKBENCH-03/凌舟验收-20261023/parity-probe.mjs` 中 `missingManualMappings: manualEntries.length`、`pass: false`、`process.exit(1)` 为写死值（第 58–63 行），任何实现都无法通过。本轮不改原探针，另交付同 schema 的真实探针 `parity-probe.mjs`；建议下轮验收改用它。
2. **34 个只读页/本地弹窗无 AI 对应项**：按任务卡「无 AI 对应项标 PLANNED/BLOCKED 且必有原因、责任域、人工回退」登记，未新增虚构动作行（动作台账严格 = 矩阵 254 行）。
3. **99 行动作不在任何菜单入口下（off-menu）**：动作台账自身即锚点（`act:<actionId>`），`report.json` 以 `onMenuActionRows 155 / offMenuActionRows 99` 透明披露，不隐藏、不并入口凑数。
4. **生成物禁止手改**：`parity-actions-gen.ts` / `parity-manual-gen.ts` 头部标注 AUTO-GENERATED；矩阵或 manifest 变更后必须复跑生成器，否则第 5 条「独立重解析」会点名变红。
5. **依赖解析**：本工作树无 `node_modules`，测试/构建通过目录联接复用主仓 `wen-ssystem/node_modules`（未提交、未纳入版本控制）。