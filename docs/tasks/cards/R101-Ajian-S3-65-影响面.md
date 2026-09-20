# R101-S3-65 影响面精确扫描（阿坚 · 后端域 · 只读静态扫描）

> 派单编号：**R101-S3-65-影响面** ｜ 派单人：凌舟（总负责人）｜ 2026-09-21
> 执行方：阿坚（后端域；本次由**本地子代理代执行**）｜ 报告日期：2026-09-21
> 扫描范围：`backend/src/**`，排除 `**/__tests__/**`；排除 `backend/ai-base/**`（独立部署副本，走自有仓库 ZXQL-AI，见 S3-36）
> 工具：TypeScript 编译器 API 静态遍历（脚本全文见附录 A）+ **真实 `injectXxxTenant` 纯函数两版复算**（main 现版 vs 分支 `1c46dd9c`，脚本全文见附录 B）
> 本卡为**只读**扫描单：**未修改/新增任何源码与测试**、**未连数据库**、**未起服务/浏览器**、**未 commit/push/切分支/改 HEAD**；本卡是本次唯一新建的报告文件（另按 inbox 协议产出 `docs/tasks/inbox/ACTIVE-回执.md`，并把 `ACTIVE.md` 归档）。

---

## 回传（照抄派单卡 §〇「回传格式」块，逐项填满）

```
【汇报 S3-65影响面】对应派单 R101-S3-65-影响面：三 helper 写路径调用点共 356 处，其中"修复前静默 0 行、修复后首次真正生效"的写操作调用点为 38 处（27 个文件）；旧口径 10 处为本卡命中集的子集，扩口径后新增 28 处，且**旧口径漏掉了本次生产 P0 的现场本身**（services/admin/auth.service.ts:293 改密）。
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端域；本地子代理代执行）｜2026-09-21
交付物：docs/tasks/cards/R101-Ajian-S3-65-影响面.md（本卡）——写调用点总数 356 / UPDATE 281 / DELETE 75 / 命中集 38（27 文件）；含写路径全量表 356 行、读路径按文件全量聚表 169 行、命中集逐条展开表 38 行、反证复算 8 例（命中 5 例两版参数对照 + 不受影响对照 3 例）+ 不命中归类 6 条。
证据（可复跑）：见 §2（计数命令与分母口径）、§4（真实 injectUpdateTenant 两版纯函数复算）、§9（一键复跑命令）；关键锚点：backend/src/config/database.ts:271-286（main 现版病灶）、:214-225（SELECT 同款写法）、:251-266（INSERT 分支）。
验收自评：①计数可独立复算 通过（§2，误差 0；commands 与输出同卡）；②命中集逐条可核对 通过（§3，每条含 文件:行号 + 展开后 SQL + tenantId 实参行）；③反证 通过（§4，命中 5 例两版参数对照 + 不命中 6 条逐条指明卡在哪一条件）；④口径差异逐条解释 通过（§5）；⑤四条件逐项有依据 通过（§1/§3/§4）；⑥只读性自查 通过（§8，附 git status --porcelain 原始输出）。
未完成与阻塞：① 旧口径 484/439 无法复现（其扫描脚本未入库，本卡用其卡内命令复跑得 769 行，§5 给出可核对归因）；② 本通道禁止 node 子进程（EPERM），故不产出运行期读数（无 DB/浏览器），运行期项已单列 §7；③ 无其他未完成。
风险与自我报备：① 命中集 38 处中 32 处调用方**不校验 affectedRows**，修复后写入开始生效但"0 行"仍不会报错（属另一批工作，本卡未动）；② services/admin/marketing-points.service.ts:292 修复前存在"积分流水已记、余额未扣"的矛盾数据（依据 :301 INSERT 自带 tenant_id 可正常写入），**历史脏数据需人工清点**；③ 附带发现两处本卡范围外缺陷（读路径同族 1 处、INSERT 重建 SQL 丢括号 1 处，§7），**本卡未修**；④ 目录名含"（（DELETE））"等纯格式化差异不影响判定；⑤ 本卡所有结论均为静态结论，标注了"需运行期确认"的项不得当结论使用。
回传要求：本汇报已落卡：docs/tasks/cards/R101-Ajian-S3-65-影响面.md
关联卡：docs/tasks/cards/R101-S3-65-影响面-派单卡.md
```

---

## 〇、结论摘要（结论先行）

1. **计数**：`backend/src/**`（排除 `__tests__`）中三个 WithTenant helper 的调用点共 **1842** 处 = UPDATE **281** + DELETE **75** + INSERT **177** + SELECT **1298** + 动态/不可静态解析 **11**；其中走 `injectUpdateTenant` 的写路径调用点 **356** 处（UPDATE 281 + DELETE 75）。
2. **命中集**：写路径中"SQL 未自带 tenant_id 且注入后参数会错位"的调用点共 **38 处 / 27 个文件**（候选 40 处，其中 2 处经动态条件核对后判不命中，见 §3/§7）。判定式为一句话：**UPDATE/DELETE ∧ SQL 文本不含 `tenant_id` ∧ 注入点（首个 `where`）之前存在 `?` 占位符 ∧ tenantId 实参可真值**。
3. **DELETE 无一命中**：75 处 DELETE 的"首个 WHERE 前占位符数"**全部为 0**（§2），因此虽与 UPDATE 共用 `injectUpdateTenant`（`database.ts:291`），实际不产生错位——这是本卡对"DELETE 同灶"说法的**精确化**（同函数同分支，但触发条件不成立）。
4. **与旧口径（10 处）关系**：旧 10 处**全部包含在**本卡 38 处内（逐条见 §5 对照表）；新增 28 处来自两个旧口径没覆盖的形态：① 动态 SET 拼接（`updates.join(", ")` 等，20 处）；② 同为静态形态但旧扫描漏记（8 处，**含本次 P0 现场 `services/admin/auth.service.ts:293` changePassword**）。
5. **修复后开始真正落库的功能面**（38 条逐条一句话见 §3）：改密 / 默认主页 / 员工启用停用 / 购物车数量 / 拜访签到签退 / 打印模板 / 积分兑换与规则 / 优惠券·秒杀·满减·拼团·促销·叠加规则 / 标签 / 支付与硬件配置 / 即时零售对接 / 员工资料 / SKU 条码 / 推送 token / 订单超时配置。
6. **附带发现（不在本卡范围，本卡未修）**：① **读路径同族缺陷 1 处**——`injectSelectTenant` 的"含 WHERE"分支（`database.ts:225`）用的是**同一个前置写法** `[tenantId, ...params]`，本卡扫得 1 处 SELECT 调用点在首个 `where` 前存在占位符（`services/admin/report/sales-report.service.ts:154`）；② **INSERT 分支重建 SQL 丢尾部 1 处**——`injectInsertTenant`（`database.ts:262`）用正则重建语句，`VALUES (..., NOW())` 会在**第一个 `)` 处截断**，`services/admin/push.service.ts:371` 注入后 SQL 括号不平衡（复算证据见 §7）。
7. **旧数字 484/439 不予引用**：本卡复跑旧卡给出的 rg 命令得 **769** 行（≠484），旧脚本未入库、计数单位不可复现；本卡给出可复算的替代数字（三 helper 写路径 356 / 五 helper 写语句 396 / 事务内 `conn.*` 写语句 26），差异归因见 §5。

---

## 一、全量表（每个 WithTenant 调用一行）

### 1.1 写路径全量表（UPDATE + DELETE，356 行，逐行）

列规范（逐字按派单卡 §四模板执行，「判定」列取值与 §4 的规则码对应）：

- **判定码**：`命中`（H1 静态命中 / H2 动态 SET 展开后命中）；`不命中`（N1 SQL 自带 tenant_id 短路 / N2 首个 WHERE 前无占位符 / N3 非写路径 / N4 tenantId 恒空串 / N5 动态条件使其运行期自带 tenant_id）。
- **「自带 tenant_id?（WHERE 前 ? 个数）」**列：括号内是"首个 `where` 出现位置之前的 `?` 个数"——**这是本卡的判据核心**：`>0` 表示注入的 `tenant_id = ?` 归位错误、参数整体错位；`0` 表示注入后参数顺序恰好正确（与实现一致，见 §4 复算）。
- helper 缩写：`qWT` = `queryWithTenant`、`qOWT` = `queryOneWithTenant`、`eWT` = `executeWithTenant`。
- 路径已省略 `backend/src/` 前缀（同派单卡模板口径）；命中集在 §3 给出**带完整前缀**的 `文件:行号`。

