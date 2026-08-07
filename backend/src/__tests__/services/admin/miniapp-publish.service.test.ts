/**
 * miniapp-publish.service 单元测试（R96-05）
 *
 * 覆盖：配置/AppID/模板/密钥/版本号校验、成功发布（复用产物构建 + CI 上传 +
 * publish_log 落库）、上传失败（写失败日志 + 抛可读错误）。
 * 测试通过 deps 注入 uploadFn/buildStagingFn，真实上传由用户提供密钥后验收。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("../../../shared/db", () => ({
  queryOneWithTenant: vi.fn(),
  queryWithTenant: vi.fn(),
}));

import { queryOneWithTenant, queryWithTenant } from "../../../shared/db";
import { MiniappPublishService, MiniappPublishError } from "../../../services/admin/miniapp-publish.service";
import { MiniappUploadService } from "../../../services/admin/miniapp-upload.service";

describe("services/admin/miniapp-publish", () => {
  let tempDir: string;
  let repoRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-publish-test-"));
    process.env.MINIAPP_KEY_STORAGE_DIR = tempDir;

    // 构造伪仓库根：miniapp/template-dist/a 产物目录
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-repo-test-"));
    fs.mkdirSync(path.join(repoRoot, "miniapp", "template-dist", "a"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "miniapp", "template-dist", "a", "app.json"),
      JSON.stringify({ pages: ["pages/index/index"] }, null, 2),
      "utf8"
    );

    // 默认 DB mock：配置行 + 模板行
    (queryOneWithTenant as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes("FROM t_miniapp_config")) {
        return Promise.resolve({
          app_id: "wx1234567890abcdef",
          app_name: "测试商城",
          app_version: "1.0.0",
          template_id: 1,
        });
      }
      if (sql.includes("FROM t_miniapp_template")) {
        return Promise.resolve({
          id: 1,
          name: "模板A",
          style_config: JSON.stringify({ theme: "a", primaryColor: "#1e40af" }),
        });
      }
      return Promise.resolve(null);
    });
    // 生产模式 queryWithTenant 对 INSERT 返回 ResultSetHeader（含 insertId）
    (queryWithTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ insertId: 99 });
  });

  afterEach(() => {
    delete process.env.MINIAPP_KEY_STORAGE_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  /** 注入测试依赖：stub 产物构建与 CI 上传，真实密钥走文件系统 */
  function makeDeps(uploadImpl?: () => Promise<{ status: string; message: string }>) {
    const uploadFn = vi
      .fn()
      .mockImplementation(uploadImpl || (() => Promise.resolve({ status: "uploaded", message: "体验版上传成功" })));
    const buildStagingFn = vi.fn().mockReturnValue(fs.mkdtempSync(path.join(os.tmpdir(), "miniapp-staging-test-")));
    return { uploadFn, buildStagingFn, repoRoot };
  }

  /** 在注入的存储目录真实上传一份假密钥 */
  async function uploadKey() {
    await MiniappUploadService.uploadKey(
      "t1",
      "WECHAT",
      {
        originalname: "private.key",
        buffer: Buffer.from("-----BEGIN PRIVATE KEY-----\nMOCKKEY\n-----END PRIVATE KEY-----\n"),
        size: 60,
      }
    );
  }

  it("配置不存在时应抛 400 可读错误", async () => {
    (queryOneWithTenant as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      MiniappPublishService.publish("t1", {}, makeDeps())
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("请先保存小程序配置") });
  });

  it("AppID 格式不正确时应抛 400", async () => {
    (queryOneWithTenant as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes("FROM t_miniapp_config")) {
        return Promise.resolve({ app_id: "bad-appid", app_name: "测试商城", app_version: "1.0.0", template_id: 1 });
      }
      return Promise.resolve(null);
    });
    await expect(
      MiniappPublishService.publish("t1", {}, makeDeps())
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("AppID 格式不正确") });
  });

  it("上传密钥未配置时应抛 400", async () => {
    await expect(
      MiniappPublishService.publish("t1", {}, makeDeps())
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("上传密钥未配置") });
  });

  it("版本号格式不正确时应抛 400", async () => {
    await uploadKey();
    await expect(
      MiniappPublishService.publish("t1", { version: "v1.0" }, makeDeps())
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("版本号格式不正确") });
  });

  it("成功发布：复用产物构建 + CI 上传 + publish_log 落库并返回结果", async () => {
    await uploadKey();
    const deps = makeDeps();

    const result = await MiniappPublishService.publish("t1", { remark: "测试发布" }, deps);

    expect(result).toMatchObject({
      publishLogId: 99,
      version: "1.0.0",
      status: "uploaded",
      mpUrl: expect.stringContaining("mp.weixin.qq.com"),
    });
    expect(deps.buildStagingFn).toHaveBeenCalledOnce();
    expect(deps.uploadFn).toHaveBeenCalledOnce();
    expect(deps.uploadFn.mock.calls[0][0]).toMatchObject({
      appId: "wx1234567890abcdef",
      version: "1.0.0",
      privateKeyPath: expect.stringContaining("private.key"),
    });
    // 发布日志：action='publish'、result='success'、status='uploaded'
    const logSql = (queryWithTenant as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logSql).toContain("t_miniapp_publish_log");
    expect(logSql).toContain("'publish'");
    expect((queryWithTenant as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("success");
  });

  it("上传失败时应写失败日志并抛 500 可读错误", async () => {
    await uploadKey();
    const deps = makeDeps(() => Promise.reject(new Error("upload boom")));

    await expect(
      MiniappPublishService.publish("t1", {}, deps)
    ).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining("upload boom") });

    // 失败日志：result='failed'、status='failed'、error_msg 记录原因
    const logSql = (queryWithTenant as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logSql).toContain("t_miniapp_publish_log");
    expect((queryWithTenant as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("failed");
    expect((queryWithTenant as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("upload boom");
  });

  it("publish 成功返回的 MiniappPublishError 类型可被 instanceof 识别", () => {
    const err = new MiniappPublishError(400, "测试");
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
  });
});
