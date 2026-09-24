/**
 * 平台 Logo 上传控制器（C6-1A #80）
 *
 * 清账依据：C6-0 §三.1 #80（Settings.vue:441）「无 Logo 上传端点（建议 POST /platform/config/logo）」
 * ⇒ 零 DDL、复用既有上传范式（multer 内存存储 + backend/storage 落盘 + /uploads 静态挂载，
 * 与 `product-image.controller.ts` / `avatar.controller.ts` 同构），不引入 OSS（裁定 C6-0-R4）。
 *
 * ★ 边界（红线④，凌舟裁定 §四）：本端点**只落盘并返回 URL，不写 t_platform_config**。
 *   该表是凭据表（platform 列 NOT NULL、唯一键含 platform/store_id/tenant_id），
 *   用键值行存 Logo 会与其凭据语义与唯一键冲突，属语义污染。
 *   Logo 的持久化载体（既有 `/api/platform/config/sys-config` 的 saas_settings 包，或另立新表）
 *   需凌舟裁定后由前端接线，本单只交付「上传能力 + URL」。
 */

import { ok, fail } from "../../shared/response";
import { asyncHandler } from "../../middleware/async-handler";
import fs from "node:fs";
import path from "node:path";

/** 平台 Logo 存储目录（backend/storage/platform-logo） */
export function platformLogoDir(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];
  let base = process.cwd();
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "backend")) && fs.existsSync(path.join(c, "docs"))) {
      base = path.join(c, "backend");
      break;
    }
  }
  const dir = path.join(base, "storage", "platform-logo");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 允许的图片扩展名（与商品图上传同口径） */
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/**
 * POST /api/platform/config/logo —— 上传平台 Logo，返回可访问 URL
 * 表单字段名兼容 `file` 与 `logo` 两种写法。
 */
export const uploadPlatformLogo = asyncHandler(async (req: any, res: any) => {
  // multer 用 .fields() 时文件落在 req.files（按字段名分组）；两种形态都取，避免字段名口径分歧
  const files = req.files as Record<string, Array<{ originalname?: string; buffer: Buffer }>> | undefined;
  const file = req.file ?? files?.file?.[0] ?? files?.logo?.[0];
  if (!file) {
    res.status(400).json(fail("请选择 Logo 图片（表单字段名 file 或 logo）", "400"));
    return;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    res.status(400).json(fail("仅支持 jpg/png/gif/webp 图片", "400"));
    return;
  }

  const filename = `platform-logo-${Date.now()}-${Math.round(Math.random() * 100000)}${ext}`;
  fs.writeFileSync(path.join(platformLogoDir(), filename), file.buffer);

  const relativePath = `/uploads/platform-logo/${filename}`;
  const host = req.get("host") || "saas.onepan.cn";
  const proto = req.headers["x-forwarded-proto"] === "https" || req.secure ? "https" : "http";

  // 显式声明未持久化：避免前端把「上传成功」误读成「配置已保存」
  res.json(
    ok({
      url: `${proto}://${host}${relativePath}`,
      path: relativePath,
      persisted: false,
      persistedNote: "本端点不写 t_platform_config（凌舟裁定 §四），保存动作由页面调用既有配置接口完成"
    })
  );
});
