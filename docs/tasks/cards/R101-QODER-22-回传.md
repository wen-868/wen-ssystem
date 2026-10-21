# R101-QODER-22 回传卡 · 移动端最终 main 收口

> 派单人：凌舟｜执行方：Qoder（移动端专职）｜日期：2026-10-21
> 任务书：`docs/tasks/inbox/QODER-22-mobile-main-closeout.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-22`｜分支：`chore/qoder-22-mobile-main-closeout`
> 基座 `cf9a98fa`（QODER-20 尖端，11/186）＋ 并入 `2e8cde17`（QODER-21 尖端，lint error 20→0）
> 本卡只写执行方自己的读数与自评，**不含任何验收方判词**。所有判据读数都有对应原始日志，路径逐条标注。

---

## 一、基线与提交

| 项 | 值 | 出处 |
| --- | --- | --- |
| 基座（第 1 父） | `cf9a98fa50b796cead73634ac294fea7ad0fd240`（QODER-20 尖端） | `raw/00-premerge-base.log` |
| 并入（第 2 父） | `2e8cde17184c5cf3c68a308ba95fb72ecd42aecd`（QODER-21 尖端） | `raw/00` / `raw/41` |
| 共同祖先（合并基线） | `21b465e5c2a9defd0e3f65809a4b2ba4bc6c0e18`（= `origin/main`） | `raw/00`：`git merge-base HEAD 2e8cde17` |
| 本卡代码笔 | `e9afb0a69df38bbf7ec2093cbe936fa06cbdbf16` `chore: QODER-22 移动端最终 main 收口——并入 QODER-21 lint 清零并按双范围收敛 pin-ssl 静态守卫` | `raw/41`：`git rev-list --parents -n1 HEAD` |
| 交付笔 | `24811fa86f677064a165e582b4a3a514c2b051e5` `docs: QODER-22 回传卡 + 回执 + 证据树（合并零冲突机械证明、pin-ssl 双范围四轮反测、storage-crypto 概率红根因探针）`（32 个文件，逐文件 `git add`，无 `-A`） | 本卡提交后 `git log --oneline -3` |
| 终态四门复跑笔 | 见 §四.4（在交付笔之后复跑并登记；该笔本身只含一份日志，`app-mobile` 面 0 行） | `raw/48-tip-gates.log` |
| 谱系形态 | **真双父 merge**，未 rebase、未 squash；`21b465e5`／`cf9a98fa`／`2e8cde17` 均为 HEAD 祖先（`--is-ancestor` 全部 exit=0）；来源支 `chore/qoder-21-lint-errors-zero` 尖端仍是 `2e8cde17`（未改写别人的支） | `raw/41-merge-lineage.log`（含两条同轮标签补记） |
| 上游 | `fatal: no upstream configured` ⇒ 未 push、无远端跟踪 | `raw/41` |

`e9afb0a6` 相对基座 `cf9a98fa` 的改动面共 9 个文件：本卡自己的 2 个（`app-mobile/tests/pin-ssl-static.spec.ts`、`app-mobile/scripts/gates-baseline.json`）＋ 随 `2e8cde17` 并入带进来的 7 个 src（QODER-21 的 lint 清零处置）。`src/utils/pin-ssl.ts` 相对 `cf9a98fa` diff = **0 行**（本卡不动实现，只动扫描范围）。出处 `raw/43-config-and-rule-face.log` §1/§2。

---

## 二、合并 × 两段冲突处理（任务书 §一.2 / §四「两段冲突处理」）

**结论：实际零冲突。** 任务书预期 `gates-baseline.json` 会被两侧同时改动而冲突，现场没有发生；这属口径偏差，按事实报备并给出机械证明，不粉饰成"我处理得好"。

```
$ git merge --no-ff --no-commit 2e8cde17
Auto-merging app-mobile/scripts/gates-baseline.json
Automatic merge went well; stopped before committing as requested
MERGE_EXIT=0
```
出处 `raw/10-merge-21b465e5-plus-2e8cde17.log`。

为什么零冲突（`-U0` hunk 行区间证明，`raw/42-section-provenance.log` §1/§4）：

| 侧 | 相对 `21b465e5` 改动的行区间 | numstat |
| --- | --- | --- |
| ours（`cf9a98fa`，QODER-19/20 链） | `@@ -57,3 +57,3 @@` ⇒ 只动 **57–59 行（tests 段）** | `3 / 3` |
| theirs（`2e8cde17`，QODER-21） | `@@ -10 +10 @@`／`@@ -13,15 +13 @@`／`@@ -36 +22 @@` ⇒ 只动 **10、13–27、36 行（lint 段）** | `3 / 17` |

两组行区间**不相交** ⇒ 三方自动合并合法，不是"某侧被丢弃"。四态归因读数（同文件 §2/§3）：

