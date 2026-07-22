# 当前任务文件

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-22  
> 凌舟维护

---

## 一、活跃轮次

### R55 — 后端安全与质量遗留问题（基于v7测试报告核查） [待开始 — 当前轮次]

> **日期**：2026-07-22
> **来源**：全面测试报告v7 + 凌舟逐项代码级核查
> **核查结论**：v7报告16项验证全部属实（8项已修复确认 + 8项仍存在确认）
> **说明**：R54已修复P0级问题（CSRF双重注册、密码校验不一致等），本轮处理剩余P1-P3级遗留问题

#### R55-01 — retail-announcement 跨租户数据泄露 [P0]

- **优先级**：P0
- **负责人**：阿坚
- **预计**：1天
- **状态**：⬜ 待开始
- **文件**：`backend/src/routes/retail-announcement.routes.ts`、`backend/src/services/instant-retail/retail-announcement.service.ts`、`docs/migrations/052_add_retail_announcement.sql`
- **问题**：retail-announcement路由使用requireAuth（不含tenantMiddleware），表无tenant_id列，所有SQL仅按store_id过滤且storeId来自用户输入。updateAnnouncement和deleteAnnouncement仅凭id操作，连store_id都不校验。任何认证用户可跨租户访问/修改/删除其他租户公告
- **修复方向**：
  1. DDL迁移：t_retail_announcement表新增tenant_id列
  2. 路由auth从"requireAuth"改为"requireAuthWithTenant"
  3. service层所有SQL增加tenant_id过滤条件（从req.user.tenantId获取）
  4. updateAnnouncement和deleteAnnouncement增加store_id + tenant_id双重校验
  5. storeId从req.user关联查询获取，不直接信任用户输入
- **验收标准**：跨租户用户无法访问其他租户的公告数据

#### R55-02 — 双重飞书告警 [P1]

- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：移除 `errorResponseInterceptor` 中的 `reportToLingZhou` 调用与 feishu-report import，简化为透传中间件（保留作响应降级扩展点）；飞书告警统一由 `errorHandler` 负责（5xx 唯一告警源）。同步改写 `error-response-interceptor.test.ts`（移除飞书告警断言，保留透传 + 不触发副作用验证）。`npx tsc --noEmit` 0 错误，`npx vitest run` 416 文件 4857 用例全部通过。
- **文件**：`backend/src/middleware/error-handler.ts`、`backend/src/shared/error-response-interceptor.ts`、`backend/src/__tests__/shared/error-response-interceptor.test.ts`
- **问题**：errorHandler（第63/96行）和errorResponseInterceptor（第33行）各自对5xx错误调用reportToLingZhou发送飞书告警，同一条错误告警发送两次。insertErrorLog双重写入已修复，但告警仍重复
- **修复方向**：移除errorResponseInterceptor中的reportToLingZhou调用，仅保留errorHandler发送告警；errorResponseInterceptor仅负责响应重定向/降级
- **验收标准**：5xx错误只触发一次飞书告警

#### R55-03 — rate-limit 使用 MemoryStore [P1]

- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：新增 `rate-limit-redis@6.0.0` 依赖（monorepo hoist 到根 node_modules）；`config/env.ts` 新增 `REDIS_URL`（可选）；`server.ts` 新增 `createRateLimiter` 工厂函数——测试环境或未配置 REDIS_URL 时用默认 MemoryStore，生产环境+REDIS_URL 时用 RedisStore（ioredis + sendCommand），初始化抛错降级 MemoryStore，Redis 运行时连接错误经 error 事件记录日志。三个限流器（globalLimiter/adminLoginLimiter/storeLoginLimiter）均改用工厂创建。`npx tsc --noEmit` 0 错误，`npx vitest run` 全量通过。
- **文件**：`backend/src/server.ts`、`backend/src/config/env.ts`、`backend/package.json`
- **问题**：globalLimiter（第80行）、adminLoginLimiter（第84行）、storeLoginLimiter（第85行）三个rateLimit实例均使用默认MemoryStore，多进程部署或重启后计数清零，防暴力破解能力降级
- **修复方向**：生产环境替换为rate-limit-redis（需安装依赖并配置Redis连接），开发环境可保留MemoryStore
- **验收标准**：生产环境限流器使用Redis存储

