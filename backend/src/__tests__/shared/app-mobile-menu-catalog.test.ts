/**
 * S3-143：app-mobile 25 个页面菜单码——代码常量 + 启动幂等自愈 单测
 *
 * 四类断言（对应派单卡 §三②）：
 *  ① 新码写入（菜单行 + 角色映射）
 *  ② 幂等（连续两次：第二次 0 变更）
 *  ③ 角色映射等价（逐码角色集合 = 持有该前缀的角色集合；超管不加行）
 *  ④ 既有 64 码与既有绑定零改动（且全程无 UPDATE/DELETE/REPLACE）
 *
 * 夹具 = **生产真值**（`D:\Users\ZXQL\verify\s3136-prod-matrix.txt`，凌舟 2026-09-29 只读实测）：
 * 64 个菜单码 + 12 个角色 + 328 条绑定，逐字转写为下面的常量（不手写、不臆造）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeMenu {
  id: number;
  menuCode: string;
  parentId: number | null;
  name: string;
  path: string;
  sortNo: number;
  tenant: string;
}

interface FakeBinding {
  roleId: number;
  menuId: number;
  tenant: string;
}

const fake = vi.hoisted(() => {
  const db = {
    menus: [] as FakeMenu[],
    bindings: [] as FakeBinding[],
    nextId: 1,
    /** 本次用例内实际下发过的语句（用于证明"没有 UPDATE/DELETE/REPLACE"） */
    statements: [] as string[],
  };
  return { db };
});

vi.mock("../../shared/db", () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    fake.db.statements.push(sql);
    const tenant = String(params[0]);
    if (sql.includes("t_sys_role_menu")) {
      return fake.db.bindings
        .filter((b) => b.tenant === tenant)
        .map((b) => ({
          roleId: b.roleId,
          menuCode: fake.db.menus.find((m) => m.id === b.menuId)?.menuCode ?? "",
        }));
    }
    return fake.db.menus
      .filter((m) => m.tenant === tenant)
      .map((m) => ({ id: m.id, menuCode: m.menuCode }));
  }),
  transaction: vi.fn(async (runner: (conn: unknown) => Promise<unknown>) => runner({})),
  connExecute: vi.fn(async (_conn: unknown, sql: string, params: unknown[] = []) => {
    fake.db.statements.push(sql);
    if (sql.includes("INSERT IGNORE INTO t_sys_menu")) {
      const [parentId, code, name, path, sortNo, tenant] = params as [
        number,
        string,
        string,
        string,
        number,
        string,
      ];
      const dup = fake.db.menus.some((m) => m.menuCode === code && m.tenant === tenant);
      if (dup) return [{ affectedRows: 0, insertId: 0 }];
      const id = fake.db.nextId++;
      fake.db.menus.push({ id, menuCode: code, parentId, name, path, sortNo, tenant });
      return [{ affectedRows: 1, insertId: id }];
    }
    if (sql.includes("INSERT IGNORE INTO t_sys_role_menu")) {
      const [tenant, roleId, menuId] = params as [string, number, number];
      const dup = fake.db.bindings.some((b) => b.roleId === roleId && b.menuId === menuId);
      if (dup) return [{ affectedRows: 0, insertId: 0 }];
      fake.db.bindings.push({ roleId, menuId, tenant });
      return [{ affectedRows: 1, insertId: fake.db.bindings.length }];
    }
    throw new Error(`未预料的语句: ${sql}`);
  }),
}));

import type { MenuRowIdentity, RoleMenuRowIdentity } from "../../shared/app-mobile-menu-catalog";
import {
  APP_MOBILE_MENU_CATALOG,
  APP_MOBILE_MENU_CODES,
  APP_MOBILE_MENU_PREFIXES,
  ensureAppMobileMenus,
  menuPrefixOf,
  planAppMobileMenuSelfHeal,
} from "../../shared/app-mobile-menu-catalog";

/* ------------------------------------------------------------------ *
 * 生产真值夹具（逐字转写自 s3136-prod-matrix.txt：64 码 / 12 角色 / 328 绑定）
 * ------------------------------------------------------------------ */
