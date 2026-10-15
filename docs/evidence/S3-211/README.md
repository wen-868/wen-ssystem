# S3-211 证据包（第 **57** 项·**乙方案**：12 条 `js/path-injection` 换成 CodeQL 已建模的净化形态）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-211.md`｜工作树 `D:\Users\ZXQL\wt-agents\S3-211`｜分支 `fix/s3-211-path-sanitize-rootfix`（基线 `c0f9cf39`）
> 汇报人：阿坚（后端／CI）｜2026-10-16
> **本单不 push、不开 PR、不改 `.github/**`**；最终 CodeQL 判定需合并后的 CI run。

## 〇、结论先行

1. **12 条告警全部在"污染段真正进入路径拼接"的那一行完成根治**：改成
   `resolved = path.resolve(path.join(根目录, 变量段))` + `if (!resolved.startsWith(根目录 + path.sep)) 拒/抛`
   —— 这是 CodeQL `js/path-injection` **建模过**的形态（依据见 §二，附官方 QL 源码与行号）。
2. **行为逐字节不变**：合法输入与全部穿越/编码/绝对/空段/Unicode 载荷，落点、落盘名、返回码与改造前一致（§四，实测）。
3. **校验是承重的**：反测矩阵 M1/M2/M3 实测"去掉校验 ⇒ 载荷真的跑到根目录外；复原 ⇒ 拒"（§五，含 SHA256 还原证据）。
4. **门禁全绿**：全量 vitest `669 文件 / 8091 用例 0 失败`、`tsc --noEmit` 0、5 条 guard + `guard-rbac-wiring --strict` 全 `EXIT=0`、backend build `EXIT=0`、lint 0 error（§六）。
5. **两处与卡面字面不一致，已在 §七 显式报备**：① `shared/zip.ts` 本体不加校验（纯工具，根目录只有调用方知道）；② 卡面写"miniapp-upload.service.ts（9 条）"，实测该文件是 **8 条**（合计仍是 12 条）。

## 一、交付物（全部在工作树，**未提交、未 push、未开 PR**）

| # | 文件 | 变更 | 说明 |
|:--:|:--|:--|:--|
| ① | `backend/src/controllers/admin/avatar.controller.ts` | +8/−1 | 落盘前归一 + 校验（告警 265） |
| ② | `backend/src/controllers/admin/product-image.controller.ts` | +9/−1 | 同上（告警 266） |
| ③ | `backend/src/services/admin/miniapp-upload.service.ts` | +16/−2 | `keyFilePaths()` 两处归一 + 校验，覆盖 8 条告警（267–274） |
| ④ | `backend/src/services/admin/miniapp-package.service.ts` | +8/−1 | zip 输出路径归一 + 校验（告警 275/276 的污染源头） |
| ⑤ | `backend/src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts` | 新增（10 用例） | ①行为对照 + ②承重性探针 |
| ⑥ | `docs/evidence/S3-211/**` | 新增 | 本证据包（判据装置 / 反测矩阵 / 原始日志 / 官方 QL 源码引用） |

> 工作树里的 `node_modules` / `backend/node_modules` 是指向主检出 `D:\Users\ZXQL\ZXQL-MS\wen-ssystem` 的 **junction**（仅为在本工作树跑门禁，`node_modules` 已被 gitignore；未改主检出任何文件）。

## 二、为什么这样改 CodeQL 会认得（机制依据，可逐条复核）

依据文件已随包存档：`ref/codeql-TaintedPathCustomizations.qll`（`js/path-injection` 的净化模型）、
`ref/codeql-StringOps.qll`（守卫极性）、`ref/codeql-BarrierGuards.qll`（守卫→屏障节点的推导）。

### 2.1 被净化的表达式 = `path.resolve(...)` 的**第 0 个实参**（或其中 `path.join` 的**最后一个**实参）

`ref/codeql-TaintedPathCustomizations.qll:627-674`（`RelativePathStartsWithSanitizer`）：

