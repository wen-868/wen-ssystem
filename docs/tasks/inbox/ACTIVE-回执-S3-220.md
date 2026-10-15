# ACTIVE-回执-S3-220 · 商品域权限接线（B2 批 3）交付回执

```
【汇报 S3-220】S3-220 商品域 45 条写端点按「使用者已持码」接线：接 15 条、留 30 条（B13/A15/P2），
                门禁缺口 588 → 573、--strict EXIT=0；全量 8450 用例/tsc/build 全绿，三条反测证明门禁与用例都会红
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 权限 · 本地子代理 `/root/s3223_ajian`）｜2026-10-16
回传要求：本回执与回传卡同源：docs/tasks/cards/R101-S3-220-阿坚-回传.md（十项完整版）
关联卡：docs/tasks/inbox/ACTIVE-S3-220.md
```

## 〇、一行摘要

商品域 45 条写端点里**只有 15 条**的「真实使用者集合」能对上生产已持的码 —— 因为生产**只有超管/运营持
`goods:create|edit|delete`**（店长只持 `goods:price`），而这 15 条恰好**无有效页面调用点**。已接线：缺口
**588 → 573**、`--strict` EXIT=0、全量 **8450 用例 0 失败**。其余 30 条按卡面口径**不接并逐条登记**。
本单**未新立码、未改角色种子、未动迁移**；工作树 `wt-agents/S3-220`、分支 `feat/s3-220-product-domain-wiring`、
提交 `COMMIT_PLACEHOLDER`（**未 push、未开 PR**）。

## 一、改了什么

| 类别 | 内容 |
|:--|:--|
| 接线（15 行） | `admin-product.routes.ts` 41/43/53（`goods:edit`）、`product-bundle.routes.ts` 18-22+27-29（`goods:create|edit|delete`）、`product-review.routes.ts` 14（`goods:create`）、`unit.routes.ts` 14-16（`goods:create|edit|delete`） |
| 用例 | 新增 `backend/src/__tests__/routes/rbac-b2-s3-220-product-wiring.test.ts`（146 用例：名单自证 / 形状 / 401-403-200 两侧 / 范围控制） |
| 快照 | `rbac-g0-wiring.test.ts` 接线总数 107 → **122**（只改总数＋逐文件计数，G0 名单行一字未动） |
| 台账 | `backend/scripts/rbac-wiring-baseline.json` `gaps` 588 → **573**（逐键移除 15 条＋`_s3220_note`）；`docs/tasks/R101-RBAC接线缺口清单.md` 新增 **§十二** |
| 仅注释 | `price.routes.ts`（说明两条价格端点为何本批不接；**代码零改动**） |

