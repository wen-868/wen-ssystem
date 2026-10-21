# R101-QODER-13F2-回传 · pin-ssl 静态断言独立 spec + env.ts 旧文案收口

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13F2
> 任务书原件（只读未动）：`docs/tasks/inbox/QODER-13F2-pin-static-spec-and-env.md`（主仓 `wen-ssystem` 内）
> 共享执行协议：`D:\Users\ZXQL\wt-agents\_qoder-restack-exec-protocol-20261021.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13f2-pin-static-spec-and-env`｜基线：`61514b02`（QODER-13F1 尖端）
> 证据树：`docs/evidence/qoder-13f2/**`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-13F2.md`
> 本文只写「执行方自评」与「卡片要求的目标读数」，不含任何验收结论性判词。

## 一、基线与提交

- 基线 = `61514b02`（13F1 尖端，即凌舟裁定「功能通过、落法不认可」那一态）；**未 rebase、未切他人分支、未改历史**。
- 提交共 2 笔（逐文件 `git add`，未用 `git add -A`）：
  1. `f4772512` `fix:` — 实现笔，4 文件 / +93 −53：`app-mobile/tests/storage-crypto.spec.ts`（还原 −48）、`app-mobile/tests/pin-ssl-static.spec.ts`（新增 +85）、`app-mobile/src/config/env.ts`（注释 +5 −2）、`app-mobile/scripts/gates-baseline.json`（`tests` 段 5/56 → 6/57）。
  2. 第二笔 `docs:` — 回传卡 + 回执 + 证据树 `docs/evidence/qoder-13f2/**`。**该笔哈希只在本笔落盘后才存在**，故此处不写死；复现取 `git log --oneline 61514b02..HEAD` 第一行。
- 卡 §二.1 要求「从 `61514b02` 建新分支」：分支 `fix/qoder-13f2-pin-static-spec-and-env` 由负责人预先建好并已 checkout 到该基线，本单在其上直接落两笔，未新建、未切换。

## 二、修法 × 读数总表

| # | 卡 §二 动作 | 落法 | 自评读数 | 证据 |
|---|---|---|---|---|
| 1 | 建新分支 | 沿用负责人建好的 `fix/qoder-13f2-pin-static-spec-and-env` | `git rev-parse HEAD` = `61514b02` 起笔 | `raw/00` |
| 2 | 撤回 `storage-crypto.spec.ts` 混入断言与扫描代码 | `git checkout 597230c4 -- <path>` + `git reset -q`（取回 13F1 之前的纯 AES/GCM 态） | `git diff 597230c4 -- <path>` = **0 行**；文件内 `pin-ssl|installSslPinning|PIN_SSL|2026-09-15|trustasia` **0 命中**；4 用例不变 | `raw/07` |
| 3 | 新增 `tests/pin-ssl-static.spec.ts` 独立 `it` | 1 个 `describe` / 1 个 `it` / 5 条 `expect`，覆盖卡 §二.3 四个断言点 | 反测四轮红点分别钉到 `spec:73 / :75 / :77 / :83`（每轮只红它自己那条） | `anti/×4` |
| 4 | 修正 `src/config/env.ts:8` 旧文案 | 同一句注释（原 `:8-:9` 两行）改写为 5 行：未接线 + 在册指纹为 2026-10-21 现网 LE 值 + 未接线原因不是「过期」+ 换域名/叶子轮换**必须**同步更新 + 维护口径指针 | 代码零改动（只动注释）；`rg -in '2026-09-15|trustasia' app-mobile/src` = **0 命中** | `raw/01`、`raw/02` |
| 5 | gates baseline 5/56 → 6/57 | 只动 `tests.testFiles/testCount` + `tests.note` 留痕 | `typeCheck / lint / checkContract / contractDrift` 四段逐字段 **UNCHANGED**（机检 `JSON.stringify` 比对） | `raw/10` |

## 三、逐条实现说明

**1）新 spec 的四条断言（宿主 = `it「文件头无失效旧文案、保留现网叶子到期日，且 installSslPinning 调用点恒为 0」`）**

- ① `PIN_SSL_HEAD.includes('2026-09-15') === false`（`spec:73`）；
- ② `PIN_SSL_HEAD.toLowerCase().includes('trustasia') === false`（`:75`，大小写不敏感）；
- ③ `PIN_SSL_HEAD` 必须同时含 `2026-11-11`（api 叶子）与 `2026-12-22`（m 叶子）（`:77`/`:78`）——这是卡 §二.3「文件头保留现网 api/m 叶子到期日期」的正向半边；
- ④ `collectInstallCallSites(SRC_DIR)` 清单 `toEqual([])`（`:80-83`），失败消息把 `文件:行号` 全列出（反测 `callsite` 轮实测到 `…pin-ssl.ts:270`）。

每条 `expect` 都带第二参数 message，红了直接读出「守的是哪条事实」，不必回到源码定位——这正是凌舟裁定 13F1 落法不认可的痛点（测试名与守护对象错配）。

**2）求值时机沿用 13F1 第三笔被接受的更正**：`readFileSync(pin-ssl)` 与扫全 `src` 的调用点采集都放在**模块加载期（import 阶段）**（`spec:67-68`），`it` 体内只做常数比较。理由与实测耗时写在文件头 `:17-20`（扫 189 个 .ts/.vue ≈ 1.1~1.8 s，若放进 `it` 体内会吃掉 vitest 默认 5000 ms 的大半预算 ⇒ 13F1 曾因此假红，见 `docs/evidence/qoder-13f1/raw/32`）。本轮四门复跑 + 实现笔后 `npm run test` 连跑 3 次无抖动。

**3）`headBlock()` 的作用域收口（比卡面字面更严，见 §五.1 报备）**：断言只作用于「起始块注释」（首个 `*/` 之前），不用全文。原因：`2026-11-11` / `2026-12-22` 在 `PINNED_CERTS` 常量旁注释里各出现一次，按全文比对时**文件头被改坏、常量旁注释仍在**照样读到绿 ⇒ 断言③ 失去防回潮能力。实测反证 = `dates` 轮：只抹文件头两处日期，全文仍各有 1 次命中，本 spec 仍红（`raw/08` 之外可直接复现）。

**4）env.ts 改后原文**（`app-mobile/src/config/env.ts:8-12`，注释，代码未动）：

```
 * 注：src/utils/pin-ssl.ts 的证书固定（PINNED_CERTS）**当前未接线**（全仓零调用点）；在册指纹为 2026-10-21 采集的
 *     现网 Let's Encrypt 值（api.onepan.cn 叶子 2026-11-11 到期、m.onepan.cn 叶子 2026-12-22 到期，均在有效期内），
 *     未接线的原因是"原生层证书回调可用"这一前置尚未满足，**不是**指纹已过期。
 *     PINNED_CERTS 按域名登记，故换 API 域名或叶子证书轮换时都**必须**同步更新在册叶子指纹；
 *     维护口径与接线前置见 docs/tasks/cards/R101-QODER-5-回传.md（S3-247）。
