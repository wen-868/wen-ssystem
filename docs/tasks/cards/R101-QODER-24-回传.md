# R101-QODER-24 回传卡 · 移动端热更新安全（MO-14）失败关闭

> 汇报对象：凌舟（总负责人）
> 汇报人：Qoder（移动端）｜2026-10-21
> 派单人：凌舟｜任务书：`docs/tasks/inbox/QODER-24-update-security.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-24`｜分支：`fix/qoder-24-update-security`｜基线：`bc1087ee`
> 执行协议：`D:\Users\ZXQL\wt-agents\_qoder23-26-exec-protocol-20261021.md`
> 本卡只写执行方自评 + 依据 + 待裁项，**不含任何验收方判词**（"通过/准予合并"一类字句不出现）。
> 所有读数都有对应原始日志（`docs/evidence/qoder-24/**`），命令原文 + 退出码 + 行号 + SHA 落盘，未做二次加工。

---

## 一、基线与提交

| 项 | 值 | 出处 |
| --- | --- | --- |
| 基线（共同） | `bc1087eec4b880827518444be36f5874e330e1d3` | `raw/00`（开工前 `git rev-parse HEAD`）；负责人 §三 已实测四树 HEAD 均此值 |
| 开工前工作树 | `git status --porcelain` 空、分支 `fix/qoder-24-update-security` | `raw/00` |
| **实现笔** | `622f5894f1e03f7f122706fe5d0c97b52e36d368`（`feat: QODER-24 热更新失败关闭——…`），5 文件 +1304/−71，逐文件 `git add`（无 `-A`） | `raw/00`：`git rev-parse HEAD`；`raw/40`：`git show --stat` |
| 交付笔（本卡 + 回执 + 证据树） | 本笔（哈希不在本卡内预写，由 `git log --oneline -3` 实测；协议 §四.4 禁止给不存在的东西预先写哈希） | `raw/40` |
| 上游 / push | `git remote -v` 无 upstream 跟踪分支被本单写过；**未 push、未开 PR** | `raw/40` |
| 后端 | `git diff bc1087ee..HEAD -- backend/` = **0 字节** | `raw/40` |
| 工作树终态 | `git status --porcelain` 为空 | `raw/40` |

主检出 `main` 已在 `d5f56c0a`（`git worktree list` 读数），**不等于**本卡基线 `bc1087ee`；本单未 rebase、未追新，收敛由集成单负责（见 §八 风险 ⑦）。

---

## 二、逐条实现说明（文件:行号，均为实现笔 `622f5894` 的行号）

新增集中判据模块 `app-mobile/src/config/update-security.ts`（495 行，**全部纯函数**，不碰 `uni`/`plus`/`window`/网络 ⇒ 反测能"摘一个判据就红"）：

| # | 判据 | 位置 |
| --- | --- | --- |
| 1 | semver 严格比较：`SEMVER_RE`（严格 `X.Y.Z`，拒 `v` 前缀/前导零/四段）、`parseSemver`、`compareSemver`、预发布 §11 序（`comparePrereleaseIdentifier` / `comparePrerelease`）、唯一入口 `isRemoteVersionNewer` | `:42` / `:53` / `:99` / `:72` / `:84` / **`:110`**（`return cmp > 0` 在 `:115`） |
| 2 | URL 手工解析与硬闸：`isStrictAsciiUrl`（拒空白/控制字符/非 ASCII/反斜杠）、`parseHttpUrl`（scheme/userinfo/host/port/path/query/hash）、`isIpAddress`、`isDomainHost`（拒 IP、单标签、`xn--`）、`hardenedHttpsUrl`（https + 无 userinfo + 非 IP + 端口只允许缺省或 443 + 拒 `.`/`..` 路径段） | `:143` / `:157` / `:227` / `:234` / `:268` |
| 3 | **同源判定从运行时 API 基址派生主机**（不写死字面量）：`deriveApiHost`（绝对基址取主机；相对 `/api` 只能靠运行时 origin；解析不出 ⇒ 空串 ⇒ 调用方失败关闭） | **`:247`** |
| 4 | `packageUrl` 闸：`validatePackageUrl` = 硬闸 + `parsed.host !== apiHost ⇒ 拒装`（`:306`）+ `.wgt` 结尾（`:309`） | **`:298`** |
| 5 | 摘要闸：`normalizeSha256Hex`（整串 64 hex，缺失/非法 ⇒ `null`）、`sha256HexFromBytes`（**实算字节**，复用 `utils/crypto.ts` 的纯 JS `sha256`）、`digestMatches`（任一侧非法即 false）、`dataUrlToBytes`（还原 `plus.io.FileReader.readAsDataURL` 的 base64 为原始字节）、`verifyPackageBytes`（缺摘要 / 读不到字节 / 不一致三种全部 `deny`，禁止 toast 冒充） | `:320` / `:335` / `:340` / `:351` / **`:368`** |
| 6 | 跳转白名单**集中配置**：`OFFICIAL_UPDATE_HOSTS`（`:391`，唯一配置点；来源可核对 `deploy/nginx-production.conf:127` 官网 `www.onepan.cn onepan.cn`、`:85` `m.onepan.cn`）、`extraUpdateHosts`（`:394`，构建期 `VITE_UPDATE_HOSTS` 追加，非法主机丢弃）、`updateHostAllowlist`（`:403`，集中名单 ∪ 运行时 API 主机）、`isAllowedUpdateHost`（`:411`，全等比较、无通配）、`validateUpdateUrl`（`:417`） | **`:391–:425`** |
| 7 | 决策合成：`decideUpdateAction`（版本判据先于通道判据；`.wgt` 直装必须同时过包地址闸与摘要闸，任一不过 ⇒ 自动直装关闭 ⇒ 回落白名单跳转 ⇒ 跳转也不可信则"只提示不执行"） | **`:458`** |

