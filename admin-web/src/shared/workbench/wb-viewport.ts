/**
 * 视口断点（WORKBENCH-10-F1 补齐项 F · 390px）。
 *
 * 原型是 1440 桌面稿，没有移动端布局 ⇒ 这里只定义「什么算窄视口」这一个真相源，
 * 布局降级（rail→底部条、二级导航→抽屉、主面单列）写在各组件的 @media 里，
 * 由本模块的 `WB_NARROW_MAX_WIDTH_PX` 与其媒体查询逐字对齐（测试比对）。
 */

/** 卡片口径：390px（iPhone 12/13/14 逻辑宽度）及以下视为窄视口 */
export const WB_NARROW_MAX_WIDTH_PX = 390;

/** 与 CSS `@media (max-width: 390px)` 同义的唯一查询串 */
export const WB_NARROW_MEDIA_QUERY = `(max-width: ${WB_NARROW_MAX_WIDTH_PX}px)`;

/** 纯函数：给定宽度是否落入窄视口（宽度取不到 ⇒ 按桌面处理，不做窄化猜测） */
export function isNarrowViewport(width: number | null | undefined): boolean {
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return false;
  return width <= WB_NARROW_MAX_WIDTH_PX;
}

/**
 * 窄视口下的三列壳层是否会裁剪：桌面口径 60 + 230 = 290px 固定列宽。
 * 只用于测试断言「窄视口必须放弃三列」，不参与运行时布局。
 */
export const DESKTOP_SIDE_COLUMNS_PX = 60 + 230;

export function desktopColumnsClip(width: number): boolean {
  return isNarrowViewport(width) && DESKTOP_SIDE_COLUMNS_PX >= width * 0.5;
}
