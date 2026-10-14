// S3-200 · 第 61 项反测（两侧齐）：把一处**已还原**的注释再破坏成 U+FFFD ⇒ 检测脚本必须判红；
// 复原 ⇒ 必须判绿。两侧不齐（红不起来 / 绿不回来）时本脚本以非零退出码报错。
// 用法：node anti-test-61.mjs <repoRoot>
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2];
const target = "backend/src/routes/alert.routes.ts";
const abs = path.join(repoRoot, target);
const guard = path.join(repoRoot, "backend/scripts/guard-utf8-encoding.mjs");

// 历史损坏行的真实码点（S3-200 开工时 alert.routes.ts:14 的字节），按码点构造，避免手抄走样
const CP = [
  0x2f, 0x2f, 0x20, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x20,
  0xb7, 0xfffd, 0xfffd, 0xfffd, 0x536, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd,
  0x20, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d, 0x3d,
];
const dmg = CP.map((c) => String.fromCodePoint(c)).join("");

const sha = (b) => createHash("sha256").update(b).digest("hex");
const runGuard = () => spawnSync(process.execPath, [guard], { cwd: repoRoot, encoding: "utf8" });

const original = fs.readFileSync(abs);
const origSha = sha(original);
const lines = original.toString("utf8").split("\n");
const i = lines.findIndex((l) => l.includes("路由自动发现配置"));
if (i < 0) throw new Error("未找到已还原的注释行，反测前提不成立");
const cr = lines[i].endsWith("\r") ? "\r" : "";
console.log("注入行字节数 = " + Buffer.from(dmg, "utf8").length + "（历史损坏行实测 65）");
console.log("目标 " + target + ":" + (i + 1) + "  " + JSON.stringify(lines[i]));
console.log("原文件 sha256 = " + origSha);

lines[i] = dmg + cr;
fs.writeFileSync(abs, Buffer.from(lines.join("\n"), "utf8"));
const red = runGuard();
console.log("--- 反测①（注入 U+FFFD）guard 输出 ---");
console.log(red.stdout.trim());
console.log("guard EXIT=" + red.status + "（期望 1）");

fs.writeFileSync(abs, original);
const restored = fs.readFileSync(abs);
const green = runGuard();
console.log("--- 反测②（复原）guard 输出 ---");
console.log(green.stdout.trim());
console.log("guard EXIT=" + green.status + "（期望 0）");
console.log("复原后 sha256 = " + sha(restored) + "  与改前一致=" + (sha(restored) === origSha));

const ok = red.status === 1 && green.status === 0 && sha(restored) === origSha;
console.log(ok ? "ANTI_TEST_61_OK（两侧齐）" : "ANTI_TEST_61_FAILED");
process.exit(ok ? 0 : 1);
