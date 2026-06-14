import { existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const output = "store-terminal-beta.zip";

if (existsSync(output)) {
  rmSync(output);
}

execFileSync("npm", ["--workspace", "store-terminal", "run", "build"], { stdio: "inherit" });
execFileSync("zip", ["-qr", `../../${output}`, "."], {
  cwd: "store-terminal/dist",
  stdio: "inherit"
});

console.log(`STORE_BETA_PACKAGE_READY ${output}`);
console.log("部署建议：上传 zip 内容到 https://store.<正式域名>，API 指向 https://api.<正式域名>。");
