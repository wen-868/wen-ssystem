# WORKBENCH-03 证据包 · AI 数字员工主交互面

- 任务卡：`docs/tasks/inbox/WORKBENCH-03-ai-primary-interaction.md`
- 基线：`d7e7cc6e96299dd0465614b070acd956a3cbe76b`
- 工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-03`
- 分支：`workbench/WORKBENCH-03-ai-primary`
- 责任人：墨（工作台负责人）

## 1. 实现范围

| 交付项 | 落地文件 |
| --- | --- |
| AI 主交互面（信息流 / 快捷经营指令 / Agent 运行状态 / 能力台账 四区） | `admin-web/src/components/workbench/AiFeedContainer.vue` |
| 能力台账（19 项，LIVE/PARTIAL/PLANNED/BLOCKED） | `admin-web/src/shared/workbench/capability-types.ts`、`capability-entries-a.ts`、`capability-entries-b.ts`、`capability-registry.ts` |
| AI 故障隔离 + 一键回人工 | `admin-web/src/components/workbench/AiChatPanel.vue`、`admin-web/src/components/AiChat/AiSidePanel.vue`（新增 `status` 事件与 `defineExpose`） |
| 壳层接线（会话状态 / 快捷指令 / 新对话 / fallback） | `admin-web/src/layouts/WorkbenchShell.vue` |
| 断言用例（12 条） | `admin-web/tests/ai-primary.spec.mjs`，已并入 `npm --workspace admin-web run test` |

约束遵守：

- `admin-web/src/views/**`、登录/注册页、`backend/**` 相对基线零改动（测试第 12 条用 `git diff --name-only d7e7cc6e -- admin-web/src/views backend` 断言为空）。
- 不接 `/api/admin/menus/user`；不新增 AI 写动作确认链（留 WT-04）。
- 不复制第二套对话实现：快捷指令与「新对话」经 `AiChatPanel` → `AiSidePanel` 的 `defineExpose` 复用既有真实发送/清空逻辑。
- 无 mock：AI 主交互面 6 个文件不含 `Math.random / mock / fake / 示例数据 / 随机`。

## 2. 能力台账对账规则（硬验收③）

- 真相源：`docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md`（19 行明细表）。
- 状态判据原样沿用矩阵：LIVE＝端点存在且挂载中有调用点；PARTIAL＝端点存在但前端未接；PLANNED＝端点不存在；BLOCKED＝前置依赖未满足。
- 守恒：`LIVE 1 + PARTIAL 12 + PLANNED 6 + BLOCKED 0 = 19`。
- 测试直接解析矩阵 markdown 明细行（`/^\|\s*\d+\s*\|/`），与台账逐行比对「行号 + 标题 + 状态」；标题比对前做空白归一（矩阵 #8 写作「预览 → 确认 → 执行 → 撤销」带空格）。
- 唯一 LIVE 项为 `ai-08`（写操作确认/取消/撤销），依据：`admin-web/src/api/ai.ts` 含 confirm/cancel/revoke 三条端点，`AiSidePanel.vue` 含对应调用函数。
- 6 项 PLANNED 必填 `missingReason`，UI 侧 `isCapabilityEnabled()` 返回 false 并落 `is-disabled` / `title` 提示，不做伪造入口。

## 3. AI 故障隔离（硬验收④）

- `AiSidePanel` 新增 `status` 事件：对话开始 `streaming`、结束 `idle`、SSE/请求失败 `error(message)`；不改内部对话逻辑。
- `AiChatPanel` 收到 `error` 后渲染 `role="alert"` 故障横幅（含真实错误文案）+「切换人工操作台（业务页面不受影响）」按钮，点击 `emit('fallback')`。
- `WorkbenchShell` 以 `@fallback="switchMode('human')"` 接回人工模式；人工分支 `<router-view />` 无条件渲染，AI 组件不包裹人工路由。
- 无自动重试：不出现 `setInterval / while (true) / autoRetry`。

## 4. 可复跑命令

```powershell
# cwd = D:\Users\ZXQL\wt-agents\WORKBENCH-03
npm --workspace admin-web run test          # 56 passed（role-guard 3 + landing 30 + workbench-shell 11 + ai-primary 12）
npm --workspace admin-web run build:check
npm --workspace admin-web run build
node admin-web/tests/ai-primary.spec.mjs    # 单跑本任务 12 条
```

## 5. 测试与构建结果

- 全量测试：`test-final.log`，`56 passed / 0 failed`，EXIT=0。
- 构建检查：`buildcheck.log`，EXIT=0。
- 构建：`build.log`，EXIT=0。

## 6. 反测记录（硬验收⑥：红侧点名，复原 SHA 一致并复绿）

### 反测 A · 能力状态被洗成 LIVE

- 造错：`capability-entries-a.ts` 中 `ai-02` 由 `PLANNED` 改为 `LIVE`。
- 红侧日志：`redtest-a.log`，`8 passed / 4 failed`，点名：
  - `FAIL 状态守恒 …`：`LIVE 2 / PLANNED 5`
  - `FAIL P0 矩阵对账 …  ← #2 状态应与矩阵一致（矩阵 PLANNED）`
  - `FAIL LIVE 依据：ai-08 端点 + 挂载中的真实调用点  ← LIVE 应仅有 1 项`
  - `FAIL PLANNED：必填缺失原因且 UI 禁用  ← PLANNED 应为 6 项`
- 复原：SHA256 = `038479791A34102C74FA753F2E06A0CF78C5D9DD0AD71A72E9212D93534D90DF`（复原前后一致）。
- 复绿：`redtest-a-restore.log`，EXIT=0。

### 反测 B · AI 故障不提供人工保底

- 造错：删除 `AiChatPanel.vue` 故障横幅中的「切换人工操作台」按钮块（`emit('fallback')` 一并移除）。
- 红侧日志：`redtest-b.log`，`11 passed / 1 failed`，点名：
  - `FAIL AI 故障隔离：明确状态 + 一键回人工 + 人工路由不受阻  ← 故障横幅应有切人工入口`
- 复原：SHA256 = `1AC79A10A5436EB796A6F85E33AA0C3D26EA9F1C53CB090169A691230BE2CD6C`（复原前后一致）。
- 复绿：全量 `test-final.log` EXIT=0。

## 7. 文件清单

```
docs/evidence/WORKBENCH-03/
  README.md
  test-final.log
  redtest-a.log
  redtest-a-restore.log
  redtest-b.log
  buildcheck.log
  build.log
```
