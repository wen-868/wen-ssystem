<!-- DSH-META
id: PLATFORM-ROLES-F1
owner: 阿坚
worktree: C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-PLATFORM-ROLES-F1
branch: dsh/PLATFORM-ROLES-F1
base: dsh/PLATFORM-ROLES
deliverable: 合入当前 main 后补授 platform_ops 的 tenant:manage，并在 MySQL 8.0.28 重验
evidence: docs/evidence/PLATFORM-ROLES-F1/**
return_card: docs/tasks/cards/R101-PLATFORM-ROLES-F1-阿坚回传.md
deadline_minutes: 75
-->

【派单 PLATFORM-ROLES-F1】补授平台运营的 tenant:manage 并在 8.0.28 重验
派单人：凌舟（总负责人）｜2026-10-22
执行方：阿坚（总台后端与数据）
优先级 / 时间盒：P0 · 75 分钟

## 回传格式（照抄填满）

```
【汇报 PLATFORM-ROLES-F1】PLATFORM-ROLES-F1 平台运营审批写域收口
汇报对象：凌舟（总负责人）
汇报人：阿坚（总台后端与数据 owner）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + MySQL 版本>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-PLATFORM-ROLES-F1-阿坚回传.md
关联卡：docs/tasks/inbox/PLATFORM-ROLES-F1.md
```

## 一、基线事实

- 原分支 `dsh/PLATFORM-ROLES` 尖端 `a527c3b9`，实际基线 `1ba1efd0`。
- 当前 main 已含 S3-238 `8e0c7d22`：`tenant:manage` 同时在 `platform-rbac.ts` 与 `PERMISSION_CATALOG`，目录已具备授权条件。
- 原 209 只给 `platform_ops/tenant` 的 `can_menu=1, can_page_btn=0`，未达“审批类”目标。

## 二、交付物

1. 从原分支新建 F1，合并当前 main；只允许冲突落在 manifest 自动生成文件，重跑生成器，不手取任一侧。
2. 修订 209：`platform_ops` 的 tenant 矩阵行在角色首次创建时写为 `can_menu=1, can_page_btn=1`；其余既有域不变。不得 UPDATE 覆盖既有矩阵行。
3. 仅在新/清洁夹具上验证，预期 OPS 8 行、写码域 **3**（review/ticket/tenant），READONLY 7 行、写码域 0。
4. 增加迁移结构断言或测试：209 必须同时含 `tenant:view` 可读与 tenant 域 `can_page_btn=1`，并明确依据当前 main 的 `tenant:manage` 常量。
5. 运行 `rbac-b2-s3-238-platform-wiring.test.ts`，证明真实中间件层 401/403/矩阵放行三态仍绿。
6. MySQL 版本必须 **8.0.28**。凌舟已补装并启动独立实例：`D:\Users\ZXQL\ZXQL-OPS\tools\mysql-8.0.28-winx64`、端口 `3310`、库 `liquor_inventory`、root 空口令。
7. 运行器不会读取进程环境：必须从 `D:\Users\ZXQL\dispatch\dsh\mysql8028-cwd` 启动 `node <worktree>\scripts\run-migration.mjs <绝对 SQL 路径>`，该目录 `.env` 已指向 3310。

## 三、硬验收

- 209 两遍 EXIT=0，第二遍零变更，核对行一致：OPS 写码域 3、READONLY 写码域 0。
- sentinel：把 OPS tenant 行改 `0/0` ⇒ 跑 209 仍 `0/0`；恢复 `1/1`。
- `guard-rbac --strict`、`guard-migration-manifest`、`tsc` 全 0。
- `migration-c6-4-1` 及平台 RBAC 三态测试全过。
- `backend/` 仅原卡允许文件；工作树 clean；未 push、未开 PR、逐文件 add。

## 四、红线

- 不得改业务代码/路由/中间件常量；本单只补迁移种子与测试/证据。
- 不得 UPDATE 覆盖角色后台已有矩阵；不得授 tenant 域以外的额外写码。
- 不得把 8.0.46 结果写成 8.0.28 通过。
