# 回执 · S3-191（第 19/20 项：动态 `import()` 漏补扩展名 · 7 个「非法编码」文件复核）

> 汇报对象：凌舟（总负责人）｜汇报人：**阿坚（后端 / 构建脚本）**｜日期：**2026-10-14**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-191.md`（本工作树基线 `3922cc43` 未含该卡，已按原文归档为 `docs/tasks/inbox/archive/ACTIVE-S3-191-20261014.md`）
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-191-阿坚-回传.md`
> **本地提交（未 push、未开 PR）：`2e972962`**（代码 + 证据包）｜分支 `fix/s3-191-dynamic-import-esm`｜基线 `origin/main` = `3922cc43`
> 证据目录（可复跑，脚本与原始输出全部入库未删）：`docs/evidence/S3-191/`（脚本 4 个 + 原始输出 30 份，索引见其 `README.md`）

```
【汇报 S3-191】对应派单 S3-191：动态 import() 漏补扩展名已根治（pay/notify 由 500 → 真库 HTTP 200 实证）；7 个「非法编码」文件复核为不成立
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 构建脚本）｜2026-10-14
交付物：见下「二、交付物」
证据（可复跑）：见下「三、证据」
验收自评：见下「四、验收自评」
未完成与阻塞：见下「五、未完成与阻塞」
风险与自我报备：见下「六、风险与自我报备」
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-191-阿坚-回传.md
关联卡：docs/tasks/inbox/ACTIVE-S3-191.md（已归档）
```

## 一、一句话结论

第 19 项**成立且已根治**：`scripts/fix-esm-extensions.js` 原先只给静态 `from "..."` 补扩展名，产物里 19 处无扩展名动态相对 `import()` 直通运行期 ⇒ 已让脚本同时处理动态 `import()`（19 处全部补全），构建后产物无扩展名导入归 **0**；并把 `POST /api/miniapp/pay/notify` 从 `Cannot find module` 500 实测跑到 **HTTP 200**（真库 + 构造回调）。第 20 项**不成立**：7 个路由文件严格 UTF-8 解码全部通过、工具可读，无非法字节（`凌舟此前量过全 0` 得到独立确认）；附带回执 6 个文件残留 65 处 U+FFFD 的待裁定项。

## 二、交付物

| 类别 | 内容 |
|:--|:--|
| 代码（唯一业务侧改动） | `scripts/fix-esm-extensions.js`（+25 / −1）：新增动态 `import(` 双引号、单引号两条补全分支；日志增列动态处数 |
| 证据包（新增，未删脚手架） | `docs/evidence/S3-191/README.md`、`enum-imports.mjs`、`harness/resolve-and-load.mjs`、`harness/make-notify-payload.mjs`、`harness/encoding-check.mjs`、`logs/**`（30 份原始输出） |
| 回传 | 本文件 + `docs/tasks/cards/R101-S3-191-阿坚-回传.md` + 派单卡归档件 `docs/tasks/inbox/archive/ACTIVE-S3-191-20261014.md` |
| 提交 | `2e972962`（代码 + 证据）；文档回传另起一笔（见 `git log --oneline fix/s3-191-dynamic-import-esm`） |

**未改**：任何业务路由/控制器/服务、`tsconfig.json`、`.github/**`、`deploy/**`、`docs/migrations/**`、其它迁移与脚本。

## 三、证据（可复跑）

### 3.1 第 19 项 · 产物侧枚举（命令 + 原始输出）

命令：`node docs\evidence\S3-191\enum-imports.mjs backend\dist`

| 时点 | 静态缺扩展名 | 动态缺扩展名 | 原始输出 |
|:--|:--|:--|:--|
| 修复前（基线构建） | 0 | **19**（5 个文件） | `logs/../enum-before.txt` |
| 修复后 | 0 | **0** | `logs/../enum-after-final.txt` |
| 反测（脚本动态分支复原） | 0 | **19** | `logs/../enum-antitest.txt` |

