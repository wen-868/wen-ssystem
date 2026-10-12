import fs from "node:fs";
import path from "node:path";

/**
 * a11y 门禁共用输出工具（S3-59 ②③④）—— admin-web 与 saas-admin 两个 spec 共用。
 *
 * 背景（S3-59 卡 §7 四条结构缺陷，本文件负责后三条）：
 *   ② 无未覆盖清单：门禁只报「有没有违规」，不报「扫了哪些页面、哪些没扫」——
 *      「没扫到」与「扫了没问题」在输出里无法区分 ⇒ 覆盖不闭合。
 *   ③ 不可定位：违规只报数量与类型，不报元素 —— 拿到「有 1 条违规」也不知道是哪一条。
 *   ④ incomplete 不判：axe 的 `incomplete`（如 color-contrast 取不到终态）被整类丢弃。
 *
 * 🔴 本文件只做**输出**，不改任何断言与阈值：
 *   - 违规仍由各 spec 的 `expect(criticalSerious.length).toBe(0)` 判定；
 *   - incomplete 只打印计数与抽样，**不新增抖动源**（上限锁定待观察期基线稳定后再谈，
 *     见 S3-59 §4「锁上限」——本轮不做硬红线，理由写在该卡回传里）。
 */

/** 违规节点明细打印上限：3 个不足以定位「新增那一批」，沿用 saas-admin 的 6。 */
export const MAX_NODES = 6;

/** 一条「本次确实扫过」的路由声明。 */
export type ScannedRoute = { path: string; name: string; by: string };

/**
 * 归一化路由路径，使「声明路径」与「实际访问 URL」可比：
 *   - hash 路由前缀：`/#/tenants` → `/tenants`（saas-admin 用 createWebHashHistory）
 *   - 去掉 query / hash 尾缀
 *   - 动态段统一占位：`:id` → `:x`（否则 `/inventory-transfer/edit/3` 与声明对不上）
 *   - 空串归一为 `/`
 */
export function normalizeRoutePath(raw: string): string {
  let s = String(raw).trim();
  if (s.startsWith("/#")) s = s.slice(2);
  s = s.split("?")[0].split("#")[0];
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");
  s = s.replace(/:[A-Za-z0-9_]+/g, ":x");
  return s === "" ? "/" : "/" + s;
}

/**
 * 定位仓库内文件：从 cwd 与其上一级各试一次。
 * （不用 `__dirname`——Playwright 走 CJS 转译时可用、被 node 直接当 ESM 跑时就不可用；
 *  也不写死绝对路径。找不到由调用方按「清单不可用」处理，不给假绿。）
 */
function resolveRepoFile(relPath: string): string | null {
  for (const base of [process.cwd(), path.resolve(process.cwd(), "..")]) {
    const p = path.resolve(base, relPath);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 从路由源码文件里抽取声明路由（只读文本，不执行应用代码）。 */
export function readDeclaredRoutes(relPath: string): string[] {
  const abs = resolveRepoFile(relPath);
  if (abs === null) throw new Error(`找不到文件 ${relPath}（cwd=${process.cwd()}）`);
  const src = fs.readFileSync(abs, "utf8");
  const out: string[] = [];
  // 引号风格两种都收：admin-web 用双引号，saas-admin 用单引号（少收一种就会静默得到 0 条）
  const re = /path:\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1] ?? m[2] ?? "");
  return out;
}

export type CoverageResult = {
  declared: string[];
  scanned: string[];
  unscanned: string[];
  readError: string | null;
};

/**
 * ② 打印覆盖清单：声明路由总数 / 本次扫描 / 未扫清单（逐条列出，不静默省略）。
 * 返回结构化结果，供调用方断言「清单自身完整」（读不到源码 ⇒ 视为未覆盖，不给假绿）。
 */