`app-mobile/src/utils/update.ts`（重写接线，295 行改动）：

| # | 改动 | 位置 |
| --- | --- | --- |
| 8 | `LatestAppVersion` 增加 `packageSha256?: string \| null`（只表示"读得到就用"，**不代表缺失可通过**） | `:46` |
| 9 | `resolveBase` / `currentVersion` 保持原语义，但改为"默认值 + 按端覆盖"形态（消除并列 `return` 的 `no-unreachable` 隐患）；新增 `runtimeOrigin()`（H5 取 `window.location.origin`，其余端空串 ⇒ 相对基址解析不出主机即失败关闭） | `:49` / `:57` / `:70` |
| 10 | `readPackageBytes()`：`plus.io.resolveLocalFileSystemURL` → `entry.file` → `new plus.io.FileReader().readAsDataURL` ⇒ **原始字节**；任一步失败回调 `null`；**非 APP 端直接 `null`（不安装）** | **`:112`** |
| 11 | `downloadAndVerify()`：`uni.downloadFile` 后**先实算再装**——`verifyPackageBytes(bytes, expectedSha256)` 通过才 `installVerifiedWgt(tempFilePath)`；不通过 ⇒ `removeTempPackage(tempFilePath, …)` 删临时文件 + 取消安装提示 | **`:174`**（`:185` 读字节、`:186` 比对、`:192` 删文件） |
| 12 | `installVerifiedWgt()`：`plus.runtime.install` 全仓**唯一**调用点（`:146`），options 由原 `:55` 的 `force: true` 改为 **`{ force: false }`（`:149`）**，且只在校验通过路径可达 | `:142` |
| 13 | `removeTempPackage()`：校验失败分支删临时文件（`entry.remove`），删除失败也不放宽拒装结论 | `:85` |
| 14 | `handleAppUpdate()`：`decideUpdateAction` 唯一决策入口；`if (!decision.prompt) return`（`:280`，旧实现在 `:131` 是 `versionName === currentVersion()` 等值比较，已删除）；`wgt`/`open-url`/无可信通道三分支互斥 | **`:273`**（`:274` 决策、`:280` prompt 闸） |
| 15 | `plus.runtime.openURL` 全仓唯一调用点（`:236`），参数只能是**决策产出的** `decision.openUrl`（已过白名单硬闸），后端原始 `data.updateUrl` 不再直达 | `:223` / `:236` |
| 16 | H5 提示刷新、APP 按决策分支、**小程序端无任何动作**（条件编译后无可达安装路径 ⇒ 失败关闭）；`checkAppUpdate` 的端点与 arch 逻辑未动 | `:257` / `:294` |

`app-mobile/src/utils/crypto.ts`：**最小改动**——只给既有 `sha256`（`:167`）与 `base64ToBytes`（`:69`）加 `export`，未另写第二份摘要实现。`git diff bc1087ee..HEAD -- app-mobile/src/utils/crypto.ts` 全文只有 **4 增 4 删 = 2 行 JSDoc 注释 + 2 行函数签名（`function` 前加 `export`）**，函数体一行未动（原始 diff 见 `raw/46-crypto-minimal-diff.log`）。

