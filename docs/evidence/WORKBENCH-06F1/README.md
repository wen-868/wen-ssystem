# WORKBENCH-06F1 证据包 · AI 状态真实性 + Agent 顶部真实数据

> 负责人：墨（工作台前端 owner）｜2026-10-25
> 基线：`20fdd794b577b3665ba99c42fd3c1ac80f3f2a2c`（＝ WT-06 尖端）
> 分支：`workbench/WORKBENCH-06F1-agent-status-truth`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F1`
> 上游驳回：`docs/tasks/cards/R101-WORKBENCH-06-凌舟验收与裁定-20261024.md`（B1 假绿 / B2 前提证伪 / B3 截图无效）
> 权威原型 SHA256：`6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51`

## 1. 三条驳回的处置结论

| 驳回 | 根因 | 本单处置 | 证据 |
|:--|:--|:--|:--|
| **B1 AI 状态假绿** | `AgentStatusBar` 把 `sessionState=idle`（无流式请求）直接渲染成绿色「AI 在线待命」；idle 与"服务可达"无关 | 新建 `ai-readiness.ts` 五态状态机（`unchecked/checking/ready/degraded/error`），只以真实探针 `GET /api/health/ready` 判定；**只有 ready 才绿**；失败/超时/CORS/401/非2xx/形状异常一律非绿；落实"不自动重试风暴"（并发去重 + 60s 冷却） | `logs/11-ai-status-truth.log`（23 例）＋ 运行态 `reports/ready.json` / `reports/ai-fault.json` |
| **B2 D-2 前提被证伪** | 我在 WT-06 回传卡写 `ai-06=PLANNED`、"底座无在线数/进度端点"——**事实错误**（`ai-06` 实为 PARTIAL，且员工/计划端点齐备） | 新建 `agent-metrics.ts`：真实接 `GET /api/ai/employees` 与 `GET /api/ai/agent/plans`；两源**独立降级**；失败/异常形状 ⇒ `unknown`（不假 0、不复用旧值）；**不编造分母**（底座无 online 字段 ⇒ 只显示「N 人就绪」）；能力台账 `ai-06` 文案改为真实接入情况（保持 PARTIAL），`ai-02` 保持 PLANNED | 同上 + `capability-entries-a.ts` 改动 |
| **B3 截图对照无效** | 原型页面**内置自检脚本**（`V12`/`V14` 系列 `ck()` 断言，源码 L8635~）在加载中主动 `openSetWin('conn')` 打开设置弹窗做断言；旧取证"加载 2.5s 后截图"正落在自检中途 | 取证改为：**等自检收口 → 调原型自身 `closeSet()` → 复验 setwin/mask/toast 均不可见 → 再截图**；并把实现切到与原型**同一主面**后成对截图。**未用临时改 display 冒充可见态** | `reports/prototype-shots.json`（含 `dismissed`/`overlayState` 逐宽度复验）＋ `screenshots/README.md` |

## 2. 复跑命令（工作树根目录）

```powershell
# ① 单测/结构（本单新增 23 例；既有 114 条一条未减）
node admin-web/tests/ai-status-truth.spec.mjs
npm test --prefix admin-web

# ② 三条 mutation 反测（注入 → 点名变红 → SHA256 恒等复原 → 回绿）
node admin-web/tests/ai-status-countertest.mjs

# ③ 门禁
node admin-web/node_modules/vue-tsc/bin/vue-tsc.js -b admin-web/tsconfig.json --force
node admin-web/node_modules/eslint/bin/eslint.js admin-web/src/
node admin-web/node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web

