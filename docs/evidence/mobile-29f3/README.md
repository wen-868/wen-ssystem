# MOBILE-29F3 · pageerror 空壳白名单精确收紧 · 证据索引

> 负责人：**阿潵（移动端前端 owner）**｜日期：2026-10-24
> 派单卡：`docs/tasks/inbox/MOBILE-29F3-pageerror-whitelist-precision.md`
> 依据：`docs/tasks/cards/R101-MOBILE-29F2-凌舟验收与裁定-20261024.md` §三.3 / §三.4
> 工作树：`D:\Users\ZXQL\wt-agents\MOBILE-29F3`｜分支 `mobile/MOBILE-29F3-pageerror-precision`｜基线 `4b28551c`
> ⚠️ 本目录**不覆盖** 29F2 历史证据；29F2 的 `smoke/results.json` 与 `smoke/uploads/*` 在本单冒烟后已**逐字节复原**（哈希见下）。

## 一、改了什么

唯一代码面改动：`docs/evidence/mobile-29f2/smoke/run-smoke.mjs` 的 pageerror 分类裁决（**不改业务代码**）。

1. **逐字段精确 signature**（`KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE`）：
   `ctor==='PlaywrightError'` ∧ `message==='Object'` ∧ `name===''` ∧ `stack===''` ∧ `log` 为空数组（`logLen===0`）∧ `keys` 恰为 `['log','name']` ∧ `inspect==='\[Object] { log: [] }'`。
2. **次数上限**：`maxOccurrences: 1` —— 同类已知空壳单次冒烟第 2 条 ⇒ 不豁免、判红。
3. **裁决器工厂** `createPageErrorJudge()` 导出，供本目录反测装置**直接 import 单测**（同 import 已加"仅直接执行才跑冒烟"守卫，避免 import 触发整场冒烟）。
4. **第二种反测注入口** `SMOKE_INJECT_UNKNOWN_OBJ=1`：页面抛凌舟的构造反例 `{name:'',message:'unknown-object-marker',log:[]}`。

## 二、signature 的来源（先补证据再定义，卡 §二.2 要求）

- `00-signature-forensics-from-29f2-tracked-results.md`：从 29F2 **git 留档** `smoke/results.json` 提取的已知空壳全字段。
- 正式冒烟复现同一形态（`raw=Object`、`keys=['log','name']`、`inspect='[Object] { log: [] }'`）⇒ 卡面 `message="Object"` 现场坐实为**字面 'Object' 的非枚举自有属性**（若 message 为 falsy，`raw` 会等于 inspect 全文）。

## 三、每个 raw 文件证明什么

| 文件 | 命令 | 证明 |
|:--|:--|:--|
| `raw/20-anti-offline-judge.log` | `node docs/evidence/mobile-29f3/anti/20-whitelist-precision-anti.mjs` | **10/10 用例通过 / EXIT=0**：已知空壳第 1 条豁免、第 2 条判红、凌舟反例判红、伪造 ctor 判红、普通 Error 判红、四类逐字段扰动全判红、hideTabBar 仍豁免 |
| `raw/30-smoke-formal-run.log` | `node docs/evidence/mobile-29f2/smoke/run-smoke.mjs` | 正式冒烟 **19/19 全绿 / SMOKE_EXIT=0**；精确豁免恰好 1 条；两处 `.env.local` 无残留、5199 释放 |
| `raw/40-anti-A-normal-error-inject.log` | `set SMOKE_INJECT_PAGEERROR=anti-29f3-normal-error&& node …run-smoke.mjs` | 普通 Error 注入 ⇒ **SMOKE_EXIT=1**，断言逐条 `✗ 无未知 pageerror` 点名，且已留全字段原文 |
| `raw/41-anti-B-unknown-object-inject.log` | `set SMOKE_INJECT_UNKNOWN_OBJ=1&& node …run-smoke.mjs` | 结构化未知对象注入 ⇒ **SMOKE_EXIT=1**（**红因 = 空壳超出 maxOccurrences=1**，见 §四） |
| `raw/41-anti-B-results.json` | 同上运行的 results 快照 | 反测 B 的裁决留档（未覆盖 29F2 原件，副本存本目录） |
| `raw/50-gates-check.log` | `npm --workspace app-mobile run check:gates` | 门禁 EXIT=0、测试 **16 文件 / 329 用例**不降 |
| `anti/20-whitelist-precision-anti.mjs` | — | 反测装置本体（离线、不起浏览器，复用冒烟同一份判据） |

## 四、必须如实报备的一点（不影响硬验收结论）

反测 B **确实 EXIT=1**，但红因不是"message/keys 不匹配"：实测 Playwright 会把页面抛出的**非 Error 对象**序列化成正好与已知空壳同形的壳——注入的 `message:'unknown-object-marker'` 到 Node 侧读成 `message:'Object'`、`keys` 只剩 `['log','name']`、`inspect='[Object] { log: [] }'`，与 signature **逐字段相同**。因此：

- **单条**该形态的结构化未知对象，任何"只靠字段值"的白名单都无法区分（信息已被 Playwright 序列化层抹掉）；
- 本单把它拦下的是**次数上限**：现场稳定出现 1 条真·工具侧空壳，注入的第 2 条同类 ⇒ `overLimit` ⇒ 判红（正是凌舟裁定 3"把该 signature 次数限制为 0 或 1"的落点）。
- 若凌舟要求"该形态**一条都不许豁免**"（`maxOccurrences=0`），改一个常量即可，但正式冒烟会因现场那 1 条空壳转红 ⇒ 需一并裁定正式冒烟基线。已列入回传卡待裁定项。

## 五、29F2 历史证据未被覆盖（逐字节核对）

跑冒烟会写 29F2 的 `smoke/results.json` 与 `smoke/uploads/*`，本单已按基线复原：

| 对象 | 基线 blob（本单开始前） | 复原后 | 判定 |
|:--|:--|:--|:--|
| `smoke/results.json` | `7a820a85cc474a58503fd677f533b617b28796c4` | 同值 | 一致 |
| `smoke/uploads/*`（12 个） | 全部 `613754cfaf74a7a2d86984231479d5671731f18a` | 12 个同值 | 一致 |
| 本单新产生的 6 个 uploads | —（未跟踪） | `git clean -fd` 移除 | 不残留 |
