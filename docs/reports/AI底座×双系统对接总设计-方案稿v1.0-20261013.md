# AI 底座 × 双系统对接总设计（v1.0 方案稿）

> 设计人：凌舟｜2026-10-13
> 业主指令：「AI 底座需要对接两个系统（管理系统 + 运营系统），权限要分清楚」
> 依据（全部已核实）：
> - 《智享AI底座-架构设计文档【唯一权威】》§3.3 独立部署形态、§十 多租户
> - 《统一管理后台与数据互通规则方案 v1.1》（ZXQL-OPS/docs）
> - OPS 架构 v0.2.0（27 域全落地）+ Skill Gateway 实现（`zhixiang-ops-backend/src/skill/`）
> - AI 底座现状：152 套件/1674 用例、治理链完整、97 工具（36 写）
> 状态：**方案稿 —— 经业主批准后进入实现**

---

## 一、目标与原则

### 1.1 目标
AI 底座作为**统一 AI 大脑**，同时服务两个业务系统：
- **管理系统（ZXQL-MS）**：酒水进销存 —— **已对接**（53 工具 + 43 动态技能，治理链完整）
- **运营系统（ZXQL-OPS）**：短视频+直播带货 —— **待对接**（27 域，已有 Skill Gateway）

### 1.2 三条不变原则（从既有方案继承，不新造）
1. **AI 为大脑、软件为工具**：AI 底座不绑定单一业务系统，通过**标准化适配**接入（架构文档 §3.3）
2. **零侵入**：业务系统零感知 AI 存在（业务模块不直连 AI，经各自的网关/适配层）
3. **双向工具化**：①业务系统的能力 → 注册为 AI 的工具；②AI 的生成能力 → 注册为业务系统的 Skill Provider

### 1.3 本设计的四个决策点
- D1：对接 OPS 走哪条通道（Skill Provider 反向注册 / MCP Client / REST 直连）
- D2：三域身份与租户映射（管理系统租户 ≠ OPS 租户 ≠ AI 底座租户）
- D3：治理链如何覆盖 OPS 工具（写全审核/幂等/审计不可绕过）
- D4：AI 底座的工具命名空间与冲突处理

---

## 二、两系统现状能力对照（对接的前提）

| 维度 | 管理系统（ZXQL-MS） | 运营系统（ZXQL-OPS） |
|---|---|---|
| 定位 | 酒水进销存（14 微服务） | 短视频+直播带货运营（27 域） |
| AI 能力出口 | **无网关**——AI 底座直接持其工具 | **Skill Gateway**（`invoke(skill,payload)`，5 类技能，3 源降级）|
| AI 能力入口 | `/ai-api`（AI 底座被 Nginx 反代） | **AiChatModule**（AI 对话框后端已存在）|
| 身份 | JWT issuer=zhixiang-system / zhixiang-platform | JWT issuer=zhixiang-ops（独立）+ SSO 接管理系统 |
| 租户 | `tenant_id`（liquor_inventory 库） | `ops_tenant_id`（zhixiang_ops 库）+ `ops_tenant_bind` 映射表 |
| 数据 | 业务真源（库存/订单/商品/客户/财务） | 运营业务（选题/脚本/发布/直播/投放/客服）+ 主数据镜像 |
| 部署 | 云端服务器（公网 api.onepan.cn） | **本地打包模式**（127.0.0.1:3100，服务器不可达本地）|

**两个关键事实**（决定对接方向）：
1. **OPS 已有 AI 对话后端**（AiChatModule）但**没有工具执行体系** —— 它的 AI 只能聊，不能操作业务
2. **OPS 的 Skill Gateway 只聚合"生成类"技能**（text/image/video/voice/digital-human），**没有"业务执行类"技能**

---

## 三、D1 对接通道决策

### 3.1 三个候选方案

| 方案 | 机制 | 优点 | 缺点 |
|---|---|---|---|
| **A. MCP Client** | AI 底座实现 MCP Client，OPS 实现 MCP Server 暴露业务工具 | 标准协议；第三方可复用 | OPS 要新写 MCP Server（27 域工具化工作量大）；OPS 的 Skill Gateway 被绕过 |
| **B. REST 适配器** | AI 底座给 OPS 写一组 adapter（照 ZhixiangCore 范式） | 简单直接 | 每个业务域手写适配；OPS 的鉴权/租户/审计要 AI 底座重复理解 |
| **C. 双向 Skill 网关互联** ⭐ | ①AI 底座把自己注册为 OPS Skill Gateway 的一个 **Provider**（提供 `business-exec` 类技能）；②AI 底座把 OPS 的 Skill Gateway 封装为自己的 **ops 工具族**（选题/脚本/发布/成片…） | **双向复用既有网关**：OPS 侧零新协议（Provider 是它已有的扩展点）；AI 侧工具化成本低（一个 gateway.provider 范式）；治理链天然覆盖 | 需要定义 `business-exec` 技能类型扩展 + OPS Skill Gateway 支持**外部 Provider**（当前 3 源是本地/外部/BYO，加 `remote-ai-base`） |

