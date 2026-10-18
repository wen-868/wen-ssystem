# S3-236 · 前端入口登记表（落地面 4）

> 生成装置：`docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs`（**禁止手抄**）
> 实测读数：`docs/evidence/S3-236/raw/12-frontend-entry-hits.json`（扫描 `607` 个前端文件：
> admin-web/src / app-mobile/src / saas-admin/src / miniapp/src / platform-miniapp/src）
> 逐条原始输出（含命中源码行）：`docs/evidence/S3-236/raw/10-frontend-entry-scan.txt`、`raw/11-frontend-entry-scan-debug.txt`

## 一、口径（先读，否则会误读下表）

1. 本仓**前端不引用商家权限码**（页面可见性由 `meta.roles` + 菜单授予决定，同 S3-232 §三）
   ⇒ 落地面 4 是**登记表**，不是前端代码改动（`admin-web/src` 零改动）。
2. 表中"调用点"= **前端代码里真实调用该端点**的位置（`文件:行号`），由扫描装置按
   "HTTP 方法 + 路径字面量（含去掉 `/api` 的相对写法）+ 排除注释行"三条判据实测得出。
3. 有调用点 ≠ 页面有权限门：`admin-web` 的页面门由 `meta.roles` 决定，
   **接线（`requirePermission`）留给后续批次**，本批只立码。

## 二、汇总读数

- 有前端调用点的码：**38 / 38**
- 暂无前端入口（仅后端授权位）：**0 / 38**

## 三、逐码登记表

| # | 域 | 码 | 端点 | 前端入口判定 |
|--:|:--|:--|:--|:--|
| 1 | 报表域 | `report:custom:create` | `POST /api/admin/reports/`<br>`POST /api/custom-report/templates` | ✅ 有调用点：admin-web/src/api/report.ts:240 |
| 2 | 报表域 | `report:custom:edit` | `PUT /api/admin/reports/:id`<br>`PUT /api/custom-report/templates/:id` | ✅ 有调用点：admin-web/src/api/report.ts:241 |
| 3 | 报表域 | `report:custom:delete` | `DELETE /api/admin/reports/:id`<br>`DELETE /api/custom-report/templates/:id` | ✅ 有调用点：admin-web/src/api/report.ts:242 |
| 4 | 报表域 | `report:custom:generate` | `POST /api/admin/reports/:id/generate`<br>`POST /api/custom-report/templates/:id/execute` | ✅ 有调用点：admin-web/src/api/report.ts:243 |
| 5 | 报表域 | `report:schedule:create` | `POST /api/custom-report/schedules` | ✅ 有调用点：admin-web/src/api/report.ts:245 |
| 6 | 报表域 | `report:schedule:edit` | `PUT /api/custom-report/schedules/:id` | ✅ 有调用点：admin-web/src/api/report.ts:246 |
| 7 | 报表域 | `report:schedule:delete` | `DELETE /api/custom-report/schedules/:id` | ✅ 有调用点：admin-web/src/api/report.ts:247 |
| 8 | 报表域 | `report:schedule:toggle` | `PUT /api/custom-report/schedules/:id/toggle` | ✅ 有调用点：admin-web/src/api/report.ts:248 |
| 9 | 报表域 | `report:schedule:run` | `POST /api/custom-report/schedules/:id/run` | ✅ 有调用点：admin-web/src/api/report.ts:249 |
| 10 | 报表域 | `report:permission:edit` | `PUT /api/admin/report-permissions/matrix`<br>`PUT /api/admin/report-permissions/data-scope`<br>`POST /api/admin/report-permissions/batch`<br>`PUT /api/admin/report-permissions/user/:userId` | ✅ 有调用点：admin-web/src/api/report.ts:231 / app-mobile/src/api/modules/report-permission.ts:179 / app-mobile/src/api/modules/report-permission.ts:196 / app-mobile/src/api/modules/report-permission.ts:220 / app-mobile/src/api/modules/report-permission.ts:290 |
| 11 | 报表域 | `report:export` | `POST /api/admin/reports/export` | ✅ 有调用点：app-mobile/src/api/modules/reports.ts:346 |
| 12 | 硬件 / 打印域 | `system:print-record:create` | `POST /api/admin/print/records` | ✅ 有调用点：admin-web/src/modules/print/api.ts:85 / app-mobile/src/api/modules/print.ts:102 |
| 13 | 硬件 / 打印域 | `system:print-record:reprint` | `POST /api/admin/print/records/:id/reprint` | ✅ 有调用点：app-mobile/src/api/modules/print.ts:155 |
| 14 | 硬件 / 打印域 | `system:print-template:create` | `POST /api/admin/print/templates` | ✅ 有调用点：admin-web/src/modules/print/api.ts:47 |
| 15 | 硬件 / 打印域 | `system:print-template:edit` | `PUT /api/admin/print/templates/:id` | ✅ 有调用点：admin-web/src/modules/print/api.ts:61 |
| 16 | 硬件 / 打印域 | `system:print-template:delete` | `DELETE /api/admin/print/templates/:id` | ✅ 有调用点：admin-web/src/modules/print/api.ts:67 |
| 17 | 硬件 / 打印域 | `system:print-template:reset` | `POST /api/admin/print/templates/:id/reset` | ✅ 有调用点：admin-web/src/modules/print/api.ts:73 |
| 18 | 硬件 / 打印域 | `system:print-template:set-default` | `POST /api/admin/print/templates/:id/set-default` | ✅ 有调用点：admin-web/src/modules/print/api.ts:79 |
| 19 | 硬件 / 打印域 | `store:hardware:config-edit` | `PUT /api/store/hardware/configs/:category` | ✅ 有调用点：admin-web/src/api/hardware.ts:15 |
| 20 | 硬件 / 打印域 | `store:hardware:config-test` | `POST /api/store/hardware/configs/:category/test` | ✅ 有调用点：admin-web/src/api/hardware.ts:21 |
| 21 | 硬件 / 打印域 | `store:hardware:announce` | `POST /api/store/hardware/cloud-speaker/announce` | ✅ 有调用点：admin-web/src/api/hardware.ts:43 |
| 22 | 硬件 / 打印域 | `store:hardware:box-pay` | `POST /api/store/hardware/box/pay` | ✅ 有调用点：admin-web/src/api/hardware.ts:49 |
| 23 | 硬件 / 打印域 | `store:hardware:box-config-edit` | `PUT /api/store/hardware/box-config` | ✅ 有调用点：admin-web/src/api/hardware.ts:32 |
| 24 | 硬件 / 打印域 | `store:hardware:box-config-test` | `POST /api/store/hardware/box-config/test` | ✅ 有调用点：admin-web/src/api/hardware.ts:37 |
| 25 | 硬件 / 打印域 | `store:hardware:unionpay-test` | `POST /api/store/hardware/unionpay/test` | ✅ 有调用点：admin-web/src/api/hardware.ts:55 |
| 26 | 小程序 / 移动端域 | `miniapp:config:edit` | `PUT /api/miniapp-config/configs/:platform` | ✅ 有调用点：admin-web/src/api/instant-retail.ts:237 |
| 27 | 小程序 / 移动端域 | `miniapp:package:upload-key` | `POST /api/miniapp-config/upload-key` | ✅ 有调用点：admin-web/src/api/instant-retail.ts:253 |
| 28 | 小程序 / 移动端域 | `miniapp:package:build` | `POST /api/miniapp-config/packages` | ✅ 有调用点：admin-web/src/api/instant-retail.ts:240 |
| 29 | 小程序 / 移动端域 | `miniapp:package:publish` | `POST /api/miniapp-config/publish` | ✅ 有调用点：admin-web/src/api/instant-retail.ts:244 |
| 30 | 小程序 / 移动端域 | `miniapp:order-sync:retry` | `POST /api/miniapp-order-sync/:orderNo/retry` | ✅ 有调用点：admin-web/src/api/instant-retail.ts:37 |
| 31 | 工作台 / 待办消息域 | `dashboard:todo:create` | `POST /api/admin/todos` | ✅ 有调用点：admin-web/src/views/dashboard/TodoList.vue:324 |
| 32 | 工作台 / 待办消息域 | `dashboard:todo:complete` | `PUT /api/admin/todos/:id/complete` | ✅ 有调用点：admin-web/src/views/dashboard/TodoList.vue:260 |
| 33 | 工作台 / 待办消息域 | `dashboard:todo:dismiss` | `PUT /api/admin/todos/:id/dismiss` | ✅ 有调用点：admin-web/src/views/dashboard/TodoList.vue:269 |
| 34 | 工作台 / 待办消息域 | `dashboard:todo:delete` | `DELETE /api/admin/todos/:id` | ✅ 有调用点：admin-web/src/views/dashboard/TodoList.vue:278 |
| 35 | 工作台 / 待办消息域 | `dashboard:quick-entry:create` | `POST /api/admin/quick-entries` | ✅ 有调用点：admin-web/src/views/dashboard/QuickEntryConfig.vue:274 |
| 36 | 工作台 / 待办消息域 | `dashboard:quick-entry:sort` | `PUT /api/admin/quick-entries/sort` | ✅ 有调用点：admin-web/src/views/dashboard/QuickEntryConfig.vue:308 |
| 37 | 工作台 / 待办消息域 | `dashboard:quick-entry:edit` | `PUT /api/admin/quick-entries/:id` | ✅ 有调用点：admin-web/src/views/dashboard/QuickEntryConfig.vue:265 |
| 38 | 工作台 / 待办消息域 | `dashboard:quick-entry:delete` | `DELETE /api/admin/quick-entries/:id` | ✅ 有调用点：admin-web/src/views/dashboard/QuickEntryConfig.vue:296 |

## 四、复跑命令（任何人可自行核对）

```bash
node docs/evidence/S3-236/harness/scan-frontend-entries.mjs            # 逐码命中（+ 落盘 JSON）
node docs/evidence/S3-236/harness/scan-frontend-entries.mjs --debug    # 附命中源码行原文
node docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs      # 重新生成本表
```
