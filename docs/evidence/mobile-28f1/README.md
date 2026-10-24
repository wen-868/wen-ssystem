# MOBILE-28F1 · 微信 WXSS 通配选择器阻断修复 · 证据索引

> 负责人：**阿潵（移动端负责人）**｜2026-10-24
> 派单卡：`docs/tasks/inbox/MOBILE-28F1-mp-star-selectors.md`
> 依据：`docs/tasks/cards/R101-MOBILE-29F3-凌舟验收与裁定-20261024.md`（基线已对齐到 29F3 尖端）
> 工作树：`D:\Users\ZXQL\wt-agents\MOBILE-28F1`｜分支 `mobile/MOBILE-28F1-mp-star-selectors`｜基线 `e257825f`（已验收 MOBILE-29F3 栈尖端，**未从旧 QODER-28 `b66940d7` 起跑**）

## 一、改了什么（2 文件 3 规则块，与卡 §一"修法面闭合为 2 文件 3 规则块"一致）

| 位置 | 规则 | 处置 |
|:--|:--|:--|
| `app-mobile/src/App.vue:69-75` | `*, *::before, *::after { box-sizing: border-box }` | 用样式级 `/* #ifndef MP-WEIXIN */ … /* #endif */` 包住（H5/App 原样保留） |
| `app-mobile/src/App.vue:119-129` | `@media (prefers-reduced-motion: reduce){ *, … }` | 同上 |
| `app-mobile/src/pages/sales/create-sale.vue:2472-2482` | `@media …{ .create-sale-page *, … }` | 同上 |

**未删任何 H5 修复规则**（红线）。条件编译块位置可行性有同文件先例：`App.vue:58-62` 的 `/* #ifdef APP-PLUS */` 与 `App.vue:11-16` 的 `// #ifndef MP-WEIXIN`（注释自述"口径与 `components/app-tab-bar.vue` 保持一致：`#ifndef MP-WEIXIN`，不是只盖 APP-PLUS"）⇒ 本单沿用既定口径，未新造手法。

新增守卫：`app-mobile/scripts/guard-mp-style-selectors.mjs`（卡 §二.3）——三模式 `--src`（源码，识别条件编译隔离）/ `--dist <目录>`（产物 WXSS）/ `--self-test`（自检分辨力）。**未接进 `check:gates`，也未加 npm script**：与 29F3 裁定 3 同口径（是否接入属防回归治理，待凌舟裁定）。运行方式：`node app-mobile/scripts/guard-mp-style-selectors.mjs`（无参默认 `--src`）。

## 二、每个文件证明什么

| 文件 | 命令 | 读数 |
|:--|:--|:--|
| `raw/10-before-src-scan.txt` | `node …guard… --src`（**修复前**） | 命中 3 / **未隔离 3** ⇒ `SRC_FAIL` / EXIT=1 |
| `raw/11-before-dist-scan.txt` | `node …guard… --dist dist/build/mp-weixin`（**修复前**） | 命中 3：`app.wxss` 两条 `*,*:before,*:after` + `pages/sales/create-sale.wxss` 一条 `.create-sale-page *.data-v-*` ⇒ EXIT=1 |
| `raw/20/22/23-after-build-*.txt` | `npm run build:mp-weixin` / `build:h5` / `build:app`（**修复后**） | 三者均 `DONE Build complete.` + **EXIT=0**（硬验收 1） |
| `raw/21-after-dist-scan.txt`、`raw/25-after-dist-scan-recheck.txt` | 修复后产物扫描（两次独立跑） | **`*` 通配 prelude = 0** ⇒ `MP_STAR_GUARD_DIST_PASS` / EXIT=0（硬验收 2 前半） |
| `raw/24-positive-control-and-h5-preservation.txt` | `node docs/evidence/mobile-28f1/anti/20-positive-control-and-h5-preservation.mjs` | A 正对照注入被扫出（EXIT=0=控制全通过）；B 真实产物 0 命中；C H5 四处行为 PRESENT；D 源码 3 处全部"已隔离"（硬验收 2 后半 + 硬验收 3） |
| `raw/26-guard-self-test.txt` | `node …guard… --self-test` | `{"ok":true,"positiveHits":1,"negativeHits":0,"mediaInnerHits":1,"keyframeFalseHits":0,"atOnlyHits":0}` ⇒ 守卫**非恒绿** |
| `raw/27-after-src-scan.txt` | 修复后源码扫描 | 命中 3 / **未隔离 0** ⇒ `MP_STAR_GUARD_SRC_PASS` / EXIT=0 |
| `raw/28-gates-check.txt` | `npm run check:gates` | **EXIT=0**：type 0（基线 0）；lint error 0 / warning 12872（均等于基线）；**`Test Files 16 passed` / `Tests 329 passed`**（16/329 不降）；contract 差集 1 条全具名豁免；guard A/B/C/D 绿 |
| `raw/29-wechat-cli-probe-not-run.txt` | `Test-Path` × 4 安装路径 + `where.exe cli.bat/wechatide` + 目录列举 | **本机无微信开发者工具 CLI ⇒ preview 未执行**（硬验收 4：如实记未验，不写"运行通过"） |
| `anti/20-positive-control-and-h5-preservation.mjs` | — | 控制装置本体（可复跑；只 import 守卫判据） |

## 三、正对照的实现口径（如实说明）

卡 §三.2 要求"正对照注入后扫描必红"。本单做法是：**把真实 `app.wxss` 复制到临时目录**再追加 `.injected-positive-control-28f1 *{color:red}`，用**同一个扫描器**扫该临时目录 ⇒ 命中 1 并点名注入行；真实 `dist/` **不写入**（避免污染产物、避免与"真实产物 0 命中"互相干扰）。⇒ 证明"命中 0"来自修复，而不是扫描器失灵。

## 四、MP 侧行为影响（如实标注证据等级）

修复前 `*, …` 规则**确实进了 MP 产物**（`raw/11` 三条命中），但按卡 §一"已知事实"（凌舟 preview 报 `unexpected token '*'`、仓库外仅替换这些 token 后得到 `✔ preview`），微信侧对该文件的解析本就失败 ⇒ 这些规则在 MP **从未生效**。本单把它们隔掉，MP 侧不产生"失去有效样式"的行为变化。
⚠️ 该结论的**运行态证据来自凌舟的 preview 实测（卡面既有事实）**，本单**未能在本机复现 preview**（无 CLI，见 `raw/29`），故本条为**推断 + 引用**，不是本单实测。
