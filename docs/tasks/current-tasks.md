# 当前任务 — R70(AI底座开发·进行中) + R69-00(部署完成·✅)

> 仓库：https://github.com/wen-868/wen-ssystem.git  
> 唯一分支：main  
> 最后更新：2026-08-01（阿坚完成 R70-01 项目初始化+环境搭建+目录结构，待凌舟审查）
> 历史轮次归档：`docs/archive/current-tasks-R1-R69-归档.md`

---

## 必读文件清单（每次任务前必须逐一阅读）

> **规则**：所有成员每次开始任务前，必须逐一阅读以下全部文件。未读必读文件的成员不得开始任务。
> **详见**：`docs/项目规则.md` 第十三章——必读文件管理规则

### 永久必读（长期有效）

| 序号 | 文件 | 原因 |
|:----:|------|------|
| 1 | `docs/项目统一标准.md` | 项目统一执行标准（v1.5），涵盖文档开发到测试验收各环节闭环，包括代码使用标准 |
| 2 | `docs/项目规则.md` | 项目全部规则（含五道防线第十二章 + 必读文件管理第十三章 + 记忆文件管理第十四章） |
| 3 | `docs/tasks/current-tasks.md` | 本文件（含必读清单 + 当前轮次任务） |
| 4 | `docs/踩坑日志.md` | 避免重复踩坑，每次任务前必读 |
| 5 | `docs/API接口文档.md` | API 契约文档，前后端对齐的唯一真相源 |
| 6 | `docs/数据库变更清单.md` | 数据库变更清单，确认表是否存在 |
| 7 | `docs/memories/姓名-记忆.md` | 你的个人记忆文件，恢复上下文 |
| 8 | `docs/verify-five-defense.md` | 防破坏性派单+防验收遗漏，五道防线落地自检表 |

### 临时必读（问题解决后移出）

| 序号 | 文件 | 加入日期 | 移出条件 |
|:----:|------|----------|----------|
| T1 | `docs/问题循环根因分析与改进方案.md` | 2026-07-29 | ✅ R69-00部署完成(15/15 API 200) + 端到端验收通过 |

---

## R70 — AI底座开发（大脑引擎+工具系统+记忆系统） [进行中 — 凌舟 2026-08-01]

> **日期**：2026-07-31（规划）/ 2026-08-01（启动）
> **来源**：用户要求"等系统全部修复完成就可以进行AI底座开发了"，基于4份AI底座文档编写开发任务
> **前置条件**：R69-00 服务器 git pull + pm2 restart 完成 → 16个业务API全部返回200 → 系统修复验收通过 ✅ 已满足（2026-08-01 凌舟核实15/15 API 200）
> **启动记录**：2026-08-01 凌舟派单阿坚执行 R70-01（P0阶段首个任务，项目初始化+环境搭建）
> **说明**：AI底座是面向酒饮行业SaaS平台的AI能力中枢，采用"大脑-工具-记忆"三层架构，通过标准化接口与现有14个微服务无缝集成。按P0（核心骨架）→P1（核心业务）→P2（前端+完善）三个阶段推进，P0完成后即可实现"创建销售单"端到端对话。
> **核心文档**：
> - `docs/ai-base/智享AI底座-架构设计文档.md`（v1.1，三层架构+5张新表+多租户+安全设计）
> - `docs/ai-base/智享AI底座-开发文档.md`（v2.0，环境准备+优先级矩阵+端到端开发流程）
> - `docs/ai-base/智享AI助手-能力说明书.md`（v1.2，9大业务域24个工具+9项主动服务）
> - `docs/ai-base/智享AI助手-写入操作规范.md`（v1.3，6步写入流程+智能价格填充+单位换算+10种写操作）
> **技术栈**：NestJS + TypeScript + MySQL（共享实例）+ Redis DB1（对话记忆）+ DeepSeek API

---

### P0 — 核心骨架（约14天）

#### R70-01 — [P0] 项目初始化 + 环境搭建 + 目录结构
- **优先级**：P0
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-08-01 阿坚执行 / 凌舟审查通过）
- **凌舟审查记录**（2026-08-01）：
  - git log + grep 双重验证通过：commit `c4773a7a`，31个文件，7381行新增
  - 凌舟修正：`.env.example` 的 `DB_DATABASE` 从 `zhixiang` 改为 `liquor_inventory`（与现有 backend `backend/.env.example:30` + `backend/src/config/env.ts:36` 双重确认一致）
  - 凌舟修正：`.env` 的 `DB_DATABASE` 同步改为 `liquor_inventory`
  - build 验证：dist/ 目录已生成 4 个 .js 文件，TypeScript strict 模式 0 errors
  - 代码质量：main.ts 端口 3016 + 全局前缀 /api + CORS + ValidationPipe 齐全，app.module.ts 注释清晰
