# 智享营销系统 - 项目管理中枢

> **用途：** 项目管理的唯一入口。所有阶段报告、任务下发、里程碑记录都在此文件索引。
> **更新规则：** 每个阶段完成后由凌舟更新。团队成员只需读取此文件即可了解全局。

---

## 一、项目基本信息

| 项目 | 内容 |
|------|------|
| 项目名称 | 智享营销系统 |
| 产品定位 | 酒水饮料行业进销存 SaaS 系统 |
| 技术栈 | Node.js/Express + MySQL + Vue 3 + Vite + Element Plus |
| GitHub | https://github.com/wen-868/wen-ssystem.git |
| 当前分支 | feat/formal-mvp-a |
| 部署地址 | api.onepan.cn / admin.onepan.cn / m.onepan.cn / store.onepan.cn |

---

## 二、团队配置

| 成员 | 角色 | 职责 |
|------|------|------|
| 凌舟 | 项目管理 | 调研评估、工作计划、任务分配、服务器部署、阶段审查 |
| 墨 | 主线开发（前端） | admin-web 重构、PC端功能开发 |
| 阿澈 | 前端工程师 | merchant-mobile 开发、UI组件 |
| 阿坚 | 后端工程师 | API开发、数据库、架构改造 |
| 林夕 | UI/交互设计 | 设计稿、UI规范 |
| 苏然 | 测试工程师 | 测试用例、质量验收 |

---

## 三、当前阶段

### 阶段：架构整改期（2026-06-24 至 2026-07-07）

**阶段目标：** 解决架构问题，为后续功能开发扫清障碍。

**核心问题：**
1. admin-web 单文件5300+行，无路由无组件拆分
2. 后端胖路由模式，389个端点业务逻辑全在路由中
3. 62张表无 tenant_id，多租户隔离未实施

**任务分配：**

| 负责人 | 任务 | 工时 | 状态 |
|--------|------|------|------|
| 墨 | R1-01 admin-web 引入vue-router + 页面拆分 | 2天 | ⏳ 进行中 |
| 墨 | R1-02 抽取公共组件 | 1天 | ⏳ 待开始 |
| 墨 | R1-03 store-terminal 同步重构 | 1天 | ⏳ 待开始 |
| 阿坚 | R2-01 后端Controller-Service分层改造 | 3天 | ⏳ 进行中 |
| 阿坚 | R2-02 tenant_id 数据隔离（62张表） | 5天 | ⏳ 待开始 |
| 阿澈 | M-01 merchant-mobile 快速开单优化 | 2天 | ⏳ 进行中 |
| 阿澈 | M-02 销售退货页面 | 1.5天 | ⏳ 待开始 |
| 阿澈 | M-03 客户往来账页面 | 1.5天 | ⏳ 待开始 |
| 苏然 | R4-01 核心模块测试用例 | 3天 | ⏳ 待开始 |

**里程碑：**

| 里程碑 | 日期 | 验收标准 | 状态 |
|--------|------|---------|------|
| M1-重构 | 6/27 | admin-web vue-router 上线，22页面可访问 | ⏳ |
| M1-分层 | 6/28 | 后端分层完成，API不变 | ⏳ |
| M1-终端 | 6/28 | store-terminal vue-router 上线 | ⏳ |
| M2-隔离 | 7/4 | 62张表 tenant_id 隔离完成 | ⏳ |
| M2-验收 | 7/7 | 所有测试通过，功能无回归 | ⏳ |

---

## 四、阶段历史

### 已完成阶段

| 阶段 | 时间 | 内容 | 状态 |
|------|------|------|------|
| Phase 1 - 基础搭建 | 早期 | 数据库25张表、基础CRUD、认证、商品/库存/销售 | ✅ 完成 |
| Phase 2 - 采购扩展 | 早期 | 供应商、采购订单/入库/退货/付款、客户对账/收款 | ✅ 完成 |
| Phase 3-6 - 功能扩展 | 近期 | 预警、价格体系、信贷、溯源、批次、门店管控、营销、即时零售 | ✅ 完成 |
| V2.0 UI升级 | 近期 | 15个新模块、全系统UI打磨、部署准备 | ✅ 完成 |
| 商家移动端 | 近期 | merchant-mobile 18个页面、vue-router架构 | ✅ 完成 |
| 门店终端 | 近期 | store-terminal 10个页面、PWA支持 | ✅ 完成 |

### 待启动阶段

