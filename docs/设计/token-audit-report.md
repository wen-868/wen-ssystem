# 总后台（saas-admin）令牌与视觉漂移审计报告

> 单号 TOTAL-SAAS-UI-TOKENS-01｜审计人 林夕｜生成脚本 `docs/设计/token-audit.mjs`
> 扫描 84 个文件，令牌定义 323 个，合计问题 **0** 处

| 维度 | 数量 |
|---|---|
| ① 未定义令牌引用 | 0 |
| ② 硬编码色值 | 0 |
| ③ 硬编码圆角 | 0 |
| ③ 硬编码阴影 | 0 |
| ④ 与 admin-web 同名不同值 | 61 |
| ⑤ Element 跨体系漂移（未收口） | 8 |

> 说明：①②③ 为本仓代码可自行收口项，目标恒为 0；④⑤ 为**跨体系/跨产品**对齐项，需评审后决定，不计入收口 KPI。

## ① 未定义令牌引用（0）

（无）

## ② 硬编码色值（0）

（无）

## ③ 硬编码圆角（0）

（无）

## ③ 硬编码阴影（0）

（无）

## ④ 与 admin-web 同名不同值（令牌漂移）

| 令牌 | saas-admin | admin-web |
|---|---|---|
| `--color-primary` | #2563eb | #3F6FEF |
| `--color-primary-hover` | #1d4ed8 | #5A83F2 |
| `--color-primary-active` | #1e40af | #2F5BD6 |
| `--color-primary-soft` | #dbeafe | rgba(63, 111, 239, 0.12) |
| `--color-primary-bg` | #eff6ff | rgba(63, 111, 239, 0.06) |
| `--gray-300` | #888888 | #CCCCCC |
| `--gray-400` | #6D6D6D | #999999 |
| `--color-success` | #16a34a | #0EA879 |
| `--color-success-soft` | #f0fdf4 | rgba(14, 168, 121, 0.12) |
| `--color-success-text` | #15803D | #0A7655 |
| `--color-warning` | #ea580c | #D48B3A |
| `--color-warning-soft` | #fff7ed | rgba(212, 139, 58, 0.12) |
| `--color-danger` | #dc2626 | #C0392B |
| `--color-danger-soft` | #fef2f2 | rgba(192, 57, 43, 0.12) |
| `--color-info` | #2563eb | #3F6FEF |
| `--color-info-soft` | #eff6ff | rgba(63, 111, 239, 0.12) |
| `--chart-1` | #2563eb | #3F6FEF |
| `--chart-2` | #16a34a | #0EA879 |
| `--chart-3` | #ea580c | #D48B3A |
| `--chart-4` | #dc2626 | #C0392B |
| `--chart-5` | #7c3aed | #8B5CF6 |
| `--chart-grid` | #f0f0f0 | #EEF0F3 |
| `--frost-sidebar` | rgba(23, 23, 23, 0.85) | #F7F8FA |
| `--frost-sidebar-blur` | blur(16px) | none |
| `--frost-topbar` | rgba(255, 255, 255, 0.80) | #FFFFFF |
| `--frost-topbar-blur` | blur(16px) | none |
| `--frost-modal-blur` | blur(8px) | none |
| `--frost-bottom` | rgba(255, 255, 255, 0.85) | #FFFFFF |
| `--frost-bottom-blur` | blur(16px) | none |
| `--text-placeholder` | #767676 | #6D6D6D |
| `--text-link` | #2563eb | #365FCE |
| `--sidebar-text-primary` | #374151 | #222222 |
| `--sidebar-text-secondary` | #6B7280 | #555555 |
| `--sidebar-text-active` | #FFFFFF | #365FCE |
| `--bg-page` | #f7f7f7 | #F5F5F5 |
| `--bg-sidebar` | #FFFFFF | #FAFAFA |
| `--border-focus` | #2563eb | #3F6FEF |
| `--border-error` | #dc2626 | #C0392B |
| `--font-family` | "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif | "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif |
| `--space-page-padding` | 24px | clamp(12px, 1.2vw, 24px) |
| `--shadow-xs` | 0 1px 2px rgba(0, 0, 0, 0.04) | 0 1px 2px rgba(16, 24, 40, 0.04) |
| `--shadow-sm` | 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03) | 0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04) |
| `--shadow-md` | 0 2px 8px rgba(0, 0, 0, 0.06) | 0 4px 8px -2px rgba(16, 24, 40, 0.08), 0 8px 16px -4px rgba(16, 24, 40, 0.10) |
| `--shadow-lg` | 0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.03) | 0 8px 16px -4px rgba(16, 24, 40, 0.10), 0 16px 24px -8px rgba(16, 24, 40, 0.08) |
| `--shadow-xl` | 0 20px 40px rgba(0, 0, 0, 0.07) | 0 24px 48px -12px rgba(16, 24, 40, 0.18), 0 8px 16px -8px rgba(16, 24, 40, 0.10) |
| `--shadow-card` | 0 1px 3px rgba(0, 0, 0, 0.04) | 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06) |
| `--shadow-focus` | 0 0 0 3px rgba(37, 99, 235, 0.18) | 0 0 0 3px rgba(63, 111, 239, 0.18) |
| `--shadow-error` | 0 0 0 3px rgba(220, 38, 38, 0.14) | 0 0 0 3px rgba(192, 57, 43, 0.14) |
| `--nav-item-radius` | 9px | 8px |
| `--nav-item-gap` | 9px | 2px |
| `--nav-item-padding` | 7px 9px | 8px 12px |
| `--sidebar-width` | 206px | clamp(176px, 14vw, 192px) |
| `--sidebar-width-collapsed` | 64px | clamp(56px, 4.5vw, 64px) |
| `--topbar-height` | 50px | 48px |
| `--input-focus-border` | #2563eb | #3F6FEF |
| `--input-focus-shadow` | 0 0 0 3px rgba(37, 99, 235, 0.12) | 0 0 0 3px rgba(63, 111, 239, 0.12) |
| `--tag-radius` | 4px | 6px |
| `--card-radius` | 12px | 10px |
| `--card-shadow` | 0 1px 3px rgba(0, 0, 0, 0.04) | 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06) |
| `--tag-font-size` | 10.5px | 12px |
| `--tag-padding` | 3px 8px | 3px 10px |

## ⑤ Element Plus 跨体系漂移（未收口）

已通过 `:root:root` 收口 3 个：`--el-color-primary`、`--el-text-color-placeholder`、`--el-text-color-secondary`

| 语义 | Element 令牌 | EP 原值 | 设计令牌 | 令牌值 |
|---|---|---|---|---|
| 成功 | `--el-color-success` | #67c23a | `--color-success` | #16a34a |
| 警告 | `--el-color-warning` | #e6a23c | `--color-warning` | #ea580c |
| 危险 | `--el-color-danger` | #f56c6c | `--color-danger` | #dc2626 |
| 信息 | `--el-color-info` | #909399 | `--color-info` | #2563eb |
| 主文本 | `--el-text-color-primary` | #303133 | `--text-primary` | #000000 |
| 常规文本 | `--el-text-color-regular` | #606266 | `--text-secondary` | #444444 |
| 边框 | `--el-border-color` | #dcdfe6 | `--border-normal` | #E2E2E2 |
| 圆角 | `--el-border-radius-base` | 4px | `--radius-md` | 8px |
