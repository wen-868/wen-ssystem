const fs = require('node:fs')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27/app-mobile/'
const hits = (f, n) => fs.readFileSync(TREE + f, 'latin1').split(n).length - 1
const cases = [
  ['src/utils/crypto.ts', 'if (iv.length !== 12) return null'],
  ['src/utils/crypto.ts', 'if (false && iv.length !== 12) return null'],
  ['src/api/modules/products.ts', '      id: skuId,'],
  ['src/api/modules/products.ts', '      id: r.spuId ?? r.id,'],
  ['src/pages/ai-chat/ai-chat.vue', `<app-tab-bar :current="'ai'"`],
  ['src/pages/ai-chat/ai-chat.vue', `<custom-tab-bar :current="'ai'"`],
  ['src/pages/ai-chat/ai-chat.vue', "components/app-tab-bar.vue'"],
  ['src/pages/ai-chat/ai-chat.vue', "components/custom-tab-bar.vue'"],
  ['src/pages/ai-chat/ai-chat.vue', 'const aiMsg = reactive<ChatMessage>({'],
  ['src/pages/ai-chat/ai-chat.vue', 'const aiMsg: ChatMessage = {'],
  ['src/pages/ai-chat/ai-chat.vue', '    streaming: true\n  })'],
  ['src/pages/ai-chat/ai-chat.vue', '    streaming: true\n  }'],
]
for (const [f, n] of cases) console.log(`${String(hits(f, n)).padStart(2)}  ${f}  ::  ${JSON.stringify(n)}`)
