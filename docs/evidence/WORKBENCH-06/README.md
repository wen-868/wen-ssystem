# WORKBENCH-06 证据包 · 工作台原型结构对齐

> 负责人：墨（工作台前端 owner）｜2026-10-24
> 基线：`11aeda17f7927572c2933b85d0d653e0f39bf031`（＝ WT-05 尖端）
> 分支：`workbench/WORKBENCH-06-prototype-parity`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06`
> 权威原型：`D:\Users\ZXQL\ZXQL-AI\docs\设计\智享全链_工作台电脑端_UI原型_融合版.html`
> 原型 SHA256：`6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51`（脚本每次运行前校验）

## 1. 为什么有这一单（结构偏差，不是配色问题）

`R101-WORKBENCH-05-凌舟复核纠正-20261024.md` §二 实测：

| 维度 | 权威原型 | WT-05 前的实现 | WT-06 后 |
|:--|:--|:--|:--|
| 左侧导航 | 常驻一级图标 rail + 第二列上下文导航 | 单列 209px 侧栏 | **rail 64px + 第二列 231px**（实测） |
| 模式切换 | 工作台内直接切换，顶部为 Agent 状态/待审阅/进度 | 顶部「人工/AI」tab | **顶部 Agent 状态区 + 工作台·收银台胶囊** |
| AI 主面 | 信息流/会话即默认主面 | 独立 AI 卡片页 | **默认 feed（信息流）⇄ chat（会话）** |
| 输入区 | 底部固定 AI 输入框，人工页仍可协同 | 仅 AI 模式右侧会话面板 | **底部常驻输入区；人工页收为 compact 条** |
| 收银切换 | 顶部胶囊 | 进 POS 后才显示「快速收银台」 | **顶部胶囊双向切换** |
| 业务页面 | 二级页嵌入新壳 | 保留但壳不同 | **原样嵌入（`views/**` 零改动）** |

## 2. 复跑命令（工作树根目录）

```powershell
# ① 结构断言（10 条）：rail/第二列/Agent 区/主面三层/底部输入区/胶囊/旧壳回退/无 mock/真实数据源/能力锚点
node admin-web/tests/prototype-parity.spec.mjs

# ② 反测（4 条注入 → 点名红 → 逐字节复原 → 复跑回绿）
node admin-web/tests/prototype-parity-countertest.mjs

# ③ 全量测试链（8 spec / 114 条）
npm test --prefix admin-web

# ④ 类型 / lint / 构建
node admin-web/node_modules/vue-tsc/bin/vue-tsc.js -b admin-web/tsconfig.json --force
node admin-web/node_modules/eslint/bin/eslint.js admin-web/src/
node admin-web/node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web

# ⑤ 运行态（前置：mock 后端 8080 + vite preview 4173，见 §4）
node docs/evidence/WORKBENCH-06/runtime-parity.mjs prototype    # 同尺寸对照（仅需 4173 + 原型）
node docs/evidence/WORKBENCH-06/runtime-parity.mjs normal       # 正常态
node docs/evidence/WORKBENCH-06/runtime-parity.mjs ai-fault     # AI 故障态（3016 不启动）
node docs/evidence/WORKBENCH-06/runtime-parity.mjs menu-fault   # 菜单失败态（先停 8080）
```

## 3. 结果摘要（原始输出见 `reports/`、`redtest/`）

| 项 | 读数 |
|:--|:--|
| 结构断言 `prototype-parity.spec.mjs` | **10 passed / 0 failed** |
| 全量测试链 `npm test` | **114 passed / 0 failed**（既有 104 条一条未减 + 新增 10 条） |
| `vue-tsc -b --force` | **EXIT=0** |
| `eslint src/` | **EXIT=0，0 error 0 warning** |
| `vite build` | **EXIT=0**，✓ built in 1m 9s |
| 反测 4 条 | **4/4 点名变红**（rail / 第二列 / 输入区 / 旧壳回退）＋ **4/4 逐字节复原**＋复原后回绿 |
| 同尺寸对照 3 宽度 | **16 passed / 0 failed**（1280/1440/1920） |
| 运行态 normal | **15 passed / 0 failed**（真实登录、三段结构、默认信息流、新对话、rail、收银往返、fail-closed） |
| 运行态 menu-fault | **5 passed / 0 failed**（真实 ECONNREFUSED、故障横幅、不回退全量、rail/输入区可用） |
| 运行态 ai-fault | **5 passed / 0 failed**（真实 3016 拒连、横幅、一键切人工、人工面可用） |

### 3.1 同尺寸几何对照（`reports/prototype-parity.json`）

| 宽度 | rail 原型／实现 | 第二列 原型／实现 | 输入区 |
|--:|:--|:--|:--|
| 1280 | 60 / **64** | 230 / **231** | 实现贴底 708+92=800 ✅ |
| 1440 | 60 / **64** | 230 / **231** | 实现贴底 808+92=900 ✅ |
| 1920 | 60 / **64** | 230 / **231** | 实现贴底 988+92=1080 ✅ |

> rail 实现比原型宽 4px（64 vs 60）：为容纳 4 字中文标签（「工作台」「销售管理」）所需的可读宽度；
> 第二列比原型宽 1px（231 vs 230）。两者均在卡定判据（rail ≤8px、side ≤30px）内，差异清单见 §6。

## 4. 环境与前置（真实运行，非模拟）

| 组件 | 实际形态 | 备注 |
|:--|:--|:--|
| 后端 | `USE_MOCK_DB=true NODE_ENV=development PORT=8080 npx tsx src/server.ts` | `/api/platform/health` 返回 `mode:"mock-db"`；真实签发 JWT |
| 前端 | `vite preview --port 4173`（用 **dist 产物**，非 dev server） | 验证的是构建产物真实运行 |
| 数据库 | 未安装 MySQL | mock DB 无菜单/角色行 ⇒ `/menus/user` 真实返回空集 |
| AI 底座 | 未启动（3016 无监听） | 用于制造真实 AI 连接失败 |
| 浏览器 | Playwright Chromium（根 `node_modules`） | 不拦截、不改写任何接口响应 |

**空菜单是真实运行态，不是缺陷**：mock DB 下 `/menus/user` 返回 `200 + data:[]` ⇒ 新壳 fail-closed
（第二列 0 入口 + 明示「当前账号暂无可显示的菜单」），不回退全量。非空菜单场景由单测覆盖（§3）。

## 5. 目录结构

```text
docs/evidence/WORKBENCH-06/
├── README.md                      # 本文件
├── runtime-parity.mjs             # 运行态取证：prototype / normal / menu-fault / ai-fault
├── screenshots/                   # 11 张
│   ├── prototype-{1280,1440,1920}.png   # 原型同尺寸
│   ├── impl-{1280,1440,1920}.png        # 实现同尺寸
│   ├── normal-1440.png / normal-chat-1440.png / normal-pos-1440.png
│   └── menu-fault-1440.png / ai-fault-1440.png
├── reports/                       # 4 份结构化 JSON（含逐项断言与网络记录）
│   ├── prototype-parity.json      # 18 组几何 + 判定
│   ├── normal.json / menu-fault.json / ai-fault.json
└── redtest/
    └── prototype-parity-countertest.md   # 4 条反测：注入 SHA → FAIL 原文 → 复原 SHA → 回绿
```

## 6. 差异清单（**须凌舟裁定**，逐条给依据）

| # | 差异 | 原型 | 实现 | 依据／处置 |
|--:|:--|:--|:--|:--|
| **D-1** | 第二列「员工/对话切换」「会话列表」 | 有（`.sess-list` + 员工/对话 tab） | **未实现** | AI 底座**无历史会话端点**（`/api/chat` 只支持单轮 conversationId，无 list 端点）；按红线「不得用原型 mock」⇒ 只做「新对话」+ 实时会话，会话列表待底座补端点。**请裁定**是否另立单要底座补 `GET /api/chat/conversations` |
| **D-2** | 顶部「数字员工 12/14 在线」「任务进度 2/5」 | 有 | **未实现** | 能力台账 `ai-06`（Agent 任务通道）= **PLANNED**，无在线数/进度真实端点；不编造（`AgentStatusBar.vue` 内已注明）。显示真实可得的两项：会话通道状态 + 待审阅数（`/api/chat/confirmations`） |
| **D-3** | 信息流「事件流 + 订单跟踪进度条」 | 有（`FEED` 6 条 + 6 节点进度） | **改为真实业务动态** | 原型 FEED 是占位数据；实现接 `GET /admin/wb-notifications`（与消息中心同源）+ `/api/chat/confirmations`，另有真实 WS 推送刷新。跟踪进度需底座 feed 端点（`ai-03`=PLANNED） |
| **D-4** | 人工页下输入区 | `display:none`（原型 L1990） | **保留 compact 输入条** | 派单卡 §一.5 明写「进入人工业务页时仍可保持 AI 协同入口」⇒ 有意差异 |
| **D-5** | rail 宽度 | 60px | **64px** | 中文 4 字标签可读性（判据 rail 差 ≤8px 内） |
| **D-6** | 设置入口 | 设置大弹窗（5 tab） | **跳 `/system` 页面** | 设置弹窗是原型内独立体系（含原型 mock 的连接信息）；现有 `/system` 页已具备系统配置的能力，不重复造弹窗。**请裁定**是否另立单做设置弹窗 |

## 7. 未验项（如实登记，不降级为已验）

1. **非空业务菜单的运行时渲染**：需真实 MySQL + 角色/菜单行；本轮 mock DB 空集，第二列与 rail 模块项运行时均为 0。非空场景由单测（`workbench-shell.spec` 12/71 项、`menu-ai-bridge.spec` 8 码裁剪）覆盖，但**不声称运行态已验证**。
2. **角色化运行态**（STORE_MANAGER/STORE_OPERATOR 浏览器渲染）：未做，仅单测覆盖 23/0 项裁剪。
3. **AI 正常在线会话**（3016 已启动的真实问答）：本轮未启底座，只验故障态。
4. **Electron 客户端**、**1280 以下宽度 / 移动 H5**：不在本卡范围。
5. **AI 信息流的「巡检主动播报」**：需底座 WS 实推；本轮 WS 未连（`推送离线`如实显示）。

## 8. 反测记录（`redtest/prototype-parity-countertest.md` 摘要）

| 反测 | 注入 | EXIT | 点名命中 | 复原 |
|:--|:--|:--:|:--:|:--:|
| A | 删除一级 rail | 1 | ✅ 「一级 rail 结构缺失」 | SHA256 逐字节一致 ✅ |
| B | 删除第二列导航 | 1 | ✅ 「第二列导航结构缺失」 | ✅ |
| C | 删除底部输入区 | 1 | ✅ 「底部输入区结构缺失」 | ✅ |
| D | 删除旧壳回退分支 | 1 | ✅ 「旧壳回退结构缺失」 | ✅ |

复原后复跑：**10 passed / 0 failed**。
