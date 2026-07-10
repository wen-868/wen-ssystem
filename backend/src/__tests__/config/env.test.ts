import { describe, it, expect } from "vitest";
import { env } from "../../config/env.js";

describe("config/env", () => {
  it("应读取端口号", () => {
    expect(env.PORT).toBe(8080);
  });
  it("应读取运行环境", () => {
    expect(typeof env.NODE_ENV).toBe("string");
  });
  it("应读取JWT密钥", () => {
    expect(env.JWT_SECRET).toBe("test-secret-key-for-vitest");
  });
  it("应有默认数据库主机", () => {
    expect(env.DB_HOST).toBe("127.0.0.1");
  });
  it("应有默认数据库端口", () => {
    expect(env.DB_PORT).toBe(3306);
  });
  it("应有默认数据库用户名", () => {
    expect(env.DB_USER).toBe("zhixiang_app");
  });
  it("应有默认数据库名称", () => {
    expect(env.DB_NAME).toBe("liquor_inventory");
  });
  it("应在测试环境启用Mock数据库", () => {
    expect(env.USE_MOCK_DB).toBe(true);
  });
  it("应有默认Redis配置", () => {
    expect(env.REDIS_HOST).toBe("127.0.0.1");
    expect(env.REDIS_PORT).toBe(6379);
  });
  it("应有默认域名配置", () => {
    expect(env.DOMAIN).toBe("onepan.cn");
    expect(env.API_DOMAIN).toBe("api.onepan.cn");
    expect(env.ADMIN_DOMAIN).toBe("admin.onepan.cn");
    expect(env.MERCHANT_DOMAIN).toBe("m.onepan.cn");
    expect(env.STORE_DOMAIN).toBe("store.onepan.cn");
  });
  it("应有微信相关配置字段", () => {
    expect(typeof env.WECHAT_APP_ID).toBe("string");
    expect(typeof env.WECHAT_MCH_ID).toBe("string");
    expect(typeof env.WECHAT_PAY_API_V3_KEY).toBe("string");
  });
  it("应有兼容别名配置", () => {
    expect(typeof env.WX_APPID).toBe("string");
    expect(typeof env.WX_APP_SECRET).toBe("string");
    expect(typeof env.WX_MCH_ID).toBe("string");
    expect(typeof env.WX_API_KEY).toBe("string");
  });
  it("应有腾讯云AppID", () => {
    expect(env.TENCENT_CLOUD_APPID).toBe("1442871774");
  });
  it("应有即时零售Mock开关", () => {
    expect(typeof env.INSTANT_RETAIL_MOCK).toBe("string");
  });
});
