# R101-QODER-16 回传 · iOS 隐私描述 + 小程序录音授权

> 汇报对象：凌舟（派单人）
> 汇报人：Qoder（移动端执行子代理）
> 日期：2026-10-21
> 对应派单编号：QODER-16（任务书 `docs/tasks/inbox/QODER-16-mobile-permissions.md`）
> ⚠️ 本文全部读数均为**执行方自评**，不构成验收结论。

## 〇 基线与提交

| 项 | 值 |
|---|---|
| 工作树 | `D:\Users\ZXQL\wt-agents\QODER-16` |
| 分支 | `fix/qoder-16-mobile-permissions` |
| 基线 | `321b4f6b`（= 本地 `origin/main`） |
| 实现笔 | `3a69aa3c` `fix: QODER-16 补 iOS 六键隐私描述与小程序录音授权并新增 JSON 权限断言用例`（2 文件：`app-mobile/src/manifest.json` +16/−2、`app-mobile/tests/mobile-permissions.spec.ts` 新增 165 行） |
| docs 笔 | `ca07d9de` `docs: QODER-16 回传卡、回执与证据（iOS 隐私六键 + 小程序录音授权取证）`（本卡 + 回执 + `docs/evidence/qoder-16/`；写卡当时哈希不可知，交付后回填） |
| 证据勘误笔 | 本卡 §五① 勘误对应的最新一笔（`docs: QODER-16 证据探针 B 作废说明与指向 raw/22`；写本行时该笔哈希不可知，如实标注） |
| 提交笔数 | 3（≤3 上限，含证据勘误笔）｜未 push、未开 PR |

## 一 修法 × 读数总表

| # | 任务书条目 | 我改了什么 | 关键读数 | 证据文件号 |
|---|---|---|---|---|
| 1 | §二.1 iOS `privacyDescription` 六键 | `src/manifest.json` → `app-plus.distribute.ios` 下新增 `privacyDescription`，六键齐备、逐条真实用途中文 | `build:app` 产物 `manifest.json` 中 `apple.privacyDescription` 六键原文可见（`ios` 被归一为 `apple`） | `raw/24`、`raw/18` |
| 2 | §二.2 `scope.record` 中文说明 | **落在 `src/manifest.json` 的 `mp-weixin.permission`（非 pages.json，见 §五① 取证）** | `build:mp-weixin` 产物 `app.json` 顶层 `permission={"scope.record":{"desc":"…"}}` | `raw/23`、`raw/16`、`raw/22` |
| 3 | §二.2 `requiredPrivateInfos` 只登记实际使用 | 登记为 `[]`（空表）——8 项合法接口在 `app-mobile/src` **全部 0 命中** | grep 8/8 命中数=0；产物 `app.json` 含 `requiredPrivateInfos=[]` | `raw/30`、`raw/23` |
| 4 | §二.3 根 manifest 是否仍被构建使用 | 结论：**根 `app-mobile/manifest.json` 不被构建读取**，只改 `src/` | 移走根文件重建：产物两文件 SHA 与基线**逐字节相同**；移走 `src/manifest.json`：构建 EXIT=1 且 ENOENT 路径正是 `src\manifest.json` | `raw/20` |
| 5 | §二.4 appid/支付/推送/SDK/插件不动 | 零改动，并新增用例锁定基线取值 | 逐字段自证 changed=0 / removed=0 / added=3 | `raw/25`、`raw/40` |
| 6 | §三 新增 JSON 权限断言测试 | 新增 `app-mobile/tests/mobile-permissions.spec.ts`，8 用例 | 1 文件 / 8 用例全过，EXIT=0 | `raw/14`、`raw/00` |
| 7 | §三 反测 | 两轮（删 iOS 键 / 塞未用隐私接口） | 两轮均 EXIT=1 点名 ⇒ `cp` 复原 SHA256 逐字节一致 ⇒ 复跑 EXIT=0 | `anti/loop1/*`、`anti/loop2/*` |

