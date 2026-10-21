# ACTIVE 回执 · QODER-23 —— AES-GCM 认证标签长度正确性

【汇报 QODER-23】QODER-23 AES-GCM 标签长度正确性 —— 长度守卫落在常量时间比较之前（crypto.ts:630），篡改用例改确定性翻转 tag[0]、新增 18 字节非规范标签拒绝用例，四门 + build:h5 全 EXIT=0（test 11/187），两轮反测各打红一条且互不重叠，backend diff 0 字节、工作树 clean
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-21
对应派单编号：QODER-23（`docs/tasks/inbox/QODER-23-gcm-tag-length.md`）
交付物：实现笔 `ad73898e8da79a6ce6ec309cace397a96a667479`（`crypto.ts` / `storage-crypto.spec.ts` / `gates-baseline.json`）＋ 文档笔 `e33f35411abb5ffa7e3fc3c12adcc29132afa9ab`（本回执 + `docs/tasks/cards/R101-QODER-23-回传.md` + `docs/evidence/qoder-23/**` 14 文件）＋ 一笔只含 `raw/45`/`raw/48` 两份日志的证据补笔（`app-mobile` 面 0 行，自指限制不预写哈希）
完整十项回传：`docs/tasks/cards/R101-QODER-23-回传.md`｜证据树：`docs/evidence/qoder-23/**`
> 本回执只写执行方自评与卡片判据对照，**不含凌舟裁定／验收结论类判词**。

## 人读摘要

基线 `bc1087ee`（第 1 父实测）⇒ 实现笔 `ad73898e`（**未 push、未开 PR、逐文件 add**）。三件事，严格限于卡 §二 五条：

- **守卫**：`crypto.ts:630` `if (tag.length !== 16) return null`，位置在 `:632` 常量时间比较注释与 `:633-635` 的 `diff` 循环之前；`:635` 原文一字未动；函数体只多一条 `if` 与注释，**未新增任何声明**（`grep -c "function aesGcmDecrypt"` = 1，type-check 实测 0=0）。根因按实测更正过：定长循环上界恒为 16 ⇒ 长 tag 的尾部字节**根本没被读**（探针 E4：前 16 字节合法时 `diff = 0` 静默通过），短 tag 则是 `ToInt32(undefined)=0` 拿 0 去比（探针 F2 `undefined ^ 4 = 4`，**不是 NaN**）；两种形态都不该靠巧合。
- **用例**：① 原篡改用例改确定性——先 `expect(b64ToBytes(enc.tag).length).toBe(16)`，再 `tagBytes[0] ^= 0x01`，并钉重编码后长度仍 16 ⇒ 差异恰 1 字节且在被比较区内（探针 D3/D4：`diff=1`），与随机数无关；旧写法实测解出 18 字节、被比较区只 `tag[15]` 被置 0 ⇒ 真 tag[15] 恰为 0（约 1/256，QODER-22 探针 2000 次命中 8 次）时假绿。② 新增「非规范长度 tag 一律拒绝」：合法 16 字节 + 尾部追加 2 字节 ⇒ 解码 18 且**前 16 字节逐字节等于合法 tag**，必须抛错，支点唯一就是新守卫。③ 既有 4 条用例（密钥 32 字节／往返含中文 JSON／IV 随机／错误密钥）逐字保留，无 skip、无超时改动、无 disable、无吞异常。
- **基线**：`gates-baseline.json` 只动 `tests` 段（`testCount` 186 → **187**，`testFiles` 保持 11）＋ `tests.note` 末尾追加 ★QODER-23 一段；`lint`/`typeCheck`/`checkContract`/`contractDrift`/`_comment` 四段与 `_comment` 一字未动（diff 只有 2 行）。

## 判据自评（卡 §三 逐条）

| 判据 | 目标 | 实测 | 自评 |
| --- | --- | --- | --- |
| `check:gates` | EXIT=0 | **CHECK_GATES_EXIT=0**（`raw/20-gates-tip.log`）；文档笔后尖端复跑同读数 **0**（`raw/48-tip-gates.log`） | 达标 |
| test 复跑稳定性 | 无概率红 | 连跑常驻门 3 **8/8 全 EXIT=0**、每次 `187 passed (187)`（`raw/45-determinism-reruns.log`；结构性依据见探针 D3/D4） | 达标 |
| type-check | 0 = 0 | **vue-tsc EXIT=0，当前 0 条／基线 0 条** | 达标 |
| lint | error 0／warning ≤12872 | **error 0（基线 0）／warning 12872（= 基线，未劣化）** | 达标 |
| test | 全过、基线只升 | **11 passed (11)／187 passed (187)**；门行"当前 11/187，基线 11/187"（已无"高于基线"提示） | 达标 |
| check:contract | EXIT=0 | **EXIT=0，差集 1 条／具名豁免 1 条** | 达标 |
| `build:h5` | EXIT=0 | **BUILD_H5_EXIT=0**、`DONE Build complete.`、产物 `app-mobile/dist/build/h5/` | 达标（仅"可编产物"，运行态未验） |
| 反测 R1（摘长度守卫） | 红且点名 | **INJECT_EXIT=0／回读三件套在场／TEST_EXIT=1**，红点唯一：`非规范长度 tag 一律拒绝…` @ `spec.ts:80:37`，`1 failed \| 186 passed (187)` | 达标 |
| 反测 R2（摘比较分支） | 红且点名 | **INJECT_EXIT=0／回读三件套在场（守卫仍在场）／TEST_EXIT=1**，红点唯一：`tag 校验失败即抛（确定性翻转 tag[0]…）` @ `spec.ts:65:37` | 达标 |
| 复原 | 同形态 SHA 恒等 ⇒ 复跑绿 | 两轮 `cp` 复原，`SHA_BEFORE == SHA_AFTER == 97063e803c60a1bf541caf02c72dccd0b9712d2d3868e81afc0032845d0211c6`（worktree-crlf），`grep -c ANTI-R` = 0，`TEST_EXIT_RERUN=0` | 达标 |
| 作废轮 | — | **无**（两轮 INJECT_EXIT 均 0；无 `No workspaces found` 类目录错用读数；未用 `sed -i`；未用 `npx rg`） | 达标 |
| `git diff bc1087ee..HEAD -- backend/` | 0 | **0 字节**（工作树侧 `git diff bc1087ee -- backend/` 亦 0） | 达标 |
| 改动面 | 仅点名文件 | **3 个文件**（+9/−2、+43/−2、+2/−2），无第三方文件 | 达标 |
| 工作树 | clean | 实现笔 + 文档笔提交后 `git status --porcelain` **空**（`raw/40`） | 达标 |
| 红线（不 push／不 PR／不 `git add -A`） | 硬性 | 全部遵守，逐文件 add | 达标 |

