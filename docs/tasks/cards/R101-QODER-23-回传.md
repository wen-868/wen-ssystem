# R101-QODER-23 回传卡 · AES-GCM 认证标签长度正确性

```
【汇报 QODER-23】QODER-23 AES-GCM 标签长度正确性 —— 长度守卫已落在常量时间比较之前，篡改用例改确定性并新增 18 字节非规范标签拒绝用例，四门 + build:h5 全 EXIT=0，两轮反测各打红一条且互不重叠，backend diff 0 字节、工作树 clean
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-21
交付物：
  ① 实现笔 ad73898e8da79a6ce6ec309cace397a96a667479 —— app-mobile/src/utils/crypto.ts（:598/:600/:625-630）、app-mobile/tests/storage-crypto.spec.ts（:5-8/:13-30/:56-68/:70-81）、app-mobile/scripts/gates-baseline.json（tests 段）
  ② 文档笔 `e33f35411abb5ffa7e3fc3c12adcc29132afa9ab` —— 本卡 + docs/tasks/inbox/ACTIVE-回执-QODER-23.md + docs/evidence/qoder-23/**（14 文件）。其后另有一笔**只含两份日志**的证据补笔（`raw/45` 八次确定性复跑 + `raw/48` 尖端出厂读数，`app-mobile` 面 0 行），该笔哈希受自指限制不预写，复现 `git log --oneline -4`）
  ③ 未 push、未开 PR（红线 §四）
证据（可复跑）：见 §三 / §五（命令 + 原始输出摘要 + 行号 + SHA256，全部落 docs/evidence/qoder-23/）
验收自评：见 §四，逐条「自评达标 / 未达成 + 依据」；最终判定权在凌舟，本卡不含验收结论
未完成与阻塞：见 §七（源码面未验项：真机 APP-PLUS 分支、H5 浏览器运行态、短 tag 一侧无用例覆盖）
风险与自我报备：见 §八（含 3 条派单口径与实测不一致、1 条文件归属面的自我报备）
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-23-回传.md
关联卡：docs/tasks/inbox/QODER-23-gcm-tag-length.md
```

> 派单人：凌舟（总负责人）｜执行方：Qoder（移动端）｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-23`（唯一写入面）｜分支：`fix/qoder-23-gcm-tag-length`
> 并发协议：`D:\Users\ZXQL\wt-agents\_qoder23-26-exec-protocol-20261021.md`（已完整读取后再动手）
> **本卡只写执行方自评 + 依据 + 待裁项，不出现任何验收方口径判词。**

---

## 一、基线与提交

| 项 | 值 | 出处 |
| --- | --- | --- |
| 开工 HEAD（实测） | `bc1087eec4b880827518444be36f5874e330e1d3` | `raw/00` 说明段（21:50 会话内实测；该时刻未落文件，已在 `raw/00` 诚实标注，改以下两条可核证据替代） |
| 实现笔第 1 父 = 基线 | `git rev-list --parents -n1 HEAD` ⇒ `ad73898e8da79… bc1087eec4b88…` | `raw/00-baseline-and-tree.log` |
| 分支 | `fix/qoder-23-gcm-tag-length` | `raw/00` |
| 实现笔 | `ad73898e8da79a6ce6ec309cace397a96a667479` `fix: QODER-23 AES-GCM 认证标签长度守卫与确定性篡改用例`（3 文件，逐文件 `git add`） | `raw/00` / `raw/40` |
| 实现笔改动面 numstat | `crypto.ts +9/−2`、`storage-crypto.spec.ts +43/−2`、`gates-baseline.json +2/−2` | `git diff --numstat bc1087ee HEAD` |
| 文档笔 | `e33f35411abb5ffa7e3fc3c12adcc29132afa9ab` `docs: QODER-23 回传卡 + 回执 + 证据树（…）`（14 文件，逐文件 `git add`，无 `-A`）；其后一笔只含 `raw/45`+`raw/48` 两份日志（`app-mobile` 面 0 行，自指限制不预写哈希） | `raw/40` / `raw/48`：`git log --oneline -3` |
| 上游 / push | 全程未 `git push`、未开 PR、无远端写动作 | §六 红线对照 |
| node_modules | 树根与 `app-mobile/` 下均为可用真实目录（`vitest/vitest.mjs`、`vue-tsc/bin/vue-tsc.js` existsSync = true/true），未 `npm install` | `raw/00` |

---

## 二、逐条实现说明（对应任务书 §二 五条）

### §二.1 长度守卫在常量时间比较之前 —— `app-mobile/src/utils/crypto.ts`

`aesGcmDecrypt`（函数体 `:602-642`）新增：

```
:625  // 认证标签长度守卫（QODER-23）：GCM tag 规范长度恒为 16 字节，必须先拒绝非规范长度，
:626  // 再进入下面的定长比较。原因（实测见 docs/evidence/qoder-23/probe）：比较循环只取 tag[0..15]，
:627  //   · tag 长于 16 字节 ⇒ 尾部字节完全不参与校验，前 16 字节合法即可静默通过（认证被绕过）；
:628  //   · tag 短于 16 字节 ⇒ 越界位读作 undefined，ToInt32(undefined)===0，只是"恰好"被非零期望字节兜住。
:629  // 两种形态都不该依赖巧合，统一在此返回 null。
:630  if (tag.length !== 16) return null // 认证标签长度非法 ⇒ 等同校验失败
```

位置硬要求满足：守卫在 `:632` 的「常量时间比较」注释与 `:633-635` 的 `diff` 循环/判定**之前**；`:635` 的 `if (diff !== 0) return null` 原文未动。JSDoc 同步落口径：`:598`（`@param tag`）、`:600`（`@returns` 增加"长度非 16 字节"）。
`#ifdef` 纪律：改动全在 `aesGcmDecrypt` 单一函数体内，**未新增任何标识符声明**（只有一条 `if` 语句 + 注释），`grep -c "function aesGcmDecrypt"` 恒为 1，type-check 实测 0=0（§三），无重复声明风险。
其余语义零改动：AES-CTR / GHASH / `aesGcmEncrypt`（`:559-591`，tag 恒 16 字节）、`deriveKey`、H5/APP 存储策略、KDF 一律未碰（红线 §四）。

