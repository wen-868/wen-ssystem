# S3-226 · 营销域（18 文件 / 89 写端点）接线判定留档

> 执行方：阿坚（后端 / 权限）｜本地子代理 `/root/s3231_ajian`｜派单卡：`docs/tasks/inbox/ACTIVE-S3-226.md`
> 基线：`origin/main` = `ea29ee1f`（开工时本地 `origin/main` 真值；`git fetch` 因网络被重置失败，见回执 §六.1）
> 原始输出：`docs/evidence/S3-226/02-callers.txt`（调用面清点）、`01-guard-before.txt`（门禁前读数）、`04-domain-gaps-before.txt`（机读台账本域 89 键）

## 一、起点订正（台账 §三.4 的 89 与机读真值一致）

`node backend/scripts/guard-rbac-wiring.mjs --json` ⇒ 本域 18 文件 / **写端点 89 / 仍缺口 89**（与台账 §三.4 逐条一致，无偏移）。
全程读数：已接线 244 → **309**、缺口 480 → **415**、缺口文件 129 → **118**。

## 二、方法（照派单卡 §二／§三，四道闸 + 分桶）

1. **先查锁定闸**：`rg -n 'admin-marketing|points|coupon|seckill|bargain|announcement|marketing-asset' rbac-g0|g1|g2-wiring.test.ts`
   ⇒ 本域 18 文件**未命中** `NOT_IN_G0` / G1 待裁名单 / G2「R 类」⇒ **本域无 L 类**（对比批 6 有 2 条命中）。
2. **调用面清点**（`tools/callers.mjs`，两遍：URL 片段 + 方法 → api 封装函数 → `.vue` 调用点）⇒ `02-callers.txt`。
   ⚠️ 工具首版有两处**假阴性/假阳性**，已修并留档（见 §七）：app-mobile 用**裸函数** `post(` / `put(` / `del(`（非 `api.post(`）；
   通用函数名（`create` / `pause` / `verify`）不能用于 `.vue` 回溯。
3. **分桶**（派单卡 §二.5 要求先按调用面分桶再决定接不接）：

   | 桶 | 条数 | 判据 | 处置 |
   |:--|--:|:--|:--|
   | ① 仅 admin-web 页面调用（`meta.roles` ⊆ {SUPER_ADMIN, OPERATION_ADMIN}） | 33 | `router/index.ts` 角色 + `.vue` 调用点 | **接** |
   | ② 全仓无有效调用点（含前端路径/方法错配 ⇒ 今天即 404） | 32 | `02-callers.txt` + `rg` 复核 | **接**（同批 4 §12.2 口径：使用者集合退化为管理 API 面） |
   | ③ 有 app-mobile 写调用点且页面**无门可达 / 孤岛页 / 菜单码不在生产菜单库** | 9 | 推送深链 `native/push.ts:107`、首页快捷入口 `home.vue:69-92`、`pages.json` 注册但零导航、菜单可见性对照表 | **不接（B）** |
   | ④ 有 app-mobile 写调用点且页面可见角色**可枚举但 ⊄ 码持有人**（含 `READONLY` / 旧词表 `STORE_ADMIN` / 店长 / 销售 / 客服） | 14 | 生产菜单可见性对照表 + 12 角色权限复算 | **不接（W）** |
   | ⑤ 查询型 POST（service 只读不写） | 1 | `marketing-calculation.service.ts` 仅 SELECT | **不接（Q）** |
   | 合计 | **89** | | 接 **65** / 不接 **24** |

4. **选码唯一依据 = 生产持有复算**（`docs/evidence/_shared/prod-roles-20261016.txt` 的 12 角色权限串 × 生产同一份 `matchPermission`）：

   | 候选码 | 码的类型与出处 | 生产持有角色 |
   |:--|:--|:--|
   | `marketing:create` | BUTTON（`docs/migrations/079_权限矩阵.sql:215`） | SUPER_ADMIN、OPERATION_ADMIN（均靠角色串 `"*"`） |
   | `marketing:points` | MENU（`docs/migrations/079_权限矩阵.sql:165`） | SUPER_ADMIN、OPERATION_ADMIN |

   ⇒ 生产 12 角色里**没有任何角色显式持有 `marketing:*`**；两个码的持有人集合相同。
   故「页面角色 ⊆ 持有人」对**仅超管页**成立；凡页面可见角色含 `READONLY` / `STORE_ADMIN` / 店长 / 销售 / 客服的行，一律不接。

