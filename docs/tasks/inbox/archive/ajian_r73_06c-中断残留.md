# 任务卡：阿坚 R73-06 AI 底座本地验证 + 验收清单复核

> 派发人：凌舟 | 日期：2026-08-03 | 系统标识：ajian_r73_06c

## 任务来源

你被 spawn 时可能收不到消息正文（平台故障），请以本任务卡为准。任务已登记于 `docs/tasks/current-tasks.md` 的 R73-06 段。

## 必读文件（按顺序，逐份读完）

1. `D:\Users\Documents\TREA\.trae\agents\ajian.md`（你的角色定义）
2. `D:\Users\Documents\TREA\wen-ssystem\docs\memories\阿坚-记忆.md`（你的记忆）
3. `D:\Users\Documents\TREA\wen-ssystem\docs\tasks\current-tasks.md`（R73-06 段 + 必读清单）
4. `D:\Users\Documents\TREA\wen-ssystem\docs\项目规则.md`
5. `D:\Users\Documents\TREA\wen-ssystem\docs\项目统一标准.md`
6. `D:\Users\Documents\TREA\wen-ssystem\docs\踩坑日志.md`

## 任务内容（R73-06 AI 底座验证，工作目录 D:\Users\Documents\TREA\wen-ssystem，分支 main）

1. **AI 底座构建**：
   - `cd D:\Users\Documents\TREA\wen-ssystem\backend\ai-base`
   - 按 `package.json` 实际脚本执行构建（如 `pnpm install` 完成后 `pnpm build` 或 npm 对应命令；先勘察确认）
   - 预期：构建成功产出 `dist/`，exit 0
2. **AI 底座健康检查（本地）**：
   - 查看 `backend/ai-base/src/app.controller.ts` 确认 `/health` 端点与 `.env.example` 中 `PORT=3016`
   - 若本地可启动（依赖 MySQL/Redis/DeepSeek 密钥），执行 `npm run start:prod` 或 `pnpm start:prod` 后 `curl http://127.0.0.1:3016/health`，记录实际响应
   - 若因缺少密钥/数据库无法启动，如实记录"本地启动受阻 + 原因"，不得编造 200
3. **R73-02 验收清单复核**：打开 `docs/reports/R73-02-服务器验收清单.md`，逐条核对清单中的命令与仓库实际代码一致（backend build/typecheck/test 脚本、端口 8080/3016、/health 路径、dashboard 前缀 /api/admin/dashboard、products/brands/categories 路径、ai-base pnpm 脚本）。发现偏差直接修正清单并记录。
4. **测试**：在 `backend` 目录执行 `npm run typecheck`（或等价脚本），预期零错误；若时间允许跑 `npm test`（vitest 416 文件基准）
5. **更新任务文件**：在 `docs/tasks/current-tasks.md` R73-06 段标注你负责部分的完成状态与证据
6. **提交**：git add + git commit（信息如 `docs: R73-06 AI底座本地验证与验收清单复核`），**不要 push**（凌舟统一收口）
7. **归档**：将本任务卡移动到 `docs/tasks/inbox/archive/`

## 最终回复要求

必须包含：任务标识（R73-06）；对任务正文关键内容复述；AI 底座构建/健康检查实际结果（或受阻原因）；清单复核发现（如有）；commit 哈希。不要编造未执行的结果。

## 验收标准

AI 底座构建 exit 0（健康检查如实记录）；验收清单与仓库代码一致性复核完成；任务文件状态更新；任务卡归档。

