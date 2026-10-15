# ACTIVE 回执 · S3-198（库存/追溯域 RBAC 接线：34 写端点接线 · 台账守恒 705→671 · 未接 23 条逐条定性）

```
【汇报 R101-S3-198】第 43 项第 1 批（1 个域）：库存/追溯域 57 个写端点逐条定性 —— 34 条接线（0 新立权限点）、
  23 条按 A/B/N 三类留证未接；缺口 705 → 671；guard:rbac-wiring --strict EXIT=1 → EXIT=0（含 S3-187 改名遗留的 3 条台账同步）；
  vitest 655 文件 / 7945 用例 / 0 failed、tsc --noEmit 0、三条 guard EXIT=0、backend build EXIT=0；两条反测两侧齐
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 权限 · 本地子代理通道 /root/s3201_ajian）｜2026-10-14
交付物：工作树 D:\Users\ZXQL\wt-agents\S3-198｜分支 feat/s3-198-rbac-batch1｜分支 HEAD = 1654698c（**本地提交，未 push、未开 PR**）｜基线 origin/main = fc6651a5
  ① backend/src/routes/data-transfer.routes.ts    572980beeade → cf2f8c41af40（git blob，+2 处接线）
  ② backend/src/routes/inventory-batch.routes.ts  ec2a61f32b24 → 7abb64fa91ad（+7 处接线）
  ③ backend/src/routes/inventory-share.routes.ts  5c921ab8df05 → c5bd3a7c0695（+6 处接线）
  ④ backend/src/routes/trace.routes.ts            6728c9cc06c5 → aea7f68c2916（**9 处接线已按裁定退回**，仅留退回依据注释）
  ⑤ backend/src/routes/transfer-order.routes.ts   866bef52bdec → 9265a5b086ee（+7 处接线）
  ⑥ backend/src/routes/warehouse.routes.ts        bcea2cc95c02 → 9f787215725c（+3 处接线）
  ⑦ backend/scripts/rbac-wiring-baseline.json     5F8D63B2492528EE（705 条 → **680 条** / 161 → 156 文件；返工后口径）
  ⑧ backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts  4A7049A8E40F774D（新增，202 用例；返工后口径）
  ⑨ backend/src/__tests__/routes/rbac-g0-wiring.test.ts  DFD5963C172B9554（仅同步「全量接线总数」快照 56 → 81）
  ⑩ docs/tasks/R101-RBAC接线缺口清单.md（新增 §九：接线明细 + 守恒 + 未接 32 条定性 + §9.6 裁定与返工）
证据（可复跑）：命令与原始输出见 §三；逐端点台账见清单 §九；src/dist 双哈希见 §一.2
验收自评：卡面 §三 四条 + §四 反测 —— 逐条见 §四 / §五
未完成与阻塞：见 §六（A 类 1 条 + N 类 1 条需你裁定；无阻塞项）
风险与自我报备：见 §七（含 store:transfer 用于 CSV 导入的语义保留意见、台账同步的越域说明）
回传要求：本汇报已落卡：docs/tasks/cards/R101-S3-198-阿坚-回传.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-198-20261014.md
```

> **返工更新（2026-10-14，按凌舟裁定 `R101-S3-198-凌舟裁定与验收.md`）**：`trace` 域 9 条 `trace:code` 接线按裁定
> **全部退回**（生产实测门店角色不含 `trace:*`）⇒ **实际接线 25 条**、缺口 **705 → 680**；分支 HEAD 由 `1654698c`
> 前进为 **`35595341`**（返工提交，仍未 push / 未开 PR）。返工后的完整读数、反测与哈希见 **§九**。

派单人：凌舟（总负责人）｜2026-10-14
汇报人：阿坚（后端 / 权限）｜2026-10-14

---

## 一、交付物（逐文件 + 哈希 + 状态）

工作树 `D:\Users\ZXQL\wt-agents\S3-198`｜分支 `feat/s3-198-rbac-batch1`｜基线 `origin/main = fc6651a5`。
提交：**`1654698c`**（`fix: 库存/追溯域 RBAC 接线（S3-198 批B2-2）——34 个写端点补 requirePermission + 台账守恒 705→671 + 验收测试`），
**本地提交，未 push、未开 PR**（卡面红线）。`git status` 干净，改动 = 8 个既有文件 + 1 个新增测试文件（无无关改动）。

### 1.1 src 改动（git blob 短哈希 前 → 后；sha256 见 1.2 表头口径说明）

