# S3-195…S3-210 回执提取表（收口总清单同步用）

> 任务：LZ-ledger-sync-20261015｜日期 2026-10-15｜工作树 `D:\Users\ZXQL\wt-agents\LZ-ledger-sync`｜分支 `docs/s3-ledger-sync-20261015`｜基线 `origin/main = af599165`
> 证据源：`docs/tasks/inbox/ACTIVE-回执-S3-<单号>.md`（本轮 15 份，实际读到 14 份，S3-195 见 §四.8）
> 联网复核：**本机 `gh` 与 `git ls-remote` 均不可达**（`gh pr list` → `proxyconnect tcp: 127.0.0.1:9`；`ls-remote` → `Failed to connect to github.com:443`）。原始 JSON 见 `raw/pr-list-merged.json`（`raw/pr-list-note.txt` 注明来源；该文件在我创建 `raw/` 后被预置于该目录，**非我生成**），其中 **14 条** PR↔`mergeCommit` 已与本地 `git log` 提交号逐条交叉核对**全部一致**（#311–#326）；**#327 本地无此提交、无法独立复核**。

## 表：一单一行（15 行）

| 单号 | PR 号 | 合并提交 | 结项项号 | 新登记项号 | 关键证据 ref | 未完成或阻塞 |
|:--|:--|:--|:--|:--|:--|:--|
| S3-195 | #313 | `089b8c3f` | 第 **51** 项 | 无（2 条范围外发现待编号，见 §三） | `docs/tasks/cards/R101-S3-195-凌舟裁定与验收.md`（3 files / 37 tests / 0 failed；G36 白名单 13 条、未登记重复前缀 0、真重复端点 0）＋`docs/evidence/S3-195/README.md`（`urls-before/after.json` 76 条 URL 逐字对照、`antitest-a1-红`/`a2-绿`、`antitest-b-摘掉租户过滤-红.log`、`tenant-isolation-green.json`、`vitest-full-1.log`、`tsc-after-final.log`、`build-after.log`） | 无技术阻塞。**回执缺失**：执行方 06:23 停手、未写回执（代码已提交 `22f84ce8`），凌舟接手补证据 + 独立复跑 + 写裁定；本表据裁定卡而非执行方回执 |
| S3-196 | #312 | `b2dbee66` | 第 **52**、**58** 项 | 无（4 条范围外发现待编号，见 §三） | 回执 §四：`docs/evidence/S3-196/`（`matrix-report.md` 49 写端点 × 4 腿、`client-harness.json` 真实客户端头、`reverse2-guard-red/restored.txt`、`probe-bind-tenant-output.txt`、`probe-notification-idor-output.txt`）；门禁 `gates-*.txt`（656 files / 7722 tests / 0 failed、tsc EXIT=0、build EXIT=0、G3 189 文件 EXIT=0） | 无阻塞。**未做（范围外）**：老端路径双段重复（第 31 项同族）、通知"标记已读"无用户维度（同租户 IDOR）、Taro 端响应契约不符 |
| S3-197 | #311 | `e9fd5c8e` | 第 **60** 项 | 无 | 回执 §三 + `docs/evidence/S3-197/README.md` §九：三态读数 pre/base/post（空库失败 **0**、与"语料意图基线"结构 sha `332b3f8f…` **相同**）、重复组 **71→15**、索引 **1622→1563**、反测 `reverse-tenant-index-names.mjs`（`1563+62=1625`、`1622+3=1625`）、vitest 654 files / 7718 tests / 0 failed | 无阻塞；**待裁定 2 处**：① 与 ② 的目标冲突取舍（093 保留 `idx_tenant_*` 原名）、既有库去重是否单开 DDL 并登记变更清单 |
| S3-198 | #316 | `790d076c` | 第 **43** 项（**仅批 1，整项未结项**） | 无（待补授权 / B 类 21 条 / `store:transfer` 细化 → 见 §三） | 回执 §九：`backend/scripts/rbac-wiring-baseline.json`（缺口 705→**680**、文件 161→156）、`guard-rbac-wiring --strict` EXIT=1→**EXIT=0**、`rbac-b2-s3-198-inventory-wiring.test.ts` 202 用例、vitest 655 files / 7920 tests / 0 failed、`docs/tasks/R101-RBAC接线缺口清单.md` §九 | 无阻塞；trace 域 9 条按生产角色核对**退回**（`trace:*` 门店角色 0 持有）待补授权另立单；**B 类 21 条**（app-mobile 写调用点）待统一口径 |
| S3-199 | #314 | `8ab0455b` | 第 **64**、**66** 项 | 无（4 条范围外发现 → 见 §三） | 回执 §三/§九：`docs/evidence/S3-199/raw/criterion-169.txt`（A 0 / B 1 / C 0 / D 1 / E 0）、`snapshots.txt`（结果态 sha256 **零差异**）、`antitest-66.txt`（FAIL 1 → 复原 7/7 PASS）、`gates.txt`（654 files / 7718 tests / 0 failed）；分支提交 `744df219` | 无阻塞。**未交"新迁移"**（定性 = 有意不设外键，主动选择）；生产侧读数未取（禁连生产）；169 修订待登记 `docs/数据库变更清单.md` |
| S3-200 | #315 | `5d8f46df` | 第 **61**、**62** 项 | 无（3 项待裁 → 见 §三） | 回执 §二/§五：`docs/evidence/S3-200/outputs/`（`04-after-root-build.log` EXIT=0、`10-anti-test-62-red.log`（`Missing script: "build"`×2）、`09-anti-test-61.log`（EXIT=1 点名 `alert.routes.ts:14`）、`08-vitest-full.log` 654 files / 7718 tests / 0 failed）；新增 `backend/scripts/guard-utf8-encoding.mjs`；还原来源 `ba7b2aa7` / `b33ffaaf` / `ab826ef0` | 无阻塞；**待裁 3 项**：`--if-present` 静默跳过边界、编码守卫是否接 CI、是否写 `docs/踩坑日志.md` |
| S3-202 | #317 | `425fa590` | 第 **24**、**25** 项 | 无 | 回执 §三/§五：`docs/evidence/S3-202/10-final-verify.log`（非 `docs/` 改动 0、可执行文件改动 0、+30/−0）、`02-literal-count.log`（8 组口令字面量计数不变）、`12-diff-full.patch`；提交 `ffc3394e` | 无阻塞；**待定夺 3 项**：`current-tasks.md` 未更新、`197_演示租户隔离.sql:92` B 类字面量是否挂指路、第 25 项历史留痕范围边界 |
| S3-203 | #319 | `66719a91` | 第 **27** 项 | 无（3 项 → 见 §三） | 回执 §二/§三：`docs/evidence/S3-203/outputs/10-migration-200-console.txt` 与 `11-migration-200-result.json`（16 项断言 true；两遍幂等 `affectedRows [1,1,2,1]→[0,0,0,0]`）、`s3-203-cross-domain-isolation.test.ts`（反测红 2/6 → 复原绿 9/9）、`20-reverse-red-isolation.txt`、vitest 663 files / 7972 tests / 0 failed | 无阻塞；**卡面 §七.2 后半（IP 维度限流）未实施**（与业主"登录不限流"既有口径冲突，回执 §六.1 待裁定）；生产未执行（迁移经部署通道执行）；e2e / 前端 build 未跑 |
| S3-204 | #318 | `64731ab5` | 跨线**未编号**项（需求 1 按维度销售序列 ＋ 需求 2 价格历史/走势） | 无（3 项 → 见 §三） | 回执 §二：`node docs/evidence/S3-204/harness.mjs` → `raw/harness-run.txt`（PASS 26 / FAIL 0 / EXIT=0）、`raw/18`–`raw/21`（与销售明细交叉核对 + 跨租户反例）、vitest 660 files / 7980 tests / 0 failed；契约落 `docs/API接口文档.md`；迁移 `200_价格日志来源列.sql` | 无技术阻塞；**跨线待办**：AI 仓 `update-product-price.tool.ts` 请求体加 `source:'ai'`（请凌舟转 AI 底座线）；`docs/数据库变更清单.md` 迁移 200 待登记 |
| S3-205 | #325 | `c813e07f` | 第 **23**、**26**、**68** 项 | 无（6 条范围外发现 + 4 条待裁 → 见 §三） | 回执 §二/§三：`docs/evidence/S3-205/logs/`（`00-baseline-rbac-strict.log`、`05-item68-strict-final.log` gaps 641 + consumerEnd 39、`06-item68-neg-{A,B,C}.log` 三条反测、`90-vitest.log` 663 files / 7995 tests / 0 failed、`91-tsc.log`、`92-guards.log`、`93-build.log`）、`04-full.diff`（63991 B） | 无阻塞。**未提交、未 push、未开 PR** ⇒ 产物 = 工作树未提交改动 ＋ 证据包（无远端 ref） |
| S3-206 | #322 | `2fe8f109` | 跨线 **P0**（`sales-ranking` 跨租户聚合越界 ＋ 同根因全仓扫描） | 无（3 项 → 见 §三） | 回执 §二：`docs/evidence/S3-206/raw/harness-run-prefix.txt`（product `1013/101805` = A+B）、`harness-run-fixed.txt`（PASS 10 / 0）、`harness-run-countertest-product.txt`（摘谓词即红）、`scan-tenant-shortcircuit.json`（789 文件 / 1747 调用点）；vitest 663 files / 7999 tests / 0 failed | 无技术阻塞；**同根因另 3 组真泄露未修**（finance 成本 / business-overview 库存金额 / batch-price 预览）等定范围与单号；**根因未根治**（注入器子串短路）→ 由 S3-207 承接 |
| S3-207 | #323 | `9dea3e39` | 跨线 **P0 续**（短路判据根治 ＋ 2 组真泄露修正 ＋ `guard-tenant-injection` 门禁 ＋ 12 处非字面量复核） | 无（3–4 项 → 见 §三） | 回执 §二：`docs/evidence/S3-207/raw/40-injector-probe.json`（改前 8 = A+B / 改后 6 = A）、`84-final-harness.txt`（profit `120886→20986`、inventoryValue `182096→172096`）、`70-guard-final.txt`（GREEN / EXIT=0）、`71-guard-reverse-test.txt`（4/4 PASS）、`50`/`52` 源码侧红/绿；vitest 664 files / 8035 tests / 0 failed | 无技术阻塞；CI 侧反测无 run（卡禁 push/PR）；**观察项未修**：6 处 `WARN-AUTO-INJECT-JOIN`、事务路径不经注入器、`t_product_price` 全局唯一键 |
| S3-208 | #326 | `af599165` | 第 **57** 项 | 无（3 项 → 见 §三；根治单 **S3-211 在办**） | 回执 §三：`docs/evidence/S3-208/pr297-annotations-raw.json`（23 条）、`outputs-F1-predicate-before.log`（14 命中）/`outputs-F1-predicate-after.log`（0）、`outputs-F1-antitest-static.log`、`outputs-F1-antitest-runtime.log`（1 failed / 14 passed → 复原 16 passed）、`outputs-gate-vitest-full-final.log`（665 files / 8021 tests / 0 failed）、`prepared/per-alert-dismissal.md` | **阻塞（机制不存在）**：12 条 `js/path-injection` 的"配置排除"未执行——CodeQL 无"查询＋路径"粒度；已备方案甲（逐条 dismissal 清单，**未执行**）＋方案乙（换 `path.resolve()`+`startsWith` 形态，需另派一单 = S3-211）；`lint` 未本地跑 |
| S3-209 | #324 | `450259be` | 跨线 **P1**（销售单取消端点，AI 底座 `cancelSalesOrder` 唯一阻塞项） | 无（2 项 → 见 §三） | 回执 §二：`node docs/evidence/S3-209/harness.mjs` → `raw/99-summary.json`（**25 PASS / 0 FAIL**）、`raw/40`–`raw/46`（正常 / 幂等 / PAID 400 / 原子性 / 403 / 租户隔离 404 / source）、`raw/20-migration-203.txt`（立码两遍幂等）、`raw/90-vitest-full.txt`（665 files / 8023 tests / 0 failed）；反测 A（1 failed / 11 passed）、反测 B（5 failed / 7 passed ＋ `--strict` EXIT=1） | 无技术阻塞（**未 push / 未开 PR**）；203 迁移未在生产执行（默认写闸门会静默跳过）；冲销流程 / AI 侧工具 / 前端按钮不在本单 |
| S3-210 | #327 | 任务书给 `c0f9cf39…`（见 `raw/pr-list-merged.json`）；**本地 ref 无此提交，未独立复核** | 跨线 **P0 收尾**（`guard-tenant-injection` 观察期结束恢复阻断 ＋ 40 项逐条台账） | 无（2 项 → 见 §三） | 回执 §二：`docs/evidence/S3-210/raw/06-ledger-40.txt`（40/40 无留空）、`01-guard-main-head.txt`（GREEN / EXIT=0）、`03-ci-3358a9e0-guard-section.txt`（CI 读数 21 BLOCK + 19 未登记）、`20-cross-tenant-probe.txt`（PASS 11 / 0）、`10-vitest.txt`（664 files / 8035 tests / 0 failed）；`.github/workflows/ci.yml` 去 `continue-on-error` | **口径冲突**：回执 §六.1/§七.7 明写"**未 push / 未开 PR**"（分支仅本地），与任务书"已合并 PR #327"不一致；本机无网 ⇒ 该 PR 的合并对象**未经独立复核** |

