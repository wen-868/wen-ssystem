# S3-232 证据包 · 立码第一批（D6）

> 执行方：**阿坚（后端 / 权限）**｜日期：**2026-10-16**｜派单卡：`docs/tasks/inbox/ACTIVE-S3-232.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-232`｜分支：`feat/s3-232-new-codes-batch1`｜基线：`origin/main` = `1a067843`
> 回执：`docs/tasks/inbox/ACTIVE-回执-S3-232.md`｜回传卡：`docs/tasks/cards/R101-S3-232-阿坚-回传.md`

---

## 一、本单结论（先看这个）

| # | 项 | 结论 | 证据文件 |
|--:|:--|:--|:--|
| 1 | **D1**：`STORE_MANAGER ← goods:create | goods:edit`（不含 `goods:delete`） | ✅ 迁移 204 真库跑通；店长权限串 9 → 11 个码，两码各出现**恰好 1 次** | `raw/23-*`、`raw/28-*`、`raw/33-*` |
| 2 | **立码 14 条**（系统设置/基础域） | ✅ 14 码 × 2 个租户 = 28 行 `t_sys_menu` BUTTON 行；第二遍**零变更** | `raw/26-*`、`raw/28-*`、`raw/29-*` |
| 3 | **迁移幂等**（连跑两遍） | ✅ 第一遍 `1 / 1 / 28` 行受影响，第二遍 `Rows matched: 0 Changed: 0`、`Records: 0` | `raw/28-*` vs `raw/29-*` |
| 4 | **门禁判据承重**（反测 A/B） | ✅ 摘掉 `NOT EXISTS` ⇒ `ER_DUP_ENTRY 1062`；摘掉 `JSON_CONTAINS` ⇒ 码被追加第二次（12 / 2 次） | `raw/30-*`、`raw/31-*` |
| 5 | **目录↔迁移一致**（含分辨力自证） | ✅ 44 例全绿；反测 C（从迁移删 1 码）⇒ 3 例判红，复原后 29 例全绿、文件 SHA256 逐字节一致 | `raw/10-*`、`raw/61-*`、`raw/62-*` |
| 6 | **零业务改动** | ✅ `git diff --name-only origin/main -- backend/src/{routes,middleware,services}` = 空 | 回执 §十 |
| 7 | **回归** | ✅ vitest `679 文件 / 9536 例 / 0 failed`、`tsc --noEmit` EXIT=0（0 字节输出）、`build` 通过、`eslint` 0 error | `raw/43-*`、`raw/41-*`、`raw/40-*`、`raw/42-*` |
| 8 | **既有门禁不回归** | ✅ `guard-rbac-wiring --strict` EXIT=0（gaps 378 / consumerEnd 45，与开工时同值）、`guard-route-auth` / `guard-evidence-secrets` / `guard-utf8-encoding` 全 EXIT=0 | `raw/50-*`、`raw/51-*` |

---

## 二、环境（可复现的边界，诚实标注）

| 项 | 值 |
|:--|:--|
| 数据库 | **本机便携 MySQL 8.0.28** `@127.0.0.1:3399`（二进制 `%TEMP%\mysql80\mysql-8.0.28-winx64`，本机既有；root 空口令，**不是生产**） |
| 夹具库 | `liquor_inventory`（由**后端 dist 空库启动**建成：312 张表；`t_sys_role` 形状含 `permissions` JSON + `tenant_id`） |
| 夹具补偿 | 空库启动后**角色权限串与菜单是空的**（079/128 的补全语句被 NOT EXISTS 守卫整条跳过）⇒ 按**生产实值**显式摆前置：`harness/fixture-before-204.sql`（角色权限串逐字来自 `docs/evidence/_shared/prod-roles-20261016.txt`） |
| 多租户 | 夹具摆了 `default` 与 `demo` 两个 **`system` 一级目录行**（角色行只 `default` 一行：本夹具库 `t_sys_role` 的唯一键是全局 `uk_sys_role_code`，跨租户同 role_code 插不进去，实测 1062） |
| 执行通道 | ① `node scripts/run-migration.mjs docs/migrations/204_系统设置域权限点立码.sql`（**生产同款**；需 cwd 有 `.env`，键为 `DB_HOST/DB_PORT/DB_USER/DB_NAME`，本机夹具为空口令）<br>② `docs/evidence/S3-232/harness/run-204-idempotency.mjs`（逐语句受影响行数，判据可核） |