#### R55-04 — queryOne\<any\> 类型安全缺失 [P2]

- **优先级**：P2
- **负责人**：阿坚
- **预计**：3天
- **状态**：🚧 进行中（第一批：5个核心模块完成）
- **文件**：`backend/src/services/` 目录下42个文件（153处）
- **问题**：整个后端services目录153处使用queryOne\<any\>或queryAll\<any\>，数据库层完全失去类型安全，字段名和类型无编译期检查
- **修复方向**：为高频模块（auth、customer、product、order）定义TypeScript接口，逐步替换any泛型。可分批进行，优先处理核心业务模块
- **验收标准**：核心模块（auth/customer/product/order/sale）无any泛型
- **完成进度**（第一批，2026-07-23）：
  - `auth.service.ts`：6处 → 定义 SysUserRow/RolePermissionRow/RoleCodeRow/UserHomepageRow/UserPasswordRow 接口
  - `customer.service.ts`：23处 → 定义 MemberListRow/MemberDetailRow/CountTotalRow 等 15 个接口
  - `product.service.ts`：14处 → 定义 ProductListRow/ProductSpuRow/ProductSkuRow 等接口，conn.query 使用 ResultSetHeader/RawDataPacket
  - `order.service.ts`：13处 → 定义 OrderListRow/OrderDetailRow/SaleBillListRow 等接口
  - `purchase-order.service.ts`：9处 → 定义 PurchaseOrderRow/PurchaseOrderItemRow 等接口
  - 合计：5个模块，65处 any 替换为明确接口
  - 验证：tsc 无新增错误，vitest 4857 用例全部通过

#### R55-05 — apiCost:1 硬编码 [P2]

- **优先级**：P2
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/shared/response.ts`、`docs/API.md`、`app-mobile/src/api/request.ts`、`backend/src/__tests__/shared/response.test.ts`
- **问题**：ok()和fail()函数都硬编码返回apiCost:1，不论实际接口开销如何，所有响应返回固定值
- **修复方向**：移除apiCost字段（如无消费方依赖），或改为可选参数由调用方传入实际耗时
- **验收标准**：apiCost字段移除或动态计算
- **完成证据**：从 `response.ts` 的 ok()/fail() 中移除 `apiCost: 1` 字段；同步移除 `response.test.ts` 中的相关断言（2处）；从 `app-mobile/src/api/request.ts` 的 `RequestResponse` 接口中移除 `apiCost`；从 `docs/API.md` 的成功响应和失败响应示例中移除 `apiCost`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-06 — asyncHandler 类型安全 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/middleware/async-handler.ts`
- **问题**：asyncHandler函数签名使用(req: any, res: any, next: any)和返回类型any，Express类型安全保障丢失
- **修复方向**：使用Express官方类型Request/Response/NextFunction替换any，返回类型改为RequestHandler
- **验收标准**：asyncHandler无any类型
- **完成证据**：引入 Express 官方类型 `Request`/`Response`/`NextFunction`/`RequestHandler`；handler 参数类型从 `any` 改为 `(req: Request, res: Response, next: NextFunction) => unknown`；返回类型明确为 `RequestHandler`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-07 — JWT_SECRET 密钥复用 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/middleware/csrf.ts`、`backend/src/config/env.ts`
- **问题**：CSRF的HMAC和JWT签名共用env.JWT_SECRET，密钥轮换时所有CSRF token立即失效
- **修复方向**：新增env.CSRF_SECRET独立密钥，csrf.ts使用CSRF_SECRET而非JWT_SECRET
- **验收标准**：CSRF和JWT使用不同密钥
- **完成证据**：`config/env.ts` 新增 `CSRF_SECRET` 环境变量，未设置时回退到 `JWT_SECRET` 确保向后兼容；`middleware/csrf.ts` 的 `generateCsrfToken` 优先使用 `CSRF_SECRET`，未配置时回退到 `JWT_SECRET`，两者均缺失时抛出明确错误。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-08 — hashPassword 动态 import 不一致 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/services/admin/auth.service.ts`
- **问题**：第161行使用await import("../../shared/password.js")动态导入hashPassword，但同文件顶部已static import verifyPassword和validatePassword，导入方式不一致且路径后缀不统一
- **修复方向**：将hashPassword加入顶部static import，删除动态import
- **验收标准**：auth.service.ts中password模块全部使用static import
- **完成证据**：将 `hashPassword` 加入顶部 static import（与 `verifyPassword`、`validatePassword` 同一声明）；删除动态 `import("../../shared/password.js")` 调用；改密码逻辑直接使用 `await hashPassword(newPassword)`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R55-01 retail-announcement跨租户泄露 | 阿坚 | P0 | 1天 | ⬜ 待开始 |
| R55-02 双重飞书告警 | 阿坚 | P1 | 0.5天 | ✅ 已完成 |
| R55-03 rate-limit MemoryStore | 阿坚 | P1 | 0.5天 | ✅ 已完成 |
| R55-04 queryOne\<any\>类型安全 | 阿坚 | P2 | 3天 | 🚧 进行中（第一批5模块完成） |
| R55-05 apiCost硬编码 | 阿坚 | P2 | 0.25天 | ✅ 已完成 |
| R55-06 asyncHandler类型安全 | 阿坚 | P3 | 0.5天 | ✅ 已完成 |
| R55-07 JWT_SECRET复用 | 阿坚 | P3 | 0.25天 | ✅ 已完成 |
| R55-08 hashPassword动态import | 阿坚 | P3 | 0.25天 | ✅ 已完成 |
| **合计** | — | — | **6.25天** | — |

