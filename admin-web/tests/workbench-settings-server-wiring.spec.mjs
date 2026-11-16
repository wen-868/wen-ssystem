import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const service = read("backend/src/services/admin/workbench-settings.service.ts");
const controller = read("backend/src/controllers/admin/workbench-settings.controller.ts");
const routes = read("backend/src/routes/workbench-settings.routes.ts");
const client = read("admin-web/src/api/workbench-settings.ts");

assert.match(service, /INSERT INTO t_sys_config/, "必须复用 t_sys_config");
assert.match(service, /INSERT INTO t_audit_log/, "保存与重置必须写 t_audit_log");
assert.match(service, /transaction\(/, "配置与审计必须在同一事务");
assert.match(service, /WORKBENCH_SETTINGS_SAVE/);
assert.match(service, /WORKBENCH_SETTINGS_RESET/);
assert.match(service, /设置已在其他窗口更新/, "缺少 revision 冲突保护");
assert.match(service, /SENSITIVE_KEY|password|token/, "缺少敏感键拒绝规则");
assert.doesNotMatch(service, /CREATE\s+TABLE/i, "本卡禁止新增表");

assert.match(routes, /requirePermission\("system:config"\)/, "租户写接口缺少服务端权限码");
assert.equal((routes.match(/requirePermission\("system:config"\)/g) || []).length, 2, "租户保存和重置都必须权限校验");
assert.match(routes, /prefix: "\/api\/admin\/workbench-settings"/);
assert.match(controller, /req\.user!\.id/, "个人设置必须取 JWT 用户");
assert.doesNotMatch(controller, /body\.userId/, "不得信任前端 userId");

assert.match(client, /saveWorkbenchSettings/);
assert.match(client, /resetWorkbenchSettings/);
assert.match(client, /resourceType: "workbench_settings"/);

console.log("PASS  workbench settings server wiring");
