/**
 * MOBILE-COMMERCIAL-IMPLEMENTATION-01 · 六项商用缺口修复测试
 *
 * ① classifyApiError 纯函数：401-登录/401-会话/403/404/500/超时/断网/业务失败 语义可区分且不泄漏内部信息；
 * ② 源码形态锁：登录 401 豁免、会员 onShow query 同步、积分账户读取、错误态与重试 UI；
 * ③ GAP-1 回归锁：对账详情 SQL 别名修复必须在本分支（F3F1 修复不得再脱落）。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyApiError } from '../src/api/request'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('GAP-5 · classifyApiError 错误语义分类（404/403/500/超时/断网可区分）', () => {
  it('登录接口自身 401 ⇒ 凭据错误（与会话过期严格区分）', () => {
    const c = classifyApiError({ statusCode: 401, isLoginRequest: true })
    expect(c.kind).toBe('credentials')
    expect(c.message).toContain('账号或密码不正确')
    expect(c.message).not.toContain('过期')
  })

  it('其它请求 401 ⇒ 会话过期语义', () => {
    const c = classifyApiError({ statusCode: 401, isLoginRequest: false })
    expect(c.kind).toBe('session')
    expect(c.message).toContain('登录已过期')
  })

  it('403 ⇒ 无权限；404 ⇒ 内容不存在（不得说成系统错误）', () => {
    expect(classifyApiError({ statusCode: 403 }).kind).toBe('forbidden')
    expect(classifyApiError({ statusCode: 403 }).message).toContain('权限')
    expect(classifyApiError({ statusCode: 404 }).kind).toBe('notfound')
    expect(classifyApiError({ statusCode: 404 }).message).toContain('不存在')
  })

  it('500/502 ⇒ 系统错误（与"不存在"严格区分，禁止把 500 说成业务不存在）', () => {
    expect(classifyApiError({ statusCode: 500 }).kind).toBe('server')
    expect(classifyApiError({ statusCode: 502 }).message).toContain('系统繁忙')
    expect(classifyApiError({ statusCode: 500 }).message).not.toContain('不存在')
  })

  it('超时与断网语义可区分', () => {
    expect(classifyApiError({ isTimeout: true }).kind).toBe('timeout')
    expect(classifyApiError({ isTimeout: true }).message).toContain('超时')
    expect(classifyApiError({ isNetworkFail: true }).kind).toBe('network')
    expect(classifyApiError({ isNetworkFail: true }).message).toContain('网络连接失败')
  })

  it('业务失败回退：带后端 msg 时透传 msg', () => {
    const c = classifyApiError({ backendMsg: '会员不存在' })
    expect(c.kind).toBe('business')
    expect(c.message).toBe('会员不存在')
  })

  it('文案不泄漏内部信息（token/堆叠/状态码原样）', () => {
    for (const c of [
      classifyApiError({ statusCode: 401, isLoginRequest: true }),
      classifyApiError({ statusCode: 500 }),
      classifyApiError({ isNetworkFail: true }),
    ]) {
      expect(c.message).not.toMatch(/eyJ|Bearer|stack|traceId/i)
    }
  })
})

describe('GAP-2 · 登录失败反馈（request 层豁免 + 登录页展示位）', () => {
  it('request.ts 对登录接口自身的 401 走凭据语义拒绝，不再 reLaunch 抹掉反馈', () => {
    const src = read('src/api/request.ts')
    expect(src).toContain('isLoginRequest')
    expect(src).toContain('.test(String(options.url || \'\')')
    expect(src).toMatch(/登录接口自身的 401 是\*\*凭据错误\*\*/)
    // 登录 401 分支内不得出现 reLaunch/清态调用（豁免在全局 401 处理之前 return）
    const loginBranch = src.slice(src.indexOf('isLoginRequest = String'), src.indexOf("reject(Object.assign(new Error(c.message), { statusCode: 401, kind: c.kind }))"))
    expect(loginBranch).not.toContain('reLaunch')
    expect(loginBranch).not.toContain('removeStorageSync')
  })

  it('login.vue 存在表单内错误展示位且 catch 写入 errorMsg', () => {
    const src = read('src/pages/login/login.vue')
    expect(src).toContain('v-if="errorMsg"')
    expect(src).toMatch(/errorMsg\.value = err\?\.message \|\| '登录失败，请重试'/)
  })
})