`app-mobile/tests/update-security.spec.ts`：1 文件 / **41 用例**，六个 describe（① semver 9、② packageUrl 8、③ 摘要 7、④ 白名单 6、⑤ 决策 6、⓰ update.ts 接线静态断言 5）。静态断言按协议 §四.7 全部在 **import 阶段**求值（`readFileSync` 在模块顶层，用例体内只做常数比较）。

`app-mobile/scripts/gates-baseline.json`：只上调 `tests.testFiles` 11→12、`tests.testCount` 186→227，并在 `tests.note` 末尾追加 ★QODER-24 一段（旧 note 长 2941 字 → 新 note 长 3641 字，`NEW_STARTS_WITH_OLD=true`、追加 700 字）；`_comment` / `typeCheck` / `lint` / `checkContract` / `contractDrift` **一字未动**（六分节 `JSON.stringify` 逐段比较：5 段 IDENTICAL + 仅 `tests` DIFFERS，机检见 `raw/42-baseline-scope-machine-check.log`，`BASELINE_SCOPE_VERIFY=PASS`）。

---

## 三、门·构建·守卫读数（终态，反测全部复原之后）

| 项 | 命令（工作树根） | 读数 | 出处 |
| --- | --- | --- | --- |
| 四门 | `npm --workspace app-mobile run check:gates` | **`CHECK_GATES_EXIT=0`** | `raw/10-gates-green.log` |
| ├ type-check | 同上第 1 道 | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`（0=0） | `raw/10` |
| ├ lint | 第 2 道 | `当前 error 0（基线 0）、warning 12872（基线 12872）` ⇒ **未劣化** | `raw/10` |
| ├ test | 第 3 道 | `Test Files 12 passed (12)` / `Tests 227 passed (227)`，test 门 `12 / 227，基线 12 / 227` ⇒ EXIT=0 | `raw/10` |
| └ check:contract | 第 4 道 | `差集 1 条，其中具名豁免 1 条` ⇒ EXIT=0 | `raw/10` |
| build:h5 | `npm --workspace app-mobile run build:h5` | **`BUILD_EXIT_h5=0`**，`DONE Build complete.` | `raw/20-build-h5.log` |
| build:mp-weixin | `… run build:mp-weixin` | **`BUILD_EXIT_mp-weixin=0`**，`DONE Build complete.` | `raw/21-build-mp-weixin.log` |
| build:app | `… run build:app` | **`BUILD_EXIT_app=0`**，`DONE Build complete.` | `raw/22-build-app.log` |
| 产物路径 | `ls app-mobile/dist/build/<p>` + `grep -rl` 机检 | `h5` 3 条目（含 `index.html`）、`mp-weixin` 16 条目（含 `app.js`/`app.json`）、`app` 21 条目；均在 `app-mobile/dist/build/<platform>`（非仓库根 `dist/`） | `raw/24-artifacts-check.log` |
| 判据是否真进三端产物 | `grep -rl "packageSha256" app-mobile/dist/build/<p>` | `PACKAGE_SHA256_HITS_h5=1 / mp-weixin=1 / app=1`；白名单主机值 `OFFICIAL_HOST_HITS` h5=2/mp=2/app=1 | `raw/24` |
| 产物内是否残留 force 直装 | `grep -rl 'force:!0' app-mobile/dist/build/app` | **`FORCE_TRUE_MINIFIED_APP=0`**（压缩形态也没有 `force:true` 残留） | `raw/24` |
| contractDrift | 未在本单单独跑（非四门之一） | 基线 debt 0 由负责人 §三 实测；本单零后端/零 API 调用面改动 | — |

⚠️ 读数纪律：`check:gates` 全部在**工作树根**跑；未在 `app-mobile/` 目录内跑 `npm --workspace`（协议 §三 作废读数坑）。反测期间的单 spec 直跑用 `node ../node_modules/vitest/vitest.mjs run tests/update-security.spec.ts`（不是门，逐轮原始输出在 `anti/`）。

---

## 四、判据自对账（任务书 §二 六件 + §三 硬验收，逐条 自评 + 依据）

| # | 判据 | 自评 | 依据 |
| --- | --- | --- | --- |
| §二.1 | 纯函数版本比较，仅合法 semver 且严格更高才提示；降级/等值/非法均不提示 | 自评**达标**（单测层） | `update-security.ts:110`；spec describe① 9 用例（含 `1.10.0>1.9.0` 数值序、`v1.0.0`/`01.0.0`/四段判非法、预发布 §11 序、build 元数据不参与）；反测① 红 |
| §二.2 | `packageUrl` 仅 https、无 userinfo、与 API 基址同源、`.wgt` 结尾，其余拒装 | 自评**达标**（单测层） | `:268` 硬闸 + `:298`；同源由 `deriveApiHost(:247)` 从运行时基址解析，**无字面量比对**（用例证明：把基址换成 `https://api.test.example.cn/api` 结论跟着换）；反测② 红 |
| §二.3 | 支持未来下发 `packageSha256`；缺失/非 64 位 hex/实算不一致 ⇒ 删临时文件并拒装 | 自评**达标**（单测层）+ **运行态未验** | 决策层 `:458`（缺摘要 ⇒ `kind!=='wgt'`）；字节层 `:368`；删文件在 `update.ts:192`；spec describe③ + ⑤ 各用例；反测③ 红 |
| §二.4 | 用项目已有能力实算文件 SHA-256，不得只校验长度/首尾片段 | 自评**达标**（单测层）：纯 JS `sha256` 与 `node:crypto` 对 0/55/56/63/64/65/119/120 字节、UTF-8 中文 emoji、1024 个单字节样本**逐一相等**；篡改首/中/尾字节、增删长度、同长度换内容全部拒装 | `crypto.ts:167` 导出复用（diff 全文见 `raw/46`，函数体 0 改动）；spec ③ 前两条用例（`spec.ts:297/299/300`）；`anti/14`（红→绿） |
| §二.5 | `updateUrl` 仅 https 且主机命中显式集中白名单，至少覆盖 API 主机 + 官网下载主机，值集中配置 | 自评**达标**（单测层）：`OFFICIAL_UPDATE_HOSTS(:391)` 三条 + `updateHostAllowlist(:403)` 并入运行时 API 主机；`VITE_UPDATE_HOSTS` 可追加；全等比较，`onepan.cn.attacker.io` 不命中 | spec describe④ 6 用例；反测④ 红 |
| §二.6 | 可单测的 URL/版本/摘要校验用例 + 四组反测（semver/同源/摘要/白名单）各自红并点名、复原 SHA 一致后复跑绿 | 自评**达标**：四轮全部 `INJECT_EXIT=0`、目标用例红且点名、`SHA_BEFORE=SHA_AFTER`、复跑 41/41 绿 | `anti/11`、`anti/12`、`anti/13`（VOID，复原链另立 `anti/17`）、`anti/14`、`anti/15`、`anti/16` |
| §三-1 | `check:gates` EXIT=0 | 自评**达标** | `raw/10` |
| §三-2 | 三构建 EXIT=0 | 自评**达标** | `raw/20/21/22` |
| §三-3 | 四组反测证据完整 | 自评**达标**（r3 首轮 VOID，同轮重跑达标） | `anti/*` + §五 |
| §三-4 | `git diff bc1087ee..HEAD -- backend/` = 0、工作树 clean | 自评**达标** | `raw/40` |
| §四红线 | 不 push、不开 PR、不 `git add -A`、不改后端 | 自评**达标**：实现笔 5 个文件逐文件 `git add`（清单 `raw/43` ⑦）；后端 0 字节（`raw/43` ⑤、`raw/45` ⑦）；本分支无 upstream（`raw/43` ⑥ `UPSTREAM_EXIT=128`） |
| §四红线 | 不信任缺失摘要/HTTP 明文/IP/非标准端口/带凭据 URL | 自评**达标**：`hardenedHttpsUrl(:268)` 五条全覆盖，spec ②④ 逐条点名用例 | `raw/10` |
| §四红线 | 不得继续 `force:true` 直装未验包；不得用 toast"提示不支持"冒充摘要校验 | 自评**达标**：`plus.runtime.install` 唯一点在 `installVerifiedWgt(:142)`，只由 `verifyPackageBytes` 通过后可达；options `{ force: false }(:149)`；读不到字节 ⇒ `deny` 且不安装 | 静态断言用例（describe⓰ 4 条） |
| §四红线 | 不得把"无后端摘要字段"写成通过 | 自评**达标**：全卡与回执一律写"失败关闭已生效 / 联调阻塞于后端契约"，见 §七 | 本卡 §七 |

