# R101 · QODER-14F1 回传卡 —— 401 清态补 `merchant_tenant` + 常驻门禁重栈

> 汇报对象：凌舟（派单人）
> 汇报人：Qoder（移动端执行方）
> 日期：2026-10-21
> 对应派单编号：QODER-14F1（任务书 `docs/tasks/inbox/QODER-14F1-auth-cleanup-restack.md`，原件未修改、未删除）
> ⚠️ 本卡所有读数均为**执行方自评**，不含验收结论；「绿/红/通过」只描述命令退出码与卡内目标读数的对照关系，不代表凌舟裁定或验收通过。

## ① 基线与提交

| 项 | 值 |
| --- | --- |
| 工作树 | `D:\Users\ZXQL\wt-agents\QODER-14` |
| 分支 | `fix/qoder-14f1-auth-cleanup-restack` |
| 卡基线 | `dfeedbc0`（#368 合并后的 main；`origin/main` = `21b465e5`） |
| 开工时分支尖端 | `a5294668`（= 旧 QODER-14 三笔 rebase 到 `dfeedbc0` 后的新哈希；本轮**未 rebase、未切分支、未碰 git 历史**） |
| 实现笔 | `8c09cfbd8e817132678a1fc4e63c8a4a13e2a0f8`（`fix: 401 清态补删 merchant_tenant 并将五敏感键无残留做成断言（QODER-14F1）`）；含且仅含 3 个文件：`app-mobile/src/api/request.ts`、`app-mobile/tests/request-retry-safety.spec.ts`、`app-mobile/scripts/gates-baseline.json` |
| docs 笔 | 本卡 + 回执 + `docs/evidence/qoder-14f1/**`（证据笔）与收尾自检证据（`raw/12`）共 2 笔 docs，全部 `git log` 尖端以下可查；写本卡时自身哈希不可知，终态以 `git log --oneline origin/main..HEAD` 为准 |
| 提交总数 | 本卡新增 3 笔（1 impl + 2 docs），分支自 `origin/main` 起共 6 笔（含开工前已存在的旧 QODER-14 三笔） |
| push / PR | **未 push、未开 PR**；逐文件 `git add`，未用 `-A` |

## ② 修法 × 读数总表

| # | 修法（改了什么） | 位置（修后行号） | 卡内依据 | 自评读数 |
| --- | --- | --- | --- | --- |
| 1 | 401 清态补第五条删除：`uni.removeStorageSync('merchant_tenant')`，并写清依据（`merchant_tenant` ≠ `merchant_tenant_id`；`setTenant()` 两键同写；拦截器连带删 `enc_` 镜像 ⇒ 一条即够） | `request.ts:115-122`（注释 7 行 `:115-121` + 删除行 `:122`）；清态块由 4 行变 5 行：`:113` token、`:114` user、`:122` tenant、`:123` tenant_id、`:129` csrf | §二.2 | test 门 6 文件 / 70 用例全绿；反测 (b) 摘该行 ⇒ ④⑩⑫ 红（门 EXIT=1） |
| 2 | 用例④ 被删键集合断言由 4 键扩为 **5 键**（`merchant_csrf_token / merchant_tenant / merchant_tenant_id / merchant_token / merchant_user`） | `request-retry-safety.spec.ts:167-177` | §二.3 | 绿；反测 (a)(b) 均点名该用例 |
| 3 | 用例⑫ 由「只断言 `enc_merchant_csrf_token` + `enc_merchant_token`」扩为「五个敏感键的**明文键 + `enc_` 镜像键双形态**均无残留」，并加入「前提自检」（注入后五键必须真的都在，防空断言） | `request-retry-safety.spec.ts:350-399`（五键常量表 `:350-362`、用例体 `:363-399`） | §二.3 | 绿；反测 (b) 点名该用例（`enc_merchant_tenant` 仍残留） |
| 4 | 用例⑩ 源码静态兜底 +1 行 `expect(src).toContain("uni.removeStorageSync('merchant_tenant')")`（在用例内部加断言，**未新增 `it`**） | `request-retry-safety.spec.ts:235-248`（新增行为 `:246`） | §二.2/§二.3 的双保险 | 绿；反测 (a)(b) 均点名该用例 |
| 5 | 文件头与 ⑪~⑬ 段注释同步登记新靶点与新反测面③（纯注释，不影响计数） | `request-retry-safety.spec.ts:1-25`、`:250-262` | §二.2/§三 | — |
| 6 | `gates-baseline.json`：**只动 `tests` 两数** `5/56 → 6/70`，`note` 追加本卡留痕；lint / typeCheck / checkContract / contractDrift 四段**一字未动** | `app-mobile/scripts/gates-baseline.json:56-60` | §二.4 / 协议 §2 | 门 3 改后打印「基线 6/70」且不再提示「请调高」；`git diff` 仅该段（`raw/11` §5） |
| — | **未动**：`upload()`（§二.5 另单 QODER-18）、403/404/500 分支、`silent`、`unauthorizedHandling` 去重锁、`storage.ts`、`crypto.ts`、任何页面 `.vue`、`package.json`/lockfile、四个门禁包装器 | `request.ts:219+`（upload）、`:135/:143/:151`（403/404/500）、`:47`（去重锁） | §二.5 / 红线 | `app-mobile/src` 改动面 = 1 个文件；`git diff d1a6adcf..HEAD -- backend/` = **0 字节** |