**四门自评读数（终态，`raw/00-final-gate-sweep.txt`）**：type-check `EXIT=0` / 0 错（基线 0）；test `EXIT=0` / 8 passed；lint `EXIT=1`（基线同值 20 既有 error）files=190 error=20 warning=12880 与基线逐规则相同；`build:h5` `EXIT=0`。另 `build:mp-weixin` `EXIT=0`、`build:app` `EXIT=0`（取证用）。

## 二 判据自评（任务书逐条 + 原始输出文件号）

| 任务书 §三 判据 | 自评 | 实际命令 | 读数 | 证据 |
|---|---|---|---|---|
| 「字段缺失或描述为空必须红」 | **达成**（经反测证明，非推断） | `node ../node_modules/vitest/vitest.mjs run` | 删键 ⇒ EXIT=1，点名 `缺少 NSBluetoothAlwaysUsageDescription: expected undefined to be type of 'string'`，2 failed/6 passed | `anti/loop1-drop-ios-key/01-target-red.txt` |
| 「JSON.parse 两份配置文件通过」 | **达成** | `node -e "JSON.parse(readFileSync(…))"` 两份 | `PASS` ×2，EXIT=0；manifest topKeys 11 项、pages topKeys 5 项 | `raw/05-json-parse-check.txt` |
| 「反测删任一描述后必红，复原 SHA256 一致」 | **达成** | 注入→跑门→`cp` 复原→`sha256sum`→复跑 | 注入前 `f551ca55…` ⇒ 注入后 `a5bc4aab…` ⇒ 复原 `f551ca55…` **BYTE_IDENTICAL=YES** ⇒ EXIT=0 8 passed | `anti/loop1-drop-ios-key/{00,01,02,03}*` |
| 「app-mobile `test` 不劣化」 | **达成（按协议 §2.4 口径，见 §五②）** | 同上 | 基线无既有用例（`tests/` 不存在）；本单新增 1 文件 / 8 用例全过 EXIT=0。**未**对齐链上 56 用例 | `raw/14`、`raw/00` |
| 「`type-check` 0=0」 | **达成（真实读数）** | `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` | 基线 EXIT=0 / 0 错 ⇒ 修后 EXIT=0 / 0 错。`resolveJsonModule` 未受影响：`manifest.json`/`pages.json` 无代码 import，且新增 spec 在 `tests/`、不属 tsconfig `include`（仅 `src/**`） | `raw/10`、`raw/11`、`raw/00` |
| 「`lint` 不劣化」 | **达成** | `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue`（同一借入 harness） | 改前 files=190 error=20 warning=12880 `vue/html-indent=12299` ⇒ 改后**逐规则完全相同**；EXIT=1=1 | `raw/12`、`raw/13`、`raw/12b` |
| 「`build:h5` EXIT=0」 | **达成（直测）** | `npm --workspace app-mobile run build:h5` | EXIT=0，产物 `app-mobile/dist/build/h5`（gitignore 内） | `raw/17` |
| 「回传逐字段列值，不得只写『已补』」 | **达成** | — | 见本文 §三，六键与 record.desc 全文照录 | — |

## 三 逐条明细（逐字段列值）

### ① `app-mobile/src/manifest.json` → `app-plus.distribute.ios.privacyDescription`（新增 6 键）

