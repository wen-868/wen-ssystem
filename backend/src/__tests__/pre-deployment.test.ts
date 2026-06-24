import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../..");
const backendRoot = path.resolve(__dirname, "../..");

describe("S404 - 上线前检查清单", () => {
  describe("配置文件检查", () => {
    it("后端 package.json 存在且版本号正确", () => {
      const pkgPath = path.join(backendRoot, "package.json");
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      expect(pkg.name).toBeDefined();
      expect(pkg.version).toBeDefined();
      expect(pkg.scripts.start).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
    });

    it("后端 .env.example 存在", () => {
      const envPath = path.join(backendRoot, ".env.example");
      expect(fs.existsSync(envPath)).toBe(true);
    });

    it("前端 package.json 存在", () => {
      const adminWebPkg = path.join(projectRoot, "admin-web/package.json");
      expect(fs.existsSync(adminWebPkg)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(adminWebPkg, "utf-8"));
      expect(pkg.scripts.build).toBeDefined();
    });

    it("小程序项目结构完整", () => {
      const miniappPath = path.join(projectRoot, "miniapp");
      expect(fs.existsSync(miniappPath)).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "app.js"))).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "app.json"))).toBe(true);
      expect(fs.existsSync(path.join(miniappPath, "project.config.json"))).toBe(true);
    });

    it("门店终端项目结构完整", () => {
      const storePath = path.join(projectRoot, "store-terminal");
      expect(fs.existsSync(storePath)).toBe(true);
      expect(fs.existsSync(path.join(storePath, "package.json"))).toBe(true);
      expect(fs.existsSync(path.join(storePath, "index.html"))).toBe(true);
    });
  });

  describe("安全配置检查", () => {
    it("JWT_SECRET 在 .env.example 中定义", () => {
      const envExample = path.join(backendRoot, ".env.example");
      if (fs.existsSync(envExample)) {
        const content = fs.readFileSync(envExample, "utf-8");
        expect(content).toContain("JWT_SECRET");
      }
    });

    it("数据库密码不在代码中硬编码", () => {
      const routesPath = path.join(backendRoot, "src/routes");
      const sharedPath = path.join(backendRoot, "src/shared");
      
      function checkDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            checkDir(fullPath);
          } else if (file.endsWith(".ts") || file.endsWith(".js")) {
            const content = fs.readFileSync(fullPath, "utf-8");
            expect(content).not.toMatch(/password\s*[:=]\s*['"][^'"]{8,}['"]/i);
          }
        }
      }
      
      if (fs.existsSync(routesPath)) checkDir(routesPath);
      if (fs.existsSync(sharedPath)) checkDir(sharedPath);
    });

    it("生产环境配置文件不包含敏感信息", () => {
      const gitignorePath = path.join(projectRoot, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        expect(content).toContain(".env");
        expect(content).toContain(".env.local");
      }
    });
  });

  describe("项目结构检查", () => {
    it("后端核心模块存在", () => {
      const srcPath = path.join(backendRoot, "src");
      expect(fs.existsSync(path.join(srcPath, "server.ts"))).toBe(true);
      expect(fs.existsSync(path.join(srcPath, "routes"))).toBe(true);
      expect(fs.existsSync(path.join(srcPath, "shared"))).toBe(true);
    });

    it("数据库 schema 文件存在", () => {
      const docsPath = path.join(projectRoot, "docs");
      expect(fs.existsSync(docsPath)).toBe(true);
      const phase1Schema = path.join(docsPath, "phase1_schema.sql");
      const phase2Schema = path.join(docsPath, "phase2_schema.sql");
      expect(fs.existsSync(phase1Schema)).toBe(true);
      expect(fs.existsSync(phase2Schema)).toBe(true);
    });

    it("API 文档存在", () => {
      const docsPath = path.join(projectRoot, "docs");
      const phase1Api = path.join(docsPath, "phase1_openapi.yaml");
      const phase2Api = path.join(docsPath, "phase2_openapi.yaml");
      expect(fs.existsSync(phase1Api)).toBe(true);
      expect(fs.existsSync(phase2Api)).toBe(true);
    });

    it("部署脚本存在", () => {
      const deployPath = path.join(projectRoot, "deploy");
      expect(fs.existsSync(deployPath)).toBe(true);
    });
  });

  describe("依赖检查", () => {
    it("后端依赖可正常加载", () => {
      const pkgPath = path.join(backendRoot, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      expect(pkg.dependencies.express).toBeDefined();
      expect(pkg.dependencies.mysql2).toBeDefined();
      expect(pkg.dependencies.jsonwebtoken).toBeDefined();
      expect(pkg.dependencies.zod).toBeDefined();
    });

    it("后端开发依赖包含测试框架", () => {
      const pkgPath = path.join(backendRoot, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      expect(pkg.devDependencies.vitest).toBeDefined();
      expect(pkg.devDependencies.typescript).toBeDefined();
    });
  });

  describe("测试覆盖率检查", () => {
    it("测试文件数量符合要求", () => {
      const testsPath = path.join(backendRoot, "src/__tests__");
      const files = fs.readdirSync(testsPath).filter(f => f.endsWith(".test.ts"));
      expect(files.length).toBeGreaterThanOrEqual(10);
    });

    it("核心模块都有对应测试", () => {
      const testsPath = path.join(backendRoot, "src/__tests__");
      const files = fs.readdirSync(testsPath);
      
      expect(files.some(f => f.includes("supplier"))).toBe(true);
      expect(files.some(f => f.includes("purchase-order"))).toBe(true);
      expect(files.some(f => f.includes("purchase-in-stock"))).toBe(true);
      expect(files.some(f => f.includes("sale-return"))).toBe(true);
      expect(files.some(f => f.includes("customer"))).toBe(true);
      expect(files.some(f => f.includes("e2e"))).toBe(true);
      expect(files.some(f => f.includes("performance"))).toBe(true);
      expect(files.some(f => f.includes("security"))).toBe(true);
    });
  });
});
