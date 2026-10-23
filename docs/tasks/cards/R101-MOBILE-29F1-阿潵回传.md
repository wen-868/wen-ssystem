# 【汇报 MOBILE-29F1】上传安全头与 JSON 内容类型分离 —— 五条硬验收全过

```
【汇报 MOBILE-29F1】上传安全头与 JSON 内容类型分离
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-23
执行通道：本地子代理（独立工作树 D:\Users\ZXQL\wt-agents\MOBILE-29F1，
          分支 mobile/MOBILE-29F1-upload-header，基线 a531ed28）
交付物：① src/api/request.ts：buildRequestHeaders 拆为 buildJsonHeaders
          （Content-Type: application/json + 安全三头）与 buildSecureHeaders
          （仅安全三头）+ 私有 writeSecureHeaders，提交 d9431918；
          ② src/api/modules/ai.ts 四处 uni.request 全走 buildJsonHeaders，同上提交；
          ③ src/api/modules/products.ts uploadImage / src/api/modules/profile.ts
          uploadAvatar / src/utils/update.ts downloadAndVerify 改走
          buildSecureHeaders，同上提交；
          ④ scripts/guard-request-contract.mjs：判据 B 按调用类型分流 +
          新增判据 D，同上提交；
          ⑤ tests/request-contract.spec.ts：19→25 用例，同上提交；
          ⑥ scripts/gates-baseline.json：tests 段 16/322→16/328，同上提交；
          ⑦ 证据树 docs/evidence/mobile-29f1/**（提交 da2aa373）；
          ⑧ 本回传卡 docs/tasks/cards/R101-MOBILE-29F1-阿潵回传.md
证据（可复跑）：
  ① npm run check:gates EXIT=0 —— docs/evidence/mobile-29f1/raw/
     21-gates-chain-run2-all-green.log：type-check EXIT=0 / lint EXIT=0
     （error 0、warning 12872 与基线一致）/ test EXIT=0（16 文件 328 用例
     全过）/ check:contract EXIT=0（差集 0）/ guard:request EXIT=0
     （A 全登记 · B 分流 · C 无明文凭据 · D 无误用）；FINAL_EXIT=0。
     环境抖动留痕：run1 链式 test 段两度被满负荷并发击穿（CPU 100%、
     6 个代理进程，5s 默认超时不取消续体污染后续用例），单跑均绿，
     第三次链式 EXIT=0 —— 见 raw/11b/20 两份 log。
  ② 三端构建 EXIT=0 —— raw/30-build-h5.log（DONE Build complete）、
     raw/31-build-mp-weixin.log、raw/32-build-app.log（仅一条既有
     动态/静态 import 混合 warning，非本单改动）。
  ③ 反测（§9.1 顺序，anti/ 目录）：
     R1 products.ts uploadImage 改回 buildJsonHeaders ⇒ spec ㉓ 红点名
     （R1-test-output.txt）+ 静态守卫同红（R1-guard-output.txt）：
     [B] products.ts 缺少 buildSecureHeaders；[D] products.ts:603
     const header = buildJsonHeaders() —— 双判据行号级点名；
     R2 摘 buildSecureHeaders 安全三头 ⇒ ㉑㉒㉓㉔ 红点名；
     R3 摘 buildJsonHeaders 的 Content-Type ⇒ ⑨⑫ 红点名；
     三轮均逐字节复原、SHA256 恒等（R1: 14c9ac053d37cceb8e293682332f
     f4928435d54c6315594b30662d0cb50bc235a；R2/R3: cddbf17dd0214c2f77f3
     cd9acdb08d9cfc4a5cb0f60054bded550e275c72ed34，注入前=注入后，
     R*-sha-before.txt / R*-sha-after.txt 逐字对照）；
     复原后复跑绿：spec 25/25 EXIT=0 + guard EXIT=0
     （R1R2R3-restored-spec-green.log / R1R2R3-restored-guard-green.log）。
  ④ 真实 H5 上传冒烟 EXIT=0 —— smoke/results.json 15/15 断言全过：
     Vite dev:h5（.env.local 注入 VITE_API_BASE 指向冒烟服务）+
     Playwright 页面内动态 import 真实 profile.ts/products.ts，
     驱动真实 uni.uploadFile（H5 XHR multipart）⇒ Express+multer
     冒烟服务（127.0.0.1:5199）收到两条记录：
     avatar 与 image 的 Content-Type 均为浏览器自生成的
     multipart/form-data; boundary=----WebKitFormBoundary…（boundary 在场）；
     multer 零错误；req.file 非空（fieldname=avatar/image、70B 与页面
     blob 逐字节一致、image/png）；页面内 uploadAvatar 解出 data.avatar、
     uploadImage 解出 url。脚手架全留档（smoke/server.cjs +
     run-smoke.mjs + uploads/ 文件本体，§8.9 凌舟可复跑）；
     冒烟服务/dev server/.env.local 均已清理。
  ⑤ 提交拓扑：a531ed28（基线）→ d9431918（实现，8 文件 281+/57-）
     → da2aa373（证据树，34 文件 3380+）→ 本回传卡。
验收自评（对照派单硬验收 5 条）：
  1. 通过 —— check:gates EXIT=0，tests 只升不降（322→328，+6 全为
     新增用例，无删除/放宽）；
  2. 通过 —— h5 / mp-weixin / app 三端构建 EXIT=0；
  3. 通过 —— R1 改回 JSON 构建器 ⇒ ㉓ 红点名 + 守卫 B/D 同红；
     R2/R3 摘三头/Content-Type ⇒ ㉑㉒㉓㉔ / ⑨⑫ 红点名；复原 SHA256
     恒等后复跑绿；
  4. 通过 —— 真实 H5 上传成功：boundary 在场、multer req.file 非空、
     表单字段对象可读（两上传调用按 uni.uploadFile(name/filePath/header)
     调用、无附加 formData 字段，故 fields 为空对象，multer 解析正常）、
     响应非业务失败；临时服务/.env.local 清理完毕；
  5. 通过 —— git status 干净，未 push、未开 PR、逐文件 add。
未完成与阻塞：无
风险与自我报备：
  ① 机器级环境修复（非本单代码问题，但影响面需报备）：主检出
     node_modules 的 rollup 4.62.2 / esbuild 0.25.12 / sass-embedded
     1.100.0 三处 x64 原生二进制因 npm 可选依赖 bug #4828 缺失
     （只装了 arm64 变体，本机为 x64），导致 vitest / H5 构建直接
     起不来。本次从 registry 直取 tarball、sha1 校验一致后装入主检出
     node_modules（另补 @dcloudio/uni-cli-shared 嵌套位
     @esbuild/win32-x64@0.20.2，修 vite "Host version 0.20.2 does not
     match binary version 0.25.12"）。修复惠及所有 junction 到主检出的
     工作树（含在办 WORKBENCH-04 / S3-243-R2-F1A）；tarball 与校验记录
     留档于证据树 README。
  ② 满负荷并发下 test 门出现三次环境性 flaky（失败文件每次不同，
     单独跑均绿，根因是超时后续体续跑污染 stub 计数），已按门禁纪律
     重试至官方链 EXIT=0；未为转绿放宽任何断言或超时。
  ③ 冒烟链路为 H5 端（uni.uploadFile→浏览器 XHR）；微信小程序与 App
     端的 multipart boundary 由各自 uni 运行时生成，本单不触碰那两个
     平台运行时，其覆盖以静态守卫判据 D 兜底（源码面禁 JSON 构建器）。
  ④ uploadAvatar / uploadImage 的返回解析按原契约未动
     （data.data / data.url ?? url）；冒烟服务响应体按两函数 success
     分支逐字对齐。
回传要求：本汇报已落卡 docs/tasks/cards/R101-MOBILE-29F1-阿潵回传.md
关联卡：docs/tasks/inbox/MOBILE-29F1-upload-header-separation.md
```

