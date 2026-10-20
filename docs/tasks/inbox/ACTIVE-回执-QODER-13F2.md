# ACTIVE-回执-QODER-13F2 · pin-ssl 静态断言独立 spec + env.ts 旧文案收口

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13F2
> 十项全文回传：`docs/tasks/cards/R101-QODER-13F2-回传.md`｜证据：`docs/evidence/qoder-13f2/**`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支：`fix/qoder-13f2-pin-static-spec-and-env`｜基线：`61514b02`
> 任务书原件与 `docs/tasks/inbox/ACTIVE.md`：**只读未动**（相对基线 diff = 0 行）；本回执为新增文件，不改他人行。
> 以下全部是**执行方自评**与卡片目标读数的对照，不含任何归属验收方的判词。

## 人读摘要

凌舟对 13F1 的裁定「把 pin-ssl 断言塞进 AES 用例不认可」已按卡 §二 逐条落 Straight：

1. **拆干净**：新增 `app-mobile/tests/pin-ssl-static.spec.ts` = 1 个 describe / 1 个 it / 5 条 expect，四条断言点各自独立成句、每条带失败 message（红了直接读出守的是哪条事实）。宿主测试名就叫「pin-ssl 在册事实静态守卫」。
2. **还原**：`storage-crypto.spec.ts` 用 `git checkout 597230c4 -- <path>` 取回 13F1 之前的纯 AES/GCM 态 ⇒ `git diff 597230c4 -- <path>` = **0 行**、文件内 pin-ssl 家族符号 0 命中、4 用例不变（还原逐字节证明 + 双形态 SHA 对照见 `raw/07`）。
3. **env.ts 同源假话收口**（卡 §一.3 并入本卡的那条）：`src/config/env.ts:8-12` 注释改真——未接线（全仓零调用点）、在册指纹为 2026-10-21 现网 Let's Encrypt 值（api 叶子 2026-11-11、m 叶子 2026-12-22）、未接线原因**不是**「指纹过期」而是「原生层证书回调可用」前置未满足、PINNED_CERTS 按域名登记 ⇒ 换域名或叶子轮换都**必须**同步更新。只动注释，`API_BASE_H5/API_BASE_NATIVE` 一字未动。
4. **基线按实测上调**：`gates-baseline.json` 的 `tests` 段 5/56 → **6/57**（note 留痕写明「13F1 落法被裁定不认可 ⇒ 撤回混入断言 + 新增独立 spec ⇒ +1 文件 / +1 用例」）；`typeCheck / lint / checkContract / contractDrift` 四段逐字段机检 UNCHANGED，lint error 仍 20 未借机调整。

## 判据自评

| 卡 §三 判据 | 目标读数 | 实测（执行方自评） | 证据 |
|---|---|---|---|
| `rg -in '2026-09-15\|trustasia' app-mobile/src` | 0 命中 | **0 命中**（RG_EXIT=1，须先 `export MSYS2_ARG_CONV_EXCL='*'`） | `raw/02`、`raw/08` |
| `installSslPinning(` 调用点 | 0 | **0**（rg 3 处 = 注释 `:7`/`:197` + 定义 `:200`，逐处定性；机检同语义扫全 src 得 `[]`） | `raw/02`、`raw/08` |
| type/lint/test/contract 四门 | 全 EXIT=0 | **全 EXIT=0**：type 0 条=基线 0 条／lint error 20=基线 20·warning 12872=基线 12872（逐位同改动前，**未调基线**）／contract 差集 1·具名豁免 1（A.2 292/283/204、后端 1498） | `raw/03`–`06`、`raw/08`、`raw/09` |
| test | EXIT=0、**6 文件 / 57 用例** | **Test Files 6 passed (6) / Tests 57 passed (57)，EXIT=0**；门 3 打印「当前 6 文件 / 57 用例，基线 6 / 57」；`✓ tests/pin-ssl-static.spec.ts (1 test) 38ms`；实现笔落盘后复跑 + 连跑 3 次逐次 `NPM_EXIT=0` 且读数同为 6/57、无 `timed out`（`raw/09` 内 append 的补采段） | `raw/05`、`raw/08`、`raw/09` |
| 反测：恢复任一条旧文案 / 加一处 install 调用 ⇒ 独立 spec 红；复原 SHA256 同形态一致后绿 | 能红 + 能自复原 | **四轮闭环**（每个断言点各钉一轮）：`date`⇒`spec:73` 红、`trustasia`⇒`:75` 红、`dates`⇒`:77` 红、`callsite`⇒`:83` 红（消息直接列出 `…pin-ssl.ts:270`）；每轮 `Test Files 1 failed \| 5 passed (6)` → `cp` 复原 → `SHA_EQUAL=yes` + `cmp` 逐字节一致（`cb27d321…408889`）→ 复跑 `6 passed (6)` / `57 passed (57)` EXIT=0；收尾 `rg -c 'ANTI-TEST'` 无残留 | `anti/×4`、`raw/08` |
| 只改 pin-ssl 注释、env 注释、测试与 baseline | 范围锁死 | 实现笔 `f4772512` 恰好 4 文件（baseline / env 注释 / 新 spec / 还原的 spec）；`pin-ssl.ts`、`backend`、`package.json`、`crypto.ts` 相对基线 diff 全 **0**；13F1 交付物与 `docs/tasks/inbox` diff 全 **0** | `raw/01`、`raw/10` |

