'use strict';
/*
 * S3-50 门禁体检 · 步骤枚举器（只读）
 *
 * 用途：把 .github/workflows/ 下每个 workflow 的 **job × 步骤** 逐项枚举出来，
 *       带 1-based 行号、步骤名、uses/run 首行、if、continue-on-error，
 *       作为《门禁四档表》的行集合来源（保证"全覆盖、可核对"）。
 *
 * 复跑：node docs/evidence/S3-50/tools/probe-workflow-steps.mjs
 * 只读：本脚本不写任何文件（输出走 stdout，由调用方重定向到 outputs/）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const WF_DIR = path.join(ROOT, '.github', 'workflows');

const files = fs
  .readdirSync(WF_DIR)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .sort();

const out = [];
const push = (s = '') => out.push(s);

let totalJobs = 0;
let totalSteps = 0;
let totalGateSteps = 0;

for (const f of files) {
  const full = path.join(WF_DIR, f);
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);

  const jobsIdx = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const onIdx = lines.findIndex((l) => /^on:\s*$/.test(l) || /^on:\s*\[/.test(l));

  // job 名：jobs: 之后、二级缩进的 `<name>:`（排除属性行如 runs-on: / steps:）
  const jobNames = [];
  for (let i = jobsIdx + 1; i < lines.length; i++) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (m) jobNames.push({ name: m[1], line: i + 1 });
  }
  const jobBlocks = jobNames.map((j, idx) => ({
    ...j,
    start: j.line,
    end: idx + 1 < jobNames.length ? jobNames[idx + 1].line - 1 : lines.length,
  }));

  push(`===================================================================`);
  push(`workflow: ${f}   （文件 ${lines.length} 行；on: 见第 ${onIdx + 1} 行；${jobBlocks.length} 个 job）`);
  push(`===================================================================`);
  totalJobs += jobBlocks.length;

  for (const jb of jobBlocks) {
    const block = lines.slice(jb.start - 1, jb.end);
    const runsOn = /^\s{4}runs-on:\s*(.+)$/m.exec(block.join('\n'));
    const hasJobCOE = /^\s{4}continue-on-error:\s*true\s*$/m.test(block.join('\n'));
    push('');
    push(`── job: ${jb.name}   （L${jb.start}；runs-on=${runsOn ? runsOn[1].trim() : '?'}${hasJobCOE ? '；job 级 continue-on-error: true ⇒ 永不阻断' : ''}）`);

    // 步骤：`      - ` 起始项
    const stepStarts = [];
    for (let i = jb.start - 1; i < jb.end; i++) {
      if (/^ {6}- /.test(lines[i])) stepStarts.push(i);
    }
    if (stepStarts.length === 0) {
      push('  （未识别到步骤项）');
      continue;
    }

    stepStarts.forEach((s, si) => {
      const e = si + 1 < stepStarts.length ? stepStarts[si + 1] : jb.end;
      const chunk = lines.slice(s, e);
      const first = chunk[0];
      const inlineName = /^ {6}- name:\s*(.+)$/.exec(first);
      let name = inlineName ? inlineName[1].trim() : null;
      if (!name) {
        const nm = /^\s+name:\s*(.+)$/m.exec(chunk.slice(1).join('\n'));
        name = nm ? nm[1].trim() : null;
      }
      const uses = /^\s+(?:- )?uses:\s*(.+)$/m.exec(chunk.join('\n'));
      const runLine = /^\s+(?:- )?run:\s*(.+)$/m.exec(chunk.join('\n'));
      const ifLine = /^\s+if:\s*(.+)$/m.exec(chunk.join('\n'));
      const coe = /^\s+continue-on-error:\s*(.+)$/m.exec(chunk.join('\n'));

      const kind = uses ? `uses: ${uses[1].trim()}` : runLine ? `run: ${runLine[1].trim()}` : '(无 uses/run)';
      const isGate = Boolean(runLine || uses);
      if (isGate) totalGateSteps++;
      totalSteps++;

      push(
        `  step ${String(si + 1).padStart(2)} L${String(s + 1).padStart(3)}  [${isGate ? '检查/执行' : '　　'}] ` +
          (name ?? '(无名)')
      );
      push(`         ${kind}`);
      if (ifLine) push(`         if: ${ifLine[1].trim()}`);
      if (coe) push(`         continue-on-error: ${coe[1].trim()}`);
    });
  }
  push('');
}

push('===================================================================');
push(`合计：workflow 文件 ${files.length} 个 ｜ job ${totalJobs} 个 ｜ 步骤 ${totalSteps} 个`);
push('===================================================================');

process.stdout.write(out.join('\n') + '\n');