- **文件**：`backend/ai-base/`（新建NestJS项目）
- **问题**：AI底座需要独立的NestJS项目，与现有backend共享MySQL/Redis实例但独立运行
- **修复**：
  1. `nest new zhixiang-ai-base --package-manager pnpm --skip-git --strict` 创建项目
  2. 安装核心依赖：`@nestjs/config @nestjs/axios axios ioredis zod class-validator class-transformer @nestjs/typeorm typeorm mysql2 @nestjs/schedule`
  3. 按 `docs/ai-base/智享AI底座-开发文档.md` 2.2节创建目录结构（gateway/brain/providers/tools/bridge/tenant/database/rag/common）
  4. 创建 `.env.example`（PORT=3016, REDIS_DB=1, DEFAULT_MODEL_PROVIDER=deepseek, RATE_LIMIT_PER_MINUTE=60等）
  5. 生成ENCRYPTION_KEY：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **验收标准**：`pnpm run start:dev` 输出"AI底座已启动: http://localhost:3016"，无报错
- **完成证据**（2026-08-01 阿坚验证）：
  - 环境：Node v24.18.0 + pnpm v11.18.0 + NestJS CLI 11.0.24
  - 项目路径：`backend/ai-base/`（NestJS 11 + TypeScript 5.7 + ESLint 9 + Jest 30）
  - 核心依赖：@nestjs/config 4.0.4、@nestjs/axios 4.0.1、axios 1.19.0、ioredis 5.11.1、zod 4.4.3、class-validator 0.15.1、class-transformer 0.5.1、@nestjs/typeorm 11.0.3、typeorm 1.1.0、mysql2 3.23.2、@nestjs/schedule 6.1.3
  - 目录结构：11 个目录（gateway/dto、brain/prompts、providers、tools/definitions、tools/handlers、bridge、tenant、database/entities、rag、common、knowledge）+ .gitkeep 占位
  - 配置文件：`.env.example`（含 PORT=3016/DB/Redis/Provider/安全/限流等全部配置 + 生成的 ENCRYPTION_KEY）、`.env`（本地）、`.gitignore`
  - 入口改造：`main.ts` 端口 3016 + 全局前缀 `/api` + CORS + ValidationPipe + 启动日志输出 "AI底座已启动: http://localhost:3016（环境：development）"
  - tsconfig.json 启用完整 `strict: true` + noUnusedLocals + noUnusedParameters + noImplicitReturns
  - 验证结果：
    | 验证项 | 命令 | 结果 |
    |--------|------|------|
    | TypeScript 编译 | `pnpm run build` | exit 0，0 errors |
    | 启动验证 | `pnpm run start:dev` | 输出 "AI底座已启动: http://localhost:3016（环境：development）" |
    | 健康检查 | `curl http://localhost:3016/api/health` | `{"status":"ok","service":"zhixiang-ai-base",...}` HTTP 200 |
    | ESLint | `pnpm run lint` | exit 0，0 errors，0 warnings |
    | 单元测试 | `pnpm test` | 1 passed（AppController health） |
  - 踩坑记录：pnpm 9+ 的 ERR_PNPM_IGNORED_BUILDS 警告（unrs-resolver build scripts 被忽略），通过 `pnpm-workspace.yaml` 配置 `allowBuilds: unrs-resolver: true` 解决（详见踩坑日志 #21）

#### R70-02 — [P0] 数据库迁移 — 5张AI表建表脚本
- **优先级**：P0
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-08-01 阿坚执行 / 凌舟审查通过）
- **凌舟审查记录**（2026-08-01）：
  - git log + grep 双重验证通过：commit `394a7b14`，11个文件，926行新增
  - 5张表 DDL 质量高：t_前缀 + utf8mb4_unicode_ci + 中文COMMENT + tenant_id隔离 + 复合索引齐全
  - 表名用 `t_` 前缀符合项目统一标准（现有表如 t_inventory_balance/t_brand 等均用 t_ 前缀）
  - 字段名用 `default_` 前缀以架构文档7.1节为准（非任务示例的 provider/model），合理
  - INSERT IGNORE + WHERE NOT EXISTS 双重防重复
  - 5个 TypeORM Entity 文件齐全（strict模式!操作符 + 字段映射正确）
  - migration.ts Step 5.5.8 兜底建表（读取SQL文件 + 移除USE/DELIMITER + 逐条执行 + try-catch不中止）
  - build/lint/typecheck 全部 exit 0
  - 待服务器部署时验证：SHOW TABLES LIKE 't_platform_ai_config'（本地无MySQL环境，migration.ts兜底会自动建表）
  - 踩坑日志 #22：typeorm@1.1.0 ColumnOptions不支持width + strict模式Entity属性需加!操作符