#### R55 执行顺序

```
【第一批 P0 — 立即执行】
  阿坚：R55-01（retail-announcement租户隔离，1天）

【第二批 P1 — 高优先级】
  阿坚：R55-02（双重告警，0.5天）→ R55-03（rate-limit Redis，0.5天）

【第三批 P2-P3 — 迭代优化】
  阿坚：R55-05（apiCost，0.25天）→ R55-07（JWT_SECRET，0.25天）→ R55-08（hashPassword，0.25天）→ R55-06（asyncHandler，0.5天）→ R55-04（queryOne类型安全，3天，可分批）
```

---

### R53 — 生产环境全面整改（基于AUDIT-ISSUES审查） [第0-2步、第4步（标准文档）已完成，第3步（UI审查）延后]

> **日期**：2026-07-20
> **说明**：第0步（后端致命问题）和第1-2步（前端菜单+模块完善）已完成。第3步（UI审查）延后，第4步（标准文档）待执行。

#### R53-18 — UI审查与优化 [P2]

- **优先级**：P2
- **负责人**：林夕 + 墨
- **预计**：5天
- **状态**：⬜ 待开始
- **问题**：各模块页面UI需林夕审查后统一优化
- **验收标准**：林夕审查通过

#### R53-19 — 项目统一标准v1.4更新 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/standards/项目统一标准.md`
- **问题**：标准文档停留在v1.3（2026-07-05），需补充手写SQL t_前缀、views目录规范、部署验证、菜单覆盖率、safeExec限制，更新差距数据和优先级矩阵
- **修复**：完成10处更新——版本号升至v1.4、补充手写SQL t_前缀铁律、红线新增第13条、新增6.4 views目录分类规范、新增7.4生产环境部署验证、新增11.7菜单覆盖率验收、补充safeExec参数化限制、更新附录C优先级矩阵（移除已完成项）、更新A.2返回体/A.4数据库差距数据
- **验收标准**：凌舟核查通过

#### R53-20 — 项目规则更新 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/standards/项目规则.md`
- **问题**：文档仍残留Windows绝对路径（流程文件索引、记忆文件位置）和违规的成员任务文件段落
- **修复**：将2处Windows绝对路径改为.workspace/相对路径；删除违规的成员任务文件段落改为禁止创建独立任务文件规则；流程文件索引补充产品清单/统一标准/项目规则3项
- **验收标准**：凌舟核查通过

