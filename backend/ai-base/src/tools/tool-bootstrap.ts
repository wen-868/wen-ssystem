import { Injectable, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { EchoTool } from './definitions/echo.tool';

/**
 * Tool 注册引导器
 *
 * 职责：在 NestJS 模块初始化阶段，将所有 ITool 实现集中注册到 ToolRegistry。
 *
 * 设计理由：
 * - ToolRegistry 保持纯粹（只负责存储/查询/生成定义），不依赖具体工具实现
 * - ToolBootstrap 集中管理工具注册，后续新增工具只需在此处注入并 registerAll
 * - 利用 NestJS OnModuleInit 生命周期，确保工具在服务接收请求前完成注册
 *
 * 后续 R70-09~13 新增业务工具时：
 * 1. 创建 src/tools/definitions/xxx.tool.ts（实现 ITool）
 * 2. 在本类构造函数注入该工具
 * 3. 在 onModuleInit 的 registerAll 数组中添加该工具
 *
 * 注意：本 provider 不被任何模块 export，仅用于触发注册副作用，
 * 必须在 ToolsModule.providers 中声明才能生效。
 */
@Injectable()
export class ToolBootstrap implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly echoTool: EchoTool,
  ) {}

  onModuleInit(): void {
    // 集中注册所有工具（R70-09~13 会逐步追加 order/inventory/product 等业务工具）
    this.registry.registerAll([this.echoTool]);
  }
}
