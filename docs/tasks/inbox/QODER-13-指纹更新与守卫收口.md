# QODER-13 · pin-ssl 指纹更新（4 条）+ basis 行号修正 + `--no-stale` 守卫

> 派单人：凌舟｜端：**移动端 → Qoder**｜基线：`dfeedbc0`（#368 squash 合并后的 main）
> ⚠️ 不得 push / 开 PR / `git add -A`；不得写「凌舟裁定/验收结论」。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-13`｜分支 `fix/qoder-13-pin-fingerprints-and-guard`

## 一、三件（都很小）

### ① 换掉 `pin-ssl.ts:76-81` 的 4 条在册指纹（**只改常量，不接线**）
- 现网已换 **Let's Encrypt**，在册 4 条是 **TrustAsia** ⇒ **无一命中**（QODER-12 独立复核）；
- 用 `app-mobile/scripts/pin-spki.sh` 采集 **api.onepan.cn / m.onepan.cn** 的叶子 + 中间 **双指纹**（按域名成对，**禁跨域抄用**）；
- 只替换 `PINNED_CERTS` 常量值；`installSslPinning()` **仍不调用**（接线另裁）；
- 回传卡必须记录：采集时间、`notAfter`（api 叶子 **2026-11-11**，剩 23 天）、每条指纹来源域名。

### ② `permission-gates.ts:596` 的 `basis` 行号修正
- 现写 `backend/src/routes/aftersale.routes.ts:64`，实际 `confirm-receipt` 在 **:67**（QODER-9 后）⇒ 改对。

### ③ `guard-rbac-wiring` 加 `--no-stale`（可选开关，默认不改变现有行为）
- 现状"陈旧>0"只提示不判红；加开关后 `--no-stale` 时**陈旧>0 ⇒ EXIT=1**；
- CI 里**先不启用**（等全仓陈旧清零那批再开），只把开关做出来 + 给两侧反测（陈旧>0 ⇒ 红；陈旧=0 ⇒ 绿）。

## 二、判据

1. ①：`pin-spki.sh` 采集输出原文（两域各一对）；`PINNED_CERTS` 4 条新值与输出逐字一致；`rg "trustasia" -i` 0 命中；
2. ②：改后 `rg -n "aftersale.routes.ts:67"` 命中；`:64` 在该 basis 行 0 命中；
3. ③：`node backend/scripts/guard-rbac-wiring.mjs --strict` **EXIT=0**；`--strict --no-stale` 在当前陈旧 0 时 **EXIT=0**；注入 1 条陈旧 ⇒ `--no-stale` **EXIT=1 且点名**，不带开关仍 EXIT=0（**行为隔离证明**）；
4. 回归：app-mobile `test` 不劣化、`type-check 0=0`；`pin-ssl.ts` 除常量外零改动（`installSslPinning(` 调用数仍为 0）。

## 三、回传

`docs/tasks/cards/R101-QODER-13-回传.md`（十项）+ 回执。