## 三、已接 65 条（端点 → 落地码 → 使用者依据）

行级清单与使用者依据见新测试文件 `backend/src/__tests__/routes/rbac-b2-s3-226-marketing-wiring.test.ts`
的 `ROWS`（65 行，每行带 `pageRoles` + `page:文件:行`），并逐条复算在台账 §十五.2。

**逐码分布**：`marketing:create` 55 ｜ `marketing:points` 10 = **65**。

## 四、不接 24 条（逐类，含判定理由）

### 4.1 Q 类 · 查询型 POST（1 条）

| 端点 | 理由 |
|:--|:--|
| `POST /api/admin/marketing/calculate` | `services/admin/marketing-calculation.service.ts` 的 `calculatePromotion` **只读不写**（全函数仅 `queryOneWithTenant`/`queryWithTenant` 的 SELECT；`rg -in 'insert into\|delete from\|update \w+ set'` 零命中）⇒ 按派单卡 §二.3「查询型 POST 不按写端点接」（同批 6 `POST /admin/quote-push/preview`、批 5 `POST /admin/prices/best-price` 同口径）。另：admin-web 唯一封装 `api/marketing.ts:256` 打 `/admin/marketing/promotions/calculate`（后端无此前缀）。 |

### 4.2 B 类 · 使用者集合不可枚举（9 条）

**判据**（与批 1 §9.1、批 4 §12.3、批 5 §13.3、批 6 §14.5 逐字同口径）：存在 app-mobile 写调用点，
且该页 ① 经**推送深链 / 首页快捷入口 / tabBar** 等无权限门入口可达；或 ② 是**孤岛页**（`pages.json` 注册、全仓无导航入口）；
或 ③ 页面注册码在生产菜单库**不存在**（前缀回退 ⇒ 无法用菜单映射取角色集合）。三者任一 ⇒ 无法证明不误伤 ⇒ 不接。

| # | 端点 | app-mobile 写调用点 | 不可枚举的原因 |
|--:|:--|:--|:--|
| 1 | `admin-marketing-coupon.routes.ts` POST `/coupons/templates` | `create-coupon.vue:279`（`couponsApi.create`） | 优惠券页有**无条件推送深链** `native/push.ts:107`（`marketing → /pages-sub/marketing/marketing/coupons`） |
| 2 | 同上 POST `/coupons/templates/:id/pause` | `coupons.vue:147`（`couponsApi.pause`） | 同上 |
| 3 | `admin-marketing-full-reduction.routes.ts` POST `/:id/activate` | `activities.vue:128`（`activityApi.start`） | 页面菜单码 `marketing:activities` 生产**不在菜单库**，仅靠前缀回退可见（对照表 :143） |
| 4 | 同上 POST `/:id/pause` | `activities.vue:146` | 同上 |
| 5 | 同上 DELETE `/:id` | `activities.vue:164` | 同上 |
| 6 | `admin-marketing-points.routes.ts` POST `/points/redeem` | `points-exchange.vue:88`（`pointsApi.exchange`） | **孤岛页**：`pages.json:461` 注册，全仓 `rg 'points-exchange'` 仅命中 `pages.json` |
| 7 | `points.routes.ts` POST `/:id/points/adjust` | `member-detail.vue:540` | 经首页快捷入口「会员管理」`home.vue:87`（**无条件**）→ 会员列表 → 详情 |
| 8 | `store-coupon.routes.ts` POST `/verify` | `coupon-verify.vue:160`（`verifyCoupon`） | 经优惠券页 `coupons.vue:132` 进入，而该页有**无条件推送深链** |
| 9 | `store-coupon.routes.ts` POST `/manual-verify` | `coupon-verify.vue:163` | 同上 |
| — | 合计 **9 条** = `admin-marketing-coupon` 2 ＋ `admin-marketing-full-reduction` 3 ＋ `admin-marketing-points` 1 ＋ `points.routes` 1 ＋ `store-coupon` 2 | 上表逐条 | — |