const PROD_MENU_CODES: string[] = [
  "customer", "customer:credit", "customer:list", "customer:payment",
  "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
  "finance", "finance:payment", "finance:receipt", "finance:receivable",
  "finance:report", "finance:statement", "goods", "goods:batch",
  "goods:category", "goods:inventory", "goods:ledger", "goods:list",
  "goods:price", "goods:price-level", "marketing", "marketing:coupon",
  "marketing:flash-sale", "marketing:full-reduction", "marketing:group-buy", "marketing:points",
  "purchase", "purchase:inbound", "purchase:order", "purchase:payment",
  "purchase:return", "purchase:supplier", "report", "report:customer",
  "report:finance", "report:product", "report:sales", "report:staff",
  "sale", "sale:bill", "sale:cart", "sale:miniapp",
  "sale:record", "sale:return", "store", "store:control",
  "store:list", "store:stock-check", "store:transfer", "system",
  "system:approval", "system:audit", "system:config", "system:role",
  "system:subscription", "system:tenant", "system:user", "trace",
  "trace:code", "trace:config", "trace:recall", "trace:scan",
];

const PROD_ROLE_MENUS: Record<string, string[]> = {
  CUSTOMER_SERVICE: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "sale", "sale:bill",
    "sale:cart", "sale:miniapp", "sale:record", "sale:return",
  ],
  FINANCE_STAFF: [
    "finance", "finance:payment", "finance:receipt", "finance:receivable",
    "finance:report", "finance:statement", "report", "report:customer",
    "report:finance", "report:product", "report:sales", "report:staff",
  ],
  OPERATION_ADMIN: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
    "finance", "finance:payment", "finance:receipt", "finance:receivable",
    "finance:report", "finance:statement", "goods", "goods:batch",
    "goods:category", "goods:inventory", "goods:ledger", "goods:list",
    "goods:price", "goods:price-level", "marketing", "marketing:coupon",
    "marketing:flash-sale", "marketing:full-reduction", "marketing:group-buy", "marketing:points",
    "purchase", "purchase:inbound", "purchase:order", "purchase:payment",
    "purchase:return", "purchase:supplier", "report", "report:customer",
    "report:finance", "report:product", "report:sales", "report:staff",
    "sale", "sale:bill", "sale:cart", "sale:miniapp",
    "sale:record", "sale:return", "store", "store:control",
    "store:list", "store:stock-check", "store:transfer", "system",
    "system:approval", "system:audit", "system:config", "system:role",
    "system:subscription", "system:tenant", "system:user", "trace",
    "trace:code", "trace:config", "trace:recall", "trace:scan",
  ],
  PURCHASE_STAFF: [
    "goods", "goods:batch", "goods:category", "goods:inventory",
    "goods:ledger", "goods:list", "goods:price", "goods:price-level",
    "purchase", "purchase:inbound", "purchase:order", "purchase:payment",
    "purchase:return", "purchase:supplier",
  ],
  READONLY: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
    "finance", "finance:payment", "finance:receipt", "finance:receivable",
    "finance:report", "finance:statement", "goods", "goods:batch",
    "goods:category", "goods:inventory", "goods:ledger", "goods:list",
    "goods:price", "goods:price-level", "marketing", "marketing:coupon",
    "marketing:flash-sale", "marketing:full-reduction", "marketing:group-buy", "marketing:points",
    "purchase", "purchase:inbound", "purchase:order", "purchase:payment",
    "purchase:return", "purchase:supplier", "report", "report:customer",
    "report:finance", "report:product", "report:sales", "report:staff",
    "sale", "sale:bill", "sale:cart", "sale:miniapp",
    "sale:record", "sale:return", "store", "store:control",
    "store:list", "store:stock-check", "store:transfer", "system",
    "system:approval", "system:audit", "system:config", "system:role",
    "system:subscription", "system:tenant", "system:user", "trace",
    "trace:code", "trace:config", "trace:recall", "trace:scan",
  ],
  SALES_STAFF: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
    "sale", "sale:bill", "sale:cart", "sale:miniapp",
    "sale:record", "sale:return",
  ],
  SALESMAN: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "sale", "sale:bill",
    "sale:cart", "sale:miniapp", "sale:record", "sale:return",
  ],
  STORE_ADMIN: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
    "finance", "finance:payment", "finance:receipt", "finance:receivable",
    "finance:report", "finance:statement", "goods", "goods:batch",
    "goods:category", "goods:inventory", "goods:ledger", "goods:list",
    "goods:price", "goods:price-level", "marketing", "marketing:coupon",
    "marketing:flash-sale", "marketing:full-reduction", "marketing:group-buy", "marketing:points",
    "purchase", "purchase:inbound", "purchase:order", "purchase:payment",
    "purchase:return", "purchase:supplier", "report", "report:customer",
    "report:finance", "report:product", "report:sales", "report:staff",
    "sale", "sale:bill", "sale:cart", "sale:miniapp",
    "sale:record", "sale:return", "store", "store:control",
    "store:list", "store:stock-check", "store:transfer", "system",
    "system:approval", "system:audit", "system:config", "system:role",
    "system:subscription", "system:tenant", "system:user", "trace",
    "trace:code", "trace:config", "trace:recall", "trace:scan",
  ],
  STORE_MANAGER: [
    "customer", "customer:credit", "customer:list", "customer:payment",
    "customer:statement", "customer:visit", "dashboard", "dashboard:workbench",
    "goods", "goods:batch", "goods:category", "goods:inventory",
    "goods:ledger", "goods:list", "goods:price", "goods:price-level",
    "report", "report:customer", "report:finance", "report:product",
    "report:sales", "report:staff", "sale", "sale:bill",
    "sale:cart", "sale:miniapp", "sale:record", "sale:return",
    "store", "store:control", "store:list", "store:stock-check",
    "store:transfer",
  ],
  STORE_OPERATOR: [
    "dashboard", "dashboard:workbench", "goods", "goods:batch",
    "goods:category", "goods:inventory", "goods:ledger", "goods:list",
    "goods:price", "goods:price-level", "sale", "sale:bill",
    "sale:cart", "sale:miniapp", "sale:record", "sale:return",
    "store", "store:control", "store:list", "store:stock-check",
    "store:transfer",
  ],
  SUPER_ADMIN: [],
  WAREHOUSE_STAFF: [
    "goods", "goods:batch", "goods:category", "goods:inventory",
    "goods:ledger", "goods:list", "goods:price", "goods:price-level",
    "store", "store:control", "store:list", "store:stock-check",
    "store:transfer", "trace", "trace:code", "trace:config",
    "trace:recall", "trace:scan",
  ],
};

