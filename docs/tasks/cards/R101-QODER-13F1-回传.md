# R101-QODER-13F1-回传 · pin-ssl 文件头过期文案修正

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13F1
> 任务书原件（只读未动）：`docs/tasks/inbox/QODER-13F1-pin-comment-refresh.md`（主仓 `wen-ssystem` 内，本单未修改）
> 共享执行协议：`D:\Users\ZXQL\wt-agents\_qoder-restack-exec-protocol-20261021.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13f1-pin-comment-refresh`｜基线：`597230c4`
> 证据树：`docs/evidence/qoder-13f1/**`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-13F1.md`
> 本文只写「执行方自评」与「卡片要求的目标读数」，不含任何验收结论性判词。

## 一、基线与提交

- 分支与 checkout 由负责人预先建好，基线 = QODER-13 尖端 `597230c4`；本单**未 rebase、未切分支、未改历史**。
- 本单提交 3 笔（`git log --oneline 597230c4..HEAD`；笔数超出卡内"1~2 笔"，偏差已在 §六 与 §八.6 报备，起因是收尾自检发现门 3 超时缺陷必须修）：
  1. `d9151ae5` `fix: pin-ssl 文件头两处过期文案改真（在册指纹为2026-10-21现网Let's Encrypt值、api/m叶子实际到期日2026-11-11/2026-12-22）+ 静态断言挂进既有用例防回潮`
  2. `50750e39` `docs: QODER-13F1 回传卡与回执及 pin-ssl 文件头文案修正证据落盘（改前/改后、判据、四门读数、三轮反测红与复原绿）`
  3. 第三笔（`fix:`，内含 spec 求值时机更正 + `raw/32`/`raw/33` + `anti2/` 三张红档 + **本回执与证据 README 的同步更正**；本卡文字在 docs 笔已成稿，第三笔不再回头改写本卡；**哈希只在本笔落盘后才存在**，故此处不写死，复现取 `git log --oneline 597230c4..HEAD` 第一行）
- 逐文件 `git add`（实现笔只 add `app-mobile/src/utils/pin-ssl.ts` 与 `app-mobile/tests/storage-crypto.spec.ts`；docs 笔与第三笔同样逐个文件 add），**未使用 `git add -A`**。
- 改动面 = 卡点名 2 文件（`src/utils/pin-ssl.ts` + 承载静态断言的 `tests/storage-crypto.spec.ts`），不多一个（`raw/30-final-selfcheck.log`、`raw/33-post-fix-gates.log`）。

## 二、修法 × 读数总表