| 文件 | blob 前 → 后（`git rev-parse`） | sha256(src，接头后 16 位) | 改动 |
|:--|:--|:--|
| `backend/src/routes/data-transfer.routes.ts` | `572980beeade` → `cf2f8c41af40` | `5BD4DD689FAD9FB3` | +2 处 `requirePermission("store:transfer")` + 依据注释 |
| `backend/src/routes/inventory-batch.routes.ts` | `ec2a61f32b24` → `7abb64fa91ad` | `597D83F7F41C0A38` | +7 处（`inventory:create` ×3 / `inventory:adjust` ×4）+ 依据注释 |
| `backend/src/routes/inventory-share.routes.ts` | `5c921ab8df05` → `c5bd3a7c0695` | `DBDD8B3E749F8961` | +6 处（`inventory:create` ×3 / `inventory:adjust` ×3）+ 依据注释 |
| `backend/src/routes/trace.routes.ts` | `6728c9cc06c5` → `aea7f68c2916` | `E11BB86F4B1DCD9C` | **9 处 `trace:code` 接线已按凌舟裁定退回**（返工后）；现仅留退回依据注释，含写端点数 11 → 0 |
| `backend/src/routes/transfer-order.routes.ts` | `866bef52bdec` → `9265a5b086ee` | `F35450FD9BB6CF6A` | +7 处（`store:transfer` ×5 / `inventory:approve` ×2）+ 依据注释 |
| `backend/src/routes/warehouse.routes.ts` | `bcea2cc95c02` → `9f787215725c` | `99F2FB2FF7E2226E` | +3 处（`inventory:create` ×1 / `inventory:adjust` ×2）+ 依据注释 |
| `backend/scripts/rbac-wiring-baseline.json` | `ccc17bda2829` → `b4f93c1aac0b` | `5F8D63B2492528EE` | 移除本批 **25 条**（trace 域 9 条已回填）+ 同步 3 条改名；`_counts` 705/161 → **680/156** |
| `backend/src/__tests__/routes/rbac-g0-wiring.test.ts` | `206679b8a05c` → `b68f6fe4d178` | `DFD5963C172B9554` | 只同步「全量接线总数」快照（56 → **81**，新增 `S3_198_WIRED_FILES` 5 文件）；G0 名单行断言一字未动 |
| `backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts` | （新增）`7a629d0409ca` | `4A7049A8E40F774D` | **新增**（**202 用例**：形状断言 / 403 / 200 / 401 / 范围控制；返工后口径 25 接 / 32 未接） |
| `docs/tasks/R101-RBAC接线缺口清单.md` | `95fdb273f433` → `854d04700074` | — | 新增 §九（接线明细 25 条 + 未接 32 条定性 + 守恒 + 反测 + §9.6 裁定与返工） |

> ⚠️ 上表是**返工后（HEAD `35595341`）**的最终值；首版（`1654698c`）的对应值是「baseline 671 条 / g0 快照 90 / 新测试 227 用例 / trace 后哈希 `b583615769c3`」，
> 差异原因见 §九（trace 域 9 条按裁定退回）。

> 两套哈希口径并存的原因：`git blob` 短哈希可由 `git rev-parse origin/main:<path>` / `HEAD:<path>` 直接复算（口径唯一、不受行尾转换影响），
> sha256 是工作区文件的读数（card §「证据记 src + dist 哈希」）。**行尾提示**：Windows 侧 checkout 会将 LF 转 CRLF，
> 故 `git hash-object` 与 `Get-FileHash` 的读数不同属正常；两侧都已记录，便于你交叉核对。

### 1.2 dist（构建产物）复算（`npm --workspace backend run build`）

| dist 文件 | sha256(dist) | `requirePermission` 出现次数 |
|:--|:--|--:|
| `backend/dist/routes/data-transfer.routes.js` | `CAF3212F9A7CC6C6` | 3（= 2 接线 + 1 import） |
| `backend/dist/routes/inventory-batch.routes.js` | `391B56783621FC44` | 8（= 7 + 1） |
| `backend/dist/routes/inventory-share.routes.js` | `A5AB3740938274A0` | 7（= 6 + 1） |
| `backend/dist/routes/trace.routes.js` | `E6899066D45834D1` | 10（= 9 + 1） |
| `backend/dist/routes/transfer-order.routes.js` | `EF79BBB5CCA1C181` | 8（= 7 + 1） |
| `backend/dist/routes/warehouse.routes.js` | `890951F8AB547D91` | 4（= 3 + 1） |

> 说明：`src` 侧计数含 import 与注释说明；`dist` 计数 = 接线数 + import 1 处，两侧一致 ⇒ 产物确实带上了接线。

