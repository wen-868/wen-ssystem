import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function assertFile(path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`缺少文件: ${path}`);
  }
}

function assertIncludes(path, text) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(text)) {
    throw new Error(`${path} 缺少 ${text}`);
  }
}

assertFile("store-terminal/public/manifest.webmanifest");
assertFile("store-terminal/public/sw.js");
assertFile("store-terminal/src/register-sw.ts");
assertFile("store-terminal/.env.beta.example");
assertFile("miniapp/app.config.beta.example.js");
assertFile("scripts/build-store-beta.mjs");
assertFile("scripts/build-mobile-beta.mjs");

assertIncludes("store-terminal/index.html", "manifest.webmanifest");
assertIncludes("store-terminal/index.html", "#1677FF");
assertIncludes("store-terminal/src/main.ts", "./register-sw");
assertIncludes("store-terminal/public/manifest.webmanifest", "智享门店端");
assertIncludes("store-terminal/public/sw.js", "store-terminal-shell-v1");
assertIncludes("store-terminal/.env.beta.example", "VITE_API_BASE_URL=");
assertIncludes("miniapp/app.config.beta.example.js", "https://api.example.com/api");

function walkJsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkJsFiles(path);
    return path.endsWith(".js") ? [path] : [];
  });
}

for (const file of walkJsFiles("miniapp")) {
  const content = readFileSync(file, "utf8");
  if (content.includes("?.")) {
    throw new Error(`${file} 含有小程序兼容风险语法: ?.`);
  }
  if (/\{\s*\.\.\./.test(content)) {
    throw new Error(`${file} 含有小程序兼容风险语法: 对象展开`);
  }
}

console.log("BETA_ARTIFACTS_PASS");
