# ACTIVE-回执 · D1-R1（S3-57 返工第 1 轮）— 阿坚（子代理通道回执）

> 本文件按 AGENTS.md「子代理回传」协议落盘：**改了什么 + 证据 + 阻塞点**；十项完整版见 `docs/tasks/cards/R101-S3-57-阿坚回传-R1.md`。
> 上一轮（第 0 轮）回执已归档：`docs/tasks/inbox/archive/ACTIVE-回执-第0轮-20260925.md`（未覆盖、未删除）。

```
【汇报 D1-R1】对应派单 R101-20260925-D1-S3-57（返工第 1 轮）：漏改的旧口径用例（DROP PROCEDURE 应跳过）已改写为新语义（DROP PROCEDURE 必须完整下发），并以"同源左右对照"反测证明旧行为下它必红。
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 · 本地通道）｜2026-09-25
交付物：
  ① backend/src/__tests__/shared/migration.test.ts :591-606 —— 改写 1 条用例（旧口径 `外部 SQL 文件包含 DROP PROCEDURE 应跳过` → 新语义 `DROP PROCEDURE 语句应作为完整语句下发（S3-57 前为被跳过）`），本轮 +16 / -10（该文件对 HEAD 累计 +24 / -13）；用例仍在、未 skip、未删除、未放宽。
  ② 全仓静态扫描清单：docs/evidence/D1-S3-57/outputs/07-static-scan-round1.txt（`PROCEDURE` 命中 3 文件 / 38 行；迁移三测试文件 `toBeUndefined` 命中 0）。
  ③ 证据包增补（保留不删）：docs/evidence/D1-S3-57/outputs/08..13 + tools/d1-verify.mjs 扩 H 组（同源抽取 + 三条左右对照）+ 生成物 outputs/11-rework-same-source-case.txt。
  ④ 回执与记账：本文件 + 第 0 轮回执归档 + 回传卡 docs/tasks/cards/R101-S3-57-阿坚回传-R1.md + 看板两行（只改 S3-57）。
证据（可复跑）：
  · node docs/evidence/D1-S3-57/tools/d1-verify.mjs → EXIT=0；A 红 9 / B 绿 0 / C0 44 / C 44（新增失败 0）/ D 绿 0 / E 红 8 / F 红 2 / H1 绿 0 / H2 红 1 / H3 红 2 / G 读数（CREATE PROCEDURE 2 条 / DROP PROCEDURE 4 条 / CALL 下发 0）→ outputs/10-verify-run-round1.txt
  · cd backend && npx tsc --noEmit → EXIT=0（无输出）→ outputs/08-tsc-round1.txt
  · cd backend && npx vitest run（及单文件、--configLoader runner 两变体）→ 全部 EXIT=1、`spawn EPERM`、跑了 0 个文件 → outputs/09/09b/09c
  · 反测红输出原始文本：outputs/10-verify-run-round1.txt §[H3] —— `AssertionError/Error: AssertionError: expected 0 to be greater than 0`（该用例在"两处 continue 全量还原"下红）
  · 影响面：node docs/evidence/D1-S3-57/tools/d1-impact.mjs → 176 文件 / DELIMITER 1 文件 4 行 / CREATE PROCEDURE 2 / DROP PROCEDURE 4 / CALL 173（092 138）→ outputs/12-impact-scan-round1.txt
验收自评（对照派单卡 §四 1-8）：1 通过（`toBeUndefined` 归零，改为"≥1 条且每条含完整 `DROP PROCEDURE IF EXISTS test`"）；2 通过（用例在、未 skip/删除/放宽，H3 证明有分辨力）；3 通过（反测由留在仓库内的脚本产出，H3 该用例红）；4 通过（tsc EXIT=0）；5 通过（如实贴出三种 vitest 尝试均 EPERM、跑 0 文件，未主张全量绿）；6 通过（3b 主判据 `ROUTINES` 残留 0 行 + 附加 CREATE 2 / DROP 4，明确"未执行，待凌舟服务器侧跑"）；7 通过（151/152/164 消失条目 10 + 2 + 14、待复核 0，注明工具化判据 + 人工复核、非形式化证明）；8 通过（影响面本轮独立复跑）。
未完成与阻塞：
  ① 全量/单文件 `npx vitest run` 在本工作区跑不起来（esbuild `spawn EPERM`）⇒ 红绿由凌舟本机判定；"跑不了"不得推出"没红"。
  ② 3b 真库验收不由我执行（无 MySQL/Docker/外网，3306 连接被拒），脚本与预期判据已交付。
  ③ 申请处置（超出文件域、未动）：`migration-split.test.ts:154` 用例名里的"循环内再跳过"措辞已过期（其断言与新语义不冲突）；`:349` 的 `safeExec` 错误码跳过语义按派单卡豁免保持不动。请凌舟裁定措辞是否随 S3-106 一并收口。
风险与自我报备：
  ① 第 0 轮我漏改这条用例，根因是"最小运行时看不见真实 vitest 的红"——降级装置能证明"改对了"，不能证明"没漏改"；本轮已补全量静态扫描。
  ② 反测的"旧行为还原"我一开始只还原第 8 步的 continue，导致 H3 意外全绿；查明 5.5.8 兜底也会下发同一条语句后，改为两处一起还原，差异已写进证据不粉饰。
  ③ H1 的"绿"是降级证据（沙箱限制），真实判定交凌舟本机。
  ④ 看板两行在**工作区**的换行由 CRLF 变为 LF（`core.autocrlf=true`，提交按 LF，`git diff` 无空白噪声，numstat 各 1/1）；如需工作区纯 CRLF 请回退这两行重做。
  ⑤ 未做任何 git 写操作（commit/push/fetch/ls-remote）、未做 gh 写操作、未 `git add -A`；未产出任何 `*凌舟裁定*` / `*凌舟验收*` 文件，既有 `R101-S3-57-凌舟验收结论（越权产出-无效）.md` 未动。
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-57-阿坚回传-R1.md
关联卡：docs/tasks/cards/R101-派单-20260925-D1-S3-57.md
```

## 收尾动作（本回执同批完成）

1. 第 0 轮回执已归档：`docs/tasks/inbox/ACTIVE-回执.md` → `docs/tasks/inbox/archive/ACTIVE-回执-第0轮-20260925.md`（保留，未覆盖）。
2. 本轮回执 = 本文件（十项 + 署名三项齐全）。
3. 派单卡载体已归档并删除 inbox 活动卡：`docs/tasks/inbox/ACTIVE.md` → `docs/tasks/inbox/archive/ACTIVE-派单-S3-57-D1-R1-20260925.md`。
4. 看板/队列**只改 S3-57 行**：`docs/tasks/R101-总进度与推进计划.md:36`、`docs/tasks/current-tasks.md:237`，状态记「返工第 1 轮已回，待凌舟本机全量复跑判定」。
