# 任务派单：智享系统剩余验收任务（CodeBuddy 接手）

> 生成方：Codex（主代理）｜日期：2026-08-16
> 项目根：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（git 仓库，远程 github.com:wen-868/wen-ssystem）
> 验收基线：docs/验收总览报告.md（31 个真实缺陷已修复，三端路由缺口清零，CI 12 道门禁全绿）

## 〇、分工协议（2026-08-16 用户确认）

- **CodeBuddy = 执行方**：负责补测试、提覆盖率、跑全量验证、提交推送等 token 密集型任务。
- **Codex = 验收方**：负责检查 CodeBuddy 产出的质量与达标情况，更新验收总览报告，处理真实缺陷修复/架构级工作，以及服务器/第三方项。
- **交接通道**：Codex 把任务写入本文件（P0 批次清单）；CodeBuddy 完成后以 git 提交 + 汇报为准；Codex 通过 `git log`、覆盖率报告、全量测试结果验收。
- **验收门槛**：CodeBuddy 每批交付必须满足：全量 `npx vitest run -c vitest.config.ts` 通过、lint 0 error、构建通过、覆盖率高于上一批、提交已推送 origin/main。未达标即打回补充。

## 一、接手须知

1. **先读基线**：`docs/验收总览报告.md`（缺陷清单/覆盖率/剩余差距）、`docs/顶级商业软件完成标准明细-智享系统验收.md`（55 项标准）。
2. **仓库状态**：main 与 origin/main 同步；本地有 ai-base 其他代理在途改动（`backend/ai-base/`），**不要触碰**。
3. **测试命令**（必须用显式配置，避免扫全 workspace）：
   - 全量测试：`cd backend && npx vitest run -c vitest.config.ts`
   - lint：`npm --workspace backend run lint`（根目录跑）
   - 构建：`npm --workspace backend run build`
4. **推送**：`git -c http.version=HTTP/1.1 push origin main`（GitHub 间歇性断连，失败就间隔重试）。

## 二、任务清单（按优先级）

### P0：本地可立即推进（覆盖率 65%→85% 路线图，CodeBuddy 执行）

目标：把全局 Statements 从 ~65.6% 提升向 85%，每完成一批上调 vitest.config.ts 覆盖率阈值（当前 63/51/62/64；services/admin 专项 54/50/53/55）。
CodeBuddy 按下列批次执行；Codex 每批验收并更新报告。

- **批次 1（admin 财务/审批/审计）**：audit.service、bank-account.service、approval-records.service、receipt.service、expense.service、credit-adjust/limit/collection/risk/scoring.service。
- **批次 2（admin 报表/追溯/营销）**：custom-report.service、trace-config.service、trace-records.service、quote-push.service、marketing-flash-sale/group-buy/stack-rule/limited-discount/points-mall/asset.service。
- **批次 3（admin 通知/预警/损益）**：notification.service、alert.service、inventory-loss-order.service、profit-loss-stats.service。
- **批次 4（store/shared 收尾）**：coupon-verify.service、inventory.service、sale-bill.service 剩余、shared 的 seed-data/store-control-scheduler/pagination/db。
- 每批：CodeBuddy 执行并推送 → Codex 验收（跑全量 + lint + build + 覆盖率对比）→ 通过则 Codex 更新验收总览报告，未过则打回。

### 批次进度（2026-08-16 更新）
- ✅ **Batch 1 已完成并验收通过**：trace-config（10 例）/ approval-records（18 例）/ quote-push（13 例）= 41 例，覆盖率 66.17%（Codex 已确认，验收总览报告第 33 项）。
- ✅ **Batch 2 已完成并验收通过**：custom-report（27 例，stmts 97.51%）/ trace-records（34 例，stmts 88.83%）= 61 例，全量 529 文件 / 5610 用例，覆盖率 statements 67.41%（高于上批 66.17%），门槛全过（Codex 已确认，验收总览报告第 34/35 项）。注：marketing-flash-sale/group-buy/stack-rule/limited-discount/points-mall/asset 六服务测试此前已在仓库内（已提交），本次 Batch 2 实质新增为 custom-report 与 trace-records 两服务 0%→高覆盖；全量回归确认这六服务测试仍全部通过。
- ✅ **Batch 3 已完成并验收通过**：Codex 独立复核——全量 531 文件 / 5648 用例通过、lint 0 error、构建通过、覆盖率 statements 68.29%（CodeBuddy 自测 68.33%，实测 68.29%，均远高于门槛）、branches 55.95%（门槛 51）、functions 67.06%（门槛 62）、lines 70.1%（门槛 64）、services/admin 64.37%；alert.service（19 例，分支 71.56%）与 notification.service 质量抽查合格；inventory-loss-order/profit-loss-stats 回归全过（验收总览报告第 36 项）。⏳ **Batch 4 待执行**（coupon-verify、inventory、sale-bill 剩余、shared 收尾）。

### P1：生产证据类（需服务器，脚本已就绪）

服务器（root@VM-0-5-ubuntu，仓库 /opt/zhixiang/liquor-inventory-system）执行并在 docs/验收总览报告.md 回填证据：

- [ ] 生产压测/吞吐量：`scripts/load-test.mjs` 跑峰值，记录 QPS/TP99。
- [ ] SLA 可用性统计：部署 `deploy/health-monitor.sh` + 外部 uptime 服务，月度统计。
- [ ] 故障演练/降级：演练 circuit-breaker 与依赖故障（MySQL/Redis/微信 API 断连）。
- [ ] 灾备恢复演练：执行 `deploy/restore-drill.sh` 产出报告。
- [ ] 内存曲线/缓存命中率：生产监控周期采样。
- [ ] 可用性测试/响应速度：生产环境 Lighthouse + 真实用户采样。
- [ ] 生产部署验收：迁移 151-156 实库执行验证 + 微信支付真实下单/回调联调 + 三端线上冒烟。
- [ ] 移动端客户端更新链路验证：Electron 打包三架构（x64/ia32/arm64）上传与更新提示。

### P2：缺失项（需第三方）

- [ ] 渗透测试：聘请第三方出具渗透报告（前置：生产环境 + 上线前）。

### P3：长期提升（不阻断上线）

- [ ] KMS 密钥迁移（docs/密钥规范与KMS迁移计划.md）
- [ ] SonarQube 复杂度门禁
- [ ] 专业级 DAST
- [ ] staging 环境隔离
- [ ] 外部调用重试全接入
- [ ] 重复代码整合

## 三、完成标准

每完成一项：跑全量验证 → 更新 docs/验收总览报告.md → 提交推送（提交信息以 `feat/fix/test(验收-...)` 开头）。

## 四、交接说明

本文件由 Codex 生成。CodeBuddy 接手后按 P0→P1→P2→P3 顺序推进，遇到服务器权限/第三方依赖时在回复中明确标注"需用户/外部介入"。
