# 回执 · S3-196（第 52＋58 项：消费者端身份/CSRF 适配层）

> 汇报对象：凌舟（总负责人）｜汇报人：**阿坚（后端 / 客户端 · 本地通道）**｜日期：**2026-10-14**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-196.md`（已归档为 `docs/tasks/inbox/archive/ACTIVE-S3-196-20261014.md`）
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-196-阿坚-回传.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-196`｜分支 `fix/s3-196-consumer-identity-csrf`｜基线 `origin/main` = `5fdd6da3`
> **本地提交（未 push、未开 PR）：`c7bc7a5b`**（代码 + 证据包）｜对照装置：`D:\Users\ZXQL\wt-agents\S3-196-base`（`--detach 5fdd6da3`，未改动产物）
> 证据包（可复跑，脚本与原始输出全部入库）：`docs/evidence/S3-196/`，索引见其 `README.md`

```
【汇报 S3-196】第 52 项「消费者身份适配层」+ 第 58 项「消费者端 CSRF 适配」：微信令牌 ⇒ 绑定会员身份打通（49/49 写端点由 401 ⇒ 越过门到业务码；45/45 改造前恒 401 已在基线实例上复现）；客户端 100% 走统一封装携带 x-csrf-token；通知 2 个写端点补 CSRF 并删除 R2_EXEMPT 两条豁免（G3 仍 EXIT=0，反测摘掉即红）
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 客户端 · 本地通道）｜2026-10-14
交付物：见下「二、交付物」
证据（可复跑）：见下「四、原始证据」
验收自评：见下「五、验收自评」
未完成与阻塞：见下「六、未完成与阻塞」
风险与自我报备：见下「七、风险与自我报备」
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-196-阿坚-回传.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-196-20261014.md
```

## 一、一句话结论

老 miniapp 的消费者链路此前**整段不可用**：它手上只有微信令牌，而后端消费者端一律要商家端 JWT
⇒ 45/45 写端点在**基线产物**上恒 `401`（不是"偶发"）。本单新增 `requireConsumerAuthWithTenant`：
微信令牌 ⇒ 按 `openid` 解析**绑定的会员身份**（`t_member.id`，roles 恒空）注入登录态；
CSRF 侧让同一登录态的「会员 id / 微信用户 id」两个等价主体都可用，老端**一个登录令牌即可同时驱动**
微信端点与消费者端点。客户端侧把老端全部消费者调用点收口到 `app.request()`（自动带
`Authorization` + `x-csrf-token`），Taro 端 `request.ts` 同样携带。收口第 58 项：
`notification.routes.ts` 的 2 个写端点补 `csrfMiddleware` 并**删除 `R2_EXEMPT` 两条豁免**，
`guard-route-auth` 仍 `EXIT=0`，且"摘掉就红"已反测。

## 二、交付物（逐文件）

