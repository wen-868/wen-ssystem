# CodeBuddy 任务卡（2026-08-16 派发）

## 一、背景

智享进销存系统（项目根 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem`，远程 github.com:wen-868/wen-ssystem）验收推进中。P0 覆盖率批次 Batch 1-4 已完成并验收通过（验收总览报告第 33-37 项）。现派发 **Batch 5**：继续补测试提升覆盖率，向全局 85% 推进。

## 二、当前基线（验收方已确认）

- 全量测试：535 文件 / 5695 用例通过
- lint 0 error、tsc 构建通过
- 覆盖率：statements 68.95% / branches 56.61% / functions 67.38% / lines 70.8%
- 门禁阈值：全局 63/51/62/64；services/admin 专项 54/50/53/55
- 已覆盖重点：store 72.98%（收银/交接班/会员/挂单/登录/商品/应收/销售单/库存）、admin 64.37%（财务/审批/营销/分类/品牌/佣金/门店管控/库存/报表权限/系统配置/客户全链路/采购）、shared 94.96%

## 三、Batch 5 任务清单（按优先级）

### A. 低覆盖服务补测（提升全局 statements，目标 70%+）

优先补**行数多、当前 0%/低覆盖**的服务（用 `npx vitest run -c vitest.config.ts --coverage` 查当前缺口）：

- [ ] `services/admin/`：audit.service、bank-account.service、credit-adjust/limit/collection/risk/scoring.service、marketing-asset.service、marketing-points.service、customer-statement（已覆盖则跳过）、supplier-statement.service、trace-records（已覆盖）、receipt.service、expense.service（已覆盖则跳过）、notification（已覆盖）、custom-report（已覆盖）
- [ ] `services/miniapp/`：retail-consumer-address.service（已有测试则核对）、member.service（已有测试则核对）、cart.service、checkout.service
- [ ] `services/saas/`、`services/sync/` 低覆盖文件
- [ ] `services/marketing/`：community-marketing.service（拼团/砍价/秒杀分支）
- [ ] `services/hardware/`：payment-box.service（收款盒子，含签名校验/回调）
- [ ] `services/` 根目录：purchase.service、sale-return.service（已有部分）、transfer-order.service

### B. 每完成一个服务

1. 写单测（mock db 层，遵循仓库现有测试约定：queryWithTenant 返回行数组、queryOneWithTenant 返回对象或 null、SQL 别名驼峰键）
2. 跑 `cd backend && npx vitest run -c vitest.config.ts` 确认全量通过
3. 跑 `npm --workspace backend run lint`（根目录）确认 0 error
4. 跑 `npm --workspace backend run build` 确认通过

### C. 批次收尾

- 全部完成后跑覆盖率（`cd backend && npx vitest run -c vitest.config.ts --coverage`），确认 statements ≥ 70%（若未到则继续补）
- 更新 `docs/验收总览报告.md`（新增"覆盖率提升 / Batch 5"条目，含各服务覆盖明细与四维覆盖率）
- 更新 `docs/任务派单-codebuddy.md` 批次进度（Batch 5 交付，待验收）
- 提交推送（`git -c http.version=HTTP/1.1 push origin main`，GitHub 间歇断连则重试），提交信息 `test(验收-Batch5): ...`

## 四、约束与验收门槛

- 不要触碰 `backend/ai-base/`（其他代理在途）
- 不要修改业务代码来"凑覆盖率"；只补测试
- 测试必须真实断言（断言 SQL 参数、返回值、错误分支），禁止空跑 mock
- 验收门槛：全量测试通过 + lint 0 + 构建通过 + statements ≥ 70% + 质量抽查合格；未达打回

## 五、交付物

完成后回复：覆盖了哪些服务、每服务用例数与行覆盖、全量测试数、四维覆盖率、提交 hash。
