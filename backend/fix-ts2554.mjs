import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "src/__tests__");

// Step 1: 获取所有 TS2554 错误
console.log("Step 1: 收集 TS2554 错误...");
let tscOutput = "";
try {
    execSync("npx tsc --noEmit -p tsconfig.test.json", {
        cwd: __dirname,
        encoding: "utf8",
        maxBuffer: 100 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
} catch (e) {
    tscOutput = e.stdout || "";
}

const errors = [];
const regex = /^(.+\.test\.ts)\((\d+),(\d+)\): error TS2554:/gm;
let match;
while ((match = regex.exec(tscOutput)) !== null) {
    errors.push({
        file: path.resolve(__dirname, match[1]),
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
    });
}

console.log(`找到 ${errors.length} 个 TS2554 错误`);

// 按文件分组
const fileErrors = {};
for (const err of errors) {
    if (!fileErrors[err.file]) fileErrors[err.file] = [];
    fileErrors[err.file].push(err);
}

console.log(`涉及 ${Object.keys(fileErrors).length} 个文件`);

// Step 2: 逐个文件修复
console.log("\nStep 2: 批量修复...");
let totalFixed = 0;
let totalFailed = 0;

function findClosingParen(line, startIdx) {
    let depth = 1;
    let i = startIdx + 1;
    let argStart = -1;
    let args = [];
    let currentArg = "";

    while (i < line.length && depth > 0) {
        const ch = line[i];

        if (ch === "(") {
            depth++;
            currentArg += ch;
        } else if (ch === ")") {
            depth--;
            if (depth === 0) {
                if (currentArg.trim()) args.push(currentArg.trim());
                return { endIdx: i, args };
            }
            currentArg += ch;
        } else if (ch === "," && depth === 1) {
            args.push(currentArg.trim());
            currentArg = "";
        } else {
            currentArg += ch;
        }
        i++;
    }
    return null;
}

for (const [file, errs] of Object.entries(fileErrors)) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    let fileFixed = 0;
    let fileFailed = 0;

    // 按行号从大到小处理（避免行号偏移）
    const linesToFix = [...new Set(errs.map((e) => e.line))].sort((a, b) => b - a);

    for (const lineNum of linesToFix) {
        const lineIdx = lineNum - 1;
        if (lineIdx < 0 || lineIdx >= lines.length) {
            fileFailed++;
            continue;
        }

        let line = lines[lineIdx];

        // 模式: 函数名(xxx, yyy) 形式（2个参数，第2个参数后直接是)）
        // 先尝试用括号匹配的方式
        let fixed = false;

        // 找所有类似 await xxx( 或 xxx( 的调用
        const callStartRegex = /(await\s+)?([a-zA-Z_$][\w$.]*)\s*\(/g;
        let m;

        while ((m = callStartRegex.exec(line)) !== null) {
            const fnName = m[2];
            const openParenIdx = m.index + m[0].length - 1;

            const result = findClosingParen(line, openParenIdx);
            if (!result) continue;

            const { endIdx, args } = result;

            // 只处理恰好 2 个参数的调用
            if (args.length !== 2) continue;

            // 验证是否是 controller 调用（参数名包含 req/res/mockReq/mockRes 等）
            const firstArg = args[0];
            const secondArg = args[1];
            const looksLikeControllerCall =
                /req(uest)?/i.test(firstArg) ||
                /mockReq/i.test(firstArg) ||
                /res(ponse)?/i.test(secondArg) ||
                /mockRes/i.test(secondArg);

            if (!looksLikeControllerCall) continue;

            // 构造新调用
            const newCall = `${fnName}(${args[0]}, ${args[1]}, vi.fn())`;
            const oldCall = line.substring(m.index, endIdx + 1);

            // 替换
            line = line.substring(0, m.index) + newCall + line.substring(endIdx + 1);
            fileFixed++;
            fixed = true;
            break; // 一行只处理一个
        }

        if (fixed) {
            lines[lineIdx] = line;
        } else {
            fileFailed++;
        }
    }

    if (fileFixed > 0) {
        const newContent = lines.join("\n");
        fs.writeFileSync(file, newContent, "utf8");
        totalFixed += fileFixed;
        const relPath = path.relative(testDir, file);
        console.log(`[OK] ${relPath}: 修复 ${fileFixed} 处`);
    }
    if (fileFailed > 0) {
        const relPath = path.relative(testDir, file);
        console.log(`[WARN] ${relPath}: ${fileFailed} 处未修复`);
        totalFailed += fileFailed;
    }
}

console.log(`\n结果: 修复 ${totalFixed} 处, 未修复 ${totalFailed} 处`);