### 3.2 裁定：**方案 C（双向 Skill 网关互联）**

理由：
1. **OPS 侧已有 Provider 插槽**：`SkillProvider` 接口（`supports` + `generate`）就是为多源聚合设计的，加一个 `RemoteAiBaseProvider` 是**既定扩展点的使用**，不是改架构
2. **AI 底座侧已有工具工厂范式**：`DynamicApiTool`（API 目录 → 工具）与"OPS Skill → 工具"同构
3. **本地打包约束天然满足**：OPS 在本地（127.0.0.1:3100），AI 底座在云端 —— 连接方向是 **OPS → AI 底座**（OPS 主动调公网 AI API，符合互通方案 §1.3 硬约束"服务器不可达本地"）
4. **AI 底座调 OPS**：经浏览器聚合或 OPS 主动拉取（互通方案既有通道），AI 底座**不反向访问本地** —— 即 AI 底座的 ops 工具族仅在「OPS 主动会话」内可用（见 D2）

### 3.3 通道细节

```
┌──────────── AI 底座（云端 3016）────────────┐    ┌──── OPS（本地 3100）────┐
│ ToolRegistry                                │    │ Skill Gateway           │
│ ├─ 管理系统工具族（53+43，已通）             │    │ ├─ ollama.provider      │
│ ├─ OPS 工具族（新增，动态注册）               │◀───│ ├─ external.provider    │
│ │   ├─ ops_create_topic（选题）              │    │ ├─ tenant-byo.provider  │
│ │   ├─ ops_create_script（脚本）             │    │ └─ ai-base.provider ★新 │
│ │   ├─ ops_publish_video（发布）             │    │    ↑ OPS 主动调云端      │
│ │   └─ …（按 OPS 域逐步开通）                 │    └─────────────────────────┘
│ └─ 跨系统编排（orchestrator 已支持多域）      │
└─────────────────────────────────────────────┘
```

**两层语义**：
- **上行（OPS → AI）**：OPS 的 AiChatModule / Workflow 把"需要 AI 决策/生成"的调用发给 AI 底座（`ai-base.provider` 是 OPS SkillGateway 的新 Provider，skill 类型扩展 `business-exec`）
- **下行（AI → OPS 业务）**：AI 底座在会话中把 OPS 业务操作作为**工具**调用（工具实现 = 调 OPS 的业务 API，凭证见 D2）

**会话归属原则**（关键）：**OPS 工具族只在"OPS 发起的会话"中可用**（token 含 `source=zhixiang-ops`）—— 管理 token 的会话看不见 OPS 工具，反之亦然。这样权限分域天然清晰（见 D2）。

---

## 四、D2 身份与租户（权限分清楚的核心）

### 4.1 三域身份模型

| 域 | 签发方 | issuer/audience | 载荷 |
|---|---|---|---|
| **管理域** | 管理系统 backend | zhixiang-system / zhixiang-client | `{id, roles[], tenantId}` |
| **平台域** | 管理系统 backend | zhixiang-platform / zhixiang-platform-client | `{id, username, type:'platform_admin'}`（无 tenantId）|
| **运营域** | OPS backend | zhixiang-ops / zhixiang-ops-client | `{id, role, tenantId(ops), type}` |

AI 底座**新增识别第三种**：运营 JWT（issuer=zhixiang-ops）。三域互不互认（与互通方案 §4.3 一致：禁止任意 issuer 放行）。

### 4.2 租户映射（AI 底座侧新增）

AI 底座建映射表（对应 OPS 的 `ops_tenant_bind`）：

```
t_ai_tenant_bind:
  ms_tenant_id  VARCHAR(64)   -- 管理系统租户（default/demo/…）
  ops_tenant_id VARCHAR(64)   -- 运营系统租户（t_dev/…）
  UNIQUE(ms_tenant_id), INDEX(ops_tenant_id)
```

- OPS 会话进来时：JWT tenantId（ops）→ 查映射 → **AI 底座内部统一租户 ID = ms_tenant_id**（保证审计/幂等/记忆的键与管理系统侧一致）
- 无映射的 ops 租户 ⇒ 拒绝（fail-closed）

### 4.3 权限分域矩阵（AI 底座视角）

| 会话来源 | 可见工具族 | 写全审核 | 幂等 | 审计归属 |
|---|---|---|---|---|
| 管理 JWT（商家） | 管理系统工具族（mgmt scope） | ✅ | ✅ | demo 租户 |
| 平台 JWT | 管理系统工具族（platform scope，可跨租户） | ✅ | ✅ | 平台操作者 |
| **运营 JWT（新增）** | **OPS 工具族（ops scope）** | ✅（同门，OPS 写操作同样过写全审核） | ✅（键含 ops 租户映射） | 映射回 ms_tenant |

