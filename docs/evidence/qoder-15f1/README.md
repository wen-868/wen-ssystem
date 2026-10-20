# QODER-15F1 证据目录 · 低价比较归一化 + 常驻门禁重栈

> 执行方：Qoder（移动端）子代理。本目录所有读数均为**执行方自评**，不是验收结论。
> 工作树 `D:\Users\ZXQL\wt-agents\QODER-15`｜分支 `fix/qoder-15f1-price-compare-restack`｜
> 代码基线 `dfeedbc0`（#368 合并后的 main）｜起点 HEAD `241f1f15`｜实现笔 `477acdca`。
> 日期 2026-10-21。

## 0 本轮与上一轮（`docs/evidence/qoder-15/`）的关系

- **旧目录一字未改**：`docs/evidence/qoder-15/**` 保持原样，本目录只新增。
- 上一轮修的是**显示层**（裸 `.toFixed()` 白屏 → `fmtAmount`）；本轮修的是**判定层**
  （`price-anomaly.vue:63` 的 `:class="{ 'price-danger': item.retailPrice < item.costPrice }"` → `isBelowCost`）。
- **与旧读数不一致处（点名）**：旧 `browser/render-demo-dom-readback.txt` 记 `dangerCount=2`，
  其中"零售价为 null"的行**被标红**——那是当时页面仍用裸 `<`（`null` 隐式转 0）造成的凭空标红，
  本轮同样数据形态（新目录 `browser/render-dom-readback-before-after.txt` 行4）标红消失。
  这不是旧证据写错，而是旧证据如实记录了当时的缺陷现场；本轮不覆盖、只并存。

## 1 门禁设施（本轮与上轮最大差异）

基线 `dfeedbc0` 起 `app-mobile/vitest.config.ts`、`.eslintrc.cjs`、`scripts/*.mjs`、`scripts/gates-baseline.json`
都是**已入库真文件**，四门一律 `cd app-mobile && npm run <gate>` 走包装器；本轮**未借入、未删除任何 harness**。

## 2 raw/ —— 四门 + 构建 + 逐规则 + rg 取证（每条含命令与 EXIT）

| 文件 | 内容 | 读数 |
| --- | --- | --- |
| `01-typecheck-pre.txt` | 改前 `npm run type-check` | EXIT=0，当前错误 0 / 基线 0 |
| `02-lint-pre.txt` | 改前 `npm run lint` | EXIT=0，error 20（基线 20）、warning 12872（基线 12872） |
| `03-test-pre.txt` | 改前 `npm run test` | EXIT=0，7 文件 / 100 用例（当时基线仍写 5/56 ⇒ 只提示"请调高"） |
| `04-check-contract-pre.txt` | 改前 `npm run check:contract` | EXIT=0，口径 292/283/204，注册 1498，差集 1 条全豁免 |
| `05-typecheck-post.txt` | 改后 | EXIT=0，0=0 |
| `06-lint-post.txt` | 改后 | EXIT=0，error 20 / warning 12872（与改前逐项相同） |
| `07-test-post.txt` | 改后 | EXIT=0，**7 文件 / 158 用例**全过 |
| `08-check-contract-post.txt` | 改后 | EXIT=0，三口径读数与改前一致 |
| `09-lint-per-rule-diff.txt` | eslint `-f json` 逐规则展开 vs 冻结基线 | 覆盖文件 **188**（本轮未新增 src 文件，故未 190→191）、warning 劣化规则 **0**、error 新增对 **0** |
| `10-build-h5.txt` | 仓库根 `npm --workspace app-mobile run build:h5` | **EXIT=0**（DONE Build complete） |
| `11-final-selfcheck.txt` | 协议 §7 收尾自检（采集于 docs 笔提交前，自指说明已写在文件头） | 本轮改动面 = 卡点名 5 文件；`backend/` 0 改动；gates-baseline 只有 tests 段三个键 |
| `12-rg-proof.txt` | rg 取证（已 `export MSYS2_ARG_CONV_EXCL='*'`） | 缺陷写法 0 命中；同类判定缺陷面 = 1 处已修 / 0 处仍受影响；范围外裸 `.toFixed` 38 文件 106 处 |
| `13-terminal-verify.txt` | 已提交态（`bd59a405`）上四门复跑 + 终态 git 读数 | type-check/lint/test/check:contract 全 EXIT=0（0=0、20/12872、7 文件 158 用例、差集全豁免）；该文件自身为当时唯一未提交项，随收尾 docs 笔提交后 `git status --porcelain` 为空 |