### §二.2 篡改用例改确定性 —— `app-mobile/tests/storage-crypto.spec.ts:56-68`

旧写法（已删）：`const bad = { ...enc, tag: enc.tag.slice(0, -4) + 'AAAA' }`。实测（`probe/probe-b64.txt`）：B2 解出 **18 字节**，B4 被比较的 16 字节内**只有 `tag[15]` 被置成 0**，其余差异（16/17）落在比较区外从不被读 ⇒ 真 tag[15] 恰为 0 时 `diff = 0` 不抛 ⇒ 约 **1/256 概率假绿**；QODER-22 已用 2000 次加密实测到 8 次命中（0.0040 vs 理论 0.00391），同日志还记录过一次清洁态真红（`storage-crypto.spec.ts:37`，`1 failed | 185 passed`），出处 `docs/evidence/qoder-22/raw/50-storage-crypto-flake-probe.log`。

新写法（确定性，三步钉死）：

```
:59    const tagBytes = b64ToBytes(enc.tag)
:60    expect(tagBytes.length).toBe(16)              // ① 先断言合法 tag 解码长度 = 16
:62    tagBytes[0] ^= 0x01                            // ② 翻转被比较区内的明确字节（tag[0] 最低位）
:63    const bad = { ...enc, tag: bytesToB64(tagBytes) }
:64    expect(b64ToBytes(bad.tag).length).toBe(16)    // ③ 重编码后长度仍是规范 16 ⇒ 本用例考比较、不考守卫
:65    expect(() => decrypt(bad, key)).toThrow()      // ⇒ diff 恒非 0（探针 D3/D4：差异恰 1 字节、diff=1）
```

`atob`/`btoa` 与 `crypto.ts` 自研 codec 的解码**逐字节相同**（探针 C2/C3），故测试侧换算不构成第二套语义；换算助手 `:20-30` 只在模块顶层定义、不做文件 IO（协议 §四.7）。

### §二.3 新增非规范长度（18 字节）用例 —— `storage-crypto.spec.ts:70-81`

```
:71-73  enc = encrypt('top-secret', key)；expect(legit.length).toBe(16)
:76-77  const padded = new Uint8Array(18); padded.set(legit)   // 合法 16 字节 + 追加 2 字节
:78     const bad = { ...enc, tag: bytesToB64(padded) }
:79     expect(b64ToBytes(bad.tag).length).toBe(18)            // 钉住"可解码为 18 字节"
:80     expect(() => decrypt(bad, key)).toThrow()              // 必须被拒绝
```

关键构造：追加的 2 字节放在**尾部** ⇒ 前 16 字节与合法 tag **逐字节相同**（探针 E3），故 §二.1 的守卫是这条用例唯一的支点（探针 E4：无守卫时 `diff = 0` ⇒ 静默返回明文）。反测 R1 即据此成立。

### §二.4 既有断言零放宽