| # | 卡内条目 | 修法 | 判据目标读数 | 实测读数（执行方自评） |
|---|---|---|---|---|
| 1 | §二.1 `pin-ssl.ts:6` | 整行替换为"在册指纹已更新为 2026-10-21 现网 Let's Encrypt 值；仍未接线"口径（并修正"未接线原因不再是过期"） | 该行不再含 `2026-09-15` | 命中 0（`raw/03`） |
| 2 | §二.2 `pin-ssl.ts:28` | 整行替换为 api/m 叶子实际到期日 + 中间证书 YE2/YE1 2028-09-02 + 轮换提醒口径 | 该行不再含 `2026-09-15` | 命中 0（`raw/03`） |
| 3 | §二.3 只改注释 | `PINNED_CERTS` 四条指纹、`installSslPinning()` 函数体、`validateCertificate` 等实现逻辑一字未动 | diff 仅 2 行 `-`/`+`（同文件行数不变） | `+2/-2`，文件仍 268 行（`raw/05`/`raw/06`） |
| 4 | §三.1 rg 判据 | — | `rg -in '2026-09-15\|trustasia' pin-ssl.ts` = 0 命中 | **0 命中**（`RG_EXIT=1`） |
| 5 | §三.2 调用点 | — | `installSslPinning(` 调用点仍为 0 | **0**（rg 3 处全为定义/注释，`raw/03` 逐处定性） |
| 6 | §三.3 四门 | — | type-check/lint/test/contract 全 EXIT=0；test 5/56 不升不降 | **终态全 EXIT=0；test 5 文件 / 56 用例**（改动后 `raw/21`–`raw/24`；实现笔后 `raw/31`；求值时机更正后 `raw/33`，含 `npm run test` 连跑 3 次均 5/56 EXIT=0）。中间一次全量复跑门 3 曾红（超时，`raw/32`），成因与处置见 §八.6 |
| 7 | §三.4 反测 | 旧文案原样注回 ⇒ 静态断言红 ⇒ `cp` 复原 ⇒ SHA 一致 ⇒ 复跑绿 | 门能红、能自复原 | **达成两轮**：第一轮 `anti/*`（四份红档 + 一份绿档，红点 `spec:75/:76/:77`）、第二轮 `anti2/*`（求值时机更正后复跑三张红档，红点 `spec:85/:86/:87`，每轮各自 `cp` 复原且 SHA 与注入前一致、复原态复跑 5/56 EXIT=0） |
| 8 | §三 附带要求 `gates-baseline.json` | 不动 | tests 仍 5/56 | **一字未动**（`raw/30` 第五段） |
| 9 | 卡外必做项：修我自己引入的门 3 超时 | 把静态求值（读 `pin-ssl.ts` + 扫 `src` 调用点）从 `it` 体内移到模块加载期（import 阶段）；断言三条、宿主用例、口径、用例数全部不变 | 不属卡内条目，主动报备（§八.6） | 修正后四门全 EXIT=0、test 5/56、连跑 3 次无抖动（`raw/33`）；`pin-ssl.ts` 未再变动（SHA 仍 `cb27d321…408889`） |

## 三、逐条实现说明

1. **`:6`（文件头"接线状态"第 2 条）**：原文断言"叶子证书指纹已于 2026-09-15 过期——此刻接线会让 APP-PLUS 全部请求被判指纹不匹配拒连"。自 `1b61811b` 起在册四条已是 2026-10-21 现网 Let's Encrypt 值（api 叶子 2026-11-11、m 叶子 2026-12-22、中间 YE2/YE1 2028-09-02，见 `docs/evidence/qoder-13/raw/01|02-pin-spki-*.log` 的 notAfter 原文），该句为**假话**。新行按卡口径写"在册指纹已更新为 2026-10-21 现网 Let's Encrypt 值 …… 本模块仍未接线"，并把"仍未接线的原因"从"指纹过期"纠正为"下文'原生层证书回调可用'前置未满足"（对应同文件 `:7-:11` 既有的双前置口径，未新增事实）。
2. **`:28`（"注意"段第 1 条）**：原文"已配置生产证书实际指纹（2026-09-15 到期）"同为假话。新行给出两条叶子的**实际到期日**与中间证书 YE2/YE1 的 2028-09-02，并把轮换提醒写成"命中到期前 30 天提醒窗口即应启动"——该窗口口径直接来自 `qoder-13/raw/01` 采集时 api 叶子剩 22 天触发的 WARN，不是新造的规则。
3. **未动区**：`PINNED_CERTS` 四条指纹常量、`validateCertificate`/`getPinnedCerts`/`isPinningEnabled`/`setPinningEnabled`/`installSslPinning`/`addPinnedCert`/`listPinnedHostnames` 实现体、`CertificateInfo`/`PinningResult` 类型，全部零改动（`raw/06` 全量逐行 diff 可见本文件只有 2 行变化）。`installSslPinning()` **仍未被任何地方调用**。
4. **静态断言（防回潮）**：`tests/storage-crypto.spec.ts` 顶部加导入与 `collectInstallCallSites()`（与 `rg -n 'installSslPinning\(' app-mobile/src` 同语义：跳过注释行与 `export function` 定义行），并在既有 `it`「tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）」（现 `:76`）的断言列表末尾追加 3 条（现 `:85`/`:86`/`:87`）：不含 `2026-09-15`、小写化后不含 `trustasia`、调用点清单 `toEqual([])`。**不新增 spec 文件、不新增 `it`**，用例数保持 5/56。
5. **求值时机（第三笔的更正）**：三条断言的**求值**放在模块加载期（`const PIN_SSL_TEXT = readFileSync(PIN_SSL, 'utf8')`、`const INSTALL_CALL_SITES = collectInstallCallSites(SRC_DIR)`，现 `:49`/`:50`），`it` 体内只做常数比较。移动前它俩在 `it` 体内跑，与同用例的 GCM 运算叠加会越过 vitest 默认 5000 ms 用例超时（实测数据与红档见 `raw/32`）；移动后断言语义、"注入即红"、用例数一律不变（`anti2/` 三张红档即为证据）。

