# 智享全链 · 移动端 UI 设计规范（统一版）

> 来源：原型群《智享全链·移动端 UI 原型群·项目记忆与对接指南》§3–§4 与现有工程 Atlas Blue Token 体系（src/uni.scss Design Tokens v5.0）收敛。
> 适用范围：供应商管理 / 会员管理 / 公司信息·门店仓库 三项补全，以及后续所有页面。
> 铁律：**严禁硬编码颜色/尺寸/字号字面量，一律走 uni.scss 设计 Token。**

---

## 1. 设计 Token（唯一来源：src/uni.scss）

| 类别 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 主色 | `$uni-color-primary` | `#2563EB` | 主按钮、强调、链接、分组竖条 |
| 主色渐变 | `$uni-gradient-blue` | `135deg #2563EB→#1D4ED8` | 概要卡/头像底 |
| 主色浅底 | `$uni-color-primary-soft` | `rgba(37,99,235,.12)` | 选中/标签底、弹层背景 |
| 成功 | `$uni-color-success` / `-soft` | `#3A9D5C` / `rgba(58,157,92,.12)` | 状态 |
| 警告 | `$uni-color-warning` / `-soft` | `#C8803A` / `rgba(200,128,58,.12)` | 状态 |
| 错误 | `$uni-color-error` / `-soft` | `#C45050` / `rgba(196,80,80,.12)` | 危险/必填 |
| 紫（会员/客户） | `$uni-color-purple` / `-soft` | `#722ED1` / `rgba(114,46,209,.12)` | 会员等级标签 |
| 灰阶 | `$uni-gray-0~900` | `#FFF`→`#171717` | 文字/分隔/占位 |
| 文字 | `$uni-text-color` `#171717`；`-grey` `#737373`；`-placeholder` `#A3A3A3` | 正文/辅助/占位 |
| 背景 | `$uni-bg-color` `#FFF`；`-page` `#F5F5F7` | 卡片/页面底 |
| 圆角 | `-xs`16 / `-sm`24 / `-base`32 / `-lg`40 (rpx) | 小元素/按钮/卡片/大卡 |
| 阴影 | `$uni-shadow-card-sm` `0 2rpx 12rpx rgba(0,0,0,.04)` | 卡片默认 |
| 间距 | `-xs`8 / `-sm`16 / `-base`24 / `-lg`32 / `-xl`48 (rpx) | 内外边距 |
| 字号 | `-xs`22 / `-sm`24 / `-base`28 / `-lg`32 / `-xl`36 / `-xxl`44 (rpx) | 辅助/正文/标题 |
| 字重 | `-normal`400 / `-medium`500 / `-semibold`600 / `-bold`700 | — |

**扩展语义色（R94-02）**：`$zx-badge-*` 单据状态徽标、`$uni-color-purple`、`$uni-color-cyan` 等，按需取用，不新增硬编码。

---

## 2. 通用类（全局可用，src/uni.scss）

- `.card` / `.metric` / `.metric-grid`：KPI 卡片网格
- `.btn-primary` `.btn-default` `.btn-text` `.btn-danger`：按钮
- `.status-tag` + `.success/.warning/.danger/.info/.default`：浅底彩字状态标签（**单据/账户状态统一用此**）
- `.page-container` `.safe-top` `.safe-bottom`：页面容器与安全区

---

## 3. 分组标题（统一结构）

所有"卡片内分组标题"复用同一结构，避免重复造样式：

```html
<view class="grp-head">
  <view class="gt-bar"></view>
  <text class="grp-title">基本信息</text>
</view>
```

```scss
.grp-head { display:flex; align-items:center; gap:14rpx; padding-bottom:16rpx; border-bottom:1rpx solid $uni-gray-100; }
.gt-bar  { width:6rpx; height:24rpx; border-radius:4rpx; background:$uni-color-primary; }
.grp-title { font-size:24rpx; font-weight:700; color:$uni-gray-500; }
```

---

## 4. 共用组件（src/components）

