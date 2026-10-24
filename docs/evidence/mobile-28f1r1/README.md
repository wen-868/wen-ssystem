# MOBILE-28F1R1 · 守卫接线与 preview 复验 · 证据索引

> 负责人：**阿潵（移动端负责人）**｜2026-10-25
> 派单卡：`docs/tasks/inbox/MOBILE-28F1R1-preview-and-guard-wiring.md`
> 上游裁定：`docs/tasks/cards/R101-MOBILE-28F1-凌舟验收与裁定-20261024.md`（B1 / B2）
> 工作树：`D:\Users\ZXQL\wt-agents\MOBILE-28F1R1`｜分支 `mobile/MOBILE-28F1R1-preview-guard-wiring`｜基线 `5f4204bd`

## 一、本单结论摘要

| 项 | 结果 |
|:--|:--|
| B1 微信 preview | **BLOCKED**（IDE 服务端口关闭 + GUI 启动即退出；已拆分四判据实测，详见 `01-cli-correction-and-preview-blocked.md`） |
| B2 守卫接线 | **完成**（`guard:mp-style` 已加进 `package.json` 并串入 `check:gates`） |
| 防回归反测 | **完成**（注入 ⇒ `check:gates` 点名变红 EXIT=1 ⇒ 逐字节复原 SHA256 一致 ⇒ 复绿 EXIT=0） |
| 三端构建 / MP 产物 / H5 保留 | **复跑通过**（EXIT=0 / 0 通配 / 四处 PRESENT） |
| 16/329 | **未减少**（`Test Files 16 passed` / `Tests 329 passed`） |
| 更正上一单失实结论 | **已完成**（`raw/29` 原样保留，不改写） |

## 二、交付物与改动面

| 文件 | 改动 | 说明 |
|:--|:--|:--|
| `app-mobile/package.json` | `+2 行` | 新增 `"guard:mp-style": "node scripts/guard-mp-style-selectors.mjs"`；`check:gates` 末尾追加 `&& npm run guard:mp-style` |
| `app-mobile/scripts/guard-mp-style-selectors.mjs` | 无改动（沿用 28F1） | 无参默认 `--src`（无构建依赖），符合卡"至少把 `--src` 接进 check:gates" |
| `docs/evidence/mobile-28f1r1/**` | 新增 | 本索引 + 更正证据 + raw 原始输出 |
| `app-mobile/src/**` 业务代码 | **零改动** | 样式修复沿用 28F1，本单未动 |

`--dist` 产物扫描**未接常驻门禁**（如实标注，不宣称已常驻）：CI 现有构建后阶段是 `npm run build`（`--workspaces`，产物路径因端而异且 app-mobile 的 dist 被 gitignore），本单仅在本地以 `--dist` 手动复验；接 CI 需另立单（卡 §二.2 允许"未接时不得宣称产物扫描已常驻"）。

## 三、每个 raw 文件证明什么

| 文件 | 命令 | 读数 |
|:--|:--|:--|
| `raw/10-cli-four-criteria-probe.txt` | `Test-Path cli.bat` / `cli.bat --help` / `cli.bat islogin` / 启动 IDE | ① 路径 True ② `--help` 列出 preview/islogin… ③ `islogin` 报 `initialize error`→补目录后报 `IDE service port disabled` ④ GUI `HasExited=True ExitCode=0` |
| `raw/20-guard-mp-style-clean.txt` | `npm run guard:mp-style`（干净态） | `命中 3 / 未隔离 0`、`MP_STAR_GUARD_SRC_PASS`、`EXIT=0` |
| `raw/21-redtest-before-sha.txt` | `Get-FileHash` | `BEFORE_SHA256=1B9723CEB6900D9263185E4F85351FB26942BB97472AF4F9DD37AFEEC0EF7116` |
| `raw/21-redtest-injected-sha.txt` | 注入后哈希 | `INJECTED_SHA256=C53AF4B24B3E577DD1F99C600EEE0A70F5A95478DD3773B491B2E1C13B8BCB10` |
| `raw/22-redtest-guard-red.txt` | `npm run guard:mp-style`（注入态） | `命中 4 / 未隔离 1`、**点名 `pages-sub/admin/more/more-functions.vue:364 ⇒ .__probe-28f1r1 *`**、`GUARD_EXIT=1` |
| `raw/23-redtest-check-gates-red.txt` | `npm run check:gates`（注入态） | type/lint/test(16/329)/contract/guard:request 全绿后，**末尾 `guard:mp-style` 点名变红**、`CHECK_GATES_EXIT=1` |
| `raw/24-redtest-restored-sha.txt` | `git checkout --` 后哈希 | `RESTORED_SHA256=1B9723CE…` = BEFORE（逐字节一致） |
| `raw/25-redtest-check-gates-green.txt` | `npm run check:gates`（复原态） | `MP_STAR_GUARD_SRC_PASS`、`Test Files 16` / `Tests 329`、`CHECK_GATES_EXIT=0` |
| `raw/30/31/32-build-*.txt` | `npm run build:mp-weixin/h5/app` | 三者 `DONE  Build complete.` + `EXIT=0` |
| `raw/33-dist-scan.txt` | `node …guard… --dist app-mobile/dist/build/mp-weixin` | `命中 0 处`、`MP_STAR_GUARD_DIST_PASS`、`DIST_EXIT=0` |
| `raw/34-h5-and-controls.txt` | 28F1 控制装置 | A 正对照 PASS / B 真实产物 0 / C H5 四处 PRESENT / D 源码已隔离、`MOBILE_28F1_CONTROLS_PASS` |
| `raw/40-preview-attempt.txt` | `cli.bat preview --project <abs> --port 9420` | 原始输出含 `× initialize` + `[error] IDE service port disabled`；`PREVIEW_EXIT=0` 但**三条成功判据未同时满足 ⇒ BLOCKED** |

## 四、反测闭环（卡 §三.3，逐步可复跑）

| 步 | 动作 | 读数 |
|:--|:--|:--|
| 1 | 记录注入前哈希 | `1B9723CE…` |
| 2 | 向 `more-functions.vue` 注入 `.__probe-28f1r1 * { color:red }`（**未隔离**） | `C53AF4B2…` |
| 3 | `npm run guard:mp-style` | **EXIT=1**，点名 `more-functions.vue:364` |
| 4 | `npm run check:gates`（整链） | **EXIT=1**，末尾点名同一处 |
| 5 | `git checkout --` 逐字节复原 | `RESTORED_SHA256=1B9723CE…`（= 步 1） |
| 6 | `npm run check:gates` 复跑 | **EXIT=0**，16/329 不减 |

## 五、历史结论失效声明

`docs/evidence/mobile-28f1/raw/29-wechat-cli-probe-not-run.txt` 的结论「本机无微信开发者工具 CLI」**不再作为验收依据**（它自身即记录 `cli.bat => FOUND`，自相矛盾）。该文件原样保留不改写，以 `mobile-28f1r1/raw/10` 与 `raw/40` 为准。
