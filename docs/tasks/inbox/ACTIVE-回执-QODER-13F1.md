# ACTIVE-回执-QODER-13F1 · pin-ssl 文件头过期文案修正

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13F1
> 十项全文回传：`docs/tasks/cards/R101-QODER-13F1-回传.md`｜证据：`docs/evidence/qoder-13f1/**`
> 任务书原件与 `docs/tasks/inbox/ACTIVE.md`：**只读未动**；本回执为新增文件，不改他人行。
> 以下全部是**执行方自评**与卡片目标读数的对照，不含任何归属验收方的判词。

## 人读摘要

卡 §二 的两个动作全部完成，范围锁死在**两行注释**（`pin-ssl.ts` 净变化 `+2/-2`，文件仍 268 行）：

1. **`:6` 改后原文**：
   `* - PINNED_CERTS 在册指纹已更新为 2026-10-21 现网 Let's Encrypt 值（api.onepan.cn 叶子 2026-11-11 到期、m.onepan.cn 叶子 2026-12-22 到期，均在有效期内）；本模块仍未接线，且仍未接线的原因已不是"在册指纹已过期"，而是下文"原生层证书回调可用"这一前置尚未满足；`
2. **`:28` 改后原文**：
   `* - 已配置生产证书实际指纹（api.onepan.cn 叶子 2026-11-11 到期、m.onepan.cn 叶子 2026-12-22 到期，中间证书 Let's Encrypt YE2/YE1 2028-09-02 到期）；叶子证书轮换（命中到期前 30 天提醒窗口即应启动）时必须同步更新在册叶子证书指纹`
3. **未动区**：`PINNED_CERTS` 四条指纹常量、`installSslPinning()` 调用点（仍 0）、`validateCertificate` 等实现逻辑一字未动；代码改动面 = 卡点名 1 文件 + 承载静态断言的 `app-mobile/tests/storage-crypto.spec.ts`。
4. **卡内一处内部矛盾（已按负责人下发口径处理，未自行扩大范围）**：§三 同时要求「反测恢复旧文案 ⇒ 静态断言红」与「test 5/56 不升不降」。现场核对基线 `597230c4`：`app-mobile/tests` 5 个 spec 对 pin-ssl 家族符号（`pin-ssl` / `PINNED_CERTS` / `installSslPinning` / `validateCertificate`）**全部零命中**，全仓除 `src/config/env.ts:8` 一行注释外无人引用它（逐文件读数见 `raw/07`）。⇒ 新增 spec 或新增 `it` 必然把 56 抬上去；不新增则当场没有断言可红，两条字面互斥。落法：**不新增 spec 文件、不新增 `it`**，把三条静态断言追加进既有 `it`「tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）」的断言列表 ⇒ 用例数 5/56 不变、`gates-baseline.json` 一字不动（与 14F1/15F1 等不同，本卡不抬 tests）。选择该宿主的理由与矛盾全文见回传卡 §五.1–5.2。

## 判据自评

| 卡 §三 判据 | 目标读数 | 实测（执行方自评） | 证据 |
|---|---|---|---|
| `rg -in '2026-09-15\|trustasia' app-mobile/src/utils/pin-ssl.ts` | 0 命中 | **0 命中**（RG_EXIT=1；先 `export MSYS2_ARG_CONV_EXCL='*'`） | `raw/03` |
| `installSslPinning(` 调用点 | 仍为 0 | **0**（rg 3 处命中 = 定义 `:200` + 注释 `:7`/`:197`，逐处定性；另用同语义机检扫全 src 得 `[]`） | `raw/03` |
| `npm run type-check` | EXIT=0 | **EXIT=0**（vue-tsc 0 条 = 基线 0 条） | `raw/21`、`raw/31` |
| `npm run lint` | EXIT=0、不劣化 | **EXIT=0**，error 20（基线 20）/ warning 12872（基线 12872），与改动前逐位相同 ⇒ **未调基线** | `raw/22`、`raw/00` |
| `npm run test` | EXIT=0、**5/56 不升不降** | **5 文件 / 56 用例，EXIT=0**（改动前后同读数） | `raw/23`、`raw/00`、`raw/31` |
| `npm run check:contract` | EXIT=0 | **EXIT=0**（差集 1 条 / 具名豁免 1 条，同基线） | `raw/24` |
| 反测恢复旧文案 ⇒ 静态断言红；复原 SHA256 一致后复绿 | 能红、能自复原 | **达成**：三条断言红点各自钉到 `spec:75` / `:76` / `:77`；四份红档"注入前 SHA = `cp` 复原后 SHA"= `cb27d321…408889`；复原态复跑 5/56 EXIT=0 | `anti/*` |

反测四轮（均走树外 `.mjs`、latin1 字节精确、命中 ≠1 即 `exit 9`、`cp` 复原、未用 `sed -i`）：
`date`（卡点名的 :6 旧文案原样注回 ⇒ 断言① 红）、`trustasia` 首轮（注入串同时含两个 token ⇒ 红点错位到断言①，日志按"证据不覆盖历史"留档）、
`trustasia2` 更正轮（只注入 `TrustAsia` ⇒ 断言② `spec:76` 红 ⇒ 复原 ⇒ SHA 一致 ⇒ 复跑绿）、`callsite`（注入真实调用点 ⇒ 断言③ `spec:77` 红 ⇒ 复原 ⇒ SHA 一致）。