> ⚠️ **不是生产验证**：本包只证明"迁移 SQL 自身正确且幂等"。生产执行与只读复核仍须由凌舟完成（命令见上文 ①）。

---

## 三、raw/ 文件逐项说明

| 文件 | 证明什么 |
|:--|:--|
| `10-vitest-catalog-and-snapshot.txt` | 目录 29 例 + 迁移编号快照 15 例 = **44 passed**（含命名规范、目录↔迁移双向一致、端点存在性、D1 双侧同源、I1' 前置事实） |
| `20-server-boot.log` / `20b-server-boot.log` | 后端空库启动（build dist 后 `node backend/dist/server.js`）：**所有迁移完成**、`t_sys_role` 收敛到含 `permissions`/`tenant_id` 的形状。`20b` 为**无 ANSI 噪声版**（推荐引用）；`20` 是 PTY 版（含终端转义序列，仅留档） |
| `21-fixture-before-204.txt` | 夹具摆好后的读数：`STORE_MANAGER 1 行（持 goods:create 的 0 行）；system CATALOG 2 行` |
| `22-204-pass1.txt` / `25-204-pass2-runner.txt` / `32-204-final-official-run.txt` | **官方通道**三次执行（第一遍 / 第二遍 / 复位后收尾一遍）均 `迁移执行成功`、EXIT=0 |
| `23-readings-after-pass1.txt` | 第一遍后：`14 码 × default/demo 两个租户`；店长权限串 9 → 11 |
| `24-204-pass2-cli-verbose.txt` | 第二遍的 mysql CLI `-v` 全文（逐语句回显）；末尾 `204 立码核对：14 码全租户命中 28 行…` |
| `26-readings-after-pass2.txt` | 第二遍后：`total_14codes 28`（未变）、`duplicate_rows 0`、店长 `perm_len 11`、`create_occ/edit_occ = 1` |
| `27-fixture-reset-before-pass1.txt` | 复位：只删本批 14 码的菜单行（明确 `WHERE`），`system:%` 剩余 0 行（父目录行保留） |
| **`28-harness-pass1.txt`** | **幂等判据的机读证据（第一遍）**：`Rows matched: 1 Changed: 1`（两个授权）、`Records: 28`（菜单行）、合计受影响 30 行 |
| **`29-harness-pass2.txt`** | **幂等判据的机读证据（第二遍）**：两个授权 `Rows matched: 0 Changed: 0`、菜单 `Records: 0 Duplicates: 0`，合计 **0** |
| **`30-neg-A-no-notexists.txt`** | **反测 A**（摘掉菜单行 NOT EXISTS 守卫）⇒ `ER_DUP_ENTRY` / `errno 1062` / `Duplicate entry 'system:alert:handle-demo' for key 't_sys_menu.uk_sys_menu_code_tenant'` ⇒ 守卫承重 |
| **`31-neg-B-no-jsoncontains.txt`** | **反测 B**（摘掉 `goods:create` 的 `JSON_CONTAINS` 守卫）⇒ 该语句仍 `affectedRows: 1`，库内 `perm_len 11 → 12`、`goods:create` 出现 **2** 次 ⇒ 守卫承重 |
| `33-final-readings.txt` | 收尾态：14/14（两租户）、`dup_pairs 0`、店长 `perm_len 11 / occ 1/1`、持 `goods:delete` 的角色行 **0** |
| `40-build-backend.txt` | `npm --workspace backend run build` 通过（805 个 JS、修 1957 处导入路径） |
| `41-tsc-noemit.txt` | `tsc --noEmit` **0 字节输出 = 无任何错误**（EXIT=0） |
| `42-eslint.txt` | `eslint src --ext .ts`：**0 error** / 169 warning（全为存量复杂度告警） |
| `43-vitest-full.txt` | 全量单测：**679 文件 / 9536 例 / 0 failed**（158s） |
| `50-*` / `51-*` | 四道既有门禁的原始输出（rbac-wiring --strict / route-auth / evidence-secrets / utf8-encoding），均为 EXIT=0 |
| `60-negC-injected-204.sql` | 反测 C 的**注入版迁移**（从 14 条里删掉 `system:push:test` 一行），留档 |
| `61-negC-vitest-red.txt` | 反测 C 的红侧输出：**3 failed / 26 passed**（目录↔迁移一致、`sort_no` 序列、提取器自证三条判红） |
| `62-negC-restored-green.txt` | 复原后复跑：**29 passed**；且复原后文件 SHA256 = `E31A17466256A9CC…`（与注入前逐字节一致） |
| `harness/fixture-before-204.sql` | 夹具脚本（前置状态 + 自证 SELECT） |
| `harness/run-204-idempotency.mjs` | 逐语句受影响行数装置（幂等机读判据；用法见文件头） |
| `harness/neg-A-…sql` / `harness/neg-B-…sql` | 两个反测的**注入版迁移**（只去掉守卫，其余逐字相同） |

