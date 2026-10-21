# ACTIVE 回执 · QODER-24 —— 移动端热更新安全（MO-14）失败关闭

【汇报 QODER-24】QODER-24 热更新四道闸（semver 严格更高／包地址同源／下载实算 SHA-256／跳转集中白名单）—— 判据全部收进纯函数模块并可逐条摘除红，四门 + 三构建负责人独立复跑全 EXIT=0（test 12/227），后端摘要字段缺失 ⇒ **`.wgt` 自动直装通道按设计保持关闭，未伪造联调通过**
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-21
对应派单编号：QODER-24（`docs/tasks/inbox/QODER-24-update-security.md`）｜批次协议：`D:\Users\ZXQL\wt-agents\_qoder23-26-exec-protocol-20261021.md`
交付物：实现笔 `622f5894f1e03f7f122706fe5d0c97b52e36d368`（5 文件：`src/config/update-security.ts` 新增 495 行、`src/utils/update.ts`、`src/utils/crypto.ts` 仅加两处 `export`、`tests/update-security.spec.ts` 新增、`scripts/gates-baseline.json`）＋ 文档笔（本回执 + `docs/tasks/cards/R101-QODER-24-回传.md` + `docs/evidence/qoder-24/**` 含负责人亲跑两份，哈希不预写，由 `git log --oneline -3` 实测）
完整十项回传：`docs/tasks/cards/R101-QODER-24-回传.md`｜证据树：`docs/evidence/qoder-24/**`
> 本回执只写执行方自评、负责人亲跑复核与卡片判据对照，**不含凌舟裁定／验收结论类判词**。

## 一、负责人亲跑复核（不是转录代理日志）

本轮由负责人在同一工作树、同一尖端 `622f5894` 上**串行**重跑，与执行代理日志分文件并存（`raw/50`、`raw/51`、`anti/50`）：

| 复核项 | 命令（工作树根） | 负责人实测 | 与卡 §三 对照 |
| --- | --- | --- | --- |
| 四门 | `npm --workspace app-mobile run check:gates` | **`GATES_EXIT=0`**；`vue-tsc EXIT=0，当前错误 0 条，基线 0 条`；`当前 error 0（基线 0）、warning 12872（基线 12872）`；`Test Files 12 passed (12)`／`Tests 227 passed (227)`；`差集 1 条，具名豁免 1 条` | **逐项一致** |
| build:h5 | `npm --workspace app-mobile run build:h5` | **`BUILD_EXIT_h5=0`**、`DONE Build complete.` | 一致 |
| build:mp-weixin | 同上 | **`BUILD_EXIT_mp-weixin=0`**、`DONE Build complete.` | 一致 |
| build:app | 同上 | **`BUILD_EXIT_app=0`**、`DONE Build complete.` | 一致 |
| 产物 | `ls -d app-mobile/dist/build/*` | `app` / `h5` / `mp-weixin` 三目录均在 | 一致 |
| 后端 | `git diff bc1087ee..HEAD -- backend/ \| wc -c` | **0 字节** | 一致 |
| 反测 r1（摘 semver 严格更高） | `_qoder24_ownverify/round.sh r1`（负责人自有副本） | `INJECT_EXIT=0`、`BEFORE_HIT=1`、`PREFLIGHT_AFTER_HIT=0`、`VITEST_RED_EXIT=1`，红点含 **`★ 远端版本更低（降级）必须不提示【反测①目标用例】`**（`2 failed \| 39 passed (41)`）；`cp` 复原后 **`VITEST_GREEN_EXIT=0`（41/41）** | **复现成功** |
| 反测 r3（摘摘要比较） | `round.sh r3` | 同上形态，红点含 **`★ 实算与下发不一致必须拒装（改首/中/尾字节/改长度…）【反测③目标用例】`** 与 `digestMatches 任一侧非法即 false`；复原后 41/41 绿 | **复现成功** |
| 复原 SHA | `sha256sum` + `git hash-object` | 两轮 `SHA_BEFORE == SHA_AFTER == 12fb8fbc182ea6ae9cfa6b602ea565ef3a3fc8798adf5819d4b3a83eef7866c8`（worktree 形态，该文件实测 LF）、`GIT_BLOB_SHA` 恒为 `4c802a5d7ef09217bd9a688156c3eacd89531994`，且与代理四轮台账同值 | **一致（两形态不跨比）** |
| 残留突变体 | `rg -n "QODER24-ANTI\|QODER-24-ANTI-MUTATED\|return true // QODER24" app-mobile/src app-mobile/tests` | **`MARKER_EXIT=1` ⇒ 零残留** | 见 §三.1 的读数澄清 |
| 行号锚点 | 逐行 `awk` 抽样 | `update-security.ts` 26 处锚点（`:42/:53/:99/:110/:115/:143/:157/:227/:234/:247/:268/:298/:306/:309/:320/:335/:340/:351/:368/:391/:394/:403/:411/:417/:458`）与 `update.ts` 12 处（`:46/:112/:142/:146/:149/:174/:192/:223/:236/:244/:273/:280`）**全部逐字命中**；`crypto.ts:69/:167` 两处 `export` 就位 | 卡 §二 引用可信 |
| 唯一调用点 | `rg -n "plus\.runtime\.install\s*\("` / `"plus\.runtime\.openURL\s*\("` src | `install` 实码 1 处（`update.ts:146`）、`openURL` 实码 1 处（`:236`）；`force: true` 仅出现在注释文里，**代码内零残留** | 卡 §二.12/15 成立 |