```
627:  class RelativePathStartsWithSanitizer extends BarrierGuard {
632:    RelativePathStartsWithSanitizer() {
633:      (member = "relative" or member = "resolve" or member = "normalize") and
635:      pathCall = NodeJSLib::Path::moduleMember(member).getACall() and
637:        startsWith.getBaseString().getALocalSource() = pathCall      // 被检查的字符串就是 resolve 的结果
649:    override predicate blocksExpr(boolean outcome, Expr e) {
654:      not member = "relative" and
655:      e = this.maybeGetPathSuffix(pathCall.getArgument(0)).asExpr()  // ← 净化的是 resolve 的**第一个实参**
656:      outcome = startsWith.getPolarity()
664:    private DataFlow::Node maybeGetPathSuffix(DataFlow::Node e) {
666:      exists(DataFlow::CallNode call | call = ...moduleMember("join").getACall() and e = call | result = call.getLastArgument())  // ← 若该实参是 join，则净化 join 的最后一个实参
```

⇒ 两个硬性写法要求（本单全部满足，见 `harness/codeql-path-sanitizer-predicate.mjs` 的机器核对）：

1. 校验的基串必须是 `path.resolve(...)` 的**结果变量**（`!resolved.startsWith(根目录 + path.sep)`）；
2. **用户可控段必须是变量/属性访问，且是 `path.join(根目录, 段)` 的最后一段**——否则这段是"内联表达式"，抓不到 AccessPath，判据不生效。

### 2.2 `if (!x.startsWith(...))` 这种"负向守卫"同样被认

`ref/codeql-StringOps.qll:23-28,47-52`：`x.startsWith(y)` 的 `getPolarity() = true`；被 `!` 包一层后极性翻转为 `false`
（注释原文："If the polarity is `false` the check returns `true` if the string does not start with …"）。
而 `blocksExpr(outcome = startsWith.getPolarity())`（qll:656）中的 `outcome` 是**守卫表达式在该分支的取值**：
极性 `false` 对应"`!startsWith` 为假"的那一支，也就是 `if (!…) { 拒 }` **之后**的落空分支 —— 正是我们放落盘语句的地方。

### 2.3 守卫必须与"被阻断的那个使用"在同一函数内；但 sink 可以在别的函数

`ref/codeql-BarrierGuards.qll:380-393`（`barrierGuardBlocksNode`）把屏障落到
`barrierGuardBlocksAccessPathUse` 推导出的**节点**上；而 `:196-222`（`ConditionGuardDominators`）用的是同函数基本块支配关系
（`getDominatingCondition(bb)`）。⇒ 结论：

- `path.resolve(path.join(...))` 与 `if (!resolved.startsWith(...))` **必须写在同一个函数里**（本单 ③ 的 8 条写在
  `keyFilePaths()` 内、④ 写在唯一生产调用方内）；
- 屏障是**节点属性**，一旦建立，**跨函数的下游**（`uploadKey/getKeyStatus/readDecryptedKey` 的 `fs.*`、
  `shared/zip.ts` 的 `fs.mkdirSync/fs.writeFileSync`）一律被截断 ⇒ 这些 sink 无需各自再写一遍校验。

### 2.4 为什么自研净化不被认（本单要根治的原因）

CodeQL 认的是"建模过的**形态**"（`resolve+startsWith` / `is-path-inside` / `..`-过滤 / 白名单成员测试），
**不认函数名**。本仓原来的 `safeSegment` / `safeName` / `ALLOWED_EXT` 是自研净化，工具读不懂 ⇒ 必须靠
S3-208 的逐条 dismissal（人工背书）撑着。本单把这 12 处换成工具自证形态后，**dismissal 不再是唯一依据**。

## 三、12 条告警 → 4 个改造点的映射（告警号取自 `docs/evidence/S3-208/alerts-raw.json`）

| 告警 | 文件:行（`2fe8f109` 时点） | 沉入点 | 用户可控输入 | 改造点 |
|:--:|:--|:--|:--|:--|
| 265 | `controllers/admin/avatar.controller.ts:44` | `fs.writeFileSync(target, …)` | `file.originalname`→白名单扩展名；租户/用户 id | ① 落盘前校验 |
| 266 | `controllers/admin/product-image.controller.ts:41` | 同上 | 同上 | ② 落盘前校验 |
| 267–274 | `services/admin/miniapp-upload.service.ts:132/138/146/150/153/159/168/173` | `fs.writeFileSync` / `readFileSync` / `existsSync` / `statSync` | `req.query.platform \|\| req.body.platform` | ③ `keyFilePaths()` 唯一的路径出口 |
| 275 | `shared/zip.ts:100` | `fs.mkdirSync(path.dirname(zipPath))` | 经调用方 `tenantId` | ④ 调用方（`miniapp-package.service.ts`）的路径拼接点 |
| 276 | `shared/zip.ts:168` | `fs.writeFileSync(zipPath, …)` | 同上 | 同上 |