> 说明：`28/29` 的最后一条"写语句"是**文件尾空语句**（mysql2 对结尾换行回一个 0 行空结果集），非真实语句。

---

## 四、关键读数（一屏核对）

```
立码 14 条 × 2 租户 = 28 行 t_sys_menu（default 14 / demo 14），重复对 0
STORE_MANAGER 权限串：9 → 11，goods:create 出现 1 次、goods:edit 出现 1 次（无 goods:delete）
幂等第二遍：Rows matched: 0 Changed: 0（两条授权）+ Records: 0 Duplicates: 0（菜单）
反测 A（无 NOT EXISTS）⇒ 1062；反测 B（无 JSON_CONTAINS）⇒ 追加第二次；反测 C（删 1 码）⇒ 3 例判红
回归：vitest 9536 例 0 failed ｜ tsc 0 ｜ eslint 0 error ｜ build 通过 ｜ 四道门禁 EXIT=0
零业务改动：backend/src/{routes,middleware,services} 对 origin/main 差异 = 空
```

---

## 五、卡外观察（只登记不动手，详见回执 §六）

1. **卡 §二.1 的目录位置不存在**：`backend/src/shared/user-permissions.ts` 无 `PERMISSION_CATALOG`
   （商家侧目录是 per-域常量文件）⇒ 本批新建 `system-permission-codes.ts`。
2. **卡 §二.2 的 `t_sys_role_permission` 不是真机制**（全仓无人读）⇒ 授权落 `t_sys_role.permissions`。
3. **空库启动后角色权限串为空**：079/128 的补全语句被 `NOT EXISTS(role_code, tenant_id)` 守卫整条跳过
   （001 已先建同名角色行）⇒ 灾备/新库重建拿不到生产权限串，需另立"角色种子补全"单。
4. **`069_商品SPU增加品牌ID.sql` 重跑不幂等**：非空库二次启动报
   `Duplicate foreign key constraint name 'fk_product_spu_brand'`（无 `information_schema` 守卫）。
   ⚠️ 这是本机夹具库**二次启动**触发的存量问题（CI 用全新空库，不触发），与 204 无关。
5. **`t_sys_role` 的唯一键在本夹具库是全局 `uk_sys_role_code`**：跨租户同 `role_code` 插不进去（实测 1062）
   ⇒ 多租户角色克隆的形态与 197/198 的意图可能不一致，属既有形态问题（只登记）。