## 四、测试 / 门读数

| 门 | 命令 | 基线 597230c4（改动前，`raw/00`） | 改动后终态（`raw/21`–`24`、`raw/31`、`raw/33`） |
|---|---|---|---|
| type-check | `npm run type-check` | vue-tsc EXIT=0，0 条 = 基线 0 条 ⇒ EXIT=0 | 同读数 ⇒ **EXIT=0** |
| lint | `npm run lint` | error 20（基线 20）、warning 12872（基线 12872）⇒ EXIT=0 | **error 20 / warning 12872 ⇒ EXIT=0（无劣化，未调基线）** |
| test | `npm run test` | 5 文件 / 56 用例 ⇒ EXIT=0 | **5 文件 / 56 用例 ⇒ EXIT=0（不升不降）**；`raw/33` 另附终态连跑 3 次读数（RUN1/RUN2/RUN3 全 EXIT=0、56 passed） |
| check:contract | `npm run check:contract` | 差集 1 条 / 具名豁免 1 条 ⇒ EXIT=0 | 同读数 ⇒ **EXIT=0** |

**门 3 中途一次红（不掩盖）**：`raw/32-timeout-before-fix.log` ⇒ 在实现笔 + docs 笔已落定的状态上做全量四门复跑时，`npm run test` 报 `Tests 1 failed | 55 passed (56)`、`Error: Test timed out in 5000ms.`，红点正是宿主用例。归因是本卡把"扫全 `src` 求调用点"的 IO 放进了 `it` 体内（扫描本身实测 1121 ms 冷 / 1829 ms 热，叠加同用例 GCM 运算后在负载下越线），属**执行方自引入的实现缺陷**，不是既有问题、也不是断言口径问题。处置 = 第三笔把求值移到 import 阶段，随后 `raw/33` 四门全绿且连跑 3 次无抖动，`anti2/` 三张红档证明断言仍能红。用例数全程 5/56 未变。

`gates-baseline.json` 四个段落（typeCheck / lint / checkContract / contractDrift / tests）全部未动；`package.json`、`package-lock.json`、`node_modules` 未动，无 `npm install`。

## 五、口径偏差报备

1. **★ 卡内 §三 存在一处内部矛盾（必须点名，已按负责人下发口径处理，未自行扩大范围）**：
   §三 同时要求「反测恢复旧文案 ⇒ 静态断言红」与「test 5/56 不升不降」，但现场核对：
   `app-mobile/tests` 下 5 个 spec（api-base-env / entry-gate-consistency / permission-codes / permission-view-state / storage-crypto）**没有任何一条引用 pin-ssl**——逐文件 rg 原文见 `docs/evidence/qoder-13f1/raw/07-no-spec-references-pinssl.log`；全仓只有 `app-mobile/src/config/env.ts:8` 的注释与本文件自身提到 `pin-ssl`。
   ⇒ 若按"新增一条断言"的字面理解去新建 spec 文件或新增 `it`，`test` 必然从 56 变成 >56，与"不升不降"直接冲突；反之若要 5/56 不变则当场不可能有"静态断言"可红。两条**无法同时成立**。
   ⇒ 采法（负责人下发口径，非执行方自裁）：**不新增 spec 文件、不新增 `it`**，把三条静态断言追加进既有 `it` 的断言列表，用例数保持 5/56、`gates-baseline.json` 一字不动。矛盾与采法在此留痕，该落法是否认可留待负责人判定（执行方不自作结论）。