---

## 附：改动面逐文件速查（供验收抽看）

| 文件 | 改动 | 关键行 |
|---|---|---|
| app-mobile/src/api/request.ts | buildRequestHeaders → buildJsonHeaders + buildSecureHeaders + 私有 writeSecureHeaders | 81（writeSecureHeaders）、102（buildJsonHeaders）、123（buildSecureHeaders） |
| app-mobile/src/api/modules/ai.ts | import buildJsonHeaders；本地 buildHeaders() 返回 buildJsonHeaders() | 42、46 |
| app-mobile/src/api/modules/products.ts | uploadImage 改 buildSecureHeaders | 1（import）、603（调用） |
| app-mobile/src/api/modules/profile.ts | uploadAvatar 改 buildSecureHeaders | 1、48 |
| app-mobile/src/utils/update.ts | downloadAndVerify 的 downloadFile 头改 buildSecureHeaders | 25、182 |
| app-mobile/scripts/guard-request-contract.mjs | 判据 B 按调用类型分流；新增判据 D | 判据 B/D 段 |
| app-mobile/tests/request-contract.spec.ts | 19→25 用例（㉑–㉖ 新增） | 257–345 |
| app-mobile/scripts/gates-baseline.json | tests 段 16/322→16/328 | tests.testCount |
