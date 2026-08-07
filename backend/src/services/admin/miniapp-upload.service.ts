/**
 * 小程序上传密钥（.key）管理服务（R96-05）
 *
 * 用途：接收微信公众平台生成的「代码上传密钥」（private.key），加密落盘于
 * backend/storage/miniapp-keys/（不入库、已 gitignore），供一键发布时
 * 解密后交给 miniprogram-ci 上传体验版使用。
 *
 * 存储格式：
 *   - {tenant}-{platform}.key       AES-256-GCM 加密后的密钥内容
 *   - {tenant}-{platform}.meta.json 元信息（原文件名/配置时间/是否带私钥密码）
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../../shared/env";

/** 上传密钥允许的最大体积（2MB，实际 .key 通常仅 1~3KB） */
export const MAX_KEY_FILE_SIZE = 2 * 1024 * 1024;

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

/** 密钥存储目录（backend/storage/miniapp-keys，已 gitignore） */
export function getKeyDir(): string {
  // 测试/自定义存储目录（仅测试注入用，生产不设置）
  if (process.env.MINIAPP_KEY_STORAGE_DIR) {
    return process.env.MINIAPP_KEY_STORAGE_DIR;
  }
  const dir = path.join(findRepoRoot(), "backend", "storage", "miniapp-keys");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 将租户/平台转换为安全文件片段 */
function safeSegment(value: string): string {
  return (value || "WECHAT").replace(/[^\w-]/g, "_").slice(0, 64);
}

/** 加密密钥：优先环境变量，否则由 JWT_SECRET 派生（确定性，免额外配置） */
function getEncryptionKey(): Buffer {
  const configured = env.MINIAPP_KEY_ENCRYPTION_KEY;
  if (configured) {
    const buf = Buffer.from(configured, "hex");
    if (buf.length === 32) return buf;
  }
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
}

/** AES-256-GCM 加密：iv(12) + authTag(16) + ciphertext */
export function encryptBuffer(data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/** AES-256-GCM 解密（与 encryptBuffer 对应） */
export function decryptBuffer(data: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const body = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/** 密钥元信息 */
interface KeyMeta {
  /** 用户上传时的原始文件名 */
  fileName: string;
  /** 配置时间 ISO 字符串 */
  configuredAt: string;
  /** 是否设置了私钥密码 */
  hasPassword: boolean;
}

/** 上传文件结构（由 multer 内存存储产出） */
export interface UploadKeyFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export class MiniappUploadService {
  /** 计算当前租户/平台的密钥文件与元信息路径 */
  static keyFilePaths(tenantId: string, platform: string): { keyPath: string; metaPath: string } {
    const base = `${safeSegment(tenantId)}-${safeSegment(platform)}`;
    return {
      keyPath: path.join(getKeyDir(), `${base}.key`),
      metaPath: path.join(getKeyDir(), `${base}.meta.json`),
    };
  }

  /** 上传并加密存储 .key 文件（重新上传覆盖旧密钥） */
  static async uploadKey(
    tenantId: string,
    platform: string,
    file: UploadKeyFile,
    privateKeyPassword?: string
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      const err = new Error("未接收到上传密钥文件，请重新选择 .key 文件") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    if (!/\.key$/i.test(file.originalname || "")) {
      const err = new Error("请上传微信公众平台生成的 .key 上传密钥文件（代码上传密钥）") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    if (file.size > MAX_KEY_FILE_SIZE) {
      const err = new Error(`上传密钥文件过大（超过 ${Math.floor(MAX_KEY_FILE_SIZE / 1024)}KB），请检查文件是否正确`) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const { keyPath, metaPath } = this.keyFilePaths(tenantId, platform);
    fs.writeFileSync(keyPath, encryptBuffer(file.buffer));
    const meta: KeyMeta = {
      fileName: file.originalname,
      configuredAt: new Date().toISOString(),
      hasPassword: Boolean(privateKeyPassword),
    };
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

    return { configured: true, fileName: meta.fileName, configuredAt: meta.configuredAt };
  }

  /** 查询密钥配置状态（脱敏：只返回是否配置/配置时间/原文件名） */
  static getKeyStatus(tenantId: string, platform: string) {
    const { keyPath, metaPath } = this.keyFilePaths(tenantId, platform);
    if (!fs.existsSync(keyPath)) {
      return { configured: false, configuredAt: null, fileName: "" };
    }
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Partial<KeyMeta>;
      return {
        configured: true,
        configuredAt: meta.configuredAt || new Date(fs.statSync(keyPath).mtime).toISOString(),
        fileName: meta.fileName || "",
      };
    } catch {
      return {
        configured: true,
        configuredAt: new Date(fs.statSync(keyPath).mtime).toISOString(),
        fileName: "",
      };
    }
  }

  /** 读取并解密密钥内容（供 miniprogram-ci 上传使用） */
  static readDecryptedKey(tenantId: string, platform: string): Buffer {
    const { keyPath } = this.keyFilePaths(tenantId, platform);
    if (!fs.existsSync(keyPath)) {
      const err = new Error("上传密钥未配置，请先在配置页上传 .key 文件") as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    return decryptBuffer(fs.readFileSync(keyPath));
  }
}
