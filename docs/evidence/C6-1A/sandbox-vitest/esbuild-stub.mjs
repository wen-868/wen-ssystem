import ts from "file:///D:/Users/ZXQL/ZXQL-MS/wen-ssystem/node_modules/typescript/lib/typescript.js";
export const version = "0.25.12";
function fileNameFor(loader) {
  if (loader === "ts") return "a.ts";
  if (loader === "tsx") return "a.tsx";
  if (loader === "jsx") return "a.jsx";
  return "a.js";
}
function compile(input, options = {}) {
  if (options.loader === "json") return { code: `export default ${input}`, map: "{\"version\":3,\"sources\":[],\"names\":[],\"mappings\":\"\"}", warnings: [] };
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: false,
    useDefineForClassFields: false,
    sourceMap: true,
    inlineSourceMap: false,
    isolatedModules: true,
    ...(options.tsconfigRaw || {})
  };
  const out = ts.transpileModule(String(input), { compilerOptions, fileName: fileNameFor(options.loader) });
  const map = out.sourceMapText || "{\"version\":3,\"sources\":[],\"names\":[],\"mappings\":\"\"}";
  return { code: out.outputText, map, warnings: [] };
}
export async function transform(input, options = {}) { return compile(input, options); }
export function transformSync(input, options = {}) { return compile(input, options); }
export async function formatMessages() { return []; }
export function formatMessagesSync() { return []; }
export async function build() { throw new Error("esbuild stub: build not supported"); }
export function buildSync() { throw new Error("esbuild stub: buildSync not supported"); }
export async function context() { throw new Error("esbuild stub: context not supported"); }
export default { version, transform, transformSync, formatMessages, formatMessagesSync, build, buildSync, context };
