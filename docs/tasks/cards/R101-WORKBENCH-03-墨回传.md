# 【汇报 WORKBENCH-03】AI 数字员工主交互面

汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-23
执行通道：本地独立工作树 `D:\Users\ZXQL\wt-agents\WORKBENCH-03`（分支 `workbench/WORKBENCH-03-ai-primary`，基线 `d7e7cc6e`）
交付物（文件路径 + 提交哈希）：

| # | 文件 | 性质 | 提交 |
| --- | --- | --- | --- |
| 1 | `admin-web/src/components/workbench/AiFeedContainer.vue` | AI 主交互面四区：快捷经营指令 / Agent 运行状态 / AI 信息流 / 能力台账 | `e8143e46` |
| 2 | `admin-web/src/shared/workbench/capability-types.ts` | 能力状态类型（LIVE/PARTIAL/PLANNED/BLOCKED） | `e8143e46` |
| 3 | `admin-web/src/shared/workbench/capability-entries-a.ts` | 能力台账 ai-01…ai-10（镜像矩阵第 1–10 行） | `e8143e46` |
| 4 | `admin-web/src/shared/workbench/capability-entries-b.ts` | 能力台账 ai-11…ai-19（镜像矩阵第 11–19 行） | `e8143e46` |
| 5 | `admin-web/src/shared/workbench/capability-registry.ts` | 台账汇总、快捷指令、状态判定与统计辅助 | `e8143e46` |
| 6 | `admin-web/src/components/workbench/AiChatPanel.vue` | AI 故障隔离横幅 + 一键切人工，暴露快捷指令/新对话 | `e8143e46` |
| 7 | `admin-web/src/components/AiChat/AiSidePanel.vue` | 新增 `status` 事件与 `defineExpose`（不改内部对话逻辑） | `e8143e46` |
| 8 | `admin-web/src/layouts/WorkbenchShell.vue` | 会话状态/快捷指令/新对话/fallback 接线（+29/−2 行） | `e8143e46` |
| 9 | `admin-web/tests/ai-primary.spec.mjs` + `admin-web/package.json` | 12 条断言并接入 `npm test` | `e8143e46` |
| 10 | `docs/evidence/WORKBENCH-03/{README.md,test-final.log,redtest-a.log,redtest-a-restore.log,redtest-b.log,build.log,buildcheck.log}` | 证据包 | `e8143e46` |

证据（可复跑）：

```powershell
npm --workspace admin-web run test          # 56 passed / 0 failed（role-guard 3 + landing 30 + workbench-shell 11 + ai-primary 12）
node admin-web/tests/ai-primary.spec.mjs    # 12 passed / 0 failed
npm --workspace admin-web run build:check   # exit 0（✓ built in 8m 33s，仅 chunk 体积提示）
npm --workspace admin-web run build         # exit 0（✓ built in 8m 9s）
```

原始输出：

- `docs/evidence/WORKBENCH-03/test-final.log`：role-guard 3 / landing 30 / workbench-shell 11 / ai-primary 12，合计 56 passed / 0 failed。
- `docs/evidence/WORKBENCH-03/build.log`、`buildcheck.log`：均 EXIT=0；日志内 `error TS` 计数 0；唯一提示为 `(!) Some chunks are larger than 500 kB`（非阻断，与 WB-02 一致）。
- `docs/evidence/WORKBENCH-03/redtest-a.log`（8 passed / 4 failed）、`redtest-b.log`（11 passed / 1 failed）、`redtest-a-restore.log`（12 passed / 0 failed）。

验收自评（对应任务卡 7 条硬验收）：

1. **通过** — 冻结面零改动：`git diff --name-only d7e7cc6e -- admin-web/src/views backend` 输出为空；登录/注册页未触碰；测试第 12 条固化该断言。
2. **通过** — `test`（56 passed）、`build:check`（EXIT=0）、`build`（EXIT=0）全绿。
3. **通过** — 台账 19 项与 P0 矩阵逐行对账（行号 + 标题 + 状态），守恒 `LIVE 1 / PARTIAL 12 / PLANNED 6 / BLOCKED 0 = 19`；唯一 LIVE 项 `ai-08` 有可复跑依据（`api/ai.ts` confirm/cancel/revoke 三端点 + `AiSidePanel.vue` 挂载中调用点）。
4. **通过** — 故障隔离：`AiSidePanel` 错误 → `AiChatPanel` `role="alert"` 横幅 +「切换人工操作台」→ 壳层 `switchMode('human')`；人工分支 `<router-view />` 无条件渲染；无自动重试、无白屏路径。
5. **通过** — 未接 `/api/admin/menus/user`（6 个 AI 面文件零命中）；未新增 AI 写动作确认链（零 `confirmAiOperation(`/`cancelAiOperation(`/`revokeAiOperation(` 调用），留 WT-04。
6. **通过** — 反测两侧齐：
   - A：`ai-02` 由 PLANNED 洗成 LIVE → `状态守恒（LIVE 2 / PLANNED 5）`、`P0 矩阵对账 #2（矩阵 PLANNED）`、`LIVE 依据 2 !== 1`、`PLANNED 5 !== 6` 四条点名变红；复原 SHA256 `038479791A34…D90DF` 一致并复绿。
   - B：删除「切换人工操作台」按钮块 → `AI 故障隔离：… ← 故障横幅应有切人工入口` 点名变红；复原 SHA256 `1AC79A10A543…CD6C` 一致并复绿。
7. **通过** — 工作树 clean（`git status --porcelain` 为空）；未 push、未开 PR；逐文件 `git add`（未用 `-A`）。

未完成与阻塞：

- 无。

风险与自我报备：

1. **AI 信息流与 Agent 任务通道未接真实数据**：对应矩阵 `ai-03`/`ai-06` 均为 PARTIAL（端点/推送通道未接前端），界面显式标注「本体未接入（ai-03 PARTIAL）」「未接入（ai-06 PARTIAL）」，不展示虚构进度或演示数字；接入属后续任务。
2. **AI 模式下二级业务入口仍为「切人工并打开真实页面」**：符合任务卡口径，AI 模式不直接承载二级页面路由。
3. **快捷指令复用 `POST /api/chat`**：底座无指令注册/解析端点（`ai-05` PARTIAL），故 3 条快捷指令仅作为提示词注入既有真实会话，未新增端点、未伪造指令执行结果。
4. **会话状态为客户端真实观测**：`idle/streaming/error` 仅来自 `AiSidePanel` 实际回调，不代表服务端 Agent 队列状态；后端 Agent 运行态可视化留待底座能力补齐。
5. **能力台账需随底座演进而更新**：后续若端点新增，必须先改 `docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md` 再改台账，否则 `ai-primary` 用例会因逐行对账不一致而变红（这是预期护栏）。

关联卡：`docs/tasks/inbox/WORKBENCH-03-ai-primary-interaction.md`；上轮验收卡 `docs/tasks/cards/R101-WORKBENCH-02-凌舟验收与裁定-20261023.md`
