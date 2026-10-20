# QODER-13F1 证据树 · pin-ssl 文件头过期文案修正

> 执行方：Qoder（移动端执行方）｜日期：2026-10-21
> 任务书原件（只读未动）：`wen-ssystem/docs/tasks/inbox/QODER-13F1-pin-comment-refresh.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13f1-pin-comment-refresh`｜基线：`597230c4`
> 本目录**全新建立**；上一轮 `docs/evidence/qoder-13/**` 一字未改（核对见 `raw/30-final-selfcheck.log`）。

## 一、本卡做了什么（范围：两行注释 + 三条静态断言挂进既有用例）

| # | 对象 | 动作 | 证据 |
|---|------|------|------|
| 1 | `app-mobile/src/utils/pin-ssl.ts:6` | 「叶子证书指纹已于 2026-09-15 过期」→ 在册指纹已更新为 2026-10-21 现网 Let's Encrypt 值 + 仍未接线的原因同步纠正 | `raw/01`/`raw/02`/`raw/05` |
| 2 | `app-mobile/src/utils/pin-ssl.ts:28` | 「2026-09-15 到期」→ api 叶子 2026-11-11、m 叶子 2026-12-22、中间 YE2/YE1 2028-09-02 + 轮换提醒口径 | 同上 |
| 3 | `app-mobile/tests/storage-crypto.spec.ts` | 在既有 `it`「tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）」的断言列表末尾追加 3 条静态断言（**不新增 spec 文件、不新增 `it`**） | `raw/06`、`anti/*` |
| 4 | `app-mobile/scripts/gates-baseline.json` | **一字未动**（tests 仍 5/56，与实测一致） | `raw/30` |

指纹常量、`installSslPinning()` 调用点（仍为 0）、`validateCertificate` 等实现逻辑：**未动**（`raw/05` 的 diff 只有 2 行 `-`/`+`，`raw/30` 改动面仅 2 文件）。

## 二、目录清单

```
raw/
  00-prechange-gates-baseline.log   改动前常驻四门全跑（证明改前即绿，作为"不劣化"参照）
  01-before-pin-ssl-head30.log      改动前 pin-ssl.ts 文件头 30 行 + SHA256
  02-after-pin-ssl-head30.log       改动后 pin-ssl.ts 文件头 30 行 + SHA256
  03-rg-judgements.log              卡 §三 两条 rg 判据原文（含 MSYS2_ARG_CONV_EXCL 前置）+ 逐处定性
  05-head30-before-after.log        文件头 30 行 unified diff（基线 597230c4 vs 本次）
  06-diff-scope.log                 改动面 diff --stat 与全量逐行
  07-no-spec-references-pinssl.log  卡 §三 内部矛盾的现场核对（基线上 5 个 spec 对 pin-ssl 零引用）
  08-repo-wide-stale-hits.log       全仓剩余 2026-09-15/TrustAsia 命中面（范围外既存内容，报备未动）+ 一条取证陷阱
  21-gate-type-check.log            改动后门 1
  22-gate-lint.log                  改动后门 2
  23-gate-test.log                  改动后门 3（必须 5/56）
  24-gate-check-contract.log        改动后门 4（文件名去掉冒号，避免 Windows 路径非法字符）
  30-final-selfcheck.log            协议 §7 收尾自检（status/log/改动面/基线与上一轮证据零改动核对）
  31-postcommit-gates.log           实现笔 d9151ae5 落定后常驻四门终态复跑（全 EXIT=0）
anti/
  anti-date-red.log                 注入卡点名旧文案（:6 原样注回）⇒ 断言① spec:75 红 ⇒ cp 复原 ⇒ SHA 一致
  anti-trustasia-red.log            第一轮 TrustAsia 注入（红点落在 :75，未隔离到断言②；见 note）
  attempt1-trustasia-note.note.txt  上述"未隔离"的原因与更正说明（证据不覆盖历史，原样留档）
  anti-trustasia2-red.log           更正轮：只注入 TrustAsia ⇒ 断言② :76 红 ⇒ 复原 ⇒ SHA 一致 ⇒ 复跑转绿
  anti-callsite-red.log             注入真实 installSslPinning() 调用点 ⇒ 断言③ :77 红 ⇒ 复原 ⇒ SHA 一致
  anti-green-after-restore.log      前三轮共用复原态复跑 `npm run test` 转绿（5/56，EXIT=0）
  green-log-note.note.txt           反测时间线更正（四轮均跑在实现笔之前，故 ` M` 不是反测残留）
```

