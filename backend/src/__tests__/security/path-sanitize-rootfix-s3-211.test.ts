/**
 * S3-211（R101 收口总清单第 **57** 项·**乙方案**）：12 条 `js/path-injection` 的**根治**回归。
 *
 * 口径（见 `docs/evidence/S3-211/README.md`）：
 *   - 甲方案（S3-208）= 逐条 dismissal，属"人工背书"，代码一变、查询一升级就可能再报；
 *   - 乙方案（本单）= 把净化改写成 **CodeQL 已建模的形态**
 *     `path.resolve(path.join(根目录, 段))` + `resolved.startsWith(根目录 + path.sep)`，
 *     让工具自己就能证明"落点逃不出根目录"。
 *
 * 本文件钉两件事（不靠文字自述）：
 *   ① **行为对照**：改造前后对同一组输入（穿越 / 反斜杠 / URL 编码 / 绝对路径 / 空段 / Unicode / 白名单外扩展名）
 *      的落点、落盘名、返回码**逐字节一致**（legacy 公式 vs 改造后的真实输出）；
 *   ② **承重性探针**：`starter` 分隔符段（绕过前置净化）只能"被拒"或"落在根目录内"，
 *      绝不落盘到根目录外 —— 去掉 `startsWith` 校验后本文件会红（反测矩阵见
 *      `docs/evidence/S3-211/harness/antitest-remove-guard.mjs`）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { avatarDir, uploadAvatar } from "../../controllers/admin/avatar.controller";
import { productImageDir, uploadProductImage } from "../../controllers/admin/product-image.controller";
import { MiniappUploadService } from "../../services/admin/miniapp-upload.service";
import { MiniappPackageService } from "../../services/admin/miniapp-package.service";

/** 与业务代码同形的"改造前"公式（用于逐字节对照，不得删） */
function legacySafeSegment(value: string): string {
  return (value || "WECHAT").replace(/[^\w-]/g, "_").slice(0, 64);
}

/** 与 miniapp-package.service.ts 的 safeName 同形（改造前公式的一部分） */
function legacySafeName(value: string): string {
  return (value || "").replace(/[^\w-]/g, "_");
}

/** 复刻服务的仓库根定位（兼容 backend/ 与仓库根两种 cwd），供代码包落点断言用 */
function repoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "miniapp")) && fs.existsSync(path.join(c, "docs"))) return c;
  }
  return process.cwd();
}

const STORAGE_DIR = path.join(repoRoot(), "backend", "storage");
const PACKAGE_DIR = path.join(STORAGE_DIR, "miniapp-packages");

/** 穿越 / 编码 / 绝对路径 / 空段 / Unicode / 白名单外扩展名 的载荷矩阵 */
const NAME_PAYLOADS = [
  "../../../../s3-211-evil.jpg",
  "..\\..\\s3-211-evil.jpg",
  "%2e%2e%2fs3-211-evil.jpg",
  "/etc/s3-211-evil.jpg",
  "",
  "s3-211-头像.jpg",
  "../../s3-211-evil.exe",
];

const SEGMENT_PAYLOADS = ["../..", "..\\..", "../../../../etc", "%2e%2e", "", "…", "租户-甲", "..", "a/b"];

const writtenFiles: string[] = [];
const createdDirs: string[] = [];

/** 只清理本单探针自己写出的东西（固定前缀，避免误删） */
function cleanupProbeArtifacts(): void {
  for (const file of writtenFiles) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* 清理失败不影响结论 */
    }
  }
  for (const dir of fs.readdirSync(STORAGE_DIR, { withFileTypes: true })) {
    if (dir.isFile() && dir.name.startsWith("s3-211-evil")) {
      fs.rmSync(path.join(STORAGE_DIR, dir.name), { force: true });
    }
  }
  if (fs.existsSync(PACKAGE_DIR)) {
    for (const name of fs.readdirSync(PACKAGE_DIR)) {
      if (name.includes("s3-211")) fs.rmSync(path.join(PACKAGE_DIR, name), { force: true });
    }
  }
}