**保守口径声明**：孤岛页/无门页「看得到按钮的角色」**可能为空**（H5 构建下页面 URL 仍可直达，静态扫描只能证明"仓库内无引用"）
⇒ 按「**无法证明不误伤则不动**」处理，零回归优先。若凌舟认定某页使用者集合为空，这些行可一键接线（码位方案已在测试 `UNWIRED.note` 里写明）。

### 4.3 W 类 · 待授权模型定案（14 条）

| # | 端点 | 页面（调用点） | 可见角色（生产菜单映射） | 为什么不接 |
|--:|:--|:--|:--|:--|
| 1 | `community-marketing.routes.ts` POST `/api/marketing/group-buy/:id/join` | app-mobile `group-buy-detail.vue:221` | 菜单码 `marketing:group-buy`（对照表 :126） | 可见角色含 `READONLY`（`["*:view"]`）与 `STORE_ADMIN`（099 旧词表 `product:read/order:read/...`）——**均不持** `marketing:*` ⇒ 接线即 403 |
| 2 | 同上 POST `/api/marketing/bargain/:id/help` | `bargain-detail.vue:311/326` | 菜单码 `marketing:bargain` | 同上 |
| 3 | 同上 POST `/api/marketing/seckill/:orderNo/pay` | `seckill-detail.vue:281` | 菜单码 `marketing:seckill` | 同上 |
| 4 | `points.routes.ts` POST `/levels/config` | `level-config.vue:164` | 页面注册码 `customer:level`（`function-menu.ts:69`） | 可见角色含 **STORE_MANAGER / SALES_STAFF / CUSTOMER_SERVICE**（对照表 :113-122）——三类工作角色都不持 `marketing:*` ⇒ 接线即 403 |
| 5 | 同上 PUT `/levels/config/:id` | `level-config.vue:161` | 同上 | 同上 |
| 6 | 同上 PUT `/levels/config/:id/status` | `member-levels.vue:117` | 同上 | 同上 |

> 上表为**代表行**；W 类全量 **14 条** = `community-marketing.routes.ts` **全部 10 条**
> （group-buy join/start/end、bargain start/help/end、seckill buy/pay/cancel/end——页面均由 `marketing:*` 菜单码进入，
> 可见角色含 `READONLY` / `STORE_ADMIN`）＋`points.routes.ts` 会员等级 **4 条**
> （create / update / status / delete，`level-config.vue:161/164`、`member-levels.vue:117/137`）。
> ⚠️ 口径分界：页面**经无门入口可达或菜单码零映射** ⇒ B 类（见 §4.2）；页面**可见角色可枚举但 ⊄ 持有人** ⇒ W 类（本节）。
> W 类三选一（补授权 / 收紧菜单授予面 / 另立细码）属**产品授权口径**，不在本单（同 S3-222 §12.6）。

## 五、与台账 §三.4「建议权限码」的差异

| 序 | 台账建议 | 本单落地 | 理由 |
|:--|:--|:--|:--|
| ① | 89 条整体按 `marketing:create`／`marketing:points` | 65 条接、24 条不接 | 台账是「该不该要权限」的域级判定；**接不接**还要过调用面（派单卡 §二.5 明确要求先分桶）。差异逐条在 §四。 |
| ② | `POST /admin/marketing/calculate` → `marketing:create` | **不接（Q）** | service 只读不写；派单卡 §二.3 明令查询型 POST 不按写端点接 |
| ③ | 会员等级配置 4 条 → `marketing:create` | **不接（W）** | 页面可见角色含店长/销售/客服，三类均不持该码 ⇒ 接线即 403（授权模型口径） |
| ④ | `POST /admin/marketing/points/rule` → `marketing:points`；`POST /admin/members/rules` → `marketing:create` | 按台账逐条落地（未统一） | 二者语义同为「积分规则」，但两码持有人集合**完全相同**（{SUPER_ADMIN, OPERATION_ADMIN}）⇒ 无功能差异；为免"擅自改口径"按台账原样落地，**建议后续授权模型单统一**（登记待裁定） |
| ⑤ | — | 本域 `flash-sale` 既有接线用 `sale:create`/`sale:edit`（G1 + 批 6） | **同前缀两套码**：`admin-marketing-flash-sale.routes.ts` 用 `sale:*`，本批其余营销端点用 `marketing:*`。两者对超管/运营等价，但 `marketing:*` **更严**（不含店长/收银员/销售）⇒ 更符"营销活动=超管/运营"语义；统一与否**待凌舟裁定** |

