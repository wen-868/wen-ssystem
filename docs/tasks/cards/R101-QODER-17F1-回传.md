# R101-QODER-17F1-回传 · `index.html` 补 `viewport-fit=cover` + 常驻门禁重栈

> 汇报对象：凌舟（总负责人／派单人）
> 汇报人：Qoder（移动端执行方）｜2026-10-21
> 对应派单编号：QODER-17F1（任务书原件 `docs/tasks/inbox/QODER-17F1-safe-top-viewport.md`，只读引用，未修改未删除）
> 格式依据：共享协议 `_qoder-restack-exec-protocol-20261021.md` §5 十项 + `docs/tasks/派单规范.md` §三（S1 署名三项齐）
> 本文所有读数均为**执行方自评**，不构成验收结论；卡内「裁定」段落是**引用派单方原文**，非执行方判词。

【一句话结论】`app-mobile/index.html:5` viewport 追加 `viewport-fit=cover`（唯一改动行），静态断言门新增独立用例④点名该口径，常驻四门全绿（test 实测 **6 文件 / 60 用例**）、`build:h5` EXIT=0 且**产物 index.html 里回读到 viewport-fit=cover**；两条反测均能红并点名、`cp` 复原 SHA256 逐字节一致；桌面 H5 computed 在新基线上重做（`uni-page-body` 上 `--safe-top` = `0px` 可解析非空），iOS 真机与 App 端运行时**仍未验**。

---

