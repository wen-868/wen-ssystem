const fs = require("fs");
const path = require("path");

// 生成一个简单的 256x256 PNG 图标（蓝色背景 + 白色"智"字）
// 使用纯 Node.js 实现，不依赖外部库

function createPng(width, height, r, g, b) {
  const rowSize = width * 4;
  const dataSize = height * rowSize;
  const ihdrSize = 13;
  const idatSize = dataSize + height; // +height for filter bytes

  function crc32(buf) {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
      }
    }
    return ~crc >>> 0;
  }

  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    buf.writeUInt32BE(crc32(buf.slice(4, 8 + len)), 8 + len);
    return buf;
  }

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(ihdrSize);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT (zlib compressed image data)
  const zlib = require("zlib");
  const rawData = Buffer.alloc(idatSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData);

  // IEND
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    iend,
  ]);
}

const iconPath = path.join(__dirname, "../public/icon.png");
const png = createPng(256, 256, 24, 144, 255); // 蓝色 #1890FF
fs.writeFileSync(iconPath, png);
console.log("Icon generated:", iconPath);
