# R101-QODER-23F1 回传 · AES-GCM IV 与短标签边界

【汇报 QODER-23F1】QODER-23F1 AES-GCM IV 与短标签边界：IV 规范长度守卫已落在构造 J0 之前（crypto.ts:618），短 tag/短 IV/长 IV 四条确定性反测用例补齐，两轮反测各自点名目标用例红、SHA 恒等复绿，四门 11/191 全绿三构建全过
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
交付物：
1. 实现提交 `bbc8aa9ec380133629733222bc766d8722d55b0a`（`app-mobile/src/utils/crypto.ts`、`app-mobile/tests/storage-crypto.spec.ts`、`app-mobile/scripts/gates-baseline.json`）
2. 本回传卡 `docs/tasks/cards/R101-QODER-23F1-回传.md`
3. 回执 `docs/tasks/inbox/ACTIVE-回执-QODER-23F1.md`
4. 证据树 `docs/evidence/qoder-23f1/`（README + raw/00~11 + anti/R-IV、anti/R-TAG + probe 存档）
证据（可复跑）：见 §三、§五 与 `docs/evidence/qoder-23f1/`（命令+原始输出+行号+SHA 全部落档）
验收自评：见 §四（逐条 通过/未通过 + 依据）
未完成与阻塞：无（全部交付物已落；作废读数留档见 §八）
风险与自我报备：见 §八
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-23F1-回传.md
关联卡：docs/tasks/inbox/QODER-23F1-aes-boundary.md

---

## 一、基线与提交

- 工作树（唯一写入面）：`D:\Users\ZXQL\wt-agents\QODER-23F1`，分支 `fix/qoder-23f1-aes-boundary`（raw/00）
- 开工基线实测：`git rev-parse HEAD` = `2568ef0352929f29e4c99ba79627fea2b5a26476`（= QODER-23 尖端，与派单一致）
- 实现提交（本卡点名三文件）：`bbc8aa9ec380133629733222bc766d8722d55b0a`
- 文档提交（本卡 + 回执 + 证据树）：哈希见 `git log --oneline`（raw/11 及其后一笔）
- `node_modules`：负责人预建的 junction 两层在场（raw/00 实测为 symlink 指向 `QODER-23` 树），未 npm install、未删改

## 二、逐条实现说明（文件:行号）

派单 §一.1（IV 守卫）：`app-mobile/src/utils/crypto.ts:609-618` —— `aesGcmDecrypt` 函数体第一句（在 `aesKeyExpansion`、`H`、J0 构造**之前**）`if (iv.length !== 12) return null`（:618）。注释写明不能靠 `set` 的两个巧合：长 IV 溢出抛**未分类 RangeError**（守卫前实测探针 P4 行，raw/02c）；短 IV 静默零填充——13 字节 IV 第 13 字节取 0x00 时零填充后的 J0 与规范 12 字节完全同型，**守卫前实测解密成功返回了原文**（探针 P1 行）。JSDoc `@param iv`/`@returns` 同步改写（:597/:600）。KDF、GHASH、CTR、加密侧、H5 存储策略零改动（diff 仅上述两处 + 注释，`git diff 2568ef03..HEAD --name-only` = 点名三文件，raw/11 附）。
派单 §一.2（tag 两侧）：既有 18 字节用例逐字保留（spec.ts:78）；新增 15 字节短 tag 用例（spec.ts:120-134）——**确定性构造**：加密侧重采样直到期望 `tag[15]===0`（探针实测 146/237 次内命中，上限 20000），使摘掉 tag 守卫后越界读 `undefined`（ToInt32 归 0）必静默通过 ⇒ R-TAG 轮该用例必红（实测红，见 §五）。
派单 §一.3（IV 两侧）：新增 11 字节（spec.ts:136-147，同型确定性构造 `iv[11]===0`，摘 IV 守卫即零填充解密成功）、13 字节（spec.ts:149-161，破口本体：13<16 不触发 set 溢出、走零填充静默解密成功——探针 P1 行实证非想象）、17 字节（spec.ts:163-173，原 RangeError 溢出路径）三条；断言统一走 `expectClassifiedDecryptFailure`（spec.ts:97-110）：既不返回明文、异常 `name==='Error'`、消息含『AES-256-GCM 解密失败』——**不接受异常类型不同当通过**。
派单 §一.4（保留既有用例）：QODER-23 的确定性 `tag[0]^=0x01` 篡改 + 合法 16 字节钉桩（spec.ts:64-76）与 18 字节拒绝（:78-89）逐字未动；5 个既有用例全保留 ⇒ spec 现 9 个 `it`；无 it.skip、无超时改动、无 eslint-disable、无吞异常换绿（新用例用 try/catch 是为把"返回明文"与"抛错类型"分开断言，异常未被吞：非已分类口径一律判红）。
派单 §一.5（两轮反测）：见 §五 台账，注入器 `probe/inject-f1.cjs.txt`（.cjs、utf8 读写、单行子串替换不触行尾、hits!=1 ⇒ exit(2)）。

