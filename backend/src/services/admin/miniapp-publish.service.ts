/**
 * 小程序一键发布服务（R96-05）
 *
 * 流程：读取租户配置/模板 → 校验（AppID、模板、密钥、版本号）→ 复用
 * buildPackageStaging 生成产物（替换 appid/标题/导航色）→ 解密上传密钥 →
 * 调用 miniprogram-ci 上传体验版 → 写 t_miniapp_publish_log（action='publish'）。
 *
 * 微信限制：上传后为体验版；「提交审核/发布上线」为微信公众平台强制流程，
 * 本服务返回公众平台入口链接与指引，不代替平台审核。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { queryOneWithTenant, queryWithTenant } from "../../shared/db";
import { buildPackageStaging, type TemplateStyleConfig } from "./miniapp-package-builder";
import { MiniappUploadService } from "./miniapp-upload.service";
import { MiniappCiService, type MiniappCiUploadParams } from "./miniapp-ci.service";

/** 业务错误（携带 HTTP 状态码，供全局 error-handler 返回可读信息） */
export class MiniappPublishError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** 一键发布请求体（可选覆盖，未传读租户已存配置） */
export interface PublishInput {
  platform?: string;
  templateId?: number;
  appId?: string;
  appName?: string;
  version?: string;
  remark?: string;
}

/** 测试注入点：CI 上传函数与产物构建函数可替换 */
export interface PublishDeps {
  uploadFn?: (params: MiniappCiUploadParams) => Promise<{ status: string; message: string }>;
  buildStagingFn?: typeof buildPackageStaging;
  /** 仓库根目录（测试注入用，默认自动定位） */
  repoRoot?: string;
}

const THEME_IDS = ["a", "b", "c"] as const;
type ThemeId = (typeof THEME_IDS)[number];

/** 微信小程序 AppID：wx + 16 位十六进制字符 */
const WECHAT_APPID_RE = /^wx[0-9a-f]{16}$/i;
/** 微信版本号：x.y.z */
const VERSION_RE = /^\d+\.\d+\.\d+$/;

/** 公众平台「版本管理」入口（提交审核需在此完成） */
export const WECHAT_MP_VERSION_URL =
  "https://mp.weixin.qq.com/wxamp/wadevelopment/index?new=1&lang=zh_CN";

/** t_miniapp_template 模板行 */
interface TemplateRow {
  id: number | string;
  name: string;
  style_config: string | null;
}

/** t_miniapp_config 配置行 */
interface ConfigRow {
  app_id: string | null;
  app_name: string | null;
  app_version: string | null;
  template_id: number | string | null;
}

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

/** 解析模板 style_config */
function parseStyleConfig(raw: string | null): TemplateStyleConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TemplateStyleConfig;
  } catch {
    return {};
  }
}

export class MiniappPublishService {
  /** 写发布日志（action='publish'） */
  private static async writeLog(
    tenantId: string,
    row: {
      platform: string;
      templateId: number | string;
      version: string;
      result: "success" | "failed";
      status: string;
      remark: string;
      errorMsg: string;
    }
  ) {
    const logResult = await queryWithTenant(
      `INSERT INTO t_miniapp_publish_log
       (tenant_id, platform, template_id, action, version, result, remark, status, error_msg)
       VALUES (?, ?, ?, 'publish', ?, ?, ?, ?, ?)`,
      [
        tenantId,
        row.platform,
        row.templateId,
        row.version,
        row.result,
        row.remark,
        row.status,
        row.errorMsg,
      ],
      tenantId
    );
    return (logResult as unknown as Record<string, unknown>).insertId;
  }

