process.env.USE_MOCK_DB = "true";

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";
import fs from "node:fs";
import path from "node:path";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18769";
let server: http.Server;

function api(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = base + path;
    const req = http.request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data || "{}") });
        } catch {
          resolve({ status: res.statusCode || 0, data: null });
        }
      });
    });
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

beforeAll(async () => {
  server = http.createServer(app).listen(18769);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

const miniappPath = "/workspace/miniapp";

describe("S106 - 小程序模板测试", () => {
  describe("小程序页面功能测试", () => {
    it("小程序页面配置完整 - app.json", () => {
      const appJsonPath = path.join(miniappPath, "app.json");
      expect(fs.existsSync(appJsonPath)).toBe(true);
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
      expect(appJson.pages).toBeDefined();
      expect(Array.isArray(appJson.pages)).toBe(true);
      expect(appJson.pages.length).toBeGreaterThanOrEqual(5);
      expect(appJson.tabBar).toBeDefined();
      expect(appJson.window).toBeDefined();
    });

    it("首页存在且结构完整", () => {
      const homePage = path.join(miniappPath, "pages/home");
      expect(fs.existsSync(path.join(homePage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(homePage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(homePage, "index.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(homePage, "index.json"))).toBe(true);
    });

    it("订单列表页存在且结构完整", () => {
      const orderPage = path.join(miniappPath, "pages/order");
      expect(fs.existsSync(path.join(orderPage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(orderPage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(orderPage, "index.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(orderPage, "index.json"))).toBe(true);
    });

    it("订单详情页存在且结构完整", () => {
      const detailPage = path.join(miniappPath, "pages/order-detail");
      expect(fs.existsSync(path.join(detailPage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(detailPage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(detailPage, "index.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(detailPage, "index.json"))).toBe(true);
    });

    it("个人中心页存在且结构完整", () => {
      const profilePage = path.join(miniappPath, "pages/profile");
      expect(fs.existsSync(path.join(profilePage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(profilePage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(profilePage, "index.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(profilePage, "index.json"))).toBe(true);
    });

    it("支付结果页存在且结构完整", () => {
      const payResultPage = path.join(miniappPath, "pages/payment-result");
      expect(fs.existsSync(path.join(payResultPage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(payResultPage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(payResultPage, "index.json"))).toBe(true);
    });

    it("分享收款页存在且结构完整", () => {
      const sharePage = path.join(miniappPath, "pages/share-collection");
      expect(fs.existsSync(path.join(sharePage, "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(sharePage, "index.wxml"))).toBe(true);
      expect(fs.existsSync(path.join(sharePage, "index.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(sharePage, "index.json"))).toBe(true);
    });

    it("全局样式和配置文件存在", () => {
      expect(fs.existsSync(path.join(miniappPath, "app.js"))).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "app.wxss"))).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "project.config.json"))).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "styles/tokens.wxss"))).toBe(true);
    });
  });

  describe("小程序 API 对接验证", () => {
    it("小程序登录接口可用", async () => {
      const r = await api("POST", "/api/miniapp/login", { code: "test-code" });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.token).toBeDefined();
      expect(r.data.data.memberId).toBeDefined();
      expect(r.data.data.customerType).toBeDefined();
    });

    it("小程序用户资料接口可用", async () => {
      const r = await api("GET", "/api/miniapp/profile", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.memberId).toBeDefined();
      expect(r.data.data.nickname).toBeDefined();
    });

    it("小程序商品列表接口可用", async () => {
      const r = await api("GET", "/api/miniapp/products?storeId=1", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(Array.isArray(r.data.data)).toBe(true);
    });

    it("小程序商品列表 - 零售客户返回零售价", async () => {
      const r = await api("GET", "/api/miniapp/products?storeId=1", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      if (r.data.data.length > 0) {
        expect(r.data.data[0].retailPrice).toBeDefined();
        expect(r.data.data[0].priceType).toBe("RETAIL");
      }
    });

    it("小程序订单创建接口可用", async () => {
      const r = await api("POST", "/api/miniapp/orders", {
        storeId: 1,
        fulfillmentType: "DELIVERY",
        receiverName: "测试用户",
        receiverMobile: "13800138000",
        receiverAddress: "测试地址",
        items: [
          { skuId: 1, qty: 2 }
        ]
      }, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.orderNo).toBeDefined();
      expect(r.data.data.orderStatus).toBeDefined();
      expect(r.data.data.payStatus).toBeDefined();
    });

    it("小程序订单列表接口可用", async () => {
      const r = await api("GET", "/api/miniapp/orders?page=1&pageSize=20", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.records).toBeDefined();
      expect(Array.isArray(r.data.data.records)).toBe(true);
    });

    it("小程序订单详情接口可用", async () => {
      const createResult = await api("POST", "/api/miniapp/orders", {
        storeId: 1,
        fulfillmentType: "PICKUP",
        items: [
          { skuId: 1, qty: 1 }
        ]
      }, {
        "x-customer-type": "RETAIL"
      });
      const orderNo = createResult.data.data.orderNo;

      const r = await api("GET", `/api/miniapp/orders/${orderNo}`, undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.orderNo).toBe(orderNo);
      expect(r.data.data.items).toBeDefined();
      expect(Array.isArray(r.data.data.items)).toBe(true);
    });
  });

  describe("配置替换后发布流程验证", () => {
    it("app.js 中包含 API 基础地址配置", () => {
      const appJsPath = path.join(miniappPath, "app.js");
      const content = fs.readFileSync(appJsPath, "utf-8");
      expect(content).toContain("apiBase");
      expect(content).toContain("demoMode");
    });

    it("小程序支持演示模式切换", () => {
      const appJsPath = path.join(miniappPath, "app.js");
      const content = fs.readFileSync(appJsPath, "utf-8");
      expect(content).toContain("demoMode");
      expect(content).toContain("true");
    });

    it("项目配置文件存在且有效", () => {
      const configPath = path.join(miniappPath, "project.config.json");
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      expect(config).toBeDefined();
    });

    it("示例配置文件存在", () => {
      const betaConfigPath = path.join(miniappPath, "app.config.beta.example.js");
      expect(fs.existsSync(betaConfigPath)).toBe(true);
    });

    it("首页代码包含 API 请求逻辑", () => {
      const homeJsPath = path.join(miniappPath, "pages/home/index.js");
      const content = fs.readFileSync(homeJsPath, "utf-8");
      expect(content).toContain("wx.request");
      expect(content).toContain("miniapp/products");
    });

    it("订单页代码包含 API 请求逻辑", () => {
      const orderJsPath = path.join(miniappPath, "pages/order/index.js");
      const content = fs.readFileSync(orderJsPath, "utf-8");
      expect(content).toContain("wx.request");
      expect(content).toContain("miniapp/orders");
    });

    it("小程序 tabBar 配置正确", () => {
      const appJsonPath = path.join(miniappPath, "app.json");
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
      expect(appJson.tabBar.list.length).toBe(3);
      expect(appJson.tabBar.list[0].pagePath).toContain("home");
      expect(appJson.tabBar.list[1].pagePath).toContain("order");
      expect(appJson.tabBar.list[2].pagePath).toContain("profile");
    });
  });
});
