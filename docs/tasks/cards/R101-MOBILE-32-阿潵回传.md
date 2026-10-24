【汇报 MOBILE-32】403 按钮级权限预判与人工引导
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端前端 owner）｜2026-10-25
执行通道：WorkBuddy

## 交付物

| # | 交付物 | 文件路径 | 提交哈希 |
|:--|:--|:--|:--|
| 1 | **按钮门核心**：七态判定纯函数（复用 `matchPermissionCode` + `resolvePermissionViewState`，不自造码、不另立 null 语义） | `app-mobile/src/config/button-gates.ts`（新增 246 行） | `416ebf85` |
| 2 | composable 接线：`usePermissionGate()` 新增 `buttonGate(codes, cached?)` | `app-mobile/src/composables/usePermissionGate.ts` | `416ebf85` |
| 3 | 页面接线 9 个写按钮 / 3 页 | `transfer.vue`（新建+取消+提交+驳回+审核+发货+收货 7 个）、`receipts.vue`（作废）、`statements.vue`（确认） | `416ebf85` |
| 4 | 测试 +38 用例（18 文件 / 367） | `app-mobile/tests/button-gates.spec.ts`（23）、`app-mobile/tests/page-wiring.spec.ts`（15）、基线 `gates-baseline.json` 16/329 → 18/367 | `416ebf85` |
| 5 | 写操作权限矩阵 + 审计装置 + 后端码映射 + 全部 raw 证据 | `docs/evidence/mobile-32/01-写操作权限矩阵.md`、`tools/**`、`raw/**` | `416ebf85` |

工作树 `D:\Users\ZXQL\wt-agents\MOBILE-32`｜分支 `mobile/MOBILE-32-403-button-gates`｜基线 `243b78fe`。
改动面：`41 files changed, 4248 insertions(+), 16 deletions(-)`；**`backend/**`、`docs/migrations/**` 零改动**（已用 `git status --short -- backend docs/migrations` 验证为空）；未改 AI 工具、tabBar、登录注册页。

## 证据（可复跑）

### 1. 审计先行（卡 §三.1）
`node docs/evidence/mobile-32/tools/audit-write-actions.mjs` ⇒ `raw/01-write-action-audit.txt`
**写动作按钮 179 个 / 66 页**；开工时已门控 **11**、待修 **168**（62 页）。
口径：`<template>` 内 `@tap` 命中写语义词表；排除只读/导航/UI/认证语义；整页排除 `pages/login`、`pages/register`、`profile/change-password`、`components/**`（红线）。

### 2. 码来源（**不猜码**）
`node tools/backend-code-map.mjs` ⇒ `raw/02-backend-code-map.txt`：83 个路由文件有码、**36 码种 / 369 处** `requirePermission(...)` 实文。
矩阵每行码均引自实文；会员等级经查实为 `points.routes.ts` 的 `customer:level`（S3-231 F1 改挂；我最初误映射的 `member-level.routes.ts` **不存在**，已更正）。

### 3. 三条 mutation 点名红 + SHA256 复原（卡 §三.4）
`node tools/mutation-3x.mjs` ⇒ `raw/20-mutation-3x.txt`，`MUT_EXIT=0`：

| mutation | 注入 | 红 EXIT | 点名断言 | 复原 |
|:--|:--|:--|:--|:--|
| M1 删按钮门 | `gateCancel` 改成恒可用对象 | **1** | `缺少 gateCancel 声明: expected null to be truthy` | SHA 一致 |
| M2 null 改放行 | `codes` 空 ⇒ 返回 `allowed` | **1** | `expected 'allowed' to be 'blocked'` ×2 | SHA 一致 |
| M3 多按钮绑同码 | `gateReceive` 追加 `goods:edit` | **1** | `expected [ 'store:transfer', 'goods:edit' ] to deeply equal [ 'store:transfer' ]` + 跨域码断言 | SHA 一致 |

