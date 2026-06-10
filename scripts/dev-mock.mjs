import { spawn } from "node:child_process";

const child = spawn("npm", ["--workspace", "backend", "run", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    USE_MOCK_DB: "true"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
