# 项目全局记忆 · 智享全链管理系统

> 本文件是项目的全局记忆中枢，所有团队成员和 AI 助手在读仓库时应首先读取此文件。
> 最后更新：2026-06-30

---

## 一、项目概况

| 项目 | 内容 |
|------|------|
| 项目名 | 智享全链管理系统（酒水行业 SaaS） |
| 仓库 | GitHub: wen-868/wen-ssystem |
| 技术栈 | 后端 Node.js+Express+MySQL，管理后台 Vue3+Element Plus，商户移动端 Vue3+Vant，门店终端 Vue3 |
| 产品规格 | `docs/product-spec-v6-adapted.md`（12个一级分类，106个二级模块，~4140字段，217张表） |
| 部署文档 | `docs/DEPLOY.md` |

---

## 二、仓库结构

```
liquor-inventory-system/
├── backend/              # 后端 API
│   └── src/
│       ├── routes/       # 48 个路由文件
│       ├── controllers/  # 52 个控制器
│       ├── services/     # 73 个服务
│       └── server.ts     # 入口
├── admin-web/            # 管理后台（54个视图）
├── merchant-mobile/      # 商户移动端（34个视图）
├── store-terminal/       # 门店终端（11个视图）
├── docs/                 # 产品规格、API文档、数据库Schema
│   └── migrations/       # 数据库迁移脚本
├── tasks/                # 唯一任务文件目录（4人各1份 + 1份审计报告）
│   ├── tasks-墨.md       # 墨的任务
│   ├── tasks-阿坚.md     # 阿坚的任务
│   ├── tasks-阿澈.md     # 阿澈的任务
│   ├── tasks-林夕.md     # 林夕的任务
│   └── field-audit-product-center.md  # 字段审计报告
├── saas-admin/           # 平台总后台（待开发）
├── miniapp/              # 小程序（待开发）
└── README.md
```

---

## 三、团队与分工

| 成员 | 职责 | 当前状态 |
|------|------|---------|
| 凌舟 | 项目管理、代码审计、任务分配 | — |
| 林夕 | UI/UX 设计师 | 全部模块已完成 ✅ |
| 墨 | 管理后台 admin-web 前端 | 全部模块已完成 ✅ |
| 阿坚 | 后端 API | 全部模块已完成 ✅ |
| 阿澈 | 商户移动端 merchant-mobile 前端 | 全部模块已完成 ✅ |
| 苏然 | 测试工程师 / DAO 层 | 全部模块已完成 ✅ |

---

## 四、开发节奏

1. **按一级模块纵向推进**：一个模块做完再做下一个（设计稿→后端→前端→联调）
2. **模块顺序**：商品中心 ✅ → 销售管理 ✅ → 采购管理 ✅ → 库存管理 ✅ → 客户管理 ✅ → 财务往来 ✅ → 数据报表 ✅ → 营销中心 ✅ → 即时零售 ✅ → 订单管理 ✅ → 系统设置 ✅ → 工作总台 ✅
3. **每轮流程**：任务分解 → 分发 → 林夕出设计稿 → 阿坚后端 → 墨+阿澈前端 → 审计验收 → 合并推送 → 下一轮
4. **设计稿提前**：林夕的设计稿需提前 1 天交付，避免阻塞前端开发
5. **验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证，无遗漏

---

## 五、任务文件管理规则

1. **唯一任务目录**：`tasks/`，只有 4 份任务文件 + 1 份审计报告
2. **根目录禁止**：不许在根目录放 tasks-*.md、ASSIGNMENT.md、MEMORY.md 等任何任务/管理文件
3. **文件命名**：`tasks/tasks-{人名}.md`
4. **状态更新**：每完成一项标记 ✅，全部完成后写"Phase X 全部完成"

---

## 六、Phase 历史记录

### Phase 1 · 模块化开发（已完成 ✅）

- 墨 3/3：审批流程(3页+3路由+9API)、客户拜访(2页+2路由+8API)、租户订阅(3页+3路由+20API)
- 阿坚 8/8：OAuth token刷新、信用评分引擎、Redis缓存、索引迁移、即时零售mock去除、risk-list路由
- 阿澈 4/4：24条路由注册、首页6模块分组

### Phase 2+3 · 商品中心（已完成 ✅）