| # | 文件 | 改动 | 为什么 |
|:--:|:--|:--|:--|
| 1 | `backend/src/middleware/consumer-auth.ts`（新增） | `requireConsumerAuth` / `requireConsumerAuthWithTenant` | 第 52 项主体：消费者端接受微信令牌 ⇒ 绑定会员身份 + 租户注入 + 显式失败 |
| 2 | `backend/src/middleware/csrf.ts` | 支持 `req.csrfSubjectIds`（多等价主体；缺省行为逐字不变） | 登录下发的是 `HMAC(微信用户 id)`，业务身份是会员 id ⇒ 同一登录态两主体都应可用 |
| 3 | `backend/src/shared/auto-routes.ts` | 新增 `auth: "requireConsumerAuthWithTenant"` 分支（= 认证 + 租户 + CSRF） | 让声明式路由（`cart.routes.ts`）也能用消费者身份 |
| 4 | `backend/src/routes/miniapp.routes.ts` | 56 处 `requireAuthWithTenant` → `requireConsumerAuthWithTenant` | `/api/miniapp/**` 是消费者面；写端点的 `csrfMiddleware` 原样保留（顺序认证在前） |
| 5 | `backend/src/routes/marketing-miniapp.routes.ts` | 7 处同上（claim/my/points/my-records/buy/join/calculate） | 第 52 项判据对象（老端三处调用） |
| 6 | `backend/src/routes/aftersale.routes.ts` | 小程序分支 6 处同上（admin 分支声明式不动） | 售后 miniapp 面同属消费者端 |
| 7 | `backend/src/routes/cart.routes.ts` | 声明式 `auth` 改 `requireConsumerAuthWithTenant` | 购物车/结算写端点（auto-routes 照常成对附 CSRF） |
| 8 | `backend/src/routes/notification.routes.ts` | 小程序分支 4 处换消费者认证 + **2 个写端点补 `csrfMiddleware`** | 第 58 项：豁免的移除条件达成 ⇒ 改真覆盖 |
| 9 | `backend/src/controllers/admin/wechat.controller.ts` | `bind` 开头加租户显式校验 | 裁定④：两源都缺 ⇒ 400 显式失败且不落库（此前用空租户一路走到 service，把"缺租户"误报成"账号不存在"） |
| 10 | `backend/scripts/guard-route-auth.mjs` | `AUTH_MIDDLEWARES` 补新中间件名；**删除 `R2_EXEMPT` 两条豁免**；同步两处登记文字 | 门禁识别新鉴权写法（否则判据反向失真）+ 豁免按期移除 |
| 11 | `miniapp/app.js` | `fetchWxProfile` 改走 `this.request()`；登录处注明"令牌来源保持裸调用" | 统一封装是携带 CSRF 的唯一出口 |
| 12 | `miniapp/pages/coupons/index.js` | 3 处调用改 `app.request()`；**删除客户端声明的 `userId`** 与 `getUserId()`；登录判定改用 `app.isLoggedIn()` | 身份一律取登录态（客户端声明会与登录态不一致 ⇒ 403） |
| 13 | `miniapp/pages/notifications/index.js` | 3 处（含 `PUT /:id/read`）改 `app.request()` | 该写端点本次补了 CSRF ⇒ 必须带令牌 |
| 14 | `miniapp/pages/{profile,order,statement,aftersale,aftersale-detail,share-collection}/index.js`、`miniapp/utils/theme.js` | 10 处裸 `wx.request` → `app.request()` | 卡面要求"所有消费者端调用点统一封装"，消除"下次新写又漏令牌"的土壤 |
| 15 | `miniapp/src/api/request.ts`、`miniapp/src/stores/user.ts` | 统一封装增加 `x-csrf-token`；store 保存/持久化/清理 `csrfToken` | Taro 端同一条链路（登录响应已下发 `csrfToken`） |
| 16 | `docs/API接口文档.md` | 微信登录响应补 `csrfToken` 行 + 新增「消费者端身份与 CSRF 载体」契约段 | 防线2：载体/请求头/租户顺序属契约变更，先落文档 |
| 17 | 新增 4 个测试文件（31 例） | 适配层 15 例 + 营销接线 8 例 + 通知 CSRF 5 例 + bind 租户 3 例 | 判据锁死（含反测用例） |
| 18 | `backend/src/__tests__/routes/cart.test.ts` | 1 行断言随契约有意变更 | 该文件原断言 `auth === "requireAuthWithTenant"`，属**唯一**被本单改动的存量测试（已在代码注释写明理由） |
| 19 | `docs/evidence/S3-196/**` | 证据包（脚本 + 原始输出 + 指纹） | 可复跑 |

- **未动**：`.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/tasks/inbox/ACTIVE.md`（路由表，另有三单在跑）、
  `current-tasks.md`、`docs/数据库变更清单.md`、`docs/migrations/**`、记忆文件、其它工作树。
- 本单**无 DDL / 无迁移**（`t_member.openid`、`t_notification.recipient_id` 等均为既有列，只读使用）。

## 三、定性与设计口径（凌舟裁定③/④ 的落地方式）

1. **消费者身份 = 绑定的会员（`t_member.id`）**。依据两条既有代码事实：
   `community-marketing.service.ts:704`「**小程序用户 id 即 t_member.id**」；
   订单侧 `miniapp.service.ts:489-492`（`t_miniapp_order.member_id` JOIN `t_member`）。
   ⇒ 用 `openid` 找会员，而不是把微信用户 id 当业务身份（否则后台发的券/通知与消费者侧永远对不上）。
2. **`roles` 恒空**：消费者身份在任何 `requireRoles/requirePermission` 面前都不可能被当成商家/平台身份。
3. **租户来源三步**（第 3 步为本单实现期补入，**已报备**，见 §七.1）：
   令牌 `tenantId` → `X-Tenant-Id` → 按 `openid` **唯一**命中会员取其租户；
   不可解析（未绑定 / 跨租户多命中）⇒ `401` 显式失败，**不落库、不默认租户、不取第一条**。
