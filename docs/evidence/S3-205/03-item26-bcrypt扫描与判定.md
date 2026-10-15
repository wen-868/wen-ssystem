# 第 26 项 · `bcrypt` 直调绕开 `verifyPassword()` / `hashPassword()` 的扩围扫描与逐条判定

> 扫描命令（可复跑，工作区 `D:\Users\ZXQL\wt-agents\S3-205`）：
> `rg -n --no-heading -g '!**/node_modules/**' -g '!**/package-lock.json' "bcrypt(js)?\.(compare|compareSync|hash|hashSync)" .`
> 及 `rg -n "bcrypt" backend/src`（含注释/文档/测试夹具，逐条人工判定）。
> 基线 `origin/main` = `36a7a02f`。

## 一、判定口径（先立规，再逐条判）

项目**唯一**的口令哈希/校验入口是 `backend/src/shared/password.ts`：
`hashPassword()` / `hashPasswordSync()`（`"v2$" + bcrypt(cost=12)`）与
`verifyPassword()` / `verifyPasswordSync()`（内部 `stripVersionPrefix` 后比对）。

**风险根因（S3-172 原型事故）**：库内一旦并存两种口径（带 `v2$` 前缀 / 不带），
**任何"按裸 bcrypt 校验"的代码或测试对带前缀的哈希恒为 `false`** ——
"验证不通过"会被误读成"凭据不对/功能坏了"，而不是"比对方法不对"（踩坑日志 [114] 同源）。
⇒ 扫描目标是**所有**绕过封装的 `bcrypt.hash*` / `bcrypt.compare*`。

## 二、扫描结果与逐条判定

### A 类 · 产品代码里的**口令写入**（隐患，本单已统一走封装）—— 8 处 / 6 文件

| # | 文件:行（改前） | 用途 | 改前原文 | 改后 |
|--:|:--|:--|:--|:--|
| 1 | `services/admin/sys-user.service.ts:155` | 管理端建用户（`t_sys_user.password_hash`） | `await bcrypt.hash(input.password, 10)` | `await hashPassword(input.password)` |
| 2 | `services/admin/sys-user.service.ts:263` | 管理端重置用户口令 | `await bcrypt.hash(newPassword, 10)` | `await hashPassword(newPassword)` |
| 3 | `services/admin/employee.service.ts:134` | 建员工（带口令） | `await bcrypt.hash(body.password, 10)` | `await hashPassword(body.password)` |
| 4 | `services/admin/employee.service.ts:135` | 建员工（默认口令） | `await bcrypt.hash("123456", 10)` | `await hashPassword("123456")`（字面量见 §四.1） |
| 5 | `services/platform/admin-account.service.ts:150` | 平台建管理员 | `await bcrypt.hash(params.password, 10)` | `await hashPassword(params.password)` |
| 6 | `services/platform/admin-account.service.ts:283` | 平台重置管理员口令 | `await bcrypt.hash(initialPassword, 10)` | `await hashPassword(initialPassword)` |
| 7 | `services/platform-tenant.service.ts:153` | 开通租户时首个管理员口令 | `await bcrypt.hash(data.adminPassword, 10)` | `await hashPassword(data.adminPassword)` |
| 8 | `services/platform/tenant-admin.service.ts:300` | 租户默认管理员（默认口令） | `await import("bcryptjs").then(m => m.hash("123456", 10))` | `await hashPassword("123456")`（字面量见 §四.1） |

**同族第 9~11 处（`shared/migration.ts`，启动迁移写口令）**：

| # | 文件:行（改前） | 用途 | 改前原文 | 改后 |
|--:|:--|:--|:--|:--|
| 9 | `shared/migration.ts:741` | 第 4 步：把 SHA256 旧口令重置为随机值 | `bcrypt.hashSync(randomBytes(24).toString("hex"), 10)` | `hashPasswordSync(randomBytes(24).toString("hex"))` |
| 10 | `shared/migration.ts:1178` | 第 7.1 步：种入平台管理员 `admin` | `bcrypt.hashSync(seedAdminPassword \|\| randomBytes(24).toString("hex"), 10)` | `hashPasswordSync(…)` |
| 11 | `shared/migration.ts:1217` | 第 7.2 步：种入租户管理员 `tenant_admin` | 同 10 | `hashPasswordSync(…)` |

> 这三处**写入的正是最高权限账号的登录口令**，却是全仓唯一仍产"无 `v2$` 前缀 + cost 10"哈希的地方
> ⇒ 与 `shared/seed-data.ts`（S3-175 起就用 `hashPasswordSync`）、登录链路的 `verifyPassword` 三方不一致。
> 统一后本仓产品代码**不存在第二种口令哈希口径**。
> 兼容性：`verifyPassword` 对**无前缀旧哈希**与 `v2$` 新哈希都可校验（`stripVersionPrefix` 只剥前缀），
> 故存量行不受影响；`migration.ts` 第 4 步的筛选条件 `password_hash NOT LIKE '$2b$%' AND LENGTH=64`
> 也不受影响（`v2$` + bcrypt 长度为 63，不会命中"64 位 SHA256"）。

### B 类 · 产品代码里的**密钥/Secret**哈希（**不是口令，本单不改**）—— 4 处 / 3 文件