`storage-crypto.spec.ts` 的 4 条既有用例（`:35` 密钥 32 字节且可复现、`:41` 明文往返含中文/JSON、`:48` IV 随机两次密文不同、`:56` 内的错误密钥 `expect(() => decrypt(enc, wrongKey)).toThrow()` 两行）**逐字保留**；`it.only`/`it.skip`/`test.each` 一个未加，超时未改，未吞异常，未加 `eslint-disable`，未改 `vitest.config.ts` / 四门脚本 / `.eslintrc.cjs`。文件用例数 4 → 5，文件数不变（11）。

### §二.5 反测（两轮）

见 §五台账。R1 摘长度守卫 ⇒ 只有 18 字节用例红；R2 摘常量时间比较的失败分支 ⇒ 只有确定性翻转用例红；两轮 `INJECT_EXIT=0`、注入后回读三件套在场、`cp` 复原后 `worktree-crlf` SHA256 与注入前恒等、复跑 `TEST_EXIT_RERUN=0`。

---

## 三、门 · 构建 · 守卫读数（全部在工作树根跑）

| 门 / 构建 | 命令（cwd = `D:\Users\ZXQL\wt-agents\QODER-23`） | 读数 | 出处 |
| --- | --- | --- | --- |
| 门 1 type-check | `npm --workspace app-mobile run check:gates` 内联 | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条` ⇒ **0 = 0** | `raw/20-gates-tip.log:13-14` |
| 门 2 lint | 同上 | `当前 error 0（基线 0）、warning 12872（基线 12872）` ⇒ **无新增 error、warning 未劣化** | `raw/20:20-21` |
| 门 3 test | 同上 | `Test Files 11 passed (11)` / `Tests 187 passed (187)`；门行 `当前 11 文件 / 187 用例，基线 11 / 187` ⇒ **无"高于基线"提示**（已同步上调） | `raw/20:52-54` |
| 门 4 check:contract | 同上 | `差集 1 条，其中具名豁免 1 条` ⇒ EXIT=0；`contractDrift` 段本卡零改动 | `raw/20:60-66` |
| `check:gates` 总 | 同上 | **CHECK_GATES_EXIT=0** | `raw/20` |
| 构建 | `npm --workspace app-mobile run build:h5` | **BUILD_H5_EXIT=0**、`DONE Build complete.`、产物 `app-mobile/dist/build/h5/{index.html,assets,static}` 实测在位 | `raw/21-build-h5.log` |
| backend 只读 | `git diff bc1087ee..HEAD -- backend/ \| wc -c` | **0 字节**（工作树侧 `git diff bc1087ee -- backend/` 亦 0） | `raw/30-scope-and-redlines.log` |
| 改动面 | `git diff --name-only bc1087ee` | 仅 3 个文件（crypto.ts / storage-crypto.spec.ts / gates-baseline.json） | `raw/30` |
| 行尾形态 | `git ls-files --eol` | 三文件均 `i/lf w/crlf`；`bareLF=0`（未混入 LF） ⇒ SHA 分形态登记，不跨形态比较 | `raw/30` |

终态 `worktree-crlf` SHA256（`raw/30`）：`crypto.ts 97063e80…d0211c6`／`storage-crypto.spec.ts 880fda05…a1f6476`／`gates-baseline.json 83484b9b…2f8adb`。

补充两读（同一命令、文档笔 `e33f3541` 之后的尖端复跑）：

| 补充 | 命令 | 读数 | 出处 |
| --- | --- | --- | --- |
| 尖端出厂 | `npm --workspace app-mobile run check:gates` ＋ `build:h5`（HEAD=`e33f3541`） | **CHECK_GATES_EXIT=0**（type 0=0／lint error 0 warning 12872／test 11/187=基线 11/187／contract 差集 1 豁免 1）；**BUILD_H5_EXIT=0**、`DONE Build complete.`；`git status --porcelain` 只余待补的 `raw/45`+`raw/48`；backend diff **0 字节** | `raw/48-tip-gates.log` |
| 确定性复跑 | 连跑 `npm --workspace app-mobile run test` **8 次** | **RUN=1..8 全部 EXIT=0**，每次 `Tests 187 passed (187)`、`storage-crypto.spec.ts (5 tests)` ✓ ⇒ 旧写法那条 1/256 概率红面复跑不见（结构性依据是探针 D3/D4，8/8 只是侧证，不以统计替代证明） | `raw/45-determinism-reruns.log` |


---

## 四、判据自对账（任务书 §三 硬验收逐条）

| 判据（卡 §三原文） | 目标 | 实测 | 自评 |
| --- | --- | --- | --- |
| `check:gates` EXIT=0 | EXIT=0 | **0**（`raw/20`） | 达标 |
| type 0 = 0 | 0=0 | **当前 0 条 / 基线 0 条** | 达标 |
| lint error 0、warning ≤ 12872 | error 0 / ≤12872 | **error 0 / warning 12872（等于基线，未劣化）** | 达标 |
| test 全过、基线按实测只上调 | 全过 + 只升 | **11/187 全过；tests 段 11/186 → 11/187（只升 `testCount`，`testFiles` 不动），其余四段零改动** | 达标 |
| `build:h5` EXIT=0 | EXIT=0 | **0**，`DONE Build complete.` | 达标 |
| 反测①（两条）记 `INJECT_EXIT=0` | 均 0 | **R1=0、R2=0**，无 VOID 轮 | 达标 |
| 反测注入后回读 | 三件套 | 两轮均 `注入标记在场=true / 原行已消失=true / 另一处守卫仍在=true`（含文件字节数与 CRLF 行数） | 达标 |
| 反测目标测试 EXIT=1 | 1 | **R1 TEST_EXIT=1（红点=18 字节用例，`spec.ts:80:37`）；R2 TEST_EXIT=1（红点=翻转用例，`spec.ts:65:37`）**，各只 1 条红、点名可定位 | 达标 |
| 反测复原 SHA | 恒等 | 两轮 `SHA_BEFORE == SHA_AFTER == 97063e803c60a1bf541caf02c72dccd0b9712d2d3868e81afc0032845d0211c6`（`worktree-crlf` 形态），`cp` 复原、未用 `sed -i`/编辑器写回；`grep -c ANTI-R` = 0 | 达标 |
| 反测复跑 EXIT=0 | 0 | 两轮 `TEST_EXIT_RERUN=0`；终态四门再跑 `raw/20` EXIT=0 | 达标 |
| `git diff bc1087ee..HEAD -- backend/` = 0 | 0 字节 | **0** | 达标 |
| 工作树 clean | 空 | **空**（实现笔 + 文档笔逐文件 add 后 `git status --porcelain` 无输出，`raw/40`） | 达标 |
| 卡 §二.1 守卫在比较之前 | 是 | `crypto.ts:630` 早于 `:632-635` | 达标 |
| 卡 §二.2 确定性篡改 + 先断言长度 16 + 翻转明确字节 + 必抛 | 是 | `spec.ts:60/62/65`（+ `:64` 钉重编码后长度 16） | 达标 |
| 卡 §二.3 18 字节非规范标签必须被拒绝 | 是 | `spec.ts:70-81` | 达标 |
| 卡 §二.4 既有断言不放宽 | 是 | 4 条既有用例逐字保留（§二.4） | 达标 |
| 卡 §四 不 push / 不开 PR / 不 `git add -A` | 硬性 | 未 push、未开 PR；三次 `git add <路径>` 逐文件 | 达标 |
| 卡 §四 不改存储策略/KDF/AES-CTR/GHASH 语义 | 硬性 | 只加 1 条 `if` 与注释；`aesGcmEncrypt`/`ghash`/`aesCtrCrypt`/`deriveKey`/`storage*` 零改动 | 达标 |

**未达成项：无。**

---

## 五、反测轮次台账

注入器：`D:\Users\ZXQL\wt-agents\_qoder23_work\inject-guard-off.cjs`（树外，`.cjs` 非 `.mjs`；整行字面量匹配，命中数 ≠ 1 ⇒ 不写文件并 `exit(2)`）。副本 `probe/inject-guard-off.cjs.txt`。
备份（树外）：`D:\Users\ZXQL\wt-agents\_qoder23_bak\crypto.ts.R1.before` / `crypto.ts.R2.before`。
目标命令：`npm --workspace app-mobile run test`（跑的是常驻门 3，不是裸 vitest ⇒ 红的是门禁本体）。

| 轮 | 替换行 | needle hits | INJECT_EXIT | 注入后回读 | TEST_EXIT | 红行原文（行号） | SHA_BEFORE / SHA_AFTER | RESTORE_RC | 复跑 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `crypto.ts:630` `if (tag.length !== 16) return null …` → 注释 `[QODER-23-ANTI-R1]` | 1 | **0** | 在场=true／原行消失=true／比较分支仍在=true；`rb_crlf=940 rb_totalLF=940`（无 LF 混入） | **1** | `FAIL tests/storage-crypto.spec.ts > 存储加解密往返（AES-256-GCM） > 非规范长度 tag 一律拒绝（可解码为 18 字节的标签不得进入定长比较）` → `AssertionError: expected [Function] to throw an error` @ `tests/storage-crypto.spec.ts:80:37`；`Tests 1 failed \| 186 passed (187)`；`✗ vitest 本体失败（EXIT=1）⇒ 门 3 红` | `97063e80…` / `97063e80…`（相等） | 0 | **0** |
| R2 | `crypto.ts:635` `if (diff !== 0) return null // tag 校验失败` → 注释 `[QODER-23-ANTI-R2]` | 1 | **0** | 在场=true／原行消失=true／**长度守卫仍在=true**；`rb_crlf=940 rb_totalLF=940` | **1** | `FAIL … > tag 校验失败即抛（确定性翻转 tag[0]，绝不返回明文）` → `AssertionError: expected [Function] to throw an error` @ `tests/storage-crypto.spec.ts:65:37`；`Tests 1 failed \| 186 passed (187)` | `97063e80…` / `97063e80…`（相等） | 0 | **0** |

