/**
 * S3-186 守门单测：`docs/migrations/*.sql` 里**不得再出现 `CALL` 语句**。
 *
 * 为什么（缺陷事实，可复跑）：
 *   MIG-4 写闸门（`migration.ts` 的 `blockedByWriteGate`，默认 block）把 `CALL` 与
 *   INSERT/UPDATE/DELETE/REPLACE 一并当"数据写语句"整条挡下 ⇒ 外部迁移里的 `CALL` 在**默认配置**下
 *   一条都不会执行（只留一行 WARN），而 092 末尾 `DROP PROCEDURE` 之后两个辅助过程再未重建 ⇒
 *   即使显式 `MIGRATION_WRITE_GATE=allow`，092 之后的 `CALL` 也全部 `ER_SP_DOES_NOT_EXIST` 静默跳过。
 *   2026-10-13 实测：空库跑完比"补列语句全部落地"的结构**少 24 列（12 张表）/ 59 个索引**。
 *   ⇒ 本仓的迁移语料只允许**结构语句**（CREATE / ALTER / SET / PREPARE / EXECUTE / SELECT 等），
 *     补列一律写成 `information_schema` 守卫 + `PREPARE/EXECUTE`（先例：081、196）。
 *
 * 反测（判据有分辨力）：往任一迁移文件里加一行 `CALL add_column_if_not_exists('t_x','y','INT');`
 * ⇒ 本用例必须红并点名该文件；删掉该行 ⇒ 复原绿（S3-186 回传卡 §反测）。
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 迁移目录（vitest 的 cwd 可能是 backend/ 或仓库根，逐候选探测） */
function resolveMigrationsDir(): string {
  const candidates = [
    resolve(process.cwd(), "docs", "migrations"),
    resolve(process.cwd(), "..", "docs", "migrations"),
  ];
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error(`找不到迁移目录，已尝试：${candidates.join(", ")}`);
  return found;
}

const MIGRATIONS_DIR = resolveMigrationsDir();
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

describe("外部迁移语料：不得依赖存储过程（无 CALL）", () => {
  it("夹具自证：迁移目录确实被读到（避免目录空转导致恒绿）", () => {
    expect(files.length, `迁移目录 ${MIGRATIONS_DIR} 下 .sql 文件数异常`).toBeGreaterThan(150);
  });

  it("所有迁移文件里没有 CALL 语句（CALL 会被写闸门静默挡下 / 过程不存在时报错跳过）", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        if (/^\s*CALL\s/i.test(line)) {
          offenders.push(`${file}:${index + 1} ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(
      offenders,
      "以下 CALL 语句在默认写闸门（MIGRATION_WRITE_GATE 未设置=block）下不会执行；" +
        "请改写为 information_schema 守卫 + PREPARE/EXECUTE 的结构写法（见 081/196 与 docs/evidence/S3-186）：\n" +
        offenders.join("\n")
    ).toEqual([]);
  });
});