export function logCoverage(
  prefix: string,
  relPath: string,
  scanned: readonly ScannedRoute[],
  uncoveredReason: string
): CoverageResult {
  let declared: string[] = [];
  let readError: string | null = null;
  try {
    declared = Array.from(new Set(readDeclaredRoutes(relPath).map(normalizeRoutePath))).sort();
  } catch (e) {
    readError = (e as Error).message;
  }

  const scannedPaths = scanned.map((s) => normalizeRoutePath(s.path));
  const scannedSet = new Set(scannedPaths);
  const unscanned = declared.filter((p) => !scannedSet.has(p));

  console.log(
    `[${prefix}][覆盖] 路由清单：声明来源=${relPath}，声明路由=${declared.length}，` +
      `本次扫描=${scannedPaths.length}，未扫描=${unscanned.length}` +
      (readError ? `（⚠️ 读取失败：${readError} —— 清单不完整，按「未覆盖」处理）` : "")
  );
  for (const s of scanned) {
    const p = normalizeRoutePath(s.path);
    console.log(
      `[${prefix}][覆盖] ✅ 已扫 ${p} ← ${s.name}（用例：${s.by}）` +
        (declared.includes(p) ? "" : " ⚠️ 该路由未在声明来源中找到（可能已改名/已下线）")
    );
  }
  if (unscanned.length > 0) {
    console.log(
      `[${prefix}][覆盖] ⚠️ 未扫清单（${unscanned.length} 条，逐条列出、不允许静默省略）：` +
        unscanned.join(" | ")
    );
    console.log(`[${prefix}][覆盖] 未扫原因（统一）：${uncoveredReason}`);
  } else {
    console.log(`[${prefix}][覆盖] 未扫清单：空（声明路由全部覆盖）`);
  }
  return { declared, scanned: scannedPaths, unscanned, readError };
}

/**
 * ③ 打印违规的**元素身份**：type / impact / 节点数 / 每个节点的 target 选择器 + html 片段 + axe data。
 * 输出形状与 admin-web 既有 `[a11y] … nodes target` / saas-admin 既有 `[saas-a11y] … node[i]` 兼容，
 * 且**新增 html**（此前只有 target ⇒ 定位不到「同一个选择器下的哪一个实例」）。
 */
export function logViolations(prefix: string, tag: string, violations: any[]): void {
  if (violations.length === 0) {
    console.log(`[${prefix}] ${tag} ✅ 无 critical/serious 违规`);
    return;
  }
  for (const v of violations) {
    console.log(
      `[${prefix}] ${tag} ❌ type=${v.id} impact=${v.impact} nodes=${v.nodes.length} help=${v.help}`
    );
    v.nodes.slice(0, MAX_NODES).forEach((n: any, i: number) => {
      const target = Array.isArray(n.target) ? n.target.join(" ") : String(n.target);
      const html = String(n.html ?? "").replace(/\s+/g, " ").slice(0, 160);
      console.log(`[${prefix}] ${tag}   node[${i}] target=${target}`);
      console.log(`[${prefix}] ${tag}   node[${i}] html=${html}`);
      const data = n.any?.[0]?.data ?? n.all?.[0]?.data ?? null;
      if (data !== null) {
        console.log(`[${prefix}] ${tag}   node[${i}] axeData=${JSON.stringify(data)}`);
      }
    });
    if (v.nodes.length > MAX_NODES) {
      console.log(
        `[${prefix}] ${tag}   （其余 ${v.nodes.length - MAX_NODES} 个节点省略 —— 完整计数见上方 nodes=${v.nodes.length}；如需逐节点请把 MAX_NODES 调大）`
      );
    }
  }
}

/**
 * ④ 打印 axe `incomplete` 计数与抽样（不得整类丢弃）。
 * 🔴 只打印、不判定：本函数不返回/不抛出红绿结论。
 */
export function logIncomplete(prefix: string, tag: string, results: { incomplete?: any[] }): void {
  const inc = results.incomplete ?? [];
  const nodes = inc.reduce((sum: number, r: any) => sum + (r.nodes?.length ?? 0), 0);
  if (inc.length === 0) {
    console.log(`[${prefix}] ${tag} incomplete: rules=0, nodes=0（axe 无疑难项）`);
    return;
  }
  console.log(
    `[${prefix}] ${tag} incomplete: rules=${inc.length}, nodes=${nodes}, ` +
      `ids=${inc.map((r: any) => `${r.id}:${r.nodes?.length ?? 0}`).join(",")}`
  );
  inc.slice(0, 3).forEach((r: any) => {
    const samples = (r.nodes ?? []).slice(0, 3).map((n: any) => {
      const target = Array.isArray(n.target) ? n.target.join(" ") : String(n.target);
      const html = String(n.html ?? "").replace(/\s+/g, " ").slice(0, 80);
      return `${target} <= ${html}`;
    });
    console.log(
      `[${prefix}] ${tag} incomplete 抽样: id=${r.id} impact=${r.impact} nodes=${r.nodes?.length ?? 0} → ` +
        samples.join(" || ")
    );
  });
  if (inc.length > 3) {
    console.log(
      `[${prefix}] ${tag} incomplete 其余 ${inc.length - 3} 条规则仅计数（完整计数见上方 rules=${inc.length}）`
    );
  }
}
