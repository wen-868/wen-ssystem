/**
 * 租户注入判据（S3-207 · 收口总清单第 63 项根因根治）
 *
 * 背景（根因，S3-206 实测）：`config/database.ts` 的 `queryWithTenant` 系列原先用**子串判断**决定是否跳过注入——
 *   `if (sql.toLowerCase().includes('tenant_id')) return sql;`
 * ⇒ 只要 SQL 文本任何位置出现 `tenant_id`（JOIN 的列对列等值 `a.tenant_id = b.tenant_id`、SELECT 列、
 *   INSERT 列清单、UPDATE 的 SET 子句……）就整体**跳过注入**；若该 SQL 本身没有真正的租户过滤谓词，
 *   就会退化成**跨租户读取/聚合**（S3-206 实测：A 令牌读到 A+B 的合并值）。
 *
 * 本模块把"是否已经有**绑定到调用者租户的条件**"变成一个**可判定、可解释、可测**的判据：
 *
 * | 语句 | 判据（在**完整 SQL**上判定，含子查询与插值后的文本） |
 * |:--|:--|
 * | SELECT | 出现**值谓词** `tenant_id = ? / = '字面量' / = 数字 / IN (值)`；**列对列等值不算** |
 * | UPDATE / DELETE | 同上，且必须出现在**顶层 WHERE 之后**（`SET tenant_id = ?` 是"写租户列"，不是过滤） |
 * | INSERT | 列清单里显式写了 `tenant_id`（含 `INSERT IGNORE`）；或 `SET tenant_id = 值`；或 INSERT…SELECT 的 SELECT 段有值谓词 |
 * | 任意 | 带**显式标记**（写在 SQL 注释里）：`tenant-scope:self`（我已自己写租户条件）/ `tenant-scope:platform`（平台级，故意不带租户过滤） |
 *
 * 边界（必须说清，别把它当成"证明"）：
 * 1. 判据证明的是**形状**（存在绑定到 tenant_id 列的等值/IN 谓词），**不是取值**——注入器无法从 SQL 文本证明
 *    那个 `?` 绑的就是调用者租户。相比旧判据（连形状都不看）这是**严格收紧**：跳过注入的集合 ⊂ 旧集合。
 * 2. 判据比旧判据严 ⇒ 会出现"改前跳过、改后注入"的位置。这类位置若 SQL 是多表 JOIN，注入的是**无限定列名**
 *    `tenant_id = ?`，MySQL 会报 `ER_NON_UNIQ_ERROR 1052`（响亮失败）而不是静默泄露 ⇒ 由
 *    `backend/scripts/guard-tenant-injection.mjs` 在静态侧提前拦截，调用点应显式补限定谓词。
 * 3. 值谓词出现在**子查询**里也算"已绑定"（如 `... WHERE customer_id = ? AND tenant_id = ?` 的标量子查询、
 *    派生表 `FROM (SELECT ... WHERE tenant_id = ?) t`）。这一类的覆盖强度不如外层直接限定，门禁会把它单独
 *    打出来供人工复核。
 * 4. `tenant_id = (SELECT …)` 这种"右侧是子查询"的写法**不**算（保守从严：宁可多注入一次也不漏判）。
 */

/** 显式标记：我已自己写了租户条件（SQL 里以注释形式出现） */
export const TENANT_SCOPE_SELF_MARKER = "tenant-scope:self";
/** 显式标记：平台级/全局范围，故意不带租户过滤（SQL 里以注释形式出现） */
export const TENANT_SCOPE_PLATFORM_MARKER = "tenant-scope:platform";

/**
 * 绑定到调用者租户的**值谓词**：
 *   · 右侧是值（`?` 占位符 / 字符串字面量 / 数字）⇒ 算；
 *   · 右侧是列（`a.tenant_id = b.tenant_id`）或子查询 ⇒ **不算**（这正是 S3-206 的病灶写法）；
 *   · 不等式（`<> != < >`）不算（不等式不是过滤，注入补一个等值谓词属于收紧）。
 */
