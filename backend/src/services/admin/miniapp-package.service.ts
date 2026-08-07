/**
 * 小程序代码包生成服务（R96-02）
 *
 * 基于预构建产物（miniapp/template-dist/{a,b,c}）为租户生成可下载的
 * 微信小程序 zip 代码包：
 *   - 校验模板与租户配置存在；
 *   - 复制产物 → 替换 appid/标题/导航栏/tabBar 色 → 压缩为 zip；
 *   - 产物落 backend/storage/miniapp-packages/，记录写入 t_miniapp_publish_log
 *     （action='package'）。
 */
import fs from "node:fs";
import path from "node:path";
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { zipDirectory } from "../../shared/zip";
import {
  buildPackageStaging,
  type TemplateStyleConfig,
} from "./miniapp-package-builder";

/** t_miniapp_template 模板行（生成包所需字段） */
interface TemplateRow {
  id: number | string;
  name: string;
  style_config: string | null;
}

/** t_miniapp_config 配置行 */
interface ConfigRow {
  app_id: string | null;
  app_name: string | null;
  template_id: number | string | null;
}

/** 生成代码包请求体 */
export interface GeneratePackageInput {
  platform: string;
  templateId: number;
  appId?: string;
  appName?: string;
  version?: string;
}

const THEME_IDS = ["a", "b", "c"] as const;
type ThemeId = (typeof THEME_IDS)[number];

/** 定位仓库根目录（兼容 backend/ 目录与仓库根目录启动两种 cwd） */
function findRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "miniapp")) && fs.existsSync(path.join(c, "docs"))) {
      return c;
    }
  }
  return process.cwd();
}

/** 代码包存储目录（仓库 backend/storage/miniapp-packages） */
function getStorageDir(): string {
  const dir = path.join(findRepoRoot(), "backend", "storage", "miniapp-packages");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 将字符串转成安全文件名片段 */
function safeName(value: string): string {
  return (value || "").replace(/[^\w-]/g, "_");
}

/** 解析 style_config JSON */
function parseStyleConfig(raw: string | null): TemplateStyleConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TemplateStyleConfig;
  } catch {
    return {};
  }
}

export class MiniappPackageService {
  /**
   * 生成代码包：
   * 1. 校验模板存在（DEFAULT 全局模板或本租户模板）；
   * 2. 校验租户配置存在（AppID 兜底取配置行）；
   * 3. 读取预构建产物 → 替换 → zip → 落库。
   */
  static async generate(tenantId: string, input: GeneratePackageInput) {
    const platform = input.platform || "WECHAT";
    const template = await queryOneWithTenant<TemplateRow>(
      `SELECT id, name, style_config FROM t_miniapp_template
       WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')`,
      [input.templateId, tenantId],
      tenantId
    );
    if (!template) {
      throw new Error("模板不存在或已被停用");
    }

    const config = await queryOneWithTenant<ConfigRow>(
      `SELECT app_id, app_name, template_id FROM t_miniapp_config
       WHERE platform = ? AND tenant_id = ?`,
      [platform, tenantId],
      tenantId
    );
    if (!config) {
      throw new Error("请先保存小程序配置（AppID/商城名称）");
    }

    const appId = (input.appId || config.app_id || "").trim();
    const appName = (input.appName || config.app_name || "").trim();
    if (!appId) {
      throw new Error("AppID 未配置，无法生成代码包");
    }

    const style = parseStyleConfig(template.style_config);
    const theme = (THEME_IDS as readonly string[]).includes(style.theme as string)
      ? (style.theme as ThemeId)
      : "a";

    const distDir = path.join(findRepoRoot(), "miniapp", "template-dist", theme);
    if (!fs.existsSync(distDir)) {
      throw new Error(`模板产物未构建（${theme}），请先在 miniapp 目录执行 npm run build:weapp:all`);
    }

    // 复制产物 + 替换 appid/标题/导航栏/tabBar 色
    const staging = buildPackageStaging({
      templateDistDir: distDir,
      appId,
      appName,
      styleConfig: style,
    });

    // 压缩为 zip
    const fileName = `miniapp-${theme}-${safeName(tenantId)}-${Date.now()}.zip`;
    const zipPath = path.join(getStorageDir(), fileName);
    try {
      zipDirectory(staging, zipPath);
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }

    const version = input.version || "1.0.0";
    const logResult = await queryWithTenant(
      `INSERT INTO t_miniapp_publish_log
       (tenant_id, platform, template_id, action, version, result, remark, status, error_msg)
       VALUES (?, ?, ?, 'package', ?, 'success', ?, 'package_ready', '')`,
      [tenantId, platform, template.id, version, fileName],
      tenantId
    );
    const logId = (logResult as unknown as Record<string, unknown>).insertId;

    return {
      id: logId,
      fileName,
      downloadUrl: `/api/miniapp-config/packages/${logId}/download`,
    };
  }

  /** 查询代码包文件（校验租户归属 + 防路径穿越） */
  static async getPackageFile(tenantId: string, id: number) {
    const log = await queryOneWithTenant<Record<string, unknown>>(
      `SELECT * FROM t_miniapp_publish_log
       WHERE id = ? AND tenant_id = ? AND action = 'package'`,
      [id, tenantId],
      tenantId
    );
    if (!log) {
      throw new Error("代码包记录不存在");
    }
    const fileName = path.basename(String(log.remark || ""));
    const filePath = path.join(getStorageDir(), fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error("代码包文件不存在或已被清理");
    }
    return { filePath, fileName };
  }
}
