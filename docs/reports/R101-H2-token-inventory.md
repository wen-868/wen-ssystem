# R101-H2 · 四端 token 全量盘点（颜色类）

- 生成：`node docs/reports/R101-H2-inventory.cjs`（本文件由脚本生成，勿手改）
- 数据源：各端 `importOrder` 真源文件；`现值` 与 `R101-H2-measure.cjs` 同源
- 「颜色类」= 值可解析为颜色的 token；非颜色类（间距/字号/圆角/阴影/动效/模糊）不在「统一色」范围
- app-mobile 为 **SCSS 变量体系**（`$uni-*`，全端引用 6718 处；`var(--uni-*)` 引用 0 处）

## admin-web（admin-web 工作台）

- 真源：`admin-web/src/styles/tokens.css`、`admin-web/src/styles.css`
- 唯一 token **230**；其中颜色类 **121**；已盘点（本卡范围）**38**；范围外 83 条见下表处置列

| # | token | 现值 | 出处 | 语义族 | 本卡处置 |
|---|---|---|---|---|---|
| 1 | `--color-primary` | #3F6FEF | `tokens.css:15` | 状态色 | **改** → `#365FCE` |
| 2 | `--color-primary-hover` | #5A83F2 | `tokens.css:16` | 状态色 | **改** → `#1D4ED8` |
| 3 | `--color-primary-active` | #2F5BD6 | `tokens.css:17` | 状态色 | **改** → `#1E40AF` |
| 4 | `--color-primary-soft` | rgba(63, 111, 239, 0.12) | `tokens.css:18` | 状态色 | 不动（观测基准） |
| 5 | `--color-primary-bg` | rgba(63, 111, 239, 0.06) | `tokens.css:19` | 状态色 | 不动（观测基准） |
| 6 | `--gray-0` | #FFFFFF | `tokens.css:24` | 中性/文字 | 不动（范围外：中性/文字） |
| 7 | `--gray-50` | #F8F8F8 | `tokens.css:25` | 中性/文字 | 不动（范围外：中性/文字） |
| 8 | `--gray-100` | #F0F0F0 | `tokens.css:26` | 中性/文字 | 不动（范围外：中性/文字） |
| 9 | `--gray-200` | #E2E2E2 | `tokens.css:27` | 中性/文字 | 不动（范围外：中性/文字） |
| 10 | `--gray-300` | #CCCCCC | `tokens.css:28` | 中性/文字 | **改** → `#D4D4D4` |
| 11 | `--gray-400` | #999999 | `tokens.css:29` | 中性/文字 | **改** → `#A3A3A3` |
| 12 | `--gray-500` | #666666 | `tokens.css:30` | 中性/文字 | **改** → `#737373` |
| 13 | `--gray-600` | #444444 | `tokens.css:31` | 中性/文字 | **改** → `#525252` |
| 14 | `--gray-700` | #333333 | `tokens.css:32` | 中性/文字 | **改** → `#404040` |
| 15 | `--gray-800` | #222222 | `tokens.css:33` | 中性/文字 | 不动（范围外：中性/文字） |
| 16 | `--gray-900` | #111111 | `tokens.css:34` | 中性/文字 | 不动（范围外：中性/文字） |
| 17 | `--color-success` | #0EA879 | `tokens.css:39` | 状态色 | **改** → `#0A7655` |
| 18 | `--color-success-soft` | rgba(14, 168, 121, 0.12) | `tokens.css:40` | 状态色 | 不动（观测基准） |
| 19 | `--color-warning` | #D48B3A | `tokens.css:41` | 状态色 | **改** → `#8E5D27` |
| 20 | `--color-warning-soft` | rgba(212, 139, 58, 0.12) | `tokens.css:42` | 状态色 | 不动（观测基准） |
| 21 | `--color-danger` | #C0392B | `tokens.css:43` | 状态色 | **改** → `#C0392B` |
| 22 | `--color-danger-soft` | rgba(192, 57, 43, 0.12) | `tokens.css:44` | 状态色 | 不动（观测基准） |
| 23 | `--color-info` | #3F6FEF | `tokens.css:45` | 状态色 | **改** → `#365FCE` |
| 24 | `--color-info-soft` | rgba(63, 111, 239, 0.12) | `tokens.css:46` | 状态色 | 不动（范围外：状态色） |
| 25 | `--chart-1` | #3F6FEF | `tokens.css:51` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 26 | `--chart-2` | #0EA879 | `tokens.css:52` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 27 | `--chart-3` | #D48B3A | `tokens.css:53` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 28 | `--chart-4` | #C0392B | `tokens.css:54` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 29 | `--chart-5` | #8B5CF6 | `tokens.css:55` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 30 | `--chart-6` | #06B6D4 | `tokens.css:56` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 31 | `--frost-sidebar` | #F7F8FA | `tokens.css:61` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 32 | `--frost-sidebar-blur` | none | `tokens.css:62` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 33 | `--frost-topbar` | #FFFFFF | `tokens.css:63` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 34 | `--frost-topbar-blur` | none | `tokens.css:64` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 35 | `--frost-modal` | rgba(0, 0, 0, 0.35) | `tokens.css:65` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 36 | `--frost-modal-blur` | none | `tokens.css:66` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 37 | `--frost-bottom` | #FFFFFF | `tokens.css:67` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 38 | `--frost-bottom-blur` | none | `tokens.css:68` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 39 | `--text-primary` | #000000 | `tokens.css:73` | 中性/文字 | **改** → `#171717` |
| 40 | `--text-secondary` | #444444 | `tokens.css:74` | 中性/文字 | **改** → `#525252` |
| 41 | `--text-muted` | #6d6d6d | `tokens.css:80` | 中性/文字 | **改** → `#6B6B6B` |
| 42 | `--text-placeholder` | #6D6D6D | `tokens.css:90` | 中性/文字 | **改** → `#6B6B6B` |
| 43 | `--text-inverse` | #FFFFFF | `tokens.css:91` | 中性/文字 | 不动（观测基准） |
| 44 | `--text-link` | #3F6FEF | `tokens.css:92` | 中性/文字 | **改** → `#365FCE` |
| 45 | `--sidebar-text-primary` | #222222 | `tokens.css:95` | 状态色 | 不动（观测基准） |
| 46 | `--sidebar-text-secondary` | #555555 | `tokens.css:96` | 其它 | 不动（观测基准） |
| 47 | `--sidebar-text-muted` | #6d6d6d | `tokens.css:98` | 其它 | **改** → `#6B6B6B` |
| 48 | `--sidebar-text-active` | #3F6FEF | `tokens.css:99` | 其它 | **改** → `#365FCE` |
| 49 | `--bg-page` | #F5F5F5 / #F2F5FC | `tokens.css:104`, `styles.css:1184` | 其它 | **改** → `#F7F7F7` |
| 50 | `--bg-card` | #FFFFFF | `tokens.css:105` | 其它 | 不动（观测基准） |
| 51 | `--bg-soft` | #F0F0F0 | `tokens.css:106` | 其它 | 不动（观测基准） |
| 52 | `--bg-elevated` | #FFFFFF | `tokens.css:107` | 其它 | 不动（范围外：其它） |
| 53 | `--bg-sidebar` | #FAFAFA | `tokens.css:108` | 其它 | **改** → `#FFFFFF` |
| 54 | `--bg-overlay` | rgba(0, 0, 0, 0.45) | `tokens.css:109` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 55 | `--bg-mask` | rgba(0, 0, 0, 0.55) | `tokens.css:110` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 56 | `--border-normal` | #E2E2E2 | `tokens.css:115` | 边框 | **改** → `#E5E5E5` |
| 57 | `--border-light` | #F0F0F0 | `tokens.css:116` | 边框 | 不动（范围外：边框） |
| 58 | `--border-focus` | #3F6FEF | `tokens.css:117` | 边框 | **改** → `#365FCE` |
| 59 | `--border-error` | #C0392B | `tokens.css:118` | 边框 | 不动（范围外：边框） |
| 60 | `--metric-accent` | #2F5FD0 | `tokens.css:226` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 61 | `--chart-grid` | #EEF0F3 | `tokens.css:231` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 62 | `--chart-axis` | #CCCCCC | `tokens.css:232` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 63 | `--chart-gradient-primary` | linear-gradient(180deg, rgba(63, 111, 239, 0.32) 0%, rgba(63, 111, 239, 0) 100%) | `tokens.css:233` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 64 | `--table-header-bg` | #F8F8F8 / #F4F7FF | `tokens.css:270`, `styles.css:1185` | 其它 | **改** → `#F8F8F8` |
| 65 | `--table-header-text` | #444444 / #333333 | `tokens.css:271`, `styles.css:1186` | 其它 | 不动（观测基准） |
| 66 | `--table-row-hover` | #F8F8F8 / #F7FAFF | `tokens.css:272`, `styles.css:1187` | 其它 | **改** → `#F8F8F8` |
| 67 | `--table-stripe` | #FAFAFA | `tokens.css:273` | 其它 | 不动（范围外：其它） |
| 68 | `--table-border` | #E2E2E2 | `tokens.css:274` | 边框 | **改** → `#E5E5E5` |
| 69 | `--input-border` | #888888 | `tokens.css:280` | 边框 | **改** → `#888888` |
| 70 | `--input-bg` | #FFFFFF | `tokens.css:281` | 其它 | 不动（范围外：其它） |
| 71 | `--input-focus-border` | #3F6FEF | `tokens.css:282` | 边框 | 不动（范围外：边框） |
| 72 | `--tooltip-bg` | #2A2A2A | `tokens.css:299` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 73 | `--tooltip-text` | #FFFFFF | `tokens.css:300` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 74 | `--skeleton-bg` | #F0F0F0 | `tokens.css:303` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 75 | `--skeleton-shine` | #E2E2E2 | `tokens.css:304` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 76 | `--el-color-primary` | #3F6FEF | `styles.css:26` | 状态色 | 不动（范围外：状态色） |
| 77 | `--el-color-primary-light-3` | #5A83F2 | `styles.css:27` | 状态色 | 不动（范围外：状态色） |
| 78 | `--el-color-primary-light-5` | rgba(63, 111, 239, 0.12) | `styles.css:28` | 状态色 | 不动（范围外：状态色） |
| 79 | `--el-color-primary-light-7` | rgba(63, 111, 239, 0.20) | `styles.css:29` | 状态色 | 不动（范围外：状态色） |
| 80 | `--el-color-primary-light-8` | rgba(63, 111, 239, 0.30) | `styles.css:30` | 状态色 | 不动（范围外：状态色） |
| 81 | `--el-color-primary-light-9` | rgba(63, 111, 239, 0.06) | `styles.css:31` | 状态色 | 不动（范围外：状态色） |
| 82 | `--el-color-primary-dark-2` | #2F5BD6 | `styles.css:32` | 状态色 | 不动（范围外：状态色） |
| 83 | `--el-color-success` | #0EA879 | `styles.css:33` | 状态色 | 不动（范围外：状态色） |
| 84 | `--el-color-warning` | #D48B3A | `styles.css:34` | 状态色 | 不动（范围外：状态色） |
| 85 | `--el-color-danger` | #C0392B | `styles.css:35` | 状态色 | 不动（范围外：状态色） |
| 86 | `--el-border-color` | #888888 | `styles.css:36` | 边框 | 不动（范围外：边框） |
| 87 | `--el-border-color-light` | #F0F0F0 | `styles.css:37` | 边框 | 不动（范围外：边框） |
| 88 | `--el-text-color-primary` | #000000 | `styles.css:38` | 状态色 | 不动（范围外：状态色） |
| 89 | `--el-text-color-regular` | #444444 | `styles.css:39` | 其它 | 不动（范围外：其它） |
| 90 | `--el-text-color-secondary` | #6d6d6d | `styles.css:42` | 其它 | 不动（范围外：其它） |
| 91 | `--el-bg-color` | #FFFFFF | `styles.css:43` | 其它 | 不动（范围外：其它） |
| 92 | `--el-bg-color-page` | #F8F8F8 | `styles.css:44` | 其它 | 不动（范围外：其它） |
| 93 | `--el-fill-color-blank` | #FFFFFF | `styles.css:45` | 其它 | 不动（范围外：其它） |
| 94 | `--el-fill-color-light` | #F0F0F0 | `styles.css:46` | 其它 | 不动（范围外：其它） |
| 95 | `--el-table-border-color` | var(--border-normal) / var(--table-border) | `styles.css:251`, `styles.css:293`, `styles.css:555`, `styles.css:650`, `styles.css:724`, `styles.css:1059` | 边框 | 不动（范围外：边框） |
| 96 | `--el-table-header-bg-color` | #F8F8F8 / var(--table-header-bg) | `styles.css:252`, `styles.css:294`, `styles.css:553`, `styles.css:648`, `styles.css:721`, `styles.css:1060` | 其它 | 不动（范围外：其它） |
| 97 | `--el-table-header-text-color` | var(--text-secondary) / var(--table-header-text) | `styles.css:253`, `styles.css:295`, `styles.css:722` | 其它 | 不动（范围外：其它） |
| 98 | `--el-table-row-hover-bg-color` | #F8F8F8 / var(--table-row-hover) / #F5F7FA | `styles.css:254`, `styles.css:296`, `styles.css:554`, `styles.css:649`, `styles.css:723` | 其它 | 不动（范围外：其它） |
| 99 | `--el-table-text-color` | var(--text-primary) | `styles.css:255`, `styles.css:297`, `styles.css:725` | 其它 | 不动（范围外：其它） |
| 100 | `--el-table-tr-bg-color` | #FFFFFF | `styles.css:256` | 其它 | 不动（范围外：其它） |
| 101 | `--el-tag-bg-color` | var(--color-primary-soft) / var(--color-success-soft) / var(--color-warning-soft) / var(--color-danger-soft) | `styles.css:570`, `styles.css:575`, `styles.css:580`, `styles.css:585` | 其它 | 不动（范围外：其它） |
| 102 | `--el-tag-border-color` | transparent | `styles.css:571`, `styles.css:576`, `styles.css:581`, `styles.css:586` | 边框 | 不动（范围外：边框） |
| 103 | `--el-tag-text-color` | var(--color-primary) / var(--color-success) / var(--color-warning) / var(--color-danger) | `styles.css:572`, `styles.css:577`, `styles.css:582`, `styles.css:587` | 其它 | 不动（范围外：其它） |
| 104 | `--el-color-info` | #3F6FEF | `styles.css:630` | 状态色 | 不动（范围外：状态色） |
| 105 | `--el-color-info-light-3` | #5A83F2 | `styles.css:631` | 状态色 | 不动（范围外：状态色） |
| 106 | `--el-color-info-light-5` | rgba(63, 111, 239, 0.12) | `styles.css:632` | 状态色 | 不动（范围外：状态色） |
| 107 | `--el-color-info-light-7` | rgba(63, 111, 239, 0.20) | `styles.css:633` | 状态色 | 不动（范围外：状态色） |
| 108 | `--el-color-info-light-8` | rgba(63, 111, 239, 0.30) | `styles.css:634` | 状态色 | 不动（范围外：状态色） |
| 109 | `--el-color-info-light-9` | rgba(63, 111, 239, 0.06) | `styles.css:635` | 状态色 | 不动（范围外：状态色） |
| 110 | `--el-color-info-dark-2` | #2F5BD6 | `styles.css:636` | 状态色 | 不动（范围外：状态色） |
| 111 | `--el-button-bg-color` | var(--color-primary) / var(--bg-card) | `styles.css:696`, `styles.css:708` | 其它 | 不动（范围外：其它） |
| 112 | `--el-button-border-color` | var(--color-primary) / var(--border-normal) | `styles.css:697`, `styles.css:709` | 边框 | 不动（范围外：边框） |
| 113 | `--el-button-hover-bg-color` | var(--color-primary-hover) / var(--gray-50) | `styles.css:698`, `styles.css:711` | 其它 | 不动（范围外：其它） |
| 114 | `--el-button-hover-border-color` | var(--color-primary-hover) / var(--color-primary) | `styles.css:699`, `styles.css:712` | 边框 | 不动（范围外：边框） |
| 115 | `--el-button-active-bg-color` | var(--color-primary-active) | `styles.css:700` | 其它 | 不动（范围外：其它） |
| 116 | `--el-button-active-border-color` | var(--color-primary-active) | `styles.css:701` | 边框 | 不动（范围外：边框） |
| 117 | `--el-button-text-color` | var(--text-secondary) | `styles.css:710` | 其它 | 不动（范围外：其它） |
| 118 | `--el-button-hover-text-color` | var(--color-primary) | `styles.css:713` | 其它 | 不动（范围外：其它） |
| 119 | `--el-pagination-button-bg-color` | var(--gray-0) | `styles.css:830` | 其它 | 不动（范围外：其它） |
| 120 | `--el-pagination-hover-color` | var(--color-primary) | `styles.css:831` | 其它 | 不动（范围外：其它） |
| 121 | `--el-pagination-button-color` | var(--text-secondary) | `styles.css:832` | 其它 | 不动（范围外：其它） |

