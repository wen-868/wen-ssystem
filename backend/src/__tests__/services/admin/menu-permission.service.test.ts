import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  getRoleMenuCodes,
  getUserMenus,
  getDataPermissions,
  getFieldPermissions,
} from "../../../services/admin/menu-permission.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("menu-permission.service - 菜单与权限", () => {
  it("getRoleMenuCodes 返回菜单编码列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ menuCode: "dashboard" }, { menuCode: "sale" }]);
    const codes = await getRoleMenuCodes(1, tenantId);
    expect(codes).toEqual(["dashboard", "sale"]);
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([1]);
  });

  it("getUserMenus 无角色返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const menus = await getUserMenus(9, tenantId);
    expect(menus).toEqual([]);
  });

  it("getUserMenus 超级管理员返回全部菜单", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 1, roleCode: "SUPER_ADMIN" }])
      .mockResolvedValueOnce([
        { id: 1, parentId: null, menuName: "工作台", menuCode: "dashboard", menuType: "MENU", path: "/dashboard", icon: "", sortNo: 1, status: 1 },
        { id: 2, parentId: 1, menuName: "销售", menuCode: "sale", menuType: "MENU", path: "/sale", icon: "", sortNo: 2, status: 1 },
      ]);
    const menus = await getUserMenus(9, tenantId);
    expect(menus).toHaveLength(1); // 构建成树：根 1 个
    expect(menus[0].menuCode).toBe("dashboard");
    const allMenuCall = mocks.queryWithTenant.mock.calls[1][0];
    expect(String(allMenuCall)).toContain("FROM t_sys_menu");
    expect(String(allMenuCall)).not.toContain("t_sys_role_menu");
  });

  it("getUserMenus 普通角色按角色过滤菜单", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ roleId: 3, roleCode: "STORE_MANAGER" }])
      .mockResolvedValueOnce([
        { id: 5, parentId: null, menuName: "收银", menuCode: "cashier", menuType: "MENU", path: "/cashier", icon: "", sortNo: 1, status: 1 },
      ]);
    const menus = await getUserMenus(9, tenantId);
    expect(menus).toHaveLength(1);
    const roleMenuCall = mocks.queryWithTenant.mock.calls[1][0];
    expect(String(roleMenuCall)).toContain("t_sys_role_menu");
    expect(mocks.queryWithTenant.mock.calls[1][1]).toEqual([3]);
  });

  it("getDataPermissions 返回角色数据权限", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ roleId: 1, tableName: "t_sale_bill", fieldName: "store_id", filterType: "IN", filterValue: "1,2" }]);
    const perms = await getDataPermissions(1, tenantId);
    expect(perms).toHaveLength(1);
    expect(perms[0].tableName).toBe("t_sale_bill");
  });

  it("getFieldPermissions 返回角色字段权限", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ roleId: 1, tableName: "t_sale_bill", fieldName: "cost_price", accessType: "HIDDEN" }]);
    const perms = await getFieldPermissions(1, tenantId);
    expect(perms).toHaveLength(1);
    expect(perms[0].fieldName).toBe("cost_price");
  });
});