- 阿坚 11/11 ✅：DDL修复、分类/品牌/单位CRUD、商品详情/导入、标签体系DDL+CRUD、营销标签、批次追溯
- 林夕 14/14 ✅：14项设计规范HTML + Design Tokens v3.0
- 墨 11/11 ✅：SPU 14列+SKU展开行、分类/品牌/单位/导入/标签/标签关联/营销标签/批次追溯、wangeditor富文本
- 阿澈 8/8 ✅：分类API化、商品详情/管理增强、搜索优化、标签展示/筛选、批次查看

### Phase 4 · 销售管理模块（已完成 ✅）

- 阿坚 7/7 ✅：分享收款H5 API+微信支付回调、分享链接管理、价格策略API、提成DDL+CRUD+计算引擎、销售报表API
- 林夕 6/6 ✅：H5支付页/分享链接管理/价格策略/提成管理/销售报表/收银台班结 设计稿
- 墨 5/5 ✅：分享链接管理页、销售单状态可视化、价格策略页、提成管理页(2个)、销售报表页
- 阿澈 4/4 ✅：H5支付页、分享链接管理、销售报表、收银台班结优化

### Phase 5 · 采购管理模块（已完成 ✅）

- 阿坚 4/4 ✅：供应商对账API(三表汇总)、采购报表API(汇总/趋势/排名)、采购计划DDL+智能补货(安全库存+销量+在途)、采购合同DDL+CRUD
- 林夕 4/4 ✅：供应商对账/采购报表/采购计划/商户端供应商管理 设计稿
- 墨 3/3 ✅：供应商对账页面(285行)、采购报表页面(ECharts 3图)、采购计划页面(智能补货+转采购订单)
- 阿澈 2/2 ✅：商户端供应商管理(2页)、供应商对账(2页)

### Phase 6 · 库存管理模块（已完成 ✅）

- 阿坚 5/5 ✅：DDL修复(4张缺失表+3表补tenant_id)、库存成本核算(移动加权平均)、库存预警配置化、库存报表API(周转率/库龄/ABC)、损益处理API
- 林夕 4/4 ✅：库存成本核算/预警配置/库存报表/商户端盘点调拨 设计稿
- 墨 3/3 ✅：库存成本核算页面、库存预警配置页面、库存报表页面(周转率/库龄/ABC)
- 阿澈 2/2 ✅：商户端盘点(2页)、调拨(2页)

### Phase 7 · 客户管理模块（任务已分发）

- 阿坚 10项：DDL×3(积分/储值卡/标签画像) + API×7(积分等级/储值卡/会员体系/标签画像/关怀/生命周期/分群)
- 林夕 8项：积分等级/储值卡/会员体系/标签画像/关怀规则/生命周期看板/分群/商户端 设计稿
- 墨 7项：积分等级(2页)/储值卡/会员体系/标签画像(2页)/关怀规则/生命周期看板/分群 页面
- 阿澈 4项：商户端积分明细/储值卡/会员卡/标签编辑 页面
- 苏然 7项：积分等级/储值卡/会员体系/标签画像/关怀/生命周期/分群 DAO+测试（测试中）

### Phase 8 · 财务往来模块（已完成 ✅）

- 10 个二级模块，6个P0（收款/付款/应收应付/费用/对账/老板驾驶舱），约365字段
- 已有基础：授信管理、客户收款、采购付款、提成、日结、微信支付
- 阿坚 8项：DDL×2(receipt/payment+expense/bank/invoice) + API×6(收款/付款/应收应付/费用/对账/驾驶舱)
- 林夕 6项：收款/付款/费用/对账/驾驶舱/商户端 设计稿
- 墨 6项：ReceiptsView, PaymentsNewView, ReceivablesPayables, ExpensesView, ReconciliationView, FinanceDashboard
- 阿澈 4项：ReceiptListView, ExpenseCreateView, ReconciliationMobileView, CustomerReceivableView
- 苏然 6项：DAO+测试（测试中）

### Phase 9 · 数据报表模块（已完成 ✅）

- 10 个二级模块，3个P0（经营总览/销售分析/在线收款专项），约340字段
- 已有基础：42个API端点(新旧重叠)、6个前端页面(4个占位)、商户端2个报表
- 阿坚 6项：统一路由/收款分析/客户分析/导出/汇总DDL/定时任务
- 林夕 6项：5个管理后台+1个商户端设计稿
- 墨 6项：经营总览完善/销售分析/收款分析/商品分析/客户分析/库存分析
- 阿澈 4项：商户端报表完善/收款分析/库存分析/客户分析
- 苏然 6项：DAO/集成测试/收款分析测试/定时任务测试/导出测试/前端测试