**未达成项：无。**

## 未验清单与挂账（如实，不许当通过）

1. **短 tag（<16 字节）一侧无用例覆盖**（卡 §二.3 只点名 18 字节，为不扩面未加截断用例）；守卫本身两个方向都管，探针 F1–F4 只算机检不算门覆盖。
2. **真机全未验**：APP-PLUS 分支只经 vue-tsc 静态求值（`#ifdef` 是注释），无运行期读数；常驻门 3 靠 `uni-ifdef-shim` **按 H5 分支**加载，实际跑的是 H5 形态的 `aesGcmDecrypt`。
3. **H5 浏览器运行态未验**：未起 `dev:h5`、未接 mock 后端、未取 DOM/console/network；`build:h5` 只证明产物。
4. **端侧存量 tag 普查未做**：`decrypt()` 的唯一生产消费点是 `getSecureStorage` 的 `#ifndef H5` 分支（`crypto.ts:913-921`，`catch` → 返回 `''` ⇒ 表现为"读不到/静默登出"，不是崩溃）；H5 分支已不走 AES-GCM（`b64:` 混淆 + 旧数据判失效），不受守卫影响。残留敞口是 APP/小程序侧被历史 `uni.base64*` 尾部损坏过的 `enc_*`（风险出处 `crypto.ts:862-863` 原注释），改后从"偶尔可解"变"一定不可解"。
5. `tests/**` 不在 tsconfig `include`（`src/**`）与 eslint 面（`eslint src`）内 ⇒ 新增助手 `b64ToBytes`/`bytesToB64` 只经 vitest 运行验证，不被 type-check/lint 覆盖（既有口径，本卡未扩门）。
6. **四卡并行读数未收敛**：11/187 只是本树口径，最终由集成单收敛（协议 §三）。
7. 实现笔与文档笔均未进 `main`，本卡无主干落地权限。

## 待裁问题（本卡不动手）

1. **基线文件的归属面**：任务书 §一"只准改"未列 `gates-baseline.json`，但批次卡 `QODER-BATCH-23-26-20261021.md:17` 已授权"如因新增测试需要调整，只允许本单实测值和新 note" ⇒ 本卡按授权只动 `tests` 段（187 + note 追加），其余四段与 `_comment` 一字未动。报备点：建议下轮把基线文件写进"只准改"清单，否则执行方按字面理解会漏调基线、门 3 长鸣"高于基线"提示。
2. **派单字段名与实际不符**：协议写作 `tests.fileBaseline`/`tests.testBaseline`，实测字段是 `tests.testFiles`/`tests.testCount`（`test-gate.mjs` 用的是后者）。本卡按实测字段名改。
3. **派单根因表述需更正**："`tag[16..]` 溢出为 undefined ⇒ `diff |= NaN` 仍是 0" 与实测不符（`ToInt32(undefined)=0`，且循环上界恒为 16 ⇒ 越界字节根本没进循环）。缺陷方向与守卫结论不变，措辞请按探针 E4/F2 更正，避免下一张卡照抄。
4. **任务书与批次卡不在本分支 git 内**：本树 `docs/tasks/inbox/` 无 `QODER-23-gcm-tag-length.md`、无 `QODER-BATCH-23-26-20261021.md`，两者只在主检出工作区（未提交态）。本卡只读引用，未复制入库（不属本卡文件面）——若需随卡入库请裁由谁做。
5. **`current-tasks.md` 与 `inbox/ACTIVE.md` 本卡未动**：AGENTS.md 旧信箱协议要求回执后归档 ACTIVE.md 并更新台账，但本批走批次协议 §六 的每卡独立文件名通道；`ACTIVE.md` 是 2026-10-16/17 S3 批路由表（末次提交 `7ea26e8d`）、`current-tasks.md` 是凌舟台账 ⇒ 四卡并行下执行方改这两份等于并发写他人台账（协议明令禁止）。两份均未改，请裁收口人。
6. **建议派单**：① QODER-23F1 GCM **IV 长度边界**（`j0.set(iv)` 无守卫：短 IV 静默留零、`12<len<=16` 误用 96-bit 模式、`>16` 抛 RangeError）；② 短 tag 用例补 1 条；③ 端侧 `enc_*` tag 长度普查；④ codec 一致性常驻断言（可选）。详见卡 §十。

