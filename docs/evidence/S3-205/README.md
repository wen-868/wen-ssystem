# S3-205 证据包（脚本与门禁小单打包：第 23 ＋ 26 ＋ 68 项）

- 状态：**已完成**（本文件为交付快照，2026-10-15）
- 执行方：阿坚（`/root/s3210_ajian`，本地并行通道）
- 工作区：`D:\Users\ZXQL\wt-agents\S3-205`（分支 `chore/s3-205-script-hygiene`）
- 基线：`origin/main` = `36a7a02fc2ddbceb2f13ba66c7295528174fed67`（开工时工作区与该基线一致、无未提交改动）

> ⚠️ 我不是凌舟：不写裁定/验收结论，只做执行与取证；不 push、不开 PR、不提交。

## 一、开工时的卡面前提核对（先核前提，再动手）

卡 §三 写「当前 `--strict` EXIT=1，3 条缺口在 `marketing-miniapp.routes.ts:55/72/80`」。
**实测与卡面不一致**，故先把事实钉下来（原始输出见 `logs/00-baseline-rbac-strict.log`）：

| 项 | 卡面 | 实测（基线 `36a7a02f`） |
|:--|:--|:--|
| `guard-rbac-wiring --strict` | EXIT=1 | **EXIT=0**（`已登记缺口 680 条 ／ 未登记缺口 0 条`） |
| 3 条缺口位置 | `marketing-miniapp.routes.ts:55/72/80` | 端点实际注册行 = **61 / 78 / 86**（另有同族 `POST /calculate` 在 90） |
| 缺口是否已登记 | 未登记 | **已在 `rbac-wiring-baseline.json` 登记**（新路径形态，由 PR #316 / 提交 `790d076c`（S3-198）登记） |

**结论（本单要解决的真问题）**：这 4 条端点当时被台账记为「**欠账待接线**」，而凌舟已裁定它们是
**消费者端合规形态**（`requireConsumerAuthWithTenant` + `csrfMiddleware`，不适用商家 RBAC）。
故本单的「真收口」= 让门禁把**消费者端保护形态**识别为合规（从而这几条**不再是缺口**），
而不是靠「台账里再多登记 4 条」把红点盖住。**判定按端点路径匹配，不按行号**（行号已漂移）。

## 二、三项各自的证据

| 项 | 结论 | 证据 |
|:--|:--|:--|
| **第 23 项** 验收脚本去默认生产凭据 | ✅ 13＋4 处默认凭据/地址全部改 env 注入，缺项即 `exit 1`；两侧反测齐 | `01-item23-默认值枚举.md`；`logs/02-item23-*.log`（4 份） |
| **第 26 项** `bcrypt` 直调扩围扫描 + 逐条判定 | ✅ 全仓扫描：产品代码**口令写入 11 处**全部统一走封装；**校验侧产品代码 0 处直调**；密钥族/测试夹具逐条注明理由不改 | `03-item26-bcrypt扫描与判定.md`；`logs/03-item26-targeted-run1.log`（隐患现场复现）、`…run2.log`（修后全绿） |
| **第 68 项** 消费者端豁免 + 门禁识别 + `--strict` EXIT=0 | ✅ 门禁新增第三类「消费者端保护形态」（须认证＋CSRF 成对、须逐条登记）；39 条从 `gaps` 移入 `consumerEnd`，守恒 `680 = 641 + 39`；三条反测齐 | `docs/tasks/R101-RBAC接线缺口清单.md` §十；`logs/00-baseline-rbac-strict.log`、`logs/05-item68-*.log`、`logs/06-item68-neg-*.log`（3 份） |

## 三、门禁全量复跑（原始输出，全部 EXIT=0）

| 门禁 / 检查 | 结果 | 证据文件 |
|:--|:--|:--|
| `npx vitest run`（全量） | **Test Files 663 passed ／ Tests 7995 passed ／ 0 failed**；`VITEST_EXIT=0` | `logs/90-vitest.log` |
| `npx tsc -p tsconfig.json --noEmit` | **TSC_EXIT=0** | `logs/91-tsc.log` |
| `guard-route-auth` | **EXIT=0**（✅ G3 通过：无绕过声明式鉴权/CSRF 的路由文件） | `logs/92-guards.log` |
| `guard-tenant-status` | **EXIT=0**（✅ G2 通过：租户状态域只有 ACTIVE / DISABLED 一套口径） | `logs/92-guards.log` |
| `guard-rbac-wiring`（报告模式） | **EXIT=0**（已接线 82 ／ 消费者端 39 ／ 无授权形态 641） | `logs/92-guards.log` |
| `guard-rbac-wiring --strict` | **EXIT=0**（`gaps` 641 全部已登记、`consumerEnd` 39 全部已登记、陈旧 0） | `logs/92-guards.log`、`logs/05-item68-strict-final.log` |
| `npm --workspace backend run build` | **BUILD_EXIT=0**（`已处理 801 个 JS 文件，修复 1897 处导入路径`） | `logs/93-build.log` |

**终态复跑（文档改动之后的"最终树状态"，防"读数早于产物"）**：
`logs/90-vitest-final-tree.log`（663 / 7995 / 0 failed，`VITEST_EXIT=0`）、
`logs/92-guards-final-tree.log`（TSC_EXIT=0 ＋ 三条 guard EXIT=0 ＋ `--strict` EXIT=0）、
`logs/93-build-final-tree.log`（BUILD_EXIT=0）——与首轮读数**一致**。

**沙箱边界（本会话实测）**：`spawnSync` 与管道在此会话**可用**（与 `docs/memories/阿坚-记忆.md`
§二十九/§三十记录的旧会话不同），故全量 vitest / tsc / 构建都是**真跑**，未走替代通道。

## 四、改动面（`git diff --stat`，16 文件 / +505 −137；均在工作树、未提交）

| 组 | 文件 |
|:--|:--|
| 第 23 项 | `scripts/acceptance-all-domains.mjs`、`scripts/acceptance-production.mjs` |
| 第 26 项 | `backend/src/services/admin/{sys-user,employee}.service.ts`、`backend/src/services/platform-tenant.service.ts`、`backend/src/services/platform/{admin-account,tenant-admin}.service.ts`、`backend/src/shared/migration.ts` ＋ 3 个测试文件 |
| 第 68 项 | `backend/scripts/guard-rbac-wiring.mjs`、`backend/scripts/rbac-wiring-baseline.json`、`docs/tasks/R101-RBAC接线缺口清单.md` |
| 交接/留痕 | `docs/踩坑日志.md`（新增 [171] 中间件调用/引用、[172] 沙箱能力须复验）、`docs/memories/阿坚-记忆.md`（新增 §三十二） |
| 证据包 | `docs/evidence/S3-205/**`（本 README ＋ 2 篇枚举/判定 ＋ 全部原始日志） |

`logs/_backup-*` 是反测 A/B/C 的**逐字节备份**（用于证明注入后能原样还原），不是产物。
