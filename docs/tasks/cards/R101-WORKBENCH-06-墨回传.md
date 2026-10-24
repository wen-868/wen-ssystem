# R101 · WORKBENCH-06 墨回传 —— 工作台原型结构与视觉对齐

```text
【汇报 WORKBENCH-06】工作台原型结构与视觉对齐
汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-24
执行通道：WorkBuddy
交付物：见 §一（11 项，含分支 + 提交哈希）
证据（可复跑）：见 §三（命令 + 原始输出 + 行号 / 文件路径）
验收自评：见 §四（逐条 通过/未通过 + 依据）
未完成与阻塞：见 §五
风险与自我报备：见 §六
回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-06-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-06-prototype-structural-parity.md
```

> 依据卡：`docs/tasks/inbox/WORKBENCH-06-prototype-structural-parity.md`（派单人：凌舟｜2026-10-24）
> 上游纠正：`docs/tasks/cards/R101-WORKBENCH-05-凌舟复核纠正-20261024.md` §二/§三/§四
> 基线：`11aeda17f7927572c2933b85d0d653e0f39bf031`（＝ WT-05 尖端）
> 分支：`workbench/WORKBENCH-06-prototype-parity`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06`
> 权威原型 SHA256（脚本每次运行前校验）：`6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51`

---

## 一、交付物

| # | 交付物 | 路径 | 动作 |
|--:|:--|:--|:--|
| 1 | 壳层重构（三段式：rail \| 第二列 \| main；默认 feed 主面；底部输入区；顶部 Agent 状态 + 收银胶囊） | `admin-web/src/layouts/WorkbenchShell.vue` | 重写（+599/−243 中含本文件 804 行变更） |
| 2 | **第二列上下文导航**（品牌 / 新对话 / 二级目录网格 / 账户区 / 可收起） | `admin-web/src/layouts/WorkbenchSubnav.vue` | 新增 |
| 3 | **顶部 Agent 状态区**（会话通道状态 + 待审阅数 + 能力台账入口） | `admin-web/src/components/workbench/AgentStatusBar.vue` | 新增 |
| 4 | **AI 信息流主面**（真实业务动态 + AI 待审阅 + 快速入口 + 真实推送状态） | `admin-web/src/components/workbench/AiFeedView.vue` | 新增 |
| 5 | **底部固定 AI 输入区**（人工页收为 compact 条） | `admin-web/src/components/workbench/AiChatComposer.vue` | 新增 |
| 6 | 默认主面口径：`human` → **`ai`（feed）** + 注释留痕 | `admin-web/src/shared/workbench/shell-mode.ts` | 修改（+27/−9） |
| 7 | 结构断言（10 条） | `admin-web/tests/prototype-parity.spec.mjs` | 新增 |
| 8 | 反测装置（4 条注入 → 点名红 → 逐字节复原） | `admin-web/tests/prototype-parity-countertest.mjs` | 新增 |
| 9 | 测试链串入新 spec | `admin-web/package.json` | 修改（+1 行） |
| 10 | 默认模式口径变更断言（留痕，非静默改） | `admin-web/tests/workbench-shell.spec.mjs` | 修改（+9/−4） |
| 11 | 证据包（README + 取证脚本 + 9 份日志/说明 + 4 份报告 + 11 张截图 + 1 份反测记录） | `docs/evidence/WORKBENCH-06/**` | 新增 |

**提交**：`ad1679e2cced3974e5fbc95887f4067ddaab04d5`（父提交 `11aeda17` = 派单基线）。
逐文件 `git add`（15 源码/测试/文档 + 32 证据文件），**未用 `git add -A`**；见 §七。

## 二、改动面

```
 admin-web/package.json                       |   2 +-
 admin-web/src/layouts/WorkbenchShell.vue     | 804 +++++++++---------
 admin-web/src/shared/workbench/shell-mode.ts |  27 +-
 admin-web/tests/workbench-shell.spec.mjs     |   9 +-
 4 files changed, 599 insertions(+), 243 deletions(-)
新增（未跟踪→已提交）：WorkbenchSubnav.vue、AgentStatusBar.vue、AiFeedView.vue、
                      AiChatComposer.vue、prototype-parity.spec.mjs、
                      prototype-parity-countertest.mjs、docs/evidence/WORKBENCH-06/**
```

**未动**：`admin-web/src/views/**`（零改动，见 §三.5 亲验）、`backend/**`、`app-mobile/**`、`saas-admin/**`、
`docs/migrations/**`、`.github/**`、既有 6 个 spec（`role-guard`/`landing`/`ai-primary`/`parity-coverage`/
`menu-ai-bridge`/`rollout-rollback`）。

### 2.1 能力保留（未为视觉削弱任何一项）

| 能力 | 保留方式 | 证据 |
|:--|:--|:--|
动态菜单 fail-closed | `fetchUserMenus` → `resolveMenuAccess` → `restrictManifestGroups` 全保留；故障/空集/加载三态在原位 | 结构断言 §三.1 第 10 条 + `menu-fault` 5/5 |
角色裁剪 | `userRoles: auth.userRoles` + `meta.roles` 同源；收银 9 项按 `meta.roles` 保底、不吃菜单交集 | 同上 + 114 条测试含 71/23/0 与收银 9 |
AI 故障回退 | `AiChatPanel` 的 `@fallback="switchMode('human')"` 保留；`router-view` **无条件渲染**（不包 v-if） | `ai-primary.spec` 11/11 + `ai-fault` 5/5 |
灰度/回滚 | `wb.shell.v2`（运行时）+ `VITE_WORKBENCH_SHELL_V2`（构建级）双开关；`<MainLayout v-if="!shellEnabled" />` 分支保留且互斥 | `rollout-rollback.spec` 8/8（含 1→0→1→0 四连切） |
能力台账（WT-03/03F1 全量） | `AiFeedContainer` **组件与数据一字未删**，改为抽屉承载（顶栏「能力台账」入口） | `ai-primary.spec` 12/12 + `parity-coverage.spec` 16/16 |
收银 9 项 | `visibleCashierItems` 与胶囊「收银台」→ `/pos/dashboard` | `normal` 阶段收银往返通过 |

## 三、证据（可复跑）

全部原始输出落盘于 `docs/evidence/WORKBENCH-06/logs/`（零输出日志均配 `.note.txt` 说明命令/退出码/为何零输出）。

### 3.1 结构断言（10 条，对应卡 §二.4）

```
$ node admin-web/tests/prototype-parity.spec.mjs
PASS  一级 rail：常驻图标栏存在且含工作台项 + 模块项循环 + 设置固定底部
PASS  第二列导航：Subnav 被装配 + 含新对话/二级目录/账户区/可收起
PASS  Agent 状态区：装配于顶栏且含会话状态 + 待审阅 + 台账入口
PASS  主面三层：feed 默认 + chat + manual（router-view 常驻）
PASS  底部输入区：Composer 常驻 + 人工态 compact + 发送经统一链
PASS  工作台/收银台胶囊：mode-seg 双向 + desk/pos 两项
PASS  旧壳回退：MainLayout v-if=!shellEnabled 分支保留且互斥
PASS  无 mock：新面组件零原型数据层/随机/示例数据（红线：不用原型 mock）
PASS  真实数据源：feed 走 /admin/wb-notifications，待审阅走 /api/chat/confirmations
PASS  能力保留锚点：菜单 fail-closed / 角色裁剪 / AI 故障回退 / 收银保底未被破坏
小结：10 passed / 0 failed   （EXIT=0）
```
原始：`logs/10-structure-spec.log`

### 3.2 反测（卡 §三.5 四条，缺一即未验收）

```
$ node admin-web/tests/prototype-parity-countertest.mjs
基线 SHA256(WorkbenchShell.vue) = FCDF91B39A46FE93DF7069975361F87E0676FCB0C783BD63505E99D868FDAA9E

[反测 A-remove-rail]          注入后 EXIT=1，FAIL 点名「一级 rail 结构缺失」      复原 SHA 与基线一致=true
[反测 B-remove-second-nav]    注入后 EXIT=1，FAIL 点名「第二列导航结构缺失」      复原=true
[反测 C-remove-composer]      注入后 EXIT=1，FAIL 点名「底部输入区结构缺失」      复原=true
[反测 D-remove-fallback]      注入后 EXIT=1，FAIL 点名「旧壳回退结构缺失」        复原=true
复原后复跑：EXIT=0（10 passed / 0 failed）
全部反测通过：4/4 点名变红 + 4/4 逐字节复原 + 复原后回绿
```
原始：`logs/70-countertest.log`；表格式记录：`redtest/prototype-parity-countertest.md`

### 3.3 门禁四项

| 门禁 | 命令 | 读数 | 原始 |
|:--|:--|:--|:--|
全量测试 | `npm test --prefix admin-web` | **114 passed / 0 failed**（既有 104 条一条未减 + 新增 10 条），EXIT=0 | `logs/20-npm-test.log` |
类型 | `vue-tsc -b admin-web/tsconfig.json --force` | **EXIT=0**，零输出 | `logs/30-vue-tsc.log`（+`.note.txt`） |
lint | `eslint admin-web/src/` | **EXIT=0**，0 error 0 warning，零输出 | `logs/31-eslint.log`（+`.note.txt`） |
构建 | `vite build --config admin-web/vite.config.ts admin-web` | **EXIT=0**，✓ built in 1m 9s | `logs/40-build.log` |

`npm test` 各 spec 分布：3 / 30 / 11 / 12 / 16 / 24 / 8 / 10 = **114**。

### 3.4 运行态三态（卡 §二.5、§三.2）

| 态 | 结果 | 关键读数 | 原始 |
|:--|:--|:--|:--|
**normal** | **15 passed / 0 failed** | 真实登录 200；rail=64px / 第二列=231px / Agent 区=164px / 输入区 h=92px；**默认主面 feed=true chat=false**；旧壳未渲染；`/menus/user` 真实 200 空集 ⇒ fail-closed 空态可见；「新对话」→ chat；rail 工作台→feed；胶囊收银→`/pos/dashboard` 人工面可见；胶囊工作台→`/dashboard` | `logs/50-runtime-normal.log`、`reports/normal.json`、`screenshots/normal-*.png` |
**menu-fault** | **5 passed / 0 failed** | 真实 `net::ERR_CONNECTION_REFUSED`（停 8080 后端）；故障横幅（role=alert+重试）可见；**不回退全量**（第二列 0 项）；rail/输入区仍可用 | `logs/52-runtime-menu-fault.log`、`reports/menu-fault.json`、`screenshots/menu-fault-1440.png` |
**ai-fault** | **5 passed / 0 failed** | 真实 3016 拒连/CORS 失败；故障横幅出现；一键切人工按钮 1 个；点击后人工面 router-view 可用 | `logs/51-runtime-ai-fault.log`、`reports/ai-fault.json`、`screenshots/ai-fault-1440.png` |

### 3.5 同尺寸原型/实现对照（卡 §二.3、§三.1）

```
$ node docs/evidence/WORKBENCH-06/runtime-parity.mjs prototype
PASS  原型文件 SHA256 与冻结值一致
PASS  1280px 原型：rail/side/top/feed/input 五区齐备   ← rail {w:60} / side {w:230}
PASS  1280px 实现：rail/second-nav/top/feed/composer 五区齐备 ← rail {w:64} / second {w:231}
PASS  1280px 两列布局一致（rail 差 ≤8px，side 差 ≤30px）
PASS  1280px 底部输入区：实现精确贴底 + 原型信息流态输入区贴 .main 底 ← 实现 708+92=800
PASS  1280px 原型加载无 pageerror  ← 0 条
（1440 / 1920 同构成对通过）
小结：16 passed / 0 failed   （EXIT=0）
```
原始：`logs/60-prototype-parity.log`；结构化几何：`reports/prototype-parity.json`；
截图（同尺寸成对）：`screenshots/prototype-{1280,1440,1920}.png` 与 `screenshots/impl-{1280,1440,1920}.png`

**几何对照表**

| 宽度 | rail 原型/实现 | 第二列 原型/实现 | 实现输入区 |
|--:|:--|:--|:--|
| 1280 | 60 / **64** | 230 / **231** | 708+92=800（贴底） |
| 1440 | 60 / **64** | 230 / **231** | 808+92=900（贴底） |
| 1920 | 60 / **64** | 230 / **231** | 988+92=1080（贴底） |

### 3.6 业务冻结面亲验（卡 §四）

```
$ git diff --name-only d7e7cc6e... -- admin-web/src/views backend   → （零输出）
$ git diff --name-only 6b0a87c3... -- admin-web/src/views backend   → （零输出）
$ git status --short -- admin-web/src/views backend                 → （零输出）
```
⇒ `views/**` 与 `backend/**` 相对**两个**基线（WT-02 与 WT-05）均零改动。

> ⚠️ 说明：`ai-primary.spec` 与 `parity-coverage.spec` 内有 2 条用例用
> `execSync("git diff …")` 断同一事实。本沙箱该子进程曾被拦（`spawnSync cmd.exe EPERM`），
> 故那两次运行此 2 条曾报 FAIL；**未修改测试去"洗绿"**，改为由我以上命令亲验并记入本卡
> （用户已将 file policy 放开后，本轮最终运行的 `logs/20-npm-test.log` 中**该 2 条已恢复 PASS**，
> 114/114 全绿即为最终读数）。

### 3.7 运行态发现并修正的真实缺陷（过程留痕）

| # | 缺陷 | 发现方式 | 修正 |
|--:|:--|:--|:--|
1 | **主面三层非互斥**：`feed` 层条件缺 `effectiveMode === 'ai'` ⇒ feed 与 manual 同时 `shown`，业务页盖住信息流（首版截图可见） | `normal` 阶段首轮截图 + 播放几何探针 | feed/chat 层加 `effectiveMode === 'ai'` 条件（并写入模板注释说明为何必须互斥） |
2 | **空菜单空态永不触发**：`visibleEntryCount` 把收银 9 项计入，而收银项按设计不吃菜单交集 ⇒ 空菜单时总数恒 ≥9，fail-closed 的"明示无可见菜单"承诺落空 | `normal` 阶段 `menuEmpty=false` 失败 | 拆分 `visibleBusinessEntryCount`（只算业务项）用于空态判定；删除因此未使用的旧 computed |
3 | **默认主面仍是人工**：`workbenchMode` 默认 `human`（WT-02 遗留偏差） | 修正第 1 项后 `feed=false` 暴露 | 默认改 `ai`（信息流）；`shell-mode.ts` 与 `workbench-shell.spec` 双处注明依据；旧断言按新口径更新并留痕 |
4 | `PARITY_ACTION_ROWS` 死导入（HEAD 既有） | ESLint warning | 本次重写已无引用，移除 |

## 四、验收自评（逐条对卡）

| 卡内硬验收 | 自评 | 依据 |
|:--|:--|:--|
**1. 1440px 截图结构与原型逐项对齐；差异清单必须有凌舟裁定** | **通过（结构）/ 差异待裁定** | 五区几何逐项对照（§3.5）；11 张截图；**差异清单 D-1~D-6 见 §六.1 全部提请裁定**，未自行裁定 |
**2. AI 信息流、AI 会话、人工工作台首页、收银台四态均可操作** | **通过** | normal 阶段：feed 默认可见 → 「新对话」切 chat → rail 回 feed → 胶囊进 POS（人工面）→ 胶囊回工作台（§3.4） |
**3. 现有登录/动态菜单/角色权限/AI 故障回退/收银9项/旧壳回滚不回退** | **通过** | 114/114 测试（含 71/23/0 裁剪、收银 9、灰度 1→0→1→0）；三态运行态分别验证菜单失败、AI 故障、收银往返 |
**4. 现有测试不减少，build:check / build EXIT=0** | **通过** | 既有 7 个 spec 一条未减（3+30+11+12+16+24+8=104）+ 新增 10 = **114**；`vue-tsc -b --force` EXIT=0；`vite build` EXIT=0（`build:check` 等价两段均已单独 EXIT=0） |
**5. 反测：删除 rail/第二列/输入区/回退分支 ⇒ 对应测试必须点名变红** | **通过** | 4/4 点名变红 + 4/4 逐字节复原 + 复原回绿（§3.2） |
**6. 工作树 clean、未 push、未开 PR、逐文件 add** | **通过** | 提交后 `git status` clean；未 push（`git ls-remote` 无此分支）；逐文件 `git add`（§七） |

卡 §二 交付物：
1. ✅ 按原型重构 Shell + 新增 4 个导航/容器组件；`views/**` 零改动（§3.6）
2. ✅ 动态菜单/角色裁剪/AI 故障回退/灰度/构建级回退全保留（§2.1）
3. ✅ 同尺寸截图对照 1280/1440/1920 + AI 信息流 + AI 会话 + 人工页 + 收银台（§3.4/3.5）
4. ✅ 结构断言 10 条（§3.1）
5. ✅ 运行态三态（§3.4），**零原型 mock 数据**（结构断言第 8 条代码区扫描 + 第 9 条真实端点）
6. ✅ 证据 `docs/evidence/WORKBENCH-06/**`；回传卡本文件

## 五、未完成与阻塞

**无阻塞项。** 以下为**未验项**（如实登记，不降级为已验，详见 `docs/evidence/WORKBENCH-06/README.md` §7）：

1. **非空业务菜单的运行时渲染**：需真实 MySQL + 角色/菜单行；本轮 mock DB 下 `/menus/user` 真实返回空集 ⇒ 第二列与 rail 模块项运行态均为 0（fail-closed 的真实表现）。非空场景由单测覆盖（12 组/71 项、8 码裁剪、71/23/0 角色可见性），**不声称运行态已验证**。
2. **角色化运行态**（STORE_MANAGER / STORE_OPERATOR 浏览器渲染）：未做，仅单测覆盖。
3. **AI 正常在线会话**（3016 已启动的真实问答链路）：本轮未启底座，只验故障态。
4. **Electron 客户端**、**1280 以下宽度 / 移动 H5**：不在本卡范围。
5. **AI 主动推送**：WS 未连（界面如实显示「推送离线（不影响人工操作）」），未验实推。

## 六、风险与自我报备

### 6.1 差异清单（**六条全部提请凌舟裁定**，我不自行裁定）

| # | 差异 | 原型 | 实现 | 依据／待裁定 |
|--:|:--|:--|:--|:--|
| **D-1** | 第二列「员工/对话切换」「会话列表」 | 有（`.sess-list` + tab） | **未实现** | AI 底座**无历史会话列表端点**（`/api/chat` 只有单轮 `conversationId`）。按红线不得用原型 mock ⇒ 只做「新对话」+ 实时会话。**请裁定**是否另立单要底座补 `GET /api/chat/conversations` |
| **D-2** | 顶部「数字员工 12/14 在线」「任务进度 2/5」 | 有 | **未实现** | 能力台账 `ai-06`（Agent 任务通道）= **PLANNED**，无真实端点。`AgentStatusBar.vue` 内已注明为何不渲染；改为显示真实可得的两项：会话通道状态 + 待审阅数（`/api/chat/confirmations`） |
| **D-3** | 信息流「事件流 + 6 节点订单跟踪进度条」 | 有（FEED 6 条占位） | **改为真实业务动态** | 接 `GET /admin/wb-notifications`（与消息中心同源）+ `fetchAiConfirmations` + 真实 WS 刷新；订单跟踪需底座 feed 端点（`ai-03`=PLANNED） |
| **D-4** | 人工页下输入区 | `display:none`（原型 L1990） | **保留 compact 输入条** | 派单卡 §一.5 明写「进入人工业务页时仍可保持 AI 协同入口」⇒ 有意差异 |
| **D-5** | rail 宽度 | 60px | **64px** | 中文 4 字标签可读性；判据允许差 ≤8px |
| **D-6** | 设置入口 | 设置大弹窗（5 tab） | **跳 `/system` 页面** | 原型设置弹窗内含原型 mock 的连接信息；现有 `/system` 已具备配置能力，不重造。**请裁定**是否另立单做设置弹窗 |

### 6.2 自我报备

1. **口径变更（已留痕，非静默）**：`workbenchMode` 默认由 `human` 改为 `ai`（信息流），并同步更新 `workbench-shell.spec.mjs` 的 1 条断言。依据 = 原型 `mainMode='feed'`（paintMain L2061）+ WT-06 卡 §一.4 + 纠正卡 §三.1。旧断言原文与依据均写入测试文件注释与 `shell-mode.ts` 头注释，**未删除旧口径痕迹**。
2. **主面三层互斥是本轮自造的真缺陷**：首版把 `feed` 层条件写成 `face === 'feed' && !isCashierRoute`，漏掉 `effectiveMode === 'ai'`，导致业务页盖住信息流。是**运行态截图**发现的，不是测试发现的——说明结构断言不覆盖"层叠可见性"，已补模板注释说明为何必须互斥（但未新增自动化断言，如果凌舟认为该补，我加）。
3. **`visibleEntryCount` 拆分是行为修正**：空态判据从"业务+收银"改为"仅业务"，属于 fail-closed 语义的**修正**（旧写法让空态永不出现）。已删掉因此未使用的旧 computed，无遗留死代码。
4. **反测装置会临时改写源文件**：`prototype-parity-countertest.mjs` 注入违规后**逐字节复原并校验 SHA256**（4/4 一致）。该脚本会写 `WorkbenchShell.vue`，**不宜并入 `npm test`**（已确认未串入，仅在需要时手跑）。
5. **`Test-NetConnection` 对 8080 有假阳性**：本轮为制造 menu-fault 真实失败态，先后 3 次误判"端口仍开"。最终改用 `Get-NetTCPConnection -LocalPort 8080` 取 PID + `taskkill` 才真正停掉（原文与 PID 见对话留痕）。教训：**判端口用真实 HTTP 探针或 `Get-NetTCPConnection`，不用 `Test-NetConnection -InformationLevel Quiet`**。
6. **未修改任何 `views/**` 业务页**：按要求"不重做页面内部"。第二列点击仅 `router.push` 既有路由。
7. **能力台账改抽屉是形态变更**：WT-03/03F1 的 `AiFeedContainer` 数据与组件**一字未删**，只换了承载方式（顶栏「能力台账」入口打开）。若凌舟认为应保持独立页，我可改回并调整主面。

## 七、提交与分支（未 push、未开 PR）

```
$ git log --oneline -3
ad1679e2 feat(workbench): WORKBENCH-06 壳层按原型重构（rail/第二列/Agent 状态/信息流主面/底部输入区）
11aeda17 docs(workbench): 落 WORKBENCH-05 墨回传卡     ← 派单基线
eef659fe test(workbench): 补 WORKBENCH-05 全量回归…

$ git rev-parse HEAD
ad1679e2cced3974e5fbc95887f4067ddaab04d5

$ git status --short --branch
## workbench/WORKBENCH-06-prototype-parity            ← clean（无未提交改动）

$ git ls-remote origin workbench/WORKBENCH-06-prototype-parity
（空输出 ⇒ 远端无此分支 ⇒ 未 push）
```

逐文件 `git add`（**未用 `git add -A`**）：10 个源码/测试/配置 + 1 个回传卡 + 1 个在办卡 + 33 个证据文件。
工作树 `D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06`｜分支 `workbench/WORKBENCH-06-prototype-parity`。

## 八、环境复原

- 已停：mock 后端（8080，PID 2172 已 taskkill）、vite preview（4173，见 job 记录）；
- 未提交产物：`admin-web/dist/`（`.gitignore` 忽略）、会话缓存（系统临时目录 `wb06-session.json`，不入库）；
- 已删：诊断脚本 `_diag*.mjs`、运行日志 `parity-run.log`/`menu-fault-run.log`/`preview-4173.log`/`backend-8080.log`、临时探针 `probe-spawn.mjs`/`probe-inherit.mjs`（均在工作树外或已清理）；
- 反测注入：4 次全部逐字节复原（SHA256 见 `redtest/prototype-parity-countertest.md`）。

---

派单人：凌舟（总负责人）｜2026-10-24
汇报人：墨（工作台负责人）｜2026-10-24