2. **断言宿主选择**：负责人下发建议落在 `tests/storage-crypto.spec.ts`，并要求"读文件后自行判断"。选择理由：
   - `pin-ssl.ts` 唯一 import 就是 `@/utils/crypto`（应急开关 `isPinningEnabled`/`setPinningEnabled` 走 `getSecureStorage`/`setSecureStorage`），`storage-crypto.spec.ts` 正是这条依赖根所在的测试文件，同属 `src/utils` 安全件族；
   - 该文件四条 `it` 中，只有「tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）」是**负向/防篡改**契约（内容被改坏 ⇒ 必须拒绝、绝不静默放行），与本卡新增静态守卫（文件头被改回失效旧文案 ⇒ 必须红）语义同构；其余三条是正向往返/可复现断言，语义不符；
   - 备选 `entry-gate-consistency.spec.ts` / `permission-view-state.spec.ts` 虽也有 `readFileSync` 静态断言先例，但属"权限门 / 三态接线"业务域，与 pin-ssl 无依赖关系，跨域放置语义更差 ⇒ 未采。
   - 附带事实：宿主 `it` 名保持不变，vitest 红档点名即该用例全名（见 `anti/*.log` 的 `FAIL` 行）。
3. **未随本单处理的同类过期表述（如实报备，未动）**：`app-mobile/src/config/env.ts:8` 仍写着 "src/utils/pin-ssl.ts 的证书固定（PINNED_CERTS）当前未接线（全仓零调用点，**且指纹已过期**）"——这半句与本卡 `:6` 是同一处假话，但卡 §二 只点名 `pin-ssl.ts:6/:28` 两行，按"禁止扩大改动范围"未动。建议另裁一行式追单。
4. 卡 §二.1 只给了"在册指纹已更新…；仍未接线"的口径短语，未规定整句写法；本单在同一行内补了两条叶子的具体到期日（与 `:28` 一致、且是常量旁注释里既有事实的复述），未引入任何新事实。
5. `raw/04-…` 编号空缺：本卡未做后端/真机类读数采集，无需该档；其余编号连续，无零字节文件。`raw/32`/`raw/33` 与 `anti2/` 为收尾自检发现门 3 超时后**追加**的证据（编号顺延，未回头覆盖 `raw/00`–`raw/31` 与 `anti/*` 的任何历史读数）。

## 六、红线对照

| 红线 | 实况 |
|---|---|
| 不得 push | **未 push**（本地分支，未跑任何 `git push`） |
| 不得开 PR | **未开 PR**（未跑 `gh`） |
| 不得 `git add -A` | **逐文件 add**（实现笔 2 个文件、docs 笔 24 个文件、第三笔逐个文件；三笔均未见 `-A`/`.`） |
| 不得 rebase / 改历史 / 切分支 | 未跑 `rebase`/`reset`/`commit --amend`/`checkout`；全程停在 `fix/qoder-13f1-pin-comment-refresh`。第三笔是**新提交**而非改写前两笔，前两笔哈希不变（`d9151ae5`/`50750e39`） |
| 只动 `D:\Users\ZXQL\wt-agents\QODER-13` | 是；注入/复原脚本与备份全部落在 `_scratch/qoder-13f1/`（协议允许的例外目录） |
| 上一轮 QODER-13 证据 / 回传 / 回执一字不改 | **未改**（`raw/30` 第四段：`git diff --name-only 597230c4..HEAD -- docs/evidence/qoder-13 docs/tasks/cards/R101-QODER-13-回传.md docs/tasks/inbox/ACTIVE-回执-QODER-13.md` 输出为空） |
| 不改任务书原件与 `docs/tasks/inbox/ACTIVE.md` | 未改（两者均只读；本卡回执另存新文件名 `ACTIVE-回执-QODER-13F1.md`） |
| 不得 `npm install/uninstall`、不得改依赖与 lockfile | 未改 |
| lint 劣化禁止调基线 | lint 读数与改动前逐位相同（error 20 / warning 12872），基线未动 |
| 不是凌舟：不写归属凌舟的判词 | 本文与证据树、回执只写"执行方自评"与"卡片目标读数"，无"凌舟裁定/验收结论/验收通过"类字样 |
| 提交格式 `type: 中文描述`、笔数 ≤ 卡内 1~2 笔 | 实现笔 `fix:` + docs 笔 `docs:` + 第三笔 `fix:`（修我引入的门 3 超时），**共 3 笔 ⇒ 超出卡内 1~2 笔，属偏差，已在 §八.6 主动报备**。未 push、未开 PR，故第三笔只是本地追加，没有改写任何已交付历史 |

