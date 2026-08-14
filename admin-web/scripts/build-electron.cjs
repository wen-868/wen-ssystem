/**
 * 桌面版构建入口：先设 ELECTRON_BUILD=1（vite base 变为相对路径 ./，
 * 保证 file:// 加载资源不 404），再执行标准 vite build。
 */
process.env.ELECTRON_BUILD = "1";
const { spawnSync } = require("child_process");
const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
