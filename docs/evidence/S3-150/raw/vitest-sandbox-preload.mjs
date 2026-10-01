// S3-150-F1 取证用 node 预载（**不落库**）：把 vite 的 `net use` 探测改成 no-op。
//
// vite/dist 的 safeRealPathSync 会 `exec("net use", cb)` 探测网络盘映射；
// 本沙箱拒绝带 pipe stdio 的子进程（spawn EPERM），该调用**同步抛错**并打断整次
// 解析。这里只拦这一条命令，其余 child_process.exec 原样放行。
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cp = require("node:child_process");
const origExec = cp.exec;

cp.exec = function sandboxExec(command, ...rest) {
  if (typeof command === "string" && command.trim() === "net use") {
    const cb = rest.find((a) => typeof a === "function");
    const fakeChild = {
      on() { return fakeChild; },
      once() { return fakeChild; },
      kill() {},
      stdin: null,
      stdout: null,
      stderr: null,
      pid: undefined,
    };
    if (cb) queueMicrotask(() => cb(null, ""));
    return fakeChild;
  }
  return origExec.call(this, command, ...rest);
};
