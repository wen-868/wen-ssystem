# 当前任务

> 唯一任务文件，所有团队成员读取此文件获取任务。  
> 凌舟维护，每次分派新增轮次。  
> 最后更新：2026-07-05

---

## 历史轮次

### R1~R6 — 2026-07-05 修复补丁轮次 [全部已完成]

> 苏然测试报告 → 凌舟验收 → 阿坚修复 → 墨前端字段 → 两轮返工。  
> 39 个任务全部完成，零待办。

---

## R7 — 2026-07-05 全局标准化整改 [进行中]

> 来源：凌舟对照《AI开发大型SaaS项目全局统一标准化方案》对项目做全量审计。  
> 发现根本问题：项目长期修修补补，全局配置不统一、分层混乱、命名不一致、公共工具重复、业务约束未全局应用。  
> 这不是某个模块的 bug，而是**全局架构债务**。需要系统性整改。

---

## 审计结论

项目当前状态 vs 标准化方案要求，差距分为三级：

### 严重（P0）— 不改则系统存在数据泄露/功能失效风险

| 编号 | 问题 | 影响 |
|:---:|------|------|
| S1 | 价格守卫（price-guard）仅用于 price.routes.ts，其他路由手写 WHOLESALE 判断 | 价格越权泄露 |
| S2 | 追溯码未嵌入出入库业务流程，入库/出库不自动绑定追溯码 | 追溯系统形同虚设 |
| S3 | 两套 makeBizNo 实现（biz-no.ts vs id.ts），编号格式不一致 | 数据混乱 |
| S4 | init_database.sql 中 62 张表全部缺失 tenant_id | 多租户隔离失效 |
| S5 | Controller 直接操作数据库（wechat、notification） | 分层违规 |

### 重要（P1）— 架构混乱导致修修补补恶性循环

| 编号 | 问题 | 影响 |
|:---:|------|------|
| S6 | 缺少 config/ 目录，配置散落在 shared/ 中 | 配置管理混乱 |
| S7 | 缺少 middleware/ 目录，中间件混在 shared/ 中 | 分层混乱 |
| S8 | 返回体字段名 message 应改为 msg；缺少 traceId/apiCost | 前后端交互不统一 |
| S9 | 数据库表全部缺少 t_ 前缀（0% 符合） | 命名不统一 |
| S10 | WHOLESALE/RETAIL 价格判断逻辑重复 3 处 | 代码冗余 |
| S11 | 订单创建流程重复 3 处（miniapp/checkout、admin/cart、miniapp.service） | 代码冗余 |
| S12 | 6 个 Controller 共 29 处直接 res.json 绕过统一返回函数 | 返回格式不统一 |
| S13 | 无存储容量检测/超限拦截 | 租户超配额 |
| S14 | 无历史单据归档/删除机制 | 数据无限增长 |

### 一般（P2）— 影响可维护性

| 编号 | 问题 | 影响 |
|:---:|------|------|
| S15 | 16 处硬编码业务参数（365天、12瓶/箱、5000条导出上限等） | 改参数需改代码 |
| S16 | 缺少集中业务配置常量模块 | 配置分散 |
| S17 | 追溯码解析逻辑未抽取为公共工具函数 | 复用性差 |
| S18 | 路由中动作动词嵌入 URL（submit/approve/cancel 等） | 非 RESTful |

---

## 任务分派

### 第一阶段：基础设施（阿坚，预计 5 天）

#### R7-1 创建 config/ 目录，迁移所有配置
- 优先级：P1
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：新建 `backend/src/config/` 目录
- 问题：配置散落在 shared/ 中（db 连接、微信支付、Redis、环境变量），租户配额/API计费/权限开关配置缺失
- 修复：
  1. 新建 `config/database.ts`、`config/wechat-pay.ts`、`config/redis.ts`、`config/env.ts`
  2. 从 shared/ 迁移对应配置
  3. 新建 `config/tenant.ts`（配额常量）、`config/api-billing.ts`（计费配置）、`config/permission.ts`（权限开关）
  4. 新建 `config/constants.ts`（集中管理所有硬编码业务参数：箱规、导出上限、告警阈值、默认天数等）

#### R7-2 创建 middleware/ 目录，迁移所有中间件
- 优先级：P1
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：新建 `backend/src/middleware/` 目录
- 问题：租户隔离、价格权限、Token 鉴权、错误处理等中间件混在 shared/ 中
- 修复：
  1. 从 shared/ 迁移：`auth.ts` → `middleware/auth.ts`，`tenant.ts` → `middleware/tenant.ts`，`price-guard-middleware.ts` → `middleware/price-guard.ts`，`error-handler.ts` → `middleware/error-handler.ts`，`async-handler.ts` → `middleware/async-handler.ts`
  2. 更新所有 import 路径

#### R7-3 统一返回体：message→msg，补充 traceId/apiCost
- 优先级：P1
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：`backend/src/shared/response.ts` + 全局替换
- 问题：返回体字段名 `message` 与标准 `msg` 不符；缺少 traceId 和 apiCost 字段
- 修复：
  1. `ok()` 和 `fail()` 中 `message` 改为 `msg`
  2. 新增 `traceId`（UUID）和 `apiCost` 字段
  3. 全局搜索替换所有 `{ code, message` 为 `{ code, msg`（约 29 处 + 路由文件中的直接返回）
  4. 6 个 Controller 中 29 处直接 res.json 改为调用 ok/fail

