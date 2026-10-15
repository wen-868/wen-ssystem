# S3-207 工作台账（/root/s3211_ajian｜阿坚后端）

- 派单：`docs/tasks/inbox/ACTIVE-S3-207.md`（凌舟 2026-10-15，P0）
- 工作树：`D:\Users\ZXQL\wt-agents\S3-207`｜分支 `fix/s3-207-tenant-shortcircuit-rootfix`｜基线 `origin/main = 2fe8f109`
- 红线遵守：不 push、不开 PR、不写裁定；只动租户隔离相关代码/门禁/用例

## 时间线（每次写盘追加）

### 2026-10-15 起工

1. 已读：工作区 `AGENTS.md`、`docs/tasks/inbox/ACTIVE.md`（路由表，确认自己 = `/root/s3211_ajian` ⇒ S3-207）、
   派单卡、`docs/项目规则.md`、`docs/evidence/S3-206/README.md` + 回执 + 扫描器源码/机读结果。
2. 建工作树 `wt-agents/S3-207`（`origin/main = 2fe8f109`，已含 S3-206 的 `sales-ranking` 修复）；`npm ci` 进行中。
3. 本机 MySQL 8 在 `127.0.0.1:3408`（root/空口令，S3-206 装置同款），真库证据可行。

## 已确认的事实（静态，含行号）

| # | 事实 | 位置 |
|:--:|:--|:--|
| F1 | 短路判据 = `sql.toLowerCase().includes('tenant_id')`（四个注入函数各一份） | `backend/src/config/database.ts:216 / 253 / 273 / 304`(delete 复用 update) |
| F2 | 无 WHERE 且无限定列名时注入 `tenant_id = ?`（多表 JOIN 会 1052 歧义） | `database.ts:224 / 231 / 240 / 280 / 296` |
| F3 | S3-206 扫描：1747 调用点 / 617 含 `tenant_id` 字样；其中 `tok&!filt` = SELECT 5 + INSERT 161、`tok&filt&!pTen` = SELECT 28 + UPDATE 45 | `docs/evidence/S3-206/raw/scan-tenant-shortcircuit.json` |
| F4 | 卡面 ② 第 3 组（`batch-price` 预览）**疑似误报**：`previewBatchPriceAdjustment` 的 `conditions` 首项本来就是 `pp.tenant_id = ?`（`params` 首项 = tenantId），`WHERE ${where}` 插值后含真实租户谓词 | `backend/src/services/admin/batch-price.service.ts:150-151, 187, 194, 212` |
| F5 | 卡面 ② 第 1 组（`finance` 成本）两处 JOIN 用 `sb.tenant_id = sbi.tenant_id` / `pp.tenant_id = sbi.tenant_id` 列对列，WHERE 无租户谓词 ⇒ 真泄露 | `finance-report.service.ts:210-219, 264-273` |
| F6 | 卡面 ② 第 2 组（`business-overview` 库存金额）`ib JOIN pp ... AND pp.tenant_id = ib.tenant_id`，**整句无 WHERE** ⇒ 真泄露 | `sales-report.service.ts:508-514` |
| F7 | `report-aggregation.job.ts:7` 是**有意为之**的平台级查询（`SELECT DISTINCT tenant_id …`，且第 3 实参传 `""`）⇒ 收紧判据后必须显式声明"平台范围"，否则会被注入 `tenant_id = ''` 而返回空 | `backend/src/jobs/report-aggregation.job.ts:7` |
| F8 | CI 里 guard 是**显式 step**（`node backend/scripts/guard-*.mjs`），且跑在 `Build backend` **之前** ⇒ 新门禁必须免构建可跑 | `.github/workflows/ci.yml:90-96`（build 在 116-117） |

## 待办（对应卡面 §一 四件事）

- [x] ① 收紧短路判据（语句感知 + 值绑定谓词 + 两个显式标记）：`backend/src/shared/tenant-scope.ts`（判据/边界/反例见文件头）
- [x] ② finance ×2（L210/L264-273）＋ business-overview ×1（L508-514）显式谓词；batch-price 组用真库证据证明"**非泄露**"（见 §四）
- [x] ③ 静态门禁 `backend/scripts/guard-tenant-injection.mjs`（语料自检 + 登记表）+ 常驻用例 `__tests__/shared/tenant-scope.test.ts` + 双侧反测（`tools/reverse-test-guard.mjs` 4/4 PASS）
- [x] ④ 12 处非字面量逐条复核（结论见 §五），全部登记进门禁 INDIRECT_ALLOWLIST
- [ ] 门禁收口：vitest 全量（进行中）/ `tsc --noEmit` **0** ✅ / 五条 guard **EXIT=0** ✅ / backend build **EXIT=0** ✅（改后复跑）

### 收尾（2026-10-15 晚）