分离性（本卡反测的设计要点，红点互不重叠）：R1 态下 `tag 校验失败即抛（确定性翻转 tag[0]…）` 仍 ✓；R2 态下 `非规范长度 tag 一律拒绝…` 仍 ✓ ⇒ 两条用例分别钉住守卫与比较两处，红了即可定位是哪一面坏（对齐既往裁定：测试名与守护对象必须一对一）。

作废轮：**无**（两轮 `INJECT_EXIT` 均为 0，未出现"注入静默空转"或"产物没出现"的互斥读数）。

---

## 六、红线对照（逐条自查）

| 红线 | 自查 | 依据 |
| --- | --- | --- |
| 不 push / 不开 PR | 遵守：全程无 `git push`、无 `gh pr create`，分支无 upstream 写动作 | 会话动作面 |
| 不 `git add -A` / `git add .` | 遵守：实现笔 3 次 `git add <具体路径>`；文档笔逐文件 add | `raw/40`（提交前后 `git status --porcelain`） |
| 提交前 `git status --porcelain` 自查 | 做过：实现笔提交前只有 3 个 `M` + 本卡证据目录 `??`，无第三方无关文件 | `raw/30` |
| `git diff bc1087ee..HEAD -- backend/` = 0 | **0 字节** | `raw/30` |
| 不放宽断言 / `it.skip` / 改超时 / `eslint-disable` / 吞异常换绿 | 未做任何一项；基线只有 `tests.testCount` 186→187（升），其余四段一字未动、note 只在末尾追加本卡一段 | `git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json`（2 行） |
| 不把"构建通过"当"运行通过" | `build:h5` 只登记为"可编产物"；H5 浏览器运行态、真机 APP-PLUS 分支一律写 **未验**（§七） | §七 |
| 时间不够先提交实现 | 不适用：实现笔 `ad73898e` 已先于证据与卡片入库 | §一 |
| 只在 `D:\Users\ZXQL\wt-agents\QODER-23` 写入 | 遵守：未读写其他 QODER 工作树；对 `D:\Users\ZXQL\ZXQL-MS` 主检出仅读任务书与协议 | §一 工作树表 |
| 不共用其他树、不重新 `npm install` | 遵守：本树 `node_modules` 现成可用（`raw/00`），未安装、未建 junction | `raw/00` |
| SHA 标形态 | 全程标 `worktree-crlf`；`git hash-object`（git-blob-lf）另行为列，未跨形态直接比较 | `raw/30` |
| 取证不用 `npx rg` | 遵守：字面量核对用 Grep 工具与 `grep`/`grep -c`，未调用 `npx rg` | 会话动作面 |

