#!/usr/bin/env node
/**
 * R101 任务派单脚本（执行方：阿坚｜通道：ZCode CLI）
 *
 * 任务与执行方命名（2026-09-12 用户指定）：第 1 步界面 → 林夕（见 docs/tasks/cards/），
 * 第 2/3 步接口与后端 → 阿坚（本脚本派发的就是这一批，任务卡里执行方已统一记为「阿坚」）。
 *
 * 用法：
 *   node scripts/r101-dispatch-zcode.mjs --list                 # 列出可派任务
 *   node scripts/r101-dispatch-zcode.mjs --task R101-S3-01      # 派单个任务
 *   node scripts/r101-dispatch-zcode.mjs --step S3              # 派某一步全部任务
 *   node scripts/r101-dispatch-zcode.mjs --task R101-S3-01 --dry-run  # 只打印任务卡不执行
 *
 * 说明：ZCode CLI 入口为 <ZCode 安装目录>/resources/glm/zcode.cjs，
 *      需先完成模型配置（zcode login 或写入 ~/.zcode/cli/config.json）。
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formPath = path.join(repoRoot, 'docs/tasks/r101-tasks.json');
const form = JSON.parse(readFileSync(formPath, 'utf8'));

/** 通道入口：ZCode CLI（Windows 默认安装路径，可用 ZCODE_CLI 环境变量覆盖）——仅作执行通道，不参与任务命名 */
const ZCODE_CLI =
  process.env.ZCODE_CLI || 'C:/Program Files (x86)/ZCode/resources/glm/zcode.cjs';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(name);

const stepFilter = getArg('--step');
const taskFilter = getArg('--task');
const dryRun = hasFlag('--dry-run');
const listOnly = hasFlag('--list');

let targets = form.tasks.filter((t) => t.agent === 'ajian');
if (stepFilter) targets = targets.filter((t) => t.step === stepFilter);
if (taskFilter) targets = targets.filter((t) => t.id === taskFilter);

if (listOnly) {
  console.log(`R101 可派给阿坚的任务（共 ${targets.length} 项）：`);
  for (const t of targets) {
    console.log(`  ${t.id}  ${t.title}  [${t.estimateDays}天]  依赖: ${t.deps.join(' / ') || '无'}`);
  }
  process.exit(0);
}

if (targets.length === 0) {
  console.error('未匹配到任务，请用 --list 查看可用任务号。');
  process.exit(1);
}

/** 生成任务卡文本（严格遵循项目规则的必读文件与验收要求） */
function buildPrompt(task) {
  return [
    `你是智享全链项目的执行方。请严格按项目规则完成以下任务，只改有问题的地方，不做无关改动。`,
    ``,
    `【项目】智享全链 · 总后台（仓库根目录：${repoRoot}）`,
    `【任务号】${task.id}｜【任务名】${task.title}`,
    `【所属步骤】第 ${task.step.slice(1)} 步 · ${task.stepName}`,
    `【优先级】${task.priority}｜【预估】${task.estimateDays} 人天`,
    `【依赖】${task.deps.join('；') || '无'}`,
    ``,
    `【开工前必读】`,
    ...form.mandatoryReads.map((f) => `  - ${f}`),
    ``,
    `【交付内容】`,
    ...task.deliverable.map((d) => `  - ${d}`),
    ``,
    `【涉及文件】`,
    ...task.files.map((f) => `  - ${f}`),
    ``,
    `【验收标准】`,
    ...task.acceptance.map((a) => `  - ${a}`),
    ``,
    `【硬性约束】`,
    `  - ${form.rules.minimalChange}`,
    `  - ${form.rules.noFakeData}`,
    `  - ${form.rules.configurable}`,
    `  - ${form.rules.boundary}`,
    `  - ${form.rules.dbChange}`,
    `  - ${form.rules.apiContract}`,
    `  - ${form.rules.commits}`,
    ``,
    `【完成后输出】交付说明 + 逐条验收证据（命令与输出、涉及文件清单、提交哈希）。`,
  ].join('\n');
}

console.log(`准备派发 ${targets.length} 个任务给阿坚${dryRun ? '（预览模式，不执行）' : ''}...\n`);

for (const task of targets) {
  const prompt = buildPrompt(task);
  console.log('='.repeat(72));
  console.log(`>>> ${task.id} ${task.title}`);
  if (dryRun) {
    console.log(prompt);
    continue;
  }
  const res = spawnSync('node', [ZCODE_CLI, '--prompt', prompt], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (res.status !== 0) {
    console.error(`\n[失败] ${task.id} 退出码 ${res.status}；后续任务已停止。`);
    process.exit(res.status ?? 1);
  }
  console.log(`\n[完成] ${task.id}\n`);
}

console.log(dryRun ? '预览结束。' : '全部任务派发完成，请按验收标准复核。');
