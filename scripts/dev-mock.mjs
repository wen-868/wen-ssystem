import { spawn } from "node:child_process";

const child = spawn("npm", ["--workspace", "backend", "run", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    // 显式指定开发环境：server.ts 在 NODE_ENV === "test" 时不执行 start()
    // （测试模式由 supertest 自行管理连接），若本地 backend/.env 配置了
    // NODE_ENV=test（用于 vitest），dev:mock 会导致服务不监听端口。
    USE_MOCK_DB: "true",
    NODE_ENV: "development"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
