/**
 * C2-4 核验③：反测（证明检测器**真的会红**）
 *
 * 做法：在**临时副本**里改坏目标对象（仓库文件零改动），用**同一份检测逻辑**再跑一次，
 *   断言 (a) 判定为不一致、(b) 输出点名了被改坏的对象；随后还原副本并再次断言为绿。
 *
 * ⚠ 与上一版的关键差异（为什么重写）：
 *   本沙箱内 `node` 的 child_process spawn 被拒（EPERM：spawnSync node.exe EPERM），
 *   「另起子进程跑检测器」的做法在本机必失败（上一版 6 项反测全部 exit=-1 即此因）。
 *   现改为**进程内**调用 c2-4-lib.mjs 的 analyzeStaticDiff / analyzeCrossFile
 *   —— 检测算法一字未改，只是不再需要子进程。
 *
 * 用法：node docs/evidence/C2-4/tools/c2-4-02-falsify.mjs
 * 退出码：0 = 全部反测通过（含还原检查）；1 = 有反测未达预期
 */
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { analyzeStaticDiff, analyzeCrossFile } from "./c2-4-lib.mjs";

const REPO = resolve(".");
const OUT_DIR = join(REPO, "docs/evidence/C2-4/outputs");

/** 检测器依赖的文件（副本必须齐） */
const COPY_FILES = [
  "backend/src/routes/platform-templates.routes.ts",
  "backend/src/routes/admin-platform-announcement.routes.ts",
  "saas-admin/src/api/platform-template.ts",
  "saas-admin/src/api/announcement.ts",
  "saas-admin/src/utils/request.ts",
  "saas-admin/src/views/platform/TemplateCenter.vue",
  "saas-admin/src/views/Announcements.vue",
];

function buildSandbox() {
  const dir = mkdtempSync(join(tmpdir(), "c2-4-falsify-"));
  for (const rel of COPY_FILES) {
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(REPO, rel), dest);
  }
  // 01b 要求 backend/src/routes 目录里能找到全部路由文件；副本里只放本单两个文件，
  // 对「目标路径是否被别的文件抢先」的判定足够（目标只可能被这两个文件命中）。
  mkdirSync(join(dir, "backend/src/routes"), { recursive: true });
  return dir;
}

/** 进程内跑检测①（与 CLI 同一份逻辑） */
function runStaticDiff(root, label) {
  const { lines, failures } = analyzeStaticDiff(root, label);
  return { exitCode: failures.length === 0 ? 0 : 1, stdout: lines.join("\n"), failures };
}

/** 进程内跑检测①b（与 CLI 同一份逻辑） */
function runCrossFile(root) {
  const { lines, failures } = analyzeCrossFile(root, "GET:/api/platform/announcements/templates");
  return { exitCode: failures.length === 0 ? 0 : 1, stdout: lines.join("\n"), failures };
}

const cases = [
  {
    id: "M1",
    name: "前端路径改错：platform-template.ts 的 print/:id/public → publish",
    file: "saas-admin/src/api/platform-template.ts",
    from: "/platform/templates/print/${id}/public",
    to: "/platform/templates/print/${id}/publish",
    detector: "01",
    expectRed: ["/api/platform/templates/print/${id}/publish", "前端调用无后端路由"],
  },
  {
    id: "M2",
    name: "前端路径改错：announcement.ts 的 /platform/announcements → /platform/announcement（少个 s）",
    file: "saas-admin/src/api/announcement.ts",
    from: "request.get('/platform/announcements', { params })",
    to: "request.get('/platform/announcement', { params })",
    detector: "01",
    expectRed: ["/api/platform/announcement", "前端调用无后端路由"],
  },
  {
    id: "M3",
    name: "后端注册顺序颠倒：GET/PUT /templates 移到 GET /:id 之后（通配吞并）",
    file: "backend/src/routes/admin-platform-announcement.routes.ts",
    // 逐行变形（仓库文件是 CRLF，跨行字符串锚点会失配）：把 `.get("/:id"` 行整行挪到 `.get("/templates"` 之前
    mutate: (text) => {
      const lines = text.split(/\r?\n/);
      const iGet = lines.findIndex((l) => l.includes('.get("/templates"'));
      const iId = lines.findIndex((l) => l.includes('.get("/:id"'));
      if (iGet < 0 || iId < 0) return null;
      const [idLine] = lines.splice(iId, 1);
      lines.splice(iGet, 0, idLine);
      return lines.join("\n");
    },
    detector: "01",
    expectRed: ["通配吞并", "templates 注册早于 /:id ? 否"],
  },
  {
    id: "M4",
    name: "删除后端 GET /templates 注册行（改由 /:id 通配处理）",
    file: "backend/src/routes/admin-platform-announcement.routes.ts",
    mutate: (text) => {
      const lines = text.split(/\r?\n/);
      if (!lines.some((l) => l.includes('.get("/templates"'))) return null;
      return lines.filter((l) => !l.includes('.get("/templates"')).join("\n");
    },
    detector: "01b",
    expectRed: ["是否由「/templates」专门 handler 命中（而非被 /:id 通配吞掉）: 否"],
  },
  {
    id: "M5",
    name: "检出边界（预期不红）：前端方法改错 GET→POST，同路径后端确实存在 POST",
    file: "saas-admin/src/api/announcement.ts",
    from: "request.get('/platform/announcements', { params })",
    to: "request.post('/platform/announcements', { params })",
    detector: "01",
    expectRed: null, // null = 本项不计失败，只记录「集合差集法能否发现」
  },
];