---

## 七、未完成与阻塞 / 未验清单

**阻塞：无。**

未完成 / 未验（如实，不得当通过）：

1. **短 tag（< 16 字节）一侧无独立用例**。卡 §二.3 只点名 18 字节非规范标签，为不扩大动作面本卡未加"截断标签"用例；同一守卫已覆盖该方向，但用例面未证。依据：探针 F1–F4 已机检"短 tag 靠巧合拒绝"，属**未验**。
2. **真机未验**：APP-PLUS / iOS / Android / 微信开发者工具均未跑。`crypto.ts` 的 `#ifdef APP-PLUS` 分支只经 vue-tsc **静态**检查（`#ifdef` 是注释，tsc 对各分支都求值，故新守卫在类型面已被覆盖），但**无任何运行期读数**；vitest 侧由 `uni-ifdef-shim` 固定按 **H5 分支**加载（`vitest.config.ts` 文件头说明），⇒ 常驻门 3 实际跑到的是 H5 形态的 `aesGcmDecrypt`。
3. **H5 浏览器运行态未验**：本卡 src 改动只在纯函数内新增一条 `if`，未起 `dev:h5`、未接 mock 后端、未取 DOM/console/network 读数；`build:h5` EXIT=0 仅证明可编产物。
4. **行为变更风险（影响面已按源码核清，但无运行样本）**：守卫使"非 16 字节 tag"从"多半静默解密/偶然解密"变为**必然 `return null`**，`decrypt()`（`crypto.ts:786`）随即抛错。抛错的**唯一生产消费点**是 `getSecureStorage` 的 `#ifndef H5` 分支（`:913-921`）：`catch` 后返回 `''`（注释原文已把"数据被篡改、密钥不匹配"列为预期），⇒ 表现为"读不到 token/用户/租户/CSRF/记住我"（`src/api/storage.ts:229/265/301/346/397/413/425` 与 `src/utils/pin-ssl.ts:102` 共 8 个读取点）⇒ **静默登出/空值，而不是崩溃**。H5 分支不走 AES-GCM（`:889-907`：新格式是 `b64:` 混淆，旧 AES-GCM 数据已被判失效并 `removeItem`），故 H5 存量数据不受本守卫影响。若 APP/小程序侧真存在被截断的历史 `enc_*`，后果由"偶尔还能解出来"变为"一定解不出来"。本卡未做端侧存储样本普查 ⇒ **未验**，见 §十.3 建议派单。
5. `app-mobile/tests/**` 不在 `tsconfig.include`（`src/**`）与 eslint 面（`eslint src`）内 ⇒ 新助手函数 `b64ToBytes`/`bytesToB64` 只经 vitest 运行验证，**不经 type-check/lint 门覆盖**。这是既有门覆盖口径，本卡未扩门。
6. 四卡并行读数未收敛：本卡 `tests` 11/187 只是**本树**口径，最终由集成单收敛（协议 §三）。