**三条硬规则**：
1. 工具族按会话来源**互斥可见**（管理会话看不到 ops_create_*，反之亦然）—— 复用既有 `ToolScope` 机制（扩 `scope: 'ops'`）
2. OPS 写工具**一视同仁**走写全审核（preview → confirm）+ 幂等闸门 + 审计 —— 零豁免
3. 平台身份跨系统操作须**显式指定目标系统+租户**（无静默缺省）

---

## 五、D3 治理链覆盖（零豁免）

OPS 工具族进入 `ToolRegistry` 后，自动继承 `ToolExecutor` 全部治理（这是选 ToolRegistry 路线的最大收益）：

```
OPS 工具调用 → 写全审核门 → tenantId 校验（映射后）→ customerScope → 熔断
→ 幂等闸门（t_ai_idempotency，键含映射后租户）→ 执行（HTTP → 本地 OPS :3100）
→ 指标/审计 → 死信（fail-open 时）
```

需适配的两点：
1. **幂等键租户**：OPS 会话用映射后的 ms_tenant_id 入键（全局唯一，防跨系统键撞）
2. **死信/审计的来源标记**：`DeadLetterRecord`/审计日志补 `source_system` 字段（'zhixiang-ms' / 'zhixiang-ops'）—— 需一次 DDL（018）

## D4 命名空间与冲突

- OPS 工具统一前缀 `ops_`（如 `ops_create_topic`），管理系统工具保持现名 —— 与 `ToolRegistry` 的 name 唯一键天然隔离
- AI-25 的业务键机制对 OPS 工具同样适用（OPS 工具可声明 `idempotencyKeyFields`）

---

## 六、实施路线（四期，每期可独立验收）

| 期 | 内容 | 验收 |
|---|---|---|
| **P1 身份与映射**（AI 底座） | 识别运营 JWT（第三 issuer）+ `t_ai_tenant_bind` 映射（018 迁移）+ 会话来源标记 | OPS JWT 调 AI 底座任一端点 ⇒ 认证通过且租户映射正确；无映射租户被拒 |
| **P2 OPS 侧 Provider**（OPS 仓） | Skill Gateway 新增 `ai-base.provider`（skill 类型扩展 `business-exec`）+ 白名单/服务账号 | OPS AiChat 经 SkillGateway 调 `business-exec` ⇒ AI 底座收到并返回 |
| **P3 AI 底座 OPS 工具族**（AI 底座） | OPS 工具工厂（首批 3~5 个：选题/脚本/发布/查询）+ scope='ops' 会话互斥 | OPS 会话中 AI 可自主调 ops 工具；管理会话不可见 |
| **P4 治理与可观测** | 写全审核/幂等/审计覆盖 OPS 工具 + 死信 source_system（019 迁移）+ XLEN/审计报表分域 | OPS 写操作全程过治理链；审计可按系统分域查 |

**依赖与顺序约束**：P1 不依赖 OPS 改动（可先行）；P2 需 OPS 侧排期（跨线协作，同 S3-181-C 模式）；P3 依赖 P1+P2；P4 收尾。

## 七、风险与待业主确认项

| # | 事项 | 需要的输入 |
|---|---|---|
| 1 | **OPS 本地打包模式 vs AI 底座云端**：OPS → AI 走公网（OPS 主动出网）已满足；但**OPS 离线时** AI 底座的 ops 工具族全部不可用 —— 会话中需明确降级提示 | 确认"OPS 离线 ⇒ AI 自动摘除 ops 工具族"是否可接受 |
| 2 | **OPS 租户映射种子**：`ops_tenant_bind` 初始数据（ms 的 default/demo ↔ ops 的 t_dev？） | 需要租户对照清单 |
| 3 | **OPS 侧开发资源**：P2 要 OPS 仓改代码（跨线，同 S3-181-C 模式） | 排期与负责人 |
| 4 | **AiChatModule 与 AI 底座 /chat 的关系**：OPS 已有 AI 对话框后端，是否**替换**为 AI 底座 /chat（SSE）还是并存 | 产品口径 |
| 5 | 办公能力（已裁定最后做）—— 本设计**不预留**办公专属机制，但四类框架下办公工具可按同一范式接入 | 待办公规划清单 |

---

## 八、本设计不做什么（明确边界）

- **不做**办公能力规划（业主裁定最后做，另出清单）
- **不做** OPS 27 域工具的全量工具化（首批 3~5 个，按需扩）
- **不做**管理系统与 OPS 之间的数据互通（那是《互通规则方案 v1.1》的范畴，AI 底座只是消费方）
- **不改**管理系统侧既有对接（53+43 工具零变化）