## ③ 逐条实现说明

### 3.1 为什么必须补 `merchant_tenant`（卡 §二.2 的机制依据）

`app-mobile/src/api/storage.ts:75-80` 的 `SENSITIVE_KEYS` 是五个键，其中：

- `TENANT: 'merchant_tenant'` —— 租户**对象**（`TenantInfo`：id/name/code）；
- `TENANT_ID: 'merchant_tenant_id'` —— 租户 **ID 字符串**。

两个键是**独立**的两条存储记录：`setTenant()`（`storage.ts:319-322`）会**同时**写
`setSecureStorage(TENANT, tenant)` 与 `setSecureStorage(TENANT_ID, String(tenant.id))`，
`removeTenant()`（`:325-331`）也是两条一起删。而 401 清态此前只删了 `merchant_tenant_id`，
⇒ 被踢回登录页后 `enc_merchant_tenant` 里旧租户对象（含 name/code/id）仍可被 `getTenant()` 读出，
属登录态残留，与卡 §一「QODER-14 的方向通过、清态需补全」一致。

### 3.2 为什么一条删除就够（不补第二条）

`storage.ts:196-203` 的 `uni.removeStorageSync` 拦截器对 `SENSITIVE_KEYS` 内的键执行
`removeSecureStorage(key)` + `_originalRemoveStorageSync(key)` 两步；`removeSecureStorage`
（`crypto.ts:923-933`）在 H5 分支 `ls.removeItem('enc_'+key)`、非 H5 分支 `uni.removeStorageSync('enc_'+key)`，
两分支都真删。⇒ `uni.removeStorageSync('merchant_tenant')` 一条调用即同时清掉
`enc_merchant_tenant` 镜像键与历史明文残留，与既有四行完全同一套语义。这一点由 ⑫ 的运行期断言实测
（不是只靠读代码）：H5 分支下 `enc_*` 写在 `window.localStorage`，若按字面再补一条
`uni.removeStorageSync('enc_merchant_tenant')` 反而打不中目标（同 ⑬ 的归属结论）。

### 3.3 用例⑫ 的扩法（做成「五敏感键均无残留」的断言）

