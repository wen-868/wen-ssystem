# R101-QODER-19-回传 · 四卡合并与门禁基线收敛（复跑取证 + 五轮反测）

> 汇报对象：凌舟（总负责人／派单人）
> 汇报人：Qoder（移动端执行方）｜2026-10-21
> 对应派单编号：QODER-19（任务书原件 `docs/tasks/inbox/QODER-19-baseline-convergence.md`，只读引用，未修改未删除）
> 共享协议：`wt-agents/_qoder-restack-exec-protocol-20261021.md`
> **本单不含任何验收判词。执行方不是凌舟，以下只有「卡片要求的目标读数」「实测读数」「执行方自评」三类。**

## ① 基线与提交

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-19`｜分支 `chore/qoder-19-baseline-convergence`｜基线 `21b465e5`（= `origin/main`）
- 四笔 merge commit（**由负责人完成，执行方未重做 git 机制、未 rebase、未改合并历史**）：

| # | merge commit | 第一父（集成分支侧） | 第二父（被并分支尖端） | 对应卡 |
|:--|:--|:--|:--|:--|
| 1 | `0ddcc3d2` | `21b465e5`（基线） | `e6801de0` | QODER-14F1 `fix/qoder-14f1-auth-cleanup-restack` |
| 2 | `25663f73` | `0ddcc3d2` | `316f2051` | QODER-15F1 `fix/qoder-15f1-price-compare-restack` |
| 3 | `bcf4f4e0` | `25663f73` | `54ba998a` | QODER-16R `fix/qoder-16r-permissions-restack` |
| 4 | `0963459d` | `bcf4f4e0` | `47c737e8` | QODER-17F1 `fix/qoder-17f1-safe-top-viewport` |

  四个第二父与卡 §一 表格尖端逐项相符 ⇒ 固定合并序 14F1→15F1→16R→17F1 成立（`raw/11`）。
- 执行方本次只新增 docs 证据（≤2 笔 `docs:` 提交），实现与测试文件**零改动**。

### 四个 merge commit 与每笔的冲突处理（逐项）

冲突面**只有 `app-mobile/scripts/gates-baseline.json` 的 `tests` 段一处**；判定口径：取 merge-base
（四笔的 merge-base 均为代码基线 `dfeedbc0`，其 tests 段 = `5/56`），**仅当两侧相对 base 都改了 tests 段才算内容冲突**。

**① `0ddcc3d2`（并入 QODER-14F1 `e6801de0`）— 无冲突，git 自动合并**
- 哪个文件：`app-mobile/scripts/gates-baseline.json`（tests 段两侧取值不同，但只有单侧相对 base 改动）。
- 两侧各是什么：父1（`21b465e5`）`5/56` = 与 merge-base 相同 ⇒ **未改动**；父2（14F1）`6/70` = 该卡自己抬的。
- 为什么这么解：单侧改动，git 直接取父2，**无需人工介入**，结果 `6/70`。
- note 逐项列源：此时 14F1 分支自带的 note 只写它自己那一跳（`5/56 → 6/70`）。

**② `25663f73`（并入 QODER-15F1 `316f2051`）— 仅 tests 段内容冲突**
- 哪个文件：`app-mobile/scripts/gates-baseline.json`，冲突块 = `"tests": { testFiles, testCount }`。
- 两侧各是什么：父1（`0ddcc3d2`）`6/70`（已含 14F1 的 1 文件/14 用例）；父2（15F1）`7/158`（相对 `5/56` 是 +2 文件/+102 用例）。
- 为什么这么解：两侧各自只并了**自己的** spec，谁都不是全集；按卡 §二.2「只在集成结果上解决」取**累积并** = `8/172`
  （5+1+2 文件；56+14+102 用例）。其余四段（`typeCheck` / `lint` / `checkContract` / `contractDrift`）与父1 **逐字节一致**（零改动），业务实现一行未动。
- note 逐项列源：note 必须同时写两跳 `5/56 → 6/70`（14F1）与 `6/70 → 8/172`（15F1），而不是只写总数。

**③ `bcf4f4e0`（并入 QODER-16R `54ba998a`）— 仅 tests 段内容冲突**
- 两侧各是什么：父1（`25663f73`）`8/172`；父2（16R）`6/64`（相对 `5/56` 是 +1 文件/+8 用例）。
- 为什么这么解：同上取累积并 = `9/180`（172+8）；非 tests 四段与父1 一致。
- note 逐项列源：追加第三跳 `8/172 → 9/180`，并写明 16R 的 8 条构成（配置 JSON 合法性 1 + iOS 隐私描述 2 + 小程序录音与 requiredPrivateInfos 3 + pages.json 死配置 1 + 红线字段自证 1）。

**④ `0963459d`（并入 QODER-17F1 `47c737e8`）— 仅 tests 段内容冲突，并在此笔定终态**
- 两侧各是什么：父1（`bcf4f4e0`）`9/180`；父2（17F1）`6/60`（相对 `5/56` 是 +1 文件/+4 用例）。
- 为什么这么解：取累积并 = **`10/184`**，与卡 §二.3 与 §三 判据字面相同；非 tests 四段与父1 一致。
- note 如何逐项列源（终态 note 实测含全部四条，见 `raw/12`）：
  `①…5/56 → 6/70`、`②…6/70 → 8/172`、`③…8/172 → 9/180`、`④…9/180 → 10/184`，
  每跳都点名"并入了哪个 spec 文件、几条、按什么分组拆的"，没有出现"只写总数"的形态；
  并显式声明"lint / typeCheck / checkContract / contractDrift 四段本单零改动"。

> 交叉核对（`raw/13`）：各分支尖端相对自身基线 `dfeedbc0` 的独立增量分别是 **+1/14、+2/102、+1/8、+1/4**，
> 与卡 §二.3 的组成式 `56 + 14 + 102 + 8 + 4 = 184` 逐项匹配；按序累积收敛推得 `10/184`，与终态实测一致 ⇒ 无重复计数、无丢失。

## ② 修法 × 读数总表

| 判据 | 卡要求的目标读数 | 实测读数 | EXIT | 证据 |
|:--|:--|:--|:--|:--|
| `type-check` | EXIT=0 | vue-tsc 0 错 / 基线 0 | 0 | `raw/01` |
| `lint` | EXIT=0，error 20 / warning 12872 不劣化 | error **20** / warning **12872**，逐规则一致（六条 warning 规则无一劣化） | 0 | `raw/02` |
| `test` | 10 文件 / 184 用例全过 | **10 文件 / 184 用例全过**，基线 10/184 | 0 | `raw/03` |
| `check:contract` | EXIT=0 | 292 / 283 / 204，后端注册 1498，差集 1 条全具名豁免 | 0 | `raw/04` |
| `build:h5` | EXIT=0 | `DONE Build complete.` | 0 | `raw/05` |
| `build:mp-weixin` | EXIT=0 | `DONE Build complete.` | 0 | `raw/06` |
| `build:app` | EXIT=0 | `DONE Build complete.`（**未因签名/资源失败**） | 0 | `raw/07` |
| `git diff -- backend/src` | 0 | **0 字节** | — | `raw/09` |
| `git diff -- backend/` | 仅允许四卡原有台账/证据变化 | **0 字节**（比卡口径更严） | — | `raw/09` |
| 终态四门串行 | 全绿 | `check:gates` EXIT=0 | 0 | `raw/15` |

五轮反测读数见 `anti/`（§③-5 与证据树 README 第二节）。

## ③ 逐条实现说明（本单交付的是"收敛取证"，不是代码）

1. **四门复跑**：一律 `cd app-mobile && npm run <gate>`，只用常驻包装器入口（协议 §1），未借入/删除任何 harness，未自拼 `node …/vitest.mjs` 绕过基线比较。
2. **三构建复跑**：一律在**仓库根**执行 `npm --workspace app-mobile run build:<t>`。已知坑（在 `app-mobile/` 内跑 workspace 命令报 `No workspaces found`，EXIT=1）**主动复现一次并另立负面控制文件**（`raw/14`），本单三构建本体无失败读数，不存在需作废的构建输出。
3. **`gates-baseline.json` 未被本单写入**：终态 10/184 由负责人在 `0963459d` 定；执行方全程只读，第⑤轮反测临时抬到 200 后**已 cp 复原且 sha256 逐字节一致**。
4. **改动面自证**：`git diff 21b465e5..HEAD --stat` = 230 文件，其中 `app-mobile/` 只有 8 类文件（6 个 src + 5 个新 spec 中除既有外的部分 + `index.html` + `gates-baseline.json`），逐项可归因到四卡既有提交（`raw/08`/`raw/10`）；src 六文件的 `git log` 归属全部落在 `5dbf1453 / 8c09cfbd / 81ef5c07 / 477acdca / 6b6fb197 / e3a4a7d0`，**没有一个由本单产生**。
5. **五轮反测**（门必须能红 + 原子自复原，协议 §4）：
   - ① 摘 `request.ts` 的 `uni.removeStorageSync('merchant_tenant')` ⇒ 14F1 的 **④⑩⑫** 三条红（与任务书点名一致），`Tests 3 failed | 181 passed (184)`。
   - ② `price-anomaly.vue` 的 `isBelowCost(item.retailPrice, item.costPrice)` 改回裸 `item.retailPrice < item.costPrice` ⇒ **字符串低价 retail "9.00"/cost "12.00" 卡点名复现条** + 4 条静态门，共 8 条红。
   - ③ `src/manifest.json` 删 `"NSCameraUsageDescription"` 整行 ⇒ 16R **"iOS 六个隐私描述键齐备且描述非空"** + "每条隐私描述与其真实功能对得上" 2 条红（JSON 合法性条仍绿，证明是断言红而非解析崩）。
   - ④ `index.html` 删 `, viewport-fit=cover` ⇒ 17F1 **断言④** 单条红（点名精确）。
   - ⑤ `gates-baseline.json` 的 `testCount` 184→200 ⇒ **184 用例全过仍判红**：`✗ 用例数劣化：10 文件 / 184 用例 < 基线 10 / 200（少了 16 条）`，证明基线冻结门真的会咬人；复原后 10/184 复绿。
   - 七步原子：`sha256sum` → `cp` 备份 → 树外 `.mjs` latin1 字节精确替换（命中≠1 `exit 9` 拒写，已先用自测样本验证拒写路径）→ 跑门点名 → `cp` 复原 → `sha256sum` 比对 → 复跑转绿。**未用 `sed -i`**（`gates-baseline.json` 实测混合行尾 CRLF 55 / LF 6，注入前后 CRLF 计数 55→55 未被归一）；**未用 Edit 删卡点名功能行**；五轮串行，注入与 vitest 冷跑无并发。

## ④ 测试 / 门读数

见 §② 表与 `docs/evidence/qoder-19/raw/`。补充逐轮 vitest 明细：

| 轮 | RED 时 vitest 汇总 | 失败 spec 文件 | GREEN 复跑 |
|:--|:--|:--|:--|
| ① | `Test Files 1 failed \| 9 passed (10)`，`Tests 3 failed \| 181 passed (184)` | `tests/request-retry-safety.spec.ts` | 10/184 EXIT=0 |
| ② | 同上口径，`Tests 8 failed \| 176 passed (184)` | `tests/price-anomaly-static.spec.ts` | 10/184 EXIT=0 |
| ③ | `Tests 2 failed \| 182 passed (184)` | `tests/mobile-permissions.spec.ts` | 10/184 EXIT=0 |
| ④ | `Tests 1 failed \| 183 passed (184)` | `tests/safe-top-var.spec.ts` | 10/184 EXIT=0 |
| ⑤ | `Tests 184 passed (184)` 但**门红**（基线 10/200） | 无（劣化判据触发） | attempt1 无关偶发红 → attempt2 10/184 EXIT=0 |

## ⑤ 口径偏差报备

1. **门命令形态**：卡 §三 写 `npm --workspace app-mobile run <gate>`，执行方按负责人本轮指令改用 `cd app-mobile && npm run <gate>`（协议 §1 规定的常驻门入口）。两者是同一 `package.json` scripts 段、同一入口脚本、同一基线比较逻辑，**判据本体无差**；读数见 `raw/01–04`。`raw/14` 记录了 workspace 形态必须在仓库根执行这一已知坑，供下一单避坑。
2. **`backend/` 口径**：卡写"`-- backend/src` = 0；`backend/` 仅允许四卡原有台账/证据变化"。实测**两条口径都是 0 字节**——四卡从未触碰 `backend/`，其台账/证据在 `21b465e5` 上已是终态，故"仅允许的变化"实际发生为零。这是**比卡更严**，不是偏差。
3. **`raw/09` 本体非零字节**：为满足"零字节文件不得留存"纪律，该文件在空 diff 之外写入了命令、HEAD、`wc -c` 实测与结论，两个实测值仍为 0 字节（不是把空文件改名交差）。
4. **15F1 分支自带基线值（7/158）与协议 §2 所列 targets（7/100）不同**：非本单引入，本单不动任何分支既有文件；收敛值一律按**实测**取累积并，终态 10/184 与卡 §二.3 字面一致。
5. **第⑤轮转绿需两次尝试**：attempt1 的红**原样存档**、不改写、不删除，另立 `04a` note 与 `05-test-green-attempt2.txt`（新文件号，协议 §5"新读数另存"）。

## ⑥ 红线对照（逐条）

| 红线 | 是否遵守 | 自证方式 |
|:--|:--|:--|
| 不得 push / 不得开 PR | 是 | 全程零 `git push`；分支只在本地，无远端 ref 变化 |
| 不得 `git add -A` | 是 | 逐文件 `git add <path>`（提交清单见回执 `commits` 与本节末尾） |
| 不得 rebase / 改历史 / 切分支 | 是 | `git rev-parse HEAD` 全程 `0963459d` → 仅在其上追加 docs；merge-base 链未变（`raw/11`/`raw/16`） |
| 不得动本工作树之外的仓库文件 | 是 | 仅写 `wt-agents/QODER-19/docs/**` 与 scratch 目录；主仓 `wen-ssystem` 只读（仅 `Read` 任务书） |
| 不得改写四卡既有证据 | 是 | 未打开写 `docs/evidence/qoder-1[4-7]*/**` 任何文件；`git diff` 对这些目录**零改动**（本单只新增 `qoder-19/`） |
| 不得改任务书原件与 `docs/tasks/inbox/ACTIVE.md` | 是 | 二者 mtime/内容未动；`git status` 不含它们 |
| 不得调基线换绿 | 是 | lint 无劣化（20/12872 逐规则一致）；`gates-baseline.json` 本单零写入，第⑤轮注入已复原 |
| 不得借入/删除 harness、不得 `npm install` | 是 | 未增删任何 `node_modules`、未改 `package.json`/lockfile；门只走 `npm run` |
| 不得写"凌舟裁定/验收结论"类判词 | 是 | 本文与回执、证据 README 均只用"卡片要求的目标读数 / 实测读数 / 执行方自评" |
| 禁止 `sed -i`、禁止用 Edit 删卡点名功能行 | 是 | 注入全走树外 `.mjs`（latin1，命中≠1 拒写）；`sed` 仅用于 `/d/`→`D:/` 路径字符串转换，不触碰仓库文件 |

## ⑦ 未完成与阻塞

**阻塞：无。** 四门三构建全绿、五轮反测全部红→复原→绿、工作树在 docs 提交后为空。

未验清单（协议 §6，逐条给原因与复现命令）：

1. **iOS / Android 真机**：`viewport-fit=cover` 的安全区实际留白、`privacyDescription` 六键的系统弹窗文案 —— **未验**（本环境无 iPhone/iPad/Android 设备与 HBuilderX 打包签名链）。复现：`npm --workspace app-mobile run build:app` 后 HBuilderX 导入 `dist/build/app` 真机运行。
2. **微信开发者工具 / 小程序后台**：`build:mp-weixin` 产物 `app.json` 的 `permission.scope.record.desc` 渲染与 `requiredPrivateInfos` 后台报备 —— **未验**（无开发者工具与后台权限）。复现：开发者工具导入 `dist\build\mp-weixin`。
3. **登录态整页 E2E**：401 清态在真实登录-失效链路上的整页表现 —— **未验**（本单不新增 E2E，无常驻 mock 后端）。
4. **PNG 目视 / computed 值本轮不复采**：17F1/15F1 已各自留过浏览器 computed 与修复前后直证，本单是**合并收敛取证**，未重跑浏览器 —— **未验（本轮）**，历史读数见 `docs/evidence/qoder-17f1/browser/`、`docs/evidence/qoder-15f1/browser/`。
5. **`storage-crypto.spec.ts`「tag 校验失败即抛」条的稳定性根治** —— **未验/未治**。本单只登记（`anti/a5-baseline-freeze/04a-attempt1-flake-note.txt`）：该用例每次 `encrypt()` 都用随机 IV（`src/utils/crypto.ts` 第 16 行注释）⇒ 篡改串 `tag.slice(0,-4)+'AAAA'` 的判定依赖本次随机 tag 取值。是否另立卡请负责人裁定；本单未改其代码、未调基线。
6. **`git diff -- backend/` 的"四卡原有台账/证据变化"未做二次交叉审计** —— 本单只证明其为 0 字节；若负责人要"原有台账"的历史变更明细，需另跑四卡各自分支的 diff（不在本单范围）。

## ⑧ 自我报备与踩坑

1. **证据文件里的推导脚有过一次错判并已就地更正**：`raw/12` 第一版用"两侧 tests 值不同 ⇒ 必然冲突"的错误启发式，会把 `0ddcc3d2`（单侧改动、实为自动合并）误标为冲突。已改为 **merge-base 双侧改动判据**重生成，并在文件顶部留「勘误」行说明；该文件当时**未被任何提交或结论引用**，无读数损失。与负责人的"merge1 自动合并无冲突"结论一致。
2. **第⑤轮 attempt1 转绿失败**：落在与本注入无关的 `storage-crypto.spec.ts` 随机 tag 用例。已按"未验就是未验"原样存档 + 四条无关性依据，未改代码、未调基线、未重跑洗绿。该用例在本单 raw/03 与①②③④轮绿跑及 `raw/15` 终态串行中累计 6 次全过 ⇒ 判定为 intermittent，但**没有把它写成"应无影响"**。
3. **反测轮② 首轮脚本备份路径没跑起来**：`_scratch` 备份名里带了证据目录的子路径（含 `/`）导致 `cp` 失败、脚本在**注入之前**就退出 3，仓库文件未被触碰。修脚本后重跑，无半成品注入。
4. **`sed -e` 在双引号里吞掉了 JSON 双引号**：needle 预检改用树外 `.mjs` 落地（`q19-needle-check.mjs`），五枚 needle 全部实测 `hits=1` 后才开始注入。
5. **Git Bash 路径转换**：按指令先 `export MSYS2_ARG_CONV_EXCL='*'`；对含 `/xxx/` 起头模式的检索一律走该口径。注入器 `--file` 用 `D:/…` 形态传入，避免 `/d/…` 被 MSYS 改写后 node 找不到文件。
6. **本轮没有做任何 git 机制**：四笔 merge 与 `gates-baseline.json` 终态都不是执行方产的，本单价值只在"复跑 + 反测 + 自证"。若负责人希望连合并动作也算执行方交付，请明确另派。

## ⑨ 复现命令

```bash
export MSYS2_ARG_CONV_EXCL='*'
R=/d/Users/ZXQL/wt-agents/QODER-19