describe('GAP-3 · 会员 query 切换重载（onShow 感知 + 写目标一致）', () => {
  it('member-detail 注册 onShow 并在 id 变化时整体重载（含清空旧 member）', () => {
    const src = read('src/pages-sub/marketing/member/member-detail.vue')
    expect(src).toContain("import { onLoad, onShow } from '@dcloudio/uni-app'")
    expect(src).toMatch(/syncToRouteMember\(\)[\s\S]*?qid !== memberId\.value[\s\S]*?member\.value = null[\s\S]*?loadDetail\(\)/)
    expect(src).toContain('onShow(() => {')
    expect(src).toContain("syncToRouteMember() } catch")
    expect(src).toContain('editMode.value = false')
  })
})

describe('GAP-4 · 积分显示来自真实积分账户', () => {
  it('member-detail 调用 GET /store/members/:id/points 并以 availablePoints 展示与校验', () => {
    const src = read('src/pages-sub/marketing/member/member-detail.vue')
    expect(src).toContain("get(`/store/members/${memberId.value}/points`)")
    expect(src).toContain('await loadAccountPoints()')
    expect(src).toContain('available: Number(d.availablePoints ?? d.points ?? 0)')
    // 三处展示 + 校验改用 availablePoints；等级累计仍用 pointBase
    expect(src).toContain('{{ availablePoints }}</text>')
    expect(src).toContain('当前可用积分 {{ availablePoints }}')
    expect(src).toContain("availablePoints.value + v < 0")
    expect(src).toContain('pointBase') // 等级晋级累计口径保留
  })
})

describe('GAP-6 · 错误态与重试兜底', () => {
  it('member-detail 错误态按 notfound/forbidden/系统三类呈现，系统错误带页内重试', () => {
    const src = read('src/pages-sub/marketing/member/member-detail.vue')
    expect(src).toContain(`loadError.kind === 'notfound' ? '会员不存在或已失效'`)
    expect(src).toContain(`loadError.kind === 'forbidden' ? '当前账号无权限查看该会员'`)
    expect(src).toContain(`'系统繁忙，加载失败'`)
    expect(src).toContain('@tap="retryLoad"')
    expect(src).toMatch(/function retryLoad\(\) \{\s*if \(loading\.value\) return/)
    // 分支顺序：loadError 优先于 member（切换失败不得渲染旧会员）
    expect(src.indexOf('v-else-if="loadError"')).toBeLessThan(src.indexOf('v-else-if="member"'))
  })

  it('member-list 错误态与空态互斥（list-error 与 empty-state 的 v-if 条件互斥）', () => {
    const src = read('src/pages-sub/marketing/member/member-list.vue')
    expect(src).toContain(`v-if="!loading && listLoadError && filtered.length === 0"`)
    expect(src).toContain(`v-if="!loading && !listLoadError && filtered.length === 0"`)
  })

  it('member-detail 错误态含区分性副文案（error-sub-text）', () => {
    const src = read('src/pages-sub/marketing/member/member-detail.vue')
    expect(src).toContain('error-sub-text')
  })

  it('member-list 错误态与空态互斥且带页内重试', () => {
    const src = read('src/pages-sub/marketing/member/member-list.vue')
    expect(src).toContain('listLoadError')
    expect(src).toContain(`listLoadError.kind === 'forbidden' ? '当前账号无权限查看会员列表'`)
    expect(src).toContain('@tap="retryLoadList"')
    expect(src.indexOf('list-error')).toBeLessThan(src.indexOf('empty-state'))
  })
})

describe('GAP-1 · 对账详情 SQL 修复回归锁（F3F1 修复不得再脱落）', () => {
  it('403 携带后端 msg 时透传（避免吞掉业务语义）', () => {
    expect(classifyApiError({ statusCode: 403, backendMsg: '无权限执行此操作，需要权限: report:finance' }).message).toContain('report:finance')
  })

  it('对账弹层金额格式化保持 F3F1 修复（Number 转换防 TypeError 回归）', () => {
    const src = read('src/pages-sub/finance/reconciliation/reconciliation.vue')
    expect(src).toContain('Number(val || 0).toFixed(2)')
  })

  it('对账卡片点击必须接通详情弹层（GAP-1 的用户可见入口）', () => {
    const src = read('src/pages-sub/finance/reconciliation/reconciliation.vue')
    expect(src).toContain('@tap="goDetail(item)"')
    expect(src).toContain('detailVisible.value = true')
    expect(src).toContain('class="detail-modal"')
  })

  it('本分支后端对账详情 SQL 必须声明别名 r（列表与详情一致）', () => {
    const svc = read('../backend/src/services/admin/reconciliation.service.ts')
    const detail = svc.slice(svc.indexOf('r.tenant_id'))
    expect(detail, '详情 SQL 须使用 `FROM t_receivable r`（F3F1 修复）').toContain('FROM t_receivable r')
    expect(svc.match(/FROM t_receivable(?! r)/g)?.length ?? 0, '不得再出现无别名的详情/分页 SQL').toBe(0)
  })
})
