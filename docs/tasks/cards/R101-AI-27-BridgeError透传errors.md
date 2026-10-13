# R101-AI-27 · BridgeError 透传后端字段级 errors + traceId（凌舟重出 · P1）

> 依据：`docs/tasks/派单规范.md` §一 + §三；**上游 = S3-181-C 复跑的直接教训 + AI-21/22 报备族**
> 队列登记：`docs/tasks/当前批次.md` 文末「ZXQL-AI 线路」块

---

【派单 R101-AI-27】BridgeError 透传后端字段级 errors + traceId：根治"400 看不到原因"
派单人：凌舟（总负责人）｜2026-10-13
执行方：阿坚（后端架构）（仓库 `D:\Users\ZXQL\ZXQL-AI`，分支 `main`，**基线 `5c55364`**）
优先级 / 时间盒：P1 · 半天

## 背景与依据（真实生产教训，凌舟已取证）
- S3-181-C 复跑时，后端新校验返回**字段级错误**：
  ```json
  {"code":"400","msg":"参数校验失败","traceId":"80ce3465-f229-417a-9ad2-6e29dd2df2df",
   "errors":[{"field":"mobile","message":"手机号格式不正确","code":"invalid_string"}]}
  ```
  但我方工具返回只剩静态文案「客户名称不能为空…」—— **真实原因（mobile 格式）完全丢失**，生产排障瞎试 3 轮。
- 凌舟已定位（无需重复探查）：
  - `src/bridge/service-client.ts:477-499` `toBridgeError`：AxiosError 分支只取 `backendData.msg/code/traceId`，**`errors[]` 完全没取**
  - `src/bridge/service-client.ts:34-44` `BridgeError` 类：只有 `statusCode/backendCode/traceId`，**无 errors 字段**
  - 消费侧示例：`create-customer.tool.ts:296-303` catch 只拼 `err.message`
  - 后端错误体形态：`{code, msg, traceId, errors:[{field, message, code?}]}`（对方已实测确认）

## 交付物
1. `BridgeError` 增可选 `errors?: Array<{field: string; message: string; code?: string}>`（**向后兼容**既有 4 参调用点，全仓多处）
2. `toBridgeError` AxiosError 分支：取 `backendData.errors`（防御式：非数组忽略）传入；`traceId` 保持
3. **消费侧**：`create-customer.tool.ts` catch 把 errors 拼进返回（形态你定，但**面向用户可读**，如「mobile：手机号格式不正确」）
4. **至少再改 1 个写工具的 catch**（如 `create-sales-order.tool.ts`）—— 证明不是只修一个点
5. **反测（必做，对方要求的核心）**：mock 后端返回带 errors 的 400 ⇒ 工具返回**必须打印 field 级错误 + traceId**；去掉透传 ⇒ 红；改完即还原

## 验收标准（硬）
1. `tsc` 0 / `eslint "src/**/*.ts" --max-warnings=0` 0 / `jest --ci` 全绿，**不少于 152 套件 / 1667 用例**
2. 反测有原始输出（含"去掉透传 ⇒ 红"）
3. **既有 spec 零断言修改**
4. `create-customer.tool.ts` 的 `mobile` 契约（S3-181-C 刚改的）**不得回退**

## 红线
- junction worktree 内严禁 `pnpm`（[168]）；禁 `stash`/`checkout`/`reset`/`commit`/`push`（[165]）
- 不得改后端契约（mobile 权威口径，S3-181-C 刚统一）
- 不得 `.skip`、不得改既有断言凑绿、不得代写裁定/验收卡（§8.8）
- **半成品铁律**：做不完先还原自己的改动再报备；每完成一个文件自查 tsc
- 回传落 `docs/reports/R101-AI-27-阿坚-回传.md`，十项格式（含 ref=`5c55364`）

## 回传格式（十项，缺项无效）
```
【汇报 R101-AI-27-R】对应派单 R101-AI-27 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端架构）｜<YYYY-MM-DD>
交付物：<BridgeError 扩展 + toBridgeError + 消费侧 + 反测>
证据（可复跑）：<命令 + 原始输出摘要 + 反测 + ref=5c55364>
验收自评：<逐条对照 4 条硬标准，通过/未通过 + 依据>
未完成与阻塞：<逐条；没有也要写"无">
风险与自我报备：<向后兼容性核验结论；没有也要写"无">
回传要求：本汇报已落卡：docs/reports/R101-AI-27-阿坚-回传.md
关联卡：docs/tasks/cards/R101-AI-27-BridgeError透传errors.md
```