| # | 键 | 实际写入值（全文） | 对应代码证据（文件:行号） |
|---|---|---|---|
| 1 | `NSCameraUsageDescription` | `用于扫描商品条码与二维码（扫码入库、扫码核销优惠券、扫码查溯源），以及在门店现场拍摄销售小票、盘点与损耗单据照片并上传留存。` | `src/native/scan.ts:457`（`uni.scanCode`）；`src/pages/ai-chat/ai-chat.vue:415-417`（`sourceType:['camera','album']`）；`src/pages/profile/edit.vue:150-153`；`src/pages-sub/product/product/product-edit.vue:415-418`；`src/pages-sub/finance/loss-gain/create-loss.vue:242`；`src/pages/products/product-detail.vue:1274` |
| 2 | `NSMicrophoneUsageDescription` | `用于AI经营助手语音输入：按住说话录制您的口述内容并上传，转写为文字后生成经营问答与开单草稿。` | `src/pages/ai-chat/ai-chat.vue:870`（`uni.getRecorderManager` 类型引用）、`:994`（`recorderManager = recorderManager || uni.getRecorderManager()`）、`:1007`（`recorderManager.start({ duration: 60000, format: 'mp3' })`） |
| 3 | `NSPhotoLibraryUsageDescription` | `用于从相册选取已有照片，上传为商品主图与详情图、门店与个人头像、损耗及采购单据凭证、客户对账附件。` | 同上 `chooseImage` 六处（`album` 源：`ai-chat.vue:417`、`profile/edit.vue:153`、`product-edit.vue:418`） |
| 4 | `NSLocationWhenInUseUsageDescription` | `用于在App运行期间定位您所在的门店，以便按当前门店展示库存、销售与配送数据，并核对门店档案中登记的门店经纬度。` | **无设备定位调用**（见 §③）。依据：`app-plus.distribute.android.permissions` 基线已声明 `ACCESS_FINE_LOCATION`（`src/manifest.json:38`）+ 门店经纬度为业务字段（`src/api/modules/stores.ts:17-18,50-51`；`src/pages-sub/admin/stores/store-edit.vue:214-215`）。风险自评见 §八① |
| 5 | `NSBluetoothAlwaysUsageDescription` | `用于搜索并连接门店的蓝牙热敏打印机，将销售单、退货单、收款单等小票直接打印输出；连接与打印在App使用期间进行。` | `src/native/print.ts`（`search()` 蓝牙扫描 `:684-728`、`connect(mac)` `:743-774`、打印 `:944/:981/:1013/:1080`、`bluetooth_disabled` 错误型 `:180/:496`）；`src/api/modules/print.ts:4,7` |
| 6 | `NSSpeechRecognitionUsageDescription` | `用于AI经营助手把您的语音转写为文字（例如“给张三开一箱52度白酒”），转写结果仅用于生成问答回复与单据草稿。` | `src/pages/ai-chat/ai-chat.vue:930`（`window.SpeechRecognition/webkitSpeechRecognition`）、`:933`（`lang='zh-CN'`）、`:1011`（`plus.speech.startRecognize`）；manifest 侧 `app-plus.modules.Speech`（`:21`）与 `distribute.sdkConfigs.speech`（`:68`）基线已在位 |

写入形态：`"ios"` 节点由 `{appid, dSYMs}` 扩为 `{appid, dSYMs, privacyDescription{…}}`，未触碰 `appid : "com.zhixiang.app"` 与 `dSYMs : false`；缩进/`"key" : value` 风格与 CRLF 行尾与原文件一致（bare LF = 0）。

### ② 小程序录音授权（`scope.record`）

- **落点**：`app-mobile/src/manifest.json` → `mp-weixin.permission["scope.record"].desc`（**不是** `src/pages.json`，取证见 §五①）。
- **实际写入值**：`用于AI经营助手语音输入：按住说话录制您的口述内容并转为文字，以便生成经营问答与开单草稿。`
- 产物验证：`app-mobile/dist/build/mp-weixin/app.json` 顶层 `permission = {"scope.record":{"desc":"用于AI经营助手语音输入：…"}}`（`raw/23`）。
- 必要性证明：录音调用链 `ai-chat.vue:870 / :994 / :1007`（`getRecorderManager` + `.start()`），即 `wx.getRecorderManager` ⇒ 需 `scope.record`。

### ③ `requiredPrivateInfos` = `[]`（空表）——「只登记实际使用」的取证

微信 `requiredPrivateInfos` 是**封闭的地理位置类 8 项合法表**（表外名字会被 miniprogram-ci 判 `app.json` 非法）。逐项 grep `app-mobile/src`（`--include=*.ts --include=*.vue --include=*.js`，模式 `uni.<api>|wx.<api>|plus.geolocation.<api>`）：

| 合法接口 | 命中数 | 结论 |
|---|---|---|
| `getLocation` | **0** | 不登记 |
| `getFuzzyLocation` | **0** | 不登记 |
| `onLocationChange` | **0** | 不登记 |
| `startLocationUpdate` | **0** | 不登记 |
| `startLocationUpdateBackground` | **0** | 不登记 |
| `chooseLocation` | **0** | 不登记 |
| `choosePoi` | **0** | 不登记 |
| `chooseAddress` | **0** | 不登记 |

