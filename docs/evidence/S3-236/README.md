# S3-236 证据包 · 立码第二批（四域 38 码）

> 执行方：**DSH（S3-236 执行会话，任务 owner 字段 = 阿坚）**｜日期：**2026-10-17**
> 派单卡：`D:\Users\ZXQL\dispatch\dsh\outbox\S3-236.md`（+ 仓库内 `docs/tasks/inbox/ACTIVE-S3-236.md`）
> 工作树：`C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-S3-236`｜分支：`dsh/S3-236`｜基线：`main`
> 回传卡：`docs/tasks/cards/R101-S3-236-DSH回传.md`

---

## 一、本单结论（先看这个）

| # | 判据 | 结论 | 证据 |
|--:|:--|:--|:--|
| 1 | 38 码在**目录 / 迁移 207 / 路由注册行**三处逐条可对齐 | ✅ 10 条判据全 PASS（双向一致、sort_no 1..38、45 端点存在性、父行白名单、零授权、幂等守卫） | `raw/70-three-way-verify.txt` |
| 2 | 迁移 `207` 真库**连跑两遍零错误**、第二遍"已存在，跳过" | ⚠️ **部分达成**：本机 **MariaDB 11.4.5** 便携实例（工作树内数据目录）两遍零错误 + 第二遍 `Records: 0 Duplicates: 0`；官方 runner 两遍 EXIT=0；**未在 MySQL 8.0.28 上复现**（本沙箱无该实例，见 §二） | `raw/31`、`raw/32`、`raw/33`、`raw/50`、`raw/51`、`raw/52` |
| 3 | `guard-rbac-wiring --strict` EXIT=0 | ✅ EXIT=0（gaps 314 / consumerEnd 45，与开工时同值 ⇒ **未接任何业务路由**） | `raw/40-guard-rbac-wiring-strict.txt` |
| 4 | `guard-migration-manifest` EXIT=0；`EXPECTED_MAX_MIGRATION` = 207 | ✅ 生成器重跑（A 187 / C 8 / B 12 = 207），门禁 PASS EXIT=0；断言常量已同步 207 | `raw/20`、`raw/21` |
| 5 | 回归：全量 `npx vitest run` 0 failed、`tsc --noEmit` 0、`npm run build` 0 | ⚠️ **部分达成**：`tsc --noEmit` EXIT=0（0 字节输出）、后端 `build`（tsc + fix-esm-extensions）EXIT=0；**vitest 与根 `npm run build` 未达成**（沙箱 `spawn EPERM` + 依赖安装不完整，见 §二） | `raw/81-tsc-noemit-说明.txt`、`raw/80-vitest-batch2-attempt2.txt`、`raw/82-build-all.txt` |
| 6 | 反测：删掉某一条码 ⇒ 三方一致断言**必红并点名**该码；复原后逐字节一致（SHA256） | ✅ 删 `report:export` ⇒ ③④⑤ 判红并点名（`目录有、迁移无：report:export=导出报表`）；迁移文件**从未落盘改动**，SHA256 恒定 | `raw/71-negC-drop-report-export.txt`、`raw/72-207-sha256.txt` |

---

## 二、环境（可复现的边界，诚实标注）

| 项 | 值 |
|:--|:--|
| **真库** | ⚠️ 本沙箱**没有 MySQL 8.0.28**：端口 3306/3399 均无监听；`D:\Users\ZXQL\tools\mariadb\data`（既有夹具库）在**工作树之外**，本会话文件沙箱对该路径只读（`[sandbox: file access denied under workspace-write mode]`），提权申请被拒（`no approval channel is available`） |
| **替代实例** | 本机既有 **MariaDB 11.4.5** 便携二进制（`D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64`），数据目录在工作树内：`docs/evidence/S3-236/harness/mariadb-data/`，端口 3407；**复跑后已停药并删除该目录**（见 §六） |
| **夹具形状** | 最小形状（**不是** 312 张业务表）：`t_sys_menu`（079 第 18-37 行 DDL 逐字）+ `t_sys_role`（008 DDL + `tenant_id`/`data_scope`）；父行摆 `default` 与 `demo` 两租户的 `report/system/store/dashboard` CATALOG 行（验证"父行逐租户定位"） |
| **执行通道** | ① 官方通道 `node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql`（两遍 EXIT=0）；② `mysql` CLI `--verbose`（逐语句回显 + `Records:` 行 = 幂等机读读数） |
| **TS 断言通道** | ⚠️ vitest 在本沙箱起不来（`vite` 加载 config 要 `esbuild` service 子进程 + 管道 stdio ⇒ `spawn EPERM`）⇒ 改用 `node --experimental-strip-types --import ./docs/evidence/S3-236/harness/ts-resolve-hooks.mjs` 加载**同一份** TS 目录常量，按**同一套判据**复跑（`verify-three-way.mjs`，10/10 PASS） |
| **依赖安装** | `npm install --legacy-peer-deps --cache ./.npm-cache` 多次尝试后仍不完整（`typescript/lib/lib.es2022.full.d.ts`、`vite/bin/vite.js`、`vue-tsc`、`@dcloudio/vite-plugin-uni` 缺失）⇒ 根 `npm run build` 各工作区失败（报错全是 `Cannot find module …`，**非代码问题**）；`tsc --noEmit` EXIT=0（`raw/81`）是在依赖尚完整时取得的读数。⚠️ 末几次 install 遇 `EPERM` 后 `node_modules/` 掉到 11 个包 ⇒ 要在本工作树复跑请先 `npm ci --legacy-peer-deps` |

