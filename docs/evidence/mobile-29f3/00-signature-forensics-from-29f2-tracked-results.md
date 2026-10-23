node _tmp-peek.mjs docs/evidence/mobile-29f2/smoke/results.json
# MOBILE-29F3 取证前置：凌舟要求 message 按"现场实际字段"定义——本记录为从 29F2 git 留档
# （docs/evidence/mobile-29F2/smoke/results.json，基线提交 4b28551c）提取的**已知空壳全字段**：
{
  "raw": "Object",
  "knownId": "PlaywrightError 空壳（工具侧：name/stack 为空且 log 为空数组，非页面运行时错误）",
  "parts": {
    "name": "",
    "ctor": "PlaywrightError",
    "logLen": 0,
    "keys": ["log", "name"],
    "inspect": "[Object] { log: [] }",
    "stack": ""
  }
}
# 判读：
#   1) raw = String(parts.message || parts.inspect) 的产物 = "Object" ⇒ 现场 parts.message 为 FALSY，
#      message 不是该空壳自身可枚举键（keys 恰为 ["log","name"]，且 Playwright 序列化对 Error 形态
#      注入 name/message/stack ⇒ 非自身可枚举）。卡面 message="Object" 按此坐实为
#      **序列化形态**（String(message||inspect) === "Object"），非对象自身枚举属性。
#   2) 断言总数 = 19（凌舟验收卡实测 19/19 通过，本单保留此口径）。
#   3) env 残留清理与 5199 释放均通过（留档 after 两处 = null）。
