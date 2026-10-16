# ACTIVE-回执 · S3-237（接线批 10：系统设置/基础域 10 条 + 商品 A 类 7 条）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）· 本地子代理 `/root/s3244_ajian`**｜日期：**2026-10-16**
> 对应派单编号：**S3-237**｜派单卡：`docs/tasks/inbox/ACTIVE-S3-237.md`｜详细回传：`docs/tasks/cards/R101-S3-237-阿坚-回传.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-237`｜分支：`feat/s3-237-system-goods-wiring`｜基线 `efc8d1be`｜提交：`3b60825b`（组 1）、`212da88f`（组 2）｜**未 push / 未开 PR**

## 一、改了什么

1. **组 1（系统设置/基础域）10 条**挂 S3-232 已立的新码（`system-permission-codes.ts` ↔ 迁移 204）：
   `alert.routes.ts` 3（handle / rule-edit / check）、`archive.routes.ts` 1（execute）、`notification.routes.ts` **1**（send）、
   `push.routes.ts` 1（test）、`sms-template.routes.ts` 3（create / edit / delete）、`system.routes.ts` 1（migrate）。
2. **组 2（商品 A 类）7 条**挂既有码 `goods:create|edit`（079:200-201）：
   `admin-product.routes.ts` 1（skus/:skuId/barcode）、`brand.routes.ts` 2、`product-marketing-tag.routes.ts` 2、`unit-group.routes.ts` 2。
3. **不接 12 条并登记**：4 条手机端通知写端点（消息页无门，见 §四）、3 条 DELETE（D1 不含 `goods:delete` ⇒ D4 前端补门）、
   4 条审核端点（079/204 无审核类码 ⇒ 入下一批立码）、1 条 `POST /products/import`（无真实调用点）。
4. **台账与计数**：`rbac-wiring-baseline.json` 逐条移除 17 条（`_counts` 同步：缺口 314→297、文件 93→89、已接线 398→415、用例口径 369→386）；
   `R101-RBAC接线缺口清单.md` 新增 **§二十**；`rbac-g0-wiring.test.ts` **只新增本批常量块**（17；和式 + 台账一致性）；
   `rbac-b2-s3-220-product-wiring.test.ts` 做**最小交接**（7 行移出 `UNWIRED` + 计数同步 + 加注）。
5. **零业务逻辑改动**：未动 `controllers/` `services/` `middleware/`、任何迁移与角色种子、任何前端（`git diff` 自证见回传卡 §二）。

## 二、证据（可复跑，原始输出在 `docs/evidence/S3-237/raw/`）

| 项 | 读数 |
|:--|:--|
| `guard-rbac-wiring --strict` | **EXIT=0**；未登记 0 / 陈旧 0；缺口 **297 / 89 文件**、已接线 **415** |
| 本批用例 | 组 1 **70 passed**、组 2 **60 passed**；RBAC 全域 **17 文件 / 2343 例 / 0 failed** |
| 全量回归 | **683 文件 / 9998 例 / 0 failed**；`tsc` **EXIT=0**；根 `npm run build` **EXIT=0** |
| 反测①（组 1） | 摘 `archive.routes.ts` 挂码 ⇒ 报告 415→414 / 297→298；`--strict` **EXIT=1** 点名 `archive.routes.ts:13 POST /api/admin/archive/execute`；用例 **4 failed**；复原 SHA256 一致 ⇒ EXIT=0 |
| 反测②（组 2） | 摘 `admin-product.routes.ts:68` 挂码 ⇒ `--strict` **EXIT=1** 点名 `PUT /api/admin/products/skus/:skuId/barcode`；用例 **3 failed**；复原 SHA256 一致 ⇒ EXIT=0 |
| 证据守卫 | `guard-evidence-secrets` **PASS**（命中 0 / 豁免 1，与既有 allowlist 同源） |

## 三、阻塞点

**无阻塞项**（凌舟先决条件为零）。两处**主动报备的差异**需凌舟裁定（不阻塞本单交付）：

1. **4 条手机端通知写端点未接**：卡面组 1 写"14 条机械接线"，但其中 4 条的唯一调用点是**手机端消息页，该页无任何权限门**
   （`app-mobile/src/config/permission-gates.ts` 全表 0 处引用 `/api/admin/notifications`；`pages/home/home.vue:16` 铃铛无条件渲染），
   在用角色店长(1 账号)/操作员(1 账号)不持 `system:notification:*` ⇒ 不变量 **I1' 的 ①②③ 三条都不成立** ⇒ 本批**不接、只登记**。
   请择一：(a) 另立前端门单后收编；(b) 改判码族。
2. **卡面数字与实测不符**：组 2 卡面"15 = 8+3+4+1"（和=16）⇒ 实测可接 **7 条**（按台账 §12.4 十五条的构成逐条清点）；本批按实测交付，**未造第 8 条端点**。

另：`docs/tasks/inbox/ACTIVE.md` §〇 路由表**无 `/root/s3244_ajian` 行**（本单依"派单消息优先于路由表"开工），建议补行；
本单**未改动** `ACTIVE.md` 一行（按"路由文件只追加"纪律，归档与路由维护留给凌舟收口）。