合计 **12 条**（卡面把 267–274 记为 9 条，实测为 **8** 条；总数与卡面一致）。

## 四、行为对照：改造前后**逐字节一致**（实测，非文字自述）

用例文件：`backend/src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts`（"S3-211 ①" 组，6 例）
做法：把**改造前的公式**（`safeSegment` / `safeName` / `path.join` / `${tenant}-${userId}-${ts}${ext}`）在测试里原样复刻，
冻结 `Date`（`vi.setSystemTime`）与 `Math.random`，对同一组载荷比较**返回值/落盘名的字面量**。

| 站点 | 载荷集 | 对照量 | 结果 |
|:--|:--|:--|:--|
| 头像 | `../../../../s3-211-evil.jpg`、`..\..\s3-211-evil.jpg`、`%2e%2e%2fs3-211-evil.jpg`、`/etc/s3-211-evil.jpg`、空段、`s3-211-头像.jpg`、`../../s3-211-evil.exe` | 落盘名（`tenant-a-7-<ts><ext>`）、状态码（合法 200／白名单外 400）、落点是否在 `storage/avatars` 内 | 全部一致 |
| 商品主图 | 同上 | 落盘名（`tenant-a-<ts>-<rand><ext>`）、状态码、落点 | 全部一致 |
| 密钥 | 段载荷矩阵 9×9（`../..`、`..\..`、`../../../../etc`、`%2e%2e`、空、`…`、中文、`..`、`a/b`） | `keyFilePaths()` 返回的 `keyPath`/`metaPath` 字节 | 81 组全部与改造前公式一致 |
| 代码包 | 真实 `MiniappPackageService.generate()`（mock 库表、真实产物复制 + zip 写入） | 返回的 `fileName`、zip 实际落点 | 与改造前公式一致、落在 `storage/miniapp-packages` 内 |
| 图片目录 | 载荷矩阵 | `path.resolve(path.join(dir,name))` vs `path.join(dir,name)` | 同值（证明"加 resolve"本身是等价变形） |

## 五、反测：**去掉校验 ⇒ 能穿越；复原 ⇒ 拒**（装置 + 原始日志）

装置：`harness/antitest-remove-guard.mjs`（在工作树上**机械注入变体 → 跑探针 → 按字节还原并校验 SHA256**，还原不一致直接非零退出）。
原始日志：`outputs-F1-antitest-matrix.log`。

| 变体 | 说明 | 头像 | 商品主图 | 密钥 | 代码包 | 判据 |
|:--|:--|:--:|:--:|:--:|:--:|:--|
| **M0** | 基线（修复后最终形态） | 绿 | 绿 | 绿 | 绿 | — |
| **M1** | 只摘 `startsWith` 校验 | **红** | **红** | 绿 | 绿 | PASS（实拍穿越落点：`storage/s3-211-evil-av-7-<ts>.jpg`、`storage/s3-211-evil-img-<ts>-<rand>.jpg`） |
| **M2** | 摘校验 **+** 摘前置净化 | **红** | **红** | **红** | **红** | PASS（密钥穿到 `%LOCALAPPDATA%\s3-211-escaped-x.key`；代码包穿到 `storage/s3-211-evil-pkg-<ts>.zip`） |
| **M3** | 只摘前置净化（校验留着） | 绿 | 绿 | 绿 | 绿 | 校验单独就能拦住**原始**分隔符段（抛错/压缩回根目录内） |

还原证据（同一日志尾部）：4 个源码文件 SHA256 **逐一 `OK <前16位> == <前16位>`**（`6e95e20c7541a40a` / `ceb941fb3215b7d1` /
`240a8577a87678bf` / `db5c6cbfbe380319`），且变体期间产生的探针文件（`s3-211-evil*` / `s3-211-escaped*`）已全部清理。

