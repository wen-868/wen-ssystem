# 任务卡：ache_r98_01b — R98-01 平台小程序 MVP（续：余额恢复后重新派单）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（小程序 + 后端接口）
- **优先级**：P1
- **取代**：ache_r98_01（原代理因 DeepSeek 402 余额中断，工程已建）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务不变（原任务卡 `docs/tasks/inbox/ache_r98_01.md` 完整要求仍然有效）

平台小程序 MVP：产品介绍 + 套餐订阅（意向申请 → saas-admin 后台审核 → 我的申请查状态），方案 B 不接支付。

## 二、当前进度（凌舟已接手补全，从中断处继续）

**前端工程已完成（构建通过）：**
- `platform-miniapp/` 工程：Taro 3.6 + Vue3，5 页齐全（index 首页/plans 套餐/subscribe 订阅申请/my-applications 我的申请/about 关于）
- 测试 AppID `wx3ea76428aa15cec7` 已配置进 project.config.json（仅测试用，正式发布换平台自己的）
- `src/api/platform.ts` + `request.ts` 已写（fetchPlans/submitSubscription/fetchMyApplications）
- config/index.js 已补 sass 全局注入；variables.scss 已补字重/radius-pill 变量；`npm run build:weapp` exit 0
- **注意**：工程可能尚未注册到根 package.json workspace，若后端/前端构建需要则补注册

**未完成（本任务核心）：**
- 后端公开接口 `/api/platform-miniapp/plans`、`POST /api/platform-miniapp/subscriptions`、`GET /api/platform-miniapp/subscriptions/me`（routes + controller + service，auth none + 基础防刷）
- 新表 `t_platform_subscription_apply` + 迁移 SQL（编号 131）
- saas-admin「订阅申请」审核页面（列表 + 详情 + 通过/驳回）调 `GET /api/platform/subscription-applies` + `PUT /api/platform/subscription-applies/:id/audit`（requirePlatformAuth）
- 验证：platform-miniapp build:weapp、后端 build/typecheck、接口实测（套餐列表 200、提交落库、me 查询、审核流转）、saas-admin build
- 提交推送 origin/main（中文提交信息）

## 三、注意事项

- 全程简体中文；最小改动；禁止改动 miniapp/（租户商城）、app-mobile/、admin-web/（saas-admin 审核页属本任务范围）
- 微信登录 MVP 简化：wx.login 换 openid 或按手机号兜底（前端已按此实现）
- 订阅消息通知（R98-02）本任务不做
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R98-01、复述关键内容、给完成结果与验证证据
