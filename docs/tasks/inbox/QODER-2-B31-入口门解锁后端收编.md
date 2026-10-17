# QODER-2 · B3-1：移动端**入口门登记**，解锁后端权限收编

> 派单人：凌舟｜端/执行：**QODER**｜回传人：QODER 执行人
> 依据（A 级证据 MO-02，凌舟已逐行复读原文）：
> - `backend/src/routes/aftersale.routes.ts:49-71` 注释：approve / reject / inspect / complete **4 条本批不接**，因 app-mobile `order-aftersale/aftersale.vue:144/178` 有写调用点 ⇒ 使用者集合不可枚举（B 类）；
> - `backend/src/routes/points.routes.ts:14-17` 注释：`POST /:id/points/adjust` **不接**，因 `member-detail.vue:540` 有调用点且首页快捷入口**无条件可达** ⇒ B 类。
> ⚠️ 你不是凌舟；**不得 push / 开 PR / `git add -A`**；不得写「凌舟裁定/验收结论」。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-2`｜分支 `feat/qoder-2-appmobile-entry-gates`｜基线：`origin/main`

## 一、目标（**只补门，不接后端**）

后端那 5 条之所以"不敢加守卫"，唯一原因是**移动端使用者集合不可枚举**。只要移动端把这些入口纳入**权限门注册表**（可枚举），后端就能按既有裁定接线。**本单不改 `backend/**`**。

## 二、交付

1. 在 `app-mobile/src/config/permission-gates.ts` 的 `ENTRY_GATES` 里新增/补齐 **5 条 endpoint 映射**：
   | 端点 | 归属页 | 本单给的门码 |
   |:--|:--|:--|
   | `POST /api/admin/aftersales/:id/approve` | `pages-sub/order/order-aftersale/aftersale.vue` | `sale:return`（与同文件 `confirm-receipt` 同族，先按现有码；**不新造码**） |
   | `POST /api/admin/aftersales/:id/reject` | 同上 | `sale:return` |
   | `POST /api/admin/aftersales/:id/inspect` | 同上 | `sale:return` |
   | `POST /api/admin/aftersales/:id/complete` | 同上 | `sale:return` |
   | `POST /api/admin/members/:id/points/adjust` | `pages-sub/member/member-detail.vue` | **`customer:points:adjust`（该码未立）⇒ 本单登记为 `pending-code`**，页面按"未开通"隐藏入口；**不许硬挂不存在的码** |
2. **判据同源**：复用 S3-240 已建的判据镜像（`admin-web/src/config/permission-gates.ts` 的 `matchPermission` 全通配语义）——移动端若已有同源实现就复用，**禁止第三套**；
3. **一致性用例**：扩展 `app-mobile`（或 `docs/evidence/qoder-2/`）的装置：`ENTRY_GATES` 里每条 `status='gated'` 的 endpoint 必须在后端**已接线**且用码 ∈ codes —— 但本单后端尚未接 ⇒ 该用例对 5 条新登记项**预期为"待接"白名单**（具名 + 理由），并在回执里给出"后端接线后自动转绿"的判据说明。

## 三、判据（逐条给原始输出）

1. `ENTRY_GATES` 新增 5 条，逐条给 `id / entry / page / endpoints / codes / status`；
2. **反测**：删掉其中 1 条登记 ⇒ 一致性用例**必红并点名**；复原 ⇒ 绿（SHA256 一致）；
3. `cd app-mobile && npx vue-tsc --noEmit` ⇒ **0 新增**（S3-245 后基线是 0）；`npm --workspace app-mobile run build:h5` ⇒ EXIT=0；
4. 页面级：`aftersale.vue` / `member-detail.vue` 在"无码/未取到码"时**入口不可见**（给装置输出：持码=渲染、不持码=0、未取到=0）；
5. 后端零改动：`git diff origin/main HEAD -- backend/` **为空**。

## 四、红线

只改 `app-mobile/**` + 证据/回传卡；**不得改后端、不得新立权限码、不得动迁移**；不得碰其它工作树；零字节证据配 `<同名>.note.txt`。

## 五、回传

`docs/tasks/cards/R101-QODER-2-回传.md`（十项）+ 回执；并在卡里明确"后端收编单（S3-250 待我派）需要挂的 5 条码与门 id 对照表"，供我后续派单直接引用。