**未动**：其它域路由、控制器、服务、`.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`、
`docs/tasks/inbox/ACTIVE.md` 路由表、`docs/tasks/current-tasks.md`、记忆文件、其它批次工作树。

---

## 二、选域与判定口径（结论先行）

**选域 = 库存 / 追溯域**（台账 §三.12：12 文件 / 57 写端点）。理由：属「批 C2 · 用既有码的域先做」——
本域 **0 条需新立权限点**（卡面 §二.2 的「先立码」在本域为空集），57 条全是纯机械接线候选；
且体量（57）在三选一（库存 57 / 客户 45 / 采购 31）中最大、页面归属最集中。**避开** `platform*`（另立单）与营销域（S3-196 刚动过）。

对 57 条逐端点做**两条判定**（口径与 S3-122-G1 一致，可复算）：

1. **调用面**：全仓 `rg`（admin-web / app-mobile / miniapp / saas-admin / e2e / tests）查该端点 URL。
   存在 **app-mobile 写调用点** ⇒ 判 **B（不可判定）**：app-mobile 页面无角色门禁，无法证明「接线后不误伤」⇒ 本批不接。
2. **持有核对**：有页面调用点时，取 `admin-web/src/router/index.ts` 该页 `meta.roles`，要求 **页面角色 ⊆ 权限码持有人**
   （持有人用 `node backend/scripts/guard-rbac-wiring.mjs --holders <码>` 复算）。

结果：**34 条接线 / 23 条未接**（B 21 · A 1 · N 1），逐条表见 `docs/tasks/R101-RBAC接线缺口清单.md` §九.2 / §九.3。
其中 3 类特殊情形值得你知道：

- **零调用点也接线**：`trace.routes.ts` 9 条（admin-web 只有 `api/trace.ts` 的写函数、**零页面引用**）与
  `transfer-order.routes.ts` 7 条（全仓无任何前端引用 `/api/admin/transfer-orders`）——接线不会 403 任何现有页面角色；
- **A 类 1 条**：`POST /api/store/trace/verify`（收银台 `CashierView.vue:1273`）——页面角色含 STORE_MANAGER / STORE_OPERATOR，
  二者均**不持** `trace:code` ⇒ 接了就把收银台扫追溯码打 403，**故不接**；
- **N 类 1 条（台账判定有误）**：`POST /api/miniapp/trace/c/verify` 在 `trace.routes.ts:52` 挂的是 `auth:"none"`
  ＝**消费者端免鉴权**接口，台账 §三.12 判「管理面 / 该要权限」不成立；若照判接线，会因无 `req.user` 反成 401（消费者全部扫不了码）。

---

## 三、原始读数（可复跑）

工作树 `D:\Users\ZXQL\wt-agents\S3-198`｜HEAD `1654698c`｜基线 `origin/main = fc6651a5`。

### 3.1 `guard:rbac-wiring` 报告模式（前 → 后）

```
# 本批前（同一工作树，接线前）
[guard:rbac-wiring] 扫描 189 个路由文件 · 762 个写端点
[guard:rbac-wiring] 已接线 57 处 ／ **无权限检查 705 处**（分布在 162 个文件）
inventory-batch.routes.ts  (7 处) / inventory-share.routes.ts (6) / trace.routes.ts (11)
transfer-order.routes.ts (7) / transfer.routes.ts (8) / warehouse.routes.ts (3) / data-transfer.routes.ts (2) …

# 本批后
[guard:rbac-wiring] 扫描 189 个路由文件 · 762 个写端点
[guard:rbac-wiring] 已接线 91 处 ／ **无权限检查 671 处**（分布在 156 个文件）
   （本域只剩 trace.routes.ts 2 处：POST /api/admin/trace/verify、POST /api/miniapp/trace/c/verify —— 即 §六 的 B/N 类）
```

### 3.2 `guard:rbac-wiring --strict`（前 → 后）

```
# 本批前（在 origin/main 上，与本次接线无关的既有红）
已登记缺口 705 条 ／ 未登记缺口 3 条 ／ 已登记但当前无缺口 3 条
   ❌ 未登记：marketing-miniapp.routes.ts:55 POST /api/miniapp/marketing/coupons/:templateId/claim
   ❌ 未登记：marketing-miniapp.routes.ts:72 POST /api/miniapp/marketing/flash-sale/:id/buy
   ❌ 未登记：marketing-miniapp.routes.ts:80 POST /api/miniapp/marketing/group-buy/:teamId/join
❌ [--strict] 存在 3 处**未登记**的无权限写端点 ⇒ exit 1        → EXIT=1

# 本批后
已登记缺口 671 条 ／ 未登记缺口 0 条 ／ 已登记但当前无缺口 0 条
✅ [--strict] 无「未登记」缺口（已登记欠账 671 条不计红）        → EXIT=0
```