### Phase 10 · 营销中心模块（已完成 ✅）

- 9 个二级模块，7个P1（营销活动/优惠券/限时折扣/满减满赠/积分商城/营销看板/素材库），约345字段
- 已有基础：10张表、57个API端点(新旧重叠)、3个管理后台页面、0商户端
- 阿坚 6项：统一路由/限时折扣/满赠/积分商城/营销看板/素材库
- 林夕 6项：5个管理后台+1个商户端+营销设计规范 设计稿
- 墨 6项：营销中心重构/限时折扣/满赠/积分商城/看板/素材库
- 阿澈 4项：商户端营销中心/优惠券/秒杀+限时折扣/积分商城
- 苏然 6项：DAO×5/集成测试/限时折扣/积分商城/看板/前端测试

### Phase 11 · 即时零售模块（已完成 ✅）

- 18 个二级模块，15个P0（小程序→配送→接单→履约），约975字段
- 已有基础：17个API端点、3个平台适配器(京东/美团/饿了么)、8个占位页面、72文件小程序
- 关键缺失：9张表DDL + instant-retail-new.routes.ts路由文件 + 商户端完全空白
- 阿坚 6项、林夕 6项、墨 6项、阿澈 4项、苏然 6项

### Phase 12 · 订单管理模块（已完成 ✅）

- 8 个二级模块，5个P0（全渠道订单聚合/分发路由/状态同步/异常处理/商品映射），3个P1（合并拆分/售后聚合/订单报表），约~361字段
- 已有基础：6个订单API（listOrders/exportOrdersCsv/getOrderDetail/getOrderStatusStats/listSaleBills/exportSaleBillsCsv）、3个管理后台页面（Orders/OrderBoard/OrderTimeout）、1个商户端页面（OrdersView）、售后模块（aftersale.routes.ts）、超时处理（order-timeout.routes.ts）
- 关键缺失：无渠道订单聚合表、无分发路由、无状态同步引擎、无异常处理中心、无商品映射表、无订单报表
- 阿坚 6项（后端：聚合DDL+API/分发路由/状态同步/异常处理/商品映射/售后聚合）
- 林夕 6项（设计稿：聚合/分发路由/状态同步/异常处理/商品映射/商户端）
- 墨 6项（管理后台：聚合/分发路由/状态同步/异常处理/商品映射/售后聚合）
- 阿澈 4项（商户端：订单列表/订单详情/异常处理/售后）
- 苏然 6项（DAO+测试：7表DAO/聚合测试/路由测试/同步测试/异常测试/前端测试）

### Phase 13 · 系统设置模块（已完成 ✅）

- 8 个二级模块，5个P0（门店管理/员工管理/角色权限/操作日志/参数配置），3个P1（审批流程/数据字典/系统通知），约~385字段
- 已有基础：门店CRUD（employee.controller/service/routes）、员工CRUD（employee.controller/service）、RBAC角色权限（rbac.routes/controller/service）、操作日志（audit.routes/controller/service）、系统参数配置（sys-config.routes/controller/service）、审批流程（approval.routes/controllers/services）、系统通知（notification.routes/controller/service）
- 管理后台已有：StoresView/EmployeesView/System.vue/SystemRoles/AuditLogView/ApprovalRules/ApprovalDetail/MyApprovals
- 商户端已有：AdminStoresView/AdminStaffView/ProfileView
- 关键缺失：数据字典完全空白、参数配置无独立管理后台页面、系统通知无管理后台页面、门店/员工/角色权限API需统一整合
- 阿坚 6项（后端：门店API/员工API/角色权限API/操作日志API/参数配置API/审批流程API）
- 林夕 6项（设计稿：门店/员工/角色权限/操作日志/参数配置/审批流程）
- 墨 6项（管理后台：门店管理/员工管理/角色权限/操作日志/参数配置/审批流程）
- 阿澈 4项（商户端：门店信息/员工列表/个人信息/通知）
- 苏然 6项（DAO+测试：门店/员工/角色/日志/配置/审批）

### Phase 14 · 工作总台模块（已完成 ✅）

