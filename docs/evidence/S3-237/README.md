# S3-237 · 接线批 10（系统设置/基础域 10 条 + 商品 A 类 7 条）· 证据索引

> 执行方：`/root/s3244_ajian`（阿坚 · 后端/权限）｜日期：2026-10-16｜派单卡：`docs/tasks/inbox/ACTIVE-S3-237.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-237`｜分支：`feat/s3-237-system-goods-wiring`｜基线：`origin/main` = `efc8d1be`
> 提交：组 1 = `3b60825b`｜组 2 = `212da88f`（**未 push、未开 PR**）
> 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §二十｜回传：`docs/tasks/cards/R101-S3-237-阿坚-回传.md`

## 一、读数一览（全部可复跑）

| 指标 | 本批前 | 本批后 |
|:--|--:|--:|
| 已接线（权限码） | 398 | **415** |
| 无授权形态（缺口） | 314 / 93 文件 | **297 / 89 文件** |
| 消费者端保护形态 | 45 | 45 |
| 查询型 POST（已登记） | 6 | 6 |
| 扫描写端点总数 | 763 | 763 |
| `guard-rbac-wiring --strict` | EXIT=0 | **EXIT=0**（未登记 0 / 陈旧 0） |
| 用例口径（`requirePermission(` 出现次数） | 369 | **386** |
| 回归 | — | 全量 vitest **683 文件 / 9998 用例 / 0 failed**；`tsc` 0；根 `npm run build` EXIT=0 |

## 二、raw/ 原始输出索引

| 文件 | 内容 |
|:--|:--|
| `raw/30-at1-before-hash.txt` / `raw/34-at1-restored-hash.txt` | 反测①注入前 / 复原后 `archive.routes.ts` 的 SHA256（应逐字节相同） |
| `raw/31-at1-report.txt` | 反测①报告模式：已接线 415→414、缺口 297→298 |
| `raw/32-at1-strict.txt` | 反测①`--strict`：**EXIT=1** 且点名 `archive.routes.ts:13 POST /api/admin/archive/execute` |
| `raw/33-at1-vitest-red.txt` | 反测①用例侧：`rbac-b2-s3-237-system-wiring.test.ts` **4 failed / 66 passed** |
| `raw/35-at1-strict-restored.txt` | 复原后 `--strict` **EXIT=0**、未登记 0 / 陈旧 0 |
| `raw/40-at2-before-hash.txt` / `raw/44-at2-restored-hash.txt` | 反测②注入前 / 复原后 `admin-product.routes.ts` 的 SHA256 |
| `raw/41-at2-report.txt` | 反测②报告模式：缺口 297→298 |
| `raw/42-at2-strict.txt` | 反测②`--strict`：**EXIT=1** 且点名 `admin-product.routes.ts:68 PUT /api/admin/products/skus/:skuId/barcode` |
| `raw/43-at2-vitest-red.txt` | 反测②用例侧：`rbac-b2-s3-237-goods-wiring.test.ts` **3 failed / 57 passed** |
| `raw/45-at2-strict-restored.txt` | 复原后 `--strict` **EXIT=0**、未登记 0 / 陈旧 0 |
| `raw/50-full-vitest.txt` | 全量后端用例：683 文件 / 9998 用例 / 0 failed |
| `raw/60-root-build.txt` | 根 `npm run build`（全 workspace）EXIT=0 |

> 复跑命令（在本工作树内，逐条与上表对应）：
> ```
> node backend/scripts/guard-rbac-wiring.mjs                 # 报告模式（读数一览）
> node backend/scripts/guard-rbac-wiring.mjs --strict        # 严格模式（EXIT=0 才算绿）
> npx vitest run src/__tests__/routes/rbac-b2-s3-237-system-wiring.test.ts   # 组 1（70 例）
> npx vitest run src/__tests__/routes/rbac-b2-s3-237-goods-wiring.test.ts    # 组 2（60 例）
> npx vitest run src/__tests__/routes/rbac                              # 17 文件 / 2343 例
> npm --workspace backend test                                          # 全量 683 / 9998
> npx tsc -p backend/tsconfig.json --noEmit ; npm run build
> ```

## 三、反测说明（照 `docs/tasks/派单规范.md` §9.1「先更新基线再注入」）

两次反测都在**提交后**注入，复原用 `git restore --source=HEAD -- <file>`（因此"复原"= 已提交版本，逐字节可比对；
SHA256 见上表两对文件）。**关键点**：若先注入而不先更新台账，摘掉的端点会落回"已登记的缺口"⇒ `--strict` 仍绿（假绿）；
本单的注入均在台账已移除本批条目之后进行，故能真红且点名到端点。

## 四、未纳入证据目录的内容（故意）

- 本机未跑生产、未做任何生产写操作（授权面取自共用底稿 `docs/evidence/_shared/prod-roles-20261016.txt` + 其 204 批注）；
- 未包含任何口令/密钥（`guard-evidence-secrets` 已复跑，见回传卡 §七）。