# 0) 门面：分支/HEAD/改动面
cd $R && git rev-parse --abbrev-ref HEAD && git rev-parse HEAD           # chore/… @ 0963459d(或其上的 docs)
git log --merges --format='%h parents=%p %s' 21b465e5..HEAD             # 四笔 merge（raw/11）
git diff 21b465e5..HEAD --stat                                          # raw/08
git diff 21b465e5..HEAD -- backend/ | wc -c                             # 必须 0（raw/09）

# 1) 常驻四门（协议 §1：入口只有 npm run，不得自拼 vitest/eslint）
cd $R/app-mobile
npm run type-check && echo "EXIT=$?"     # raw/01  error 0/0
npm run lint && echo "EXIT=$?"           # raw/02  error 20 / warning 12872
npm run test && echo "EXIT=$?"           # raw/03  10 文件 / 184 用例
npm run check:contract && echo "EXIT=$?" # raw/04  差集全具名豁免

# 2) 三构建（必须仓库根，否则 No workspaces found，见 raw/14）
cd $R
npm --workspace app-mobile run build:h5        # raw/05
npm --workspace app-mobile run build:mp-weixin # raw/06
npm --workspace app-mobile run build:app       # raw/07

# 3) 反测一轮完整七步（以①为例；其余四轮换 target 与 needle，走同一脚本）
cd $R/app-mobile
sha256sum src/api/request.ts                                        # 注入前
cp src/api/request.ts /d/Users/ZXQL/wt-agents/_scratch/qoder-19/bak
node /d/Users/ZXQL/wt-agents/_scratch/qoder-19/q19-anti-inject.mjs \
  --file="D:/Users/ZXQL/wt-agents/QODER-19/app-mobile/src/api/request.ts" \
  --mode=replace --old="uni.removeStorageSync('merchant_tenant')" --new=
