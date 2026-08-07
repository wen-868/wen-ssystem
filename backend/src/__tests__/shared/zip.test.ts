import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { zipDirectory } from "../../shared/zip";

/** 测试用临时目录集合（afterEach 统一清理） */
const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

interface ZipEntryRead {
  name: string;
  data: Buffer;
}

/** 极简 ZIP 读取器：仅用于测试校验（解析本地文件头 + deflateRaw 解压） */
function readZipEntries(buf: Buffer): ZipEntryRead[] {
  const entries: ZipEntryRead[] = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const csize = buf.readUInt32LE(offset + 18);
    const usize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const raw = buf.subarray(dataStart, dataStart + csize);
    const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
    if (usize !== data.length) {
      throw new Error(`条目 ${name} 解压后大小不符：期望 ${usize}，实际 ${data.length}`);
    }
    entries.push({ name, data });
    offset = dataStart + csize;
  }
  return entries;
}

describe("zipDirectory", () => {
  it("应生成标准 ZIP，文件与子目录内容完整可解压", () => {
    const src = makeTempDir("zip-src-");
    const out = makeTempDir("zip-out-");
    fs.mkdirSync(path.join(src, "sub"), { recursive: true });
    fs.mkdirSync(path.join(src, "empty"), { recursive: true });
    const hello = "你好，智享小程序 ✅";
    fs.writeFileSync(path.join(src, "a.txt"), hello, "utf8");
    fs.writeFileSync(path.join(src, "sub", "b.json"), JSON.stringify({ theme: "a" }), "utf8");

    const zipPath = path.join(out, "pkg.zip");
    zipDirectory(src, zipPath);

    const buf = fs.readFileSync(zipPath);
    // 签名校验
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.length).toBeGreaterThan(100);

    const entries = readZipEntries(buf);
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    expect(byName.has("a.txt")).toBe(true);
    expect(byName.has("sub/b.json")).toBe(true);
    expect(byName.has("empty/")).toBe(true);
    expect(byName.get("a.txt")!.toString("utf8")).toBe(hello);
    expect(JSON.parse(byName.get("sub/b.json")!.toString("utf8"))).toEqual({ theme: "a" });
  });

  it("源目录不存在时应抛错", () => {
    const out = makeTempDir("zip-out-");
    expect(() => zipDirectory(path.join(out, "not-exist"), path.join(out, "x.zip"))).toThrow(/不存在/);
  });
});
