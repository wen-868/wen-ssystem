/**
 * miniprogram-ci 上传封装（R96-05）
 *
 * 动态 import「miniprogram-ci」，避免在未安装该依赖的环境中模块加载即失败；
 * 测试通过 mock 本模块（或注入假 uploadFn）验证一键发布链路。
 */

/** 上传参数（与 miniprogram-ci ICreateProjectOptions / IUploadOptions 对齐） */
export interface MiniappCiUploadParams {
  /** 小程序 AppID（wx 开头） */
  appId: string;
  /** 小程序产物目录（含 app.json/project.config.json） */
  projectPath: string;
  /** 解密后的上传密钥文件路径（.key） */
  privateKeyPath: string;
  /** 版本号（x.y.z） */
  version: string;
  /** 上传备注 */
  desc: string;
  /** 上传机器人编号 1~30，默认 1（体验版） */
  robot?: number;
}

export interface MiniappCiUploadResult {
  status: string;
  message: string;
}

export class MiniappCiService {
  /** 调用 miniprogram-ci 上传体验版 */
  static async upload(params: MiniappCiUploadParams): Promise<MiniappCiUploadResult> {
    // 动态 import：包体积较大且仅发布场景需要，避免拖慢服务启动
    const ci = await import("miniprogram-ci");
    const project = new ci.Project({
      appid: params.appId,
      type: "miniProgram",
      projectPath: params.projectPath,
      privateKeyPath: params.privateKeyPath,
      ignores: ["node_modules/**/*"],
    });
    await ci.upload({
      project,
      version: params.version,
      desc: params.desc,
      robot: params.robot ?? 1,
      setting: { es6: true, minify: true },
    });
    return {
      status: "uploaded",
      message: `体验版上传成功（版本 ${params.version}）`,
    };
  }
}