| 段 | `21b465e5` | `cf9a98fa`(ours) | `2e8cde17`(theirs) | HEAD（合并＋本单追加 note） | 取了谁 |
| --- | --- | --- | --- | --- | --- |
| `lint.errorBaseline` | 20 | 20 | **0** | **0** | theirs |
| `lint.errorsByFileRule` | 13 对 | 13 对 | **{}** | **{}** | theirs |
| `tests` | 5/56 | **11/186** | 5/56 | **11/186** | ours |
| `lint.warningsByRule` | — | 合计 12872 | 合计 12872 | 合计 12872（逐项相等） | 两侧同值 |
| `typeCheck`／`checkContract`／`contractDrift`／`_comment` | — | — | 未动 | 与 ours 逐字段相等 | ours（零漂移） |

「两段 note 都保留来源」（§一.3 最后一项）落地方式：只在两侧 note **末尾各追加一段**，不删不改对方的字。

- `lint.note`（1052 → **1524** 字）：QODER-5 段 + QODER-21 的 ①~⑤ 逐条处置 + `★ QODER-22 最终 main 收口` 段（写明"本段整段来自并入支 2e8cde17、基座 cf9a98fa 的 lint 段仍是 20＋13 对、两段来源在此并存可追、本单未手工改写任何一条处置记录"）。
- `tests.note`（2270 → **2941** 字）：①~⑦ 历史链 + `⑧` 段（写明"theirs 自带的 5/56 只是它自己分支口径 ⇒ 本单以合并态实测为准，tests 段保持 11/186 不变"＋ 双范围改写的口径与"1 个 it / 5 条 expect ⇒ 用例数不升不降"）。

追加动作的取证（`raw/11-baseline-convergence.log`）：追加前 SHA `18c425512e59…`、追加后 `ebf8cf99363b…`、`PARSE_AFTER=OK`、`git diff --numstat` 仅 `2 2`（只有两行 note 变化）、`crlf=47 bytes=9891`、`sections` 六段顺序与结构不变。写盘用 `_scratch/qoder-22/append-notes.cjs`（utf8 读、`JSON.stringify(b,null,2)` 后统一转 CRLF），避免中文按本地码页读写导致 note 乱码或换行风格漂移。

---

## 三、逐条实现说明（本卡动作面只有 2 个文件）

### 3.1 `app-mobile/tests/pin-ssl-static.spec.ts`（+35 / −18，85 → 102 行）

按凌舟裁定把 QODER-13F2 版「四条全扫文件头」改成**双范围**。`describe` 1 个、`it` 1 个、`expect` 5 条 —— 与改前同数量，只换求值范围与消息文案（任务书 §二「测试仍为 1 个 it，总用例数保持 186」）。

| # | 断言（现 `spec.ts:84-100`） | 改前范围 | 改后范围 | 求值变量 |
| --- | --- | --- | --- | --- |
| ① | `2026-09-15` 不得回潮（负向） | 文件头块 | **`pin-ssl.ts` 全文** | `PIN_SSL_TEXT`（`:77`，新增） |
| ② | `TrustAsia` 不得回潮（负向，大小写不敏感） | 文件头块 | **`pin-ssl.ts` 全文** | `PIN_SSL_TEXT` |
| ③ | `2026-11-11`（api 叶子）必须在册（正向） | 文件头块 | 文件头块（**不变**） | `PIN_SSL_HEAD`（`:78`） |
| ③′ | `2026-12-22`（m 叶子）必须在册（正向） | 文件头块 | 文件头块（**不变**） | `PIN_SSL_HEAD` |
| ④ | `installSslPinning(` 调用点恒为 0 | 全 `src` | 全 `src`（**不变**） | `INSTALL_CALL_SITES`（`:79`） |

实现要点（`app-mobile/tests/pin-ssl-static.spec.ts:77-79`）：

```ts
const PIN_SSL_TEXT = readFileSync(PIN_SSL, 'utf8')
const PIN_SSL_HEAD = headBlock(PIN_SSL_TEXT)
const INSTALL_CALL_SITES = collectInstallCallSites(SRC_DIR)
```

