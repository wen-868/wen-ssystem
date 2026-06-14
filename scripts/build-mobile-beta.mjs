import { mkdirSync, rmSync, cpSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const workDir = ".beta-build/miniapp";
const output = "miniapp-beta.zip";
const appJs = readFileSync("miniapp/app.js", "utf8");

if (!appJs.includes("globalData") || !appJs.includes("apiBase")) {
  throw new Error("miniapp/app.js 缺少 globalData.apiBase");
}

rmSync(".beta-build", { recursive: true, force: true });
rmSync(output, { force: true });
mkdirSync(workDir, { recursive: true });
cpSync("miniapp", workDir, { recursive: true });

execFileSync("zip", ["-qr", `../../${output}`, "."], {
  cwd: workDir,
  stdio: "inherit"
});

console.log(`MOBILE_BETA_PACKAGE_READY ${output}`);
console.log("微信开发者工具导入 miniapp 或解压 miniapp-beta.zip；上传体验版前替换真实 appid 和 HTTPS API 域名。");
