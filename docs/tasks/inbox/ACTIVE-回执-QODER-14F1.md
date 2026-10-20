# ACTIVE 回执 · QODER-14F1 —— 401 清态补 `merchant_tenant` + 常驻门禁重栈

> 汇报对象：凌舟（派单人）
> 汇报人：Qoder（移动端执行方）
> 日期：2026-10-21
> 对应派单编号：QODER-14F1（任务书 `docs/tasks/inbox/QODER-14F1-auth-cleanup-restack.md`，原件未改未删）
> 详细十项见 `docs/tasks/cards/R101-QODER-14F1-回传.md`；原始输出见 `docs/evidence/qoder-14f1/`。
> ⚠️ 本回执全部为**执行方自评**，不含验收结论。

## 一、改了什么（人读摘要）

1. **`app-mobile/src/api/request.ts`**：401 清态补第五行 `uni.removeStorageSync('merchant_tenant')`。
   依据：`storage.ts:75-80` 的 `SENSITIVE_KEYS` 里 `TENANT='merchant_tenant'`（租户对象）与
   `TENANT_ID='merchant_tenant_id'`（租户 ID 串）是**两个不同**敏感键，`setTenant()` 两键同写，
   此前 401 只清 `tenant_id` ⇒ 重新登录前旧租户对象仍可读。拦截器（`storage.ts:196-203`）会把这一条
   调用连带转成 `removeSecureStorage`（删 `enc_merchant_tenant`）+ 原始 remove（删明文残留），
   **一条即够，未补第二条**。403/404/500、`silent`、并发去重锁、`upload()` 一律未动。
2. **`app-mobile/tests/request-retry-safety.spec.ts`**：
   ④ 被删键集合断言 4 键 → **5 键**；⑫ 扩为「token/user/tenant/tenant_id/csrf 五个敏感键的
   明文键 + `enc_` 镜像键**双形态**均无残留」，并加「前提自检」（五键注入后必须真的都在，防空断言）；
   ⑩ 源码静态兜底 +1 行 `toContain("uni.removeStorageSync('merchant_tenant')")`；文件头/段注释登记新反测面。
   **未新增 `it`** ⇒ 该 spec 仍 14 用例，全仓仍 6 文件 / 70 用例。
3. **`app-mobile/scripts/gates-baseline.json`**：`tests` 两数 `5/56 → 6/70`（实测即基线），`note` 追加 QODER-14F1 留痕。
   lint / typeCheck / checkContract / contractDrift 四段**一字未动**。
4. **范围外**：`upload()` 的 401 缺失 = QODER-18，本卡零改动。

改动面 = 卡点名 3 文件，不多一个（`git diff --name-only a5294668..8c09cfbd`）。

## 二、判据自评（常驻门禁四道全跑 + build:h5）

| 判据 | 命令 | 自评读数 | 卡 §三 目标 | 证据 |
| --- | --- | --- | --- | --- |
| lint 逐规则不劣化 | `cd app-mobile && npm run lint` | EXIT=0；error 20（基线 20）/ warning 12872（基线 12872）；6 条 warning 规则 + 13 对 `文件::规则` **逐项相等** | 不劣化 | `raw/02`、`raw/06`、`raw/07` |
| type-check `0=0` | `npm run type-check` | EXIT=0；当前 0 错 / 基线 0 错 | 0=0 | `raw/01`、`raw/05` |
| test 6 文件 / 70 用例 | `npm run test` | EXIT=0；**6 文件 / 70 用例全过**，基线已调平 6/70（无「请调高」提示）；改前现态基线 5/56 的那次读数也留了 | 6/70 ✅ **与卡内目标无差异** | `raw/03`、`raw/08` |
| contract EXIT=0 | `npm run check:contract` | EXIT=0；差集 1 条 / 具名豁免 1 条（A.2 三口径 292/283/204，后端注册 1498） | EXIT=0 | `raw/04`、`raw/09` |
| build:h5 EXIT=0 | `npm --workspace app-mobile run build:h5`（仓库根） | EXIT=0；`DONE Build complete.` | EXIT=0 | `raw/10` |
| 反测 (a) 摘 GET 判定 | 同一命令内原子注入→跑门→`cp` 复原→SHA→复跑 | 红：`Tests 6 failed \| 64 passed (70)`，点名 ②③③④⑩⑫（`request-retry-safety.spec.ts`），门 EXIT=1；复原 SHA `6585f7c5…` **逐字节一致**；复跑 6/70 EXIT=0 | 必须红 | `anti/a-get-gate/00~03` |
| 反测 (b) 摘 `merchant_tenant` 清理行 | 同上（注入器命中数=1 才允许注入） | 红：`Tests 3 failed \| 67 passed (70)`，点名 ④⑩⑫（⑫ 报 `enc_merchant_tenant` 仍残留），门 EXIT=1；复原 SHA 同一值**逐字节一致**；复跑 6/70 EXIT=0 | 必须红 | `anti/b-tenant-clear/00~03` |
| `git diff d1a6adcf..HEAD -- backend/` = 0 | 原式 | **0 字节** | =0 ✅ | `raw/11` §2 |

未用 `sed -i`、未用 Edit 删功能行、未借入/删除 harness、未 `git add -A`、未 push、未开 PR。

## 三、未验清单

