# 项目全局记忆 · 智享营销系统

> 本文件是项目的全局记忆中枢，所有团队成员和 AI 助手在读仓库时应首先读取此文件。
> 最后更新：2026-06-29

---

## 一、项目概况

| 项目 | 内容 |
|------|------|
| 项目名 | 智享营销系统（酒水行业 SaaS） |
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
│       ├── routes/       # 45 个路由文件
│       ├── controllers/  # 49 个控制器
│       ├── services/     # 70 个服务
│       └── server.ts     # 入口
├── admin-web/            # 管理后台（54个视图）
├── merchant-mobile/      # 商户移动端（34个视图）
├── store-terminal/       # 门店终端（11个视图）
├── docs/                 # 产品规格、API文档、数据库Schema
│   └── migrations/       # 数据库迁移脚本
├── tasks/                # 唯一任务文件目录（3人各1份 + 1份审计报告）
│   ├── tasks-墨.md       # 墨的任务
│   ├── tasks-阿坚.md     # 阿坚的任务
│   ├── tasks-阿澈.md     # 阿澈的任务
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
| 墨 | 管理后台 admin-web 前端 | Phase 2 待开始 |
| 阿坚 | 后端 API | Phase 2 ✅ 7/7 完成 |
| 阿澈 | 商户移动端 merchant-mobile 前端 | Phase 2 待开始 |

---

## 四、开发节奏

1. **按一级模块纵向推进**：一个模块做完再做下一个（前端+后端+联调）
2. **模块顺序**：商品中心 → （待定）
3. **每轮流程**：任务分解 → 分发 → 开发 → 审计验收 → 合并推送 → 下一轮
4. **验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证，无遗漏

---

## 五、任务文件管理规则

1. **唯一任务目录**：`tasks/`，只有 3 份任务文件 + 1 份审计报告
2. **根目录禁止**：不许在根目录放 tasks-*.md、ASSIGNMENT.md、MEMORY.md 等任何任务/管理文件
3. **文件命名**：`tasks/tasks-{人名}.md`
4. **状态更新**：每完成一项标记 ✅，全部完成后写"Phase X 全部完成"

---

## 六、Phase 历史记录

### Phase 1 · 模块化开发（已完成 ✅）

- 墨 3/3：审批流程(3页+3路由+9API)、客户拜访(2页+2路由+8API)、租户订阅(3页+3路由+20API)
- 阿坚 8/8：OAuth token刷新、信用评分引擎、Redis缓存、索引迁移、即时零售mock去除、risk-list路由
- 阿澈 4/4：24条路由注册、首页6模块分组

### Phase 2 · 商品管理模块（进行中）

- **阿坚 7/7 ✅**：DDL修复(3表补字段+2新建表)、分类CRUD、商品详情接口、品牌CRUD、单位CRUD、列表字段完善、商品导入
- **墨 7项 待开始**：Products.vue适配、分类联调、Brands.vue、Units.vue、详情增强、导入页面、路由注册
- **阿澈 5项 待开始**：分类API化、ProductDetailView、AdminProductsView增强、搜索优化、路由注册

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