4. **商家端 JWT 原样透传**（issuer/audience 双校验不变）⇒ 既有调用方与既有测试零回归。
5. **CSRF**：`csrfMiddleware` 认 `req.csrfSubjectIds`（本单仅适配层会设置）——
   `[会员 id, 微信用户 id]`。二者同属一个已认证登录态，故这不是"放宽"，而是"让同一会话的两种身份口径都可用"。

## 四、原始证据（可复跑）

装置：本机私有 MariaDB `127.0.0.1:3406` 上**本单自建**的两个 scratch 库
`s3196_e2e`（本单产物，端口 18096）与 `s3196_e2e_base`（基线产物，端口 18097）；
夹具 = 会员 `openid-s196`（id=4, tenant=`default`）+ 券模板 + 通知。生产库零写操作。

### 4.1 端到端矩阵（49 写端点 × 4 腿 + 4 读端点，`matrix-report.md` / `matrix-raw.json`）

| 口径 | 读数 |
|:--|:--|
| 写端点总数 | **49**（miniapp 组 45 / wechat 组 4） |
| **fixed + 有 CSRF**（老端真行为）越过 401/403 | **49/49** |
| fixed + 无 CSRF（反测①：客户端摘掉令牌）⇒ `403` | **49/49** |
| **base + 微信令牌**（改造前）miniapp 写端点仍 401 | **45/45** |
| base + 商家 JWT + CSRF（改造前的合法载体对照） | 47/49 可达业务码；**2 个端点 500 与本次改造无关**（见 §七.3） |
| 读端点 | base 全 401 → fixed 全 200（`coupons/my`、`points/my`、`notifications`、`orders`） |

逐端点状态码见 `docs/evidence/S3-196/matrix-report.md`（含每一格 `状态/业务码`）。

### 4.2 真实客户端产物装置（`client-harness.mjs` / `client-harness.json`）

桩化 `wx/App` 后**加载 `miniapp/app.js` 本体**，调用它自己的 `request()` 取回它组装的 header
（`{Content-Type, Authorization: Bearer <微信令牌>, x-csrf-token}` —— **不是手写的头**），再用这份头打真实后端：

| 调用（老端页面） | 端点 | 结果 |
|:--|:--|:--|
| coupons 页领取 | `POST /api/miniapp/marketing/coupons/1/claim` | `400/400`「您已领取过该优惠券」（业务码；且证明券已按会员身份落库） |
| coupons 页我的 | `GET /api/miniapp/marketing/coupons/my` | `200/0` |
| notifications 页标记已读 | `PUT /api/miniapp/notifications/1/read` | `200/0` |
| notifications 页全部已读 | `POST /api/miniapp/notifications/read-all` | `200/0` |
| home 页加购 | `POST /api/miniapp/cart/add` | `200/0` |
| 汇总 | `blocked = 0`（无 401/403） | `HARNESS_OK` |

### 4.3 库里归属（证明"身份真的按会员口径落库"）

| 表 | 读数 |
|:--|:--|
| `t_member` | `id=4, tenant_id=default, openid=openid-s196, status=1` |
| `t_user_coupon` | `id=1, template_id=1, **user_id=4**, tenant_id=default, status=UNUSED` |
| `t_notification` | `id=1, recipient_id=4, is_read=1, read_at=2026-10-14 06:06:41` |
| `t_cart_item` | `id=1, **customer_id=4**, sku_id=1, quantity=1, tenant_id=default` |

### 4.4 反测（缺一不可）

| 反测 | 做法 | 读数 |
|:--|:--|:--|
| ① 客户端摘掉 `x-csrf-token` | 49 个写端点同请求去掉该头 | **49/49 → `403`**（`matrix-report.md` 的 `fixed无CSRF` 列）；单测另锁（营销 claim、通知 read） |
| ② 服务端摘掉通知端点 `csrfMiddleware` | 临时摘两行 ⇒ 跑 G3 | **EXIT=1**，点名 `notification.routes.ts:29/30` 两条 ⇒ 复原后 **EXIT=0**（`reverse2-guard-red.txt` / `reverse2-guard-restored.txt`） |
| ③ `bind` 两源都缺 | 微信令牌（无 tenantId）+ 无 `X-Tenant-Id` | **`400`「缺少租户信息…」**，且 `t_user_binding` **0 → 0**（未落库）；对照（带 `X-Tenant-Id`）为业务 `400 账号不存在`（`probe-bind-tenant-output.txt` / `-db.txt`） |