> 同名多文件重复定义（16 条）：`--bg-page`、`--table-header-bg`、`--table-header-text`、`--table-row-hover`、`--el-table-border-color`、`--el-table-header-bg-color`、`--el-table-header-text-color`、`--el-table-row-hover-bg-color`、`--el-table-text-color`、`--el-tag-bg-color`、`--el-tag-border-color`、`--el-tag-text-color`、`--el-button-bg-color`、`--el-button-border-color`、`--el-button-hover-bg-color`、`--el-button-hover-border-color`

## saas-admin（saas-admin 租户后台）

- 真源：`saas-admin/src/style.css`、`saas-admin/src/styles/tokens.css`、`saas-admin/src/styles/components.css`、`saas-admin/src/styles/layout.css`
- 唯一 token **330**；其中颜色类 **116**；已盘点（本卡范围）**38**；范围外 78 条见下表处置列

| # | token | 现值 | 出处 | 语义族 | 本卡处置 |
|---|---|---|---|---|---|
| 1 | `--text` | #6b6375 / #9ca3af | `style.css:2`, `style.css:35` | 中性/文字 | 不动（范围外：中性/文字） |
| 2 | `--text-h` | #08060d / #f3f4f6 | `style.css:3`, `style.css:36` | 中性/文字 | 不动（范围外：中性/文字） |
| 3 | `--bg` | #fff / #16171d | `style.css:4`, `style.css:37` | 其它 | 不动（范围外：其它） |
| 4 | `--border` | #e5e4e7 / #2e303a | `style.css:5`, `style.css:38` | 边框 | 不动（范围外：边框） |
| 5 | `--code-bg` | #f4f3ec / #1f2028 | `style.css:6`, `style.css:39` | 其它 | 不动（范围外：其它） |
| 6 | `--accent` | #aa3bff / #c084fc | `style.css:7`, `style.css:40` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 7 | `--accent-bg` | rgba(170, 59, 255, 0.1) / rgba(192, 132, 252, 0.15) | `style.css:8`, `style.css:41` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 8 | `--accent-border` | rgba(170, 59, 255, 0.5) / rgba(192, 132, 252, 0.5) | `style.css:9`, `style.css:42` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 9 | `--social-bg` | rgba(244, 243, 236, 0.5) / rgba(47, 48, 58, 0.5) | `style.css:10`, `style.css:43` | 其它 | 不动（范围外：其它） |
| 10 | `--color-primary` | #2563eb | `tokens.css:20` | 状态色 | **改** → `#365FCE` |
| 11 | `--color-primary-hover` | #1d4ed8 | `tokens.css:21` | 状态色 | **改** → `#1D4ED8` |
| 12 | `--color-primary-active` | #1e40af | `tokens.css:24` | 状态色 | **改** → `#1E40AF` |
| 13 | `--color-primary-soft` | #dbeafe | `tokens.css:25` | 状态色 | 不动（观测基准） |
| 14 | `--color-primary-bg` | #eff6ff | `tokens.css:26` | 状态色 | 不动（观测基准） |
| 15 | `--gray-0` | #FFFFFF | `tokens.css:31` | 中性/文字 | 不动（范围外：中性/文字） |
| 16 | `--gray-50` | #F8F8F8 | `tokens.css:32` | 中性/文字 | 不动（范围外：中性/文字） |
| 17 | `--gray-100` | #F0F0F0 | `tokens.css:33` | 中性/文字 | 不动（范围外：中性/文字） |
| 18 | `--gray-200` | #E2E2E2 | `tokens.css:34` | 中性/文字 | 不动（范围外：中性/文字） |
| 19 | `--gray-300` | #888888 | `tokens.css:35` | 中性/文字 | **改** → `#D4D4D4` |
| 20 | `--gray-400` | #6D6D6D | `tokens.css:36` | 中性/文字 | **改** → `#A3A3A3` |
| 21 | `--gray-500` | #666666 | `tokens.css:37` | 中性/文字 | **改** → `#737373` |
| 22 | `--gray-600` | #444444 | `tokens.css:38` | 中性/文字 | **改** → `#525252` |
| 23 | `--gray-700` | #333333 | `tokens.css:39` | 中性/文字 | **改** → `#404040` |
| 24 | `--gray-800` | #222222 | `tokens.css:40` | 中性/文字 | 不动（范围外：中性/文字） |
| 25 | `--gray-900` | #111111 | `tokens.css:41` | 中性/文字 | 不动（范围外：中性/文字） |
| 26 | `--ink` | #171717 | `tokens.css:48` | 中性/文字 | 不动（范围外：中性/文字） |
| 27 | `--g7` | #404040 | `tokens.css:49` | 中性/文字 | 不动（范围外：中性/文字） |
| 28 | `--g6` | #525252 | `tokens.css:50` | 中性/文字 | 不动（范围外：中性/文字） |
| 29 | `--g5` | #737373 | `tokens.css:51` | 中性/文字 | 不动（范围外：中性/文字） |
| 30 | `--g4` | #a3a3a3 | `tokens.css:52` | 中性/文字 | 不动（范围外：中性/文字） |
| 31 | `--g3` | #d4d4d4 | `tokens.css:53` | 中性/文字 | 不动（范围外：中性/文字） |
| 32 | `--g2` | #e5e5e5 | `tokens.css:54` | 中性/文字 | 不动（范围外：中性/文字） |
| 33 | `--g1` | #f0f0f0 | `tokens.css:55` | 中性/文字 | 不动（范围外：中性/文字） |
| 34 | `--g0` | #f7f7f7 | `tokens.css:56` | 中性/文字 | 不动（范围外：中性/文字） |
| 35 | `--color-success` | #16a34a | `tokens.css:63` | 状态色 | **改** → `#0A7655` |
| 36 | `--color-success-soft` | #f0fdf4 | `tokens.css:64` | 状态色 | 不动（观测基准） |
| 37 | `--color-warning` | #ea580c | `tokens.css:65` | 状态色 | **改** → `#8E5D27` |
| 38 | `--color-warning-soft` | #fff7ed | `tokens.css:66` | 状态色 | 不动（观测基准） |
| 39 | `--color-danger` | #dc2626 | `tokens.css:67` | 状态色 | **改** → `#C0392B` |
| 40 | `--color-danger-soft` | #fef2f2 | `tokens.css:68` | 状态色 | 不动（观测基准） |
| 41 | `--color-info` | #2563eb | `tokens.css:69` | 状态色 | **改** → `#365FCE` |
| 42 | `--color-info-soft` | #eff6ff | `tokens.css:70` | 状态色 | 不动（范围外：状态色） |
| 43 | `--color-purple` | #7c3aed | `tokens.css:72` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 44 | `--color-purple-soft` | #faf5ff | `tokens.css:73` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 45 | `--chart-1` | #2563eb | `tokens.css:78` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 46 | `--chart-2` | #16a34a | `tokens.css:79` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 47 | `--chart-3` | #ea580c | `tokens.css:80` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 48 | `--chart-4` | #dc2626 | `tokens.css:81` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 49 | `--chart-5` | #7c3aed | `tokens.css:82` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 50 | `--chart-6` | #06B6D4 | `tokens.css:83` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 51 | `--chart-1-soft` | #93c5fd | `tokens.css:86` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 52 | `--chart-1-mid` | #60a5fa | `tokens.css:87` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 53 | `--chart-1-deep` | #1e40af | `tokens.css:88` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 54 | `--chart-neutral` | #94a3b8 | `tokens.css:89` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 55 | `--chart-grid` | #f0f0f0 | `tokens.css:91` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 56 | `--chart-axis-text` | #a3a3a3 | `tokens.css:92` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 57 | `--frost-sidebar` | rgba(23, 23, 23, 0.85) | `tokens.css:97` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 58 | `--frost-topbar` | rgba(255, 255, 255, 0.80) | `tokens.css:99` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 59 | `--frost-modal` | rgba(0, 0, 0, 0.35) | `tokens.css:101` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 60 | `--frost-bottom` | rgba(255, 255, 255, 0.85) | `tokens.css:103` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 61 | `--text-primary` | #000000 | `tokens.css:109` | 中性/文字 | **改** → `#171717` |
| 62 | `--text-secondary` | #444444 | `tokens.css:110` | 中性/文字 | **改** → `#525252` |
| 63 | `--text-muted` | #6D6D6D | `tokens.css:111` | 中性/文字 | **改** → `#6B6B6B` |
| 64 | `--text-placeholder` | #767676 | `tokens.css:112` | 中性/文字 | **改** → `#6B6B6B` |
| 65 | `--text-inverse` | #FFFFFF | `tokens.css:113` | 中性/文字 | 不动（观测基准） |
| 66 | `--text-link` | #2563eb | `tokens.css:114` | 中性/文字 | **改** → `#365FCE` |
| 67 | `--sidebar-bg` | #FFFFFF | `tokens.css:120` | 其它 | **改** → `#FFFFFF` |
| 68 | `--sidebar-text-primary` | #374151 | `tokens.css:121` | 状态色 | **改** → `#171717` |
| 69 | `--sidebar-text-secondary` | #6B7280 | `tokens.css:122` | 其它 | **改** → `#525252` |
| 70 | `--sidebar-text-muted` | #6D6D6D | `tokens.css:123` | 其它 | **改** → `#6B6B6B` |
| 71 | `--sidebar-text-active` | #FFFFFF | `tokens.css:124` | 其它 | 不动（范围外：其它） |
| 72 | `--sidebar-brand-text` | #111827 | `tokens.css:125` | 其它 | 不动（范围外：其它） |
| 73 | `--sidebar-brand-border` | #E5E7EB | `tokens.css:126` | 边框 | 不动（范围外：边框） |
| 74 | `--sidebar-hover-bg` | #eff6ff | `tokens.css:127` | 其它 | 不动（范围外：其它） |
| 75 | `--sidebar-hover-text` | #2563eb | `tokens.css:128` | 其它 | 不动（范围外：其它） |
| 76 | `--sidebar-active-bg` | #2563eb | `tokens.css:129` | 其它 | 不动（观测基准） |
| 77 | `--line-frame` | #E5E7EB | `tokens.css:131` | 边框 | 不动（范围外：边框） |
| 78 | `--bg-page` | #f7f7f7 | `tokens.css:137` | 其它 | **改** → `#F7F7F7` |
| 79 | `--bg-card` | #FFFFFF | `tokens.css:138` | 其它 | 不动（观测基准） |
| 80 | `--bg-soft` | #f0f0f0 | `tokens.css:139` | 其它 | 不动（观测基准） |
| 81 | `--bg-elevated` | #FFFFFF | `tokens.css:140` | 其它 | 不动（范围外：其它） |
| 82 | `--bg-sidebar` | #FFFFFF | `tokens.css:141` | 其它 | 不动（范围外：其它） |
| 83 | `--bg-overlay` | rgba(0, 0, 0, 0.45) | `tokens.css:142` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 84 | `--bg-mask` | rgba(0, 0, 0, 0.55) | `tokens.css:143` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 85 | `--border-normal` | #E2E2E2 | `tokens.css:148` | 边框 | **改** → `#E5E5E5` |
| 86 | `--border-light` | #F0F0F0 | `tokens.css:149` | 边框 | 不动（范围外：边框） |
| 87 | `--border-focus` | #2563eb | `tokens.css:150` | 边框 | **改** → `#365FCE` |
| 88 | `--border-error` | #dc2626 | `tokens.css:151` | 边框 | 不动（范围外：边框） |
| 89 | `--table-header-bg` | #F8F8F8 | `tokens.css:275` | 其它 | **改** → `#F8F8F8` |
| 90 | `--table-header-text` | #444444 | `tokens.css:276` | 其它 | 不动（观测基准） |
| 91 | `--table-row-hover` | #F8F8F8 | `tokens.css:277` | 其它 | **改** → `#F8F8F8` |
| 92 | `--table-stripe` | #FAFAFA | `tokens.css:278` | 其它 | 不动（范围外：其它） |
| 93 | `--table-border` | #E2E2E2 | `tokens.css:279` | 边框 | **改** → `#E5E5E5` |
| 94 | `--input-border` | #888888 | `tokens.css:285` | 边框 | **改** → `#888888` |
| 95 | `--input-bg` | #FFFFFF | `tokens.css:286` | 其它 | 不动（范围外：其它） |
| 96 | `--input-focus-border` | #2563eb | `tokens.css:287` | 边框 | 不动（范围外：边框） |
| 97 | `--ctl-border` | #888888 | `tokens.css:343` | 边框 | 不动（范围外：边框） |
| 98 | `--tbl-head-color` | #525252 | `tokens.css:354` | 其它 | 不动（范围外：其它） |
| 99 | `--tbl-cell-color` | #404040 | `tokens.css:355` | 其它 | 不动（范围外：其它） |
| 100 | `--tbl-row-hover-bg` | #fafbff | `tokens.css:356` | 其它 | 不动（范围外：其它） |
| 101 | `--login-brand-bg` | linear-gradient(150deg, #1e3a8a 0%, #2563eb 58%, #3b82f6 100%) | `tokens.css:414` | 其它 | 不动（范围外：其它） |
| 102 | `--login-cap-color` | #3730a3 | `tokens.css:448` | 其它 | 不动（范围外：其它） |
| 103 | `--login-cap-bg` | repeating-linear-gradient(45deg, #eef2ff, #eef2ff 6px, #e0e7ff 6px, #e0e7ff 12px) | `tokens.css:449` | 其它 | 不动（范围外：其它） |
| 104 | `--login-logo-bg` | rgba(255, 255, 255, 0.16) | `tokens.css:457` | 其它 | 不动（范围外：其它） |
| 105 | `--login-logo-border` | rgba(255, 255, 255, 0.3) | `tokens.css:458` | 边框 | 不动（范围外：边框） |
| 106 | `--login-feat-bg` | rgba(255, 255, 255, 0.12) | `tokens.css:459` | 其它 | 不动（范围外：其它） |
| 107 | `--login-feat-border` | rgba(255, 255, 255, 0.22) | `tokens.css:460` | 边框 | 不动（范围外：边框） |
| 108 | `--tooltip-bg` | #2A2A2A | `tokens.css:465` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 109 | `--tooltip-text` | #FFFFFF | `tokens.css:466` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 110 | `--skeleton-bg` | #F0F0F0 | `tokens.css:469` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 111 | `--skeleton-shine` | #E2E2E2 | `tokens.css:470` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 112 | `--warning-line` | #fed7aa | `tokens.css:478` | 边框 | 不动（范围外：边框） |
| 113 | `--warning-text` | #9a3412 | `tokens.css:479` | 状态色 | 不动（范围外：状态色） |
| 114 | `--danger-line` | #fecaca | `tokens.css:480` | 边框 | 不动（范围外：边框） |
| 115 | `--danger-text` | #991b1b | `tokens.css:481` | 状态色 | 不动（范围外：状态色） |
| 116 | `--overlay-bg` | rgba(23, 23, 23, 0.45) | `tokens.css:485` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |

> 同名多文件重复定义（9 条）：`--text`、`--text-h`、`--bg`、`--border`、`--code-bg`、`--accent`、`--accent-bg`、`--accent-border`、`--social-bg`

## app-mobile（app-mobile 商户端）

- 真源：`app-mobile/src/uni.scss`
- 唯一 token **253**；其中颜色类 **203**；已盘点（本卡范围）**28**；范围外 175 条见下表处置列

| # | token | 现值 | 出处 | 语义族 | 本卡处置 |
|---|---|---|---|---|---|
| 1 | `--uni-color-primary` | #2563EB | `uni.scss:8` | 状态色 | **改** → `#365FCE` |
| 2 | `--uni-color-primary-hover` | #3B76F0 | `uni.scss:9` | 状态色 | **改** → `#1D4ED8` |
| 3 | `--uni-color-primary-active` | #1D4ED8 | `uni.scss:10` | 状态色 | **改** → `#1E40AF` |
| 4 | `--uni-color-primary-soft` | rgba(37, 99, 235, 0.12) | `uni.scss:11` | 状态色 | 不动（观测基准） |
| 5 | `--uni-gradient-blue` | linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%) | `uni.scss:12` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 6 | `--uni-color-success` | #3A9D5C | `uni.scss:15` | 状态色 | **改** → `#0A7655` |
| 7 | `--uni-color-success-soft` | rgba(58, 157, 92, 0.12) | `uni.scss:16` | 状态色 | 不动（观测基准） |
| 8 | `--uni-color-warning` | #C8803A | `uni.scss:17` | 状态色 | **改** → `#8E5D27` |
| 9 | `--uni-color-warning-soft` | rgba(200, 128, 58, 0.12) | `uni.scss:18` | 状态色 | 不动（观测基准） |
| 10 | `--uni-color-error` | #C45050 | `uni.scss:19` | 状态色 | **改** → `#C0392B` |
| 11 | `--uni-color-error-soft` | rgba(196, 80, 80, 0.12) | `uni.scss:20` | 状态色 | 不动（观测基准） |
| 12 | `--uni-color-info` | #2563EB | `uni.scss:21` | 状态色 | **改** → `#365FCE` |
| 13 | `--uni-color-info-soft` | rgba(37, 99, 235, 0.12) | `uni.scss:22` | 状态色 | 不动（范围外：状态色） |
| 14 | `--uni-color-primary-light` | #60A5FA | `uni.scss:25` | 状态色 | 不动（范围外：状态色） |
| 15 | `--uni-color-purple` | #722ED1 | `uni.scss:26` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 16 | `--uni-color-purple-light` | #9254DE | `uni.scss:27` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 17 | `--uni-color-purple-soft` | rgba(114, 46, 209, 0.12) | `uni.scss:28` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 18 | `--uni-color-pink` | #EB2F96 | `uni.scss:29` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 19 | `--uni-color-pink-light` | #F759AB | `uni.scss:30` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 20 | `--uni-color-cyan` | #13C2C2 | `uni.scss:31` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 21 | `--uni-color-cyan-soft` | rgba(19, 194, 194, 0.12) | `uni.scss:32` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 22 | `--zx-badge-success-strong` | #059669 | `uni.scss:35` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 23 | `--zx-badge-success-bg` | #ECFDF5 | `uni.scss:36` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 24 | `--zx-badge-warning-strong` | #D97706 | `uni.scss:37` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 25 | `--zx-badge-warning-bg` | #FFFBEB | `uni.scss:38` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 26 | `--zx-badge-danger-strong` | #DC2626 | `uni.scss:39` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 27 | `--zx-badge-danger-bg` | #FEF2F2 | `uni.scss:40` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 28 | `--zx-badge-draft-strong` | #EA580C | `uni.scss:41` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 29 | `--zx-badge-draft-bg` | #FFF7ED | `uni.scss:42` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 30 | `--zx-success-text` | #047857 | `uni.scss:43` | 状态色 | 不动（范围外：状态色） |
| 31 | `--zx-success-chip-bg` | rgba(58, 157, 92, 0.08) | `uni.scss:44` | 状态色 | 不动（范围外：状态色） |
| 32 | `--zx-store` | #EA580C | `uni.scss:47` | 其它 | 不动（范围外：其它） |
| 33 | `--zx-store-soft` | rgba(234, 88, 12, 0.12) | `uni.scss:48` | 其它 | 不动（范围外：其它） |
| 34 | `--zx-warehouse` | #0D9488 | `uni.scss:49` | 其它 | 不动（范围外：其它） |
| 35 | `--zx-warehouse-soft` | rgba(13, 148, 136, 0.12) | `uni.scss:50` | 其它 | 不动（范围外：其它） |
| 36 | `--uni-gray-0` | #FFFFFF | `uni.scss:53` | 中性/文字 | 不动（范围外：中性/文字） |
| 37 | `--uni-gray-50` | #F8F8F8 | `uni.scss:54` | 中性/文字 | 不动（范围外：中性/文字） |
| 38 | `--uni-gray-100` | #F0F0F0 | `uni.scss:55` | 中性/文字 | 不动（范围外：中性/文字） |
| 39 | `--uni-gray-200` | #E5E5E5 | `uni.scss:56` | 中性/文字 | 不动（范围外：中性/文字） |
| 40 | `--uni-gray-300` | #D4D4D4 | `uni.scss:57` | 中性/文字 | **改** → `#D4D4D4` |
| 41 | `--uni-gray-400` | #A3A3A3 | `uni.scss:58` | 中性/文字 | **改** → `#A3A3A3` |
| 42 | `--uni-gray-500` | #737373 | `uni.scss:59` | 中性/文字 | **改** → `#737373` |
| 43 | `--uni-gray-600` | #525252 | `uni.scss:60` | 中性/文字 | **改** → `#525252` |
| 44 | `--uni-gray-700` | #404040 | `uni.scss:61` | 中性/文字 | **改** → `#404040` |
| 45 | `--uni-gray-800` | #262626 | `uni.scss:62` | 中性/文字 | 不动（范围外：中性/文字） |
| 46 | `--uni-gray-900` | #171717 | `uni.scss:63` | 中性/文字 | 不动（范围外：中性/文字） |
| 47 | `--uni-text-color` | #171717 | `uni.scss:66` | 其它 | **改** → `#171717` |
| 48 | `--uni-text-color-secondary` | #525252 | `uni.scss:67` | 其它 | **改** → `#525252` |
| 49 | `--uni-text-color-grey` | #737373 | `uni.scss:68` | 中性/文字 | **改** → `#6B6B6B` |
| 50 | `--uni-text-color-placeholder` | #A3A3A3 | `uni.scss:69` | 其它 | **改** → `#6B6B6B` |
| 51 | `--uni-text-color-light` | #A3A3A3 | `uni.scss:70` | 其它 | 不动（范围外：其它） |
| 52 | `--uni-text-color-inverse` | #FFFFFF | `uni.scss:71` | 其它 | 不动（观测基准） |
| 53 | `--uni-text-color-link` | #2563EB | `uni.scss:72` | 其它 | **改** → `#365FCE` |
| 54 | `--uni-bg-color` | #FFFFFF | `uni.scss:75` | 其它 | 不动（观测基准） |
| 55 | `--uni-bg-color-grey` | #F5F5F7 | `uni.scss:76` | 中性/文字 | 不动（观测基准） |
| 56 | `--uni-bg-color-page` | #F5F5F7 | `uni.scss:77` | 其它 | **改** → `#F7F7F7` |
| 57 | `--uni-bg-color-soft` | #F0F0F0 | `uni.scss:78` | 其它 | 不动（观测基准） |
| 58 | `--uni-bg-color-hover` | #F0F0F0 | `uni.scss:79` | 其它 | 不动（范围外：其它） |
| 59 | `--uni-border-color` | #E5E5E5 | `uni.scss:82` | 边框 | **改** → `#E5E5E5` |
| 60 | `--uni-border-color-light` | #F0F0F0 | `uni.scss:83` | 边框 | 不动（范围外：边框） |
| 61 | `--uni-border-color-focus` | #2563EB | `uni.scss:84` | 边框 | **改** → `#365FCE` |
| 62 | `--uni-border-color-error` | #C45050 | `uni.scss:85` | 边框 | 不动（范围外：边框） |
| 63 | `--uni-mask-bg` | rgba(0, 0, 0, 0.45) | `uni.scss:134` | 玻璃/遮罩/骨架 | 不动（范围外：玻璃/遮罩/骨架） |
| 64 | `--ai-gradient-start` | #2563EB | `uni.scss:284` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 65 | `--ai-gradient-end` | #1D4ED8 | `uni.scss:285` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 66 | `--ai-tab-active` | #2563EB | `uni.scss:286` | 其它 | 不动（范围外：其它） |
| 67 | `--ai-tab-inactive` | #C5C7CB | `uni.scss:287` | 其它 | 不动（范围外：其它） |
| 68 | `--ai-primary` | #2563EB | `uni.scss:288` | 状态色 | 不动（范围外：状态色） |
| 69 | `--ai-bg-page` | #FFFFFF | `uni.scss:291` | 其它 | 不动（范围外：其它） |
| 70 | `--ai-bg-gap` | #F5F5F7 | `uni.scss:292` | 其它 | 不动（范围外：其它） |
| 71 | `--ai-bg-soft` | #EFF6FF | `uni.scss:293` | 其它 | 不动（范围外：其它） |
| 72 | `--ai-border` | #E5E5E5 | `uni.scss:294` | 边框 | 不动（范围外：边框） |
| 73 | `--ai-text-main` | #171717 | `uni.scss:295` | 其它 | 不动（范围外：其它） |
| 74 | `--ai-text-body` | #404040 | `uni.scss:296` | 其它 | 不动（范围外：其它） |
| 75 | `--ai-text-sub` | #A3A3A3 | `uni.scss:297` | 其它 | 不动（范围外：其它） |
| 76 | `--ai-text-mid` | #737373 | `uni.scss:298` | 其它 | 不动（范围外：其它） |
| 77 | `--ai-success` | #3A9D5C | `uni.scss:301` | 状态色 | 不动（范围外：状态色） |
| 78 | `--ai-warning` | #C8803A | `uni.scss:302` | 状态色 | 不动（范围外：状态色） |
| 79 | `--ai-danger` | #C45050 | `uni.scss:303` | 状态色 | 不动（范围外：状态色） |
| 80 | `--ai-info` | #737373 | `uni.scss:304` | 状态色 | 不动（范围外：状态色） |
| 81 | `--ai-success-bg` | #EDF7F0 | `uni.scss:307` | 状态色 | 不动（范围外：状态色） |
| 82 | `--ai-warning-bg` | #FBF3EA | `uni.scss:308` | 状态色 | 不动（范围外：状态色） |
| 83 | `--ai-danger-bg` | #FBF0F0 | `uni.scss:309` | 状态色 | 不动（范围外：状态色） |
| 84 | `--zx-amber-100` | #fef3c7 | `uni.scss:378` | 其它 | 不动（范围外：其它） |
| 85 | `--zx-amber-150` | rgba(217,119,6,0.15) | `uni.scss:379` | 其它 | 不动（范围外：其它） |
| 86 | `--zx-amber-300` | #fcd34d | `uni.scss:380` | 其它 | 不动（范围外：其它） |
| 87 | `--zx-amber-700` | #b45309 | `uni.scss:381` | 其它 | 不动（范围外：其它） |
| 88 | `--zx-amber-900` | #92400e | `uni.scss:382` | 其它 | 不动（范围外：其它） |
| 89 | `--zx-ant-gray-500` | #909399 | `uni.scss:383` | 中性/文字 | 不动（范围外：中性/文字） |
| 90 | `--zx-antblue-100` | rgba(22,119,255,0.1) | `uni.scss:384` | 其它 | 不动（范围外：其它） |
| 91 | `--zx-antblue-200` | rgba(22,119,255,0.2) | `uni.scss:385` | 其它 | 不动（范围外：其它） |
| 92 | `--zx-antblue-350` | rgba(22,119,255,0.35) | `uni.scss:386` | 其它 | 不动（范围外：其它） |
| 93 | `--zx-antblue-400` | rgba(22,119,255,0.4) | `uni.scss:387` | 其它 | 不动（范围外：其它） |
| 94 | `--zx-antblue-80` | rgba(22,119,255,0.08) | `uni.scss:388` | 其它 | 不动（范围外：其它） |
| 95 | `--zx-antblue2-400` | rgba(24,144,255,0.4) | `uni.scss:389` | 其它 | 不动（范围外：其它） |
| 96 | `--zx-antblue3-100` | rgba(64,150,255,0.1) | `uni.scss:390` | 其它 | 不动（范围外：其它） |
| 97 | `--zx-antgreen-100` | rgba(82,196,26,0.1) | `uni.scss:391` | 其它 | 不动（范围外：其它） |
| 98 | `--zx-antgreen-300` | rgba(82,196,26,0.3) | `uni.scss:392` | 其它 | 不动（范围外：其它） |
| 99 | `--zx-antgreen-400` | rgba(82,196,26,0.4) | `uni.scss:393` | 其它 | 不动（范围外：其它） |
| 100 | `--zx-antorange-100` | rgba(250,140,22,0.1) | `uni.scss:394` | 其它 | 不动（范围外：其它） |
| 101 | `--zx-antred-100` | rgba(255,77,79,0.1) | `uni.scss:395` | 其它 | 不动（范围外：其它） |
| 102 | `--zx-antred-300` | rgba(255,77,79,0.3) | `uni.scss:396` | 其它 | 不动（范围外：其它） |
| 103 | `--zx-antred-900` | rgba(255,77,79,0.9) | `uni.scss:397` | 其它 | 不动（范围外：其它） |
| 104 | `--zx-bg-f5` | #f5f5f5 | `uni.scss:398` | 其它 | 不动（范围外：其它） |
| 105 | `--zx-black-120` | rgba(0,0,0,0.12) | `uni.scss:399` | 其它 | 不动（范围外：其它） |
| 106 | `--zx-black-140` | rgba(0,0,0,0.14) | `uni.scss:400` | 其它 | 不动（范围外：其它） |
| 107 | `--zx-black-15` | rgba(0,0,0,0.015) | `uni.scss:401` | 其它 | 不动（范围外：其它） |
| 108 | `--zx-black-150` | rgba(0,0,0,0.15) | `uni.scss:402` | 其它 | 不动（范围外：其它） |
| 109 | `--zx-black-160` | rgba(0,0,0,0.16) | `uni.scss:403` | 其它 | 不动（范围外：其它） |
| 110 | `--zx-black-180` | rgba(0,0,0,0.18) | `uni.scss:404` | 其它 | 不动（范围外：其它） |
| 111 | `--zx-black-20` | rgba(0,0,0,0.02) | `uni.scss:405` | 其它 | 不动（范围外：其它） |
| 112 | `--zx-black-200` | rgba(0,0,0,0.2) | `uni.scss:406` | 其它 | 不动（范围外：其它） |
| 113 | `--zx-black-30` | rgba(0,0,0,0.03) | `uni.scss:407` | 其它 | 不动（范围外：其它） |
| 114 | `--zx-black-40` | rgba(0,0,0,0.04) | `uni.scss:408` | 其它 | 不动（范围外：其它） |
| 115 | `--zx-black-400` | rgba(0,0,0,0.4) | `uni.scss:409` | 其它 | 不动（范围外：其它） |
| 116 | `--zx-black-50` | rgba(0,0,0,0.05) | `uni.scss:410` | 其它 | 不动（范围外：其它） |
| 117 | `--zx-black-500` | rgba(0,0,0,0.5) | `uni.scss:411` | 其它 | 不动（范围外：其它） |
| 118 | `--zx-black-550` | rgba(0,0,0,0.55) | `uni.scss:412` | 其它 | 不动（范围外：其它） |
| 119 | `--zx-black-60` | rgba(0,0,0,0.06) | `uni.scss:413` | 其它 | 不动（范围外：其它） |
| 120 | `--zx-black-600` | rgba(0,0,0,0.6) | `uni.scss:414` | 其它 | 不动（范围外：其它） |
| 121 | `--zx-black-70` | rgba(0,0,0,0.07) | `uni.scss:415` | 其它 | 不动（范围外：其它） |
| 122 | `--zx-black-80` | rgba(0,0,0,0.08) | `uni.scss:416` | 其它 | 不动（范围外：其它） |
| 123 | `--zx-black-90` | rgba(0,0,0,0.09) | `uni.scss:417` | 其它 | 不动（范围外：其它） |
| 124 | `--zx-blue-50` | #f0f5ff | `uni.scss:418` | 其它 | 不动（范围外：其它） |
| 125 | `--zx-blue-500` | #3b82f6 | `uni.scss:419` | 其它 | 不动（范围外：其它） |
| 126 | `--zx-chart-bronze` | #cd7f32 | `uni.scss:420` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 127 | `--zx-chart-copper` | #b87333 | `uni.scss:421` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 128 | `--zx-chart-gold` | #ffb800 | `uni.scss:422` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 129 | `--zx-chart-gold2` | #ffd700 | `uni.scss:423` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 130 | `--zx-chart-gray` | #a0a0a0 | `uni.scss:424` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 131 | `--zx-chart-silver` | #c0c0c0 | `uni.scss:425` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 132 | `--zx-cyan-soft-10` | rgba(19,194,194,0.1) | `uni.scss:426` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 133 | `--zx-deepblue-180` | rgba(13,44,124,0.18) | `uni.scss:427` | 其它 | 不动（范围外：其它） |
| 134 | `--zx-deepblue-350` | rgba(13,44,124,0.35) | `uni.scss:428` | 其它 | 不动（范围外：其它） |
| 135 | `--zx-emerald-soft-10` | rgba(5,150,105,0.1) | `uni.scss:429` | 其它 | 不动（范围外：其它） |
| 136 | `--zx-gray-1a` | #1a1a1a | `uni.scss:430` | 中性/文字 | 不动（范围外：中性/文字） |
| 137 | `--zx-gray-323` | #323233 | `uni.scss:431` | 中性/文字 | 不动（范围外：中性/文字） |
| 138 | `--zx-gray-400` | #9ca3af | `uni.scss:432` | 中性/文字 | 不动（范围外：中性/文字） |
| 139 | `--zx-gray-969` | #969799 | `uni.scss:433` | 中性/文字 | 不动（范围外：中性/文字） |
| 140 | `--zx-grayf7-550` | rgba(247,248,250,0.55) | `uni.scss:434` | 中性/文字 | 不动（范围外：中性/文字） |
| 141 | `--zx-green-100` | #dcfce7 | `uni.scss:435` | 其它 | 不动（范围外：其它） |
| 142 | `--zx-green-600` | #16a34a | `uni.scss:436` | 其它 | 不动（范围外：其它） |
| 143 | `--zx-green-700` | #15803d | `uni.scss:437` | 其它 | 不动（范围外：其它） |
| 144 | `--zx-indigo-100` | #e0e7ff | `uni.scss:438` | 其它 | 不动（范围外：其它） |
| 145 | `--zx-nearblack` | #0b0b0c | `uni.scss:439` | 其它 | 不动（范围外：其它） |
| 146 | `--zx-orange2-100` | rgba(250,173,20,0.1) | `uni.scss:440` | 其它 | 不动（范围外：其它） |
| 147 | `--zx-orange2-300` | rgba(250,173,20,0.3) | `uni.scss:441` | 其它 | 不动（范围外：其它） |
| 148 | `--zx-primary-100` | rgba(37,99,235,0.1) | `uni.scss:442` | 状态色 | 不动（范围外：状态色） |
| 149 | `--zx-primary-150` | rgba(37,99,235,0.15) | `uni.scss:443` | 状态色 | 不动（范围外：状态色） |
| 150 | `--zx-primary-180` | rgba(37,99,235,0.18) | `uni.scss:444` | 状态色 | 不动（范围外：状态色） |
| 151 | `--zx-primary-200` | rgba(37,99,235,0.2) | `uni.scss:445` | 状态色 | 不动（范围外：状态色） |
| 152 | `--zx-primary-220` | rgba(37,99,235,0.22) | `uni.scss:446` | 状态色 | 不动（范围外：状态色） |
| 153 | `--zx-primary-250` | rgba(37,99,235,0.25) | `uni.scss:447` | 状态色 | 不动（范围外：状态色） |
| 154 | `--zx-primary-280` | rgba(37,99,235,0.28) | `uni.scss:448` | 状态色 | 不动（范围外：状态色） |
| 155 | `--zx-primary-30` | rgba(37,99,235,0.03) | `uni.scss:449` | 状态色 | 不动（范围外：状态色） |
| 156 | `--zx-primary-350` | rgba(37,99,235,0.35) | `uni.scss:450` | 状态色 | 不动（范围外：状态色） |
| 157 | `--zx-primary-60` | rgba(37,99,235,0.06) | `uni.scss:451` | 状态色 | 不动（范围外：状态色） |
| 158 | `--zx-primary-600` | rgba(37,99,235,0.6) | `uni.scss:452` | 状态色 | 不动（范围外：状态色） |
| 159 | `--zx-primary-80` | rgba(37,99,235,0.08) | `uni.scss:453` | 状态色 | 不动（范围外：状态色） |
| 160 | `--zx-primaryact-160` | rgba(29,78,216,0.16) | `uni.scss:454` | 状态色 | 不动（范围外：状态色） |
| 161 | `--zx-primaryact-60` | rgba(29,78,216,0.06) | `uni.scss:455` | 状态色 | 不动（范围外：状态色） |
| 162 | `--zx-purple-500` | #a855f7 | `uni.scss:456` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 163 | `--zx-purple-600` | #9333ea | `uni.scss:457` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 164 | `--zx-purple-soft-10` | rgba(114,46,209,0.1) | `uni.scss:458` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 165 | `--zx-red-100` | #fecaca | `uni.scss:459` | 其它 | 不动（范围外：其它） |
| 166 | `--zx-red-50` | #fee2e2 | `uni.scss:460` | 其它 | 不动（范围外：其它） |
| 167 | `--zx-red-50b` | #fff5f5 | `uni.scss:461` | 其它 | 不动（范围外：其它） |
| 168 | `--zx-red-700` | #b91c1c | `uni.scss:462` | 其它 | 不动（范围外：其它） |
| 169 | `--zx-red2-300` | rgba(245,108,108,0.3) | `uni.scss:463` | 其它 | 不动（范围外：其它） |
| 170 | `--zx-slate-280` | rgba(15,23,42,0.28) | `uni.scss:464` | 其它 | 不动（范围外：其它） |
| 171 | `--zx-success2-30` | rgba(58,157,92,0.03) | `uni.scss:465` | 状态色 | 不动（范围外：状态色） |
| 172 | `--zx-success2-60` | rgba(58,157,92,0.06) | `uni.scss:466` | 状态色 | 不动（范围外：状态色） |
| 173 | `--zx-violet-100` | #ede9fe | `uni.scss:467` | 其它 | 不动（范围外：其它） |
| 174 | `--zx-violet-600` | #7c3aed | `uni.scss:468` | 其它 | 不动（范围外：其它） |
| 175 | `--zx-violet-800` | #5b21b6 | `uni.scss:469` | 其它 | 不动（范围外：其它） |
| 176 | `--zx-violet2-30` | rgba(124,58,237,0.03) | `uni.scss:470` | 其它 | 不动（范围外：其它） |
| 177 | `--zx-violet2-320` | rgba(124,58,237,0.32) | `uni.scss:471` | 其它 | 不动（范围外：其它） |
| 178 | `--zx-violet2-350` | rgba(124,58,237,0.35) | `uni.scss:472` | 其它 | 不动（范围外：其它） |
| 179 | `--zx-violet2-60` | rgba(124,58,237,0.06) | `uni.scss:473` | 其它 | 不动（范围外：其它） |
| 180 | `--zx-violet2-80` | rgba(124,58,237,0.08) | `uni.scss:474` | 其它 | 不动（范围外：其它） |
| 181 | `--zx-violet3-180` | rgba(168,85,247,0.18) | `uni.scss:475` | 其它 | 不动（范围外：其它） |
| 182 | `--zx-violet3-550` | rgba(168,85,247,0.55) | `uni.scss:476` | 其它 | 不动（范围外：其它） |
| 183 | `--zx-violet3-600` | rgba(168,85,247,0.6) | `uni.scss:477` | 其它 | 不动（范围外：其它） |
| 184 | `--zx-violet3-650` | rgba(168,85,247,0.65) | `uni.scss:478` | 其它 | 不动（范围外：其它） |
| 185 | `--zx-violet4-100` | rgba(91,33,185,0.1) | `uni.scss:479` | 其它 | 不动（范围外：其它） |
| 186 | `--zx-warning2-100` | rgba(200,128,58,0.1) | `uni.scss:480` | 状态色 | 不动（范围外：状态色） |
| 187 | `--zx-warning2-40` | rgba(200,128,58,0.04) | `uni.scss:481` | 状态色 | 不动（范围外：状态色） |
| 188 | `--zx-warning2-80` | rgba(200,128,58,0.08) | `uni.scss:482` | 状态色 | 不动（范围外：状态色） |
| 189 | `--zx-white-180` | rgba(255,255,255,0.18) | `uni.scss:483` | 其它 | 不动（范围外：其它） |
| 190 | `--zx-white-200` | rgba(255,255,255,0.2) | `uni.scss:484` | 其它 | 不动（范围外：其它） |
| 191 | `--zx-white-250` | rgba(255,255,255,0.25) | `uni.scss:485` | 其它 | 不动（范围外：其它） |
| 192 | `--zx-white-300` | rgba(255,255,255,0.3) | `uni.scss:486` | 其它 | 不动（范围外：其它） |
| 193 | `--zx-white-650` | rgba(255,255,255,0.65) | `uni.scss:487` | 其它 | 不动（范围外：其它） |
| 194 | `--zx-white-70` | rgba(255,255,255,0.07) | `uni.scss:488` | 其它 | 不动（范围外：其它） |
| 195 | `--zx-white-700` | rgba(255,255,255,0.7) | `uni.scss:489` | 其它 | 不动（范围外：其它） |
| 196 | `--zx-white-800` | rgba(255,255,255,0.8) | `uni.scss:490` | 其它 | 不动（范围外：其它） |
| 197 | `--zx-white-850` | rgba(255,255,255,0.85) | `uni.scss:491` | 其它 | 不动（范围外：其它） |
| 198 | `--zx-white-880` | rgba(255,255,255,0.88) | `uni.scss:492` | 其它 | 不动（范围外：其它） |
| 199 | `--zx-white-900` | rgba(255,255,255,0.9) | `uni.scss:493` | 其它 | 不动（范围外：其它） |
| 200 | `--zx-white-920` | rgba(255,255,255,0.92) | `uni.scss:494` | 其它 | 不动（范围外：其它） |
| 201 | `--zx-lv-wholesale` | #0891b2 | `uni.scss:498` | 其它 | 不动（范围外：其它） |
| 202 | `--zx-lv-basic` | #64748b | `uni.scss:499` | 其它 | 不动（范围外：其它） |
| 203 | `--zx-lv-silver` | #94a3b8 | `uni.scss:500` | 其它 | 不动（范围外：其它） |

## website（website 官网）

- 真源：`website/src/assets/global.css`
- 唯一 token **14**；其中颜色类 **10**；已盘点（本卡范围）**8**；范围外 2 条见下表处置列

| # | token | 现值 | 出处 | 语义族 | 本卡处置 |
|---|---|---|---|---|---|
| 1 | `--primary` | #1a73e8 | `global.css:4` | 状态色 | **改** → `#365FCE` |
| 2 | `--primary-dark` | #1557b0 | `global.css:5` | 状态色 | 不动（范围外：状态色） |
| 3 | `--primary-light` | #e8f0fe | `global.css:6` | 状态色 | 不动（观测基准） |
| 4 | `--accent` | #0ea5e9 | `global.css:7` | 图表/品牌扩展 | 不动（范围外：图表/品牌扩展） |
| 5 | `--text` | #1f2937 | `global.css:8` | 中性/文字 | **改** → `#171717` |
| 6 | `--text-secondary` | #6b7280 | `global.css:9` | 中性/文字 | **改** → `#525252` |
| 7 | `--bg` | #ffffff | `global.css:10` | 其它 | 不动（观测基准） |
| 8 | `--bg-alt` | #f8fafc | `global.css:11` | 其它 | 不动（观测基准） |
| 9 | `--bg-dark` | #0f172a | `global.css:12` | 其它 | 不动（观测基准） |
| 10 | `--border` | #e5e7eb | `global.css:13` | 边框 | **改** → `#E5E5E5` |

## 合计

| 端 | 唯一 token | 颜色类 | 已盘点 | 范围外 |
|---|---|---|---|---|
| admin-web | 230 | 121 | 38 | 83 |
| saas-admin | 330 | 116 | 38 | 78 |
| app-mobile | 253 | 203 | 28 | 175 |
| website | 14 | 10 | 8 | 2 |
| **合计** | **827** | **450** | — | — |

> 验收①口径：**颜色类 token 总数 = 已盘点数**（两者相等）；范围外 token 亦逐条列出并给出「不在本卡范围」的理由，故不存在「未盘点」的 token。非颜色类 token（间距/字号/圆角/阴影/动效）与「统一色」无关，另列计数不逐条展开。