## 二、证据（可复跑）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-220
git rev-parse origin/main                      # 11f4af48（开工基线）
node backend/scripts/guard-rbac-wiring.mjs     # 缺口 573 / 146 文件 / 已接线 151
node backend/scripts/guard-rbac-wiring.mjs --strict   # EXIT=0（未登记 0 / 陈旧登记 0）
node docs/evidence/S3-220/tools/prod-holders.mjs      # 生产持有复算（goods:create|edit|delete = 仅超管/运营）
node docs/evidence/S3-220/tools/callers.mjs           # 45 条端点的前端调用面清点
cd backend; npx vitest run                     # 672 文件 / 8450 用例 全通过
npx tsc -p tsconfig.json --noEmit              # EXIT=0
```

原始输出（`docs/evidence/S3-220/`，24 个文件）：`00-prod-roles-raw.txt`、`01/12/13-guard-*`、
`02-callers.txt`、`03-prod-holders.txt`、`10-guard-after-wiring.txt`、`11-baseline-update.txt`、
`20/21-vitest-*`、`30/31/32/33/34/35-neg-*`、`40-tsc.txt`、`41-eslint.txt`、`42-vitest-full.txt`、
`43-root-build.txt`、`50-src-hashes.txt`（源码哈希 ＋ `dist` 命中数）。

**反测（门禁铁律）**：摘掉 `product-bundle.routes.ts:29` 的 `requirePermission("goods:delete")` ⇒
缺口 573 → **574**、`--strict` **EXIT=1** 并点出该端点、本单用例 **3 failed**；复原 ⇒ 573 / EXIT=0 / 140 passed，
文件 SHA256 逐字节一致（`E795DBD9…C4F33`）。

## 三、验收自评（对照卡面 §三）

① 对账 `45 = 15 + 30`（B 13 / A 15 / P 2，逐条列名在缺口清单 §十二.3/§十二.4/§十二.6）**通过**；
② 两侧反测（缺码⇒403 逐行 / 有码⇒200 逐行 / 摘接线⇒用例红）**通过**；
③ 门禁 573 = 588 − 15、文件数同步、`--strict` EXIT=0、登记进 baseline（逐键移除、非重新生成）**通过**；
④ 回归：全量 8450 用例 0 failed、tsc 0、build 0、eslint 0 error **通过**；
⑤ 零回归论证：本批 15 条**无有效调用点**（`02-callers.txt` 逐条），使用者 ⊆ {超管, 运营} = 目标码持有集 **通过**。

## 四、未完成与阻塞

1. **30 条未接**（B 13 / A 15 / P 2）—— 按卡面 §二.3/§二.4 **有意不接**，理由逐条落缺口清单 §十二，非"没做完"。
2. **`ACTIVE.md` 未移卡、`current-tasks.md` 未改**：路由表内仍有 `/root/s3224_frontend` 的 S3-221 在办行，
   且 `current-tasks.md` 属本卡 §四.2 禁改文件 ⇒ 两者均未动（与 S3-214-B2 处置一致），归档与移行留待凌舟。
3. **生产运行期未验证**（本卡禁止 push/PR，故不涉生产写侧）。

## 五、风险与自我报备

1. **首版曾多接 2 条价格端点，被既有锁定断言拦下 ⇒ 已撤回**（原始输出 `21-vitest-g0-and-s3220.txt`，2 failed）：
   `POST /prices/best-price` 是 `rbac-g0-wiring.test.ts:700` 明写的「查询型 POST（待裁定）」、
   `POST /prices/batch/preview` 的 `PRICE_MANAGEMENT_DENIED` 是 `:725` 的已知锁定。**我的错在判断顺序**：
   先按"同族同码"（`/batch/execute` 已挂 `goods:price`）就动手，**没有先查既有锁定**。缺口因此为 573 而非 571。
2. **"无调用点即接线"沿用批 1 §9.3 先例**（15 条里 14 条属此类）：未来若这些端点被页面调用且该页允许店长，会新出现 403。
   这是**先例口径**而非我的裁量；若要更保守，请裁定后本批可缩到 1 条。
3. 桌面「商品管理」的**上下架按钮今天即 404**（前端打 `PATCH /products/:id/status`，后端只有 `PUT`）—— 卡外观察，已登记未动手。
4. 为跑测试在 `wt-agents/S3-220` 建了指向主检出 `node_modules` 的 **junction**（lockfile 字节一致）；复原＝删除该 junction。
5. **生产只读通道的授权边界**：本单按**本卡** §二.1「走服务器只读通道导出」执行（仅 `SELECT`，脚本全文可核，未落盘任何口令），
   但 S3-136 卡曾写「执行方不得连生产库」⇒ 两条口径冲突，请凌舟明确以后以哪条为准。

## 六、待凌舟裁定

① **A 类 15 条**（店长可见页 × goods 码）：补店长权限 or 收窄页面 `meta.roles`，二选一后再接；
② **B 类 13 条**：先补移动端权限门（商品 tab/详情/编辑/扫码均无门）；
③ **P 类 2 条价格端点**：是否与 `/batch/execute` 对齐挂 `goods:price`（需同时明确可改哪条锁定断言）；
④ `POST /products/import`：沿用 `store:transfer`／接 `goods:create`／合并端点，三选一；
⑤ `admin-product-s3-142-perm.test.ts:78` 的店长权限串取自 079 种子、与生产不符，是否补订正；
⑥ 生产只读通道的授权边界（见 §五.5）。

## 七、环境复原

工作树 `D:\Users\ZXQL\wt-agents\S3-220`｜分支 `feat/s3-220-product-domain-wiring`｜基线 `origin/main` = `11f4af48`；
`node_modules` = junction（删掉即可 `npm ci` 独立安装）；已在**本分支**提交（哈希见下），未 push / 未开 PR；
未触碰其它单工作树与主检出工作区。

派单人：凌舟（总负责人）｜2026-10-16　　执行方：阿坚（后端/权限 · `/root/s3223_ajian`）｜2026-10-16
