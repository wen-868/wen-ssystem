# QODER-22 证据树 · 移动端最终 main 收口

> 执行方：Qoder（移动端）｜派单人：凌舟｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-22`｜分支：`chore/qoder-22-mobile-main-closeout`
> 基座 `cf9a98fa`（QODER-20 尖端）+ 并入 `2e8cde17`（QODER-21 尖端）⇒ 本卡 HEAD `e9afb0a6`
> 回传卡：`docs/tasks/cards/R101-QODER-22-回传.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-22.md`
> 本树只登记执行方自己的读数，不含验收方判词。所有原始日志均为命令原文 + 退出码落盘，未做二次加工。

## raw/ —— 判据取证（合并 → 收敛 → 双范围 → 四门三构建双守卫 → 红线机检）

| 文件 | 内容 | 关键读数 |
| --- | --- | --- |
| `00-premerge-base.log` | 合并前基座取证：`cf9a98fa` 与 `2e8cde17` 两侧 `gates-baseline.json` 原文、`merge-base` | `HEAD=cf9a98fa`、`merge-base=21b465e5`、`THEIRS tests=5/56` |
| `10-merge-21b465e5-plus-2e8cde17.log` | `git merge --no-ff --no-commit 2e8cde17` 原样输出 | `Auto-merging gates-baseline.json`、`MERGE_EXIT=0`、**零冲突** |
| `10-gates-check-merged.log` | 合并态 + spec 改写后 `check:gates` 串行四门（19:13 轮） | `GATES_EXIT=0`、type 0=0、error 0/warning 12872、test 11/186、contract 差集 1/豁免 1 |
| `11-baseline-convergence.log` | `gates-baseline.json` 两段 note 追加前后对照（含 SHA、CRLF 计数、六段清单） | 前 `18c42551…` → 后 `ebf8cf99…`、`crlf=47 bytes=9891`、`sections` 六段齐、追加面仅 2 行 |
| `12-pinssl-spec-single-green.log` | 双范围改写后单 spec 直跑 | `1 test passed`、用例数仍为 1（总 186 不变） |
| `13-test-gate-repro-clean-tree.log` | 清洁合并态复跑 test 门（复现 19:27 那次红） | `RUN1_TEST_GATE_EXIT=0`、11/186 全绿 ⇒ 见 `probe/` |
| `20-build-h5.log` / `21-build-mp-weixin.log` / `22-build-app.log` | 卡 §三 要求的三端构建（仓库根 `npm --workspace`） | `BUILD_H5_EXIT=0` / `BUILD_MP_EXIT=0` / `BUILD_APP_EXIT=0`，均 `DONE Build complete.` |
| `30-guard-strict.log` / `31-guard-strict-nostale.log` | 后端双守卫 `guard-rbac-wiring.mjs --strict` 与 `--strict --no-stale` | 两份均 `EXIT=0`，gaps 已登记 289／未登记 0／陈旧 0；consumerEnd 45／0 |
| `40-scope-and-redlines.log` | 范围与红线机检：后端零改动、`upload` 导出、pin-ssl 调用点、旧事实扫描面 | `BACKEND_SRC_DIFF_LINES=0` `BYTES=0`、`UPLOAD_ANYwhere=0`、`PINNED_INSTALL_CALLS=0`、`OLD_FACTS_IN_SRC=0` |
| `41-merge-lineage.log` | 合并谱系：真双父、祖先关系、来源支尖端未被改写、无上游分支（含两条同轮标签补记） | `HEAD parents = cf9a98fa + 2e8cde17`、`--is-ancestor` 全部 exit=0、`chore/qoder-21…` 尖端仍 `2e8cde17`、`no upstream configured` |
| `42-section-provenance.log` | **两段冲突处理**的机械证明：`-U0` hunk 行区间不相交 + 四态读数归因表 + §4 hunk 补记 | 我方仅动 57-59（tests 段）、并入方仅动 10/13-27/36（lint 段）⇒ 零冲突属正常三方合并；`HEAD lint=0/{}` 取 theirs、`HEAD tests=11/186` 取 ours |
| `43-config-and-rule-face.log` | 门禁装置与规则面零改动自检 + 本卡改动面清单 + disable 扫描面（含 §6 qualifier） | `.eslintrc.cjs`/`vitest.config.ts`/`package.json`/四门脚本/pin-ssl.ts/crypto.ts/storage-crypto.spec.ts 相对 `cf9a98fa` diff 全 0 |
| `46-terminal-gates.log` | **终态**四门复跑（反测全部复原、探针删除之后） | `GATES_EXIT=0`、`11 passed (11)`、`186 passed (186)`、error 0（基线 0）、warning 12872（基线 12872）、vue-tsc 0=0、差集 1/豁免 1 |
| `47-artifact-spot-check.log` | 三构建产物级抽查（`app-mobile/dist/**`，已被 `app-mobile/.gitignore:2` 忽略、不入库；非判据，仅补"构建绿之外还能看到什么"） | h5 `index.html` 的 `viewport-fit=cover` 命中 **1**、mp `app.json` `pages=16`／`requiredPrivateInfos=[]`／`scope.record.desc` 为真实中文用途说明 |
| `48-tip-gates.log` | **出厂复跑**：交付笔 `24811fa8` 之后再跑一次常驻四门（当时未提交面只有 `docs/` 两文件 ⇒ `app-mobile` 面与该笔一致） | `GATES_EXIT=0`、type 0=0、error 0／warning 12872、`11 passed (11)`／`186 passed (186)`、差集 1／豁免 1 |
| `50-storage-crypto-flake-probe.log` | 附带发现的根因探针（临时 spec，跑完即删、不入库） | A：第 77 次加密命中，`decrypt(篡改 tag)=false` 抛错、返回 `"top-secret"`；B 对照必抛；C：2000 次命中 8 = 0.00400（理论 0.00391） |

## anti/ —— 反测四轮（卡 §三 两条判据，证明"不是只看文件头"）

每轮形态：`SHA_BEFORE` → 字节级注入（命中数≠预期即拒绝写盘、退出码非 0）→ 红跑并点名断言 → `cp` 复原 → `SHA_AFTER` 与 `SHA_BEFORE` 逐字节一致 → 复跑转绿。
`pin-ssl.ts` 工作树（CRLF 形态）注入前/后 SHA 恒为 `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889`。

| 文件 | 注入位置（均在**文件头块之外**，即行 33 `*/` 之后） | 红了什么 |
| --- | --- | --- |
| `A1-old-date-at-constant-tail.txt` | `PINNING_ENABLED_KEY` 常量行尾注释加 `2026-09-15` | ①点名（`spec.ts:87`）；并额外跑常驻 test 门：`1 failed \| 185 passed`、`TEST_GATE_EXIT=1` ⇒ 全链转红；复原后 `VITEST_EXIT_AFTER_RESTORE=0` |
| `A2-old-issuer-at-constant-tail.txt` | `DEFAULT_PINNING_ENABLED` 常量行尾注释加 `TrustAsia` | ②点名（大小写不敏感） |
| `B1-head-missing-api-expiry-date.txt` | 文件头 `叶子 2026-11-11 到期` → `叶子到期`（常量旁 `:76` 同值字符串保持不动） | ③点名 ⇒ 证明正向只认文件头、不被常量注释"顶包" |
| `B2-head-missing-m-expiry-date.txt` | 文件头 `叶子 2026-12-22 到期` → `叶子到期`（常量旁 `:80` 不动） | 正向 m 侧点名，同 B1 语义（证明正向只认文件头） |
| `void-v1/` | **v1 轮 4 份日志全部作废**（`INJECT_EXIT=1` 未中止轮次 ⇒ "红跑"实为绿跑），另附 `README.note.txt` 说明作废原因与那次清洁树真红的发现过程 | 作废读数不作任何判据引用；原始文件未改写 |

## probe/ —— 附带发现（不在本卡动作面内，仅报告）

- `README.md`：`storage-crypto.spec.ts:37` 概率红（约 1/256）的现象、根因（`crypto.ts:626-628` 校验循环上界写死 16、不校验 `tag.length`）、影响面与建议处置。
- `__q22-flake-probe.spec.ts.txt`：探针源码存档（**未交付**，`app-mobile/tests/` 下已删除；复现命令见 README §五）。

## 复现口径

四门 / 三构建 / 双守卫一律在**仓库根** `D:\Users\ZXQL\wt-agents\QODER-22` 跑 `npm --workspace app-mobile run …`；在 `app-mobile/` 目录内跑会报 `No workspaces found`。命令逐条见回传卡 §十。