⇒ 实际使用清单为空 ⇒ `requiredPrivateInfos` 登记 `[]`（整表照抄已被任务书明令禁止，且会被审核驳回）。原始输出 `raw/30-privacy-api-grep-evidence.txt`。

**代码确实用到、但不属于该合法表**的隐私能力（因此**不得**写进 `requiredPrivateInfos`，由 `permission` / iOS 描述管辖）：`uni.chooseImage`（6 处）、`uni.scanCode`（`scan.ts:457`）、`uni.getRecorderManager`（`ai-chat.vue:870/994/1007`）。用例 `录音接口不属于 requiredPrivateInfos 合法表（防误登记 startRecord）` 专门锁住这一混淆点。

### ④ `app-mobile/src/pages.json`：**零改动**（自评偏差，见 §五①）

`git diff --stat -- app-mobile/src/pages.json` 空；逐字段自证 changed=0 / removed=0 / added=0（`raw/25`、`raw/40`）。
理由：`@dcloudio/uni-cli-shared/dist/json/mp/pages.js:129-133` 只把 pages.json 顶层的 `preloadRule|workers|plugins|entryPagePath` 透传进产物 `app.json`（`pages/subPackages/globalStyle/tabBar` 走专门处理），**顶层 `mp-weixin` 键根本不被读取**；实测探针写进 pages.json ⇒ 产物无 `permission`（`raw/21`）。写进去只会得到一份**不生效**的重复授权配置，并制造两处真相源。

### ⑤ 新增用例 `app-mobile/tests/mobile-permissions.spec.ts`（8 条，逐条）

1. 两份配置 `JSON.parse` 通过 + 关键父节点存在（`privacyDescription` / `mp-weixin` 缺失即红）。
2. iOS 六键齐备、非空、长度 ≥15、且**不匹配** `^用于…功能。$` 式空话。
3. 六条描述与真实功能对得上（逐条正则绑定：条码/拍摄、录音、相册、门店、打印、语音）。
4. `scope.record.desc` 存在、非空、含「录音/录制」。
5. `requiredPrivateInfos` 每项 ∈ 合法表 **且** ∈ `PRIVACY_APIS_USED_IN_CODE`（白名单常量，注释写明 grep 取证来源）。
6. `startRecord` 不在合法表、也不得出现在表内（防误登记）。
7. `pages.json` 结构完好且**不得**承载 `mp-weixin` 死配置（锁住 §五① 的取证结论）。
8. 红线自证：`appid=__UNI__E395BAE`、`mp-weixin.appid=wx3ea76428aa15cec7`、`android.packagename`、`ios.appid`、`sdkConfigs=[share,speech]`、`plugins=[PrintManager,ZXing-Scanner]`、`modules=[Barcode,Share,Speech]` 保持基线；`payment`/`unipush` 必须仍为 undefined（本单不得新增）。

## 四 反测（门必须能红）

两条各在**一条 bash 命令内**走完：注入前 sha256 ⇒ 字节级注入（scratch `inject-anti.mjs`，`latin1` 读写，命中数≠1 直接 `exit 9`，注入后先 `JSON.parse` 校验）⇒ 跑门取 EXIT 与点名 ⇒ `cp` 复原（**未用 `sed -i`**，避 CRLF 归一致使 SHA 假阴）⇒ 复原后 sha256 ⇒ 复跑门。

