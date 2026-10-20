# QODER-14 · 401 重试只允许 GET + 清 CSRF

> 派单人：凌舟｜端：移动端 → Qoder｜日期：2026-10-20
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-14`
> 分支：`fix/qoder-14-auth-retry-safety`｜基线：`origin/main=321b4f6b`
> 红线：不得 push、不得开 PR、不得 `git add -A`；不得改后端。

## 一、已核实问题

`app-mobile/src/api/request.ts:97-107` 在 401 时原样重放请求。POST/PUT/DELETE 若首请求已落库后 401，会重复开单或重复扣减。

同时 401 清理只删 token/user/tenant，未删 `merchant_csrf_token`。

## 二、修复

1. 401 静默重试仅允许 `GET`；其余 method 首次 401 直接清态、提示并跳登录。
2. method 缺省按 GET 处理，统一大写比较。
3. 401 清理补 `uni.removeStorageSync('merchant_csrf_token')`。
4. 不引入后端幂等键；不改变 403/404/500 处理。

## 三、验收

- 新增 `app-mobile/tests/request-retry-safety.spec.ts`，至少覆盖：
  1. GET 401 + token 可读 ⇒ 重试一次；
  2. POST 401 + token 可读 ⇒ **0 重试**；
  3. PUT/DELETE 同理不重放；
  4. 401 后 csrf 键被清除。
- 反测：删掉 GET 判定或删 CSRF 清理，目标用例必须红；cp 复原 SHA256 一致。
- app-mobile `test` 不劣化，`type-check` 0=0，`lint` 不劣化，`build:h5` EXIT=0。
- 只改 request 及测试/证据，不碰业务页面。

## 四、回传

`docs/tasks/cards/R101-QODER-14-回传.md`（十项）+ 回执；必须带 DSH-RECEIPT 区块。