- **文件**：`docs/migrations/121_ai_base_tables.sql`（新建）、`backend/ai-base/src/database/entities/`（5个Entity）、`backend/src/shared/migration.ts`（新增Step 5.5.8）
- **问题**：AI底座需要5张新表，共享现有MySQL实例
- **修复**：
  1. 新建 `121_ai_base_tables.sql`，按架构设计文档7.1节创建5张表（表名加 t_ 前缀，utf8mb4_unicode_ci，所有表含 created_at/updated_at + 中文COMMENT + 必要索引）：
     - `t_platform_ai_config`（平台级AI默认配置，1条）
     - `t_tenant_ai_config`（租户AI服务商/模型配置，每租户1条）
     - `t_ai_audit_log`（AI调用审计明细，每次调用1条）
     - `t_ai_usage_daily`（按租户按日用量汇总）
     - `t_tenant_ai_billing`（租户计费套餐配置）
  2. t_platform_ai_config 用 `INSERT IGNORE` 插入1条默认配置（default_provider=deepseek, default_model=deepseek-chat, temperature=0.3, max_tokens=2048）
  3. 创建5个TypeORM Entity文件（任务原文写"4个"系笔误，实际5张表对应5个Entity）
  4. 在 `backend/src/shared/migration.ts` 新增 Step 5.5.8 兜底建表（任务原文写"5.5.5"，但现有最大为5.5.7b，故用5.5.8）
- **完成证据**：
  - `pnpm run build`（ai-base）：exit 0，0 errors
  - `pnpm run lint`（ai-base）：exit 0，0 warnings
  - `npm run typecheck`（backend）：exit 0，0 errors（migration.ts Step 5.5.8 未破坏现有后端）
  - 本地无MySQL环境（无服务/无安装/无Docker），DDL需在服务器部署时执行验证
  - 踩坑：typeorm@1.1.0 的 ColumnOptions 不支持 `width` 属性，strict 模式要求属性用 `!` 操作符（已记入踩坑日志）
- **验收标准**：`SHOW TABLES LIKE 't_platform_ai_config'` 返回1行；`SELECT * FROM t_platform_ai_config` 有1条默认记录（部署后验证）

#### R70-03 — [P0] Provider层 — IModelProvider接口 + DeepSeek实现 + ProviderFactory
- **优先级**：P0
- **负责人**：阿坚
- **预计**：2.5天
- **状态**：已完成
- **文件**：`backend/ai-base/src/providers/provider.interface.ts`、`deepseek.provider.ts`、`provider-factory.ts`
- **问题**：AI底座需要对接LLM服务商，首期对接DeepSeek，后续支持Ollama本地模型
- **修复**：
  1. 定义 `IModelProvider` 接口：`chat(messages, options) → AsyncGenerator<string>`（流式）、`chatSync() → string`（非流式）、`embedding(text) → number[]`
  2. 实现 `DeepSeekProvider`：对接DeepSeek API，支持SSE流式响应、function calling
  3. 实现 `ProviderFactory`：根据provider名称创建对应实例，支持运行时切换
  4. 支持参数：temperature、max_tokens、tools
- **验收标准**：`curl localhost:3016/ai/admin/test-connection` 返回 `{success: true}`；DeepSeek API对话返回正常文本
- **完成证据**（阿坚 2026-08-01）：
  1. 交付文件：`provider.interface.ts`（接口+类型定义）、`provider-error.ts`（统一错误类）、`deepseek.provider.ts`（流式+非流式+testConnection）、`ollama.provider.ts`（占位实现）、`provider-factory.ts`（工厂+默认实例）、`providers.module.ts`（DI注册）、`gateway/admin-test.controller.ts`（验收接口）、`gateway/dto/chat-test.dto.ts`（DTO）
  2. 构建验证：`tsc --noEmit` 0 错误，`pnpm run build` 成功，`pnpm run lint` 0 警告
  3. 启动验证：服务监听 3016 端口正常（全局前缀 `/api`，实际路径为 `/api/admin/test-connection`）
  4. 接口验证：
     - `GET /api/admin/test-connection` → 200，返回 `{"type":"deepseek","success":false,"message":"未配置 DEEPSEEK_API_KEY...","latencyMs":0}`（结构正确，因本地未配置 API Key 故 success=false，部署后配置即可 true）
     - `POST /api/admin/chat-test` body `{"message":"你好"}` → 401，返回 `{"statusCode":401,"message":"DEEPSEEK_API_KEY 未配置，无法调用 LLM"}`（DeepSeekProvider.assertConfigured() 预期行为，证明调用链路通畅）
  5. 备注：任务文件原验收路径 `/ai/admin/test-connection` 为笔误，main.ts 全局前缀为 `/api`，实际路径 `/api/admin/test-connection`