---

## 五、反测轮次台账（协议 §四.1/§四.2/§四.3 逐条照做）

注入对象统一为 `app-mobile/src/config/update-security.ts`；注入器 `D:/Users/ZXQL/wt-agents/_qoder24_bak/inject.cjs`（**`.cjs`**，命中次数≠1 或 after 串已存在 ⇒ `exit(2)` 拒写）；备份/复原全用 `cp`，备份在**树外** `_qoder24_bak/`；未用 `sed -i`、未用编辑器写回。

| 轮 | mutation（字节精确单行） | INJECT_EXIT | 红用例（点名） | SHA_BEFORE / SHA_AFTER（worktree 形态，LF） | 复跑 |
| --- | --- | --- | --- | --- | --- |
| r1 semver | `  return cmp > 0` → `  return cmp !== 0` | 0 | `× ★ 远端版本更低（降级）必须不提示【反测①目标用例】`、`× 预发布版低于同版本正式版…`（Tests 2 failed \| 39 passed） | `12fb8fbc…7866c8` / `12fb8fbc…7866c8` **相等** | `VITEST_GREEN_EXIT=0`，41/41 | 
| r2 同源 | `  if (parsed.host !== apiHost) {` → `  if (parsed.host !== parsed.host) {` | 0 | `× ★ 主机与 API 不同源的 .wgt 必须拒装【反测②目标用例】`（`https://evil.example/app-1.0.1.wgt: expected true to be false`）、`× 同源判定从运行时 API 基址解析主机…` | 同上，**相等** | 0，41/41 |
| r3 摘要（首轮） | `  return e === a` → `  return true` | **2 ⇒ 本轮 VOID** | 未跑测试：注入器回读 `AFTER_HIT=2`（原文 `isStrictAsciiUrl` 末尾本就有 `  return true`）⇒ 拒绝承认，另立 `anti/13`；文件已写入 mutation，**当场 `cp` 复原**，`SHA_NOW` 与 `SHA_BEFORE` 逐字节一致 | — | 见 r3 重试 |
| r3 摘要（重试） | `  return e === a` → `  return true // QODER24-ANTI-R3-MUTATED`（唯一化 + 注入器新增 `PREFLIGHT_AFTER_HIT=0` 预检） | 0 | `× ★ 实算与下发不一致必须拒装（改首/中/尾字节/改长度）【反测③目标用例】`、`× digestMatches 任一侧非法即 false…` | 同上，**相等** | 0，41/41 |
| r4 白名单 | `  return updateHostAllowlist(…).includes(host.toLowerCase())` → `  return true // QODER24-ANTI-R4-MUTATED` | 0 | `× ★ 未命中白名单的 updateUrl 禁止打开【反测④目标用例】`（`https://evil.example/download`）、`× ★ 未命中白名单的 updateUrl 不会进入 open-url 决策`（`expected 'open-url' to be 'none'`） | 同上，**相等** | 0，41/41 |

