# B-2b 证据包：明细类写入漏 `tenant_id` 的清扫 + 修复 + 回填 + 离线重复提交改幂等成功

> 派单：`docs/tasks/inbox/ACTIVE.md`（卡 `docs/tasks/cards/R101-派单-20260922-B.md` §B-2b）；裁定：`docs/tasks/cards/R101-B2-凌舟裁定.md`
> 来源：GitHub Issue #62｜执行：阿坚（后端 · 本地子代理代执行）｜2026-09-23
> 回执：`docs/tasks/inbox/ACTIVE-回执.md`｜回传卡：`docs/tasks/cards/R101-B2b-阿坚回传.md`

## 一、一键复跑（产出本包全部证据）

```powershell
pwsh -File docs/evidence/B-2b/probe/b2b-run.ps1
```

> **唯一入口（canonical）**：`pwsh -File docs/evidence/B-2b/probe/b2b-run.ps1`；harness ＝ `docs/evidence/B-2b/probe/tenant-id-fix/`（入口 `tenant-id-fix/register.mjs`）。
> `docs/evidence/B-2b/probe/` **根目录下**曾存在的同名 harness 副本（`register.mjs` / `hooks.mjs` / `db-adapter.mjs` / `schema-sqlite.mjs` / `stub-mock-db.mjs`）
> 已于 2026-09-23 按踩坑日志 [106] 清理，**现在不存在**——照本包任何注释复跑都只会命中 `tenant-id-fix/`。

等价的原生命令（逐条）：

```powershell
$env:JWT_SECRET='b2b-probe-secret'; $env:NODE_ENV='production'; $env:LOG_LEVEL='silent'

# ① 修复验证 + 幂等（15 条断言）
node --import ./docs/evidence/B-2b/probe/tenant-id-fix/register.mjs docs/evidence/B-2b/probe/b2b-01-fix-verify.mts

# ② 回填迁移只动应动的行 + 幂等（11 条断言）
node --import ./docs/evidence/B-2b/probe/tenant-id-fix/register.mjs docs/evidence/B-2b/probe/b2b-02-backfill.mts

# ③ 迁移语句不会被 runner 的"注释块丢弃"吃掉
node docs/evidence/B-2b/probe/b2b-03-migration-pipeline.mjs

# ④ 全仓影响面扫描
node docs/evidence/B-2b/probe/b2b-scan-tenant-id.mjs --json > docs/evidence/B-2b/b2b-output-tenant-id-scan.json
```

## 二、文件清单

| 文件 | 作用 |
|---|---|
| `影响面清单.md` | **交付物 1**：同族影响面全量清单（253 表 / 669 INSERT / 22 条真漏点）+ 数字 + 排除清单 + 自动注入路径 |
| `其他漏点处理建议.md` | 剩余 6 处漏点的"可直接照抄改法 / 待裁定信息"（1 处已按卡内 R3 补修；其余卡在口径而非授权） |
| `契约注释漂移-方案.md` | **交付物 5**：`billNo` 契约注释漂移的两方案 + 影响面 + 推荐意见（不动客户端/注释/实现） |
| `probe/b2b-01-fix-verify.mts` | **交付物 4+6 的反测**：修复后明细带租户（主干道 + 离线同步）、重复提交 `success=true` 且 `billNo` 一致、跨租户读隔离；含**修复前 INSERT 会落 `default`** 的反测 |
| `probe/b2b-02-backfill.mts` | **交付物 3 的反测**：回填 SQL 只动"应动的行"（含"父记录也是 `default`"的反例与"无父记录"反例，跑前/跑后逐行对比）+ 第二次执行影响 0 行 |
| `probe/b2b-03-migration-pipeline.mjs` | 复刻 `migration.ts` 第 8 步切块/过滤，自证 172 的语句在注释之前、会被执行且零 ALTER |
| `probe/b2b-scan-tenant-id.mjs` | 影响面扫描器（只读）：DDL 表集合 × INSERT 列清单 × 执行器（是否 `queryWithTenant` 自动注入） |
| `probe/tenant-id-fix/**` | **唯一 harness**（入口 `register.mjs` + `hooks.mjs` / `db-adapter.mjs` / `schema-sqlite.mjs`），由 S3-80-B2 的 harness 复制而来（S3-80-B2 原文件未改）；`probe/` 根目录下的同名副本已于 2026-09-23 清理，不再存在 |
| `b2b-output-*.txt` / `b2b-output-*.json` | 上列命令的**原始输出与结构化证据**（保留，不使用后删除） |

> ⚠️ **非 canonical，仅供参考（文件保留，不删）**：下列 4 个文件**不是本执行者产出**，属同一工作区**另一执行者**的独立扫描/门禁证据；
> 数字与结论一律以本节 canonical 复跑为准（见回执「风险与自我报备」）。
>
> | 文件 | 说明 |
> |---|---|
> | `probe/scan-tenant-writes.mjs` | 另一执行者的初版扫描器，口径较窄（未读 `docs/init_database.sql`），仅作交叉核对 |
> | `scan-tenant-writes.json` | 上者的结构化输出 |
> | `门禁复跑-另一执行者-20260923.txt` | 另一执行者的门禁复跑原始输出 |
> | `eslint-baseline-vs-worktree.txt` | 另一执行者的 eslint 基线与工作区对照 |

## 三、证据边界（必须随结论一起引用）

1. **引擎替换**：把 `backend/src/shared/db.ts` 换成 SQLite（`node:sqlite`）替身，业务代码一行不改。
   列默认值、UNIQUE 约束、事务 BEGIN/COMMIT/ROLLBACK、参数绑定语义同构；
   **锁粒度、隔离级别、DECIMAL 精度与 InnoDB 不同** ⇒ 本包不能替代"真库并发压测"结论。
2. **无真库**：本沙箱无 MySQL / docker / 网络 ⇒ 生产回填的"先备份 → 迁移链执行 → 跑后核对"仍须由凌舟在服务器执行
   （回填行数预期 = 真实租户那 1 张单的明细行数；`明细 tenant <> header tenant` 计数须归零）。
3. **`hooks.mjs` 与 S3-80 原版的一处差异**：判定改为"按解析后的 URL 是否等于 `backend/src/shared/db.ts`"，
   因为主干道链路存在相对简写 `import ... from "./db"`（`shared/trace-code.ts:5`）。替换目标仍只有那一个模块。
4. **探针脚本与 harness 均保留**（未用完即删）；S3-80-B2 目录下文件**未被修改**。

派单人：凌舟（总负责人）｜2026-09-23　　执行：阿坚（后端 · 本地子代理代执行）｜2026-09-23
