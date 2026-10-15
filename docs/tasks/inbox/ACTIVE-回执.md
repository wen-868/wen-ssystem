# 回执 · S3-187（#289 五条：路由参数契约 / `/api/store` 前缀级覆盖 / `points/my` 身份 / 老 miniapp / wechat CSRF）

> 汇报对象：凌舟（总负责人）｜汇报人：**阿坚（后端·本地子代理通道执行）**｜日期：**2026-10-13**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-187.md`（已归档为 `docs/tasks/inbox/archive/ACTIVE-S3-187-20261013.md`）
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-187-阿坚-回传.md`（工作树内已随提交入库，邮箱内另存一份）
> **本地提交（未 push、未开 PR）：`e8574541`**，分支 `fix/s3-187-route-contract-and-csrf`（基线 `origin/main` = `09309817`）
> 证据目录（可复跑）：`D:\Users\ZXQL\wt-agents\_s3187-evidence\`（探针脚本 4 个 + 原始输出 6 份）

## 一、一句话结论

五条**逐条处置完毕、无跳过**：A 三条写端点按契约改带参路径且参数**真达服务层**（老路径已下线且为路由 404）、B 把 `commerce-fix` 的前缀级覆盖收窄为自有权路径段（**实测救回"会员自助注册"与"收银硬件回调"两个被拦成 401 的端点**）、C `points/my` 身份改取登录态（实测 `userId=1` 非 NaN）、D 老 miniapp 定**在用**并做路径对齐（登录态载体缺口如实登记待裁定）、E wechat 4 个写端点的 CSRF 从"假安全"变真（**反测两侧齐**）。

## 二、改了什么（20 个文件，改动面 = 卡 §二 涉及范围）

| 类别 | 文件（关键行） |
|:--|:--|
| A 路由 | `backend/src/routes/marketing-miniapp.routes.ts:55/72/80` |
| A 控制器 | `marketing-coupon.controller.ts:117-121`、`marketing-flash-sale.controller.ts:3/80-84`、`marketing-group-buy.controller.ts:3/112-116` |
| B | `backend/src/routes/commerce-fix.routes.ts:24-30/34`、`backend/src/shared/auto-routes.ts:102-110`（新增前缀登记） |
| C | `marketing-points.controller.ts:39-58` + 路由 `:67` |
| D | `miniapp/pages/coupons/index.js:1-13/88-90`、`miniapp/src/api/coupon.ts:41-44` |
| E | `backend/src/middleware/wechat-auth.ts:17-40`、`backend/src/routes/wechat.routes.ts:5/26-30`、`backend/src/services/wechat.service.ts:70-73`、`miniapp/app.js:9/46-48/89-94/118-119`、`miniapp/pages/profile/index.js:146-149` |
| 门禁台账（仅文本） | `backend/scripts/guard-route-auth.mjs:86-88/101-105/166-169` |
| 测试 | 新增 3 个（`marketing-miniapp-s3-187` 9 例 / `wechat-csrf-s3-187` 7 例 / `commerce-fix-store-prefix-s3-187` 3 例）+ 改既有 2 个（`marketing-miniapp-s3-178` 12 处 URL、`instant-retail-store-s3-178` 注释） |

## 三、证据（摘，全部可复跑）

**A（真后端 `USE_MOCK_DB=true`，端口 8097；路由 404 = HTML `Cannot POST`，业务 404 = JSON）**

```
POST /api/miniapp/marketing/coupons/1/claim   无凭证 -> 401 ；带凭证无 CSRF -> 403 ；带凭证+CSRF -> 404 JSON「优惠券不存在或已过期」
POST /api/miniapp/marketing/flash-sale/1/buy  带凭证+CSRF -> 404 JSON「秒杀活动不存在或已结束」
POST /api/miniapp/marketing/group-buy/1/join  带凭证+CSRF -> 404 JSON「拼团组不存在或已结束」
POST /api/miniapp/marketing/coupons/abc/claim -> 400 JSON「优惠券模板ID无效」
老路径 /coupons/claim、/flash-sales/grab、/group-buys/teams/join -> 404 HTML（已下线）
```

**B（同一批例子，修前端口 8098 / 修后端口 8097）**

```
修前：members/register -> 401 ；hardware/callbacks/cloud-speaker/t1 -> 401 ；/api/store/no-such-path -> 401（前缀级证据）
修后：members/register -> 400「缺少必填字段」（到 controller）；hardware 回调 -> 200 受理；/api/store/coupons/verify-records -> 401（自有防护仍生效）
启动日志：白名单 /api/store/coupons (2次) + 真重复端点 0 项 + 已自动注册 203 个路由
```

**C**：`GET /points/my` 无凭证 401；带凭证 **200 `data.userId=1`**（此前该字段由 NaN 决定）；`?userId=4242` ⇒ 403。

**D**：定性四条证据（Taro 构建源 = `miniapp/src`；`scripts/check-miniapp-release.mjs:32-34` 仍断言旧端文件；`deploy/deploy-production.sh:267-272` 仍部署旧端源码；旧端最后变更 `5c718b8e`(2026-06-20) vs 新端 `4c3e28da`(2026-08-15)）⇒ 在用；路径 `/coupons/mine` → `/coupons/my` 已对齐；登录态载体缺口写进 `miniapp/pages/coupons/index.js:1-13`。

**E**：`POST /api/miniapp/wechat/auth/unbind` 微信令牌无 CSRF ⇒ 403；带 `x-csrf-token=HMAC(33)` ⇒ 200。
**反测（原始输出 `E-mutation-red.log`）**：注释掉 `requireWxAuth` 里的 `req.user = {…}` ⇒ 该文件 `3 failed | 4 passed`，红点正是"缺 CSRF 却 200"；复原 ⇒ `7 passed`。
**反测（`A-mutation-red.log`）**：注释掉 `claimCoupon` 的参数闸门 ⇒ `1 failed | 8 passed`；复原 ⇒ `9 passed`。

**门禁/构建（冻结状态）**：`npx vitest run` **649 files / 7681 tests / 0 failed**；`tsc --noEmit` **EXIT=0**；`guard-route-auth` **EXIT=0**；`guard-tenant-status` **EXIT=0**；`npm run build` **EXIT=0**。

## 四、验收自评（对照卡 §三 七条）

1 ✅（A，归属反例口径见下）2 ✅ 3 ✅ 4 ✅（D 定性=在用，路径已修）5 ✅（E 反测两侧 + 正常两侧）6 ✅ 7 ✅（20 个文件全在本单范围；未碰迁移/.github/deploy/契约文档/收口总清单/当前批次；未新增权限码；未放宽鉴权与 CSRF）。

## 五、未完成与阻塞

1. **跨租户字面反例未做**：本机 mock 库无业务数据，"拿 A 的凭证传 B 的对象"只验到**等价分支**（服务层 SQL 逐条带 `tenant_id`、取不到行 ⇒ 404；行号见回传卡 §二.A）。若要真库夹具，请指派并说明（我可复用 S3-183-F1 的副本库，避开其并行单）。
2. **老 miniapp 的登录态载体**未解决（卡明令不得在客户端硬塞 JWT）—— 待裁定。
3. **微信 `bind` 的租户来源**未解决（需令牌带租户或客户端传 `X-Tenant-Id`，属契约变更）。
4. `backend/scripts/rbac-wiring-baseline.json` 里三条 miniapp 端点路径已成**陈旧登记**（不在本单闸门清单内，未动；建议用其生成器重生成）。

## 六、风险与自我报备

1. `/api/store` 前缀级覆盖**只消除 1/20 处**（commerce-fix）；其余 9 个根前缀文件仍覆盖整段，`/api/store/no-such-path` 仍是 401（不是 404）——是否另立单统一治理请裁定。
2. E 的 `req.tenantId` 取值顺序（令牌 → `X-Tenant-Id` → 不伪造）是新引入口径，**请确认**；若只挂 CSRF 而不下发 `csrfToken`，老端 4 个写端点会 403，故本单同批补了登录响应字段与老端请求头（属"更能用"，非回退）。
3. D 的"在用"结论依赖 §二.D 四条证据；若你掌握旧端已停用的事实，我按裁定改为"标记弃用 + 删除调用"。
4. 本回执覆盖了 `ACTIVE-回执.md`（其上一版 = S3-183-F1 的回执，已在 `ACTIVE-回执-S3-183-F1.md` 留底，未丢失）。

## 七、环境复原

- 两个取证用 mock 后端（端口 8097 / 8098）已停（`Stop-Process` 六个 PID，两个端口实测 down）；未做任何生产库写操作。
- 工作树 `D:\Users\ZXQL\wt-agents\S3-187` 的 `node_modules` 为指向主仓 `node_modules` 的 junction（与 S3-185 worktree 同法），未改动主仓依赖。
