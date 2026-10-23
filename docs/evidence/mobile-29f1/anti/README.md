# MOBILE-29F1 反测记录（门禁反测标准 §9.1）

单号：MOBILE-29F1 · 上传安全头与 JSON 内容类型分离
分支：mobile/MOBILE-29F1-upload-header（基线 a531ed28）
执行：阿潵（WB 端）· 2026-10-23

## 反测协议（§9.1 五步，逐轮执行）

1. 基线已更新（gates-baseline.json tests 16/328，门 3 现场复跑 EXIT=0）
2. 注入违规（只改一处、可指名的确定位点）
3. 验红：对应测试必须红并点名（测试门 + 静态守卫门分别取证）
4. 逐字节复原（`cp` 树外备份回写）+ SHA256 恒等机检
5. 复跑验绿

## 注入轮次与预期红面

| 轮次 | 注入点 | 预期红（点名） |
|------|--------|----------------|
| R1 | `products.ts` uploadImage 内 `buildSecureHeaders()` → `buildJsonHeaders()` | 测试 ㉓（无 Content-Type 断言）；守卫判据 B（uploadFile 必须走安全构建器，点名 products.ts 行号）；守卫判据 D（multipart 直调文件出现 JSON 构建器） |
| R2 | `buildSecureHeaders` 摘安全三头（去掉 writeSecureHeaders 调用） | 测试 ㉑㉒（buildSecureHeaders 只含三头）；㉓㉔（上传三头齐全）；守卫判据 B 不红（调用面未变） |
| R3 | `buildJsonHeaders` 摘 `'Content-Type': 'application/json'` | 测试 ⑨/⑫（JSON Content-Type 断言）；守卫不红（守卫只管安全头与分流） |
| R4 | （复原后）无注入 | 全绿 |

每轮记录：注入后回读在场（grep 命中）、TEST_EXIT / GUARD_EXIT、红面点名原文、
复原后 `sha256sum` 与注入前恒等、复跑 EXIT=0。
