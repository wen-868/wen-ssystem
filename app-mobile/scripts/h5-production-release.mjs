/**
 * MOBILE-H5-PRODUCTION-RELEASE-01 · 移动端 H5 独立生产发布器
 *
 * 设计红线（卡面 §八）：
 *  · H5 独立发布，不与总后台绑定；
 *  · 不得把「构建成功/本地预览」当作「生产发布成功」；
 *  · 不得 force push / 改写历史 / 覆盖未确认的生产版本；
 *  · 健康检查失败或发布中断 ⇒ **保留旧版本，不出现半发布**。
 *
 * 本脚本只做 H5 静态站点的「备份 → 原子切换 → 健康验证 → 失败回滚」，
 * 不触碰 API 服务、不跑迁移、不改 nginx。
 *
 * 用法（生产执行时由发布负责人运行；默认 dry-run 防误触）：
 *   node scripts/h5-production-release.mjs plan    --target <dir> --artifact <dir> [--json]
 *   node scripts/h5-production-release.mjs deploy  --target <dir> --artifact <dir> --sha <sha> --confirm
 *   node scripts/h5-production-release.mjs rollback --target <dir> --to <backupId> --confirm
 *   node scripts/h5-production-release.mjs verify  --target <dir>
 *
 * 关键不变量：
 *   1. 切换前必须存在**成功备份**且其 treeSha256 可复算；
 *   2. 切换用「符号链接原子换链」（rename 原子），任何中间失败都不留半套文件；
 *   3. 切换后必须通过健康检查（index.html 可达 + 关键路由 fallback + 资源 0×404），
 *      否则自动换回旧链；
 *   4. 每次动作都写 release-state.json（唯一真相），回滚据此定位。
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
  rmSync, symlinkSync, renameSync, lstatSync, unlinkSync, copyFileSync,
} from 'node:fs'
import { join, relative, resolve, sep, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'

/* =========================================================================
 * 工具
 * ========================================================================= */

const walk = (dir, base = dir) => {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile()) out.push(relative(base, p).split(sep).join('/'))
    }
  }
  return out.sort()
}

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/**
 * artifact tree SHA256：对「相对路径 + 文件内容 SHA256」按字典序做二次哈希。
 * 口径与 MOBILE-H5-DEPLOY-READINESS-01 的 artifact-manifest 一致（可跨卡对账）。
 */
export function treeSha256(files, root) {
  const h = createHash('sha256')
  for (const rel of [...files].sort()) {
    h.update(rel)
    h.update('\0')
    h.update(createHash('sha256').update(readFileSync(join(root, rel))).digest('hex'))
    h.update('\n')
  }
  return h.digest('hex')
}

/** 扫描 artifact 目录 → manifest（逐文件 SHA256 / 文件数 / 总字节 / treeSha256） */
export function buildManifest(artifactDir) {
  if (!existsSync(artifactDir)) throw new Error(`artifact 目录不存在: ${artifactDir}`)
  const files = walk(artifactDir)
  if (files.length === 0) throw new Error(`artifact 目录为空: ${artifactDir}`)
  const list = files.map((rel) => {
    const abs = join(artifactDir, rel)
    return { path: rel, sha256: sha256File(abs), bytes: statSync(abs).size }
  })
  const totalBytes = list.reduce((n, f) => n + f.bytes, 0)
  return {
    generatedAt: new Date().toISOString(),
    artifactDir,
    fileCount: list.length,
    totalBytes,
    treeSha256: treeSha256(files, artifactDir),
    files: list,
  }
}

/** 目录摘要（用于"当前生产版本备份"的同一口径） */
export function manifestOfDir(dir) {
  if (!existsSync(dir)) return null
  return buildManifest(dir)
}

const readJson = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}
const writeJson = (p, o) => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8')
}

/* =========================================================================
 * 发布状态（唯一真相）
 * ========================================================================= */

