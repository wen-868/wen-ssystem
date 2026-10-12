# R101-AI-22 · 死信 sink 生产注册（凌舟重出）

> 依据：`docs/tasks/派单规范.md` §一 + §三；**上游 = R101-AI-21（`c2b4c21`）的自报备第 1 条**
> 队列登记：`docs/tasks/当前批次.md` 文末「ZXQL-AI 线路」块

---

【派单 R101-AI-22】死信 sink 生产注册：让 bestEffort 的死信**可复盘**
派单人：凌舟（总负责人）｜2026-10-12
执行方：阿坚（后端架构）（仓库 `D:\Users\ZXQL\ZXQL-AI`，分支 `main`，**基线 `c2b4c21`**）
优先级 / 时间盒：P1 · 半天

## 背景与依据（凌舟已取证，直接引用，无需重复探查）
- 上游缺陷：R101-AI-21 的幂等闸门在「MySQL 不可用 ⇒ fail-open」时，死信**只进日志 + 指标**，**未落库、无法复盘**（凌舟已实测：全仓 `setDefaultDeadLetterSink` 27 处命中中，非 spec 仅 4 处且全是 API 定义/注释/降级日志，**无任何生产注册**）
- API 已就绪：`src/common/error-semantics.ts:96` `setDefaultDeadLetterSink(sink)`；`DeadLetterRecord` 7 字段（`op` / `tenantId` / `detail` / `error` / `stack` / `level` 恒 `best_effort` / `at` ISO8601）
- 现有降级路径：`error-semantics.ts:228` 无 sink 时打「无死信接收方，记录仅留存日志」
- **同族参照**：`t_ai_idempotency`（016 迁移，AI-21 刚落地的表结构 + `@Cron` 清理 + README 登记模式）—— 照它的成例做，勿自造第二套

## 交付物
1. **新表 `t_ai_dead_letter`**（迁移 `017_ai_dead_letter.sql`，**只写 + 在 scratch 实例执行一次 + 幂等复跑一次**，证据同 016）：列与 `DeadLetterRecord` 逐字段对齐（含 `stack` 用 TEXT、`at` 用 DATETIME、`level` 固定 `best_effort`），加 `op` 与 `created_at` 索引；**不得新建与 016 不同的清理范式**
2. **sink 实现**：把死信写入 `t_ai_dead_letter`（用既有仓储/`bestEffort` 语义，注意**sink 自身失败不得递归打日志刷屏** —— 静默计数或降级为一次 warn）
3. **生产注册点**：在启动阶段调用 `setDefaultDeadLetterSink(...)`（参照同仓既有 `OnModuleInit` / 启动装配位置；注册失败不得阻断启动）
4. **清理**：沿用 **R101-AI-17 同款 `@Cron` 模式**（命名任务，每日一次，分批 DELETE），保留期给出依据（建议 30 天，与 016 对齐）
5. **补 `migrations/README.md` 的 017 登记**（同 016 成例）
6. **反测（必做）**：
   - 注册后触发一次 bestEffort 失败 ⇒ 死信**真的落库**（断言行数 +1）
   - 去掉注册点 ⇒ 落库断言变红
   - sink 自身写入失败 ⇒ 不抛、不刷屏、有计数/告警

## 验收标准（硬）
1. `tsc` 0 / `eslint "src/**/*.ts" --max-warnings=0` 0 / `jest --ci` 全绿，**不少于 146 套件 / 1604 用例**
2. 迁移：scratch 执行一次 + 幂等复跑（PASS2 exit 0）+ `SHOW CREATE TABLE` 前后一致
3. 反测 3 条全有原始输出
4. `error-semantics.ts:228` 的「无死信接收方」降级日志**不再出现于生产路径**（有断言或证据）
5. **不得破坏 AI-21 的 fail-open 行为**（MySQL 不可用仍要放行，且此时死信要能落库——注意这里有个循环依赖：死信落库依赖 MySQL，而 fail-open 场景正是 MySQL 不可用 ⇒ **必须显式处理**：MySQL 不可用时 sink 降级为日志 + 指标，不得无限重试/阻塞）

## 红线
- 迁移只写 + scratch 执行一次 + 幂等复跑一次；**不得对业务库/生产库做任何其他写入**
- 不得改 `error-semantics.ts` 的既有语义（`bestEffort`/`degrade`/`mustSucceed` 行为零变化）
- junction worktree 内严禁 `pnpm`（[168]）；禁 `stash`/`checkout`/`reset`/`commit`/`push`（[165]）
- 不得 `.skip`、不得改既有断言凑绿、不得代写裁定/验收卡（§8.8）
- **半成品铁律**：做不完先还原自己的改动再报备；每完成一个文件自查 tsc
- 回传落 `docs/reports/R101-AI-22-阿坚-回传.md`，十项格式（含 ref=`c2b4c21`）

## 回传格式（十项，缺项无效）
```
【汇报 R101-AI-22-R】对应派单 R101-AI-22 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端架构）｜<YYYY-MM-DD>
交付物：<迁移 + sink + 注册点 + 清理 + README + 反测>
证据（可复跑）：<命令 + 原始输出摘要 + SHOW CREATE TABLE + 3 条反测 + ref=c2b4c21>
验收自评：<逐条对照 5 条硬标准，通过/未通过 + 依据>
未完成与阻塞：<逐条；没有也要写"无">
风险与自我报备：<含"MySQL 不可用时 sink 的降级行为"实测结论；没有也要写"无">
回传要求：本汇报已落卡：docs/reports/R101-AI-22-阿坚-回传.md
关联卡：docs/tasks/cards/R101-AI-22-死信sink生产注册.md
```