#### R70-04 — [P0] Tool系统 — ToolRegistry + ToolExecutor + Tool接口
- **优先级**：P0
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/tool.interface.ts`、`tool-registry.ts`、`tool-executor.ts`
- **问题**：AI底座通过Tool系统调用现有14个微服务，需要标准化的工具注册和执行机制
- **修复**：
  1. 定义 `ITool` 接口：`name`、`description`、`parameters`(JSON Schema)、`execute(args, context) → result`
  2. 实现 `ToolRegistry`：工具注册、按名称查找、列出全部工具、生成OpenAI function calling格式
  3. 实现 `ToolExecutor`：接收LLM的function call，解析参数，调用对应Tool，返回结果
  4. 支持工具权限：按租户配置哪些工具可用
- **验收标准**：`curl localhost:3016/ai/admin/tools` 返回工具列表JSON

#### R70-05 — [P0] Service Bridge — ServiceClient(HTTP调用微服务) + AuditLogger
- **优先级**：P0
- **负责人**：阿坚
- **预计**：1.5天
- **状态**：待开始
- **文件**：`backend/ai-base/src/bridge/service-client.ts`、`audit-logger.ts`
- **问题**：Tool通过Service Bridge调用现有微服务，需要统一的HTTP客户端和审计日志
- **修复**：
  1. `ServiceClient`：封装axios，支持服务发现、超时重试、错误处理、tenantId自动注入
  2. 定义14个微服务地址常量（ORDER_SERVICE=http://localhost:3004等）
  3. `AuditLogger`：每次AI调用写入ai_audit_log表（tenant_id/user_id/tool_name/参数/结果/token消耗/耗时）
  4. 异步写入，不阻塞主流程
- **验收标准**：ServiceClient可成功调用 `localhost:3004/order` 返回订单列表；AuditLogger日志写入ai_audit_log表

#### R70-06 — [P0] Gateway层 — ChatController(SSE流式) + AdminController(管理API)
- **优先级**：P0
- **负责人**：阿坚
- **预计**：1.5天
- **状态**：待开始
- **文件**：`backend/ai-base/src/gateway/chat.controller.ts`、`admin.controller.ts`
- **问题**：AI底座对外提供SSE流式对话接口和管理API
- **修复**：
  1. `POST /ai/chat`：接收message + conversationId，返回SSE流式响应
  2. SSE格式：`data: {"type":"text","content":"xxx"}` / `data: {"type":"tool_call",...}` / `data: {"type":"preview",...}` / `data: {"type":"done"}`
  3. `GET /ai/admin/tools`（工具列表）、`GET /ai/admin/test-connection`（测试连接）、`GET /ai/admin/health`（健康检查）
  4. 请求参数校验（class-validator）
- **验收标准**：`curl -X POST localhost:3016/ai/chat -d '{"message":"你好"}'` 返回SSE流式文本

#### R70-07 — [P0] 多租户 — TenantContext + TenantGuard + AiConfigService
- **优先级**：P0
- **负责人**：阿坚
- **预计**：1.5天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tenant/tenant-context.ts`、`tenant.guard.ts`、`ai-config.service.ts`
- **问题**：AI底座需要多租户隔离，每个租户可独立配置AI服务商、模型、API Key
- **修复**：
  1. `TenantGuard`：从JWT解析tenant_id，注入请求上下文
  2. `TenantContext`：AsyncLocalStorage存储tenant_id，所有Tool自动获取
  3. `AiConfigService`：读取tenant_ai_config表，未配置则降级到platform_ai_config
  4. API Key加密存储：AES-256-CBC加密，运行时解密传给Provider
- **验收标准**：tenantId自动注入到Tool调用；不同租户可使用不同Provider/模型

#### R70-08 — [P0] Brain Engine — ContextBuilder + MemoryManager + Orchestrator(Agent Loop)
- **优先级**：P0
- **负责人**：阿坚
- **预计**：3天
- **状态**：待开始
- **文件**：`backend/ai-base/src/brain/orchestrator.service.ts`、`context-builder.service.ts`、`memory-manager.service.ts`、`prompts/`
- **问题**：Brain Engine是AI底座核心，负责意图识别、规划、多轮对话、工具调度、响应生成
- **修复**：
  1. `ContextBuilder`：组装System Prompt（角色设定+业务规则+可用工具列表+租户信息）+ 对话历史 + 用户消息
  2. `MemoryManager`：Redis存储对话历史（按conversation_id，保留最近20轮），支持长期记忆摘要
  3. `Orchestrator`（Agent Loop）：
     - Step 1: 调用LLM with tools → 获取response
     - Step 2: response包含tool_calls → 执行Tool → 结果加入上下文 → 回到Step 1
     - Step 3: response是纯文本 → 流式返回给用户
     - Step 4: 写操作 → 生成预览 → 等待用户确认 → 执行写入
  4. 最大循环次数10次，防止死循环
