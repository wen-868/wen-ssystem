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

/**
 * uni-app SQLite API 类型补充
 *
 * @dcloudio/types 中未声明 uni.openDatabase / uni.executeSql / uni.selectSql / uni.closeDatabase
 * 的类型定义（仅在 APP-PLUS 平台支持），vue-tsc 检测时报 TS2339。
 * 这些 API 在 uni-app 编译器运行时会正确注入（仅 APP-PLUS 平台），
 * 此处通过 interface 合并机制补充类型声明以消除 TypeScript 编译错误。
 *
 * 文档：https://uniapp.dcloud.net.cn/api/system/database.html
 */
interface UniDatabaseOptions {
  /** 数据库名称 */
  name: string
  /** 数据库文件路径（不传使用默认 _doc/ 目录） */
  path?: string
  /** 成功回调 */
  success?: (res: any) => void
  /** 失败回调 */
  fail?: (err: any) => void
  /** 完成回调 */
  complete?: () => void
}

interface UniExecuteSqlOptions {
  /** 数据库名称 */
  name: string
  /** SQL 语句 */
  sql: string
  /** 成功回调 */
  success?: (res: any) => void
  /** 失败回调 */
  fail?: (err: any) => void
  /** 完成回调 */
  complete?: () => void
}

interface UniSelectSqlOptions {
  /** 数据库名称 */
  name: string
  /** SQL 语句（SELECT） */
  sql: string
  /** 成功回调 */
  success?: (res: { data: any[] }) => void
  /** 失败回调 */
  fail?: (err: any) => void
  /** 完成回调 */
  complete?: () => void
}

interface UniCloseDatabaseOptions {
  /** 数据库名称 */
  name: string
  /** 成功回调 */
  success?: (res: any) => void
  /** 失败回调 */
  fail?: (err: any) => void
  /** 完成回调 */
  complete?: () => void
}

interface Uni {
  /** 打开数据库（仅 APP-PLUS 平台支持） */
  openDatabase(options: UniDatabaseOptions): void
  /** 执行非查询 SQL（INSERT/UPDATE/DELETE/CREATE 等，仅 APP-PLUS 平台支持） */
  executeSql(options: UniExecuteSqlOptions): void
  /** 执行查询 SQL（SELECT，仅 APP-PLUS 平台支持） */
  selectSql(options: UniSelectSqlOptions): void
  /** 关闭数据库（仅 APP-PLUS 平台支持） */
  closeDatabase(options: UniCloseDatabaseOptions): void
}