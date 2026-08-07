# 任务卡：ache_r98_01 — R98-01 [P1] 平台小程序 MVP（工程 + 页面 + 后端接口 + 后台审核）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（小程序 + 后端接口）
- **优先级**：P1
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务背景

用户需求：智享全链 SaaS 平台自己做一个小程序，用于**产品介绍**和**套餐订阅**（面向潜在客户/租户）。与 R96 租户商城小程序（`miniapp/`）相互独立，**禁止改动 miniapp/**。

本任务为 MVP：新建 `platform-miniapp/` 工程（Taro 3.6 + Vue3），5 个页面 + 后端公开接口 + 订阅申请表 + saas-admin 后台审核，端到端跑通「浏览套餐 → 提交订阅申请 → 后台审核 → 状态可查」。

## 二、必读文件

1. `docs/tasks/current-tasks.md`：R98-00（方案）+ R98-01（本任务）小节
2. `miniapp/`（Taro 工程骨架参考：package.json/config/src/app.config.ts/styles 体系，**只参考不改**）
3. `website/src/views/HomeView.vue` + `landing-page/index.html`（产品介绍文案素材）
4. 后端：`backend/src/routes/platform-plans.routes.ts`（套餐管理，requirePlatformAuth 不可直接给小程序用，需新增公开端点）、`backend/src/routes/tenant-register.routes.ts`（公开申请模式参考）、`backend/src/controllers/admin/subscription-plan.controller.ts`（套餐数据结构）
5. saas-admin：`src/views/tenant/ApplicationList.vue`（后台审核交互参考）
6. `docs/migrations/`（迁移 SQL 规范，参考 130/125/126 编号风格）

## 三、任务清单

### 1. 新建 platform-miniapp 工程
- 复制 `miniapp/` 骨架精简：package.json（Taro 3.6 + Vue3 + Vant4 依赖同款）、config/index.js（build:weapp）、src 结构（app.config.ts/app.ts/main.ts/styles）
- 删除租户商城相关页面/API（cart/order/points/stored/wholesale/aftersale 等），只留基础
- `build:weapp` 构建通过；appid 先用占位（`touristappid` 或空），真实 AppID 用户后续提供
- 加入根 package.json workspace（如项目是 npm workspace 结构则对齐；否则独立 npm install）

### 2. 页面（5 个，简洁漂亮、去 AI 味）
1. **首页** `pages/index/index`：产品介绍——SaaS 能力亮点（批零一体、即时零售、AI 助手、多门店、数据报表等，文案取自 website/landing-page）、核心差异化、底部「查看套餐」入口
2. **套餐列表** `pages/plans/index`：调公开接口拉套餐，卡片展示（名称/价格/周期/功能点），底部「立即订阅」
3. **订阅申请** `pages/subscribe/index`：选套餐（带参进入）+ 表单（公司名称/联系人/手机号/备注）→ 提交成功页/提示
4. **我的申请** `pages/my-applications/index`：wx.login 换 openid（MVP 可先本地存 openid 或免登录按手机号查），展示本人申请与状态（PENDING/APPROVED/REJECTED）
5. **关于我们** `pages/about/index`：平台简介/联系方式
- tabBar：首页 / 套餐 / 我的申请（3 个，或首页+套餐+我的）

### 3. 后端公开接口（挂主后端 8080，新建 routes/platform-miniapp.routes.ts）
- `GET /api/platform-miniapp/plans`：公开套餐列表（复用 subscription-plan 数据，仅 status='ACTIVE'，字段脱敏为 id/name/price/cycle/description/features）
- `POST /api/platform-miniapp/subscriptions`：body { openid?, planId, company, contact, mobile, remark? }，校验必填+手机号格式，落表，返回申请记录
- `GET /api/platform-miniapp/subscriptions/me?openid=&mobile=`：查询本人申请（openid 优先，mobile 兜底），返回列表
- 新表 `t_platform_subscription_apply` + 迁移 SQL（编号 131）：
  - id BIGINT PK、openid VARCHAR(64) DEFAULT ''、plan_id BIGINT、plan_name VARCHAR(64)、company VARCHAR(128)、contact VARCHAR(64)、mobile VARCHAR(20)、remark VARCHAR(500)、status VARCHAR(20) DEFAULT 'PENDING'（PENDING/APPROVED/REJECTED）、audit_remark VARCHAR(500) DEFAULT ''、audited_by BIGINT NULL、audited_at DATETIME NULL、tenant_id VARCHAR(36) DEFAULT 'default'、created_at/updated_at
- 接口鉴权：读套餐/提交申请/查本人申请均公开（auth: "none"），但要加基础防刷（如简单限流或校验）

### 4. saas-admin 后台审核
- 新增「订阅申请」页面（或并入现有应用审核）：列表（PENDING 优先）+ 详情 + 通过/驳回（填审核备注）
- 调后端平台接口（requirePlatformAuth）：`GET /api/platform/subscription-applies`、`PUT /api/platform/subscription-applies/:id/audit`
- 侧边栏加入口（复用 saas-admin 菜单模式）

### 5. 验证
- `platform-miniapp`：`npm run build:weapp` exit 0；H5 走查 5 页截图（可存 docs/reports/R98-01-*）
- 后端：build + typecheck；接口本地/生产实测（公开套餐列表 200、提交申请落库、me 查询、后台审核流转）
- saas-admin：build 通过，审核页面可用
- 提交推送 origin/main（中文提交信息）

## 四、验收标准

- 平台小程序 5 页构建通过、视觉简洁美观（非模板感）
- 端到端：小程序浏览套餐 → 提交订阅申请 → saas-admin 后台审核 → 小程序「我的申请」看到状态
- 公开接口实测 200；迁移 131 落库；saas-admin 审核页面可用
- current-tasks.md 更新 R98-01 完成记录；任务卡归档

## 五、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- **禁止改动 miniapp/（租户商城）、app-mobile/、admin-web/**（除非 saas-admin 后台审核需新增页面——那是允许的本任务范围）
- 最小改动：新工程独立，不重构现有代码
- 微信订阅消息通知（R98-02）本任务不做，只做状态可查；openid 关联用 wx.login 简化实现即可
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R98-01、复述任务关键内容、给出完成结果与验证证据
