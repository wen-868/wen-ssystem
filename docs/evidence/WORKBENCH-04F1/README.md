# WORKBENCH-04F1 证据包 · 角色运行时集合 + 收银保底

基线：`84effa41651e832273d668fedf347906784031c1`
工作树：`D:\Users\ZXQL\wt-agents\WORKBENCH-04F1`
分支：`workbench/WORKBENCH-04F1-role-runtime-cashier`

## 一、驳回项与修复

| 驳回项 | 根因 | 修复 |
| --- | --- | --- |
| STORE_OPERATOR 收银 9 → 0 | 收银项被 `restrictManifestItems(...access.visibleRouteNames)` 套用了 `/menus/user` 交集；STORE_OPERATOR 业务路由为空，连带收银被清空 | 收银改由 `filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles)` 只按路由 `meta.roles` 保底；Shell 不再调用 `restrictManifestItems`（该函数保留为恒等实现以兼容既有调用点） |
| STORE_MANAGER 的 AI 对等为 8/27（服务端原始路由），角色实际 1/0 | `resolveMenuAccess` 只做「服务端 menuCode ∩ 静态白名单」一层裁剪，UI/对等直接消费该业务集合 | `resolveMenuAccess` 增加第二层「`auth.userRoles` + 路由 `meta.roles`」裁剪，`visibleRouteNames` 改为最终角色集；新增 `businessVisibleRouteNames` 仅用于诊断，不驱动任何 UI/对等 |

## 二、代码改动（3 个文件，+192/−35）

| 文件 | 改动 |
| --- | --- |
| `admin-web/src/shared/workbench/menu-access.ts` | 输入新增 `userRoles` / `resolveRoles`；`Snapshot` 新增 `businessVisibleRouteNames`；ready 分支两层裁剪（无角色/无解析器 → 最终集为空，fail-closed）；notice 增补「业务层命中但角色无权」文案；`restrictManifestItems` 改为收银保底恒等实现 |
| `admin-web/src/layouts/WorkbenchShell.vue` | `resolveMenuAccess` 传入 `auth.userRoles` + `resolveRoles`；`visibleRouteNameList` 取最终角色集（人工侧栏、AI rail、AI 代办按钮、`projectParityRuntime` 共用）；收银改 `filterVisibleItems`，菜单 loading/error 时不清空 |
| `admin-web/tests/menu-ai-bridge.spec.mjs` | 既有断言补传角色上下文（与守卫同一语义）；新增 6 条 F1 用例（收银 9/9 两态、业务集合 8 与角色集 1 分离、SUPER_ADMIN 不回退、非超管看不到无权动作、无角色 fail-closed、源码护栏） |

数据口径（`runtime-role-probe.mjs` 实测）：

- 业务集合（服务端 menuCode ∩ 白名单）= **8**（`system`、`finance:expenses` 白名单缺失，登记 unroutable）
- SUPER_ADMIN：可见 8 路由 → 对等 **8/27**
- STORE_MANAGER：可见 1 路由（`dashboard`）→ 对等 **1/0**，收银 **9**
- STORE_OPERATOR：可见 0 路由 → 对等 0/0，收银 **9/9**（菜单 ready 与 error 两态均为 9）
- 无角色上下文：业务集合仍为 8（仅诊断），最终集为空（fail-closed，不回退全量）
- 静态台账不参与运行时裁剪：人工 80/80、动作 254/254、四态 26/0/213/15

## 三、证据复跑

```powershell
# 角色运行时探针（显式传參角色，本包新增）
node docs/evidence/WORKBENCH-04F1/runtime-role-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-04F1
# 凌舟验收探针（只读，位于主仓）
node D:\Users\ZXQL\ZXQL-MS\wen-ssystem\docs\evidence\WORKBENCH-04\凌舟验收-20261023\runtime-permission-probe.mjs D:\Users\ZXQL\wt-agents\WORKBENCH-04F1

cd D:\Users\ZXQL\wt-agents\WORKBENCH-04F1
npm --workspace admin-web run test          # 96 passed / 0 failed（既有 90 条一条未减）
npm --workspace admin-web run build:check   # EXIT=0
npm --workspace admin-web run build         # EXIT=0
```

