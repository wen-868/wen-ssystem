#!/usr/bin/env node
/**
 * MOBILE-29F1 反测执行器（§9.1 五步协议机械化）
 *
 * 用法：node anti-run.cjs R1|R2|R3
 *   R1 products.ts 上传改回 JSON 构建器（import + 调用两处）
 *   R2 buildSecureHeaders 摘安全三头（去掉 writeSecureHeaders 调用）
 *   R3 buildJsonHeaders 摘 Content-Type: application/json
 *
 * 每轮：备份 → 记注入前 SHA256 → 注入 → 回读在场 → 跑指定测试文件（红）→
 *       （R1 加跑静态守卫，B/D 红）→ 复原 → 校验 SHA256 恒等 → 复跑绿。
 * 全程输出写 anti/<轮次>-*.log（本执行器只负责前 4 步与第 6-7 步的机制，
 * 第 5 步「复跑绿」由 anti/README.md 的收尾命令执行——因为要在全部轮次
 * 复原后跑一次全量门禁，避免每轮都付一次满量跑的负载代价）。
 */
const { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } = require('node:fs')
const { createHash } = require('node:crypto')
const { execSync } = require('node:child_process')
const { join, dirname } = require('node:path')

const MOBILE = join(__dirname, '..', '..', '..', '..', 'app-mobile') // app-mobile/
const ANTI = __dirname
const round = process.argv[2]
if (!['R1', 'R2', 'R3'].includes(round)) { console.error('用法: node anti-run.cjs R1|R2|R3'); process.exit(2) }

const F = {
  products: join(MOBILE, 'src/api/modules/products.ts'),
  profile: join(MOBILE, 'src/api/modules/profile.ts'),
  request: join(MOBILE, 'src/api/request.ts')
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const backup = (p) => { const b = join(ANTI, `backup-${round}-${require('node:path').basename(p)}`); copyFileSync(p, b); return b }
const log = (...a) => console.log(`[anti ${round}]`, ...a)

const ROUNDS = {
  R1: {
    files: [F.products],
    edits: [[ 'del, buildSecureHeaders } from \'../request\'', 'del, buildJsonHeaders } from \'../request\'' ],
            [ 'const header = buildSecureHeaders()', 'const header = buildJsonHeaders()' ]],
    spec: 'tests/request-contract.spec.ts',
    expectRed: ['㉓'],
    runGuard: true
  },
  R2: {
    files: [F.request],
    edits: [[ "  const headers: Record<string, string> = { ...(extra || {}) }\r\n  writeSecureHeaders(headers)\r\n  return headers",
              "  const headers: Record<string, string> = { ...(extra || {}) }\r\n  return headers" ]],
    spec: 'tests/request-contract.spec.ts',
    expectRed: ['㉑', '㉒', '㉓', '㉔'],
    runGuard: false
  },
  R3: {
    files: [F.request],
    edits: [[ "  const headers: Record<string, string> = {\r\n    'Content-Type': 'application/json',\r\n    ...(extra || {})\r\n  }",
              "  const headers: Record<string, string> = {\r\n    ...(extra || {})\r\n  }" ]],
    spec: 'tests/request-contract.spec.ts',
    expectRed: ['⑨', '⑫'],
    runGuard: false
  }
}

const cfg = ROUNDS[round]
const shasBefore = {}
const backups = {}

// 1) 备份 + 注入前 SHA
for (const p of cfg.files) { backups[p] = backup(p); shasBefore[p] = sha(p) }
log('注入前 SHA256:', JSON.stringify(shasBefore, null, 1))

// 2) 注入（逐条精确替换，任一锚点未命中即中止——绝不模糊注入）
let ok = true
for (const p of cfg.files) {
  let src = readFileSync(p, 'utf8')
  for (const [from, to] of cfg.edits) {
    if (!src.includes(from)) { console.error(`锚点未命中（${p}）：${JSON.stringify(from.slice(0, 60))}`); ok = false; break }
    src = src.replace(from, to)
  }
  if (ok) writeFileSync(p, src)
}
if (!ok) process.exit(3)

// 3) 回读在场
for (const p of cfg.files) {
  const src = readFileSync(p, 'utf8')
  for (const [, to] of cfg.edits) {
    const probe = to.length > 40 ? to.slice(0, 40) : to
    log(`回读在场（${require('node:path').basename(p)}）:`, src.includes(probe) ? 'YES' : 'NO')
  }
}

// 4) 跑目标 spec（期望红 + 点名）
const testCmd = `node ${join(MOBILE, '..', 'node_modules', 'vitest', 'vitest.mjs')} run ${cfg.spec}`
log('运行:', testCmd)
try {
  const out = execSync(testCmd, { cwd: MOBILE, encoding: 'utf8', stdio: 'pipe' })
  writeFileSync(join(ANTI, `${round}-test-output.txt`), out)
  console.error(`✗ 预期红但实测全绿（${round}）——注入未生效或断言失效`)
  process.exit(4)
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`
  writeFileSync(join(ANTI, `${round}-test-output.txt`), out)
  const missing = cfg.expectRed.filter((name) => !out.includes(name))
  if (missing.length) { console.error(`✗ 红了但未点名预期用例：${missing.join(' / ')}`); process.exit(5) }
  log(`✓ 红面点名符合预期：${cfg.expectRed.join(' / ')}`)
}

// 5) （R1）静态守卫必须同红
if (cfg.runGuard) {
  try {
    const out = execSync(`node scripts/guard-request-contract.mjs`, { cwd: MOBILE, encoding: 'utf8', stdio: 'pipe' })
    writeFileSync(join(ANTI, `${round}-guard-output.txt`), out)
    console.error('✗ 预期守卫红但实测绿')
    process.exit(6)
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`
    writeFileSync(join(ANTI, `${round}-guard-output.txt`), out)
    log('✓ 守卫同红（B/D 点名见输出）')
  }
}

// 6) 逐字节复原 + SHA 恒等机检
for (const p of cfg.files) {
  copyFileSync(backups[p], p)
  const now = sha(p)
  log(`复原 SHA256 恒等（${require('node:path').basename(p)}）:`, now === shasBefore[p] ? 'YES' : 'NO')
  if (now !== shasBefore[p]) { console.error('✗ 复原后 SHA 不一致——停止'); process.exit(7) }
}
writeFileSync(join(ANTI, `${round}-sha-before.txt`), Object.entries(shasBefore).map(([p, h]) => `${h}  ${p}`).join('\n') + '\n')
writeFileSync(join(ANTI, `${round}-sha-after.txt`), Object.entries(shasBefore).map(([p, h]) => `${h}  ${p}`).join('\n') + '\n')
log('注入/验红/复原完成。第 5 步「复跑绿」见 anti/README.md 收尾命令。')
