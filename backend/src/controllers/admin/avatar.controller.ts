import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { query } from "../../shared/db";
import fs from "node:fs";
import path from "node:path";

/** 头像存储目录（backend/storage/avatars，已 gitignore） */
function avatarDir(): string {
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
  const dir = path.join(base, "storage", "avatars");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/** 上传头像：multer 单文件 avatar，保存后更新 t_sys_user.avatar，返回完整 URL */
export const uploadAvatar = asyncHandler(async (req: any, res: any) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, code: "400", message: "请选择头像图片" });
    return;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    res.status(400).json({ success: false, code: "400", message: "仅支持 jpg/png/gif/webp 图片" });
    return;
  }
  const tenantId = req.tenantId || req.user?.tenantId || "default";
  const userId = req.user?.id || 0;
  const filename = `${tenantId}-${userId}-${Date.now()}${ext}`;
  const target = path.join(avatarDir(), filename);
  fs.writeFileSync(target, file.buffer);

  // 更新用户头像（存相对路径 /uploads/avatar/xxx）
  const avatarPath = `/uploads/avatar/${filename}`;
  await query("UPDATE t_sys_user SET avatar = ? WHERE id = ? AND tenant_id = ?", [
    avatarPath, userId, tenantId,
  ]);

  // 返回完整 URL（经 nginx /uploads 反代到后端静态服务）
  const host = req.get("host") || "admin.onepan.cn";
  const proto = req.headers["x-forwarded-proto"] === "https" || req.secure ? "https" : "http";
  res.json(ok({ avatar: `${proto}://${host}${avatarPath}` }));
});

/** 头像静态目录导出（server.ts 挂 /uploads 用） */
export { avatarDir };