# ④ 运行态（前置见 §3；按顺序跑）
node docs/evidence/WORKBENCH-06F1/local-ai-proxy.mjs                 # 起真实上游反代（3017）
$env:VITE_AI_BASE_URL="http://127.0.0.1:3017"; $env:VITE_API_BASE="/api"
node admin-web/node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web
node node_modules/vite/bin/vite.js preview --port 4173 --host 127.0.0.1   # 在 admin-web 目录执行
$env:WB_BASE_URL="http://127.0.0.1:4173"
node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs ready           # AI 可达 ⇒ 绿
node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs shots           # 同尺寸成对 + 四态
# 停 3017 后：
node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs aifault         # AI 不可达 ⇒ 非绿
# 停 8080 后：
node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs menufault        # 菜单失败 ⇒ 人工可用
```

## 3. 环境与前置（真实运行，不拦截、不伪造）

| 组件 | 实际形态 | 备注 |
|:--|:--|:--|
| 后端 | `USE_MOCK_DB=true NODE_ENV=development PORT=8080 npx tsx src/server.ts` | 真实签发 JWT；`/api/platform/health` 200 |
| 前端 | **`vite preview` 4173（构建产物）**，非 dev server | 回应凌舟 §2.1 口径要求 |
| AI 底座（真实上游） | `https://admin.onepan.cn/ai-api`（**生产**）；本机 3016 未起 | 经 `local-ai-proxy.mjs` **透明转发 + 仅补 CORS 头**（不改写任何响应体） |
| 探针契约 | `GET /api/health/ready` 恒返 HTTP 200，语义在 `status` 与 `X-AI-Readiness` 头（`ZXQL-AI/src/app.controller.ts:47-64`） | 实测生产返回 `status=ready`、`X-AI-Readiness=ready` |
| 浏览器 | Playwright Chromium（根 `node_modules`） | 记录全部 `/api/ai/*` 请求、响应与失败 |

> **为什么需要本地反代**：构建产物在 `127.0.0.1:4173`，生产 AI 底座未给该 origin 放行 ⇒ 浏览器跨域直连会被 CORS 拦，
> 导致"底座真不可用"与"浏览器跨域被拦"无法区分。反代只补 CORS 头、**响应体由真实上游产生**。

## 4. 结果摘要（原始输出见 `logs/`、`reports/`、`redtest/`）

| 项 | 读数 | 原始 |
|:--|:--|:--|
| 新增状态机/端点用例 `ai-status-truth.spec.mjs` | **23 passed / 0 failed** | `logs/11-ai-status-truth.log` |
| 全量测试链 `npm test --prefix admin-web` | **137 passed / 0 failed**（既有 **114 条一条未减** + 新增 23 条），各段 3/30/11/12/16/24/8/10/23 | `logs/10-npm-test.log` |
| **三条 mutation 反测** | **3/3 点名变红** + **3/3 SHA256 恒等复原** + 复原后 23/23 回绿 | `logs/40-countertest.log`、`redtest/ai-status-countertest.md` |
| `vue-tsc -b --force` | **EXIT=0**（零输出，见 note） | `logs/20-vue-tsc.log`+`.note.txt` |
| `eslint src/` | **EXIT=0**，0 error 0 warning（零输出，见 note） | `logs/21-eslint.log`+`.note.txt` |
| `vite build` | **EXIT=0**，✓ built in 1m 45s | `logs/30-build.log` |
| 业务冻结面 | `git diff --name-only 20fdd794 -- admin-web/src/views backend` **零输出** | 本 README §7 |
| 结构回归 `prototype-parity.spec.mjs` | **10 passed / 0 failed**（未因本单改动破坏） | `logs/12-prototype-parity.log` |

### 4.1 运行态三态（对应 §三.1/2/3）

| 阶段 | 结果 | 关键读数 |
|:--|:--|:--|
| **ready**（AI 真实可达） | **10 passed / 0 failed** | 探针 `/api/health/ready` → **200**；`X-AI-Readiness=ready` ⇒ 状态 `ready`、**点 computed = `rgb(22,163,74)`（绿）**；`GET /api/ai/employees`、`GET /api/ai/agent/plans` **均真实发出**（生产返回 401 ⇒ UI 独立降级「未知」，**无假 0**） |
| **aifault**（AI 真实不可达） | **9 passed / 0 failed** | `net::ERR_CONNECTION_REFUSED`（3017 已停，真实）⇒ 状态 `error`、**点 computed = `rgb(220,38,38)`（非绿）**；文案「AI 不通」不含"在线待命"；重试入口存在；员工/计划独立「未知」；壳层与信息流仍可用 |
| **menufault**（后端 8080 已停） | **4 passed / 0 failed** | 菜单故障横幅可见、不回退全量；**AI 状态 `ready` 不受菜单影响（两者解耦）** |
| **shots**（同尺寸 + 四态） | **14 passed / 0 failed** | 1280/1440/1920 三宽度：原型 `setwin=false/mask=false/toast=0`（人眼可核对）；原型与实现**同主面**；四态①会话（**仅 1 个输入区**）②人工首页 ③收银台 |