## 3 anti/ —— 反测四段（协议 §4：改前 SHA → cp 备份 → 字节注入 → 红 → cp 复原 → SHA 一致 → 绿）

注入内容：`isBelowCost(item.retailPrice, item.costPrice)` → `item.retailPrice < item.costPrice`（命中数恰 1，`exit 9` 保护）。

| 文件 | 内容 |
| --- | --- |
| `00-pre-sha256.txt` | 注入前 vue SHA256 `a615a954a9170a6d7cc7bf0872a0d3c5cc6ce3086cfa720fdfd8b47833f5cf7c` |
| `01-inject-note.txt` / `01b-injected-line-readback.txt` | 命中数与注入后该行原文回读（`:63` 确为缺陷写法） |
| `02-test-red.txt` | **红**：`TEST_RED_EXIT=1`，`Tests 8 failed / 158`，逐条点名，含卡点名那条 `字符串低价 retail "9.00" / cost "12.00" ⇒ 必须标红（卡点名复现）→ AssertionError: expected false to be true` |
| `03-lint-red-incidental.txt` | 附带读数（非反测目标）：注入态 lint 也红 —— `@typescript-eslint/no-unused-vars` 104→105（注入体没删 import） |
| `04-restore-sha256.txt` + `05-sha-compare.txt` + `05b-restore-proof.txt` | `cp` 复原后 SHA256 = `a615a954…cf7c`，**与注入前逐字节一致**；`cmp -s` 亦一致；并说明 `git diff --stat` 比的是 HEAD（本卡改动前）非注入残留 |
| `06a/06b/06c` + `06a-flake-note.txt` | 复原后 test 复跑三次：前两次被**无关** `api-base-env.spec.ts` 的 5000ms 冷转换超时打断；第三次（无并发负载）`TEST_GREEN_EXIT=0`，7 文件/158 全过，其中 api-base-env 3 用例 478ms 通过 |
| `07-lint-green.txt` | 复原后 `npm run lint` EXIT=0，error 20 / warning 12872（回到冻结基线） |

红点 8 条清单（`02-test-red.txt`）：静态门 3 条（调用数≠1、页面重新出现 `item.retailPrice < item.costPrice`、出现裸价格比较）
+ 行为门 5 条（绑定表达式不再是 `isBelowCost(...)`、字符串低价漏判、字符串高价误判、1000 vs 999 误判、null 凭空判红）。

## 4 browser/ —— 标红判定修复前后对比（真实浏览器 DOM 回读）

- `price-danger-before-after.html`：真实 SFC 的 `<view class="price-row">` 整块（按 view 标签配对从页面切出，非手抄）
  × 6 行数据 × 修复前/修复后两变体，经 vue 3.4.21 + `@vue/server-renderer` 渲染；CSS 用真实 token 值。
- `render-ssr-readback.txt`：SSR 侧读数 + 溯源（页面 sha256、format.ts sha256、esbuild 转译后动态 import 的真实导出名）。
- `render-dom-readback-before-after.txt`：browser-use `evaluate_script` 真实浏览器读数（className / classList / textContent / **computed color**）。
  颜色与源码对应：标红 `rgb(196, 80, 80)` = `$uni-color-error #C45050`（`src/uni.scss:19`）；
  普通 `rgb(64, 64, 64)` = `$uni-gray-700 #404040`（`src/uni.scss:61`）。
  判据：行1 字符串低价 修复前**不标红**→修复后**标红**；行2/行3/行4 修复前**误标红**→修复后**不标红**；行5/行6 两向一致（无回归）。
- `render-a11y-snapshot.txt`：无障碍树（不含 class/颜色，只证结构同源、渲染不报错）。
- `browser-session-note.txt`：静态服务与工具动作序列、复现命令。
- **未验**：PNG 目视（`take_screenshot` 本轮返回成功但只回图像文本描述，二进制未落盘）；登录态整页 E2E、真机（iOS/Android/微信开发者工具/小程序后台）—— 无 :8080 后端与登录态 token。

## 5 复现命令（全部在 `D:\Users\ZXQL\wt-agents\QODER-15`）

```
cd app-mobile
npm run type-check
npm run lint
npm run test
npm run check:contract
cd .. && npm --workspace app-mobile run build:h5

# 反测（单条原子命令，注入器/复原见 anti/）
node D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/inject-anti.mjs <vue 绝对路径> <输出 txt>
# 渲染对比证据
node D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/render-compare.cjs
```