> 口径说明（不掩盖差异）：**密钥 8 条、代码包 2 条**的"第一道防线"是各自的前置净化（`safeSegment` / `safeName`），
> 只在 M1 下不穿越；M2/M3 才把这 10 条区分开 —— 即：**把这 10 条的真·承重层与新增校验分清了**，而不是把"校验装上"当成"问题已消失"。
> 头像/商品主图 2 条没有前置净化（租户/用户 id 直接进路径），M1 即穿越 ⇒ 新增校验是它们的唯一防线。

## 六、门禁（本工作树实跑；日志同目录 `outputs-gate-*.log`）

| 门禁 | 命令 | 结果 |
|:--|:--|:--|
| 全量测试 | `cd backend && npx vitest run` | **669 文件 / 8091 用例，0 失败，EXIT=0**（`outputs-gate-vitest-full.log`） |
| 类型 | `cd backend && npx tsc -p tsconfig.json --noEmit` | **EXIT=0** |
| 构建 | `npm --workspace backend run build` | **EXIT=0**（804 文件、1904 处 ESM 扩展名修复） |
| 静态门禁 | `guard-route-auth` / `guard-tenant-status` / `guard-tenant-injection` / `guard-route-prefix` / `guard-utf8-encoding` | 逐个 **EXIT=0** |
| 台账门禁 | `node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=0** |
| lint（CI 同名步骤） | `npm --workspace backend run lint` | **0 error**（166 warning，与基线同量级） |
| 本单判据（形态） | `node docs/evidence/S3-211/harness/codeql-path-sanitizer-predicate.mjs` | **EXIT=0**（4/4 落点命中，`outputs-F1-predicate-after.log`） |

源码/产物哈希：`outputs-src-dist-sha256.txt`。

## 七、未完成与阻塞 / 与卡面字面不一致（显式报备）

1. **CodeQL 复跑只能等 CI**：CodeQL 仅由 `push` / `PR` / `schedule` 触发，本单被禁止 push/开 PR ⇒ 本地无法取得"12 条消失"的最终证据。
   替代证据＝① 官方 QL 源码逐行对齐（§二）+ ② 机器核对形态（§六末行）+ ③ 反测矩阵（§五）。**终局判据：合并后新 run 的 `js/path-injection` 应从 12 降到 0，且 4 个文件不再出现该查询告警。**
2. **`shared/zip.ts` 本体未加校验**（告警 275/276 的落点在该文件）：`zipDirectory(srcDir, zipPath)` 是**纯工具**，它自己无法知道"允许写到哪个根目录"；
   若在函数内用 `path.dirname(zipPath)` 当基准，那是**同义反复的假校验**（任何路径都满足"在自己目录内"），既骗不过审阅、也不具备安全意义。
   ⇒ 校验改在**唯一生产调用方**（`miniapp-package.service.ts`，根目录 `getStorageDir()` 为服务器侧派生）的拼接点完成；屏障节点建立后跨函数截流，`zip.ts` 两个 sink 同样被覆盖（依据 §2.3）。
   **若凌舟要求改在 `zip.ts` 内，需先裁定"根目录由谁提供"（建议给 `zipDirectory` 增加 `allowedBaseDir` 必填参数——那会改 `shared/` 的对外签名并需同步 `zip.test.ts`），本单未擅自扩面。**
3. **卡面计数偏差**：卡面写 `miniapp-upload.service.ts（9）`，实测该文件 **8 条**（267–274），`zip.ts（2）`＋两个控制器（各 1）⇒ 合计 **12**，与卡面总数一致。
4. **`.github/**` 未改**（卡面红线）、`deploy/**` 未改、`R101-收口总清单.md` 未改、生产库零写操作。
5. **新增 1 个测试文件**（卡面 diff 白名单未列）：把"行为逐字节一致 + 校验承重"钉成可复跑回归；若不接受可单独 revert（不影响 4 处源码改造）。

## 八、复跑指令（照抄即可）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-211
# 形态判据（4/4 落点）
node docs/evidence/S3-211/harness/codeql-path-sanitizer-predicate.mjs
# 反测矩阵（M0/M1/M2/M3，含 SHA256 还原校验；EXIT=0 = 判据成立）
node docs/evidence/S3-211/harness/antitest-remove-guard.mjs
# 单文件回归（行为对照 + 承重性探针）
cd backend; npx vitest run src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts
```