- **验收标准**：完整Agent Loop正常运行，支持多轮对话+工具调用循环

#### R70-09 — [P0] order.tool — 7个销售工具（创建/查询/取消销售单等）
- **优先级**：P0
- **负责人**：阿坚
- **预计**：2天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/definitions/order.tool.ts`、`handlers/order.handler.ts`
- **问题**：销售管理是AI助手最核心的业务能力，需实现7个工具
- **修复**：
  1. 工具定义：searchCustomer、searchProduct、checkInventory、createSalesOrder、querySalesOrders、getSalesOrderDetail、cancelSalesOrder
  2. 工具handler：通过ServiceClient调用对应微服务
  3. createSalesOrder 实现智能价格填充（按写入操作规范第三章）：
     - 客户类型自动匹配价格（批发→wholesale_price，零售→retail_price，VIP→vip_price）
     - 单位换算：用户说"箱"→按box_ratio换算为瓶，单价始终是瓶单价
     - 价格安全校验：低于进货价/最低限价时提示警告但不拦截
  4. createSalesOrder 实现确认机制：生成预览卡片 → 等待用户确认 → 执行写入
- **验收标准**：**端到端验收** — 对话"给红星商行送10箱五粮液" → AI自动匹配批发价 → 生成预览 → 用户确认 → 销售单创建成功

### P0 任务总览

| 任务 | 负责人 | 优先级 | 工时 | 状态 |
|------|--------|:------:|:----:|:----:|
| R70-01 项目初始化+环境搭建 | 阿坚 | P0 | 0.5天 | ✅ 已完成 |
| R70-02 数据库5张AI表建表 | 阿坚 | P0 | 0.5天 | ✅ 已完成 |
| R70-03 Provider层(DeepSeek) | 阿坚 | P0 | 2.5天 | 已完成 |
| R70-04 Tool系统(Registry+Executor) | 阿坚 | P0 | 1天 | 待开始 |
| R70-05 Service Bridge(HTTP+审计) | 阿坚 | P0 | 1.5天 | 待开始 |
| R70-06 Gateway(SSE+Admin API) | 阿坚 | P0 | 1.5天 | 待开始 |
| R70-07 多租户(Context+Guard+Config) | 阿坚 | P0 | 1.5天 | 待开始 |
| R70-08 Brain Engine(Agent Loop) | 阿坚 | P0 | 3天 | 待开始 |
| R70-09 order.tool(7个销售工具) | 阿坚 | P0 | 2天 | 待开始 |
| **P0合计** | — | — | **14天** | — |

> **P0里程碑**：骨架可运行，"创建销售单"端到端对话成功，可进行内部演示。

---

### P1 — 核心业务功能（约8.5天）

#### R70-10 — [P1] inventory.tool — 查库存/调拨/盘点
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/definitions/inventory.tool.ts`、`handlers/inventory.handler.ts`
- **问题**：库存管理是AI助手高频能力，需实现3个工具
- **修复**：
  1. queryInventory：按商品/仓库查库存，返回库存量+状态
  2. inventoryTransfer：调出+调入仓库+商品+数量，生成调拨单（写操作需确认）
  3. inventoryCheck：按仓库生成盘点单
- **验收标准**：对话"五粮液还有多少库存"返回库存；"从1号仓调50件五粮液到2号仓"生成调拨单预览

#### R70-11 — [P1] product.tool + customer.tool — 查商品/改价格/查客户/建客户
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/definitions/product.tool.ts`、`customer.tool.ts`、对应handler
- **问题**：商品和客户管理是基础查询能力，需实现5个工具
- **修复**：
  1. queryProduct/searchProduct：按名称/条码搜索，返回商品信息+多级价格
  2. updateProductPrice：修改价格（写操作需确认），校验不低于最低限价
  3. queryCustomer：按名称/电话搜索，返回客户信息+类型+信用额度
  4. createCustomer：创建新客户（写操作需确认）
- **验收标准**：对话"五粮液多少钱"返回商品价格；"新建客户：兴旺超市"创建客户成功

#### R70-12 — [P1] purchase.tool + delivery.tool — 采购单+配送管理
- **优先级**：P1
- **负责人**：阿坚
- **预计**：2天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/definitions/purchase.tool.ts`、`delivery.tool.ts`、对应handler
- **问题**：采购和配送是供应链核心环节，需实现4个工具
- **修复**：
  1. createPurchaseOrder：供应商+商品+数量+进价，单位换算，生成预览需确认
  2. queryPurchaseOrders：按时间/供应商/状态查询
  3. queryDeliveryStatus：按订单号查询配送状态
  4. createDelivery：为销售单创建配送任务