**差异**：`705 − 34 = 671`（本批接线 34 条）；另有 3 条**同端点改名**的台账同步（旧路径 → 新路径），见 §七 报备第 2 条。
> ⚠️ 本节读数是**首版（HEAD `1654698c`）**；**返工后**为 `705 − 25 = 680`（trace 域 9 条按裁定退回），见 §九。

### 3.3 三条既有 guard（与本次改动无关，须保持绿）

```
node backend/scripts/guard-route-auth.mjs      → ✅ G3 通过（auth:"none" 公开端点已登记 18 个文件）  EXIT=0
node backend/scripts/guard-tenant-status.mjs   → ✅ G2 通过（租户状态域只有 ACTIVE / DISABLED 一套口径）EXIT=0
node backend/scripts/guard-route-prefix.mjs    → ✅ G36 通过（重复前缀 12 个均登记、未登记重复前缀 0、真重复端点 0）EXIT=0
```

### 3.4 测试 / 类型 / 构建（卡面 §三.4）

```
npx vitest run                          → Test Files 655 passed (655) ／ Tests 7945 passed (7945) ／ 0 failed  EXIT=0
npx tsc --noEmit                        → 无输出                                                                    EXIT=0
npm --workspace backend run build       → tsc 通过 + fix-esm-extensions 处理 799 个 JS / 修复 1884 处导入路径       EXIT=0
```

> 本批新增测试文件 `rbac-b2-s3-198-inventory-wiring.test.ts` 单独跑：**227 passed（227）**。
> 首次全量跑曾出现 1 处红：`rbac-g0-wiring.test.ts` 的「全量接线总数」快照（56 → 实测 90）——
> 按历次批次既定做法只同步该快照期望值（G0 名单行与逐行 403/200 断言**一字未动**），同步后全量绿。
> ⚠️ 同上：本节为**首版**读数；**返工后**为「新测试 **202 passed**、全量 **7920 passed（655 文件）/ 0 failed**、g0 快照 56 → **81**」，见 §九.3。

---

## 四、验收自评（逐条对照卡面 §三 / §四）

> 下表为**首版**自评（34 条口径）；**返工后**的验收自评见 §九（25 条口径，判据不变、全部仍满足）。

| 卡面条目 | 结论 | 证据 |
|:--|:--|:--|
| §三.1 选域说明 + 该域端点逐条台账（方法/路径/文件:行/权限码/是否新立码） | ✅ | 清单 §九.2（首版 34 条 → **返工后 25 条**，含 `文件:行`、权限码、是否新立码）＋ §九.3（首版 23 条 → **返工后 32 条**，含原因与依据文件行） |
| §三.2 反测三段（缺码 403 / 有码通过 / 摘中间件变红） | ✅ | §五（三段原始输出） |
| §三.3 台账守恒数字 + `--strict` 前后退出码与差异 | ✅ | §3.1 / §3.2 / §九.4：首版 705 → 671（−34）；**返工后 705 → 680（−25）**，`--strict` EXIT=1 → EXIT=0（两侧一致） |
| §三.4 `vitest` 0 failed、`tsc --noEmit` 0、三条 guard EXIT=0、backend build EXIT=0 | ✅ | §3.3 / §3.4 |
| §二.5 不得放宽既有鉴权；三条 guard 仍 EXIT=0 | ✅ | 本批只**新增** `requirePermission`，未删改任何既有鉴权/CSRF；§3.3 |
| §二.1 只做一个域、不许一次改 100+ | ✅ | 仅 6 个文件 34 处（**返工后 5 个文件 25 处**，本域 12 文件中的 5 个），未越域 |
| §二.2 先立码后接线 | ✅（本域为空集） | 本域 57 条均落在既有码上：`inventory:create/adjust/approve`、`trace:code`、`store:transfer`，**0 条新立码**（§九.2 末列全为「否（既有码）」） |
| §二.4 反测至少覆盖该域全部新接线端点 | ✅ | 34 行**逐行**都有「READONLY ⇒ 403」「holders ⇒ 200」「未登录 ⇒ 401」用例（首版 227 → **返工后 202 用例**） |
| §四 反测两段：摘 1 条 ⇒ `--strict` 红；摘 1 条 ⇒ 用例红 | ✅ | §五 A / B |

