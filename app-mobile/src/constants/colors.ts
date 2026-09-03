/**
 * 移动端颜色常量（R94-02 新增，UI1.2 打磨轮对齐 uni.scss token）
 * 与 uni.scss 中的 token 等值，供 script 侧 / 组件属性使用
 * （canvas、原生 switch color 等无法使用 SCSS 变量的场景）
 */

/* Atlas 品牌色（$uni-color-primary 系） */
export const COLOR_PRIMARY = '#2563EB'
export const COLOR_SUCCESS = '#3A9D5C'
export const COLOR_WARNING = '#C8803A'
export const COLOR_ERROR = '#C45050'
export const COLOR_WHITE = '#FFFFFF'               // $uni-bg-color / $uni-text-color-inverse
export const COLOR_BLACK_03 = 'rgba(0,0,0,0.03)'   // $zx-black-30

/* AI 设计色（与 uni.scss $ai-* 等值） */
export const AI_BG_SOFT = '#EFF6FF'
export const AI_TAB_ACTIVE = '#2563EB'
export const AI_SUCCESS = '#3A9D5C'
export const AI_SUCCESS_SOFT = '#EDF7F0'
export const AI_WARNING = '#C8803A'
export const AI_WARNING_SOFT = '#FBF3EA'
export const AI_DANGER = '#C45050'
export const AI_DANGER_SOFT = '#FBF0F0'
export const AI_BG_GAP = '#F5F5F7'
export const AI_TEXT_MID = '#737373'

/** 商品首字缩略图色板（8 单据原稿 prod-thumb，按商品名哈希取色） */
export const PRODUCT_THUMB_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#3B82F6',
  '#EC4899', '#06B6D4', '#10B981', '#0EA5E9',
] as const

/** 快速新增商品自动配色（原稿 NEW_COLORS） */
export const NEW_PRODUCT_COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#06B6D4', '#84CC16',
] as const

/** 商品详情首字缩略图色板（product-detail.vue 使用；10 色 = 8 单据原稿 + 品牌蓝 + 紫，按商品名哈希取色） */
export const PRODUCT_DETAIL_THUMB_COLORS = [
  '#2563EB', '#EF4444', '#F97316', '#EAB308', '#3B82F6',
  '#EC4899', '#06B6D4', '#10B981', '#0EA5E9', '#8B5CF6',
] as const
