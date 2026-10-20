/**
 * QODER-1 门 3 · 测试① 权限码匹配（通配语义，与后端 `rbac.service.ts matchPermission` 同源）
 * 反测面：任何人改动通配判定（去掉 `*` / 模块通配 / 动作通配任一支）⇒ 本用例必红并点名。
 */
import { describe, it, expect } from 'vitest'
import { matchPermissionCode, hasPermissionCodes } from '../src/config/permission-gates'

describe('matchPermissionCode（四步判定顺序，与后端一致）', () => {
  it('① 全局通配 `*` 命中一切码', () => {
    expect(matchPermissionCode(['*'], 'sale:create')).toBe(true)
    expect(matchPermissionCode(['*'], 'system:user:edit')).toBe(true)
  })

  it('② 模块通配 `<dom>:*` 只覆盖本域', () => {
    expect(matchPermissionCode(['sale:*'], 'sale:create')).toBe(true)
    expect(matchPermissionCode(['sale:*'], 'sale:return')).toBe(true)
    expect(matchPermissionCode(['sale:*'], 'purchase:create')).toBe(false)
  })

  it('③ 动作通配 `*:<action>` 只覆盖本动作', () => {
    expect(matchPermissionCode(['*:view'], 'sale:view')).toBe(true)
    expect(matchPermissionCode(['*:view'], 'product:view')).toBe(true)
    expect(matchPermissionCode(['*:view'], 'sale:create')).toBe(false)
  })

  it('④ 精确码命中；其余不通过', () => {
    expect(matchPermissionCode(['customer:points:adjust'], 'customer:points:adjust')).toBe(true)
    expect(matchPermissionCode(['customer:points:adjust'], 'customer:level')).toBe(false)
  })

  it('未取到权限码 / 空码串 ⇒ 不通过（失败关闭语义）', () => {
    expect(matchPermissionCode(null, 'sale:create')).toBe(false)
    expect(matchPermissionCode(undefined, 'sale:create')).toBe(false)
    expect(matchPermissionCode([], 'sale:create')).toBe(false)
    expect(matchPermissionCode(['*'], '')).toBe(false)
  })
})

describe('hasPermissionCodes（入口门"全部持有"口径）', () => {
  it('码数组为空 ⇒ 不门（注册表 registered 入口放行）', () => {
    expect(hasPermissionCodes(['sale:create'], [])).toBe(true)
    expect(hasPermissionCodes(null, [])).toBe(true)
  })

  it('多码必须全持有才通过', () => {
    expect(hasPermissionCodes(['sale:create', 'sale:void'], ['sale:create', 'sale:void'])).toBe(true)
    expect(hasPermissionCodes(['sale:create'], ['sale:create', 'sale:void'])).toBe(false)
  })

  it('未取到权限码（null/undefined）⇒ 失败关闭（S3-231 F3 口径）', () => {
    expect(hasPermissionCodes(null, ['sale:create'])).toBe(false)
    expect(hasPermissionCodes(undefined, ['sale:create'])).toBe(false)
    expect(hasPermissionCodes([], ['sale:create'])).toBe(false)
  })
})