修复前 19 处分布：`controllers/miniapp/miniapp.controller.js` 14、`services/wechat-pay.service.js` 2、`services/miniapp.service.js` 1、`services/miniapp/stored-card.service.js` 1、`services/miniapp/member.service.js` 1（逐条 文件:行:字面量见 `enum-before.txt`）。

构建日志（命令：`cd backend; npm run build`）：`已处理 798 个 JS 文件，修复 1869 处导入路径（其中动态 import() 19 处）`，`TSC_EXIT=0`。

### 3.2 第 19 项 · 解析 + 真实加载

命令：`node docs\evidence\S3-191\harness\resolve-and-load.mjs backend\dist`（`USE_MOCK_DB=true NODE_ENV=development`）⇒ `logs/resolve-and-load.txt`

- 产物内动态相对 `import()` 共 **21 处**（19 处新补 + 2 处原本已带 `.js`），逐条解析到真实文件：**缺失 0**；
- 去重后 **7 个目标模块**逐个真实 `import()`：**全部 LOAD OK**（miniapp.service / miniapp/stored-card / miniapp/wholesale / store/sale-bill / wechat-pay.service / shared/password / shared/wechat-pay）。
- 不误伤证据（`logs/no-false-positive.txt`）：`import("bcryptjs")`、`import("child_process")`、`import("fs")`、`import("miniprogram-ci")` 等包名/node 内置模块**保持原样**；`.js.js` 双扩展名命中 **0**。

### 3.3 第 19 项 · 运行期实证（真实产物 + 真库，`POST /api/miniapp/pay/notify`）

装置：本机私有 MariaDB 11.4.5（`127.0.0.1:3406`，`--skip-grant-tables`）一次性库 `s3191_rt`（跑产品迁移 → 311 张表）＋一条一次性支付配置；`node dist/server.js`（`USE_MOCK_DB=false`）。报文用 `harness/make-notify-payload.mjs` 以 `api_v3_key` 按 AES-256-GCM 构造（与 `decryptResource` 同构）。

| 侧 | 命令/报文 | 原始响应 | 文件 |
|:--|:--|:--|:--|
| 修复后（真库） | 同一条回调报文 | **HTTP 200** `{"code":"SUCCESS","message":"非成功交易，忽略"}` | `logs/runtime-real-db-fixed.txt` |
| 反测（脚本动态分支复原） | **同一条报文、同一库** | **HTTP 500** `{"code":"FAIL","message":"Cannot find module 'D:\\...\\backend\\dist\\services\\wechat-pay.service' imported from D:\\...\\backend\\dist\\controllers\\miniapp\\miniapp.controller.js"}` | `logs/runtime-real-db-antitest.txt` |
| 修复后（mock 模式两探针） | `{}` / 带 `resource` 的报文 | 500 `回调缺少 resource 密文` / 500 `无启用微信支付的租户配置，拒绝回调`（**均为业务错误，非模块错误**） | `logs/runtime-mock-fixed.txt` |

> mock 模式（`USE_MOCK_DB=true`）没有 `t_payment_config` 行，业务上必然拒绝回调，所以"不再是 500"这条以**真库 HTTP 200** 为准（同一报文在反测侧给出 500 Cannot find module，构成同一装置的 A/B 对照）。

### 3.4 第 19 项 · 源码侧同形写法清单

- 非测试源码（`backend/src/**`，不含 `__tests__`）无扩展名动态相对导入 **19 处**：`controllers/miniapp/miniapp.controller.ts` 14（L243/277/289/296/306/311/334/345/352/359/366/373/379/389）、`services/miniapp.service.ts` L457、`services/miniapp/stored-card.service.ts` L124、`services/miniapp/member.service.ts` L742、`services/wechat-pay.service.ts` L224/228（清单：`logs/src-dynamic-imports-nontest.txt`）。
- 另有 2 处源码动态相对导入**本就带 `.js`**（`controllers/share.controller.ts:25`、`controllers/admin/report.controller.ts:99`）——与产物侧 21 = 19 + 2 一致。
- `backend/src/__tests__/**` 内还有 **13 处**无扩展名动态相对导入，但 `backend/tsconfig.json` 的 `exclude` 已排除 `__tests__`（产物只落 `src` 非测试部分），**不影响运行期**，本单未动（清单：`logs/src-tests-dynamic-extensionless.txt`）。
- 源码侧**未做任何改动**：源码由 `tsx`/vitest 直接执行，Node 不需要扩展名；补全只发生在**编译产物**上（本单的修复点）。