原始输出：

- `role-probe.log`（本包探针）：`{"businessVisible":8,"storeOperator":{"cashierBeforeMenu":9,"cashierAfterMenu":9,"cashierOnMenuError":9,"visibleRoutes":[],...},"storeManager":{"visibleRoutes":["dashboard"],"cashier":9,"parityManual":1,"parityActions":0},"superAdmin":{"parityManual":8,"parityActions":27},"noRoles":{"businessVisible":8,"visibleRoutes":[]},"staticLedger":{"manualCovered":80,"manualTotal":80,"actionCovered":254,"actionTotal":254},"pass":true}`，`EXIT=0`
- 凌舟探针：`{"serverVisibleRoutes":[],"storeOperatorCashierBefore":9,"storeOperatorCashierAfter":9,"storeManagerRoleRoutes":[],"rawParityManual":0,"roleParityManual":0,"rawParityActions":0,"roleParityActions":0,"pass":true}`，`EXIT=0`
- `test-final.log`：小结 `3 / 30 / 11 / 12 / 16 / 24`，合计 **96 passed / 0 failed**
- `buildcheck.log` / `build.log`：均 `# EXIT=0`

## 四、反测（mutation，点名变红后复原并校验 SHA256）

| 用例 | 篡改 | 变红断言 | 结果 |
| --- | --- | --- | --- |
| A | `restrictManifestItems` 改回按 `/menus/user` 过滤 | `【F1】STORE_OPERATOR：收银 9/9（菜单 ready 与 error 两态），业务路由为空 ← ready 态收银必须保持 9 项`；凌舟探针 `storeOperatorCashierAfter: 0 / pass:false` | 23 passed / 1 failed（`redtest-a.log`） |
| B | Shell 的 `visibleRouteNameList` 改取 `businessVisibleRouteNames` | `【F1】源码护栏 ← AI 容器集合必须取自最终角色集` | 23 passed / 1 failed（`redtest-b.log`） |

复原校验：

- `menu-access.ts` SHA256 = `751788344B57192335E34594A80DD00A389BAC648479AB58D0D6D654BEA4ECA6`
- `WorkbenchShell.vue` SHA256 = `B85DAF49DB875D298D3EE4D5A13030FB27CBFDD38A8F5CBD834939AC85AB8D1E`

## 五、口径说明与已知风险

1. **凌舟探针为何仍为 0/0 且 pass=true**：其脚本未传 `userRoles`，`resolveMenuAccess` 在无角色上下文时对角色层 fail-closed（`serverVisibleRoutes=[]`），故 raw/role 对等计数同为 0/0。这只证明「不越权」，不能证明角色实际数值；真实数值由本包 `runtime-role-probe.mjs` 显式传角色证明（9/9、1/0、8/27）。
2. **业务集合不再直接驱动 UI**：`businessVisibleRouteNames` 仅用于诊断/notice；源码护栏断言 Shell 与 AI 容器不得引用该字段（反测 B 守护）。
3. **收银不受菜单影响**：菜单 loading/error/空集时收银导航仍按 `meta.roles` 展示（STORE_OPERATOR/STORE_MANAGER 均 9 项）。这是对 04 驳回项的直接修复，也意味着收银可见性完全依赖前端静态 `meta.roles`，与服务端菜单授权脱钩 —— 若后续要求「服务端可收回银入口」，需另立卡引入菜单码。
4. **`system`、`finance:expenses` 仍 unroutable**：白名单无对应路由，维持 04 轮已报备的已知风险。
5. **工作树依赖**：无独立 `node_modules`，通过目录联接复用主仓（被 `.gitignore` 忽略，不入库）。