## 二、失败关闭的真实语义（派单点名要求，逐字回话）

派单原文：**「QODER-24 的后端摘要字段当前缺失，移动端必须失败关闭，不得伪造联调通过。」** 本卡执行结果：

- 后端事实（只读取证，未改一行）：`backend/src/services/platform/app-version.service.ts:16-32` 的 `AppVersionRow` 无摘要字段；`controllers/platform/app-version.controller.ts:49/:100` 的 zod 只收 `packageUrl`；`docs/migrations/141_app_version.sql:9` 只有 `package_url`。后端全仓 `rg -in "package_sha256|packageSha256|sha256"` 在 platform 服务/控制器与迁移文件 **零命中**（`raw/45`）。
- 因此移动端行为：**`decideUpdateAction`（`update-security.ts:458`）在缺摘要时判定 `kind !== 'wgt'` ⇒ 自动直装通道关闭**；用户被引导到白名单下载页（`updateUrl` 可信时），或只看到"暂不能自动更新"提示（`promptBlocked`，`update.ts:244`）。
- **未写"联调通过"任何一处**：卡 §四 对 §二.3 的自评明确写作「达标（单测层）+ 运行态未验」，§七.1 把后端字段列为**外部阻塞**并建议派后端卡；本回执同样只声明"失败关闭已生效"，不声明热更新功能可用。
- 代价已如实登记（卡 §七.2）：**免重装 APK 的 wgt 增量更新当前不可用**，且若某条发布记录只填 `packageUrl`、没填 `updateUrl`，表现为"提示发现新版本但没有可点动作"。这条只能由后端补摘要字段解除；本单未按红线禁止的方向放宽任何校验。

## 三、本轮回执对代理证据的两处读数澄清（不改写原始日志，另立说明）

1. **`anti/16-restore-and-final-state.log` 的 `MUTANT_LEAK_EXIT=0` 不是突变体残留**：该条 `rg` 的 pattern 含 `cmp !== 0`，命中的是 `update-security.ts:23` **文件头注释里描述反测配方的一行**（`① semver：… 改成 …`）⇒ `rg` 退出 0 表示"有命中"，命中物不是代码。负责人另跑只匹配突变尾标的 `rg` ⇒ **`MARKER_EXIT=1`（零残留）**，见 §一 表末行与 `anti/50-owner-anti-r1-r3.log` 收尾。原始日志保持原样，本条只做解释。
2. **`raw/23-artifacts-and-exits.log` 里混进一行 `ls: cannot access 'app-mobile/dist/build/mp-weixin/app-service.js'`**：该行属采集顺序问题（产物清单在 `raw/24` 重采并给出 `mp-weixin 16 条目（含 app.js/app.json）`）。负责人本轮 `ls -d app-mobile/dist/build/*` 三目录齐在 ⇒ 三构建产物事实成立，但 **`23` 这份文件的 `ls` 段不可单独引用**，应以 `24` + `raw/50` 为准。

## 四、判据自评（卡 §三 逐条 + 亲跑覆盖）

| 判据 | 目标 | 读数（负责人亲跑优先） | 自评 |
| --- | --- | --- | --- |
| `check:gates` | EXIT=0 | `GATES_EXIT=0`（`raw/50`，代理 `raw/10` 同值） | 达标 |
| type-check | 0 = 0 | `vue-tsc EXIT=0，0 条／基线 0 条` | 达标 |
| lint | error 0／warning ≤12872 | `error 0（基线 0）／warning 12872（= 基线）` | 达标（未劣化） |
| test | 全过、基线只升 | `12 passed (12)`／`227 passed (227)`，门行"当前 12/227，基线 12/227" | 达标 |
| check:contract | EXIT=0 | `差集 1 条／具名豁免 1 条` | 达标 |
| 三构建 | 各 EXIT=0 | `BUILD_EXIT_h5=0`／`_mp-weixin=0`／`_app=0`（`raw/50` 亲跑） | 达标（仅"可编产物"） |
| 四组反测 | 各红且点名、复原绿 | r1/r3 **负责人复现**；r2/r4 代理日志 `INJECT_EXIT=0`＋点名＋`SHA` 恒等（`anti/12`、`anti/15`） | 达标 |
| r3 首轮作废 | 不作证据 | `anti/13` 记 `AFTER_HIT=2 ⇒ VOID`，同轮重跑记 `anti/14`，原始日志未改写 | 合规（作废轮不计数） |
| 后端零改动 | diff 0 | **0 字节**（亲跑 + 代理双份） | 达标 |
| 改动面 | 仅卡点名文件 | 5 文件（+1304/−71），未碰 `.eslintrc.cjs`/`vitest.config.ts`/四门脚本/`package.json`/admin-web/miniapp | 达标 |
| 基线纪律 | 只升 `tests` 段 | `testFiles` 11→12、`testCount` 186→**227**、`tests.note` 末尾追加（`NEW_STARTS_WITH_OLD=true`）；其余五段 + `_comment` 逐段 `JSON.stringify` 比较 5 段 IDENTICAL（`raw/42`） | 达标（批次卡 `:17` 授权范围内） |
| 红线 | 不 push／不 PR／不 `git add -A`／不改后端 | 逐文件 add；本分支无 upstream；后端 0 字节 | 达标 |
| 红线 | 失败关闭不得冒充联调通过 | 见 §二 | 达标 |
| 工作树终态 | clean | 文档笔提交后 `git status --porcelain` 空 | 本笔提交后成立 |

