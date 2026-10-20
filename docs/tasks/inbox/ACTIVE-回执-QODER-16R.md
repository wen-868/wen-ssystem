# ACTIVE-回执 · QODER-16R（隐私权限交付重栈到常驻门禁）

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方，子代理）｜日期：2026-10-21｜对应派单：QODER-16R
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-16`｜分支：`fix/qoder-16r-permissions-restack`｜基线：`dfeedbc0`
> 详版见 `docs/tasks/cards/R101-QODER-16R-回传.md`（十项）。以下读数均为**执行方自评**，不构成验收结论。

## 做了什么

1. 保留 QODER-16 的 8 个权限断言用例（`app-mobile/tests/mobile-permissions.spec.ts`，本轮零改动），在**常驻 `npm run test`**（test-gate.mjs ⇒ 仓内 vitest）下重新跑绿：`✓ mobile-permissions (8 tests)`，全量 **6 文件 / 64 用例**，与上一轮借入 harness 的 8/8 读数一致。本轮**未借入、未删除任何 harness**。
2. `app-mobile/scripts/gates-baseline.json` **只动 `tests` 段**：5/56 → **6/64**（实测 = 卡 §二.3 目标，无差异需报备），note 追加 QODER-16R 留痕；lint/typeCheck/checkContract/contractDrift 四段逐字节未动。
3. 产物取证在新基线重跑：`build:h5` EXIT=0、`build:mp-weixin` EXIT=0、`build:app`（可选）EXIT=0；产物 `dist/build/mp-weixin/app.json` 实读 `permission["scope.record"].desc` 原文在场、`requiredPrivateInfos = []`；App 产物 `manifest.json` 六键 iOS 隐私描述原文在场（`apple.privacyDescription` 节点）。
4. 反测一条（协议 §4）：scratch `.mjs` 字节精确删除 `NSBluetoothAlwaysUsageDescription` 整行 ⇒ 常驻 test 门红 EXIT=1 点名两处（缺键 AssertionError + spec:111 TypeError）⇒ `cp` 复原 SHA256 与改前逐字节一致（`f551ca55…604e5fe`）⇒ 复跑 6/64 绿。未用 `sed -i`、未用 Edit 删功能行。
5. 交付面零业务改动：`src/manifest.json`、`src/pages.json`、spec 本体、appid/支付/推送/SDK/插件均维持 rebase 笔 `6b6fb197` 内容；旧证据 `docs/evidence/qoder-16/**` 原样保留，新读数全部另存 `docs/evidence/qoder-16r/**`。

## 判据自评

- type-check：EXIT=0（0 = 0）。lint：EXIT=0（error 20/20、warning 12872/12872，逐规则不劣化）。test：EXIT=0（6 文件/64 用例 = 新基线）。contract：EXIT=0（差集 1/具名豁免 1）。四门与负责人同基线参考读数逐项一致。
- 收尾自检：`git status --porcelain` 空；`git diff dfeedbc0..HEAD -- backend/` = 0；`app-mobile/src` 差集只含 `manifest.json`；本卡改动面 = 卡点名文件（gates-baseline.json + docs/evidence + 回传卡 + 回执），不多一个。

## 未验清单（继续如实标未验）

- iOS 真机隐私弹窗：未验（无设备/签名链路；产物侧证≠运行期行为）。
- 微信开发者工具运行：未验（本机无工具授权链路）。
- 小程序后台「用户隐私保护指引」口径：未验（需人工登录后台核对）。
- 复现命令见回传卡 §⑨ 与 `docs/evidence/qoder-16r/raw/30-unverified-registration.txt`。

## 自我报备

- 反测比对脚本首版 hash 提取写错（head -1 取到命令行）造成 `SHA_MATCH=NO` 假象并中断一次流程；双行 sha256sum 实际相同，修正提取后重写 02 件，红/绿读数不受影响，已在 `anti/loop1-drop-ios-key/04-walkthrough.txt` 勘误留痕。

```
===DSH-RECEIPT-BEGIN===
id: QODER-16R
status: DONE
summary: QODER-16 交付重栈到常驻门禁：8 权限用例在常驻 npm run test 下 6 文件/64 用例跑绿（与借入 harness 读数一致）；gates-baseline.json 仅 tests 段 5/56→6/64（实测=卡目标）并 note 留痕；build:h5/build:mp-weixin/build:app 均 EXIT=0，产物 app.json permission[scope.record].desc 与 requiredPrivateInfos=[] 读数保持、App 产物六键 iOS 隐私描述在场；反测删 NSBluetoothAlwaysUsageDescription 整门红点名（EXIT=1）⇒cp 复原 SHA256 f551ca55 逐字节一致⇒复跑 6/64 绿；业务源码零改动，旧证据 qoder-16 原样保留，新读数另存 qoder-16r。真机/微信开发者工具/小程序后台三项继续标未验。
worktree: D:\Users\ZXQL\wt-agents\QODER-16
branch: fix/qoder-16r-permissions-restack
commits: 9b12c4ba(impl：gates-baseline tests 6/64)；docs 笔=本卡+回执+证据（最新一笔，哈希不自指，git log -1 可查）；其下为 rebase 带来的 QODER-16 三笔 6b6fb197/67546800/f4260a90
evidence: docs/evidence/qoder-16r/README.md, docs/evidence/qoder-16r/raw/01-type-check.log, raw/02-lint.log, raw/03a-test-before-baseline.log, raw/03b-test-after-baseline.log, raw/04-check-contract.log, raw/05-build-h5.log, raw/06-build-mp-weixin.log, raw/07-mpweixin-appjson-readback.log, raw/08-build-app.log, raw/09-app-product-privacyDescription-readback.log, raw/10-config-json-and-lengths.log, raw/11-pagesjson-no-dead-config.log, raw/20-final-gate-sweep.log, raw/21-final-selfcheck.log, raw/30-unverified-registration.txt, docs/evidence/qoder-16r/anti/loop1-drop-ios-key/{00-pre-sha256,01a-inject,01-target-red,02-restore-sha256,03-restore-green,04-walkthrough}.txt
return_card: docs/tasks/cards/R101-QODER-16R-回传.md
gates: type-check(npm run) => EXIT=0 0=0；lint(npm run) => EXIT=0 error 20/20 warning 12872/12872 逐规则不劣化；test(npm run) => EXIT=0 6 文件/64 用例（改基线前基线 5/56 亦绿并留痕）；check:contract(npm run) => EXIT=0 差集1/豁免1；build:h5 => EXIT=0；build:mp-weixin => EXIT=0 且产物 app.json permission[scope.record].desc 在场、requiredPrivateInfos=[]；build:app(可选) => EXIT=0 且产物 apple.privacyDescription 六键原文；反测(删 NSBluetoothAlwaysUsageDescription) => npm run test EXIT=1 点名「缺少 NSBluetoothAlwaysUsageDescription」+spec:111 => cp 复原 SHA256 一致(f551ca55…604e5fe) => 复跑 EXIT=0 6/64
redlines: 遵守（未 push/未开 PR/未 git add -A，逐文件 add；未改 appid·支付·推送·SDK·插件·package.json·pages.json·src/manifest.json·任务书原件·ACTIVE.md；未 npm install；未借入/删除 harness；只动 QODER-16 工作树与授权 scratch；旧证据 qoder-16 零改写；本分支累计新增 2 笔 ≤3）
===DSH-RECEIPT-END===
```
