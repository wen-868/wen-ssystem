/**
 * 即时零售平台适配器注册表
 * Instant Retail Platform Adapter Registry
 *
 * 负责管理所有平台适配器的注册与查找，
 * 支持运行时动态获取对应平台的适配器实例。
 */

import type { AbstractPlatformAdapter } from './base-adapter.js';
import type { PlatformType } from './types.js';

/** 适配器类构造函数类型 */
type AdapterConstructor = new (...args: any[]) => AbstractPlatformAdapter;

/** 内部注册表映射 */
const registry = new Map<PlatformType, AdapterConstructor>();

/**
 * 注册平台适配器
 * @param platform 平台类型标识
 * @param AdapterClass 适配器类构造函数
 */
export function register(platform: PlatformType, AdapterClass: AdapterConstructor): void {
  registry.set(platform, AdapterClass);
}

/**
 * 获取已注册的平台适配器类
 * @param platform 平台类型标识
 * @returns 适配器类构造函数，若未注册则返回 undefined
 */
export function getAdapterClass(platform: PlatformType): AdapterConstructor | undefined {
  return registry.get(platform);
}

/**
 * 判断指定平台是否已注册适配器
 * @param platform 平台类型标识
 * @returns 是否已注册
 */
export function hasAdapter(platform: PlatformType): boolean {
  return registry.has(platform);
}

/**
 * 获取所有已注册的平台类型列表
 * @returns 平台类型数组
 */
export function getRegisteredPlatforms(): PlatformType[] {
  return Array.from(registry.keys());
}

/**
 * 创建平台适配器实例
 * @param platform 平台类型标识
 * @param args 传递给适配器构造函数的参数
 * @returns 适配器实例，若未注册则抛出错误
 */
export function createAdapter(platform: PlatformType, ...args: any[]): AbstractPlatformAdapter {
  const AdapterClass = registry.get(platform);
  if (!AdapterClass) {
    throw new Error(`Adapter not registered for platform: ${platform}`);
  }
  return new AdapterClass(...args);
}