---

## 八、风险与自我报备（含越面发现）

1. **文件归属面的自我报备（已找到授权出处，不算越面）**：任务书 §一"只准改"清单列了 3 项（`crypto.ts`、`storage-crypto.spec.ts`、回传卡 + `docs/evidence/qoder-23/**`），**未列** `app-mobile/scripts/gates-baseline.json`；而同一张卡 §三 要求"基线按实测只上调"、批次卡 `QODER-BATCH-23-26-20261021.md:17` 明确写了"`gates-baseline.json` 如因新增测试需要调整，只允许本单实测值和新 note，禁止重排他人记录"。⇒ 本卡按批次卡授权只动 `tests` 段（`testCount` 186→187 + note 末尾追加本卡一段），其余四段与 `_comment` 一字未动、他人记录未重排。**报备点**：任务书 §一 的清单不完备，请凌舟下轮派单把基线文件写进"只准改"（避免下一张卡按字面理解而漏调基线导致门 3 长鸣"高于基线"提示）。
2. **派单口径与实测不一致（已按实测落地，不按旧文硬改）**：
   - ① 协议 §三 与本卡派单消息写作 `tests.fileBaseline` / `tests.testBaseline`；**实测字段名是 `tests.testFiles` / `tests.testCount`**（`gates-baseline.json` 与 `scripts/test-gate.mjs` 双向核对）。已按真实字段名改。
   - ② 派单称"`tag[16..]` 溢出为 undefined，异或后为 NaN ⇒ `diff |= NaN` 结果仍是 0"。**实测否掉 NaN 这条路径**：`^` 先做 `ToInt32`，`ToInt32(undefined) === 0`（探针 F2：`undefined ^ 4 = 4`），且定长循环上界恒为 16，**长 tag 的越界字节根本没被读**（探针 E4：18 字节 tag 前 16 字节合法时 `diff = 0` ⇒ 静默通过）。缺陷方向与结论不变（守卫必要、18 字节必须拒），只是根因描述需更正为"尾部字节完全不参与校验"。已在 `probe/README.md` 与本节报备。
   - ③ 派单称"base64 尾四字符替换…只有约 1/256 概率命中被比较的前 16 字节"。实测更精确：篡改后 `tag[15]` **恒被置 0**，被比较区内只有它位移 ⇒ 假绿条件是"真 tag[15] 恰为 0"，概率约 1/256（QODER-22 探针 2000 次实测 8 次，0.0040）。方向一致，表述精度差异，记此。