npm run test    # 期望 EXIT=1 且点名 ④⑩⑫
cp /d/Users/ZXQL/wt-agents/_scratch/qoder-19/bak src/api/request.ts
sha256sum src/api/request.ts    # 必须与注入前逐字节一致
npm run test    # 期望 EXIT=0 10/184

# 4) 第⑤轮（基线门自身）
node …/q19-anti-inject.mjs --file="…/scripts/gates-baseline.json" \
  --mode=replace '--old="testCount": 184' '--new="testCount": 200'
npm run test    # 期望 EXIT=1：Tests 184 passed (184) 但「< 基线 10 / 200（少了 16 用例）」
cp <备份> scripts/gates-baseline.json && sha256sum scripts/gates-baseline.json && npm run test
```

## ⑩ 对下一单的建议

1. **`tests` 段合并冲突是本轮唯一冲突面，且是可预言的**：任何并行的移动端卡都从 `dfeedbc0` 的 `5/56` 各自抬自己的基线，合并时必冲。建议下一批**在派单时就固定"累积序"**（本单序 14F1→15F1→16R→17F1），或在 note 模板里预置各卡应写的"上一跳值"，让冲突解决变成填表而不是判断。
2. **note 的"逐项列源"应机检**：本单靠人眼比对四条递进（`raw/12`）。建议在 `test-gate.mjs` 加一条弱断言：`tests.note` 必须包含每个已并卡名与 `X/Y → W/Z` 递进串，缺失即红（属新增门禁，按 AGENTS.md 铁律必须配反测才能上）。
3. **`storage-crypto.spec.ts` 的随机 tag 用例建议改造**：把"篡改后必须抛"改为"用固定 IV/固定明文构造确定性篡改向量"，消除 1/16.7M 级但真实存在的偶发红；改前别把它塞进 required checks。
4. **workspace 形态命令的坑应在派单里写明**：四门用 `cd app-mobile && npm run`，三构建用仓库根 `npm --workspace`；混用会得到 `No workspaces found`（EXIT=1）这种"看着像构建失败"的假红。
5. **混合行尾文件（`gates-baseline.json`：CRLF 55 / LF 6）必须走 latin1 字节级注入**，`sed -i` 会把整篇归一导致 SHA 必差；本单的 `q19-anti-inject.mjs`（命中≠1 拒写 + 打印 CRLF 计数）可直接复用。
6. **反测请沿用"七步一轮 + 另立文件号"**：attempt 失败的红要原样存档并配 note，不要覆盖成绿，否则"门能红"的证据本身就变成不可审计的。

---

> 汇报对象：凌舟（总负责人／派单人）
> 汇报人：Qoder（移动端执行方）｜2026-10-21
> 对应派单编号：QODER-19
> ref：分支 `chore/qoder-19-baseline-convergence`（哈希见 `docs/tasks/inbox/ACTIVE-回执-QODER-19.md` 的 `commits:` / `branch:` 行）