#### R7-4 统一 makeBizNo：合并 biz-no.ts 和 id.ts
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：`backend/src/shared/biz-no.ts`、`backend/src/shared/id.ts`
- 问题：两套编号生成逻辑，格式不一致
- 修复：统一为 id.ts 的 crypto.randomBytes 方式，删除 biz-no.ts，更新 4 个引用文件

#### R7-5 Controller 去数据库操作
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：`backend/src/controllers/wechat.controller.ts`、`backend/src/controllers/notification.controller.ts`
- 问题：wechat 直接执行 SQL，notification 直接传递 pool 对象
- 修复：将数据库逻辑下沉到 service 层

#### R7-6 价格守卫全局应用
- 优先级：P0
- 负责人：阿坚
- 预计：1.5天
- 状态：待开始
- 文件：product.routes.ts、admin-order.routes.ts、store.routes.ts、miniapp.routes.ts、export.routes.ts
- 问题：price-guard 仅用于 price.routes.ts，其他路由手写 WHOLESALE 判断
- 修复：
  1. 将 price-guard 中间件应用到所有价格敏感路由
  2. 删除服务层中手写的 `customerType === "WHOLESALE"` 判断（3 处重复）
  3. 统一使用 price-guard 的 `requirePriceFieldAccess` 和 `requirePriceLevelAccess`

---

### 第二阶段：业务约束统一（阿坚 + 墨 + 阿澈，预计 7 天）

#### R7-7 追溯码嵌入出入库业务流程
- 优先级：P0
- 负责人：阿坚
- 预计：2天
- 状态：待开始
- 文件：`backend/src/services/admin/purchase-in-stock.service.ts`、`backend/src/services/admin/sale-bill.service.ts`、`backend/src/services/store/order.service.ts`
- 问题：追溯码生成是独立 API，出入库不会自动绑定/更新追溯码状态
- 修复：
  1. 入库时自动生成/绑定追溯码，写入 trace_event_log
  2. 出库时自动更新追溯码状态，记录流向
  3. 合并 `verifyTraceCode` 和 `consumerVerifyTraceCode` 重复逻辑

#### R7-8 订单创建流程统一
- 优先级：P1
- 负责人：阿坚
- 预计：1.5天
- 状态：待开始
- 文件：miniapp/checkout.service.ts、admin/cart.service.ts、miniapp.service.ts
- 问题：三个文件各自实现完整下单流程（批发跳过支付、ACCOUNT 结算、库存锁定），重复 3 处
- 修复：统一到 shared/fulfillment.ts 中，三个文件仅调用统一入口

#### R7-9 存储容量检测 + 超限拦截
- 优先级：P1
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：新建 `backend/src/shared/storage-guard.ts` + 中间件注册
- 问题：subscription_plan 表有 max_storage_mb 字段，但无任何实际检测/拦截
- 修复：实现存储容量检测工具，在文件上传/数据写入前检查，超限弹窗提醒

#### R7-10 历史单据归档机制
- 优先级：P1
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：新建 `backend/src/services/admin/archive.service.ts`
- 问题：无历史数据归档/删除机制，数据无限增长
- 修复：实现归档服务（标记 archived 状态 + CSV 导出 + 可选物理删除），支持销售单/采购单/对账单

#### R7-11 商品信息表单整合品牌/分类/单位下拉
- 优先级：P1
- 负责人：墨
- 预计：0.5天
- 状态：待开始
- 文件：`admin-web/src/views/Products.vue`
- 问题：R4-1 补了 14 个字段的输入框，但 brand/unit/specs 应改用下拉选择（从品牌表/单位表读取），而非自由文本
- 修复：brand 改为 el-select 从品牌 API 加载；unit 改为 el-select 从单位 API 加载

---

### 第三阶段：数据库规范（可后续迭代，非紧急）

#### R7-12 数据库表加 t_ 前缀
- 优先级：P1
- 负责人：阿坚
- 预计：3天
- 状态：待开始（后续迭代）
- 文件：docs/init_database.sql + docs/migrations/*.sql
- 问题：160+ 张表全部缺少 t_ 前缀（0% 符合规范）
- 修复：全量 RENAME TABLE，更新所有后端代码中的表名引用
- 注意：需停机维护窗口，涉及大量回归测试

#### R7-13 init_database.sql 补 tenant_id
- 优先级：P0
- 负责人：阿坚
- 预计：1天
- 状态：待开始（后续迭代）
- 文件：docs/init_database.sql
- 问题：62 张基础表全部缺失 tenant_id
- 修复：为所有基础表 ALTER TABLE ADD tenant_id，更新 init_database.sql

---

## 汇总

| 阶段 | 任务 | 负责人 | 预计 |
|:---:|------|:---:|:---:|
| 一 | R7-1~R7-6 基础设施 | 阿坚 | 5 天 |
| 二 | R7-7~R7-10 业务约束 | 阿坚 | 5.5 天 |
| 二 | R7-11 商品品牌下拉 | 墨 | 0.5 天 |
| 三 | R7-12~R7-13 数据库规范 | 阿坚 | 4 天（后迭代） |
| **合计** | **13 个任务** | | **第一阶段 5.5 天，第二阶段 6 天，第三阶段 4 天** |