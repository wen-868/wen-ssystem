/* eslint-disable */
/**
 * QODER-25F1 反测①注入器（.cjs，纪律见 _qoder23-26-exec-protocol §反测）
 *
 * 注入内容：把 app-mobile/src/pages/ai-chat/ai-chat.vue 的流式消息创建注回**上一轮的缺陷写法**
 *           `const aiMsg = reactive<ChatMessage>({` → `const aiMsg: ChatMessage = {`
 *           （push 语句、回调写入都原样不动，所以注入后正是"数组里存裸对象、回调写裸对象"）
 * 目标红名：tabbar-name-reactivity.spec.ts › R1 流式消息必须先入响应式代理再入 ref 数组，回调写的就是那个代理
 *
 * 用法：node inject-01.cjs <ai-chat.vue 绝对路径>
 * 退出码：0 = 注入成功且 hits==1；2 = hits!=1 或基线不干净（**不许**带着脏基线继续反测）
 */
const fs = require('fs')

const TARGET = process.argv[2]
if (!TARGET) {
  console.error('[inject-01] usage: node inject-01.cjs <path-to-ai-chat.vue>')
  process.exit(2)
}

const BEFORE = 'const aiMsg = reactive<ChatMessage>({'
const AFTER = 'const aiMsg: ChatMessage = {'

const text = fs.readFileSync(TARGET, 'utf8')
const hits = text.split(BEFORE).length - 1
if (hits !== 1) {
  console.error(`[inject-01] ABORT hits=${hits} (expect exactly 1) for needle: ${BEFORE}`)
  process.exit(2)
}
if (text.includes(AFTER)) {
  console.error(`[inject-01] ABORT baseline is not clean, already contains: ${AFTER}`)
  process.exit(2)
}

// 只替换这一处子串：CRLF 工作区里 fs.writeFileSync 回写的是同长度字节流之外的唯一改动，
// 换行符与其余字节保持原样（复原一律用 cp，不用 sed -i / 编辑器写回）。
fs.writeFileSync(TARGET, text.replace(BEFORE, AFTER))
console.log(`[inject-01] OK hits=${hits} :: "${BEFORE}" -> "${AFTER}"`)
