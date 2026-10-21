<!-- DSH-META
id: B2-REPORT-WIRING-F1
owner: 阿坚
worktree: C:\Users\XIONG\Documents\Codex\dsh-worktrees\dsh-B2-REPORT-WIRING-F1
branch: dsh/B2-REPORT-WIRING-F1-runtime-ledger
base: dsh/B2-report-wiring
deliverable: 补人读 RBAC 台账与 18 条报表写端点的 401/403/200 运行时抽样
evidence: docs/evidence/B2-REPORT-WIRING-F1/**
return_card: docs/tasks/cards/R101-B2-REPORT-WIRING-F1-阿坚回传.md
deadline_minutes: 75
-->

【派单 B2-REPORT-WIRING-F1】补齐报表接线的人读台账与运行时三态
派单人：凌舟（总负责人）｜2026-10-22
执行方：阿坚（总台后端与数据）
优先级 / 时间盒：P0 · 75 分钟

## 回传格式（照抄填满）

```
【汇报 B2-REPORT-WIRING-F1】B2 报表域运行时与会账补齐
汇报对象：凌舟（总负责人）
汇报人：阿坚（总台后端与数据 owner）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-B2-REPORT-WIRING-F1-阿坚回传.md
关联卡：docs/tasks/inbox/B2-REPORT-WIRING-F1-runtime-ledger.md
```

## 一、原卡已成立部分

- 18 条行级 `requirePermission` 已接入，11 码全在 207，台账 289→271/87→83、763 守恒。
- 凌舟亲跑 19 文件 / 2404 例、双门禁、tsc 全绿。

## 二、必须补齐

1. 更新人读 `docs/tasks/R101-RBAC接线缺口清单.md`：新增 B2 报表域批次章节，列出 18 条与 289→271 的差异；修正该文件中“报表模板/定时任务无现成码”的过期结论，指向 207 已立码。
2. 新增运行时三态抽样，至少覆盖 4 个路由文件各 1 条：
   - `POST /api/admin/reports/`
   - `POST /api/custom-report/templates`
   - `PUT /api/admin/report-permissions/matrix`
   - `POST /api/admin/reports/export`
   每条均验：无令牌 401、无该码 403 且不到控制器、持码 200 到控制器。
3. 中间件使用真实 `requirePermission`；认证可按既有平台/租户测试模式注入用户，但权限判定不得 mock 成恒真。
4. 反测：任选一条摘权限中间件 ⇒ 对应 403/200 用例红并点名；复原 SHA 一致后绿。

## 三、硬验收

- 人读台账含 18 行端点/码与更新后计数；旧“无码”结论不再作为当前事实。
- 专项测试至少 12 条运行时三态（4 端点 × 3），全绿。
- `vitest run src/__tests__/routes/rbac`、双门禁、tsc 全 0。
- `docs/migrations/**` diff=0；工作树 clean；未 push/开 PR/`git add -A`。

## 四、红线

- 不得新增迁移、权限码或角色种子。
- 不得只做静态源扫描冒充 401/403/200。
- 不得通过 mock 掉 `requirePermission` 或放宽期望换绿。
- 不得与 S3-252 同时改人读台账；本 F1 先完成。
