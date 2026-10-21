# QODER-23F1 证据树（AES-GCM IV 与短标签边界）

- 卡：`docs/tasks/inbox/QODER-23F1-aes-boundary.md`
- 分支 / 基线：`fix/qoder-23f1-aes-boundary`，基线 `2568ef0352929f29e4c99ba79627fea2b5a26476`（QODER-23 尖端，开工实测）
- 实现提交：`bbc8aa9ec380133629733222bc766d8722d55b0a`（fix: IV 守卫 + 四条用例 + tests 基线 187→191）
- 执行方：Qoder（移动端）子代理｜2026-10-22｜回传见 `docs/tasks/cards/R101-QODER-23F1-回传.md`

## 结论读数速查（全部为现场原始输出，见对应文件）

| 项 | 读数 | 出处 |
|---|---|---|
| 基线四门（改动前） | EXIT=0，11 文件 / 187 用例 | raw/01 |
| 守卫前探针 | 13 字节 IV（13 字节=0x00）静默解密成功；17 字节 IV 抛未分类 RangeError | raw/02c P1/P4 行 |
| 守卫后探针 | 全部非规范输入抛已分类『AES-256-GCM 解密失败』 | raw/03 |
| 实现后门 3 | EXIT=0，11 文件 / 191 用例（基线未调时提示上调） | raw/04 |
| note 前缀机检 | STARTSWITH=true（追加 1262 字符），非 tests 段零改动 | raw/05b |
| build:h5 / mp-weixin / app | EXIT=0 / 0 / 0，产物 app-mobile/dist/build/<平台> | raw/06/07/08 |
| 反测 R-IV（摘 IV 守卫） | INJECT_EXIT=0；红点名 spec.ts:120/136/149/163 三条 IV 用例（146/160/172 行断言）；SHA 恒等 1a6bd4ef…；MARKER_RG_EXIT=1；复跑 EXIT=0 | anti/R-IV-guard-removed.txt |
| 反测 R-TAG（摘 tag 守卫） | INJECT_EXIT=0；红点名 spec.ts:78（88 行）与 spec.ts:120（133 行）两条 tag 用例；SHA 恒等 1a6bd4ef…；MARKER_RG_EXIT=1；复跑 EXIT=0 | anti/R-TAG-guard-removed.txt |
| 收尾全量四门 | EXIT=0，11/191 与基线一致 | raw/10 |
| backend diff | `git diff bc1087ee..HEAD -- backend/ | wc -c` = 0 | raw/11 |

## 目录

- `raw/00`：工作树与基线核对（rev-parse、branch、junction 实况）
- `raw/01`：改动前基线四门
- `raw/02`、`raw/02b`：**作废读数留档**（02=vitest 路径 MODULE_NOT_FOUND；02b=探针配置 JSDoc 内 glob `*/` 提前闭合注释致 esbuild 报错），修正后实跑在 `raw/02c`
- `raw/02c` / `raw/03`：守卫前 / 守卫后形态探针（同一段探针代码两次运行的全部 PROBE 行）
- `raw/04`：实现后门 3（191 用例实测）
- `raw/05`（作废留档：/tmp 盘符解析 ENOENT）/ `raw/05b`：note 前缀机检修正版
- `raw/06~08`：三平台构建原始日志
- `raw/10`：收尾全量 check:gates
- `raw/11`：收尾自检（porcelain / log -3 / backend diff 字节）
- `anti/`：两轮反测完整台账（注入器输出、红行原文、SHA 对、残留检查、复跑绿）
- `probe/`：探针 spec / 探针 vitest 配置 / 注入器 inject-f1.cjs 源码存档（`.txt` 后缀防误跑；工作树内临时件已删）

复现命令与判据自对账见回传卡 §十 / §四。

---

## 负责人复验段（Qoder 亲自跑，2026-10-22 02:31~03:05；以上各行为子代理读数）

本节由负责人独立取证，与上文子代理轮次**相互独立**：注入器另写一份、needle 由负责人自己从尖端 `457d8b88` 文件读出，不复用 `probe/inject-f1.cjs`。归属已在文内逐处标明，避免与执行方读数混淆。

| 项 | 负责人实测读数 | 出处 |
|---|---|---|
| 四门全量 `check:gates` | EXIT=0；type-check 0=0；lint error 0 / warning 12872；test **11 文件 / 191 用例**（与基线一致）；check:contract 差集 1 / 具名豁免 1 | raw/20 |
| 三构建 | `build:h5` / `build:mp-weixin` / `build:app` 全部 EXIT=0 | raw/21 |
| 基线追加机检 | `_comment`/`typeCheck`/`lint`/`checkContract`/`contractDrift` 对 `bc1087ee` **全部未改动=true**；`tests.testFiles` 11→11、`testCount` 186→191；`tests.note` `startsWith(old)=true`（2941→5395）；新增分节为空 | raw/22 |
| 负责人反测 R-IV | `INJECT_EXIT=0`；`TEST_EXIT=1`，`Test Files 1 failed \| 10 passed (11)`、`Tests 3 failed \| 188 passed (191)`，三条 IV 用例逐字点名红（短 IV 11 字节 / 长 IV 13 字节 / 长 IV 17 字节）；两条 tag 用例保持绿；`SHA_BEFORE=SHA_AFTER=1a6bd4ef…`；`MARKER_RG_EXIT=1`；复跑 `TEST_EXIT_GREEN=0` 11/191 | anti/61-owner-R-IV-guard-removed.txt |
| 负责人反测 R-TAG | `INJECT_EXIT=0`；`TEST_EXIT=1`，`Test Files 1 failed \| 10 passed (11)`、`Tests 2 failed \| 189 passed (191)`，红点名为两条 tag 用例（短 tag 15 字节 / 可解码为 18 字节的长 tag）；三条 IV 用例保持绿；`SHA_BEFORE=SHA_AFTER=1a6bd4ef…`；`MARKER_RG_EXIT=1`；复跑 `TEST_EXIT_GREEN=0` 11/191 | anti/60-owner-R-TAG-guard-removed.txt |
| 注入器 | `OWNER_NEEDLE_HITS=1`、`OWNER_FILE_HAS_CRLF=true LINES=952`、回读「标记在场=true 原守卫行已消失=true 另一守卫仍在场=true」 | probe/owner-inject-23f1.cjs.txt |

负责人对守卫正当性的独立复核：`j0.set(iv)` 写入 `new Uint8Array(16)` 对 13 字节 IV **不抛错**而按零填充，当被截掉的尾字节恰为 `0x00` 时构造出的 J0 与合法 12 字节 IV 的 J0 **逐字节相同** ⇒ 认证被静默绕过；17 字节则抛未分类 `RangeError: offset is out of bounds`。因此 `if (iv.length !== 12) return null` 必须在任何 J0 构造**之前**，实测其确为 `aesGcmDecrypt` 的第一条语句。新用例采用确定性重采样（`tag[15]===0` / `iv[11]===0`）保证反测必红而非依赖巧合。

一处排版越面报备（**未改动**）：本表上方子代理表格「backend diff」行内含未转义的 `|`，markdown 会多渲染一列。属执行方文档，负责人只作登记不代改。