## 七、未完成与阻塞

**无阻塞**。未完成项（均不属本卡范围，列出备查）：

- `installSslPinning()` 接线：**未做**（卡 §二.3 明令不得调用，`app-mobile/src` 调用点仍为 0）。
- `config/env.ts:8` 同族过期表述：**未做**（见 §五.3，待另裁）。
- 卡 §三 未要求构建（`build:h5` / `build:app`）：未跑。

## 八、自我报备（含未验清单）与踩坑

**未验清单（真机/运行时一律未验）**

1. APP-PLUS 真机 TLS 握手与证书回调：**未验**——本卡未接线，谈不上运行时行为验证；无 HBuilderX 真机与 iOS/Android 设备，亦无取证手段。复现前提：先满足"新指纹 + 原生层证书回调可用"双前置并接线，再谈验证。
2. 现网证书**此刻**是否仍为在册四条：**未验**——本卡未重新联网采集，`2026-11-11 / 2026-12-22 / 2028-09-02` 三个日期是**复述 `docs/evidence/qoder-13/raw/01|02` 在 2026-10-21 01:46/01:47 的采集读数**；api 叶子当时剩 22 天，合并前若现网发生轮换，需重跑 `bash app-mobile/scripts/pin-spki.sh api.onepan.cn` 复核（本卡只改注释，不改指纹，故未触发复核义务）。
3. H5 / 小程序端：**未验**（本卡无运行时变更；`installSslPinning` 在非 APP-PLUS 分支返回 false，未新增验证）。
4. 截图 / 浏览器读数：本卡无 UI 面，未产出，也不属于未验缺口。

**自我报备**

1. **反测第一轮未隔离断言②**（`anti/attempt1-trustasia-note.note.txt`）：第一轮注入文本写成 `沿用 TrustAsia 旧签发链（2026-09-15 口径）`，同时携带两个禁用 token，vitest 按断言书写顺序命中 `:75`（断言①）即失败，拿不到"断言②能红"的证明。已补跑 `anti-trustasia2-red.log`（只注入 `TrustAsia`、不含 `2026-09-15`）⇒ 红点 `:76`。第一轮日志按"证据不覆盖历史"原样留档，未改写。**这是本单执行方的处置瑕疵，主动报备**。（`:75/:76/:77` 是求值时机更正前的 spec 行位；更正后同三条断言行位为 `:85/:86/:87`，见 `anti2/`。）
2. 反测 `callsite` 轮在 `pin-ssl.ts` 里注入过一行真实调用 `installSslPinning()`（红档证据），已 `cp` 复原、SHA 与注入前一致、复跑转绿；复原态下该文件**无任何调用点**（`raw/03` 判据 2 为 0）。
3. 反测绿跑：`trustasia2`（补正轮）自带完整闭环（红 `spec:76` ⇒ `cp` 复原 ⇒ SHA 一致 ⇒ 复跑 5/56 EXIT=0，见该档尾部 `GREEN_EXIT=0`）；另三轮（`date`/`trustasia`/`callsite`）共用同一份复原态复跑转绿（`anti/anti-green-after-restore.log`），未逐轮重复绿跑；理由：四份红档的"复原后 SHA"彼此相同且等于注入前值（`cb27d321…408889`），字节同一 ⇒ 一次绿跑对三轮同等成立。
4. `git status` 在反测过程中一度列 `M app-mobile/src/utils/pin-ssl.ts`（autocrlf 展示态与实现笔未落定期间均有出现）；最终态以 `raw/30`/`raw/31` 为准，docs 笔落盘后 `git status --porcelain` 为空。
5. 未擅自"顺手"改 `:10` 那句"未采到'新指纹 + 原生层证书回调可用'两个前置前，禁止接线"——严格说"新指纹"一项已随 `1b61811b` 采到，该句读起来像未采；但它写的是"未采到 …… 前禁止接线"的条件式禁令，两个前置未同时满足 ⇒ 禁令此刻仍成立，属**未失真**表述，故按范围红线不动（如负责人认为需要收紧，另裁一行式追单）。