## §三 待凌舟编号（原样摘录，**未编号**）

- **S3-195**（来源 `docs/evidence/S3-195/README.md` §四"范围外发现"）：① `claimCoupon()` 的 INSERT 未写 NOT NULL 列 `source`（语料 `018_phase10_marketing.sql:54`）⇒ 真库即便租户匹配也回 400；② `claimCoupon()` 把 `valid_start/valid_end` 以 ISO-8601 写进 `DATETIME` ⇒ 严格模式 1292 ⇒ 500。
- **S3-196**（回执 §七.5）：① 老端路径双段重复 ⇒ 404（`/api/miniapp/cart/cart/*`、`/api/miniapp/aftersales/aftersales/*`）；② 通知"标记已读"无用户维度——会员 5 的令牌把会员 4 的通知（id=3）标记已读成功（200、库内 `is_read` 0→1）；③ 两个存量 500（`confirm-receive` 不存在的订单号、`cart/checkout/create` 空车，基线 + 商家 JWT 同样 500，与第 45 项同族）；④ Taro 端响应契约不符（后端 `code:"0"` 字符串 + `msg`，Taro 判 `code === 0` 数字 + `message`）。
- **S3-197**：无"新发现"待编号；§六列出 2 处待裁定（见上表）。
- **S3-198**（回执 §六/§九.3）：① 未接 **32 条**（B 类 21 / A 类 1 / N 类 1 之外的同域余量）；② trace 域 9 条退回、标"待补授权"另立单；③ `store:transfer` 用于 CSV 导入语义偏宽，记"待细化"（建议后续 `data:import` 类细码）。
- **S3-199**（回执 §六）：① `069_商品SPU增加品牌ID.sql` 第二遍恒红 1 条（`Duplicate foreign key constraint name 'fk_product_spu_brand'`）⇒ 建议并入第 60/65 项；② 第 60 项素材补充：同库第二遍多出 18 行索引（`120c` 先于补列迁移执行）；③ `016:163` / `034:15` 的 FK 声明已成"建了又删"死声明 ⇒ 建议并入第 65 项；④ `192:35` 表注释在全新库上不生效（未做 ALTER 对齐，仅登记）。
- **S3-200**（回执 §六）：① `--if-present` 的"静默跳过"边界是否收口；② 新增 `guard-utf8-encoding.mjs` 是否接进 CI；③ 是否把"65 处自 2026-07-13 躺了 3 个月"写进 `docs/踩坑日志.md`。
- **S3-202**（回执 §六）：① `docs/tasks/current-tasks.md` 未更新；② `197_演示租户隔离.sql:92` 的 `Demo@2026`（B 类"当前有效口径"）是否挂指路；③ 第 25 项历史任务记录类过时项目名是否逐条覆盖。
- **S3-203**（回执 §六/§七）：① 门店账号锁定策略（IP 维度为主）与业主"登录不限流"冲突，仅给 (a)/(b)/(c) 三选项 ⇒ 未实施，登记技术债；② `docs/**` 历史留痕仍留旧口令字面量 **35 个文件**（清单 `docs/evidence/S3-203/outputs/40-demo-password-residue-list.txt`）；③ `e2e` 未在本单内跑。
- **S3-204**（回执 §七.3）：① 既有 `GET /api/admin/reports/sales-ranking?dimension=product` 跨租户聚合（复现 `raw/21`；**已由 S3-206 承接**）；② 商品导入覆盖价不落历史（`data-transfer.service.ts:305-320` 的 `upsertSkuPrice`；建议另立卡）；③ 价格日志 `COST` 档位可见性（`priceResponseFilter` 只按字段名过滤）。
- **S3-205**（回执 §七）：① 硬编码弱默认口令 `"123456"`（`employee.service.ts:135`、`tenant-admin.service.ts:300`）；② `tenant-admin.service.ts:303` 用列名 `password` 而同表其它写入方用 `password_hash`（且该文件当前无路由注册）；③ 密钥族 `api_secret` / `sign_secret` 仍裸 bcrypt（建议另立 `shared/secret-hash.ts`）；④ `wechat.routes.ts` 5 条与 `cart.routes.ts` 声明式 consumer 未进新判据（仍在 `gaps`）；⑤ `docs/reports/P1-生产证据采集手册.md:17` 文档滞后；⑥ `[auto-routes][根前缀共享告警]` 4 个根前缀被多文件共用。
- **S3-206**（回执 §五/§六）：① 同根因另 3 组真泄露未修；② 根因（注入器子串短路）未根治，建议立项静态门禁 + 判据改造；③ **意外发现**：`t_product_price` 唯一键 `uk_product_price_sku_id (sku_id)` 全局唯一 ⇒ 多租户下同一 SKU 无法各自定价。
- **S3-207**（回执 §六/§七）：① 6 处 `AUTO-INJECT+JOIN` 观察项（建议注入时按 FROM 首表别名限定列名，另立单）；② 事务路径 `conn.query` 不经注入器；③ `t_product_price` 全局唯一键（同 S3-206）；④ 建议进踩坑日志的"子串判据当条件判据"条目（回执 §七.11 已给出全文）。
- **S3-208**（回执 §四/§六）：① 12 条 `js/path-injection` 的排除方式待裁定（方案甲逐条 dismissal / 方案乙换 `path.resolve()`+`startsWith` 形态，需另派一单）；② 全仓 `js/missing-rate-limiting` 仍 **126 条**（`141 − 15`，属 S3-112 系统性存量）；③ `npm --workspace backend run lint` 未本地跑（工作树只装 backend 侧依赖）。
- **S3-209**（回执 §七）：① `docs/ai-base/智享AI助手-写入操作规范.md` §5.2 要求 AI 先读单状态，但本仓 `GET /api/admin/sale-bills/:billNo` **不存在**；② `t_inventory_balance` 唯一键 `(store_id, sku_id, stock_type)` **不含 `tenant_id`** ⇒ 两租户无法各自持有同一 SKU 库存行。
- **S3-210**（回执 §七）：① 门禁仍留 36 条 `WARN-AUTO-INJECT-JOIN` + 4 条 `REVIEW-SINGLE-TABLE-INJECT`（按设计不阻断）；② 真库对照覆盖 11 条语句，未做到"每条语句一条 HTTP 端到端"。

