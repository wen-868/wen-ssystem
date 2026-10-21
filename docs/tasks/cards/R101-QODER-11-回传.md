# R101-QODER-11-回传 · H5 手动验收清单 6 场景执行记录（真跑 + 证据）

> 汇报对象：凌舟｜汇报人：**Qoder（移动端）**｜日期：2026-10-20｜对应派单：**QODER-11**（`docs/tasks/inbox/QODER-11-H5手动验收执行.md`）
> 工作树 `D:\Users\ZXQL\wt-agents\QODER-11`｜分支 `docs/qoder-11-h5-manual-run`（本地，未 push、未开 PR）
> ⚠️ 本卡为执行方回传，只登记实测读数与如实判定，不含任何裁定性表述。

## 〇、基线与提交（基线披露）

- **基线 = `2baf13af`（卡 8 尖端，feat/mobile-batch-a 链）**。选择依据：验收对象 `app-mobile/docs/H5手动验收清单-2026-10-19.md` **只在卡 8 尖端存在**（开工第一步 `git show 2baf13af:app-mobile/docs/H5手动验收清单-2026-10-19.md` 验证通过）；#368 主链尖端 `844515d5`（卡 1~7+9）不含该文件。
- **本基线不含卡 9（售后 4 条挂 `sale:return`）接线**。对本期 6 场景的影响评估：清单场景全部落在**权限三态（菜单 code 可见性 + 入口门）渲染表现**，观察点为报表域最小集/横幅文案/显隐收敛，**不涉及售后动作入口的显隐读数** ⇒ 零影响；场景 2/3 中 gated 写入口集合按 2baf13af 注册表态判定（`island-aftersale` 等在本基线仍为 gated 未接，不进入本清单任何读数）。卡 9 合入后如复跑，预期读数不变（见执行记录 §五）。
- node_modules：工作树两枚 junction 指向主仓（`QODER-11\node_modules`、`QODER-11\app-mobile\node_modules`），**全程未 npm install**；junction 创建回显与 `dir /al` 复核在案。

## 一、交付物

1. 执行记录：`app-mobile/docs/H5手动验收执行记录-2026-10-20.md`（任务书 §二 指定路径与五列格式）。
2. 证据全集：`docs/evidence/qoder-11/**`（11 张截图 + 每场景 note + 装置脚本/日志 + dev server 原始日志 + git diff 自证 + 设备探测原始输出）。
3. 本回传卡 + `docs/tasks/inbox/ACTIVE-回执-QODER-11.md`。
4. 提交：按文件分步（证据一笔、执行记录一笔、回传一笔、提交后自证补哈希一笔），哈希见 §九。

## 二、六场景读数（一览）

| # | 场景 | 判定 | 一句话依据（原样读数见执行记录表） |
|:--|:--|:--|:--|
| 1 | 首启无缓存 → ① | **通过** | ① 窗口=最小可见集 6 报表项、`bannerPresent:false`；返回后一次收敛 42 项，只增不减无闪回 |
| 2 | `permissions:[]` → ② | **通过** | 功能页需码项 `labels:[]` 全隐藏、无横幅；首页无码入口可用；往返重进读数稳定 |
| 3 | 500/超时 → ③ | **通过**（两文案分支+非阻塞+重试恢复）；**「× 可关闭」子项不通过** | 3a 文案原文「权限信息未取到，已按最小可见集显示，请下拉刷新重试」+最小集 6 项；3b「权限信息加载失败，显示的是上次结果」+缓存 31 项；`masks:[]` 非阻塞；撤 mock 点重试横幅消失；横幅子节点仅文案+重试，**closeBtnFound:false** |
| 4 | 弱网首屏 | **通过** | 七点采样 0→7→42 一次切换无反复闪回；全程 blank:false、可见 mask 0；abort 超时分支落 stale 不卡死不白屏 |
| 5 | Android 真机 WebView | **阻塞（未执行）** | 本机无 adb/无 Android 设备接入（device-probe.txt 原始输出）；未跑一律不判通过 |
| 6 | iOS | **缺设备未验** | 同 5（清单字面自带该选项） |

统计：通过 4 / 不通过 1 子项 / 阻塞 1 / 未验 1。

## 三、判据对账（任务书 §三 逐条）

1. 6 场景全部有判定 ✔（上表，凡未跑到的均判阻塞/未验，无一处冒充通过）。
2. 每个「通过」≥1 件证据 ✔（场景 1/2/3/4 均有截图 + mock-backend.log 行为行 + note 原样读数）。
3. 场景 3 记录提示文案**原文**（两分支逐字）与关闭按钮现状 ✔（本基线 QODER-10 的 × 未合，按 2baf13af 现状记录，含 DOM 子节点枚举与截图）。
4. `git diff 2baf13af..HEAD -- app-mobile/src` = **0 行** ✔（命令+原始输出 `git-diff-src-selfcheck.log`；全部提交后终态复跑读数 `git-diff-src-final.log`，见 §九补哈希笔）。

## 四、装置与方法（可复跑）

- 起服：`cd app-mobile && npm run dev:h5` → http://localhost:5173/（ready in 92460ms，日志 `dev-h5.log`）。
- mock：`node docs/evidence/qoder-11/mock-backend.mjs`（:8080，vite /api 代理目标）；切态 `curl -X POST localhost:8080/__mock -d '{"menus":{"mode":"500"}}'`（支持 500/abort/empty/perms=full|missing|empty/delayMs）。逐请求留痕 `mock-backend.log`。
- 浏览器：browser-use MCP（navigate/fill/click/screenshot/evaluate_script/list_console_messages），登录走真实表单（填账号→点 `uni-button.login-btn`）；「杀页面重进」用真实 reload；「重试」用点击 `.func-banner-retry`。
- 与清单的偏差：whistle/Charles 与 DevTools Slow 3G 档位不可用 ⇒ 等效手段为 mock 延迟/abort（能力覆盖清单所需三项：改响应体、改状态码、断连）；场景 5/6 真机不可得 ⇒ 判阻塞并留探测证据，未以外推冒充。

