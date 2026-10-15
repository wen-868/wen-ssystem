/**
 * S3-208（R101 收口总清单第 57 项）：12 条 `js/path-injection`
 * （"This path depends on a user-provided value"）的**误报判定**的可执行证据。
 *
 * 判定的口径（见 `docs/evidence/S3-208/README.md` §三）：这 12 条的"数据流"确实存在
 * （CodeQL 把 `req.*` 上的字段都当远端输入），但**路径拼接里可被用户控制的成分已被消解**：
 *   - 文件名 = 服务端取值（租户/用户 id，来自签名 JWT）+ `Date.now()` + **白名单扩展名**；
 *     用户可控的只有 `file.originalname`，它对最终路径的唯一贡献是 `path.extname()` 的返回值，
 *     且必须命中 `.jpg/.jpeg/.png/.gif/.webp` 白名单（`path.extname("../../x.jpg") === ".jpg"`）。
 *   - 密钥落盘名 = `safeSegment(租户)-safeSegment(平台).key`，`safeSegment = replace(/[^\w-]/g,"_")`
 *     ⇒ `/`、`.`、`..` 不可能存活（平台值**是**用户可控的：`req.query.platform || req.body.platform`）。
 *   - 代码包路径 = `getStorageDir() + "miniapp-" + theme + "-" + safeName(租户) + "-" + Date.now() + ".zip"`
 *     （`theme` 过 `THEME_IDS` 白名单），`safeName` 与 `safeSegment` 同形。
 *
 * 本文件不对 12 条做任何"排除"，只把上述判定钉成回归：
 *   ① 头像/商品主图控制器：**带穿越载荷的真实 multipart 上传** ⇒ 文件落在目标目录内、
 *      目标目录外不产生文件（载荷本身是真实穿越尝试，先断言它确实会穿越）；
 *   ② 小程序上传密钥：**穿越的租户/平台值 + 穿越的上传文件名** ⇒ `.key`/`.meta.json`
 *      落在注入的存储目录内，且目录外不产生文件。
 * 若哪天有人把白名单或 `safeSegment` 拆掉，本文件会红——这正是"判定可被推翻"的判据。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { avatarDir, uploadAvatar } from "../../controllers/admin/avatar.controller";
import { productImageDir, uploadProductImage } from "../../controllers/admin/product-image.controller";
import { MiniappUploadService } from "../../services/admin/miniapp-upload.service";

const TRAVERSAL_NAME = "../../../../s3-208-evil.jpg";
const TRAVERSAL_TARGET = path.resolve(process.cwd(), "../../s3-208-evil.jpg");

const writtenFiles: string[] = [];

afterAll(() => {
  for (const file of writtenFiles) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* 清理失败不影响结论 */
    }
  }
});

function uploadApp(mountPath: string, field: string, handler: RequestHandler): express.Express {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.post(
    mountPath,
    (req, _res, next) => {
      // 等价于 requireAuthWithTenant 之后的状态：租户/用户 id 由服务端（JWT）给出
      (req as unknown as { tenantId: string }).tenantId = "tenant-a";
      (req as unknown as { user: { id: number; tenantId: string } }).user = { id: 7, tenantId: "tenant-a" };
      next();
    },
    upload.single(field),
    handler
  );
  return app;
}