## 六、门禁与反测

见台账 §十五.7 与回执 §三（报告模式分辨力 / `--strict` 两侧 / vitest 侧分辨力 / 逐字节还原）。

## 七、工具自身的两处缺陷（已修，留档以便他人复用）

1. **app-mobile 的裸函数调用**：`api/modules/*.ts` 用 `post(` / `put(` / `del(`（从 `api/request` 导入），
   不是 `api.post(` ⇒ 首版判据 `\.post\(` 把**整个 app-mobile** 判成"无调用点"（会漏掉 23 条 B/W 类，后果是把它们**错接**）。
   修正：`\b(?:post|put|delete|del)\s*\(`，并保留 `\b` 防误伤 `submitPost(`。
2. **通用函数名回溯造成假阳性**：`create` / `pause` / `verify` / `toggleStatus` 等名字在 app-mobile 辅助层被大量复用，
   用它回溯 `.vue` 会把不相干页面算成调用者（首版实测把 `pages/sales/create-sale.vue:2202` 算成营销券模板调用者）。
   修正：通用名黑名单，只记录为「api 封装函数名」，不参与页面回溯；页面结论另由 `rg` 复核（`02-callers.txt` 附复核清单）。

## 八、卡外观察（只登记不动手）

1. **前端路径/方法错配 6 组**（本域 32 条"无有效调用点"的主因）：
   `stack-rules`（前端 `/admin/marketing/promotions/stack-rules*` vs 后端 `/api/admin/marketing/stack-rules*`）、
   `seckill`（`/admin/marketing/seckill*` vs `/api/seckill*`）、
   `marketing-asset`（`/admin/marketing-assets*` vs `/api/marketing-asset*`）、
   `points-mall`（`/admin/points-mall/*` vs `/api/points-mall/*`，且 `deliver` 前端 POST / 后端 PUT）、
   `calculate`（`/admin/marketing/promotions/calculate` vs `/api/admin/marketing/calculate`）。
   ⇒ 这些页面/封装的按钮**今天即 404**，属契约治理，另立单（同批 2 §13.7-1、批 5 §11.7-1 形态）。
2. **`points.routes.ts` 缺 `DELETE /api/admin/members/rules/:id`**：前端 `PointsRules.vue:230 deletePointsRule` 调该方法，后端无此路由 ⇒ 404。
3. **同域两套码**：`sale:*`（flash-sale，G1/批 6）与 `marketing:*`（本批）并存（§五.⑤）。
4. **公告两套路由**：`retail-announcement.routes.ts`（`/api/retail-announcement/admin/...`）与
   `retail-announcements-admin.routes.ts`（`/api/admin/retail-announcements`）服务同一业务；前端只打后者，
   前者 3 条为"无有效调用点"。两文件是否合并属契约治理。
5. **`community-marketing.routes.ts` 的语义混装**（派单卡 §一先验警告成立）：拼团/砍价/秒杀的
   `join` / `help` / `buy` / `pay` / `cancel` 是**消费者行为**，却挂在**商家认证** `requireAuthWithTenant` 下
   （不是 `requireConsumerAuthWithTenant` ⇒ 门禁看不见消费者端形态）。本批按 B/W 类不接并登记；
   若要收编，须先定"这些动作到底谁是主体"（商家代客操作 / 消费者自助），属产品口径。
6. **`t_sys_role_menu` 的角色×菜单矩阵缺证据**：本次派单底稿只给菜单**分布计数**（CATALOG 11 / MENU 78 / BUTTON 1），
   未给"哪个角色持哪个菜单码"。本单 W/B 判定用的是仓库内既有的生产导出
   （`R101-总进度与推进计划.md:1610`、`R101-S3-136-F1-阿澈-可见性对照表.md`，均为菜单 64 行时期）。
   ⚠️ 菜单已由 64 → **89** 行，`marketing:*` 前缀当时的"零持有"结论**可能已变化** ⇒ 请凌舟以生产只读
   `SELECT r.role_code, m.menu_code FROM t_sys_role_menu rm JOIN t_sys_role r ... JOIN t_sys_menu m ...` 复核；
   若这些菜单仍未授予任何工作角色，则本批 23 条 B/W 类可批量接线（码位方案已备）。
