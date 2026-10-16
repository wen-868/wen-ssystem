/**
 * S3-240 探针（保留备查）：确认 `@vue/compiler-dom` 能把**模板片段**编成可渲染函数，
 * 供 `admin-web/tests/permission-gates.spec.mjs` 的 DOM 装置使用（不依赖 vite / esbuild / @vue/test-utils）。
 *
 * 结论：`compile(tpl, { mode: "function", prefixIdentifiers: true })` 产出
 *   `const { …helpers } = Vue` + `return function render(_ctx, _cache) { … _ctx.canGate('x') … }`
 *   ⇒ 用 `new Function(code)()` 取回 render，交给 `Vue.createApp({ setup, render })` 渲染到 jsdom 即可。
 *   未注册的组件（`el-button` / `el-popconfirm`）会经 `_resolveComponent` 走 app 级注册 ⇒ 装置里挂桩组件。
 *
 * 运行：node docs/evidence/S3-240/tools/probe-compile-shape.mjs
 */
import { compile } from "@vue/compiler-dom";
const tpl = `<el-popconfirm v-if="canGate('x')" title="q"><template #reference><el-button size="small" link type="danger">删除</el-button></template></el-popconfirm>`;
const a = compile(tpl, { mode: "function", prefixIdentifiers: true });
console.log("---- function/prefixIdentifiers:true ----");
console.log(a.code.slice(0, 700));
