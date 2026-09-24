/**
 * S3-67 复跑用：启动 admin-web dev server（127.0.0.1:5173）
 * 代理显式指向本 worktree 自己的 mock 后端 8081（VITE_API_BASE=/api ⇒ 同源 + vite proxy）。
 * 日志：docs/evidence/S3-67/raw/logs/admin-web-dev.log（由 s3-67-run-all.ps1 重定向）
 */
const { spawn } = require("child_process");
const path = require("path");

const WT = path.resolve(__dirname, "..", "..", "..", "..");
const VITE = path.join(WT, "node_modules/vite/bin/vite.js");

const child = spawn(process.execPath, [VITE, "--port", "5173", "--host", "127.0.0.1", "--strictPort"], {
  cwd: path.join(WT, "admin-web"),
  env: {
    ...process.env,
    VITE_API_BASE: "/api",
    VITE_API_PROXY_TARGET: "http://127.0.0.1:8081",
  },
  stdio: "inherit",
});

console.log("[s3-67] admin-web dev spawn pid=" + child.pid + " cwd=" + path.join(WT, "admin-web") + " 5173 → proxy 8081");
child.on("exit", (code) => {
  console.log("[s3-67] admin-web dev exited code=" + code);
  process.exit(code ?? 0);
});