---

## 五、反测（门禁铁律：故意制造失败证明它会红）

### A. `--strict` 两侧（摘掉 `inventory-batch.routes.ts:20` 的 `requirePermission("inventory:create")`）

```
# A-1 报告模式必须重新报出该端点
inventory-batch.routes.ts  (1 处)
   L20: POST /api/admin/inventory-batch/batches ⇒ 无权限检查

# A-2 --strict 必须转红并点名
已登记缺口 671 条 ／ 未登记缺口 1 条 ／ 已登记但当前无缺口 0 条
   ❌ 未登记：inventory-batch.routes.ts:20 POST /api/admin/inventory-batch/batches
❌ [--strict] 存在 1 处**未登记**的无权限写端点 ⇒ exit 1              → EXIT=1

# A-3 复原后（当前状态）
已登记缺口 671 条 ／ 未登记缺口 0 条 ／ 已登记但当前无缺口 0 条
✅ [--strict] 无「未登记」缺口                                        → EXIT=0
```

### B. vitest 侧（摘掉 `warehouse.routes.ts:21` 的 `requirePermission("inventory:adjust")`）

```
npx vitest run src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts
 ❯ 227 tests | 3 failed
 FAIL … 形状断言 … 'warehouse.routes.ts' 'put' '/:id'：注册行自带 requirePermission("inventory:adjust")
 FAIL … a) 只读账号被拦 … 'warehouse.routes.ts' 'put' '/:id' ⇒ 403 且 msg 指向该权限码
        AssertionError: expected 200 to be 403
 FAIL … c) 反证：非持有人一律 403 … uid=9001（readonly）: expected 200 to be 403
 Tests  3 failed | 224 passed (227)                                    → EXIT=1

# 复原后
 Test Files  1 passed (1) ／ Tests  227 passed (227)                   → EXIT=0
（复原后 6 个 src 文件 sha256 与接线后一致：5BD4DD68… / 597D83F7… / DBDD8B3E… / 2D548312… / F35450FD… / 99F2FB2F…）
```

### C. 缺口可见性（反测的第三只脚：报告模式不是恒绿摆设）

本批前报告模式对本域 6 文件报 **34 处**「无权限检查」，本批后报 **0 处**（`trace.routes.ts` 剩 2 处＝刻意未接的 B/N 类）；
即：报告模式的读数**随代码真实变化**，而不是恒绿。

---

## 六、未完成与阻塞

> **2026-10-14 更新**：以下 3 项均已由凌舟裁定（`R101-S3-198-凌舟裁定与验收.md`）——
> A 类 13 号与 trace 域同因（`trace:*` 无生产持有者）⇒ **归入「待补授权」另立单**；N 类 15 号 ⇒ **采纳本单判定**（台账已订正）；
> B 类 21 条 ⇒ **本批不动**，后续批次须先做生产持有核对。落地与复跑见 **§九**。

**无阻塞**。以下为本单原始待裁项（保留原文以便对照）：

1. **A 类 1 条**（`POST /api/store/trace/verify`，`store-trace.routes.ts:8`）：收银台页面角色（SUPER_ADMIN / STORE_MANAGER / STORE_OPERATOR）
   与建议码 `trace:code` 的持有人（WAREHOUSE_STAFF + 超管）不相交。二选一：
   **(a)** 新立一条收银台语义的细码（如 `trace:verify`，须同时定授予角色）；**(b)** 先给 STORE_MANAGER / STORE_OPERATOR 补授 `trace:code` 再接线。
2. **N 类 1 条**（`POST /api/miniapp/trace/c/verify`）：建议把台账 §三.12 的判定由「管理面 / 是」改为「公开端点（免鉴权）」，
   并在 §三 的清单行上同步（本单**未改**该行的历史判定，只在本节与 §九.3 留证）。

另：**本批未接的 21 条 B 类**（app-mobile 写调用点）需要一个统一口径才能推进——建议你定一条规则，例如
「app-mobile 写调用点 ⇒ 先确认 app-mobile 该功能的角色集合（`function-menu.ts` 的 code 与后端角色/权限映射），
确认页面角色 ⊆ 持有人后才接线」，否则 B 类会一直挂着。

---

## 七、风险与自我报备

