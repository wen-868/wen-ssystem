【汇报 MOBILE-29F3】pageerror 空壳白名单精确收紧
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-24
执行通道：WorkBuddy

## 交付物

| # | 交付物 | 文件路径 | 提交哈希 |
|:--|:--|:--|:--|
| 1 | pageerror 判据收紧为**逐字段精确 signature** + 同类空壳**次数上限 1**；导出 `createPageErrorJudge` / `isKnownPlaywrightErrorShell`；新增第二反测注入口 `SMOKE_INJECT_UNKNOWN_OBJ` | `docs/evidence/mobile-29f2/smoke/run-smoke.mjs` | `e45c36a4` |
| 2 | 离线反测装置（不起浏览器，import 冒烟同一份判据，10 用例） | `docs/evidence/mobile-29f3/anti/20-whitelist-precision-anti.mjs` | `e45c36a4` |
| 3 | signature 取值依据（先补证据再定义，卡 §二.2） | `docs/evidence/mobile-29f3/00-signature-forensics-from-29f2-tracked-results.md` | `e45c36a4` |
| 4 | 证据索引（每个 raw 证明什么 + 29F2 未覆盖核对表） | `docs/evidence/mobile-29f3/README.md` | `e45c36a4` |
| 5 | 原始输出 6 份（正式冒烟 / 反测 A / 反测 B 及其 results 副本 / 离线装置 / 门禁） | `docs/evidence/mobile-29f3/raw/` 下 `20-`、`30-`、`40-`、`41-`（含 `41-anti-B-results.json`）、`50-` | `e45c36a4` |

工作树 `D:\Users\ZXQL\wt-agents\MOBILE-29F3`｜分支 `mobile/MOBILE-29F3-pageerror-precision`｜基线 `4b28551c2b1f61c339d22f5280f4fe88f2580170`。
**业务代码零改动**（改动仅在冒烟编排与证据文档）；**未 push、未开 PR、逐文件 `git add`（无 `-A`）**。

收紧后的 signature（`KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE`，逐字段全等才豁免）：

```js
{ ctor: 'PlaywrightError', message: 'Object', name: '', stack: '',
  logLen: 0, keys: ['log','name'], inspect: '[Object] { log: [] }', maxOccurrences: 1 }
```

对比 29F2 被驳回的宽泛判据 `ctor==='PlaywrightError' && !name && !stack && logLen===0`：新增 **message 精确、keys 集合恰等（禁额外字段）、inspect 精确、同类次数上限**四道约束。

## 证据（可复跑）

1. **正式冒烟** `node docs/evidence/mobile-29f2/smoke/run-smoke.mjs` ⇒ `raw/30-smoke-formal-run.log`
   **19 条断言全 ✓，`SMOKE PASS（EXIT=0）`**；pageerror 精确豁免**恰好 1 条**（`:51` ✓；留档 `parts.message="Object"`、`keys=["log","name"]`、`inspect="[Object] { log: [] }"`）；`:52-54` 两处 `.env.local` 无残留、5199 命中 0、端口已释放。
2. **反测 A（普通 Error）** `set SMOKE_INJECT_PAGEERROR=anti-29f3-normal-error&& node …run-smoke.mjs` ⇒ `raw/40-anti-A-normal-error-inject.log`
   **`SMOKE FAIL（EXIT=1）`**，`:55` `✗ 无未知 pageerror … ⇒ 未知 1 条：["anti-29f3-normal-error"]`，其余 18 条 ✓（红因唯一且正确）。
3. **反测 B（结构化未知对象）** `set SMOKE_INJECT_UNKNOWN_OBJ=1&& node …run-smoke.mjs` ⇒ `raw/41-anti-B-unknown-object-inject.log`
   **`SMOKE FAIL（EXIT=1）`**，`:55` `✗ … ⇒ 未知 1 条：["Object"]`；stdout 点名 `pageerror: 已知空壳**超出 maxOccurrences=1**（第二次同类）⇒ 判红`。
4. **离线判据单测** `node docs/evidence/mobile-29f3/anti/20-whitelist-precision-anti.mjs` ⇒ `raw/20-anti-offline-judge.log`
   **10 用例 / 失败 0 / `WHITELIST_PRECISION_PASS` / EXIT=0**：A 第 1 条豁免 ✓、B 第 2 条判红 ✓、C 凌舟反例判红 ✓、C2 伪造 ctor 但 message/keys 不符判红 ✓、D 普通 Error ✓、E 额外键 ✓、F 非空 stack ✓、G 非空 log ✓、H message 非 `Object` ✓、I hideTabBar 仍豁免 ✓。
