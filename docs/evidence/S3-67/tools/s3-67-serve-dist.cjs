/**
 * S3-67 取证环境辅助：静态服务「现场构建的 admin-web 产物」+ `/api` 反向代理到 mock 后端。
 *
 * 为什么不用 `vite dev`：本沙箱禁止 node 创建带管道的子进程 ⇒ vite/tsx 启动即 EPERM（见 s3-67-sandbox-shim.cjs 头注）。
 * 因此改用「现场构建产物 + 静态服务 + 同源 /api 代理」——与生产/CI 的取数方式同构
 * （`VITE_API_BASE=/api`、同源请求、真实 mock 后端数据）。
 *
 * 🔴 只读：只提供文件与代理转发，不改任何业务文件。
 *
 * 用法：node docs/evidence/S3-67/tools/s3-67-serve-dist.cjs
 *   S3_67_DIST_DIR   产物目录（默认 %TEMP%\s3-67-admin-dist）
 *   S3_67_SERVE_PORT 端口（默认 5173）
 *   S3_67_API_TARGET 后端地址（默认 http://127.0.0.1:8081）
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");

const DIST = process.env.S3_67_DIST_DIR || path.join(os.tmpdir(), "s3-67-admin-dist");
const PORT = Number(process.env.S3_67_SERVE_PORT || 5173);
const API_TARGET = process.env.S3_67_API_TARGET || "http://127.0.0.1:8081";
const target = new URL(API_TARGET);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

if (!fs.existsSync(DIST)) {
  console.error("[s3-67-serve] 产物目录不存在：" + DIST + "（先跑 s3-67-build-admin.mjs）");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith("/api")) {
    const proxyReq = http.request(
      {
        host: target.hostname,
        port: target.port || 80,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `${target.hostname}:${target.port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on("error", (e) => {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ code: "502", msg: "代理后端失败：" + e.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(DIST, rel);
  const safe = path.resolve(filePath).startsWith(path.resolve(DIST));
  const finalPath = safe && fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(DIST, "index.html");
  fs.readFile(finalPath, (err, buf) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(finalPath).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[s3-67-serve] http://127.0.0.1:${PORT}  静态=${DIST}  /api → ${API_TARGET}`);
});