### 3.5 第 20 项 · 7 个「非法编码」文件逐文件判定表

判据：① `TextDecoder('utf-8', {fatal:true})` 严格解码；② 解码后 U+FFFD 计数；③ `git ls-files --eol`。
命令：`node docs\evidence\S3-191\harness\encoding-check.mjs <7 个文件>`、`git ls-files --eol -- backend/src/routes/*.routes.ts`

| 文件 | 严格 UTF-8 解码 | 非法字节 | 残留 U+FFFD | 行尾（索引/工作区） | 判定 |
|:--|:--|:--|:--|:--|:--|
| `routes/payment.routes.ts` | OK | 0 | 0 | `i/lf w/crlf attr/` | **不成立** |
| `routes/alert.routes.ts` | OK | 0 | 12 | `i/lf w/crlf attr/` | **不成立**（残留 12 处 FFFD 另报） |
| `routes/customer-merge.routes.ts` | OK | 0 | 12 | `i/lf w/crlf attr/` | 同上 |
| `routes/export.routes.ts` | OK | 0 | 12 | `i/lf w/crlf attr/` | 同上 |
| `routes/miniapp-order-sync.routes.ts` | OK | 0 | 1 | `i/lf w/crlf attr/` | 同上 |
| `routes/stock-check.routes.ts` | OK | 0 | 16（L19 4 处 + L27 12 处） | `i/lf w/crlf attr/` | 同上 |
| `routes/sys-config.routes.ts` | OK | 0 | 12 | `i/lf w/crlf attr/` | 同上 |

汇总：严格解码失败 **0/7**（无非法编码、工具可读，`git`/`node`/`apply_patch` 通道均正常）；残留 U+FFFD 合计 **65 处**（6 个文件）。
全量影响面（技术债铁律②：给数字）：`backend/src/**` 全量扫描含 U+FFFD 的文件 **共 6 个，全部在这 7 个名单内**，无其它文件。
逐行码点证据：`logs/item20-fffd-lines.txt`（例：`alert.routes.ts:14 // ========== U+B7 U+FFFD×3 U+536 U+FFFD×8 ==========`；对照 S3-177 已归一的 `payment.routes.ts` 同位置文本为 `// ========== 路由自动发现配置 ==========`）。

### 3.6 门禁

| 门禁 | 命令 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| 全量单测 | `cd backend; npx vitest run` | **EXIT=0**，`Test Files 652 passed (652)`、`Tests 7694 passed (7694)` | `logs/gate-vitest.log` |
| 类型 | `cd backend; npx tsc -p tsconfig.json --noEmit` | **EXIT=0**（0 行输出） | `logs/gate-tsc.log` |
| 构建 | `cd backend; npm run build` | **EXIT=0** | 见 §3.1 构建日志 |
| guard-route-auth | `node backend/scripts/guard-route-auth.mjs` | **EXIT=0** | `logs/gate-guard-route-auth.log` |
| guard-tenant-status | `node backend/scripts/guard-tenant-status.mjs` | **EXIT=0** | `logs/gate-guard-tenant-status.log` |
| guard-route-prefix | `node backend/scripts/guard-route-prefix.mjs` | **EXIT=0** | `logs/gate-guard-route-prefix.log` |

## 四、验收自评（逐条对照派单 §三 验收判据 + §四 反测）

