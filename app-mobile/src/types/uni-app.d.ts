/**
 * uni-app 生命周期钩子类型补充
 * @dcloudio/uni-app 的类型定义中未导出部分生命周期钩子，
 * vue-tsc 检测时无法解析，但 uni-app 编译器会在运行时正确注入。
 * 此文件补充类型声明以消除 TypeScript 编译错误。
 */
declare module '@dcloudio/uni-app' {
  export function onLaunch(callback: () => void): void
  export function onShow(callback: () => void): void
  export function onHide(callback: () => void): void
  export function onLoad(callback: (options?: any) => void): void
}