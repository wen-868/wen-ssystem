# R101-QODER-17-回传 · `--safe-top` 自引用修复

> 汇报对象：凌舟（派单人）｜汇报人：Qoder（移动端执行子代理）｜日期：2026-10-20
> 对应派单编号：QODER-17（任务书 `docs/tasks/inbox/QODER-17-safe-top-css.md`，主仓原件，本工作树只读引用）
> 所有判据读数均为**执行方自评**，不构成验收结论。

## 〇 基线与提交

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-17`｜分支 `fix/qoder-17-safe-top`｜基线 `321b4f6b`（= 本地 `origin/main`）。
- 提交：
  - `e1288787`（impl）= `fix: QODER-17 App.vue --safe-top 自引用改为 env(safe-area-inset-top) 并新增静态断言用例`（2 文件：`app-mobile/src/App.vue`、`app-mobile/tests/safe-top-var.spec.ts`）。
  - docs 笔 = 本卡 + 回执 + `docs/evidence/qoder-17/**`（`git log` 最新一笔；**写卡时本笔哈希不可知**，如实标注）。
- 未 push、未开 PR（`git status -sb` 无 upstream 推进）。

## 一 修法 × 读数总表

| # | 改动 | 判据 | 自评读数 |
| --- | --- | --- | --- |
| 1 | `App.vue:54` 默认分支 `--safe-top: var(--safe-top);` ⇒ `--safe-top: env(safe-area-inset-top);` | 静态断言①② | 修前红（raw/05，EXIT=1）⇒ 修后绿（raw/06，EXIT=0） |
| 2 | `:59` `#ifdef APP-PLUS` 覆盖 `var(--status-bar-height)` **原样保留** | 静态断言③ | 绿；产物侧被条件编译正确剔除（raw/10） |
| 3 | 新增 `app-mobile/tests/safe-top-var.spec.ts`（3 用例真断言） | test | 基线既有用例 0；本单新增 1 文件 / 3 用例全过 EXIT=0 |
| 4 | 全量门禁 | type-check / lint / build | 0=0（EXIT=0/0）；lint 逐规则不劣化（190/20/12880 两次一致）；build:h5 EXIT=0 |
| 5 | H5 computed 取证（R8.1） | 任务书 §三 | `uni-page-body` 上 `--safe-top` = `0px` 可解析非空；活体反证：自引用 ⇒ 空串（browser/01、02） |

## 二 判据自评（任务书逐条 + 证据文件号）

任务书 §三逐条（原始输出见 `docs/evidence/qoder-17/raw|anti|browser/`，README 有索引表）：

1. **静态断言三条** ⇒ `app-mobile/tests/safe-top-var.spec.ts`：① 全文 `not.toMatch(/--safe-top:\s*var\(--safe-top\)/)`；② `#ifdef APP-PLUS` 之前的默认分支 `toMatch(/--safe-top:\s*env\(\s*safe-area-inset-top\s*\)/)`；③ APP-PLUS 块内 `toMatch(/--safe-top:\s*var\(\s*--status-bar-height\s*\)/)`。三条均为真断言：跑在未修复基线上 ①② 红（raw/05），非空转。证据：raw/05、raw/06。
2. **反测（门必须能红）** ⇒ 协议 §3 原子单命令：注入前 SHA256（anti/00）⇒ scratch `.mjs` latin1 逐字节把 :54 改回 `var(--safe-top)`（命中≠1 即 exit 9）⇒ vitest **EXIT=1**、断言①点名（anti/01）⇒ `cp` 复原 ⇒ SHA256 与注入前**逐字节一致** `7b8d33bd…`（anti/02 MATCH-OK）⇒ 复跑 **EXIT=0、3 passed**（anti/03）。
3. **test 不劣化** ⇒ 基线 `tests/` 不存在、既有用例 0；本单新增 1 文件 / 3 用例全过（raw/06，EXIT=0）。**未**对齐链上 56 用例口径（见 §五）。
4. **type-check 0=0** ⇒ `vue-tsc --noEmit` 改前（raw/01）与改后（raw/02）均 EXIT=0、错误 0 条。
5. **lint 不劣化** ⇒ 同一 harness 全仓两遍（raw/03 前 / raw/04 后）：files=190 / error=20 / warning=12880 两次完全一致；11 条逐规则计数逐项 after ≤ before（比较脚本输出 `PER-RULE-NOT-DEGRADED: OK`，eslint EXIT=1 系基线既有 20 error，非本单引入）。CSS 本不在 eslint 扫描面，仍按派单实测两遍。
6. **build:h5 EXIT=0** ⇒ raw/07（DONE Build complete. EXIT=0）；产物 `app-mobile/dist/build/h5`（gitignore，不入库）。
7. **H5 computed 取证** ⇒ browser/01：`getComputedStyle(uni-page-body).getPropertyValue('--safe-top')` = **`0px`，可解析、不为空串；桌面浏览器 env() 解析为 0px 属正常**（任务书预置口径）。使用点 `.login-page`（login.vue:326）实测 `padding-top: 0px`。活体反证 browser/02：运行时注入自引用 ⇒ computed 变**空串** ⇒ 移除复原回 0px——用 computed 值坐实「自引用按定义即无效」。运行时匹配规则 browser/03。截图未产出（无可见浏览器表面），见 browser/screenshot-blocked.note.txt + §七。
8. **App 真机** ⇒ 无设备，**未验**（§七），未写通过。

## 三 逐条明细

- **改动行（唯一业务改动）** `app-mobile/src/App.vue:54`：
  - 前：`  --safe-top: var(--safe-top);`
  - 后：`  --safe-top: env(safe-area-inset-top);`
- **靶点分支确认（派单要求先读 :30-75）**：`:49-55` 的 `page{}` 规则**不在任何条件编译块内**（`/* #ifdef/#ifndef */` 均无覆盖到它），即默认分支，H5/小程序共用；`:57-61` 才是 `/* #ifdef APP-PLUS */` 覆盖块（内含 `:59` `var(--status-bar-height)`，原样保留）。全 `app-mobile/src` 仅 App.vue 有 `--safe-top:` 定义（grep 两处即 :54/:59）。
- **使用点统计（任务书 §三第 3 条点名回传）**：`grep -rn "var(--safe-top)" app-mobile/src` 命中 **97 处，分布于 90 个文件**（清单 raw/08）；本单**零改动**任何使用点。
- **env() 单值不叠 `constant()` 的理由**：仓内既有 `constant(safe-area-inset-top)`+`env()` 双行风格（uni.scss:269-270 `.safe-top` 类）只适用于**普通属性**（后者按解析顺序覆盖前者）。放到**自定义属性**定义上不可靠：两条同名声明后者恒赢，`constant()` 行形同虚设；且自定义属性在 computed-value 期才解析函数，不支持时按 IACVT 失效，双行模式在变量定义场景不提供任何老 iOS 兜底。故 `env(safe-area-inset-top)` 单值即是正确形态，也与原注释「H5/浏览器用 env」的作者意图一致。
- **未动项**：布局数值、页面结构、导航组件、`index.html` viewport 均未改（viewport-fit 问题见 §七）。

## 四 反测（门必须能红）

结论：**门能红，且红得点名**。完整三段见 anti/：

1. 红：`01-inject-selfref-red.txt` —— 注入 :54=`var(--safe-top)` 后 vitest `EXIT=1`，`× ① 不得出现自引用 --safe-top: var(--safe-top)`（附带②也红，因 env 定义被换掉），2 failed | 1 passed。
2. 复原：`02-restore-sha256.txt` —— `cp` 复原后 SHA256=`7b8d33bd68232782339f9194984d2ebb2fd4cac892ecdff5403434c54a11b013` 与 `00-pre` 逐字节一致（未用 `sed -i`，CRLF 无归一风险）。
3. 绿：`03-restore-green.txt` —— 复原后 `EXIT=0`、3 passed。

另有一层浏览器侧活体反证（不触文件）：browser/02。

## 五 口径偏差报备（任务书文字 vs 仓库事实）

1. **基线无门禁设施**：`321b4f6b` 的 app-mobile 无 `tests/`、无 `vitest.config.ts`、无 `.eslintrc.cjs`、`package.json` 无 test/lint/type-check 脚本。等价装置按协议 §2 借入链上 `9fd90257` 的两份配置 + 直调 junction 内工具入口：
   - 用例：`cd app-mobile && node ../node_modules/vitest/vitest.mjs run`
   - 类型：`node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit`
   - 静态：`node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue`（json 全量落盘外 scratch `D:/Users/ZXQL/wt-agents/_scratch/qoder-17/`，仓内只落计数摘要）
   - 构建：`npm --workspace app-mobile run build:h5`（工作树根）
   - 借入文件**未提交**，最后一轮读数后已删除（见 §六）。
2. **test 口径**：报「基线无既有用例（0 个），本单新增 1 文件 / 3 用例全过」，**不**声称对齐链上 56 用例。
3. **computed 作用域**：任务书点名脚本 `getComputedStyle(document.documentElement)` 实测返回**空串**——非缺陷复发，而是 uni-app H5 把 `page` 选择器编译为 `uni-page-body`（产物 `assets/index-DpZdr1mN.css`，变量定义本就不在 `:root`；该作用域基线即如此，本单不改）。判定改以**定义所在元素** `uni-page-body` 及其后代的 computed 值为准（= `0px`，可解析非空），并附运行时匹配规则佐证。如实报备，不粉饰。
4. **行号**：任务书 :54/:59 与工作树实测一致，无漂移。
5. 我侧改前实测与协议 §2.3（QODER-14 交叉核对值）逐项一致：tc EXIT=0 零错；lint 190/20/12880（vue/html-indent=12299 含于内）。

## 六 红线对照

- 未 push、未开 PR：`git log --oneline origin/main..HEAD` 有本地两笔，`git status -sb` 无 upstream 推进。✔
- 未 `git add -A`：逐文件 add（impl 笔 2 文件；docs 笔逐路径 add）。✔
- 只动本工作树本分支；主仓工作树与其它 `wt-agents/*` 未触碰；任务书原件未修改。✔
- 未 `npm install/uninstall`、未改任何 `package.json`/appid/支付/推送/插件配置。✔
- 借入 harness（`vitest.config.ts`、`.eslintrc.cjs`）与 scratch 未提交、交付前已删除；`App.vue.orig` 备份已清；`dist/` 不入库。✔
- 提交消息 `type: 中文描述`；本地提交 2 笔 ≤3。✔
- 全角字符/路径转换陷阱：grep 前 `export MSYS2_ARG_CONV_EXCL='*'`，echo 串加引号；反测复原用 `cp` 非 `sed -i`。✔

## 七 未完成与阻塞

1. **`index.html` 缺 `viewport-fit=cover`（登记提请后续单，本单未改）**：`app-mobile/index.html:5` meta viewport 仅 `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`，产物 index.html 同样无 viewport-fit（grep=0，证据 raw/09、raw/10）。后果：**真机刘海机上 `env(safe-area-inset-*)` 恒为 0**，本单修复使「自引用无效 ⇒ 定义有效可解析」达标，但 H5/小程序真机拿到非零安全区高度还需 viewport-fit=cover。修复属 viewport 变更（涉全屏布局位移风险），超出本单「只修根变量定义」边界，**按派单不擅自改**，提请凌舟裁定后续单。复现取证命令见 browser/screenshot-blocked.note.txt。
2. **App 真机未验**：无 iOS/Android 设备，`#ifdef APP-PLUS` 覆盖仅静态断言③兜住，运行时 `--status-bar-height` 注入未实测。**不得据本卡判 APP 端通过**。
3. **浏览器截图未产出**：take_screenshot 连续两次 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`（in-app 浏览器无可见表面）。computed 取证不受影响（evaluate_script 正常），截图项标**未验**。
4. 微信/支付宝小程序端 env() 行为未实测（无小程序运行环境），仅静态断言。

## 八 风险与自我报备

- **风险 1（低）**：默认分支 env 单值不含 `constant()`——如前所述自定义属性上双行模式无兜底语义，老 iOS(<11.2) 上该变量将拿不到值（回退继承/初始值），与原自引用同状但不再影响现代机型；若需老 iOS 兜底应在**使用点**（普通属性）写 constant+env 对，超出本单范围。
- **风险 2（提请注意）**：§七-1 viewport-fit 未解决前，H5 真机刘海机上页头安全区仍拿不到高度（env=0），视觉表现与修复前桌面一致、真机仍可能顶进信号栏——这不是本单能闭环的，已给证据与复现命令。
- 自评偏差披露：反测首轮 `EXIT=` 行误捕获 sed 管道状态（恒 0），已按「直接重定向再剥 ANSI」重做取证（anti/01 现为 EXIT=1 真实读数）；无其他读数伪造风险点。
- 本卡所有「绿/不劣化」均为执行方自评，验收权在凌舟。

## 九 交付物与证据清单

- 代码：`app-mobile/src/App.vue`（1 行）、`app-mobile/tests/safe-top-var.spec.ts`（新增，3 用例）。
- 回传卡：`docs/tasks/cards/R101-QODER-17-回传.md`（本文件）。
- 回执：`docs/tasks/inbox/ACTIVE-回执-QODER-17.md`（含 DSH-RECEIPT 围栏块）。
- 证据：`docs/evidence/qoder-17/README.md` + `raw/01…11` + `anti/00…03` + `browser/README.md、01…03、screenshot-blocked.note.txt`。
- 盘外（不入库）：`D:/Users/ZXQL/wt-agents/_scratch/qoder-17/`（eslint 全量 json×2、原始日志、注入 .mjs）；`app-mobile/dist/build/h5`（gitignore 产物）。

## 十 一行摘要

`App.vue:54` 自引用 `--safe-top: var(--safe-top)` 改为 `env(safe-area-inset-top)`（APP-PLUS 覆盖保留、97 处使用点零改动）；静态断言门修前红修后绿 + 反测红/SHA 复原/绿三段齐；type 0=0、lint 逐规则不劣化、build:h5 绿、H5 computed 实测 `0px` 可解析（桌面 0 属正常）；viewport-fit=cover 缺失与真机、截图三项如实标未验/提请后续单。
