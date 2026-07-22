# 当前任务文件

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-22  
> 凌舟维护

---

## 一、活跃轮次

### R53 — 生产环境全面整改（基于AUDIT-ISSUES审查） [✅ 第0-2步+第4步已完成，第3步延后]

> **日期**：2026-07-20
> **验收记录（凌舟 2026-07-22）**：R53-19/20/21已由IDE端完成。统一标准更新为v1.4，项目规则路径已修正为.workspace/，侧边栏12个一级模块命名与产品功能清单v6.1完全一致。第3步UI审查仍延后。

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
| R53-19 统一标准v1.4更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成（凌舟验收 2026-07-22） |
| R53-20 项目规则更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成（凌舟验收 2026-07-22） |
| R53-21 产品清单命名同步 | 凌舟 | P1 | 0.25天 | ✅ 已完成（凌舟验收 2026-07-22） |

---

### R51 — App 原生层封装方案 [✅ 全部完成 — 凌舟验收 2026-07-22]

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
- **状态**：✅ 已完成（2026-07-23）
- **前置**：R51-03 后端打印记录 API ✅
- **文件**：`app-mobile/src/native/print.ts`、`app-mobile/src/manifest.json`
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
| R51-02 蓝牙热敏打印插件 | 阿澈 | P0 | 3天 | ✅ 已完成 |
| R51-03 后端打印记录API | 阿坚 | P0 | 1天 | ✅ 已完成 |
| R51-04 离线SQLite+同步扩展 | 阿澈+阿坚 | P1 | 5天 | ✅ 已完成 |
| R51-05 安全加固（Token加密+证书锁定） | 阿澈 | P1 | 2天 | ✅ 已完成 |
| R51-06 分包优化 | 阿澈 | P1 | 1天 | ✅ 已完成 |
| R51-07 推送通知集成 | 阿坚+阿澈 | P2 | 3天 | ✅ 已完成 |
| R51-08 虚拟滚动改造 | 阿澈 | P2 | 1天 | ✅ 已完成 |
| R51-09 HarmonyOS适配 | 阿澈 | P3 | 5天 | ✅ 已完成 |
| **合计** | — | — | **23天** | **全部完成** |

> 详细方案：`.workspace/tasks/R51-App原生层封装方案.md`

---

## 二、待处理遗留项

### R54 遗留

| 问题 | 严重程度 | 状态 | 说明 |
|------|:---:|:---:|------|
| R54-13 内部备注字段缺失 | 低 | ✅ 已修复（2026-07-22，提交4b4c33d） | SalesOrderCreate.vue备注已拆分为"客户可见备注"和"内部备注"（internalRemark） |
| 生产环境登录API 500错误 | **高** | ✅ 已修复（2026-07-22，提交7a532c3） | 根因mysql2自动解析JSON列导致JSON.parse(数组)抛异常，新增normalizePermissions容错函数 |

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
| R55 | 2026-07-22 | 8 | ✅ 7/8 | 后端安全与质量遗留问题（R55-04核心模块已替换，其余仍有any） |