| 阶段 | 内容 | 预计周期 | 依赖 |
|------|------|---------|------|
| P0 核心改造 | 收银台、订单看板、客户档案、出库退货、分享收款 | 3周 | 架构整改完成 |
| P1 增强功能 | POS快开单、销售提成、价格策略、信用赊销、销售报表 | 3周 | P0完成 |
| P2 SaaS化 | 租户/订阅/自助注册/功能开关/账号管理 | 3周 | P1完成 |
| P3 增值功能 | 营销模块、即时零售、数据导出 | 持续 | P2完成 |
| AI助手V1 | 智能问答 + 记忆开单 | 8天 | M3之后 |

### phase2-dev 分支进展（凌舟总结，2026-06-24）

> 墨在 phase2-dev 分支上已推进了大量工作，以下为凌舟审查总结。

**admin-web 重构（部分完成）：**
- ✅ 已引入 vue-router（`admin-web/src/router/index.ts`）
- ✅ 已创建 13 个 views 文件（Dashboard/Products/Suppliers/PurchaseOrders/PurchaseInStocks/Orders/SaleBills/CustomerStatements/Inventory/InventoryAlerts/Collection/Reports/System）
- ⚠️ 路由仅13条，原规划22条，缺少：客户、销售退货、员工、门店、预警中心（已有InventoryAlerts）、价格中心、授信管理、售后管理、订单超时、营销中心、操作日志
- ⚠️ 未抽取公共组件（无 components/ 目录）

**后端测试（大幅扩展）：**
- ✅ 新增 12 个测试文件（supplier/purchase-order/purchase-in-stock/purchase-return/sale-return/customer-payment/customer-statement/debug-po/miniapp/performance/pre-deployment/system-config/security）
- ✅ 新增 vitest 配置
- ✅ 新增飞书报告集成（feishu-report.ts）

**merchant-mobile（功能扩展）：**
- ✅ 新增 8 个页面（采购订单/入库/退货/对账/对账详情/对账付款/退货详情/功能中心/商品管理）
- ✅ 新增采购相关API封装

**其他：**
- ✅ 新增 CI/CD 配置（.github/workflows/ci.yml）
- ✅ 新增 phase-tracker.mjs 和 send-report.mjs 脚本
- ✅ 新增测试文档（test-cases/test-plan）

**凌舟的评估：**
- 墨的推进速度很快，admin-web vue-router 重构已经启动
- 但 phase2-dev 和 feat/formal-mvp-a 两个分支存在大量分叉，需要合并
- admin-web 重构未完成（13/22页面），需要继续补全
- 后端分层改造（Controller-Service）尚未开始
- tenant_id 隔离尚未开始

---

## 五、文档索引

### 根目录（团队必读）

| 文件 | 用途 | 更新频率 |
|------|------|---------|
| `PROJECT_MEMORY.md` | **本文件** - 项目管理中枢，阶段索引 | 每阶段更新 |

### tasks/ 文件夹（所有报告和任务）

| 文件 | 用途 | 生成人 |
|------|------|--------|
| `tasks/PROJECT_STATUS.md` | 当前阶段完成度报告 | 凌舟 |
| `tasks/PROJECT_TASKS.md` | 当前阶段整改任务清单 | 凌舟 |
| `tasks/project-status-report.md` | 首次代码审查完成度报告（详细版） | 凌舟 |
| `tasks/project-refactor-plan.md` | 整改方案（详细版） | 凌舟 |
| `tasks/form-field-spec-v1.md` | 表单字段开发手册（11模块/50+表单） | 凌舟 |
| `tasks/tasks-墨.md` | 墨（技术负责人）任务清单 | 墨 |
| `tasks/tasks-阿坚.md` | 阿坚后端任务清单 | 墨 |
| `tasks/tasks-阿澈.md` | 阿澈前端任务清单 | 墨 |
| `tasks/tasks-林夕.md` | 林夕UI/UX任务清单 | 墨 |
| `tasks/tasks-苏然.md` | 苏然测试任务清单 | 墨 |
| `tasks/TECH_REVIEW_sprint2.md` | Sprint 2 技术评审报告 | 墨 |
| `tasks/林夕-记忆文件.md` | 林夕个人记忆文件 | 林夕 |

> 所有任务文件、报告、个人记忆文件统一存放在 `tasks/` 文件夹，根目录不再散落任务文件。

### docs/ 目录（参考资料）