## 三、门 · 构建 · 守卫读数（全部工作树根目录跑）

- 基线四门（改动前）：`check:gates` **EXIT=0**，test 门 11 文件 / 187 用例（raw/01）
- 实现后：门 3 **EXIT=0，11 文件 / 191 用例**（raw/04）；`gates-baseline.json` 只调 `tests.testCount` 187→191，note 末尾追加本卡一段，机检 `newNote.startsWith(oldNote)=true`（追加 1262 字符）、`tests` 其余字段与非 tests 四段逐字节相同（raw/05b）
- 收尾全量四门（探针临时件删除后）：**EXIT=0**，type-check 0/0、lint error 0 warning 不劣化、test 11/191、contract 差集全豁免（raw/10）
- 构建（产物 `app-mobile/dist/build/<平台>` 实测存在）：`build:h5` **EXIT=0**（raw/06）、`build:mp-weixin` **EXIT=0**（raw/07）、`build:app` **EXIT=0**（raw/08）
- 守卫前后形态（同一探针两次跑，raw/02c 与 raw/03）：守卫前 P1（13 字节 IV 尾 0x00）返回明文 `"probe-payload-中文"`、P4（17 字节）`name=RangeError "offset is out of bounds"`；守卫后 P1~P7 全部 `name=Error "AES-256-GCM 解密失败：…"`
- backend：`git diff bc1087ee..HEAD -- backend/ | wc -c` = **0**（raw/11）；未起任何 dev/mock server（本卡零端口动作）

## 四、判据自对账（派单 §二 硬验收，逐条）

1. `check:gates` EXIT=0 且 test 文件数仍为 11、用例数从 187 按实测上调至 191 —— **通过**（raw/04、raw/10；基线三处受改字段机检见 raw/05b）。
2. `build:h5`/`build:mp-weixin`/`build:app` 均 EXIT=0 —— **通过**（raw/06~08）。
3. 两轮反测齐全（INJECT_EXIT=0、注入回读、红点名、树外 cp 复原、SHA_BEFORE==SHA_AFTER worktree-crlf、MARKER_RG_EXIT=1、复跑绿）—— **通过**（§五）。
4. backend diff=0、工作树 clean —— **通过**（raw/11；本回传卡落笔后逐文件 add，收尾复核见 raw/11 第二笔）。
5. 未起 dev/mock server —— **通过**（全程仅单测+构建命令）。

## 五、反测轮次台账