- 文件只读**一次**，`headBlock()` 复用同一份文本 ⇒ 全文与文件头两个范围来自同一快照，不存在两次读到的内容不一致。
- 三条求值一律留在**模块加载期（import 阶段）**，`it` 体内只做常数比较。扫全 `src`（189 个 .ts/.vue、约 2.2 MB）本机实测 1.1~1.8 s，写进 `it` 体内会吃掉 vitest 默认 5000 ms 用例超时的大半预算，并发负载下随机假红（QODER-13F1 踩坑实录 `docs/evidence/qoder-13f1/raw/32-timeout-before-fix.log`）。
- 为什么负向扩到全文而正向仍钉文件头（已写进文件头注释 `:18-20`）：QODER-13F2 版四条全扫文件头，于是把 `2026-09-15`／`TrustAsia` 写回 `PINNED_CERTS` 常量旁的注释里门仍然绿 —— 而那句注释恰是每次证书轮换都要动的位置。负向是"不得出现"，范围越宽越安全；正向是"必须出现"，若按全文守，`pin-ssl.ts:76`／`:80` 常量旁的同值字符串会替文件头"顶包"，文件头被改坏也读到绿。
- 现场对照（`rg -n '2026-11-11|2026-12-22'`）：`pin-ssl.ts` 的 `:6`、`:28`（文件头块内，块结束符在 `:33`）与 `:76`、`:80`（常量旁）各出现一次 ⇒ 文件头计数 2、全文计数 3，两个范围确有区别，不是同一段代码的两种写法。
- 未动：`src/utils/pin-ssl.ts`（0 行）、`src/utils/crypto.ts`（0 行）、`tests/storage-crypto.spec.ts`（0 行）、`vitest.config.ts`、`.eslintrc.cjs`、四门脚本、`package.json`（全部相对 `cf9a98fa` diff = 0，出处 `raw/43` §2）。

### 3.2 `app-mobile/scripts/gates-baseline.json`

只加两段 note（见 §二），**一个基线数字都没调**。终态四段判据字段实测：

```
lint.errorBaseline=0  lint.errorsByFileRule={}  lint.mustReachZero=true
lint.warningsByRule 合计=12872（no-console 225 / no-unused-vars 104 / html-indent 12299 /
                       bracket-spacing 196 / bracket-newline 1 / multiline-content-newline 47）
typeCheck.errors={}（0 条）
checkContract: missingAfterExemptions=0 exempted=1
contractDrift: debt=0 d1=0 d2=0 d4=1（employees 行保留读数，历史说明未动）
tests.testFiles=11 tests.testCount=186
```
出处：`raw/11-baseline-convergence.log`（字段级）＋ `raw/46-terminal-gates.log`（门实测）。

---

## 四、门 / 构建 / 守卫读数（任务书 §三 全量，原始输出索引）

一律在**仓库根**跑（`app-mobile/` 目录内跑 `npm --workspace` 报 `No workspaces found`）。

### 4.1 四门 `check:gates`（终态，反测全部复原 + 探针删除之后）→ `GATES_EXIT=0`

```
—— type-check（vue-tsc --noEmit，0 新增口径）——
vue-tsc EXIT=0，当前错误 0 条，基线 0 条
✓ 无新增类型错误 ⇒ EXIT=0
—— lint（eslint src --ext .ts,.vue，error 0 新增 / warning 不劣化）——
当前 error 0（基线 0）、warning 12872（基线 12872）
✓ 无新增 error、warning 未劣化 ⇒ EXIT=0
 Test Files  11 passed (11)
      Tests  186 passed (186)
—— test 门（用例数冻结）：当前 11 文件 / 186 用例，基线 11 / 186 ——
✓ vitest 全过且用例数不劣化 ⇒ EXIT=0
A.2 口径① '/admin/...' 非注释行出现次数: 292 ／ ② 调用/url: 行内: 283 ／ ③ 去重调用路径: 204
后端注册端点: 1498 ／ 差集: 1 条，其中具名豁免 1 条
✓ 差集为 0 或全部具名豁免 ⇒ EXIT=0
GATES_EXIT=0
```
出处 `raw/46-terminal-gates.log`（19:53:18）。合并态另有一轮同结果读数在 `raw/10-gates-check-merged.log`（19:13:34，`GATES_EXIT=0`）。

### 4.2 三构建（全部 EXIT=0）

| 端 | 命令 | 末行 | 出处 |
| --- | --- | --- | --- |
| H5 | `npm --workspace app-mobile run build:h5` | `DONE Build complete.` / `BUILD_H5_EXIT=0` | `raw/20-build-h5.log` |
| 微信小程序 | `npm --workspace app-mobile run build:mp-weixin` | `DONE Build complete.` / `BUILD_MP_EXIT=0` | `raw/21-build-mp-weixin.log` |
| App | `npm --workspace app-mobile run build:app` | `DONE Build complete.` / `BUILD_APP_EXIT=0` | `raw/22-build-app.log` |

三端各自的已知告警原样保留、未压：H5 `hd-scan.svg` 运行时解析提示；mp `<custom-tab-bar>` 是 H5 专用组件告警；App rollup 的 `scan.ts` 动态/静态混合导入告警。均非本卡引入（本卡 src 零改动），也均未升级为错误。

### 4.3 后端双守卫（全部 EXIT=0）

| 命令 | 结果 | 出处 |
| --- | --- | --- |
| `node backend/scripts/guard-rbac-wiring.mjs --strict` | `✅ [--strict] 无「未登记」项`／`GUARD_STRICT_EXIT=0`；gaps 已登记 289／未登记 0／陈旧 0；consumerEnd 已登记 45／未登记 0 | `raw/30-guard-strict.log` |
| `node backend/scripts/guard-rbac-wiring.mjs --strict --no-stale` | 同上读数／`GUARD_NOSTALE_EXIT=0` | `raw/31-guard-strict-nostale.log` |