> ⚠️ **不是生产验证**：本包只证明"迁移 SQL 自身正确且幂等 + 目录/迁移/路由三方一致"。生产执行与只读复核仍须由凌舟用
> `node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql` 完成（执行后核对末尾三条 SELECT 的读数）。

---

## 三、产物清单（本单改了/加了什么）

| 类别 | 文件 |
|:--|:--|
| 迁移 | `docs/migrations/207_四域权限点立码.sql`（38 码，BUTTON 行，父行 = 各租户域 CATALOG；幂等，零角色授权） |
| 目录常量 | `backend/src/shared/batch2-entry.ts`（共用形状 + 命名校验）、`report-permission-codes.ts`（11）、`hardware-permission-codes.ts`（14）、`miniapp-permission-codes.ts`（5）、`dashboard-permission-codes.ts`（8）、`batch2-permission-codes.ts`（汇总） |
| 断言 | `backend/src/__tests__/shared/batch2-permission-codes.test.ts`（新增）；`backend/src/__tests__/shared/migration-c6-4-1.test.ts`（`EXPECTED_MAX_MIGRATION` 206 → **207**） |
| 落地面 4 | `docs/evidence/S3-236/frontend-entry-registry.md`（38 码逐条前端入口登记，实测） |
| 清单 | `deploy/migrations-manifest.txt`（生成器重跑 ⇒ 207 进 A 活动段，186 → 187） |
| 证据装置 | `harness/gen-batch2-codes.mjs`（码表唯一真相源 → 目录 + 迁移）、`scan-frontend-entries.mjs`（前端调用点实测）、`gen-frontend-entry-registry.mjs`、`verify-three-way.mjs`（判据 1）、`apply-fixture.mjs`、`fixture-before-207.sql`、`neg-A/neg-B` 反测变体、`ts-resolve-hooks*.mjs`、`probe-db.mjs` |

---

## 四、raw/ 文件逐项说明

| 文件 | 证明什么 |
|:--|:--|
| `10-frontend-entry-scan.txt` | 38 码逐条前端调用点实测（38/38 有调用点） |
| `11-frontend-entry-scan-debug.txt` | 同上 + 命中源码行原文（供人工核对不是假命中） |
| `12-frontend-entry-hits.json` | 机读命中表（生成器据此写 `frontendEntry` 字段，避免手抄） |
| `20-gen-migrations-manifest.txt` | 生成器重跑：A 187 / C 8 / B 12 = 207 |
| `21-guard-migration-manifest.txt` | 门禁 PASS（含判据⑥最大编号 = 断言常量 207） |
| `30-db-create.txt` | 夹具库建成 + 版本读数（`11.4.5-MariaDB`，**非 MySQL 8.0.28**） |
| `31-fixture-before-207.txt` | 夹具前置读数（CATALOG 8 行 / 本批码 0 行 / 角色 2 行） |
| `32-207-pass1.txt` | **第一遍**：`38 码全租户命中 76 行；default 38`；重复 0；零角色授权 0 |
| `33-207-pass2.txt` | **第二遍**：`Records: 0 Duplicates: 0`、76 行未变 ⇒ 幂等成立 |
| `40-guard-rbac-wiring-strict.txt` | `--strict` EXIT=0（零业务路由改动） |
| `41-guard-utf8-encoding.txt` / `42-guard-evidence-secrets.txt` | 编码门禁 / 证据口令门禁均 EXIT=0 |
| `50-207-official-run-pass1.txt` / `51-…pass2.txt` | **官方通道**两遍 `迁移执行成功`、EXIT=0 |
| `52-207-pass3-verbose-nochange.txt` | 官方通道执行后再跑一遍的数据库侧读数：`Records: 0 Duplicates: 0` |
| `60-negA-no-notexists.txt` | **反测 A**（摘 `NOT EXISTS` 守卫）⇒ `ERROR 1062 Duplicate entry 'report:export-default'` ⇒ 守卫承重 |
| `61-negB-bad-parent.txt` | **反测 B**（父行条件改成不存在的 parent_code）⇒ `Records: 0`、库内 38 码 0 行 ⇒ **不插孤儿行** |
| `62-207-restored.txt` | 反测后复原：76 行恢复、重复 0 |
| `70-three-way-verify.txt` | **判据 1**：10 条判据全 PASS |
| `71-negC-drop-report-export.txt` | **判据 6 反测**：删 `report:export` ⇒ ③④⑤ 判红并点名该码 |
| `72-207-sha256.txt` | 迁移文件 SHA256（`ACEA61D1…`，反测前后恒定 ⇒ 逐字节一致） |
| `80-vitest-batch2-attempt2.txt` | vitest 起不来的原始报错（`esbuild … spawn EPERM`） |
| `81-tsc-noemit-说明.txt` | `tsc -p tsconfig.json --noEmit` **EXIT=0、0 字节输出**（全绿即无输出，故留命令 + 文字说明；同口径互证 `docs/evidence/S3-232/raw/41-tsc-noemit.txt`） |
| `82-build-all.txt` | 根 `npm run build` 的失败明细（各前端工作区缺依赖；后端 build 另见 §一.5） |