**R-IV（摘 IV 长度守卫，tag 守卫在位）**——anti/R-IV-guard-removed.txt：
- `INJECT_NEEDLE_HITS=1 (期望 1)`、`INJECT_FILE_HAS_CRLF=true BARE_LF_COUNT=0`、回读「标记在场=true 原行已消失=true 另一处守卫仍在场=true」、`INJECT_EXIT=0`、`INJECT_RC=0`
- 注入态 `TEST_EXIT=1`，红点名（vitest FAIL 行原文，用例标题+spec 行号）：
  1. × `短 IV 即拒（11 字节、截尾后零填充与规范 J0 同型的 IV 必须抛已分类解密失败）`（it 在 spec.ts:136，红在 :146 调用→helper :105 `expected 'top-secret' to be null`）
  2. × `长 IV 即拒·13 字节（守卫前实测静默零填充解密成功，守卫后必须抛已分类解密失败）`（it 在 spec.ts:149，红在 :160→:105 同型静默解密成功）
  3. × `长 IV 即拒·17 字节（守卫前实测抛未分类 RangeError，守卫后必须抛已分类解密失败）`（it 在 spec.ts:163，红在 :172→helper :107 `expected 'RangeError' to be 'Error'`）
  - 汇总：`Tests 3 failed | 188 passed (191)`；15/18 字节两条 tag 用例保持在位守卫下绿（证明两轮各摘一守卫互不串台）
- 复原 `cp /d/Users/ZXQL/wt-agents/_qoder23F1_bak/crypto.ts.R-IV.before`、`RESTORE_RC=0`；`SHA_BEFORE=1a6bd4ef655e9526864a1298323b9f6df967ba9276a1ea338fd69c607862f29f == SHA_AFTER`（worktree-crlf 形态）；`MARKER_RG_EXIT=1`（rg 无残留）；复跑 `TEST_EXIT_RERUN=0`（11/191）

**R-TAG（摘 tag 长度守卫，IV 守卫在位）**——anti/R-TAG-guard-removed.txt：
- `INJECT_NEEDLE_HITS=1`、`INJECT_EXIT=0`、回读三 Boolean 全真
- 注入态 `TEST_EXIT=1`，红点名：
  1. × `非规范长度 tag 一律拒绝（可解码为 18 字节的标签不得进入定长比较）`（it 在 spec.ts:78，红在 :88 `expected [Function] to throw an error`——前 16 字节合法即静默通过）
  2. × `短 tag 一律拒绝（解码 15 字节、且期望 tag[15]===0 的标签必须抛已分类解密失败）`（it 在 spec.ts:120，红在 :133→helper :105 `expected 'top-secret' to be null`——越界读 undefined 巧合静默通过，确定性构造生效）
  - 汇总：`Tests 2 failed | 189 passed (191)`；三条 IV 用例在 IV 守卫在位下绿
- 复原 cp、`RESTORE_RC=0`；`SHA_MATCH=true`（同一 1a6bd4ef… 恒等，worktree-crlf）；`MARKER_RG_EXIT=1`；`TEST_EXIT_RERUN=0`

## 六、红线对照（逐条自检）

- 未 push、未开 PR；`git add` 逐文件（三文件各自一条命令）—— 遵守
- 未读写 QODER-23/24/25/26 工作树；主检出只读 —— 遵守
- 未 npm install、未动 junction —— 遵守
- 未只补测试不补守卫（守卫在 crypto.ts:618，且 R-IV 红证明测试真的依赖它）—— 遵守
- 未把"异常类型不同"当通过（helper 显式断言 `name==='Error'`+消息前缀，R-IV 轮 RangeError 即红）—— 遵守
- 未改 KDF、GHASH、CTR、加密侧、H5 存储策略 —— 遵守（diff 面仅 aesGcmDecrypt 头部 + JSDoc 两行）
- 未放宽既有用例、无 it.skip/超时/eslint-disable/吞异常 —— 遵守
- 未起 dev/mock server —— 遵守

## 七、未完成与阻塞

无。

## 八、风险与自我报备

