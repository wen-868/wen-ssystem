/**
 * AI 底座容器装配回归检查（本地提交前门禁）
 *
 * 背景：P0-P3 期间两次「单测全过但生产启动崩溃」（模块循环依赖、Module exports 缺失），
 * 均为 Nest 容器装配的 DI 错误——单元测试不装配容器，仅在启动时暴露。
 *
 * 本脚本：启动 dist/main.js，观察 6 秒——
 * - 进程存活（本地无 MySQL 卡连接重试）且无 DI 错误 → 通过
 * - 进程崩溃 / 输出 Nest can't resolve / UndefinedDependency → 失败
 *
 * 用法：node scripts/check-ai-base-start.mjs
 * 前置：cd backend/ai-base && pnpm run build
 */
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MAIN = join(ROOT, 'backend', 'ai-base', 'dist', 'main.js');

const child = spawn('node', [MAIN], {
  cwd: join(ROOT, 'backend', 'ai-base'),
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (d) => (output += String(d)));
child.stderr.on('data', (d) => (output += String(d)));

const DI_PATTERNS = /Nest can't resolve|UndefinedDependency|UnknownDependenciesException/i;

setTimeout(() => {
  if (child.exitCode === null) {
    // 进程存活：本地无 MySQL 会卡连接重试，说明 DI 装配通过
    child.kill('SIGKILL');
    if (DI_PATTERNS.test(output)) {
      console.error('❌ 启动日志含 DI 错误：');
      console.error(output.slice(0, 800));
      process.exit(1);
    }
    console.log('✅ AI 底座容器装配通过（进程稳定运行，仅卡数据库连接）');
    process.exit(0);
  }

  // 进程已退出（启动崩溃）
  console.error(`❌ AI 底座启动崩溃（exit=${child.exitCode}）：`);
  console.error(output.slice(0, 1200));
  process.exit(1);
}, 6000);

child.on('error', (err) => {
  console.error('❌ 启动进程异常：', err.message);
  process.exit(1);
});