### 4.5 门禁（原始输出在 `gates-*.txt`）

| 门禁 | 命令 | 结果 |
|:--|:--|:--|
| 后端全量测试 | `npx vitest run` | **656 files / 7722 tests / 0 failed** |
| 类型检查 | `npx tsc -p tsconfig.json --noEmit` | **EXIT=0** |
| 构建 | `npm --workspace backend run build` | **EXIT=0**（1876 处导入修复，含动态 import 19 处） |
| G3 | `node scripts/guard-route-auth.mjs` | **EXIT=0**（189 文件；**无豁免失效告警**——R2_EXEMPT 已空） |
| G2 | `node scripts/guard-tenant-status.mjs` | **EXIT=0** |
| G3.6 | `node scripts/guard-route-prefix.mjs` | **EXIT=0** |
| 小程序发布包自检 | `node scripts/check-miniapp-release.mjs` | **PASS**（与基线同） |
| Taro 端类型检查 | `npx tsc -p miniapp/tsconfig.json --noEmit` | **EXIT=0**（与基线同） |

## 五、验收自评（逐条对照卡面）

| 卡面判据 | 自评 | 依据 |
|:--|:--|:--|
| §三.1 端点清单（消费者端挂 CSRF 的写端点 + 各端调用位置） | ✅ | `matrix-report.md`（49 条）+ §四.2 老端逐页调用点；Taro 端调用点清单见 §七.4 说明 |
| §三.2 客户端改造（Taro 统一封装；原生端裸调用点补 CSRF） | ✅ | §二 第 11~15 项；静态读数：老端仅剩 2 处裸 `wx.request`（`app.js:36`、`profile:138`，均为**登录本身**——令牌来源，无令牌可带）+ 1 处是封装内部实现（`app.js:104`） |
| §三.3 端到端实证（每端点：改造前 403 ⇒ 改造后 200/业务码） | ✅ | §四.1 四腿矩阵（49 写端点逐条）；§四.2 用真实客户端头复验 5 条主链路 |
| §三.4 收口第 58 项（删 2 条豁免 + 通知 2 写端点补 CSRF + G3 仍 0） | ✅ | §二 第 8/10 项；§四.5 G3；§四.4 反测② |
| §三.5 反测三条 | ✅ | §四.4 ①②③ |
| §五 红线（不放宽鉴权/CSRF、不用 NODE_ENV 绕过、不改 .github/deploy/清单、生产库零写） | ✅ | 未动清单所列文件；e2e 只打自建 scratch 库；买家 JWT 路径逐字保留 |
| §二 凌舟方向（不换 JWT；微信令牌 ⇒ 绑定消费者身份；最小 req.user、roles 不含商家角色；租户来源顺序；两源都缺显式失败不落库） | ✅（第 3 租户来源已报备，见 §七.1） | §三 口径 + 单测 15 例 |

## 六、未完成与阻塞

**无阻塞项。** 以下三项按卡面红线**未做**（已另见 §七）：
1. 老端**路径不对齐**的双段重复（`/api/miniapp/cart/cart/*`、`/api/miniapp/aftersales/aftersales/*`）——
   属第 31 项同族（客户端路径与后端不一致），本单只做"身份 + CSRF"，**未顺手改路径**（避免混入第二类缺陷）。
2. `notification.controller.myMarkRead` 缺用户维度（跨会员标记他人通知已读）——**未修**（涉及 API 语义/契约，需先定性）。
3. Taro 端 `request.ts` 的响应契约不符（后端 `code:"0"` 字符串 + `msg`；Taro 判 `code === 0` 数字 + `message`）——**未修**（超本单范围）。

## 七、风险与自我报备

1. **⚠️ 租户来源补了第三步（请凌舟确认口径）**：卡面写的是「令牌 → `X-Tenant-Id` → 不伪造」两步。
   实测老 miniapp **全仓没有任何租户来源**（`rg -i tenant miniapp` 除我加的注释外零命中；部署产物只注入
   `apiBase/storeId`，无 tenant）⇒ 只按两步实现时，卡面判据「老端三处调用 401 ⇒ 200」**不可达**
   （会全部 401「缺少租户信息」）。故补第三步：**按 openid 唯一命中会员取其租户**；
   0 命中（未绑定）/ 多命中（跨租户歧义）一律 401，**绝不默认租户、绝不取第一条**。
   **若凌舟不认可此口径**，替代方案是"客户端注入 `X-Tenant-Id`"——但那需要给老端新增租户来源（产品/发布面决策），
   本单未擅自做。**这处是全单唯一"超出卡面字面"的实现选择，故单列。**