const logs = [];
const push = (s = "") => {
  logs.push(s);
  process.stdout.write(`${s}\n`);
};

push("[C2-4/02] 反测：证明检测器会红（临时副本，仓库文件零改动）");
push(`         仓库根：${REPO}`);
push(`         检测方式：进程内调用 c2-4-lib.mjs（本沙箱 child_process spawn 被拒 EPERM，不能起子进程）`);
push("");

const sandbox = buildSandbox();
let failures = 0;

try {
  // ── 第 1 次原始输出：副本原样（期望绿） ──
  const baseline = runStaticDiff(sandbox, "falsify-baseline-copy");
  push("== 第 1 次原始输出（副本原样，期望 ALL PASS / exit=0） ==");
  for (const l of baseline.stdout.split("\n")) push(`   | ${l}`);
  push(`[C2-4/02] 副本原样 exit=${baseline.exitCode}（期望 0）`);
  if (baseline.exitCode !== 0) {
    failures++;
    push("✗ 副本原样竟然红了 ⇒ 反测前提不成立");
  }
  push("");

  // ── 逐个改坏 → 断言必须红 ──
  for (const c of cases) {
    const target = join(sandbox, c.file);
    const original = readFileSync(target, "utf8");
    push(`== ${c.id} ${c.name} ==`);

    let mutated;
    let before;
    let after;
    if (c.mutate) {
      mutated = c.mutate(original);
      if (mutated === null) {
        failures++;
        push("   ✗ 副本里找不到待改坏的锚点（逐行变形未命中）");
        push("");
        continue;
      }
      const ol = original.split(/\r?\n/);
      const ml = mutated.split("\n");
      before = `${ol.filter((l) => l.includes('"/templates"') || l.includes('"/:id"')).join(" ⏎ ")}`;
      after = `${ml.filter((l) => l.includes('"/templates"') || l.includes('"/:id"')).join(" ⏎ ")}`;
    } else {
      if (!original.includes(c.from)) {
        failures++;
        push(`   ✗ 副本里找不到待改坏的锚点（${c.from.replace(/\n/g, " ⏎ ").slice(0, 90)}…）`);
        push("");
        continue;
      }
      before = c.from;
      after = c.to;
      mutated = original.replace(c.from, c.to);
    }
    writeFileSync(target, mutated, "utf8");

    const res = c.detector === "01" ? runStaticDiff(sandbox, c.id) : runCrossFile(sandbox);
    push(`   改前：${before.replace(/\n/g, " ⏎ ").slice(0, 160)}`);
    push(`   改后：${after.replace(/\n/g, " ⏎ ").slice(0, 160)}`);
    push(`   原始输出（判定行）：`);
    for (const l of res.stdout.split("\n").filter((l) => /FAIL|✗|RESULT|EXIT|templates 注册早于|专门 handler 命中/.test(l))) {
      push(`     ${l}`);
    }
    push(`   exit=${res.exitCode}`);

    if (c.expectRed === null) {
      push(
        `   · 检出边界记录：${res.exitCode === 1 ? "本次改坏**被检出**（集合差集抓到同路径不同方法）" : "本次改坏**未被检出** ⇒ 集合差集法的已知盲区（见回传卡「未完成与阻塞/风险」）"}（不计入失败）`
      );
    } else if (res.exitCode !== 1) {
      failures++;
      push(`   ✗ ${c.id} 未变红 ⇒ 该检测点不可信`);
    } else {
      const missed = c.expectRed.filter((needle) => !res.stdout.includes(needle));
      if (missed.length) {
        failures++;
        push(`   ✗ ${c.id} 变红了，但输出未点名目标对象：缺 ${missed.map((s) => `"${s}"`).join(", ")}`);
      } else {
        push(`   ✓ ${c.id} 变红且点名目标对象（${c.expectRed.map((s) => `"${s}"`).join(" + ")}）`);
      }
    }

    writeFileSync(target, original, "utf8"); // 还原副本
    const restored = c.detector === "01" ? runStaticDiff(sandbox, `${c.id}-restored`) : runCrossFile(sandbox);
    push(`   还原后 exit=${restored.exitCode}（期望 0）`);
    if (restored.exitCode !== 0) {
      failures++;
      push("   ✗ 还原后仍红 ⇒ 还原不干净");
    }
    push("");
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

push(`[C2-4/02] 反测结论：${failures === 0 ? "全部反测通过（检测器确实会红，且红在目标对象上）" : `${failures} 项反测失败`}`);
push(`RESULT: ${failures === 0 ? "ALL PASS" : "FAILURES"}`);
push(`EXIT=${failures === 0 ? 0 : 1}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "02-falsify.log"), `${logs.join("\n")}\n`, "utf8");

// 同时落盘「去掉逐行原始输出明细」的尾段视图，便于人工快速核对
const tail = logs.filter((l) => !l.startsWith("   | ")).join("\n");
writeFileSync(join(OUT_DIR, "02-falsify-stdout.txt"), `${tail}\n`, "utf8");

process.exit(failures === 0 ? 0 : 1);
