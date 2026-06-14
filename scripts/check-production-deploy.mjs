import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function read(path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`缺少文件: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function assertIncludes(path, text) {
  const content = read(path);
  if (!content.includes(text)) {
    throw new Error(`${path} 缺少 ${text}`);
  }
}

function assertNotIncludes(path, text) {
  const content = read(path);
  if (content.includes(text)) {
    throw new Error(`${path} 不应包含 ${text}`);
  }
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}

assertIncludes("store-terminal/.env.beta.example", "VITE_API_BASE=");
assertNotIncludes("store-terminal/.env.beta.example", "VITE_API_BASE_URL");

assertIncludes("scripts/build-store-beta.mjs", "VITE_API_BASE");
assertIncludes("deploy/03-deploy.sh", "https://api.${DOMAIN}/api");
assertNotIncludes("deploy/03-deploy.sh", "VITE_API_BASE=\"http://localhost:8080/api\"");

assertIncludes("deploy/07-local-archive-deploy.sh", "cd \"${PROJECT_DIR}\"");
assertIncludes("deploy/04-nginx.conf", "Cache-Control \"no-cache, no-store, must-revalidate\"");
assertIncludes("deploy/04-nginx.conf", "location = /sw.js");

assertIncludes("store-terminal/public/sw.js", "store-terminal-shell-v2");
assertNotIncludes("store-terminal/public/sw.js", "SHELL_ASSETS = [\"/\"");
assertIncludes("store-terminal/public/sw.js", "event.request.mode === \"navigate\"");

for (const dir of ["admin-web/dist", "store-terminal/dist"]) {
  if (!existsSync(dir)) continue;
  for (const file of walkFiles(dir)) {
    if (!/\.(html|js|css|webmanifest)$/.test(file)) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("localhost:8080/api")) {
      throw new Error(`${file} 含有 localhost:8080/api`);
    }
  }
}

console.log("PRODUCTION_DEPLOY_CONTRACT_PASS");
