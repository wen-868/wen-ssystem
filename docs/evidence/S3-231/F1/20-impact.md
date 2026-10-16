# S3-231 F1 · 影响面（会员等级配置 4 条改挂 `customer:level`）

> 生成：人工整理，依据 = 生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt`（12 角色权限串）+
> `prod-role-usage-20261016.sql`（角色 × 账号数）+ 页面注册码 `app-mobile/src/config/function-menu.ts:84`。
> 机读复算见 `backend/src/__tests__/routes/rbac-b2-s3-231-f1-member-levels-wiring.test.ts` 的「e) 影响面」用例。

## 一、改了什么

`backend/src/routes/points.routes.ts` 的会员等级配置 4 条（增/改/启停/删）由**无权限检查**改为
`requirePermission("customer:level")` —— 即页面**自身的注册码**（凌舟裁定 1）。

命中机制 = 生产同一份 `matchPermission`（`backend/src/services/admin/rbac.service.ts:295`）：
`customer:level` 的**域** = `customer` ⇒ 持 `customer:*` 的角色经**域通配分支**命中。

## 二、逐角色影响（生产 12 角色全集）

| 角色 | 生产账号数 | 相关权限串 | 接线前 | 接线后 | 判定 |
|:--|--:|:--|:--|:--|:--|
| `SUPER_ADMIN` | 2 | `["*"]` | 200 | **200** | 在用写角色，无回归 |
| `STORE_MANAGER` | **1** | 含 `customer:*` | 200 | **200** | **在用写角色，零回归（I1'① 命中）** |
| `OPERATION_ADMIN` | 0 | `["*"]` | 200 | 200 | 未用角色 |
| `SALES_STAFF` | **0** | `customer:view`（**精确码**） | 200 | **403** | 该页写能力**降级为只读**；**0 账号** ⇒ 无在用账号受损 |
| `CUSTOMER_SERVICE` | **0** | `customer:view`（**精确码**） | 200 | **403** | 同上 |
| `READONLY` | 1 | `["*:view"]` | 403 | 403 | **只读观察员**，写 403 是**改造前既有**期望（非本单回归） |
| `STORE_OPERATOR` | 1 | `sale:create` 等（无 `customer:*`） | 403 | 403 | 该角色对会员等级页**本就无菜单入口** |
| `PURCHASE_STAFF` / `WAREHOUSE_STAFF` / `FINANCE_STAFF` / `SALESMAN` / `STORE_ADMIN` | 0 | 各自域码 / 旧词表 | 403 | 403 | 未用角色；`SALESMAN`/`STORE_ADMIN` 属**旧词表遗留**（D3），本就无写码 |

**结论**：**无任何"在用写角色"被锁死**（不变量 I1' 的底线）；唯一行为变化是两类**各 0 账号**角色
（`SALES_STAFF` / `CUSTOMER_SERVICE`）在该页由"能调但会被后端拒"变成"调用被拒"，
用户体验上等同"该页对其只读" —— 与 I1' 的**②前端按码只读**方向一致（S3-230 的入口门同时覆盖该页）。

## 三、逐角色数据来源（可核对）

- 权限串：`docs/evidence/_shared/prod-roles-20261016.txt`（12 角色 × 权限码，租户 `default`）；
- 账号数：`docs/evidence/_shared/prod-role-usage-20261016.sql`（在用 = SUPER_ADMIN 2 / STORE_MANAGER 1 /
  STORE_OPERATOR 1 / READONLY 1；其余 0）；
- 页面注册码：`app-mobile/src/config/function-menu.ts:84`（`code: 'customer:level'`，会员等级页）；
- 页面写调用点：`member-levels/member-levels.vue:117`、`member-levels/level-config.vue:119/161/164`、`api/modules/member-levels.ts:66`。

## 四、未接的 1 条（本单范围外，保留登记）

`POST /api/admin/members/:id/points/adjust`（会员积分调整）—— app-mobile `member/member-detail.vue:540` 有写调用点，
该页经首页快捷入口「会员管理」（`pages/home/home.vue:87`，**无条件**）→ 会员列表 → 详情可达 ⇒
使用者集合不可枚举（**B 类**，D4：先补前端权限门再收编）。本单 F1 **不动**它。
