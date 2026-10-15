# R101-S3-211-阿坚-回传（第 57 项·乙方案：12 条 `js/path-injection` 换成 CodeQL 已建模形态）

```
【汇报 S3-211】对应派单 S3-211：12 条 `js/path-injection` 已按**乙方案**逐处根治——把净化换成
CodeQL 建模过的 `path.resolve(path.join(根目录, 变量段))` + `if (!resolved.startsWith(根目录 + path.sep)) 拒`，
落在四处"污染段真正进拼接"的点上（四文件 +41/−5）；行为对同一组载荷**逐字节不变**（含穿越/反斜杠/URL 编码/
绝对路径/空段/Unicode/白名单外扩展名）；反测矩阵 M0/M1/M2/M3 实测"去掉校验 ⇒ 载荷跑到根目录外、复原 ⇒ 拒"；
门禁全绿（全量 669 文件 / 8091 用例 0 失败、tsc 0、5 条 guard + `guard-rbac-wiring --strict` 全 EXIT=0、
build 0、lint 0 error）。**未 push、未开 PR、未改 `.github/**`** ⇒ CodeQL 复跑只能等合并后的 CI run，
本地以"官方 QL 源码逐行对齐 + 形态机器核对 + 反测矩阵"三项替代取证。两处与卡面字面不一致已在"未完成与阻塞"报备。

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端／CI）｜2026-10-16
（本会话身份：`/root/s3218_ajian`；按 `docs/tasks/inbox/ACTIVE.md` 路由表接手 S3-211——原 `s3215` 会话零产出）

一、交付物（全部在工作树 `D:\Users\ZXQL\wt-agents\S3-211`，分支 `fix/s3-211-path-sanitize-rootfix`，
    基线 `c0f9cf39`，**未提交、未 push、未开 PR**）
  ① backend/src/controllers/admin/avatar.controller.ts（+8/−1，告警 265）
     SHA256 6E95E20C7541A40AC603308DEEF91F7FA679295DB52F716D3B809A6C483487BA
  ② backend/src/controllers/admin/product-image.controller.ts（+9/−1，告警 266）
     SHA256 CEB941FB3215B7D14B1FF59ABBEC52AB8F3470F4A4C0109C90DB0E6557A0831E
  ③ backend/src/services/admin/miniapp-upload.service.ts（+16/−2，告警 267–274 共 8 条）
     SHA256 240A8577A87678BFF6C56899D0D04F85CB2944364253892C73256251AAF83744
  ④ backend/src/services/admin/miniapp-package.service.ts（+8/−1，告警 275/276 的污染源头）
     SHA256 DB5C6CBFBE380319B48274D7D547871B67A01521F32316EB26929C00A0E4E89B
  ⑤ backend/src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts（新增，10 用例）
     SHA256 7D5ABFD398A284E9EF95554817BAA2B616108E17B51E1447C2819DFE1B0DF7C2
  ⑥ docs/evidence/S3-211/**（README ＋ 两个判据/反测装置 ＋ 原始日志 ＋ 官方 QL 源码引用 ref/）
  dist 产物哈希见 docs/evidence/S3-211/outputs-src-dist-sha256.txt（例：avatar.controller.js
     DFE46657192AA665F19E66D870CBAD983C8F45E33EB2F9885720E9F9EF2D3A6A）

二、证据（可复跑；脚手架**已留档不删**，符合派单规范 §8.9）
  1) 形态（为什么 CodeQL 会认得）：官方 QL 源码逐行对齐——`docs/evidence/S3-211/ref/codeql-TaintedPathCustomizations.qll`
     `RelativePathStartsWithSanitizer:627-674`（净化对象＝`path.resolve` 的**第 0 个实参**，若它是 `path.join`
     则是 join 的**最后一个**实参：`maybeGetPathSuffix:664-673`）、`ref/codeql-StringOps.qll:23-28/47-52`
     （守卫极性：`!x.startsWith(...)` 的命中分支＝写盘所在的落空分支）、`ref/codeql-BarrierGuards.qll:196-222/380-393`
     （守卫条件必须与"被阻断的那个使用"同函数；屏障建立后**跨函数**截流，故 `shared/zip.ts` 的两个 sink 不需各自再写）。
     机器核对：`node docs/evidence/S3-211/harness/codeql-path-sanitizer-predicate.mjs` ⇒ **PASS 4/4 落点**
     （输出 `outputs-F1-predicate-after.log`；要求"用户可控段必须是变量/属性且是 join 最后一段"，四处均满足）。
  2) 行为对照（逐字节一致）：`backend/src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts`（"① 行为对照"6 例）
     把改造前公式在测试内原样复刻（`safeSegment`/`safeName`/`path.join`/`${tenant}-${userId}-${ts}${ext}`），
     冻结 `Date`（`vi.setSystemTime`）与 `Math.random` 后比较字面量：
       头像/商品主图（7 载荷 × 状态码）全部一致；密钥 9×9＝81 组 `keyPath/metaPath` 全部一致；
       代码包真实 `generate()`（mock 库表 + 真实产物复制/zip 写入）返回 `fileName` 与实际落点一致；
       `path.resolve(path.join(dir,name)) === path.join(dir,name)` 对全载荷同值（证明"加 resolve"是等价变形）。
  3) 反测（**去掉 startsWith 校验 ⇒ 能穿越；复原 ⇒ 拒**）：`node docs/evidence/S3-211/harness/antitest-remove-guard.mjs`
     ⇒ **EXIT=0**（日志 `outputs-F1-antitest-matrix.log`），矩阵实测：
       | 变体 | 头像 | 商品主图 | 密钥 | 代码包 |
       | M0 基线 | 绿 | 绿 | 绿 | 绿 |
       | M1 只摘 startsWith | **红** | **红** | 绿 | 绿 |
       | M2 摘校验＋摘前置净化 | **红** | **红** | **红** | **红** |
       | M3 只摘前置净化 | 绿 | 绿 | 绿 | 绿 |
     M1 实拍穿越落点：`backend/storage/s3-211-evil-av-7-<ts>.jpg`、`.../s3-211-evil-img-<ts>-<rand>.jpg`；
     M2 实拍：`%LOCALAPPDATA%\s3-211-escaped-x.key`、`backend/storage/s3-211-evil-pkg-<ts>.zip`。
     装置跑完**按字节还原并校验 SHA256**（4 个文件逐一 `OK <前16位> == <前16位>`），探针产物已清理（同日志尾部）。
  4) 门禁（本工作树实跑；`outputs-gate-*.log`）：
       全量测试 669 文件 / 8091 用例 0 失败 EXIT=0；`npx tsc -p tsconfig.json --noEmit` EXIT=0；
       `npm --workspace backend run build` EXIT=0（804 文件 / 1904 处 ESM 扩展名修复）；
       guard-route-auth / guard-tenant-status / guard-tenant-injection / guard-route-prefix / guard-utf8-encoding
       逐个 EXIT=0；`node backend/scripts/guard-rbac-wiring.mjs --strict` EXIT=0；
       `npm --workspace backend run lint` 0 error（166 warning，与基线同量级）。
     复跑：见 docs/evidence/S3-211/README.md §八（三段命令，照抄即可）。

三、验收自评（逐条对照派单卡 §三）
  1. 12 处逐条改造 + 前后行为对照表 —— **通过**：12 条＝4 个拼接点（README §三 逐条映射告警号/文件:行/沉入点），
     对照表见上"证据 2"，含穿越/反斜杠/编码/绝对/空段/Unicode/白名单外七类载荷。
  2. 反测：去掉校验 ⇒ 能穿越（红）；复原 ⇒ 拒（绿）—— **通过**：M1（头像/商品主图红）＋ M2（四处全红）＋
     M3（只留校验也拦得住原始段），并含 SHA256 还原证据。
  3. CodeQL 复跑后的告警数 —— **未通过（只能等 CI）**：本单禁 push/开 PR ⇒ 以官方 QL 源码对齐 + 形态机器核对 +
     反测矩阵三项替代；终局口径：合并后新 run 的 `js/path-injection` 由 12 降到 0（README §七.1）。
  4. 门禁 —— **通过**：全量 vitest 0 失败、tsc 0、五条 guard ＋ `--strict` 全 EXIT=0、build EXIT=0（另补 lint 0 error）。
  §四 红线 —— **遵守**：未改对外行为（上传落点/命名规则/错误码；唯一新增失败路径见"风险与自我报备"1）、
     未顺手重构、未改 `.github/**`、未改 `deploy/**`、未改 `R101-收口总清单.md`、无生产库写操作。

四、未完成与阻塞
  1) **CodeQL 复跑只能等合并后的 CI**（机制限制：CodeQL 仅 push/PR/schedule 触发；本单被禁 push/开 PR）。
     这不是"我没跑"，是"本地没有可跑的 CodeQL"；替代证据三条已齐，终局判据请以新 run 为准。
  2) **`shared/zip.ts` 本体未加校验**（卡面 §二.1 把 275/276 列在 zip.ts）：`zipDirectory(srcDir, zipPath)` 是纯工具，
     自己不知道"允许写到哪个根目录"；若在函数内拿 `path.dirname(zipPath)` 当基准，那是**同义反复的假校验**
     （任何路径都满足"在自己目录内"）。⇒ 校验改在**唯一生产调用方**（`miniapp-package.service.ts`，根目录
     `getStorageDir()` 服务器侧派生）的拼接点；屏障建立后跨函数截流，zip.ts 两个 sink 同样被覆盖（QL 依据见"证据 1"）。
     **若要求改回 zip.ts 内，需先裁定"根目录由谁提供"**（建议给 `zipDirectory` 增 `allowedBaseDir` 必填参数，
     那会改 `shared/` 对外签名并需同步 `zip.test.ts`）；本单未擅自扩面。
  3) **卡面计数偏差**：卡面写 `miniapp-upload.service.ts（9）`，实测该文件 **8 条**（267–274）；zip.ts 2 ＋ 两控制器各 1
     ⇒ 合计 **12** 条，与卡面总数一致（README §三）。
  4) **未改 `docs/tasks/current-tasks.md`**：AGENTS.md 的子代理回传条款提到同步该文件，但本轮的 S3 编号在
     `docs/tasks/R101-收口总清单.md`（卡面红线禁改），且主检出 `current-tasks.md` 上另有他人未提交改动
     ⇒ 不在本单擅自插段。建议由你在 R101 收口清单里登记 S3-211，并把本卡归档（我这边已把派单卡移入 archive）。
  5) 新增 1 个测试文件（卡面 diff 白名单未列）：用于把"行为逐字节一致 + 校验承重"钉成可复跑回归；若需回退，
     单独 revert 即可，不影响 4 处源码改造。
  6) **未改 `docs/tasks/inbox/ACTIVE.md` 路由表**：该文件本轮已由多会话共用（路由表里 S3-211 一行仍写"在办（`s3215`）"，
     实际交付会话是 `s3218`；S3-212/S3-214 同行在办）⇒ 按"路由文件不得删改他人在办行"的纪律，我只归档了**自己的派单卡**
     （`ACTIVE-S3-211.md` → `archive/ACTIVE-S3-211-20261016.md`）并落了回执，**没有动路由表**；行内状态请你收口时更正。

五、风险与自我报备
  1) **唯一新增失败路径**：段里带路径分隔符时（头像/商品主图是"租户/用户 id"带分隔符；密钥/代码包是"绕过前置净化"
     的原始段），行为由"照旧写盘（但落到根目录外）"变为"400 / 抛错"。这是本单要的效果，但**属可观测变化**，
     请按"红线：不得改变对外行为"确认这是否在你允许的范围内。
  2) **密钥 8 条 / 代码包 2 条的第一道防线仍是前置净化**（`safeSegment` / `safeName`）：M1（只摘校验）实测这 10 条
     **不穿越** —— 别把"告警消失"读成"这两个模块的净化已重构"；新增校验对它们的当前输入是**第二道**＋让工具自证，
     对"未来某天有人把段换成未净化值"则是唯一防线（M3 证明：只留校验也拦得住原始穿越段）。
  3) **本单结论依赖 CodeQL 的 AccessPath 屏障语义**（QL 源码为 2.27.2 一代；`js/path-injection` 查询与 2.27.2
     的 `TaintedPathCustomizations.qll` 对齐）。我把论文式依据（源码行号）与机器核对的"形态判据"都留了档，
     但**本地跑不了 CodeQL** ⇒ 若 CI 复跑仍有残留告警，请把这 4 个文件的行号给我，我按新查询版本再对齐一次。
  4) 我在本工作树建了两个**指向主检出**的 `node_modules` junction（仅为跑门禁；`node_modules` 已被 gitignore，
     主检出零改动）；若要清理，删掉这两个 junction 即可（不要把它们提交进库）。
  5) 反测装置会**临时改写工作树源码**（M1/M2/M3）后按字节还原；还原一致性已由 SHA256 自校验（不通过即非零退出），
     并对"未找到待改片段"直接报错——若你复跑时看到该类报错，说明判据与代码已不同步，请以 README §五 的口径重对齐。
  6) `docs/evidence/S3-211/ref/*.qll` 取自上游 `github/codeql`（main 分支）与 S3-208 已存档的同名文件，
     本 README 行号**以随包副本为准**；它们只作依据引用，不参与构建。

回传要求：本汇报已落卡：docs/tasks/cards/R101-S3-211-阿坚-回传.md（同文另落 docs/tasks/inbox/ACTIVE-回执-S3-211.md）
关联卡：docs/tasks/inbox/ACTIVE-S3-211.md → 已归档 docs/tasks/inbox/archive/ACTIVE-S3-211-20261016.md
```

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端／CI）｜2026-10-16
