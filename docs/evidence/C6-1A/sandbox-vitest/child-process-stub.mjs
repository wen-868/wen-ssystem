import * as real from "node:child_process";
export * from "node:child_process";
export { default } from "node:child_process";
export function exec(cmd, opts, cb) {
  if (typeof opts === "function") { cb = opts; opts = {}; }
  if (typeof cmd === "string" && /^\s*net\s+use\s*$/i.test(cmd)) {
    process.nextTick(() => { if (typeof cb === "function") cb(new Error("net use probe skipped in sandbox"), "", ""); });
    return { on() { return this; }, once() { return this; }, kill() {}, unref() {}, stdout: null, stderr: null };
  }
  return real.exec(cmd, opts, cb);
}