const PROD_ROLE_IDS: Record<string, number> = {
  SUPER_ADMIN: 1,
  STORE_MANAGER: 2,
  SALES_STAFF: 3,
  PURCHASE_STAFF: 4,
  WAREHOUSE_STAFF: 5,
  FINANCE_STAFF: 6,
  CUSTOMER_SERVICE: 7,
  READONLY: 8,
  OPERATION_ADMIN: 9,
  STORE_ADMIN: 10,
  STORE_OPERATOR: 11,
  SALESMAN: 12,
};

/** 把生产真值灌进假库（等价于"生产同形库"：64 菜单 / 12 角色 / 328 绑定） */
function seedProdShape(): void {
  fake.db.menus = [];
  fake.db.bindings = [];
  fake.db.nextId = 1;
  fake.db.statements = [];
  const idByCode = new Map<string, number>();
  for (const code of PROD_MENU_CODES) {
    const id = fake.db.nextId++;
    idByCode.set(code, id);
    const prefix = menuPrefixOf(code);
    fake.db.menus.push({
      id,
      menuCode: code,
      parentId: code.includes(":") ? idByCode.get(prefix) ?? null : null,
      name: code,
      path: `/${code.replace(":", "/")}`,
      sortNo: id,
      tenant: "default",
    });
  }
  for (const [roleCode, codes] of Object.entries(PROD_ROLE_MENUS)) {
    const roleId = PROD_ROLE_IDS[roleCode];
    for (const code of codes) {
      fake.db.bindings.push({ roleId, menuId: idByCode.get(code)!, tenant: "default" });
    }
  }
}

/** 从假库现算"持有前缀 X 的角色集合"（等价规则的判据侧，独立于被测代码） */
function holderRolesFromFakeDb(prefix: string): number[] {
  const roles = new Set<number>();
  for (const b of fake.db.bindings) {
    const code = fake.db.menus.find((m) => m.id === b.menuId)?.menuCode ?? "";
    if (code === prefix || code.startsWith(`${prefix}:`)) roles.add(b.roleId);
  }
  return [...roles].sort((a, b) => a - b);
}

/** 某个码在假库里的角色集合 */
function roleIdsOfCode(code: string): number[] {
  const menuId = fake.db.menus.find((m) => m.menuCode === code)?.id;
  return [...new Set(fake.db.bindings.filter((b) => b.menuId === menuId).map((b) => b.roleId))].sort(
    (a, b) => a - b
  );
}

/** 判据：全程只允许 SELECT / INSERT IGNORE（不得 UPDATE / DELETE / REPLACE 存量） */
function assertOnlySelectAndInsert(): void {
  for (const sql of fake.db.statements) {
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|REPLACE)/i);
  }
}

beforeEach(() => {
  seedProdShape();
});