SHA 形态标注：`SHA_*` 为 `sha256sum` 对**工作树内文件**（该文件实测 LF，非 CRLF）；`GIT_BLOB_SHA_*` 为 `git hash-object`（LF blob 形态）`4c802a5d…531994`，两种形态**不跨比**（协议 §四.3）。四轮读数去重后 worktree 形态只有 1 个值 `12fb8fbc…7866c8`、blob 形态只有 1 个值 `4c802a5d…531994`，且都等于终端实算值与 `HEAD:` 入库 blob（机检见 `anti/17-void-r3-round-restore-chain.log` ②，`UNIQUE_WORKTREE_SHA_COUNT=1` / `UNIQUE_BLOB_SHA_COUNT=1` / `WORKTREE_VS_HEAD_DIFF_LINES=0`）；`anti/16-restore-and-final-state.log` 另证复原后 `git status` 只剩本卡自有未跟踪文档、`QODER24-ANTI` 标记 0 残留。

---

## 六、红线对照（逐条自证）

1. 未 push、未开 PR、未 `git add -A`：两次提交均逐文件 `git add`（`raw/40` 有 `git show --stat` 文件清单）。
2. `git diff bc1087ee..HEAD -- backend/` = **0 字节**（`raw/43` ⑤、`raw/45` ⑦，另有 `git status --porcelain -- backend/` 空）；后端 `app-version.service.ts:16-35` 的 `AppVersionRow` 无摘要字段这一事实只作只读取证（全字段清单 `raw/45` ②，`rg -in "package_sha256|packageSha256|sha256"` 在后端 platform 服务/控制器与 `docs/migrations/141_app_version.sql` **RC=1 零命中**，`raw/45` ①）。
3. 未放宽断言、无 `it.skip`、未改超时、无新增 `eslint-disable`、未吞异常换绿（`raw/43` 机检：`eslint-disable` 在两个新文件 + `update.ts` **RG_EXIT=1 零命中**；`it.skip|describe.skip|test.skip|.only(|xit(|xdescribe(` 全 `app-mobile/tests` **RG_EXIT=1 零命中**；四门脚本 / `.eslintrc.cjs` / `vitest.config.ts` 的 `git diff --numstat` **空输出**；本卡 spec 内 `timeout` 零命中 ⇒ 未加超时放宽）；lint 劣化是靠**改代码**（`prefer-const`）修的，未动任何基线数字（§二 末段 + `raw/42` 五段 IDENTICAL）。
4. 未把"构建通过"当"运行通过"：三构建只证明编译通过；**真机行为一律标未验**（§七）。
5. 实现先提交（`622f5894`），证据与文档随后落笔，工作树未留未提交状态。