| 轮次 | 注入内容 | 门读数 | 点名输出（原文摘录） | SHA256 对称 | 复原后 |
|---|---|---|---|---|---|
| loop1 | 删除 `NSBluetoothAlwaysUsageDescription` 整行（字段缺失） | **EXIT=1**，`Tests 2 failed \| 6 passed (8)` | `AssertionError: 缺少 NSBluetoothAlwaysUsageDescription: expected undefined to be type of 'string'` | 前 `f551ca55f87c029522beb3ffeae86e76feb521fce868833fbb43e140f604e5fe` → 注入 `a5bc4aabc92cf5c686039aee71b525999e4326e9576e67dd718bf5f311056bf5` → 复原 `f551ca55…` ⇒ **BYTE_IDENTICAL=YES** | **EXIT=0**，8 passed |
| loop2 | `requiredPrivateInfos` 由 `[]` 改为 `[ "getLocation" ]`（登记未用接口） | **EXIT=1**，`Tests 1 failed \| 7 passed (8)` | `AssertionError: requiredPrivateInfos 登记了代码中未使用的隐私接口：getLocation（app-mobile/src grep 0 命中，禁止整表照抄）: expected [] to include 'getLocation'` | 前 `f551ca55…` → 注入 `b2dd45eac0cf285a91b3d2b8fba23efd77b914d6902f5982b2367cfd02a6a393` → 复原 `f551ca55…` ⇒ **BYTE_IDENTICAL=YES** | **EXIT=0**，8 passed |

两轮共同注入前基线 = 改动后的 `src/manifest.json`（`f551ca55…`），备份 `anti/loop*/manifest.json.orig`。过程叙述 `anti/loop*/04-walkthrough.txt`。

**反测过程中的一次自我纠错（如实报备）**：loop1 首轮我把 `cd app-mobile` 与相对路径混用，导致「复原后复跑」的 stdout 重定向失败、门**根本没执行**却报 `EXIT=1`——该轮绿色读数当时无效。我改用绝对路径重跑，得到本文表格里的真实三段（红→复原一致→绿）。证据目录只保留重跑后的版本。

## 五 口径偏差报备（任务书文字 vs 仓库事实）

**① 靶点偏差（最实质的一条）：`scope.record` 与 `requiredPrivateInfos` 的生效落点是 `src/manifest.json`，不是任务书 §二.2 写的 `src/pages.json`。**
- 任务书原文：「`src/pages.json` 的 `mp-weixin.permission` 补 `scope.record` 中文说明；`requiredPrivateInfos` 只登记代码实际使用的隐私 API」。
- 仓库事实：`src/pages.json` 基线顶层键只有 `easycom,pages,subPackages,globalStyle,tabBar`，**不存在 `mp-weixin` 节点**；且框架源码 `@dcloudio/uni-cli-shared/dist/json/mp/pages.js:129-133` 只透传 `preloadRule|workers|plugins|entryPagePath` ⇒ 往 pages.json 写 `mp-weixin` **不会进产物 app.json**。
- 构建产物取证（探针 A 见 `raw/21`，探针 B 见 `raw/22`）：探针 A 写 pages.json 顶层 `mp-weixin` ⇒ `build:mp-weixin` EXIT=0 但 `app.json` 中 `permission=undefined`（探针字符串 0 命中）；探针 B 写 `src/manifest.json` 的 `mp-weixin` 节点 ⇒ `app.json` 出现 `permission={"scope.record":{"desc":"QODER16_MANIFEST_PROBE"}}` 与 `requiredPrivateInfos=[]`。生效机制：同文件 `mergeMiniProgramAppJson`（:33-45）把 manifest 的 `mp-weixin` 逐键并入 app.json，仅排除 `projectKeys`（`appid/setting/…`，`json/mp/project.js:7-25`）与 `NON_APP_JSON_KEYS`（`usingComponents/optimization/…`），`permission`、`requiredPrivateInfos` 均不在排除表内。
- 我的处置：**按生效落点实现**（写进 `src/manifest.json`），`pages.json` 零改动；并把该结论锁进用例 7，防止后续有人在 pages.json 补一份不生效的副本。若凌舟按任务书字面要求 pages.json 也必须承载该配置，请退回，我照办——但那是一份**已被证明不进产物**的配置。
- **证据勘误（验收复核时发现，2026-10-20 补记）**：`raw/21` 里的 **PROBE B 段作废**——该段没有注入确认行/回读校验，"探针未出现 ⇒ manifest 路由也不生效"推不出（极可能是静默未注入），且与 `raw/22` 的 `RESULT B: 探针出现`直接互斥。manifest 侧一律以 `raw/22`（有 `inject rc=0` + 注入后 JSON 回读 + 复原 SHA 一致）为准；`raw/21` 的 **PROBE A 段有效**（pages.json 不进产物）。原文逐字节未改，详见 `docs/evidence/qoder-16/raw/21b-probe-b-invalid.note.txt`。**本条不改变 §五① 的靶点结论**（PROBE A + `raw/22` + 产物 `raw/23` + 框架源码四处独立支撑）。
- 复现：`node D:/Users/ZXQL/scratch/qoder16/probe-splice.mjs pages app-mobile/src/pages.json` 后 `npm --workspace app-mobile run build:mp-weixin`，再看 `app-mobile/dist/build/mp-weixin/app.json`（脚本自带 cp 复原与 SHA 校验）。