```

## 四、测试 / 门读数（`raw/08`＝反测闭环后·提交前；`raw/09`＝实现笔落盘后复跑）

| 门 | 实测（执行方自评） | 卡目标 | 证据 |
|---|---|---|---|
| `npm run type-check` | EXIT=0（vue-tsc 当前 0 条 = 基线 0 条） | EXIT=0 | `raw/08`、`raw/09` |
| `npm run lint` | EXIT=0（error **20** = 基线 20、warning **12872** = 基线 12872，逐位同改动前 ⇒ **未调基线**） | EXIT=0、不劣化 | `raw/04`、`raw/08` |
| `npm run test` | EXIT=0，**Test Files 6 passed (6) / Tests 57 passed (57)**，门 3 打印「当前 6 文件 / 57 用例，基线 6 / 57」⇒ **6/57 达标**；新 spec 单文件 `✓ tests/pin-ssl-static.spec.ts (1 test) 38ms` | EXIT=0、6/57 | `raw/05`、`raw/08`、`raw/09` |
| `npm run check:contract` | EXIT=0（差集 1 条 / 具名豁免 1 条，与基线同；A.2 三口径 292/283/204、后端注册 1498） | EXIT=0 | `raw/06`、`raw/08` |
| 判据① `rg -in '2026-09-15\|trustasia' app-mobile/src` | **0 命中**（RG_EXIT=1；须先 `export MSYS2_ARG_CONV_EXCL='*'`） | 0 | `raw/02`、`raw/08` |
| 判据② `installSslPinning(` 调用点 | **0**：rg 3 处命中 = 注释 `pin-ssl.ts:7`、注释 `:197`、定义 `:200`，逐处定性后均非调用点；机检同语义扫全 `src` 得 `[]` | 0 | `raw/02`、`raw/08` |
| 判据④ 反测 | 四轮闭环（见下表） | 能红、能自复原、复跑绿 | `anti/×4`、`anti/90` |

反测四轮（注入面唯一 = `app-mobile/src/utils/pin-ssl.ts`；spec / env / baseline 全程未动）：

| case | 注入 | 红点 | 复原 |
|---|---|---|---|
| `date` | 把卡点名的旧句「…已于 2026-09-15 过期」原样注回 `:6` | `AssertionError: pin-ssl.ts 文件头又出现已失效的 2026-09-15 过期表述: expected true to be false` @ `spec:73`；`Test Files 1 failed \| 5 passed (6)`、`Tests 1 failed \| 56 passed (57)`、`RED_EXIT=1` | `SHA_EQUAL=yes` + `cmp` 逐字节一致 ⇒ 复跑 `6 passed (6)` / `57 passed (57)` / `GREEN_EXIT=0` |
| `trustasia` | `:28` 只把 `Let's Encrypt` 换成 `TrustAsia`（单 token，隔离断言②） | `…又出现 TrustAsia 旧签发链表述: expected true to be false` @ `spec:75` | 同上 |
| `dates` | 文件头两处叶子到期日一并抹掉（常量旁注释仍在 ⇒ 必须两处同删） | `…缺少 api.onepan.cn 叶子到期日 2026-11-11: expected false to be true` @ `spec:77` | 同上 |
| `callsite` | 文件尾追加真实调用 `installSslPinning()`（带 `ANTI-TEST` 标记 + 重复注入拒写守卫） | `installSslPinning 出现调用点（本模块仍未接线）：…pin-ssl.ts:270: expected [ Array(1) ] to deeply equal []` @ `spec:83` | 同上 |

四轮共同点：`INJECT_EXIT=0`（注入器 latin1 字节精确、命中数 ≠ 预期即 `exit 9` 拒写）⇒ 注入现场确认（rg 计数）⇒ `RED_EXIT=1` ⇒ `cp` 复原（**未用 `sed -i`**，本仓 CRLF）⇒ 注入前/复原后同形态 SHA256 一致 = `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889` ⇒ 复原态复跑 EXIT=0。收尾另采 `rg -c 'ANTI-TEST' src/utils/pin-ssl.ts` = 无命中 ⇒ 无残留（`raw/08`）。

## 五、口径偏差报备

1. **断言作用域比卡面字面更窄也更严（主动选择，请复核）**：卡 §二.3 写「pin-ssl 文件头不含 `2026-09-15`、不含 `TrustAsia`」。① ② 两条我按字面只守**文件头**，不守全文——理论上旧文案若回潮到 `PINNED_CERTS` 旁的注释区，本 spec 读绿。补救面：卡 §三 判据① 是一条**全 `src` 的 rg**（`raw/02`、`raw/08` 实测 0 命中），人工/CI 复采可覆盖；如需把① ② 也提到全文口径，本卡一行改动即可（去掉 `headBlock` 包一层），请裁。③ 两条则反过来**必须**收窄到文件头（理由见 §三.3，`dates` 轮是它的实测反证）。
2. **env.ts 改动面从「一行」扩到「同一句的 5 行」**：卡点名 `config/env.ts:8`。原文 `:8-:9` 是**同一句话**（「…（全仓零调用点，**且指纹已过期**），域名变更时**无需**同步更新其指纹」）——「已过期」在 `:8`、「无需同步更新」是它的后果从句挂在 `:9`。只改 `:8` 会留下「指纹已过期所以换域名不用管指纹」这半截假话，故整句一并改真；未新增未删任何代码行，`API_BASE_H5/API_BASE_NATIVE` 一字未动。此点已随 §二.4 一并在 `raw/01` 留 diff 原文。
3. **反测做了 4 轮而非卡面最低要求的 1~2 轮**：卡 §三 只写「恢复任一条旧文案、或加一处 install 调用 ⇒ 独立 spec 红」。本卡有 4 个断言点，逐条钉红点才能证明**每条**都能红（首轮 13F1 的教训是 token 混注导致红点错位到别的断言，见 `docs/evidence/qoder-13f1/anti/trustasia-red.log` 那次）。未扩大代码动作面。
4. **`gates-baseline.json` 只抬 `tests`（实测即基线）**：6 文件 / 57 用例是 `npm run test` 实测读数，非推算；`lint.errorBaseline` 保持 20（未借本卡降/升），`typeCheck`/`checkContract`/`contractDrift` 三段逐字段不变（`raw/10` 机检）。
5. **过程披露：第一轮反测四轮全部作废**（`anti/90-round1-voided.note.txt`）。根因已复现定死：驱动顶部为保护 rg 参数而 `export MSYS2_ARG_CONV_EXCL='*'`，该 env 同时关掉了 MSYS 对 **node 脚本路径**的 POSIX→Windows 自动转换 ⇒ `node /d/Users/…/inject-13f2.mjs` 被 node 解析成 `D:\d\Users\…` ⇒ `MODULE_NOT_FOUND`、`INJECT_EXIT≠0` ⇒ 驱动按设计 `exit 7` 作废本轮并 `cp` 复原，**没有**把「根本没注入」的读数当反测结论。更正 = 在 `MSYS2_ARG_CONV_EXCL='*'` 下改用 Windows 盘符路径 `D:/…`（该写法对转换开关免疫）。作废轮与三段复现均未落字节（`pin-ssl.ts` SHA 全程 = `cb27d321…408889`，`git status` 对 HEAD 无改动）。
6. **补证一次采错条件（同文件内留记，未掩盖）**：`anti/90` 首版补证时漏设 `MSYS2_ARG_CONV_EXCL`，于是「错写法」也加载成功，得不出根因差异 ⇒ 该版作废重写，A/B/C 三段对照齐全（A 错写法+env ⇒ MODULE_NOT_FOUND；B 正写法+env ⇒ 正常加载；C 不设 env ⇒ 自动转换成功）。
7. **`build:h5` / `build:mp-weixin` / `build:app` 未跑**：卡 §三 未要求（本卡动作面 = 测试文件 + 两处注释 + 基线，无运行时/打包面变更）。合并态三构建按 QODER-20 卡要求必跑，已列入下一单。

## 六、红线对照

| 红线 | 自评 |
|---|---|
| 不得 push | **未 push**（`git log` 只在本地；无远端写动作） |
| 不得开 PR | **未开**（未触碰 gh / 远端） |
| 不得 `git add -A` | **未用**（实现笔逐文件 add 4 个路径；docs 笔同样逐个文件 add） |
| 只动本工作树与本分支 | 是。注入器与备份全部在树外 `D:\Users\ZXQL\wt-agents\_scratch\qoder-13f2\` |
| 不改指纹常量与业务实现 | `pin-ssl.ts` 相对 `61514b02` diff = **0 行**（`raw/10`）；`crypto.ts`、`package.json`、`backend` 全部 diff = 0 |
| 不许以调基线过关 | `tests` 段是实测上调（5/56→6/57 有 note 留痕），其余四段未动；lint error 保持 20 未借机调整 |
| 不动他人交付物 | `docs/evidence/qoder-13f1/**`、13F1 回传卡与回执：相对 `61514b02` diff = **0 行**；任务书原件与 `docs/tasks/inbox/ACTIVE.md`：diff = **0 行**（`raw/10`） |
| 不写验收判词 | 全文仅「执行方自评 × 卡目标读数」对照 |

## 七、未完成与阻塞

- **阻塞**：无。
- **`app-mobile/docs` 的同族旧表述未动**（卡 §三 判据只扫 `app-mobile/src`，文档面在判据之外，按「没有问题的地方禁止私自修改」一律未动）：实测 `rg -ilc '2026-09-15|trustasia' app-mobile/docs` = 2 文件 / 6 处——`app-mobile/docs/pin-ssl指纹维护口径.md`（5 处）、`app-mobile/docs/移动端全面审查清单与修复方案-2026-10-18.md`（1 处）。另 `docs/踩坑日志.md` 6 处、`docs/配置项契约登记表.md` 2 处属历史留档。建议一行式追单口径：维护文档改成「现网 LE 值 + 到期日 + 未接线前置」，历史留档只加「已失效」标注不改原文。
- **pin-ssl 仍未接线**（`installSslPinning()` 调用点恒 0，本卡的断言④ 守的就是这件事）：接线需要「新指纹在册 + 原生层证书回调可用」两个前置，属另一张卡的动作面（S3-247）。
- **真机/APP-PLUS 运行时未验**：本卡零运行时变更，无手段可验，见 §八。

## 八、自我报备（含未验清单）与踩坑

未验清单：① APP-PLUS 真机 TLS 握手与原生层证书回调——**未验**（未接线，无从验）；② 现网证书**此刻**是否仍是在册四条——**未验**（本卡未联网重采，注释里的三个日期是复述 `docs/evidence/qoder-13/raw/01|02-pin-spki-*.log` 于 2026-10-21 01:46/01:47 的采集读数；api 叶子当时剩 22 天，已命中 30 天提醒窗口 WARN）；③ H5 / 小程序端行为——**未验**（无运行时变更）；④ 三端构建——**未跑**（卡未要求，见 §五.7）。

踩坑（新增 2 条，均已在证据里留可复现取证）：

- **[A] `MSYS2_ARG_CONV_EXCL='*'` 是双刃**：它保护 rg 的 `/` 开头与 `|` 模式参数不被改写，但同时关掉 node 脚本路径的自动转换 ⇒ 同一驱动里两类参数需要两套写法（rg 用 POSIX 路径 + 该 env；`node <脚本>` 必须 `D:/…` 盘符风格）。第一轮反测四轮作废就是踩在这上面。
- **[B] 「红档被成功轮覆盖」的处理**：作废轮的四张 `anti-*.log` 在重跑时被成功轮同名覆盖，属既成事实。处置 = 不复现转述、而是**重新采一次可复现证据**（`anti/90`），并写清「补证不是当时原始 stdout」；采错条件的那一版也在文件内留了一行说明，避免后来人按错条件复现得出「无法复现」的结论。
- **[C] `echo "RUN$i EXIT=$?"` 在管道后取的是管道末端命令的退出码（本卡又踩一次，已在 `raw/09` 追加补采）**：`raw/09` 首版「连跑 3 次」段用 `npm run test 2>&1 | grep … | paste …; echo "RUN$i EXIT=$?"` ⇒ 取到的是 `paste`/`grep` 的退出码，且选中的读数行在该写法下没落进日志 ⇒ 那三行 `EXIT=0` **不足以**证明 57 用例全过。处置 = 同一文件内 **append** 补采段（临时文件 + `$?` 紧跟 `npm`），三次 `RUN{n} NPM_EXIT=0` 且逐次给出 `Test Files 6 passed (6)` / `Tests 57 passed (57)` / 门 3「当前 6 文件 / 57 用例，基线 6 / 57」，无 `timed out`。首版那段不删（证据不覆盖历史），只在补采段开头点名其缺陷。附带一处小瑕疵：补采段的说明行里 `$i`/`$?` 被 shell 提前展开，日志里显示成 `echo "RUN EXIT=0"`，语义仍完整，不再重采。

## 九、复现命令

```bash
# 四门（两种等价口径；命令与 cwd 必须配套）
cd /d/Users/ZXQL/ZXQL-MS/wen-ssystem && npm --workspace app-mobile run check:gates
cd /d/Users/ZXQL/wt-agents/QODER-13/app-mobile && for g in type-check lint test check:contract; do npm run $g; done

# 两条 rg 判据
export MSYS2_ARG_CONV_EXCL='*'
rg -in '2026-09-15|trustasia' app-mobile/src      # 期望 0 命中（EXIT=1）
rg -n  'installSslPinning\(' app-mobile/src       # 期望 :7/:197 注释 + :200 定义 ⇒ 调用点 0

# 还原证明与范围证明
git diff 597230c4 -- app-mobile/tests/storage-crypto.spec.ts | wc -l      # 期望 0
git diff --stat 61514b02..HEAD                                             # 期望 4 文件
git diff 61514b02..HEAD -- app-mobile/src/utils/pin-ssl.ts | wc -l         # 期望 0

# 反测（每 case 一份红档，驱动自带 cp 复原与 SHA 同形态比对；node 路径必须盘符风格）
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f2/anti-round.sh date       <红档路径>
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f2/anti-round.sh trustasia  <红档路径>
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f2/anti-round.sh dates      <红档路径>
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f2/anti-round.sh callsite   <红档路径>
# 复原自检
sha256sum app-mobile/src/utils/pin-ssl.ts        # 期望 cb27d321…408889
rg -c 'ANTI-TEST' app-mobile/src/utils/pin-ssl.ts # 期望无命中（EXIT=1）
```

## 十、对下一单（QODER-20 最终集成）的建议

1. 本卡合流后 `app-mobile/tests` = 6 文件（新增 `pin-ssl-static.spec.ts`，1 describe/1 it）；与 QODER-19 基座 `cdf16ce4`（10 文件 / 184 用例）、QODER-18 `bd7e158f`（6 文件 / 71 用例，含 `request-retry-safety.spec.ts` 的 `it`⑭）合并时，`gates-baseline.json.tests` 必然冲突，按「实测即基线」收敛，勿手推。
2. 冲突面提示（按 `21b465e5..` 的改动文件清单比对，非推测）：13F2 与 18 的**唯一**同名改动文件是 `app-mobile/scripts/gates-baseline.json`；18 与 19 基座**共享** `app-mobile/src/api/request.ts` 与 `app-mobile/tests/request-retry-safety.spec.ts` 两个文件 ⇒ 合并这两支时该两处也可能出现内容冲突，不止 baseline。11R 相对基线的改动集中在 `app-mobile/docs/`、`docs/evidence/qoder-11{,r}/`、`docs/tasks/**`，与三支代码面无重叠，但与 18 共享若干 `docs/tasks/**` 文件。
3. `guard-rbac-wiring.mjs --strict` 与 `--strict --no-stale` 两次都要跑（QODER-13 给脚本加过 `--no-stale`），且 `git diff 21b465e5..HEAD -- backend/src` 必须为 0。
4. 若要把 pin-ssl 旧文案守卫扩到全文口径（§五.1），建议放进 QODER-20 之后的独立小单，别在合并态里混代码改动。
