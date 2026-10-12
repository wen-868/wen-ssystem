# R101-AI-24 · options.idempotencyKey 生产接线（凌舟重出 · P2-3）

> 依据：`docs/tasks/派单规范.md` §一 + §三；**上游 = R101-AI-21 自报备第 3 条**
> 队列登记：`docs/tasks/当前批次.md` 文末「ZXQL-AI 线路」块

---

【派单 R101-AI-24】`options.idempotencyKey` 生产接线：让调用方能显式指定幂等键
派单人：凌舟（总负责人）｜2026-10-12
执行方：阿坚（后端架构）（仓库 `D:\Users\ZXQL\ZXQL-AI`，分支 `main`，**基线 `1334135`**）
优先级 / 时间盒：P2 · 半天

## 背景与依据（凌舟已取证，直接引用）
- 上游缺口：R101-AI-21 自报备第 3 条 —— `options.idempotencyKey` **口子已就位但生产零调用方**（唯一使用在 spec）
- 凌舟实测确认：`src/tools/tool-executor.ts:61` 声明 `options.idempotencyKey?: string`、`:159` 传给闸门 `explicitKey`；**全仓生产代码零处传入**（唯一命中 `tool-executor.idempotency.spec.ts:180` 的 `'ERP-1'`）
- 闸门侧已支持：`idempotency-gate.service.ts` 的 `buildKey`（`:416` explicit 分支 ⇒ `keySource='explicit'`、TTL 用 `IDEMPOTENCY_REDIS_TTL_SEC`）

## 交付物
1. **最小可用接线（至少 1 处真实调用方）**，优先级从高到低，你能做几条做几条，但**至少要 1 条**：
   - a. **Agent 计划步**：`agent.controller.ts` 的 `plans/:id/run` 链路（若计划步调工具，允许调用方带业务键）
   - b. **admin 工具执行入口**：`admin.controller.ts:140` `POST /tools/execute`（管理端手动执行，可显式传键）
   - c. **外部系统/ERP 侧**：若本单范围内无自然调用方，**如实说明并只做 a 或 b**
2. **校验**：显式键的**格式校验与长度上限**（防止滥用/超长键打爆索引），不合规时的行为（拒绝 + 明确错误信息）
3. **文档/注释**：在 `tool-executor.ts:55` 的参数注释处补全「什么场景该用显式键」的指引
4. **反测（必做）**：
   - 接入的调用方传显式键 ⇒ 闸门按 `explicit` 分支生效（同键两次 ⇒ 第二次回放）
   - 传非法/超长键 ⇒ 被拒且有明确错误
   - 不传 ⇒ 行为与现状完全一致（回归）

## 验收标准（硬）
1. `tsc` 0 / `eslint "src/**/*.ts" --max-warnings=0` 0 / `jest --ci` 全绿，**不少于 147 套件 / 1616 用例**
2. **至少 1 处生产调用方真实接线**（给出 `文件:行号` 与调用方式）
3. 反测 3 条全有原始输出
4. 未接线的路径**行为零变化**（既有 spec 全绿即为证）
5. 显式键有格式校验 + 长度上限，拒绝路径有明确错误信息

## 红线
- junction worktree 内严禁 `pnpm`（[168]）；禁 `stash`/`checkout`/`reset`/`commit`/`push`（[165]）
- 不得改闸门的 `buildKey` 既有语义（explicit 分支行为不变）
- 不得为了接线而新增 DTO 破坏既有接口契约（若要改接口，先报备）
- 不得 `.skip`、不得改既有断言凑绿、不得代写裁定/验收卡（§8.8）
- **半成品铁律**：做不完先还原自己的改动再报备；每完成一个文件自查 tsc
- 回传落 `docs/reports/R101-AI-24-阿坚-回传.md`，十项格式（含 ref=`1334135`）

## 回传格式（十项，缺项无效）
```
【汇报 R101-AI-24-R】对应派单 R101-AI-24 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端架构）｜<YYYY-MM-DD>
交付物：<接线点 文件:行号 + 校验 + 注释 + 反测>
证据（可复跑）：<命令 + 原始输出摘要 + 3 条反测 + ref=1334135>
验收自评：<逐条对照 5 条硬标准，通过/未通过 + 依据>
未完成与阻塞：<逐条；没有也要写"无">
风险与自我报备：<哪些调用方没接及原因；没有也要写"无">
回传要求：本汇报已落卡：docs/reports/R101-AI-24-阿坚-回传.md
关联卡：docs/tasks/cards/R101-AI-24-idempotencyKey接线.md
```
