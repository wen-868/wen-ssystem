import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPackageStaging } from "../../../services/admin/miniapp-package-builder";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTemplateDist(): string {
  const dir = makeTempDir("tpl-dist-");
  fs.mkdirSync(path.join(dir, "pages", "index"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "app.json"),
    JSON.stringify(
      {
        pages: ["pages/index/index"],
        window: {
          navigationBarBackgroundColor: "#1e40af",
          navigationBarTitleText: "智享商城",
          navigationBarTextStyle: "white",
          backgroundColor: "#f5f5f5",
        },
        tabBar: {
          color: "#999999",
          selectedColor: "#1e40af",
          backgroundColor: "#ffffff",
          list: [],
        },
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "project.config.json"),
    JSON.stringify({ appid: "wx0000000000000000", projectname: "zhixiang-miniapp" }, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(dir, "pages", "index", "index.js"), "console.log('ok')", "utf8");
  return dir;
}

describe("buildPackageStaging", () => {
  it("应替换 project.config.json 的 appid", () => {
    const staging = buildPackageStaging({
      templateDistDir: makeTemplateDist(),
      appId: "wx1234567890abcdef",
      appName: "测试商城",
      styleConfig: { theme: "a", primaryColor: "#1e40af" },
    });
    tempDirs.push(staging);

    const projectConfig = JSON.parse(
      fs.readFileSync(path.join(staging, "project.config.json"), "utf8")
    );
    expect(projectConfig.appid).toBe("wx1234567890abcdef");
  });

  it("应替换 app.json 导航栏标题/背景色与 tabBar 选中色", () => {
    const staging = buildPackageStaging({
      templateDistDir: makeTemplateDist(),
      appId: "wx1234567890abcdef",
      appName: "臻品酒庄旗舰店",
      styleConfig: {
        theme: "b",
        primaryColor: "#9d1f33",
        gradientFrom: "#b91c1c",
        gradientTo: "#7f1d2d",
        backgroundColor: "#faf7f2",
        navBgColor: "#7f1d2d",
        navTextColor: "#ffffff",
        tabBarColor: "#8a8a8a",
        tabBarSelectedColor: "#9d1f33",
        tabBarBgColor: "#ffffff",
      },
    });
    tempDirs.push(staging);

    const appJson = JSON.parse(fs.readFileSync(path.join(staging, "app.json"), "utf8"));
    expect(appJson.window.navigationBarTitleText).toBe("臻品酒庄旗舰店");
    expect(appJson.window.navigationBarBackgroundColor).toBe("#7f1d2d");
    expect(appJson.window.backgroundColor).toBe("#faf7f2");
    expect(appJson.tabBar.selectedColor).toBe("#9d1f33");
    expect(appJson.tabBar.color).toBe("#8a8a8a");
    expect(appJson.tabBar.backgroundColor).toBe("#ffffff");
  });

  it("标题超长时应截断到 20 字", () => {
    const staging = buildPackageStaging({
      templateDistDir: makeTemplateDist(),
      appId: "wx1234567890abcdef",
      appName: "这是一个非常非常非常非常非常非常长的商城名称测试",
      styleConfig: { theme: "a" },
    });
    tempDirs.push(staging);

    const appJson = JSON.parse(fs.readFileSync(path.join(staging, "app.json"), "utf8"));
    expect(appJson.window.navigationBarTitleText.length).toBeLessThanOrEqual(20);
  });

  it("模板产物缺失时应抛出明确错误", () => {
    expect(() =>
      buildPackageStaging({
        templateDistDir: path.join(makeTempDir("tpl-empty-"), "not-exist"),
        appId: "wx1234567890abcdef",
        appName: "测试",
        styleConfig: { theme: "a" },
      })
    ).toThrow(/模板产物未构建/);
  });
});