## ① 基线与提交

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-17`｜分支 `fix/qoder-17f1-safe-top-viewport`（本轮未 rebase、未切分支、未碰 git 历史，按派工指令）。
- 代码基线 `dfeedbc0`（#368 合并后的 main）｜`origin/main` = `21b465e5`（其后仅 2 笔 docs，口径见协议 §1：本轮 main 已含常驻门禁）。
- 开工前分支 HEAD：`6e714beb`（旧 5 笔 rebase 到 `dfeedbc0` 后的链顶；其中 `e3a4a7d0` 带来 `App.vue:54` 的 `--safe-top: env(safe-area-inset-top)` 修复）。
- 本单新增提交（**2 笔实现 + 文档笔，见下表**）：

| 哈希 | 类型 | 内容 | 文件 |
| --- | --- | --- | --- |
| `6bd830d9` | impl | `fix: QODER-17F1 index.html viewport 补 viewport-fit=cover 并新增静态断言④（tests 基线实测 6/60）` | `app-mobile/index.html`、`app-mobile/tests/safe-top-var.spec.ts`、`app-mobile/scripts/gates-baseline.json`（逐文件 add，3 文件） |
| docs 笔（本卡落地那笔，哈希见回执 DSH 块） | docs | `docs: QODER-17F1 回传卡+回执+证据` | `docs/tasks/cards/R101-QODER-17F1-回传.md`、`docs/tasks/inbox/ACTIVE-回执-QODER-17F1.md`、`docs/evidence/qoder-17f1/**` |
| docs 笔 2 | docs | `docs: QODER-17F1 收尾自检输出（协议 §7）` | `docs/evidence/qoder-17f1/raw/11-final-selfcheck-before-commit.txt`、`raw/12-closing-check-after-commit.txt` |

- 未 push、未开 PR；`git log --oneline origin/main..HEAD` 笔数与哈希见 `raw/11`、`raw/12`。
- **ref（协议 R8.2）= `fix/qoder-17f1-safe-top-viewport` @ `6bd830d9`（实现笔）**；docs 笔哈希在回执 DSH-RECEIPT 的 `commits:` 行给出。

## ② 修法 × 读数总表

| # | 动作（卡 §二逐条） | 判据 | 自评读数 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | `index.html:5` viewport content 追加 `, viewport-fit=cover`（**只这一行、只这一个键值**，其余 meta/格式未动） | 源码 + 产物字符串 | 源文件第 5 行含该键值；`grep -c viewport-fit=cover` = 1；产物 `dist/build/h5/index.html:7` 同串 | raw/04、raw/06 |
| 2 | 新增断言：viewport 同时含 `width=device-width` 与 `viewport-fit=cover`（做成**独立第 4 条 `it`**） | test | 常驻 `npm run test` 6 文件 / **60** 用例全绿；断言④单独可红 | raw/02、anti/01 |
| 3 | `gates-baseline.json` **只动 `tests`** ⇒ 实测 `6/60` + note 留痕 | test 门 | 门打印「当前 6 文件 / 60 用例，基线 6 / 60」⇒ 实测即基线；lint/typeCheck/checkContract/contractDrift 四段一字未动 | raw/02、§⑤-2 |
| 4 | 常驻四门全跑（`cd app-mobile && npm run …`，无任何借入装置） | 卡 §三 | type-check EXIT=0（错误 0=0）；lint EXIT=0（error 20 / warning 12872，逐规则与冻结基线**逐项相等**）；test EXIT=0（6/60）；check:contract EXIT=0 | raw/01、raw/02、raw/03 |
| 5 | `build:h5` + 产物 viewport 回读（"配置进产物"直证） | 卡 §三 | `npm --workspace app-mobile run build:h5` **EXIT=0**；产物 viewport 串带 `viewport-fit=cover`（命中 1） | raw/05、raw/06 |
| 6 | H5 computed 取证在新基线重做 | 协议 §AGENTS R8.1 | `uni-page-body` computed `--safe-top` = **`0px`（可解析、非空串）**；使用点 `.login-page` `padding-top` = 0px；运行时 viewport meta 带 cover（DOM 里 1 份）；层叠规则：定义唯一 + 活体自证（注自引用 ⇒ `''`，移除 ⇒ `0px`） | browser/01、03 |
| 7 | 运行时 viewport-fit 注入/移除对照（桌面） | 卡 §二.4 | 三态 computed **全 `0px`**（`desktop_identical=true`）⇒ **桌面不能鉴别 viewport-fit**，只作局限登记，真机差异**未验** | browser/02 |
| 8 | 反测 1（必做）：删 `viewport-fit=cover` | 门能红 | `npm run test` **TEST_EXIT=1**，FAIL 点名「④ viewport meta 必须同时含 `width=device-width` 与 `viewport-fit=cover`」，1 failed / 59 passed ⇒ `cp` 复原 sha256 `dd221de3…` **逐字节一致** ⇒ 复跑 **TEST_EXIT=0、6/60** | anti/00…03、08 |
| 9 | 反测 2（建议补，已做）：`App.vue:54` 注回自引用 | 门能红、断言互不粘连 | **TEST_EXIT=1**，①②两条红（2 failed / 58 passed），**同一次运行里④保持绿** ⇒ 复原 `7b8d33bd…` 一致 ⇒ 复跑 6/60 绿 | anti/04…07、08 |
| 10 | 使用点零改动复核 | 红线 | 源码 `var(--safe-top)` = **96 处 / 89 文件**（与旧目录 `qoder-17/raw/13` 负责人复核值逐项一致，**无差异需报备**）；产物侧同数 96 | raw/08、raw/07 |

## ③ 逐条实现说明

1. **`app-mobile/index.html`（1 行）**：第 5 行（全文唯一 viewport meta）

   ```
   前：<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
   后：<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
   ```

   键值追加在 content 末尾（逗号分隔，与既有三项同形态），`charset` / `apple-mobile-web-app-capable` /
   `apple-mobile-web-app-status-bar-style` / `title` / `link icon` / `#app` / `/src/main.js` 逐字未动
   （`git diff` 该文件 = 1 行改，raw/04 有全文）。缩进 4 空格、CRLF 行尾保持原形态。

   **为什么这一行是根因**：`App.vue:54` 的 `env(safe-area-inset-top)` 在 iOS webview 里只有在
   viewport 声明 `viewport-fit=cover`（内容铺到刘海/圆角区）时才可能拿到非零值；缺该键值时 env 恒解析 0，
   所以上一轮的修复"定义有效但取不到值"。卡 §一 裁定原文（引用派单方，非执行方判词）：
   「`--safe-top: env(safe-area-inset-top)` 修复本身正确，但 `app-mobile/index.html` 缺少 `viewport-fit=cover`，
   iOS 真机仍会得到 0。两处同属安全区根链，本卡必须一起收口。」出处：任务书 §一。

2. **`app-mobile/tests/safe-top-var.spec.ts`**：文件头注释补「QODER-17F1 · 追加第 4 条断言」段（写明根因与"单独成一条 it"的理由）；
   新增 `indexHtml` 读取（`new URL('../index.html', import.meta.url)`），新增**独立 describe**
   `QODER-17F1 index.html viewport（安全区根链另一半）`，内含单条 `it('④ viewport meta 必须同时含 width=device-width 与 viewport-fit=cover')`：
   先断言 viewport meta **只有 1 份**（多份时优先级不可控、口径会漂），再对该条 meta 文本分别 `toMatch(/width=device-width/)` 与
   `toMatch(/viewport-fit=cover/)`。①②③ 三条既有用例一字未改（含 `#ifdef APP-PLUS` 覆盖断言③）。

3. **`app-mobile/scripts/gates-baseline.json`**：**只改 `tests` 段** `testFiles 5→6`、`testCount 56→60`，
   `note` 追加一句留痕（谁、为什么、从几到几、与卡内 59 的差异指向本卡 §⑤-2）。
   `lint` / `typeCheck` / `checkContract` / `contractDrift` 四段**一字未动**（协议 §2：本轮唯一允许上调的数就是 tests）。

4. **未动项**（红线对照见 §⑥）：`App.vue:54` 的 env 定义与 `:57-61` `#ifdef APP-PLUS` 覆盖（`:59` `var(--status-bar-height)`）**原样保留**；
   96 处 `var(--safe-top)` 使用点零改动；`index.html` 除 viewport 外无一处改动；`backend/` 零改动。

## ④ 测试 / 门读数（常驻门禁，命令一律 `cd app-mobile && npm run <gate>`）

改前（HEAD=`6e714beb`，index.html 尚无 cover、基线仍 5/56）—— `raw/01`：

| 门 | 读数 | EXIT |
| --- | --- | --- |
| `npm run type-check` | vue-tsc EXIT=0，当前错误 0 条，基线 0 条 | 0 |
| `npm run lint` | 当前 error 20（基线 20）、warning 12872（基线 12872）；无新增 error、warning 未劣化 | 0 |
| `npm run test` | Test Files 6 passed (6)；Tests 59 passed (59)；「当前 6 文件 / 59 用例，基线 5 / 56」⇒ 打印"请调高" | 0 |
| `npm run check:contract` | 口径①292 / ②283 / ③204；后端注册 1498；差集 1 条、具名豁免 1 条 ⇒ missingAfterExemptions=0 | 0 |

改后（实现笔 `6bd830d9`）—— `raw/02`：

| 门 | 读数 | EXIT |
| --- | --- | --- |
| `npm run type-check` | vue-tsc EXIT=0，错误 **0=0**（tsconfig include 只覆盖 `src/**`，本单未动 src ⇒ 同态） | 0 |
| `npm run lint` | error **20**（基线 20）/ warning **12872**（基线 12872）⇒ EXIT=0；逐规则快照（raw/03，eslint 全量 json，仅作取证）：files=187、`vue/html-indent=12299`、`no-console=225`、`vue/html-closing-bracket-spacing=196`、`@typescript-eslint/no-unused-vars=104`、`vue/multiline-html-element-content-newline=47`、`vue/html-closing-bracket-newline=1`、`errorsByFileRule` 13 对 ⇒ **与冻结基线逐项相等，无一条劣化** | 0 |
| `npm run test` | Test Files **6 passed (6)**；Tests **60 passed (60)**；「当前 6 文件 / 60 用例，基线 6 / 60」⇒ 实测即基线，无"请调高"提示 | 0 |
| `npm run check:contract` | 同上（292/283/204、1498、差集 1 全豁免） | 0 |
| `npm --workspace app-mobile run build:h5`（工作树根） | `DONE Build complete.`，产物 viewport 带 cover | **0** |

与负责人同基线参考读数（`_scratch/qoder-restack-gatecheck/`）逐项核对：type-check 0=0 ✔、lint error 20 / warning 12872 / `vue/html-indent` 12299 ✔、contract EXIT=0 ✔；test 6/59（改前）→ 6/60（本单 +1 条断言）✔。

## ⑤ 口径偏差报备（卡内文字 vs 实测；协议 §2「实测即基线」）

> 本节即 `gates-baseline.json` tests.note 里所指的「卡 §五」与派工指令要求的「卡 §五 明确报备」——十项格式第 ⑤ 项 = §五，同一节。

1. **tests 实测 `6/60` vs 卡 §二.4 目标 `6/59`——差异 +1，来源已点名**：卡内 `5/56 → 6/59` 的算术只计入了上一轮的
   **原有 3 条用例**（main 5 文件/56 用例 + 3 = 59）。本单按卡 §二.3 与派工指令新增**第 4 条断言**，且指令明确「建议做成独立第 4 条 `it`
   （点名清晰、反测可精确打中）」——独立成 `it` ⇒ 用例数 +1 ⇒ 实测 60。
   协议 §2 要求"实跑数值与卡内目标不一致时如实报备并写实测值，不要为了对上卡里的数而改测试"，故 `gates-baseline.json` 写 **6/60**，
   **没有**为了凑 59 把 viewport 断言折进用例②（折进去会变成"一条 it 断两件事"，反测打点不再精确，且与派工指令相悖）。
   **若负责人认为必须严格 6/59**：把 `describe('QODER-17F1 …')` 里那条 `it` 的两个 `toMatch` 折回用例②即可（改动点唯一、可回退，
   执行方不擅自做，等裁定）。
2. **`gates-baseline.json` 的 tests 起点**：分支上此字段仍是 `5/56`（上一轮实现笔只加测试没同步基线，test 门当时靠"高于基线只提示"过关）。
   本单把它对齐到**实测 6/60**（同时覆盖上一轮漏调的 +3），note 里把 `5/56 → 6/59（QODER-17）→ 6/60（QODER-17F1）` 两步都留了痕。
3. **卡 §三「静态反测」与协议 §4 的执行差异**：注入手段按协议走工作树外 scratch `.mjs`（latin1 字节精确、命中≠1 即 exit 9），
   复原用 `cp`（禁 `sed -i`、禁用 Edit 删该功能行）；首轮脚本因 `/d/...` MSYS 路径 node 不识别而 `MODULE_NOT_FOUND`
   （**未触文件**，sha256/`git status` 双证），改 `D:/...` 后重跑，过程记录 `anti/09-…note.txt`。
4. **反测 1 复原后第一次复跑撞到无关 flake**：`tests/api-base-env.spec.ts:33` 报 `Test timed out in 5000ms`
   （同批串行连跑 4 次 vitest、机器高负载，那次 Duration 66.26s / import 116.10s）。红点**不在本单目标断言**上
   （那次 safe-top 四条全绿）。原始失败记录保留为 `anti/03a-…txt`，干净复跑（无并发）为 `anti/03-…txt`（TEST_EXIT=0、6/60）。
   登记为**既有用例的负载敏感 flake**，不属本单修复面，也未为此放宽任何基线。
5. **桌面 H5 无法鉴别 viewport-fit**：运行时摘掉/复原 `viewport-fit=cover` 三态 computed 全为 `0px`（`browser/02`）。
   本单据此**不**把 computed 读数写成"viewport-fit 已生效"，桌面判据只到「变量可解析非空 + viewport-fit 进了产物与运行时 DOM + 断言④能红」；
   真机非零与否仍属未验（§⑦）。
6. **旧证据目录并存**：`docs/evidence/qoder-17/`（含 raw/13「修后 96 处/89 文件」计数校订）**原样保留、未改写**；
   本单重测计数与其一致（96/89），**无差异需点名**。旧目录 raw/08 的 97/90 是修前快照（含被改掉的定义行），口径在旧 README 已标注。
7. **提交笔数**：本单 1 笔实现 + 2 笔 docs（协议 ≤3）；docs 拆两笔的原因是收尾自检必须在提交**前**与提交**后**各取一次读数（`raw/11`/`raw/12`），不能自指。

## ⑥ 红线对照（逐条）

- 未 push、未开 PR：全程无 `git push`；`git log origin/main..HEAD` 仅本地笔（`raw/11`、`raw/12`）。✔
- 未 `git add -A`：实现笔逐文件 add 3 个路径；docs 笔逐路径 add（`raw/12` 的 `git status` 为空亦证无漏项）。✔
- 不是凌舟、未写归属凌舟的判词：本卡只出现「执行方自评」「卡内目标读数」，引用卡 §一 裁定处已注明「引用派单方原文，非执行方判词」。✔
- 只动 `D:\Users\ZXQL\wt-agents\QODER-17`（本分支）：主仓 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem` 与其它 `wt-agents/*` 仅只读引用；
  盘外只写 `_scratch/qoder-17f1/`（大 json、注入脚本、截图原图，不入库）。✔
- 任务书原件未修改未删除；未动 `ACTIVE.md`；`docs/tasks/inbox/` 只新增本单回执一份。✔
- 未 `npm install/uninstall`、未改任何 `package.json` 依赖与 lockfile（常驻 harness 本就入库，无借入无删除）。✔
- `gates-baseline.json` 只动 `tests`；`lint`/`typeCheck`/`checkContract`/`contractDrift` 未放宽。✔
- 97/96 处使用点零改动：本单未触碰 `app-mobile/src/**`（`git status --porcelain -- app-mobile/src` 空，`raw/08`、`anti/06`）；
  计数实测 96 处/89 文件。✔
- `#ifdef APP-PLUS` 覆盖（`App.vue:59` `var(--status-bar-height)`）保留，静态断言③绿；H5 产物侧该覆盖被条件编译剔除（命中 0，`raw/07`），符合预期。✔
- 提交消息 `type: 中文描述`（`fix:` / `docs:`）。✔
- `rg`/`grep` 取证前 `export MSYS2_ARG_CONV_EXCL='*'`（协议 §3，防假 0 命中）；`--safe-top:` 用 `grep -- ` 防参数误解析。✔

## ⑦ 未完成与阻塞

1. **iOS 真机 `env(safe-area-inset-top)` 是否变非零：未验**（无 iPhone/iPad 设备，无微信开发者工具）。
   本单能证的是「viewport-fit=cover 进了源码、进了产物、进了运行时 DOM，且断言④能红」，**不能**据此判真机通过。
   复现：iOS Safari/WKWebView 打开部署后的 H5，控制台执行
   `getComputedStyle(document.querySelector('uni-page-body')).getPropertyValue('--safe-top')`，
   或临时把 `.login-page` 的 `padding-top` 改成 `calc(var(--safe-top) + 20px)` 目视页头是否避开刘海；
   同一 URL 在真机上把 meta 里 `viewport-fit=cover` 手动去掉再对比，即为差异读数。
2. **App 端（`#ifdef APP-PLUS` + `--status-bar-height`）运行时：未验**（无安卓/iOS 设备与 HBuilderX 真机调试）；仅静态断言③与产物侧条件编译剔除读数。
3. **小程序端（微信/支付宝）env() 与 viewport 口径：未验**（无小程序运行环境）；本单只动 H5 模板 `index.html`，
   `miniapp/`、`platform-miniapp/` 未触碰（`git diff --name-only` 可核）。
4. **登录态整页 E2E、真机截图目视：未验**（本次桌面截图 `browser/screenshot-h5-login-desktop.png` 是**桌面视口**，
   env=0，对 viewport-fit 无鉴别力，不能代替真机截图）。
5. **无阻塞项**：本轮未遇到需要越界（改后端/改 package.json/推远端/开 PR）才能继续的情形。

## ⑧ 自我报备与踩坑

- **踩坑 1（已解决并留痕）**：反测脚本首版用 Git Bash 的 `/d/...` 路径传给 `node` ⇒ `MODULE_NOT_FOUND`，注入未执行。
  脚本内置「注入 EXIT≠0 ⇒ 立刻 `cp` 复原并退出」救回了流程，事后 sha256 与 `git status` 双证文件未被动过（`anti/09-…note.txt`）。
  给下一单：**凡把路径交给 node 的 bash 脚本，一律用 `D:/...` 正斜杠 Windows 形态**，`MSYS2_ARG_CONV_EXCL='*'` 只解决参数转换、不解决 node 认路径。
- **踩坑 2（不掩盖）**：反测 1 复原后第一次复跑是红的（`api-base-env` 用例超时）。我**没有**把它当"绿"写，也没有为它放宽任何基线，
  而是保留失败原始输出（`anti/03a`）+ 无并发重跑取干净读数（`anti/03`）+ 在 §⑤-4 点名根因（同批 4 次 vitest 连跑、机器负载）。
  存疑处如实说：该 flake 是否只在高负载下出现，本单未做复现压力测试，属**未定性**。
- **口径自查**：`viewportMetas.length === 1` 这条附加断言是我加的（卡 §二.3 只要求"同时含两个键值"）。
  理由写在 §③-2：多份 viewport meta 会让"哪份生效"不可控。**这是我主动扩大断言强度的一处，若负责人认为越界可删**（删除只影响该条 it 内部，不影响 60 的用例计数）。
- **自我报备**：`gates-baseline.json` 里我一次把 tests 从 5/56 调到 6/60（含上一轮漏调的 +3）。
  这不是"为凑绿改基线"——test 门方向是**只准升**，且 6/60 是 `npm run test` 的实测打印；但确实一次跨了两轮的增量，已在 note 与本卡 §⑤-2 分步留痕。
- 未做反测覆盖的项：`viewportMetas.length===1` 这个子断言我没有单独做"多份 viewport ⇒ 红"的反测（只反测了 viewport-fit 缺失 ⇒ ④红）。
- 本卡所有"绿/不劣化/达成"均为执行方自评，验收权在凌舟。

## ⑨ 复现命令

```bash
WT=/d/Users/ZXQL/wt-agents/QODER-17
REF=fix/qoder-17f1-safe-top-viewport   # 实现笔 6bd830d9（R8.2：未给 ref 的验证结论无效）

# 0) 门面：确认分支与改动面
cd "$WT" && git rev-parse --abbrev-ref HEAD && git log --oneline origin/main..HEAD
git diff --name-only 6e714beb..HEAD          # 应只有 3 个 app-mobile 文件 + docs/evidence + docs/tasks
git diff --name-only dfeedbc0..HEAD -- backend/   # 应为空

# 1) 常驻四门（协议 §1：入口只有 npm run，禁止自拼 vitest/eslint 命令绕过包装器）
cd "$WT/app-mobile"
npm run type-check;      echo "EXIT=$?"      # 期望 0，错误 0=0
npm run lint;            echo "EXIT=$?"      # 期望 0，error 20 / warning 12872 不劣化
npm run test;           echo "EXIT=$?"      # 期望 0，6 文件 / 60 用例，基线 6/60
npm run check:contract; echo "EXIT=$?"      # 期望 0，missingAfterExemptions=0

# 2) 构建 + 产物 viewport 直证（卡 §三"配置进产物"）
cd "$WT" && npm --workspace app-mobile run build:h5; echo "BUILD_EXIT=$?"
grep -n viewport app-mobile/dist/build/h5/index.html   # 期望串尾带 viewport-fit=cover
grep -rc -- "--safe-top: env(safe-area-inset-top)" app-mobile/dist/build/h5/assets/index-*.css

# 3) 反测 1（红→复原→绿；协议 §4：禁 sed -i、禁 Edit 删功能行）
cd "$WT/app-mobile"
sha256sum index.html; cp index.html /d/Users/ZXQL/wt-agents/_scratch/qoder-17f1/index.html.bak
node D:/Users/ZXQL/wt-agents/_scratch/qoder-17f1/scratch-strip-viewport-fit.mjs "$WT/app-mobile/index.html"
npm run test; echo "EXIT=$?"                                # 期望 1，FAIL 点名「④ viewport meta …」
cp /d/Users/ZXQL/wt-agents/_scratch/qoder-17f1/index.html.bak index.html
sha256sum index.html                                        # 与注入前逐字节一致
npm run test; echo "EXIT=$?"                                # 期望 0，6/60

# 4) 反测 2（App.vue:54 注回自引用 ⇒ ①②红、④仍绿）
sha256sum src/App.vue; cp src/App.vue /d/Users/ZXQL/wt-agents/_scratch/qoder-17f1/App.vue.bak
node D:/Users/ZXQL/wt-agents/_scratch/qoder-17f1/scratch-inject-selfref.mjs "$WT/app-mobile/src/App.vue"
npm run test; echo "EXIT=$?"                                # 期望 1
cp /d/Users/ZXQL/wt-agents/_scratch/qoder-17f1/App.vue.bak src/App.vue && sha256sum src/App.vue
npm run test; echo "EXIT=$?"                                # 期望 0

# 5) H5 computed 取证（R8.1）
node D:/Users/ZXQL/wt-agents/_scratch/qoder-17f1/scratch-h5-server.js &   # 端口 5181，300s 自退
#   浏览器打开 http://127.0.0.1:5181/#/ 后控制台执行：
#   getComputedStyle(document.querySelector('uni-page-body')).getPropertyValue('--safe-top')  → "0px"
#   getComputedStyle(document.querySelector('.login-page')).paddingTop                        → "0px"（桌面 env=0）
#   document.querySelector('meta[name=viewport]').content                                     → 含 viewport-fit=cover
# 真机差异未验：需 iPhone/iPad 或 WKWebView 同一读数对照（见 §⑦-1）
```

## ⑩ 对下一单的建议

1. **viewport-fit 只能靠真机闭环**：本单把"配置进产物"与"静态断言能红"两条做到了头，剩下的 iOS 非零读数必须挂在**有设备的验收单**上
   （建议 QODER-11R 的 H5 手动验收里加一栏「iOS Safari 打开后读 `--safe-top` computed，带/不带 viewport-fit 各一次」），否则这类修复永远停在"逻辑正确、读数缺席"。
2. **`index.html` 的 viewport 与 `pages.json` 的 H5/App 配置存在双写风险**：本轮只动模板；若后续单要改 `apple-mobile-web-app-status-bar-style`
   （现为 `default`，与"内容铺到刘海"的 cover 语义有交互），建议**同一张卡**收口，别拆两轮——本轮就是拆两轮的代价（17 修定义、17F1 修 viewport）。
3. **`api-base-env.spec.ts:33` 的 5000ms 超时 flake 值得单独一张小卡**（把 `loadEnvModule()` 的动态 import 纳入 warm-up 或显式给 timeout）：
   它会污染任何反测的"复跑取绿"步骤，本轮就撞了一次（§⑤-4）。别用调基线掩盖它。
4. **独立 `it` 的用例计数代价要写进派单算术**：卡内 `6/59` 少算了"新增独立断言 = +1 用例"。建议后续卡直接写「目标 = 实测口径，允许 ±N 并说明」，
   避免执行方为对齐数字把两条断言折进一条（反测打点会变糊，正是本轮拒绝做的事）。
5. **常驻 harness 的形态已稳定**：四道门 + `check:gates` 串行 + `gates-baseline.json` 逐规则冻结，本轮全程无借入无删除，
   下一单照 `cd app-mobile && npm run <gate>` 三条即可，别再造临时装置。

---

## 附：交付物清单（协议 §5 四件套）

1. 回传卡（本文件）：`docs/tasks/cards/R101-QODER-17F1-回传.md`
2. 回执：`docs/tasks/inbox/ACTIVE-回执-QODER-17F1.md`（含 `===DSH-RECEIPT-BEGIN===…END===`）
3. 证据：`docs/evidence/qoder-17f1/README.md` + `raw/01…08、10…12` + `anti/00…09、03a` + `browser/README.md、01…03、screenshot-h5-login-desktop.png`
   （旧目录 `docs/evidence/qoder-17/**` 原样保留未改写）
4. 提交：`6bd830d9`（impl，3 文件）+ docs 笔（见回执 `commits:`）；终态 `git status` 空（`raw/12`）
