/**
 * S3-209：销售单取消（cancel）权限点常量
 *
 * 为什么在这里"立码"（本仓约定：权限码只能取既有码表中的码，不能临时硬编码字符串）：
 *   · `docs/migrations/079_权限矩阵.sql` 的销售域只登记了 `sale:create` / `sale:void` /
 *     `sale:edit`（BUTTON 行 id 210/211/212），**没有** `sale:cancel`；
 *   · `sale:void` 的语义是"销售记录页的作废按钮"，而本单是**销售单取消**（跨线给 AI 底座调用的写能力），
 *     两者授权面不同（前者属工作台页面按钮，后者要被 AI 底座/店长调用）⇒ 按派单卡 R1 立新码
 *     `sale:cancel`，登记在 `docs/migrations/203_销售单取消权限点.sql`（菜单 BUTTON 行）。
 *
 * 持有者口径（与 `backend/scripts/guard-rbac-wiring.mjs --holders sale:cancel` 同源）：
 *   · `SUPER_ADMIN`（`*`）与 `STORE_MANAGER`（`sale:*` 域通配，生产实值已确认）⇒ 通过；
 *   · `SALES_STAFF`（`sale:create`/`sale:view` 精确码）、`STORE_OPERATOR`（无 sale:*）⇒ 403。
 *
 * ⚠️ 本仓迁移写闸门默认 block（INSERT/UPDATE/DELETE 一律跳过），因此"角色授权"不可随迁移预置：
 *   需给某个非通配角色单独发 `sale:cancel` 时，由凌舟在生产用既有权角色接口
 *   （`PUT /api/platform/roles/:id/permissions` 或后台权限页）按需配置一次。
 */
export const PERM_SALE_CANCEL = "sale:cancel";