> **本轮 15 份回执中，无任何一份"新登记"了带编号的项号**（编号型新增一律未出现）⇒ 本表条目总数仍为 68，未新增行。

## §四 与表内原状态冲突之处

1. **第 57 项**：表内原状态 ❌（"处置需决策"），任务书将其列为 S3-208 的结项项号 ⇒ 按任务书口径改 ✅，但**回执自报仍有 1 项未完成**（12 条 path-injection 的"配置排除"，阻塞＝机制不存在）⇒ 已在表内写明"**未"根治"**、根治另派 S3-211（在办）"，不写成已根治。
2. **第 64 项**：表内备注"需定性：漏配 or 有意为之"；S3-199 定性为 **(b) 有意为之**。另：回执 §六.3 指出 `016:163` / `034:15` 的 FK 声明已成"建了又删"死声明（建议并入第 65 项）——表内第 65 项未提，本表未新增行，仅在此记一笔。
3. **第 66 项**：表内备注写"（并入第 65 项做）"，而 S3-199 实际按"只做表旁注释留痕、不变更删除语义"落地（`017` +11 行纯注释）⇒ 与表内表述不一致，按回执为准。
4. **第 43 项**：表内 ❌ 与回执一致（批 1 未结项、缺口 680 仍在）⇒ 无冲突，仅在备注补批 1 进展，状态位保持 ❌。
5. **表内原总计数自身不自洽**：逐行清点 = 46 ✅ / 21 ❌ / 1 ⏸（合计 68）；而原表写"待完成 21"（漏了 1 个 ⏸ 或 1 个 ❌）⇒ 本次按逐行重算为 **总数 68 / 已完成 61 / 在办 0 / 待完成 7（含外部依赖 1）**。
6. **迁移编号**：S3-203 回执写"新增 `docs/migrations/200_账号口径统一.sql`"，S3-204 回执写"新增 `docs/migrations/200_价格日志来源列.sql`"（**同号并行**），而合并后 PR #319 标题写"迁移 201 只落哈希" ⇒ 200 号曾被两单同时占用，合入后取 201。本表不涉及迁移编号行，仅记录待核。
7. **S3-210 的 PR 号**：任务书 §2.1 记"已合并 PR #327"，而 S3-210 回执明写"未 push / 未开 PR"（分支仅本地）；本地 clone 亦无 #327 提交（`origin/main = af599165 = #326`），仅预置 JSON 记 `c0f9cf39…` ⇒ 该 PR 的合并对象**未经独立复核**（记为"对象不确定"）。
8. **S3-195 回执缺失**：全盘检索（`D:\Users\ZXQL` 递归）无 `ACTIVE-回执-S3-195.md`，只有凌舟验收卡 `docs/tasks/cards/R101-S3-195-凌舟裁定与验收.md` 与 `docs/evidence/S3-195/**` ⇒ 该单结项依据**不是执行方回执**，与"回执是唯一证据源"的口径有落差，已在上表注明。

## §五 我认为仍未结项的项号清单

- 保持"待完成"：**第 9、13、43、47、65、67 项**（❌）＋ **第 16 项**（⏸ 外部依赖：等业主给短信 / 邮件通道凭据）＝ **7 项**。
- 备注 1：**第 57 项**虽按任务书口径记为结项，其"根治"（12 条 `js/path-injection` 的消除）由 **S3-211** 承担，当前**在办**且**未编号入本表**。
- 备注 2：**第 43 项**批 1 后缺口仍 **680 条 / 156 文件**，B 类 21 条待统一口径，故整项仍列 ❌。
