# WORKBENCH-04 证据包 —— 动态菜单与 AI 代办桥接

基线：`db350f2f6758e3005f48d2226d639bdf230448f3`
分支：`workbench/WORKBENCH-04-menu-ai-bridge`

## 1. 交付内容

| 交付 | 文件 | 说明 |
| --- | --- | --- |
| 动态菜单纯逻辑 | `admin-web/src/shared/workbench/menu-access.ts` | 桥接表 10 条（带矩阵行号证据）、载荷解析、fail-closed 状态机、manifest 裁剪 |
| 唯一服务端消费点 | `admin-web/src/api/workbench-menu.ts` | `GET /api/admin/menus/user`，全仓仅此一处字面量 |
| AI 代办上下文 | `admin-web/src/shared/workbench/ai-bridge.ts` | 仅生成 prompt 与动作清单，不含任何写接口调用 |
| 壳层接线 | `admin-web/src/layouts/WorkbenchShell.vue` | 菜单加载/失败/重试/空态、AI 代办当前页按钮、人工与 AI 同源可见集合 |
| AI 主面运行时裁剪 | `admin-web/src/components/workbench/AiFeedContainer.vue` | `projectParityRuntime` 展示运行时口径，静态台账不变 |
| 会话排队 | `admin-web/src/components/workbench/AiChatPanel.vue` | 异步面板未就绪时上下文入队，挂载后交同一会话 |
| 对等运行时视图 | `admin-web/src/shared/workbench/parity-ledger.ts` | 新增 `projectParityRuntime`，静态 80/80、254/254 不变 |
| 白名单索引 | `admin-web/src/shared/workbench/route-manifest.ts` | `ALL_MANIFEST_ITEMS` / `ALL_MANIFEST_ROUTE_NAMES` |
| 断言用例 | `admin-web/tests/menu-ai-bridge.spec.mjs` | 18 条（含反测 A/B/C 守门） |

## 2. 关键判定口径

- 可见性 = 服务端 menuCode 集 ∧ 白名单 routeName 存在 ∧ 路由 `meta.roles` 命中；三者缺一不可。
- 服务端 menuCode 与前端 `web.` 前缀不同命名空间，仅通过 `SERVER_MENU_BRIDGE` 显式桥接，禁止名称相似推断。
- 加载中 / 失败 / 空菜单 / 未知码 / 未知路由 → 空可见集（fail-closed），文案披露原因并提供重试/联系管理员，不回退全量。
- 桥接 10 条中，`system`、`finance:expenses` 在静态白名单无对应路由 → 记为 unroutable，不渲染。
- AI 代办只把 `prompt` 交给既有会话（`AiSidePanel.sendText` → `POST /api/chat`）；写操作仍必须预览→确认→执行→撤销。
- PLANNED/BLOCKED 动作在 prompt 中明确「不能代办」并给出人工回退，不出现「已可执行」暗示。

## 3. 验证结果

- `npm test`：90 passed / 0 failed（既有 72 条保留 + 新增 18 条），见 `test-final.log`。
- `npm run build:check`：EXIT=0，见 `buildcheck.log`。
- `npm run build`：见 `build.log`。
- 反测：`redtest-a.log`（服务失败回退全量）、`redtest-b.log`（越权菜单透传）、`redtest-c.log`（AI 代办直接写），三者均须红并点名单条用例，复原后复绿。

## 4. 未完成 / 风险报备

- 桥接仅覆盖 10-route-menu-matrix 判定可对齐的 10 个 menuCode（8 个可路由）；其余服务端菜单码暂不映射，按未知码隐藏，需后续矩阵补齐。
- 静态台账 80/80、254/254 不随服务端菜单变化；运行时视图会裁剪，台账口径以静态为准并在 UI 中标注「静态台账不变」。