| 派单要求 | 自评 | 依据 |
|:--|:--|:--|
| §三.1 产物内无扩展名动态相对 import = 0（命令 + 输出） | **通过** | §3.1（`enum-before/after-final`） |
| §三.2 `POST /api/miniapp/pay/notify` 运行期不再 Cannot find module（原始响应体） | **通过** | §3.3（真库 HTTP 200；同报文反测侧为 Cannot find module 500） |
| §三.3 第 20 项逐文件判定表（成立/不成立 + 证据） | **通过** | §3.5（7/7 不成立 + 残留 FFFD 另报） |
| §三.4 门禁：vitest 0 failed / tsc EXIT=0 / build EXIT=0 / 三 guard EXIT=0 | **通过** | §3.6 |
| §四 反测：脚本动态分支复原 ⇒ 产物重现无扩展名动态 import，且 pay/notify 回到 500 / Cannot find module（红）；复原 ⇒ 绿 | **通过** | `enum-antitest.txt`（19 处）+ `runtime-real-db-antitest.txt`（500 Cannot find module）；复原后 sha256 与备份一致（`5D681EED…`），重建后 `enum-after-final.txt` = 0 |

## 五、未完成与阻塞

- **无阻塞**，第 19/20 项全部处置完毕。
- 非阻塞说明①：`npm run build` 时 Node 会打印 `Reparsing as ES module because module syntax was detected … add "type": "module" to package.json` 警告（仓根 `package.json` 无 `type` 字段）。属既有告警，**不在本单范围**，未动。
- 非阻塞说明②：`docs/memories/阿坚-记忆.md` 我**未更新**（该文件最后更新 2026-10-02，近两日 S3-18x/S3-19x 执行惯例均未随单更新）。如需随本单补更，请指示，我再补一笔。
- **归档口径说明（避免误读）**：本工作树基线 `3922cc43` **未包含** `ACTIVE-S3-191.md`（该卡位于你本地 main 的未推送提交里），故"把本卡移入 `docs/tasks/inbox/archive/`"在本工作树内的等价动作 = **新增归档件** `docs/tasks/inbox/archive/ACTIVE-S3-191-20261014.md`（原文逐字复制）。
  我**没有**在主仓工作树里删除 `docs/tasks/inbox/ACTIVE-S3-191.md`，也没有动 `inbox/ACTIVE.md` 路由表——理由：`ACTIVE.md` 当前同时挂着 190/191/192 三张在办卡，删卡会使路由表指向空文件，**改路由表属你的记账动作**（§8.3 步⑥）。如需我在主仓执行"删 inbox 卡 + 改路由表"，请明确指示。

## 六、风险与自我报备

1. **第 20 项判"不成立"但同时发现了别的**：6 个路由文件残留 U+FFFD **65 处**（历史编码事故的痕迹：非法字节曾被容错替换后写回，故现在"合法但内容残缺"）。我**没有修**——修它需要重建中文注释原文（属语义改写），超出本单允许的「编码归一」范围，且派单卡明确"不要为凑数去改"。**请裁定**是否另立单（修复口径建议：按 `payment.routes.ts` 的 `// ========== 路由自动发现配置 ==========` 同款文案归一，逐文件给改前/改后 sha256）。
2. **mock 模式侧 `pay/notify` 仍是 500**（业务错误：缺 resource 密文 / 无租户支付配置）。这是 mock 无配置行的必然结果，不是模块错误；"不再是 500"这条我另用**真库 + 真产物**跑出 200 作为硬证据。若凌舟认为 mock 侧也必须非 500，请以此真库证据为准或指示补 mock 夹具。
3. **反测期间动过脚本**：为做红侧，我临时移除动态分支 → 重建 → 取证 → 复原（备份 `logs/fix-esm-extensions.fixed.bak`，sha256 `5D681EED7C039F9074D04B7F468FA4FD6BFCBCBEC3095D9B1681825DA65DFF1A`，复原后与备份逐字节一致）。当前工作树 `backend/dist` 为**修复后**产物（`enum` = 0）。
4. **一次性夹具与库**：运行期验证用了本机私有 MariaDB 的一次性库 `s3191_rt` 与一行一次性配置（`tenant_id=S3191RT`、`api_v3_key=S3191RuntimeProofKey0123456789ab`），**生产库零写操作**；该库与配置保留未删（便于复跑），可随时 `DROP DATABASE s3191_rt`。
5. **未动的地方**：本单未改任何业务代码/迁移/CI/部署；`backend/tsconfig.json` 的 `exclude __tests__`（正=产物不含测试）也是既有事实，未借本单调整。
