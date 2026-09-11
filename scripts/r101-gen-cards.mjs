/**
 * R101 任务卡生成脚本
 *
 * 用途：把 docs/tasks/r101-tasks.json（主表单）+ docs/tasks/cards-design.json（逐页设计要点）
 *      合成 30 张可单独转发的任务卡，输出到 docs/tasks/cards/。
 *
 * 用法：
 *   node scripts/r101-gen-cards.mjs            # 重新生成全部任务卡 + 索引
 *   node scripts/r101-gen-cards.mjs --check     # 只校验数据完整性，不写文件
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const formPath = path.join(repoRoot, 'docs/tasks/r101-tasks.json');
const designPath = path.join(repoRoot, 'docs/tasks/cards-design.json');
const outDir = path.join(repoRoot, 'docs/tasks/cards');

const form = JSON.parse(fs.readFileSync(formPath, 'utf8'));
const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));

const agentLabel = {
  workbuddy: 'WorkBuddy（阿坚）',
  zcode: 'ZCode',
  codex: 'Codex（凌舟）',
};

/** 第 1 步标题自带「01 」顺序号，与卡片编号重复，标题里去掉；第 2/3 步标题里的数字是内容（如「28 项配置项」）必须保留 */
const slug = (t) => (t.step === 'S1' ? t.title.replace(/^\d+\s+/, '') : t.title).trim();
/** 文件名不能含 \ / : * ? " < > |，空格会让 Markdown 链接失效，一并去掉 */
const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '');
const cardName = (t) => `${t.id}-${safeName(slug(t))}.md`;

const missingDesign = form.tasks.filter((t) => !design[t.id]).map((t) => t.id);
if (missingDesign.length) {
  console.error(`缺少设计要点：${missingDesign.join(', ')}`);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  console.log(`数据完整：${form.tasks.length} 项任务，设计要点 ${Object.keys(design).length} 条`);
  process.exit(0);
}

const renderCard = (t) => {
  const lines = [];
  lines.push(`# 任务卡 ${t.id} · ${slug(t)}`);
  lines.push('');
  lines.push(`> 项目：${form.project}｜所属步骤：第 ${t.step.slice(1)} 步 ${t.stepName}`);
  lines.push(`> 执行方：${agentLabel[t.agent] || t.agent}｜优先级：${t.priority}｜预估：${t.estimateDays} 天｜状态：待开始`);
  lines.push(`> 前置依赖：${t.deps.length ? t.deps.join('、') : '无'}`);
  lines.push(`> 仓库根目录：${repoRoot}`);
  lines.push('');

  lines.push('## 一、开工前必读（逐份读完再动手，禁止跳读）');
  lines.push('');
  form.mandatoryReads.forEach((f, i) => lines.push(`${i + 1}. \`${f}\``));
  lines.push('');
  lines.push(`重点章节：改造方案 §11「页面级实施对照表」中 ${t.id} 对应行、§10.3「后台可配置项总表」。`);
  lines.push('');

  lines.push('## 二、任务目标（本次交付物）');
  lines.push('');
  t.deliverable.forEach((d) => lines.push(`- ${d}`));
  lines.push('');

  lines.push('## 三、设计要求（设计稿 v1.6 逐页要点，逐项落实）');
  lines.push('');
  lines.push(design[t.id]);
  lines.push('');

  lines.push('## 四、涉及文件');
  lines.push('');
  t.files.forEach((f) => lines.push(`- \`${f}\``));
  lines.push('');
  lines.push('仅允许改动以上文件及为实现本卡目标必须新增的文件；不得顺手改动其他模块。');
  lines.push('');

  lines.push('## 五、验收标准');
  lines.push('');
  t.acceptance.forEach((a) => lines.push(`- [ ] ${a}`));
  lines.push('');
  lines.push('统一门禁（凌舟复核时逐条核对）：');
  form.acceptanceGates.forEach((g) => lines.push(`- [ ] ${g}`));
  lines.push('');

  lines.push('## 六、硬性约束（违反即退回）');
  lines.push('');
  lines.push(`- **最小改动**：${form.rules.minimalChange}`);
  lines.push(`- **数据真实性**：${form.rules.noFakeData}`);
  lines.push(`- **配置项界面化**：${form.rules.configurable}`);
  lines.push(`- **三不边界**：${form.rules.boundary}`);
  lines.push(`- **数据库变更**：${form.rules.dbChange}`);
  lines.push(`- **API 契约**：${form.rules.apiContract}`);
  lines.push(`- **提交规范**：${form.rules.commits}`);
  lines.push('');

  lines.push('## 七、完成后请输出');
  lines.push('');
  lines.push('1. 交付说明：改了什么、每项对应本卡第几节；');
  lines.push('2. 逐条证据：build / tsc / vitest 输出、页面截图或接口返回；');
  lines.push('3. 阻塞点：做不了的部分写清原因与所需支持，不要用占位或假数据掩盖。');
  lines.push('');
  return lines.join('\n');
};

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.md')) fs.unlinkSync(path.join(outDir, f));
}

