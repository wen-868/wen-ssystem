/**
 * 一次构建三套微信小程序模板产物（R96-02）
 *
 * 用法：node scripts/build-all-themes.mjs（或 npm run build:weapp:all）
 *
 * 行为：
 *   1. 对 a/b/c 依次执行 build-with-theme.js weapp（UNI_THEME 编译期切换）；
 *   2. 构建成功后把 dist/ 完整复制到 template-dist/{a,b,c}/；
 *   3. template-dist/ 已加入 .gitignore（产物不入库，由后端生成代码包时读取）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const THEMES = ["a", "b", "c"];

for (const theme of THEMES) {
  console.log(`[build-all-themes] 构建主题 ${theme} ...`);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "build-with-theme.js"), "weapp"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, UNI_THEME: theme },
    }
  );
  if (result.status !== 0) {
    console.error(`[build-all-themes] 主题 ${theme} 构建失败（exit=${result.status}）`);
    process.exit(result.status || 1);
  }

  const target = path.join(ROOT, "template-dist", theme);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(DIST, target, { recursive: true });
  console.log(`[build-all-themes] 主题 ${theme} 产物已复制到 template-dist/${theme}`);
}

console.log("[build-all-themes] 三套模板产物构建完成");
