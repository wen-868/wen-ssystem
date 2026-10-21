# QODER-18 · `upload()` 死导出处置 — 证据树

> 执行方：Qoder（移动端执行方）｜汇报对象：凌舟｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-18`｜分支：`fix/qoder-18-upload-dead-code`
> 基线：`e6801de0`（任务书 §前言自述的 QODER-14F1 尖端；此为该派单原文措辞，非本执行方判词）｜任务书：`docs/tasks/inbox/QODER-18-upload-dead-charge.md`
> 本目录只放**原始输出**与读数，不含判词；验收结论由凌舟另行给出。

## 一、本卡做了什么（一句话）

删除 `app-mobile/src/api/request.ts` 里全仓 0 引用的死导出 `upload()`（**实际 :219-254**，卡内写的 :211 已过期），
并在既有 `app-mobile/tests/request-retry-safety.spec.ts` 内新增 **1 条**静态断言（⑭）把「删掉了、不许再引回来」做成门禁。
**未改写实际上传链路**（`products.ts uploadImage()` / `profile.ts uploadAvatar()` 及其消费点 diff 全为 0 行）。

## 二、判据读数一览

| 项 | 读数 | 证据文件 |
|---|---|---|
| 死导出复证（删前） | `export function upload` 仅 1 处（request.ts:219）；src+tests 无从 `api/request` 导入 `upload`（0 命中） | `raw/00-dead-export-before.txt` |
| 改动面 | `git diff --name-only e6801de0..HEAD` = 3 文件（request.ts / spec / gates-baseline.json） | `raw/01-change-diff.txt`、`raw/60-terminal-selfcheck.txt` |
| 死导出复证（删后） | `app-mobile/src` 内 `export function upload` 0 命中；request.ts 全文无 `upload` 字样 | `raw/30`、`raw/31-post-delete-src-only.txt` |
| import/helper 处置 | `getToken`(:49→65,105)、`getTenantId`(:53→66)、`getCsrfToken`(:57→67)、`BASE_URL`(:10→87)、`import {API_BASE_H5,API_BASE_NATIVE}`(:6) **仍被 `request()` 使用 ⇒ 一个都不删** | `raw/30-dead-export-after-and-scope.txt` CMD 6 |
| 门 1 type-check | EXIT=0（vue-tsc 错误 0 条 / 基线 0） | `raw/50`（终态）、`raw/10`（首跑） |
| 门 2 lint | EXIT=0（error 20=基线 20、warning 12872=基线 12872，无劣化） | `raw/50`、`raw/11` |
| 门 3 test | EXIT=0，**实测 6 文件 / 71 用例**（卡内预判 6/71 命中） | `raw/50`、`raw/12`、`anti/05` |
| 门 4 check:contract | EXIT=0，**292 / 283 / 204、差集 1、豁免 1 —— 与删前逐项相同** | `raw/50`、`raw/13`、`raw/00` CMD 4 |
| contract-drift | EXIT=0（D1=0 / D2=0 / debt=0） | `raw/51`、`raw/42` |
| build:h5 | EXIT=0（**必须在仓库根执行**） | `raw/51`、`raw/21` |
| build:h5 入口错误 | EXIT=1 `No workspaces found` ⇒ **不是构建失败**，已作废登记并配 note | `raw/20-build-h5-wrong-entry-voided.txt` + `.note.txt` |
| backend/ | `git diff e6801de0..HEAD -- backend/` = **0 行** | `raw/60`、`raw/70` |
| gates-baseline.json | **只动 `tests` 段**（`testCount` 70→71 + note 追加），`testFiles` 仍 6；lint/typeCheck/checkContract/contractDrift 四段一字未动 | `raw/01-change-diff.txt` |

> `raw/70-post-commit-final-readings.txt` = 提交后终态读数（含对 `raw/60` 一处措辞的补正、docs 笔 `--amend` 报备，
> 以及「证据文件无法记录自身提交后状态」的自指限制说明 + 负责人可直接复跑的终态复核命令块）。

## 三、反测（门必须能红）

`anti/` 目录，协议 §4 原子序列：注入前 SHA → `cp` 备份到树外 `_scratch/qoder-18/` →
树外 `.mjs` latin1 字节精确注回死导出桩 → `npm run test` 红 → `cp` 复原 → SHA 逐字节一致 → 复跑绿。

| 文件 | 内容 |
|---|---|
| `anti/00-inject.txt` | 首轮注入 + **守卫自检**（对仍含 `upload` 的文件注入 ⇒ `exit 9` 拒写，证明注入器不会重复注） |
| `anti/01-gate-red-with-injection.txt` | 首轮红：`FAIL … QODER-18 … ⑭`、`AssertionError: request.ts 又出现 export function upload`、EXIT=1 |
| `anti/02-restore-sha.txt` | `cp` 复原 + SHA256 与注入前一致 |
| `anti/03-gate-green-after-restore.txt` | 首轮复原后转绿（当时 spec 尚未定稿） |
| `anti/04-final-anti-atomic.txt` | **发现负载型假红的一轮**：STEP 7 复跑 `EXIT=1`，原因是 vitest 默认 **5000ms 用例超时**（不是断言差异）。原始输出**未改写**，保留作踩坑证据 |
| `anti/05-timeout-fix-stability.txt` | 处置（给该 `it` 显式 30_000ms 超时、断言一字未减）+ 连续两遍稳定性复跑 |
| `anti/06-final-anti-atomic-valid.txt` | **最终有效轮**：红 EXIT=1 且点名 ⑭（`AssertionError`）→ 复原 `cmp` 逐字节一致 → 绿 EXIT=0 |

注入器：`D:\Users\ZXQL\wt-agents\_scratch\qoder-18\inject-upload-stub.mjs`（工作树外，不进仓库）。
备份件：同目录 `request.ts.anti*-before.bak`。全程未用 `sed -i`。

## 四、口径偏差报备（动手前已复核，详见回传卡 §五）

1. **行号偏差（必须点名）**：卡内写 `request.ts:211`，现场实际 **`:219-254`**。
   原因：基线 `e6801de0`（QODER-14F1）在本文件 401 分支上方新增了注释与清理行，把死导出整体下移。
   已按现场行号执行，删除范围以「`export function upload` 函数体」为准而非硬行号。
2. **新增用例数**：卡/负责人预判「加 1 条后实测 6/71」⇒ 现场实测 **6 文件 / 71 用例**，与预判一致。
3. **contract 读数**：预判「`upload()` 内不含 `/admin/...` 字面量 ⇒ 删除不影响读数」——
   复核成立（`raw/00` CMD 4 = 0 命中；`check-contract.mjs` 的 `CALL_METHOD_RE` 虽含 `upload`，
   但口径① 只统计 `'/admin/...'` 字面量出现次数，`upload(` 的定义行写成 `upload<T = any>(` 也不匹配该正则）。
   终态读数 **292 / 283 / 204、差集 1 / 豁免 1** 与删前**逐项相同** ⇒ 未为此动基线。

## 五、未验（真机/H5 目视与登录态 E2E 一律如实标注）

见 `docs/tasks/cards/R101-QODER-18-回传.md` §七。摘要：H5/真机上传目视、登录态整页 E2E、
后端 `POST /admin/products/upload-image` 联调、微信开发者工具与小程序端 —— **全部未验**（无设备/无登录态/无后端实例）。
