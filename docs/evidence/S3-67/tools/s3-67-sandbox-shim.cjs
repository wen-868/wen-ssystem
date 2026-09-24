/**
 * S3-67 取证环境辅助：沙箱子进程补丁（只在**取证脚手架**里用 NODE_OPTIONS=--require 预加载）
 *
 * 背景（实测，非推测）：本沙箱禁止 node 创建**带管道**的子进程 ——
 *   `spawn(exe, args, { stdio: ['pipe','pipe','pipe'] })` ⇒ EPERM（stdio:'ignore' / 文件 fd 正常）。
 *   ⇒ vite 在 Windows 上执行 `net use`（探测网络盘）会直接抛 EPERM，构建/起服中断。
 *
 * 本补丁只做一件事：把这类**探测性**子进程降级为"探测失败"，让上游走它的 fallback 分支。
 *   - `net use`：vite `optimizeSafeRealPathSync()` 的探测 ⇒ 失败即不启用 realpath 缓存（vite 官方 fallback）。
 *   - 其他带管道的 spawn：**不拦截**（保持原样报错），避免掩盖真实问题。
 *
 * 🔴 不改变任何构建/渲染/样式行为，也不触碰项目源码。
 */
const cp = require("child_process");

const origExec = cp.exec;
const origExecFile = cp.execFile;
const isNetUseProbe = (cmd) => /^\s*net\s+use\b/i.test(String(cmd));

cp.exec = function patchedExec(cmd, opts, cb) {
  if (isNetUseProbe(cmd)) {
    const callback = typeof opts === "function" ? opts : cb;
    const err = new Error("EPERM（沙箱禁止带管道子进程）: net use 探测已跳过");
    err.code = "EPERM";
    if (typeof callback === "function") queueMicrotask(() => callback(err, "", ""));
    return { on() { return this; }, once() { return this; }, kill() {}, pid: 0 };
  }
  return origExec.apply(this, arguments);
};

cp.execFile = function patchedExecFile(file, args, opts, cb) {
  if (isNetUseProbe([file, ...(Array.isArray(args) ? args : [])].join(" "))) {
    const callback = typeof opts === "function" ? opts : cb;
    const err = new Error("EPERM（沙箱禁止带管道子进程）: net use 探测已跳过");
    err.code = "EPERM";
    if (typeof callback === "function") queueMicrotask(() => callback(err, "", ""));
    return { on() { return this; }, once() { return this; }, kill() {}, pid: 0 };
  }
  return origExecFile.apply(this, arguments);
};

if (!process.env.S3_67_SHIM_QUIET) {
  process.stderr.write("[s3-67-shim] 已加载（net use 探测降级）\n");
}

/**
 * 追加（仅在 `S3_67_ESBUILD_JS_TRANSFORM=1` 时启用）：
 *   本沙箱连 esbuild 的**原生二进制**也起不来（spawn 需要管道 ⇒ EPERM），而 vite 的
 *   `replaceDefine()`（define 替换）与 `vite:build-html` 会调用 `esbuild.transform`。
 *   这里把 `esbuild.transform` 换成**纯 JS 实现**：只做 define 键的标识符级替换
 *   （`import.meta.env.*` / `process.env.NODE_ENV` 等），这正是 vite 在该调用点需要的全部能力。
 *
 * 🔴 边界（如实声明）：
 *   - 只替换 `transform`，`build` 不动（若别处真需要原生 esbuild，会照旧报 EPERM，不掩盖问题）；
 *   - 替换是"按标识符边界 + 最长键优先"的文本替换，不做完整 JS 解析；
 *   - 由于 admin-web 构建里 esbuild 只承担 define 替换（`esbuild:false` 已关闭转译/压缩），
 *     该实现与原生行为在**本工程范围内**等价；产物正确性由"浏览器真实渲染 + 样式读数"反证。
 */
if (process.env.S3_67_ESBUILD_JS_TRANSFORM === "1") {
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const applyDefine = (code, define) => {
    const keys = Object.keys(define).sort((a, b) => b.length - a.length);
    let out = code;
    for (const key of keys) {
      const value = define[key];
      const parts = key.split(".").map(escapeRe);
      const re = new RegExp(parts.join("\\s*\\.\\s*") + "(?![\\w$])", "g");
      out = out.replace(re, () => value);
    }
    return out;
  };
  const jsTransform = async (code, options = {}) => ({
    code: options.define ? applyDefine(code, options.define) : code,
    map: "",
    warnings: [],
  });
  // 说明：esbuild 的 `module.exports` 是 `__toCommonJS()` 产物，`transform` 是**不可配置的 getter**
  // ⇒ `Object.defineProperty(esbuild, 'transform', ...)` 实测报 "Cannot redefine property"。
  // 改用 `require.cache[resolved].exports` 换成一个 Proxy：CJS→ESM 互操作时命名导出按
  // `module.exports[name]` 惰性读取，Proxy 即可让 `import { transform } from "esbuild"` 拿到实现。
  const Module = require("module");
  const resolveEsbuild = () => {
    try {
      return require.resolve("esbuild", { paths: [process.cwd(), __dirname] });
    } catch {
      return null;
    }
  };
  const esbuildMain = resolveEsbuild();
  if (!esbuildMain) throw new Error("[s3-67-shim] 找不到 esbuild 模块");
  const realMain = require("fs").realpathSync(esbuildMain);
  const isEsbuildMain = (s) => typeof s === "string" && /esbuild[\\/]lib[\\/]main\.js$/.test(s);
  const makeProxy = (target) =>
    new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === "transform") return jsTransform;
        return Reflect.get(t, prop, receiver);
      },
      // 不重写 getOwnPropertyDescriptor：esbuild 的导出是不可配置 getter，
      // Proxy 不变量要求原样返回，否则 Node 建 ESM 命名空间时报错（已实测）。
    });
  // 关键：必须在 **esbuild 被 ESM 命名空间快照之前**替换 module.exports，
  // 因此拦 Module._load（CJS 装载入口），而不是等 require 回来再改缓存。
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    const exp = origLoad.apply(this, arguments);
    if ((request === "esbuild" || isEsbuildMain(request)) && exp && typeof exp.transform === "function") {
      return makeProxy(exp);
    }
    return exp;
  };
  for (const key of [esbuildMain, realMain]) {
    if (require.cache[key]) require.cache[key].exports = makeProxy(require.cache[key].exports);
  }
  if (!process.env.S3_67_SHIM_QUIET) {
    process.stderr.write("[s3-67-shim] esbuild.transform 已替换为纯 JS define 替换实现\n");
  }
}