- 5 个二级模块，全部 P0（经营概览~40 / 待办提醒~30 / 快捷入口~20 / 消息通知~20 / 数据看板~35），合计约145字段
- 已有基础：`admin-web/Dashboard.vue` 基础框架、`report.controller` 基础 getDashboard API、`notification` 表结构已存在、消息通知基础API已存在
- 管理后台已有：Dashboard.vue（基础经营概览）、FinanceDashboard.vue、MarketingDashboard.vue
- 商户端已有：HomeView.vue（首页框架）、NotificationView.vue + NotificationDetailView.vue（消息通知页面）
- **新增后端**：workbench.routes.ts（待办/快捷入口/消息通知路由）、todo.controller + service、quick-entry.controller + service、notification-center.controller + service、dashboard 路由/控制器/服务增强
- **新增管理后台**：TodoList.vue（待办提醒）、QuickEntryConfig.vue（快捷入口配置）、MessageCenter.vue（消息中心）、Dashboard.vue 增强
- **新增商户端**：TodoListView.vue（待办列表）、HomeView.vue + NotificationView.vue 增强
- **新增设计稿**：dashboard-admin.html、dashboard-merchant.html、notification-center.html、quick-entry-config.html
- 阿坚 4项 ✅（后端：经营概览聚合API/待办提醒API/快捷入口配置API/消息通知API）
- 林夕 4项 ✅（设计稿：管理后台工作台/商户端工作台/消息通知/快捷入口）
- 墨 4项 ✅（管理后台：经营概览Dashboard/待办提醒/快捷入口/消息中心 页面）
- 阿澈 4项 ✅（商户端：商户首页Dashboard/待办列表/消息中心/快捷入口）
- 苏然 4项 ✅（测试：Dashboard API测试/待办测试/消息测试/前端页面测试）

> **🎉 12 个模块全部开发完成！项目进入收尾阶段。**

### Bug修复阶段 · 编译错误清零（已完成 ✅）

- **审查日期**：2026-07-02
- **背景**：全面审查发现 205 个编译错误 + 3 个运行时风险 + 2 个安全隐患
- **阿坚 12项** ✅：auth.service 状态冲突回滚 + changePassword 补充 + report.userId 修复 + alert/notification/stock-check/store-control 共 35 个函数名不匹配 + order.controller 5 个函数 + store.routes batchController + 3 个即时零售适配器 + node-cron 安装
- **墨 5项** ✅：admin-web 60 个 TS 错误 + CustomerVisit API 修复 + wangeditor 类型声明 + store-terminal .env 清理
- **阿澈 3项** ✅：merchant-mobile 45 个 TS 错误 + 未使用变量清理 + 类型不匹配修复
- **林夕 2项** ✅：微信支付签名验证（validatePlatformSignature）+ 冗余路由删除（instant-retail/menu-permission/quote）
- **凌舟 4项** ✅：server.ts workbench 恢复 + db.ts executeWithTenant + http-client.ts 类型修复 + node-cron 安装
- **编译结果**：后端 100→0 ✅ | admin-web 60→0 ✅ | merchant-mobile 45→0 ✅
- **安全验证**：JWT_SECRET 无 fallback ✅ | .gitignore 含 .env ✅ | auth.service.ts 状态校验正常 ✅ | wechat-pay 签名验证已实现 ✅

### Phase 15 · 支付配置 + 小程序平台（已完成 ✅）

- **审查日期**：2026-07-01 ~ 2026-07-03
- **背景**：新增支付配置独立二级菜单 + 小程序多平台配置/模板/一键发布 + 实时价格同步
- **阿坚 13项** ✅：payment-config.service(含银行账号CRUD) + miniapp-config.service + miniapp-template.service + miniapp-publish.service + sync/price-sync.service + sync/product-sync.service + payment-config.routes + miniapp-config.routes + sync.routes + wechat-pay.fromTenant + server.ts路由注册 + order.controller.requirePaymentReady + sales.controller
- **墨 6项** ✅：PaymentConfigView(微信支付/支付宝/银行账号三Tab) + MiniappConfigView(四平台/三模板/发布历史) + PaymentCheckModal + router路由 + MainLayout菜单 + api.ts
- **阿澈 6项** ✅：config.template.js(25个__XXX__占位符) + utils/sync.js(SyncManager) + app.js(平台配置注入) + home/index.js(SyncManager集成+off修复) + home/index.wxml + home/index.wxss
- **林夕** ✅：设计稿通过
- **合并提交**：`ea5f941` — 26 文件 +3362 行