1. **`store:transfer` 用于 CSV 导入的语义保留意见**（data-transfer 2 行）：台账 §三.12 给的建议码就是 `store:transfer`，
   我按台账接线（持有者含店长 `store:*`，页面角色 ⊆ 持有人成立），但**语义上偏宽**——它本义是「门店调拨」，不是「数据导入」。
   如你认为不妥，最小改动是：**新立 `data:import` 细码**（或改用 `goods:create` + `customer:create` 两码，但那样商品导入页的
   STORE_MANAGER 会被 403，因为店长不持 `goods:create`）——该取舍我不自行决定，已在代码注释里写明保留意见。
2. **台账同步越域（主动报备）**：`--strict` 在本批**开工前**即为红（EXIT=1），红点是 **S3-187（`67beff76`）改名遗留**：
   营销 3 条小程序端点的路径由 `coupons/claim` → `coupons/:templateId/claim` 等，台账里仍是旧路径（3 条「已登记但当前无缺口」），
   新路径则「未登记」。我在改台账时把这 3 组**同端点改名**一并同步（旧 → 新），使 `--strict` 转绿。
   **这不是"用登记洗绿新缺口"**：两侧条数相抵（3 旧 → 3 新），全仓缺口总数未因此变化；这 3 条仍未接线（消费者端，建议另立单）。
   如果你认为跨域改动不宜由我落，回滚方式：把那 3 条键名改回旧路径即可（`--strict` 会立刻回到 EXIT=1）。
3. **权限码语义 vs 端点语义的边界（本批共性）**：`warehouse.routes.ts` 的仓库主数据用 `inventory:create/adjust`，
   `trace` 配置用 `trace:code`——都是**沿用台账建议码**。持有人覆盖成立、无页面 403，但粒度偏粗（例如"新建仓库"与"新增库存"共用一码）。
   若后续要细分，需先补权限点目录（属批 C1 的活）。
4. **持有人口径不是生产真值**：所有"页面角色 ⊆ 持有人"结论基于**仓库角色种子**（079/128/ops-S3-122*）。
   生产库另有 `STORE_ADMIN` / `SALESMAN` / `CASHIER` 等未入种子的角色 ⇒ **合并前请在服务器核对**
   `SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;`
   重点看：`STORE_MANAGER` 是否真有 `store:*`、`inventory:*`（本批 25 行依赖它）。
5. **静态判定为主、未跑真库**：本单无 DB 权限，反测用「路由注册行 + supertest（真实 router + 真实 `matchPermission`）」，
   非真实 MySQL/JWT 全链路；这与 S3-122-G1 以来的验收方式一致，但**不等于**端到端验证。
6. **本工作树未删**：按卡面红线保留工作树与 `node_modules`（未执行 `rmdir node_modules`），交给你决定何时回收。
7. **`current-tasks.md` 未动**：它是主检出的共享任务文件（你本人也在改），为避免与你的在途编辑冲突，本单未碰；
   如需登记本批状态，请在合并后统一更新。

---

## 八、复算命令（任何人可逐条核对）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-198
git log --oneline -1                       # 期望 1654698c