两份日志的台账核对段逐字相同（`已登记 289 条 ／ 未登记 0 条 ／ 陈旧 0 条`）⇒ `--no-stale` 这一轮没有新增陈旧项。

### 4.4 出厂复跑（交付笔 `24811fa8` 之后）→ `GATES_EXIT=0`

交付笔入库后再跑一次常驻四门：`type-check 0=0`／`error 0（基线 0）、warning 12872（基线 12872）`／`Test Files 11 passed (11)`、`Tests 186 passed (186)`／`差集 1 条、具名豁免 1 条`，末行 `GATES_EXIT=0`。出处 `raw/48-tip-gates.log`。
该轮工作树的 `app-mobile` 面与 `24811fa8` **完全一致**（当时未提交的只有 `docs/` 下两个文件），所以读数对交付笔成立；紧随其后的补哈希笔只增 1 份日志（`git diff --name-only` 无 `app-mobile/` 条目）。

---

## 五、判据自对账（任务书 §三逐条 → 证据 → 读数）

| 卡 §三 判据 | 目标 | 实测 | 出处 |
| --- | --- | --- | --- |
| `check:gates` | EXIT=0 | **GATES_EXIT=0**（三轮同读数：合并态 vitest 起于 19:17:21、终态 19:55:00、交付笔之后 20:34） | `raw/10-gates-check-merged`、`raw/46`、`raw/48` |
| lint | error 0、warning ≤12872 | **error 0（基线 0）／warning 12872（= 基线，六规则逐项相等）** | `raw/46`、`raw/11` |
| test | 11 文件 / 186 用例 | **11 passed (11)／186 passed (186)** | `raw/46` |
| type-check | 0 = 0 | **vue-tsc 当前 0 条／基线 0 条** | `raw/46` |
| `check:contract` | EXIT=0 | **EXIT=0，差集 1 条／具名豁免 1 条** | `raw/46` |
| `build:h5` / `build:mp-weixin` / `build:app` | 均 EXIT=0 | **0 / 0 / 0** | `raw/20`、`raw/21`、`raw/22` |
| `guard --strict` / `--strict --no-stale` | 均 EXIT=0 | **0 / 0** | `raw/30`、`raw/31` |
| `git diff 21b465e5..HEAD -- backend/src` | 0 | **0 行 / 0 字节**（`--name-only -- backend` 只有 `backend/scripts/guard-rbac-wiring.mjs`，属 QODER-13 链既入件，本卡未动后端） | `raw/40` |
| request.ts 无 `upload` 导出 | 无 | **`rg -n 'export function upload|export const upload' app-mobile/src/api/request.ts` ⇒ `RG_EXIT=1`（无命中）；连全文 `rg -n 'upload' request.ts` 也 `RG_EXIT=1` ⇒ `UPLOAD_ANYwhere=0`（导出与字面量都不在）** | `raw/40` |
| pin-ssl 未接线 | 调用点 0 | **`rg -n 'installSslPinning\(' app-mobile/src` 仅 3 行命中，全部在 `pin-ssl.ts` 自身（:7 注释、:197 注释、:200 定义）⇒ `PINNED_INSTALL_CALLS=0`；spec 侧 `INSTALL_CALL_SITES=[]` 同语义** | `raw/40`、`raw/46` |
| 工作树 clean | clean | **`git status --porcelain` 只列本卡未入库的证据目录；交付笔提交后为空** | 本卡 §七 |
| 反测① 旧事实写回常量尾部必须红 | 红且点名 | **A1/A2 两轮均红** | `anti/A1…`、`anti/A2…` |
| 反测② 文件头缺新日期必须红 | 红且点名 | **B1/B2 两轮均红** | `anti/B1…`、`anti/B2…` |

---

## 六、反测（四轮，含 v1 作废报备）

每轮固定形态：先记工作树 SHA ⇒ 字节级注入（**命中数 ≠ 预期即拒绝写盘、退出码非 0**）⇒ 红跑并点名到具体断言行 ⇒ `cp` 出树备份复原（不用 `sed -i`）⇒ `SHA_AFTER` 与 `SHA_BEFORE` 逐字节一致 ⇒ 复跑转绿。
`pin-ssl.ts`（工作树 CRLF 形态）四轮注入前后 SHA 恒为 `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889`。

