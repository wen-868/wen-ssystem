# WORKBENCH-02 证据包 · 双模式工作台壳层骨架

- 任务卡：`docs/tasks/inbox/WORKBENCH-02-shell-skeleton.md`
- 负责人：墨（工作台负责人）
- 基线：`7e12d06c`（`7e12d06c97b59dd88003a21872e5d48bd6e754d8`）
- 分支：`workbench/WORKBENCH-02-shell`
- 工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-02`
- 日期：2026-10-23

## 一、实现范围

只新增壳层、静态 manifest 与测试；现有二级业务页面、登录页、注册页零改动。

| 文件 | 性质 | 说明 |
| --- | --- | --- |
| `admin-web/src/shared/workbench/types.ts` | 新增 | manifest 类型与 `item()` 构造器 |
| `admin-web/src/shared/workbench/manifest-manual-a.ts` | 新增 | 人工侧第 1~6 组，37 项 |
| `admin-web/src/shared/workbench/manifest-manual-b.ts` | 新增 | 人工侧第 7~12 组，34 项 |
| `admin-web/src/shared/workbench/manifest-pos.ts` | 新增 | 收银 9 项（8 条路由 + 1 个本地打印设置动作） |
| `admin-web/src/shared/workbench/route-manifest.ts` | 新增 | 组合 12 组 71 项；角色可见性派生与过滤 |
| `admin-web/src/shared/workbench/shell-mode.ts` | 新增 | `human \| ai` 模式状态 + feature flag |
| `admin-web/src/layouts/WorkbenchShell.vue` | 新增 | 总壳：模式切换、人工/AI 分支、收银分支、回退旧壳 |
| `admin-web/src/layouts/ManualSidebar.vue` | 新增 | 人工模式二级导航（按角色过滤后的 manifest） |
| `admin-web/src/layouts/AiNavRail.vue` | 新增 | AI 模式一级模块 rail |
| `admin-web/src/components/workbench/AiFeedContainer.vue` | 新增 | AI 信息流容器骨架（明示 P2 接入，不造数据） |
| `admin-web/src/components/workbench/AiChatPanel.vue` | 新增 | 挂载现有 `AiSidePanel` 并覆盖布局 |
| `admin-web/src/router/index.ts` | 修改 2 行 | 根布局 `MainLayout` → `WorkbenchShell` |
| `admin-web/src/components/AiChat/AiSidePanel.vue` | 修改 | 修复未消费/未挂载问题（见第四节） |
| `admin-web/tests/workbench-shell.spec.mjs` | 新增 | 11 条断言 |
| `admin-web/package.json` | 修改 1 行 | `test` 脚本接入新用例 |

## 二、装配规则

1. **特征开关**：`isWorkbenchShellV2Enabled()` 默认启用；`localStorage wb.shell.v2=0/off` 或构建期
   `VITE_WORKBENCH_SHELL_V2=0/false` 时，壳层直接渲染旧 `MainLayout`（灰度回滚路径，旧壳未被修改）。
2. **人工模式**：`ManualSidebar`（角色派生后的 12 组）+ 现有 `<router-view>`；页面组件零改动。
3. **AI 模式**：`AiNavRail`（组级）+ `AiFeedContainer`（骨架占位）+ `AiChatPanel`（复用 `AiSidePanel`）；
   不接写动作、不展示模拟数据，二级入口只提供“切人工操作台打开”的真实导航。
4. **收银台**：`/pos/*` 强制人工模式，渲染 `CASHIER_ITEMS` 的 9 项；打印设置为本地弹窗（沿用
   `PrintSettingsPanel`），不新增路由。
5. **可见性**：`resolveRoles(routeName)` 从 `router.getRoutes()` 读取 `meta.roles`；未知 routeName 返回
   `null` → 不可见（fail-closed）。人工与 AI 共用同一函数。
6. **模式持久化**：`localStorage wb.shell.mode`（默认 `human`）。

## 三、可复跑命令

```powershell
# 工作树根目录
npm --workspace admin-web run build        # vite build
npm --workspace admin-web run build:check  # vue-tsc -b && vite build
npm --workspace admin-web run test         # role-guard 3 + landing 30 + workbench-shell 11
node admin-web/tests/workbench-shell.spec.mjs
```

原始输出见同目录：

- `test-final.log`（全量测试，44 passed / 0 failed）
- `redtest.log`（反测，10 passed / 1 failed）
- `buildcheck.log`（`npm --workspace admin-web run build:check` 原始输出：vue-tsc 无报错 + `✓ built in 5m 2s`）
- `build.log`（`npm --workspace admin-web run build` 原始输出）

构建记录：`build:check` 与 `build` 均 exit 0；随后仅对 `router/index.ts` 做换行符归一（内容等价，
`git diff --ignore-cr-at-eol` 为 2/2 行），测试与上述构建结论不变。

## 四、AiSidePanel 修复清单

| 问题 | 修复 |
| --- | --- |
| `clearChat()` 已定义但模板无任何消费（死函数） | 头部新增“清空对话”按钮，`messages.length > 0 && !collapsed` 时显示 |
| 折叠按钮 `:icon="collapsed ? 'Expand' : 'Fold'"` 传字符串，Element Plus 要求组件 | 改为 import `Expand` / `Fold` 组件并按状态切换 |
| 原样式 `grid-column: 3; grid-row: 2; min-height: 100vh` 不适配 AI 模式的行内 flex | 由 `AiChatPanel` 用 `:deep(.ai-side-panel)` 覆盖定位与高度，不改面板内部实现 |

未新增任何 AI 动作；`sendChatMessage` / `confirmAiOperation` / `revokeAiOperation` / `cancelAiOperation`
在壳层与 manifest 中均无调用（测试断言）。

## 五、反测记录

1. 将 `admin-web/src/router/index.ts` 中 `dashboard` 的 `meta.roles` 临时从
   `["SUPER_ADMIN","STORE_MANAGER"]` 改为 `["SUPER_ADMIN"]`。
2. `node admin-web/tests/workbench-shell.spec.mjs` → **红**：
   `FAIL 角色可见性：STORE_MANAGER 只见授权项 … 22 !== 23`，`10 passed / 1 failed`。
3. 复原为 `["SUPER_ADMIN","STORE_MANAGER"]` 后复跑 → **绿** `11 passed / 0 failed`。
4. `git diff --numstat -- admin-web/src/router/index.ts` → `2 2`，仅根布局装配两行；
   角色映射行无差异（复原一致）。

## 六、约束核对

- 未接入 `/api/admin/menus/user`：壳层、manifest、路由与测试文件均无该调用（测试断言）。
- 未接入 AI 写动作：壳层只挂载现有对话面板，未调用任何确认/撤销/发送 API。
- 未新增后端表、未改业务页面、未改登录/注册页。
- 未 push、未开 PR；提交按文件 add。