#### R53-21 — 产品功能清单命名同步确认 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/product/产品功能清单-v6.1.md`、`admin-web/src/layouts/MainLayout.vue`
- **问题**：需确认产品规划3处一级模块命名（工作总台/财务往来/营销中心）与侧边栏一致
- **修复**：经核查，MainLayout.vue侧边栏12个一级模块与产品功能清单v6.1的12个一级目录完全一致，无需修改代码
- **验收标准**：侧边栏命名与产品规划完全一致 ✅

#### R53 待完成任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R53-18 UI审查与优化 | 林夕+墨 | P2 | 5天 | ⬜ 待开始 |
| R53-19 统一标准v1.4更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成 |
| R53-20 项目规则更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成 |
| R53-21 产品清单命名同步 | 凌舟 | P1 | 0.25天 | ✅ 已完成 |

---

### R51 — App 原生层封装方案 [进行中]

> **日期**：2026-07-19 撰写方案 / 2026-07-20 任务分派
> **撰写人**：凌舟
> **负责人**：阿澈（前端主导）+ 阿坚（后端）+ 苏然（测试）+ 凌舟（审查）
> **完整方案**：`.workspace/tasks/R51-App原生层封装方案.md`（1172行，5大模块）

#### R51-01 — 条码扫码原生插件封装 [P0] ✅ 已完成

- **优先级**：P0
- **负责人**：阿澈
- **预计**：2天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`app-mobile/src/native/scan.ts`（重构949行）、`app-mobile/src/manifest.json`（已配置 ZXing-Scanner + CAMERA 权限）
- **问题**：app-mobile 当前无原生扫码能力，门店收银、盘点、追溯场景需依赖系统扫码功能
- **修复方向**：
  1. 封装 `uni.requireNativePlugin('ZXing-Scanner')` 为 Promise 接口
  2. 实现 `ScanResult` 类型识别（barcode/qrcode/trace_code）
  3. 实现 `handleScanResult()` 路由分发：追溯码 → /admin/trace/query/:code，商品条码 → 优先本地 SQLite，未命中走网络
  4. 支持连续扫码（盘点场景），间隔可配置
  5. 错误处理：相机权限拒绝、设备不支持、扫码超时
- **验收标准**：vue-tsc 0 错误，扫码插件类型定义完整，三种场景路由分发逻辑正确
- **完成内容**：
  - 接口对齐 R51 方案：`scan(options?): Promise<ScanResult>` + `startContinuousScan(callback, options?): void` + `stopContinuousScan(): void` + `handleScanResult(result): Promise<void>`
  - ScanOptions 新增 `timeout?: number`（默认 30000ms）
  - 新增 `ScanError` 类 + `ScanErrorType` 枚举（device_not_supported/camera_permission_denied/timeout/scan_failed/no_content）
  - `checkCameraPermission()` 用 `uni.getSetting` 检查 `scope.camera` 拒绝状态
  - `scan()` 用 `Promise.race` + `setTimeout` 实现扫码超时
  - 路由分发：追溯码 → `/pages-sub/admin/trace/trace-query?code=xxx` + 后端 `GET /admin/trace/query/:code`；商品条码 → `LocalProductDb.findByBarcode` 优先，未命中走 `productsApi.list({ keyword })`
  - 保留 `scanCode` / `stopScan` 作为 `@deprecated` 别名向后兼容
  - HMS Scan Kit 适配（HarmonyOS）保留
- **验证结果**：`npx vue-tsc --noEmit` 0 错误（app-mobile 全量通过）

#### R51-02 — 蓝牙热敏打印插件封装 [P0]

- **优先级**：P0
- **负责人**：阿澈
- **预计**：3天
- **状态**：⬜ 待开始
- **前置**：R51-03 后端打印记录 API
- **文件**：`app-mobile/src/native/print.ts`（新建）、`app-mobile/src/manifest.json`
- **问题**：app-mobile 无蓝牙打印能力，门店收银后无法打印小票
- **修复方向**：
  1. 实现 `PrintManager` 接口：search/connect/disconnect/isConnected/printSaleBill/printSaleBillDot/printRaw
  2. 实现 58mm 热敏打印模板（销售单）
  3. 打印成功后调用后端 /api/admin/print/records 保存打印记录
- **验收标准**：蓝牙打印机搜索/连接/打印正常，打印记录保存到后端