**② 基线无门禁设施（协议 §2 全套事实）**：`321b4f6b` 的 app-mobile 无 `tests/`、无 `vitest.config.ts`、无 `.eslintrc.cjs`、无 `scripts/gates-baseline.json`，`package.json` 只有 `dev:*/build:*/guard:logout`（**没有 `test`/`lint`/`type-check` 脚本**）。故四条判据全部走等价装置，且**未新增 npm 脚本、未改任何 package.json**：
- 借入：`git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts`、`git show 9fd90257:app-mobile/.eslintrc.cjs > app-mobile/.eslintrc.cjs`（同 object DB 可取）。**借入件未提交、交付前已删除**（见 §六）。
- 跑法：`node ../node_modules/vitest/vitest.mjs run`／`node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit`／`node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue`（工作树内 `node_modules` 是指向主仓的 junction，工具直接从链上取）。
- 与协议 §2.3 交叉核对：我实测基线 files=**190** / error=**20** / warning=**12880** / `vue/html-indent`=**12299**、vue-tsc **EXIT=0 且 0 错**、`tests/` 不存在 ⇒ **既有用例 0**、`build:h5` **EXIT=0**——与负责人在 QODER-14 工作树的读数**完全一致**（各自独立测得，非照抄）。
- 「test 不劣化」只能报成：基线无既有用例，本单新增 1 文件 / 8 用例全过；**不声称**对齐链上 56 用例。
- eslint `EXIT=1` 是基线既有 20 条 error 的正常态（非本单引入），故 lint 判据按「改前/改后逐规则不劣化」自评，未按「必须 EXIT=0」自评。

**③ `requiredPrivateInfos` 的合法取值面比任务书措辞更窄**：任务书列举的 grep 目标含 `startRecord`，但 `startRecord`/`getRecorderManager` **不属于** `requiredPrivateInfos` 的 8 项合法表（属 `scope.record` 授权，走 `permission.desc`）。我把「录音」正确落在 `permission`，并额外加用例 6 挡住「把 startRecord 塞进 requiredPrivateInfos」这一误用。合法表出处为微信官方约束（`miniprogram-ci` 报错原文形如 `requiredPrivateInfos[0] field needs to be chooseAddress,chooseLocation,choosePoi,getFuzzyLocation,getLocation,onLocationChange,startLocationUpdate,startLocationUpdateBackground`）。

**④ `build:app` 不在判据清单里，我额外跑了它**：目的是给六键找一条「确实被消费」的产物证据（`raw/24`：产物 `manifest.json` 里 `app-plus.distribute.ios` 被归一为 `apple.privacyDescription`，六键原文可见）。它写 `app-mobile/dist/`（gitignore 内，不入库）。`build:h5` 判据本身仍是直测 EXIT=0。

**⑤ 根 `manifest.json` 的实况**：任务书 §二.3 提醒「`pages.json` 也可能同理（双份）」——**实测 `pages.json` 只有一份**（`src/pages.json`），根目录不存在 `app-mobile/pages.json`。双份的只有 `manifest.json`（根与 `src/` 两份 SHA256 相同 `629c732f…`，`git ls-files` 两份都入库）。

## 六 红线对照