| 轮 | 注入位置 | 注入内容（等价性说明） | 红了什么 | 复原 |
| --- | --- | --- | --- | --- |
| **A1** | `PINNING_ENABLED_KEY` 常量行尾注释（在块结束符 `:33` **之外**） | `… // stale fact: expired on 2026-09-15` | `AssertionError: pin-ssl.ts 全文又出现已失效的 2026-09-15 过期表述（负向旧事实按全文守，不限于文件头）: expected true to be false` @ `spec.ts:87:7`，`Test Files 1 failed (1)`；**并把常驻 test 门整体拖红**：`FAIL tests/pin-ssl-static.spec.ts`、`1 failed \| 185 passed (186)`、`TEST_GATE_EXIT=1`（注意：这里的红点是我注入的 pin-ssl-static，与 §9.1 清洁树那次同为 `1 failed \| 185 passed` 但红点不同 —— 那次是 `storage-crypto.spec.ts:37`） | `RESTORE_EXIT=0`、`SHA_IDENTICAL`、`VITEST_EXIT_AFTER_RESTORE=0` |
| **A2** | `DEFAULT_PINNING_ENABLED` 常量行尾注释（同外） | `… // old issuer TrustAsia` | `… 全文又出现 TrustAsia 旧签发链表述（负向旧事实按全文守，不限于文件头）: expected true to be false` @ `spec.ts:92:7` | 同上 |
| **B1** | 文件头 `:6`/`:28` 的 `叶子 2026-11-11 到期` → `叶子到期`（`expect 2`；常量旁 `:76` 同值字符串**保持不动**） | 只抹文件头的正向值 | `… 文件头缺少 api.onepan.cn 叶子到期日 2026-11-11: expected false to be true` @ `spec.ts:94:100` ⇒ **证明正向断言确实只认文件头、不会被常量注释顶包** | 同上 |
| **B2** | 文件头 `叶子 2026-12-22 到期` → `叶子到期`（常量旁 `:80` 不动） | 同上（m 侧） | `… 文件头缺少 m.onepan.cn 叶子到期日 2026-12-22` @ `spec.ts:95:98` | 同上 |

A1 是任务书 §三第一条判据的正面回答：QODER-13F2 版（只扫文件头）在这一次注入下会**读到绿** —— 因为 `2026-09-15` 落在块注释结束符之后。A1 红 ⇒ 扩范围确实生效，不是文案改动。

**v1 轮全部作废（如实报备）**：注入器写成 `inject.mjs` 却用了 CommonJS `require()` ⇒ `ReferenceError: require is not defined in ES module scope`、退出码 1、**文件一字节没改**；v1 驱动只把退出码记进日志、没据此中止 ⇒ 4 轮"红跑"实为绿跑（`INJECT_EXIT=1` / `VITEST_EXIT=0` 空转）。
处置：改名 `inject.cjs`，驱动加硬闸 `INJECT_EXIT≠0 ⇒ ROUND_VOID=1`、只做保底复原、不产出红/绿读数；v1 四份原始日志整体移入 `anti/void-v1/` 并附 `README.note.txt` 说明作废原因（按纪律**不改写原始证据文件**）。
副作用是这次空转反而撞出一个真问题 ⇒ 见 §九.1。

---

## 七、红线对照（逐条自查）

| 红线 | 自查 |
| --- | --- |
| 不 push | ✅ 分支无上游（`raw/41`：`fatal: no upstream configured`），全程未执行任何 `git push` |
| 不开 PR | ✅ 未调用任何 PR/GitHub 接口 |
| 不 `git add -A` | ✅ 逐文件 `git add`（本卡 3 件 + 证据树逐文件列举），提交后 `git status` 复核无漏项、无意外件 |
| 只动自己的工作树与分支 | ✅ 全部写操作限于 `D:\Users\ZXQL\wt-agents\QODER-22` 与 `_scratch/qoder-22/`；`chore/qoder-21-lint-errors-zero` 尖端未被改写（`raw/41`） |
| 不写验收方判词 | ✅ 全卡只写"实测/自评/达标与否"，无「凌舟裁定/验收结论」类判词（文件里引用任务书口径时均标注为任务书原文要求） |
| 动作面收敛 | ✅ 代码面只 `tests/pin-ssl-static.spec.ts` + `gates-baseline.json`（note）；`src/utils/pin-ssl.ts`、`crypto.ts`、`storage-crypto.spec.ts`、`.eslintrc.cjs`、`vitest.config.ts`、`package.json`、四门脚本相对 `cf9a98fa` diff 全 0（`raw/43` §2） |
| 不动判据换绿 | ✅ 未升/降任何基线数字（`errorBaseline`/`errorsByFileRule` 的变化来自并入的 QODER-21 实测，非本卡）；未关规则、未加文件级 `disable`、未删改测试、未加 `skip`/`todo`（`raw/43` §4/§6） |
| git 安全 | ✅ 未 `--amend`、未 rebase、未 `reset --hard`、未 `clean -f`、未 `checkout --`；复原一律 `cp` 出树备份，不用 `sed -i` |
| harness | ✅ 未借入/删除任何 harness；四门仍走 main 常驻件（`#368` 起） |
| 编码/换行 | ✅ 中文 JSON 用 utf8 读写并保持 CRLF（`raw/11`：`crlf=47 bytes=9891`） |

---

## 八、未完成与阻塞 / 未验清单（如实，不许当通过）

