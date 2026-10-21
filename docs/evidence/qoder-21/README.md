# QODER-21 证据树 · app-mobile lint error 20→0

> 执行方：Qoder（移动端执行方）｜日期：2026-10-21｜工作树：`D:\Users\ZXQL\wt-agents\QODER-21`
> 分支：`chore/qoder-21-lint-errors-zero`｜卡基线：`21b465e5`｜实现笔：`5bbd4324`
> 回传卡：`docs/tasks/cards/R101-QODER-21-回传.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-21.md`
> 本目录为 QODER-21 首轮证据，无同名历史目录，未覆盖任何旧读数。

## 目录

```
raw/   常驻四门 + build:h5 的原始输出（含命令、时点、EXIT）
anti/  反测（门必须能红）三段式日志：注入 → 红并点名 → 复原 SHA 同形态一致 → 复跑绿
```

| 文件 | 内容 | 关键读数 / EXIT |
| --- | --- | --- |
| `raw/00-sha-worktree-after-before-restore.txt` | 改后工作树 7 个源文件的 SHA256（**工作树 CRLF 形态**，非 `git show` 的 LF blob 形态），以及临时还原改前→复原后的 `SHA_MATCH` 逐字节校验 | 7/7 `SHA_MATCH`，`RESTORE_FAIL=0` |
| `raw/01-lint-before-fix-eslint-unix.txt` | **改前**基线 lint 读数复现：`eslint src --ext .ts,.vue -f unix` 的 20 条 error 逐条 `文件:行:列 规则` 清单（采集时 7 个文件临时还原为 `21b465e5` 内容） | `ERROR_LINES=20`（13 个 文件::规则 对），同次运行 eslint 汇总 `12892 problems` = 20 error + 12872 warning |
| `raw/02-git-status-after-restore.txt` | 临时还原→复原之后 `git status --short`，证明还原没有留下副作用 | 仅本卡 8 个改动文件 + 证据目录 |
| `raw/03-lint-gate-after.txt` | 门 2 `npm run lint`（`scripts/lint-gate.mjs` 判据本体） | `当前 error 0（基线 0）、warning 12872（基线 12872）`，**LINT_EXIT=0** |
| `raw/04-type-check.txt` | 门 1 `npm run type-check`（`vue-tsc --noEmit` + 基线比较） | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`，**TYPECHECK_EXIT=0** |
| `raw/05-test.txt` | 门 3 `npm run test`（vitest + 用例数基线） | `Test Files 5 passed (5)`、`Tests 56 passed (56)`，**TEST_EXIT=0**（一次通过，无负载型假红） |
| `raw/06-check-contract.txt` | 门 4 `npm run check:contract` | 口径①292／②283／③204、后端注册 1498、差集 1 条全具名豁免，**CONTRACT_EXIT=0** |
| `raw/07-build-h5.txt` | `npm run build:h5` 生产构建 | `DONE Build complete.`，**BUILD_H5_EXIT=0**（`hd-scan.svg` 那条是本基线既有提示，非本卡引入） |
| `raw/08-lint-after-by-rule.txt` | 改后逐规则 warning 计数（证明「只准降不准升」是逐规则相等，不只是总数相等） | error 0；html-indent 12299／no-console 225／bracket-spacing 196／no-unused-vars 104／multiline-content-newline 47／bracket-newline 1，合计 12872 |
| `raw/09-git-status-before-docs-commit.txt` | 证据笔提交**之前**的 `git status --short`（说明：提交后的 clean 状态无法由本目录内文件自证，故记在回传卡 §②/§⑨ 与回执里） | 只有 `docs/evidence/qoder-21/**`、`docs/tasks/cards/R101-QODER-21-回传.md`、`docs/tasks/inbox/ACTIVE-回执-QODER-21.md` |
| `anti/1-anti-storage.ts-no-extra-semi.txt` | 反测①（卡建议的 `no-extra-semi` 一处）：`git show 21b465e5:src/api/storage.ts` 回填 208 行行首分号 → 门红 → scratch 备份复原 → 复跑绿 | 注入后 `✗ 新增 error 1 条 … src/api/storage.ts:208:1 no-extra-semi`、`LINT_EXIT=1`；复原 `SHA_IDENTICAL=YES`；复跑 `LINT_EXIT=0` |
| `anti/2-anti-settings.vue-no-unreachable.txt` | 反测②（卡建议的 `no-unreachable` 一处）：还原 `settings.vue` 的 `apiBase` IIFE 双 return 形态 → 门红 → 复原 → 复跑绿 | 注入后 `✗ 新增 error 1 条 … src/pages-sub/settings/settings.vue:186:3 no-unreachable`、`LINT_EXIT=1`；复原 `SHA_IDENTICAL=YES`；复跑 `LINT_EXIT=0` |

## 采集与复原方法（可复跑）

- 门禁入口一律 `cd app-mobile && npm run <gate>`（共享协议 §1/§4；`npm --workspace` 形态在 `app-mobile` 目录内会 `No workspaces found`，属命令形态错误而非构建失败，本轮未采信任何此类日志）。
- 逐条定位用 `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue -f unix`（不猜行号）。
- 源文件改动由 `_scratch/qoder-21/apply.mjs` 完成：Buffer/UTF-8 字节精确替换、按文件探测 CRLF、两阶段（先全模式校验命中数==1，再落盘），**未用 `sed -i`**、未用编辑器整篇写盘 ⇒ `git diff --stat` = 78(+) / 61(-)，无换行归一伪 diff。
- 反测与改前读数采集都走同一套原子自复原：注入前 SHA → `cp` 备份 → 注入（打印 `INJECT_EXIT` 与注入确认行）→ 跑门（必须红并点名）→ `cp` 复原 → 与注入前**同形态**逐字节比对 → 复跑转绿；注入/复原窗口与 vitest 运行时间不重叠（全程串行）。
- SHA 形态说明：`raw/00…` 与 `anti/…` 里的 64 位值均为**工作树 CRLF 文件形态**（`sha256sum <文件>`）；`git show <rev>:<path> | sha256sum` 得到的是 **LF blob 形态**，两者对同一内容也必然不同，不可混比。

## 零字节文件

本目录无零字节文件（`find docs/evidence/qoder-21 -type f -size 0` 输出为空）。