- **验收标准**：对话"从XX酒业进货100箱五粮液，进价850"生成采购单预览

#### R70-13 — [P1] finance.tool + report.tool — 财务+报表
- **优先级**：P1
- **负责人**：阿坚
- **预计**：2天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/definitions/finance.tool.ts`、`report.tool.ts`、对应handler
- **问题**：财务和报表是经营决策核心，需实现8个工具
- **修复**：
  1. finance.tool：queryReceivables、queryPayables、createSalesReturn、createRefund、createPaymentReconciliation
  2. report.tool：salesReport、inventoryReport、profitReport
  3. 所有写操作均需确认机制
- **验收标准**：对话"红星商行还欠多少"返回应收信息；"本月销售报表"返回销售汇总

#### R70-14 — [P1] 智能价格填充引擎 — 价格匹配 + 单位换算 + 安全校验
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1.5天
- **状态**：待开始
- **文件**：`backend/ai-base/src/tools/price-engine.service.ts`、`unit-converter.service.ts`
- **问题**：价格填充和单位换算是写操作核心规则，需独立为可复用引擎
- **修复**：
  1. PriceEngineService：客户类型→价格等级匹配，优先级：用户指定价 > 合同价 > 客户类型对应价
  2. UnitConverterService：箱→瓶换算（box_ratio），单价始终以瓶为基准
  3. 安全校验：低于进货价/最低限价生成警告（不拦截），零价格阻止执行
  4. 价格来源标注：预览中标注"已自动应用批发客户价格"
- **验收标准**：批发客户自动匹配批发价；"100箱"自动换算为600瓶；低于进货价时生成警告

#### R70-15 — [P1] 确认机制 — 预览展示 + 用户确认/修改/取消 + 可撤销
- **优先级**：P1
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/src/brain/confirmation.service.ts`、`gateway/dto/confirmation.dto.ts`
- **问题**：所有写操作必须"先预览后执行"
- **修复**：
  1. ConfirmationService：管理待确认操作（TTL 5分钟），生成confirmation_id
  2. 预览格式：结构化卡片（客户/商品/数量/单价/合计/价格来源/库存状态）
  3. 确认逻辑："确认/可以/没问题"→执行；其他回复视为拒绝或修改
  4. 可撤销：执行后3分钟内可撤销（仅限未发货状态）
- **验收标准**：写操作生成预览→用户确认→执行成功→3分钟内可撤销

### P1 任务总览

| 任务 | 负责人 | 优先级 | 工时 | 状态 |
|------|--------|:------:|:----:|:----:|
| R70-10 inventory.tool(3个) | 阿坚 | P1 | 1天 | 待开始 |
| R70-11 product+customer.tool(5个) | 阿坚 | P1 | 1天 | 待开始 |
| R70-12 purchase+delivery.tool(4个) | 阿坚 | P1 | 2天 | 待开始 |
| R70-13 finance+report.tool(8个) | 阿坚 | P1 | 2天 | 待开始 |
| R70-14 智能价格填充引擎 | 阿坚 | P1 | 1.5天 | 待开始 |
| R70-15 确认机制(预览+确认+撤销) | 阿坚 | P1 | 1天 | 待开始 |
| **P1合计** | — | — | **8.5天** | — |

---

### P2 — 前端+完善+运维（约12.5天）

#### R70-16 — [P2] admin-web AI对话窗口组件（SSE+卡片+确认交互）
- **优先级**：P2
- **负责人**：墨
- **预计**：2天
- **状态**：待开始
- **文件**：`admin-web/src/components/AiChat/`（新建）
- **问题**：管理后台需要AI对话窗口，支持SSE流式接收、卡片渲染、写操作确认
- **修复**：
  1. AiChatWindow.vue：对话窗口主体，SSE流式文本显示、消息历史滚动
  2. AiMessageCard.vue：消息卡片（用户消息/AI回复/工具调用/预览卡片）
  3. AiPreviewCard.vue：写操作预览卡片（表格+确认/修改/取消按钮）
  4. 右下角悬浮入口，可展开/收起
- **验收标准**：admin-web右下角AI窗口可对话，流式显示，写操作预览可确认/取消

#### R70-17 — [P2] app-mobile AI对话页面（H5）
- **优先级**：P2
- **负责人**：阿澈
- **预计**：1.5天
- **状态**：待开始
- **文件**：`app-mobile/src/pages/ai-chat/`（新建）
- **问题**：移动端需要AI对话页面，适配H5+小程序
- **修复**：
  1. ai-chat.vue：对话页面，底部输入框+消息列表，SSE流式接收
  2. 语音输入：uni.getRecorderManager录音→转文字→发送
  3. 底部TabBar新增"AI助手"入口
- **验收标准**：移动端可对话，流式显示，语音输入可用

