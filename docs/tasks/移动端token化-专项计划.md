# 移动端 Token 化专项计划（根治「不受全局管控」）

> 编制：凌舟 ｜ 日期：2026-08-24 ｜ 状态：待派单
> 关联：`移动端UI-子页边距系统性归一`（已完成，但改的是「数字→数字」，非「数字→token」）

## 一、根因
移动端页面在**统一 CSS 变量（`$uni-*` token）与写死数值/颜色之间混用**。写死的部分**不受全局管控**——改任何全局 token 对它无效，导致各页不一致、以及反复出现的「布上去就变样」。

**实测**：110/110 个子/顶层页均有写死值。
- 重灾：`home`98、`create-sale`83、`ai-chat`81、`reports`49、`loss-gain-report`47、`permission-assign`46、`sales-reports`42、`orders`40、`my-permission`38、`instant-retail`37、`loss-gain-detail`37。
- `uni.scss` 已有完整 token，但 **间距 scale 缺 `20rpx`（$uni-spacing-md）**，故归一用的 20 是「漏网值」。

## 二、目标
将全部移动端页面的**写死 间距/圆角/阴影/颜色**替换为 `$uni-*` token，实现「全局一处改动、全站生效」；视觉零回归。

## 三、Phase 0 — 补全 token 体系（先做，阻塞后续）
`app-mobile/src/uni.scss` 新增：
- `$uni-spacing-md: 20rpx;`（关键，当前缺失）
- 若高频出现 `4/12/28rpx`，补 `$uni-spacing-xs2:4rpx`、`$uni-spacing-sm2:12rpx`、`$uni-spacing-base2:28rpx`（按实测值定，避免过度枚举）。

## 四、替换映射表（写死值 → token）
| 写死值 | 换成 token |
|---|---|
| 间距/margin/gap `8rpx` | `$uni-spacing-xs` |
| `16rpx` | `$uni-spacing-sm` |
| `20rpx` | `$uni-spacing-md`（新增） |
| `24rpx` | `$uni-spacing-base` |
| `32rpx` | `$uni-spacing-lg` |
| `26/28rpx` | `$uni-spacing-base`（就近） |
| `12/14rpx` | `$uni-spacing-sm` 就近（或补 token） |
| 圆角 `12rpx` | `$uni-border-radius-xs`(16) 就近 |
| `16/20rpx` | `$uni-border-radius-xs` |
| `24rpx` | `$uni-border-radius-sm` |
| `32rpx` | `$uni-border-radius-base` |
| `36/40rpx` | `$uni-border-radius-lg`(40) 就近 |
| `48rpx` | `$uni-border-radius-xl` |
| 颜色 `#hex` | `$uni-gray-0~900` / `$uni-color-*` / `$uni-text-*` / `$uni-bg-*`（按语义就近） |
| `rgba(色,..)` 装饰 | 对应 `$uni-color-*-soft` / `$uni-bg-*-soft` |
| 阴影 `0 2rpx 10rpx rgba(0,0,0,.03)` | `$uni-shadow-xs`；`0 2rpx 12rpx rgba(0,0,0,.04)`→`$uni-shadow-card` |

> ⚠️ 就近映射可能造成±2~4rpx 的视觉微调，**必须改前/改后截图比对确认不回归**；拿不准的用更接近的 token，不硬套。

## 五、阶段化分批（按写死值权重 + 业务优先级）
- **批1（重点 + 列表/卡片页）**：member-list、orders、reports、sales-reports、inventory、reconciliation、loss-gain 系列、customer-reports、finance-reports。
- **批2（权限/配置/营销）**：permission-assign、my-permission、report-matrix、audit-detail、instant-retail 系列、coupons、seckill/bargain-detail、settings、more-functions。
- **批3（顶层 + 其余）**：home、create-sale、ai-chat、products、functions、profile、notifications、todos 及剩余。

## 六、强制验收（每页必做）
1. `node ui-shot.mjs`（`LOGIN_USERNAME=store_manager LOGIN_PASSWORD=admin123`）截**改前**图，**视口改为用户真实宽度 319×645**（脚本加 `SHOT_VIEWPORT=319x645`）。
2. 依映射表**逐条替换**（可回溯，禁止全局替换）。
3. `npm run build:h5` 通过；`ui-shot.mjs` 截**改后**图。
4. 改前/改后比对：**无回归**（尤其不拍平按钮/页签/徽章/输入框/AI/悬浮/tab/标题栏）。
5. 达标 → 记录「页面 + 替换类型 + 前后截图路径」，进入下一页；**每 10 页报一次进度**。

## 七、红线（硬性禁止）
- ❌ 不碰按钮/标签/徽章/状态标/输入框/AI 页大圆角/悬浮胶囊/tab 导航/`page-header` 标题栏。
- ❌ 不改后端/接口/逻辑；**禁止假数据**；SVG 用 `/static/icons/**`；不加 `xmlns`。
- ❌ 禁止无脑正则全局替换（尤其 `24→32`、`圆角→16`）。
- 业务数据默认色（如表单默认值/文案色）不 token 化，保留原样。

## 八、派单与验收
- 执行方：workBuddy（或按项目约定拆分给 阿坚/阿澈/苏然/林夕，每批 1 人）。
- 分 3 批：批1 → 批2 → 批3；每批完成即提交 + 报进度。
- 验收：凌舟 `build:h5` + `ui-shot.mjs` 全量重截图，逐张把关；不达标打回。
- 完成标准：全站写死间距/圆角/颜色数趋近 0（保留业务默认色例外）；全局 token 改动可全站生效；无回归、无假数据。