### 4.1 BanksCard —— 多银行卡账户
- 受控组件：`v-model="banks: BankAccount[]"`，`editable` / `title` / `showHead` / `pendingBackend`
- 卡号脱敏 `maskNo()`（`**** **** 末4位`），可增删
- 后端 `banks` 接口未就绪时：空态显示「暂无银行账户（后端 banks 接口对接中）」——**不造假**
- 用法：供应商详情、会员详情（收款账户）、公司信息（收款银行账户）

### 4.2 DocPage —— 历史单据覆盖式子页（#docPage）
- 受控显隐：`v-model`（即 `modelValue`），`title` / `docs: DocRow[]` / `amountLabel` / `loading` / `pendingBackend`
- `DocRow = { no, date?, amount, status?, statusType?, sub? }`，由父级把真实接口数据**归一化**后传入
- 金额自动汇总（顶部汇总条 `formatMoney()`：`¥` + 千分位 + 2 位小数）
- 状态用 `.status-tag` 映射（`statusType` → `success/warning/danger/info/default`）
- 用法：供应商采购单据 / 采购退货、会员销售单据（DOCS）

### 4.3 等级晋级进度条（autoRetailLevel 模式，真实数据驱动）
- 场景：会员详情"等级晋级进度"。非独立组件，作为页面内卡片模式复用（见 `member-detail.vue`）。
- 数据真实：拉取 `memberLevelApi.list()`（GET `/admin/members/levels/config`）取各等级 `minPoints` 门槛；会员基数 = `member.totalPoints ?? member.points`（累计积分）。
- 计算：
  - `currentLevel` = 门槛 `≤` 当前分的最高「启用」等级
  - `nextLevel` = 首个门槛 `>` 当前分的等级（无则满级）
  - 进度% = `(当前分 − 当前门槛) / (下一门槛 − 当前门槛)`，clamp 0~100
  - 满级 → 100% + 文案「已达最高」
- 结构：标题「等级晋级进度」→ `.lp-head`（当前级 → 下一级）→ `.lp-track`/`.lp-fill`（渐变填充，Token：`$uni-gradient-blue` 轨道 `$uni-gray-100`）→ `.lp-meta`（百分比 + 「还差 X 积分升级至 Y」）
- **不造假**：全部取自真实会员积分与真实等级配置，无任何 mock。

---

## 5. 金额格式

一律 `¥` + `toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2})`，金额字体用等宽 `'SF Mono','Fira Code',monospace`。汇总金额用 `$uni-color-primary` 强调。

---

## 6. 后端接口占位约定（不造假）

原型群交互后端尚未全部就绪时：
- 列表为空 → 显示空态 + `（后端 xxx 接口对接中）`
- 详情字段后端未返回（如供应商 `address` / `settlementType`）→ 显示 `—`
- 真实接口存在则直连：采购 `purchaseApi.getOrderList/getInStockList`、采购退货 `purchaseReturnApi.list`、销售 `salesApi.list`、会员 `/store/members/:id/orders`、会员等级 `memberLevelApi.list()`
- **当前占位项**：仅「多银行卡 banks」接口后端确实缺失（见 §4.1 `pendingBackend`）。「历史单据」「会员等级晋级」均已用真实接口落地，无占位、无 mock。

---

## 7. 三项补全落地清单

| 模块 | 页面 | 复用 |
| --- | --- | --- |
| 供应商 | `pages-sub/product/suppliers/detail.vue`（**新建**，已注册路由） | BanksCard + DocPage + 真实 `getById` |
| 会员 | `pages-sub/marketing/member/member-detail.vue`（扩展） | BanksCard + DocPage + 充值/积分入口 + **autoRetailLevel 晋级进度条（§4.3）** |
| 公司/门店 | `pages-sub/admin/stores/stores.vue`（扩展） | BanksCard 收款账户 |

### 7.1 原"缺口"闭环状态
| 缺口 | 状态 | 说明 |
| --- | --- | --- |
| ① BanksCard 多银行卡（banks） | 占位完成（真实） | 后端确无接口，用 `pendingBackend` 占位"对接中"，不造假 |
| ② 会员 autoRetailLevel 晋级进度条 | ✅ 已完成 | 真实 `memberLevelApi.list()` 门槛 + 真实会员积分计算，无 mock（§4.3） |
