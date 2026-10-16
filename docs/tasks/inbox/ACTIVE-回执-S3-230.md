# ACTIVE-回执 · S3-230（前端权限门单：解锁 B 类端点收编）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**林夕（前端 / 移动端 · 本地子代理通道 `/root/s3234_frontend`）**｜日期：**2026-10-16**｜对应派单编号：**S3-230**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-230`｜分支：`feat/s3-230-mobile-permission-gates`｜**未 push、未开 PR**
> 完整十项回传：`docs/tasks/cards/R101-S3-230-林夕-回传.md`｜详细证据：`docs/evidence/S3-230/01-入口门清单与B类映射.md` + `docs/evidence/S3-230/raw/**`
> **提交**：分支 `feat/s3-230-mobile-permission-gates` HEAD（工作树 clean）——哈希以 `git log --oneline -1` 为准（写进回执会改变自身哈希，故不内嵌）

## 一、改了什么

1. **新增入口权限门机制**（`app-mobile/**`，零后端改动）：
   - `src/config/permission-gates.ts`：`matchPermissionCode()`（后端 `matchPermission` 的逐条镜像）+ `hasPermissionCodes()`（全部持有）+ `ENTRY_GATES` 声明式注册表（**入口 → 码 → 端点 → 依据**，runtime 与证据脚本共用同一份）；
   - `src/composables/usePermissionGate.ts`：`can / canEntry / canAnyEntry`；
   - `stores/user.ts` + `api/modules/auth.ts` + `api/storage.ts`：把登录/`me` 下发的 `permissions` 存下来（此前被丢弃）；
   - `config/function-menu.ts` + `pages/functions/functions.vue` + `pages-sub/admin/more/more-functions.vue`：`FunctionItem.permCodes` 与"菜单 code 之外的第二道闸"。
2. **27 个入口已按码显隐（覆盖 60 条端点行）**：订单详情（状态流转 3 按钮 + 取消）、开单页（挂单、收款单、采购四子段）、首页扫码入库、库存预警、盘点调拨、报损报益、门店调拨 + 确认收货、商品详情底栏保存、批量改价、商品分类增改删、员工/角色管理入口、优惠券（含**推送深链前置判定**）、营销活动、银行账户、对账确认。
3. **43 行只登记不门**（36 行孤岛页 + 4 行码未定 + 2 行 W 类），逐条理由见证据文档 §3.2。
4. **卡外发现（已顺带补门）**：订单详情「取消订单」端点**已接线** `sale:void`（S3-209）但页面无条件可达 ⇒ 店员点它必 403；B 类 40 条清单漏登记（批次按 `api/modules/orders.ts` 封装判"无页面调用点"，而 `pages/orders/order-detail.vue:291` 实际调用了 `ordersApi.cancel`）。

**未动**：`backend/**`（含权限目录/路由/中间件/迁移）、`.github/**`、`docs/migrations/**`、`admin-web/**`、其他端。

## 二、证据（读数）

| 项 | 读数 | 原始输出 |
|:--|:--|:--|
| 自检 + 反测脚本 `tools/s3230-gate-check.mjs` | **EXIT=0 / PASSED** | `docs/evidence/S3-230/raw/11-gate-check.txt` |
| 台账 ↔ 注册表 | **103 行（端点 × 入口）/ 去重端点 101**（100 条 B 类 + 1 条卡外）；gated 60 / registered 43；27 门一一对上 | 同上 §A |
| 注册表 ↔ 源码引用 | 27/27 门都被真实接上（页面 `canEntry`/`gate:`/`DOC_SUB_GATE` 或 `function-menu.ts` 注册表项 path+码双匹配） | 同上 §B、`raw/70-impl-sites.txt`、`raw/71-fm-permcodes.txt` |
| 在用角色 × 入口矩阵 | 超管/店长/店员/观察员 × 27 门 = 期望表逐格一致 | 同上 §C |
| 反测① 摘门 / ② 改码 / ③ 台账错标 | 三种注入**均 EXIT=1**（分别是"门零引用"/"观察员被放进来"/"status 不一致"）；复原均 EXIT=0 | `raw/61-*.txt`、`raw/62-*.txt`、`raw/63-*.txt` |
| 反测 D1/D2/D3（分辨力） | 17/17 门"换码 ⇒ 非通配角色全不可见"；27/27 门"换码 ⇒ 受众变化"；27/27"复原回基线" | `raw/11-gate-check.txt` §D1–D3 |
| `vue-tsc --noEmit`（app-mobile） | 改动前 12 / 改动后 12（**全在未触碰的 `utils/crypto.ts`**）⇒ **0 新增** | `raw/42-vue-tsc-baseline-head.txt`、`raw/41-vue-tsc-after.txt` |
| `uni build -p h5`（app-mobile） | **EXIT=0 / DONE Build complete.** | `raw/50-build-h5.txt` |
| 复原校验 | 3 个注入文件 SHA256 与注入前逐字节一致 | `raw/60-hashes-before-inject.txt`、`raw/64-hashes-after-restore.txt` |

## 三、阻塞点

**无阻塞。** 三点如实报备：

1. **受众变化 6 组**需您确认（员工/角色管理、商品详情编辑、商品分类写、营销入口 → 只剩超管；对账确认 → 超管+店长；采购四子段 → 店长仅失「采购订单」、店员全失）—— 门码可一行改，改后自检脚本会立刻反映；
2. **3 条推定门码**（`fx-transfer-receive` → `store:transfer`、`fin-recon-confirm` → `report:finance`、`sale-bill-offline-pay` → `sale:create`）：台账未给码，按批次规则②推定，收编时若改码须同步改注册表；
3. **计数口径**：台账逐条清点是 **100 条 B 类**（95 + 采购 M 4 + 客户 W 1，与您 S3-224 验收卡 §四结转的相加口径一致），卡面写 66 —— 本单按台账执行，未按 66 截断。

## 四、环境复原

验证用的 `node_modules` junction 与 `app-mobile/dist` 构建产物均在 `.gitignore` 内，**提交前已删除**；证据脚本零依赖（Node ≥ 20 即可复跑）；未触碰分支外任何工作树与 `main`。

## 五、一行摘要

给 B 类写端点所在的手机端入口补上"按码显隐"的前端权限门（27 门 / 60 条端点行；43 行孤岛页与码未定项只登记），配四层自检 + 三组注入反测（摘门/改码/错标均会红、复原回绿），使不变量 I1 在移动端成立，后端据此可收编。
