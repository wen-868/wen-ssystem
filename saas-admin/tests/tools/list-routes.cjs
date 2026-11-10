#!/usr/bin/env node
const fs = require('fs')
const s = fs.readFileSync('saas-admin/src/router/index.ts', 'utf8')
const paths = [...s.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
console.log('路由', paths.length, '条:')
console.log(paths.join('\n'))