**未达成项：无。** 但 §五 的未验面意味着本卡的"达标"只到**单测层 + 构建层**，不代表热更新功能可用。

## 五、未验清单（不许当通过，随卡结转）

1. **App 真机 `plus.io.FileReader.readAsDataURL` 能否读回 `.wgt` 原始字节**——无设备。失败方向是 `deny`（不安装、删临时文件），不会退化为直装，但需真机复核一次。
2. **真机"下载→校验→安装→重启"全链路**与 `{ force: false }` 在 5+ Runtime 的实际拒绝行为——无设备。
3. **H5 运行态**：未起 `dev:h5`、未接 mock 后端、未取 DOM/console/network——本卡只有 `build:h5` EXIT=0。
4. **小程序运行态**：产物内无可达安装路径（`#ifdef APP-PLUS` 剥离），行为等价"该端不更新"，未做运行取证。
5. **`VITE_UPDATE_HOSTS` 在真实 CI/.env 的注入链路**：只在单测用 `vi.stubEnv` 验证。
6. **纯 JS SHA-256 的性能**：`sha256()` 一次性构造填充副本（≈2× 文件大小），叠加 `readAsDataURL` 的 base64（≈1.33×），几十 MB 包在主线程同步摘要**未压测**（卡 §八.1）。
7. **后端摘要字段**：键名/来源/是否同时下发 `packageSize` 需外部卡（卡 §十.1）。
8. 四卡并行读数未收敛：12/227 只是本树口径，由集成单统一收敛（批次协议 §三）。
9. 实现笔与文档笔均未进 `main`；主检出 `main` 已到 `d5f56c0a`，本卡按协议钉在 `bc1087ee`，未 rebase。

## 六、待裁问题（本卡不动手，请凌舟定）

1. **`.wgt` 包实际发布主机**：卡 §二.2 要求"与 API 基址同源"。若运营当前把包放在 OSS/CDN（不在 `api.onepan.cn`），改造后会被拒装。仓库内**无任何证据**说明 wgt 发布在哪个主机（`docs/部署文档.md:38-50` 只写"填下载地址/包地址"，未给主机）。改判为"与集中配置的包主机白名单同源"只需动 `validatePackageUrl(:298)` 的主机来源，架构已留口——**是否改判请裁**。
2. **后端摘要字段契约**：键名（本卡消费驼峰 `packageSha256`）、来源（人工填 vs 构建产物机算）、是否加 `packageSize` 二次兜底；定了之后移动端最多一行跟进。
3. **通道关闭期间的运营口径**：是否接受"提示发现新版本但无可点动作"的表现，还是要求总台**缺摘要即禁止发布**（后者更安全，但需要后端卡支持）。
4. **`force: false` 与版本号严格递增**：同版本号重发包会被 semver 闸与 `force:false` 双拒——发布流程纪律需书面确认（`docs/部署文档.md:49` 已写"版本号递增"，未写重发场景）。
5. **`gates-baseline.json` 归属面**：任务书 §一"只准改"清单未列基线文件，本卡按批次卡 `:17` 授权只动 `tests` 段。建议下轮把基线写进"只准改"清单，否则执行方按字面理解会漏调基线、门 3 长鸣"高于基线"提示。
6. **`current-tasks.md` / `inbox/ACTIVE.md` 本卡未动**：四卡并行下执行方改这两份等于并发写他人台账（协议明令禁止），请裁收口人。
7. **本卡 `raw/23` 的 `ls` 段不可单独引用**（§三.2），是否要求在文档笔内加"证据可引用性"标注，请裁。

## 七、建议派单

- **BACK-QODER-25**：`t_app_version` 加 `package_sha256 CHAR(64)` + 服务读写 + 下发字段 + 总台发布页必填校验，并给出 wgt 构建→摘要入库的产物链（入口行号见卡 §七.1 三处）。
- **MO-QODER-24B**：真机跑两条路径取证（`readAsDataURL`→实算→拒装删文件 / 通过安装），并补 §五.6 的耗时读数。
- **OPS**：`deploy/nginx-production.conf:85/:127` 与 `OFFICIAL_UPDATE_HOSTS(:391)` 主机清单一致性巡检（域名轮换两处同步）。