  /**
   * 一键生成并发布：
   * 1. 校验租户配置/AppID/模板/密钥/版本号；
   * 2. 复用 R96-02 buildPackageStaging 生成代码包（不重新实现）；
   * 3. 解密密钥 → miniprogram-ci 上传体验版；
   * 4. 写 publish_log（成功/失败均记录），失败时抛出可读错误。
   */
  static async publish(
    tenantId: string,
    input: PublishInput = {},
    deps: PublishDeps = {}
  ) {
    const uploadFn = deps.uploadFn || MiniappCiService.upload;
    const buildStagingFn = deps.buildStagingFn || buildPackageStaging;
    const repoRoot = deps.repoRoot || findRepoRoot();
    const platform = (input.platform || "WECHAT").toUpperCase();

    // 1. 租户配置
    const config = await queryOneWithTenant<ConfigRow>(
      `SELECT app_id, app_name, app_version, template_id FROM t_miniapp_config
       WHERE platform = ? AND tenant_id = ?`,
      [platform, tenantId],
      tenantId
    );
    if (!config) {
      throw new MiniappPublishError(400, "请先保存小程序配置（AppID/商城名称）");
    }

    const appId = (input.appId || config.app_id || "").trim();
    if (!appId) {
      throw new MiniappPublishError(400, "AppID 未配置，无法发布");
    }
    if (!WECHAT_APPID_RE.test(appId)) {
      throw new MiniappPublishError(
        400,
        "AppID 格式不正确：应为 wx 开头 + 16 位十六进制字符（mp.weixin.qq.com 小程序 AppID）"
      );
    }

    const appName = (input.appName || config.app_name || "").trim();
    if (!appName) {
      throw new MiniappPublishError(400, "商城名称未配置，无法发布");
    }

    // 2. 模板
    const templateId = input.templateId ?? config.template_id;
    if (!templateId) {
      throw new MiniappPublishError(400, "请先选择小程序模板");
    }
    const template = await queryOneWithTenant<TemplateRow>(
      `SELECT id, name, style_config FROM t_miniapp_template
       WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')`,
      [templateId, tenantId],
      tenantId
    );
    if (!template) {
      throw new MiniappPublishError(400, "模板不存在或已被停用");
    }
    const style = parseStyleConfig(template.style_config);
    const theme = (THEME_IDS as readonly string[]).includes(style.theme as string)
      ? (style.theme as ThemeId)
      : "a";

    // 3. 上传密钥
    const keyStatus = MiniappUploadService.getKeyStatus(tenantId, platform);
    if (!keyStatus.configured) {
      throw new MiniappPublishError(
        400,
        "上传密钥未配置：请在微信公众平台「开发管理-开发设置」生成代码上传密钥并上传 .key 文件"
      );
    }

    // 4. 版本号/备注
    const version = (input.version || config.app_version || "1.0.0").trim();
    if (!VERSION_RE.test(version)) {
      throw new MiniappPublishError(400, "版本号格式不正确，应为 x.y.z（如 1.0.0）");
    }
    const remark = (input.remark || `智享小程序自动发布 ${version}`).slice(0, 200);

    const distDir = path.join(repoRoot, "miniapp", "template-dist", theme);
    if (!fs.existsSync(distDir)) {
      throw new MiniappPublishError(
        400,
        `模板产物未构建（${theme}），请先在 miniapp 目录执行 npm run build:weapp:all`
      );
    }

    let staging = "";
    let keyTempDir = "";
    try {
      // 5. 复用 R96-02 产物构建逻辑（替换 appid/标题/导航栏/tabBar 色）
      staging = buildStagingFn({
        templateDistDir: distDir,
        appId,
        appName,
        styleConfig: style,
      });

      // 6. 解密密钥到临时文件，供 miniprogram-ci 使用
      keyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-key-"));
      const privateKeyPath = path.join(keyTempDir, "private.key");
      fs.writeFileSync(privateKeyPath, MiniappUploadService.readDecryptedKey(tenantId, platform));

      // 7. 上传体验版
      const uploadResult = await uploadFn({
        appId,
        projectPath: staging,
        privateKeyPath,
        version,
        desc: remark,
      });

      const publishLogId = await this.writeLog(tenantId, {
        platform,
        templateId: template.id,
        version,
        result: "success",
        status: uploadResult.status || "uploaded",
        remark,
        errorMsg: "",
      });

      return {
        publishLogId,
        version,
        status: uploadResult.status || "uploaded",
        message: uploadResult.message || "体验版上传成功",
        mpUrl: WECHAT_MP_VERSION_URL,
      };
    } catch (err) {
      // 已带状态码的业务错误（校验类）原样抛出，不写失败日志
      if (err instanceof MiniappPublishError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      await this.writeLog(tenantId, {
        platform,
        templateId: template.id,
        version,
        result: "failed",
        status: "failed",
        remark,
        errorMsg: message.slice(0, 1000),
      }).catch(() => undefined);
      throw new MiniappPublishError(500, `发布失败：${message}`);
    } finally {
      if (staging) fs.rmSync(staging, { recursive: true, force: true });
      if (keyTempDir) fs.rmSync(keyTempDir, { recursive: true, force: true });
    }
  }
}
