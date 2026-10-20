# R101-QODER-11R-回传 · H5 场景 3「× 可关闭」重栈复跑（真跑 + 证据）

> 汇报对象：凌舟｜汇报人：**Qoder（移动端执行方）**｜日期：2026-10-21｜对应派单编号：**QODER-11R**（`docs/tasks/inbox/QODER-11R-h5-rebase-rerun.md`）
> 工作树 `D:\Users\ZXQL\wt-agents\QODER-11`｜分支 `docs/qoder-11r-h5-rebase-rerun`（本地，未 push、未开 PR）
> ⚠️ 本卡为执行方回传，只登记实测读数与如实判定，不含任何裁定性表述（「通过/不通过」均指卡片目标读数的执行方自评）。

## ①、基线与提交（基线披露）

- **基线 = `dfeedbc0`（#368 已合并 main）**。与上一轮 QODER-11 的 `2baf13af`（feat/mobile-batch-a 链）的差异：**main 现已含 × 关闭按钮 + `menuStore.dismissBanner()`**（QODER-10/10F1 已进 main），故场景 3「× 可关闭」本轮**具备通过条件**——这正是本卡要复跑的原因。
- 本分支由负责人按卡 §二.1「只保留 docs/证据」用 `git rebase --onto dfeedbc0 2baf13af` 只重放 5 笔纯 docs 提交；开工即核验 `git diff dfeedbc0..HEAD -- app-mobile/src` = **0 行**（见 §六、证据 `git-diff-selfcheck.log`）。
- 常驻门禁已入库（`app-mobile/scripts/*`、`vitest.config.ts`、`.eslintrc.cjs` 为真文件），本卡**不改代码**，四门各跑一遍留证（§④）。
- node_modules 经 junction 指向主仓（console 里 `/@fs/D:/Users/ZXQL/ZXQL-MS/wen-ssystem/node_modules/...` 可证），**全程未 npm install**。
- 本轮新落提交：证据笔、执行记录+回传笔、收尾自证补哈希笔（哈希见 §⑨）。

## ②、修法 × 读数总表（场景 3 四步）

| 步 | 卡片目标 | 实测原样读数（browser-use evaluate_script） | 执行方自评 |
|:--|:--|:--|:--|
| 步1 | ③ 态横幅出现 | `bannerPresent:true`，文案「权限信息未取到，已按最小可见集显示，请下拉刷新重试｜重试｜×」，`hasClose:true`/`closeChar:"×"`，`labelCount:6`（报表域最小集） | **达成** |
| 步2 | 点 × ⇒ 横幅消失 | `bannerPresent:false`/`hasClose:false`（含重试一并隐藏）、`labelCount:6`（渲染集合不变）、`searchUsable:true`、`masks:0`（非阻塞） | **达成** |
| 步2b | 本次会话隐藏（关闭不持久） | home→functions 往返 `bannerPresent:false`；本地存储仅 `enc_merchant_token/user/tenant/csrf/…`，**无 banner-dismiss 持久键** | **达成** |
| 步3 | 再次 ③ 态 ⇒ 横幅重现 | 保持 me=500/menus=500 整页 reload → `bannerPresent:true`、`hasClose:true`、`closeChar:"×"`、`labelCount:6` | **达成** |

补充：`more-functions.vue` 同 store 同 ×（`hasMfBanner:true`→点 `.mf-banner-close`→`mfBannerPresent:false`），两页行为一致。

## ③、逐条实现说明（本卡零改代码，只复跑取证）

1. **装置复用**：与上一轮同一套 mock 网络手术装置 `docs/evidence/qoder-11r/mock-backend.mjs`，**仅**把监听端口从硬编码 8080 改为 `MOCK_PORT`（默认 8288），其余逻辑逐字一致；未新增任何拦截能力。
2. **端口与并发代理错开**：dev server `npm run dev:h5 -- --port 5288`；`/api` 代理目标经 `VITE_PROXY_TARGET=http://localhost:8288` 指向本轮 mock。两端口开工前 `netstat` 确认空闲、收尾 `port-shutdown-check.log` 确认关闭。
3. **切 ③ 态**：`curl -X POST localhost:8288/__mock -d '{"me":{"mode":"500","perms":"full"},"menus":{"mode":"500"},"login":{"mode":"ok","perms":"full"}}'` + `localStorage.clear()` + 重新登录（无缓存⇒`status='firstfail'`，横幅走 PERMISSION_UNAVAILABLE_NOTICE + 最小集）。
4. **× 关闭复现**：browser-use 对 `.func-banner-close` 原生 click 触发 Vue `@tap`（a11y click 对 uni `<text>` 报 scrollIntoView not a function，与产品无关，改走 DOM click，等价真实点击路径）。