for (const t of form.tasks) {
  fs.writeFileSync(path.join(outDir, cardName(t)), renderCard(t), 'utf8');
}

const steps = [
  { key: 'S1', label: '第 1 步 · 界面成型' },
  { key: 'S2', label: '第 2 步 · 真实环境对接' },
  { key: 'S3', label: '第 3 步 · 补齐缺失功能' },
];

const readme = [];
readme.push('# R101 任务卡（拆分版）');
readme.push('');
readme.push(`> 项目：${form.project}`);
readme.push(`> 生成：${form.generatedAt}｜共 ${form.tasks.length} 张卡（第 1 步 ${form.summary.byStep.S1} + 第 2 步 ${form.summary.byStep.S2} + 第 3 步 ${form.summary.byStep.S3}）`);
readme.push('> 来源：`docs/tasks/r101-tasks.json` + `docs/tasks/cards-design.json`｜进度看板：`docs/tasks/current-tasks.md`');
readme.push('');
readme.push('每张卡自带「开工前必读 + 交付物 + 设计要求 + 涉及文件 + 验收标准 + 硬性约束」，可整份转发给执行方，无需再补上下文。');
readme.push('');
readme.push(`重新生成：\`node scripts/r101-gen-cards.mjs\``);
readme.push('');
readme.push('## 转发说明');
readme.push('');
readme.push(`- **WorkBuddy**：第 1 步 ${form.summary.byAgent.workbuddy} 张卡，一次转一张；必须等前一张验收通过再转下一张（接口设计可能随验收意见调整）。`);
readme.push(`- **ZCode**：第 2、3 步共 ${form.summary.byAgent.zcode} 张卡；每张卡开工前先确认对应 S1 界面已验收。`);
readme.push('- 执行方回传交付说明后，由凌舟按本卡第五节逐条复核，通过后更新 `docs/tasks/current-tasks.md` 进度总表状态与证据列。');
readme.push('');

for (const s of steps) {
  const list = form.tasks.filter((t) => t.step === s.key);
  readme.push(`## ${s.label}（${list.length} 张）`);
  readme.push('');
  readme.push('| 任务卡 | 执行方 | 优先级 | 预估 | 依赖 | 文件 |');
  readme.push('| --- | --- | --- | --- | --- | --- |');
  for (const t of list) {
    readme.push(
      `| [${t.id} ${slug(t)}](${cardName(t)}) | ${agentLabel[t.agent] || t.agent} | ${t.priority} | ${t.estimateDays}天 | ${t.deps.length ? t.deps.join('、') : '—'} | ${t.files.length} 个 |`
    );
  }
  readme.push('');
}

readme.push('## 关键文档（执行前必读，卡内已列出）');
readme.push('');
for (const f of form.mandatoryReads) readme.push(`- \`${f}\``);
readme.push('');

fs.writeFileSync(path.join(outDir, 'README.md'), readme.join('\n'), 'utf8');

console.log(`已生成 ${form.tasks.length} 张任务卡 + README.md → ${path.relative(repoRoot, outDir)}`);
