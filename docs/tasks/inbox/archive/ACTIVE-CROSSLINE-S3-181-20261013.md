# 【派单 S3-181（P0 跨线阻塞）】写端点 500 → 补入参校验 + DB 错误映射（AI 底座写链路全断）

- 派单人：**凌舟（总负责人）｜2026-10-13**
- 执行方：**阿坚（后端）**
- 工作区：从 `origin/main` 起新工作树，分支 `fix/s3-181-write-500-mapping`
- 触发：跨线缺陷报告 `docs/reports/跨线缺陷-后端写端点500-AI底座端到端阻塞-20261013.md`（AI 底座侧提，**阻塞其全部 36 个写工具**）

> ⚠️ 本文件是**并行单**，与 `docs/tasks/inbox/ACTIVE.md`（S3-180 批B2-1）**互不相干**：如果你的任务提到 **CROSSLINE / S3-181**，就只读这一份，**不要**去动 `wt-agents/S3-180`。

---

## 一、根因（凌舟已在生产复现并抓到栈，勿再重复求证）

同一处代码：`backend/src/services/admin/customer.service.ts:189-200` 的 `createCustomer`。

### 缺陷 1：没有入参校验（字段名不符 ⇒ 空值 ⇒ 500）

- 契约（`docs/API接口文档.md:417-430`）要求 `mobile` 必填；AI 底座发的是 `phone`。
- controller（`customer.controller.ts:15-18`）**没有 zod 校验**，直接把 `req.body` 交给 service。
- service 直接把 `body.mobile`（undefined）塞进 INSERT ⇒ MySQL `Column 'mobile' cannot be null` ⇒ **未捕获 ⇒ 500**。
- 生产栈（`/root/.pm2/logs/zhixiang-api-out.log`，traceId `2cd31ac0-…` 附近的告警）：
  ```
  POST /api/admin/members  状态码 500  Column 'mobile' cannot be null
    at queryWithTenant (backend/dist/config/database.js:151)
    at Module.createCustomer (backend/dist/services/admin/customer.service.js:28)
  ```

### 缺陷 2：没有唯一键冲突映射（重复手机号 ⇒ 500）

- 生产栈（`zhixiang-api-out.log`）：
  ```
  POST /api/admin/members  状态码 500  Duplicate entry '13900000001' for key 't_member.uk_member_mobile'
  ```
- `t_member.uk_member_mobile` 是唯一键 ⇒ 重复插入抛 `ER_DUP_ENTRY`，**没人映射** ⇒ 500。

### 我（凌舟）的生产实测（可复跑）

在服务器本机用**后端自己下发的 `csrfToken`**（不是 AI 底座算的）打 `/api/admin/members`：

| 请求 | 结果 |
|:--|:--|
| 无 CSRF | `403 CSRF token 无效或缺失` |
| **带后端下发的 CSRF + `{"name":…,"phone":…,"customerType":"WHOLESALE"}`** | **`500`**（栈即缺陷 1） |

⇒ **不是 AI 底座的 token 算错**，是我们后端 handler 抛未捕获异常。
（对照：同一次实测里 `POST /api/store/sale-bills` 带 CSRF + `{}` 返回 **400 参数校验失败** ⇒ 那个端点有 zod，其 500 属**另一个错因**，见 §三.3。）

## 二、交付物（3 件）

### ① `POST /api/admin/members`：补 zod 校验（对齐契约，**不改契约**）

- `name` 必填 string；`mobile` 必填 string（按既有口径校验手机号格式，若仓内已有可复用的校验器就用它）；`customerType` 可选枚举（对齐 `CustomerType`）；其余字段按 service 现有可选字段收。
- 校验失败 ⇒ **400**，响应体带**逐字段错误**（沿用项目既有 `fail(...)` / zod 错误格式，与同族端点一致）。

### ② DB 错误映射（本单核心 · 防"这一类"再变 500）