每条均：注入 ⇒ 红 ⇒ `git checkout` 复原 ⇒ **SHA256 与注入前逐字节一致** ⇒ 复绿 EXIT=0。

### 4. H5 三态运行态（卡 §三.7，**含防假绿前置**）
`node tools/h5-three-states.mjs` ⇒ `raw/44-h5-three-states.txt`：

```
[前置①] 有权限态渲染按钮数 = 1（hash=#/pages-sub/finance/transfer/transfer）
✓ 目标页已渲染按钮
=== 有权限（STORE_MANAGER 持 store:transfer）=== 写请求=0  「+ 新建调拨单」enabled op=1
=== 无权限（STORE_OPERATOR 不持）===              写请求=0  「+ 新建调拨单」DISABLED op=0.45
=== 权限失败（/auth/me 500）===                    写请求=0  「+ 新建调拨单」DISABLED op=0.45
[前置②] 有权限 disabled=0 / 无权限 disabled=1 ⇒ 差异=true
✓ 三态按钮状态有差异（权限接线生效）
H5_THREE_STATES_PASS（含前置①②）
```

真实 dev:h5 + 真实 Playwright + 真实桩后端；三态写请求均 **0**。

### 5. 门禁与构建
`npm run check:gates` ⇒ `raw/50-final-check-gates.txt` **EXIT=0**：type 0（基线 0）；lint error 0 / warning **12872 = 基线 12872（零劣化）**；**`Test Files 18 passed` / `Tests 367 passed`**（基线 18/367，较原 16/329 +38，无减少）；contract、guard A/B/C/D 全绿。
三端构建：`build:mp-weixin` / `build:h5` / `build:app` 均 **EXIT=0**（`raw/51,52,53`）。

### 6. 微信 preview：**BLOCKED（如实登记）**
`raw/43-wechat-preview-blocked.txt`：CLI 存在=True、`.cli` 内容 `3799`、**端口 3799 可连=False、IDE 进程数=0** ⇒ 与 MOBILE-28F1R1 同一阻断，preview 未执行。**不以构建 EXIT=0 代替**（红线）。

## 验收自评（逐条对照卡 §四 七条）

| 硬验收 | 自评 | 依据 |
|:--|:--|:--|
| 1 矩阵无未解释空缺（每项有码 / BLOCKED 理由 / 已覆盖证据） | **通过** | 矩阵 §三 9 项全有码；§四 BLOCKED 有理由+证据；§五 如实登记 159 项待修 |
| 2 可做页面不再"填完表单才 403"，403 只留兜底 | **部分通过（见"未完成"1）** | 已接线 9 按钮；`request.ts` 403 兜底保留（`page-wiring` 用例守护） |
| 3 三态与陈旧策略明确且测试覆盖；无权限/未取到时写请求为 0 | **通过** | 23 用例覆盖 loading/unavailable/stale/blocked/denied + 零调用断言；运行态三态写请求均 0 |
| 4 三条 mutation 点名红、复原 SHA256 一致、复绿 | **通过** | §3 表 |
| 5 `check:gates` EXIT=0、16/329 不减、三端构建、H5 三态 | **通过** | 18/367（+38）；三端 EXIT=0；H5 三态 PASS |
| 6 backend/迁移零改动；不改 AI/tabBar/登录注册 | **通过** | `git status` 验证为空；未触碰相关文件 |
| 7 工作树 clean、未 push、未开 PR、逐文件 add | **通过** | `git add` 逐文件；`git status` 空；无 upstream、远端无本分支 |

## 未完成与阻塞