5. **门禁** `npm --workspace app-mobile run check:gates` ⇒ `raw/50-gates-check.log` **EXIT=0**：type `0 条 / 基线 0 条`；lint `error 0（基线 0）、warning 12872（基线 12872）`；**`Test Files 16 passed (16)` / `Tests 329 passed (329)`**；contract `差集为 0 或全部具名豁免`；guard `A/B/C/D ⇒ EXIT=0`。
6. **29F2 历史证据未覆盖**：跑冒烟前记录基线 blob，跑完 `git checkout --` 复原 `smoke/results.json` ⇒ `7a820a85cc474a58503fd677f533b617b28796c4`，12 个 `smoke/uploads/*` ⇒ 均 `613754cfaf74a7a2d86984231479d5671731f18a`；本单新增的 6 个未跟踪 uploads 已 `git clean -fd` 移除。`git diff --stat 4b28551c HEAD` 中 29F2 侧**仅 `run-smoke.mjs` 一个文件**。

## 验收自评

| 硬验收（卡 §三） | 自评 | 依据 |
|:--|:--|:--|
| 1 正式冒烟实际断言全过 + 两处 `.env.local` 无残留、5199 释放 | **通过** | 证据 1（`:51-54`，19/19） |
| 2 普通 Error 注入 ⇒ EXIT=1 | **通过** | 证据 2（`EXIT=1`，`✗` 点名注入原文） |
| 3 结构化未知对象注入 ⇒ EXIT=1，不得再被空壳白名单吞掉 | **通过（但红因与卡面设想不同，见"风险与自我报备"1）** | 证据 3（`EXIT=1`）；实际红因是**次数上限**，非字段不匹配 |
| 4 已知空壳只能按精确 signature 豁免；出现第二条同类即 EXIT=1 | **通过** | `maxOccurrences: 1` + 证据 3 + 离线装置 B 用例 |
| 5 `check:gates` EXIT=0，测试数 16/329 不降 | **通过** | 证据 5 |
| 6 工作树 clean、未 push、未开 PR、逐文件 add | **通过** | 提交 `e45c36a4` 仅含本单文件；本卡落盘后随即提交，状态见下条 |

## 未完成与阻塞

1. **本回传卡与回执自身的提交**：写完即逐文件 add 提交（不 push）；提交后 `git status` 应为空。除这两个文档外无其它未跟踪残留：`.env.local` 两处不存在、5199 空闲、29F2 产物已逐字节复原。
2. **CI 未覆盖本判据**：本单只收紧冒烟内裁决，`ci.yml` 无冒烟 job ⇒ 真实 GitHub run 不会跑到它。是否把冒烟（或离线判据单测）接进 CI，**待凌舟裁定**（离线装置已可被任意 harness 直接调用，接入成本低）。
3. 无其它阻塞；MOBILE-28F1 / MOBILE-28R1 仍排队，未动。

## 风险与自我报备

1. **必须如实报备：反测 B 的红因不是"字段不匹配"**。实测 Playwright 会把页面抛出的**非 Error 对象**序列化成正好与已知空壳**同形**的壳——注入的 `message:'unknown-object-marker'` 到 Node 侧读成 `message:'Object'`，`keys` 只剩 `['log','name']`，`inspect` 恰为 `[Object] { log: [] }`，与 signature **逐字段相同**（见 `raw/41-anti-B-unknown-object-inject.log` 全字段原文）。⇒ 差异在序列化层已被抹掉，**任何"只靠字段值"的白名单都无法区分单条该形态**；本单把它拦下的是**次数上限**（现场稳定 1 条真·工具侧空壳 ⇒ 注入的第 2 条同类判红）。我**没有**把它说成"message 不匹配导致判红"。
2. **连带结论（请一并裁定）**：若要求该形态**一条都不豁免**（`maxOccurrences: 0`），改一个常量即可，但**正式冒烟会因现场那 1 条空壳转红** ⇒ 需同时裁定正式冒烟基线是否接受该空壳存在。当前保持 1 以维持 19/19。
3. **`message` 取值过程有自我修正**：初版我按 `String(message||inspect)==='Object'` 宽松实现；复核 29F2 留档发现 `raw` 恰为 `"Object"` 而 `inspect` 为 `"[Object] { log: [] }"`（若 message 为 falsy，`raw` 会等于 inspect 全文）⇒ 证明现场 `message` 就是字面 `"Object"` 的**非枚举自有属性**，遂改为精确相等。取证已单独落文件（交付物 3），满足卡面"若现场取到不同值，先补证据再定义"。
4. **改动了 29F2 的文件**：卡 §二.1 指定就地修改 `mobile-29f2/smoke/run-smoke.mjs`，故沿用该路径未另建副本（避免两份判据漂移）；29F2 的**历史证据**（results/uploads）已按证据 6 逐字节复原，未覆盖。
5. **本仓环境故障仍在**：PowerShell Core 内置模块缺失（`Set-Location`/`Test-Path`/`Set-Content`/`Select-Object` 及 `copy` 别名、`cd /d` 混用会静默跑偏，本轮已两次踩到），本轮全程改用 `cmd /c` + `cmd /v:on` 延迟展开取退出码。建议排查，否则后续取证易出假读数。
6. 未弱化未知 pageerror 判红（只收紧白名单）；未改上传业务实现与请求头实现；未以"白名单更宽"换正式冒烟绿；未覆盖 29F2 历史证据。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-MOBILE-29F3-阿潵回传.md`
关联卡：`docs/tasks/inbox/MOBILE-29F3-pageerror-whitelist-precision.md`