#### R51-03 — 后端打印记录 API [P0]

- **优先级**：P0
- **负责人**：阿坚
- **预计**：1天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：routes/service/migration/测试前序轮次已部分完成（存在但 controller 缺失导致编译失败），本次补齐缺失的 `print.controller.ts`（4 端点：POST /records 保存、GET /records 分页查询、GET /records/:id 详情、POST /records/:id/reprint 重打），修复 `print.service.ts` 的 insertId 提取 bug（兼容 mock 数组与真实 DB 对象两种形态，踩坑 [76]）。routeConfig.auth=requireAuthWithTenant，租户隔离用 queryWithTenant/queryOneWithTenant，operatorId 由服务端从 req.user.id 注入（不信任客户端）。主键采用 BIGINT 自增（比 VARCHAR(36) 更适合审计记录高频写入，service/test 均基于 number 类型实现）。`npx tsc --noEmit` 0 错误，`npx vitest run` print.service.test.ts + print.routes.test.ts 全部通过（含 CRUD + 租户隔离 + 边界）。
- **文件**：`backend/src/routes/print.routes.ts`、`backend/src/services/admin/print.service.ts`、`backend/src/controllers/admin/print.controller.ts`、`docs/migrations/20260720_print_record.sql`
- **问题**：后端无任何打印记录能力，App 端打印小票无法留痕审计
- **修复方向**：
  1. 新建 `t_print_record` 表（含 tenant_id/store_id/bill_type/bill_no/printer_mac/print_content/copies/operator_id/status/error_msg）
  2. 路由 `POST /api/admin/print/records` 保存打印记录
  3. 路由 `GET /api/admin/print/records` 查询打印记录
  4. 路由 `POST /api/admin/print/records/:id/reprint` 重打
- **验收标准**：tsc 0 错误，vitest 测试通过（含 CRUD + 租户隔离），路由注册成功

#### R51-04 — 离线能力（SQLite + 增量同步） [P1]

- **优先级**：P1
- **负责人**：阿澈（前端）+ 阿坚（后端扩展）
- **预计**：5天
- **状态**：⬜ 待开始
- **文件**：`app-mobile/src/native/sqlite.ts`（新建）、`app-mobile/src/api/local-db.ts`（新建）、`backend/src/services/sync/delta-sync.service.ts`（新建）
- **问题**：app-mobile 无离线能力，网络中断时无法开单
- **修复方向**：
  1. 前端 SQLite 建表（local_product_sku/local_member/local_sale_draft/local_inventory_snapshot/sync_watermark）
  2. 前端同步流程：App启动增量同步 → 无网络写local_sale_draft → 恢复网络自动提交
  3. 后端新增 4 个同步端点：products/inventory/members 增量 + offline-orders 批量提交
- **验收标准**：vue-tsc 0 错误，离线开单→网络恢复→自动同步→服务端落库 全流程跑通

#### R51-05 — 安全加固（Token加密 + 证书锁定 + 防调试） [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：阿澈
- **预计**：2天
- **状态**：✅ 已完成（2026-07-20）
- **文件**：`app-mobile/src/utils/crypto.ts`（825行）、`app-mobile/src/utils/pin-ssl.ts`（261行）、`app-mobile/src/utils/security.ts`（430行）、`app-mobile/src/api/storage.ts`（324行）、`app-mobile/src/manifest.json`

#### R51-06 — 分包优化（pages.json 分包改造） [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：阿澈
- **预计**：1天
- **状态**：✅ 已完成（2026-07-20）
- **文件**：`app-mobile/src/pages.json`（重构，主包14页 + 5个子包共80页）、`app-mobile/src/pages-sub/`（新建目录）

#### R51-07 — 推送通知集成 [P2]

- **优先级**：P2
- **负责人**：阿坚（后端）+ 阿澈（前端）
- **预计**：3天
- **状态**：⬜ 待开始
- **文件**：`backend/src/services/admin/push.service.ts`（新建）、`app-mobile/src/native/push.ts`（新建）

#### R51-08 — 虚拟滚动改造 [P2]