afterAll(() => {
  cleanupProbeArtifacts();
  for (const dir of createdDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function uploadApp(mountPath: string, field: string, handler: RequestHandler, tenantId: string, userId: number): express.Express {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.post(
    mountPath,
    (req, _res, next) => {
      // 等价于 requireAuthWithTenant 之后的状态：租户/用户 id 由服务端（签名 JWT）给出
      (req as unknown as { tenantId: string }).tenantId = tenantId;
      (req as unknown as { user: { id: number; tenantId: string } }).user = { id: userId, tenantId };
      next();
    },
    upload.single(field),
    handler
  );
  return app;
}

describe("S3-211 ① 行为对照：净化改造前后逐字节一致", () => {
  it("头像：真实 multipart（载荷矩阵）⇒ 落盘名与 legacy 公式逐字节一致、均落在 avatars 内", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
    const now = Date.now();

    for (const payload of NAME_PAYLOADS) {
      const dir = avatarDir();
      const ext = path.extname(payload).toLowerCase();
      const app = uploadApp("/avatar", "avatar", uploadAvatar, "tenant-a", 7);
      const res = await request(app).post("/avatar").attach("avatar", Buffer.from("s3-211"), payload);

      if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
        // 白名单外扩展名：改造前后同码拒
        expect(res.status, `载荷 ${JSON.stringify(payload)} 应被扩展名白名单拒`).toBe(400);
        continue;
      }

      expect(res.status, `载荷 ${JSON.stringify(payload)} 应成功`).toBe(200);
      const written = path.basename(String(res.body?.data?.avatar ?? ""));
      // 改造前公式（唯一用户可控成分是白名单扩展名）
      expect(written, `载荷 ${JSON.stringify(payload)} 落盘名应与改造前逐字节一致`).toBe(`tenant-a-7-${now}${ext}`);
      const abs = path.join(dir, written);
      writtenFiles.push(abs);
      expect(abs.startsWith(dir + path.sep)).toBe(true);
      expect(fs.existsSync(abs)).toBe(true);
      expect(res.body?.data?.avatar).not.toContain("..");
    }
  });

  it("商品主图：真实 multipart（载荷矩阵）⇒ 落盘名与 legacy 公式逐字节一致、均落在 product-images 内", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
    const now = Date.now();
    const rand = 0.12345;
    vi.spyOn(Math, "random").mockReturnValue(rand);

    for (const payload of NAME_PAYLOADS) {
      const dir = productImageDir();
      const ext = path.extname(payload).toLowerCase();
      const app = uploadApp("/image", "image", uploadProductImage, "tenant-a", 7);
      const res = await request(app).post("/image").attach("image", Buffer.from("s3-211"), payload);

      if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
        expect(res.status, `载荷 ${JSON.stringify(payload)} 应被扩展名白名单拒`).toBe(400);
        continue;
      }

      expect(res.status, `载荷 ${JSON.stringify(payload)} 应成功`).toBe(200);
      const written = path.basename(String(res.body?.data?.path ?? ""));
      expect(written, `载荷 ${JSON.stringify(payload)} 落盘名应与改造前逐字节一致`).toBe(
        `tenant-a-${now}-${Math.round(rand * 100000)}${ext}`
      );
      const abs = path.join(dir, written);
      writtenFiles.push(abs);
      expect(abs.startsWith(dir + path.sep)).toBe(true);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });

  it("图片目录：path.resolve(path.join(dir, name)) 与 path.join(dir, name) 对全部载荷同值（改造即等价变形）", () => {
    for (const dir of [avatarDir(), productImageDir()]) {
      for (const payload of NAME_PAYLOADS) {
        const name = `tenant-a-7-1750000000000${path.extname(payload).toLowerCase()}`;
        expect(path.resolve(path.join(dir, name)), `目录 ${dir} 载荷 ${name}`).toBe(path.join(dir, name));
      }
    }
  });

  it("密钥：keyFilePaths（载荷矩阵）与改造前公式逐字节一致，且始终压在注入目录内", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "s3-211-keys-"));
    createdDirs.push(storageDir);
    process.env.MINIAPP_KEY_STORAGE_DIR = storageDir;
    try {
      for (const tenant of SEGMENT_PAYLOADS) {
        for (const platform of SEGMENT_PAYLOADS) {
          const base = `${legacySafeSegment(tenant)}-${legacySafeSegment(platform)}`;
          const legacy = {
            keyPath: path.join(storageDir, `${base}.key`),
            metaPath: path.join(storageDir, `${base}.meta.json`),
          };
          expect(MiniappUploadService.keyFilePaths(tenant, platform), `租户=${tenant} 平台=${platform}`).toEqual(legacy);
        }
      }
    } finally {
      delete process.env.MINIAPP_KEY_STORAGE_DIR;
    }
  });

  it("密钥：穿越载荷的真实上传 ⇒ 只在注入目录内落盘 2 个 [\\w-] 文件（前置净化未被改动）", async () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "s3-211-keys-"));
    createdDirs.push(storageDir);
    process.env.MINIAPP_KEY_STORAGE_DIR = storageDir;
    try {
      await MiniappUploadService.uploadKey("../../../../etc", "../../../../s3-211-escaped", {
        originalname: "../../../../s3-211-escaped.key",
        buffer: Buffer.from("private-key"),
        size: 11,
      });
      const entries = fs.readdirSync(storageDir);
      expect(entries).toHaveLength(2);
      expect(entries.every((name) => /^[\w-]+(\.key|\.meta\.json)$/.test(name))).toBe(true);
    } finally {
      delete process.env.MINIAPP_KEY_STORAGE_DIR;
    }
  });

  it("代码包：真实 generate（mock 库表）⇒ 返回的 fileName 与改造前公式逐字节一致、zip 落在 miniapp-packages 内", async () => {
    const distDir = path.join(repoRoot(), "miniapp", "template-dist", "a");
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
      createdDirs.push(distDir);
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
    const now = Date.now();

    const result = await MiniappPackageService.generate("s3-211-tenant", {
      platform: "WECHAT",
      templateId: 1,
      appId: "wxs3-211-appid",
      appName: "S3-211 演示小店",
      version: "1.0.0",
    });

    const legacyName = `miniapp-a-${legacySafeName("s3-211-tenant")}-${now}.zip`;
    expect(result.fileName, "代码包名应与改造前逐字节一致").toBe(legacyName);
    expect(path.resolve(PACKAGE_DIR, result.fileName)).toBe(path.join(PACKAGE_DIR, legacyName));
    expect(fs.existsSync(path.join(PACKAGE_DIR, result.fileName))).toBe(true);
    expect(fs.statSync(path.join(PACKAGE_DIR, result.fileName)).size).toBeGreaterThan(80);
  });
});

