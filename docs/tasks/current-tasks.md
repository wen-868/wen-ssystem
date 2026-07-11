# 当前任务 — R22

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-12  
> **硬性标准：覆盖率阈值 100%，测试不允许跳过，只有修复一条路。**

---

## R22 任务列表

### R22-A1 — 修复 auto-routes.test.ts 失败用例 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿坚
- **预计**：0.5 天
- **问题**：`auto-routes.test.ts:145` — "router 为 undefined 的配置项应被跳过" 断言 `/api/test-router-valid` 未注册
- **验收**：`npx vitest run src/__tests__/shared/auto-routes.test.ts` → 0 失败

### R22-A2 — 77 个 it.skip 测试全部修复 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿坚 + 苏然
- **预计**：3 天

### R22-A3 — admin-web 客户详情页 + 编辑/禁用 UI [P0]

- **状态**：✅ 已完成
- **优先级**：P0
- **负责人**：墨
- **预计**：2 天
- **完成时间**：2026-07-12
- **完成内容**：
  1. ✅ 客户详情页 — 显示完整客户信息（基本信息+地址+结算方式+积分+等级）
  2. ✅ 详情页内子数据 Tab — 采购统计、销售单列表、付款记录、对账单
  3. ✅ 客户编辑功能 — 编辑弹窗（调用 PUT /admin/members/:id）
  4. ✅ 客户禁用/启用 — 列表页和详情页加禁用/启用按钮（调用 PUT /admin/members/:id/disable）
  5. ✅ 会员卡信息展示 — 调用 GET /admin/members/:id/member-card
  6. ✅ 会员等级调整 UI — 调用 PUT /admin/members/:id/member-level
- **验收结果**：
  - ✅ vue-tsc --noEmit 0 错误
  - ✅ npm run build 成功，所有 chunk ≤500KB
- **修改文件**：
  - `admin-web/src/api.ts` — 新增 8 个 API 函数
  - `admin-web/src/views/CustomerDetail.vue` — 新建客户详情页
  - `admin-web/src/views/CustomersView.vue` — 添加详情、禁用/启用按钮
  - `admin-web/src/router/index.ts` — 添加客户详情路由
  - `admin-web/src/utils/format.ts` — 新增 formatMoney 函数

### R22-A4 — app-mobile 客户 API 路径修复 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：阿澈
- **预计**：0.5 天

### R22-A5 — R22 全量回归测试 [P0]

- **状态**：待开始
- **优先级**：P0
- **负责人**：苏然
- **前置条件**：R22-A1~A4 全部完成

---

## R21 任务列表（已完成）

### R21-A8 — admin-web chunk 优化

- **状态**：✅ 已完成
- **优先级**：P1
- **负责人**：墨

---

## R18-R20 任务列表（已完成）

（保留历史记录，详见原文件）

---

## 强制闭环流程

1. **读取任务** — ✅ 已完成
2. **执行** — ✅ 已完成
3. **验证** — ✅ vue-tsc + build
4. **总结** — ✅ 已更新
5. **提交** — ✅ 已完成
6. **更新踩坑日志** — ✅ 已完成
7. **推送** — ✅ 已完成