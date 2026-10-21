# R101-QODER-13-回传 · pin-ssl 指纹更新 + basis 行号 + `--no-stale` 守卫开关

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13
> 任务书原件（只读未动）：`docs/tasks/inbox/QODER-13-指纹更新与守卫收口.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13-pin-fingerprints-and-guard`

## 〇、基线登记（如实报备）

- 卡内写基线 `dfeedbc0`（#368 squash 合并后的 main）；派单人指令：工作树建于 **`origin/main` = `21b465e5`**（= `dfeedbc0` + 2 笔纯 docs 提交：`97b29f9a`、`21b465e5`），**代码态与 `dfeedbc0` 完全相同**，按「也可在 origin/main 上开工」执行。
- ⇒ 本回传所有"改动面"判据以 `21b465e5..HEAD` 计；相对卡内 `dfeedbc0` 多出的 2 笔是 main 既有 docs，**不属本单改动**，本单未据此调整任何代码基线判断。

## 一、基线与提交

| 项 | 值 |
|:--|:--|
| 开工 HEAD | `21b465e5`（origin/main） |
| 分支 | `fix/qoder-13-pin-fingerprints-and-guard` |
| 实现笔 | 见 `git log --oneline origin/main..HEAD`（提交哈希以收尾自检证据 `docs/evidence/qoder-13/raw/16-final-selfcheck.log` 为准） |
| 改动文件 | `app-mobile/src/utils/pin-ssl.ts`、`app-mobile/src/config/permission-gates.ts`、`backend/scripts/guard-rbac-wiring.mjs`（仅这 3 个，`git diff --stat` = 28+/7-） |

## 二、修法 × 读数总表

| # | 交付 | 判据 | 实测读数 | 自评 |
|:--|:--|:--|:--|:--|
| ① | 换 `PINNED_CERTS` 四条指纹（只改常量+紧邻注释） | `pin-spki.sh` 两域采集 EXIT=0；新值与输出逐字一致；`pin-ssl.ts` 内 `rg -i trustasia` 0 命中 | api/m 两域各采一次均 EXIT=0；`08-new-pinned-certs-values.log` 机器校验 4 条值逐一命中来源域日志（api 值只出现在 api 日志、m 值只出现在 m 日志，禁跨域抄用达成）；`rg -n -i trustasia app-mobile/src/utils/pin-ssl.ts` EXIT=1（0 命中） | 达成 |
| ①b | 不接线 | `installSslPinning()` 调用点 0 | 定义在 `pin-ssl.ts:200` 存在；`rg "installSslPinning" app-mobile/src/ -g '!utils/pin-ssl.ts'` EXIT=1（src 内除定义文件外 0 命中）；全仓其余命中均为文档/证据注释 | 达成 |
| ② | basis 行号 `:64→:67` | `rg -n "aftersale.routes.ts:67" permission-gates.ts` 命中；`:64` 0 命中 | `596: basis: …aftersale.routes.ts:67…` EXIT=0；`:64` 模式 EXIT=1；后端真值 `grep -n confirm-receipt aftersale.routes.ts` = **67** | 达成 |
| ③ | `--no-stale` 开关 | 三态 + 行为隔离反测 | `--strict` EXIT=0；`--strict --no-stale`（现场陈旧 0）EXIT=0；注入 1 条陈旧 ⇒ `--strict --no-stale` **EXIT=1 且点名** `admin-auth.routes.ts\|POST /api/qoder13-antitest/never-exists`，同现场不带开关仍 **EXIT=0**；`cp` 复原 sha256 前后逐字节一致（`05ee3642…43e926`），复跑两态 EXIT=0 | 达成 |
| 回归 | 四门 | 不劣化 | type-check 0=0 EXIT=0；lint error 20/warning 12872（=基线，逐规则不劣化）EXIT=0；test 5 文件/56 用例（=基线 5/56）EXIT=0；contract 差集 1/豁免 1 EXIT=0 | 达成 |
| 回归b | 受影响后端测试 | 两文件全过 | `rbac-g0-wiring.test.ts` 147 过 + `rbac-b2-s3-233-gate-wiring-parity.test.ts` 135 过 = 282 passed，EXIT=0（只跑这两文件，未跑全量） | 达成 |

## 三、逐条实现说明