describe("app-mobile 25 码：代码常量", () => {
  it("常量就是 25 个码 / 7 个前缀，且与 186 迁移逐条同值（抽查排序与显示名）", () => {
    expect(APP_MOBILE_MENU_CATALOG).toHaveLength(25);
    expect(APP_MOBILE_MENU_CODES).toHaveLength(25);
    expect(APP_MOBILE_MENU_PREFIXES).toEqual([
      "customer",
      "finance",
      "goods",
      "marketing",
      "report",
      "store",
      "system",
    ]);
    expect(APP_MOBILE_MENU_CATALOG.map((e) => e.sortNo)).toEqual(
      Array.from({ length: 25 }, (_, i) => 61 + i)
    );
    expect(APP_MOBILE_MENU_CATALOG[0]).toEqual({
      code: "customer:address",
      parent: "customer",
      name: "收货地址",
      path: "/customer/address",
      sortNo: 61,
    });
    expect(APP_MOBILE_MENU_CATALOG[24]).toEqual({
      code: "system:print",
      parent: "system",
      name: "单据打印",
      path: "/system/print",
      sortNo: 85,
    });
    // 25 个码一个都不是既有 64 码（否则就会动到存量）
    for (const code of APP_MOBILE_MENU_CODES) {
      expect(PROD_MENU_CODES).not.toContain(code);
    }
  });
});

describe("app-mobile 25 码：启动幂等自愈（生产同形库）", () => {
  it("① 新码写入：64 → 89 菜单、328 → 452 绑定（+25 / +124）", async () => {
    const before = {
      menus: fake.db.menus.length,
      bindings: fake.db.bindings.length,
    };
    expect(before).toEqual({ menus: 64, bindings: 328 });

    const result = await ensureAppMobileMenus();

    expect(result.applied).toBe(true);
    expect(result.existingMenuCount).toBe(64);
    expect(result.insertedMenus).toBe(25);
    expect(result.insertedBindings).toBe(124);
    expect(fake.db.menus).toHaveLength(89);
    expect(fake.db.bindings).toHaveLength(452);

    // 逐码落位正确：parent_id 指向前缀 CATALOG 行、menu_name/path/sort_no 与常量一致
    for (const entry of APP_MOBILE_MENU_CATALOG) {
      const row = fake.db.menus.find((m) => m.menuCode === entry.code);
      expect(row, entry.code).toBeTruthy();
      const parent = fake.db.menus.find((m) => m.menuCode === entry.parent);
      expect(row!.parentId).toBe(parent!.id);
      expect(row!.name).toBe(entry.name);
      expect(row!.path).toBe(entry.path);
      expect(row!.sortNo).toBe(entry.sortNo);
    }
    // 无重复 menu_code
    expect(new Set(fake.db.menus.map((m) => m.menuCode)).size).toBe(89);
  });

  it("② 幂等：连续两次启动，第二次 0 变更、库内计数不变", async () => {
    const first = await ensureAppMobileMenus();
    const afterFirst = {
      menus: fake.db.menus.length,
      bindings: fake.db.bindings.length,
    };
    const statementsAfterFirst = fake.db.statements.length;

    const second = await ensureAppMobileMenus();

    expect(first.insertedMenus).toBe(25);
    expect(second.insertedMenus).toBe(0);
    expect(second.insertedBindings).toBe(0);
    expect(afterFirst).toEqual({ menus: 89, bindings: 452 });
    expect({ menus: fake.db.menus.length, bindings: fake.db.bindings.length }).toEqual(afterFirst);
    // 第二次只发生 2 次读、0 次写
    expect(fake.db.statements.length - statementsAfterFirst).toBe(2);
  });

  it("③ 角色映射等价：逐码角色集合 = 持有该前缀的角色集合（不多不少）", async () => {
    const expectedByPrefix: Record<string, number> = {
      customer: 7,
      finance: 4,
      goods: 7,
      marketing: 3,
      report: 5,
      store: 6,
      system: 3,
    };

    await ensureAppMobileMenus();

    for (const entry of APP_MOBILE_MENU_CATALOG) {
      const actual = roleIdsOfCode(entry.code);
      const expected = holderRolesFromFakeDb(entry.parent);
      expect(actual, `${entry.code} 角色集合`).toEqual(expected);
      expect(actual.length, `${entry.code} 角色数`).toBe(expectedByPrefix[entry.parent]);
    }

    // SUPER_ADMIN（生产 0 行，代码旁路）不得被补行
    const superAdminId = PROD_ROLE_IDS.SUPER_ADMIN;
    const superAdminBindings = fake.db.bindings.filter((b) => b.roleId === superAdminId);
    expect(superAdminBindings).toHaveLength(0);

    // 未持有该前缀的角色不得多拿：STORE_OPERATOR 不持 finance ⇒ 不得有 finance 新码
    const financeCodes = APP_MOBILE_MENU_CATALOG.filter((e) => e.parent === "finance").map((e) => e.code);
    for (const code of financeCodes) {
      expect(roleIdsOfCode(code)).not.toContain(PROD_ROLE_IDS.STORE_OPERATOR);
    }
  });

  it("④ 既有 64 码与既有 328 绑定零改动，且全程无 UPDATE/DELETE/REPLACE", async () => {
    const menusBefore = JSON.stringify([...fake.db.menus].sort((a, b) => a.id - b.id));
    const bindingsBefore = JSON.stringify(
      [...fake.db.bindings].sort((a, b) => a.menuId - b.menuId || a.roleId - b.roleId)
    );

    await ensureAppMobileMenus();

    const existingMenusAfter = fake.db.menus.filter((m) => PROD_MENU_CODES.includes(m.menuCode));
    expect(JSON.stringify([...existingMenusAfter].sort((a, b) => a.id - b.id))).toBe(menusBefore);

    const prodMenuIds = new Set(fake.db.menus.filter((m) => PROD_MENU_CODES.includes(m.menuCode)).map((m) => m.id));
    const existingBindingsAfter = fake.db.bindings.filter((b) => prodMenuIds.has(b.menuId));
    expect(
      JSON.stringify([...existingBindingsAfter].sort((a, b) => a.menuId - b.menuId || a.roleId - b.roleId))
    ).toBe(bindingsBefore);

    assertOnlySelectAndInsert();
  });

  it("边界：全新空库（父码不存在）⇒ 25 个码全部跳过、不产生孤儿行、不报错", async () => {
    fake.db.menus = [];
    fake.db.bindings = [];
    fake.db.statements = [];

    const result = await ensureAppMobileMenus();

    expect(result.applied).toBe(true);
    expect(result.insertedMenus).toBe(0);
    expect(result.insertedBindings).toBe(0);
    expect(result.skippedCodes).toEqual(APP_MOBILE_MENU_CODES);
    expect(fake.db.menus).toHaveLength(0);
    expect(fake.db.statements).toHaveLength(2); // 只读了两次，零写入
  });

  it("边界：父码在、但库内无任何角色绑定 ⇒ 只补 25 条菜单、0 条映射", async () => {
    fake.db.bindings = [];

    const result = await ensureAppMobileMenus();

    expect(result.insertedMenus).toBe(25);
    expect(result.insertedBindings).toBe(0);
    expect(fake.db.menus).toHaveLength(89);
    expect(fake.db.bindings).toHaveLength(0);
  });
});

