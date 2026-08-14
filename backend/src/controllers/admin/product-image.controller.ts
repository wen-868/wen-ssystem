import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import fs from "node:fs";
import path from "node:path";

/** 商品主图存储目录（backend/storage/product-images，已 gitignore） */
export function productImageDir(): string {
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
  const dir = path.join(base, "storage", "product-images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/** 上传商品主图：multer 单文件 image，保存后返回完整 URL（/uploads/product-image/xxx） */
export const uploadProductImage = asyncHandler(async (req: any, res: any) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, code: "400", message: "请选择商品图片" });
    return;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    res.status(400).json({ success: false, code: "400", message: "仅支持 jpg/png/gif/webp 图片" });
    return;
  }
  const tenantId = req.tenantId || req.user?.tenantId || "default";
  const filename = `${tenantId}-${Date.now()}-${Math.round(Math.random() * 100000)}${ext}`;
  fs.writeFileSync(path.join(productImageDir(), filename), file.buffer);

  const imagePath = `/uploads/product-image/${filename}`;
  const host = req.get("host") || "admin.onepan.cn";
  const proto = req.headers["x-forwarded-proto"] === "https" || req.secure ? "https" : "http";
  res.json(ok({ url: `${proto}://${host}${imagePath}`, path: imagePath }));
});
