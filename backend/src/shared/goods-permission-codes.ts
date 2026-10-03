/**
 * S3-142：商品（goods）权限点常量
 *
 * 为什么沿用既有码、不新造码：手工建品（POST /api/admin/products）的权限点
 * 在权限矩阵里**已经存在** —— `docs/migrations/079_权限矩阵.sql:201`
 *   (200, 10, 'goods:create', '新增商品', 'BUTTON', 1, 'default')
 * 本单只把它接线到路由上，不改权限矩阵、不新增迁移（C6-4-0 裁定 Q5：补齐"手工建品"两道门）。
 *
 * 命名与用法对齐 shared/library-permission-codes.ts（C6-4-1 先例）：
 * 路由侧只引用常量，权限判定仍走 middleware/rbac-auth.requirePermission。
 */
export const PERM_GOODS_CREATE = "goods:create";
