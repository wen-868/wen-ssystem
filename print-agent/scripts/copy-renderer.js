/**
 * 构建辅助：将设置窗口静态资源（index.html）拷贝到 dist/renderer/
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "renderer", "index.html");
const destDir = path.join(__dirname, "..", "dist", "renderer");
const dest = path.join(destDir, "index.html");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("已拷贝 renderer/index.html -> dist/renderer/index.html");
