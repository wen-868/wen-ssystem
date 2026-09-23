/**
 * C2-4 核验①b：全仓「同路径竞争」独立证明（不执行 express）
 *
 * 用法：node docs/evidence/C2-4/tools/c2-4-01b-cross-file-shadow.mjs [--root .] [--target GET:/api/platform/announcements/templates]
 *
 * 分析逻辑在 c2-4-lib.mjs 的 analyzeCrossFile（便于 02 反测进程内复用同一份逻辑）。
 */
import { analyzeCrossFile } from "./c2-4-lib.mjs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const ROOT = resolve(rootArg >= 0 ? args[rootArg + 1] : ".");
const targetArg = args.indexOf("--target");
const target = targetArg >= 0 ? args[targetArg + 1] : "GET:/api/platform/announcements/templates";

const { lines, failures } = analyzeCrossFile(ROOT, target);
process.stdout.write(`${lines.join("\n")}\n`);
process.exit(failures.length === 0 ? 0 : 1);
