/**
 * MOBILE-H5-DEPLOY-READINESS-01 · H5 生产产物部署就绪静态测试
 *
 * 直接对 dist/build/h5 真实产物审计（build 先行；dist 为 gitignore 构建输出）：
 *  ① index.html 存在；
 *  ② 无本机绝对路径（盘符 / /Users / /home / file://）；
 *  ③ 无开发端口硬编码（5173/3000 dev server）；
 *  ④ 无高置信密钥（私钥块/AWS/sk-/ghp_/xox-/硬编码 JWT）；
 *  ⑤ index.html 引用的本地资源全部存在（无 404 隐患）；
 *  ⑥ artifact manifest 结构合法（HEAD/treeSha256/文件数/大小/时间/路由集）；
 *  ⑦ 路由覆盖 ≥6 且含卡面六类页面；
 *  ⑧ 静态服务 handler：/ 回 index、无扩展名 SPA 兜底、目录穿越拒绝、/api 反代可达。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditArtifact, buildArtifactManifest, createPreviewHandler, PREVIEW_ROUTES, DIST } from '../scripts/deploy-readiness.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
let audit
let manifest

// MOBILE-COMMERCIAL-IMPLEMENTATION-01：466 文件双遍扫描 + 全树 SHA256 在整链负载下可超
// vitest 默认 10s 钩子超时（check:gates 实测 flake）⇒ 显式放宽到 60s
beforeAll(() => {
  audit = auditArtifact()
  manifest = buildArtifactManifest()
}, 60000)

describe('MOBILE-H5-DEPLOY-READINESS · 产物完整性', () => {
  it('① dist/build/h5/index.html 存在（生产构建入口）', () => {
    expect(audit.indexHtml, '缺 index.html ⇒ 未完成生产构建或产物目录不对').toBe(true)
    expect(audit.scanned).toBeGreaterThan(0)
    expect(audit.totalBytes).toBeGreaterThan(100_000)
  })

  it('② 产物内无本机绝对路径（盘符//Users//home/file://）', () => {
    expect(audit.absolutePaths, `绝对路径残留：\n${audit.absolutePaths.join('\n')}`).toEqual([])
  })

  it('③ 产物内无开发端口硬编码（5173/3000 dev server）', () => {
    expect(audit.devPorts, `开发端口残留：\n${audit.devPorts.join('\n')}`).toEqual([])
  })

  it('④ 产物内无高置信密钥（私钥/AWS/sk-/ghp_/xox/硬编码 JWT）', () => {
    expect(audit.secrets, `疑似密钥：\n${audit.secrets.join('\n')}`).toEqual([])
  })

  it('⑤ index.html 引用的本地资源全部存在于产物内（无 404 隐患）', () => {
    expect(audit.missingAssets, `缺失资源：\n${audit.missingAssets.join('\n')}`).toEqual([])
  })
})

describe('MOBILE-H5-DEPLOY-READINESS · artifact manifest', () => {
  it('⑥ manifest 结构合法：HEAD/treeSha256/fileCount/totalBytes/generatedAt/路由集', () => {
    expect(manifest.head, 'HEAD 应为 40 位 commit SHA').toMatch(/^[0-9a-f]{40}$/)
    expect(manifest.distTreeSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.fileCount).toBeGreaterThan(0)
    expect(manifest.totalBytes).toBeGreaterThan(100_000)
    expect(manifest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(manifest.perFileCount).toBe(manifest.fileCount)
  })

  it('⑥b manifest.distTreeSha256 对产物逐文件 SHA256 汇总可复算（确定性）', () => {
    const again = buildArtifactManifest()
    expect(again.distTreeSha256).toBe(manifest.distTreeSha256)
    expect(again.fileCount).toBe(manifest.fileCount)
  })

  it('⑦ 预览路由集 ≥6 且覆盖登录/首页/会员/费用/收款/对账六类', () => {
    expect(PREVIEW_ROUTES.length).toBeGreaterThanOrEqual(6)
    const all = PREVIEW_ROUTES.map((r) => r.path).join('|')
    for (const marker of ['login', 'home', 'member', 'finance/finance/expenses', 'finance/receipts', 'finance/reconciliation']) {
      expect(all, `路由集缺 ${marker}`).toContain(marker)
    }
  })
})

describe('MOBILE-H5-DEPLOY-READINESS · 静态服务 handler（生产预览行为）', () => {
  const handler = createPreviewHandler('http://127.0.0.1:18111')
  function serve(reqOpt, body) {
    return new Promise((resolve, reject) => {
      const s = createServer(handler)
      s.listen(0, '127.0.0.1', async () => {
        const port = s.address().port
        try {
          const res = await fetch(`http://127.0.0.1:${port}${reqOpt.path}`, {
            method: reqOpt.method ?? 'GET',
            headers: reqOpt.headers,
            body,
          })
          const text = await res.text()
          resolve({ status: res.status, contentType: res.headers.get('content-type') ?? '', text: text.slice(0, 400) })
        } catch (e) { reject(e) } finally { s.close() }
      })
    })
  }

  it('⑧a GET / 回 index.html（SPA 入口）', async () => {
    const r = await serve({ path: '/' })
    expect(r.status).toBe(200)
    expect(r.contentType).toContain('text/html')
    expect(r.text).toContain('<!DOCTYPE') // uni-app H5 构建的 index 入口
  })

  it('⑧b 无扩展名深路径回 index.html（SPA 兜底，hash 路由由前端接管）', async () => {
    const r = await serve({ path: '/pages-sub/marketing/member/member-list' })
    expect(r.status).toBe(200)
    expect(r.contentType).toContain('text/html')
  })

  it('⑧c 目录穿越（../）拒绝为 404', async () => {
    const r = await serve({ path: '/..%2f..%2f..%2fpackage.json' })
    expect([r.status, r.text]).not.toContain(200)
    expect(r.text).not.toContain('"name"')
  })

  it('⑧d /api 反代转发到隔离后端（reachable 时透传状态码；不可达时 502 而非假成功）', async () => {
    const r = await serve({ path: '/api/admin/auth/me', method: 'POST' })
    // 隔离后端可能起或未起：起 ⇒ 透传 401（未带 token）；未起 ⇒ 502。均不得是 200 假成功
    expect([401, 403, 502]).toContain(r.status)
  })
})