改后 ⑫ 的真实链路：装 `uni` mock + `window.localStorage` mock → `import storage.ts`（安装拦截器）
→ `import request.ts` → `setToken/setUser/setTenant/setCsrfToken` 落五条登录态
→ 再向 `uniStore` 各塞一份「历史明文残留」（拦截器不拦 `setStorageSync`，直落 uni 存储层）
→ **前提自检**：五个 `enc_*` 与五个明文键必须全部命中（否则「不残留」是空断言）
→ 真实调用 `request.request({ method: 'POST' })` 走 401 不重试分支
→ 断言：`calls.length = 1`、四个 getter 读回空/`null`、五个 `enc_*` 不在 `localStorage`、五个明文键不在 `uniStore`。

### 3.4 为什么用「扩断言」而不是「新增 `it`」

卡 §二.3 要求的是把「五个敏感键均无残留」**做成断言**，卡 §二.4 的 tests 目标是 `6/70`。
本轮选择在被点的 ④/⑫（外加 ⑩ 源码兜底）**用例内部**加断言，用例数保持 14 ⇒ 全仓 6 文件 / 70 用例，
**实测与卡内目标一致，无需为凑 70 合并任何断言，也没有需要报备的 +1/-1 差异**。

## ④ 测试 / 门读数（常驻门禁四道全跑 + build:h5；原始输出见 `docs/evidence/qoder-14f1/`）

入口一律 `cd app-mobile && npm run <gate>`，未自拼 `node ../node_modules/...` 绕过包装器（协议 §1）。

| 门 | 命令 | 改前（分支现态） | 改后（终态） | 卡 §三 目标 | 证据 |
| --- | --- | --- | --- | --- | --- |
| type-check | `npm run type-check` | EXIT=0，当前 0 错 / 基线 0 错 | EXIT=0，当前 0 错 / 基线 0 错 | `0=0` ✅ | `raw/01`、`raw/05` |
| lint | `npm run lint` | EXIT=0，error 20（基线 20）/ warning 12872（基线 12872） | EXIT=0，error 20 / warning 12872 | 逐规则不劣化 ✅（6 条 warning 规则 + 13 对 `文件::规则` 全部当前=基线） | `raw/02`、`raw/06`、逐规则明细 `raw/07` |
| test | `npm run test` | EXIT=0，6 文件 / 70 用例，基线 5/56 ⇒ 打印「高于基线⇒请调高」 | EXIT=0，**6 文件 / 70 用例，基线 6/70**，无调高提示 | `6 文件 / 70 用例` ✅ 与卡内目标**完全一致** | `raw/03`、`raw/08` |
| check:contract | `npm run check:contract` | EXIT=0，差集 1 条 / 具名豁免 1 条（`missingAfterExemptions=0`） | EXIT=0，同读数（A.2 三口径 292/283/204，后端注册 1498） | EXIT=0 ✅ | `raw/04`、`raw/09` |
| build:h5 | `npm --workspace app-mobile run build:h5`（**仓库根**） | 未单独跑 | EXIT=0，`DONE Build complete.` | EXIT=0 ✅ | `raw/10` |
| backend 零改动 | `git diff d1a6adcf..HEAD -- backend/` | — | **0 字节** | =0 ✅ | `raw/11` §2 |

### 4.1 反测（门必须能红）—— 两条各自原子自复原

| 反测 | 注入 | vitest 红点名（`npm run test`） | 门 EXIT | 复原 SHA256 | 复跑 |
| --- | --- | --- | --- | --- | --- |
| (a) 摘 GET 判定（恢复无条件重放） | `retryToken && retryMethod === 'GET' && !` → `retryToken && !`（命中数 1，字节 10409→10384） | `tests/request-retry-safety.spec.ts` 内 **6 条**：② POST 0 次重试、③ PUT、③ DELETE、④ 被删键集合、⑩ 源码静态兜底、⑫ 五敏感键无残留；`Test Files 1 failed \| 5 passed (6)`、`Tests 6 failed \| 64 passed (70)` | 1（`✗ vitest 本体失败（EXIT=1）⇒ 门 3 红`） | `6585f7c5ea3f006537777c4d0a23130551c8415de84a644d91ccda49cd388376` ⇒ 前后**逐字节一致**（BYTE_IDENTICAL=yes） | 6 文件 / 70 用例 EXIT=0（`anti/a-get-gate/03-green.txt`） |
| (b) 摘 `merchant_tenant` 清理行 | 整行删除 `          uni.removeStorageSync('merchant_tenant')\r\n`（命中数 1，字节 10409→10357） | 同文件内 **3 条**：④（集合少 `merchant_tenant`）、⑩（源码 `toContain` 失败）、⑫（`enc_merchant_tenant` 仍残留）；`Tests 3 failed \| 67 passed (70)` | 1 | 同上 SHA，前后**逐字节一致** | 6/70 EXIT=0（`anti/b-tenant-clear/03-green.txt`） |

