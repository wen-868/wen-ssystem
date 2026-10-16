# S3-233 证据索引 · B 类收编第一批（把 S3-230 的入口门变成真接线）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-233.md`｜分支 `feat/s3-233-bclass-wiring-batch1`｜分支基底 `be781a10`
> 台账章节：`docs/tasks/R101-RBAC接线缺口清单.md` **§十九**｜机读台账：`backend/scripts/rbac-wiring-baseline.json`
> 分工：**接线与原始证据＝s3238**（未提交）；**收尾＝s3240**（修 3 处用例/断言缺陷 ＋ §十九 ＋ 本地提交 ＋ 回传）

## 一、一行读数

`26 道 gated 门 / 60 端点行 / 58 条唯一端点`（57 条本单接线 ＋ 1 条 S3-209 既有）。
**交付树（rebase 到 main 之后）实测**：缺口 **314 条 / 93 文件**、已接线 **398**、`guard-rbac-wiring --strict` **EXIT=0**、全量 **681 文件 / 9882 用例 / 0 failed**、`tsc` 0、`build` EXIT=0。
（本单在旧基底 `be781a10` 上的读数是 378 → 321 / 113 → 94、已接线 337 → 394；两个读数都留在档，守恒关系见台账 §19.1。）

⚠️ **基线差异（已由凌舟 rebase 收口，此节改为实测记录）**：
1. 路由表写的「gaps 371→321」中的 **371 是"含 #358 的 main"读数**；本分支基底 `be781a10` 早于 #358 ⇒ 本单在旧基底上是 **378 → 321**。
2. rebase 到 `origin/main`（`ca4b4151`，gaps **371** / 112 文件）后**实测**：缺口 **314 / 93**、已接线 **398**（守恒：371−57=314、341+57=398、113−20=93）。原始输出 `raw/63-s3240-main-vs-branch-baseline.txt`。
   （我在 rebase 前的**投影**估的是 91 文件，实测 93 —— 差 2 来自文件级并集，逐条见台账 §19.1 的文件数守恒式。）
3. 收尾轮已把用例里**唯一**会随基线漂移的裸数字断言（gaps 321 / files 94）按派单规范 **§9.2** 改为"和式 + 台账自洽"两条 ⇒ rebase 后**不需要**再改本单用例（另见台账 §19.8-4）。

## 二、四个真相源（本目录的表格都由它们复算，不手抄）

| 源 | 文件 | 读取方式（工具） |
|:--|:--|:--|
| 门 → 端点行 → 码 | `app-mobile/src/config/permission-gates.ts`（`ENTRY_GATES`） | `tools/s3240-gate-recon.mjs`（求值数组字面量） |
| 本单从 `gaps` 移除的 57 条 | `raw/30-wired-map.json`（`tools/s3238-wired-map.mjs` 生成） | 同上 |
| 落地码（用例与台账同一份表） | `backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts`（`WIRED_ROWS` / `REGISTERED_ROWS`） | 同上 |
| 生产在用持有者 | `docs/evidence/_shared/prod-roles-20261016.txt` §一 | `tools/s3240-prod-holders.mjs` |

## 三、复跑命令（全部只读，除 vitest/build）

```
# 1) 门级对账（输出 = 台账 §十九 表 A/B/C）
node docs/evidence/S3-233/tools/s3240-gate-recon.mjs

# 2) 20 个落地码 × 生产在用持有者（判据 §二.6 零回归论证）
node docs/evidence/S3-233/tools/s3240-prod-holders.mjs

# 3) 门禁（缺口台账）
cd backend && node scripts/guard-rbac-wiring.mjs --strict ; echo EXIT=$?

# 4) 跨层一致性断言（本单新增判据）
cd backend && npx vitest run src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts

# 5) 全量回归 / 类型 / 构建
cd backend && npx vitest run
cd backend && npx tsc -p tsconfig.json --noEmit
cd backend && npm run build
```

## 四、raw/ 索引

| 文件 | 内容 |
|:--|:--|
| `10-callers.txt` | app-mobile 写调用点扫描（B/M 类判据起点） |
| `20-gate-scope-after-wiring.txt` | **门注册表 × 后端注册形态逐条对照**（26 gated + 11 registered） |
| `30-wired-map.json` / `.txt` | 本单从 `gaps` 移除的 57 条（按文件分组） |
| `31-baseline-before.json` | 本单开工前的机读台账快照（378/113，337 wired） |
| `32/33-strict-before/after.txt` | `--strict` 前后读数 |
| `40/41/42-*` | 反测 A/B（摘 `category.routes.ts` 中段中间件）+ 复原 |
| `43/44/45-*` | 反测 C（摘 `store-sale-bill.routes.ts` 中间件）+ 复原 |
| `50-full-vitest.txt` | s3238 轮全量回归（**含 2 failed**：即收尾轮修的 2 处用例缺陷） |
| `51/52-s3240-*.txt` | **收尾轮**全量回归 **0 failed** / `npm run build` EXIT=0 |
| `53/56-s3240-*.txt` | 反测 D 注入前后 SHA256（逐字节还原） |
| `54/55-s3240-*.txt` | 反测 D：parity **2 failed** / `--strict` **EXIT=1**（点名 `purchase.routes.ts:16`） |
| `57/58-s3240-*.txt` | 反测 D 复原后：parity **120 passed** / `--strict` **EXIT=0** |
| `60-s3240-prod-holders.txt` | 20 码 × 生产持有者（**无持有者 0**） |
| `61-s3240-gate-recon.txt` | 门级对账三表（粘贴源） |
| `62-s3240-parity-after-title-fix.txt` | 修正"25→27"标题后 parity 120 passed |
| `63-s3240-main-vs-branch-baseline.txt` | **本分支基底 vs `origin/main` 台账差异与 rebase 投影** |
| `64-s3240-final-check.txt` | 收尾轮终态复核：parity 120 passed / `--strict` EXIT=0 / `tsc` 0 / evidence-secrets PASS |
| `65-s3240-ledger-selfcheck-rerun.txt` | 断言口径改"和式 + 自洽"后的复跑（含 394+321+45+3 == 763 复算） |
| `66-s3240-head-full-vitest.txt` | **交付树（HEAD）全量回归：679 文件 / 9830 用例 / 0 failed** |

## 五、tools/ 索引

| 文件 | 作用 |
|:--|:--|
| `s3238-callers.mjs` / `s3238-lock-scan.mjs` / `s3238-gate-scope.mjs` | 接线前的调用点/锁定扫描与门作用域生成 |
| `s3238-wired-map.mjs` / `update-baseline.mjs` | 生成移除名单 + 逐键更新机读台账（含前后计数与守恒断言） |
| `s3240-gate-recon.mjs` | **收尾轮**：门级对账（表 A/B/C），四源交叉 |
| `s3240-prod-holders.mjs` | **收尾轮**：落地码 × 生产在用持有者 |