| 项 | 状态 | 原因 / 复现 |
| --- | --- | --- |
| 真机（iOS/Android/微信开发者工具/小程序后台）401 清态实际表现 | 未验 | 无真机与宿主；复现：真机登录 → 使 token 失效 → 触发 POST → 查 `merchant_tenant` / `enc_merchant_tenant` 是否一并消失 |
| 登录态整页 E2E、后端联调（真实 401） | 未验 | 无后端实例与凭据；Playwright 面不含 app-mobile；用例走 mock `uni.request` 的 401 分支 |
| H5 产物目视 / PNG 截图 | 未验（截图未产出） | 本轮只跑 `build:h5` EXIT=0，未起静态服务、未开浏览器 |
| 非 H5 分支（`#ifndef H5`）的 `enc_merchant_tenant` 删除 | 未验 | vitest 条件编译 shim 固定按 H5 跑；非 H5 路径仅代码阅读确认（`crypto.ts:930-932`） |
| `upload()` 的 401 处理 | 未做（范围外） | 属 QODER-18，卡 §二.5 |

## 四、机读回执

```
===DSH-RECEIPT-BEGIN===
id: QODER-14F1
status: DONE
summary: request.ts 401 清态补 uni.removeStorageSync('merchant_tenant')（它与 merchant_tenant_id 是 SENSITIVE_KEYS 里两个不同敏感键，setTenant 两键同写；一条调用即由 storage.ts:196-203 拦截器连带删 enc_merchant_tenant 镜像键，未补第二条）；request-retry-safety.spec.ts 用例④ 被删键集合 4→5、用例⑫ 扩为 token/user/tenant/tenant_id/csrf 五敏感键明文+enc_ 双形态无残留（含注入后前提自检）、用例⑩ 源码兜底 +1 行 toContain，未新增 it 故仍 14 用例；gates-baseline.json 只动 tests 两数 5/56→6/70（实测即基线）并在 note 追加 QODER-14F1 留痕，lint/typeCheck/checkContract/contractDrift 四段一字未动；upload() 未碰（属 QODER-18，卡 §二.5 范围外）。自评口径，不含验收结论
worktree: D:\Users\ZXQL\wt-agents\QODER-14
branch: fix/qoder-14f1-auth-cleanup-restack
commits: 开工尖端 a5294668（旧 3 笔 rebase 后态，本轮未 rebase/未切分支）；实现笔 8c09cfbd8e817132678a1fc4e63c8a4a13e2a0f8（app-mobile/src/api/request.ts + app-mobile/tests/request-retry-safety.spec.ts + app-mobile/scripts/gates-baseline.json）；docs 笔 = 回传卡 + 本回执 + docs/evidence/qoder-14f1/（README + raw/01~11 + anti/**）；docs 笔 = raw/12 收尾自检（git log 最新一笔，写卡时自身哈希不可知）；卡基线 dfeedbc0，origin/main=21b465e5，全部本地未 push
gates: type-check => EXIT=0（当前 0 错 / 基线 0 错，改前改后同）；lint => EXIT=0（error 20 基线 20 / warning 12872 基线 12872，6 条 warning 规则与 13 对 文件::规则 逐项相等，无劣化）；test => EXIT=0（6 文件 70 用例全过，基线已调平 6/70，与卡内目标无差异；改前现态基线 5/56 的那次读数同样留证）；check:contract => EXIT=0（差集 1 条 / 具名豁免 1 条，A.2 三口径 292/283/204，后端注册 1498）；build:h5 => EXIT=0（npm --workspace app-mobile run build:h5 在仓库根，DONE Build complete.）；改动面 => git diff d1a6adcf..HEAD -- backend/ = 0 字节，git diff --name-only a5294668..8c09cfbd 仅卡点名 3 文件；反测 a（摘 GET 判定）=> 门 EXIT=1，Tests 6 failed 64 passed (70)，点名 ② POST ③ PUT ③ DELETE ④ ⑩ ⑫，cp 复原后 request.ts SHA256=6585f7c5ea3f006537777c4d0a23130551c8415de84a644d91ccda49cd388376 与注入前逐字节一致，复跑 6 文件 70 用例 EXIT=0；反测 b（摘 merchant_tenant 清理行）=> 门 EXIT=1，Tests 3 failed 67 passed (70)，点名 ④ ⑩ ⑫（⑫ 报 enc_merchant_tenant 仍残留），cp 复原同一 SHA 逐字节一致，复跑 6/70 EXIT=0
redlines: 遵守（未 push / 未开 PR / 未 git add -A 逐文件 add；未 rebase、未切分支、未碰 git 历史；全程用 main 常驻门 npm run <gate>，零借入 harness 零删除；gates-baseline.json 仅 tests 段变动；未 npm install，app-mobile/package.json 与 package-lock.json diff 0 字节；任务书原件与 docs/tasks/inbox/ACTIVE.md 未改未删；只动 wt-agents/QODER-14，工作树外仅新写协议 §4 要求的 scratch 注入器目录且未改他人既有文件；旧证据 docs/evidence/qoder-14/** 未改写未删除；本回执与回传卡均不写「凌舟裁定/验收结论/验收通过」类判词）
evidence: docs/evidence/qoder-14f1/README.md, docs/evidence/qoder-14f1/raw/01-pre-type-check.txt, raw/02-pre-lint.txt, raw/03-pre-test.txt, raw/04-pre-check-contract.txt, raw/05-post-type-check.txt, raw/06-post-lint.txt, raw/07-post-lint-per-rule.txt, raw/08-post-test.txt, raw/09-post-check-contract.txt, raw/10-post-build-h5.txt, raw/11-change-scope.txt, raw/12-closeout-checklist.txt, docs/evidence/qoder-14f1/anti/a-get-gate/00-pre-sha256.txt, 01-red.txt, 02-restore-sha256.txt, 03-green.txt, docs/evidence/qoder-14f1/anti/b-tenant-clear/00-pre-sha256.txt, 01-red.txt, 02-restore-sha256.txt, 03-green.txt
return_card: docs/tasks/cards/R101-QODER-14F1-回传.md
===DSH-RECEIPT-END===
```
