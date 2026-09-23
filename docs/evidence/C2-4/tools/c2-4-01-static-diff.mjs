/**
 * C2-4 核验①：后端端点集合 × 前端调用集合 双向差集（纯静态）
 *
 * 用法：
 *   node docs/evidence/C2-4/tools/c2-4-01-static-diff.mjs [--root <仓库根>] [--json <输出json>] [--label <名>]
 *
 * 判定（详见 c2-4-lib.mjs 的 analyzeStaticDiff）：
 *   - 每条前端 `METHOD 全路径` 必须能在后端集合里找到同 `METHOD` + 同规范化路径 ⇒ 否则记为「不一致」
 *   - 通配吞并风险（先通配后字面量）必须为 0
 *   - 完整性自检：后端/前端源码里 `<verb>(` 出现次数必须等于解析条数（防「只检第一个」「正则漏解析」）
 * 退出码：0 = 全部一致；1 = 存在不一致（供反测断言「会红」）
 *
 * 本文件只做「参数解析 + 打印 + 落盘」；分析逻辑在 c2-4-lib.mjs，
 * 便于 02 反测在**同一进程内**指向副本目录复用同一份检测逻辑（沙箱 spawn EPERM）。
 */
import { analyzeStaticDiff } from "./c2-4-lib.mjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const ROOT = resolve(rootArg >= 0 ? args[rootArg + 1] : ".");
const jsonArg = args.indexOf("--json");
const JSON_OUT = jsonArg >= 0 ? resolve(args[jsonArg + 1]) : null;
const labelArg = args.indexOf("--label");
const label = labelArg >= 0 ? args[labelArg + 1] : "baseline";

const { lines, failures, data } = analyzeStaticDiff(ROOT, label);
process.stdout.write(`${lines.join("\n")}\n`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(data, null, 2), "utf8");
  process.stdout.write(`[C2-4/01] JSON 已落盘：${JSON_OUT}\n`);
}

process.exit(failures.length === 0 ? 0 : 1);