describe("S3-208 · 图片上传控制器：文件名只吃白名单扩展名（12 条 path-injection 的误报证据）", () => {
  it("先证载荷确实是穿越尝试（naive 拼接会跑出目标目录）", () => {
    const dir = avatarDir();
    expect(path.resolve(dir, TRAVERSAL_NAME)).not.toContain(path.resolve(dir) + path.sep);
    expect(path.extname(TRAVERSAL_NAME)).toBe(".jpg");
  });

  it("头像上传：../../../../s3-208-evil.jpg ⇒ 落盘在 avatars 目录内、目录外无文件", async () => {
    const app = uploadApp("/avatar", "avatar", uploadAvatar);
    const res = await request(app).post("/avatar").attach("avatar", Buffer.from("s3-208"), TRAVERSAL_NAME);

    expect(res.status).toBe(200);
    const url = String(res.body?.data?.avatar ?? "");
    expect(url).toContain("/uploads/avatar/");
    expect(url).not.toContain("..");

    const written = path.join(avatarDir(), path.basename(url));
    writtenFiles.push(written);
    expect(fs.existsSync(written)).toBe(true);
    expect(written.startsWith(avatarDir() + path.sep)).toBe(true);
    expect(fs.existsSync(TRAVERSAL_TARGET)).toBe(false);
  });

  it("商品主图上传：同上（同形代码，独立目录）", async () => {
    const app = uploadApp("/image", "image", uploadProductImage);
    const res = await request(app).post("/image").attach("image", Buffer.from("s3-208"), TRAVERSAL_NAME);

    expect(res.status).toBe(200);
    const imagePath = String(res.body?.data?.path ?? "");
    const written = path.join(productImageDir(), path.basename(imagePath));
    writtenFiles.push(written);
    expect(fs.existsSync(written)).toBe(true);
    expect(written.startsWith(productImageDir() + path.sep)).toBe(true);
    expect(fs.existsSync(TRAVERSAL_TARGET)).toBe(false);
  });

  it("反测：扩展名不在白名单（.exe）⇒ 400，且不落盘", async () => {
    const app = uploadApp("/avatar", "avatar", uploadAvatar);
    const res = await request(app).post("/avatar").attach("avatar", Buffer.from("s3-208"), "../../evil.exe");
    expect(res.status).toBe(400);
    expect(fs.existsSync(TRAVERSAL_TARGET)).toBe(false);
  });
});

describe("S3-208 · 小程序上传密钥：safeSegment 消解穿越（8 条 miniapp-upload.service.ts 的误报证据）", () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "s3-208-miniapp-keys-"));
    process.env.MINIAPP_KEY_STORAGE_DIR = storageDir;
  });

  it("穿越的租户/平台 + 穿越的上传文件名 ⇒ 只在注入目录内落盘点名文件", async () => {
    const outside = path.resolve(storageDir, "..", "s3-208-escaped.key");
    const result = await MiniappUploadService.uploadKey(
      "../../../../etc",
      "../../../../s3-208-escaped",
      { originalname: "../../../../s3-208-escaped.key", buffer: Buffer.from("private-key"), size: 11 }
    );

    expect(result.configured).toBe(true);
    const entries = fs.readdirSync(storageDir);
    expect(entries.length).toBe(2); // {base}.key + {base}.meta.json
    expect(entries.every((name) => !name.includes("/") && !name.includes("\\") && !name.includes(".."))).toBe(true);
    // 落盘名只由 [\w-] 组成（`/\`、`.` 被 safeSegment 换成 `_`，穿越载荷无法存活）
    expect(entries.filter((name) => /^[\w-]+\.key$/.test(name))).toHaveLength(1);
    expect(entries.filter((name) => /^[\w-]+\.meta\.json$/.test(name))).toHaveLength(1);
    expect(fs.existsSync(outside)).toBe(false);
    expect(fs.existsSync(path.join(storageDir, "s3-208-escaped.key"))).toBe(false);
  });

  it("读写同源：任何穿越载荷都被压平到注入目录内的安全片段上", () => {
    const a = MiniappUploadService.keyFilePaths("../../tenant", "../../platform");
    const b = MiniappUploadService.keyFilePaths("../../tenant", "../../platform");
    expect(path.dirname(a.keyPath)).toBe(storageDir);
    expect(path.dirname(a.metaPath)).toBe(storageDir);
    expect(path.basename(a.keyPath)).toMatch(/^[\w-]+\.key$/);
    expect(path.basename(a.metaPath)).toMatch(/^[\w-]+\.meta\.json$/);
    expect(a.keyPath).toBe(b.keyPath); // 同一载荷 ⇒ 同一路径（读写不会各算一份）
    // 平台值即使完全由用户控制（req.query.platform || req.body.platform），也进不了目录
    const evil = MiniappUploadService.keyFilePaths("t", "../../../etc/passwd");
    expect(path.dirname(evil.keyPath)).toBe(storageDir);
  });
});
