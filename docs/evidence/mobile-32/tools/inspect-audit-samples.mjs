import { audit } from './audit-write-actions.mjs'

const rows = audit()
const groups = [
  ['login/login', /pages\/login\/login\.vue/],
  ['register/register', /pages\/register\/register\.vue/],
  ['reports/reports', /reports\/reports\.vue/],
  ['notification-detail', /notification-detail\.vue/],
  ['profile/profile', /pages\/profile\/profile\.vue/],
  ['components', /components\//],
]
for (const [name, re] of groups) {
  const pick = rows.filter((r) => re.test(r.page))
  if (!pick.length) continue
  console.log('--- ' + name + ' (' + pick.length + ')')
  for (const r of pick.slice(0, 8)) {
    console.log('  L' + r.line + ' <' + r.element + '> @' + r.handler + ' | text="' + r.text + '" | guarded=' + r.guarded)
  }
}

console.log('')
console.log('=== 分布统计：handler 名 → 次数（前 25）===')
const m = new Map()
for (const r of rows) m.set(r.handler, (m.get(r.handler) || 0) + 1)
for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log('  ' + String(v).padStart(3) + '  ' + k)
}