describe("planAppMobileMenuSelfHeal（纯函数）", () => {
  it("只对缺失项出计划：已齐备时计划为空（幂等的计算侧证据）", () => {
    const menuRows: MenuRowIdentity[] = [
      ...PROD_MENU_CODES.map((code, i) => ({ id: i + 1, menuCode: code })),
      ...APP_MOBILE_MENU_CATALOG.map((e, i) => ({ id: 100 + i, menuCode: e.code })),
    ];
    const idByCode = new Map(menuRows.map((r) => [r.menuCode, r.id]));
    const bindingRows: RoleMenuRowIdentity[] = [];
    for (const entry of APP_MOBILE_MENU_CATALOG) {
      for (const [roleCode, codes] of Object.entries(PROD_ROLE_MENUS)) {
        if (codes.some((c) => c === entry.parent || c.startsWith(`${entry.parent}:`))) {
          bindingRows.push({ roleId: PROD_ROLE_IDS[roleCode], menuCode: entry.code });
        }
      }
    }
    expect(idByCode.size).toBe(89);

    const plan = planAppMobileMenuSelfHeal({ menuRows, bindingRows });

    expect(plan.menusToInsert).toEqual([]);
    expect(plan.bindingsToInsert).toEqual([]);
    expect(plan.skippedCodes).toEqual([]);
  });

  it("menuPrefixOf 取冒号前前缀，无冒号时返回自身", () => {
    expect(menuPrefixOf("customer:address")).toBe("customer");
    expect(menuPrefixOf("customer")).toBe("customer");
    expect(menuPrefixOf("system:operation-log")).toBe("system");
  });
});