---

## 七、未完成与阻塞（含"失败关闭"实际造成的功能影响）

**外部前置（禁止本单改后端）**

1. **后端 `LatestAppVersion` 无摘要字段 ⇒ 联调阻塞。** 事实：`backend/src/services/platform/app-version.service.ts:16-32`（`AppVersionRow`）无 `packageSha256`；`backend/src/controllers/platform/app-version.controller.ts:49/:100` 的 zod 只收 `packageUrl`；表结构 `docs/migrations/141_app_version.sql:9` 只有 `package_url VARCHAR(512)`，**无摘要列**。
   ⇒ 需要一张后端卡：加列（迁移）+ 服务读写 + 下发字段 + 总台「版本发布」录入/校验。**本单未做、也未声称可做。**
2. 在 1 补齐之前，**`.wgt` 自动直装通道是关闭的**（本单预期结果，非缺陷）：
   - App 端点"立即更新"后不再可能安装任何包 —— 决策层 `decideUpdateAction` 直接判定 `kind!=='wgt'`；
   - 实际功能影响 = **热更新（免重装 APK 的 wgt 增量更新）当前不可用**，用户会被引导到白名单下载页自行取新安装包（`updateUrl` 可用时），或只看到提示（`updateUrl` 也不可信时）；
   - 若某条发布记录只填了 `packageUrl`、没填 `updateUrl` ⇒ 表现为"提示发现新版本，但没有任何可点的动作"（`promptBlocked`，`update.ts:244`）。运营侧填表必须保证 `updateUrl` 指向 `www.onepan.cn`/`onepan.cn`/`m.onepan.cn`/API 主机之一，否则会看到这条提示。
   - 这条影响**只能由后端补摘要字段解除**；任何"先放宽校验让流程跑起来"的做法都在红线上（本单未做）。
3. **同一字段名要前后端对齐**：本单移动端读的键名是 `packageSha256`（驼峰，与 `packageUrl` 同族）。后端若定名不同（如 `packageSha` / `sha256`），移动端需一行跟进；属**契约裁量**，见 §十。

**未验（无设备 / 无浏览器 / 无真机，一律不写成通过）**

4. **未验：App 真机上 `plus.io.FileReader.readAsDataURL` 能否读回 `.wgt` 原始字节。** 该链路（`update.ts:112`）在无设备环境下不可跑；单测覆盖的是**字节进来之后**的全部判据（`dataUrlToBytes` + `verifyPackageBytes` 用 base64 样本与 Node crypto 对账）。若真机上该原生 API 不可用或 base64 形态不同 ⇒ 结论是 `deny`（不安装、删临时文件），**不会退化为直装**；这条失败关闭语义是设计保证，但仍需真机复核一次。
5. **未验：真机下载→校验→安装→重启全链路、`{ force: false }` 在 5+ Runtime 的实际拒绝行为**（同版本/降级包会被运行时拒装，这是我们要的方向，但没有设备无法取证）。
6. **未验：H5 运行期读数**（未启浏览器、未跑 dev:h5 + mock 后端）；本单只跑 `build:h5` EXIT=0。协议 §五 的 browser-use 读数**没有采**，因此不写任何 DOM/console/network 结论。
7. **未验：小程序端运行态**。事实面：`mp-weixin` 构建产物里根本没有可达的安装路径（`#ifdef APP-PLUS` 剥离），行为等价于"该端不更新"；未做小程序运行取证。
8. **未验：`VITE_UPDATE_HOSTS` 在真实 CI/.env 的注入链路**（只在单测里用 `vi.stubEnv` 验证了读取与非法条目丢弃）。
9. **未完成：H5 端 `packageUrl` 同源判定依赖 `window.location.origin`**；若站点将来部署在与 API 不同主机且 API 基址仍是相对 `/api`，`.wgt` 通道会继续关闭（H5 本就不装 wgt，无功能损失），但**这条口径需要负责人确认是否接受**。

