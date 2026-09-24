/**
 * S3-67 复跑用：启动 mock 后端（127.0.0.1:8081，USE_MOCK_DB=true）
 * 路径全部指向**本 worktree**（D2 卡要求：只在本 worktree 内落盘/起服务）。
 * 日志：docs/evidence/S3-67/raw/logs/mock-backend.log（由 s3-67-run-all.ps1 重定向）
 */
const { spawn } = require("child_process");
const path = require("path");

const WT = path.resolve(__dirname, "..", "..", "..", "..");
const TSX = path.join(WT, "node_modules/tsx/dist/cli.mjs");

const child = spawn(process.execPath, [TSX, "src/server.ts"], {
  cwd: path.join(WT, "backend"),
  env: {
    ...process.env,
    PORT: "8081",
    HOST: "127.0.0.1",
    NODE_ENV: "development",
    USE_MOCK_DB: "true",
    LOG_LEVEL: "error",
  },
  stdio: "inherit",
});

console.log("[s3-67] mock backend spawn pid=" + child.pid + " cwd=" + path.join(WT, "backend") + " port=8081");
child.on("exit", (code) => {
  console.log("[s3-67] mock backend exited code=" + code);
  process.exit(code ?? 0);
});
