export async function resolve(specifier, context, nextResolve) {
  if (specifier === "esbuild") {
    return { url: new URL("./esbuild-stub.mjs", import.meta.url).href, shortCircuit: true, format: "module" };
  }
  const parent = context.parentURL || "";
  if (specifier === "node:child_process" && /[\\/]vite[\\/]dist[\\/]/.test(parent)) {
    return { url: new URL("./child-process-stub.mjs", import.meta.url).href, shortCircuit: true, format: "module" };
  }
  return nextResolve(specifier, context);
}