执行方式：每条反测在**同一个 bash 命令内**完成 `sha256sum`→`cp` 备份→`node inject.mjs`（工作树外 scratch，`latin1` 读写、命中数≠1 即 EXIT 9）→跑门取红→`cp` 复原→SHA 比对→复跑取绿；注入与 vitest 冷跑严格串行不重叠；**未用 `sed -i`、未用 Edit 删功能行**。复原后 `git status --porcelain` 无幻影 `M`（协议 §7.4 那次未复现）。

## ⑤ 口径偏差报备

| # | 项 | 卡内口径 | 本轮实况 | 处置 |
| --- | --- | --- | --- | --- |
| 1 | 用例数 | `5/56 → 6/70` | 实测 6/70 | **无差异**，基线按实测写 6/70 |
| 2 | 常驻门「改前态」 | 卡 §三 只给目标读数 | 开工现态基线仍是 `5/56`，跑 test 门 EXIT=0 并打印「请把 tests 同步调高」；本轮先落改后基线 6/70 再复跑 | 改前/改后两份原始输出都留（`raw/03` vs `raw/08`），不事后只留绿的 |
| 3 | 反测 (b) 的对象 | 卡 §三「摘 `merchant_tenant` 清理」 | 本轮照做；**未**重复上一轮那条「摘 CSRF 清理」的反测（CSRF 断言已被并进 ④/⑫，摘 CSRF 行同样会打红 ④/⑫，但本轮不再单独取证） | 如实登记：本轮反测靶点 = 卡内点名的两行；旧取证在 `docs/evidence/qoder-14/anti/b-csrf-clear/`，未改写 |
| 4 | 用例⑩ 加断言 | 卡未点名 ⑩ | 本卡在其内部 +1 行 `toContain('merchant_tenant')` 源码兜底（不新增 `it`、不改计数） | 报备为**卡内 §二.2 要求的双保险**，非越面；如认为超出可回退该行，④/⑫ 已足够覆盖反测 (b) |
| 5 | scratch 目录位置 | 协议 §4 要求注入脚本在工作树外 | 新写 `D:\Users\ZXQL\wt-agents\_scratch\qoder-14f1-exec\`（仅新建文件，未改主仓与其它 `wt-agents/*` 的任何既有文件） | 报备该目录为协议要求的「工作树外 scratch」，不入库 |
| 6 | `docs` 笔数 | 协议 §0「笔数尽量少（≤3）」 | 1 impl + 2 docs = 3 笔（收尾自检 `raw/12` 必须在终态才能取，故独立一笔） | 未超 3 |
| 7 | 越面改动 | — | **无**。只动卡点名 3 文件；`storage.ts`/`crypto.ts`/页面/`package.json`/lockfile/门禁本体 0 改动 | `raw/11` §0/§3/§4 自证 |

## ⑥ 红线对照（逐条自查）

| 红线 | 自查结果 |
| --- | --- |
| 不得 push、不得开 PR | 未执行任何 `git push`；未建 PR；`origin/main..HEAD` 全为本地提交 |
| 不得 `git add -A`，逐文件 add | 逐文件 add：`app-mobile/src/api/request.ts`、`app-mobile/tests/request-retry-safety.spec.ts`、`app-mobile/scripts/gates-baseline.json`；docs 笔同样逐文件 |
| 不是凌舟，不得写「凌舟裁定/验收结论/验收通过」 | 本卡与回执只写「执行方自评」与「卡内目标读数」；未代凌舟下任何判词（引用 `gates-baseline.json` note 里的历史文字属既有基线内容，非本轮新增判词） |
| 只动 `wt-agents/QODER-14`；主仓与其它 `wt-agents/*` 只读 | 除协议 §4 要求的工作树外 scratch 新目录（只新增自己的文件）外，无任何其它目录写入；主仓任务书原件未改未删 |
| 不得改任务书原件、不得动 `docs/tasks/inbox/ACTIVE.md` | 任务书 `QODER-14F1-auth-cleanup-restack.md` 只读；`ACTIVE.md` 未创建、未修改、未移动 |
| 不得 `npm install`、不得改 `package.json` 依赖/lockfile | 未执行任何安装；`app-mobile/package.json` 与 `package-lock.json` diff 0 字节（`raw/11` §4） |
| 严禁「借入 harness 后删除」 | 全程用 main 常驻门 `npm run <gate>`；未借入、未删除任何 harness 文件 |
| 禁放宽 `gates-baseline.json` 的 lint/typeCheck/contract 任何一段 | 四段一字未动，只动 `tests` 两数（协议 §2 唯一允许项），note 追加留痕 |
| 真机/后端联调没做的写「未验」 | 见 ⑦ 与 `docs/evidence/qoder-14f1/README.md` §三，5 项未验全部登记原因与复现命令 |

## ⑦ 未完成与阻塞

**无阻塞**。未完成项（均属卡外/环境所限，非本卡判据项）：

1. `upload()` 的 401 缺失 —— **本卡范围外**，属 **QODER-18**（卡 §二.5 明确「另单处理，本卡不碰」）。本轮对 `upload()` 零改动。
2. 真机 / 小程序宿主 / 后端联调 / 登录态整页 E2E / H5 产物目视 —— **未验**，原因与复现命令见 `docs/evidence/qoder-14f1/README.md` §三。
3. 非 H5 分支（`#ifndef H5`）的 `enc_merchant_tenant` 删除路径 —— **未验**（vitest 条件编译 shim 固定按 H5 跑）。

## ⑧ 自我报备与踩坑

1. **`gates-baseline.json` 的 note 里我一开始把日期打成 `2026-14-21`**，已改回 `2026-10-21`（改在提交前，diff 面不含笔误）。
2. 上一轮证据目录 `docs/evidence/qoder-14/**` 与本轮读数**存在系统性差异**（门禁形态、lint 全仓计数 files 190→187 / warning 12880→12872 / no-console 232→225、`request.ts` SHA、反测 (b) 靶点）。原因不是本轮读数不可信，而是**两轮基线不同**（旧轮在 `321b4f6b` 用借入 harness，本轮在 `dfeedbc0` 用常驻门）。旧文件一字未改，差异已在 `docs/evidence/qoder-14f1/README.md` §〇 逐条点名为表。
3. 证据落盘时踩到一个平台限制：门 4 的原始日志文件名 `post-check:contract.log` 含 `:`，bash 可见但 Node/WinAPI 读不到（ENOENT），首轮生成的 `raw/09` 因此只剩头部。已 `cp` 成不含 `:` 的文件名重新落证据，并在该文件头部注明该处置，未伪造原始输出。
4. 两条反测的红都是**真实目标红**（不是环境错）：(a) 6 条、(b) 3 条，且每条都能在 vitest 输出里读到用例标题与被断言的键名；两次 `cp` 复原 SHA 与注入前逐字节一致，复跑均 6/70 绿。
5. `build:h5` 会写 `app-mobile/dist/`（`.gitignore` 已含 `dist/`），未污染 `git status`。
6. 我没跑 `npm run check:gates` 串行入口而是**逐门单独跑并各留一份 EXIT**，因为卡 §三 要逐条留原始输出；串行入口等价（`package.json` 里它就是四道 `&&`）。

## ⑨ 复现命令

```bash
cd /d/Users/ZXQL/wt-agents/QODER-14

# 四道常驻门（逐门跑，判据本体是包装器里的基线比较）
cd app-mobile
npm run type-check      # 期望 EXIT=0，当前 0 错 / 基线 0 错
npm run lint            # 期望 EXIT=0，error 20 / warning 12872
npm run test            # 期望 EXIT=0，6 文件 / 70 用例，基线 6/70
npm run check:contract  # 期望 EXIT=0，差集 1 条 / 具名豁免 1 条
cd ..

# H5 构建（仓库根）
npm --workspace app-mobile run build:h5     # 期望 EXIT=0，DONE Build complete.

# 改动面与 backend 零改动判据
git diff --name-only a5294668..8c09cfbd                     # 仅 3 个文件
git diff d1a6adcf..HEAD -- backend/ | wc -c                 # 0
git diff a5294668..HEAD -- app-mobile/src                   # 只有 request.ts

# 反测 (a) 摘 GET 判定 ⇒ 门红 ⇒ cp 复原 ⇒ SHA 一致 ⇒ 复绿
# 反测 (b) 摘 merchant_tenant 清理行 ⇒ 门红 ⇒ cp 复原 ⇒ SHA 一致 ⇒ 复绿
#   注入器：D:/Users/ZXQL/wt-agents/_scratch/qoder-14f1-exec/inject.mjs（工作树外，不入库）
#   单条命令内原子完成：sha256sum → cp 备份 → node inject.mjs <file> a|b → npm run test → cp 复原 → sha256sum → npm run test
#   逐步原始输出已落 docs/evidence/qoder-14f1/anti/{a-get-gate,b-tenant-clear}/00~03
```

## ⑩ 对下一单（QODER-18 等）的建议

1. **`upload()` 的 401 缺口就在 `request.ts:219-254`**（本卡 +8 行后行号已从旧卡的 `:211` 漂移）：现在它只解析 `res.data`，`statusCode` 完全不参与判断 ⇒ 过期后上传会静默失败或走「上传响应解析失败」，既不跳登录也不清态。QODER-18 若要做清态，请**直接复用 `request()` 里那五行**（含本轮新增的 `merchant_tenant`），并同步把 ⑫ 的五键集合断言扩到 upload 路径，否则 ④/⑫ 锁不住回归。建议别再各写一份删除清单——本轮已经出现「两处清单不同步」这一类缺陷（漏 `merchant_tenant` 就是这么来的），更稳的做法是把清态收敛成 `storage.ts` 的一个导出函数（如 `clearAuthState()`）供两处调用，但那属跨面改动，需凌舟先裁。
2. **常驻门已入库，任何 app-mobile 交付四道门全跑并各留一份 EXIT**（10F1 的教训仍在 `raw/` 里有参照）；`gates-baseline.json` 本轮唯一允许动的仍是 `tests` 两数，且必须等于实测。
3. **test 门的「高于基线⇒请调高」提示是现场态，不是红**：改前跑会看到它，落完基线后应消失；证据请两份都留（本卡 `raw/03` / `raw/08`），别只留绿的。
4. **断言尽量做在用例内部而不是新开 `it`**：新开用例会改变 6/70 这类目标计数，制造「实测与卡内不符」的报备成本（17F1 卡的 59/60 就是同一问题）。
5. 反测注入器请继续放**工作树外 scratch** 并保留「命中数≠1 即 EXIT 9」的自检与「注入后回读确认行」——本卡 `inject.mjs` 可直接复用，改 needle 即可。
6. 跑门请仍在 `app-mobile/` 下用 `npm run <gate>`；本次没有任何借入/删除动作，分支与 main 的 harness 差异为 0，QODER-18 若也落在同一条链上，`git diff <基线>..HEAD -- app-mobile/vitest.config.ts` 应始终 0 字节，可作为快速自检。
