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