### Phase 16 · 字段对齐修复（已完成 ✅）

- **审计日期**：2026-07-02
- **背景**：Phase 15 字段级审计发现 31 个 DDL vs Service vs 前端三方字段不一致
- **阿坚 7项** ✅：miniapp-template.service重写(虚构字段→DDL字段) + wechat-pay.private_key→private_key + payment-config KEY_MAP+SENSITIVE_KEYS + miniapp-publish INSERT action/result + miniapp-config INSERT补充字段 + is_encrypted智能判断
- **墨 5项** ✅：PaymentConfigView enabled→"1"/"0" + bankBranch→branchName + api.ts setDefaultBankAccount PUT + MiniappConfigView enabled保留（UI兼容）
- **阿澈 1项** ✅：config.template.js 24个占位符与 publish 服务替换逻辑完全对齐
- **合并提交**：`75e1966` — 11 文件 +295/-93 行
- **墨补充提交**：`7559602` — MiniappConfigView enabled→status + appDescription/appIcon

### 全局认证修复（2026-07-02）

- **审查日期**：2026-07-02
- **发现问题**：
  1. **P0**：`PaymentConfigView.vue` 银行默认账号 API 调用 `POST` 但后端路由是 `PUT`（405 错误）
  2. **P0**：4 个页面直接用原始 `axios` 而非 `api` 实例，导致所有请求缺少 `Authorization` 头和 401 处理
     - `MiniappConfigView.vue`（Phase 15 小程序配置）
     - `QuickEntryConfig.vue`（Phase 14 快捷入口）
     - `MessageCenter.vue`（Phase 14 消息中心）
     - `TodoList.vue`（Phase 14 待办提醒）
- **修复提交**：`fa69e69` — 5 文件，+28/-28 行

### Phase 17 · 技术债务清理（待安排 📋）

- **核查日期**：2026-07-03
- **背景**：全面架构审查发现的技术债务和安全问题
- **P0 安全** 🔄：`/api/system` 路由无认证中间件 — 需立即添加 `requireAuthWithTenant`
- **P1 安全** 🔄：docker-compose MySQL 3306/Redis 6379 端口对外暴露 — 生产环境应移除 ports 映射
- **P1 质量** 🔄：后端 `any` 类型 436 处 — 分批替换为具体类型
- **P2 质量** 🔄：前端 33 处 setTimeout/setInterval 未在 onUnmounted 清理
- **P2 规范** 🔄：全部项目无 ESLint/Prettier 配置
- **核查结论**：
  - 单体后端 78 路由文件 — 当前阶段合理，暂不拆分
  - 前端框架混用 — **不存在**，全部 Vue 3，无 React
  - 测试覆盖 — 后端 1.6%（6/375），前端 0%，后续逐步补充关键路径测试

---

## 七、产品规格关键数据

| 维度 | 数值 |
|------|------|
| 一级分类 | 12个：工作总台、销售管理、订单管理、采购管理、库存管理、客户管理、商品中心、即时零售、财务往来、数据报表、营销中心、系统设置 |
| 二级模块 | 106个 |
| 总字段 | ~4140 |
| 数据库表 | 217张 |
| P0字段 | ~2850 |

### 当前模块完成度

| 端 | 完成度 |
|----|:------:|
| 后端 API | ~90% |
| 商户移动端 | ~100% |
| 门店终端 | ~100% |
| 管理后台 | ~60% |
| 平台总后台 | 0% |

---

## 八、架构约定

| 约定 | 规则 |
|------|------|
| 数据库表命名 | snake_case（product_spu, product_sku） |
| API 路径 | `/api/{角色}/{资源}`（/api/admin/products, /api/store/products） |
| 租户隔离 | 所有表含 tenant_id，中间件 requireAuthWithTenant |
| 认证方式 | JWT + bcrypt |
| 响应格式 | `{ code: 0, data: ..., message: "ok" }` |
| 前端状态管理 | Pinia |
| 后端校验 | zod |
| 主分支 | main，开发在 trae/solo-agent-* 分支 |

---

## 九、Git 工作流

1. 开发在各自的 `trae/solo-agent-*` 分支进行
2. 完成后通知凌舟审计
3. 凌舟审计通过后提取代码合并到 main（不直接 merge 分支，避免带入无关改动）
4. 推送 main 到远程仓库
5. 更新 `tasks/tasks-{人名}.md` 状态