提交：`597230c4`（卡基线，未 rebase、未切分支）→ `d9151ae5` 实现笔（只含 `pin-ssl.ts` 与 `storage-crypto.spec.ts`，逐文件 add）→ 本 docs 笔（回传卡 + 回执 + 证据树），共 2 笔。

## 未验清单

- **APP-PLUS 真机 TLS 握手 / 原生层证书回调**：**未验**。本卡无接线（`installSslPinning()` 调用点仍为 0），谈不上运行时验证；无 HBuilderX 真机、无 iOS/Android/微信开发者工具，也没有可取证的手段。
- **现网证书此刻是否仍是在册四条**：**未验**。本卡未联网重采；注释里的 `2026-11-11 / 2026-12-22 / 2028-09-02` 是**复述** `docs/evidence/qoder-13/raw/01|02-pin-spki-*.log` 在 2026-10-21 01:46/01:47 的采集读数（当时 api 叶子剩 22 天，命中 30 天提醒窗口 WARN）。复现：`bash app-mobile/scripts/pin-spki.sh api.onepan.cn`。
- **H5 / 小程序端行为**：**未验**（无运行时变更；非 APP-PLUS 分支恒返回 false，未新增验证）。
- **构建（`build:h5` / `build:app`）**：**未跑**（卡未要求）。
- **同族遗留过期表述未动（如实报备）**：`app-mobile/src/config/env.ts:8` 仍写"…当前未接线（全仓零调用点，**且指纹已过期**）"，与本卡 `:6` 是同一条假话；`app-mobile/docs/pin-ssl指纹维护口径.md`、`docs/踩坑日志.md`、`app-mobile/docs/移动端全面审查清单与修复方案-2026-10-18.md`（MO-13）等历史文档亦仍含该表述。卡 §二 只点名 `pin-ssl.ts:6/:28`，按"没有问题的地方禁止私自修改"一律未动，全仓命中面已登记在 `raw/08`，建议另裁一行式追单。

## 阻塞

无。

===DSH-RECEIPT-BEGIN===
id: QODER-13F1
status: done-self-assessed
summary: pin-ssl.ts 文件头 :6/:28 两处"2026-09-15 过期/到期"假话改真（在册指纹=2026-10-21 现网 Let's Encrypt 值，api 叶子 2026-11-11、m 叶子 2026-12-22、中间 YE2/YE1 2028-09-02，仍未接线并纠正"未接线原因不再是过期"）；指纹常量与 installSslPinning 调用点(0)一字未动；卡 §三「静态断言可红」与「test 5/56 不升不降」内部矛盾已报备，并按不新增 spec/不新增 it、把三条静态断言追加进 storage-crypto.spec.ts 既有 it「tag 校验失败即抛…」的方式化解
worktree: D:\Users\ZXQL\wt-agents\QODER-13
branch: fix/qoder-13f1-pin-comment-refresh
commits: 基线 597230c4（未 rebase/未切分支/未改历史）→ 实现笔 d9151ae5（fix: 只含 app-mobile/src/utils/pin-ssl.ts 两行注释 +2/-2 与 app-mobile/tests/storage-crypto.spec.ts 静态断言；逐文件 add）→ docs 笔（docs: 回传卡 + 本回执 + 证据树）；共 2 笔，见 git log --oneline 597230c4..HEAD
gates: type-check EXIT=0（vue-tsc 0 条=基线 0 条）／lint EXIT=0（error 20=基线 20·warning 12872=基线 12872·无劣化·未调基线）／test EXIT=0（5 文件/56 用例·不升不降·gates-baseline.json 一字未动）／check:contract EXIT=0（差集 1·具名豁免 1）；判据 rg -in '2026-09-15|trustasia' pin-ssl.ts = 0 命中（RG_EXIT=1）、installSslPinning( 调用点 = 0；反测三红点分别钉到 spec:75/:76/:77，四份红档注入前=cp 复原后 SHA=cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889，复原态复跑 5/56 EXIT=0
redlines: 未 push／未开 PR／未 git add -A（逐文件 add）／未 rebase·未改历史·未切分支／未 npm install·未改 package.json 与 lockfile／未动 gates-baseline.json（tests 不抬）／未接线（installSslPinning 调用点 0）／未改任务书原件与 docs/tasks/inbox/ACTIVE.md／上一轮 docs/evidence/qoder-13/** 与其回传卡与回执一字未改（git diff 0 行）／backend 零改动／只动本工作树（注入脚本与备份在 _scratch/qoder-13f1）／全文只写执行方自评与卡片目标读数，不写归属验收方的判词
evidence: docs/evidence/qoder-13f1/**（README；raw：00 改动前四门基线、01/02 文件头前后 30 行与 SHA、03 两条 rg 判据原文与逐处定性、05 头 30 行 unified diff、06 改动面 diff、07 卡内矛盾现场核对、08 全仓剩余命中面+rg 取反 glob 假 0 命中陷阱、21-24 改动后四门、30 收尾自检、31 实现笔后四门终态复跑；anti：date/trustasia/trustasia2/callsite 四份红档 + 复原绿档 + 两份 .note.txt 说明；无零字节文件，raw/04 编号空缺已在 README 说明）
return_card: docs/tasks/cards/R101-QODER-13F1-回传.md
===DSH-RECEIPT-END===