1. **本卡是收口笔，不是合并笔**：`e9afb0a6` 仍在 `chore/qoder-22-mobile-main-closeout` 上，**未 push、未进 main**。main 侧最终收口动作（谁把 `cf9a98fa` + `2e8cde17` + `e9afb0a6` 落到主干）不属本卡权限，等凌舟安排。
2. **真机全未验**：iOS/Android/微信开发者工具/小程序后台均未跑。三构建只证明"能编出产物"，不证明运行期行为。
3. **H5 浏览器未起**：本轮无 UI 侧新行为（src 零改动），故未做浏览器路径实测。产物级抽查已补做（`raw/47-artifact-spot-check.log`，`app-mobile/dist/**` 被 `.gitignore` 忽略、不入库）：h5 `index.html` 的 `viewport-fit=cover` 命中 **1**（meta 原文含 `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`）；mp `app.json` `pages=16`、`requiredPrivateInfos=[]`、`permission["scope.record"].desc` 是真实中文用途说明（不是占位空串）；app 端产物顶层文件齐。⇒ 这些是"构建产物形态"读数，**不等于**运行期/UI 观测。
4. **`installSslPinning` 仍未接线**（本卡只守"没接线"这一事实）。接线前置的两个条件一个都没满足：新指纹 + 原生层证书回调可用。`pin-ssl.ts` 文件头自述的 `plus.networkEvent.addEventListener('certificateValidate')` 在当前运行时不可用，接线即静默放行。⇒ 需另立卡，本卡不动。
5. **叶子证书在有效期内但离到期已近**：`api.onepan.cn` 叶子 **2026-11-11** 到期（距今 21 天）、`m.onepan.cn` 叶子 **2026-12-22** 到期。按在册口径「到期前 30 天即应启动轮换」，api 那条**已进入提醒窗口**。本卡无权限也无动作面去做这件事，仅作提示。
6. **warning 存量 12872 条一条未清**（`vue/html-indent` 12299 为大头），不属本卡范围；`contractDrift.d4=1` 是 employees 行的保留读数（QODER-7 历史说明），非新增欠账。
7. **RBAC 已登记欠账 289 条、消费者端保护形态 45 条**：双守卫绿的是"无未登记项"，不代表欠账为零。这 289 条的处置归 R101 缺口清单线，不在本卡。

### 修复清单（总数 / 已完成 / 未完成，现场重测于 `e9afb0a6`）

| 项 | 命令 | 总数 | 已完成 | 未完成 |
| --- | --- | --- | --- | --- |
| lint error（`文件::规则` 13 对 / 20 条） | `npm --workspace app-mobile run lint` | 20 | **20**（QODER-21 清零，本卡合并后实测 error=0） | 0 |
| 旧事实文案（`2026-09-15` / `TrustAsia`）扫全 `src` | `rg -in '2026-09-15\|trustasia' app-mobile/src` | 命中 0 | 0 需要改（13F 链已清，本卡扩扫描面） | 0 |
| pin-ssl 静态断言扫描范围（4 条） | 见 §五 | 4 | **4**（负向 2 条改全文、正向 2 条留文件头、调用点扫全 src） | 0 |
| `gates-baseline.json` 双段收敛（4 项判据 + note 来源并存） | `node -e` 字段读数 | 5 | **5**（`errorBaseline=0`／`errorsByFileRule={}`／`tests=11/186`／`typeCheck={}`／两段 note 并存） | 0 |
| 合并（QODER-21 → 收口支） | `raw/10` | 1 | **1**（零冲突，真双父） | 0 |
| 四门 + 三构建 + 双守卫复跑 | §四 | 9 | **9**（全部 EXIT=0） | 0 |
| 反测轮次 | `anti/*` | 4 | **4**（另 4 轮 v1 作废） | 0 |
| **挂账（本卡范围外，须另立单）** | — | 4 | **0** | ①`storage-crypto.spec.ts:37` 概率红 + `crypto.ts` `tag.length` 不校验（§九.1）；②pin-ssl 接线（前置未满足）；③api 叶子证书 2026-11-11 到期轮换；④存量修复面：`.toFixed(` **99 处 / 39 文件**、`res?.result ?? res` **164 处 / 35 文件**、`?? res` **219 处 / 44 文件**（现场重测于 `e9afb0a6`，与早前记录的 109/39 口径不同，以本行命令为准） |

---

## 九、自我报备（含越面发现与踩坑）

### 9.1 越面发现（**不在本卡动作面，未擅自修改**）：`tests/storage-crypto.spec.ts:37` 概率红 + `crypto.ts` 标签长度不校验

发现路径不体面但真实：反测 v1 的空转轮次里，A1 的 2b 步在**未注入的清洁合并态**上跑常驻 test 门 ⇒ `TEST_GATE_EXIT=1`，红点 `storage-crypto.spec.ts:37`「tag 校验失败即抛」（`AssertionError: expected [Function] to throw an error`，`1 failed | 185 passed`）。同一棵树 19:17 的 `check:gates` 全绿、19:32 复跑也全绿 ⇒ 我**没有**把它当成"环境坏了/机器抖动"抹掉，而是查到根因并确定性复现：