1. **门禁自查发现并修掉一个"假绿"**：切实参时没跳过模板字面量 ⇒ 多列 SELECT 的 SQL 被顶层逗号截断，`BLOCK` 被漏判为 0。
   修好后新暴露 **21 条**同家族位置（见 README §三点五、`raw/73-blocking-21-full.txt`）。
2. 按**真库 schema** 分类 21 条（`tools/analyze-blocking.mjs`）：**13 处 ≥2 张带 tenant_id 表 ⇒ 必须补显式谓词**（否则收紧后 1052/500）、
   4 处单表（登记，注入补正确谓词）、8 处平台级（改 `tenant-scope:platform` 标记）。
3. 登记表迁到数据文件 `backend/scripts/fixtures/tenant-injection-exemptions.json`（生成器 `tools/gen-exemptions.mjs`，含失效清理），
   门禁由"未登记/登记失效"两侧看守。
4. **最终门禁（冻结树）**：`vitest run` **664 文件 / 8035 用例 0 failed**（`raw/7E-vitest-final.txt`）、`tsc -p backend/tsconfig.json --noEmit` **0**
   （`raw/80-tsc.txt`）、六道 guard **全 EXIT=0**（`raw/81-*.txt`）、`backend build` **EXIT=0**（`raw/83-build.txt`）、
   真库装置 **20/20 PASS**（`raw/7D-harness-second-family.txt`）、门禁双侧反测 **4/4**（`raw/71-guard-reverse-test.txt`）。
5. 提交：`05a6368f`（根因）→ `c81e8711`（证据+CI）→ `3358a9e0`（**他人并发提交**，见 README §十）→ `92879647`（连带面）。

## 时间线（续）

### 判据设计（改后行为）

跳过注入（= 认为"已有绑定到调用者租户的条件"）的判据：

| 语句 | 判据 |
|:--|:--|
| SELECT | 出现值谓词 `tenant_id = ? / = '字面量' / = 数字 / IN (值)`（含子查询内）；**列对列等值不算** |
| UPDATE / DELETE | 同上，且必须在**顶层 WHERE 之后**（`SET tenant_id = ?` 不算过滤） |
| INSERT | 列清单显式写 `tenant_id`（含 `INSERT IGNORE`）/ `SET tenant_id = 值` / INSERT…SELECT 的 SELECT 段有谓词 |
| 任意 | 显式标记 `tenant-scope:self` / `tenant-scope:platform`（**必须登记**，否则门禁红） |

**严格收紧**：新跳过集合 ⊂ 旧跳过集合（旧 = SQL 文本出现 `tenant_id` 字样）。边界与残余风险写在
`backend/src/shared/tenant-scope.ts` 顶部 ①~④ 与门禁文件头 §边界。

### 真库对照（同夹具、同一次运行）

| 探针 | 改前（origin/main dist） | 改后（本单 dist） |
|:--|:--|:--|
| P1 `... WHERE sb.tenant_id = sb.tenant_id`（列对列） | 读到 **A+B = 8** 张单 | 注入生效 ⇒ **A = 6** 张单 |
| P2 finance 口径 JOIN（两表都有 tenant_id） | 静默读到 **120886**（A+B 成本） | 注入 ⇒ **ER_NON_UNIQ_ERROR 1052**（响亮失败） |
| P3 对照 `tenant_id = ?` | 6（不重复注入） | 6（不重复注入） |
| P4 `tenant-scope:platform` 标记 | 2 个租户 | 2 个租户（标记生效） |

| 端点 | 改前 | 改后 | 真值口径 |
|:--|:--|:--|:--|
| `/reports/profit` cost | 120886（= A 20986 + B 99900） | **20986**（仅 A） | A 单独 20986 |
| `/reports/business-overview` inventoryValue | 182096（= A 172096 + B 10000） | **172096**（仅 A） | A 单独 172096 |
| `POST /admin/prices/batch/preview` | A 令牌查 A 的 SKU=1、查 B 的 SKU=**0**、查 [A,A2,B]=1 | 同左（**本来就正确 ⇒ 非泄露**） | A 侧 1 |

### 反测（故意造失败）

- 源码侧：摘掉 finance 的 `sb.tenant_id = ?`（改成 `WHERE 1 = 1`）⇒ 门禁 **EXIT=1**（点名 finance-report.service.ts:210/268）+ 真库 `/reports/profit` **500**（1052）；
  `git checkout` 复原 ⇒ 门禁 **EXIT=0**、harness **17/17 PASS**。日志：`raw/50`、`raw/51`、`raw/52`、`raw/53`。
- 门禁侧（离线夹具，可复跑）：`tools/reverse-test-guard.mjs` ⇒ 4/4 PASS（合规绿 / 违规红并点名 / 未登记标记红 / 复原绿）。日志：`raw/71`。