零字节文件：无。`raw/04` 编号空缺：本卡无后端/真机类读数采集，故未开该档。

## 三、判据自评（卡内目标读数 vs 实测）

| 卡 §三 判据 | 目标读数 | 实测 |
|---|---|---|
| `rg -i '2026-09-15\|TrustAsia' pin-ssl.ts` | 0 命中 | **0 命中**（RG_EXIT=1） |
| `installSslPinning(` 调用点 | 仍为 0 | **0**（rg 3 处命中全为定义行/注释，逐处定性见 `raw/03`） |
| 四门 EXIT | 全 0 | 全 **EXIT=0**（`raw/21`–`24`；终态复跑 `raw/31`） |
| test | 5 文件 / 56 用例（不升不降） | **5 / 56**（改动前后同读数，基线未抬） |
| 反测 | 恢复旧文案 ⇒ 静态断言红；复原 SHA256 一致后复绿 | **达成**（三条断言红点分别钉到 `spec:75` / `:76` / `:77`；四份红档"注入前 SHA = cp 复原后 SHA"） |

关键 SHA256：

| 文件 | 改动前（基线 597230c4） | 改动后（= 反测每轮复原后） |
|---|---|---|
| `app-mobile/src/utils/pin-ssl.ts` | `d30998246ba4249a3e64520d06bb6fdcb269b0112853c33f18ee8bf8c65bae2c` | `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889` |
| `app-mobile/tests/storage-crypto.spec.ts` | 未单独采集（可 `git show 597230c4:…` 复取） | `f538c918ce96bcc63b06dcb0ae963280fc70357b21b8926d2acb92dbdb096426` |

以上为**执行方自评**与卡片要求的目标读数对照，不构成验收结论。

## 四、复现命令

```bash
cd D:/Users/ZXQL/wt-agents/QODER-13
export MSYS2_ARG_CONV_EXCL='*'          # 协议 §3：/ 开头模式必需，否则假 0 命中
rg -in '2026-09-15|trustasia' app-mobile/src/utils/pin-ssl.ts    # 期望 0 命中（RG_EXIT=1）
rg -n  'installSslPinning\(' app-mobile/src                      # 期望仅 :7 / :197 注释与 :200 定义 ⇒ 调用点 0
cd app-mobile
npm run type-check && npm run lint && npm run test && npm run check:contract   # 期望全 EXIT=0，test 5/56

# 反测（注入脚本在工作树外；latin1 字节精确；命中 ≠1 即 exit 9 拒写）
node /d/Users/ZXQL/wt-agents/_scratch/qoder-13f1/inject-13f1.mjs --case date    # | trustasia | callsite
npm run test                                                                     # 期望 EXIT=1，点名「tag 校验失败即抛…」
cp /d/Users/ZXQL/wt-agents/_scratch/qoder-13f1/pin-ssl.ts.<case>.bak src/utils/pin-ssl.ts
sha256sum src/utils/pin-ssl.ts                                                   # 期望 cb27d321…408889
npm run test                                                                     # 期望 EXIT=0，5/56
```

## 五、本目录新登记的一条取证陷阱（详见 `raw/08` 开头）

除协议已登记的 `MSYS2_ARG_CONV_EXCL` 成因之外，本机 Git Bash 通道还会把 rg 取反 glob 的感叹号转义成 `\!`，
使「`-g` + 感叹号 + 路径」的写法**退化为正向 glob ⇒ 全量假 0 命中**（同一模式去掉该 glob 实测 134 行命中，带上前缀后 0 行）。
⇒ 本卡所有 0-hit 判据一律不用 `-g` 取反；需要排除目录时改用「全量 rg + `grep -Ev` 管道过滤」。