## ④、测试 / 门读数（四门各一遍，EXIT 与基线一致）

原始输出见 `docs/evidence/qoder-11r/gates-run.log`：

| 门 | 命令 | 关键读数 | EXIT |
|:--|:--|:--|:--|
| type-check | `npm run type-check` | vue-tsc EXIT=0，当前错误 0 / 基线 0，无新增类型错误 | **0** |
| lint | `npm run lint` | 无新增 error、warning 未劣化（按 `文件::规则` 比对，error=20 未清零=健康绿） | **0** |
| test | `npm run test` | Test Files 5 passed / Tests 56 passed（与基线 `gates-baseline.json` tests=5/56 一致） | **0** |
| check:contract | `npm run check:contract` | 差集为 0 或全部具名豁免 | **0** |

- 本卡**未动** `gates-baseline.json` 任何一段（无实现改动，四门 EXIT 全 0 即基线态）；未跑 `check-contract-drift`（非本卡判据）。
- 注：`tests/permission-view-state.spec.ts`（29 用例）内含逻辑级 [步1]③态 / [步3]再次③态 断言，本轮浏览器复跑与之互证。

## ⑤、口径偏差与执行报备

1. **判定语义**：卡 §三写「场景 3 有截图/日志；关闭后本次会话隐藏、再次③态重现」——本轮「再次③态」以**整页 reload**（保持 mock ③ 态）复现，读数为 `noticeDismissed` 复位后横幅重现。这既满足「重现」，也正面证明「× 只置会话内存态、不写持久存储」（与 `functions.vue` 注释、`stores/menu.ts` 一致）。同会话内切页往返的「隐藏保持」另以步2b 单独取证。
2. **登录态为 mock 签发**：token/permissions 非真实 JWT，仅验证前端三态渲染与 × 关闭链路；后端真实权限读数不在本卡验收面（与上一轮口径一致）。
3. **截图正常产出**：browser-use 本轮 `take_screenshot` 均成功（4 张 PNG，非零字节），**未遇 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`**；无需降级为仅 DOM/computed/console 读数（DOM/console 读数仍并列留证）。
4. **home/其它页 404 噪音**：mock fallback 404 触发「资源不存在」toast 与 console 报错，与权限三态无关，已在 `console-messages.txt` 标注。

## ⑥、红线对照（逐字）

- **未 push、未开 PR、未 `git add -A`**：全程逐文件 `git add`；只动 `D:\Users\ZXQL\wt-agents\QODER-11`，主仓 `wen-ssystem` 与其它 `wt-agents/*` 只读。
- **未写「凌舟裁定/验收结论」**：本卡所有「通过/达成」均为执行方自评 + 卡片目标读数对照，归属凌舟的判词一概不写。
- **不改业务代码**：`git diff dfeedbc0..HEAD -- app-mobile/src` = 0 行、`-- backend/` = 0 行（`git-diff-selfcheck.log`）；改动面全是 docs/证据。
- **不 npm install、不改 package.json/lockfile**：装置与前端直接跑现有依赖（junction）。
- **不动任务书原件、不动 `docs/tasks/inbox/ACTIVE.md`**：`QODER-11R-h5-rebase-rerun.md` 只读；本卡仅新增 `ACTIVE-回执-QODER-11R.md`。
- **进程只关自己记录的 PID**：dev=后台任务 b5onelm96、mock=b8g1f6402；TaskStop 后 vite 子进程 PID 19076 残留，仅对该记录 PID `taskkill`；**未杀任何并发代理进程**（`port-shutdown-check.log`）。
- **场景 5/6 一律「未验」**：本机无 adb/无 iOS 设备/无投屏通道（沿用上一轮 `docs/evidence/qoder-11/device-probe.txt` 探测结论），不以外推冒充通过。

## ⑦、未完成与阻塞

1. **场景 5（Android 真机 WebView）/ 场景 6（iOS）：未验**（缺设备，非代码缺陷）。复现条件：可访问的部署地址 + Android/iOS 各一台，按清单 §场景 5/6 四项观察点 + WebView console 复跑。
2. 场景 1/2/4 本卡未复跑（结论沿用上一轮「通过」）；基线 `2baf13af`→`dfeedbc0` 对这三场景的三态渲染口径无实质变化（`permission-view-state.ts` 未动），如需可在真机环境就绪时一并复跑。
3. 本卡范围内场景 3 已全量复跑闭环，**无阻塞**。

## ⑧、风险与自我报备 / 踩坑

- **装置替代风险**：mock 装置替代 whistle/Charles，覆盖改状态码/改响应体/abort/延迟，但响应头/重定向细粒度未经真后端校验（与上一轮同样声明）。
- **vite 端口只绑 IPv6 [::1]**：`--port 5288` 起服后 `127.0.0.1:5288` 拒连、`localhost:5288`（解析到 ::1）正常；关服复核须以 `localhost` 与 `[::1]:5288` 为准，勿据 `127.0.0.1` 误判。
- **TaskStop 不杀 vite 子进程**：与上一轮同现象，dev server 由 `uni`→`vite` 多层进程，TaskStop 只回收 npm 包装器，子 node 需按记录 PID 手动 `taskkill`（已留证）。
- **browser-use filePath 默认相对路径落到 CLI 根（`D:\Users\ZXQL\ZXQL-MS`）而非本工作树**：一次 `take_snapshot` 用相对路径误在 `ZXQL-MS\docs\...` 建了 `snapshot-login-page.txt`；**已在 worktree 内另存同名副本**，该越界目录因落在只读区、`rm -rf` 被门禁拦截**未能清除**，如实报备（仅一个纯文本快照，无 git 影响，非本工作树内容）。后续所有截图/快照均改用 worktree 绝对路径。
- 未使用 `sed`；未注入反测（本卡无实现改动，四门绿即基线态，无需反测）。

## ⑨、复现命令

```
# 1) 假后端（③ 态网络手术装置，端口与并发代理错开）
cd D:\Users\ZXQL\wt-agents\QODER-11
MOCK_PORT=8288 node docs/evidence/qoder-11r/mock-backend.mjs   # 日志落同目录 mock-backend.log

# 2) H5 dev server（代理指向本轮 mock 8288）
cd app-mobile && VITE_PROXY_TARGET=http://localhost:8288 npm run dev:h5 -- --port 5288   # http://localhost:5288/

# 3) 切 ③ 态
curl -X POST http://localhost:8288/__mock -H 'content-type: application/json' \
  -d '{"me":{"mode":"500","perms":"full"},"menus":{"mode":"500"},"login":{"mode":"ok","perms":"full"}}'

# 4) 浏览器（browser-use）：登录页 clear localStorage → 填账号/密码点「登 录」→ 进 /pages/functions/functions
#    步1 读 .func-banner（含 ×）→ 步2 .func-banner-close.click()→ 步2b home↔functions 往返 → 步3 reload 重现
#    同法在 /pages-sub/admin/more/more-functions 验 .mf-banner-close

# 5) 四门（在 app-mobile/ 下）
npm run type-check; npm run lint; npm run test; npm run check:contract

# 6) 关服（只杀自己记录的 PID）：TaskStop dev/mock 任务 + taskkill <vite 子 PID>，netstat 复核 5288/8288 无监听
```

## ⑩、一行摘要与对下一单建议

- **摘要**：基线 `dfeedbc0`（#368 后 main 已含 ×）真跑 H5 场景 3 四步——③ 横幅出现 ⇒ 点 × 隐藏（渲染集合不变、非阻塞）⇒ 本次会话内保持隐藏 ⇒ 再次 ③ 态横幅重现；`dismissBanner()` 实测生效，QODER-11 遗留的「× 可关闭」不通过子项**本轮闭环为达成**；场景 1/2/4 通过结论保留、场景 5/6 仍**未验**；四门 EXIT 全 0、`app-mobile/src` 0 行改动、新旧证据并存（`docs/evidence/qoder-11r/` 未覆盖 `docs/evidence/qoder-11/`）。
- **对下一单建议**：真机（场景 5/6）仍缺环境；建议单列「H5 真机回归」环境项（部署地址 + Android/iOS 各一台）后一并复跑三态四步 + WebView console；逻辑级三态/关闭已有 `permission-view-state.spec.ts` 覆盖，真机面是唯一缺口。
