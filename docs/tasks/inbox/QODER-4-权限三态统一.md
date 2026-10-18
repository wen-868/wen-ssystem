# QODER-4 · S3-239：移动端「未取到权限码」三态统一

> 派单人：凌舟｜端：**移动端 → Qoder**｜回传人：Qoder 执行人
> 依据：`docs/tasks/inbox/ACTIVE-S3-239.md`（凌舟已定三态口径）+ `R101-S3-231-凌舟验收与裁定.md` §二.2（裁定 2）
> ⚠️ 不得写「凌舟裁定/验收结论」；**不得 push、不得开 PR、不得 `git add -A`**。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-4`｜分支 `feat/qoder-4-permission-tristate`｜基线：`origin/main`

## 一、三态（凌舟已拍死，照此实现）

| 态 | 触发条件 | 菜单（`stores/menu.ts`） | 入口门（`permission-gates.ts` / `usePermissionGate.ts`） |
|:--|:--|:--|:--|
| **① 加载中** | 有登录态、`/admin/auth/me` 在途 | 有缓存按缓存；首启无缓存 ⇒ **最小可见集**（首页/工作台 + 只读项），**不判失败关闭** | 同口径 |
| **② 确实无码** | 请求成功、`permissions` 为空数组 | 失败关闭（需码菜单不显示） | 失败关闭（现状，保持不变） |
| **③ 未取到** | 失败/超时/401 已处理/老缓存缺字段 | **最小可见集** + 可关闭提示「权限信息未取到…」 | 同口径 + 同提示 |

「最小可见集」定义为代码常量并在回传卡列**逐项清单**。

## 二、交付

1. **单一定义源**：`app-mobile/src/config/permission-view-state.ts`（零依赖纯函数，可被 Node 直接加载）：
   `resolvePermissionViewState({hasSession, requestState:'pending'|'ok'|'failed', permissions}) → 'loading'|'empty'|'unavailable'|'ready'` + 显示策略；
2. **两端同源接线**：`stores/menu.ts` 与 `permission-gates.ts`/`usePermissionGate.ts` **都调它**（本单只允许改这两处 + 新文件）；
3. **提示 UI**：可关闭的顶部提示（**不得**阻塞式弹窗）。

## 三、判据（逐条给原始输出）

1. ① 加载中（请求挂起）⇒ 渲染**最小可见集**（不是全量、不是空）且无失败提示；
2. ② 成功 + `permissions=[]` ⇒ 需码菜单/入口**全部不显示**；
3. ③ 请求 500/超时 ⇒ 最小可见集 **+ 提示出现**；
4. **反测**：把 `resolvePermissionViewState` 的 `null ⇒ 放全量` 分支打回 ⇒ 用例 1/3 **必红**；复原 SHA256 一致；
5. `cd app-mobile && npx vue-tsc --noEmit` ⇒ **0 新增**（基线 0）；`npm --workspace app-mobile run test` ⇒ 全过且用例数不劣化；`build:h5` EXIT=0；
6. 后端零改动（`git diff <merge-base>..HEAD -- backend/` = **0 行**，注意用 merge-base 而不是 origin/main，避免接到 main 的新提交）。

## 四、红线

只改 `app-mobile/src/config/permission-view-state.ts`（新）、`stores/menu.ts`、`config/permission-gates.ts`、`composables/usePermissionGate.ts` + 测试/证据/回传卡；
**不得改后端、不得动权限码/迁移/角色种子**；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-4-回传.md`（十项）+ 回执；卡内必须含「最小可见集逐项清单」与三态各一条原始输出。