3. **越面发现（本卡未动，建议另立单）**：`aesGcmDecrypt`/`aesGcmEncrypt` 对 **IV 长度没有守卫**。`j0.set(iv)`（`:616`/`:572`）在 `iv.length < 12` 时静默留零、`iv.length > 16` 时抛 RangeError，`12 < iv.length <= 16` 则按非 96-bit IV 模式误用（GCM 需另走 GHASH(J0) 路径）。同族边界缺陷，超出本卡"只补认证标签长度边界"的红线，**本卡零改动**，请裁是否派 QODER-23F1。
4. **行为变更风险**（源码面影响链见 §七.4）：守卫使"非 16 字节 tag"从"多半静默解密/偶然解密"变为**必返回 null**，消费点只有 `getSecureStorage` 的 `#ifndef H5` 分支，`catch` 后返回 `''` ⇒ 端侧后果是"读不到 ⇒ 静默登出/空值"，不是崩溃；H5 分支不走 AES-GCM，存量不受影响。**残留敞口**：APP/小程序侧若确有被历史 `uni.arrayBufferToBase64/base64ToArrayBuffer` 尾部损坏过的 `enc_*` 数据（该风险见 `crypto.ts:862-863` 原注释），改动后从"偶尔还能解出来"变为"一定解不出来"。本卡无该样本扫描证据，建议验收前补一次端侧存储 tag 长度普查（§十.3）。
5. 本卡未改 `vitest.config.ts`、四门脚本、`package.json`、`.eslintrc.cjs`；未动 `crypto.ts` 其他任何函数 ⇒ 无重复声明、无双份导出漂移风险（type-check 0=0 为证）。
6. 未验清单第 2/3 条若被要求补 H5 运行证据，需要 `dev:h5` + `docs/evidence/qoder-11r/mock-backend.mjs` 夹具与 browser-use，本卡未做（不在卡 §二/§三 判据面内）。
7. **任务书与批次卡不在本分支 git 内**（实测）：`docs/tasks/inbox/` 下本树只有 `QODER-23` 的**回执**位（本卡新写）与历史 `QODER-1..22` 卡，**没有** `QODER-23-gcm-tag-length.md`，也没有 `QODER-BATCH-23-26-20261021.md`；两者只存在于主检出 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem\docs\tasks\inbox\`（未提交态）。⇒ 本卡按协议 §一"主检出只读"逐字读取，**未把任务书复制进本树提交**（不属本卡文件面）。若要求任务书随卡入库，请裁由谁做（派单方或执行方），避免四卡并行各自复制造成冲突。
8. **`docs/tasks/current-tasks.md` 与 `docs/tasks/inbox/ACTIVE.md` 本卡未动**：项目 AGENTS.md 的旧信箱协议要求"回执后归档 ACTIVE.md 并更新 current-tasks.md"，但本批走的是批次协议 §六 的**每卡独立文件名**通道（`ACTIVE-回执-QODER-23.md`），且 `ACTIVE.md` 是 2026-10-16/17 的 S3 批路由表（末次提交 `7ea26e8d`）、`current-tasks.md` 是凌舟台账 ⇒ 四卡并行下由执行方改这两份=并发写他人台账（协议 §"并行会话纪律"明令禁止删改他人在办行）。**处置：两份均未改，在此报备**，请裁由谁统一收口。

---

## 九、踩坑实录（本卡实际遇到的）

1. **反测靶标要"前 16 字节逐字节等于合法 tag"** 才叫摘守卫必红。最初想用旧写法那串（尾四字符换成 `AAAA`）当 18 字节用例，但它同时改了 `tag[15]`，摘掉守卫后**照样可能红 255/256 次**，测的是巧合不是守卫。改为"合法 16 字节 + 尾部追加 2 字节"（`padded.set(legit)`）后，`diff` 恒 0（探针 E4），R1 才是必红。旧坑记此，避免下一张卡再踩。
2. **`String.fromCharCode` 拼 base64 前先核对两套 codec**：测试侧用 `atob/btoa`、实现侧用自研 codec，若两者对 `=` 的处理不同，长度断言会变成"测自己的 helper"。已用探针 C2/C3 做逐字节一致性核对后才敢写断言（协议 §四.11 的"注入/产物互斥读数"同源纪律）。
3. **`sed -i` 禁用于本仓反测**：Windows 工作树是 `w/crlf`，`sed -i` 会整篇归一成 LF，`SHA_BEFORE == SHA_AFTER` 恒等反测当场失效。本卡全程 `cp` 备份/复原，注入器只做单行字面量替换并打印 `rb_crlf=940 rb_totalLF=940` 自证行尾未动。
4. **开工态读数要当场落文件**：`raw/00` 里的 HEAD/status 是本卡提交之后才补的，开工时刻（21:50）的读数只在会话里，无法复测 ⇒ 改为登记"实现笔的第 1 父 = `bc1087ee`"这条可核证据并在文件里诚实标注。下一张卡第一步就把 `raw/00` 落盘。
5. 未踩的坑（提前避开）：全程在**工作树根**跑门（`app-mobile/` 里跑 `npm --workspace` 会 `No workspaces found`）；取证未用 `npx rg`（仿冒包假绿）。

---

## 十、复现命令 + 建议派单

```bash
# 0. 工作树与基线（必须在工作树根跑门，不要 cd 进 app-mobile）
cd /d/Users/ZXQL/wt-agents/QODER-23
git rev-parse HEAD                                    # 文档笔之后 = 文档笔哈希（见 raw/40 说明）；实现笔恒为 ad73898e8da79a6ce6ec309cace397a96a667479
git rev-list --parents -n1 ad73898e                    # 期望 ad73898e 的第 1 父 = bc1087eec4b880827518444be36f5874e330e1d3