| 文件 | 用途 |
|------|------|
| `docs/ASSIGNMENT.md` | Phase 2 任务分配（历史参考） |
| `docs/DEPLOY.md` | 部署简要说明 |
| `docs/deployment.md` | 部署详细文档 |
| `docs/PARTNER_LOG.md` | 合作伙伴沟通记录 |
| `docs/tenant-isolation-plan.md` | tenant_id 隔离方案（阿坚专属） |
| `docs/ai-assistant-plan.md` | AI助手技术方案 |
| `docs/API.md` | API接口文档 |
| `docs/init_database.sql` | 数据库初始化（62张表） |
| `docs/ui-style-guide.md` | UI风格指南 |
| `docs/product-planning/` | 产品规划HTML（3个文件） |
| `docs/superpowers/` | 历史设计文档（19个文件，归档） |

### tests/ 目录（测试相关）

| 文件 | 用途 |
|------|------|
| `tests/README.md` | 测试说明 |
| `tests/api-test-suite.mjs` | API 测试套件 |
| `tests/docs/` | 测试文档（8个文件：测试计划/用例/兼容性/性能/安全） |

### scripts/ 目录（自动化脚本）

| 文件 | 用途 |
|------|------|
| `scripts/phase-tracker.mjs` | 阶段追踪 |
| `scripts/send-report.mjs` | 飞书报告发送 |
| `scripts/dev-mock.mjs` | 开发 Mock 服务 |
| `scripts/mysql-smoke-test.mjs` | MySQL 冒烟测试 |
| `scripts/self-test.mjs` | 自检脚本 |
| `scripts/qa-regression-test.mjs` | QA 回归测试 |
| `scripts/ui-contract-test.mjs` | UI 契约测试 |
| `scripts/build-mobile-beta.mjs` | 手机端打包 |
| `scripts/build-store-beta.mjs` | 门店端打包 |

---

## 六、项目管理机制

### 阶段流程

```
阶段开始 → 凌舟检查仓库代码 → 生成完成度报告（PROJECT_STATUS.md）
         → 生成整改/任务报告（PROJECT_TASKS.md）
         → 更新本文件（PROJECT_MEMORY.md）
         → 墨读取 PROJECT_TASKS.md → 任务分发到各人
         → 各人执行 → 阶段结束 → 凌舟再次检查 → 循环
```

### 报告规范

| 报告 | 文件名 | 内容 | 生成时机 |
|------|--------|------|---------|
| 完成度报告 | `PROJECT_STATUS.md` | API数量、表数量、页面数量、架构评分、问题清单 | 每阶段结束时 |
| 任务清单 | `PROJECT_TASKS.md` | 每人任务、工时、验收标准、里程碑 | 每阶段开始时 |
| 项目中枢 | `PROJECT_MEMORY.md` | 阶段索引、团队配置、文档索引、历史记录 | 每阶段更新 |

### 更新规则

1. **凌舟** 负责在每个阶段结束时检查仓库代码，生成报告
2. **墨** 负责读取 PROJECT_TASKS.md，将任务分发到各人
3. 所有报告放在**仓库根目录**，固定文件名，阶段更新（覆盖或追加）
4. 历史报告不删除，通过 PROJECT_MEMORY.md 的阶段历史索引查阅

---

## 七、关键决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-06-22 | 凌舟不碰代码 | 避免上下文丢失导致项目偏差 |
| 2026-06-22 | 团队从4人扩展为6人 | 凌舟专职项目管理，新增墨和阿澈 |
| 2026-06-22 | 一级分类从10个扩展为12个 | 补充订单管理和即时零售 |
| 2026-06-23 | AI助手方向确定 | AI融入系统、本地RAG+云端成长、钱货操作需人工确认 |
| 2026-06-23 | AI投入节奏确定 | 前期用DeepSeek API（月50-100元），客户量起来后再投GPU服务器 |
| 2026-06-24 | 启动架构整改 | 发现admin-web单文件5300+行、后端胖路由、无tenant_id三大问题 |
| 2026-06-24 | 建立项目管理机制 | 根目录固定文件名（PROJECT_MEMORY/STATUS/TASKS），阶段更新 |
| 2026-06-24 | phase2-dev 合并入 feat/formal-mvp-a | 92个文件合并，0冲突，统一主开发分支 |
| 2026-06-24 | 任务分发完成 | 墨完成5人任务清单分发（墨/阿坚/阿澈/林夕/苏然） |

---

## 八、AI助手战略方向

> 详细方案：`docs/ai-assistant-plan.md`

- **核心定位：** AI融入系统（非挂件），副驾驶模式（钱货操作需人工确认）
- **技术路线：** 本地RAG（商户数据）+ 云端成长（匿名聚合行业规则）
- **分阶段：** V1问答 → V2推送 → V3建议 → V4本地GPU
- **投入原则：** 用赚来的钱投AI，不提前烧钱
- **开发时机：** M3（双端可用）之后

---

> **最后更新：** 2026-06-24
> **更新人：** 凌舟
