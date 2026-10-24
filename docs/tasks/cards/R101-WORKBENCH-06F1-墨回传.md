# R101 · WORKBENCH-06F1 墨回传 —— AI 状态真实性与 Agent 顶部数据

```text
【汇报 WORKBENCH-06F1】AI 状态真实性与 Agent 顶部数据
汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-25
执行通道：WorkBuddy
交付物：见 §一（11 项，含路径 + 提交哈希）
证据（可复跑）：见 §三（命令 + 原始输出 + 文件路径）
验收自评：见 §四（逐条 通过/未通过 + 依据）
未完成与阻塞：见 §五
风险与自我报备：见 §六
回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-06F1-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-06F1-agent-status-real-endpoints.md
```

> 上游驳回：`docs/tasks/cards/R101-WORKBENCH-06-凌舟验收与裁定-20261024.md`（B1/B2/B3）
> 基线：`20fdd794b577b3665ba99c42fd3c1ac80f3f2a2c`｜分支：`workbench/WORKBENCH-06F1-agent-status-truth`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F1`｜原型 SHA256：`6A2724A6…C30C51`（脚本每次校验）

---

## 〇、三条驳回的处置（结论先行）

| 驳回 | 处置 | 运行态证据 |
|:--|:--|:--|
| **B1 假绿** | 五态状态机 + 真实 `GET /api/health/ready` 探针；**只有 ready 才绿** | AI 可达：点 `rgb(22,163,74)` **绿**；AI 不可达：点 `rgb(220,38,38)` **红**（computed 值，非源码推理） |
| **B2 前提证伪** | 真实接 `GET /api/ai/employees` + `GET /api/ai/agent/plans`；两源独立降级；**不编造分母**（无 online 字段 ⇒ 只写「N 人就绪」）；`ai-06` 文案改为真实情况（保持 PARTIAL） | 运行态两请求**均真实发出**；401 时 UI 独立「未知」、无假 0 |
| **B3 截图无效** | 等原型自检收口 → 调其 `closeSet()` → 复验 setwin/mask/toast 全不可见 → 再截图；实现切到**同一主面**成对 | 3 宽度 `setwin=false/mask=false/toast=0`；另补四态 |

## 一、交付物

| # | 交付物 | 路径 | 动作 |
|--:|:--|:--|:--|
| 1 | **AI 就绪状态机**（`unchecked/checking/ready/degraded/error`；探针双信号；并发去重；60s 冷却；超时） | `admin-web/src/shared/workbench/ai-readiness.ts` | 新增 |
| 2 | **Agent 顶部真实数据**（员工/计划取数 + 纯函数折算 + 独立降级） | `admin-web/src/shared/workbench/agent-metrics.ts` | 新增 |
| 3 | **顶栏三格重写**（AI 状态 / 数字员工 / 任务进度 + 重试入口；彻底移除 `sessionState→在线` 映射） | `admin-web/src/components/workbench/AgentStatusBar.vue` | 重写 |
| 4 | 壳层接入（挂载即探针 + 加载指标 + 手动重试；chat 面隐藏外层输入条） | `admin-web/src/layouts/WorkbenchShell.vue` | 改 |
| 5 | 能力台账 `ai-06` 文案改真实（`ai-02` 保持 PLANNED） | `admin-web/src/shared/workbench/capability-entries-a.ts` | 改 |
| 6 | 新增用例 23 条（状态机真值表/实跑/端点解析/降级/结构/回归护栏） | `admin-web/tests/ai-status-truth.spec.mjs` | 新增 |
| 7 | 三条 mutation 反测装置 | `admin-web/tests/ai-status-countertest.mjs` | 新增 |
| 8 | 测试链串入 | `admin-web/package.json` | 改（+1 行） |
| 9 | 运行态取证脚本（ready/aifault/menufault/shots） | `docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs` | 新增 |
| 10 | 真实上游透明反代（仅补 CORS 头，供跨域取证） | `docs/evidence/WORKBENCH-06F1/local-ai-proxy.mjs` | 新增 |
| 11 | 证据包（README + 7 日志(+2 note) + 4 报告 + 11 截图(+README) + 1 反测记录） | `docs/evidence/WORKBENCH-06F1/**` | 新增 |

**提交**：见 §七。

## 二、改动面

```
 admin-web/package.json                             |   2 +-
 admin-web/src/components/workbench/AgentStatusBar.vue | 重写
 admin-web/src/layouts/WorkbenchShell.vue           |  改（探针/指标/重试/输入条去重）
 admin-web/src/shared/workbench/capability-entries-a.ts | 改（ai-06 文案）
新增：src/shared/workbench/ai-readiness.ts、src/shared/workbench/agent-metrics.ts、
      tests/ai-status-truth.spec.mjs、tests/ai-status-countertest.mjs、docs/evidence/WORKBENCH-06F1/**
```

**未动**：`admin-web/src/views/**`（零改动，§三.6 亲验）、`backend/**`、`app-mobile/**`、`saas-admin/**`、
迁移、`.github/**`、既有 7 个 spec（114 条）。

## 三、证据（可复跑，全部原始输出已落盘）

### 3.1 B1 · AI 状态真实性

**(a) 状态机真值表（8 组，无一失败判绿）**
```
PASS  状态机：只有 ready 判绿（isAiOnline 唯一真值）        ← ready=true / 其余 4 态=false
PASS  状态机：resolveReadiness 真值表（网络失败/CORS/401/形状异常 全非绿）  ← 8 组判定全部符合
PASS  状态机：文案纪律 —— 只有 ready 文案允许出现「在线/就绪」
PASS  状态机：探针真实走 GET /api/health/ready（源码 + 允许注入 url）  ← health/ready + 双信号 + 冷却 + 并发去重 + 超时
PASS  状态机·实跑：桩 fetch 成功 ready ⇒ 状态转 ready
PASS  状态机·实跑：桩 fetch 网络失败 ⇒ error（绝不假绿）
PASS  状态机·实跑：HTTP 500 + body ready ⇒ error（非 2xx 不得判绿）
PASS  状态机·实跑：并发探测只发 1 次请求（防风暴）          ← 3 并发 → 1 请求
```
原始：`logs/11-ai-status-truth.log`

**判据要点**：`resolveReadiness` 的判定顺序为「先排除失败、再判就绪」：
① 网络错误/非 2xx ⇒ `error`；② body 与 header 均无 status ⇒ `error`（形状异常，如代理返回 HTML）；
③ 任一为 `degraded` ⇒ `degraded`（从严）；④ 明确 `ready` ⇒ `ready`；⑤ 其余未知值 ⇒ `error`。
⇒ **唯一进入绿色的路径是"真实探针明确报 ready"**。

**(b) 运行态对照（computed 值，R8.1）**

| 场景 | 探针真实结果 | 状态 | 点 computed | 文案 |
|:--|:--|:--|:--|:--|
| AI 可达（反代→生产底座） | `200` + `X-AI-Readiness: ready` | `ready` | `rgb(22, 163, 74)` **绿** | 「AI 就绪」 |
| AI 不可达（3017 已停） | `net::ERR_CONNECTION_REFUSED` | `error` | `rgb(220, 38, 38)` **非绿** | 「AI 不通」+ 重试 |

原始：`reports/ready.json`、`reports/ai-fault.json`；截图 `screenshots/ready-1440.png` / `ai-fault-1440.png`

**(c) 不重试风暴**：并发去重（`if (inFlight) return inFlight`）+ 60s 冷却（`RETRY_COOLDOWN_MS`）+ 8s 超时；
运行态 run 报告记录到的探针请求次数为 **1 次/次加载**（`reports/ready.json` 的 `net.requests`）。

### 3.2 B2 · Agent 顶部真实数据

**(a) 端点真实调用（运行态网络记录）**
```
PASS  AI 就绪状态取自真实探针（/api/health/ready 已发出） ← ["/api/health/ready","/api/ai/employees","/api/ai/agent/plans"]
PASS  数字员工：真实 GET /api/ai/employees 已调用        ← [{"url":"/api/ai/employees","method":"GET"}]
PASS  任务进度：真实 GET /api/ai/agent/plans 已调用      ← [{"url":"/api/ai/agent/plans","method":"GET"}]
PASS  数字员工：UI 无假分母（不得出现 N/M 人数）           ← text=数字员工未知
PASS  数字员工：有真实读数（三格均渲染且状态已知）          ← state=degraded text=数字员工未知
PASS  任务进度：有真实读数（非假 0）                      ← state=degraded text=任务进度未知
```
原始：`logs/`、`reports/ready.json`

**(b) 解析/折算用例（真实形状，含边界）**
```
PASS  员工：解析成功（数组 ⇒ ready + 真实 count）              ← 2 名员工 ⇒ ready/count=2
PASS  员工：空数组 ⇒ ready 且 count=0（真空是真实结果，不是失败）
PASS  员工：异常形状 ⇒ unknown 且 count=null（绝不假 0）        ← 6 种异常形状全部 unknown/count=null
PASS  员工：真实 HTTP 调用（走 AI_BASE_URL + JWT header），失败 ⇒ unknown
PASS  员工：JWT 透传（有 token 时必须带 Authorization）         ← Authorization: Bearer <token>
PASS  计划：真实折算（steps 完成 C/T + 进行中数）              ← total=2 / running=1 / steps=3/5
PASS  计划：无 steps ⇒ 步骤口径置 null（不伪造 0/0）            ← steps=null/null，running=1
PASS  计划：success=false ⇒ unknown（底座显式失败）             ← error=未认证
PASS  计划：异常形状 ⇒ unknown（不猜数据）                      ← 6 种异常形状全部 unknown
PASS  计划：真实 HTTP 调用（/api/ai/agent/plans），失败 ⇒ unknown
PASS  两源独立降级：员工失败不影响计划成功，反之亦然           ← employees=unknown / plans=ready
```

**(c) 文案口径**
- 员工：`ready` ⇒ 「N 人就绪」（**底座无 online 字段，永不写 N/M**）；`unknown` ⇒ 「未知」（**不写 0**）。
- 计划：有 steps ⇒ 「步骤 C/T」；仅计划态 ⇒ 「进行中计划 N」；都无 ⇒ 「进度未知」。
- 源码护栏：`assert.ok(!/\d+\s*\/\s*\d+\s*人/.test(...))` + `!/在线数/`（代码区，剥注释）。

**(d) 能力台账**
- `ai-06`：`realAction` 写明 `GET /api/ai/agent/plans` / `GET /api/ai/employees` 与前端接线点 `agent-metrics.ts`；
  `missingReason` 改为「已接员工计数 + 计划进度；仍缺 ① 对话框内实时工具过程卡片 ② 单员工任务/计划详情未展开 ③ 无 online 字段 ⇒ 不写 N/M」；
  **status 保持 `PARTIAL`**。`ai-02` **保持 `PLANNED`**（派单卡 §二.3 明写保留）。

### 3.3 B3 · 视觉证据重拍

**根因（写进证据防复发）**：原型页面**内置自检脚本**（`V12`/`V14` 系列 `ck()` 断言，源码 L8635~）在加载过程中
主动 `openSetWin('conn')` 打开设置弹窗做断言，跑完由 `restore()` 收口。旧取证"加载 2.5s 后截图"正落在自检中途。

**本版收口流程**（未用临时改 `display` 冒充）：
1. 等自检收口（`setwin` 不再 `show`，≤25s）；
2. 仍开着 ⇒ 调**原型自身** `closeSet()`；
3. 调原型自身 `goDeskHome()` 回主面；
4. 清 toast（多轮）；
5. **复验** `setwinVisible=false && maskVisible=false && toastCount=0` 后才截图；
6. 探测原型**当前真实主面**（feed/chat/manual），把实现切到**同一主面**后成对截图。

```
PASS  1280px 原型设置弹窗已关闭（截图可供人眼核对）  ← setwin=false mask=false toasts=0
PASS  1280px 原型停在**可见主面**（rail/side/top 齐备 + 三选一可见）  ← rail={w:60,h:800} surface=chat
PASS  1280px 实现与原型**同主面**（原型=chat）且顶栏三格有读数      ← chat=true ai=AI 就绪
（1440 / 1920 同构通过）
PASS  四态①AI 会话：chat 面可见
PASS  四态①chat 面**不得有两个输入框**（会话内输入区承载，外层输入条隐藏） ← 外层composer=false 会话内textarea=1
PASS  四态②人工工作台首页：人工面可见且业务页渲染
PASS  四态③收银台：POS 路由可达且人工面可见  ← /pos/dashboard
```
原始：`logs/`（shots 段）、`reports/prototype-shots.json`（含逐宽度 `dismissed`/`overlayState`）
截图：`screenshots/README.md` 有完整对照表与差异说明。

> 说明：1440 的 `impl-1440.png` 与 `impl-chat-1440.png` 内容一致 —— 因为原型收口后停在 chat，实现按"同主面"要求
> 也切到 chat，两者本为同一状态（README 已写明，避免被当成重复取证）。

### 3.4 三条 mutation 反测（§三.5）

```
[反测 A-idle-as-online]  resolveReadiness 开头插 return "ready"（绕开全部失败判据）
  EXIT=1；FAIL=2；点名「状态机」=true
  FAIL 状态机：resolveReadiness 真值表（网络失败/CORS/401/形状异常 全非绿）
  FAIL 状态机·实跑：HTTP 500 + body ready ⇒ error
  复原 SHA256 = F6AEBD8D…F05E；恒等=true
[反测 B-employees-constant]  把 fetchJson("/api/ai/employees") 换成写死常量
  EXIT=1；FAIL=3；点名「员工」=true
  复原 SHA256 = CFCF94F3…A5B9；恒等=true
[反测 C-plans-constant]      把 fetchJson("/api/ai/agent/plans") 换成写死常量
  EXIT=1；FAIL=1；点名「计划」=true
  复原 SHA256 = CFCF94F3…A5B9；恒等=true
复原后复跑：EXIT=0（23 passed / 0 failed）
全部反测通过：3/3 点名变红 + 3/3 SHA256 恒等 + 复原后回绿
```
原始：`logs/40-countertest.log`、`redtest/ai-status-countertest.md`

### 3.5 门禁四项 + 测试守恒

| 门禁 | 命令 | 读数 | 原始 |
|:--|:--|:--|:--|
全量测试 | `npm test --prefix admin-web` | **137 passed / 0 failed**（既有 **114 条一条未减** + 新增 23），各段 3/30/11/12/16/24/8/10/**23**，EXIT=0 | `logs/10-npm-test.log` |
类型 | `vue-tsc -b admin-web/tsconfig.json --force` | **EXIT=0**，零输出 | `logs/20-vue-tsc.log`(+`.note.txt`) |
lint | `eslint admin-web/src/` | **EXIT=0**，0 error 0 warning，零输出 | `logs/21-eslint.log`(+`.note.txt`) |
构建 | `vite build --config admin-web/vite.config.ts admin-web` | **EXIT=0**，✓ built in 1m 45s | `logs/30-build.log` |
结构回归 | `prototype-parity.spec.mjs` | **10 passed / 0 failed**（未被本单破坏） | `logs/12-prototype-parity.log` |

### 3.6 业务冻结面（§三.6）

```
$ git diff --name-only 20fdd794 -- admin-web/src/views backend
（零输出）
```
⇒ `views/**` 与 `backend/**` 相对基线 **零改动**。

## 四、验收自评（逐条对卡 §三 硬验收）

| 硬验收 | 自评 | 依据 |
|:--|:--|:--|
**1. AI 不可达时任一截图/运行态不出现绿色"在线待命"；真实 ready 后才转绿** | **通过** | aifault：点 computed `rgb(220,38,38)`、文案「AI 不通」、无"在线待命"字样；ready：点 `rgb(22,163,74)`。同一份代码两态可复现（§3.1b） |
**2. `/api/ai/employees`、`/api/ai/agent/plans` 均有运行态请求记录 + 真实响应摘要 + UI 读数** | **通过（请求/响应/降级）；"非空读数"未验** | `reports/ready.json` 记录两请求均发出、生产返回 401 ⇒ UI「未知」；**非空数据渲染未经运行态验证**（见 §五.1，不虚报） |
**3. 员工/计划失败时独立显示未知/降级，不显示假 0、旧值、原型数字** | **通过** | aifault 两格均 `degraded`+「未知」；解析用例 6 种异常形状全 `unknown/count=null`；`两源独立降级` 用例通过 |
**4. 现有 114 条一条不减；新增数量如实** | **通过** | 137 = 114 + **23**（如实） |
**5. 三条 mutation 点名变红、SHA256 恒等、复原后全绿** | **通过** | §3.4：3/3 点名（2/3/1 条 FAIL）+ 3/3 恒等 + 23/23 回绿 |
**6. `build:check`/`build` EXIT=0；views/**、backend/** 相对 20fdd794 零改动** | **通过** | vue-tsc EXIT=0 + build EXIT=0（`build:check` 两段已分别 EXIT=0）；`git diff` 零输出 |
**7. 同尺寸截图关闭设置弹窗后成对有效；四态均有可见证据** | **通过** | 3 宽度 `setwin=false/mask=false/toast=0` + 同主面成对；四态截图齐全（含"不得双输入框"判据） |
**8. 工作树 clean、未 push、未开 PR、逐文件 add** | **通过** | 见 §七（`git status` clean；`git ls-remote` 该分支为空；逐文件 `git add`） |

卡 §二 交付物逐条：
1. ✅ 五态 + 真实探针 + 失败非绿 + 无重试风暴（§3.1）
2. ✅ 员工/计划真实接入 + 独立降级 + 不假 0/不假分母 + 既有 API 封装模式 + JWT（§3.2）
3. ✅ `ai-02` 保持 PLANNED、`ai-06` 改真实文案并保持 PARTIAL、未接子能力写清（§3.2d）
4. ✅ 状态机测试 + 端点测试 + 三条 mutation（§3.1/3.2/3.4）
5. ✅ 视觉证据重拍（§3.3）
6. ✅ 三态运行态（ready/aifault/menufault，§3.1b/3.2a/§四）
7. ✅ 证据 `docs/evidence/WORKBENCH-06F1/**` + 回传卡本文件

## 五、未完成与阻塞

**无阻塞项。** 以下为**未验项**（如实登记，不降级为已验，详见证据 README §7）：

1. **员工/计划的"非空真实读数"运行态**：生产 AI 底座不认本机 mock JWT（`JWT_SECRET` 不同域）⇒ 运行态真实返回 **401**，
   UI 正确降级「未知」。**这是一次真实验证的降级路径**，但"有数据时渲染成 N 人就绪 / 步骤 C/T"**未经真实数据运行态验证**；
   仅由解析/折算用例与真实 HTTP 调用用例覆盖。**不在本卡声称已验。** 若要闭环，需生产凭据或与 backend 同 secrets 的底座实例。
2. **非空业务菜单运行态**：mock DB 无菜单行，第二列/rail 运行态仍为 0（fail-closed 真实表现）。
3. **AI 正常在线问答链路**：3016 未起，仅验到"就绪探针真实可达 + 会话面可打开"。
4. **Electron / <1280px / 移动 H5**：不在本卡范围。
5. **原型自检脚本结论**：本单只收口其副作用（自动开设置弹窗），未验证其断言 pass/fail。

## 六、风险与自我报备

1. **B2 的根因是我在 WT-06 的事实性错误**：把 `ai-06` 写成 `PLANNED`、断言"底座无在线数/进度端点"。凌舟用
   `capability-entries-a.ts` + ZXQL-AI 源码逐条证伪。**这是"以猜测代替核对"的复发**（同族 [128]）；本单已按真实端点重做，
   并在此明确认账。教训：**能力台账状态与端点可用性必须以源码/运行态为准，不能凭印象写入回传卡。**
2. **B3 的取证缺陷**：旧脚本"加载 2.5s 截图"未考虑原型内置自检会自动打开设置弹窗 ⇒ 截图无效。本版改为
   "等自检收口 + 调原型 API 关闭 + 复验后截图"，并把这个机制写进证据 README 防复发。
3. **运行态发现并修复的真缺陷（第 4 条，卡外）**：chat 面**同时出现两个输入框**（外层 `AiChatComposer` + 会话内
   `AiSidePanel` 输入区）。已改为 chat 面隐藏外层输入条（信息流/人工面仍保留），并加了一条运行态判据
   「chat 面不得有两个输入框」。属本单运行态截图发现，不在派单卡列举项内，主动报备。
4. **反代属取证工具、不入产品**：`local-ai-proxy.mjs` 只补 CORS 头、响应体由真实上游产生；**不在 `admin-web/src` 内**，
   不进构建产物。若凌舟认为运行态不应经过任何本地反代，则 AI 可达态的浏览器取证无法进行（生产未给 4173 放行）。
5. **`authHeaders` 加了一处防御性 try/catch**：取登录态失败（Pinia 未激活/首屏早期）时**仍发出匿名请求**由服务端裁决，
   避免"请求静默发不出、UI 只能显示未知且查不到原因"。这是测试暴露的真实健壮性问题，非为迁就测试。
6. **口径变更留痕（非静默）**：`AgentStatusBar` 的 props 由 `sessionState` 改为 `readinessState`；
   WT-06 的 10 条结构断言全部保留通过，未删任何既有断言。
7. **未改任何 `views/**` 业务页**；未动 `backend/**`。

## 七、提交与分支（未 push、未开 PR）

逐文件 `git add`（**未用 `git add -A`**）。提交见 `git log`；`git status` clean；
`git ls-remote origin workbench/WORKBENCH-06F1-agent-status-truth` 为空（未 push）。

## 八、环境复原

- 已停：mock 后端 8080、`vite preview` 4173、`local-ai-proxy` 3017（均已 taskkill 并验证端口拒绝）；
- 已删：临时诊断脚本 `_probe-*.mjs` / `_diag-*.mjs`、探针截图 `_probe-1440.png` / `_diag-login.png`、
  运行日志 `proxy-3017*.log` / `preview-4173.log` / `backend-8080*.log`；
- 未提交产物：`admin-web/dist/`（`.gitignore` 忽略）、会话缓存（系统临时目录，不入库）；
- 反测注入：3 次全部逐字节复原（SHA256 见 `redtest/ai-status-countertest.md`）。

---

派单人：凌舟（总负责人）｜2026-10-24
汇报人：墨（工作台负责人）｜2026-10-25