---

## 八、风险与自我报备（含越面发现）

1. **性能风险（未压测）**：`crypto.ts` 的 SHA-256 是纯 JS 同步实现，且 `sha256()` 内部一次性构造填充后的整份副本（内存 ~2× 文件大小）。几十 MB 的 `.wgt` 在主线程同步摘要，App 端可能卡数秒；且现在**下载文件被完整解码成 base64 字符串再还原字节**（`readAsDataURL`），峰值内存约为文件 ~1.33×（base64）+ 2×（填充副本）。**未实测耗时**。可后续改为分块读（`File.slice` + 多次 `readAsDataURL`）或接线原生摘要——但那要新契约，本单未做。
2. **失败关闭的可见后果**：见 §七.2 —— 现在热更通道为关；如果集成侧把"提示但不装"当回归，请按本单口径判为**预期结果**。
3. **`.wgt` 必须与 API 同主机**（任务书 §二.2 原文要求"与 API 基址同源"）。若运营当前把包放在 OSS/CDN 域名（`api.onepan.cn` 之外），改造后会被拒装。仓库内**没有**任何证据说明 wgt 实际发布在哪个主机（`docs/部署文档.md:38-50` 只说"总台版本发布填下载地址/包地址"，未给主机）⇒ 这是**待裁问题**（§十.2），不是我能替凌舟定的。
4. **`force:true → force:false` 的行为差异**：若后端下发的 `versionName` 与 `plus.runtime.version` 同值但确有新包（例如同一版本号重发包），semver 闸与 `force:false` 会**双双拒装**。这是安全方向上的收紧，但发布流程必须保证版本号严格递增（`docs/部署文档.md:49` 已写"版本号递增"）。
5. **白名单含 `m.onepan.cn` 与 `onepan.cn`**：取自 `deploy/nginx-production.conf:85/:127`，属"至少覆盖 API 主机 + 官网下载主机"的最小自洽集合；域名轮换/新增必须同步改 `OFFICIAL_UPDATE_HOSTS(:391)` 这一处。
6. **env.ts 口径自洽**：我没有在 `config/env.ts` 写任何新硬编码；主机比对全走 `deriveApiHost`，白名单集中在 `update-security.ts`（`env.ts:7` 的"不得硬编码真实生产域名"警告面未扩大）。
7. **基线漂移（越面发现，只报备不动作）**：`git worktree list` 读数显示主检出 `main` 已在 `d5f56c0a`，而本批次共同基线是 `bc1087ee`。本单按协议钉在 `bc1087ee`，未 rebase、未追新；集成时若 main 已前进，`gates-baseline.json` 的 `tests` 段可能与别的卡冲突（本卡只写自己树实测 12/227 + 自己的 note 段）。
8. **`anti/13` 是一轮 VOID 记录，不是红测证据**：注入器缺陷（after 串与既有 `return true` 同形）被我自己的硬闸拦住，当场复原并核对 SHA；协议 §四.11 的"互斥读数一律作废另立 note"照做，原始日志未改写。
9. **未越权**：没有改 `.eslintrc.cjs`、`vitest.config.ts`、四门脚本、`package.json`、后端、admin-web、miniapp（改动面 5 个文件，`raw/41`）。

---

## 九、踩坑实录（本单新踩的，供后来者）