## 过程披露（不掩盖）

- **第一轮反测四轮全部作废**：驱动顶部为保护 rg 参数设了 `export MSYS2_ARG_CONV_EXCL='*'`，该 env 连带关掉 MSYS 对 **node 脚本路径**的 POSIX→Windows 转换 ⇒ `node /d/Users/…/inject-13f2.mjs` 被解析成 `D:\d\Users\…` ⇒ `MODULE_NOT_FOUND`。`INJECT_EXIT≠0 ⇒ exit 7` 守卫按设计把四轮全部作废并 `cp` 复原，**没有**把「根本没注入」的读数当反测结论。更正 = 在该 env 下 node 一律用盘符路径 `D:/…`。作废轮未落一个字节（`pin-ssl.ts` SHA 全程 = 反测前锚点）。三段对照复现（错写法+env／正写法+env／不设 env）见 `anti/90-round1-voided.note.txt`；其中我的**首版补证漏设该 env**、因此得不出差异，那一版已作废重写并在文件内留记。
- **env.ts 改动面从「一行」扩到「同一句的 5 行注释」**：原文 `:8-:9` 是同一句话（「…（全仓零调用点，**且指纹已过期**），域名变更时**无需**同步更新其指纹」），只改 `:8` 会留下「过期 ⇒ 换域名不用管指纹」这半截假话，故整句一并改真；未新增未删任何代码行。
- **两条断言只守文件头（比卡面字面更严、也带来一处口径取舍）**：`2026-11-11/2026-12-22` 在 `PINNED_CERTS` 常量旁注释里各出现一次，按全文比对时「文件头被改坏、常量旁仍在」照样读到绿 ⇒ 断言③ 失守。故把①②③ 都收口到起始块注释（`headBlock()`）。取舍面：①② 若旧文案回潮到文件头之外，本 spec 读绿，靠卡 §三 的全 `src` rg 判据覆盖（已实测 0 命中）。要改回全文口径是一行改动，请裁。
- **反测做到 4 轮**（卡只要求最低 1~2 轮）：本卡有 4 个断言点，逐条钉红点才能证明每条都能红；13F1 首轮曾因注入串同时含两个 token 而红点错位（教训已用单 token 隔离规避）。未扩大代码动作面。
- **本卡未跑三端构建**（卡未要求；动作面 = 测试文件 + 注释 + 基线，无运行时/打包变更）。合并态三构建按 QODER-20 必跑。

## 未验清单

- **APP-PLUS 真机 TLS 握手 / 原生层证书回调**：**未验**（本模块仍未接线，调用点恒 0，无从验）。
- **现网证书此刻是否仍是在册四条**：**未验**（本卡未联网重采；注释里的 `2026-11-11 / 2026-12-22 / 2028-09-02` 是复述 `docs/evidence/qoder-13/raw/01|02-pin-spki-*.log` 于 2026-10-21 01:46/01:47 的采集读数，当时 api 叶子剩 22 天、命中 30 天提醒窗口 WARN）。复现：`bash app-mobile/scripts/pin-spki.sh api.onepan.cn`。
- **`app-mobile/docs` 同族旧表述**：**未动**（卡 §三 判据只扫 `app-mobile/src`）。实测 `rg -ilc '2026-09-15|trustasia' app-mobile/docs` = 2 文件 / 6 处：`pin-ssl指纹维护口径.md`（5）、`移动端全面审查清单与修复方案-2026-10-18.md`（1）；另 `docs/踩坑日志.md` 6 处、`docs/配置项契约登记表.md` 2 处属历史留档。建议另裁一行式追单。
- **H5 / 小程序端行为**：**未验**（无运行时变更）。

## 阻塞

无。下一单按凌舟指令顺序：QODER-20 最终集成（从 `cdf16ce4` 合 13F2 → 18 `bd7e158f` → 11R `df583401`，收敛 11 文件 / 186 用例）。合并面提示（按各支相对 `21b465e5` 的改动文件清单比对，非推测）：13F2 与 18 唯一同名改动文件是 `gates-baseline.json`；18 与 19 基座共享 `app-mobile/src/api/request.ts` 与 `app-mobile/tests/request-retry-safety.spec.ts`，故冲突面可能不止 baseline；11R 与三支代码面零重叠，但与 18 共享若干 `docs/tasks/**`。