- 篡改式 `spec.ts:36` 的 `tag.slice(0, -4) + 'AAAA'`：`encrypt()` 的 tag 是 **16 字节**的 base64（24 字符、末尾恒两个 `=`），`slice(0,-4)` 去掉的是「最后 2 个有效字符 + `==`」，补 `AAAA` 后解出 **18 字节**，前 15 字节与真 tag 完全相同 ⇒ 真正改动的**只有第 16 字节**（`tag[15]` → 0）。
- `src/utils/crypto.ts:626-628` 校验循环 `for (let i = 0; i < 16; i++) diff |= tag[i] ^ expectedTag[i]`，上界写死 16、**从不校验 `tag.length`** ⇒ 多出的 2 字节被无视，检出与否只取决于 `tag[15] === 0`，概率 **1/256**。
- 探针实测（`raw/50`）：第 77 次加密即命中，`decrypt(篡改 tag)` **不抛、返回 `"top-secret"`**；对照实验只改 base64 首字符 ⇒ 必抛；2000 次加密命中 8 次 = 0.00400（理论 0.00391）。
- 影响面（不夸大）：门禁侧每跑一次该用例约 **0.4% 概率假红**，容易被误读成别人引入回归；本会话清洁树共 3 次全量门跑（19:17 绿 / 19:27 红 / 19:32 绿），样本太小不足以外推，但结论不靠样本成立（探针 A 是确定性复现）。产品侧不是机密性破口（密文未动，解出的明文本就正确），真实含义是"认证标签校验的完备性弱于注释所述"—— 截断/改写出的**非规范 base64** 可被当合法标签接受。
- **本卡处置：零修改。** 动作面只许动 `tests/pin-ssl-static.spec.ts` + `gates-baseline.json`，`crypto.ts` 与 `storage-crypto.spec.ts` 相对 `cf9a98fa` diff 均为 0（`raw/43` §2）。建议处置（用例侧改必然改变比较窗口的篡改式 / 实现侧 `if (tag.length !== 16) return null`）与复现件都写在 `docs/evidence/qoder-22/probe/README.md`，**建议另立一单**，等凌舟裁定。探针 spec 已跑完即删，只以 `.txt` 存档。

### 9.2 口径偏差报备

1. **任务书 §一.3 预期 `gates-baseline.json` 会冲突，实际零冲突**。已按事实报备并给机械证明（§二），没有手工制造冲突再"解决"它，也没有因为"没冲突"就跳过两段来源归属的取证。
2. **卡 §三 反测只点名两条（旧事实写回常量尾部 / 文件头缺新日期），我做了四轮**：负向按 `2026-09-15`、`TrustAsia` 分别注入，正向按 `2026-11-11`、`2026-12-22` 分别抹除 —— 因为四条断言是独立 `expect`，合并注入会让"红了"说不清红在哪条。
3. **`app-mobile/` 内跑 `npm --workspace` 会报 `No workspaces found`**，任务书 §三 的命令一律在仓库根执行。已在 `raw/46` 与证据树 README 标注，避免下一位照抄踩空。
4. **修复清单计数更正**：早前会话记录的 `.toFixed` 命中数（109/39）与本卡现场重测（99 处 / 39 文件）不一致，差异来自命令形态（`\.` 与 `\(` 是否入图案）。本卡 §八 表末行给出**可复制命令**为准，旧数字不再引用。
5. **反测 v1 四份日志作废**（§六），作废原因两条都在我这边（`.mjs` 里用 `require()`；驱动没据 `INJECT_EXIT≠0` 中止）。作废读数一处也没有用于判据。

### 9.3 踩坑（本轮新增，供下一单避）