1. **⚠️ 覆盖范围未达卡面要求（如实报备，不冒充完成）**：卡 §三.2 要求"至少覆盖矩阵里**所有**仍有未门控写动作的页面"，实际只接了 **9 个按钮 / 3 页**，**仍有 159 个按钮 / 约 60 页未门控**。原因：168 个按钮需逐端点取码 + 逐页过 lint 缩进，本单时间盒内只能完成优先域中**缩进风格与 lint 一致**的三页。主要剩余面见矩阵 §五（`product-detail.vue` 16、`create-sale.vue` 7、`member/address.vue` 7 等）。
2. **`expenses.vue` 登记 BLOCKED**：接线实现已验证有效（M1 mutation 用的就是它验证"删门必红"），但该文件整模板 2 空格缩进 vs lint 期望 4 空格 ⇒ 每加 1 行 DOM 必 +1 warning（实测 `raw/32`：82 → 83），与 warning 冻结基线冲突。已回退并登记，待「移动端模板缩进归一」立单。
3. **微信 preview BLOCKED**：IDE 服务端口 3799 未监听、GUI 无法启动（需具备可见桌面的操作者开端口）。
4. 陈旧缓存（stale）只在单测覆盖，**运行态未造**（需构造"上次有缓存 + 本次失败"的存储态，本单时间盒内未做）。

## 风险与自我报备

1. **两次假绿被我自己抓住并修掉（重要）**：
   - ① H5 三态 v1 报 `H5_THREE_STATES_PASS`，但真相是**页面停在登录页**（按钮是"登录/注册/演示登录"、hash 掉回 `#/`），"写请求=0"毫无意义。修法：加前置①"目标页必须渲染出写按钮"+ 前置②"三态 disabled 必须有差异"，并补 `/auth/login` 桩 + 注入后**重新加载**（App.vue 的 onLaunch 已判定无 token 并 reLaunch 到登录页）。v2 才是真通过。
   - ② 写请求计数最初把 CORS 的 **`OPTIONS` 预检**算成业务写（三态都"有 11 次写"）；已排除 `OPTIONS` 后才得到真实的 0。
2. **mutation M1/M3 起初注入点选错**：改 `.vue` 里的常量，而单测只测 `button-gates.ts` 纯函数 ⇒ 天然测不到 ⇒ "该红不红"。补 `page-wiring.spec.ts`（读源码静态断言页面接线）后 M1/M3 才真红。这说明"纯函数单测"不足以守页面接线。
3. **我在 lint 缩进上消耗了过多轮次**：`transfer.vue` 整文件 2 空格风格，新增行逐一对抗 `html-indent` 才把 warning 压回 12872。经验：**在该文件族里新增 DOM 行必须按 4 空格倍率写**，否则必然劣化基线。
4. **矩阵 §三 我把行号写作 `finetransfer/...`**（笔误，应为 `pages-sub/finance/transfer/transfer.vue`），已在矩阵正文其它处给出正确路径，以路径为准。
5. **审计器口径有边界**：handler 名 + 文案词表匹配，可能漏掉语义不典型的写按钮（如纯 `onConfirmSomething` 无中文文案），故 179 是**下界**，不是精确总数。
6. 未用 mock 权限永久替代真实登录态（三态取证是"桩后端 + 真实页面"，非改页面逻辑）；未禁用只读入口换测试通过（有专门用例守护）。

## 待裁定项

1. **是否继续铺满剩余 159 个按钮**：建议按域拆多单（商品域 16、销售域 7、客户域 7、门店域 6…），每单 ≤3 页以便过 lint 缩进与逐端点取码；否则单张卡无法在时间盒内完成。
2. **「移动端模板缩进归一」是否立单**：现有多页（`expenses.vue` 等）2 空格模板与 lint `html-indent: 4` 冲突，导致"每加一行即劣化基线"，这会**系统性阻塞**后续所有按钮级接线。建议优先立单统一缩进（一次重排，之后新增行零成本）。
3. **stale（陈旧缓存）运行态**是否需要补造：单测已覆盖，运行态需额外构造存储态脚本。

## 回传要求

本汇报已落卡 `docs/tasks/cards/R101-MOBILE-32-阿潵回传.md`

## 关联卡

`docs/tasks/inbox/MOBILE-32-403-button-gates.md`