# 1) 台账守恒（前 705 / 后 671）
node backend/scripts/guard-rbac-wiring.mjs
# 2) 严格模式（后 EXIT=0；摘掉任一接线 ⇒ EXIT=1 并点名）
node backend/scripts/guard-rbac-wiring.mjs --strict; $LASTEXITCODE
# 3) 权限码持有人（接线前核对用）
node backend/scripts/guard-rbac-wiring.mjs --holders inventory:create
# 4) 三条既有 guard
node backend/scripts/guard-route-auth.mjs; node backend/scripts/guard-tenant-status.mjs; node backend/scripts/guard-route-prefix.mjs
# 5) 测试 / 类型 / 构建
cd backend
npx vitest run src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts   # 227 passed
npx vitest run                                                               # 655 文件 / 7945 用例 / 0 failed
npx tsc --noEmit
cd .. ; npm --workspace backend run build
```

> 逐端点台账与守恒表：`docs/tasks/R101-RBAC接线缺口清单.md` §九（本批新增）。
> 卡面存档：`docs/tasks/inbox/archive/ACTIVE-S3-198-20261014.md`。

---

## 九、返工回执（按凌舟裁定 R101-S3-198，2026-10-14）

> 依据：`docs/tasks/cards/R101-S3-198-凌舟裁定与验收.md`（**有条件通过，需返工一处**）
> 分支 `feat/s3-198-rbac-batch1`｜**HEAD = `35595341`**（返工提交；首版 `1654698c`）｜基线 `fc6651a5`｜仍未 push / 未开 PR

### 9.1 裁定落地（逐条）

| 裁定条目 | 处置 | 证据 |
|:--|:--|:--|
| §二.① **trace 域 9 条接线全部退回**，保留台账并标「待补授权」，**不得**顺手改角色种子 | ✅ `trace.routes.ts` 现 **0 处** `requirePermission(`；文件头留退回依据（生产实测 `trace:*` 无门店角色持有）；台账 9 条**回填**并标 P 类 | `git show HEAD:backend/src/routes/trace.routes.ts`；清单 §9.2 退回说明 / §9.3 第 24–32 行 |
| §二.② `POST /api/miniapp/trace/c/verify` 属消费者端免鉴权 ⇒ **采纳**，台账判定订正 | ✅ 清单 §三.12 该行订正为「公开端点（消费者端免鉴权，`auth:"none"`）／该不该要权限=否／不适用（免鉴权）」＋订正说明 | 清单 §三.12（`POST /api/miniapp/trace/c/verify` 行下） |
| §二.③ B 类 21 条本批不动，后续批次须先做同一道生产持有核对 | ✅ 未动；清单 §9.3 保留 B 类逐条依据，并写明「先核对持有再接线」 | 清单 §9.3 |
| §二.④ 台账里 S3-187 改名 3 键同步 ⇒ 认可 | ✅ 保留（条数相抵，未洗绿新增缺口） | §9.4 台账同步说明 |
| §二.⑤ `store:transfer` 语义偏宽 ⇒ 保留保留意见、记「待细化」 | ✅ 清单 §9.2 第 1–2 行下新增「待细化」说明（建议后续 `data:import` 类细码；`goods:create` 不可用：店长不持有） | 清单 §9.2 「待细化」段 |
| §三 返工验收判据（`--strict` EXIT=0 + 守恒自洽 + 逐条列码与生产持有证据 + 全量门禁 + 反测两侧齐） | ✅ 全部满足，见 9.2 / 9.3 / 9.4 | 下表 |

### 9.2 反工后实际接线 25 条 —— **逐条 + 依赖的权限码 + 生产持有证据**

生产持有证据（凌舟亲跑，裁定文件 §一）：`STORE_MANAGER.permissions` =
`["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price","finance:daily-settle"]`；
`SUPER_ADMIN = ["*"]`。

| # | 文件:行 | 方法 路径 | 权限码 | 该码的生产持有者 | 判定 |
|--:|:--|:--|:--|:--|:--|
| 1–2 | `data-transfer.routes.ts:26,29` | `POST /import/customers`、`/import/products` | `store:transfer` | STORE_MANAGER（`store:*`）、SUPER_ADMIN（`*`） | ✅ 页面角色（系统配置 SUPER_ADMIN；商品导入 SUPER_ADMIN+STORE_MANAGER）⊆ 持有者 |
| 3–9 | `inventory-batch.routes.ts:20,21,22,32,33,34,40` | 批次增改拆 / 效期配置 CRUD / 效期预警处理 | `inventory:create`（3）、`inventory:adjust`（4） | STORE_MANAGER（`inventory:*`）、WAREHOUSE_STAFF（`inventory:*`）、SUPER_ADMIN | ✅ 页面 `inventory-batch` = SUPER_ADMIN |
| 10–15 | `inventory-share.routes.ts:14,16,17,18,19,20` | 共享设置 + 共享商品 CRUD | `inventory:adjust`（3）、`inventory:create`（3） | 同上 | ✅ 页面 `inventory-share-config` = SUPER_ADMIN |
| 16–22 | `transfer-order.routes.ts:15,16,17,18,19,20,22` | 调拨单 v2 增删改 + 审批 + 出入库确认 | `store:transfer`（5）、`inventory:approve`（2） | `store:transfer`：STORE_MANAGER（`store:*`）、SUPER_ADMIN；`inventory:approve`：STORE_MANAGER / WAREHOUSE_STAFF（`inventory:*`）、SUPER_ADMIN | ✅ 全仓零调用点 |
| 23–25 | `warehouse.routes.ts:20,21,22` | 仓库 CRUD | `inventory:create`（1）、`inventory:adjust`（2） | 同上 | ✅ 页面 `system/config` = SUPER_ADMIN |

**退回的 9 条（P 类）**：`trace.routes.ts:23,24,25,26,29,32,40,43,44` —— 均依赖 `trace:code`，而该码生产持有者**只有**
`WAREHOUSE_STAFF`（种子口径 `trace:*`）+ `SUPER_ADMIN`/`OPERATION_ADMIN`（`*`）→ **门店角色 0 持有**（`t_sys_role_permission` 0 命中）⇒ 退回待补授权。

### 9.3 返工后复跑读数（原始输出）

```
node backend/scripts/guard-rbac-wiring.mjs
  [guard:rbac-wiring] 扫描 189 个路由文件 · 762 个写端点
  [guard:rbac-wiring] 已接线 82 处 ／ **无权限检查 680 处**（分布在 156 个文件）
node backend/scripts/guard-rbac-wiring.mjs --strict        → EXIT=0
  已登记缺口 680 条 ／ 未登记缺口 0 条 ／ 已登记但当前无缺口 0 条
  ✅ [--strict] 无「未登记」缺口（已登记欠账 680 条不计红）
guard-route-auth / guard-tenant-status / guard-route-prefix → 三者 EXIT=0
npx vitest run（backend 全量）  → Test Files 655 passed (655) ／ Tests 7920 passed (7920) ／ 0 failed  EXIT=0
npx tsc --noEmit                → 无输出                                                              EXIT=0
npm --workspace backend run build → 处理 799 个 JS / 修复 1883 处导入路径                              EXIT=0
```

**守恒对照（首版 → 返工后）**：`705 → 671（首版，−34）` ⇒ `705 → 680（返工后，−25）`；
机读台账 671 条 → **680 条**（trace 域 9 条回填）/ 文件数 156 不变。

### 9.4 返工后反测（两侧齐，可复跑）

```
# A. --strict 两侧：摘掉 inventory-batch.routes.ts:20 的 requirePermission("inventory:create")
  ❌ 未登记：inventory-batch.routes.ts:20 POST /api/admin/inventory-batch/batches  → EXIT=1
  复原 ⇒ 已登记缺口 680 / 未登记 0 / 陈旧 0  ✅ → EXIT=0

# B. vitest 侧：摘掉 warehouse.routes.ts:21 的 requirePermission("inventory:adjust")
  202 tests | 3 failed（形状断言 + READONLY⇒403 + 非持有人⇒403，均点名该行）      → EXIT=1
  复原 ⇒ Test Files 1 passed ／ Tests 202 passed (202)                              → EXIT=0
```

### 9.5 返工后交付物哈希

| 文件 | git blob（`origin/main` → `HEAD`） | sha256(src，16 位) |
|:--|:--|:--|
| `backend/src/routes/trace.routes.ts` | `6728c9cc06c5` → `aea7f68c2916`（无接线，仅留退回依据注释） | `E11BB86F4B1DCD9C` |
| `backend/scripts/rbac-wiring-baseline.json` | `ccc17bda2829` → `b4f93c1aac0b` | `5F8D63B2492528EE` |
| `backend/src/__tests__/routes/rbac-g0-wiring.test.ts` | `206679b8a05c` → `b68f6fe4d178` | `DFD5963C172B9554` |
| `backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts` | （新增）`7a629d0409ca` | `4A7049A8E40F774D` |
| `docs/tasks/R101-RBAC接线缺口清单.md` | `95fdb273f433` → `854d04700074` | — |
| 接线保留的 5 个路由文件 | 与首版一致（`572980beeade→cf2f8c41af40` 等，见 §1.1） | 见 §1.1 |

### 9.6 与主干的关系（需你合并时注意）

- 我这条分支**未 rebase、未 push**（卡面红线）。查询时 `origin/main` 已由 `fc6651a5` 前进到 **`5d8f46df`**
  （S3-195 / S3-199 / S3-200 已并入，PR #313~#315），我的 `merge-base(origin/main)` 仍是 `fc6651a5`。
- 主干台账（`5d8f46df` 版）实测：`_counts` 仍是 `705 条 / 161 文件`，且**仍含旧路径** `"POST /api/miniapp/marketing/coupons/claim"`
  ⇒ **主干当前的 `--strict` 仍是红**（3 条未登记 + 3 条陈旧，即我 §9.4 说的 S3-187 改名遗留）；本分支的同一处同步可一并解决。
- 合并冲突面：`rbac-wiring-baseline.json` 上主干改的是 `store-hardware/box-config/`、`hold-orders/`、`shifts/` 三条（S3-195，7±行），
  我改的是 marketing 三条键名 + `_counts` + `_lastUpdate`，**行不相邻**，3 路合并预计可自动完成；`_lastUpdate` 一行如冲突，保留两侧说明即可。
- 我的验收读数全部基于 `fc6651a5` 基线；并入主干后请按项目标准在主干上复跑 `--strict` 与全量 vitest（本单不做 rebase，避免动你的在途分支）。
