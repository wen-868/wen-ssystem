/**
 * 小程序代码包构建器（R96-02）
 *
 * 纯逻辑层（不依赖数据库）：
 *   1. 将预构建模板产物（miniapp/template-dist/{a,b,c}）复制到临时目录；
 *   2. 按租户配置替换：
 *      - project.config.json → appid
 *      - app.json → navigationBarTitleText / navigationBarBackgroundColor
 *        / backgroundColor + tabBar color / selectedColor / backgroundColor
 *   3. 返回临时目录路径，由调用方压缩为 zip 并落库。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 模板样式配置（对应 t_miniapp_template.style_config 解析后的对象） */
export interface TemplateStyleConfig {
  theme?: string;
  primaryColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  backgroundColor?: string;
  navBgColor?: string;
  navTextColor?: string;
  tabBarColor?: string;
  tabBarSelectedColor?: string;
  tabBarBgColor?: string;
  [key: string]: unknown;
}

export interface BuildPackageOptions {
  /** 模板产物目录（绝对路径），如 <repo>/miniapp/template-dist/a */
  templateDistDir: string;
  /** 小程序 AppID */
  appId: string;
  /** 小程序名称（写入导航栏标题，超长截断） */
  appName: string;
  /** 模板样式配置 */
  styleConfig: TemplateStyleConfig;
}

const NAV_TITLE_MAX_LEN = 20;

/** 递归复制目录 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (ent.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

/** 读取 JSON 文件（容错：解析失败返回 null） */
function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 写入 JSON 文件（保持缩进 2 空格） */
function writeJson(file: string, obj: Record<string, unknown>): void {
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

/** 截断微信小程序标题（导航栏标题建议不超过 20 字） */
function truncateTitle(name: string): string {
  return (name || "").trim().slice(0, NAV_TITLE_MAX_LEN);
}

/**
 * 构建代码包临时目录。
 * @returns 临时目录绝对路径（调用方负责压缩后清理）
 */
export function buildPackageStaging(opts: BuildPackageOptions): string {
  const { templateDistDir, appId, appName, styleConfig } = opts;

  if (!fs.existsSync(templateDistDir)) {
    throw new Error("模板产物未构建，请先在 miniapp 目录执行 npm run build:weapp:all");
  }
  if (!appId || !appId.trim()) {
    throw new Error("AppID 未配置，无法生成代码包");
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-pkg-"));
  copyDirRecursive(templateDistDir, staging);

  // 1. project.config.json → appid
  const projectConfigPath = path.join(staging, "project.config.json");
  const projectConfig = readJson(projectConfigPath) ?? {};
  projectConfig.appid = appId.trim();
  writeJson(projectConfigPath, projectConfig);

  // 2. app.json → 导航栏 + tabBar
  const appJsonPath = path.join(staging, "app.json");
  const appJson = readJson(appJsonPath) ?? {};
  const navBg = styleConfig.navBgColor || styleConfig.primaryColor || "#1e40af";
  const tabSelected = styleConfig.tabBarSelectedColor || styleConfig.primaryColor || "#1e40af";

  const windowConfig = (appJson.window as Record<string, unknown>) || {};
  windowConfig.navigationBarTitleText = truncateTitle(appName);
  windowConfig.navigationBarBackgroundColor = navBg;
  windowConfig.navigationBarTextStyle =
    styleConfig.navTextColor === "#000000" || styleConfig.navTextColor === "black" ? "black" : "white";
  if (styleConfig.backgroundColor) {
    windowConfig.backgroundColor = styleConfig.backgroundColor;
  }
  appJson.window = windowConfig;

  const tabBar = (appJson.tabBar as Record<string, unknown>) || null;
  if (tabBar) {
    tabBar.color = styleConfig.tabBarColor || "#999999";
    tabBar.selectedColor = tabSelected;
    if (styleConfig.tabBarBgColor) {
      tabBar.backgroundColor = styleConfig.tabBarBgColor;
    }
  }
  writeJson(appJsonPath, appJson);

  return staging;
}