> **B1 闭环要点**：同一份代码在 AI 可达时绿、不可达时红，且颜色取自 **computed 值**（R8.1 口径），
> 不是源码推理。旧版"idle 即绿"的假绿路径已被状态机彻底切断。

## 5. 目录结构

```text
docs/evidence/WORKBENCH-06F1/
├── README.md                     # 本文件
├── runtime-ai-truth.mjs          # 运行态取证：ready / aifault / menufault / shots
├── local-ai-proxy.mjs            # 真实上游透明反代（仅补 CORS 头，供跨域取证）
├── logs/                         # 10-npm-test / 11-ai-status-truth / 12-prototype-parity /
│                                 # 20-vue-tsc(+note) / 21-eslint(+note) / 30-build / 40-countertest
├── reports/                      # ready.json / ai-fault.json / menu-fault.json / prototype-shots.json
├── screenshots/                  # 11 张 + README.md（同尺寸口径与差异说明）
│   ├── prototype-{1280,1440,1920}.png   实现同尺寸：impl-{1280,1440,1920}.png
│   ├── ready-1440.png（绿） / ai-fault-1440.png（红） / menu-fault-1440.png
│   └── impl-chat-1440.png / impl-manual-dashboard-1440.png / impl-pos-1440.png
└── redtest/
    └── ai-status-countertest.md  # 三条 mutation：注入 SHA → FAIL 原文 → 复原 SHA → 回绿
```

## 6. 三条 mutation 反测（对应 §二.4 / §三.5）

| 反测 | 注入手法 | 结果 |
|:--|:--|:--|
| **A** 把 idle/失败改回"在线" | 在 `resolveReadiness` 开头插入 `return "ready"`（绕开全部失败判据 ⇒ 等价旧版假绿） | EXIT=1，**2 条点名红**（真值表 + HTTP 500 用例）；SHA256 恒等复原 |
| **B** 删 employees 真实调用 | 把 `fetchJson("/api/ai/employees")` 换成写死常量（不走网络） | EXIT=1，**3 条点名红**（真实调用/JWT 透传/独立降级）；SHA256 恒等复原 |
| **C** 删 plans 真实调用 | 把 `fetchJson("/api/ai/agent/plans")` 换成写死常量 | EXIT=1，**1 条点名红**（真实调用）；SHA256 恒等复原 |

复原后复跑：**23 passed / 0 failed**。基线 SHA256：
`ai-readiness.ts = F6AEBD8D…F05E`、`agent-metrics.ts = CFCF94F3…A5B9`（详见 redtest 卡）。

## 7. 未验项（如实登记，不降级为已验）

1. **员工/计划端点的"真实读数"运行态**：生产 AI 底座不认本机 mock JWT（`JWT_SECRET` 不同域）⇒ 运行态真实返回 **401**，
   UI 正确降级为「未知」（这正是要验的降级路径）。**"非空数据渲染成 N 人就绪 / 步骤 C/T"未经真实数据运行态验证**，
   仅由 `ai-status-truth.spec` 的解析/折算用例 + 真实 HTTP 调用用例覆盖。**不在本卡声称已验。**
2. **非空业务菜单运行态**：mock DB 无菜单行 ⇒ 第二列/rail 模块项运行态仍为 0（fail-closed 真实表现）。
3. **AI 正常在线问答**：3016 未起，仅验到"就绪探针真实可达 + 会话面可打开"，未做完整问答链路。
4. **Electron 客户端 / <1280px / 移动 H5**：不在本卡范围。
5. **原型自检脚本本身的 pass/fail**：本单只把它的副作用（自动开设置弹窗）收口，未验证其断言结论。
