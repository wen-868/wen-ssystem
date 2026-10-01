/**
 * R101-C6-4-1：商品库调取（COPY）权限点常量（凌舟裁定 Q8 ①「代码常量 + 授权另行落」）
 *
 * 为什么单独成常量文件：本仓迁移写闸门默认 block（INSERT/UPDATE/DELETE 一律跳过），
 * 因此"角色授权"不能随迁移预置（预置写不进去，会制造"看起来配了实际没配"的假能力）。
 * 代码侧只负责把权限点**固定成常量**并挂到路由上；角色授权由凌舟在既有权
 * 权限矩阵能力（PUT /api/platform/roles/:id/permissions + AdminPermissions 页）上按
 * 立项草案 §5.3 的授权表在生产配置一次。
 *
 * 两个码的分工（读写分离，不可合并）：
 *   · library:view —— 检索/预览公共库 + 查看本租户调取流水（只读）
 *   · library:copy —— 执行调取（写：生成租户私有档案 + 写流水 + 扣商品配额）
 * 合并成一个码会破坏 READONLY 角色的既有语义：该角色权限为 ["*:view"]，
 * 按 rbac.service.matchPermission 规则 3（"*:<action>" 后缀匹配）会自动命中 library:view
 * 而**不**命中 library:copy —— 这正是"只读角色能看不能调取"的预期行为，无需改角色权限数组。
 */
export const PERM_LIBRARY_VIEW = "library:view";
export const PERM_LIBRARY_COPY = "library:copy";
