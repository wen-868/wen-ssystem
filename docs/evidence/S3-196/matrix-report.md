# S3-196 · 端到端矩阵（真产物 + 真库）

固定口径：微信用户 id=9001、openid=openid-s196、租户=default、会员 id=4；
base=http://127.0.0.1:18097（origin/main 未改动产物）、fixed=http://127.0.0.1:18096（本单产物）。

判定：`fixed+有CSRF` 必须 ≠401/403（越过身份与 CSRF 两道门）；`fixed+无CSRF` 必须 403（反测①）；
`base+有CSRF`（miniapp 组）应为 401（改造前身份层要商家 JWT）；wechat 组在 base 上本就能用。

| # | 端点 | 组 | base无CSRF | base有CSRF | base商家JWT | fixed无CSRF | fixed有CSRF | 判定 |
|--:|:--|:--|:--|:--|:--|:--|:--|:--|
| 1 | `POST /api/miniapp/cart` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 2 | `PUT /api/miniapp/cart/1` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 3 | `DELETE /api/miniapp/cart/1` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 4 | `DELETE /api/miniapp/cart` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 5 | `POST /api/miniapp/orders` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 6 | `POST /api/miniapp/orders/S196NO/pay` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 7 | `POST /api/miniapp/orders/S196NO/cancel` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 8 | `POST /api/miniapp/orders/S196NO/confirm-receive` | miniapp | 401/401 | 401/401 | 500/500 | 403/403 | 500/500 | ✅ |
| 9 | `PUT /api/miniapp/orders/S196NO/delete` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 10 | `POST /api/miniapp/stored-card/recharge` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 11 | `PUT /api/miniapp/user/profile` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 12 | `POST /api/miniapp/user/addresses` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 13 | `PUT /api/miniapp/user/addresses/1` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 14 | `DELETE /api/miniapp/user/addresses/1` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 15 | `POST /api/miniapp/user/addresses/1/default` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 16 | `POST /api/miniapp/coupons/1/use` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 17 | `POST /api/miniapp/member/coupons/1/receive` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 400/400 | ✅ |
| 18 | `PUT /api/miniapp/user/profile-update` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 19 | `POST /api/miniapp/user/change-password` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 20 | `POST /api/miniapp/wholesale/cart` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 21 | `PUT /api/miniapp/wholesale/cart/1` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 22 | `DELETE /api/miniapp/wholesale/cart/1` | miniapp | 401/401 | 401/401 | 404/404 | 403/403 | 404/404 | ✅ |
| 23 | `POST /api/miniapp/wholesale/orders` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 24 | `POST /api/miniapp/wholesale/cart/delete` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 25 | `PUT /api/miniapp/wholesale/cart/1/select` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 26 | `PUT /api/miniapp/wholesale/cart/select-all` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 27 | `POST /api/miniapp/wholesale/orders/S196NO/cancel` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 28 | `POST /api/miniapp/wholesale/orders/S196NO/confirm-receive` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 29 | `POST /api/miniapp/wholesale/orders/buy-now` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 30 | `POST /api/miniapp/cart/add` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 31 | `PUT /api/miniapp/cart/items/1` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 32 | `DELETE /api/miniapp/cart/items/1` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 33 | `POST /api/miniapp/cart/clear` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 34 | `POST /api/miniapp/cart/checkout/preview` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 35 | `POST /api/miniapp/cart/checkout/create` | miniapp | 401/401 | 401/401 | 500/500 | 403/403 | 500/500 | ✅ |
| 36 | `POST /api/miniapp/marketing/coupons/1/claim` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 37 | `POST /api/miniapp/marketing/flash-sale/1/buy` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 38 | `POST /api/miniapp/marketing/group-buy/1/join` | miniapp | 401/401 | 401/401 | 404/404 | 403/403 | 404/404 | ✅ |
| 39 | `POST /api/miniapp/marketing/calculate` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 40 | `POST /api/miniapp/aftersales` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 41 | `POST /api/miniapp/aftersales/S196NO/cancel` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 42 | `POST /api/miniapp/aftersales/S196NO/return-logistics` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 43 | `POST /api/miniapp/aftersales/S196NO/rate` | miniapp | 401/401 | 401/401 | 400/400 | 403/403 | 400/400 | ✅ |
| 44 | `PUT /api/miniapp/notifications/1/read` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 45 | `POST /api/miniapp/notifications/read-all` | miniapp | 401/401 | 401/401 | 200/0 | 403/403 | 200/0 | ✅ |
| 46 | `POST /api/miniapp/wechat/auth/decrypt-phone` | wechat | 403/403 | 400/400 | 403/403 | 403/403 | 400/400 | ✅ |
| 47 | `PUT /api/miniapp/wechat/auth/profile` | wechat | 403/403 | 200/0 | 403/403 | 403/403 | 200/0 | ✅ |
| 48 | `POST /api/miniapp/wechat/auth/bind` | wechat | 403/403 | 400/400 | 403/403 | 403/403 | 400/400 | ✅ |
| 49 | `POST /api/miniapp/wechat/auth/unbind` | wechat | 403/403 | 400/400 | 403/403 | 403/403 | 400/400 | ✅ |
| 50 | `GET /api/miniapp/marketing/coupons/my` | read | 401/401 | 401/401 | — | 200/0 | 200/0 | ✅ |
| 51 | `GET /api/miniapp/marketing/points/my` | read | 401/401 | 401/401 | — | 200/0 | 200/0 | ✅ |
| 52 | `GET /api/miniapp/notifications` | read | 401/401 | 401/401 | — | 200/0 | 200/0 | ✅ |
| 53 | `GET /api/miniapp/orders` | read | 401/401 | 401/401 | — | 200/0 | 200/0 | ✅ |

## 汇总

- 写端点（CSRF 受控）总数：**49**（miniapp 组 45 / wechat 组 4）
- fixed+有CSRF 越过 401/403 的比例：**49/49**
- fixed+无CSRF 命中 403 的比例：**49/49**
- base 上 miniapp 写端点带令牌仍 401 的比例（改造前载体缺口）：**45/45**
- 不符合判定的行数：**0**
- 对照读数：base 上「商家 JWT + CSRF」（改造前的合法载体）同样 500 的端点数：**2**（POST /api/miniapp/orders/S196NO/confirm-receive、POST /api/miniapp/cart/checkout/create）—— 说明这些 500 与本次身份改造无关，属存量业务缺陷