| 文件:行 | 用途 | 为何不改 |
|:--|:--|:--|
| `services/platform/open-webhook.service.ts:309` | webhook 订阅 `sign_secret` 哈希 | 非口令。它没有"登录校验"场景，明文只在创建响应出现一次；且与 `open-api-key` / `library` 两处属**同一族密钥口径**，单改一处反而制造新的不一致 |
| `services/platform/open-api-key.service.ts:295` / `:426` | 开放平台 `api_secret` 哈希（签发 / 轮换） | 同上 |
| `services/platform/library.service.ts:1201` | 库 API Key `api_secret` 哈希 | 同上 |

> 复核结论：这三族密钥在**产品代码里没有任何 `bcrypt.compare` 校验点**（`rg` 全仓 0 命中），
> 即"写入即唯一路径"，不存在"两种校验口径"隐患；把它们并入**口令**封装会给密钥误挂 `v2$` 口令版本前缀，
> 语义混淆、收益为零 ⇒ 本单不动，仅登记。若后续要给密钥族做统一封装，应另立单（建议命名 `secret-hash`）。

### C 类 · **校验**侧（`bcrypt.compare*`）：产品代码 **0 处**（重要结论）

`rg -n 'verifyPassword' backend/src --glob '!**/__tests__/**'` 复核：全部 5 个校验点
（`services/wechat.service.ts:149`、`services/platform/platform-auth.service.ts:161`、
`services/miniapp/member.service.ts:766/772`、`services/store/auth.service.ts:82`、
`services/admin/auth.service.ts:105/282`）**都走 `verifyPassword()`**。
⇒ **产品代码里不存在"用自己的口径校验口令"**；S3-172 那条隐患的**校验侧**在全仓已收口。

### D 类 · 测试夹具 / 脚本 / 文档（直调有理由，**逐处注明**）

| 文件:行 | 用途 | 理由（保留直调） |
|:--|:--|:--|
| `backend/src/__tests__/shared/password.test.ts:65/96/102` | **被测对象就是 `password.ts` 本身** | 需要构造"无前缀旧哈希 / cost 不同的 `v2$` 哈希"来验 `verifyPassword`、`needsRehash` 的兼容分支 ⇒ 必须直调 bcrypt 造夹具 |
| `backend/src/__tests__/services/platform/open-webhook.service.test.ts:183` | 断言"明文与库内哈希对得上" | 对象是 **B 类密钥**（非口令，未走封装）⇒ 用 bcrypt 直调是**与实现同口径** |
| `backend/src/__tests__/services/platform/open-api-key.service.test.ts:196/328` | 同上 | 同上 |
| `backend/src/__tests__/shared/migration*.test.ts`（4 文件 `vi.mock("bcryptjs")`） | mock `hashSync` 以隔离迁移步骤 | 只 mock 不直调；**本单因口径统一同步改了 `migration.test.ts` 的一处分辨断言**（见 §三） |
| `backend/scripts/s3-142-real-backend.mjs:157`、`s3-151-barcode-tenant-unique.mjs:298` | 本地验证装置自造账号 | 手工复刻封装口径（`"v2$" + hashSync(pw, 12)`）——**是"第二份实现"**，但它们不是产品代码、只用于本机核查；改用 `shared/password` 需跨端引入 TS 模块，成本高于收益 ⇒ 登记不改 |
| `docs/evidence/**`（S3-203 / S3-204 等装置） | 历史证据包 | 证据归档，不得回改（改了就破坏"原始输出"） |
| `docs/migrations/*.sql` 注释（075 / 081） | 注释里的"生成方式"说明 | 注释文本，非可执行代码；且已被踩坑[158]/S3-202 指路注释处理 |

## 三、随本单同步调整的测试断言（**需凌舟知晓**）

| 文件:行 | 改动 | 为什么必须改 |
|:--|:--|:--|
| `backend/src/__tests__/shared/migration.test.ts:683` | 分辨口径由 `rounds === 10` 改为参数形态 `/^[0-9a-f]{48}$/`，并新增 `expect(rounds).toBe(12)` | 口径统一后所有哈希都 cost=12，"按 cost 分辨步骤"失效；改按参数形态分辨（本步骤传 48 位 hex，`seed-data` 传 32 位 base64url）。**这是"把口径统一钉进断言"的更严写法**，不是放宽 |
| `backend/src/__tests__/services/platform/admin-account-c6.service.test.ts:58/107` | `bcrypt.compareSync(...)` ⇒ `verifyPasswordSync(...)` + 新增 `startsWith("v2$")` 断言 | 原断言是**裸 bcrypt**，产品改走封装后对它恒 false（**这正是 S3-172 原型事故的重现**）；改用唯一校验入口 ≤ 与 S3-172 的修法一致 |
| `backend/src/__tests__/services/admin/employee.service.test.ts` | 删掉 `vi.mock("bcryptjs")`，改 mock `shared/password` 的 `hashPassword`；断言由 `toHaveBeenCalledWith(pw, 10)` ⇒ `toHaveBeenCalledWith(pw)` | 被测代码已不 import bcryptjs；保留 bcrypt mock 会掩盖"到底走哪个入口" |

> **未放宽任何门禁/断言**：三处都属"把断言换成与被测对象同一口径"，其中两处是**新增**断言（`v2$` 前缀、cost=12）。
