# R101 · QODER-16R 回传 · 隐私权限交付重栈到常驻门禁

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方，子代理）｜日期：2026-10-21
> 对应派单编号：QODER-16R（`docs/tasks/inbox/QODER-16R-permissions-restack.md`，原件未改动）
> 以下所有"读数/判据"均为**执行方自评**，不构成验收结论。

## ① 基线与提交

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-16`，分支 `fix/qoder-16r-permissions-restack`。
- 代码基线 `dfeedbc0`（#368 合并后的 main）；`origin/main` = `21b465e5`。
- 开工 HEAD：`f4260a90`（旧 3 笔 rebase 到新基线后的哈希链：`6b6fb197` 实现 → `67546800` docs → `f4260a90` docs 勘误）。
- 本卡新增 2 笔：`9b12c4ba`（实现笔：仅 `app-mobile/scripts/gates-baseline.json` tests 段）+ docs 笔（本卡 + 回执 + `docs/evidence/qoder-16r/**`，即分支最新一笔，哈希不在本卡内自指，`git log -1` 可查）。
- 终态 `git log --oneline origin/main..HEAD` 共 5 笔；`git status --porcelain` 空（docs 笔提交后）。

## ② 修法 × 读数总表

| 项 | 动作 | 读数（常驻门） |
|---|---|---|
| type-check | 未改码，直接复跑 | `npm run type-check` EXIT=0，vue-tsc 0 条 = 基线 0 条 |
| lint | 未改码，直接复跑 | `npm run lint` EXIT=0，error 20/20、warning 12872/12872，逐规则不劣化 |
| test | 8 用例接常驻 vitest + 基线 5/56→6/64 | `npm run test` 实测 **6 文件 / 64 用例**，EXIT=0（改基线前 03a、改后 03b 两次留痕） |
| contract | 未改码，直接复跑 | `npm run check:contract` EXIT=0，差集 1 / 具名豁免 1 |
| build:h5 | 产物取证 | EXIT=0（raw/05） |
| build:mp-weixin | 产物取证 | EXIT=0；产物 `app.json` 实读 `permission["scope.record"].desc` 原文在场、`requiredPrivateInfos = []`（raw/06/07） |
| build:app（可选） | iOS 六键产物侧证 | EXIT=0；产物 `manifest.json` `plus.distribute.apple.privacyDescription` 六键原文（raw/08/09） |
| 反测 | 删 `NSBluetoothAlwaysUsageDescription` | 红 EXIT=1 点名 ⇒ cp 复原 SHA256 逐字节一致 ⇒ 复跑 6/64 绿（anti/loop1） |

## ③ 逐条实现说明

1. **保留 8 个权限断言用例，接常驻 vitest**：`app-mobile/tests/mobile-permissions.spec.ts`（rebase 笔 `6b6fb197` 已带上新基线）在本轮**未改一个字节**，由常驻 `npm run test`（`scripts/test-gate.mjs` ⇒ 仓内 `node_modules/vitest`）跑绿：`✓ tests/mobile-permissions.spec.ts (8 tests)`，与上一轮借入 harness 的 8/8 同一读数。未借入、未删除任何 harness。
2. **gates-baseline.json 只动 `tests`**：`testFiles 5→6`、`testCount 56→64`（= 实测，与卡 §二.3 目标 6/64 一致），`note` 追加「QODER-16R（2026-10-21，Qoder（移动端执行方））…5/56 → 6/64（卡 §二.3 目标 6/64 = 实测，留痕）」。`typeCheck`/`lint`/`checkContract`/`contractDrift` 四段与 `_comment` 逐字节未动（diff 全文见 raw/21 末段，1 文件 3 增 3 删）。
3. **交付内容锚点复核**（raw/10）：`src/manifest.json` 六键 desc 长度 47–62（62/47/49/56/56/55）；`scope.record.desc` 45 字；`requiredPrivateInfos = []`；appid `__UNI__E395BAE` / `wx3ea76428aa15cec7` 基线值未动。**本卡对 `src/manifest.json`、`src/pages.json` 零改动**（pages.json：`grep mp-weixin` 0 命中、`git diff dfeedbc0..HEAD` 空，raw/11）。
4. **生效机制口径沿用**（卡 §一 裁定，未推翻）：`@dcloudio/uni-cli-shared/dist/json/mp/pages.js:129-133` 顶层只透传 `preloadRule|workers|plugins|entryPagePath`；`mergeMiniProgramAppJson`（:33-45）把 manifest 的 `mp-weixin` 逐键并入产物 app.json，`permission`/`requiredPrivateInfos` 不在排除表 ⇒ 落点维持 `src/manifest.json`，未向 pages.json 补死配置。
5. **旧证据零改写**：`docs/evidence/qoder-16/**` 原样保留（raw/21 的 PROBE B 段仍由 `raw/21b-probe-b-invalid.note.txt` 具名隔离）；本轮全部读数另存 `docs/evidence/qoder-16r/**` 新文件号。

## ④ 测试 / 门读数

- 四门终态复跑（raw/20-final-gate-sweep.log）：type-check EXIT=0（0=0）、lint EXIT=0（20/12872 = 基线）、test EXIT=0（6 文件/64 用例 = 基线 6/64）、check:contract EXIT=0（差集 1/豁免 1）。与同基线参考读数（负责人 `_scratch/qoder-restack-gatecheck` 实测）逐项一致。
- 用例分布：mobile-permissions 8 + permission-view-state 29 + entry-gate-consistency 12 + permission-codes 8 + storage-crypto 4 + api-base-env 3 = 64。
- 反测（协议 §4 单命令原子流）：改前 SHA256 `f551ca55…604e5fe` ⇒ scratch `.mjs`（工作树外，latin1 字节精确、命中≠1 即 exit 9）删整行 5777→5552 字节 ⇒ `npm run test` 红 EXIT=1，点名「AssertionError: 缺少 NSBluetoothAlwaysUsageDescription」+「TypeError … spec.ts:111」，Test Files 1 failed | 5 passed ⇒ `cp` 复原 ⇒ SHA256 与改前逐字节一致 ⇒ 复跑 EXIT=0（6/64）。全程未用 `sed -i`、未用 Edit 删功能行。

## ⑤ 口径偏差报备

- **无目标偏差**：实测 6 文件/64 用例 = 卡 §二.3 目标 `6/64`（main 5/56 与本单 8 用例无重叠变化），基线按实写。
- 与上一轮借入 harness 的口径差异：上轮分支基线 `321b4f6b` 无常驻门，harness 借入后删除，test 门口径为"单 spec 8/8、链上 56 用例未声称对齐"；本轮基线常驻门直接扫 `tests/**/*.spec.ts` 全部 6 文件，口径为总数 64。同一 spec 两次读数一致（8/8），不构成劣化。
- 反测比对脚本首版 hash 提取逻辑写错（`head -1` 取到命令行）导致 `SHA_MATCH=NO` 假象并中断流程；两行 sha256sum 实际相同，已修正提取逻辑重写 `02-restore-sha256.txt`，文件内 pre/now 双值可核，勘误已写入 `04-walkthrough.txt`。红/绿两份 vitest 输出未受影响。

## ⑥ 红线对照

- 未 push、未开 PR、未 `git add -A`（两笔均逐文件 add）。
- 未改 appid、支付、推送、SDK、插件配置；未改任何 `package.json`/lockfile；未 npm install。
- 未改 `pages.json`、未改 `src/manifest.json`、未改 8 用例 spec、未改任务书原件与 `docs/tasks/inbox/ACTIVE.md`。
- 只动 `D:\Users\ZXQL\wt-agents\QODER-16`；主仓与其它 wt-agents 未写入（scratch 脚本按其卡内授权放 `D:\Users\ZXQL\wt-agents\_scratch\qoder-16r\`，不入库）。
- 本卡署名执行方自评，不含任何「凌舟裁定/验收结论」表述；卡 §一 裁定为引用任务书原文。

## ⑦ 未完成与阻塞

- 无（卡内动作 1–4 与验收判据全部闭环）。

## ⑧ 自我报备与风险

- 未验三项如实维持「未验」：iOS 真机弹窗、微信开发者工具运行、小程序后台隐私协议口径（原因与复现命令见 `raw/30-unverified-registration.txt`）。产物在场 ≠ 运行期行为已证。
- 上一轮遗留待裁项不在本卡范围：`NSLocationWhenInUseUsageDescription` 与"代码 0 定位调用"的张力（8 用例照锁现值），未动。
- 构建日志含 uni-app 新版本提示与 `hd-scan.svg` 运行时解析警告、custom-tab-bar 平台警告——均为既有噪音，非本卡引入，未处置。
- `dist/**` 与 `_scratch` 注入器/备份不入库（`.gitignore` 覆盖 dist；scratch 本在工作树外）。

## ⑨ 复现命令

```bash
cd D:/Users/ZXQL/wt-agents/QODER-16/app-mobile
npm run type-check && npm run lint && npm run test && npm run check:contract
npm run build:h5 && npm run build:mp-weixin && npm run build:app
node -e "const j=require('./dist/build/mp-weixin/app.json');console.log(JSON.stringify(j.permission),JSON.stringify(j.requiredPrivateInfos))"
# 反测复跑：见 docs/evidence/qoder-16r/anti/loop1-drop-ios-key/04-walkthrough.txt
```

## ⑩ 对下一单的建议

- 11R/13 等后续重栈卡同样只跑常驻 `npm run <gate>`；若新增用例，基线 `tests` 段实测即基线、note 留痕即可，四段其余读数勿动。
- 反测脚本里的 `sha256sum` 输出提取建议固定用 `grep -oE '[0-9a-f]{64}' | head -1`（本次 `head -1` 整行提取踩坑）。
- iOS 定位键的裁量（⑧ 第二条）若负责人裁定保留，建议在下轮卡把"requiredPrivateInfos 空表 + NSLocation 键在场"的组合口径写进验收判据，防止被误读为矛盾。