---

## 五、复跑顺序（任何人可自行核对）

```bash
# 1) 目录/迁移/断言产物重生成（顺序：先扫前端 → 再生成）
node docs/evidence/S3-236/harness/scan-frontend-entries.mjs
node docs/evidence/S3-236/harness/gen-batch2-codes.mjs
node docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs

# 2) 判据 1（三方一致，10 条）
node --experimental-strip-types --import ./docs/evidence/S3-236/harness/ts-resolve-hooks.mjs \
  docs/evidence/S3-236/harness/verify-three-way.mjs

# 3) 判据 6 反测（必红并点名）
node --experimental-strip-types --import ./docs/evidence/S3-236/harness/ts-resolve-hooks.mjs \
  docs/evidence/S3-236/harness/verify-three-way.mjs --inject-drop report:export

# 4) 清单生成与门禁
node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs
node backend/scripts/guard-migration-manifest.mjs
node backend/scripts/guard-rbac-wiring.mjs --strict

# 5) 真库两遍（需自备数据库；本包用 MariaDB 11.4.5，卡面要求 MySQL 8.0.28）
mysql --host=127.0.0.1 --port=3407 -uroot --default-character-set=utf8mb4 --database=liquor_inventory \
  < docs/evidence/S3-236/harness/fixture-before-207.sql
mysql --host=127.0.0.1 --port=3407 -uroot --verbose --verbose --database=liquor_inventory \
  < docs/migrations/207_四域权限点立码.sql      # 第一遍
mysql --host=127.0.0.1 --port=3407 -uroot --verbose --verbose --database=liquor_inventory \
  < docs/migrations/207_四域权限点立码.sql      # 第二遍：Records: 0 Duplicates: 0
node scripts/run-migration.mjs docs/migrations/207_四域权限点立码.sql   # 官方通道，EXIT=0
```

---

## 六、环境复原（本包交付时的实际状态）

- 夹具数据库实例已 **停药**（`mariadbd` 进程数 = 0）并**删除数据目录** `docs/evidence/S3-236/harness/mariadb-data/`（约 200MB，未入库）；
  需再跑时按 §五 重建：`mariadb-install-db.exe --datadir=<工作树内目录>` → `mariadbd --defaults-file=<datadir>/my.ini --port=3407 --skip-grant-tables --skip-ssl`。
- `.gitignore` **未改**（本单未追加任何忽略项）；`.env`（夹具连接串，**空口令**）命中既有 `.gitignore:6`，未入库；
  `node_modules/`、`backend/dist/`、`.npm-cache/` 均为工作区本地产物，未入库（提交前请只挑本单产物）。
- 未对生产做任何读写；未连生产。

---

## 七、卡外观察（只登记不动手，详见回传卡「待裁定项」）

1. **`report:export` 是两段式码**（清单 §2.1 明文"动作取 079 规范动作 `export`"），与"`模块:子域:动作` 三段式"规范并存；079 里也有两段式先例（`store:list` / `store:create` / `store:edit`）。
   ⇒ 断言口径 = "三段式，**或**两段式且动作在 079 既有动作白名单内"，并把本批唯一两段式码钉为 `report:export`。
2. **079 里没有 `miniapp` CATALOG 行**（`miniapp:*` 只作为模块码族出现在 079 第 92 行 CUSTOMER_SERVICE 的角色权限串里）
   ⇒ 小程序 5 码的父行挂到 `system` CATALOG，**不新建目录行**（新建目录 = 改菜单结构，越出"只立码"）。
3. **真库环境不一致**：本沙箱无 MySQL 8.0.28，用 MariaDB 11.4.5 替代（见 §二）⇒ 判据 2 未按卡面环境复现。
4. **vitest / 根 build 受沙箱与依赖安装限制未达成**（`spawn EPERM` + `npm install` 不完整），已用同判据装置替代并如实登记。