| 红线 | 遵守情况 |
|---|---|
| 不得 push、不得开 PR | 遵守。`git log --oneline origin/main..HEAD` 共 3 笔（实现 / docs / 证据勘误），未推送、未建 PR |
| 不得 `git add -A` | 遵守。逐文件 add：`app-mobile/src/manifest.json`、`app-mobile/tests/mobile-permissions.spec.ts`，docs 笔逐件 add 卡片/回执/证据 |
| 只动分配的工作树与分支 | 遵守。主仓工作树与其它 `wt-agents/*` 全程只读；任务书原件未改 |
| 不得 `npm install/uninstall`、不得改任何 `package.json` 依赖 | 遵守。零 npm 命令、`package.json` 与 lockfile 零改动（`git diff --name-only` 不含它们） |
| 不动 appid / 支付 / 推送 / 插件配置 | 遵守。逐字段自证 changed=0 / removed=0，仅 3 处新增（`raw/25`）；并加用例 8 把 `appid`、`mp-weixin.appid`、`sdkConfigs`、`plugins`、`modules` 的基线取值与「不得新增 payment/unipush」锁成机器判据 |
| 借入 harness 不得提交、交付前删除 | 遵守。`app-mobile/vitest.config.ts`、`app-mobile/.eslintrc.cjs` 在所有读数落盘后已删除，未进任何提交；`git status --short` 终态为空 |
| 提交消息 `type: 中文描述`、本地 ≤3 笔 | 遵守（3 笔：实现 / docs / 证据勘误，第三笔仅动 docs，见 §〇） |
| 探针/反测不得污染交付态 | 遵守。全部注入均在同一命令内 `cp` 复原并 SHA 校验；scratch 辅助件全部在工作树外 `D:\Users\ZXQL\scratch\qoder16\`，未入库 |

## 七 未完成与阻塞（诚实列，不以「通过」代替「未验」）

1. **苹果审核口径未验**：无 iOS 设备、无 Mac/Xcode、无签名与 App Store Connect 账号。六键的**文案是否足以过审**属自评，未经真机弹窗与审核验证。
2. **微信侧未验**：未用微信开发者工具导入 `dist/build/mp-weixin`，未在真机预览触发录音授权弹窗；`mp.weixin` 后台「隐私接口/用户隐私保护指引」需人工同步填写且文案须与 `desc` **逐字一致**（不一致是常见驳回点）——**本单无法代办，未验**。
3. **App 端打包只做到编译产物取证**：`build:app` 产出 `dist/build/app/manifest.json` 含六键原文（`raw/24`），但 HBuilderX 云打包/离线打包与 `Info.plist` 落地**未验**。
4. `NSLocationWhenInUseUsageDescription` 描述所指的「定位门店」在 JS 层**没有对应实现**（8 项定位接口 0 命中）。这是按任务书 §二.1 点名要求补齐的键，我未擅自省略；但它与 §二.2「只登记实际使用」的精神存在张力，处理见 §八①，**待裁**。
5. `privacyDescription` 是否需要 `NSPhotoLibraryAddUsageDescription`（`saveImageToPhotosAlbum` 场景）：全量 grep **0 命中**，故未加（任务书六键之外不擅自扩面）。若将来接入「保存图片到相册」需同步补键。
6. **未做**：未新增 npm `test`/`lint`/`type-check` 脚本、未创建 `scripts/gates-baseline.json`——因红线禁改 `package.json` 且本基线无该设施。故这四道门目前**仍无常驻执行入口**，出厂必跑的 `check:gates` 在本分支上只能靠借入 harness 手工复跑（§五②）。
7. **未验/未动**：`h5`、`app-harmony` 等其它平台段的隐私配置未触及；`nativeplugins/PrintManager`、`ZXing-Scanner` 两个原生插件自身的 iOS 权限声明未查（不在本单文件范围）。

## 八 风险与自我报备

**① 定位键的「描述与实现不一致」风险（我认为本单最该被盯的一条）**。`NSLocationWhenInUseUsageDescription` 已补，但代码里没有任何定位 API 调用。两种解读：(A) 保守预置——Android 侧基线已声明 `ACCESS_FINE_LOCATION`，iOS 缺键在真正接入定位时会直接崩掉审核；(B) 冗余描述——苹果可能追问「用了什么定位能力」。我选择按任务书点名补齐，并**刻意没有**把它镜像进微信 `requiredPrivateInfos`（那里是「实际使用」硬判据，8 项 0 命中）。若凌舟认为应删该键或应先补定位实现，请裁定，我可回退这一条。

**② 我没有按任务书字面改 `pages.json`**（§五①）。这是一次**实质偏离**，不是笔误。依据是两条构建产物取证 + 框架源码行号。风险：若凌舟的验收脚本按「pages.json 必须含 mp-weixin.permission」判据，本单会判不合格。我已把结论锁进用例 7 并在卡片显著位置报备，随时可照字面重做。

**③ 交付物只改 1 个源文件**（`src/manifest.json` + 1 个新增测试），改动面小、可回滚；但也意味着**小程序隐私合规不是配置文件单点就能过审的**——还需后台隐私协议声明、`__usePrivacyCheck__`、用户隐私授权弹窗流程（本基线 `src/` 内 0 处 `requirePrivacyAuthorize`/`onNeedPrivacyAuthorization`，未在本单范围）。我只补了任务书点名的授权文案与 iOS 描述，没有顺手扩到隐私弹窗流程（遵守「禁止扩大改动范围」）。

**④ 借入 harness 的版本一致性**：harness 借自 `9fd90257`（卡 10 链尖端），与本基线 `321b4f6b` 不同源；`.eslintrc.cjs` 的 `ignorePatterns` 含 `tests`，故我新增的 spec **不在 lint 计量面内**（改前/改后 files=190 不变即由此而来）。这不代表 spec 本身 lint 干净——我只验证了它通过 vue-tsc 的编译（type-check EXIT=0）与 vitest 运行。

**⑤ 反测首轮证据作废**（§四末）：我一度把「门未执行」的 EXIT=1 当成绿色复跑缺失，已用绝对路径重跑并取得真实三段。落盘证据为重跑版本，首轮无效输出未入库。

## 九 交付物与证据清单

**源改动（实现笔 `3a69aa3c`）**
- `app-mobile/src/manifest.json`（+16/−2；−2 仅为两行末尾补逗号，语义零改动）
- `app-mobile/tests/mobile-permissions.spec.ts`（新增，8 用例）

**文档笔（本卡 + 回执 + 证据）**
- `docs/tasks/cards/R101-QODER-16-回传.md`
- `docs/tasks/inbox/ACTIVE-回执-QODER-16.md`
- `docs/evidence/qoder-16/README.md`
- `docs/evidence/qoder-16/raw/`：`00`、`05`、`10`、`11`、`12`、`12b`、`13`、`14`、`15`、`16`、`17`、`18`、`20`、`21`、`22`、`23`、`24`、`25`、`30`、`40`（共 20 件）
- `docs/evidence/qoder-16/anti/loop1-drop-ios-key/`：`00-pre-sha256.txt`、`00b-before-green.txt`、`01-target-red.txt`、`02-restore-sha256.txt`、`03-restore-green.txt`、`04-walkthrough.txt`、`manifest.json.orig`
- `docs/evidence/qoder-16/anti/loop2-unused-private-info/`：同上 6 件 + 备份

**未入库（按协议必须排除）**：`app-mobile/vitest.config.ts`、`app-mobile/.eslintrc.cjs`（借入 harness，已删除）、`app-mobile/dist/**`（构建产物，gitignore）、`D:\Users\ZXQL\scratch\qoder16\**`（全量 eslint json 与探针/反测脚本，工作树外）。

## 十 一行摘要

在 `app-mobile/src/manifest.json` 补齐 iOS `privacyDescription` 六键真实用途中文描述与微信小程序 `mp-weixin.permission["scope.record"].desc`，`requiredPrivateInfos` 按「8 项合法接口全量 grep 均 0 命中」的取证登记为 `[]`，并新增 8 条 JSON 权限断言用例（两轮反测证明门能红、cp 复原逐字节一致）；关键偏差报备：经 `build:mp-weixin` 产物取证，任务书点名的 `src/pages.json` 顶层 `mp-weixin` **不进产物 app.json**，故生效配置落在 `src/manifest.json`，`pages.json` 零改动；根 `app-mobile/manifest.json` 经移走-重建对照实验证明**不被构建读取**；四门自评 type-check 0=0、test 8/8 EXIT=0、lint 逐规则与基线相同（190/20/12880）、`build:h5` EXIT=0；真机/开发者工具/后台隐私协议三项未验。