# 1. 四门 + H5 构建
npm --workspace app-mobile run check:gates             # 期望 CHECK_GATES_EXIT=0；type 0=0 / lint error 0 warning 12872 / test 11 文件 187 用例 / contract 差集 1 豁免 1
npm --workspace app-mobile run build:h5                # 期望 BUILD_H5_EXIT=0，DONE Build complete.

# 2. 范围与红线
git diff bc1087ee..HEAD -- backend/ | wc -c            # 期望 0
git diff --name-only bc1087ee HEAD                     # 期望恰好 3 个 app-mobile 文件
sha256sum app-mobile/src/utils/crypto.ts               # worktree-crlf ⇒ 97063e803c60a1bf541caf02c72dccd0b9712d2d3868e81afc0032845d0211c6
grep -c 'tag.length !== 16' app-mobile/src/utils/crypto.ts   # 期望 1

# 3. 反测复跑（注入器与备份都在树外）
cp app-mobile/src/utils/crypto.ts /d/Users/ZXQL/wt-agents/_qoder23_bak/crypto.ts.R1.before
node /d/Users/ZXQL/wt-agents/_qoder23_work/inject-guard-off.cjs app-mobile/src/utils/crypto.ts R1   # INJECT_EXIT=0
npm --workspace app-mobile run test                    # TEST_EXIT=1，红点：非规范长度 tag 一律拒绝（spec.ts:80:37）
cp /d/Users/ZXQL/wt-agents/_qoder23_bak/crypto.ts.R1.before app-mobile/src/utils/crypto.ts
sha256sum app-mobile/src/utils/crypto.ts               # 期望与注入前恒等
npm --workspace app-mobile run test                    # TEST_EXIT=0
node /d/Users/ZXQL/wt-agents/_qoder23_work/inject-guard-off.cjs app-mobile/src/utils/crypto.ts R2   # INJECT_EXIT=0
npm --workspace app-mobile run test                    # TEST_EXIT=1，红点：tag 校验失败即抛（spec.ts:65:37）
cp /d/Users/ZXQL/wt-agents/_qoder23_bak/crypto.ts.R2.before app-mobile/src/utils/crypto.ts
npm --workspace app-mobile run test                    # TEST_EXIT=0

# 4. 语义探针（动手前的依据，可独立复跑）
node /d/Users/ZXQL/wt-agents/_qoder23_work/probe-b64.cjs   # PROBE_EXIT=0；看 B2/B4/E3/E4/D3/D4/F2
```

**建议派单（供凌舟裁，本卡不动手）**：

1. **QODER-23F1 · GCM IV 长度边界**（§八.3）：`aesGcmEncrypt`/`aesGcmDecrypt` 补 `iv.length !== 12` 守卫（或在 `>12` 时按 SP 800-38D 的 GHASH(J0) 路径实现），配套用例；面同 `crypto.ts` 同一函数族，反测可复用本卡注入器形态。
2. **短 tag 用例补一条**（§七.1）：`expect(b64ToBytes(bad.tag).length).toBe(12)` 一类截断标签必须抛错，使守卫两个方向都有常驻门覆盖（1 用例 ⇒ tests 再 +1，交集成单收敛）。
3. **存量 `enc_*` tag 长度普查**（§八.4）：本地/H5 `localStorage` 与 APP 侧存储样本扫描，量化"守卫上线后必抛"的真实影响面；若为 0，§八.4 风险敞口关闭。
4. **QODER-23F2（可选）· 门禁口径固化**：`atob/btoa` 与 `crypto.ts` 自研 codec 的一致性目前靠一份树外探针保证，可考虑在 spec 里常驻一条 codec 一致性断言（属测试面扩写，非本卡权限）。
