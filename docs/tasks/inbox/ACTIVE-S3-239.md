# ACTIVE-S3-239 · 「未取到权限码」三态统一（app-mobile 菜单 + 入口门）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**林夕/前端（app-mobile）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-239`｜分支 `feat/s3-239-permission-tristate`｜基线：开工当日 `origin/main`
> 起因：S3-231 F3 把**入口门**改成失败关闭后，同端出现**两套 null 语义**（`stores/menu.ts` 的 null = 放全量 vs 入口门的 null = 关闭）⇒ 见 `docs/tasks/cards/R101-S3-231-凌舟验收与裁定.md` §二.2。本单先**定义三态**，再让两端同源。

## 一、凌舟已定的三态（**唯一口径，照此实现，不要再自拟**）

| 态 | 触发条件（可判定） | 菜单（`stores/menu.ts`） | 入口门（`permission-gates.ts` / `usePermissionGate.ts`） |
|:--|:--|:--|:--|
| **① 加载中** | 有登录态、`/admin/auth/me`（或权限来源请求）**在途未返回** | 有上次缓存 ⇒ 按缓存渲染；首启无缓存 ⇒ 渲染**最小可见集**（首页/工作台 + 只读项），**不得**因此判失败关闭、**不得**写失败判定 | 同菜单口径（按缓存；无缓存 = 最小可见集），**不隐藏整端** |
| **② 确实无码** | 请求**成功**返回、`permissions` 为空数组 | 失败关闭：不显示需码菜单（保持改造前语义） | 失败关闭：不显示需码入口（S3-231 F3 的现状） |
| **③ 未取到** | 请求失败 / 超时 / 401 已处理 / 老版本缓存**缺字段** | **最小可见集** + 顶部可关闭提示「权限信息未取到，已按最小可见集显示，请下拉刷新」 | 同菜单口径 + 同提示（**可观测，不静默**） |

> 「最小可见集」的定义写进代码常量并在回传卡列出**逐项清单**（哪些菜单/入口在 ①③ 态可见），
> 依据：`docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md` 的页面可见性 + 首页/工作台为**无码入口**的事实。

## 二、要交付的三件

### R1 · 单一定义源
新增 `app-mobile/src/config/permission-view-state.ts`（零依赖纯函数，可被 Node 直接加载做反测）：
`resolvePermissionViewState({ hasSession, requestState: 'pending'|'ok'|'failed', permissions }) → 'loading' | 'empty' | 'unavailable' | 'ready'`，
并把 `result` 给出的**显示策略**（`showAllMinimal / hideNeedsCode`）作为返回值的一部分 ⇒ 菜单与入口门**都调它**（本单只允许这两处 + 该新文件被改）。

### R2 · 两端接线
- `stores/menu.ts`：null / 空集两分支改为调用 R1（**行为变化**：①③ 态从"放全量"改为"最小可见集 + 提示"）；
- `app-mobile/src/config/permission-gates.ts` + `composables/usePermissionGate.ts`：② 态保持失败关闭；①③ 态按 R1 策略（**不再把"未取到"当"无码"**）；
- 提示 UI：一个可关闭的 `uni.showToast`/顶部提示（**不得**用阻塞式弹窗，避免遮住登录/首屏）。

### R3 · 反测（三态各自必须有分辨力）
用 S3-230/S3-231 既有的装置形态（`docs/evidence/S3-230/tools/`、`docs/evidence/S3-231/F3/tools/`）扩展：
1. ① 加载中（请求挂起不返回）⇒ 菜单渲染**最小可见集**（不是全量、不是空）且无失败提示；
2. ② 返回成功 + `permissions=[]` ⇒ 需码菜单/入口**全部不显示**；
3. ③ 请求 500/超时 ⇒ 最小可见集 **+ 提示出现**；
4. **反测（必做）**：把 R1 的分支打回"null ⇒ 放全量" ⇒ 用例 1/3 **必红**（证明判据有分辨力，不是自证）。

## 三、判据
1. 三态 + 反测四组全部有**原始输出**（存 `docs/evidence/S3-239/raw/`）；
2. `npx vue-tsc --noEmit` **0 新增**（与本仓基线逐条比对，不许"总数一样"就算过）；`npm run build:h5` EXIT=0；
3. 后端零改动（`git diff --name-only origin/main HEAD` 只允许 `app-mobile/**` + 证据/卡片）；
4. **不影响**既有后端门禁：`guard-rbac-wiring --strict` 仍 EXIT=0。

## 四、红线
1. 不得改后端、不得改权限码/角色种子/迁移、不得改 `.github/**`、`deploy/**`、收口总清单、`current-tasks.md`、其它单工作树；
2. 不得把"最小可见集"实现成"全量放行"（那是把失败关闭改回失败放行，属**反向**变更，必判红）；
3. **不得 push / 开 PR / `git add -A`**；证据不得含口令明文；回传卡不得出现「凌舟裁定 / 凌舟验收」字样。

## 五、交付与回传
`app-mobile/src/config/permission-view-state.ts` + 三处接线改动 + 反测装置与证据 + `docs/tasks/cards/R101-S3-239-林夕-回传.md`（十项）+
`docs/tasks/inbox/ACTIVE-回执-S3-239.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据 ｜ 验收自评 ｜ 未完成与阻塞 ｜ 风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡
