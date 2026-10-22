# 矩阵 20 · AI 能力 → 组件/交互 → 后端动作 → 能力状态

- 任务：WB-REFACTOR-P0（工作台 P0 盘点；除本文件外未改任何文件，未做 git 写操作）
- 生成：Qoder 工作台执行子代理｜2026-10-22
- 工作树：`D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0`（分支 `docs/wb-refactor-p0-inventory`，HEAD `7dda80b8`）

## 取证面与路径口径（先读，否则行号无法复核）

| 代号 | 绝对路径 | 说明 |
|---|---|---|
| 原型 | `D:\Users\ZXQL\ZXQL-AI\docs\设计\智享全链_工作台电脑端_UI原型_融合版.html` | 18896 行，只读 |
| 前端 | `D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0\admin-web\src\...` | 下文单元格省略此前缀 |
| 后端 | `D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0\backend\src\...` | 同上（`routes/` 共 **189** 个路由文件） |
| 底座 | `D:\Users\ZXQL\ZXQL-AI\src\...` | AI 底座 NestJS 源码在**独立仓 ZXQL-AI**，见下方盘点级事实 |

> **★ 盘点级事实（影响全部判定的口径）**：工作树内 `backend/ai-base` **不存在**（`ls backend/ai-base` → No such file or directory；`git ls-files | grep ai-base` 只命中 `deploy/ai-base-deploy.sh` 与 `docs/ai-base/*.md`），而 `docker-compose.yml:71-74` 的 `ai-base` 服务 build context 正是 `./backend/ai-base`。`deploy/ai-base-deploy.sh` 第 6-7 行写明源码来源为独立仓库 `wen-868/ZXQL-AI`、检出到 `/opt/zhixiang/ai-base`，并注明"若独立仓库不可用，自动回退到管理系统内嵌的 backend/ai-base"——**该回退路径在本仓已失效**。因此本矩阵所有"底座"端点均取证于 `D:\Users\ZXQL\ZXQL-AI\src`（全局前缀 `app.setGlobalPrefix('api')` 在 `src/main.ts:34`，故控制器 `@Controller('chat')` = `/api/chat`）。**工作树内 grep 不到 ≠ 端点不存在**，但工作树无法自证构建该服务。旁证（历史台账，非本批次判定依据）：`docs/tasks/current-tasks.md:964` 记曾有"独立验证 `backend/ai-base` `npx jest` 41 suites 512 tests"，`:775` 记 `AiChatWindow.vue` 为"新增：对话…"——即内嵌 ai-base 与 AiChatWindow 都曾真实交付，现内嵌源码目录已不在树中、AiChatWindow 已无引用方。

## 状态判据（可复核）

- **LIVE** = 端点存在 **且** 已挂载在路由链上的 admin-web 组件确实在调用它（调用点可 grep）。
- **PARTIAL** = 端点存在，但 admin-web 未接 / 仅部分接（含"封装函数已写但 0 调用点""组件已写但未挂载"两类）。
- **PLANNED** = 端点不存在（原型有交互、全仓无任何 method/path）。
- **BLOCKED** = 端点存在但前置依赖未满足（本批次 0 条，理由见文末）。
- 演示态不得充当 LIVE：原型 V25/V27 的安装与"试运行"均为 `clone(SEED)` 本地深拷贝 + 文案"模拟输出"，零网络调用。

## 明细（19 行）

| # | 能力（冻结清单项｜子项） | 原型 ref（块@行） | admin-web 现状（文件:行 / 无） | 后端 / 底座动作（method path + ref） | 状态 | 判定依据（一句话） |
|---|---|---|---|---|---|---|
| 1 | 新对话与历史会话｜新对话·清空当前会话 | `__V14_CONTACT__`@8974-9332（`openPicker`@9201「新对话」→联系人浮层）；主脚本@1270-1283（`switchSess`@1270 / `SESS.unshift` 新建@1281） | `components/AiChat/AiSidePanel.vue:236` `clearChat` **已定义、模板内 0 处绑定**（`grep clearChat` 仅命中定义行）；`MainLayout.vue:344` 只挂 AiSidePanel 单实例 | 底座 `POST /api/chat`（ZXQL-AI `src/gateway/chat.controller.ts:123`，`conversationId: dto.conversationId` 于 `:185` 透传）；**无"新建会话"独立端点** | PARTIAL | 多轮上下文靠 `AiSidePanel.vue:133/309` 的 `conversationId` 续接（已调用），但用户可见的"新对话/清空"入口未接线，`clearChat` 是死代码 |
| 2 | 新对话与历史会话｜历史会话列表与找回 | 主脚本@2207（`renderSess`）；`__V14_CONTACT__`@9100（`render` 接管列表）、`histRow`@9149、`menu`@9159（打开/归档/恢复/删除）、`unreadOf`@9069 | **无**（`AiSidePanel`/`AiChatWindow` 均无会话列表；`conversationId` 仅存内存，刷新即丢） | 底座仅 `GET /api/admin/session-archive`（ZXQL-AI `src/gateway/admin.controller.ts:361`，注释 A4 定位"用户查看历史/审计回溯"但走 `AdminGuard` + 跨租户运维口径）、`DELETE /api/admin/memory/:tenantId/:sessionId`（`:418`）；**无商家侧会话列表端点** | PLANNED | 无任何"按租户列我的历史会话"的 method/path，admin-web 亦 0 调用点 |
| 3 | AI 信息流/晨报｜AI 信息流 | 主脚本@2039-2046（`const FEED=`，含 `ty:'sys'` 晨报行@2045）、`renderFeed`@2069、`mainMode='feed'`@2009/2468；`__FU6__`@4609-4620（`renderFeed` 再包装注入修订说明） | `views/dashboard/Dashboard.vue:41` 「经营动态信息流」区块 + `:263` 信息流构建；数据源 `:629-637` = `fetchDashboardOverview/RecentAlerts/SaleBills/Receipts/Notifications/Members/Stores/SalesTrend/InstantOrders` | 后端 `GET /api/admin/dashboard/*`（`routes/dashboard.routes.ts`）、`GET /api/admin/wb-notifications`（`routes/workbench.routes.ts:26`）；**底座无 feed/briefing-feed 端点**（`ZXQL-AI/src` 各 `*.controller.ts` grep `briefing` / `feed` = 0 命中） | PARTIAL | 信息流已上线但为**业务接口拼装、非 AI 生成**；AI 内容只能经主动提醒(#7)或对话(#8)进入，"AI 信息流"本体未接 |
| 4 | AI 信息流/晨报｜AI 晨报 | 主脚本@628（晨报卡样式）、`QK_SESS` `key:'report', run:()=>report()`@1287（`report()` 定义@2536）；`__A11__`@3620（毛利异常晨报行）、`__V17_DEEP__`@9981（"AI 晨报已播报"）、@3569（预警与晨报联动·确认后执行·全程留痕） | **无**（`grep 晨报 admin-web/src` = 0 命中） | 底座巡检 `daily_briefing`（ZXQL-AI `src/brain/proactive/daily-briefing.service.ts:38-41`，`schedule='30 8 * * *'`）经 `GET /api/admin/proactive/jobs`（`proactive.controller.ts:47`）、`POST /api/admin/proactive/jobs/:name/run`（`:62`）暴露；呈现侧仅靠 WS（#7） | PARTIAL | 晨报生成任务与手动触发端点真实存在，但 admin-web 0 调用、无晨报页面/卡片，用户取不到 |
| 5 | 快捷经营指令 | 主脚本@1286-1293（`QK_SESS` 6 条经营指令）、`QK_R`@1295-1300（收银侧 4 条）、`gotoSess`@1302（指令沉淀到同名会话）；`__V37_QUICK__`@18453-18891（`getPins/setPins`@18509-18510 图钉、`sortQuick`@18525 频率排序） | `components/AiChat/AiSidePanel.vue:223` `const suggestions` + `:26-31` `.suggestion-chip` → `sendSuggestion(s)`（**仅 `messages.length===0` 空态渲染**） | 底座**无快捷指令注册/解析端点**（`ZXQL-AI/src` grep `quickCommand` / `slash.*command` / `preset` = 0）；实际复用 `POST /api/chat`（`chat.controller.ts:123`），意图识别在 `src/brain/intent-detector.ts`；`backend/src/routes/workbench.routes.ts:19-23` 的 `quick-entries` CRUD 是**页面快捷入口、非 AI 指令** | PARTIAL | 指令 chip 已接通用对话（发得出去），但只在空态可见、无 V37 的图钉/频率个性化，也无 `QK_SESS` 的"每条指令沉淀专属会话"能力 |
| 6 | Agent 工作过程与进度 | `__V9_AGENT__`@5942-6581（14 岗位助理；模型分级路由面板 `id="ap9Tiers"`@6413；`__A9_PURE__`@5958-6222）；`__V31_TEAM__`@15514-16426（`openTaskDlg`@15880、`createTeam`@15911、`stBadgeHTML` 进行中/已完成@15678）；`__ACT__`@4673-5532（节点链 `doneCnt`@4740 / `curNode`@4741 / `recompute`@4745） | `AiSidePanel.vue:291-293` `onToolStart: () => { /* 静默：不展示工具过程卡片 */ }` —— **过程被显式丢弃**；`AiMessageCard.vue:50` 有 `kind==='tool'` 渲染分支但无写入方（`kind:'tool'` 从未 push） | 底座 `POST /api/ai/agent/run`（`agent.controller.ts:60`）、`POST .../plan`（`:122`）、`GET .../plans`（`:158`）、`GET .../plans/:id`（`:178`）、`POST .../plans/:id/run\|approve\|reject\|cancel`（`:200/257/283/310`）；数字员工 `GET /api/ai/employees`（`employee.controller.ts:103`）、`GET /api/ai/employees/:id/tasks`（`:130`，注释即"对话框工作台：任务下达→结果→回传"）、`POST tasks/:taskId/rate`（`:141`） | PARTIAL | 底座 Agent/员工任务端点齐备，admin-web 0 调用（`grep 'ai/agent\|ai/employees' admin-web/src` = 0），且面板把过程静默 ⇒ 进度不可见 |
| 7 | 主动提醒 | 主脚本@2034-2037（`TIP_R`「有延误我会主动提醒」@2036/2052）、`DESK_ALERT`@2009、`__A10__`@6601-6964（`bcInit` 播报 + 未读徽章，被 V14 `unreadOf`@9069 复用）、通知中心@3525 | `components/AiChat/AiChatWindow.vue:315` `connectAiPushSocket(...)` + `:290-296` `kind:"proactive"` —— **但 `AiChatWindow.vue` 全仓 0 代码引用**（`grep AiChatWindow` 全工作树，排除 node_modules/.git，代码侧仅命中 `AiChat/index.ts:4` 的 barrel 导出与自身；其余命中全是 `docs/` 历史台账）；实际挂载的 `AiSidePanel.vue:119-129` 未 import 该函数；`MainLayout.vue:39-` 通知弹层走业务 `fetchNotifications` | 底座 WS `path: '/api/ai/ws'`（ZXQL-AI `src/gateway/push-gateway.service.ts:84`，`src/main.ts:96` 启动初始化）；巡检 `GET/POST /api/admin/proactive/jobs[/:name/run]`；前端封装 `api/ai.ts:331-388` | PARTIAL | 通道 + 封装 + 卡片渲染（`AiMessageCard.vue:33-46`）三件齐全，唯一消费者是**未挂载的 AiChatWindow** ⇒ 线上收不到主动提醒 |
| 8 | 读写工具调用与写操作确认｜预览 → 确认 → 执行 → 撤销 | `__ACT__`@4673-5532（`aiSuggest`@4811 只建议不推进、`completeNode`@4826 唯一推进入口）；`__V9_AGENT__`@6069-6080（`DENY_AI_WRITE`：AI 一律不直接执行写操作）、`apBatchRun/apAct` 确认执行@6372/6378（三栏断言@6520）；`__V11_OPS__`@7304-8455（E·批发订单确认 `ws-confirm`@7782 批量通过/驳回逐单原因） | `AiSidePanel.vue:296-304` 写 `kind:'preview'`+`confirmationId` → `:37-43` `<AiMessageCard @confirm/@cancel/@revoke>` → `AiMessageCard.vue:63` `<AiPreviewCard>` → `AiPreviewCard.vue:89/93` emit；执行侧 `AiSidePanel.vue:346 confirmAiOperation` / `:362 cancelAiOperation` / `:377 revokeAiOperation`；挂载点 `MainLayout.vue:344` | 底座 `GET /api/chat/confirmations`（`chat.controller.ts:232`）、`POST /api/chat/confirmations/:confirmationId/confirm`（`:267`，返回 `operationId`）、`POST .../cancel`（`:323`）、`POST /api/chat/operations/:operationId/revoke`（`:354`，3 分钟窗口）；封装 `api/ai.ts:265/276/285` | LIVE | 端点齐备且**挂载中的 AiSidePanel** 端到端调用（预览→确认→执行→撤销每步都有调用点），非演示态 |
| 9 | 读写工具调用与写操作确认｜tools 能力列表 | `__ACT__`@4698-4712（`var CH=` 链路模板声明动作类型）；`__V9_AGENT__`@6292（可读/不可写/禁触三态） | **无**：`api/ai.ts:235 fetchAiTools` **已定义、全仓 0 调用点**（`grep fetchAiTools admin-web/src` 仅命中定义行）；面板不展示"AI 能做什么" | 底座 `GET /api/admin/tools`（`admin.controller.ts:132`）、`POST /api/admin/tools/execute`（`:154`）；注册表 `src/tools/tool-registry.ts`；`src/tools/definitions` 共 **118 个文件**（`ls \| wc -l`） | PARTIAL | 端点与 118 个工具真实在库，但工作台不拉取、不展示能力清单，`fetchAiTools` 是死封装 |
| 10 | 读写工具调用与写操作确认｜待确认列表拉取（刷新/切页找回） | `__V9_AGENT__`@6356-6382（集中审批中心：AI 结论/依据/影响分析三栏 + 批量）；@6139-6140（依据与影响分析文案） | **无**：`api/ai.ts:255 fetchAiConfirmations` **已定义、全仓 0 调用点**；`AiSidePanel.vue:349-350/365-366` 确认/取消后置 `preview=undefined`、`confirmationId=undefined`，仅内存态 | 底座 `GET /api/chat/confirmations`（`chat.controller.ts:232`，注释"当前租户待确认列表"） | PARTIAL | 端点存在但前端从不调用 ⇒ 刷新/切页后待确认写操作在 UI 上凭空消失，只能靠底座侧过期兜底（`AiConfirmationItem.expiresAt` 已在 `api/ai.ts:252` 建模却无消费方） |
| 11 | 读写工具调用与写操作确认｜执行后留痕 | `__ACT__`@4677（"已完成节点必须带证据"）、`ev(by,tm,ty,ref)`@4759、区块@5201-5203（`actHome` 待执行动作）、@5506（冒烟断言证据可见）；`__V9_AGENT__`@6554/6566（留痕断言） | **无查询**：`AiPreviewCard.vue:69-72` 只有 `executed/revoked/cancelled` 标签态；`grep 'chat/operations' admin-web/src` = 0 命中 | 底座 `GET /api/chat/operations/:operationId`（`chat.controller.ts:468`，含撤销窗口状态）、`GET /api/admin/audit-logs`（`admin.controller.ts:517`）；业务侧 `backend/src/routes/operation-log.routes.ts`、`routes/audit.routes.ts` | PARTIAL | 留痕查询端点在底座存在但工作台不查不展示；执行历史只活在组件内存，刷新即无痕（原型承诺的"证据行"无对应实现） |
| 12 | AI 代办入口 | 主脚本@1780（单据行「AI 代办」按钮 → `wbBillAi` 定义@2186）、@2320（占位页「AI 代办可用下方对话框直接说」）、@2042（审批代办 `gotoSess`） | 待办本体 LIVE：`views/dashboard/TodoList.vue:213/224/260/269/278/324` 直调 `/api/admin/todos*`。**页面级"AI 代办"入口 = 无**：`AiSidePanel.vue` 模板内无 props/emits，全仓无 `aiPanel/openAi/useAi` 事件总线或 store（`grep` 0 命中），业务页无法把单据上下文递给助手 | 后端 `GET /api/admin/todos`+`/todos/stats`、`POST /todos`、`PUT /todos/:id/complete`、`PUT /todos/:id/dismiss`、`DELETE /todos/:id`（`routes/workbench.routes.ts:11-16`，`prefix:"/api/admin"` 在 `:34`）；底座代办工具 `src/tools/definitions/ai-todo-{list,create,update,complete,cancel}.tool.ts` | PARTIAL | 待办 CRUD 与底座 todo 工具都在跑，缺的是原型承诺的"单据 → AI 代办"交接入口（无组件通信机制） |
| 13 | AI 模板设计 | `__V20_SETTIDY__`@10621-10828（`PRINT_LINK_DESC`@10639、`PRINT_TPL_DESC`@10640 =「8 类标准模板 / 我的模板 / **AI 模板设计** / Excel 协作 / 打印记录」）；点位@9518/9526/9614、`__V13__`@9352 | **无 AI**：`modules/print/`（`PrintTemplatesView.vue`、`printClient.ts`、`variables.ts`、`widgetFactory.ts`）`grep 'AI\|智能'` 0 命中（仅命中 `DAILY_SETTLE` 等枚举）；`MainLayout.vue` 打印设计器以 `route.meta.fullscreen` 存在且此时**隐藏 AI 面板**（`:344`） | 后端**手动模板 CRUD 已有**：`GET/POST /api/admin/print/templates`、`GET/PUT/DELETE /templates/:id`、`POST /templates/:id/reset`、`POST /templates/:id/set-default`、`GET /meta`、`POST/GET /records`（`routes/print.routes.ts:26-61`，`prefix:"/api/admin/print"` 在 `:65`；默认模板 `ensureDefaultPrintTemplates` `controllers/admin/print.controller.ts:162`）；底座**无模板设计工具**（`tools/definitions` grep `template` 仅 `create-coupon-template.tool.ts`） | PLANNED | 通用（人工）模板 CRUD 已在，但"AI 生成/AI 改模板"在全仓无任何 method/path —— 按该子能力判 PLANNED，不得因模板接口存在而抬成 PARTIAL |
| 14 | 收银台 AI 预警弹窗 | 静态层@1087-1092（`#posAlert` / `#posAlertBody` DOM）、`posAlertRows`@1907、`openPosAlert`@1916-1919、`closePosAlert`@1921、进收银台自动弹@1995（`setTimeout(openPosAlert,600)`）、@499（弹窗信息行样式） | **反向证据**：`MainLayout.vue:344` `<AiSidePanel v-if="!isCashierMode && !route.meta.fullscreen"/>` —— 收银台模式**主动隐藏**助手；`views/pos/CashierView.vue` `grep 'AI\|预警\|智能'` = 0 命中；全仓无 `posAlert` | **UNKNOWN（端点不存在）**：后端 `GET /alerts/list`、`/alerts/count`、`PUT /alerts/:id/handle`、`GET/PUT /alerts/rules`、`POST /alerts/check`（`routes/alert.routes.ts:15-23`，`prefix:"/api/admin/alerts"` 在 `:26`）为**通用预警**且该文件 `:18-19` 注释自陈"三条的前端调用点全仓为 0"；收银台专用 AI 预警端点与底座 POS 预警均不存在 | PLANNED | 收银台不但没接，还显式屏蔽 AI 面板；无任何面向收银弹窗的专用 method/path |
| 15 | 模型管理 | 静态层@1023（`<!-- 模型与推理 -->` pane）、`SW_TABS`@1194（`{k:'model',n:'模型与推理',admin:true}`）；`__V20_SETTIDY__`@10635（改名 `model→'AI 模型'`）、`__V22__`@11006（旧名统一替换表）；`__V9_AGENT__`@6413 + @6113（模型分级路由标识，注释明确「不做真实调用」）、@6187（L1×3/L2×9/L3×2）；额度与审核@3303/3423 | `api/ai.ts:215 fetchAiModels` **已定义、全仓 0 调用点**；`AiSidePanel.vue:283-285` 调 `sendChatMessage` 时**未传第 5 个 `model` 形参**（签名 `api/ai.ts:151-158` 含 `model?`）。平台侧**另有真实调用**：`saas-admin/src/views/ai-config/PlatformAiConfig.vue:233`、`AiUsageStats.vue:194`、`AiBillingConfig.vue:525`、`AiCognitionView.vue:153` 引 `saas-admin/src/api/ai-config.ts:276-306` | 底座 `GET /api/chat/models`（`chat.controller.ts:71`）；`GET /api/admin/providers`（`admin.controller.ts:223`）、`GET /test-connection`（`:207`）、`POST /chat-test`（`:241`）；外部模型 `GET/POST/PUT/DELETE /api/admin/ai-config/external-models[/:id]` + `GET options` + `POST test[/ :id]`（`external-model.controller.ts:49-118`）；租户配置 `GET/PUT /api/admin/ai-config/{platform,tenants,tenants/:tenantId,usage,billing,model-prices}`（`ai-config.controller.ts:102-280`）；后端平台只读 `GET /api/platform/ai/{public-models,metering-log,abnormal-tenants,model-share}`（`backend/src/routes/ai-platform.routes.ts:24-27`）+ 平台计费配置 `routes/ai-billing.routes.ts:14-30` | PARTIAL | 模型端点齐备且 saas-admin 平台侧实调（非演示）；但**工作台侧**既无模型管理页也无对话级模型切换（`fetchAiModels` 死封装、`model` 参数未传），原型 L1/L2/L3 分级本就标注"不做真实调用" |
| 16 | 插件 | `__V25_PLUGIN__`@12172-12589（`openInstall`@12312 市场弹层、`install`@12337 + `installTick`@12350 三段进度、`toggle`@12370、`uninstall`@12384 二次确认、`reset`@12404「恢复初始演示态」） | **无**（`grep 插件 admin-web/src/views admin-web/src/components` = 0 命中；无插件市场/开关组件） | **UNKNOWN（端点不存在）**：底座 `ZXQL-AI/src` grep `plugin`（排除 spec）= **0 命中**；后端 `routes/` 189 个文件无 plugin 域；工作树唯一 `plugins` 命中是前端 `main.ts:13 installGlobalRowClick` 的目录名，与本能力无关 | PLANNED | 原型 V25 全程使用本地 SEED 深拷贝（`clone`@12251，区块注释@12228「demo 数据（SEED 不可变 · 运行态深拷贝）」），零网络调用，后端亦无对应端点 |
| 17 | Skill | `__V27_SKILL__`@12981-13552（`CAPMAP` 岗位能力映射、`stOf/itemOf`@13009-13011、`capCardHTML`@13110、`runResOf`@13053（`:13055` 文案「模拟输出」）、`dryRun`@13259、`openLog`@13216、`capDetail`@13223）；`__V28_AI__`@13601-13603（对话内取技能态 `stOf/capOf`） | **无**（`AiSidePanel`/`AiMessageCard` 无 skill 卡；`grep '技能\|Skill' admin-web/src/components admin-web/src/views` = 0 命中） | **UNKNOWN（端点不存在）**：底座 grep `skill`（排除 spec）= **0 命中**；能力实际以 **118 个 `tools/definitions` 工具 + `tool-registry.ts`** 承载，但无 Skill 注册/启停/试运行端点（`admin.controller.ts` 仅 `tools`@:132 / `tools/execute`@:154） | PLANNED | 原型 `dryRun` 输出自陈「模拟输出」（`runResOf`@13055），底座侧只有 tool 粒度、无 Skill 抽象的任何 method/path |
| 18 | 故障演练与降级引导｜熔断/降级机制 | `__V9_AGENT__`@6121（降级口径）；`__V28_AI__`@13568-13570（B1 断网态：Alt+N + 顶栏黄条 + 关键提交拦截 + 暂存队列）、`netShow`@13989 / `v28Netbar`@13990-13991、断网回复断言@14250、`__V29_ORG__`@14504（`v29Netcap` 恢复按钮） | **无**（`api/ai.ts` 无熔断/健康查询；`grep circuit admin-web/src` = 0；`AiSidePanel.vue` 无离线暂存队列——`sendChatMessage` 失败仅在 `api/ai.ts:174` 抛连接错误 + `onError` 出 `kind:'error'` 卡，**无重试/无队列**） | 底座 `GET /api/admin/circuit-breakers`（`circuit-breaker.controller.ts:21`）、`POST /reset`（`:28`）、`POST /:name/reset`（`:35`），实现 `src/tools/circuit-breaker.service.ts`；图像理解降级 `chat.controller.ts:156/169`；回滚降级引导 `chat.controller.ts:391`（"无映射降级为引导"）；`GET /api/admin/health`（`admin.controller.ts:295`）、`GET /api/admin/metrics`（`:403`） | PARTIAL | 熔断查询/重置端点真实存在且有 `AdminGuard`，工作台一个都没调；降级只发生在底座内部兜底，UI 无熔断态展示与一键恢复 |
| 19 | 故障演练与降级引导｜演练开关与额度耗尽引导 | `__FU__`@3297（`fuQuota/fuGrace` 演示开关）、@3336-3337（「模拟额度耗尽」按钮 + 引导至订阅管理续购）、@3423（额度耗尽→暂停服务，见 设置→模型与推理 演练开关）；`__V28_AI__`@13996（进入断网演练 toast + 本地暂存承诺）、@14028（帮助浮层「极端场景兜底 · 断网演练」行） | **无**（`grep 演练 admin-web/src` = 0；无断网/额度演练开关，无恢复引导） | **UNKNOWN（端点不存在）**：底座各 controller grep `drill\|演练` = 0；额度侧后端仅有**配置**端点（`backend/src/routes/ai-billing.routes.ts:14-30` `billing-strategy/free-grant/quota-packs`），而**闸门未接线**——`BillingService.checkQuota` 定义于 `ZXQL-AI/src/tenant/billing.service.ts:52`，全仓（排除 spec）grep 仅命中该定义处、**0 调用点** | PLANNED | 演练态在原型是纯前端 `onclick` 演示；对应真实机制（额度闸门）在底座有函数但无人调用，且无面向工作台的演练/引导端点 |

## 合计

| 状态 | 条数 | 行号 |
|---|---|---|
| LIVE | 1 | #8 |
| PARTIAL | 12 | #1, #3, #4, #5, #6, #7, #9, #10, #11, #12, #15, #18 |
| PLANNED | 6 | #2, #13, #14, #16, #17, #19 |
| BLOCKED | 0 | — |
| **总数（= 明细行数）** | **19** | `#1…#19` |

复算：1 + 12 + 6 + 0 = 19 = 明细表 `#1…#19` 行数。

**冻结清单 13 项全覆盖核对**（每项至少一行）：新对话与历史会话→#1/#2｜AI 信息流/晨报→#3/#4｜快捷经营指令→#5｜Agent 工作过程与进度→#6｜主动提醒→#7｜读写工具调用与写操作确认（预览→确认→执行→留痕）→#8/#9/#10/#11｜AI 代办入口→#12｜AI 模板设计→#13｜收银台 AI 预警弹窗→#14｜模型管理→#15｜插件→#16｜Skill→#17｜故障演练与降级引导→#18/#19。

**BLOCKED 为何为 0**：判据要求"端点存在但前置依赖未满足"。本批次所有未达 LIVE 的项，缺的是**前端调用点或端点本身**，不是已存在端点的外部依赖未就绪；底座服务在服务器由 `deploy/ai-base-deploy.sh` 拉起（`main.ts:96` + `/api/ai/ws` 均有实现），不构成"依赖未满足"。最接近 BLOCKED 的两个候选已按"宁低勿高"归位：#19（`checkQuota` 0 调用点 ⇒ 演练/降级端点根本不存在，记 PLANNED）、#4（晨报端点存在但前端未接，按判据记 PARTIAL 而非 BLOCKED）。

## 复核指令（行号可逐条重跑）

```bash
# 前端挂载点与死封装 / 死代码
grep -n "AiSidePanel\|AiChatWindow" D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0/admin-web/src/layouts/MainLayout.vue
grep -rn "AiChatWindow" D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0/admin-web/src
grep -rn "fetchAiModels\|fetchAiTools\|fetchAiConfirmations\|connectAiPushSocket\|clearChat" D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0/admin-web/src
# ai-base 源码缺失（compose 构建上下文指向不存在的目录）
ls D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0/backend/ai-base          # → No such file or directory
grep -n -A4 "ai-base:" D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0/docker-compose.yml
# 底座端点与闸门
grep -nE "@Controller|@Get\(|@Post\(" D:/Users/ZXQL/ZXQL-AI/src/gateway/chat.controller.ts
grep -rn "checkQuota" D:/Users/ZXQL/ZXQL-AI/src --include=*.ts      # → 仅 billing.service.ts:52 定义
ls D:/Users/ZXQL/ZXQL-AI/src/tools/definitions | wc -l              # → 118
```

---

派单人：凌舟（总负责人）｜2026-10-22　执行：工作台执行子代理（Qoder 通道）｜**负责人：墨（工作台负责人）**
纪律：只读取证；除本产出文件外未修改任何文件；生成时点未执行 git 写操作，开工前后 `git status --short` 均为空。
勘误：本行此前误写为「阿潵通道」——阿潵是**移动端**负责人，与本工作台交付无关，按「不同窗口、不同职责、各负责各的项目」口径更正署名。
收口补记（墨 · 2026-10-22）：本矩阵 19 行的「合计 ↔ 明细」守恒（1 LIVE + 12 PARTIAL + 6 PLANNED + 0 BLOCKED = 19，
且四个状态的行号集合互斥并完整覆盖 `#1…#19`）由 `scripts/verify-inventory.cjs --strict` 机读核对通过；
抽行 / 翻转状态 / 合计行号漏写三类造错均**变红**、复原均**变绿**，原始输出见同目录 `50-reverse-test-log.md` §三。
