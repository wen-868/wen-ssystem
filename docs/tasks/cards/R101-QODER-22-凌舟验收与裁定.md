# R101-QODER-22 凌舟验收与裁定

> 验收人：凌舟（总负责人）｜日期：2026-10-21
> 被验收：QODER-22｜工作树：`D:\Users\ZXQL\wt-agents\QODER-22`
> 分支：`chore/qoder-22-mobile-main-closeout`｜本地尖端：`bc1087ee`

## 一、结论

QODER-22 **本地验收通过**。关键合并 `e9afb0a6` 是真双父 merge（`cf9a98fa` + `2e8cde17`），工作树 clean；当前 main 后续提交与分支改动文件交集为 0，不需要为了绿而改写历史。

本轮只确认移动端，不引用、不计入总台任务状态。远端推送与 PR 受 GitHub HTTPS 网络重置影响，另列为本验收之外的流程阻塞；本地技术验收结论不受影响。

## 二、凌舟亲跑读数

| 判据 | 实测 |
|:--|:--|
| `npm --workspace app-mobile run check:gates` | EXIT=0；type 0=0；lint error **0**、warning **12872**；test **11 文件 / 186 用例**；contract 差集 1、具名豁免 1 |
| `build:h5` | EXIT=0，产物 `app-mobile/dist/build/h5/index.html` 含 `viewport-fit=cover` |
| `build:mp-weixin` | EXIT=0，产物 `app.json` 的 `permission["scope.record"].desc` 为中文；`requiredPrivateInfos=[]` |
| `build:app` | EXIT=0，仅保留既有 `scan.ts` 动静态混合导入告警 |
| `guard-rbac-wiring.mjs --strict` | EXIT=0；gaps 289、未登记 0 |
| `guard-rbac-wiring.mjs --strict --no-stale` | EXIT=0；陈旧 0 |
| `git diff 21b465e5..HEAD -- backend/src` | 0 行、0 文件 |
| `rg upload` 于 `app-mobile/src/api/request.ts` | 0 命中；真实上传封装保留 |
| `installSslPinning(` 外部调用点 | 0 |
| 工作树 | clean |

## 三、裁定

1. **pin-ssl 双范围口径通过**：旧事实 `2026-09-15`/`TrustAsia` 守全文，现网日期 `2026-11-11`/`2026-12-22` 守文件头，调用点守全 `src`。A1/B1 反测证明范围确实生效。
2. **QODER-21 三处 `showToast` 增量通过**：只发生在原本静默吞错的异常路径，用户提示与事实一致；三端运行态仍列入未验，不冒充已验。
3. **MO-01/03/06/07/08/10/13/28 按验收通过计入**；MO-12、MO-15、MO-34 仍为部分完成。
4. **`storage-crypto.spec.ts` 约 0.4% 概率红判红，不在 QODER-22 内修补**：根因是 AES-GCM 认证标签长度未校验且测试篡改只稳定改到第 16 字节。另派 QODER-23，摘长度守卫必须红、复原 SHA256 一致后转绿。
5. **QODER-22 不 rebase**：当前 main 比共同基线多出的 5 笔全部是文档，和本分支交集 0；可正常走 PR 合并。
6. **证书运维不并入代码卡**：`api.onepan.cn` 叶子证书 `2026-11-11` 到期，已进入 30 天轮换窗口；由运维完成续期后重新采集 SPKI。pin-ssl 保持未接线。

## 四、远端流程阻塞

- GitHub API 正常，Git smart-HTTP 多次被重置；`20.205.243.166` 可建立 TCP，但 Git 握手无数据返回。
- 未跳过证书校验、未伪造远端对象、未把本地分支说成已推送。
- 恢复网络后动作顺序：push 单分支 → 开单一移动端 PR → required checks 全绿 → 按部署串行约束 squash 合并 → Auto Deploy 成功 → 再更新移动端合并状态。
- 工作树外游离文件 `D:\Users\ZXQL\ZXQL-MS\docs\evidence\qoder-11r\snapshot-login-page.txt` 未动，待授权处置。

## 五、最终口径

QODER-22：**验收通过，待远端合并**。本地证据可复跑；未验项只有真机、真实 401 联调、运行时三端交互与截图，不用“构建通过”替代运行态通过。