- **优先级**：P2
- **负责人**：阿澈
- **预计**：1天
- **状态**：⬜ 待开始
- **文件**：`app-mobile/src/components/virtual-list.vue`（新建）

#### R51-09 — HarmonyOS 适配 [P3]

- **优先级**：P3
- **负责人**：阿澈
- **预计**：5天
- **状态**：⬜ 待开始
- **前置**：R51-01 ~ R51-04 完成后执行

#### R51 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R51-01 条码扫码原生插件 | 阿澈 | P0 | 2天 | ✅ 已完成 |
| R51-02 蓝牙热敏打印插件 | 阿澈 | P0 | 3天 | ⬜ 待开始 |
| R51-03 后端打印记录API | 阿坚 | P0 | 1天 | ⬜ 待开始 |
| R51-04 离线SQLite+同步扩展 | 阿澈+阿坚 | P1 | 5天 | ⬜ 待开始 |
| R51-05 安全加固（Token加密+证书锁定） | 阿澈 | P1 | 2天 | ✅ 已完成 |
| R51-06 分包优化 | 阿澈 | P1 | 1天 | ✅ 已完成 |
| R51-07 推送通知集成 | 阿坚+阿澈 | P2 | 3天 | ⬜ 待开始 |
| R51-08 虚拟滚动改造 | 阿澈 | P2 | 1天 | ⬜ 待开始 |
| R51-09 HarmonyOS适配 | 阿澈 | P3 | 5天 | ⬜ 待开始 |
| **合计** | — | — | **23天** | — |

> 详细方案：`.workspace/tasks/R51-App原生层封装方案.md`

---

## 二、待处理遗留项

### R54 遗留

| 问题 | 严重程度 | 说明 |
|------|:---:|------|
| R54-13 内部备注字段缺失 | 低 | SalesOrderCreate.vue有"备注"但无"内部备注"区分 |
| ~~生产环境登录API 500错误~~ | ~~高~~ | ✅ 已修复（2026-07-23，阿坚）：根因 mysql2 自动解析 JSON 类型列导致 JSON.parse(数组) 抛异常，新增 normalizePermissions 容错函数 + status 查询兼容 VARCHAR/TINYINT |

---

## 三、历史轮次归档（已完成）

| 轮次 | 日期 | 任务数 | 状态 | 说明 |
|------|------|:------:|:----:|------|
| R18 | 2026-07-08 | 2 | ✅ | 营销模块services测试 + 全量验收 |
| R20 | 2026-07-09 | 1 | ✅ | 全量验收测试 |
| R33 | 2026-07-15 | 1 | ✅ | 全量回归测试 |
| R34 | — | 1 | ✅ | — |
| R35 | — | 1 | ✅ | — |
| R36 | — | 1 | ✅ | — |
| R37 | — | 1 | ✅ | — |
| R38 | — | 1 | ✅ | P1级租户过滤漏洞修复 |
| R39 | — | 1 | ✅ | 租户隔离专项测试与代码优化 |
| R40 | — | 1 | ✅ | 系统全局统一性审查与问题修复 |
| R41 | — | 1 | ✅ | 系统性全局审查与问题修复 |
| R42 | — | 1 | ✅ | P0紧急修复：无法登录 & 无法注册 |
| R43 | — | 1 | ✅ | 系统性全局核查：产品规划 vs 现有系统对比 |
| R44 | — | 1 | ✅ | BOSS平台管理 + 即时零售 + P1页面补齐 |
| R45 | — | 1 | ✅ | SaaS定位修正 + 7大功能核验 |
| R46 | 2026-07-19 | 2 | ✅ | 工作台与收银台合并（PC端统一+移动端统一） |
| R47 | 2026-07-19 | 5 | ✅ | 数据库表命名统一 |
| R48 | 2026-07-20 | 6 | ✅ | SaaS总平台独立化修复 |
| R49 | 2026-07-20 | 6 | ✅ | 产品规格修正 + 部署验证 + 遗留清理 |
| R50 | 2026-07-21 | 1 | ✅ | 全系统完成度审计工作流 |
| R54 | 2026-07-22 | 19 | ✅ 18/19 | 产品功能细节优化（R54-13内部备注缺失） |
