<!-- DSH-META
id: S3-249-F1
owner: 阿坚
worktree: C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-S3-249-F1
branch: dsh/S3-249-F1-transfer-family-closeout
base: dsh/S3-249-transfer-code-family
deliverable: v2 审批统一 transfer:approve，并在 MySQL 8.0.28 重验 13 条调拨写端点
evidence: docs/evidence/S3-249-F1/**
return_card: docs/tasks/cards/R101-S3-249-F1-阿坚回传.md
deadline_minutes: 75
-->

【派单 S3-249-F1】调拨 v2 审批归入 transfer:approve 并完成精确版本复验
派单人：凌舟（总负责人）｜2026-10-22
执行方：阿坚（总台后端与数据）
优先级 / 时间盒：P0 · 75 分钟

## 回传格式（照抄填满）

```
【汇报 S3-249-F1】S3-249-F1 调拨码族完全收口
汇报对象：凌舟（总负责人）
汇报人：阿坚（总台后端与数据 owner）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + MySQL 版本>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-249-F1-阿坚回传.md
关联卡：docs/tasks/inbox/S3-249-F1-transfer-family-closeout.md
```

## 一、裁定与依据

- `transfer-order.routes.ts` 的 approve/reject 现留 `inventory:approve`，不再接受为最终态。
- 210 后 `STORE_MANAGER` 持 `transfer:*`；`WAREHOUSE_STAFF` 原本持 `transfer:*`；SUPER/OPERATION 为 `*`。因此改 `transfer:approve` 不造成当前在册角色回归。
- 本 F1 后调拨业务写端点统一为 **13 条** `transfer:*`；CSV 导入除外，另由 S3-252 处理。

## 二、交付物

1. 从 `9c29bd36` 新建分支并合并当前 main；重跑 manifest。
2. `transfer-order.routes.ts` approve/reject 改 `transfer:approve`，同步测试期望与 parity 用例。
3. 明确列出 13/13 端点：文件:行、旧码、新码、业务依据。
4. 新增或加强专项测试：13 条均行级带期望码；店长与仓管在 210 后均通过；无码角色 403。
5. 反测两路：摘 v2 approve 的 transfer:approve ⇒ 红并点名；回滚店长 transfer:* 的角色夹具 ⇒ 目标运行时用例红。两轮复原 SHA 一致。
6. 210 在 **MySQL 8.0.28** 两遍 + sentinel；sentinel 后恢复原始权限串。

## 三、硬验收

- `guard-rbac --strict`、`guard-migration-manifest`、`tsc` 全 0。
- `vitest run src/__tests__/routes/rbac` 全绿。
- 调拨域改后扫描：13 条全部 transfer:*；`store:transfer` 只允许 CSV 导入 2 条。
- 210 两遍输出一致，sentinel 得 `["__sentinel__","transfer:*"]` 后恢复。
- 工作树 clean、backend 外零无关改动、未 push/开 PR。

## 四、红线

- 不得改 CSV 导入；不得新增权限码；不得修改 210 编号。
- 不得用“店长会丢权限”作为例外，除非给出 210 后仍持 inventory:approve 但不持 transfer:* 的在册角色证据。
- 不得把 8.0.46 结果写成 8.0.28 通过。
