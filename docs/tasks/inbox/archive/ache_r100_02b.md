# R100-02b 阿澈：营销结束/参与记录 + 会员等级删除/启停 + 优惠券列表/详情

> 派单人：凌舟 | 日期：2026-08-14 | 优先级：P1 | 说明：原 ache_r100_02 因 API 余额不足中断，本任务卡重派，内容不变

## 背景

移动端「开发中」占位中，营销/会员等级/优惠券三块后端缺接口，需补齐并真实对接。

## 必读

`docs/项目统一标准.md`、`docs/项目规则.md`、`docs/tasks/current-tasks.md`、`docs/踩坑日志.md`、`docs/API接口文档.md`、`docs/memories/阿澈-记忆.md`。参考 `app-mobile/src/api/modules/` 现有模块风格与 `backend/src/routes|controllers|services` 现有分层。

## 任务内容

### 1. 营销活动：结束活动 + 参与记录
- 后端：`community-marketing` 相关模块补
  - POST /api/marketing/group-buy/:id/end（结束活动）、POST /api/marketing/bargain/:id/end、POST /api/marketing/seckill/:id/end
  - GET /api/marketing/group-buy/:id/records（参与记录，分页）、bargain/seckill 同理
- 前端：`api/modules/marketing-activities.ts` 去掉 reject 占位改真实调用；`pages-sub/marketing/marketing/participation-records.vue` 真实列表

### 2. 会员等级：删除 / 启停
- 后端：`member-levels` 相关补
  - DELETE /api/admin/members/levels/config/:id
  - PUT /api/admin/members/levels/config/:id/status（启用/停用）
- 前端：`api/modules/member-levels.ts` + `pages-sub/marketing/member-levels/member-levels.vue` 对接

### 3. 优惠券：列表 / 详情（门店侧）
- 后端：确认或补
  - GET /api/store/coupons（列表，分页）
  - GET /api/store/coupons/:id（详情）
- 前端：`api/modules/store.ts` 的优惠券 reject 占位改真实调用，对接对应页面

## 验收

1. 后端类型检查通过，新增接口 curl 冒烟 200；2. 前端构建通过（`npm run build:h5`）；3. 移动端对应页面无“开发中”占位、无假数据；4. 更新 `docs/API接口文档.md` 与 `docs/数据库变更清单.md`。

## 提交

不要自行提交推送！完成代码后把改动留在工作区，最终回复中列明改动文件清单与验证证据，由凌舟统一收口提交。完成后把任务卡移入 `docs/tasks/inbox/archive/` 并在 `current-tasks.md` 更新状态。
