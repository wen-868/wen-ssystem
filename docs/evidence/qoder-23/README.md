# QODER-23 证据树 · AES-GCM 认证标签长度正确性

> 执行方：Qoder（移动端）｜日期：2026-10-21｜分支：`fix/qoder-23-gcm-tag-length`｜基线：`bc1087ee`
> 任务书：`docs/tasks/inbox/QODER-23-gcm-tag-length.md`｜回传卡：`docs/tasks/cards/R101-QODER-23-回传.md`
> 本树只登记执行方自己的读数与依据，**不含任何验收方判词**。所有原始日志开头都有「做什么 + 时间戳 + `$ 命令`」。

## 目录

| 路径 | 内容 |
| --- | --- |
| `raw/00-baseline-and-tree.log` | 开工核验（基线父子关系、分支、node_modules、跑门目录口径）；含"开工态读数当时未落文件"的诚实标注。 |
| `raw/20-gates-tip.log` | 终态四门 `check:gates` ⇒ `CHECK_GATES_EXIT=0`；逐门：type-check EXIT=0（0=0）／lint EXIT=0（error 0、warning 12872=基线）／test EXIT=0（**11 文件 / 187 用例 = 基线 11/187**）／check:contract EXIT=0（差集 1／具名豁免 1）。 |
| `raw/21-build-h5.log` | `npm --workspace app-mobile run build:h5` ⇒ `BUILD_H5_EXIT=0`、`DONE Build complete.`、产物在 `app-mobile/dist/build/h5/`（非仓库根 `dist/`）。 |
| `raw/30-scope-and-redlines.log` | 改动面只有 3 个文件、`git diff bc1087ee -- backend/` = **0 字节**、行尾形态（`i/lf w/crlf`，SHA 分 `worktree-crlf` 与 `git-blob-lf` 两种登记、不跨形态比较）。 |
| `raw/40-terminal-selfcheck.log` | 文档笔之前的收尾自检（HEAD=实现笔 `ad73898e`、第 1 父 = `bc1087ee`、backend diff 0、状态只余本卡文档面）。 |
| `raw/45-determinism-reruns.log` | 连跑常驻门 3 **8 次** ⇒ `RUN=1..8 全部 EXIT=0`、每次 `Tests 187 passed (187)`（旧写法的 1/256 概率红面复跑不见；结构性依据仍是探针 D3/D4）。 |
| `raw/48-tip-gates.log` | 文档笔 `e33f3541` 之后的**尖端出厂读数**：`check:gates` 四门全绿（type 0=0／lint error 0 warning 12872／test 11/187=基线／contract 差集 1 豁免 1）⇒ `CHECK_GATES_EXIT=0`；`build:h5` ⇒ `BUILD_H5_EXIT=0`；backend diff 0 字节。 |
| `anti/R1-guard-removed.txt` | 反测 R1：摘掉**认证标签长度守卫**。 |
| `anti/R2-compare-ignored.txt` | 反测 R2：摘掉**常量时间比较的失败分支**（守卫仍在场）。 |
| `probe/probe-b64.txt` + `probe/README.md` | 动手前的 base64／定长比较语义探针与逐行读法（含对派单"NaN"口径的实测更正）。 |
| `probe/inject-guard-off.cjs.txt` | 反测注入器副本（原件在树外 `_qoder23_work/`，字节精确整行匹配 + 命中数≠1 即 `exit(2)`）。 |

## 反测台账（两轮，均无作废轮）

| 轮 | 注入内容 | INJECT_EXIT | 注入后回读 | 门 3 读数 | 红点点名 | 复原 SHA（worktree-crlf） | 复跑 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `crypto.ts:630` 长度守卫整行替换为注释 | **0** | 标记在场=true／原行消失=true／比较分支仍在=true | **TEST_EXIT=1** | `非规范长度 tag 一律拒绝（可解码为 18 字节的标签不得进入定长比较）` ×，`spec.ts:80:37`；`1 failed \| 186 passed (187)` | `SHA_BEFORE == SHA_AFTER == 97063e803c60a1bf541caf02c72dccd0b9712d2d3868e81afc0032845d0211c6` | **TEST_EXIT_RERUN=0** |
| R2 | `crypto.ts:635` 的 `if (diff !== 0) return null` 替换为注释 | **0** | 标记在场=true／原行消失=true／长度守卫仍在=true | **TEST_EXIT=1** | `tag 校验失败即抛（确定性翻转 tag[0]，绝不返回明文）` ×，`spec.ts:65:37`；`1 failed \| 186 passed (187)` | 同上（恒等，同值） | **TEST_EXIT_RERUN=0** |

两轮红点**互不重叠**，说明两条用例各守一处：R1 只打红 18 字节用例（翻转用例仍 ✓，因为它不依赖长度守卫），R2 只打红翻转用例（18 字节用例仍 ✓，因为守卫在场）。这正是既往裁定（QODER-13F1 因"测试名与守护对象错配"被打回）要求的可定位性。

复原一律 `cp /d/Users/ZXQL/wt-agents/_qoder23_bak/crypto.ts.R{1,2}.before` → 树内；未用 `sed -i`、未用编辑器写回；备份目录在**树外**。复原后 `grep -c "ANTI-R" crypto.ts` = **0**（注入标记出清）。

## 被排除的作废读数

无。本卡所有门与构建都在**工作树根**跑，没有出现 `No workspaces found` 那类目录错用的作废读数；两轮反测 `INJECT_EXIT` 均为 0，无 VOID 轮。