1. **① 指纹更新**（`app-mobile/src/utils/pin-ssl.ts:74-83`）：用 `app-mobile/scripts/pin-spki.sh`（QODER-12 交付，只读）分别对 `api.onepan.cn`（本机 2026-10-21 01:46:31）与 `m.onepan.cn`（本机 01:47:51）各采一次，均 EXIT=0、对端给出 4 张证书。按域名成对写回四条新值与紧邻注释（CA 名、到期日、采集日 2026-08-11→2026-10-21）。新值（与采集输出逐字一致）：
   - api.onepan.cn 叶子 `sha256/Y/uy8CcEO5D3HHhBa8iBqWJu3uEQwuA1bwRCpuVfcHs=`（notAfter **2026-11-11 22:28:29 GMT**，剩 22 天，脚本 WARN ≤30 天命中）
   - api.onepan.cn 中间 `sha256/s/tdAOmUzd8syaTuqfgGvFcn6DzA5Cmb+Vby1ST+U3Y=`（Let's Encrypt **YE2**，notAfter 2028-09-02）
   - m.onepan.cn 叶子 `sha256/rH0oqsRgfu1hGtbs10FXorbhao99FC99nqVBGmWA1M4=`（CN=admin.onepan.cn·SAN 含 m.onepan.cn，notAfter **2026-12-22 17:07:28 GMT**，剩 62 天）
   - m.onepan.cn 中间 `sha256/brzvtCELCIZUo4sD/qPX0ccRtPsd3DY6RfmxpOU9oB4=`（Let's Encrypt **YE1**，notAfter 2028-09-02）
   - `installSslPinning()` 未被调用（调用点 0，见 `03-rg-trustasia-and-install-callpoints.log`）；脚本输出原文 = `raw/01`、`raw/02`。
2. **② basis 修正**（`app-mobile/src/config/permission-gates.ts:596`）：`aftersale.routes.ts:64`→`:67`，只改这一处；同一对象的 codes/note/status 未动（note 内 `:49/51/69/74` 经复核本就正确）。
3. **③ `--no-stale`**（`backend/scripts/guard-rbac-wiring.mjs`）：新增 `const NO_STALE = args.includes("--no-stale")`（参数解析处）；判红块插在既有 `[--strict] 未登记` 判红之后、`✅ [--strict]` 打印之前——`NO_STALE && 陈旧合计>0` ⇒ 逐条 `console.error` 点名（`文件|METHOD 路径`）后 `exit 1`；不传 ⇒ 不进入新分支，所有既有输出逐字节不变。文件头用法注释同步。**CI 未启用**（未碰 `.github/workflows/**`，git status 证明）。

## 四、测试 / 门读数

- 四门原始输出：`raw/09`（type-check，0=0 EXIT=0）、`raw/10`（lint error 20 / warning 12872 = 基线 EXIT=0）、`raw/11`（test 5/56 = 基线 EXIT=0）、`raw/12`（contract 差集 1/豁免 1 EXIT=0）。
- 后端两测试文件：`raw/07-backend-wiring-tests.log`（282 passed，EXIT=0）。
- guard 三态：`raw/05`（--strict EXIT=0）、`raw/06`（--strict --no-stale 现场态 EXIT=0）、反测三段：`anti/anti-no-stale-full-run.log`（注入→红点名→隔离绿→复原 SHA→复跑绿）。
- `gates-baseline.json` **未动**（本卡不新增测试文件，用例数 5/56 与基线一致）。

## 五、口径偏差报备

1. **「trustasia 0 命中」范围判断**：按派单指令，该判据范围取 `pin-ssl.ts` 文件内（已 0 命中）。全仓其余命中**一律未动**，清单（`rg -i -l trustasia` 现场读数）：`app-mobile/docs/pin-ssl指纹维护口径.md`、`docs/踩坑日志.md`、`docs/tasks/inbox/QODER-13-指纹更新与守卫收口.md`（任务书原件，禁改）、`docs/tasks/inbox/ACTIVE-回执-QODER-12.md`、`docs/tasks/cards/R101-QODER-12-回传.md`、`docs/tasks/cards/R101-QODER-10-11-12-凌舟验收-20261020.md`、本单证据日志自身——均为文档/历史证据，判定不属"只改常量"范围。若凌舟认为判据应覆盖全仓文档，**另行裁定**，本单未擅自执行。
2. **紧邻注释范围**：除四条行尾注释外，同步改了 `PINNED_CERTS` 直接上方的 JSDoc 块（`:68` 采集日、`:72` CA 名——不改则判据①无法达成且注释继续说谎）。**文件头状态块未动**：`:6`「叶子指纹已于 2026-09-15 过期」与 `:28`「（2026-09-15 到期）」两条现随本次更新而**语义过时**（指纹已换成现网 Let's Encrypt 值），但它们不是 PINNED_CERTS 的紧邻注释，且"不接线"总状态未变（`:2-9` 其余论据仍成立）——**遗留为已报备的注释漂移**，接线卡或凌舟裁定后续处理。
3. **基线 2 笔 docs 差异**：见 §〇。
4. **反测第一次尝试无效留档**：注入锚点先按 LF 写而台账实为 CRLF ⇒ scratch 打印 `HIT-COUNT=0` 拒写（未污染任何字节，改前/改后 sha 一致），该无效读数按"证据不覆盖历史"保留于 `anti/attempt1-*.log` + `.note.txt`，有效反测为 `anti/anti-no-stale-full-run.log`。
5. **api 叶子剩余天数**：卡写"剩 23 天"（QODER-12 采集日语境），本单 2026-10-21 采集实测**剩 22 天**，属自然漂移，如实记实测值。