2. **`csrfMiddleware` 增加了多主体能力（`req.csrfSubjectIds`）**：属共享中间件的加法改动，
   缺省路径逐字不变（只认 `req.user.id`），既有测试全绿。若凌舟要求"共享件零改动"，
   替代方案是适配层把会员身份另存字段、由端点各自取用——但那会让每个消费者端点都要改，改动面更大。
3. **两个存量 500（与本次改造无关，已做对照腿证明）**：
   `POST /api/miniapp/orders/:id/confirm-receive`（不存在的订单号）与
   `POST /api/miniapp/cart/checkout/create`（空车）在 **base 产物 + 商家 JWT** 上**同样 500**。
   与总清单第 45 项（写路径裸 `throw`）同族，建议并入后续收口。
4. **Taro 端"能携带令牌"但链路本身尚未接登录**：`miniapp/src` 里**没有**调用
   `userStore.login()` 的地方（无登录页实现），故本单只能做到"封装就绪 + 登录响应已有 `csrfToken`"；
   另发现其响应契约与后端不符（见 §六.3）。**Taro 端的端到端实证因此不可得**，
   老端（真实在用、由 `check-miniapp-release` 与部署脚本断言）承担了端到端取证，
   本单未把 Taro 端计入"51 项判据"的通过面。
5. **范围外发现（需凌舟编号入册）**：① 老端路径双段重复 ⇒ 404（`/api/miniapp/cart/cart/add`、
   `/api/miniapp/aftersales/aftersales/mine`、`/api/miniapp/cart/cart`；对照后端真实路径 200）；
   ② 通知"标记已读"无用户维度：**会员 5 的令牌把会员 4 的通知（id=3, recipient_id=4）标记为已读成功**
   （`200 {"marked":true}`，库里 `is_read` 0→1、`read_at` 写入）——同租户内可越权改他人通知状态；
   ③ 上述两个 500；④ Taro 响应契约不符。原始输出分别在
   `probe-out-of-scope-output.txt`、`probe-notification-idor-output.txt` / `-db.txt`。
6. **引擎口径提醒**：本单 e2e 在 **MariaDB 11.4.5** 上跑（项目本机私有实例）。
   本单**不涉及迁移/DDL**，与第 63 项（MySQL 8 外键）无交叉；但若凌舟要求"生产同族"复核，
   身份适配层与 SQL 均为普通 DML，无引擎特性依赖。
7. **未同步 `docs/tasks/current-tasks.md`**：按本单卡面交付物清单与 S3-194 先例（该单同样未动），
   该文件归凌舟维护且与主线程并行编辑，避免冲突；如需我补写请指示。
8. **基线漂移（报备，不影响交付）**：本单基线 = 派单时的 `origin/main` = `5fdd6da3`；
   交付时 `origin/main` 已前进到 `dd9acede`（#307 S3-194 / #308 S3-192 / #309 S3-193 + 若干 docs）。
   已核**文件重叠 = 0**（`git diff --name-only 5fdd6da3 origin/main -- <本单 23 个改动文件>` 仅命中一个
   **新增**文件 `backend/src/middleware/platform-rbac.ts`，与本单零关系）⇒ 合并面干净，
   但合并后建议重跑 `vitest run` + G2/G3（两单都动过门禁/路由面）。

## 八、关联卡与编号

- 派单卡：`docs/tasks/inbox/ACTIVE-S3-196.md` → 已归档 `docs/tasks/inbox/archive/ACTIVE-S3-196-20261014.md`
- 来源：`docs/tasks/R101-收口总清单.md` 第 **52** 项（消费者身份适配层 + bind 无租户显式失败）＋ 第 **58** 项（消费者端 CSRF/身份适配层 + 删 `R2_EXEMPT`）
- 前序：S3-187（#289 五条；其裁定③④即本单立项依据，见 `docs/tasks/cards/R101-S3-187-阿坚-回传.md:233-245`）、S3-178（身份必须取登录态）、S3-177（写端点 CSRF）
- 证据包：`docs/evidence/S3-196/README.md`
