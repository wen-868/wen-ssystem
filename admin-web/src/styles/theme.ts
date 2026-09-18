/**
 * 图表色常量（canvas / ECharts 专用）
 *
 * ECharts / canvas 不支持 CSS 变量（var()），图表色只能使用字面值。
 * 本常量与 styles/tokens.css 的 token 取值保持一致，作为图表色的唯一真相源：
 * 品牌或主题变更时只需修改此处，避免散落 hex 不同步（R84-03 常量化专项）。
 */
export const CHART_COLORS = {
  primary: "#3F6FEF",
  success: "#0EA879",
  warning: "#D48B3A",
  danger: "#C0392B",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  gray100: "#F0F0F0",
  info: "#909399",
  textMuted: "#6D6D6D", // S3-47/S3-53（可达性优先）：原 #999999 白底图表 2.85:1 不达标；#6D6D6D=5.17:1 满足 WCAG AA 4.5:1。axe 扫不到 canvas 内文字，此值由 scripts/contrast-check.cjs 的 token×surface 矩阵替代核查（见 docs/design 工作台页面设计规范.md §八）
  textSecondary: "#444444",
};