1. **反测 after 串必须全局唯一**：`return true` 这种"看起来无害"的 mutation 与文件里既有的 `  return true` 撞车，回读 `AFTER_HIT=2` ⇒ 首轮 r3 直接作废。修法有两半：注入器加 `PREFLIGHT_AFTER_HIT=0` 预检（写之前就拒），mutation 文本带 `// QODER24-ANTI-R3-MUTATED` 标记。注意注入器当前是**先写后回读**，回读不一致时文件已被改 ⇒ 驱动脚本必须保证 `cp` 备份在注入之前（`round.sh` 已是这个顺序）。
2. **`no-control-regex`（eslint:recommended，error 位）会咬 URL 校验正则**：`/[\s\\\u0000-\u001f]/` 这种"拒绝控制字符"的写法直接把 lint error 从 0 顶到 1（门 2 红）。改成逐字符 `charCodeAt` 比较（`isStrictAsciiUrl`）既零 lint 风险，又顺带拒掉非 ASCII（IDN/同形字）。
3. **`prefer-const` 也是冻结面**：`gates-baseline.json` 的 `lint.warningsByRule` 里**没有** `prefer-const` 这一项 ⇒ 一旦新文件出现 1 条，就是"当前 1 > 基线 0"直接红。新写 `let` 要当场确认是否会被重赋值。
4. **`{ ok: true } | { ok: false; reason: string }` 在模板串里取 `.reason` 会 TS2339**：条件表达式里只对三元的一侧有效，`${a.ok ? '为空' : a.reason}` 在另一条分支（`updateUrl === ''` 那个三元）里就没窄化过来 ⇒ vue-tsc 红。把 `Verdict` 定为两侧都有 `reason`（通过侧为 `''`）解决，比到处 `as` 干净。
5. **条件编译文件里的 `#ifdef` 分支不能用并列 `return`**：`uni-ifdef` 只影响产物，vue-tsc/eslint 看的是原文 ⇒ 并列双 `return` 会 `no-unreachable`。一律"默认值 + 按端覆盖 + 末尾单出口"（QODER-21 的同一口径，本单沿用）。
6. **单测环境是 H5 分支**：`vitest.config.ts` 的 shim 把 `#ifdef APP-PLUS` 整块剥掉 ⇒ 任何写在 APP 块里的判据都测不到。**判据必须放在条件编译之外的纯函数模块**，`update.ts` 只留接线，这是本单能四轮反测的前提。
7. **`sha256sum`（worktree）与 `git hash-object`（blob）不能互比**：本仓 `core.autocrlf=true`，新文件写入是 LF、`git add` 时打印 "LF will be replaced by CRLF the next time"；两套读数在同一轮里各自相等即可，跨形态比较是错的（协议 §四.3 的坑，本单实测复现了一次警告行）。

---

## 十、复现命令 + 待裁问题 + 建议派单

**复现（工作树根，串行跑，勿与编辑重叠）**

```bash
cd /d/Users/ZXQL/wt-agents/QODER-24
git rev-parse HEAD                                       # 622f5894…（实现笔）
npm --workspace app-mobile run check:gates               # CHECK_GATES_EXIT=0（type 0=0 / error 0 warning 12872 / 12 文件 227 用例 / 差集1 豁免1）
for p in h5 mp-weixin app; do npm --workspace app-mobile run build:$p; echo "BUILD_EXIT_$p=$?"; done   # 0 0 0
bash /d/Users/ZXQL/wt-agents/_qoder24_bak/round.sh r1    # 反测①（r2/r3/r4 同）
git diff bc1087ee..HEAD -- backend/ | wc -c              # 0
git status --porcelain                                   # 空
```

**待裁（要负责人定的，我不自裁）**

1. 后端摘要字段的**键名与来源**（`packageSha256` 驼峰？发布时人工填还是构建产物机算入库？是否同时下发 `packageSize` 做二次兜底？）。
2. `.wgt` 包**实际发布主机**：是否就在 API 主机上？若在 OSS/CDN，任务书"与 API 基址同源"这条要不要改判为"与集中配置的包主机白名单同源"（改判只需动 `validatePackageUrl(:298)` 的主机来源，架构已留口）。
3. 通道关闭期间的**运营口径**：是否接受"提示发现新版本但无可点动作"的表现（§七.2），还是要求总台在缺摘要时禁止发布。

**建议派单**

- **BACK-QODER-25（示例）**：后端 `t_app_version` 加 `package_sha256 CHAR(64)` + 服务/控制器/下发字段 + 总台发布页校验（必填、64 hex），并给出 wgt 构建→摘要入库的产物链（本卡 §七.1 的三处行号可作入口）。
- **MO-QODER-24B**：真机跑一次"下载→`readAsDataURL`→实算→拒装删文件 / 通过安装"的两条路径取证（含 §八.1 的耗时读数），补本卡 §七.4/§七.5 的未验面。
- **OPS**：`deploy/nginx-production.conf` 与 `OFFICIAL_UPDATE_HOSTS` 的主机清单一致性巡检（域名轮换时两处同步）。
