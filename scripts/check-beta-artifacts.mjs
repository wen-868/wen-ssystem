import { existsSync, readFileSync, statSync } from "node:fs";

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

console.log("BETA_ARTIFACTS_PASS");