- **`ER_DUP_ENTRY`（1062）⇒ 409**（或项目既有冲突口径），消息里带上**人类可读的字段**（如"该手机号已存在"），**不要把 SQL 原文直接返回**。
- **`ER_NO_DEFAULT_FOR_FIELD`（1364）/ `ER_BAD_NULL_ERROR`（1048）⇒ 400**（属入参缺列，归客户端错误）。
- **落地位置**：优先做在**统一错误处理中间件**（`backend/src/middleware/error-handler.ts`）里按 `err.code` 映射，这样**同类端点一次性受益**；若你判断风险大，至少覆盖 `createCustomer` 等写服务，并在回传卡里说明为何没做全局。
- 🔴 **不得**把所有 DB 错误一律吞成 400（那会让真 bug 静默）——**只映射上面这几类已定性的码**，其余保持 500 并保留日志栈。

### ③ 复现 `POST /api/store/sale-bills` 的 500 并同样收口

- 用**D 级真实形状**的请求体（含 `items` 等必填）打到该端点，拿到它的真实 500 栈（按 §一 同样的方法看日志），**先给根因再修**。
- 若其 500 属同一类（DB 错误未映射）⇒ 由 ② 覆盖即可，补一条反测证明；若属别的错因（如某字段空值、业务前置缺失）⇒ 如实定性并修，**不许猜**。

## 三、验收标准（机器可判，**必须给原始输出**）

1. **改前基线（先做）**：把 §一 的两条复现贴出来（无 CSRF 403 / 带 CSRF 500 且栈为 `cannot be null`；重复手机号 500 且栈为 `Duplicate entry`）。
2. **改后**：
   - `{"name":"x","phone":"139…"}`（**AI 底座那种字段名**）⇒ **400** 且错误里指出 `mobile` 必填（**不再 500**）；
   - 同一 `mobile` 重复创建 ⇒ **409/400** 且消息是"已存在"类**业务文案**（**不含 SQL 原文**）；
   - 正常入参 ⇒ **200** 且落库成功（用 SQL 复核）。
3. **反测两侧**：把新加的 zod 校验去掉 ⇒ 第 2 条第一项**该红就红**（回到 500）；把 DB 映射改坏 ⇒ 重复项**该红就红**；两次均要复原后复绿。
4. `cd backend && npx vitest run` ⇒ **全量 0 failed**；`npx tsc -p tsconfig.json --noEmit` ⇒ **EXIT=0**；`guard-route-auth` 与 `guard-tenant-status` ⇒ 均 **EXIT=0**。
5. **不得**改契约文档的字段名（`mobile` 是权威口径）；**不得**为了消除 500 而放宽到"任何错误都 4xx"。

## 四、红线

1. **不得**改 `docs/migrations/**`、`.github/**`、`deploy/**`、`docs/API接口文档.md`、`docs/tasks/R101-收口总清单.md`、`docs/tasks/当前批次.md`。
2. **不得**顺手重构其它端点；本单只动 ① 的校验、② 的映射、③ 的该端点收口所必需处。
3. 只 add 本单文件，禁止 `git add -A`。
4. **不得** `git push`、**不得**开 PR（由凌舟在本机提交）。
5. 不得把"我这边过了"当证据；必须给命令 + 原始输出。

## 五、回传格式（照抄，十项不得省略）

```
【汇报 S3-181】<一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端）｜2026-10-13
一、交付物（文件 + 关键行号 + 改动性质）
二、改前基线（两条复现：原始输出 + 栈）
三、改后证据（字段名不符⇒400 / 重复⇒409 / 正常⇒200 且落库 SQL 复核）
四、反测两侧（校验去掉⇒红；映射改坏⇒红；复原⇒绿）
五、§三.3 的 sale-bills 500 根因与处置
六、验收自评（对照 §三 五条，逐条 ✅/⚠️/❌）
七、未完成与阻塞
八、风险与自我报备 + 关联卡（跨线报告 + 本卡）
```

## 六、完成后

回传卡落 `docs/tasks/cards/R101-S3-181-阿坚-回传.md`（工作区内）。把本文件移入 `docs\tasks\inbox\archive\`。最终回答给结论摘要。