1. **`npx rg` 装的是 npm 上的仿冒包 `rg@0.0.2`，不是 ripgrep**：命令 `npx rg -n '...'` 打印出 "README.md already exists…" 且**退出码 0** —— 一次彻头彻尾的假读数。本仓有 PATH 里的真 ripgrep 15.0.0，必须直接写 `rg`（或用 Grep 工具），永远不要 `npx rg`。
2. **`.mjs` + `require()` 崩在"没写盘"这一步，但驱动不中止 ⇒ 反测整轮变成假的**：注入器的退出码必须当作**硬闸**（≠0 就作废本轮），否则"红跑"读到的是绿。已在 v2 驱动里落实。
3. **`$?` 在管道后报的是管道最后一个命令**：本轮用 `… | head -3; echo $?` 测 `export function upload` 得到 0（假命中）。权威读数用不落管道的形态：`rg …; echo RG_EXIT=$?` ⇒ `raw/40` 的 1（无命中）。
4. **`MSYS2_ARG_CONV_EXCL='*'` 保护 rg 图案但会打断 node 脚本路径**：需要时把脚本路径写成盘符形态 `D:/…`。
5. **`git status --porcelain -- <绝对路径>` 在 `dir_path=app-mobile` 的块里失败**：pathspec 要相对 cwd 写（`src/utils/pin-ssl.ts`）。
6. **中文 JSON 必须 utf8 读写 + 保持 CRLF**，`git show` 出来的是 LF blob 形态，与工作树 CRLF 形态的 SHA 不同（同文件两哈希），比对时必须固定"工作树同形态"这一侧并在日志里写明。
7. **标签写错要比数字错更小心**：`raw/41` 我把 `chore/qoder-21*` 的分支标签写成 `fix/qoder-21*`，`raw/41` 的祖先段又把 `--is-ancestor` 的口径写成"1=是祖先"（实为 **0=是**）。两处都没有改写原文，而是在同一文件末尾追加"补记"更正并复跑验证 —— 这是纪律要求，不是修辞。
8. **产物路径不在仓库根**：`uni build` 的输出是 `app-mobile/dist/build/<h5|mp-weixin|app>`，在仓库根写 `dist/build/h5/index.html` 只会得到 `No such file`／`MODULE_NOT_FOUND`。抽查件已按更正路径重跑并把这条口径写进 `raw/47` 文件头（`dist/` 被 `app-mobile/.gitignore:2` 忽略，不会污染工作树）。

---

## 十、复现命令

```bash
cd /d/Users/ZXQL/wt-agents/QODER-22          # 仓库根，不要在 app-mobile/ 里跑 --workspace

# 0) 谱系与基线
git rev-parse HEAD; git rev-list --parents -n1 HEAD          # e9afb0a6 / 双父 cf9a98fa + 2e8cde17
git merge-base HEAD 2e8cde17                                 # 21b465e5
git diff --numstat cf9a98fa..HEAD -- app-mobile/tests/pin-ssl-static.spec.ts   # 35 18
git diff --numstat cf9a98fa..HEAD -- app-mobile/src/utils/pin-ssl.ts           # 空 = 未动
node -e "const b=require('./app-mobile/scripts/gates-baseline.json');console.log(b.lint.errorBaseline,Object.keys(b.lint.errorsByFileRule).length,b.tests.testFiles,b.tests.testCount)"  # 0 0 11 186

# 1) 四门（串行包装器）
npm --workspace app-mobile run check:gates                   # 期望 GATES_EXIT=0

# 2) 三构建
npm --workspace app-mobile run build:h5
npm --workspace app-mobile run build:mp-weixin
npm --workspace app-mobile run build:app

# 3) 后端双守卫
node backend/scripts/guard-rbac-wiring.mjs --strict
node backend/scripts/guard-rbac-wiring.mjs --strict --no-stale

# 4) 红线/范围机检
git diff 21b465e5..HEAD -- backend/src | wc -c              # 0
rg -n 'installSslPinning\(' app-mobile/src                  # 仅 pin-ssl.ts 自身 3 行（注释/定义）
rg -in '2026-09-15|trustasia' app-mobile/src; echo RG_EXIT=$?   # 期望 1（无命中）
rg -n 'upload' app-mobile/src/api/request.ts; echo RG_EXIT=$?   # 期望 1

# 5) 反测（须红 ⇒ 复跑须绿）。注入器 _scratch/qoder-22/inject.cjs 不入库，脚本形态见 anti/* 日志原文
sha256sum app-mobile/src/utils/pin-ssl.ts                    # cb27d321c52d…（工作树 CRLF 形态）
npx vitest run tests/pin-ssl-static.spec.ts                  # 单 spec：期望 1 test passed（注入后对应轮须红并点名）

# 6) 附带发现的复现件（跑完必须删，探针不入库）
cp docs/evidence/qoder-22/probe/__q22-flake-probe.spec.ts.txt app-mobile/tests/__q22-flake-probe.spec.ts
(cd app-mobile && npx vitest run tests/__q22-flake-probe.spec.ts)
rm app-mobile/tests/__q22-flake-probe.spec.ts
```

### 对下一单的建议

1. 若要修 §9.1，**用例侧先修**（篡改式改成必然改变比较窗口的写法，如改 tag 首字符）即可消除 0.4% 假红；实现侧 `tag.length !== 16 ⇒ return null` 是密码学收口，两者判据不同，建议分开裁定。
2. 常驻门 `test-gate.mjs` 目前把"概率红"表现为整门红，CI 上会重跑碰运气。若要根治，考虑给 `check:gates` 的 test 段留一条"同形态复跑 2 次"的取证口径，但**不要**加自动重试掩盖问题。
3. pin-ssl 接线的门槛是**原生层证书回调可用**（不是指纹新旧）。建议下一单先在真机/壳工程侧确认可用性，再谈接线，否则接线即静默放行、反测判据无法满足。
