# R101-QODER-12-回传 · pin-ssl 指纹维护口径文档 + pin-spki.sh 只读采集脚本（本卡不接线）

> 回传人：**Qoder（移动端执行方）**｜回传日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-12-pinssl指纹口径.md`｜工作树 `D:\Users\ZXQL\wt-agents\QODER-12`｜分支 `docs/qoder-12-pinssl-runbook`
> ⚠️ 本卡是**执行方回传**，不含任何裁定性结论；合并与验收归派单人。本卡**零接线**：`app-mobile/src` 全集 diff = 0 行（§六）。

## 〇、基线与提交

- 基线 = **`844515d5`**（任务书口径：#368 链尖端，卡 1~7+9；含 pin-ssl 现状注释与卡 5 回传），按简报指令 `git worktree add -b docs/qoder-12-pinssl-runbook` 建栈。
- `git merge-base origin/main HEAD` = `be7a9492`；本卡增量 = merge-base..HEAD 中 `844515d5..HEAD` 两枚提交。
- 提交（本地，**未 push、未开 PR、未 `git add -A`**，逐文件 add）：
  1. `0a6dc7f6` `docs: QODER-12 新增 app-mobile/docs/pin-ssl指纹维护口径.md`
  2. `481da38f` `chore: QODER-12 新增 app-mobile/scripts/pin-spki.sh`
  3. 本卡 + 回执 + `docs/evidence/qoder-12/**`（第三枚，哈希见分支尖端）
- node_modules 按简报建 junction（`mklink /J`）；本卡交付为文档 + bash 脚本，未跑 node 门禁（如实登记，非缺口）。

## 一、交付①：口径文档 `app-mobile/docs/pin-ssl指纹维护口径.md`（111 行）

任务书 §一.1 五条 × 简报追加项逐条覆盖，每条标注 **A/B/C** 取证等级（A=本机 2026-10-20 亲手复跑，B=读码/读档定位行号，C=待核实、未写成定论）：

| 节 | 覆盖点 | 取证等级 |
|:--|:--|:--|
| §一 谁负责更新 | 在册角色实名分工：移动端执行方（Qoder）采指纹+改码+提 PR；运维/后端侧轮换生效前知会送链；派单人（凌舟）按 AGENTS.md 铁律负责审计与合并（**不代裁**）；督办机制无自动装置 ⇒ **C** 不得当定论 | B（R101-QODER-5 §二、根 AGENTS.md） |
| §二 从哪取 | 任务书原式 `s_client→x509 -pubkey→pkey -outform der→dgst -sha256 -binary→base64` 完整链（叶子原式 + 中间 awk 取链内第 2 张 + 到期日），**本机复跑与脚本读数字节一致**；双指纹成对理由：中间 CA 指纹使叶子短周期轮换（实测剩余 23 天）不断连、CA 整体切换过渡、不 pin 根；**实测佐证两域名中间不同条（YE2/YE1），禁止跨域名抄同一条**；§二.3 在册 vs 现网四条指纹对照表 | A（run-raw-openssl-chain.log / run-*.log） |
| §三 何时更新 | 域名变更 / 证书变更 / **`validTo ≤ 30d` 触发口径逐条可判定**：当前手段=人工跑脚本（脚本自动 WARN，A：api 叶子当日命中窗口实际打出），接线后 release 前置门禁为后续卡交付物（**当前不存在，标 C**；`validateCertificate` 从不比对 validTo，B：pin-ssl.ts:150-180）；月度节拍留痕（C：是否并入发版检查待裁） | A/B/C 分注 |
| §四 同 PR 纪律 | 简报与任务书两口径**叠加执行**：轮换 PR=新旧指纹**并存** + 每条形如 `{ 'sha256/…=', // 备注 }` 注释（签发方+到期日）+ **指纹与接线状态注释同 PR 一起改**（禁止拆笔造成"码与注释互相说谎"，本仓 MO-12/13 教训）；观察期后**第二笔 PR 只删旧**（阈值标 C）；H5/小程序不受影响（B：pin-ssl.ts:237-240） | B |
| §五 失效表现与回滚 | 三态分明：① **当前未接线**⇒ 指纹过期**不发作**（但注释已腐化，A 级对照表为证）；② 一旦接线+指纹过期 ⇒ `valid:false` 全量拒连事故形态（不许静默放行，反测口径引用 QODER-5 双前置：①新指纹采齐在线验通过 ②原生层回调可用可控——②现运行时不可用，B：pin-ssl.ts:207-231；真机行为 C）；③ **回滚顺序固定**：应急开关 `{pinning:false}`（秒级免发版，B：pin-ssl.ts:101-119）→ 摘接线提交（小时级）→ 修指纹随版（慢路径，禁止作止血首选）→ 复核恢复。**开关对原生接线路径是否生效 = C**，接线卡须反测 | A/B/C 分注 |

## 二、交付②：脚本 `app-mobile/scripts/pin-spki.sh`（119 行，只读）

- **只读承诺**：不写任何文件、不改任何代码、不接线；全部输出走 stdout/stderr；默认域名 `api.onepan.cn` 系**字面抄录** `env.ts:16` 的 `API_BASE_NATIVE` 回退值并在脚本头注明只读取参考。
- 功能：`openssl s_client -showcerts` 取链 → awk 内存分块（无临时文件）→ 打印**叶子+中间**两条 `SPKI SHA-256 base64` + `notAfter` + 剩余天数（≤30 天 WARN）；退出码 0/1/2/3/4 全定义。
- **真跑读数（2026-10-20，本机有网）**：
  - `bash -n` EXIT=0；
  - `api.onepan.cn`：**EXIT=0**，链 4 张取 2 条——叶子 `sha256/Y/uy8CcE…fcHs=`（LE，notAfter 2026-11-11，**剩余 23 天 ⇒ WARN 命中**）、中间 `sha256/s/tdAOmU…U3Y=`（YE2，2028-09-02）；
  - `m.onepan.cn`：**EXIT=0**，叶子 `sha256/rH0oqsRg…1M4=`（CN=admin.onepan.cn、SAN 含 m，2026-12-22）、中间 `sha256/brzvtCEL…oB4=`（YE1）；
  - **失败路径反测**：`qoder-12-no-such-host.invalid` ⇒ **EXIT=2** + 清晰错误（DNS/无网/握手失败归类），未写文件（"门能红"替代项，见 §四）。
- **A 级新事实（登记）**：`pin-ssl.ts` 在册 4 条指纹（TrustAsia，2026-09-15 到期）**与现网全部失配**——生产链已换成 Let's Encrypt 且 CA、中间条目均不同；api 叶子距到期 23 天已入 30 天窗口。因未接线不发作（§一-⑤①形态），但坐实"过期指纹接线即全量拒连"。

## 三、判据自评（任务书 §二 三条）

| # | 判据 | 结果 | 证据 |
|:--|:--|:--|:--|
| 1 | 文档 5 节齐全 | ✅ §一~§五 对应任务书 1~5 条，简报追加项全覆盖，逐条 A/B/C 标注 | 文档本体 |
| 2 | 脚本 `bash -n` 过 + 有网真跑原始输出 | ✅ EXIT=0 + 两域名真跑 + 失败路径 EXIT=2（比任务书"无网给退出码 1"口径**更细**：本脚本连接类失败统一 2、1 留给缺 openssl；差异报备 §五③） | `bash-n-syntax.log`、`run-api.onepan.cn.log`、`run-m.onepan.cn.log`、`run-failure-path-exit2.log`、`run-raw-openssl-chain.log`、`run-help.log` |
| 3 | `pin-ssl.ts` 零改动（git diff 证明） | ✅ `git diff 844515d5..HEAD -- app-mobile/src` = **0 行**（含 pin-ssl.ts 单独 --stat 空） | `pin-ssl-zero-diff.log`、`diff-app-mobile-src.raw`（0 字节，配 note.txt） |

## 四、"门能红"替代项（本卡无门禁交付，如实说明）

本卡不新增门禁/CI 步骤（任务书未要求），按简报口径以**脚本失败路径真跑**替代：注入不可解析域名 ⇒ `pin-spki.sh` **EXIT=2**、stderr 点名原因、全程未写文件（`run-failure-path-exit2.log`）。exit 3（链不足 2 张）与 exit 4（解析失败）路径**未找到现网样本真跑**，逻辑就位但如实登记为未取证（C），不谎称全路径已验。

## 五、口径偏差报备（任务书/简报 vs 执行事实）

1. **路径**：简报写 `scripts/pin-spki.sh`、文档默认 `docs/tasks/runbook/…`——任务书明确为 `app-mobile/scripts/pin-spki.sh` 与 `app-mobile/docs/pin-ssl指纹维护口径.md`，**按任务书执行**（简报自认"任务书为准"）。
2. **默认域名**：任务书 §一.2 默认 `api.onepan.cn` 与 env.ts 字面量一致，无偏差；脚本头已注"只读用途、env.ts 变更须同步"。
3. **失败退出码**：任务书括注"不联网则退出 1"，简报要求"非零退出与清晰错误"；脚本把 1 保留给依赖缺失、连接/握手失败用 2（均非零）。若验收坚持字面"无网=1"，改一行映射即可，本卡按更细粒度交付并报备。
4. **轮换 PR 语义**：简报"指纹+接线状态同 PR 一起改"与任务书"新旧指纹同 PR 并存、观察期后删旧"**不冲突**，§四按两阶段叠加（并存 PR + 清旧 PR）书写。
5. **基线**：任务书写"origin/main 的 #368 分支尖端"，简报给 `844515d5` 同义（卡 1~7+9 链尖）；本卡即栈于 `844515d5`，merge-base `be7a9492` 留档。

## 六、红线对照

- **`pin-ssl.ts` 零改动**：`git diff 844515d5..HEAD -- app-mobile/src` = **0 行**（命令+输出+0 字节 raw 配 note 全落盘）。
- 改动全集 = `app-mobile/docs/pin-ssl指纹维护口径.md`（新增）+ `app-mobile/scripts/pin-spki.sh`（新增）+ `docs/evidence/qoder-12/**` + 本卡 + `docs/tasks/inbox/ACTIVE-回执-QODER-12.md`；**未 push、未开 PR、未 `git add -A`（逐文件 add）**；未触碰 QODER-10/11 工作树；任务书原卡未动未归档（归档责任在派单方，简报未授权）。
- 无"裁定/验收结论"字样；0 字节证据配 `.note.txt`（diff-app-mobile-src）；所有原始输出落盘。

## 七、未完成与阻塞

无阻塞。留给后续卡（均已在文档标 C/§六 登记）：接线实施与双前置取证（原生层回调真机验证）、`validTo≤30d` release 前置门禁自动化、观察期删除旧指纹的阈值口径、应急开关对原生接线路径生效性反测、exit 3/4 路径补真跑样本。

## 八、风险与自我报备

- 在册指纹与现网**四条全失配**已坐实（A）：若任何代理据在册 TrustAsia 注释推导"现网仍是 TrustAsia"将出错——文档 §二.3 对照表为准，且指纹读数带采集时刻（LE 链 90 天级漂移，引用前重跑脚本）。
- api 叶子 2026-11-11 到期（剩余 23 天）：接线决策若发生在轮换后而未重采指纹，即踩 §五-② 事故形态；本卡仅登记提醒，**不代作发版决策**。
- 脚本 exit 3/4 未现网取证（§四），C 级已标注，未冒充全绿。
- Git Bash 下 rg/openssl 证据均 `MSYS2_ARG_CONV_EXCL='*'` 态产出。

## 九、交付物与证据清单

- 交付：`app-mobile/docs/pin-ssl指纹维护口径.md`（0a6dc7f6）、`app-mobile/scripts/pin-spki.sh`（481da38f）。
- 证据 `docs/evidence/qoder-12/`：`baseline.log`、`bash-n-syntax.log`、`run-api.onepan.cn.log`、`run-m.onepan.cn.log`、`run-failure-path-exit2.log`、`run-raw-openssl-chain.log`、`run-help.log`、`pin-ssl-zero-diff.log`、`diff-app-mobile-src.raw`（0 字节）+ `diff-app-mobile-src.note.txt`。
- 回执：`docs/tasks/inbox/ACTIVE-回执-QODER-12.md`；回传：本卡。

## 十、一行摘要

pin-ssl 指纹维护口径六节定稿（角色实名、任务书原式采集链复跑字节一致、双指纹成对理由+现网四条全失配 A 级对照、30 天触发口径当前=脚本 WARN 已命中 api 叶子剩余 23 天、同 PR 新旧并存纪律、三态失效+先开关后摘线再修指纹的回滚次序，A/B/C 逐条标注）+ `pin-spki.sh` 只读脚本真跑两域名 EXIT=0/失败路径 EXIT=2；`app-mobile/src` diff 0 行，**未接线、未 push、未开 PR**。