const VALUE_PREDICATE_RE =
  /(?:[a-z_][a-z0-9_]*\s*\.\s*)?tenant_id\s*(?:=\s*(?:\?|'[^']*'|"[^"]*"|\d+(?:\.\d+)?)|(?:not\s+)?in\s*\(\s*(?:\?|'|"|\d))/i;

/** 语句类型（取首个关键字） */
export function statementOf(sql: string): string {
  return (/^\s*([a-z]+)/i.exec(sql)?.[1] || "").toUpperCase();
}

/** 是否出现 `tenant_id` 字样（= 旧判据会不会短路） */
export function hasTenantToken(sql: string): boolean {
  return /tenant_id/i.test(sql);
}

/**
 * 把字符串字面量内容掏空（保留成对引号，便于匹配 `= ''` 形态），并把反引号标识符的引号去掉、内容保留
 * （`` `tenant_id` = ? `` ⇒ `tenant_id = ?`）。长度保持不变，便于按下标切片。
 */
export function maskSqlStrings(sql: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) {
        if (quote === "`") out += " ";
        else if (quote === "'") out += "''";
        else out += '""';
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    out += ch;
  }
  return out;
}

/** 顶层（括号深度 0、非字符串）里 `where` 的下标；找不到返回 -1 */
export function topLevelWhereIndex(masked: string): number {
  let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === "w" || ch === "W")) {
      const m = /^where\b/i.exec(masked.slice(i));
      if (m) return i;
    }
  }
  return -1;
}

/** 顶层（括号深度 0）里某个关键字的下标；找不到返回 -1 */
function topLevelKeywordIndex(masked: string, kw: string): number {
  let depth = 0;
  const re = new RegExp("^" + kw + "\\b", "i");
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const m = re.exec(masked.slice(i));
      if (m) return i;
    }
  }
  return -1;
}

/**
 * 判定这句 SQL 是否**已经带了绑定到调用者租户的条件**（true ⇒ 运行时可以跳过注入）。
 * @param sql 运行时完整 SQL（插值已完成）
 */
export function hasCallerTenantCondition(sql: string): boolean {
  const stmt = statementOf(sql);
  const masked = maskSqlStrings(sql);

  if (stmt === "SELECT") return VALUE_PREDICATE_RE.test(masked);

  if (stmt === "UPDATE" || stmt === "DELETE") {
    const whereIdx = topLevelWhereIndex(masked);
    if (whereIdx < 0) return false;
    return VALUE_PREDICATE_RE.test(masked.slice(whereIdx));
  }

  if (stmt === "INSERT") {
    // ① 列清单里显式写了 tenant_id（含 INSERT IGNORE / LOW_PRIORITY INTO）
    const m = /insert\s+(?:ignore\s+|low_priority\s+)?into\s+[`"[\]]?[a-z0-9_.]+[`"[\]]?\s*\(([^)]*)\)/i.exec(
      sql
    );
    if (m && /\btenant_id\b/i.test(m[1])) return true;
    // ② INSERT … SET tenant_id = 值
    const setIdx = topLevelKeywordIndex(masked, "set");
    if (setIdx >= 0) return VALUE_PREDICATE_RE.test(masked.slice(setIdx));
    // ③ INSERT … SELECT：看 SELECT 段
    const selIdx = topLevelKeywordIndex(masked, "select");
    if (selIdx >= 0) return VALUE_PREDICATE_RE.test(masked.slice(selIdx));
    return false;
  }

  // 未知语句类型：不跳过（交给调用方/门禁处理）
  return false;
}

/** SQL 里的显式标记（self / platform / null） */
export function tenantScopeMarkerOf(sql: string): "self" | "platform" | null {
  if (sql.includes(TENANT_SCOPE_SELF_MARKER)) return "self";
  if (sql.includes(TENANT_SCOPE_PLATFORM_MARKER)) return "platform";
  return null;
}

/**
 * 运行时唯一入口：是否**跳过**租户条件注入。
 * 显式标记优先（作者声明）；否则由 `hasCallerTenantCondition` 判定。
 */
export function shouldSkipTenantInjection(sql: string): boolean {
  return tenantScopeMarkerOf(sql) !== null || hasCallerTenantCondition(sql);
}

/**
 * 诊断说明（门禁/回执/日志复用，便于"为什么跳过/为什么注入"可追溯）。
 */
export function explainTenantInjection(sql: string): string {
  const marker = tenantScopeMarkerOf(sql);
  if (marker) return `skip:marker=${marker}`;
  if (hasCallerTenantCondition(sql)) return "skip:caller-tenant-condition";
  return "inject:" + (hasTenantToken(sql) ? "tenant-token-without-condition" : "no-tenant-token");
}