## 五、口径偏差与执行报备

1. **场景 3「可关闭」缺口判定**：清单 §〇 预登记 + 简报口径为「QODER-10 正在修、本卡不改代码」——按 2baf13af 实测仍无 × ⇒ 子项判**不通过**，归属写明「已在 QODER-10 处理中」，未写任何裁定字样。
2. **3a 复现 me=500 会话恢复路径时**，因登录响应缺 permissions 字段 + `/me` 失败后 `initialized` 停 false，入口门读数按清单已知边界条款记为「与 ① 同表现、提示由菜单侧驱动」，不判缺陷（清单观察点原文如此）。
3. **重试恢复读数 labels=31≠42**：菜单侧恢复但用户码仍缺（装置态），入口门第二道闸失败关闭属设计口径；对照组 reload（me 恢复 full 码）读数 42 与场景 1 ready 一致，已在执行记录 §三-2 登记。
4. **② 态「更多功能」页空分区头残留**（非缺陷观察）：已登记执行记录 §三-1，建议归属随 × 按钮小改一并处理，本卡未动代码。
5. **home 页业务数据 toast**：mock 兜底 404 噪音，与三态无关，截图可见已标注。

## 六、红线对照

- 未 push、未开 PR、未 `git add -A`（逐文件 add）；只动 `D:\Users\ZXQL\wt-agents\QODER-11`，未触碰 QODER-10 等其他工作树。
- `app-mobile/src` 0 行改动（§三.4 双 log 自证）；产品代码零修改，全部改动为文档与证据（`app-mobile/docs/` 执行记录 1 份 + `docs/evidence/qoder-11/**` + `docs/tasks/cards/` + `docs/tasks/inbox/`）。
- 0 字节/纯文本证据均配 `.note.txt` 说明取证命令；原始输出落盘（mock-backend.log、device-probe.txt、git-diff-*.log、dev-h5.log）。
- 后台进程：dev server 与 mock 装置执行完毕即关闭（时间见回执）。

## 七、未完成与阻塞

1. **场景 5（Android 真机）阻塞**：本机无 adb、无设备接入；需真机 + 可访问部署地址后按清单 §场景 5 全四项复跑。
2. **场景 6（iOS）缺设备未验**：同上。
3. **场景 3「× 可关闭」子项复跑**：待 QODER-10 合入后复验（本卡基线无该改动）。
4. 其余无阻塞；本卡范围内 4 个浏览器场景已全量执行并归档。

## 八、风险与自我报备

- **装置替代风险**：mock 装置替代 whistle，等价性覆盖清单三种手术手段，但**响应头/重定向等细粒度行为未经真后端校验**；真机复跑场景 5/6 时建议同装置或 whistle 二选一并在记录中注明。
- **登录态为 mock 签发**：token 非真实 JWT，仅验证前端三态渲染链路；后端真实权限读数与本期验收面无关（清单 §〇 已声明逻辑判据由 26 条单测覆盖）。
- **基线披露风险**：本执行记录绑定 `2baf13af` 态；若最终合并顺序使清单文件与 × 按钮/QODER-10 改动同链，场景 3 子项读数需按新态刷新（§七.3）。
- Git Bash 环境注意已遵守：rg 证据类命令未涉（本卡无 rg 判据）；未使用 sed 改动任何文件；杀进程尽力并留时间记录。

## 九、交付物与证据清单（含提交哈希）

- 执行记录：`app-mobile/docs/H5手动验收执行记录-2026-10-20.md`。
- 证据目录：`docs/evidence/qoder-11/`——`mock-backend.mjs`、`mock-backend.log`、`dev-h5.log`、`device-probe.txt`、`git-diff-src-selfcheck.log`、`git-diff-src-final.log`；截图 11 张：`scene-1-loading/ready`、`scene-2-functions-empty/more-functions-empty/home-ok`、`scene-3a-banner-minimal/me500-reload`、`scene-3-retry-banner-gone`、`scene-3b-stale-banner`、`scene-3-ready-control`、`scene-4-home/functions-ready/more-functions/report-page/timeout-abort-stale`；note 4 份。
- 提交（分支 `docs/qoder-11-h5-manual-run` @ 基线 `2baf13af`，本地未 push，逐文件分步）：证据笔 `d7df2e85` → 执行记录笔 `35d6cb71` → 回传笔（本卡+回执）`cf415b21` → 补哈希笔（回执补 `cf415b21`、终态自证 `git-diff-src-final.log` 0 行读数、`port-shutdown-check.log` 关服复核）= 分支尖端。

## 十、一行摘要

基线 2baf13af（卡 8 尖端、不含卡 9，对本期 6 场景零影响）真跑 H5 三态清单：浏览器链路 4 场景**通过**（① 最小集/② 失败关闭/③ 双文案+非阻塞+重试恢复/弱网无闪回），场景 3「× 可关闭」子项按现状**不通过（QODER-10 在修）**，场景 5/6 真机**阻塞/未验**；产品代码 0 行改动，装置、截图、console、diff 自证全量落盘。