| 文件:行号 | helper | 表名 | SQL 摘要（≤80 字） | SET 含占位符? | 自带 tenant_id?（WHERE 前 ? 个数） | tenantId 来源（实参行） | 判定 |
|---|---|---|---|---|---|---|---|
| services/admin/aftersale.service.ts:111 | qWT | t_aftersale | UPDATE t_aftersale SET status = 'CANCELLED', updated_at = NOW() WHERE aftersale_ | 否 | 是（0） | 参数 tenantId: string @cancelAftersale:110 ｜行 115 | 不命中 |
| services/admin/aftersale.service.ts:135 | qWT | t_aftersale | UPDATE t_aftersale SET return_logistics_no = ?, return_logistics_company = ?, st | 是 | 是（2） | 解构自 params ｜行 139 | 不命中 |
| services/admin/aftersale.service.ts:156 | qWT | t_aftersale | UPDATE t_aftersale SET satisfaction = ?, customer_comment = ?, updated_at = NOW( | 是 | 是（2） | 解构自 params ｜行 160 | 不命中 |
| services/admin/aftersale.service.ts:233 | qWT | t_aftersale | UPDATE t_aftersale SET status = 'APPROVED', processed_by = ?, process_remark = ? | 是 | 是（2） | 参数 tenantId: string @approveAftersale:232 ｜行 237 | 不命中 |
| services/admin/aftersale.service.ts:247 | qWT | t_aftersale | UPDATE t_aftersale SET status = 'REJECTED', processed_by = ?, process_remark = ? | 是 | 是（2） | 参数 tenantId: string @rejectAftersale:246 ｜行 251 | 不命中 |
| services/admin/aftersale.service.ts:261 | qWT | t_aftersale | UPDATE t_aftersale SET status = 'RECEIVED', updated_at = NOW(), version = versio | 否 | 是（0） | 参数 tenantId: string @confirmReceipt:260 ｜行 265 | 不命中 |
| services/admin/aftersale.service.ts:285 | qWT | t_aftersale | UPDATE t_aftersale SET status = ?, inspected_by = ?, inspect_result = ?, inspect | 是 | 是（4） | 解构自 params ｜行 292 | 不命中 |
| services/admin/aftersale.service.ts:309 | qWT | t_aftersale | UPDATE t_aftersale SET status = 'COMPLETED', processed_by = ?, process_remark =  | 是 | 是（2） | 解构自 params ｜行 313 | 不命中 |
| services/admin/approval-flow.service.ts:165 | qWT | t_approval_rule | UPDATE t_approval_rule SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateRule:111 ｜行 168 | 命中 |
| services/admin/approval-flow.service.ts:195 | qWT | t_approval_rule | DELETE FROM t_approval_rule WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteRule:175 ｜行 198 | 不命中 |
| services/admin/approval-records.service.ts:603 | qWT | t_approval_notification | UPDATE t_approval_notification SET read_status = 1, read_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @markNotificationRead:598 ｜行 606 | 不命中 |
| services/admin/auth.service.ts:270 | qWT | t_sys_user | UPDATE t_sys_user SET default_homepage = ? WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @updateSettings:269 ｜行 273 | 命中 |
| services/admin/auth.service.ts:293 | qWT | t_sys_user | UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @changePassword:278 ｜行 293 | 命中 |
| services/admin/bank-account.service.ts:93 | qWT | t_bank_account | UPDATE t_bank_account SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 93 | 不命中 |
| services/admin/bank-account.service.ts:101 | qWT | t_bank_account | UPDATE t_bank_account SET balance = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @updateBankAccountBalance:97 ｜行 101 | 不命中 |
| services/admin/bank-account.service.ts:109 | qWT | t_bank_account | UPDATE t_bank_account SET status = 'FROZEN' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @freezeBankAccount:105 ｜行 109 | 不命中 |
| services/admin/bank-account.service.ts:117 | qWT | t_bank_account | UPDATE t_bank_account SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @unfreezeBankAccount:113 ｜行 117 | 不命中 |
| services/admin/bank-account.service.ts:125 | qWT | t_bank_account | UPDATE t_bank_account SET status = 'CLOSED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @closeBankAccount:121 ｜行 125 | 不命中 |
| services/admin/brand.service.ts:52 | qWT | t_brand | UPDATE t_brand SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @update:34 ｜行 54 | 不命中 |
| services/admin/brand.service.ts:66 | qWT | t_brand | DELETE FROM t_brand WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @remove:59 ｜行 66 | 不命中 |
| services/admin/cart.service.ts:291 | qWT | t_cart_item | UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @addToCart:275 ｜行 294 | 命中 |
| services/admin/cart.service.ts:308 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @updateCartItemQuantity:306 ｜行 311 | 不命中 |
| services/admin/cart.service.ts:315 | qWT | t_cart_item | UPDATE t_cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AN | 是 | 否（1） | 参数 tenantId: string @updateCartItemQuantity:306 ｜行 318 | 命中 |
| services/admin/cart.service.ts:331 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteCartItem:330 ｜行 334 | 不命中 |
| services/admin/cart.service.ts:340 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @clearCart:339 ｜行 343 | 不命中 |
| services/admin/category.service.ts:116 | qWT | t_product_category | UPDATE t_product_category SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @update:94 ｜行 118 | 不命中 |
| services/admin/category.service.ts:159 | qWT | t_product_category | DELETE FROM t_product_category WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @remove:134 ｜行 159 | 不命中 |
| services/admin/commission.service.ts:138 | qWT | t_sales_commission_rule | UPDATE t_sales_commission_rule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 141 | 不命中 |
| services/admin/commission.service.ts:153 | qWT | t_sales_commission_rule | DELETE FROM t_sales_commission_rule WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteCommissionRule:146 ｜行 156 | 不命中 |
| services/admin/commission.service.ts:243 | qWT | t_sales_commission_record | UPDATE t_sales_commission_record SET status = 'SETTLED', settled_at = NOW() WHER | 动态(H2 见 §3) | 是（0） | 解构自 params ｜行 247 | 不命中 |
| services/admin/credit-adjust.service.ts:62 | qWT | t_customer_credit | UPDATE t_customer_credit SET credit_limit = ?, version = version + 1, updated_at | 是 | 是（1） | ctx.tenantId ｜行 67 | 不命中 |
| services/admin/credit-adjust.service.ts:112 | qWT | t_customer_credit | UPDATE t_customer_credit SET payment_term = ?, version = version + 1, updated_at | 是 | 是（1） | ctx.tenantId ｜行 116 | 不命中 |
| services/admin/credit-collection.service.ts:261 | qWT | t_collection_record | UPDATE t_collection_record SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | ctx.tenantId ｜行 264 | 不命中 |
| services/admin/credit-limit.service.ts:356 | qWT | t_customer_credit | UPDATE t_customer_credit SET status = 'FROZEN', credit_frozen = credit_frozen +  | 是 | 是（2） | ctx.tenantId ｜行 362 | 不命中 |
| services/admin/credit-limit.service.ts:407 | qWT | t_customer_credit | UPDATE t_customer_credit SET status = 'ACTIVE', credit_frozen = GREATEST(0, cred | 是 | 是（1） | ctx.tenantId ｜行 414 | 不命中 |
| services/admin/custom-report-v2.service.ts:280 | qWT | t_custom_report | UPDATE t_custom_report SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateReport:252 ｜行 283 | 不命中 |
| services/admin/custom-report-v2.service.ts:299 | qWT | t_custom_report | DELETE FROM t_custom_report WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteReport:289 ｜行 302 | 不命中 |
| services/admin/custom-report.service.ts:201 | qWT | t_custom_report_template | UPDATE t_custom_report_template SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateTemplate:188 ｜行 204 | 不命中 |
| services/admin/custom-report.service.ts:210 | qWT | t_custom_report_template | DELETE FROM t_custom_report_template WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteTemplate:209 ｜行 213 | 不命中 |
| services/admin/custom-report.service.ts:365 | qWT | t_custom_report_schedule | UPDATE t_custom_report_schedule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateSchedule:352 ｜行 368 | 不命中 |
| services/admin/custom-report.service.ts:374 | qWT | t_custom_report_schedule | DELETE FROM t_custom_report_schedule WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteSchedule:373 ｜行 377 | 不命中 |
| services/admin/custom-report.service.ts:383 | qWT | t_custom_report_schedule | UPDATE t_custom_report_schedule SET status = ?, updated_at = NOW() WHERE id = ?  | 是 | 是（1） | 参数 tenantId: string @toggleSchedule:382 ｜行 386 | 不命中 |
| services/admin/custom-report.service.ts:399 | qWT | t_custom_report_schedule | UPDATE t_custom_report_schedule SET last_run_at = NOW(), updated_at = NOW() WHER | 否 | 是（0） | 参数 tenantId: string @runSchedule:391 ｜行 402 | 不命中 |
| services/admin/customer-care.service.ts:87 | qWT | t_customer_care_rule | UPDATE t_customer_care_rule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 87 | 不命中 |
| services/admin/customer-care.service.ts:92 | qWT | t_customer_care_log | DELETE FROM t_customer_care_log WHERE rule_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteCareRule:91 ｜行 92 | 不命中 |
| services/admin/customer-care.service.ts:93 | qWT | t_customer_care_rule | DELETE FROM t_customer_care_rule WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteCareRule:91 ｜行 93 | 不命中 |
| services/admin/customer-care.service.ts:151 | qWT | t_customer_points | UPDATE t_customer_points SET available_points = available_points + ?, total_poin | 是 | 是（2） | 参数 tenantId: string @executeCareRule:117 ｜行 151 | 不命中 |
| services/admin/customer-price.service.ts:115 | qWT | t_customer_price | UPDATE t_customer_price SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 118 | 不命中 |
| services/admin/customer-price.service.ts:130 | qWT | t_customer_price | DELETE FROM t_customer_price WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteCustomerPrice:123 ｜行 133 | 不命中 |
| services/admin/customer-segment.service.ts:74 | qWT | t_customer_segment | UPDATE t_customer_segment SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 74 | 不命中 |
| services/admin/customer-segment.service.ts:79 | qWT | t_customer_segment_member | DELETE FROM t_customer_segment_member WHERE segment_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteSegment:78 ｜行 79 | 不命中 |
| services/admin/customer-segment.service.ts:80 | qWT | t_customer_segment | DELETE FROM t_customer_segment WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteSegment:78 ｜行 80 | 不命中 |
| services/admin/customer-segment.service.ts:109 | qWT | t_customer_segment_member | DELETE FROM t_customer_segment_member WHERE segment_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @refreshSegmentMembers:103 ｜行 109 | 不命中 |
| services/admin/customer-segment.service.ts:118 | qWT | t_customer_segment | UPDATE t_customer_segment SET member_count = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @refreshSegmentMembers:103 ｜行 118 | 不命中 |
| services/admin/customer-statement.service.ts:191 | qWT | t_customer_statement | UPDATE t_customer_statement SET status = 'CONFIRMED', confirmed_at = NOW() WHERE | 否 | 是（0） | 参数 tenantId: string @confirm:182 ｜行 194 | 不命中 |
| services/admin/customer-statement.service.ts:213 | qWT | t_customer_statement | UPDATE t_customer_statement SET status = 'PAID' WHERE statement_no = ? AND tenan | 否 | 是（0） | 参数 tenantId: string @markPaid:204 ｜行 216 | 不命中 |
| services/admin/customer-tag.service.ts:96 | qWT | t_customer_tag | UPDATE t_customer_tag SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 96 | 不命中 |
| services/admin/customer-tag.service.ts:101 | qWT | t_customer_tag_relation | DELETE FROM t_customer_tag_relation WHERE tag_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteTag:100 ｜行 101 | 不命中 |
| services/admin/customer-tag.service.ts:102 | qWT | t_customer_tag | DELETE FROM t_customer_tag WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteTag:100 ｜行 102 | 不命中 |
| services/admin/customer-tag.service.ts:113 | qWT | t_customer_tag_relation | DELETE FROM t_customer_tag_relation WHERE customer_id = ? AND tag_id = ? AND ten | —（DELETE） | 是（0） | 参数 tenantId: string @removeCustomerTag:112 ｜行 113 | 不命中 |
| services/admin/customer-type.service.ts:104 | qWT | t_customer_type | UPDATE t_customer_type SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @update:68 ｜行 107 | 不命中 |
| services/admin/customer-type.service.ts:123 | qWT | t_customer_type | DELETE FROM t_customer_type WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @remove:113 ｜行 126 | 不命中 |
| services/admin/customer-visit.service.ts:447 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateVisit:389 ｜行 450 | 命中 |
| services/admin/customer-visit.service.ts:506 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @checkin:476 ｜行 509 | 命中 |
| services/admin/customer-visit.service.ts:565 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @checkout:523 ｜行 568 | 命中 |
| services/admin/customer-visit.service.ts:600 | qWT | t_customer_visit | UPDATE t_customer_visit SET status = 'CANCELLED', updated_at = NOW() WHERE visit | 否 | 否（0） | 参数 tenantId: string @cancelVisit:582 ｜行 603 | 不命中 |
| services/admin/customer.service.ts:240 | qWT | t_member | UPDATE t_member SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateCustomer:222 ｜行 240 | 不命中 |
| services/admin/customer.service.ts:262 | qWT | t_member | UPDATE t_member SET status = 'INACTIVE', updated_at = NOW() WHERE id = ? AND ten | 否 | 是（0） | 参数 tenantId: string @disableCustomer:254 ｜行 262 | 不命中 |
| services/admin/customer.service.ts:275 | qWT | t_member | UPDATE t_member SET staff_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id  | 是 | 是（1） | 参数 tenantId: string @assignStaffToCustomer:266 ｜行 275 | 不命中 |
| services/admin/employee.service.ts:180 | qWT | t_sys_user | UPDATE t_sys_user SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateStaff:159 ｜行 180 | 命中 |
| services/admin/employee.service.ts:184 | qWT | t_sys_user_role | DELETE FROM t_sys_user_role WHERE user_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @updateStaff:159 ｜行 184 | 不命中 |
| services/admin/employee.service.ts:205 | qWT | t_sys_user | UPDATE t_sys_user SET status = 0 WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @disableStaff:197 ｜行 205 | 不命中 |
| services/admin/employee.service.ts:215 | qWT | t_sys_user | UPDATE t_sys_user SET status = ? WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @setStaffStatus:210 ｜行 215 | 命中 |
| services/admin/employee.service.ts:316 | qWT | t_store | UPDATE t_store SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateStore:283 ｜行 316 | 不命中 |
| services/admin/expense.service.ts:109 | qWT | t_expense | UPDATE t_expense SET ${…} WHERE expense_no = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 109 | 不命中 |
| services/admin/expense.service.ts:117 | qWT | t_expense | UPDATE t_expense SET status = 'APPROVED' WHERE expense_no = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @approveExpense:113 ｜行 117 | 不命中 |
| services/admin/expense.service.ts:125 | qWT | t_expense | UPDATE t_expense SET status = 'VOIDED' WHERE expense_no = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @voidExpense:121 ｜行 125 | 不命中 |
| services/admin/instant-retail.service.ts:416 | qWT | t_platform_config | UPDATE t_platform_config SET store_id = ?, app_key = ?, app_secret = ?, merchant | 是 | 否（5） | 参数 tenantId: string @upsertConfig:398 ｜行 428 | 命中 |
| services/admin/instant-retail.service.ts:521 | qWT | t_platform_config | DELETE FROM t_platform_config WHERE platform = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteConfig:519 ｜行 524 | 不命中 |
| services/admin/instant-retail.service.ts:604 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platfo | 否 | 否（0） | 参数 tenantId: string @confirmOrder:587 ｜行 607 | 不命中 |
| services/admin/instant-retail.service.ts:630 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'DELIVERING', updated_at = NOW() WHERE plat | 否 | 否（0） | 参数 tenantId: string @startDelivery:613 ｜行 633 | 不命中 |
| services/admin/instant-retail.service.ts:656 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'COMPLETED', updated_at = NOW() WHERE platf | 否 | 否（0） | 参数 tenantId: string @completeDelivery:639 ｜行 659 | 不命中 |
| services/admin/instant-retail.service.ts:684 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platf | 否 | 否（0） | 参数 tenantId: string @cancelOrder:665 ｜行 687 | 不命中 |
| services/admin/instant-retail.service.ts:742 | qWT | t_retail_shop_config | UPDATE t_retail_shop_config SET shop_name = ?, shop_logo = ?, shop_description = | 是 | 是（13） | 参数 tenantId: string @saveShopConfig:720 ｜行 757 | 不命中 |
| services/admin/instant-retail.service.ts:1064 | qWT | t_retail_order | UPDATE t_retail_order SET ${…} WHERE order_no = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 解构自 params ｜行 1067 | 不命中 |
| services/admin/inventory-cost.service.ts:58 | qWT | t_product_sku | UPDATE t_product_sku SET cost_price = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 解构自 params ｜行 61 | 不命中 |
| services/admin/inventory-loss-gain.service.ts:43 | qWT | t_inventory_balance | UPDATE t_inventory_balance SET physical_qty = GREATEST(physical_qty + ?, 0), ava | 是 | 是（2） | 解构自 params ｜行 46 | 不命中 |
| services/admin/inventory-loss-order.service.ts:341 | qWT | t_inventory_loss_order | UPDATE t_inventory_loss_order SET status = 'REJECTED', auditor_id = ?, auditor_n | 是 | 是（3） | 解构自 params ｜行 346 | 不命中 |
| services/admin/inventory-profit-order.service.ts:341 | qWT | t_inventory_profit_order | UPDATE t_inventory_profit_order SET status = 'REJECTED', auditor_id = ?, auditor | 是 | 是（3） | 解构自 params ｜行 346 | 不命中 |
| services/admin/inventory-share.service.ts:157 | qWT | t_inventory_share_setting | UPDATE t_inventory_share_setting SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateShareSetting:92 ｜行 160 | 不命中 |
| services/admin/inventory-share.service.ts:355 | qWT | t_inventory_share_product | UPDATE t_inventory_share_product SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateShareProduct:319 ｜行 358 | 不命中 |
| services/admin/inventory-share.service.ts:376 | qWT | t_inventory_share_product | DELETE FROM t_inventory_share_product WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @removeShareProduct:366 ｜行 379 | 不命中 |
| services/admin/inventory-share.service.ts:392 | qWT | t_inventory_share_product | DELETE FROM t_inventory_share_product WHERE id IN (${…}) AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @batchRemoveShareProducts:386 ｜行 395 | 不命中 |
| services/admin/marketing-coupon.service.ts:271 | qWT | t_coupon_template | UPDATE t_coupon_template SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateCouponTemplate:236 ｜行 271 | 命中 |
| services/admin/marketing-coupon.service.ts:297 | qWT | t_coupon_template | DELETE FROM t_coupon_template WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteCouponTemplate:288 ｜行 297 | 不命中 |
| services/admin/marketing-coupon.service.ts:310 | qWT | t_coupon_template | UPDATE t_coupon_template SET status = 'ACTIVE' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @activateCouponTemplate:301 ｜行 310 | 不命中 |
| services/admin/marketing-coupon.service.ts:323 | qWT | t_coupon_template | UPDATE t_coupon_template SET status = 'PAUSED' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @pauseCouponTemplate:314 ｜行 323 | 不命中 |
| services/admin/marketing-flash-sale.service.ts:216 | qWT | t_flash_sale | UPDATE t_flash_sale SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateFlashSale:185 ｜行 216 | 命中 |
| services/admin/marketing-flash-sale.service.ts:242 | qWT | t_flash_sale | DELETE FROM t_flash_sale WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteFlashSale:233 ｜行 242 | 不命中 |
| services/admin/marketing-flash-sale.service.ts:255 | qWT | t_flash_sale | UPDATE t_flash_sale SET status = 'ACTIVE' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @activateFlashSale:246 ｜行 255 | 不命中 |
| services/admin/marketing-flash-sale.service.ts:268 | qWT | t_flash_sale | UPDATE t_flash_sale SET status = 'PAUSED' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @pauseFlashSale:259 ｜行 268 | 不命中 |
| services/admin/marketing-full-reduction.service.ts:156 | qWT | t_full_reduction | UPDATE t_full_reduction SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateFullReduction:125 ｜行 156 | 命中 |
| services/admin/marketing-full-reduction.service.ts:180 | qWT | t_full_reduction | DELETE FROM t_full_reduction WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteFullReduction:171 ｜行 180 | 不命中 |
| services/admin/marketing-full-reduction.service.ts:193 | qWT | t_full_reduction | UPDATE t_full_reduction SET status = 'ACTIVE' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @activateFullReduction:184 ｜行 193 | 不命中 |
| services/admin/marketing-full-reduction.service.ts:206 | qWT | t_full_reduction | UPDATE t_full_reduction SET status = 'PAUSED' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @pauseFullReduction:197 ｜行 206 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:143 | qWT | t_gift_rule | UPDATE t_gift_rule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateGiftRule:127 ｜行 143 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:148 | qWT | t_gift_rule_level | DELETE FROM t_gift_rule_level WHERE rule_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteGiftRule:147 ｜行 148 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:149 | qWT | t_gift_rule | DELETE FROM t_gift_rule WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteGiftRule:147 ｜行 149 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:153 | qWT | t_gift_rule | UPDATE t_gift_rule SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @activateGiftRule:152 ｜行 153 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:157 | qWT | t_gift_rule | UPDATE t_gift_rule SET status = 'PAUSED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @pauseGiftRule:156 ｜行 157 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:177 | qWT | t_gift_rule_level | UPDATE t_gift_rule_level SET ${…} WHERE id = ? AND rule_id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateGiftRuleLevel:167 ｜行 177 | 不命中 |
| services/admin/marketing-gift-rule.service.ts:181 | qWT | t_gift_rule_level | DELETE FROM t_gift_rule_level WHERE id = ? AND rule_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteGiftRuleLevel:180 ｜行 181 | 不命中 |
| services/admin/marketing-group-buy.service.ts:193 | qWT | t_group_buy | UPDATE t_group_buy SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateGroupBuy:158 ｜行 193 | 命中 |
| services/admin/marketing-group-buy.service.ts:221 | qWT | t_group_buy | DELETE FROM t_group_buy WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteGroupBuy:212 ｜行 221 | 不命中 |
| services/admin/marketing-group-buy.service.ts:234 | qWT | t_group_buy | UPDATE t_group_buy SET status = 'ACTIVE' WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @activateGroupBuy:225 ｜行 234 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:137 | qWT | t_limited_discount | UPDATE t_limited_discount SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateLimitedDiscount:122 ｜行 137 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:142 | qWT | t_limited_discount_product | DELETE FROM t_limited_discount_product WHERE discount_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteLimitedDiscount:141 ｜行 142 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:143 | qWT | t_limited_discount | DELETE FROM t_limited_discount WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteLimitedDiscount:141 ｜行 143 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:147 | qWT | t_limited_discount | UPDATE t_limited_discount SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @activateLimitedDiscount:146 ｜行 147 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:151 | qWT | t_limited_discount | UPDATE t_limited_discount SET status = 'PAUSED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @pauseLimitedDiscount:150 ｜行 151 | 不命中 |
| services/admin/marketing-limited-discount.service.ts:176 | qWT | t_limited_discount_product | DELETE FROM t_limited_discount_product WHERE discount_id = ? AND product_id = ?  | —（DELETE） | 是（0） | 参数 tenantId: string @removeDiscountProduct:175 ｜行 176 | 不命中 |
| services/admin/marketing-material.service.ts:106 | qWT | t_marketing_material | UPDATE t_marketing_material SET view_count = view_count + 1 WHERE id = ? AND ten | 否 | 是（0） | 参数 tenantId: string @getMaterialDetail:103 ｜行 106 | 不命中 |
| services/admin/marketing-material.service.ts:123 | qWT | t_marketing_material | UPDATE t_marketing_material SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateMaterial:111 ｜行 123 | 不命中 |
| services/admin/marketing-material.service.ts:128 | qWT | t_marketing_material | DELETE FROM t_marketing_material WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteMaterial:127 ｜行 128 | 不命中 |
| services/admin/marketing-material.service.ts:132 | qWT | t_marketing_material | UPDATE t_marketing_material SET status = 'PUBLISHED' WHERE id = ? AND tenant_id  | 否 | 是（0） | 参数 tenantId: string @publishMaterial:131 ｜行 132 | 不命中 |
| services/admin/marketing-material.service.ts:136 | qWT | t_marketing_material | UPDATE t_marketing_material SET status = 'ARCHIVED' WHERE id = ? AND tenant_id = | 否 | 是（0） | 参数 tenantId: string @archiveMaterial:135 ｜行 136 | 不命中 |
| services/admin/marketing-material.service.ts:174 | qWT | t_material_category | UPDATE t_material_category SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateMaterialCategory:166 ｜行 174 | 不命中 |
| services/admin/marketing-material.service.ts:178 | qWT | t_material_category | DELETE FROM t_material_category WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteMaterialCategory:177 ｜行 178 | 不命中 |
| services/admin/marketing-new-coupon.service.ts:285 | qWT | t_coupon_template | UPDATE t_coupon_template SET ${…}, updated_at = NOW() WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateCouponTemplate:219 ｜行 288 | 命中 |
| services/admin/marketing-new-coupon.service.ts:463 | qWT | t_coupon_template | DELETE FROM t_coupon_template WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteCouponTemplate:451 ｜行 463 | 不命中 |
| services/admin/marketing-new-coupon.service.ts:480 | qWT | t_coupon_template | UPDATE t_coupon_template SET status = 'ACTIVE', updated_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @activateCouponTemplate:468 ｜行 480 | 不命中 |
| services/admin/marketing-new-coupon.service.ts:497 | qWT | t_coupon_template | UPDATE t_coupon_template SET status = 'PAUSED', updated_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @pauseCouponTemplate:485 ｜行 497 | 不命中 |
| services/admin/marketing-new-promotion.service.ts:266 | qWT | t_promotion_activity | UPDATE t_promotion_activity SET ${…}, updated_at = NOW() WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updatePromotion:214 ｜行 269 | 命中 |
| services/admin/marketing-points-mall.service.ts:130 | qWT | t_points_product | UPDATE t_points_product SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updatePointsProduct:117 ｜行 130 | 不命中 |
| services/admin/marketing-points-mall.service.ts:135 | qWT | t_points_product | DELETE FROM t_points_product WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deletePointsProduct:134 ｜行 135 | 不命中 |
| services/admin/marketing-points-mall.service.ts:142 | qWT | t_points_product | UPDATE t_points_product SET status = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @togglePointsProduct:138 ｜行 142 | 不命中 |
| services/admin/marketing-points-mall.service.ts:178 | qWT | t_member | UPDATE t_member SET points = points - ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @exchangeProduct:168 ｜行 178 | 不命中 |
| services/admin/marketing-points-mall.service.ts:179 | qWT | t_points_product | UPDATE t_points_product SET stock_available = stock_available - ? WHERE id = ? A | 是 | 是（1） | 参数 tenantId: string @exchangeProduct:168 ｜行 179 | 不命中 |
| services/admin/marketing-points-mall.service.ts:192 | qWT | t_points_exchange_record | UPDATE t_points_exchange_record SET status = 'CANCELLED' WHERE id = ? AND tenant | 否 | 是（0） | 参数 tenantId: string @cancelExchange:188 ｜行 192 | 不命中 |
| services/admin/marketing-points-mall.service.ts:193 | qWT | t_member | UPDATE t_member SET points = points + ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @cancelExchange:188 ｜行 193 | 不命中 |
| services/admin/marketing-points-mall.service.ts:194 | qWT | t_points_product | UPDATE t_points_product SET stock_available = stock_available + ? WHERE id = ? A | 是 | 是（1） | 参数 tenantId: string @cancelExchange:188 ｜行 194 | 不命中 |
| services/admin/marketing-points-mall.service.ts:198 | qWT | t_points_exchange_record | UPDATE t_points_exchange_record SET status = 'CONFIRMED' WHERE id = ? AND tenant | 否 | 是（0） | 参数 tenantId: string @confirmExchange:197 ｜行 198 | 不命中 |
| services/admin/marketing-points.service.ts:90 | qWT | t_points_rule | UPDATE t_points_rule SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updatePointsRule:67 ｜行 90 | 命中 |
| services/admin/marketing-points.service.ts:292 | qWT | t_user_points | UPDATE t_user_points SET points = ?, total_spent = total_spent + ? WHERE user_id | 是 | 否（2） | 解构自 params ｜行 297 | 命中 |
| services/admin/marketing-stack-rule.service.ts:85 | qWT | t_promo_stack_rule | UPDATE t_promo_stack_rule SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateStackRule:62 ｜行 85 | 命中 |
| services/admin/marketing-stack-rule.service.ts:106 | qWT | t_promo_stack_rule | DELETE FROM t_promo_stack_rule WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteStackRule:100 ｜行 106 | 不命中 |
| services/admin/member.service.ts:181 | qWT | t_member | UPDATE t_member SET member_level = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @updateMemberLevel:178 ｜行 181 | 不命中 |
| services/admin/member.service.ts:182 | qWT | t_customer_level | UPDATE t_customer_level SET level_name = ?, upgraded_at = NOW() WHERE customer_i | 是 | 是（1） | 参数 tenantId: string @updateMemberLevel:178 ｜行 182 | 不命中 |
| services/admin/member.service.ts:183 | qWT | t_customer_profile | UPDATE t_customer_profile SET member_level = ? WHERE customer_id = ? AND tenant_ | 是 | 是（1） | 参数 tenantId: string @updateMemberLevel:178 ｜行 183 | 不命中 |
| services/admin/miniapp-config.service.ts:133 | eWT | t_miniapp_config | UPDATE t_miniapp_config SET app_id = ?, app_secret = ?, app_name = ?, app_versio | 是 | 是（8） | 参数 tenantId: string @saveConfig:120 ｜行 151 | 不命中 |
| services/admin/miniapp-order-sync.service.ts:61 | qWT | t_miniapp_order_sync_log | UPDATE t_miniapp_order_sync_log SET status = 'PENDING', updated_at = NOW() WHERE | 否 | 是（0） | 参数 tenantId: string @retrySync:60 ｜行 65 | 不命中 |
| services/admin/miniapp-template.service.ts:136 | qWT | t_miniapp_template | UPDATE t_miniapp_template SET ${…}, updated_at = NOW() WHERE id = ? AND (tenant_ | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateTemplate:116 ｜行 139 | 不命中 |
| services/admin/miniapp-template.service.ts:146 | qWT | t_miniapp_template | DELETE FROM t_miniapp_template WHERE id = ? AND (tenant_id = ? OR tenant_id = 'D | —（DELETE） | 是（0） | 参数 tenantId: string @deleteTemplate:145 ｜行 149 | 不命中 |
| services/admin/miniapp-template.service.ts:157 | qWT | t_miniapp_config | UPDATE t_miniapp_config SET template_id = ?, updated_at = NOW() WHERE tenant_id  | 是 | 是（1） | 参数 tenantId: string @applyTemplate:154 ｜行 160 | 不命中 |
| services/admin/notification-center.service.ts:123 | eWT | t_notification | UPDATE t_notification SET is_read = 1 WHERE id = ? AND tenant_id = ? AND is_read | 否 | 是（0） | 参数 tenantId: string @markAsRead:122 ｜行 126 | 不命中 |
| services/admin/notification-center.service.ts:132 | eWT | t_notification | UPDATE t_notification SET is_read = 1 WHERE tenant_id = ? AND is_read = 0 | 否 | 是（0） | 参数 tenantId: string @markAllRead:131 ｜行 135 | 不命中 |
| services/admin/notification-center.service.ts:141 | eWT | t_notification | DELETE FROM t_notification WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteNotification:140 ｜行 144 | 不命中 |
| services/admin/notification.service.ts:166 | qWT | t_notification | DELETE FROM t_notification WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteNotification:165 ｜行 169 | 不命中 |
| services/admin/notification.service.ts:181 | qWT | t_notification | DELETE FROM t_notification WHERE id IN (${…}) AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @batchDeleteNotifications:176 ｜行 184 | 不命中 |
| services/admin/order-timeout.service.ts:76 | qWT | t_order_timeout_config | UPDATE t_order_timeout_config SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | var tenantId = config.tenant_id ｜行 76 | 命中 |
| services/admin/order-timeout.service.ts:81 | qWT | t_order_timeout_config | DELETE FROM t_order_timeout_config WHERE id = ? | —（DELETE） | 否（0） | var tenantId = config.tenant_id ｜行 81 | 不命中 |
| services/admin/payment-config.service.ts:91 | eWT | t_payment_config | UPDATE t_payment_config SET box_config=?, updated_at=NOW() WHERE provider='wecha | 是 | 否（1） | 参数 tenantId: string @saveChannelConfig:68 ｜行 94 | 命中 |
| services/admin/payment-config.service.ts:111 | eWT | t_payment_config | UPDATE t_payment_config SET app_id=?, mch_id=?, api_v3_key=?, api_key=?, private | 是 | 否（10） | 参数 tenantId: string @saveChannelConfig:68 ｜行 114 | 命中 |
| services/admin/payment-config.service.ts:204 | eWT | t_bank_account | UPDATE t_bank_account SET bank_name=?, account_no=?, account_name=?, bank_branch | 是 | 是（5） | 参数 tenantId: string @updateBankAccount:203 ｜行 207 | 不命中 |
| services/admin/payment-config.service.ts:214 | eWT | t_bank_account | DELETE FROM t_bank_account WHERE id=? AND tenant_id=? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteBankAccount:213 ｜行 215 | 不命中 |
| services/admin/payment-config.service.ts:222 | eWT | t_bank_account | UPDATE t_bank_account SET is_default=0 WHERE tenant_id=? | 否 | 是（0） | 参数 tenantId: string @setDefaultBankAccount:221 ｜行 223 | 不命中 |
| services/admin/payment-config.service.ts:225 | eWT | t_bank_account | UPDATE t_bank_account SET is_default=1 WHERE id=? AND tenant_id=? | 否 | 是（0） | 参数 tenantId: string @setDefaultBankAccount:221 ｜行 226 | 不命中 |
| services/admin/payment-new.service.ts:115 | qWT | t_payable | UPDATE t_payable SET paid_amount = paid_amount + ?, balance = ?, status = ? WHER | 是 | 是（3） | 参数 tenantId: string @writeoffPayment:105 ｜行 115 | 不命中 |
| services/admin/payment-new.service.ts:125 | qWT | t_payable | UPDATE t_payable SET paid_amount = paid_amount - ?, balance = balance + ?, statu | 是 | 是（3） | 参数 tenantId: string @voidPayment:119 ｜行 125 | 不命中 |
| services/admin/payment-new.service.ts:127 | qWT | t_payment_writeoff | DELETE FROM t_payment_writeoff WHERE payment_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @voidPayment:119 ｜行 127 | 不命中 |
| services/admin/payment-new.service.ts:128 | qWT | t_payment | UPDATE t_payment SET status = 'VOIDED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @voidPayment:119 ｜行 128 | 不命中 |
| services/admin/platform-reconciliation.service.ts:95 | qWT | t_platform_reconciliation | UPDATE t_platform_reconciliation SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateReconciliation:85 ｜行 98 | 不命中 |
| services/admin/platform-review.service.ts:55 | qWT | t_platform_review | UPDATE t_platform_review SET review_result = CONCAT(IFNULL(review_result, ''), ? | 是 | 是（1） | 参数 tenantId: string @replyReview:54 ｜行 58 | 不命中 |
| services/admin/platform-review.service.ts:93 | qWT | t_platform_review | UPDATE t_platform_review SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @reviewApproval:75 ｜行 96 | 不命中 |
| services/admin/platform-review.service.ts:104 | qWT | t_platform_review | UPDATE t_platform_review SET status = ?, review_at = NOW(), updated_at = NOW() W | 是 | 是（1） | 参数 tenantId: string @batchReviewApproval:102 ｜行 108 | 不命中 |
| services/admin/points.service.ts:91 | qWT | t_points_rule | UPDATE t_points_rule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 91 | 不命中 |
| services/admin/points.service.ts:110 | qWT | t_customer_points | UPDATE t_customer_points SET available_points = ?, total_points = total_points + | 是 | 是（2） | 解构自 params ｜行 112 | 不命中 |
| services/admin/points.service.ts:164 | qWT | t_level_config | UPDATE t_level_config SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 164 | 不命中 |
| services/admin/points.service.ts:178 | qWT | t_level_config | UPDATE t_level_config SET status = ?, updated_at = NOW() WHERE id = ? AND tenant | 是 | 是（1） | 参数 tenantId: string @updateLevelConfigStatus:169 ｜行 180 | 不命中 |
| services/admin/points.service.ts:194 | qWT | t_level_config | DELETE FROM t_level_config WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteLevelConfig:186 ｜行 196 | 不命中 |
| services/admin/points.service.ts:215 | qWT | t_customer_level | UPDATE t_customer_level SET level_name = ?, level_points = ?, upgraded_at = NOW( | 是 | 是（2） | 参数 tenantId: string @checkLevelUpgrade:202 ｜行 215 | 不命中 |
| services/admin/points.service.ts:219 | qWT | t_customer_profile | UPDATE t_customer_profile SET member_level = ? WHERE customer_id = ? AND tenant_ | 是 | 是（1） | 参数 tenantId: string @checkLevelUpgrade:202 ｜行 219 | 不命中 |
| services/admin/position.service.ts:80 | qWT | t_sys_position | UPDATE t_sys_position SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 80 | 不命中 |
| services/admin/position.service.ts:87 | qWT | t_sys_position | DELETE FROM t_sys_position WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deletePosition:84 ｜行 87 | 不命中 |
| services/admin/price-level.service.ts:108 | qWT | t_price_level | UPDATE t_price_level SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updatePriceLevel:80 ｜行 111 | 不命中 |
| services/admin/price-level.service.ts:141 | qWT | t_price_level | UPDATE t_price_level SET status = 0 WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @disablePriceLevel:128 ｜行 144 | 不命中 |
| services/admin/price-management.service.ts:254 | qWT | t_sku_price | UPDATE t_sku_price SET ${…}, updated_at = NOW() WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateSkuPrice:209 ｜行 257 | 不命中 |
| services/admin/price-management.service.ts:289 | qWT | t_sku_price | DELETE FROM t_sku_price WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteSkuPrice:279 ｜行 289 | 不命中 |
| services/admin/price-management.service.ts:495 | qWT | t_customer_price_binding | UPDATE t_customer_price_binding SET price_level_id = ?, apply_reason = ?, status | 是 | 是（3） | 参数 tenantId: string @createCustomerBinding:467 ｜行 501 | 不命中 |
| services/admin/price-management.service.ts:541 | qWT | t_customer_price_binding | UPDATE t_customer_price_binding SET status = 'APPROVED', approved_by = ?, approv | 是 | 是（1） | 参数 tenantId: string @approveCustomerBinding:528 ｜行 546 | 不命中 |
| services/admin/price-management.service.ts:572 | qWT | t_customer_price_binding | UPDATE t_customer_price_binding SET status = 'REJECTED', approved_by = ?, approv | 是 | 是（1） | 参数 tenantId: string @rejectCustomerBinding:559 ｜行 577 | 不命中 |
| services/admin/price-management.service.ts:600 | qWT | t_customer_price_binding | UPDATE t_customer_price_binding SET status = 'EXPIRED', updated_at = NOW() WHERE | 否 | 是（0） | 参数 tenantId: string @cancelCustomerBinding:590 ｜行 603 | 不命中 |
| services/admin/print.service.ts:403 | qWT | t_print_template | UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, vers | 是 | 是（3） | 参数 tenantId: string @ensureDefaultPrintTemplates:372 ｜行 408 | 不命中 |
| services/admin/print.service.ts:417 | qWT | t_print_template | UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, vers | 是 | 是（3） | 参数 tenantId: string @ensureDefaultPrintTemplates:372 ｜行 422 | 不命中 |
| services/admin/print.service.ts:426 | qWT | t_print_template | UPDATE t_print_template SET template_name = ?, version = version + 1 WHERE tenan | 是 | 是（1） | 参数 tenantId: string @ensureDefaultPrintTemplates:372 ｜行 431 | 不命中 |
| services/admin/print.service.ts:520 | qWT | t_print_template | UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, stat | 是 | 否（5） | 参数 tenantId: string @updatePrintTemplate:509 ｜行 532 | 命中 |
| services/admin/print.service.ts:543 | qWT | t_print_template | DELETE FROM t_print_template WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deletePrintTemplate:538 ｜行 546 | 不命中 |
| services/admin/print.service.ts:558 | qWT | t_print_template | UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, vers | 是 | 否（3） | 参数 tenantId: string @resetPrintTemplate:552 ｜行 563 | 命中 |
| services/admin/print.service.ts:575 | qWT | t_print_template | UPDATE t_print_template SET is_default = 0 WHERE bill_type = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @setDefaultPrintTemplate:572 ｜行 578 | 不命中 |
| services/admin/print.service.ts:581 | qWT | t_print_template | UPDATE t_print_template SET is_default = 1, status = 1 WHERE id = ? AND tenant_i | 否 | 是（0） | 参数 tenantId: string @setDefaultPrintTemplate:572 ｜行 584 | 不命中 |
| services/admin/product-bundle.service.ts:344 | qWT | t_product_bundle | UPDATE t_product_bundle SET status = 1 WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @publishProductBundle:331 ｜行 347 | 不命中 |
| services/admin/product-bundle.service.ts:367 | qWT | t_product_bundle | UPDATE t_product_bundle SET status = 0 WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @unpublishProductBundle:354 ｜行 370 | 不命中 |
| services/admin/product-review.service.ts:153 | qWT | t_product_review | UPDATE t_product_review SET status = 'APPROVED', reviewer_id = ?, reviewer_name  | 是 | 是（3） | 参数 tenantId: string @approveProductReview:134 ｜行 158 | 不命中 |
| services/admin/product-review.service.ts:186 | qWT | t_product_review | UPDATE t_product_review SET status = 'REJECTED', reviewer_id = ?, reviewer_name  | 是 | 是（3） | 参数 tenantId: string @rejectProductReview:164 ｜行 191 | 不命中 |
| services/admin/product-review.service.ts:214 | qWT | t_product_review | UPDATE t_product_review SET status = 'APPROVED', reviewer_id = ?, reviewer_name  | 是 | 是（3） | 参数 tenantId: string @batchApproveProductReviews:197 ｜行 219 | 不命中 |
| services/admin/product-review.service.ts:247 | qWT | t_product_review | UPDATE t_product_review SET status = 'REJECTED', reviewer_id = ?, reviewer_name  | 是 | 是（3） | 参数 tenantId: string @batchRejectProductReviews:227 ｜行 252 | 不命中 |
| services/admin/product.service.ts:453 | qWT | t_product_spu | UPDATE t_product_spu SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_ | 是 | 是（1） | 参数 tenantId: string @updateProductStatus:452 ｜行 453 | 不命中 |
| services/admin/product.service.ts:557 | qWT | t_product_spu | UPDATE t_product_spu SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateProduct:465 ｜行 557 | 不命中 |
| services/admin/product.service.ts:560 | qWT | t_product_sku | UPDATE t_product_sku SET barcode = ? WHERE spu_id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @updateProduct:465 ｜行 560 | 不命中 |
| services/admin/product.service.ts:563 | qWT | t_product_sku | UPDATE t_product_sku SET box_ratio = ? WHERE spu_id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @updateProduct:465 ｜行 563 | 不命中 |
| services/admin/product.service.ts:602 | qWT | t_product_spu | UPDATE t_product_spu SET status = 'OFF_SALE', updated_at = NOW() WHERE id = ? AN | 否 | 是（0） | 参数 tenantId: string @disableProduct:594 ｜行 602 | 不命中 |
| services/admin/product.service.ts:699 | qWT | t_product_sku | UPDATE t_product_sku SET barcode = ?, updated_at = NOW() WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @updateSkuBarcode:692 ｜行 702 | 命中 |
| services/admin/product.service.ts:762 | qWT | t_product_sku | UPDATE t_product_sku SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateSku:723 ｜行 765 | 不命中 |
| services/admin/product.service.ts:781 | qWT | t_product_sku | UPDATE t_product_sku SET base_unit = ?, box_unit = ?, box_ratio = ?, box_barcode | 是 | 是（4） | 参数 tenantId: string @syncSkuLegacyUnits:771 ｜行 793 | 不命中 |
| services/admin/product.service.ts:889 | qWT | t_product_sku_unit | UPDATE t_product_sku_unit SET ${…} WHERE id = ? AND sku_id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateSkuUnit:845 ｜行 892 | 不命中 |
| services/admin/product.service.ts:909 | qWT | t_product_sku_unit | DELETE FROM t_product_sku_unit WHERE id = ? AND sku_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteSkuUnit:899 ｜行 912 | 不命中 |
| services/admin/product.service.ts:980 | qWT | t_product_spu | UPDATE t_product_spu SET marketing_tags = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @setMarketingTags:979 ｜行 983 | 不命中 |
| services/admin/purchase-contract.service.ts:105 | qWT | t_purchase_contract | UPDATE t_purchase_contract SET ${…} WHERE contract_no = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | params.tenantId ｜行 108 | 不命中 |
| services/admin/purchase-contract.service.ts:120 | qWT | t_purchase_contract | DELETE FROM t_purchase_contract WHERE contract_no = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deletePurchaseContract:113 ｜行 123 | 不命中 |
| services/admin/purchase-contract.service.ts:135 | qWT | t_purchase_contract | UPDATE t_purchase_contract SET file_url = ? WHERE contract_no = ? AND tenant_id  | 是 | 是（1） | 参数 tenantId: string @uploadContractFile:128 ｜行 138 | 不命中 |
| services/admin/purchase-order.service.ts:356 | qWT | t_purchase_order | UPDATE t_purchase_order SET order_status = 'CANCELLED', updated_at = NOW() WHERE | 否 | 是（0） | 参数 tenantId: string @cancelPurchaseOrder:344 ｜行 359 | 不命中 |
| services/admin/purchase-order.service.ts:377 | qWT | t_purchase_order | UPDATE t_purchase_order SET order_status = 'APPROVED', auditor_id = ?, audited_a | 是 | 是（1） | 参数 tenantId: string @confirmPurchaseOrder:365 ｜行 380 | 不命中 |
| services/admin/purchase-payment.service.ts:167 | qWT | t_purchase_payment | UPDATE t_purchase_payment SET status = 'VOIDED' WHERE payment_no = ? | 否 | 否（0） | 参数 tenantId: string @voidPayment:158 ｜行 167 | 不命中 |
| services/admin/purchase-plan.service.ts:142 | qWT | t_purchase_plan | UPDATE t_purchase_plan SET goods_amount = ? WHERE plan_no = ? AND tenant_id = ? | 是 | 是（1） | 解构自 params ｜行 145 | 不命中 |
| services/admin/purchase-plan.service.ts:221 | qWT | t_purchase_order | UPDATE t_purchase_order SET goods_amount = ? WHERE order_no = ? AND tenant_id =  | 是 | 是（1） | 参数 tenantId: string @convertPurchasePlan:184 ｜行 224 | 不命中 |
| services/admin/purchase-plan.service.ts:226 | qWT | t_purchase_plan | UPDATE t_purchase_plan SET plan_status = 'CONVERTED' WHERE plan_no = ? AND tenan | 否 | 是（0） | 参数 tenantId: string @convertPurchasePlan:184 ｜行 229 | 不命中 |
| services/admin/push.service.ts:361 | qWT | t_push_token | UPDATE t_push_token SET user_id = ?, push_token = ?, app_platform = ?, app_versi | 是 | 否（4） | 参数 tenantId: string @registerToken:333 ｜行 366 | 命中 |
| services/admin/push.service.ts:414 | qWT | t_push_token | UPDATE t_push_token SET status = 0 WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @unregisterToken:392 ｜行 417 | 不命中 |
| services/admin/quick-entry.service.ts:101 | eWT | t_quick_entries | UPDATE t_quick_entries SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateQuickEntry:86 ｜行 104 | 不命中 |
| services/admin/quick-entry.service.ts:111 | eWT | t_quick_entries | DELETE FROM t_quick_entries WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteQuickEntry:110 ｜行 114 | 不命中 |
| services/admin/quick-entry.service.ts:121 | eWT | t_quick_entries | UPDATE t_quick_entries SET sort_order = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @sortQuickEntries:119 ｜行 124 | 不命中 |
| services/admin/quote-push.service.ts:708 | qWT | t_customer_quote | UPDATE t_customer_quote SET view_count = view_count + 1 WHERE id = ? AND tenant_ | 否 | 是（0） | quote.tenantId ｜行 711 | 不命中 |
| services/admin/quote-push.service.ts:777 | qWT | t_customer_quote | UPDATE t_customer_quote SET status = 'CANCELLED', updated_at = NOW() WHERE id =  | 否 | 是（0） | 参数 tenantId: string @cancelQuote:762 ｜行 780 | 不命中 |
| services/admin/receipt.service.ts:116 | qWT | t_receivable | UPDATE t_receivable SET received_amount = received_amount + ?, balance = ?, stat | 是 | 是（3） | 参数 tenantId: string @writeoffReceipt:106 ｜行 116 | 不命中 |
| services/admin/receipt.service.ts:127 | qWT | t_receivable | UPDATE t_receivable SET received_amount = received_amount - ?, balance = balance | 是 | 是（3） | 参数 tenantId: string @voidReceipt:120 ｜行 127 | 不命中 |
| services/admin/receipt.service.ts:129 | qWT | t_receipt_writeoff | DELETE FROM t_receipt_writeoff WHERE receipt_id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @voidReceipt:120 ｜行 129 | 不命中 |
| services/admin/receipt.service.ts:130 | qWT | t_receipt | UPDATE t_receipt SET status = 'VOIDED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @voidReceipt:120 ｜行 130 | 不命中 |
| services/admin/reconciliation.service.ts:107 | qWT | t_receivable | UPDATE t_receivable SET status = 'CONFIRMED' WHERE customer_id = ? AND tenant_id | 否 | 是（0） | 参数 tenantId: string @confirmCustomerReconciliation:106 ｜行 107 | 不命中 |
| services/admin/reconciliation.service.ts:151 | qWT | t_payable | UPDATE t_payable SET status = 'CONFIRMED' WHERE supplier_id = ? AND tenant_id =  | 否 | 是（0） | 参数 tenantId: string @confirmSupplierReconciliation:150 ｜行 151 | 不命中 |
| services/admin/report.service.ts:437 | qWT | t_collection_link | UPDATE t_collection_link SET status = 'REVOKED' WHERE link_no = ? AND tenant_id  | 否 | 是（0） | 参数 tenantId: string @revokeCollectionLink:432 ｜行 437 | 不命中 |
| services/admin/stock-warning.service.ts:80 | qWT | t_stock_warning_config | UPDATE t_stock_warning_config SET min_qty = ?, max_qty = ?, enabled = 1 WHERE st | 是 | 是（2） | 解构自 params ｜行 83 | 不命中 |
| services/admin/stock-warning.service.ts:132 | qWT | t_stock_warning_config | UPDATE t_stock_warning_config SET min_qty = ?, max_qty = ?, enabled = 1 WHERE st | 是 | 是（2） | 解构自 params ｜行 135 | 不命中 |
| services/admin/store-value-card.service.ts:106 | qWT | t_store_value_card | UPDATE t_store_value_card SET balance = ?, total_recharge = total_recharge + ? W | 是 | 是（2） | 解构自 params ｜行 106 | 不命中 |
| services/admin/store-value-card.service.ts:117 | qWT | t_store_value_card | UPDATE t_store_value_card SET balance = ?, total_consume = total_consume + ? WHE | 是 | 是（2） | 解构自 params ｜行 117 | 不命中 |
| services/admin/store-value-card.service.ts:127 | qWT | t_store_value_card | UPDATE t_store_value_card SET balance = ? WHERE card_no = ? AND tenant_id = ? | 是 | 是（1） | 解构自 params ｜行 127 | 不命中 |
| services/admin/store-value-card.service.ts:135 | qWT | t_store_value_card | UPDATE t_store_value_card SET status = 'FROZEN' WHERE card_no = ? AND tenant_id  | 否 | 是（0） | 参数 tenantId: string @freezeCard:132 ｜行 135 | 不命中 |
| services/admin/store-value-card.service.ts:143 | qWT | t_store_value_card | UPDATE t_store_value_card SET status = 'ACTIVE' WHERE card_no = ? AND tenant_id  | 否 | 是（0） | 参数 tenantId: string @unfreezeCard:139 ｜行 143 | 不命中 |
| services/admin/supplier-contact.service.ts:164 | qWT | t_supplier_contact | UPDATE t_supplier_contact SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @update:124 ｜行 167 | 不命中 |
| services/admin/supplier-contact.service.ts:183 | qWT | t_supplier_contact | DELETE FROM t_supplier_contact WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @remove:173 ｜行 186 | 不命中 |
| services/admin/supplier-statement.service.ts:274 | qWT | t_supplier_statement | UPDATE t_supplier_statement SET statement_status = 'CONFIRMED' WHERE statement_n | 否 | 是（0） | 参数 tenantId: string @confirmSupplierStatement:266 ｜行 277 | 不命中 |
| services/admin/supplier-statement.service.ts:291 | qWT | t_supplier_statement | UPDATE t_supplier_statement SET statement_status = 'DISPUTED', remark = ? WHERE  | 是 | 是（1） | 参数 tenantId: string @disputeSupplierStatement:283 ｜行 294 | 不命中 |
| services/admin/sys-user.service.ts:264 | qWT | t_sys_user | UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ? AND ten | 是 | 是（1） | 参数 tenantId: string @resetPassword:252 ｜行 266 | 不命中 |
| services/admin/tag.service.ts:60 | qWT | t_product_tag_group | UPDATE t_product_tag_group SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateGroup:43 ｜行 62 | 命中 |
| services/admin/tag.service.ts:81 | qWT | t_product_tag_group | DELETE FROM t_product_tag_group WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteGroup:67 ｜行 81 | 不命中 |
| services/admin/tag.service.ts:131 | qWT | t_product_tag | UPDATE t_product_tag SET ${…} WHERE id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateTag:115 ｜行 133 | 命中 |
| services/admin/tag.service.ts:152 | qWT | t_product_tag | DELETE FROM t_product_tag WHERE id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteTag:138 ｜行 152 | 不命中 |
| services/admin/todo.service.ts:153 | eWT | t_todos | UPDATE t_todos SET status = 'COMPLETED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @completeTodo:152 ｜行 156 | 不命中 |
| services/admin/todo.service.ts:162 | eWT | t_todos | UPDATE t_todos SET status = 'DISMISSED' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @dismissTodo:161 ｜行 165 | 不命中 |
| services/admin/todo.service.ts:171 | eWT | t_todos | DELETE FROM t_todos WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteTodo:170 ｜行 174 | 不命中 |
| services/admin/trace-config.service.ts:212 | qWT | t_trace_config | UPDATE t_trace_config SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateConfig:174 ｜行 215 | 不命中 |
| services/admin/trace-config.service.ts:244 | qWT | t_trace_config | DELETE FROM t_trace_config WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteConfig:234 ｜行 247 | 不命中 |
| services/admin/trace-records.service.ts:491 | qWT | t_trace_code | UPDATE t_trace_code SET ${…} WHERE trace_code = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | var tenantId = codeInfo.tenantId ｜行 494 | 不命中 |
| services/admin/trace-records.service.ts:640 | qWT | t_trace_code | UPDATE t_trace_code SET scan_count = scan_count + 1, first_scan_at = CASE WHEN s | 是 | 是（1） | var tenantId = codeInfo.tenantId ｜行 647 | 不命中 |
| services/admin/trace-records.service.ts:855 | qWT | t_trace_code | UPDATE t_trace_code SET current_status = 'RECALLED', version = version + 1, upda | 动态(H2 见 §3) | 否（0） | var tenantId = codeInfo.tenantId ｜行 861 | 不命中 |
| services/admin/trace-records.service.ts:881 | qWT | t_recall_record | UPDATE t_recall_record SET status = 'IN_PROGRESS', started_at = NOW(), total_aff | 是 | 是（1） | var tenantId = codeInfo.tenantId ｜行 887 | 不命中 |
| services/admin/trace-records.service.ts:925 | qWT | t_recall_record | UPDATE t_recall_record SET status = 'COMPLETED', total_notified = ?, total_retur | 是 | 是（2） | var tenantId = codeInfo.tenantId ｜行 931 | 不命中 |
| services/admin/transfer-order.service.ts:427 | qWT | t_transfer_order | UPDATE t_transfer_order SET status = 'PENDING' WHERE id = ? AND tenant_id = ? | 否 | 是（0） | 参数 tenantId: string @submitTransferOrder:414 ｜行 430 | 不命中 |
| services/admin/transfer-order.service.ts:456 | qWT | t_transfer_order | UPDATE t_transfer_order SET status = 'APPROVED', approved_by = ?, approved_by_na | 是 | 是（2） | 参数 tenantId: string @approveTransferOrder:437 ｜行 460 | 不命中 |
| services/admin/transfer-order.service.ts:486 | qWT | t_transfer_order | UPDATE t_transfer_order SET status = 'REJECTED', approved_by = ?, approved_by_na | 是 | 是（3） | 参数 tenantId: string @rejectTransferOrder:467 ｜行 491 | 不命中 |
| services/admin/unit-group.service.ts:124 | qWT | t_unit_group | UPDATE t_unit_group SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateGroup:111 ｜行 126 | 不命中 |
| services/admin/unit-group.service.ts:132 | qWT | t_unit_group_item | DELETE FROM t_unit_group_item WHERE group_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @updateGroup:111 ｜行 132 | 不命中 |
| services/admin/unit-group.service.ts:146 | qWT | t_unit_group | DELETE FROM t_unit_group WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteGroup:139 ｜行 146 | 不命中 |
| services/admin/unit.service.ts:52 | qWT | t_unit | UPDATE t_unit SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @update:34 ｜行 54 | 不命中 |
| services/admin/unit.service.ts:66 | qWT | t_unit | DELETE FROM t_unit WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @remove:59 ｜行 66 | 不命中 |
| services/admin/visit-plan.service.ts:201 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateVisitPlan:143 ｜行 204 | 命中 |
| services/admin/visit-plan.service.ts:246 | qWT | t_customer_visit | UPDATE t_customer_visit SET status = 'CANCELLED', updated_at = NOW() WHERE visit | 否 | 否（0） | 参数 tenantId: string @cancelVisitPlan:228 ｜行 249 | 不命中 |
| services/admin/visit-record.service.ts:280 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @checkin:250 ｜行 283 | 命中 |
| services/admin/visit-record.service.ts:337 | qWT | t_customer_visit | UPDATE t_customer_visit SET ${…} WHERE visit_no = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @checkout:295 ｜行 340 | 命中 |
| services/alert.service.ts:639 | qWT | t_alert_record | UPDATE t_alert_record SET status = ?, handler_id = ?, handler_name = ?, handle_t | 是 | 是（4） | 参数 tenantId: string @handleAlert:624 ｜行 649 | 不命中 |
| services/alert.service.ts:706 | qWT | t_alert_rule | UPDATE t_alert_rule SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateAlertRule:678 ｜行 709 | 不命中 |
| services/hardware/hardware-config.service.ts:77 | eWT | t_hardware_config | UPDATE t_hardware_config SET config_json = ?, enabled = ?, updated_at = NOW() WH | 是 | 否（2） | 参数 tenantId: string @saveConfig:56 ｜行 80 | 命中 |
| services/hardware/payment-box.service.ts:87 | eWT | t_payment_config | UPDATE t_payment_config SET box_config = ?, updated_at = NOW() WHERE provider =  | 是 | 否（1） | 参数 tenantId: string @saveBoxConfig:63 ｜行 90 | 命中 |
| services/instant-retail/fulfillment.service.ts:33 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'DELIVERING', updated_at = NOW() WHERE plat | 否 | 否（0） | 参数 tenantId: string @startDelivery:16 ｜行 36 | 不命中 |
| services/instant-retail/fulfillment.service.ts:59 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'COMPLETED', updated_at = NOW() WHERE platf | 否 | 否（0） | 参数 tenantId: string @completeDelivery:42 ｜行 62 | 不命中 |
| services/instant-retail/inventory-deduction.service.ts:20 | qWT | t_retail_product | UPDATE t_retail_product SET stock = stock - ?, sales_count = sales_count + ? WHE | 是 | 是（2） | 参数 tenantId: string @deductStock:13 ｜行 22 | 不命中 |
| services/instant-retail/inventory-deduction.service.ts:29 | qWT | t_retail_product | UPDATE t_retail_product SET stock = stock + ?, sales_count = sales_count - ? WHE | 是 | 是（2） | 参数 tenantId: string @restoreStock:28 ｜行 31 | 不命中 |
| services/instant-retail/order-receiving.service.ts:99 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platfo | 否 | 否（0） | 参数 tenantId: string @confirmOrder:82 ｜行 102 | 不命中 |
| services/instant-retail/order-receiving.service.ts:127 | qWT | t_platform_order | UPDATE t_platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platf | 否 | 否（0） | 参数 tenantId: string @cancelOrder:108 ｜行 130 | 不命中 |
| services/instant-retail/platform-integration.service.ts:208 | qWT | t_platform_config | UPDATE t_platform_config SET store_id = ?, app_key = ?, app_secret = ?, merchant | 是 | 否（5） | 参数 tenantId: string @upsertConfig:190 ｜行 220 | 命中 |
| services/instant-retail/platform-integration.service.ts:310 | qWT | t_platform_config | DELETE FROM t_platform_config WHERE platform = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteConfig:308 ｜行 313 | 不命中 |
| services/instant-retail/product-sync.service.ts:59 | qWT | t_platform_product_map | DELETE FROM t_platform_product_map WHERE platform = ? AND store_id = ? AND local | —（DELETE） | 是（0） | 参数 tenantId: string @removeProductMapping:58 ｜行 61 | 不命中 |
| services/instant-retail/product-sync.service.ts:75 | qWT | t_platform_product_map | UPDATE t_platform_product_map SET ${…} WHERE platform = ? AND local_sku_id = ? $ | 动态(H2 见 §3) | 否（0） | tenantId // "" ｜行 77 | 不命中 |
| services/instant-retail/retail-announcement.service.ts:115 | qWT | t_retail_announcement | UPDATE t_retail_announcement SET ${…} WHERE id = ? AND store_id = ? | 动态(H2 见 §3) | 否（0） | 参数 tenantId: string @updateAnnouncement:91 ｜行 118 | 命中 |
| services/instant-retail/retail-announcement.service.ts:200 | qWT | t_retail_announcement | DELETE FROM t_retail_announcement WHERE id = ? AND store_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteAnnouncement:199 ｜行 203 | 不命中 |
| services/instant-retail/retail-ops-ext.service.ts:483 | qWT | t_retail_product | UPDATE t_retail_product SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateShelfProduct:431 ｜行 486 | 不命中 |
| services/instant-retail/retail-ops-ext.service.ts:493 | qWT | t_retail_product | DELETE FROM t_retail_product WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @removeShelfProduct:492 ｜行 496 | 不命中 |
| services/instant-retail/retail-ops-ext.service.ts:679 | qWT | t_delivery_record | UPDATE t_delivery_record SET rider_id = ?, rider_name = ?, status = 'ASSIGNED',  | 是 | 是（2） | 参数 tenantId: string @assignDeliveryRider:678 ｜行 682 | 不命中 |
| services/instant-retail/retail-ops-ext.service.ts:704 | qWT | t_delivery_record | UPDATE t_delivery_record SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateDeliveryStatus:692 ｜行 707 | 不命中 |
| services/instant-retail/retail-shop.service.ts:189 | qWT | t_retail_shop_config | UPDATE t_retail_shop_config SET ${…} WHERE store_id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @saveShopConfig:166 ｜行 189 | 不命中 |
| services/instant-retail/retail-shop.service.ts:240 | qWT | t_retail_category | UPDATE t_retail_category SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateCategory:229 ｜行 240 | 不命中 |
| services/instant-retail/retail-shop.service.ts:245 | qWT | t_retail_category | DELETE FROM t_retail_category WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteCategory:244 ｜行 245 | 不命中 |
| services/instant-retail/retail-shop.service.ts:292 | qWT | t_retail_product | UPDATE t_retail_product SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateRetailProduct:278 ｜行 292 | 不命中 |
| services/instant-retail/retail-shop.service.ts:297 | qWT | t_retail_product | DELETE FROM t_retail_product WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteRetailProduct:296 ｜行 297 | 不命中 |
| services/instant-retail/retail-shop.service.ts:343 | qWT | t_retail_order | UPDATE t_retail_order SET ${…} WHERE order_no = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateRetailOrderStatus:336 ｜行 343 | 不命中 |
| services/instant-retail/retail-shop.service.ts:385 | qWT | t_retail_banner | UPDATE t_retail_banner SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateBanner:371 ｜行 385 | 不命中 |
| services/instant-retail/retail-shop.service.ts:390 | qWT | t_retail_banner | DELETE FROM t_retail_banner WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteBanner:389 ｜行 390 | 不命中 |
| services/instant-retail/review.service.ts:49 | qWT | t_retail_review | UPDATE t_retail_review SET reply = ?, reply_at = NOW() WHERE id = ? AND tenant_i | 是 | 是（1） | 参数 tenantId: string @replyReview:48 ｜行 51 | 不命中 |
| services/instant-retail/shortage-handler.service.ts:29 | qWT | t_retail_order | UPDATE t_retail_order SET order_status = 'CANCELLED', cancel_reason = ? WHERE or | 是 | 是（1） | 参数 tenantId: string @handleShortage:28 ｜行 31 | 不命中 |
| services/instant-retail/shortage-handler.service.ts:49 | qWT | t_retail_order | UPDATE t_retail_order SET order_status = 'ACCEPTED' WHERE order_no = ? AND tenan | 否 | 是（0） | 参数 tenantId: string @confirmOrderWithStockCheck:37 ｜行 51 | 不命中 |
| services/instant-retail/shortage-handler.service.ts:59 | qWT | t_retail_order | UPDATE t_retail_order SET order_status = 'CANCELLED', cancel_reason = ? WHERE or | 是 | 是（1） | 参数 tenantId: string @cancelOrderWithRestore:57 ｜行 61 | 不命中 |
| services/marketing/community-marketing.service.ts:789 | qWT | t_seckill_order | UPDATE t_seckill_order SET status = 'PAID', paid_at = NOW() WHERE order_no = ? A | 否 | 是（0） | 参数 tenantId: string @paySeckillOrder:770 ｜行 792 | 不命中 |
| services/marketing/community-marketing.service.ts:852 | qWT | t_group_buy | UPDATE t_group_buy SET status = 'ENDED', updated_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @endGroupBuyActivity:840 ｜行 855 | 不命中 |
| services/marketing/community-marketing.service.ts:873 | qWT | t_bargain_activity | UPDATE t_bargain_activity SET status = 'ENDED', updated_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @endBargainActivity:861 ｜行 876 | 不命中 |
| services/marketing/community-marketing.service.ts:894 | qWT | t_seckill_product | UPDATE t_seckill_product SET status = 'ENDED', updated_at = NOW() WHERE id = ? | 否 | 否（0） | 参数 tenantId: string @endSeckillActivity:882 ｜行 897 | 不命中 |
| services/miniapp/cart.service.ts:85 | qWT | t_cart_item | UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ? | 是 | 否（1） | 参数 tenantId: string @addToCart:69 ｜行 88 | 命中 |
| services/miniapp/cart.service.ts:102 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @updateCartItemQuantity:100 ｜行 105 | 不命中 |
| services/miniapp/cart.service.ts:109 | qWT | t_cart_item | UPDATE t_cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AN | 是 | 否（1） | 参数 tenantId: string @updateCartItemQuantity:100 ｜行 112 | 命中 |
| services/miniapp/cart.service.ts:122 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @deleteCartItem:121 ｜行 125 | 不命中 |
| services/miniapp/cart.service.ts:131 | qWT | t_cart_item | DELETE FROM t_cart_item WHERE customer_id = ? | —（DELETE） | 否（0） | 参数 tenantId: string @clearCart:130 ｜行 134 | 不命中 |
| services/miniapp/member.service.ts:707 | qWT | t_member | UPDATE t_member SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateUserProfile:671 ｜行 710 | 不命中 |
| services/miniapp/member.service.ts:781 | qWT | t_member | UPDATE t_member SET password_hash = ? WHERE id = ? AND tenant_id = ? | 是 | 是（1） | 参数 tenantId: string @changePassword:736 ｜行 784 | 不命中 |
| services/miniapp/wholesale.service.ts:613 | qWT | t_wholesale_cart | UPDATE t_wholesale_cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND te | 是 | 是（1） | 参数 tenantId: string @addWholesaleCartItem:576 ｜行 616 | 不命中 |
| services/miniapp/wholesale.service.ts:650 | qWT | t_wholesale_cart | DELETE FROM t_wholesale_cart WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @updateWholesaleCartItem:632 ｜行 653 | 不命中 |
| services/miniapp/wholesale.service.ts:658 | qWT | t_wholesale_cart | UPDATE t_wholesale_cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND te | 是 | 是（1） | 参数 tenantId: string @updateWholesaleCartItem:632 ｜行 661 | 不命中 |
| services/miniapp/wholesale.service.ts:683 | qWT | t_wholesale_cart | DELETE FROM t_wholesale_cart WHERE id = ? AND tenant_id = ? | —（DELETE） | 是（0） | 参数 tenantId: string @deleteWholesaleCartItem:668 ｜行 686 | 不命中 |
| services/miniapp/wholesale.service.ts:1131 | qWT | t_wholesale_cart | DELETE FROM t_wholesale_cart WHERE member_id = ? AND id IN (${…}) AND tenant_id  | —（DELETE） | 是（0） | 参数 tenantId: string @deleteWholesaleCartItems:1128 ｜行 1134 | 不命中 |
| services/miniapp/wholesale.service.ts:1140 | qWT | t_wholesale_cart | UPDATE t_wholesale_cart SET selected = ?, updated_at = NOW() WHERE id = ? AND me | 是 | 是（1） | 参数 tenantId: string @toggleWholesaleCartSelect:1139 ｜行 1143 | 不命中 |
| services/miniapp/wholesale.service.ts:1149 | qWT | t_wholesale_cart | UPDATE t_wholesale_cart SET selected = ?, updated_at = NOW() WHERE member_id = ? | 是 | 是（1） | 参数 tenantId: string @toggleWholesaleCartSelectAll:1148 ｜行 1152 | 不命中 |
| services/miniapp/wholesale.service.ts:1196 | qWT | t_wholesale_order | UPDATE t_wholesale_order SET order_status = 'COMPLETED', completed_at = NOW(), u | 否 | 是（0） | 参数 tenantId: string @confirmWholesaleReceive:1195 ｜行 1200 | 不命中 |
| services/purchase.service.ts:199 | qWT | t_purchase_order | UPDATE t_purchase_order SET ${…} WHERE order_no = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @updateOrderStatus:181 ｜行 199 | 不命中 |
| services/purchase.service.ts:568 | qWT | t_purchase_order | UPDATE t_purchase_order SET approval_instance_no = ? WHERE order_no = ? AND tena | 是 | 是（1） | ctx.tenantId ｜行 571 | 不命中 |
| services/sale-return.service.ts:284 | qWT | t_sale_return | UPDATE t_sale_return SET approval_instance_no = ? WHERE return_no = ? AND tenant | 是 | 是（1） | ctx.tenantId ｜行 287 | 不命中 |
| services/sale-return.service.ts:374 | qWT | t_sale_return | UPDATE t_sale_return SET return_status = 'REJECTED', auditor_id = ?, audited_at  | 是 | 是（1） | ctx.tenantId ｜行 377 | 不命中 |
| services/store/inventory.service.ts:127 | qWT | t_product_sku | UPDATE t_product_sku SET warning_threshold = ?, updated_at = NOW() WHERE id = ?  | 是 | 是（1） | 参数 tenantId: string @updateAlertThreshold:123 ｜行 130 | 不命中 |
| services/store/member.service.ts:357 | eWT | t_member | UPDATE t_member SET name = COALESCE(?, name), mobile = COALESCE(?, mobile), cust | 是 | 是（13） | 参数 tenantId: string @updateMemberManage:340 ｜行 379 | 不命中 |
| services/store/order.service.ts:141 | qWT | t_miniapp_order | UPDATE t_miniapp_order SET order_status = 'ACCEPTED', updated_at = NOW() WHERE o | 否 | 是（0） | var tenantId = orderRows[0]?.tenantId ｜行 144 | 不命中 |
| services/store/order.service.ts:151 | qWT | t_miniapp_order | UPDATE t_miniapp_order SET order_status = 'DELIVERING', delivery_status = 'DELIV | 否 | 是（0） | var tenantId = orderRows[0]?.tenantId ｜行 156 | 不命中 |
| services/store/other.service.ts:114 | qWT | t_hold_order | UPDATE t_hold_order SET status = 'DELETED', updated_at = NOW() WHERE hold_no = ? | 否 | 是（0） | 参数 tenantId: string @deleteHoldOrder:113 ｜行 117 | 不命中 |
| services/store/sale-bill.service.ts:391 | qWT | t_sale_bill | UPDATE t_sale_bill SET collection_status = 'SHARED', share_collection_count = sh | 否 | 是（0） | 解构自 params ｜行 394 | 不命中 |
| services/store/sale-bill.service.ts:525 | qWT | t_sale_bill | UPDATE t_sale_bill SET collection_status = 'OVERDUE' WHERE bill_no IN (${…}) AND | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @checkOverdueBills:517 ｜行 528 | 不命中 |
| services/store/sale-bill.service.ts:566 | qWT | t_sale_bill | UPDATE t_sale_bill SET collection_status = 'SHARED', share_collection_count = sh | 否 | 是（0） | 解构自 params ｜行 569 | 不命中 |
| services/store/sale-bill.service.ts:586 | qWT | t_collection_link | UPDATE t_collection_link SET status = 'REVOKED' WHERE link_no = ? AND tenant_id  | 否 | 是（0） | 参数 tenantId: string @revokeCollectionLink:577 ｜行 589 | 不命中 |
| services/supplier.service.ts:478 | qWT | t_supplier | UPDATE t_supplier SET ${…} WHERE id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | ctx.tenantId ｜行 481 | 不命中 |
| shared/product-sync.ts:102 | qWT | t_product_sku | UPDATE t_product_sku SET ${…} WHERE spu_id = ? AND tenant_id = ? | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @syncProductFullChain:58 ｜行 105 | 不命中 |
| shared/product-sync.ts:140 | qWT | t_inventory_balance | UPDATE t_inventory_balance SET ${…}, updated_at = NOW() WHERE spu_id = ? AND ten | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @syncProductFullChain:58 ｜行 143 | 不命中 |
| shared/product-sync.ts:178 | qWT | t_sale_bill_item | UPDATE t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.id = sbi.bill_id AND sb.te | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @syncProductFullChain:58 ｜行 185 | 不命中 |
| shared/product-sync.ts:220 | qWT | t_purchase_order_item | UPDATE t_purchase_order_item poi JOIN t_purchase_order po ON po.id = poi.order_i | 动态(H2 见 §3) | 是（0） | 参数 tenantId: string @syncProductFullChain:58 ｜行 227 | 不命中 |
| shared/product-sync.ts:254 | qWT | t_inventory_ledger | UPDATE t_inventory_ledger SET product_name = ?, updated_at = NOW() WHERE spu_id  | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 259 | 不命中 |
| shared/product-sync.ts:286 | qWT | t_inventory_batch | UPDATE t_inventory_batch SET product_name = ?, updated_at = NOW() WHERE spu_id = | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 291 | 不命中 |
| shared/product-sync.ts:318 | qWT | t_miniapp_order_item | UPDATE t_miniapp_order_item SET product_name = ?, updated_at = NOW() WHERE spu_i | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 323 | 不命中 |
| shared/product-sync.ts:350 | qWT | t_sale_return_item | UPDATE t_sale_return_item SET product_name = ?, updated_at = NOW() WHERE spu_id  | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 355 | 不命中 |
| shared/product-sync.ts:382 | qWT | t_purchase_in_stock_item | UPDATE t_purchase_in_stock_item SET product_name = ?, updated_at = NOW() WHERE s | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 387 | 不命中 |
| shared/product-sync.ts:411 | qWT | t_purchase_return_item | UPDATE t_purchase_return_item SET product_name = ?, updated_at = NOW() WHERE spu | 是 | 是（1） | 参数 tenantId: string @syncProductFullChain:58 ｜行 416 | 不命中 |
| shared/product-sync.ts:467 | qWT | t_product_sku | UPDATE t_product_sku SET status = ?, updated_at = NOW() WHERE spu_id = ? AND ten | 是 | 是（1） | 参数 tenantId: string @syncProductStatus:456 ｜行 470 | 不命中 |
| shared/product-sync.ts:533 | qWT | t_sale_bill_item | UPDATE t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.id = sbi.bill_id AND sb.te | 是 | 是（1） | 参数 tenantId: string @syncProductPrice:498 ｜行 540 | 不命中 |
| shared/product-sync.ts:571 | qWT | t_purchase_order_item | UPDATE t_purchase_order_item poi JOIN t_purchase_order po ON po.id = poi.order_i | 是 | 是（1） | 参数 tenantId: string @syncProductPrice:498 ｜行 578 | 不命中 |

### 1.2 读路径及其余调用（按文件全量聚合，169 文件）

判定规则（逐条有依据）：

1. **INSERT（177 处）**：走 `injectInsertTenant`（`database.ts:251-266`），其把 `tenant_id` **同时**插到字段列表最前（`:262` `(tenant_id, ${fields})`）与参数最前（`[tenantId, ...params]`）⇒ 占位符顺序与参数顺序一致，**结构上不会错位**；自带 `tenant_id` 的 164 处直接短路。⇒ 全部 **不命中（N3）**。（其中 1 处 `INSERT ... SELECT` 形态自带 `tenant_id`，正则本不匹配，亦短路。）
2. **SELECT（1298 处）**：走 `injectSelectTenant`（`database.ts:214-244`），不是 `injectUpdateTenant`；其中自带 `tenant_id` 779 处短路。⇒ 全部 **不命中（N3）**（**但注意**：其"含 WHERE"分支 `:225` 与 UPDATE 同款错误写法，仅当首个 `where` 前有占位符时才错位，本卡扫得 1 处，见 §7 附带发现）。
3. **动态头部 / 不可静态解析（11 处）**：SQL 实参为变量或动态拼接（`sql` / `targetSql` / `target.sql` 等），静态无法定论 ⇒ **单列 §7，标注「需运行期确认」，不计入命中集**。
4. 已排除项（避免被读成遗漏）：`query` / `queryOne` / `transaction(conn)` 及事务内 `conn.query/conn.execute` 的写语句（26 处，17 文件）**不经 `injectUpdateTenant`**，与本病灶无关，本卡不计；`backend/ai-base/**` 为独立部署副本（自有仓库 ZXQL-AI），按派单卡 §三 排除。

| 文件 | 调用数 | helper 分布 | 语句类型 | 判定 |
|---|---|---|---|---|
| config/alipay-f2f.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| config/database.ts | 2 | qWT×2 | UNRESOLVED×2 | 全不命中（N3） |
| config/wechat-pay-v2.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| controllers/store/home.controller.ts | 3 | qOWT×1、qWT×2 | SELECT×3 | 全不命中（N3） |
| jobs/report-aggregation.job.ts | 22 | qWT×3、qOWT×19 | SELECT×17、INSERT×5 | 全不命中（N3） |
| middleware/storage-guard.ts | 2 | qOWT×2 | SELECT×2 | 全不命中（N3） |
| services/admin/aftersale.service.ts | 15 | qOWT×10、qWT×5 | SELECT×14、INSERT×1 | 全不命中（N3） |
| services/admin/approval-flow.service.ts | 7 | qWT×3、qOWT×4 | SELECT×5、INSERT×2 | 全不命中（N3） |
| services/admin/approval-records.service.ts | 9 | qWT×5、qOWT×4 | SELECT×9 | 全不命中（N3） |
| services/admin/archive.service.ts | 1 | qWT×1 | SELECT×1 | 全不命中（N3） |
| services/admin/auth.service.ts | 3 | qOWT×3 | SELECT×3 | 全不命中（N3） |
| services/admin/bank-account.service.ts | 10 | qWT×2、qOWT×8 | SELECT×9、INSERT×1 | 全不命中（N3） |
| services/admin/batch-price.service.ts | 6 | qOWT×3、qWT×3 | SELECT×6 | 全不命中（N3） |
| services/admin/brand.service.ts | 4 | qWT×2、qOWT×2 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/cart.service.ts | 9 | qWT×5、qOWT×4 | UNRESOLVED×2、SELECT×6、INSERT×1 | 全不命中（N3） |
| services/admin/category.service.ts | 7 | qWT×5、qOWT×2 | SELECT×6、INSERT×1 | 全不命中（N3） |
| services/admin/combo-product.service.ts | 6 | qWT×2、qOWT×4 | SELECT×6 | 全不命中（N3） |
| services/admin/commission.service.ts | 10 | qWT×6、qOWT×4 | SELECT×8、INSERT×2 | 全不命中（N3） |
| services/admin/credit-adjust.service.ts | 8 | qOWT×5、qWT×3 | SELECT×6、INSERT×2 | 全不命中（N3） |
| services/admin/credit-collection.service.ts | 17 | qWT×6、qOWT×11 | SELECT×15、INSERT×2 | 全不命中（N3） |
| services/admin/credit-limit.service.ts | 17 | qWT×5、qOWT×12 | SELECT×13、INSERT×4 | 全不命中（N3） |
| services/admin/credit-risk.service.ts | 2 | qWT×1、qOWT×1 | SELECT×2 | 全不命中（N3） |
| services/admin/credit-scoring.service.ts | 10 | qOWT×6、qWT×4 | SELECT×7、INSERT×3 | 全不命中（N3） |
| services/admin/custom-report-v2.service.ts | 10 | qOWT×5、qWT×5 | SELECT×7、INSERT×3 | 全不命中（N3） |
| services/admin/custom-report.service.ts | 9 | qOWT×4、qWT×5 | SELECT×7、INSERT×2 | 全不命中（N3） |
| services/admin/customer-care.service.ts | 11 | qWT×8、qOWT×3 | SELECT×9、INSERT×2 | 全不命中（N3） |
| services/admin/customer-lifecycle.service.ts | 4 | qWT×3、qOWT×1 | SELECT×4 | 全不命中（N3） |
| services/admin/customer-merge.service.ts | 18 | qWT×7、qOWT×11 | SELECT×18 | 全不命中（N3） |
| services/admin/customer-price.service.ts | 7 | qWT×2、qOWT×5 | SELECT×6、INSERT×1 | 全不命中（N3） |
| services/admin/customer-segment.service.ts | 7 | qWT×5、qOWT×2 | INSERT×2、SELECT×5 | 全不命中（N3） |
| services/admin/customer-statement.service.ts | 9 | qWT×6、qOWT×3 | SELECT×7、INSERT×2 | 全不命中（N3） |
| services/admin/customer-tag.service.ts | 12 | qWT×6、qOWT×6 | SELECT×8、INSERT×4 | 全不命中（N3） |
| services/admin/customer-type.service.ts | 7 | qWT×2、qOWT×5 | SELECT×6、INSERT×1 | 全不命中（N3） |
| services/admin/customer-visit.service.ts | 21 | qWT×9、qOWT×12 | SELECT×17、INSERT×4 | 全不命中（N3） |
| services/admin/customer.service.ts | 23 | qWT×7、qOWT×16 | SELECT×22、INSERT×1 | 全不命中（N3） |
| services/admin/daily-settlement.service.ts | 8 | qOWT×5、qWT×3 | SELECT×7、INSERT×1 | 全不命中（N3） |
| services/admin/employee.service.ts | 14 | qWT×6、qOWT×8 | SELECT×10、INSERT×4 | 全不命中（N3） |
| services/admin/expense.service.ts | 8 | qWT×3、qOWT×5 | INSERT×1、SELECT×7 | 全不命中（N3） |
| services/admin/feedback.service.ts | 2 | qWT×1、qOWT×1 | SELECT×2 | 全不命中（N3） |
| services/admin/finance-dashboard.service.ts | 20 | qOWT×13、qWT×7 | SELECT×20 | 全不命中（N3） |
| services/admin/instant-retail.service.ts | 28 | qWT×12、qOWT×16 | SELECT×24、INSERT×4 | 全不命中（N3） |
| services/admin/inventory-cost.service.ts | 4 | qOWT×2、qWT×2 | SELECT×4 | 全不命中（N3） |
| services/admin/inventory-loss-gain.service.ts | 4 | qWT×3、qOWT×1 | INSERT×2、SELECT×2 | 全不命中（N3） |
| services/admin/inventory-loss-order.service.ts | 6 | qWT×2、qOWT×4 | SELECT×6 | 全不命中（N3） |
| services/admin/inventory-profit-order.service.ts | 6 | qWT×2、qOWT×4 | SELECT×6 | 全不命中（N3） |
| services/admin/inventory-share.service.ts | 9 | qOWT×6、qWT×3 | SELECT×7、INSERT×2 | 全不命中（N3） |
| services/admin/marketing-calculation.service.ts | 4 | qOWT×3、qWT×1 | SELECT×4 | 全不命中（N3） |
| services/admin/marketing-coupon.service.ts | 18 | qWT×6、qOWT×12 | INSERT×1、SELECT×17 | 全不命中（N3） |
| services/admin/marketing-dashboard.service.ts | 12 | qOWT×8、qWT×4 | SELECT×12 | 全不命中（N3） |
| services/admin/marketing-flash-sale.service.ts | 13 | qWT×4、qOWT×9 | INSERT×1、SELECT×12 | 全不命中（N3） |
| services/admin/marketing-full-reduction.service.ts | 10 | qWT×2、qOWT×8 | INSERT×1、SELECT×9 | 全不命中（N3） |
| services/admin/marketing-gift-rule.service.ts | 6 | qWT×4、qOWT×2 | INSERT×2、SELECT×4 | 全不命中（N3） |
| services/admin/marketing-group-buy.service.ts | 15 | qWT×5、qOWT×10 | INSERT×1、SELECT×14 | 全不命中（N3） |
| services/admin/marketing-limited-discount.service.ts | 8 | qWT×5、qOWT×3 | INSERT×2、SELECT×6 | 全不命中（N3） |
| services/admin/marketing-material.service.ts | 6 | qWT×4、qOWT×2 | INSERT×2、SELECT×4 | 全不命中（N3） |
| services/admin/marketing-new-coupon.service.ts | 12 | qWT×3、qOWT×9 | SELECT×11、INSERT×1 | 全不命中（N3） |
| services/admin/marketing-new-promotion.service.ts | 6 | qWT×3、qOWT×3 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/marketing-points-mall.service.ts | 14 | qWT×4、qOWT×10 | INSERT×2、SELECT×12 | 全不命中（N3） |
| services/admin/marketing-points.service.ts | 16 | qOWT×11、qWT×5 | SELECT×14、INSERT×2 | 全不命中（N3） |
| services/admin/marketing-stack-rule.service.ts | 6 | qWT×2、qOWT×4 | INSERT×1、SELECT×5 | 全不命中（N3） |
| services/admin/member.service.ts | 18 | qOWT×9、qWT×9 | SELECT×10、INSERT×8 | 全不命中（N3） |
| services/admin/menu-permission.service.ts | 7 | qWT×7 | SELECT×7 | 全不命中（N3） |
| services/admin/miniapp-config.service.ts | 8 | qWT×3、qOWT×4、eWT×1 | SELECT×7、INSERT×1 | 全不命中（N3） |
| services/admin/miniapp-order-sync.service.ts | 2 | qOWT×1、qWT×1 | SELECT×2 | 全不命中（N3） |
| services/admin/miniapp-package.service.ts | 4 | qOWT×3、qWT×1 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/miniapp-publish.service.ts | 3 | qWT×1、qOWT×2 | INSERT×1、SELECT×2 | 全不命中（N3） |
| services/admin/miniapp-template.service.ts | 5 | qWT×2、qOWT×3 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/admin/notification-center.service.ts | 4 | qWT×2、qOWT×2 | SELECT×4 | 全不命中（N3） |
| services/admin/operation-log.service.ts | 7 | qOWT×4、qWT×3 | SELECT×7 | 全不命中（N3） |
| services/admin/order-timeout.service.ts | 9 | qWT×3、qOWT×6 | SELECT×8、INSERT×1 | 全不命中（N3） |
| services/admin/order.service.ts | 13 | qWT×7、qOWT×6 | SELECT×13 | 全不命中（N3） |
| services/admin/payment-config.service.ts | 11 | qOWT×7、eWT×2、qWT×2 | SELECT×9、INSERT×2 | 全不命中（N3） |
| services/admin/payment-new.service.ts | 12 | qWT×6、qOWT×6 | INSERT×3、SELECT×9 | 全不命中（N3） |
| services/admin/platform-reconciliation.service.ts | 4 | qOWT×2、qWT×2 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/platform-review.service.ts | 4 | qOWT×2、qWT×2 | SELECT×4 | 全不命中（N3） |
| services/admin/points.service.ts | 15 | qWT×9、qOWT×6 | SELECT×10、INSERT×5 | 全不命中（N3） |
| services/admin/position.service.ts | 6 | qWT×3、qOWT×3 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/price-level.service.ts | 7 | qWT×2、qOWT×5 | SELECT×6、INSERT×1 | 全不命中（N3） |
| services/admin/price-management.service.ts | 22 | qWT×7、qOWT×15 | SELECT×19、INSERT×2、UNRESOLVED×1 | 全不命中（N3） |
| services/admin/price-review.service.ts | 3 | qWT×2、qOWT×1 | SELECT×3 | 全不命中（N3） |
| services/admin/print.service.ts | 11 | qWT×7、qOWT×4 | INSERT×4、SELECT×7 | 全不命中（N3） |
| services/admin/product-bundle.service.ts | 10 | qWT×3、qOWT×7 | SELECT×10 | 全不命中（N3） |
| services/admin/product-review.service.ts | 6 | qOWT×4、qWT×2 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/product.service.ts | 20 | qWT×8、qOWT×12 | SELECT×18、INSERT×2 | 全不命中（N3） |
| services/admin/profit-loss-stats.service.ts | 6 | qOWT×4、qWT×2 | SELECT×6 | 全不命中（N3） |
| services/admin/purchase-contract.service.ts | 6 | qWT×2、qOWT×4 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/purchase-in-stock.service.ts | 4 | qWT×2、qOWT×2 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/purchase-order.service.ts | 9 | qWT×2、qOWT×7 | SELECT×9 | 全不命中（N3） |
| services/admin/purchase-payment.service.ts | 5 | qWT×2、qOWT×3 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/admin/purchase-plan.service.ts | 11 | qWT×7、qOWT×4 | SELECT×7、INSERT×4 | 全不命中（N3） |
| services/admin/purchase-return.service.ts | 3 | qWT×2、qOWT×1 | SELECT×2、INSERT×1 | 全不命中（N3） |
| services/admin/push.service.ts | 6 | qOWT×2、qWT×4 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/quick-entry.service.ts | 3 | qWT×2、qOWT×1 | SELECT×2、INSERT×1 | 全不命中（N3） |
| services/admin/quote-push.service.ts | 12 | qOWT×7、qWT×5 | SELECT×11、INSERT×1 | 全不命中（N3） |
| services/admin/receipt.service.ts | 12 | qWT×6、qOWT×6 | INSERT×3、SELECT×9 | 全不命中（N3） |
| services/admin/receivable.service.ts | 10 | qWT×6、qOWT×4 | SELECT×10 | 全不命中（N3） |
| services/admin/reconciliation.service.ts | 8 | qWT×4、qOWT×4 | SELECT×8 | 全不命中（N3） |
| services/admin/report-collection.service.ts | 26 | qOWT×20、qWT×6 | SELECT×26 | 全不命中（N3） |
| services/admin/report-customer.service.ts | 13 | qOWT×8、qWT×5 | SELECT×13 | 全不命中（N3） |
| services/admin/report-export.service.ts | 1 | qWT×1 | UNRESOLVED×1 | 全不命中（N3） |
| services/admin/report-permission-v2.service.ts | 7 | qWT×5、qOWT×2 | SELECT×7 | 全不命中（N3） |
| services/admin/report.service.ts | 34 | qOWT×16、qWT×18 | SELECT×34 | 全不命中（N3） |
| services/admin/report/customer-report.service.ts | 2 | qWT×1、qOWT×1 | SELECT×2 | 全不命中（N3） |
| services/admin/report/finance-report.service.ts | 13 | qWT×5、qOWT×8 | SELECT×13 | 全不命中（N3） |
| services/admin/report/product-report.service.ts | 9 | qWT×6、qOWT×3 | SELECT×9 | 全不命中（N3） |
| services/admin/report/sales-report.service.ts | 18 | qWT×8、qOWT×10 | SELECT×18 | 全不命中（N3） |
| services/admin/report/staff-report.service.ts | 1 | qWT×1 | SELECT×1 | 全不命中（N3） |
| services/admin/stock-warning.service.ts | 6 | qWT×4、qOWT×2 | SELECT×4、INSERT×2 | 全不命中（N3） |
| services/admin/store-value-card.service.ts | 10 | qOWT×5、qWT×5 | SELECT×7、INSERT×3 | 全不命中（N3） |
| services/admin/subscription-renewal.service.ts | 3 | qOWT×1、qWT×2 | SELECT×3 | 全不命中（N3） |
| services/admin/subscription.service.ts | 7 | qWT×2、qOWT×5 | SELECT×7 | 全不命中（N3） |
| services/admin/supplier-contact.service.ts | 6 | qWT×2、qOWT×4 | SELECT×5、INSERT×1 | 全不命中（N3） |
| services/admin/supplier-statement.service.ts | 16 | qOWT×7、qWT×9 | SELECT×12、INSERT×4 | 全不命中（N3） |
| services/admin/sys-user.service.ts | 12 | qOWT×8、qWT×4 | SELECT×11、INSERT×1 | 全不命中（N3） |
| services/admin/system.service.ts | 3 | qOWT×3 | SELECT×3 | 全不命中（N3） |
| services/admin/tag.service.ts | 11 | qWT×7、qOWT×4 | SELECT×9、INSERT×2 | 全不命中（N3） |
| services/admin/todo.service.ts | 4 | qWT×3、qOWT×1 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/trace-config.service.ts | 10 | qWT×2、qOWT×8 | SELECT×9、INSERT×1 | 全不命中（N3） |
| services/admin/trace-records.service.ts | 32 | qOWT×20、qWT×12 | SELECT×26、INSERT×6 | 全不命中（N3） |
| services/admin/transfer-order.service.ts | 14 | qWT×3、qOWT×11 | SELECT×14 | 全不命中（N3） |
| services/admin/unit-group.service.ts | 8 | qWT×5、qOWT×3 | SELECT×6、INSERT×2 | 全不命中（N3） |
| services/admin/unit.service.ts | 4 | qWT×2、qOWT×2 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/admin/visit-plan.service.ts | 6 | qOWT×4、qWT×2 | SELECT×4、INSERT×2 | 全不命中（N3） |
| services/admin/visit-record.service.ts | 15 | qWT×7、qOWT×8 | SELECT×13、INSERT×2 | 全不命中（N3） |
| services/alert.service.ts | 21 | qOWT×11、qWT×10 | SELECT×21 | 全不命中（N3） |
| services/hardware/hardware-config.service.ts | 5 | qOWT×3、eWT×1、qWT×1 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/hardware/payment-box.service.ts | 3 | qOWT×3 | SELECT×3 | 全不命中（N3） |
| services/instant-retail/common.service.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| services/instant-retail/fulfillment.service.ts | 2 | qOWT×2 | SELECT×2 | 全不命中（N3） |
| services/instant-retail/inventory-deduction.service.ts | 2 | qOWT×2 | SELECT×2 | 全不命中（N3） |
| services/instant-retail/order-receiving.service.ts | 5 | qWT×1、qOWT×4 | SELECT×5 | 全不命中（N3） |
| services/instant-retail/platform-integration.service.ts | 5 | qWT×2、qOWT×3 | SELECT×5 | 全不命中（N3） |
| services/instant-retail/product-sync.service.ts | 4 | qOWT×2、qWT×2 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/instant-retail/reconciliation.service.ts | 3 | qOWT×2、qWT×1 | SELECT×3 | 全不命中（N3） |
| services/instant-retail/retail-analytics.service.ts | 9 | qOWT×4、qWT×5 | SELECT×9 | 全不命中（N3） |
| services/instant-retail/retail-announcement.service.ts | 4 | qWT×3、qOWT×1 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/instant-retail/retail-ops-ext.service.ts | 13 | qOWT×6、qWT×7 | SELECT×12、INSERT×1 | 全不命中（N3） |
| services/instant-retail/retail-shop.service.ts | 16 | qOWT×7、qWT×9 | SELECT×12、INSERT×4 | 全不命中（N3） |
| services/instant-retail/review.service.ts | 6 | qOWT×5、qWT×1 | SELECT×6 | 全不命中（N3） |
| services/instant-retail/shortage-handler.service.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| services/marketing/community-marketing.service.ts | 25 | qWT×6、qOWT×19 | SELECT×25 | 全不命中（N3） |
| services/miniapp/cart.service.ts | 5 | qWT×2、qOWT×3 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/miniapp/checkout.service.ts | 4 | qWT×3、qOWT×1 | UNRESOLVED×2、SELECT×2 | 全不命中（N3） |
| services/miniapp/member.service.ts | 17 | qOWT×12、qWT×5 | SELECT×17 | 全不命中（N3） |
| services/miniapp/stored-card.service.ts | 7 | qOWT×6、qWT×1 | SELECT×7 | 全不命中（N3） |
| services/miniapp/wholesale.service.ts | 21 | qWT×10、qOWT×11 | SELECT×20、INSERT×1 | 全不命中（N3） |
| services/payment/scan-pay.service.ts | 3 | qOWT×3 | SELECT×3 | 全不命中（N3） |
| services/purchase.service.ts | 5 | qOWT×3、qWT×2 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/sale-return.service.ts | 8 | qOWT×6、qWT×2 | SELECT×8 | 全不命中（N3） |
| services/store/auth.service.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| services/store/coupon-verify.service.ts | 5 | qOWT×5 | SELECT×5 | 全不命中（N3） |
| services/store/inventory.service.ts | 4 | qWT×3、qOWT×1 | SELECT×3、UNRESOLVED×1 | 全不命中（N3） |
| services/store/member.service.ts | 16 | qOWT×10、qWT×5、eWT×1 | SELECT×15、INSERT×1 | 全不命中（N3） |
| services/store/order.service.ts | 5 | qWT×3、qOWT×2 | SELECT×4、INSERT×1 | 全不命中（N3） |
| services/store/other.service.ts | 10 | qWT×5、qOWT×5 | INSERT×1、SELECT×9 | 全不命中（N3） |
| services/store/product.service.ts | 5 | qWT×4、qOWT×1 | SELECT×5 | 全不命中（N3） |
| services/store/receivable.service.ts | 16 | qWT×2、qOWT×14 | SELECT×16 | 全不命中（N3） |
| services/store/sale-bill.service.ts | 19 | qWT×7、qOWT×12 | SELECT×17、INSERT×2 | 全不命中（N3） |
| services/supplier.service.ts | 14 | qWT×12、qOWT×2 | SELECT×11、INSERT×3 | 全不命中（N3） |
| services/sync/delta-sync.service.ts | 4 | qWT×3、qOWT×1 | SELECT×4 | 全不命中（N3） |
| services/sync/price-sync.service.ts | 7 | qWT×7 | SELECT×6、INSERT×1 | 全不命中（N3） |
| services/sync/product-sync.service.ts | 4 | qWT×4 | SELECT×3、INSERT×1 | 全不命中（N3） |
| services/transfer-execution.service.ts | 2 | qWT×2 | SELECT×2 | 全不命中（N3） |
| services/transfer-order.service.ts | 8 | qWT×3、qOWT×5 | SELECT×8 | 全不命中（N3） |
| services/wechat-pay.service.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |
| shared/field-sync.ts | 1 | qWT×1 | UNRESOLVED×1 | 全不命中（N3） |
| shared/price-guard.ts | 1 | qWT×1 | INSERT×1 | 全不命中（N3） |
| shared/product-sync.ts | 5 | qOWT×3、qWT×2 | SELECT×4、UNRESOLVED×1 | 全不命中（N3） |
| shared/trace-code.ts | 1 | qOWT×1 | SELECT×1 | 全不命中（N3） |

---

## 二、计数（分母怎么数出来的）

### 2.1 计数总表

| 指标 | 数量 | 口径（静态 AST，`backend/src/**` 排除 `__tests__`） |
|---|---|---|
| 三 helper 调用点合计 | **1842** | `queryWithTenant` 967 + `queryOneWithTenant` 851 + `executeWithTenant` 24 |
| └ UPDATE | **281** | 语句首词判定（去注释） |
| └ DELETE | **75** | 同上 |
| └ INSERT | **177** | 同上 |
| └ SELECT | **1298** | 同上 |
| └ 动态头部/不可静态解析 | **11** | SQL 实参为变量/属性访问，未解析出语句首词 |
| **写路径调用点（UPDATE+DELETE）** | **356** | 本卡判定的分母 |
| └ 自带 `tenant_id`（N1，短路） | **269** | `sql.toLowerCase().includes('tenant_id')` |
| └ 未自带 `tenant_id` | **87** | 269+87=356 |
| ── └ 首个 WHERE 前 `?` > 0（H1） | **18** | 注入点前有占位符 ⇒ 必错位 |
| ── └ 首个 WHERE 前 `?` = 0 且 SET 为动态拼接（H2/N2） | **22**（命中 20、不命中 2） | 展开动态片段后判定 |
| ── └ 首个 WHERE 前 `?` = 0 且 SET 无占位符（N2） | **47** | 注入后参数顺序正确 |
| **命中集** | **38**（27 文件） | 候选 40 − 不命中 2 |
| 五 helper 写语句（旧口径对照补算） | **396** | 增计 `query` 40（`queryOne` 0）；UPDATE 313 + DELETE 83 |
| 事务内 `conn.query/conn.execute` 写语句（非 helper、本卡范围外） | **26**（17 文件） | `rg -o` 计数，未逐条判定 |

> 写路径 helper 分布：`queryWithTenant` 337 + `executeWithTenant` 19 = 356（`queryOneWithTenant` 无写调用点）；涉及 **132** 张表。

### 2.2 可复跑命令（命令 + 原始输出摘要）

```powershell
# A) 三 helper 出现次数（含 import/定义/类型引用，≠ 调用点，仅作量级核对）
cd D:\Users\ZXQL\ZXQL-MS\wen-ssystem
foreach ($h in 'queryWithTenant','queryOneWithTenant','executeWithTenant') { $n = (rg -o --no-heading $h backend/src --glob '!**/__tests__/**' | Measure-Object).Count; "$h = $n" }
# 输出：queryWithTenant = 1190 / queryOneWithTenant = 1037 / executeWithTenant = 33（合计 2260 处文本出现）

# B) 权威计数：调用点级（AST），分母来自此命令
node --input-type=module - < 附录A脚本 >   # 输出见下行（本卡实测）
# files scanned: 707  calls: 1842
# byHelper: queryWithTenant 967 / queryOneWithTenant 851 / executeWithTenant 24
# byStmt: UPDATE 281 / DELETE 75 / INSERT 177 / SELECT 1298 / DYNAMIC-HEAD+UNRESOLVED 11
# write rows: 356  |  hits: 38（27 files）

# C) 事务内写语句（范围外，仅登记）
rg -o --no-heading 'conn\.(query|execute)\s*(<[^>]*>)?\(\s*[`"](UPDATE|DELETE)' -i backend/src --glob '!**/__tests__/**' | Measure-Object -Line   # → 26

# D) 旧卡 §七 命令 3（写入全量扫）复跑：与旧数 484 不一致
rg -n -U --no-heading 'await (query|queryWithTenant|queryOne|queryOneWithTenant|executeWithTenant)\s*(<[^>]*>)?\(\s*["`]UPDATE|await (query|queryWithTenant|queryOne|queryOneWithTenant|executeWithTenant)\s*(<[^>]*>)?\(\s*["`]DELETE' backend/src --glob '!**/__tests__/**' | Measure-Object -Line   # → 769
```

---

## 三、命中集逐条「修复后行为变化」（38 条）

每条均给：`文件:行号`（含 `backend/src/` 前缀）+ **展开后的 SQL 文本**（`${updates.join(", ")}`、`${sets.join(", ")}`、`${fields.join(", ")}` 等一律展开为元素清单）+ `tenantId` 实参所在行 + 修复后的一句话行为变化。

| # | 文件:行号 | 展开后 SQL（`${…}` 为动态占位，逐个展开见同格） | tenantId 实参行 | 修复后行为变化（一句话） |
|---|---|---|---|---|
| 1 | `backend/src/services/admin/approval-flow.service.ts:165` | `UPDATE t_approval_rule SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `rule_name = ?` + `trigger_condition = ?` + `approval_chain = ?` + `sla_hours = ?` + `escalation_level = ?` + `status = ?` | `backend/src/services/admin/approval-flow.service.ts:168`（参数 tenantId: string @updateRule:111） | 审批流规则编辑（名称/条件/审批链/SLA/升级/状态）开始落库 |
| 2 | `backend/src/services/admin/auth.service.ts:270` | `UPDATE t_sys_user SET default_homepage = ? WHERE id = ?` | `backend/src/services/admin/auth.service.ts:273`（参数 tenantId: string @updateSettings:269） | 默认主页设置开始落库 |
| 3 | `backend/src/services/admin/auth.service.ts:293` | `UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?` | `backend/src/services/admin/auth.service.ts:293`（参数 tenantId: string @changePassword:278） | 改密开始真正写入 password_hash（生产 P0 现场） |
| 4 | `backend/src/services/admin/cart.service.ts:291` | `UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?` | `backend/src/services/admin/cart.service.ts:294`（参数 tenantId: string @addToCart:275） | 管理端购物车已存在行数量开始累加 |
| 5 | `backend/src/services/admin/cart.service.ts:315` | `UPDATE t_cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AND sku_id = ?` | `backend/src/services/admin/cart.service.ts:318`（参数 tenantId: string @updateCartItemQuantity:306） | 管理端购物车行数量改为指定值开始生效 |
| 6 | `backend/src/services/admin/customer-visit.service.ts:447` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `${column} = ?` + `images = ?` + `updated_at = NOW()` | `backend/src/services/admin/customer-visit.service.ts:450`（参数 tenantId: string @updateVisit:389） | 客户拜访编辑开始落库 |
| 7 | `backend/src/services/admin/customer-visit.service.ts:506` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `status = 'VISITED'` + `start_time = ?` + `latitude = ?` + `longitude = ?` + `address = ?` + `updated_at = NOW()` | `backend/src/services/admin/customer-visit.service.ts:509`（参数 tenantId: string @checkin:476） | 拜访签到（状态/开始时间/定位）开始落库 |
| 8 | `backend/src/services/admin/customer-visit.service.ts:565` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `status = 'COMPLETED'` + `end_time = ?` + `duration_minutes = ?` + `visit_summary = ?` + `follow_up_required = ?` + `follow_up_date = ?` + `follow_up_content = ?` + `next_action = ?` + `images = ?` + `remark = ?` + `updated_at = NOW()` | `backend/src/services/admin/customer-visit.service.ts:568`（参数 tenantId: string @checkout:523） | 拜访签退与总结开始落库 |
| 9 | `backend/src/services/admin/employee.service.ts:180` | `UPDATE t_sys_user SET ${…} WHERE id = ?`；展开：`sets.join(", ")` ⇒ `username = ?` + `real_name = ?` + `mobile = ?` + `store_id = ?` + `department_id = ?` + `position_id = ?` + `status = ?` | `backend/src/services/admin/employee.service.ts:180`（参数 tenantId: string @updateStaff:159） | 员工资料编辑开始落库 |
| 10 | `backend/src/services/admin/employee.service.ts:215` | `UPDATE t_sys_user SET status = ? WHERE id = ?` | `backend/src/services/admin/employee.service.ts:215`（参数 tenantId: string @setStaffStatus:210） | 员工启用/停用开始真正生效（安全相关） |
| 11 | `backend/src/services/admin/instant-retail.service.ts:416` | `UPDATE t_platform_config SET store_id = ?, app_key = ?, app_secret = ?, merchant_id = ?, config_json = ?, updated_at = NOW() WHERE platform = ?` | `backend/src/services/admin/instant-retail.service.ts:428`（参数 tenantId: string @upsertConfig:398） | 即时零售对接配置的更新分支开始落库 |
| 12 | `backend/src/services/admin/marketing-coupon.service.ts:271` | `UPDATE t_coupon_template SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `name = ?` + `type = ?` + `value = ?` + `min_amount = ?` + `max_discount = ?` + `applicable_scope = ?` + `applicable_ids = ?` + `total_count = ?` + `start_time = ?` + `end_time = ?` + `description = ?` | `backend/src/services/admin/marketing-coupon.service.ts:271`（参数 tenantId: string @updateCouponTemplate:236） | 优惠券模板编辑开始落库 |
| 13 | `backend/src/services/admin/marketing-flash-sale.service.ts:216` | `UPDATE t_flash_sale SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `name = ?` + `product_id = ?` + `sku_id = ?` + `flash_price = ?` + `original_price = ?` + `total_stock = ?` + `limit_per_user = ?` + `start_time = ?` + `end_time = ?` | `backend/src/services/admin/marketing-flash-sale.service.ts:216`（参数 tenantId: string @updateFlashSale:185） | 秒杀活动编辑开始落库 |
| 14 | `backend/src/services/admin/marketing-full-reduction.service.ts:156` | `UPDATE t_full_reduction SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `name = ?` + `rules = ?` + `applicable_scope = ?` + `applicable_ids = ?` + `start_time = ?` + `end_time = ?` + `priority = ?` + `stackable = ?` + `description = ?` | `backend/src/services/admin/marketing-full-reduction.service.ts:156`（参数 tenantId: string @updateFullReduction:125） | 满减活动编辑开始落库 |
| 15 | `backend/src/services/admin/marketing-group-buy.service.ts:193` | `UPDATE t_group_buy SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `name = ?` + `product_id = ?` + `sku_id = ?` + `group_price = ?` + `original_price = ?` + `min_group_size = ?` + `max_group_size = ?` + `time_limit_hours = ?` + `total_stock = ?` + `start_time = ?` + `end_time = ?` | `backend/src/services/admin/marketing-group-buy.service.ts:193`（参数 tenantId: string @updateGroupBuy:158） | 拼团活动编辑开始落库 |
| 16 | `backend/src/services/admin/marketing-new-coupon.service.ts:285` | `UPDATE t_coupon_template SET ${…}, updated_at = NOW() WHERE id = ?`；展开：`updates.join(", ")` ⇒ `${column} = ?` + `applicable_ids = ?` | `backend/src/services/admin/marketing-new-coupon.service.ts:288`（参数 tenantId: string @updateCouponTemplate:219） | 优惠券模板编辑（新版）开始落库 |
| 17 | `backend/src/services/admin/marketing-new-promotion.service.ts:266` | `UPDATE t_promotion_activity SET ${…}, updated_at = NOW() WHERE id = ?`；展开：`updates.join(", ")` ⇒ `${column} = ?` + `applicable_ids = ?` + `rules = ?` | `backend/src/services/admin/marketing-new-promotion.service.ts:269`（参数 tenantId: string @updatePromotion:214） | 促销活动编辑开始落库 |
| 18 | `backend/src/services/admin/marketing-points.service.ts:90` | `UPDATE t_points_rule SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `earn_ratio = ?` + `redeem_ratio = ?` + `min_redeem_amount = ?` + `max_redeem_ratio = ?` + `expire_days = ?` + `enabled = ?` | `backend/src/services/admin/marketing-points.service.ts:90`（参数 tenantId: string @updatePointsRule:67） | 积分规则编辑开始落库 |
| 19 | `backend/src/services/admin/marketing-points.service.ts:292` | `UPDATE t_user_points SET points = ?, total_spent = total_spent + ? WHERE user_id = ?` | `backend/src/services/admin/marketing-points.service.ts:297`（解构自 params） | 积分兑换开始真正扣减余额 |
| 20 | `backend/src/services/admin/marketing-stack-rule.service.ts:85` | `UPDATE t_promo_stack_rule SET ${…} WHERE id = ?`；展开：`updates.join(", ")` ⇒ `name = ?` + `type_combination = ?` + `max_total_discount_rate = ?` + `priority = ?` + `enabled = ?` | `backend/src/services/admin/marketing-stack-rule.service.ts:85`（参数 tenantId: string @updateStackRule:62） | 叠加规则编辑开始落库 |
| 21 | `backend/src/services/admin/order-timeout.service.ts:76` | `UPDATE t_order_timeout_config SET ${…} WHERE id = ?`；展开：`fields.join(", ")` ⇒ `order_type = ?` + `timeout_type = ?` + `timeout_minutes = ?` + `action = ?` + `enabled = ?` + `description = ?` | `backend/src/services/admin/order-timeout.service.ts:76`（var tenantId = config.tenant_id） | 订单超时配置编辑开始落库 |
| 22 | `backend/src/services/admin/payment-config.service.ts:91` | `UPDATE t_payment_config SET box_config=?, updated_at=NOW() WHERE provider='wechat'` | `backend/src/services/admin/payment-config.service.ts:94`（参数 tenantId: string @saveChannelConfig:68） | 微信支付盒子配置保存开始落库 |
| 23 | `backend/src/services/admin/payment-config.service.ts:111` | `UPDATE t_payment_config SET app_id=?, mch_id=?, api_v3_key=?, api_key=?, private_key=?, serial_no=?, notify_url=?, alipay_public_key=?, box_config=?, enabled=?, updated_at=NOW() WHERE provider=?` | `backend/src/services/admin/payment-config.service.ts:114`（参数 tenantId: string @saveChannelConfig:68） | 支付渠道全字段（密钥/回调）保存开始落库 |
| 24 | `backend/src/services/admin/print.service.ts:520` | `UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, status = ?, version = version + 1, updated_by = ? WHERE id = ?` | `backend/src/services/admin/print.service.ts:532`（参数 tenantId: string @updatePrintTemplate:509） | 打印模板编辑开始落库 |
| 25 | `backend/src/services/admin/print.service.ts:558` | `UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, version = version + 1 WHERE id = ?` | `backend/src/services/admin/print.service.ts:563`（参数 tenantId: string @resetPrintTemplate:552） | 打印模板重置开始落库 |
| 26 | `backend/src/services/admin/product.service.ts:699` | `UPDATE t_product_sku SET barcode = ?, updated_at = NOW() WHERE id = ?` | `backend/src/services/admin/product.service.ts:702`（参数 tenantId: string @updateSkuBarcode:692） | SKU 条码更新开始落库 |
| 27 | `backend/src/services/admin/push.service.ts:361` | `UPDATE t_push_token SET user_id = ?, push_token = ?, app_platform = ?, app_version = ?, status = 1, last_active_at = NOW() WHERE id = ?` | `backend/src/services/admin/push.service.ts:366`（参数 tenantId: string @registerToken:333） | 已存在设备的推送 token 更新开始落库 |
| 28 | `backend/src/services/admin/tag.service.ts:60` | `UPDATE t_product_tag_group SET ${…} WHERE id = ?`；展开：`sets.join(", ")` ⇒ `name = ?` + `code = ?` + `sort_no = ?` + `is_multiple = ?` | `backend/src/services/admin/tag.service.ts:62`（参数 tenantId: string @updateGroup:43） | 标签组编辑开始落库 |
| 29 | `backend/src/services/admin/tag.service.ts:131` | `UPDATE t_product_tag SET ${…} WHERE id = ?`；展开：`sets.join(", ")` ⇒ `group_id = ?` + `name = ?` + `sort_no = ?` | `backend/src/services/admin/tag.service.ts:133`（参数 tenantId: string @updateTag:115） | 标签编辑开始落库 |
| 30 | `backend/src/services/admin/visit-plan.service.ts:201` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `${column} = ?` + `images = ?` + `updated_at = NOW()` | `backend/src/services/admin/visit-plan.service.ts:204`（参数 tenantId: string @updateVisitPlan:143） | 拜访计划编辑开始落库 |
| 31 | `backend/src/services/admin/visit-record.service.ts:280` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `status = 'VISITED'` + `start_time = ?` + `latitude = ?` + `longitude = ?` + `address = ?` + `updated_at = NOW()` | `backend/src/services/admin/visit-record.service.ts:283`（参数 tenantId: string @checkin:250） | 拜访记录签到开始落库 |
| 32 | `backend/src/services/admin/visit-record.service.ts:337` | `UPDATE t_customer_visit SET ${…} WHERE visit_no = ?`；展开：`updates.join(", ")` ⇒ `status = 'COMPLETED'` + `end_time = ?` + `duration_minutes = ?` + `visit_summary = ?` + `follow_up_required = ?` + `follow_up_date = ?` + `follow_up_content = ?` + `next_action = ?` + `images = ?` + `remark = ?` + `updated_at = NOW()` | `backend/src/services/admin/visit-record.service.ts:340`（参数 tenantId: string @checkout:295） | 拜访记录签退开始落库 |
| 33 | `backend/src/services/hardware/hardware-config.service.ts:77` | `UPDATE t_hardware_config SET config_json = ?, enabled = ?, updated_at = NOW() WHERE id = ?` | `backend/src/services/hardware/hardware-config.service.ts:80`（参数 tenantId: string @saveConfig:56） | 硬件配置编辑开始落库 |
| 34 | `backend/src/services/hardware/payment-box.service.ts:87` | `UPDATE t_payment_config SET box_config = ?, updated_at = NOW() WHERE provider = 'wechat'` | `backend/src/services/hardware/payment-box.service.ts:90`（参数 tenantId: string @saveBoxConfig:63） | 支付盒子配置保存开始落库 |
| 35 | `backend/src/services/instant-retail/platform-integration.service.ts:208` | `UPDATE t_platform_config SET store_id = ?, app_key = ?, app_secret = ?, merchant_id = ?, config_json = ?, updated_at = NOW() WHERE platform = ?` | `backend/src/services/instant-retail/platform-integration.service.ts:220`（参数 tenantId: string @upsertConfig:190） | 平台对接配置的更新分支开始落库 |
| 36 | `backend/src/services/instant-retail/retail-announcement.service.ts:115` | `UPDATE t_retail_announcement SET ${…} WHERE id = ? AND store_id = ?`；展开：`fields.join(", ")` ⇒ `store_id = ?` + `title = ?` + `content = ?` + `is_top = ?` + `start_time = ?` + `end_time = ?` + `status = ?` | `backend/src/services/instant-retail/retail-announcement.service.ts:118`（参数 tenantId: string @updateAnnouncement:91） | 零售公告编辑开始落库 |
| 37 | `backend/src/services/miniapp/cart.service.ts:85` | `UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?` | `backend/src/services/miniapp/cart.service.ts:88`（参数 tenantId: string @addToCart:69） | 小程序购物车加购累加开始落库 |
| 38 | `backend/src/services/miniapp/cart.service.ts:109` | `UPDATE t_cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AND sku_id = ?` | `backend/src/services/miniapp/cart.service.ts:112`（参数 tenantId: string @updateCartItemQuantity:100） | 小程序购物车数量更新开始落库 |

---

## 四、反证（本卡无门禁可造红，以「反向核对 + 真实函数两版复算」替代）

### 4.1 真实 `injectUpdateTenant` 两版纯函数复算（命中样例：修复前 / 修复后参数对照）

方法：从 **main 现版源码** 与 **分支 `fix/s3-65-change-password-fail` 提交 `1c46dd9c` 的源码** 中提取 `injectTenantCondition / injectSelectTenant / injectInsertTenant / injectUpdateTenant / injectDeleteTenant` 五个真实函数（TypeScript 编译器转译后同进程执行，**未连库、未起服务**），对同一条 `(SQL, params, tenantId)` 分别复算实发语句。复跑命令见 §9。

=== S1 changePassword（生产现场同款）
  入参 SQL: UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?  params=["$2b$12$HASH",7]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(3)/占位符(3): ["default","$2b$12$HASH",7]
        UPDATE t_sys_user SET password_hash = ⇒ "default"
        , updated_at = NOW() WHERE tenant_id = ⇒ "$2b$12$HASH"
        AND id = ⇒ 7
  [修复后(1c46dd9c)] SQL: UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(3)/占位符(3): ["$2b$12$HASH","default",7]
        UPDATE t_sys_user SET password_hash = ⇒ "$2b$12$HASH"
        , updated_at = NOW() WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  ⇒ 结论: 两版不同 ⇒ 修复前参数错位，修复后按占位符位置对齐

=== S2 updateSettings
  入参 SQL: UPDATE t_sys_user SET default_homepage = ? WHERE id = ?  params=["dashboard",7]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_sys_user SET default_homepage = ? WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(3)/占位符(3): ["default","dashboard",7]
        UPDATE t_sys_user SET default_homepage = ⇒ "default"
        WHERE tenant_id = ⇒ "dashboard"
        AND id = ⇒ 7
  [修复后(1c46dd9c)] SQL: UPDATE t_sys_user SET default_homepage = ? WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(3)/占位符(3): ["dashboard","default",7]
        UPDATE t_sys_user SET default_homepage = ⇒ "dashboard"
        WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  ⇒ 结论: 两版不同 ⇒ 修复前参数错位，修复后按占位符位置对齐

=== S3 admin/cart addToCart
  入参 SQL: UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?  params=[2,88]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(3)/占位符(3): ["default",2,88]
        UPDATE t_cart_item SET quantity = quantity + ⇒ "default"
        , updated_at = NOW() WHERE tenant_id = ⇒ 2
        AND id = ⇒ 88
  [修复后(1c46dd9c)] SQL: UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(3)/占位符(3): [2,"default",88]
        UPDATE t_cart_item SET quantity = quantity + ⇒ 2
        , updated_at = NOW() WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 88
  ⇒ 结论: 两版不同 ⇒ 修复前参数错位，修复后按占位符位置对齐

=== S5 print resetPrintTemplate
  入参 SQL: UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, version = version + 1 WHERE id = ?  params=["A4","t","x",9]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, version = version + 1 WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(5)/占位符(5): ["default","A4","t","x",9]
        UPDATE t_print_template SET paper_type = ⇒ "default"
        , template_name = ⇒ "A4"
        , content = ⇒ "t"
        , version = version + 1 WHERE tenant_id = ⇒ "x"
        AND id = ⇒ 9
  [修复后(1c46dd9c)] SQL: UPDATE t_print_template SET paper_type = ?, template_name = ?, content = ?, version = version + 1 WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(5)/占位符(5): ["A4","t","x","default",9]
        UPDATE t_print_template SET paper_type = ⇒ "A4"
        , template_name = ⇒ "t"
        , content = ⇒ "x"
        , version = version + 1 WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 9
  ⇒ 结论: 两版不同 ⇒ 修复前参数错位，修复后按占位符位置对齐

=== S6 动态 SET 展开（approval-flow 全字段）
  入参 SQL: UPDATE t_approval_rule SET sla_hours = ?, escalation_level = ?, status = ? WHERE id = ?  params=[4,2,"ON",11]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_approval_rule SET sla_hours = ?, escalation_level = ?, status = ? WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(5)/占位符(5): ["default",4,2,"ON",11]
        UPDATE t_approval_rule SET sla_hours = ⇒ "default"
        , escalation_level = ⇒ 4
        , status = ⇒ 2
        WHERE tenant_id = ⇒ "ON"
        AND id = ⇒ 11
  [修复后(1c46dd9c)] SQL: UPDATE t_approval_rule SET sla_hours = ?, escalation_level = ?, status = ? WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(5)/占位符(5): [4,2,"ON","default",11]
        UPDATE t_approval_rule SET sla_hours = ⇒ 4
        , escalation_level = ⇒ 2
        , status = ⇒ "ON"
        WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 11
  ⇒ 结论: 两版不同 ⇒ 修复前参数错位，修复后按占位符位置对齐

=== S7 反例·WHERE 前无占位符（SET 全字面量）
  入参 SQL: UPDATE t_sys_user SET status = 0 WHERE id = ?  params=[7]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_sys_user SET status = 0 WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(2)/占位符(2): ["default",7]
        … t_sys_user SET status = 0 WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  [修复后(1c46dd9c)] SQL: UPDATE t_sys_user SET status = 0 WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(2)/占位符(2): ["default",7]
        … t_sys_user SET status = 0 WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  ⇒ 结论: 两版一致（不受本灶影响）

=== S8 反例·SQL 自带 tenant_id（短路）
  入参 SQL: UPDATE t_sys_user SET status = ? WHERE tenant_id = ? AND id = ?  params=[0,"default",7]  tenantId="default"
  [修复前(main)] SQL: UPDATE t_sys_user SET status = ? WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(3)/占位符(3): [0,"default",7]
        UPDATE t_sys_user SET status = ⇒ 0
        WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  [修复后(1c46dd9c)] SQL: UPDATE t_sys_user SET status = ? WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(3)/占位符(3): [0,"default",7]
        UPDATE t_sys_user SET status = ⇒ 0
        WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  ⇒ 结论: 两版一致（不受本灶影响）

=== S9 反例·SELECT 分支
  入参 SQL: SELECT id FROM t_sys_user WHERE id = ?  params=[7]  tenantId="default"
  [修复前(main)] SQL: SELECT id FROM t_sys_user WHERE tenant_id = ? AND id = ?
  [修复前(main)] params(2)/占位符(2): ["default",7]
        SELECT id FROM t_sys_user WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  [修复后(1c46dd9c)] SQL: SELECT id FROM t_sys_user WHERE tenant_id = ? AND id = ?
  [修复后(1c46dd9c)] params(2)/占位符(2): ["default",7]
        SELECT id FROM t_sys_user WHERE tenant_id = ⇒ "default"
        AND id = ⇒ 7
  ⇒ 结论: 两版一致（不受本灶影响）

「WHERE 何时成立」逐例说明（与上面输出一一对应）：

- **S1 改密**：修复前 `SET password_hash = 'default'`、`WHERE tenant_id = '$2b$12$HASH' AND id = 7` ⇒ 需 `t_sys_user.tenant_id` 恰好等于一个 bcrypt 哈希串，**永不成立** ⇒ 0 行（服务层不校验 ⇒ 返回"密码修改成功"，生产实测）。修复后 `WHERE tenant_id = 'default' AND id = 7` ⇒ **成立**，改密真正落库。
- **S2 默认主页**：修复前 `SET default_homepage = 'default'`、`WHERE tenant_id = 'dashboard' AND id = 7` ⇒ 不成立；修复后 `WHERE tenant_id = 'default' AND id = 7` ⇒ 成立。
- **S3 管理端购物车加购**：修复前 `SET quantity = quantity + 'default'`（数值列加字符串）、`WHERE tenant_id = 2 AND id = 88` ⇒ 不成立；修复后 `WHERE tenant_id = 'default' AND id = 88` ⇒ 成立，数量开始累加。
- **S5 打印模板重置**：修复前 `SET content = 'A4'`、`WHERE tenant_id = 'x'`（错位一格）⇒ 不成立；修复后三者各归其位 ⇒ 成立。
- **S6 动态 SET（审批流规则全字段）**：修复前 `SET sla_hours = 'default', escalation_level = 4, status = 2`、`WHERE tenant_id = 'ON' AND id = 11` ⇒ 不成立；修复后 ⇒ 成立（这条即 H2 形态的代表：静态文本里没有占位符，展开 `updates.join(", ")` 后才有）。
- **反例 S7（SET 全字面量）/ S8（自带 tenant_id）/ S9（SELECT 分支）**：两版输出**完全一致** ⇒ 证明本卡判据（首个 WHERE 前占位符数 = 0 或已含 tenant_id）确实对应"不受本灶影响"。

### 4.2 从「不命中」抽 6 条：逐条指明卡在四条件中的哪一条

| # | 调用点 | 卡在哪一条 | 依据（原文片段） |
|---|---|---|---|
| 1 | `backend/src/services/admin/aftersale.service.ts:135` | **②** SQL 已自带 tenant_id（短路） | `UPDATE t_aftersale SET return_logistics_no = ?, ... WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ?`（注入点前有 2 个占位符，但②不成立 ⇒ `database.ts:274` 直接返回原样） |
| 2 | `backend/src/services/admin/print.service.ts:575` | **②+③** 自带 tenant_id 且 SET 无占位符 | `UPDATE t_print_template SET is_default = 0 WHERE bill_type = ? AND tenant_id = ?`（两条件同时不成立，双保险） |
| 3 | `backend/src/services/admin/product-bundle.service.ts:344` | **③** 首个 WHERE 前 0 个占位符 | `UPDATE t_product_bundle SET status = 1 WHERE id = ? AND tenant_id = ?`（即便②改判，注入后参数顺序仍正确） |
| 4 | `backend/src/services/admin/approval-flow.service.ts:195` | **①+③** 非 UPDATE（DELETE）且 WHERE 前无占位符 | `DELETE FROM t_approval_rule WHERE id = ?`（DELETE 走 `database.ts:291`→`injectUpdateTenant`，但 75 处 DELETE 的 WHERE 前占位符全为 0） |
| 5 | `backend/src/jobs/report-aggregation.job.ts:7` | **④** tenantId 实参恒为空串 | `queryWithTenant(sql, [], "")`：`SELECT DISTINCT tenant_id FROM t_sale_bill WHERE business_status = 'CREATED'`（系统级跨租户统计，tenantId 传 `""`；按派单卡 §五「恒为空串必须判不命中并写明」） |
| 6 | `backend/src/services/admin/trace-records.service.ts:855` | **②（动态形态）** 运行期 SQL 含 tenant_id | `affectedCondition` ∈ {`sku_id = ? AND tenant_id = ?`, `supplier_id = ? AND tenant_id = ?`, `tenant_id = ?`}（`trace-records.service.ts:843/847/851`）⇒ 运行期文本含 `tenant_id` ⇒ 短路；且 `SET current_status = 'RECALLED', version = version + 1, updated_at = NOW()` 全字面量 ⇒ 双条件均不成立 |

---

## 五、与旧口径差异（禁止静默换数）

### 5.1 命中集：旧 10 处 vs 本卡 38 处

| 旧口径 10 处（`R101-S3-65-阿坚回传.md` §四） | 本卡 | 说明 |
|---|---|---|
| `services/admin/auth.service.ts:270` | 命中（#2） | 一致 |
| `services/admin/cart.service.ts:291` | 命中（#4） | 一致 |
| `services/admin/employee.service.ts:215` | 命中（#10） | 一致 |
| `services/admin/instant-retail.service.ts:416` | 命中（#11） | 一致 |
| `services/admin/marketing-points.service.ts:292` | 命中（#19） | 一致 |
| `services/admin/print.service.ts:520` | 命中（#24） | 一致 |
| `services/admin/print.service.ts:558` | 命中（#25） | 一致 |
| `services/admin/push.service.ts:361` | 命中（#27） | 一致 |
| `services/instant-retail/platform-integration.service.ts:208` | 命中（#35） | 一致 |
| `services/miniapp/cart.service.ts:85` | 命中（#37） | 一致 |

**新增 28 处的来源（口径变化，逐类说明）**：

| 类别 | 数量 | 依据 |
|---|---|---|
| 动态 SET 拼接（旧扫描的 rg 只能看见字面量 SQL，`SET ${updates.join(", ")}` 形态**看不见**） | 20 | §3 的 #1/#6/#7/#8/#9/#12/#13/#14/#15/#16/#17/#18/#20/#21/#28/#29/#30/#31/#32/#36 |
| 同为静态形态但旧扫描漏记（旧卡只覆盖 `queryWithTenant` 一部分且清单缺项） | 8 | `auth.service.ts:293`（**本次 P0 现场**）、`cart.service.ts:315`、`payment-config.service.ts:91`、`payment-config.service.ts:111`、`product.service.ts:699`、`hardware-config.service.ts:77`、`payment-box.service.ts:87`、`miniapp/cart.service.ts:109` |
| 合计 | 28 | 10（旧）+ 28（新）= 38 ✔ |

> **口径变化本身要留痕**：本卡口径＝三 helper（含 `queryOneWithTenant`/`executeWithTenant`）+ 模板字符串变量展开 + `tenantId` 实参溯源，并用**真实注入函数两版复算**验证判据。旧口径漏掉 `auth.service.ts:293` 属**漏记**（该处正是生产 P0 的现场，其形态与已列的 `:270` 完全同类）。

### 5.2 写语句总数：484 / 439

| 项 | 旧卡（踩坑日志[89]） | 本卡 | 差异归因（可核对） |
|---|---|---|---|
| 写语句总数 | 484（5 helper + rg 口径） | **356**（三 helper 调用点）/ **396**（五 helper 调用点） | ① 口径收窄：484 含 `query/queryOne`（本卡补算 40 处）；② 旧命令复跑得 **769 行**（`-U` 多行匹配按"匹配块行数"输出，1 个块可占多行），与 484 亦不符 ⇒ 旧数的**计数单位未记录、无法复算**；③ 事务内 `conn.query/conn.execute` 写语句 26 处属另一路径，本卡范围外 |
| 无 `affectedRows` 校验 | 439 | 不复算 | 该项是"调用点后 500 字符窗口内是否出现 affectedRows"的**独立**统计，与本病灶判定无关；本卡只统计**命中集**的校验情况（§6） |

> 结论：**484/439 不再作为本项目引用数字**，替换为可复跑的三/五 helper 口径（356 / 396）与命中集 38。旧数降级为历史记录。

---

## 六、风险提示（有依据才写）

### 6.1 命中集里"业务上依赖写失败"的迹象

结论：**未发现"依赖写失败"的设计意图**（没有发现"故意让 UPDATE 0 行以跳过某逻辑"的写法）；但有**两处一致性风险**与**普遍无失败感知**，逐条给依据：

1. **矛盾数据风险（有依据，需人工清点历史数据）**：`services/admin/marketing-points.service.ts:292` 的余额 UPDATE 命中，而紧随其后的 `:301` 是 `INSERT INTO t_points_record (..., tenant_id) VALUES (..., ?)`——**该 INSERT 自带 `tenant_id` 列 ⇒ 注入短路 ⇒ 修复前也能正常写入**。故修复前存在"积分流水已记录、用户余额未扣减"的**不一致数据**；修复后两者一致，但**存量数据是否已有偏差需人工核查**（本卡不能连库，未做清点）。
2. **安全相关静默失效（有依据）**：`services/admin/employee.service.ts:215 setStaffStatus` = `UPDATE t_sys_user SET status = ? WHERE id = ?`（无 `affectedRows` 校验，`:210-217` 全文可核）⇒ 修复前"停用员工"接口返回成功但状态未变（离职/停用未生效）。
3. **普遍无失败感知（有依据）**：命中集 38 处中，**32 处**在调用点后 16 行窗口内**没有** `affectedRows` 判断（有校验的仅 6 处：`admin/cart.service.ts:291`、`admin/cart.service.ts:315`、`product.service.ts:699`、`instant-retail/retail-announcement.service.ts:115`、`miniapp/cart.service.ts:85`、`miniapp/cart.service.ts:109`）。⇒ 修复后写入开始生效，但"0 行"仍不会被感知（属另一批工作，见踩坑[89] 教训 2）。
4. **需人工确认清单（无依据不下结论）**：
   - `push.service.ts:361`（更新分支）修复后开始生效，而其**新增分支 `:371`** 存在注入后 SQL 括号不平衡问题（§7 附带发现②）⇒ 修复部署后需冒烟"新设备注册推送 token"。
   - 营销类（优惠券/秒杀/满减/拼团/促销/叠加规则/积分规则）修复前编辑**静默不落库**，需确认运营侧是否存在"重复提交同一编辑"的历史操作记录（如有，属正常补偿，无需处理）。
   - 拜访类（`checkin`/`checkout`）修复前签到签退静默失败，需确认是否存在"同一拜访被反复签到"的历史数据。

---

## 七、静态层面无法确定的项（**需运行期确认**）

| # | 项 | 位置 | 为何静态无法确定 | 影响 |
|---|---|---|---|---|
| 1 | SQL 实参为变量/动态拼接（11 处） | `config/database.ts:182/187`（内部委派）、`services/admin/cart.service.ts:139/186`（`dbQuery`/`doQueryOne` 包装，调用方为价格/优惠 SELECT）、`services/admin/report-export.service.ts:186`（`reportQueries[type].sql`，10 个报表查询均为 `SELECT`）、`services/miniapp/checkout.service.ts:9/53`（同包装）、`services/store/inventory.service.ts:108`（`totalSql`，`SELECT COUNT`）、`shared/field-sync.ts:343`（`targetSql`，`UPDATE ... SET t.x = (SELECT ... WHERE s.id = ?) WHERE t.k = ? AND t.tenant_id = ?` **自带 tenant_id ⇒ 静态可见不命中**）、`shared/product-sync.ts:644`（`target.sql`，`SELECT COUNT`）、`services/admin/price-management.service.ts:369`（`matchSql` 由 `:333 let matchSql = ""` + `:336/:351` 两段模板赋值，选中分支均含 `AND sp.tenant_id = ?` ⇒ 静态可见不命中） | SQL 文本在运行期才确定 | 逐条已按"可见部分"判**不命中**，但按派单卡纪律**不计入命中集**，标注需运行期确认 |
| 2 | `tenantId` 运行期真值 | 命中集 38 处的实参均为**函数参数/解构参数**（如 `auth.controller.ts:43 req.tenantId as string`、`auth.controller.ts:61 req.tenantId!`、`employee.controller.ts:50 req.user!.tenantId`、`marketing-points.controller.ts:21 req.tenantId!`） | 本通道无法起服务、无法取运行时请求 | 按派单卡 §五「可能为真值」判 ④ 成立；若某调用链存在"tenantId 为空串"的入口，该处应改判（暂无证据） |
| 3 | 动态 tenant 条件 | `services/instant-retail/product-sync.service.ts:75`：`tenantCondition = tenantId ? "AND tenant_id = ?" : ""`，实参 `tenantId \|\| ""` | 依赖运行期 `tenantId` | 真值 ⇒ 运行期 SQL 含 tenant_id ⇒ 短路（不命中）；假值 ⇒ 空串触发注入，但 WHERE 前占位符为 0（参数不错位），**只会得到 `tenant_id = ''` 匹配不到行**——该"空串语义"是否可接受需人工确认 |
| 4 | **附带发现①：读路径同族缺陷** | `services/admin/report/sales-report.service.ts:154`：`SELECT DATE_FORMAT(sb.created_at, ?) AS period, ... FROM t_sale_bill sb WHERE ... AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL ${intervalExpr}) ...`（params `[dateFormat]`，`intervalExpr` ∈ `12 MONTH`/`12 WEEK`/`30 DAY`） | 该处走 `injectSelectTenant` 的**含 WHERE 分支**（`database.ts:225`，同样 `[tenantId, ...params]`），本卡判据显示 SELECT 中满足"首个 where 前有占位符"的调用点**仅此 1 处**（全量 1298 处 SELECT 中 17 处该值 > 0，其余 16 处 SQL 自带 tenant_id ⇒ 短路） | 静态推断：修复前/修复后均会把 `tenantId` 绑到 `DATE_FORMAT` 的参数、把 `dateFormat` 绑到 `tenant_id`（**修复分支 `1c46dd9c` 未触及 `injectSelectTenant`**）⇒ 属**未根治**的同族缺陷，建议另行立卡；本卡只读未修 |
| 5 | **附带发现②：INSERT 分支重建 SQL 丢尾部** | `services/admin/push.service.ts:371`：`INSERT INTO t_push_token (..., last_active_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())` | `injectInsertTenant`（`database.ts:251-266`）用正则 `VALUES\s*\(\s*([^)]+)\s*\)` 捕获后**整句重建**，`NOW()` 的第一个 `)` 会截断捕获 ⇒ 重建结果 `... VALUES (?, ?, ?, ?, ?, ?, ?, 1`（括号不平衡、尾部丢失） | 真实函数复算证据：注入后括号不平衡 = 1（13 处"未自带 tenant_id 且可静态注入"的 INSERT 中唯一 1 处）；运行期表现预计为 SQL 语法错误（**响亮的失败，非静默**），需运行期确认；本卡只读未修 |
| 6 | 旧数字 484/439 | 见 §5.2 | 旧脚本未入库、计数单位未记录 | 不得引用 |

---

## 八、只读性自查（`git status --porcelain` 原始输出）

```powershell
cd D:\Users\ZXQL\ZXQL-MS\wen-ssystem ; git -c core.quotepath=false status --porcelain
```

原始输出（本卡收尾时执行，逐字粘贴）：

```
 M docs/memories/阿坚-记忆.md
 M docs/tasks/R101-总进度与推进计划.md
 D docs/tasks/inbox/ACTIVE.md
 M docs/踩坑日志.md
?? backend/src/__tests__/security/
?? docs/tasks/cards/R101-Ajian-S3-65-影响面.md
?? docs/tasks/cards/R101-S3-65-影响面-派单卡.md
?? docs/tasks/inbox/ACTIVE-回执.md
?? docs/tasks/inbox/archive/ACTIVE-S2-02-20260914.md
?? docs/tasks/inbox/archive/ACTIVE-S3-65-影响面-20260921.md
?? docs/tasks/inbox/archive/ACTIVE-回执-S3-65-改密修复-20260921.md
```

说明（逐条对应原始输出 11 行）：

- **本卡产生（3 项）**：
  1. `?? docs/tasks/cards/R101-Ajian-S3-65-影响面.md` —— 本报告卡；
  2. `?? docs/tasks/inbox/ACTIVE-回执.md` —— 回执；
  3. ` D docs/tasks/inbox/ACTIVE.md` + `?? docs/tasks/inbox/archive/ACTIVE-S3-65-影响面-20260921.md` —— 归档移动（原 `ACTIVE.md` 10503 字节内容**已完整平移**到归档文件，未删内容）。
- **本卡开工前已存在（8 项，非本卡产生）**：` M docs/踩坑日志.md`、` M docs/memories/阿坚-记忆.md`、` M docs/tasks/R101-总进度与推进计划.md`（凌舟维护中的文档）、`?? docs/tasks/cards/R101-S3-65-影响面-派单卡.md`（本卡派单卡）、`?? docs/tasks/inbox/archive/ACTIVE-S2-02-20260914.md`、`?? docs/tasks/inbox/archive/ACTIVE-回执-S3-65-改密修复-20260921.md`（上一轮 S3-65 归档）、`?? backend/src/__tests__/security/`（内含 `change-password-affectedrows.suran.test.ts`，文件时间 2026-09-21 00:11:38，属**同轮并行任务**产出）。
- 结论：本卡仅新增/移动上述 3 项，**未触碰任何源码、测试与 `docs/` 其他文件**；`backend/src/**` 下无本卡任何写入（可复跑 `git diff --stat -- backend` 复核，应为空）。

---

## 九、复跑命令（原样可粘贴）

```powershell
# 0) 环境：Node ≥ 20（本机 v24.18.0），仓库内自带 typescript（backend/node_modules/typescript）
cd D:\Users\ZXQL\ZXQL-MS\wen-ssystem

# 1) 主扫描（附录 A 脚本 → 存为 %TEMP%\s365\scan.mjs 后执行）：输出调用点计数 / 写路径全量表 / 命中集
node %TEMP%\s365\scan.mjs

# 2) 纯函数两版复算（附录 B 脚本）：把 main 现版与 1c46dd9c 版 injectUpdateTenant 在同进程复算
git show 1c46dd9c:backend/src/config/database.ts | Set-Content -Encoding UTF8 "$env:TEMP\s365\database.fixed.ts"
node %TEMP%\s365\replay.mjs

# 3) 关键锚点抽查（不改文件）
git show HEAD:backend/src/config/database.ts | Select-Object -Skip 270 -First 18          # injectUpdateTenant（main 现版：:281 为 [tenantId, ...params]）
rg -n 'modifiedParams: \[tenantId, \.\.\.params\]' backend/src/config/database.ts          # → :225（SELECT 含 WHERE 分支）与 :281（UPDATE 含 WHERE 分支）
rg -n 'placeholdersBeforeWhere' backend/src/config/database.ts                              # main 现版 0 命中（该写法只在分支 1c46dd9c 上）
```

---

## 附录 A：主扫描脚本（一次性只读分析脚本，**未入库**，因派单只允许新建本卡）

```javascript
// scan.mjs —— 只读静态扫描：三 helper 调用点 → 语句类型/表名/SET 占位符/tenant_id/WHERE 前占位符/tenantId 来源 → 判定
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const REPO = "D:/Users/ZXQL/ZXQL-MS/wen-ssystem";
const OUT = path.join(process.env.TEMP, "s365");
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire("file:///" + REPO + "/backend/");
const ts = require("typescript");
const THREE = new Set(["queryWithTenant", "queryOneWithTenant", "executeWithTenant"]);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (["__tests__", "node_modules", "dist"].includes(e.name)) continue; walk(p, out); }
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const recs = [];
for (const file of walk(REPO + "/backend/src")) {
  const text = fs.readFileSync(file, "utf8");
  if (!/queryWithTenant|queryOneWithTenant|executeWithTenant/.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const rel = path.relative(REPO, file).replace(/\\/g, "/");
  const L = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const calleeName = (e) => ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name) ? e.name.text : null);
  function enclosingFn(n) { let p = n.parent; while (p) { if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p) || ts.isConstructorDeclaration(p)) return p; p = p.parent; } return null; }
  const declCache = new Map();
  function allDecls(name) {
    if (declCache.has(name)) return declCache.get(name);
    const list = [];
    const visit = (n) => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) list.push(n); ts.forEachChild(n, visit); };
    visit(sf); declCache.set(name, list); return list;
  }
  // 作用域感知的变量查找：优先取"与使用点同一函数"的声明（避免跨函数同名变量串味）
  function findDecl(name, node) {
    const list = allDecls(name); if (!list.length) return null;
    const fn = enclosingFn(node);
    const inScope = list.filter((d) => enclosingFn(d) === fn);
    return (inScope.length ? inScope : list).slice().sort((a, b) => a.getStart() - b.getStart())[0];
  }
  function renderSql(node) {   // 模板字符串变量展开：${updates.join(", ")} 等保留表达式文本并记录
    if (!node) return { ok: false, kind: "missing", text: null };
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { ok: true, kind: "literal", text: node.text, markers: [] };
    if (ts.isTemplateExpression(node)) { let s = node.head.text; const ms = []; for (const sp of node.templateSpans) { ms.push({ text: sp.expression.getText(sf), node: sp.expression }); s += "\u0001" + sp.literal.text; } return { ok: true, kind: "template", text: s, markers: ms }; }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) { const l = renderSql(node.left), r = renderSql(node.right); if (l.ok && r.ok) return { ok: true, kind: "concat", text: l.text + r.text, markers: [...l.markers, ...r.markers] }; return { ok: false, kind: "concat-unresolved", text: node.getText(sf) }; }
    if (ts.isIdentifier(node)) { const d = findDecl(node.text, node); if (d) { const r = renderSql(d.initializer); if (r.ok) return { ok: true, kind: "var", text: r.text, markers: r.markers, declLine: L(d.getStart()) }; } return { ok: false, kind: "var-unresolved", text: node.getText(sf) }; }
    if (ts.isParenthesizedExpression(node)) return renderSql(node.expression);
    return { ok: false, kind: "expr", text: node.getText(sf) };
  }
  function stmtOf(sql) { const s = sql.toLowerCase().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim(); for (const k of ["update", "delete", "insert", "select"]) if (s.startsWith(k)) return k.toUpperCase(); if (s.startsWith("\u0001")) return "DYNAMIC-HEAD"; return "UNRESOLVED"; }
  function tableOf(sql) { const s = sql.replace(/\u0001/g, ""); let m = /^\s*update\s+(?:ignore\s+)?([`\w.]+)/i.exec(s); if (m) return m[1]; m = /^\s*delete\s+from\s+([`\w.]+)/i.exec(s); if (m) return m[1]; m = /^\s*insert\s+into\s+([`\w.]+)/i.exec(s); if (m) return m[1]; return null; }
  function markerResolution(m) {   // 展开 ${arr.join(", ")}：收集同函数内的数组字面量与 arr.push("...")
    const out = { expr: m.text, fragments: null };
    const mm = /^([A-Za-z_$][\w$]*)\.join\(/.exec(m.text); if (!mm) return out;
    const name = mm[1], fn = enclosingFn(m.node), d = findDecl(name, m.node), frags = [];
    if (d && ts.isArrayLiteralExpression(d.initializer)) for (const el of d.initializer.elements) frags.push(el.getText(sf));
    if (fn) { const scan = (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "push" && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === name && n.arguments.length) frags.push(n.arguments[0].getText(sf)); ts.forEachChild(n, scan); }; scan(fn); }
    out.fragments = [...new Set(frags)].map((f) => f.replace(/^["'`]|["'`]$/g, ""));
    out.declLine = d ? L(d.getStart()) : null;
    return out;
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const cn = calleeName(node.expression);
      if (cn && THREE.has(cn)) {
        const args = node.arguments;
        const r = renderSql(args[0]);
        const sqlText = r.ok ? r.text : (args[0] ? args[0].getText(sf) : "");
        const stmt = stmtOf(sqlText), hasTenantId = /tenant_id/i.test(sqlText), lower = sqlText.toLowerCase();
        const wi = lower.indexOf("where"), pre = wi >= 0 ? sqlText.slice(0, wi) : null;
        const phBefore = pre === null ? null : (pre.match(/\?/g) || []).length;     // 判据：注入点前占位符个数
        const setMatch = /^\s*update[\s\S]*?\bset\b/i.exec(sqlText);
        const setClause = setMatch ? (wi >= 0 ? sqlText.slice(setMatch[0].length, wi) : sqlText.slice(setMatch[0].length)).replace(/\u0001/g, " ").trim() : null;
        const tn = args[2];
        const tenant = { argLine: tn ? L(tn.getStart()) : null, text: tn ? tn.getText(sf) : null, cls: tn ? "expr" : "missing", origin: null };
        if (tn && (ts.isStringLiteral(tn) || ts.isNoSubstitutionTemplateLiteral(tn))) tenant.cls = tn.text === "" ? "literal-empty" : "literal-value";
        else if (tn && ts.isIdentifier(tn)) {
          const d = findDecl(tn.text, tn);
          if (d) { tenant.cls = "var"; tenant.origin = "var " + tn.text + " = " + d.initializer.getText(sf).slice(0, 90); }
          else {
            const fn = enclosingFn(tn);
            if (fn) { const nm = fn.name ? fn.name.getText(sf) : "(arrow)"; for (const p of (fn.parameters || [])) { if (ts.isIdentifier(p.name) && p.name.text === tn.text) { tenant.cls = "fn-param"; tenant.origin = "参数 " + tn.text + (p.type ? ": " + p.type.getText(sf) : "") + " @" + nm + ":" + L(fn.getStart()); } if (ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isIdentifier(el.name) && el.name.text === tn.text) { tenant.cls = "fn-param"; tenant.origin = "解构参数 " + tn.text + " @" + nm + ":" + L(fn.getStart()); } } }
            if (tenant.cls === "expr") {
              const re = new RegExp("const\\s*\\{[^}]*\\b" + tn.text + "\\b[^}]*\\}\\s*=\\s*([^;]+);");
              const m2 = re.exec(text);
              if (m2) { tenant.cls = "local-destructured"; tenant.origin = "解构自 " + m2[1].trim().slice(0, 70); } else tenant.cls = "unresolved-ident";
            }
          }
        } else if (tn && ts.isPropertyAccessExpression(tn)) { tenant.cls = "prop"; tenant.origin = tn.getText(sf); }
        recs.push({ file: rel, line: L(node.getStart()), helper: cn, sqlResolved: r.ok, sqlKind: r.kind, sqlText, declLine: r.declLine || null, stmt, table: tableOf(sqlText), hasTenantId, whereIndex: wi, placeholdersBeforeWhere: phBefore, setClause, markers: (r.markers || []).map(markerResolution), tenant });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// 命中判定：UPDATE/DELETE ∧ !tenant_id ∧ (WHERE 前占位符>0 或 动态 SET 展开后含占位符) ∧ tenantId 可真值
const isHit = (r) => {
  if (r.stmt !== "UPDATE" && r.stmt !== "DELETE") return false;
  if (r.hasTenantId) return false;
  if (r.tenant.cls === "literal-empty") return false;
  const phB = r.placeholdersBeforeWhere === null ? 0 : r.placeholdersBeforeWhere;
  if (phB > 0) return true;
  const dyn = r.markers.filter((m) => m.fragments && m.fragments.length);
  return dyn.length > 0 && dyn.every((m) => m.fragments.every((f) => /\?/.test(f.replace(/\$\{[^}]*\}/g, "X"))));
};
const W = recs.filter((r) => r.stmt === "UPDATE" || r.stmt === "DELETE");
console.log("calls=" + recs.length + " write=" + W.length + " hits=" + W.filter(isHit).length);
fs.writeFileSync(path.join(OUT, "calls.json"), JSON.stringify(recs, null, 1), "utf8");
```

## 附录 B：纯函数两版复算脚本（**未入库**）

```javascript
// replay.mjs —— 从 main 现版与分支 1c46dd9c 版源码中提取真实的 inject*Tenant 函数，同一条 (SQL, params, tenantId) 两版复算
// 前置：git show 1c46dd9c:backend/src/config/database.ts | Set-Content -Encoding UTF8 "$env:TEMP\s365\database.fixed.ts"
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const REPO = "D:/Users/ZXQL/ZXQL-MS/wen-ssystem";
const OUT = path.join(process.env.TEMP, "s365");
const require = createRequire("file:///" + REPO + "/backend/");
const ts = require("typescript");
const NAMES = ["injectTenantCondition", "injectSelectTenant", "injectInsertTenant", "injectUpdateTenant", "injectDeleteTenant"];
function build(srcText, tag) {
  const sf = ts.createSourceFile(tag, srcText, ts.ScriptTarget.Latest, true); const out = [];
  const visit = (n) => { if (ts.isFunctionDeclaration(n) && n.name && NAMES.includes(n.name.text)) out.push(srcText.slice(n.getStart(sf), n.getEnd())); ts.forEachChild(n, visit); };
  visit(sf);
  return new Function(ts.transpileModule(out.join("\n") + "\nreturn injectTenantCondition;", { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText)();
}
const cur = build(fs.readFileSync(REPO + "/backend/src/config/database.ts", "utf8"), "cur");
const fixed = build(fs.readFileSync(path.join(OUT, "database.fixed.ts"), "utf8").replace(/^\uFEFF/, ""), "fixed");
const cases = [
  ["S1 changePassword", "UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?", ["$2b$12$HASH", 7], "default"],
  ["S7 反例·SET 全字面量", "UPDATE t_sys_user SET status = 0 WHERE id = ?", [7], "default"],
  ["S8 反例·自带 tenant_id", "UPDATE t_sys_user SET status = ? WHERE tenant_id = ? AND id = ?", [0, "default", 7], "default"],
  ["S9 反例·SELECT 分支", "SELECT id FROM t_sys_user WHERE id = ?", [7], "default"]
];
for (const [label, sql, params, t] of cases) {
  const a = cur(sql, params, t), b = fixed(sql, params, t);
  console.log("=== " + label);
  console.log("  修复前 params: " + JSON.stringify(a.modifiedParams) + " / SQL: " + a.modifiedSql.replace(/\s+/g, " "));
  console.log("  修复后 params: " + JSON.stringify(b.modifiedParams) + " / SQL: " + b.modifiedSql.replace(/\s+/g, " "));
}
```

---

## 十、变更记录

| 时间 | 变更点 | 依据 |
|---|---|---|
| 2026-09-21 | 立卡（口径由"仅 `queryWithTenant`"扩为三 helper + 模板字符串变量展开 + `tenantId` 实参溯源；补入真实注入函数两版复算作为反证） | 派单卡 `R101-S3-65-影响面-派单卡.md`；旧口径见 `R101-S3-65-阿坚回传.md` 第四节 |