1. 作废读数留档三笔（未改写原始日志）：raw/02（vitest 实际在仓库根 node_modules，`app-mobile/node_modules` 为部分目录）、raw/02b（探针配置 JSDoc 里的 glob 字面量 `*/` 提前闭合块注释致 esbuild `Unexpected "*"`）、raw/05（Git Bash `/tmp` 被解析为 `D:\tmp` 的 ENOENT）。有效读数分别为 02c、05b。
2. 用户可见文案：IV 非规范长度被拒后走的是 decrypt() 既有『认证标签校验未通过（数据可能被篡改或密钥不匹配）』消息，语义上略宽（实为 IV 长度非法）。未改文案（改了会动用户可见字符串、越出本卡点名面），是否另立文案卡请负责人裁。
3. 两条用例含重采样循环（期望 256 次内命中、上限 20000），全量门 3 实测总时长 4.5s 级（raw/04/10），超时风险低但非零；上限内命不中时用例红并打印"重采样上限内必须命中"消息，不会假绿。
4. `tests.note` 追加 1262 字符使 tests 段单行继续变长，属基线文件既有形态（前四张卡同款追加），无结构改动。

## 九、踩坑实录

1. 块注释内写 `tests/**/*.spec.ts` 这类 glob：`*/` 会提前闭合 `/** … */`，esbuild 加载配置即炸（02b）；本轮探针配置与 spec 头注释统一改为行注释/避开连排。
2. `app-mobile/node_modules` junction 不含 vitest 本体，test-gate 用的是**仓库根** `node_modules/vitest/vitest.mjs`；手搭命令须走根路径（02）。
3. MSYS 文本模式吞 `\r`：`grep -c $'\r'` 对 CRLF 文件报 0，EOL 形态判定必须交给 Node（注入器的 HAS_CRLF 读数）或 `od -c`。
4. vitest 汇总行与 FAIL 行内嵌 ANSI 码，原始日志直接 grep 不到 `Tests  N failed`，落档前先 `sed 's/\x1b\[[0-9;]*m//g'`（不改写原始日志正文，另段摘录）。
5. 短 tag/短 IV 想"摘守卫必红"必须钉巧合字节（期望 tag[15]===0 / iv[11]===0）：越界读 undefined 经 ToInt32 归 0，巧合不成立时摘守卫照样抛已分类错 ⇒ 反测假绿。本轮 02c 探针 P5a（任意 15 字节 tag 在守卫摘除前也抛错）即该坑的实证。

## 十、复现命令 + 建议派单

```bash
cd /d/Users/ZXQL/wt-agents/QODER-23F1
git rev-parse HEAD                                   # 期望：本文档提交哈希
npm --workspace app-mobile run check:gates           # 期望 EXIT=0；11 文件 / 191 用例
npm --workspace app-mobile run build:h5              # EXIT=0（mp-weixin / app 同）
# 反测复现（每轮）：
#   sha256sum app-mobile/src/utils/crypto.ts        # SHA_BEFORE
#   cp app-mobile/src/utils/crypto.ts /d/Users/ZXQL/wt-agents/_qoder23F1_bak/crypto.ts.<轮>.before
#   node /d/Users/ZXQL/wt-agents/_qoder23F1_work/inject-f1.cjs app-mobile/src/utils/crypto.ts R-IV   # 或 R-TAG
#   npm --workspace app-mobile run test             # 期望红且点名（§五）
#   cp /d/Users/ZXQL/wt-agents/_qoder23F1_bak/crypto.ts.<轮>.before app-mobile/src/utils/crypto.ts
#   sha256sum app-mobile/src/utils/crypto.ts        # SHA_AFTER == SHA_BEFORE；rg 标记残留 exit=1；复跑 EXIT=0
git diff bc1087ee..HEAD -- backend/ | wc -c          # 期望 0
```

建议派单：① 集成收敛单——本卡把本树 tests 抬到 11/191，与 25F1/26F1 树读数收敛；② （可选）decrypt() 已分类异常文案细分卡——把"IV 长度非法/tag 长度非法/tag 校验失败"三类共用一条『认证标签校验未通过』文案的问题单独立项，涉及用户可见字符串，非本卡面；③ 加密侧 `aesGcmEncrypt` 的 iv 参数目前只有 encrypt() 内部传随机 12 字节一条路径，是否加开发期断言请裁（本卡按红线未动加密侧）。
