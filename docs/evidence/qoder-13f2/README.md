# QODER-13F2 证据树索引

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13F2
> 任务书：`docs/tasks/inbox/QODER-13F2-pin-static-spec-and-env.md`（只读未动）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13f2-pin-static-spec-and-env`｜基线：`61514b02`
> 实现笔：`f4772512`（4 文件 / +93 −53）

## 一、本卡改了什么（一句话）

把 QODER-13F1 混进「GCM tag 校验」用例的 pin-ssl 静态断言**拆成独立 spec** `app-mobile/tests/pin-ssl-static.spec.ts`（1 describe / 1 it / 5 expect），`storage-crypto.spec.ts` 逐字节还原为纯 AES/GCM，同时收口 `src/config/env.ts` 里与 13F1 同源的假话，`gates-baseline.json` 的 `tests` 段按实测 5/56 → **6/57**（其余四段一字未动）。

## 二、文件清单与判据对应

| 文件 | 内容 | 支撑的卡 §三 判据 |
|---|---|---|
| `raw/00-prechange-readings.log` | 改动前态：`61514b02` 的 `tests`/`lint` 基线实测、`tests/` 5 文件清单、storage-crypto 双形态 SHA；四门读数按**引用** 13F1 的 `raw/33`（不重复计为本卡实测）。文末 append 一段更正：首采 `git ls-tree … app-mobile/tests/` 输出为空是 **cwd 取错**（命令在 `app-mobile/` 下跑却写仓库根相对 pathspec），非「无测试文件」，正确采得 5 个 spec | 基线起点 |
| `raw/01-change-scope.log` | 工作树改动面（`git diff --stat` + env.ts / baseline 全文 diff） | 范围锁死 |
| `raw/02-rg-judgements.log` | `rg -in '2026-09-15\|trustasia' app-mobile/src` = 0 命中（RG_EXIT=1）、`installSslPinning(` 三处命中逐处定性、改后 env.ts 文件头 | 判据①② |
| `raw/03`–`06-gate-*.log` | 改动后常驻四门各自原文（type / lint / test / check:contract） | 判据③ |
| `raw/07-storage-crypto-restore-proof.log` | `git diff 597230c4 -- storage-crypto.spec.ts` = 0 行、spec 内 pin-ssl 家族符号 0 命中、双形态 SHA 对照 + CRLF 归一后逐字节同（1887 B = 1887 B） | §二.2「恢复只测 AES/GCM」 |
| `raw/08-final-selfcheck.log` | 反测全部闭环后、提交前的四门终态 + 复原态 SHA 锚点 + `ANTI-TEST` 残留 0 + 两条 rg 判据复采 + `git status` | 判据③④ |
| `raw/09-postcommit-gates.log` | 实现笔落盘后四门复跑 + `npm run test` 连跑 3 次抖动核验。**该文件含两段**：首版「连跑 3 次」的 `EXIT=0` 取的是管道末端 `grep`/`paste` 的退出码（不是 npm 的）、且读数行未落进日志 ⇒ 同文件内 **append** 补采段（临时文件 + `$?` 紧跟 `npm`），三次 `NPM_EXIT=0` 逐次给出 `6 passed (6)` / `57 passed (57)` / 门 3「当前 6 文件 / 57 用例，基线 6 / 57」，无 `timed out`。首版不删 | 判据③ |
| `raw/10-commit-scope.log` | 提交态改动面：4 文件清单、`pin-ssl.ts`/`backend`/`package.json`/`crypto.ts` diff 全 0、基线除 `tests` 外逐字段 UNCHANGED、13F1 交付物与 `docs/tasks/inbox` diff 0 | 判据⑤（范围） |
| `anti/anti-{date,trustasia,dates,callsite}-red.log` | 四轮反测**原子自复原**闭环（注入前 SHA → `cp` 备份 → 注入 → 红 → `cp` 复原 → 同形态 SHA 比对 → 复跑绿），每轮红点钉到各自断言行 | 判据④ |
| `anti/90-round1-voided.note.txt` | 反测**第一轮作废**现场的**可复现取证**：驱动内 `export MSYS2_ARG_CONV_EXCL='*'`（为保护 rg 的 `/` 开头与 `|` 模式）连带关掉了 node 脚本参数里 POSIX 路径的自动转换 ⇒ `node /d/...` 被解析成 `D:\d\...` ⇒ `MODULE_NOT_FOUND`、`INJECT_EXIT≠0` ⇒ 驱动 `exit 7` 作废本轮并 `cp` 复原。三段对照复现（A 错写法 / B 正写法 / C 不设 env）+ 工作树未被污染的 SHA 锚点复核。根因不是「node 天生不认 `/d/...`」，是这行 env 关掉了转换 —— 首版补证漏设该 env 得不出差异，已作废重写并在文内留记 | 过程披露 |

编号说明：`raw/` 无 04 与 11~89 段，缺号不代表缺失证据；`anti/` 内四份即四张红档（每份自带复原后的绿档复跑尾段，故不再单列绿档）。零字节文件：无。

## 三、注入面与宿主

唯一被注入文件 = `app-mobile/src/utils/pin-ssl.ts`（工作树 CRLF 形态，SHA 锚点 `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889`）。spec / env / baseline 在反测全程未动。
宿主 = `tests/pin-ssl-static.spec.ts` › `describe「pin-ssl 在册事实静态守卫（QODER-13F2）」` › `it「文件头无失效旧文案、保留现网叶子到期日，且 installSslPinning 调用点恒为 0」`。

| case | 注入内容（字节精确，命中数 ≠ 预期即 `exit 9` 拒写） | 期望并实测的红点 |
|---|---|---|
| `date` | `:6` 恢复卡点名的旧句「…已于 2026-09-15 过期」 | `AssertionError: …又出现已失效的 2026-09-15 过期表述: expected true to be false` @ `spec:73` |
| `trustasia` | `:28` 只把 `Let's Encrypt` 换成 `TrustAsia`（单 token，隔离断言②） | `…又出现 TrustAsia 旧签发链表述: expected true to be false` @ `spec:75` |
| `dates` | 文件头两处叶子到期日一并抹掉（常量旁注释仍在，必须两处同删才成立） | `…缺少 api.onepan.cn 叶子到期日 2026-11-11: expected false to be true` @ `spec:77` |
| `callsite` | 文件尾追加真实调用 `installSslPinning()`（带 `ANTI-TEST` 标记 + 重复注入拒写守卫） | `installSslPinning 出现调用点（本模块仍未接线）：…pin-ssl.ts:270: expected [ Array(1) ] to deeply equal []` @ `spec:83` |

四轮均：`INJECT_EXIT=0` → `RED_EXIT=1`（`Test Files 1 failed \| 5 passed (6)`，`Tests 1 failed \| 56 passed (57)`）→ `cp` 复原 → `SHA_EQUAL=yes` + `cmp` 逐字节一致 → 复跑 `GREEN_EXIT=0`（`6 passed (6)` / `57 passed (57)`）。

## 四、复现命令

```bash
# 0) 常驻四门（两种等价口径，命令须在同一 cwd）
cd /d/Users/ZXQL/ZXQL-MS/wen-ssystem && npm --workspace app-mobile run check:gates   # 根目录口径
cd /d/Users/ZXQL/wt-agents/QODER-13/app-mobile && for g in type-check lint test check:contract; do npm run $g; done

# 1) 两条 rg 判据（MSYS 必须屏蔽参数转换，否则 / 开头与 | 被改写）
export MSYS2_ARG_CONV_EXCL='*'
rg -in '2026-09-15|trustasia' app-mobile/src          # 期望 0 命中（EXIT=1）
rg -n  'installSslPinning\(' app-mobile/src           # 期望仅 :7/:197 注释 + :200 定义 ⇒ 调用点 0

# 2) storage-crypto 还原证明（期望 0 行 diff）
git diff 597230c4 -- app-mobile/tests/storage-crypto.spec.ts | wc -l

# 3) 反测（树外注入器 + 原子自复原驱动）
bash /d/Users/ZXQL/wt-agents/_scratch/qoder-13f2/anti-round.sh <date|trustasia|dates|callsite> <红档路径>
#   注入器：node D:/Users/ZXQL/wt-agents/_scratch/qoder-13f2/inject-13f2.mjs --case <值>
#   ⚠ 参数形态是两个 argv（--case=date 会走「未知 --case」拒写）；
#   ⚠ 驱动内已 export MSYS2_ARG_CONV_EXCL='*'（rg 判据需要），该 env 会关掉 MSYS 对 node 脚本路径的自动转换
#     ⇒ node 的脚本路径必须写 Windows 盘符风格 D:/...；写 /d/... 会 MODULE_NOT_FOUND（首跑四轮即因此作废，见 anti/90）。

# 4) 注入残留自检
rg -c 'ANTI-TEST' app-mobile/src/utils/pin-ssl.ts     # 期望无命中（EXIT=1）
sha256sum app-mobile/src/utils/pin-ssl.ts             # 期望 cb27d321…408889
```

## 五、SHA 形态口径（本卡一律标注）

`git show <rev>:<path> | sha256sum` = **LF blob** 形态；`sha256sum <工作树文件>` = **CRLF 工作树**形态（本仓 `core.autocrlf=true`）。同内容两值必不同，不可混比；跨形态比较须先做行尾归一（`raw/07` 即按此法证明还原）。

| 对象 | 形态 | SHA256 |
|---|---|---|
| `pin-ssl.ts` 工作树（反测锚点 / 终态） | CRLF | `cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889` |
| `storage-crypto.spec.ts` 工作树（还原后） | CRLF | `453b5443758ed7b45ad7c242c517f7b6a1826e39496d7eb9839e01e6555ca462` |
| `storage-crypto.spec.ts` @ `597230c4`（还原目标） | LF blob | `52f2d74c922c49e1b33a9a5bcfd5f523c3ff5d8b02db566b28c19774588545c4` |
| `storage-crypto.spec.ts` @ `61514b02`（13F1 混入态） | LF blob | `c87e8b88066e9dde6b7f1838e940a386218275d538aefb616fe843c651c0d246` |
| `pin-ssl-static.spec.ts` @ `f4772512` = 工作树 | LF（两者当前同值） | `5440af9f7a246469f115c47b12e3270a3f514ba5b91b565f7d22b155bb83ff04` |
