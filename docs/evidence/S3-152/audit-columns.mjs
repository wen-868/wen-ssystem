// S3-152 只读审计（凌舟自用，不入库）：比对"生产列集"与"迁移声明列集/ALTER 标注列"
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repo = "D:/Users/ZXQL/ZXQL-MS/wen-ssystem";
const tables = [
  "t_delivery_record", "t_payment_config", "t_platform_order", "t_points_record",
  "t_retail_category", "t_retail_order", "t_retail_product", "t_retail_review",
  "t_retail_shop_config", "t_sys_role", "t_tenant_admin", "t_transfer_order_item",
];

// 1) 生产列集
const prod = new Map(tables.map((t) => [t, new Set()]));
for (const line of readFileSync("D:/Users/ZXQL/_lz-tmp-s3152/prod-cols.tsv", "utf8").split(/\r?\n/)) {
  const [t, c] = line.split("\t");
  if (t && c && prod.has(t)) prod.get(t).add(c);
}

// 2) 迁移声明列集（CREATE 块内 + ALTER ADD COLUMN）
const sqlFiles = [
  join(repo, "docs", "init_database.sql"),
  ...readdirSync(join(repo, "docs", "migrations")).filter((f) => f.endsWith(".sql")).map((f) => join(repo, "docs", "migrations", f)),
];
const declared = new Map(tables.map((t) => [t, new Set()]));
const createCount = new Map(tables.map((t) => [t, 0]));
for (const file of sqlFiles) {
  const sql = readFileSync(file, "utf8");
  for (const t of tables) {
    // CREATE TABLE [IF NOT EXISTS] `t` ( ... ) ;
    const re = new RegExp("CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?`?" + t + "`?\\s*\\(([\\s\\S]*?)\\n\\)\\s*ENGINE", "gi");
    let m;
    while ((m = re.exec(sql))) {
      createCount.set(t, createCount.get(t) + 1);
      for (const def of m[1].split(/\r?\n/)) {
        const cm = def.match(/^\s*`([A-Za-z0-9_]+)`\s+[A-Za-z]/);
        if (cm && !/^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|FULLTEXT|FOREIGN)\b/i.test(cm[1])) declared.get(t).add(cm[1]);
      }
    }
    // ALTER TABLE `t` ADD COLUMN `c`
    const re2 = new RegExp("ALTER\\s+TABLE\\s+`?" + t + "`?[\\s\\S]{0,120}?ADD\\s+COLUMN\\s+`?([A-Za-z0-9_]+)`?", "gi");
    let m2;
    while ((m2 = re2.exec(sql))) declared.get(t).add(m2[1]);
  }
}

console.log("表\t生产列数\t迁移声明列数\tCREATE 次数\t缺列(声明但生产无)\t生产多出列数");
let problems = 0;
for (const t of tables) {
  const p = prod.get(t);
  const d = declared.get(t);
  const missing = [...d].filter((c) => !p.has(c));
  const extra = [...p].filter((c) => !d.has(c));
  if (missing.length) problems++;
  console.log([t, p.size, d.size, createCount.get(t), missing.join(",") || "-", extra.length].join("\t"));
}
console.log(problems === 0 ? "\n结论：12 张表的生产列集**均覆盖**其迁移声明列（无「旧定义抢先导致的缺列」）" : "\n⚠️ 有 " + problems + " 张表存在缺列，需人工复核");