6. **★ 偏差报备：卡内"本地提交 1~2 笔"实际做了 3 笔，原因是我自己引入的门 3 超时缺陷**（`raw/32` 红档 ⇒ `raw/33` 终态）。收尾自检的全量四门复跑里 `npm run test` 报 `1 failed | 55 passed (56)` + `Test timed out in 5000ms`，红点正是承载静态断言的宿主用例：首版把"读 `pin-ssl.ts` + 扫全 `src` 调用点"的 IO 写在 `it` 体内，扫描实测 1121 ms（冷）/1829 ms（热），与同用例的 GCM 篡改/错误密钥运算叠加后在负载下越 vitest 默认 5000 ms。这属于"门会随机红"的缺陷，不能靠重跑蒙过去，也不能留着交付。处置 = 第三笔只把**求值时机**移到 import 阶段（断言三条、宿主用例、用例数 5/56、`pin-ssl.ts` 内容全部不变），随后四门全 EXIT=0、`npm run test` 连跑 3 次 5/56 无抖动，并用 `anti2/` 三张红档（红点 `:85/:86/:87`，每轮 SHA 复原一致、复原态复跑绿）证明更正没有把防回潮能力改没。多出的这笔是本单执行方应提前避免的返工，主动报备；前两笔未改写、未 push。
7. 第二笔 docs 笔落盘后，本卡与回执里"docs 笔哈希"只能写作"见 `git log`"——文件无法写入自身所在提交的哈希；第三笔同理。此为格式限制说明，非漏填。

**踩坑（供协议沉淀）**

