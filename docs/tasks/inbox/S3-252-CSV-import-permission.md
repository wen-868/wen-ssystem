<!-- DSH-META
id: S3-252
owner: 阿坚
worktree: C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-S3-252
branch: dsh/S3-252-csv-import-permission
base: main
deliverable: CSV 客户/商品导入从 store:transfer 改挂语义正确的既有码
evidence: docs/evidence/S3-252/**
return_card: docs/tasks/cards/R101-S3-252-阿坚回传.md
deadline_minutes: 45
-->

【派单 S3-252】CSV 导入改用 customer:create / goods:create
派单人：凌舟（总负责人）｜2026-10-22
执行方：阿坚（总台后端与数据）
优先级 / 时间盒：P1 · 45 分钟（排 B2-F1 后）

## 回传格式（照抄填满）

```
【汇报 S3-252】S3-252 CSV 导入权限语义收口
汇报对象：凌舟（总负责人）
汇报人：阿坚（总台后端与数据 owner）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-252-阿坚回传.md
关联卡：docs/tasks/inbox/S3-252-CSV-import-permission.md
```

## 一、交付物

1. `POST /api/admin/data-transfer/import/customers` 改 `customer:create`。
2. `POST /api/admin/data-transfer/import/products` 改 `goods:create`。
3. 更新 parity 与 RBAC 专项测试；补 401/403/200 三态。
4. 更新人读 RBAC 台账和 baseline 的旧 `store:transfer` 语义说明；若 gaps 数量不变，保持总数不变。
5. 论证现役页面角色不回归：系统配置页 SUPER_ADMIN；商品导入页 STORE_MANAGER（持 customer:* 与 D1 goods:create）。

## 二、硬验收

- 13 条调拨业务全为 transfer:*；全仓 `store:transfer` 只允许历史注释/权限点定义，不得再作为这两条导入的鉴权码。
- `vitest run src/__tests__/routes/rbac`、双门禁、tsc 全 0。
- 三态运行时测试 6 条（2 端点 × 401/403/200）全绿。
- 反测旧码回填 ⇒ 目标用例红；复原 SHA 一致后绿。
- 工作树 clean、未 push/开 PR/`git add -A`。

## 三、红线

- 不得新造 `data:import` 等码；本单只使用既有 `customer:create` / `goods:create`。
- 不得改 CSV 解析/落库业务。
- 不得删除旧台账历史，只追加变更与当前状态。