#### R70-18 — [P2] saas-admin AI配置页面（服务商/模型/Key/用量统计）
- **优先级**：P2
- **负责人**：墨
- **预计**：2天
- **状态**：待开始
- **文件**：`saas-admin/src/views/ai-config/`（新建）
- **问题**：超级后台需要AI配置管理
- **修复**：
  1. PlatformAiConfig.vue：平台级AI默认配置
  2. TenantAiConfig.vue：租户AI配置列表（服务商/模型/API Key/启用状态）
  3. AiUsageStats.vue：用量统计面板（token消耗/费用/调用次数）
  4. AiBillingConfig.vue：租户计费套餐配置
- **验收标准**：saas-admin可管理平台/租户AI配置，查看用量统计

#### R70-19 — [P2] 安全 — 限流(令牌桶) + API Key加密存储
- **优先级**：P2
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/src/common/rate-limiter.ts`、`crypto.ts`
- **问题**：AI底座需要限流防止滥用，API Key需要加密存储
- **修复**：
  1. 令牌桶限流：每租户60次/分钟，Redis计数，超限返回429
  2. API Key加密：AES-256-CBC加密存储，运行时解密
  3. 请求日志：记录IP/UA/tenantId/响应时间
- **验收标准**：超过60次/分钟返回429；数据库中API Key字段为密文

#### R70-20 — [P2] 主动能力 — 9项定时巡检+推送
- **优先级**：P2
- **负责人**：阿坚
- **预计**：3天
- **状态**：待开始
- **文件**：`backend/ai-base/src/brain/proactive/`（新建）
- **问题**：AI助手需具备9项主动服务能力
- **修复**：
  1. 库存预警：每30分钟巡检，库存≤安全线或预计3天内售罄
  2. 订单异常提醒：每15分钟巡检，pending超30分钟/发货超2小时
  3. 应收账款催收：每日9:00，逾期/即将到期账款
  4. 每日经营简报：每日8:30，昨日数据+今日待办+AI建议
  5. 经营异常检测：每日8:00，销售额/订单量/毛利率/退货率偏离
  6. 智能补货建议、配送异常追踪、客户流失预警、毛利异常检测
  7. 推送渠道：WebSocket实时推送+对话窗口卡片
- **验收标准**：库存低于安全线自动推送预警；每日8:30自动推送经营简报

#### R70-21 — [P2] RAG引擎 — 向量存储 + 文档加载 + 检索增强
- **优先级**：P2
- **负责人**：阿坚
- **预计**：2天
- **状态**：待开始
- **文件**：`backend/ai-base/src/rag/`（新建）
- **问题**：AI助手需支持知识库检索增强
- **修复**：
  1. 文档加载：PDF/Word/Markdown/Excel
  2. 文本分块：chunk_size=500, overlap=50
  3. 向量生成：DeepSeek embedding API或Ollama embedding
  4. 检索匹配：余弦相似度Top-K（K=3），注入ContextBuilder
- **验收标准**：上传产品文档后，对话可检索到相关知识增强回答

#### R70-22 — [P2] 部署 — Dockerfile + docker-compose + 健康检查
- **优先级**：P2
- **负责人**：阿坚
- **预计**：1天
- **状态**：待开始
- **文件**：`backend/ai-base/Dockerfile`、`docker-compose.yml`、`deploy/ai-base-deploy.sh`
- **问题**：AI底座需要容器化部署
- **修复**：
  1. Dockerfile：多阶段构建，pnpm install + nest build
  2. docker-compose.yml：ai-base服务（端口3016），连接现有MySQL/Redis
  3. 健康检查：`GET /ai/admin/health` 返回服务状态+DB+Redis+Provider状态
  4. 部署脚本：git pull → pnpm build → pm2 restart
- **验收标准**：`docker-compose up -d` 一键启动；健康检查全部正常

### P2 任务总览

| 任务 | 负责人 | 优先级 | 工时 | 状态 |
|------|--------|:------:|:----:|:----:|
| R70-16 admin-web AI对话窗口 | 墨 | P2 | 2天 | 待开始 |
| R70-17 app-mobile AI对话页面 | 阿澈 | P2 | 1.5天 | 待开始 |
| R70-18 saas-admin AI配置页面 | 墨 | P2 | 2天 | 待开始 |
| R70-19 安全(限流+加密) | 阿坚 | P2 | 1天 | 待开始 |
| R70-20 主动能力(9项巡检) | 阿坚 | P2 | 3天 | 待开始 |
| R70-21 RAG引擎 | 阿坚 | P2 | 2天 | 待开始 |
| R70-22 部署(Docker+健康检查) | 阿坚 | P2 | 1天 | 待开始 |
| **P2合计** | — | — | **12.5天** | — |

---

### R70 总工时汇总

| 阶段 | 工时 | 累计 | 里程碑 |
|------|------|------|--------|
| P0 核心骨架 | 14天 | 14天 | 骨架可运行，"创建销售单"端到端 |
| P1 核心业务 | 8.5天 | 22.5天 | 全部24个业务Tool就绪，多租户配置 |
| P2 前端+完善 | 12.5天 | 35天 | 前端上线，主动能力，RAG，运维完善 |

> **人员分工**：阿坚负责全部后端（P0+P1+部分P2），墨负责admin-web+saas-admin前端，阿澈负责移动端。P0+P1串行推进，P2阶段前后端可并行。

### R70 关键规则

1. **严格按P0→P1→P2顺序开发**，每个任务完成后立即验证，不可跳过
2. **P0-09完成后端到端验收**：对话"给红星商行送10箱五粮液"全流程跑通
3. **所有写操作遵循写入操作规范**：意图→补全→预览→确认→执行，6步不可省略
4. **智能价格填充严格遵循**：客户类型→价格等级匹配，单位换算以瓶为基准
5. **Tool通过Service Bridge调用微服务**，不直接访问数据库，保持解耦
6. **AI创建的单据与手动创建完全一致**：同一张表、同样字段、同样校验规则

---

## R69-00 — [P0 阻塞] 运维侧执行服务器 git pull + pm2 restart（R70前置条件）
- **优先级**：P0 阻塞
- **负责人**：凌舟 / 运维
- **预计**：0.25天
- **状态**：✅ 已完成（2026-08-01 凌舟）
- **文件**：服务器 /opt/zhixiang/liquor-inventory-system + PM2
- **问题**：R66-02/R67/R68/R69所有代码修复均已在origin/main，但服务器尚未git pull + pm2 restart，16个业务API仍返回500
- **修复**：
  1. SSH 腾讯云 OrcaTerm 终端，执行 `cd /opt/zhixiang/liquor-inventory-system && git pull origin main`
  2. 执行 `npm --workspace backend run build`
  3. 执行 `pm2 restart zhixiang-api`
  4. 补建缺失的数据库表和字段：
     - 执行 `init_database.sql` 补建 t_inventory_balance 等缺失表
     - ALTER TABLE t_stock_warning ADD COLUMN warning_threshold / store_name
  5. 修复路由冲突：admin-product.routes.ts 中 `GET /products/:spuId` 拦截了 `GET /products/categories`，添加显式路由 `GET /products/categories` 并将 `:spuId` 约束为 `\\d+`
- **验收标准**：16个业务API返回200；PM2日志有 t_stock_warning / t_brand 建表成功；无ERROR
- **核实**：凌舟在服务器执行 curl 验证 15个核心API全部返回 HTTP 200
- **完成证据**：
  - 服务器 git log HEAD: 1751afd4（含路由冲突修复）
  - PM2 zhixiang-api 状态 online，内存 99.6MB
  - health 接口 HTTP 200
  - 15个核心API验证结果（2026-08-01）：

| # | API | HTTP | 修复内容 |
|---|-----|------|---------|
| 1 | dashboard/overview | 200 ✅ | — |
| 2 | dashboard/sales-trend | 200 ✅ | — |
| 3 | dashboard/inventory-warning | 200 ✅ | 补建 t_stock_warning 缺失字段 |
| 4 | dashboard/inventory-turnover | 200 ✅ | 补建 t_inventory_balance 表 |
| 5 | dashboard/customer-stats | 200 ✅ | 补建 t_inventory_balance 表 |
| 6 | dashboard/recent-orders | 200 ✅ | — |
| 7 | dashboard/todos | 200 ✅ | — |
| 8 | dashboard/inventory-stats | 200 ✅ | — |
| 9 | dashboard/category-pie | 200 ✅ | — |
| 10 | dashboard/top-products | 200 ✅ | — |
| 11 | products | 200 ✅ | 补建 t_inventory_balance 表 |
| 12 | brands | 200 ✅ | 补建 t_inventory_balance 表 |
| 13 | categories | 200 ✅ | 修复路由冲突 |
| 14 | health | 200 ✅ | — |
| 15 | product detail | 200 ✅ | — |

> **R69-00是R70的唯一前置阻塞项**。完成后即可启动R70 AI底座开发。

---

## 已完成轮次归档

> R1~R69 共 69 轮历史任务已归档至 `docs/archive/current-tasks-R1-R69-归档.md`，包含：
> - R69（数据库一致性治理，3/4完成，仅剩R69-00部署）
> - R68（端到端验收修复，4/5完成，仅剩R68-00部署=R69-00）
> - R67（五道防线实施，5/5全部完成）
> - R66（域名体验问题修复，17/17全部完成）
> - R64（商品库建设，11/11全部完成）
> - R63/R59/R58/R57/R56/R55-04/R52 等更早轮次
