/**
 * 启动时自动数据库迁移
 *
 * 读取 docs/migrations/ 目录下的 SQL 文件并执行
 * 预处理 DELIMITER 语法，将其转换为 mysql2 可执行的语句块
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import mysql from "mysql2/promise";
import { env } from "./env.js";

/**
 * 预处理 SQL：解析 DELIMITER 语法，将其拆分为可执行的语句块
 *
 * MySQL CLI 的 DELIMITER 是客户端命令，mysql2 驱动不识别。
 * 例如:
 *   DELIMITER $$
 *   CREATE PROCEDURE ... END $$
 *   DELIMITER ;
 * 
 * 需要被转换为：把 $$...$$ 之间的内容作为一个整块执行
 */
function parseDelimiterBlocks(sql: string): string[] {
  const lines = sql.split("\n");
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let currentDelimiter = ";";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // 检测 DELIMITER 指令
    const delimMatch = line.match(/^DELIMITER\s+(.+)$/i);
    if (delimMatch) {
      // 先把之前积累的普通语句块提交
      const blockContent = currentBlock.join("\n").trim();
      if (blockContent) {
        blocks.push(...blockContent.split(";").map(s => s.trim()).filter(Boolean).map(s => s + ";"));
        currentBlock = [];
      }
      currentDelimiter = delimMatch[1].trim();
      continue;
    }

    // 检测当前行是否以 delimiter 结尾
    if (line.endsWith(currentDelimiter) && currentDelimiter !== ";") {
      // 非分号分隔符：直接拼接作为完整语句块
      const trimmed = line.slice(0, -currentDelimiter.length).trim();
      if (trimmed) {
        currentBlock.push(trimmed);
        const block = currentBlock.join("\n").trim();
        if (block) blocks.push(block);
        currentBlock = [];
      } else if (currentBlock.length > 0) {
        // 只有分隔符本身，结束当前块
        const block = currentBlock.join("\n").trim();
        if (block) blocks.push(block);
        currentBlock = [];
      }
      continue;
    }

    // 检测分号分隔符
    if (line.endsWith(";") && currentDelimiter === ";") {
      currentBlock.push(line);
      const block = currentBlock.join("\n").trim();
      if (block) blocks.push(block);
      currentBlock = [];
      continue;
    }

    // 普通行：加入当前块
    if (line && !line.startsWith("--")) {
      currentBlock.push(line);
    }
  }

  // 处理剩余内容
  const remaining = currentBlock.join("\n").trim();
  if (remaining) {
    if (currentDelimiter === ";") {
      blocks.push(...remaining.split(";").map(s => s.trim()).filter(Boolean).map(s => s + ";"));
    } else {
      blocks.push(remaining);
    }
  }

  return blocks;
}

export async function runMigrations(): Promise<void> {
  if (env.USE_MOCK_DB) return;

  const migrationsDir = resolve(process.cwd(), "docs/migrations");

  if (!existsSync(migrationsDir)) {
    console.log("[migration] 迁移目录不存在，跳过");
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migration] 无迁移文件，跳过");
    return;
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      multipleStatements: true,
      connectTimeout: 10000,
    });
  } catch (e: any) {
    console.error("[migration] 数据库连接失败，跳过迁移:", e.message);
    return;
  }

  try {
    for (const file of files) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`[migration] 执行: ${file}`);

      try {
        // 预处理 DELIMITER 语法
        const statements = parseDelimiterBlocks(sql);
        console.log(`[migration] ${file}: 解析为 ${statements.length} 个语句块`);

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i].trim();
          if (!stmt) continue;

          try {
            await conn.query(stmt);
          } catch (e: any) {
            if (
              e.message &&
              (e.message.includes("Duplicate column") ||
                e.message.includes("already exists") ||
                e.message.includes("Duplicate key") ||
                e.code === "ER_DUP_FIELDNAME" ||
                e.code === "ER_DUP_KEYNAME")
            ) {
              console.log(`[migration] ${file} 语句块 ${i + 1}: 已存在，跳过`);
              continue;
            }
            console.error(`[migration] ${file} 语句块 ${i + 1} 失败: ${stmt.substring(0, 80)}... → ${e.message}`);
            throw e;
          }
        }

        console.log(`[migration] ${file} 完成`);
      } catch (e: any) {
        // 迁移失败不阻止服务器启动，只记录错误
        console.error(`[migration] ${file} 失败（服务器继续启动）:`, e.message);
        continue;
      }
    }
    console.log("[migration] 所有迁移完成");
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