===DSH-RECEIPT-BEGIN===
id: QODER-13F2
status: done-self-assessed
summary: 把 13F1 混进「GCM tag 校验」用例的 pin-ssl 静态断言拆成独立 spec（app-mobile/tests/pin-ssl-static.spec.ts，1 describe/1 it/5 expect，四条断言点各自带失败 message）；storage-crypto.spec.ts 以 git checkout 597230c4 逐字节还原为纯 AES/GCM 4 用例（diff 0 行、pin-ssl 家族符号 0 命中、用例数不变）；src/config/env.ts 与 13F1 同源假话收口（未接线原因改为"原生层证书回调前置未满足"、在册指纹=2026-10-21 现网 Let's Encrypt 值、PINNED_CERTS 按域名登记故换域名/叶子轮换必须同步更新；只动注释）；gates-baseline.json tests 5/56→6/57 按实测上调并 note 留痕，其余四段机检 UNCHANGED
worktree: D:\Users\ZXQL\wt-agents\QODER-13
branch: fix/qoder-13f2-pin-static-spec-and-env
commits: 基线 61514b02（未 rebase/未改历史）→ 实现笔 f4772512（fix: 4 文件 +93 −53：app-mobile/tests/storage-crypto.spec.ts 还原 −48、app-mobile/tests/pin-ssl-static.spec.ts 新增 +85、app-mobile/src/config/env.ts 注释 +5 −2、app-mobile/scripts/gates-baseline.json tests 段；逐文件 add）→ 第二笔 docs:（回传卡 + 本回执 + docs/evidence/qoder-13f2/**；本笔哈希只在本笔落盘后存在，故不写死，复现取 git log --oneline 61514b02..HEAD 第一行）
gates: type-check EXIT=0（vue-tsc 0 条=基线 0 条）／lint EXIT=0（error 20=基线 20·warning 12872=基线 12872·逐位同改动前·未调基线）／test EXIT=0（Test Files 6 passed (6)·Tests 57 passed (57)·门 3「当前 6 文件/57 用例，基线 6/57」·新 spec ✓ 1 test 38ms·实现笔落盘后复跑并连跑 3 次无抖动见 raw/09）／check:contract EXIT=0（差集 1·具名豁免 1·A.2 292/283/204·后端注册 1498）；判据 rg -in '2026-09-15|trustasia' app-mobile/src = 0 命中（RG_EXIT=1）、installSslPinning( 调用点 = 0（:7/:197 注释 + :200 定义逐处定性，机检 []）；反测四轮闭环：date⇒spec:73、trustasia⇒spec:75、dates⇒spec:77、callsite⇒spec:83（消息列出 pin-ssl.ts:270），每轮 Test Files 1 failed|5 passed (6) → cp 复原 → 注入前=复原后 SHA=cb27d321c52d487042c65bfe5061f7bce23fd6ed12963d17108f384ed9408889 且 cmp 逐字节一致 → 复跑 6/57 EXIT=0，收尾 rg -c ANTI-TEST 无残留
redlines: 未 push／未开 PR／未 git add -A（逐文件 add）／未 rebase·未改历史·未切他人分支／未 npm install·未改 package.json 与 lockfile／未改指纹常量与业务实现（pin-ssl.ts 相对基线 diff 0 行、backend diff 0、crypto.ts diff 0）／gates-baseline 只抬 tests（实测即基线），lint errorBaseline 保持 20 未借机调整／未接线（调用点恒 0）／未动任务书原件与 docs/tasks/inbox/ACTIVE.md（diff 0）／13F1 交付物（证据树+回传卡+回执）一字未改（diff 0）／注入脚本与备份在树外 _scratch/qoder-13f2／全文只写执行方自评与卡片目标读数，不写归属验收方的判词
evidence: docs/evidence/qoder-13f2/**（README 索引 + 双形态 SHA 表 + 复现命令；raw：00 改动前基线/tests 清单实测与四门引用读数、01 改动面 diff、02 两条 rg 判据原文与逐处定性、03-06 改动后四门、07 storage-crypto 逐字节还原证明、08 反测闭环后提交前四门+复原复核、09 实现笔落盘后四门复跑与 test 连跑 3 次、10 提交态范围机检（允许面外全 0、基线其余四段 UNCHANGED、13F1 交付物 diff 0）；anti：date/trustasia/dates/callsite 四份原子自复原红档（各含复原后绿档尾段）+ 90-round1-voided.note.txt 首轮作废的可复现取证；零字节文件：无；raw 编号无 04 之外的缺段，anti 不单列绿档因每份红档自带复原复跑尾段）
return_card: docs/tasks/cards/R101-QODER-13F2-回传.md
===DSH-RECEIPT-END===