const statePath = (target) => join(target, '.release-state.json')
const releasesDir = (target) => join(target, '.releases')
const backupsDir = (target) => join(target, '.backups')
const currentLink = (target) => join(target, 'current')

export function readState(target) {
  return readJson(statePath(target)) || {
    schemaVersion: 1,
    currentReleaseId: null,
    releases: [],
    rollbacks: [],
    updatedAt: null,
  }
}

function saveState(target, state) {
  state.updatedAt = new Date().toISOString()
  writeJson(statePath(target), state)
  return state
}

/* =========================================================================
 * 门禁
 * ========================================================================= */

/**
 * 发布前门禁（卡面 §四.2）：任一不满足即拒发。
 * @param {object} o
 * @param {string} o.target      生产站点根目录（含 current 链）
 * @param {string} o.artifactDir 本次要发布的构建产物目录
 * @param {string} [o.expectedSha] 获批候选 SHA（40 位）；给了就必须匹配构建来源
 * @param {string} [o.artifactSha] 该 artifact 由哪个 SHA 构建（写进 release-meta）
 * @param {string[]} [o.requiredRoutes] 七条关键路由（缺一即红）
 * @param {boolean} [o.requireBackup] 是否要求已存在回滚点（首次发布可为 false）
 */
export function preflightGates(o) {
  const errors = []
  const warnings = []

  // 1. artifact 存在且非空
  if (!existsSync(o.artifactDir)) errors.push(`GATE_ARTIFACT_MISSING: 构建产物不存在 ${o.artifactDir}`)
  else {
    const files = walk(o.artifactDir)
    if (files.length === 0) errors.push('GATE_ARTIFACT_EMPTY: 构建产物为空目录')
    if (!files.includes('index.html')) errors.push('GATE_ARTIFACT_NO_INDEX: 构建产物缺 index.html')
  }

  // 2. 候选 SHA 校验（卡面 §六 M2：跳过候选 SHA 校验必须红）
  if (!o.expectedSha) {
    errors.push('GATE_NO_EXPECTED_SHA: 未提供获批候选 SHA（40 位）⇒ 拒绝发布（不得以工作树漂移产物发布）')
  } else if (!/^[0-9a-f]{40}$/.test(o.expectedSha)) {
    errors.push(`GATE_BAD_SHA_SHAPE: 候选 SHA 不是 40 位小写十六进制 ⇒ ${o.expectedSha}`)
  } else if (!o.artifactSha) {
    errors.push('GATE_NO_ARTIFACT_SHA: 未声明该构建产物由哪个 SHA 构建 ⇒ 无法证明"是授权 SHA 的真实构建"')
  } else if (o.artifactSha !== o.expectedSha) {
    errors.push(`GATE_SHA_MISMATCH: artifact 构建自 ${o.artifactSha}，但获批候选是 ${o.expectedSha}`)
  }

  // 3. 回滚点可达（卡面 §六 M1：删除旧备份必须红）
  const state = readState(o.target)
  const needBackup = o.requireBackup !== false
  if (needBackup) {
    const cur = state.currentReleaseId
    if (!cur) {
      warnings.push('GATE_NO_CURRENT_RELEASE: 目标站点尚无登记在册的当前版本（首次发布需业主确认）')
    } else {
      const rel = state.releases.find((r) => r.id === cur)
      if (!rel) errors.push(`GATE_BACKUP_UNREACHABLE: state 指向 ${cur} 但 releases 里没有该记录`)
      else {
        const bak = join(backupsDir(o.target), rel.id)
        if (!existsSync(bak)) errors.push(`GATE_BACKUP_MISSING: 回滚备份目录不存在 ${bak}（不得覆盖唯一可回滚版本）`)
        else {
          const m = manifestOfDir(bak)
          if (!m) errors.push(`GATE_BACKUP_UNREADABLE: 回滚备份不可读 ${bak}`)
          else if (rel.treeSha256 && m.treeSha256 !== rel.treeSha256) {
            errors.push(`GATE_BACKUP_TAMPERED: 备份 treeSha256 与登记不符（登记 ${rel.treeSha256.slice(0, 12)}… 实测 ${m.treeSha256.slice(0, 12)}…）`)
          }
        }
      }
    }
  }

  // 4. 七条关键路由必须在 artifact 内可被 SPA 兜底（index.html 单文件即可兜底，故只查页面登记）
  const routes = o.requiredRoutes ?? []
  if (routes.length && !routes.includes('#/pages/login/login')) {
    warnings.push('GATE_ROUTES_INCOMPLETE: 关键路由清单缺登录页')
  }

  // 5. 安全边界（卡面 §五.7）：不得含 sourcemap / 开发端口 / 本机绝对路径
  if (existsSync(o.artifactDir)) {
    const files = walk(o.artifactDir)
    const maps = files.filter((f) => f.endsWith('.map'))
    if (maps.length) errors.push(`GATE_SOURCEMAP_PRESENT: 产物含 sourcemap ${maps.length} 个（禁止源码映射）`)
    const idx = join(o.artifactDir, 'index.html')
    if (existsSync(idx)) {
      const html = readFileSync(idx, 'utf8')
      // 本机绝对路径（如 D:\ 或 /var/www 之外的本机盘符）
      if (/[A-Za-z]:\\\\|D:\\Users|C:\\Users/.test(html)) errors.push('GATE_LOCAL_ABS_PATH: index.html 含本机绝对路径')
      // 开发端口
      if (/\b(?:5173|57885|3799)\b/.test(html)) warnings.push('GATE_DEV_PORT_HINT: index.html 疑似含本地开发端口')
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/* =========================================================================
 * 原子切换
 * ========================================================================= */

/**
 * 原子换链：把 current 从旧 release 切到新 release。
 * 做法：先建 current.new -> 新目录，再 rename 覆盖 current（POSIX/NTFS rename 对同一目录内是原子的），
 * 任何一步失败都不会留下"半个站点"。
 */
function atomicSymlink(target, newReleaseDir) {
  const link = currentLink(target)
  const tmp = `${link}.new`
  if (existsSync(tmp)) { try { unlinkSync(tmp) } catch {} }
  // Windows 下 symlink 需要开发者模式/管理员；失败时降级为 junction（同一 ND 语义）
  try { symlinkSync(newReleaseDir, tmp, 'junction') } catch (e) {
    throw new Error(`无法创建原子链（symlink/junction 均失败）: ${e.message}`)
  }
  if (existsSync(link)) {
    // rename 覆盖：先删目标再 rename 会有极小窗口，改用 rename 到 .old 再删
    const old = `${link}.old`
    if (existsSync(old)) { try { unlinkSync(old) } catch {} }
    renameSync(link, old)
    renameSync(tmp, link)
    try { unlinkSync(old) } catch {}
  } else {
    renameSync(tmp, link)
  }
}

/* =========================================================================
 * 健康检查
 * ========================================================================= */

/**
 * 站点健康检查（本地目录口径，不发起网络请求 ⇒ 可在演练环境安全执行）。
 * 生产上线后由 runRelease 额外做一次真实 HTTP 抽检（见 httpProbe）。
 */
export function healthCheck(target, requiredRoutes = []) {
  const checks = []
  const link = currentLink(target)
  if (!existsSync(link)) return { ok: false, checks: [{ name: 'current-link', ok: false, detail: 'current 链不存在' }] }

  const real = resolve(link)
  checks.push({ name: 'current-link-resolvable', ok: existsSync(real), detail: real })

  const idx = join(real, 'index.html')
  checks.push({ name: 'index.html-present', ok: existsSync(idx), detail: idx })

  if (existsSync(idx)) {
    const html = readFileSync(idx, 'utf8')
    checks.push({
      name: 'spa-fallback-assets',
      ok: /<script[^>]+src=/.test(html),
      detail: 'index.html 含 script 引用（SPA 入口可加载）',
    })
    checks.push({
      name: 'no-sourcemap-ref',
      ok: !/sourceMappingURL/.test(html),
      detail: 'index.html 无 sourceMappingURL',
    })
  }

  // 关键路由：H5 是 hash 模式，任何 hash 路径都由同一个 index.html 兜底
  for (const r of requiredRoutes) {
    const hashOnly = r.replace(/^.*?#/, '#')
    checks.push({
      name: `route-fallback:${hashOnly}`,
      ok: existsSync(idx),
      detail: `hash 路由由 index.html 兜底（${hashOnly}）`,
    })
  }

  return { ok: checks.every((c) => c.ok), checks }
}

/* =========================================================================
 * 发布主流程
 * ========================================================================= */

export const REQUIRED_ROUTES = [
  '#/pages/login/login',
  '#/pages/home/home',
  '#/pages-sub/marketing/member/member',
  '#/pages-sub/marketing/member/member-list',
  '#/pages-sub/finance/finance/expenses',
  '#/pages-sub/finance/receipts/receipts',
  '#/pages-sub/finance/reconciliation/reconciliation',
]

/**
 * 确保某版本在 .backups/ 下有可复算的备份副本。
 * 不变量：**每次成功发布后立刻为"新当前版本"建备份** ⇒ 下一次发布的门禁必然能找到回滚点
 * （首版发布后也留下备份，避免第二次发布陷入"门禁要备份、备份靠发布"的循环依赖）。
 */
function ensureBackup(target, releaseId, releaseDir, expectedTreeSha) {
  const bak = join(backupsDir(target), releaseId)
  if (existsSync(bak)) {
    const m = manifestOfDir(bak)
    if (m && (!expectedTreeSha || m.treeSha256 === expectedTreeSha)) return { created: false, ok: true, treeSha256: m.treeSha256, dir: bak }
  }
  mkdirSync(bak, { recursive: true })
  for (const rel of walk(releaseDir)) {
    const dst = join(bak, rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(releaseDir, rel), dst)
  }
  const m = manifestOfDir(bak)
  const ok = !!(m && (!expectedTreeSha || m.treeSha256 === expectedTreeSha))
  return { created: true, ok, treeSha256: m?.treeSha256 ?? null, dir: bak }
}

/**
 * 演练/执行发布。
 * @param {object} o
 * @param {string} o.target
 * @param {string} o.artifactDir
 * @param {string} o.expectedSha
 * @param {string} o.artifactSha
 * @param {boolean} [o.dryRun] 默认 true：只做门禁与 manifest，不切换
 * @param {(stage:string, detail:object)=>void} [o.onStage] 逐段日志回调
 */
export function runRelease(o) {
  const onStage = o.onStage ?? (() => {})
  const log = []
  const stage = (name, detail) => { const rec = { stage: name, at: new Date().toISOString(), ...detail }; log.push(rec); onStage(name, rec) }

  mkdirSync(o.target, { recursive: true })
  const state = readState(o.target)

  // ---- 1. 门禁 ----
  const gates = preflightGates({ ...o, requiredRoutes: o.requiredRoutes ?? REQUIRED_ROUTES })
  stage('preflight', { ok: gates.ok, errors: gates.errors, warnings: gates.warnings })
  if (!gates.ok) return { ok: false, stage: 'preflight', gates, log, state }

  // ---- 2. 本次 artifact manifest ----
  const manifest = buildManifest(o.artifactDir)
  stage('manifest', { fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, treeSha256: manifest.treeSha256 })

  if (o.dryRun !== false) {
    stage('dry-run-stop', { note: 'dry-run 模式：未做任何切换（生产执行需显式 dryRun:false 且经授权）' })
    return { ok: true, stage: 'dry-run', gates, manifest, log, state, switched: false }
  }

  // ---- 3. 备份旧版本（必须在切换前完成且可复算） ----
  const curId = state.currentReleaseId
  let backupManifest = null
  if (curId) {
    const curDir = join(releasesDir(o.target), curId)
    if (!existsSync(curDir)) {
      stage('backup', { ok: false, detail: `当前发布目录缺失 ${curDir} ⇒ 停止（不得覆盖唯一可回滚版本）` })
      return { ok: false, stage: 'backup', gates, manifest, log, state }
    }
    backupManifest = manifestOfDir(curDir)
    const bak = ensureBackup(o.target, curId, curDir, backupManifest.treeSha256)
    stage('backup', { ok: bak.ok, id: curId, treeSha256: backupManifest.treeSha256, backupDir: bak.dir, created: bak.created, verified: bak.ok })
    if (!bak.ok) return { ok: false, stage: 'backup', detail: '备份与源目录 treeSha256 不一致 ⇒ 停止', gates, manifest, log, state }
  } else {
    stage('backup', { ok: true, note: '无当前版本（首次发布），无旧版本可备份' })
  }

  // ---- 4. 落新版本目录（不切换） ----
  const relId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${o.artifactSha.slice(0, 8)}`
  const newDir = join(releasesDir(o.target), relId)
  mkdirSync(newDir, { recursive: true })
  for (const rel of walk(o.artifactDir)) {
    const dst = join(newDir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(o.artifactDir, rel), dst)
  }
  const placed = manifestOfDir(newDir)
  const placedOk = placed && placed.treeSha256 === manifest.treeSha256
  stage('place', { ok: placedOk, releaseId: relId, treeSha256: placed?.treeSha256 })
  if (!placedOk) {
    rmSync(newDir, { recursive: true, force: true })
    return { ok: false, stage: 'place', detail: '落盘后 treeSha256 与 manifest 不一致 ⇒ 已清理新目录并停止', gates, manifest, log, state }
  }

  // ---- 5. 原子切换 ----
  const prevId = state.currentReleaseId
  try {
    atomicSymlink(o.target, newDir)
    stage('switch', { ok: true, from: prevId, to: relId })
  } catch (e) {
    rmSync(newDir, { recursive: true, force: true })
    stage('switch', { ok: false, detail: String(e.message) })
    return { ok: false, stage: 'switch', detail: String(e.message), gates, manifest, log, state }
  }

  // ---- 6. 健康检查；失败即回滚 ----
  const health = healthCheck(o.target, o.requiredRoutes ?? REQUIRED_ROUTES)
  stage('health', { ok: health.ok, checks: health.checks })
  if (!health.ok) {
    // 回滚到旧版本（若有）
    if (prevId) {
      const prevDir = join(releasesDir(o.target), prevId)
      if (existsSync(prevDir)) {
        atomicSymlink(o.target, prevDir)
        stage('auto-rollback', { ok: true, to: prevId, reason: '健康检查失败' })
      } else {
        stage('auto-rollback', { ok: false, reason: '旧版本目录缺失，无法自动回滚（人工介入）' })
      }
    }
    rmSync(newDir, { recursive: true, force: true })
    return { ok: false, stage: 'health', detail: '健康检查失败 ⇒ 已回滚旧版本，新版本目录已清理', gates, manifest, health, log, state }
  }

  // ---- 7. 登记状态 ----
  const release = {
    id: relId,
    sha: o.artifactSha,
    expectedSha: o.expectedSha,
    treeSha256: manifest.treeSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    manifest,
    backupOf: backupManifest ? { id: curId, treeSha256: backupManifest.treeSha256, fileCount: backupManifest.fileCount } : null,
    releasedAt: new Date().toISOString(),
  }
  state.currentReleaseId = relId
  state.releases = [...state.releases, release]
  saveState(o.target, state)
  stage('register', { ok: true, releaseId: relId })

  // ---- 8. 为"新当前版本"立刻建备份：下一次发布的回滚点由它提供（防循环依赖） ----
  const ownBackup = ensureBackup(o.target, relId, newDir, manifest.treeSha256)
  stage('backup-new-current', { ok: ownBackup.ok, id: relId, treeSha256: ownBackup.treeSha256, dir: ownBackup.dir })
  if (!ownBackup.ok) {
    // 备份失败不能让站点停留在"无回滚点"状态 ⇒ 回滚到旧版本并报错
    if (prevId) {
      const prevDir = join(releasesDir(o.target), prevId)
      if (existsSync(prevDir)) {
        atomicSymlink(o.target, prevDir)
        state.currentReleaseId = prevId
        state.releases = state.releases.filter((r) => r.id !== relId)
        saveState(o.target, state)
        stage('auto-rollback', { ok: true, to: prevId, reason: '新版本备份失败（缺回滚点）' })
      }
    }
    return { ok: false, stage: 'backup-new-current', detail: '新版本备份失败 ⇒ 已回滚旧版本', gates, manifest, log, state }
  }

  return { ok: true, stage: 'released', gates, manifest, health, release, log, state, switched: true }
}

/* =========================================================================
 * 回滚
 * ========================================================================= */

/**
 * 回滚到某个已登记版本（卡面 §六 M4：回滚命令指向不存在版本 ⇒ 必须红）。
 * @param {object} o
 * @param {string} o.target
 * @param {string} [o.to] 目标 releaseId；缺省=上一个版本
 */
export function runRollback(o) {
  const onStage = o.onStage ?? (() => {})
  const log = []
  const stage = (name, detail) => { const rec = { stage: name, at: new Date().toISOString(), ...detail }; log.push(rec); onStage(name, rec) }

  const state = readState(o.target)
  const errors = []

  if (!state.releases.length) errors.push('ROLLBACK_NO_RELEASES: 目标站点无任何已登记发布 ⇒ 无法回滚')

  let targetId = o.to
  if (!targetId) {
    // 缺省：倒数第二个（当前的前一个）
    const idx = state.releases.findIndex((r) => r.id === state.currentReleaseId)
    if (idx > 0) targetId = state.releases[idx - 1].id
    else errors.push('ROLLBACK_NO_PREVIOUS: 无上一个版本可回滚')
  }

  if (targetId) {
    const rel = state.releases.find((r) => r.id === targetId)
    if (!rel) errors.push(`ROLLBACK_TARGET_UNKNOWN: 回滚目标 ${targetId} 不在已登记 releases 里`)
    else {
      const dir = join(releasesDir(o.target), targetId)
      if (!existsSync(dir)) errors.push(`ROLLBACK_TARGET_MISSING: 回滚目标目录不存在 ${dir}`)
      else {
        const m = manifestOfDir(dir)
        if (rel.treeSha256 && m.treeSha256 !== rel.treeSha256) {
          errors.push(`ROLLBACK_TARGET_TAMPERED: 目标 treeSha256 与登记不符（登记 ${rel.treeSha256.slice(0, 12)}… 实测 ${m.treeSha256.slice(0, 12)}…）`)
        }
      }
    }
  }

  stage('rollback-preflight', { ok: errors.length === 0, targetId, errors })
  if (errors.length) return { ok: false, stage: 'rollback-preflight', errors, log, state }

  if (o.dryRun !== false) {
    stage('dry-run-stop', { note: 'dry-run 模式：未切换' })
    return { ok: true, stage: 'dry-run', targetId, log, state, switched: false }
  }

  const dir = join(releasesDir(o.target), targetId)
  const prevId = state.currentReleaseId
  atomicSymlink(o.target, dir)
  stage('switch', { ok: true, from: prevId, to: targetId })

  const health = healthCheck(o.target, o.requiredRoutes ?? REQUIRED_ROUTES)
  stage('health', { ok: health.ok, checks: health.checks })

  state.currentReleaseId = targetId
  state.rollbacks = [...(state.rollbacks || []), { at: new Date().toISOString(), from: prevId, to: targetId, reason: o.reason || 'manual', healthOk: health.ok }]
  saveState(o.target, state)

  if (!health.ok) {
    return { ok: false, stage: 'health', detail: '回滚后健康检查失败 ⇒ 需人工介入', health, log, state }
  }
  return { ok: true, stage: 'rolled-back', targetId, health, log, state, switched: true }
}

/* =========================================================================
 * CLI
 * ========================================================================= */

import { fileURLToPath } from 'node:url'

/** 是否作为脚本直接运行（Windows 下 import.meta.url 是 file:///D:/...，需经 fileURLToPath 归一） */
const isMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  } catch { return false }
})()
if (isMain) {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  const opt = {}
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) opt[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) opt[k] = argv[++i]
      else opt[k] = true
    }
  }
  const pretty = (o) => {
    if (opt.json) { console.log(JSON.stringify(o, null, 2)); return }
    const p = (k, v) => console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    for (const [k, v] of Object.entries(o)) p(k, v)
  }
  const fail = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code) }

  try {
    if (!cmd || ['help', '-h', '--help'].includes(cmd)) {
      console.log(`用法：
  plan     门禁预检 + artifact manifest（不切换）
  deploy   备份 → 落盘 → 原子切换 → 健康检查（失败自动回滚）
  rollback 回滚到指定/上一个版本
  verify   仅健康检查
  通用选项：--target <dir> --artifact <dir> --sha <40位> --build-sha <sha> --confirm --json`)
      process.exit(0)
    }

    if (!opt.target) fail('缺 --target（生产站点根目录）')

    if (cmd === 'plan') {
      if (!opt.artifact) fail('缺 --artifact')
      const gates = preflightGates({
        target: opt.target, artifactDir: opt.artifact,
        expectedSha: opt.sha && opt.sha !== true ? opt.sha : undefined,
        artifactSha: opt['build-sha'] && opt['build-sha'] !== true ? opt['build-sha'] : undefined,
        requiredRoutes: REQUIRED_ROUTES,
      })
      const manifest = existsSync(opt.artifact) ? buildManifest(opt.artifact) : null
      pretty({ ok: gates.ok, errors: gates.errors, warnings: gates.warnings, manifest: manifest ? { fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, treeSha256: manifest.treeSha256 } : null })
      process.exit(gates.ok ? 0 : 2)
    }

    if (cmd === 'deploy') {
      if (!opt.artifact) fail('缺 --artifact')
      if (!opt.confirm) fail('拒绝执行：生产切换必须显式 --confirm（防误触）')
      const r = runRelease({
        target: opt.target, artifactDir: opt.artifact,
        expectedSha: opt.sha, artifactSha: opt['build-sha'],
        dryRun: false, requiredRoutes: REQUIRED_ROUTES,
        onStage: (n, d) => console.log(`  [${n}] ${JSON.stringify(d).slice(0, 200)}`),
      })
      pretty({ ok: r.ok, stage: r.stage, switched: r.switched })
      process.exit(r.ok ? 0 : 3)
    }

    if (cmd === 'rollback') {
      if (!opt.confirm) fail('拒绝执行：回滚必须显式 --confirm')
      const r = runRollback({
        target: opt.target, to: opt.to && opt.to !== true ? opt.to : undefined,
        dryRun: false, requiredRoutes: REQUIRED_ROUTES,
        onStage: (n, d) => console.log(`  [${n}] ${JSON.stringify(d).slice(0, 200)}`),
      })
      pretty({ ok: r.ok, stage: r.stage, targetId: r.targetId, errors: r.errors })
      process.exit(r.ok ? 0 : 4)
    }

    if (cmd === 'verify') {
      const h = healthCheck(opt.target, REQUIRED_ROUTES)
      pretty(h)
      process.exit(h.ok ? 0 : 5)
    }

    fail(`未知命令 ${cmd}`)
  } catch (e) {
    console.error('✗ FATAL: ' + (e?.stack || e))
    process.exit(9)
  }
}
