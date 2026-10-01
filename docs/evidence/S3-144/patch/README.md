# S3-144 代码补丁包（backend 改动无法在沙箱内直接落盘，故以补丁交付）

> 生成人：阿坚（后端）｜2026-10-02
> 关联任务卡：`docs/evidence/S3-144/派单-S3-144-活动任务卡.md`
> 已落地并随本提交入库的部分：`docs/migrations/192_租户建租户与归因落点补列.sql`（迁移可直接生效）

## 一、为什么是补丁而不是直接改

本沙箱（`codex-windows-sandbox-service`）对工作区做了路径级写保护，实测：

| 路径 | 写入 |
|:--|:--|
| `backend/src/services/**`、`backend/src/controllers/**`、`backend/src/{config,routes,middleware,shared}/**` | ❌ Access denied |
| `docs/tasks/**` | ❌ Access denied |
| `backend/src/__tests__/**`、`docs/**`、`docs/migrations/**`、`tests/**`、`e2e/**` | ✅ 可写 |

证据：`docs/evidence/S3-144/evidence/sandbox-write-probe.txt`（`Set-Content` / .NET `File.WriteAllText` / `cmd` 三种方式均被拒）。
因此四份 backend 源码改动 + 三份测试改动只能作为补丁交付；补丁内容已在**打补丁后的 scratch 树上真跑过**
（`tsc --noEmit` EXIT=0 + 真实 MariaDB 端到端 15/15 通过），见 `docs/evidence/S3-144/evidence/`。

## 二、补丁内容（7 个文件）

| 文件 | 变更 |
|:--|:--|
| `backend/src/services/platform/platform-tenant-attribution.service.ts` | **新增**：租户归因唯一写入口（AGENT 优先 / 一租户一条 409 / `t_tenant.source` 只写既有三取值 / 可注入事务执行器） |
| `backend/src/services/tenant-register.service.ts` | 注册申请携带 `promo_code`/`agent_id`；审批通过按真实 `tenantId` 写归因与 `source`；修正 `contact_person`/`contact_mobile` 传参串位 |
| `backend/src/services/platform-tenant.service.ts` | **A 项**：`createTenant` 用 `randomUUID()` 生成主键、`makeBizNo("T")` 生成唯一编码、补齐 NOT NULL 列、status 改数值、返回真实 `tenantId` |
| `backend/src/services/platform-miniapp.service.ts` | **C 项定案**：在 `auditSubscriptionApply` 处写明"订阅审核不作为归因落点（无租户/无邀请码，严禁挂 default）" |
| `backend/src/__tests__/services/platform/platform-tenant-attribution.service.test.ts` | **新增**：归因写入口单测（目标解析 / 来源推导 / 409 / 404 / ER_DUP_ENTRY / 时间格式） |
| `backend/src/__tests__/services/platform-tenant.service.test.ts` | 补 `createTenant` 单测（真实 UUID、必填列、管理员账号） |
| `backend/src/__tests__/services/tenant-register.service.test.ts` | 补注册携带邀请码、审批写归因 409/400、联系人串位回归 |

## 三、应用方式（二选一）

```powershell
# 方式一：用补丁
cd D:\Users\ZXQL\wt-agents\issue-218
git apply docs/evidence/S3-144/patch/S3-144.diff

# 方式二：用完整文件覆盖（逐文件内容与补丁完全一致）
powershell -File docs/evidence/S3-144/patch/apply-S3-144.ps1 -Repo D:\Users\ZXQL\wt-agents\issue-218
```

应用后必须复跑门禁（沙箱内可跑 tsc / 不可跑 vitest、eslint，原因见回执"未完成与阻塞"）：

```powershell
cd backend
npx tsc -p tsconfig.json --noEmit      # 期望 EXIT=0
npx vitest run                         # 沙箱内不可跑（node 无法 spawn 子进程）
```

## 四、核心逻辑与既有内容的一致性

- `t_tenant.source` 三取值（`MANUAL` / `SELF_REGISTER` / `INVITATION`）与 016 列注释逐字一致，未新增取值。
- 归因优先级（代理商邀请优先）与 `R101-C6-3-凌舟裁定…` §5.2 第 2 条一致。
- 归因行只在 `approveTenantApplication`（申请审批通过、真正创建租户）写入；平台侧开租户固定 `MANUAL` 且不写归因。
