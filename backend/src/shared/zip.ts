/**
 * 最小 ZIP 写入工具（R96-02）
 *
 * 用途：将预构建的小程序产物目录压缩为 zip 代码包。
 * 不引入第三方依赖，基于 node:zlib 的 deflateRaw + 自实现 CRC32 与
 * ZIP 本地头/中央目录/EOCD 结构，生成标准 ZIP（Windows/微信开发者工具可解压）。
 *
 * 只实现目录 → zip 单次写入场景，不做解压/追加。
 */
import fs from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

/** CRC32 查找表（IEEE 802.3 多项式 0xEDB88320） */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS 时间（ZIP 头字段）：bit15-11 时 / bit10-5 分 / bit4-0 秒/2 */
function dosTime(date: Date): number {
  return ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
}

/** DOS 日期（ZIP 头字段）：bit15-9 年-1980 / bit8-5 月 / bit4-0 日 */
function dosDate(date: Date): number {
  const year = Math.max(date.getFullYear(), 1980);
  return ((year - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
}

interface ZipEntry {
  name: string;
  data: Buffer;
  isDir: boolean;
  mtime: Date;
  crc: number;
  csize: number;
  usize: number;
  method: number;
  offset: number;
}

/** 递归收集目录下全部文件（含空目录，统一使用正斜杠相对路径） */
function collectEntries(srcDir: string): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const walk = (dir: string, rel: string) => {
    const names = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of names) {
      const abs = path.join(dir, ent.name);
      const name = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        entries.push({ name: `${name}/`, data: Buffer.alloc(0), isDir: true, mtime: fs.statSync(abs).mtime, crc: 0, csize: 0, usize: 0, method: 0, offset: 0 });
        walk(abs, name);
      } else if (ent.isFile()) {
        const raw = fs.readFileSync(abs);
        const deflated = deflateRawSync(raw);
        entries.push({
          name,
          data: deflated,
          isDir: false,
          mtime: fs.statSync(abs).mtime,
          crc: crc32(raw),
          csize: deflated.length,
          usize: raw.length,
          method: 8,
          offset: 0,
        });
      }
    }
  };
  walk(srcDir, "");
  return entries;
}

/**
 * 将 srcDir 目录压缩为 zipPath 文件。
 * - 目录条目按 STORE(0) 写入，文件按 DEFLATE(8) 写入；
 * - 文件名使用 UTF-8 并置位语言编码标志（bit 11），中文路径可正常解压。
 */
export function zipDirectory(srcDir: string, zipPath: string): void {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`待压缩目录不存在: ${srcDir}`);
  }
  const entries = collectEntries(srcDir);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  const chunks: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    entry.offset = offset;
    const nameBuf = Buffer.from(entry.name, "utf8");
    const time = dosTime(entry.mtime);
    const date = dosDate(entry.mtime);

    // 本地文件头（30 字节 + 文件名）
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);       // 本地文件头签名
    header.writeUInt16LE(20, 4);               // 解压所需版本
    header.writeUInt16LE(0x0800, 6);           // 通用标志：UTF-8 文件名
    header.writeUInt16LE(entry.method, 8);     // 压缩方式
    header.writeUInt16LE(time, 10);            // 修改时间
    header.writeUInt16LE(date, 12);            // 修改日期
    header.writeUInt32LE(entry.crc, 14);       // CRC32
    header.writeUInt32LE(entry.csize, 18);     // 压缩后大小
    header.writeUInt32LE(entry.usize, 22);     // 原始大小
    header.writeUInt16LE(nameBuf.length, 26);  // 文件名长度
    header.writeUInt16LE(0, 28);               // 扩展区长度

    chunks.push(header, nameBuf, entry.data);
    offset += header.length + nameBuf.length + entry.data.length;
  }

  const centralStart = offset;
  const centralChunks: Buffer[] = [];
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const time = dosTime(entry.mtime);
    const date = dosDate(entry.mtime);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);       // 中央目录头签名
    header.writeUInt16LE(20, 4);               // 创建版本
    header.writeUInt16LE(20, 6);               // 解压所需版本
    header.writeUInt16LE(0x0800, 8);           // 通用标志
    header.writeUInt16LE(entry.method, 10);    // 压缩方式
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(date, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.csize, 20);
    header.writeUInt32LE(entry.usize, 24);
    header.writeUInt16LE(nameBuf.length, 28);  // 文件名长度
    header.writeUInt16LE(0, 30);               // 扩展区长度
    header.writeUInt16LE(0, 32);               // 注释长度
    header.writeUInt16LE(0, 34);               // 磁盘号
    header.writeUInt16LE(0, 36);               // 内部属性
    header.writeUInt32LE(entry.isDir ? 0x10 : 0, 38); // 外部属性（目录标记）
    header.writeUInt32LE(entry.offset, 42);    // 本地头偏移

    centralChunks.push(header, nameBuf);
  }

  const centralBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // EOCD 签名
  eocd.writeUInt16LE(0, 4);                    // 当前磁盘
  eocd.writeUInt16LE(0, 6);                    // 中央目录起始磁盘
  eocd.writeUInt16LE(entries.length, 8);       // 当前磁盘条目数
  eocd.writeUInt16LE(entries.length, 10);      // 总条目数
  eocd.writeUInt32LE(centralBuf.length, 12);   // 中央目录大小
  eocd.writeUInt32LE(centralStart, 16);        // 中央目录偏移
  eocd.writeUInt16LE(0, 20);                   // 注释长度

  fs.writeFileSync(zipPath, Buffer.concat([...chunks, centralBuf, eocd]));
}
