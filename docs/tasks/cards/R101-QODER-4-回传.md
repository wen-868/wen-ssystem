# R101-QODER-4-回传 · S3-239「未取到权限码」三态统一

> 回传人：**Qoder（移动端执行方）**｜回传日期：2026-10-18
> ⚠️ 本卡不含任何「凌舟裁定 / 验收结论」字样；裁定与合并由凌舟执行。
> 派单卡：`docs/tasks/inbox/QODER-4-权限三态统一.md`（口径源头 `docs/tasks/inbox/ACTIVE-S3-239.md`）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-4`｜分支 `feat/qoder-4-permission-tristate`

## 〇、基线与提交（含一处主动交代的偏离）

- **基线偏离（主动交代，依裁定③栈式先例）**：任务书基线写 `origin/main`，本分支实际**栈在卡 2 尖端 `3712721a`**（其上=卡 1 `cbca2c37` → #363 `3fa138e7` → main）。理由：判据 5 要求 `npm --workspace app-mobile run test`（test 门只存在于卡 1/2 线），且 ② 态「现状保持」的定义含卡 2 的 `pending-code` 恒隐藏口径——基于裸 main 两样都无法交付。若凌舟要求换基线：本单改动面与卡 1/2 的**冲突文件只有 `permission-gates.ts` 与 `usePermissionGate.ts` 两个**，卡 2 先合则本卡 rebase 一次即可（改动集中在文件头部注释与新增导出，可预期为机械冲突）。
- 分支提交（本地，**未 push / 未开 PR / 未 `git add -A`**）：
  - `42d64816` 实现 + 测试 + 反测与原始输出证据（20 files，+1706/−57）；
  - 本卡 + 回执为第二笔（哈希见 git log）。
- merge-base 核对：`git merge-base origin/main HEAD` = `3fa138e7`（证据 `docs/evidence/qoder-4/gates/backend-zero-diff.log`）。

## 一、交付物

1. **单一定义源（新增）**：`app-mobile/src/config/permission-view-state.ts` ——
   `resolvePermissionViewState({hasSession, requestState, permissions}) → {viewState, policy, showNotice, noticeText}`；
   零依赖纯函数 + 常量（不引 vue/pinia/uni，esbuild 打包后可被 Node 直接加载，装置即证据）。
   policy 四值：`showAllMinimal`（缓存/最小可见集）/ `hideNeedsCode`（失败关闭）/ `showGranted`（按真实码）/ `showAll`（**改造前旧语义，生产分支不返回，仅供反测注入**）。
2. **两端接线（同源）**：
   - `stores/menu.ts`：「null ⇒ 放全量」废止；① 请求在途**首帧即播种**缓存/最小集（`seedLoadingFallback`）；② 成功空集 ⇒ 空集失败关闭；③ 失败 ⇒ 有缓存按缓存 + stale 明示，无缓存 ⇒ 最小可见集 + 三态源提示 + 重试；新增 `dismissBanner()`（关闭只隐藏文案、不动集合，重新拉取自动复位）；
   - `config/permission-gates.ts`：新增 `isEntryVisible(entryId, query)` —— pending-code 短路**先于**三态（B3-1 保持）、无码入口（registered/未知 id）三态下**恒可见**、带码入口上送三态源分流；文件头「与 menu.ts 有意分叉」的口径段改为统一说明；`hasPermissionCodes` 的 null 分支保留为直接调用方兜底并注释了新旧语义关系；
   - `composables/usePermissionGate.ts`：只做**参数装配**（`requestState` = permissions 是数组⇒ok；缺失且 `initialized=false`⇒pending；缺失且已初始化⇒failed），`canEntry` 改走 `isEntryVisible`；导出 `viewState` 供页面可观测。
3. **提示 UI**：文案单源 `PERMISSION_UNAVAILABLE_NOTICE`（「权限信息未取到，已按最小可见集显示，请下拉刷新重试」）；经 `menuStore.bannerText` 渲染——`functions.vue` / `more-functions.vue` **已绑定** `bannerText`（既有 top banner，非阻塞式弹窗，本单零页面改动即可显示）。见 §五残留①（关闭 × 按钮）。
4. **测试**：`app-mobile/tests/permission-view-state.spec.ts` 26 用例（三态契约 / 最小集「非全量、非空」双向卡死 / 入口门三态 / menu store 三态真实渲染 / 两端同源静态断言 / showAll 生产不可达守卫）。
5. **反测装置**：`docs/evidence/qoder-4/tools/tristate-raw-output.mjs`（原始输出，含红线自检「最小集渲染=全量 ⇒ 装置 FAIL」）。

## 二、最小可见集逐项清单（任务书点名必交）

**菜单端 `MINIMUM_VISIBLE_MENU_CODES`（6 项，①③ 态、无缓存时渲染的页面 code）**：

| # | code | 页面 | 收入理由 |
|:--|:--|:--|:--|
| 1 | `report:dashboard` | 经营看板 | 报表域，只读 |
| 2 | `report:sales` | 销售报表 | 同上 |
| 3 | `report:inventory` | 库存报表 | 同上 |
| 4 | `report:purchase` | 采购报表 | 同上 |
| 5 | `report:customer` | 客户报表 | 同上 |
| 6 | `report:finance-report` | 财务报表 | 同上 |

- **首页/工作台**：不在菜单注册表里、**不走菜单 code 闸**（tabBar 无条件可达）——这是凌舟口径「首页/工作台为无码入口」的事实，本身构成「①③ 不隐藏整端」的保底，无需入常量。
- **兼容态前缀回落约束**（`function-menu.ts` `isPageVisible` 判定②会把**同前缀整域**放大）：只收「前缀域内全部页面均为只读」的域。因此**排除**：`goods:trace`（goods 前缀 ⇒ 带出库存/盘点/报损写页）、`sale:record`（sale 前缀 ⇒ 带出开单）、`system:operation-log` / `system:config`（system 前缀 ⇒ 带出设置写页）。待 S3-143 严格 code 口径落地后可回补——列为待裁定项③。
- 依据链：`R101-S3-136-F1-阿澈-可见性对照表.md`（页面全集 44 项与前缀回落语义）+ ACTIVE-S3-239 §一（首页/工作台无码事实）。
- 反红线自检：装置断言「渲染集合 =6 ≠ 全量 38 ≠ 空集」（`filterGroupsByCodes(null)` 渲染 38 页为全量口径对照；44 为注册表全集含 5 个 inProfile 项，两数口径不同勿混）。

**入口门端 `MINIMUM_VISIBLE_ENTRY_IDS`（当前 = 空集）**：

| 类别 | ①③ 态表现 | 理由 |
|:--|:--|:--|
| `registered` / 未登记（codes 空数组，9+ 条） | **可见** | 「无码入口」天然放行——首页快捷入口/扫码/孤岛登记页在此类，整端不空白 |
| `gated`（27 条） | **隐藏** | 全部是写入口，未取到码放出去必 403（S3-231 F3 精神保持）；不放行即空集 |
| `pending-code`（1 条） | **恒隐藏** | B3-1 短路先于三态，凌舟裁定 5 原样保持 |

往 `MINIMUM_VISIBLE_ENTRY_IDS` 加任何 id 须凌舟裁定（列入待裁定项④）。

## 三、判据逐项自评（全部有原始输出落盘）

| # | 判据 | 结果 | 证据 |
|:--|:--|:--|:--|
| 1 | ① 加载中 ⇒ 最小可见集（非全量非空）且无失败提示 | ✅ | `docs/evidence/qoder-4/三态原始输出/vitest-tristate-cases.log`（用例①：`visible.sort()==6 项`、`bannerText===''`）+ `tristate-raw-output.log` §一①行 |
| 2 | ② 成功 + `permissions=[]` ⇒ 需码菜单/入口全部不显示 | ✅ | 同上（用例②：`filterGroupsByCodes=0 组`；入口端②行 `gated=false pending-code=false`）|
| 3 | ③ 请求失败 ⇒ 最小可见集 + 提示出现 | ✅ | 同上（用例③：6 页 + `bannerText=PERMISSION_UNAVAILABLE_NOTICE`、`showRetry=true`）；raw 输出③行 `showNotice:true` |
| 4 | **反测**：三态源分支打回「null ⇒ 放全量」 ⇒ 用例 1/3 必红 | ✅ | `反测/injected-vitest-red.log`：**9 failed** 点名含「用例①」「用例③」「①加载中」「③未取到」；注入仅改 `permission-view-state.ts` 两行 3 处 return；`sha256-before.txt` = `sha256-restored.txt`（`317ff3df…c56c701a`，逐字节一致）；`post-restore-green.log` 53/53 EXIT=0。附带：装置注入态 `injected-tool-red.log` 亦红（EXIT=1） |
| 5 | vue-tsc 0 新增（0=0）；npm test 不劣化（5/53 ≥ 基线 4/27）；build:h5 EXIT=0 | ✅ | `gates/gate-type-check.log`、`gates/gate-test.log`（含 INFO：基线调高待办，见 §五残留②）、`gates/build-h5.log`（`BUILD_EXIT=0`） |
| 6 | 后端零改动（merge-base 口径） | ✅ | `gates/backend-zero-diff.log`：`git diff 3fa138e7..HEAD -- backend/` = **0 行**、`git status` backend 命中 0 |
| 7 | 既有门禁不回归 | ✅ | `gates/gate-lint.log`（error 20=20 / warning 12880=12880）、`gates/gate-check-contract.log`（EXIT=0）、`gates/guard-rbac-wiring-strict.log`（EXIT=0）；存量 12 条入口门一致性用例全过（三态未破坏 B3-1/pending-code 口径） |

三态各一条原始输出（摘自 `三态原始输出/tristate-raw-output.log`，逐字）：

```
① 加载中（有登录态，请求在途）  => {"viewState":"loading","policy":"showAllMinimal","showNotice":false,"noticeText":""}
② 确实无码（成功返回空数组）    => {"viewState":"empty","policy":"hideNeedsCode","showNotice":false,"noticeText":""}
③ 未取到（请求失败/超时）       => {"viewState":"unavailable","policy":"showAllMinimal","showNotice":true,"noticeText":"权限信息未取到，已按最小可见集显示，请下拉刷新重试"}
```

## 四、验收自评（对照任务书 §三 六条）

1~4 全绿且反测有分辨力（判据不是自证：注入旧语义 ⇒ 用例①③ 直接撞红并点名）；5 全绿；6 零行。**自评：判据全过**。
两点如实声明：① 浏览器级三态手测（真机/H5 下观察 banner 与菜单集合）不在本地证据内——依裁定⑤并入 H5 手动验收清单；② 本自评不是验收结论，合并决定权在凌舟。

## 五、未完成与阻塞

- **残留①（提示「可关闭」的页面侧）**：store 已提供 `dismissBanner()`，且提示文案经**既有** `bannerText` 绑定即可显示；但两页面上**没有 × 按钮**（加按钮是一行模板改动，页面文件不在本单红线允许面）。当前用户可感知的「消除」路径=重试成功/重新拉取后自动复位。→ 待裁定项①：批准后续小改在 `functions.vue`/`more-functions.vue` 各加一个 `@tap="menuStore.dismissBanner()"`。
- **残留②（`gates-baseline.json` tests 基线）**：实测已升 5 文件/53 用例，基线仍 4/27 ⇒ test 门绿但打 INFO「请同步调高」。`app-mobile/scripts/gates-baseline.json` 不在本单红线允许面，**未动**。→ 待裁定项②：随卡 1 合并由凌舟上调（或发一张一行改动小卡）。
- 无阻塞项。

## 六、风险与自我报备

1. **requestState 推导边界**：`fetchProfile` 非过期失败时 `initialized` 停在 false ⇒ 被当作 ① 态（最小集、**无提示**）而非 ③ 态。显隐结果与 ① 相同（gated 隐藏），只差提示可见性；根因在 `stores/user.ts` 不记失败态，本单红线不动该文件（已在 composable 头注释如实写明）。→ 待裁定项③。
2. **入口门 ①③ 与 ② 显隐结果相同**（最小集空集所致），差异在**语义与可观测性**（viewState 可被页面读取、③ 有提示）——不是漏接线：gated 全为写入口，任何态都不该在持码前显示。若产品认为 ① 态该宽于 ②，改 `MINIMUM_VISIBLE_ENTRY_IDS` 即可（单点、有测试卡死「不许混入 gated」）。
3. **`filterItemsByPermissionGate` 直接调用方**（功能中心页把裸 perms 传入）在 ①③ 下需码项隐藏（同 ② 结果）——该文件不在本单允许面，未动；静态断言只覆盖三个允许文件。
4. **基线偏离**（§〇）导致本分支必须**在卡 2 之后合并**；若卡 2 被回退，本卡需 rebase 重验。
5. 「最小可见集=6 页报表」偏保守：无缓存首启用户在 ① 态看得到报表但看不到销售/库存页（请求返回后自动恢复）——按口径表执行，非自拟；若产品反馈过窄，扩列入口是单常量改动（须凌舟裁定，前缀外溢风险见 §二约束）。

## 七、环境复原

- 反测注入已复原（SHA256 逐字节一致，见 `反测/sha256-*.txt`）；
- 注入用临时 esbuild 产物写系统 tmp 并由装置 finally 清理，仓内无残留；
- `git status` 干净（除本卡与回执两文件待提交）；未 push、未开 PR、无 `git add -A`、未动 origin/main 与其它工作树；
- node_modules 为指向主仓的**junction 链接**（仅本地装置运行用，不在 git 改动面）。

## 八、一行摘要

把「未取到权限码」的两套 null 语义收成一套：新增 `permission-view-state.ts` 三态单一定义源，菜单与入口门两端同源接线（① 首帧最小集不放全量、② 失败关闭保持、③ 最小集+可观测提示），26 条新用例 + 反测注入「放全量」必红（9 红点名、复原哈希一致），四道门/build:h5/后端零改动全绿。

## 九、待凌舟裁定项

1. 两页面补 `dismissBanner()` 的 × 按钮授权（本单红线外一行改动）；
2. `gates-baseline.json` tests 基线上调 5/53（随卡 1 或单发小卡）；
3. `stores/user.ts` 失败态记录（消除 §六.1 的 ①/③ 混淆边界）；
4. `MINIMUM_VISIBLE_ENTRY_IDS` / `MINIMUM_VISIBLE_MENU_CODES` 扩列裁定（含 S3-143 后回补只读页）；
5. 本分支基线偏离（栈在 `3712721a`）是否接受——接受则合并顺序：卡 1 → 卡 2 → 本卡。

## 十、依据卡

- 派单：`docs/tasks/inbox/QODER-4-权限三态统一.md`；口径源头：`docs/tasks/inbox/ACTIVE-S3-239.md`（凌舟三态表）；
- 分叉成因：`docs/tasks/cards/R101-S3-231-凌舟验收与裁定.md` §二.2（裁定 2 指向本单）；
- 最小可见集依据：`docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md`（页面全集 + 兼容态前缀回落）；
- 装置形态先例：`docs/evidence/S3-230/tools/`、`docs/evidence/S3-231/F3/tools/`（本单 `docs/evidence/qoder-4/tools/` 与其同精神：加载源码本体、不另写判定）；
- 栈式基线先例：`R101-QODER-1-回传.md` §〇 / `R101-QODER-2-回传.md` §〇（裁定③）。
