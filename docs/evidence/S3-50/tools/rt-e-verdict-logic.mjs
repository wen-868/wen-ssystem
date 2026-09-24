'use strict';
// S3-50 反测 RT-E：a11y 汇总步骤的判定逻辑（等价复刻）
//
// 被检对象：e2e.yml job `a11y` step 9 `a11y sampling verdict (如实判定，红就是红)`
//   CI 内逻辑（bash）：读 /tmp/a11y-exit-1..10.txt，任一 != "0" 即 exit 1。
//
// 本机沙箱没有可用的 POSIX shell（Git Bash 起不来，见 outputs/rt-env.txt），
// 因此这里按同一语义逐条复刻（同一批退出码、同一判定式），不是原步骤解释器执行。
// 结论只到「逻辑会红」，不等于 CI 上该步骤已被红测过（后者需要 run id）。
//
// 复跑：node docs/evidence/S3-50/tools/rt-e-verdict-logic.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const line = (s = '') => process.stdout.write(s + '\n');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's3-50-rtE-'));

function writeSamples(codes) {
  codes.forEach((c, i) => fs.writeFileSync(path.join(dir, `a11y-exit-${i + 1}.txt`), String(c) + '\n'));
}

function verdict() {
  let fail = 0;
  const seen = [];
  for (let i = 1; i <= 10; i++) {
    const f = path.join(dir, `a11y-exit-${i}.txt`);
    const code = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : 'MISSING';
    seen.push(`[sample ${i}] exit=${code}`);
    if (code !== '0') fail = 1;
  }
  return { fail, exit: fail === 1 ? 1 : 0, seen };
}

line('=====================  S3-50 RT-E  a11y 汇总判定逻辑反测  =====================');
line(`样本目录：${dir}`);
line('');

line('--- A) 十次取样全 0（期望 exit 0）---');
writeSamples([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
{
  const v = verdict();
  v.seen.forEach(line);
  line(`exit=${v.exit}` + (v.exit === 0 ? '  ✅ A 通过：全绿判绿' : '  ❌ A 失败'));
}
line('');

line('--- B) 第 7 次取样非 0（期望 exit 1）---');
writeSamples([0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
{
  const v = verdict();
  v.seen.forEach(line);
  line(`exit=${v.exit}` + (v.exit === 1 ? '  ✅ B 通过：任一次非 0 即红（不被前 6 次绿洗掉）' : '  ❌ B 失败'));
}
line('');

line('--- C) 样本文件缺失＝取样步骤被跳过（期望 exit 1）---');
fs.rmSync(path.join(dir, 'a11y-exit-4.txt'));
{
  const v = verdict();
  v.seen.forEach(line);
  line(`exit=${v.exit}` + (v.exit === 1 ? '  ✅ C 通过：缺样本按非 0 处理，不会静默放行' : '  ❌ C 失败'));
}

line('');
line('=====================  RT-E 结束  =====================');
fs.rmSync(dir, { recursive: true, force: true });
