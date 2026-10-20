# ACTIVE-回执 · QODER-16（iOS 隐私描述 + 小程序录音授权）

> 执行方：Qoder（移动端）子代理｜日期：2026-10-21｜对应派单：QODER-16
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-16`｜分支：`fix/qoder-16-mobile-permissions`｜基线：`321b4f6b`
> 详版见 `docs/tasks/cards/R101-QODER-16-回传.md`（十项）。以下读数均为**执行方自评**，不构成验收结论。

## 做了什么

1. `app-mobile/src/manifest.json` → `app-plus.distribute.ios.privacyDescription` 新增六键真实用途中文描述（扫码+拍摄小票 / AI 语音输入录音 / 相册选图上传 / 门店定位 / 蓝牙热敏打印小票 / 语音转写），逐条绑定 `文件:行号` 代码证据，文案避开「用于XX功能」式空话。
2. 同文件 → `mp-weixin.permission["scope.record"].desc` 补录音授权中文说明；`mp-weixin.requiredPrivateInfos` 登记为 `[]`。
3. **关键偏差**：任务书 §二.2 点名 `src/pages.json`，但经构建产物取证，pages.json 顶层 `mp-weixin` **不进产物 app.json**（`uni-cli-shared/dist/json/mp/pages.js:129-133` 只透传 `preloadRule|workers|plugins|entryPagePath`），而 manifest 的 `mp-weixin` 节点会被 `mergeMiniProgramAppJson`（同文件 :33-45）逐键并入 app.json。故生效配置落在 `src/manifest.json`，`pages.json` **零改动**。两轮探针的产物实读见 `raw/21`（探针 A，有效）、`raw/22`（探针 B，manifest 侧唯一采信）、`raw/23`；`raw/21` 自带的 PROBE B 段（「探针未出现 ⇒ manifest 路由也不生效」）**作废**——该段无注入确认行与回读校验，且与 `raw/22` 互斥，详见 `raw/21b-probe-b-invalid.note.txt`（原文逐字节未改）。此作废**不改变**靶点结论：探针 A + `raw/22` + 产物 `raw/23` + 框架源码四处独立支撑。
4. 新增 `app-mobile/tests/mobile-permissions.spec.ts`（8 用例）：两份 JSON `JSON.parse` / 六键齐备非空非空话 / 描述与功能逐条对应 / `scope.record.desc` 非空 / `requiredPrivateInfos` 每项必须落在「代码实际使用清单」白名单 / 防 `startRecord` 误登记 / pages.json 死配置守卫 / appid·支付·推送·SDK·插件基线值锁定。
5. `requiredPrivateInfos` 未整表照抄：8 项合法（地理位置）接口在 `app-mobile/src` 全量 grep **命中数全为 0**（`raw/30`），故登记空表。代码实际用到的 `chooseImage` / `scanCode` / `getRecorderManager` 不属于该合法表，已由 `permission` 与 iOS 描述管辖。

## 判据自评

- `JSON.parse` 两份配置：PASS / EXIT=0。
- type-check（vue-tsc，借入 harness）：基线 0 错 → 修后 0 错，两次 EXIT=0。
- test：**基线无既有用例（`tests/` 不存在）⇒ 本单新增 1 文件 / 8 用例全过，EXIT=0**（未对齐链上 56 用例，不声称）。
- lint（同 harness 改前/改后全仓逐规则）：files 190 / error 20 / warning 12880 / `vue/html-indent` 12299 —— 改后**逐规则完全相同**，不劣化；EXIT=1=1（20 条既有 error，非本单引入）。
- `build:h5`：EXIT=0。另（取证用）`build:mp-weixin` EXIT=0、`build:app` EXIT=0。

## 反测（门必须能红）

- loop1 删 `NSBluetoothAlwaysUsageDescription` ⇒ 门 EXIT=1，点名「缺少 NSBluetoothAlwaysUsageDescription: expected undefined to be type of 'string'」⇒ `cp` 复原 SHA256 `f551ca55…` 逐字节一致 ⇒ 复跑 EXIT=0 / 8 passed。
- loop2 `requiredPrivateInfos` 塞入代码未用的 `getLocation` ⇒ 门 EXIT=1，点名「登记了代码中未使用的隐私接口：getLocation」⇒ 复原 SHA256 一致 ⇒ 复跑 EXIT=0 / 8 passed。
- 两轮各在单条 bash 命令内走完（注入器 latin1 字节读写、命中数≠1 即 `exit 9`）；未用 `sed -i`。首轮 loop1 因相对路径混用导致「复原后复跑」实际未执行、读数作废，已用绝对路径重跑，证据为重跑版本。

## 根 manifest 结论

`app-mobile/manifest.json`（根）与 `src/manifest.json` 基线 SHA256 相同（`629c732f…`），但**根文件不被构建读取**：移走根文件重建 `build:mp-weixin` ⇒ 产物 `app.json` 与 `project.config.json` 的 SHA256 与基线**逐字节相同**；移走 `src/manifest.json` ⇒ 构建 EXIT=1，ENOENT 路径正是 `…\app-mobile\src\manifest.json`。故按任务书 §二.3 只改 `src/`。另：根 `pages.json` 不存在，双份之坑仅命中 `manifest.json`。

## 偏差与未验

- 偏差：`scope.record`/`requiredPrivateInfos` 落点由 pages.json 改判为 manifest.json（上述取证）；若按字面判据验收会不通过，可退回照办。
- 偏差：基线无 test/lint/type-check 设施与 `gates-baseline.json`，全部走协议 §2 借入 harness（`git show 9fd90257:app-mobile/vitest.config.ts|.eslintrc.cjs`），**借入件未提交、已删除**；未新增 npm 脚本、未改任何 `package.json` ⇒ 这四道门在本分支仍无常驻执行入口。
- 未验：无 iOS 设备/Mac/签名 ⇒ 苹果审核口径未验；未用微信开发者工具与真机预览 ⇒ 录音授权弹窗未验；微信公众平台「隐私接口/用户隐私保护指引」需人工同步且须与 `desc` 逐字一致 ⇒ 未验；`build:app` 仅到编译产物，Info.plist 与云/离线打包未验。
- 待裁：`NSLocationWhenInUseUsageDescription` 按任务书点名补齐，但代码中无任何定位 API 调用（8/8 命中 0），描述与实现存在张力——已刻意不镜像进 `requiredPrivateInfos`，是否保留该键请裁定。

```
===DSH-RECEIPT-BEGIN===
id: QODER-16
status: DONE
summary: src/manifest.json 补 iOS privacyDescription 六键真实用途中文描述 + mp-weixin.permission[scope.record].desc，requiredPrivateInfos 按 8 项合法接口 grep 全 0 命中登记为 []（不照抄）；新增 1 文件/8 用例 JSON 权限断言门；两轮反测（删 NSBluetooth 键、塞入未用 getLocation）均红并点名、cp 复原 SHA256 f551ca55 逐字节一致、复跑 8/8 绿；type-check 0=0、lint 逐规则 190/20/12880 不劣化、build:h5 EXIT=0。关键偏差：经 build:mp-weixin 产物取证，任务书点名的 src/pages.json 顶层 mp-weixin 不进产物 app.json，生效落点为 src/manifest.json，pages.json 零改动；根 app-mobile/manifest.json 经移走-重建对照证明不被构建读取。真机/开发者工具/微信后台隐私协议三项未验。
worktree: D:\Users\ZXQL\wt-agents\QODER-16
branch: fix/qoder-16-mobile-permissions
commits: 3a69aa3c(impl)；ca07d9de(docs：本卡+回执+证据)；最新一笔=证据勘误（raw/21 PROBE B 作废说明 + 卡 §五①/README/回执指向，写本行时该笔哈希不可知）
evidence: docs/evidence/qoder-16/README.md, docs/evidence/qoder-16/raw/00-final-gate-sweep.txt, docs/evidence/qoder-16/raw/05-json-parse-check.txt, docs/evidence/qoder-16/raw/10-typecheck-baseline.txt, docs/evidence/qoder-16/raw/11-typecheck-after.txt, docs/evidence/qoder-16/raw/12-lint-baseline-summary.txt, docs/evidence/qoder-16/raw/12b-lint-run-exits.txt, docs/evidence/qoder-16/raw/13-lint-after-summary.txt, docs/evidence/qoder-16/raw/14-vitest-after.txt, docs/evidence/qoder-16/raw/15-build-mpweixin-baseline.txt, docs/evidence/qoder-16/raw/16-build-mpweixin-after.txt, docs/evidence/qoder-16/raw/17-build-h5-after.txt, docs/evidence/qoder-16/raw/18-build-app-after.txt, docs/evidence/qoder-16/raw/20-manifest-provenance-root-vs-src.txt, docs/evidence/qoder-16/raw/21-route-probe-pagesjson-vs-manifest.txt, docs/evidence/qoder-16/raw/21b-probe-b-invalid.note.txt, docs/evidence/qoder-16/raw/22-route-probe-manifest-only.txt, docs/evidence/qoder-16/raw/23-mp-product-appjson-after.txt, docs/evidence/qoder-16/raw/24-app-product-privacyDescription-excerpt.txt, docs/evidence/qoder-16/raw/25-field-diff-proof-only-added.txt, docs/evidence/qoder-16/raw/30-privacy-api-grep-evidence.txt, docs/evidence/qoder-16/raw/40-git-diff-manifest.txt, docs/evidence/qoder-16/anti/loop1-drop-ios-key/00-pre-sha256.txt, docs/evidence/qoder-16/anti/loop1-drop-ios-key/01-target-red.txt, docs/evidence/qoder-16/anti/loop1-drop-ios-key/02-restore-sha256.txt, docs/evidence/qoder-16/anti/loop1-drop-ios-key/03-restore-green.txt, docs/evidence/qoder-16/anti/loop1-drop-ios-key/04-walkthrough.txt, docs/evidence/qoder-16/anti/loop2-unused-private-info/00-pre-sha256.txt, docs/evidence/qoder-16/anti/loop2-unused-private-info/01-target-red.txt, docs/evidence/qoder-16/anti/loop2-unused-private-info/02-restore-sha256.txt, docs/evidence/qoder-16/anti/loop2-unused-private-info/03-restore-green.txt, docs/evidence/qoder-16/anti/loop2-unused-private-info/04-walkthrough.txt
return_card: docs/tasks/cards/R101-QODER-16-回传.md
gates: JSON.parse 两份配置 => PASS EXIT=0；type-check(vue-tsc) => 基线 0 错 / 修后 0 错 EXIT=0=EXIT=0；test(vitest) => 基线既有用例 0，本单新增 1 文件 8 用例全过 EXIT=0；lint(eslint src --ext .ts,.vue) => 改前 files=190 error=20 warning=12880 html-indent=12299 / 改后逐规则相同 不劣化 EXIT=1=1；build:h5 => EXIT=0；build:mp-weixin(取证) => EXIT=0 且产物 app.json 含 permission[scope.record].desc 与 requiredPrivateInfos=[]；build:app(取证) => EXIT=0 且产物 manifest.json 含 apple.privacyDescription 六键原文；反测1(删 iOS 键) => EXIT=1 点名 => cp 复原 SHA256 一致 => EXIT=0 8/8；反测2(塞未用隐私接口) => EXIT=1 点名 => cp 复原 SHA256 一致 => EXIT=0 8/8；逐字段 diff => changed=0 removed=0 added=3（只增不改成立）
redlines: 遵守（未 push / 未开 PR / 未 git add -A，逐文件 add；未动 appid·支付·推送·SDK·插件·package.json；未动主仓与其它工作树；根 app-mobile/manifest.json 未改；借入 harness app-mobile/vitest.config.ts 与 .eslintrc.cjs 已删除且未提交；dist 与 scratch 不入库；本地提交 3 笔 ≤3，第三笔仅动 docs 证据勘误）
===DSH-RECEIPT-END===
```