- **踩坑 A（latin1 与 UTF-8 锚点）**：注入器按 `latin1` 读文件时，锚点必须先把 UTF-8 字面量转成同一份 latin1 字节视图（`Buffer.from(anchor,'utf8').toString('latin1')`），否则中文锚点命中恒为 0；本单首轮就因此 `exit 9` 拒写（未落任何写入，属预期保护生效，不是缺陷）。
- **踩坑 B（rg 取反 glob ⇒ 假 0 命中；与协议 §3 的 `MSYS2_ARG_CONV_EXCL` 同族、成因不同）**：本机 Git Bash 通道会把 `rg --glob` 取反模式开头的感叹号转义成 `\!`，取反随之失效，该模式退化为"必须匹配字面 `\!` 前缀"的**正向** glob ⇒ 结果全量零命中。实测对照（同一目录同一模式）：不带 glob `rg -in '2026-09-15|trustasia' .` ⇒ EXIT=0、134 行；加上 `--glob '!node_modules'` ⇒ EXIT=1、**0 行**。本卡两条 0-hit 判据都是单文件/单目录且不含取反 glob，未受影响，但已用"去掉取反 glob 复跑"交叉复核（见 `raw/08`）。**风险**：任何用 `-g '!'` 做"零命中＝干净"的门，在这台机器上会把"根本没扫到"读成"扫过且干净"。建议协议 §3 追加一句：0-hit 判据禁用 rg 取反 glob，需要排除目录改用管道 `grep -Ev`。
- **踩坑 C（CRLF 检出形态下的多行锚点）**：本工作树 `core.autocrlf=true`，`pin-ssl.ts` 与 spec 均为 CRLF（268/41 行全部 `\r\n`）。多行锚点里的 `\n` 必须先归一成 `\r\n` 才可能命中，而写回仍走 latin1 原样字节 ⇒ 不做整篇归一（这正是协议"禁 `sed -i` 复原"同一条教训的正面用法）。做法见 `_scratch/qoder-13f1/apply-13f1.mjs` 的 `norm()` + `bytes()` 两步。
- **踩坑 D（Windows 文件名非法字符）**：门日志按 `npm run <gate>` 命名时，`check:contract` 的冒号会让 Windows 路径变成 ADS/非法名（git 里能存、shell 里难取），已改名为 `24-gate-check-contract.log`。下一单的证据文件命名建议一律去冒号。
- **踩坑 E（静态守卫的文件 IO 写在 `it` 体内 ⇒ 门 3 随机红）**：见 §八.6 与 `raw/32`。教训普适：**任何"扫目录/读大文件"的静态断言，求值必须放模块加载期（import 阶段）或 `beforeAll`**，用例体内只比常数；vitest 默认 `testTimeout: 5000`，一次全 `src` 扫描（本机 189 文件 / 2.2 MB / 1.1–1.8 s）就可能吃掉大半预算。判据侧更稳的做法是给这类用例显式传 timeout 或改用 `--testTimeout`，但本卡受"用例数与既有配置不动"约束，只做了求值时机更正，未动 `vitest.config.ts`。
- **踩坑 F（反测第二轮首跑"没红"是我自己的调用姿势错）**：`inject-13f1.mjs` 取参是 `--case <值>` 两个 argv，我写成 `--case=date`，脚本 `indexOf('--case')` 取不到 ⇒ 走"未知 --case ⇒ EXIT=9 拒写"分支，注入根本没发生，于是"期望红的那次 `npm run test` 自然 EXIT=0"。这份空跑日志已留档为 `anti2/injector-guard-attempt.note.txt`（未当作有效红档，未提交进 `anti/`），改对参数形态后三张红档才真红。**风险**：反测若只看"门红/门绿"读数而不核 `INJECT_EXIT`，会把"注入器没执行"误读成"断言失效"；已在 `anti-round2.sh` 里补 `INJECT_EXIT != 0 ⇒ 本轮作废、先复原再中止` 的守卫。
- **踩坑 G（`echo "$?"` 取错对象，日志写出假读数）**：`raw/33` 首版把 rg 判据写成 `RG_EXIT=0`，实际是 `export MSYS2_ARG_CONV_EXCL='*'` 的退出码被 `$?` 取走，rg 无命中的真值是 `RG_EXIT=1`（命中数仍 0，判据结论不变）。已就地更正并在该档内留了更正文字。**教训**：判据退出码要紧跟被测命令取（`cmd; rc=$?`），别在 `echo` 内联 `$?`，否则多一条 shell 语句就串位。
- **踩坑 H（同一文件的两种 SHA 形态不可混比）**：本工作树 `core.autocrlf=true`，`git show <rev>:<path> | sha256sum` 取到的是仓库内 **LF blob** 的哈希，`sha256sum <工作树文件>` 取到的是 **CRLF 文件**的哈希，两者对同一份内容也**必然不同**（实测本单 spec：blob `46b31dc0…` vs 工作树 `f538c918…`）。反测的"注入前后逐字节一致"用的是工作树↔工作树同形态比对，成立；但回传卡/README 里若把 `git show` 的值与工作树的值并列成"改动前/改动后"，读者会误判成文件被改过。**建议协议 §5 补一句**：证据里出现 SHA256 必须标明形态（blob 还是工作树），跨形态比对一律先归一（如都取 `git show` 或都做 `tr -d '\r'`）。

