# ACTIVE 回执 · R101-C4-1c（`orphan-scan` 生产 500 + collation 家族级收口）

```text
【汇报 C4-1c】orphan-scan 500 根因＝`LEFT JOIN t_tenant t ON t.id = f.tenant_id` 两侧 collation 不同
（t_upload_file.tenant_id=utf8mb4_unicode_ci vs t_tenant.id=utf8mb4_0900_ai_ci，DDL 原文锁定）；
已按 C5-1b 同法在非索引侧加显式 COLLATE utf8mb4_0900_ai_ci 修复 + 补回归锁 + 反测（RED=1）；
家族级收口：JOIN t_tenant 18 处逐条判定 ⇒ 已修 2 / 无需改 16 / 仍有风险 0；全量 210 处列↔列 tenant 比较中
仅 2 处涉及未统一 collation 的表，均已修。typecheck/build/lint/真执行断言全绿；vitest 沙箱 EPERM 不可跑、
生产端点与真库无可用凭据 ⇒ 两项如实报备并交付可复跑取证命令。
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 · 本地子代理）｜2026-09-25
```

## 一、改了什么（文件级）

| 文件 | 改动 | 行号（改后） |
|---|---|---|
| `backend/src/services/platform/platform-monitor-ops.service.ts` | ① `scanOrphanFiles` 的 JOIN 谓词加显式 `COLLATE utf8mb4_0900_ai_ci`（**只加在非索引侧 `f.tenant_id`**）；② 新增注释块记录两侧 DDL 依据与选侧理由 | 注释块 **L625-641**、谓词 **L643**（改前 L623）；筛选侧 `f.tenant_id = ?` **未动**（L614） |
| `backend/src/__tests__/routes/platform-monitor-ops.test.ts` | ① 原 L611 断言收紧为含 `COLLATE utf8mb4_0900_ai_ci` 的精确串 + 新增「整条 SQL `COLLATE` 恰好 1 处」；② 新增「筛选侧 `f.tenant_id = ?` 不得带 COLLATE」 | **L611-617**、**L630-632** |
| 回传卡 / 本回执 / 进度行 / inbox 归档 | 文档（无业务代码） | `docs/tasks/cards/R101-C4-1c-阿坚回传.md`、《总进度》§三十二、`docs/tasks/inbox/archive/ACTIVE-C4-1c-20260925.md` |

**未动**：`docs/migrations/**`、`docs/API接口文档.md`、`docs/数据库变更清单.md`、`backend/src/shared/migration.ts`、`saas-admin/**`、`ai-platform.service.ts`，以及其余 16 处 `JOIN t_tenant`（只审计不改）；**零 DDL**；**未** commit/push（红线）。

## 二、证据（可复跑）

| 项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `cd backend; npm run typecheck` | exit 0（无输出） |
| 构建 | `cd backend; npm run build` | exit 0（753 文件 / 1678 处导入路径） |
| lint（改动文件） | `cd backend; npx eslint src/services/platform/platform-monitor-ops.service.ts src/__tests__/routes/platform-monitor-ops.test.ts` | exit 0 |
| 单测文件 tsc | `npx tsc --noEmit --strict … src/__tests__/routes/platform-monitor-ops.test.ts` | exit 0 |
| **真执行断言**（dist + 内存桩 db，抓生成 SQL） | 见回传卡 §2.4(6) | **8/8 PASS**；main SQL 原文含 `LEFT JOIN t_tenant t ON t.id = f.tenant_id COLLATE utf8mb4_0900_ai_ci` |
| **反测（该红就红）** | 回退谓词里的 COLLATE 后重跑同一套断言（回传卡 §2.4(7)） | **RED 项数 = 1**（门禁确实会红） |
| 家族收口 | `rg -n "JOIN\s+t_tenant" backend/src --glob "!*.spec.ts"` | 18 处逐条判定 ⇒ **已修 2 / 无需改 16 / 仍有风险 0**；全量 210 处列↔列 tenant 比较中仅 2 处涉及 unicode_ci 表、均已修 |
| vitest | `cd backend; npx vitest run src/__tests__/routes/platform-monitor-ops.test.ts` | **跑不了**：`failed to load config … Error: spawn EPERM`（沙箱禁止子进程 ⇒ esbuild 不可用），如实报备，请凌舟本机复跑全量 |

## 三、阻塞点

1. 沙箱内 **vitest 不可跑**（`spawn EPERM`）⇒ 全量门禁（578 文件 / 6398 用例）需凌舟本机复跑。
2. **生产端点 200 与真库 1267/EXPLAIN 未执行**：沙箱内 8080 可达，但平台登录默认凭据被拒（401 `用户名或密码错误`）、运行实例 `backend/.env` 的库凭据连接被 `ER_ACCESS_DENIED_ERROR` 拒绝（未回显任何密钥、无写操作）⇒ 交付可复跑命令块（回传卡 §四.①②）由凌舟在真机执行；**未伪造任何真库/生产输出**。
3. 16 处「无需改」属**按 DDL 判定**（推论：DDL 未写 COLLATE ⇒ 继承库默认 0900，已由 t_tenant.id 生产实测反证）⇒ 需 §四.②⑤ 探针在真库坐实（预期仅 2 行 RISK）。

> 完整内容（含 18 处逐条表、验收自评 5 条、风险自报 7 条）见 `docs/tasks/cards/R101-C4-1c-阿坚回传.md`。

派单人：凌舟（总负责人）｜2026-09-25 ｜ 汇报人：阿坚（后端）｜2026-09-25