## 六、红线对照

- 未 push、未开 PR、未 `git add -A`（逐文件 add）；
- `installSslPinning()` 调用点保持 0（未接线，§二①b 自证）；
- 只动 `D:\Users\ZXQL\wt-agents\QODER-13`；未触碰其它 wt-agents 工作树与进程；
- 未改任务书原件、未动 `docs/tasks/inbox/ACTIVE.md`、未改 `.github/workflows/**`、未 npm install、未改任何 package.json/lockfile；
- 本文档不含任何「凌舟裁定/验收结论」式判词，所有"达成"均为**执行方自评**。

## 七、未完成与阻塞

无。

## 八、自我报备（含未验清单）与踩坑

- **未验清单（真机/端到端一律未验）**：
  - **真机/小程序端 TLS 行为：未验**——未接线，且 iOS/Android/微信开发者工具侧无取证手段；指纹正确性仅证明"与 2026-10-21 现网链全等"。
  - **现网指纹在接线后的连通性：未验**（接线另裁）。
  - **本单合并前现网若再次轮换：未验**——按维护口径 §二-3，引用前需重跑 `pin-spki.sh` 复核。复现命令：`bash app-mobile/scripts/pin-spki.sh api.onepan.cn` / `… m.onepan.cn`。
- MSYS 路径转换防护已生效（所有含 `/xxx/` 起头 rg 模式前 `export MSYS2_ARG_CONV_EXCL='*'`）；首次取证时误用 `--exclude-dir`（rg 不识别）导致一条命令无效，同场修正为默认排除并留痕。
- 反测锚点 LF/CRLF 失配被 scratch 的"命中数≠1 即 exit 9"守卫生效拦下，零污染——该铁法有效，记入踩坑建议。

## 九、复现命令

```bash
cd /d/Users/ZXQL/wt-agents/QODER-13
export MSYS2_ARG_CONV_EXCL='*'
bash app-mobile/scripts/pin-spki.sh api.onepan.cn   # 对照 raw/01（注意现网轮换后值可能已变）
bash app-mobile/scripts/pin-spki.sh m.onepan.cn     # 对照 raw/02
rg -n -i trustasia app-mobile/src/utils/pin-ssl.ts  # 期望 EXIT=1（0 命中）
rg -n "installSslPinning" app-mobile/src/ -g '!utils/pin-ssl.ts'   # 期望 EXIT=1（调用点 0）
rg -n "aftersale.routes.ts:67" app-mobile/src/config/permission-gates.ts   # 期望命中 596 行
node backend/scripts/guard-rbac-wiring.mjs --strict              # EXIT=0
node backend/scripts/guard-rbac-wiring.mjs --strict --no-stale   # 现场陈旧 0 ⇒ EXIT=0
cd app-mobile && npm run type-check && npm run lint && npm run test && npm run check:contract
```

## 十、对下一单的建议

- 接线卡执行前先做两件事：① 重跑 `pin-spki.sh` 复核四条指纹（api 叶子 2026-11-11 到期，窗口仅 22 天，**合并/发版节奏必须先于该日期**）；② 处理本单 §五-2 报备的文件头注释漂移（`:6/:28` 两行）。
- `--no-stale` 进 CI 的时机 = 全仓陈旧清零那批；启用时建议同时把 `--strict --no-stale` 写进 guard 的门禁脚本注释与本文件头（当前只做了开关本体）。
