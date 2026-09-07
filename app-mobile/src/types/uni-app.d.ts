/**
 * uni-app 生命周期钩子类型补充
 *
 * R96-03：原文件在此处有一个 declare module '@dcloudio/uni-app' 的本地声明
 * （仅手写了 onLaunch/onShow/onHide/onLoad 四个函数），是早期官方类型不全时的补丁。
 * 当前版本（3.0.0-5020320260806002）的官方 uni-app.d.ts 已导出全部生命周期钩子
 * 与 onShareAppMessage 等 20+ 成员；本地 ambient 声明会遮蔽官方完整类型，
 * 导致 import { onShareAppMessage } 报 TS2305「no exported member」。
 * 故删除该声明块，直接使用官方类型。下方 SQLite 类型补充仍保留（@dcloudio/types 未覆盖）。
 */

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