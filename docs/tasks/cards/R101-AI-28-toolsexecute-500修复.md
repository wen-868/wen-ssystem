# R101-AI-28 · tools/execute 端点 500 修复（凌舟重出 · E2E 发现）

> 依据：`docs/tasks/派单规范.md` §一 + §三；**来源 = 凌舟端到端验证实测**
> 队列登记：`docs/tasks/当前批次.md` 文末「ZXQL-AI 线路」块

---

【派单 R101-AI-28】修复 `POST /api/admin/tools/execute` 的 500：缺 authToken + 缺 context 校验
派单人：凌舟（总负责人）｜2026-10-13
执行方：阿坚（后端架构）（仓库 `D:\Users\ZXQL\ZXQL-AI`，分支 `main`，**基线 `f955cdf`**）
优先级 / 时间盒：P1 · 半天

## 背景与依据（凌舟生产实测 + 代码核实，无需重复探查）
- **现象（生产 E2E 实测）**：带合法商家 JWT 调 `POST /api/admin/tools/execute` 执行任意读工具（queryInventory / querySaleBills / queryCustomerDetail）⇒ **HTTP 500** `AI_005: Cannot read properties of undefined (reading 'tenantId')`
- **根因 1（调用方侧）**：我的首测**没传 `context` 字段** ⇒ DTO 的 `@ValidateNested()` 对 `undefined` 不报错 ⇒ controller `:170` 读 `dto.context` 相关字段时崩（**应 400，实际 500**）
- **根因 2（端点侧，修好根因 1 后会暴露）**：`admin.controller.ts:169-175` 构造的 `context` **不含 `authToken`** ⇒ 工具内部经 `ServiceClient` 调后端时**无 Authorization** ⇒ 后端 401「未登录」（我实测：补 context 后返回 `success:false, error:查询库存汇总失败：后端 HTTP 401`）⇒ **该端点实际不可用**
- 参照：`/chat` 链路的 context **带 `authToken`**（`chat.controller` 从 TenantContext 取），故对话链路工具全通 —— **本单就是把 tools/execute 对齐这条范式**
- 现有校验：`execute-tool.dto.ts:65-67` 已有 `@ValidateNested() @Type(() => ToolContextDto)`（**保留**，只补 required 语义）

## 交付物
1. **DTO**：`ExecuteToolDto.context` 补 `@IsDefined()`（或等效）⇒ 缺 `context` ⇒ **400**（不是 500）；错误信息可读
2. **authToken 注入**：`admin.controller.ts:169-175` 构造 context 时补 `authToken`（来源 = `AdminGuard` 挂在 req 上的 JWT —— 参照 `admin-auth.guard.ts` 的 `attachIdentity`/`adminIdentity`，若原始 token 未存则补存）
   - 目的：工具经 `ServiceClient` 调后端时带 `Authorization` ⇒ 后端 401 消失
3. **回归保护**：
   - 既有 5 例 `admin.controller.execute-tool-scope.spec.ts`（租户锁定 P0 回归）**必须全绿**（`expect` 零修改；若构造函数加参需补桩，同 AI-22 成例）
   - 商户锁本租户 / 平台指定目标租户 / 平台未指定 400 —— 三条口径**不得变化**
4. **反测（必做）**：
   - 缺 `context` ⇒ **400**（修复前 500）
   - **有 authToken** ⇒ `ServiceClient.buildRequestConfig` 的 headers 含 `Authorization`（断言透传）
   - 去掉注入 ⇒ 断言变红（证明是承重代码）

## 验收标准（硬）
1. `tsc` 0 / `eslint "src/**/*.ts" --max-warnings=0` 0 / `jest --ci` 全绿，**不少于 152 套件 / 1667 用例**
2. 反测 3 条全有原始输出
3. **既有 spec 零断言修改**（补桩除外，同 AI-22 成例）
4. 三条租户口径零变化

## 红线
- junction worktree 内严禁 `pnpm`（[168]）；禁 `stash`/`checkout`/`reset`/`commit`/`push`（[165]）
- 不得放开任何越权口径（商户锁本租户 / 平台须显式指定 —— 既有断言守着）
- 不得 `.skip`、不得改既有断言凑绿、不得代写裁定/验收卡（§8.8）
- **半成品铁律**：做不完先还原自己的改动再报备；每完成一个文件自查 tsc
- 回传落 `docs/reports/R101-AI-28-阿坚-回传.md`，十项格式（含 ref=`f955cdf`）

## 回传格式（十项，缺项无效）
```
【汇报 R101-AI-28-R】对应派单 R101-AI-28 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端架构）｜<YYYY-MM-DD>
交付物：<DTO + authToken 注入 + 反测>
证据（可复跑）：<命令 + 原始输出摘要 + 3 条反测 + ref=f955cdf>
验收自评：<逐条对照 4 条硬标准，通过/未通过 + 依据>
未完成与阻塞：<逐条；没有也要写"无">
风险与自我报备：<authToken 透传的安全考量（管理端手动执行，权限=操作者本人）；没有也要写"无">
回传要求：本汇报已落卡：docs/reports/R101-AI-28-阿坚-回传.md
关联卡：docs/tasks/cards/R101-AI-28-toolsexecute-500修复.md
```