describe("S3-211 ② 承重性探针：分隔符段只能被拒或落在根目录内（去掉 startsWith 校验即红）", () => {
  it("头像：tenantId 携带分隔符（绕过「服务端取值」前提）⇒ 400，且 storage/ 下不产生 s3-211-evil*", async () => {
    const evil = "../s3-211-evil-av";
    const app = uploadApp("/avatar", "avatar", uploadAvatar, evil, 7);
    const res = await request(app).post("/avatar").attach("avatar", Buffer.from("s3-211"), "ok.jpg");

    const escapedDir = path.resolve(avatarDir(), ".."); // backend/storage
    const escaped = fs.readdirSync(escapedDir).filter((name) => name.startsWith("s3-211-evil-av"));
    expect(escaped, `穿越落点：${escaped.join(", ")}`).toEqual([]);
    expect(res.status, "分隔符租户值必须被 startsWith 校验拒（去掉校验后此处会变成 200 并落盘到目录外）").toBe(400);
  });

  it("商品主图：tenantId 携带分隔符 ⇒ 400，且 storage/ 下不产生 s3-211-evil*", async () => {
    const evil = "../s3-211-evil-img";
    const app = uploadApp("/image", "image", uploadProductImage, evil, 7);
    const res = await request(app).post("/image").attach("image", Buffer.from("s3-211"), "ok.jpg");

    const escapedDir = path.resolve(productImageDir(), ".."); // backend/storage
    const escaped = fs.readdirSync(escapedDir).filter((name) => name.startsWith("s3-211-evil-img"));
    expect(escaped, `穿越落点：${escaped.join(", ")}`).toEqual([]);
    expect(res.status, "分隔符租户值必须被 startsWith 校验拒").toBe(400);
  });

  it("密钥：分隔符段（绕过前置净化）⇒ 被拒或压在注入目录内，绝不落盘到目录外", async () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "s3-211-keys-"));
    createdDirs.push(storageDir);
    process.env.MINIAPP_KEY_STORAGE_DIR = storageDir;
    const escapedParents = [path.resolve(storageDir, ".."), path.resolve(storageDir, "../..")];
    try {
      await MiniappUploadService.uploadKey("../../s3-211-escaped", "x", {
        originalname: "../../s3-211-escaped.key",
        buffer: Buffer.from("private-key"),
        size: 11,
      }).catch(() => undefined); // 校验命中时抛错也算合规

      const escaped = escapedParents.flatMap((dir) =>
        fs.readdirSync(dir).filter((name) => name.startsWith("s3-211-escaped")).map((name) => path.join(dir, name))
      );
      expect(escaped, `穿越落点：${escaped.join(", ")}`).toEqual([]);
      for (const name of fs.readdirSync(storageDir)) {
        expect(name, "目录内文件名不得含路径分隔符").toMatch(/^[\w-]+(\.key|\.meta\.json)$/);
      }
    } finally {
      delete process.env.MINIAPP_KEY_STORAGE_DIR;
      for (const dir of escapedParents) {
        for (const name of fs.readdirSync(dir)) {
          if (name.startsWith("s3-211-escaped")) fs.rmSync(path.join(dir, name), { force: true });
        }
      }
    }
  });

  it("代码包：tenantId 携带分隔符 ⇒ 被拒或压在 miniapp-packages 内，绝不落盘到目录外", async () => {
    const distDir = path.join(repoRoot(), "miniapp", "template-dist", "a");
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
      createdDirs.push(distDir);
    }

    // 三级上跳：裸租户段下 `miniapp-a-` 前缀 + `..` 会把落点推出 miniapp-packages（backend/storage 之下）
    await MiniappPackageService.generate("../../../s3-211-evil-pkg", {
      platform: "WECHAT",
      templateId: 1,
      appId: "wxs3-211-appid",
      appName: "S3-211 演示小店",
      version: "1.0.0",
    }).catch(() => undefined); // 校验命中时抛错也算合规

    const escaped = fs
      .readdirSync(STORAGE_DIR)
      .filter((name) => name.startsWith("s3-211-evil-pkg"));
    expect(escaped, `穿越落点：${escaped.join(", ")}`).toEqual([]);
    const inDir = fs.readdirSync(PACKAGE_DIR).filter((name) => name.includes("s3-211"));
    for (const name of inDir) {
      expect(name, "代码包文件名不得含路径分隔符").toMatch(/^[\w-.]+$/);
    }
  });
});

/**
 * 库表 mock：只替换 `shared/db`，其余（产物复制、zip 写入、真实 fs 落点）全部走真实实现，
 * 以便"代码包输出路径"这条真实链路被本单的校验覆盖到。
 */
vi.mock("../../shared/db", () => ({
  queryOneWithTenant: vi
    .fn()
    .mockResolvedValueOnce({ id: 1, name: "默认模板", style_config: JSON.stringify({ theme: "a" }) })
    .mockResolvedValue({ app_id: "wx-config-appid", app_name: "配置里的商城名", template_id: 1 }),
  queryWithTenant: vi.fn().mockResolvedValue({ insertId: 9001 }),
  query: vi.fn(),
}));

beforeAll(() => {
  fs.mkdirSync(PACKAGE_DIR, { recursive: true });
});
