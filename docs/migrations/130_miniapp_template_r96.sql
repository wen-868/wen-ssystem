-- ============================================
-- 迁移编号：130
-- 描述：t_miniapp_template 种子对齐 R96-01 三套新主题（A 深海蓝 / B 酒红金 / C 青翠）
-- 创建人：阿澈
-- 日期：2026-08-08
-- 说明：旧三套（经典蓝白/暖橙商务/深色臻品）置为 inactive；新三套幂等插入，
--       style_config 含 theme/primaryColor/gradient/backgroundColor/tabBar 色，
--       与 miniapp/config/themes.js 一一对应，供 R96-02 生成代码包替换使用。
-- ============================================

-- 1. 旧三套模板置为 inactive（幂等）
UPDATE t_miniapp_template
   SET status = 'inactive', updated_at = NOW()
 WHERE tenant_id = 'DEFAULT'
   AND name IN ('经典蓝白', '暖橙商务', '深色臻品')
   AND status = 'active';

-- 2. 插入新三套模板（WHERE NOT EXISTS 幂等，保留 DEFAULT 全局模板语义）
INSERT INTO t_miniapp_template
  (tenant_id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order)
SELECT 'DEFAULT',
       '商务经典 · 深海蓝',
       '深海蓝主色，稳重专业，适合批发与综合零售门店',
       '',
       '[]',
       '{"theme":"a","primaryColor":"#1e40af","gradientFrom":"#2563eb","gradientTo":"#1e40af","backgroundColor":"#f5f5f5","navBgColor":"#1e40af","navTextColor":"#ffffff","tabBarColor":"#999999","tabBarSelectedColor":"#1e40af","tabBarBgColor":"#ffffff"}',
       '{"homeLayout":"standard","productCardStyle":"grid","orderFlowStyle":"step","showBanner":true,"showCategoryNav":true,"showSearchBar":true}',
       '1.0.0', 'active', 1
 WHERE NOT EXISTS (
   SELECT 1 FROM t_miniapp_template
    WHERE tenant_id = 'DEFAULT' AND name = '商务经典 · 深海蓝'
 );

INSERT INTO t_miniapp_template
  (tenant_id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order)
SELECT 'DEFAULT',
       '高端酒红金 · 臻品',
       '酒红主色配香槟金点缀，高端质感，适合酒品专卖与品牌旗舰',
       '',
       '[]',
       '{"theme":"b","primaryColor":"#9d1f33","gradientFrom":"#b91c1c","gradientTo":"#7f1d2d","backgroundColor":"#faf7f2","navBgColor":"#7f1d2d","navTextColor":"#ffffff","tabBarColor":"#8a8a8a","tabBarSelectedColor":"#9d1f33","tabBarBgColor":"#ffffff","accentColor":"#c9a86a"}',
       '{"homeLayout":"featured","productCardStyle":"list","orderFlowStyle":"simple","showBanner":true,"showCategoryNav":true,"showSearchBar":true,"showPromotionBanner":true,"showBrandStory":true}',
       '1.0.0', 'active', 2
 WHERE NOT EXISTS (
   SELECT 1 FROM t_miniapp_template
    WHERE tenant_id = 'DEFAULT' AND name = '高端酒红金 · 臻品'
 );

INSERT INTO t_miniapp_template
  (tenant_id, name, description, thumbnail, preview_urls, style_config, page_config, version, status, sort_order)
SELECT 'DEFAULT',
       '清新活力 · 青翠',
       '青翠主色配青柠点缀，清新活力，适合便利店与年轻消费场景',
       '',
       '[]',
       '{"theme":"c","primaryColor":"#0e9f6e","gradientFrom":"#10b981","gradientTo":"#059669","backgroundColor":"#f2fbf7","navBgColor":"#059669","navTextColor":"#ffffff","tabBarColor":"#999999","tabBarSelectedColor":"#0e9f6e","tabBarBgColor":"#ffffff","accentColor":"#84cc16"}',
       '{"homeLayout":"standard","productCardStyle":"grid","orderFlowStyle":"step","showBanner":true,"showCategoryNav":true,"showSearchBar":true,"showPromotionBanner":true}',
       '1.0.0', 'active', 3
 WHERE NOT EXISTS (
   SELECT 1 FROM t_miniapp_template
    WHERE tenant_id = 'DEFAULT' AND name = '清新活力 · 青翠'
 );

-- 3. 验证：三套新模板应均为 active
SELECT name, status, JSON_EXTRACT(style_config, '$.theme') AS theme
  FROM t_miniapp_template
 WHERE tenant_id = 'DEFAULT'
 ORDER BY sort_order ASC;
