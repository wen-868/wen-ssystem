# S3-195 证据清单（门店路由根前缀统一治理）

> 单号：S3-195（收口总清单第 51 项）｜执行方：阿坚｜工作树：`wt-agents/S3-195`｜基线：`origin/main` @ `dd9acede`

## 一、结论（一屏）

1. 门店 9 个路由文件从**根前缀** `/api/store` 收窄为**自己拥有的路径段**：9 条注册 → **31 条注册**。
2. **对外 URL 逐字不变**：76 条端点在收窄前后**完全一致**（不增、不减、不重复）—— `urls-before.json` vs `urls-after.json`。
3. `POST /api/store/no-such-path`：**401 → 404**（收窄前被根前缀的前缀级认证拦下）—— 整机挂载用例 + 逐文件探针双重取证。
4. 新增「**根前缀被多文件共享**」告警（只出声、不判红），启动期与门禁脚本同调一份判据。

## 二、证据文件（逐个可复跑）

| 文件 | 内容 | 复跑方式 |
|:--|:--|:--|
| `prefix-before.json` / `prefix-after.json` | 门禁 G36 静态扫描报告（收窄前 / 后） | `cd backend && node scripts/guard-route-prefix.mjs --json` |
| `urls-before.json` / `urls-after.json` | 9 个文件的对外 URL 清单（收窄前 / 后，逐字对照 76 条） | `npx vitest run docs/evidence/S3-195/harness/dump-endpoints.test.ts`（在 `S3-195-base` 与 `S3-195` 各跑一次，输出路径见文件头） |
| `probe-before.json` / `probe-after.json` | **逐文件**四条探针（不存在的子路径 / 兄弟文件公开注册端点 / 兄弟文件公开回调端点 / 本文件自有端点） | 同上，见 `harness/per-file-probe.test.ts` |
| `antitest-a1-红-改回根前缀.log` / `antitest-a2-绿-复原.log` | **反测 A**：把 `store-trace.routes.ts` 改回根前缀 ⇒ `POST /api/store/no-such-path` 回到 **401**（用例红）；复原 ⇒ **404**（绿） | `npx vitest run src/__tests__/routes/store-prefix-narrowing-s3-195.test.ts -t "不存在的子路径"` |
| `antitest-b-*.log`、`antitest-b-*.txt` | **反测 B**：跨租户真库夹具（拿 A 的凭证打 B 的 templateId）+ 摘掉服务层租户过滤 ⇒ 变红 | 见 `harness/s3-195-*`（MariaDB 127.0.0.1:3406） |
| `before-guard-*.log` / `after-guard-*.log` | 四道门禁收窄前/后原始输出（含 `guard-rbac-wiring --strict`） | `cd backend && node scripts/guard-<name>.mjs` |
| `vitest-targeted-*.log` / `vitest-full-1.log` | 定点用例与全量用例原始输出 | `cd backend && npx vitest run [文件...]` |
| `tsc-after-final.log` / `build-after.log` | 类型检查与后端构建原始输出（均 EXIT=0） | `cd backend && npx tsc --noEmit`；仓库根 `npm --workspace backend run build` |

## 三、harness/（复跑脚本）

- `dump-endpoints.test.ts`：导出 9 个文件的 `prefix + router 内路径` URL 清单（用 `import * as` + `routeConfigs ?? routeConfig`，故收窄前/后两棵树都能跑）。
- `per-file-probe.test.ts`：每个文件单独成应用（照生产挂 `getAuthMiddlewares(cfg.auth)`），跑四条探针并落 JSON。
- `sql/`：跨租户真库夹具的建库/造数 SQL。

> ⚠️ 全部探针数据都是**本机私有库里构造的探针数据**（库名带 `s3195_` 前缀），不是生产读数、不是产品数据。生产库零写操作。

## 四、跨租户真库夹具（卡面 §二.4）

- 库：MariaDB 11.4.5 `127.0.0.1:3406` 的 **`s3195_full`**（结构由**产品自己的迁移管线**建出：`harness/run-migrations.mjs`，日志 `migrations-run.log`）。
- 夹具：`harness/sql/01-fixture.sql`（租户 A/B + B 的券模板 9001 / 秒杀 9101 / 拼团 9201 + A 自己的券模板 9002 作阳性对照）。
- 探针：`harness/probe-tenant-isolation.mjs`（A 的 JWT + `x-csrf-token`，与生产 `requireAuth` / `csrfMiddleware` 同口径）。
- 结果（`tenant-isolation-green.{log,json}`）：**跨租户三条写端点全部 404**（券/秒杀/拼团），且 **B 的券 `issued_quantity=0`、秒杀 `sold_count=0`、团 `current_size=1` 与执行前逐字相同**；阳性对照（A 领自己的券 9002）**200** 并真落库 1 行。
- 反测 B（`antitest-b-摘掉租户过滤-红.log` + `antitest-b-red.json`）：把编译产物里服务层的 `AND tenant_id = ?` 摘掉 ⇒ 同一请求 **200「成功」**，且 A 名下出现 **`template_id=9001`（B 的模板）的券** ⇒ 用例变红；逐字节复原（`antitest-b-backup-marketing-coupon.service.js`，sha256 前后一致）⇒ 回到 404/绿。

### 范围外发现（真库夹具暴露，本单未改业务代码，登记待另立单）

1. **`claimCoupon()` 的 INSERT 未写 NOT NULL 列 `source`**（语料 `018_phase10_marketing.sql:54` 定义为 `VARCHAR(32) NOT NULL` 且无默认值）⇒ 真库上即便租户匹配也回 **400「缺少必填参数：source」**（error-handler 对 MySQL 1364 的映射）。
2. **`claimCoupon()` 把 `valid_start/valid_end` 以 ISO-8601（带 `T`/`Z`）字符串写进 `DATETIME` 列** ⇒ 严格模式下 **1292 ER_TRUNCATED_WRONG_VALUE** ⇒ 同租户领券也回 500。

> 两条都只影响「领券**写**路径」，与租户隔离无关（隔离判据在事务内的第一条 `SELECT … FOR UPDATE` 上，见 `antitest-b` 的两侧对照）。为了让隔离判据在写入路径上可观测，探针库对该表做了两处**夹具侧**放宽（见 `sql/01-fixture.sql` 注释⑥⑦），**产品代码与语料一行未改**。