## 九、复现命令

```bash
cd D:/Users/ZXQL/wt-agents/QODER-13
export MSYS2_ARG_CONV_EXCL='*'          # 必设，否则 Git Bash 把 / 开头模式当路径转换 ⇒ 假 0 命中

# 判据
rg -in '2026-09-15|trustasia' app-mobile/src/utils/pin-ssl.ts      # 期望：无输出，RG_EXIT=1
rg -n  'installSslPinning\(' app-mobile/src                        # 期望：仅 :7 / :197 注释与 :200 定义 ⇒ 调用点 0

# 常驻四门（全在 app-mobile/ 下 npm run）
cd app-mobile && npm run type-check; echo $?
             && npm run lint;        echo $?
             && npm run test;        echo $?     # 必须 5 文件 / 56 用例
             && npm run check:contract; echo $?

# 反测（树外脚本，latin1 字节精确，命中≠1 即 exit 9 拒写）
# 注意参数形态是 `--case <值>`（两个 argv），写成 `--case=date` 会被脚本判为未知并 EXIT=9 拒写
node /d/Users/ZXQL/wt-agents/_scratch/qoder-13f1/inject-13f1.mjs --case date     # | trustasia | callsite
echo "INJECT_EXIT=$?"                                                             # 必须为 0，否则本轮作废（注入未发生）
npm run test                                                                     # 期望 EXIT=1，点名「tag 校验失败即抛…」
cp /d/Users/ZXQL/wt-agents/_scratch/qoder-13f1/pin-ssl.ts.<case>.bak src/utils/pin-ssl.ts
sha256sum src/utils/pin-ssl.ts                                                   # 期望 cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889
npm run test                                                                     # 期望 EXIT=0，5/56

# 一键三轮（求值时机更正后的第二轮，产出 anti2/ 三张红档）
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f1/anti-round2.sh

# 抖动验证（终态连跑 3 次，读数见 raw/33）
for i in 1 2 3; do npm run test; echo "RUN$i EXIT=$?"; done
```

## 十、对下一单的建议

1. 若要清掉 `config/env.ts:8` 的"且指纹已过期"，请开**一行式追单**（与本卡同形态：点名行 + 点名 rg 判据 + 常驻四门），别并入接线卡——接线卡的动作面比注释大一个数量级，混在一起会让"改动面 = 卡点名文件"这条判据失效。
2. **反测注入文本必须逐 token 隔离**：注入串只带**一个**禁用 token，才能把红点钉到目标断言上（本单第一轮就是被"串里同时带两个 token"骗过一次，红点错位到前一条断言）。建议协议 §4 补一句"多断言守卫的反测须逐断言单 token 注入"。
3. `static 断言挂进既有 it` 是"卡要求反测可红 + 用例数不许变"这对矛盾的唯一落法；下一张同类卡若还要静态守卫，**建议卡内直接写明宿主 `it` 全名**，否则执行方只能自行判断（本单已在 §五.2 留痕）。
4. 接线卡开工前先复核证书现值：`api.onepan.cn` 叶子 2026-11-11 到期，距离本单只剩约 3 周，接线 PR 里很可能要同时带新指纹。
5. **静态守卫（读文件/扫目录型断言）一律把求值放 import 阶段或 `beforeAll`**，用例体内只比常数——本单就是栽在把扫描写进 `it` 体内，导致门 3 在收尾复跑时随机超时（§八.6、`raw/32`）。协议 §4"反测须能红"之外，建议再加一条**"门须能稳定绿"：新增静态断言后必须连跑 3 次 `npm run test`**，单次绿不足以证明没有超时抖动。
6. **收尾自检请跑"全量四门"而不是"只跑与改动相关的门"**：本单门 3 的超时是在收尾做全量复跑时才暴露的，早先按改动面推断只盯着 lint/type-check，会漏掉。多花两分钟，省一张返工笔。
