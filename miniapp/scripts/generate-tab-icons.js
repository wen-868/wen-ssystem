/**
 * tabBar 图标生成脚本（R96-01）
 *
 * 为三套主题生成 81×81 单色 tab 图标（首页/分类/购物车/我的），
 * 输出到 src/assets/tab/，与 app.config.ts 的 iconPath 约定一致。
 * 纯 Node 实现（zlib + 手写 PNG 编码），无第三方依赖。
 *
 * 用法：node scripts/generate-tab-icons.js [主题ID a|b|c|all] [输出目录]
 *   - 默认 all：生成全部主题图标（含 *-active-{id}.png 变体）
 *   - 指定主题：额外生成 *-active.png（该主题选中色），供 H5 构建内联使用
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const themes = require('../config/themes')

const SIZE = 81
const SS = 4 // 超采样倍数，用于抗锯齿
const INACTIVE = [153, 153, 153] // 未选中统一灰 #999999
const targetTheme = process.argv[2] || 'all'
const outDirOverride = process.argv[3] ? path.resolve(process.argv[3]) : null

/* ---------- PNG 编码 ---------- */

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  return png
}

/* ---------- 图形 SDF ---------- */

function sdBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r
}

function sdLine(px, py, x1, y1, x2, y2) {
  const abx = x2 - x1
  const aby = y2 - y1
  const apx = px - x1
  const apy = py - y1
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)))
  return Math.hypot(apx - abx * t, apy - aby * t)
}

function sdUnion(a, b) {
  return Math.min(a, b)
}

function sdSubtract(a, b) {
  return Math.max(a, -b)
}

function sdIntersect(a, b) {
  return Math.max(a, b)
}

/* ---------- 各图标形状（坐标系：左上原点，81×81） ---------- */

function shapeHome(x, y) {
  // 屋顶（三角形）+ 屋身（矩形），屋顶覆盖屋身上缘
  const roofApexY = 18
  const roofBaseY = 43
  const roof = Math.max(
    (y - roofApexY) * 21 - Math.abs(x - 40.5) * (roofBaseY - roofApexY) * 0.62,
    // 屋顶外沿到斜边的距离近似
    Math.max(
      Math.abs(x - 40.5) - 26,
      Math.abs(y - (roofApexY + roofBaseY) / 2) - (roofBaseY - roofApexY) / 2
    )
  )
  const body = sdBox(x, y, 40.5, 57, 18.5, 18, 2)
  return sdUnion(roof, body)
}

function shapeCategory(x, y) {
  const d1 = sdBox(x, y, 27, 27, 11, 11, 5)
  const d2 = sdBox(x, y, 54, 27, 11, 11, 5)
  const d3 = sdBox(x, y, 27, 54, 11, 11, 5)
  const d4 = sdBox(x, y, 54, 54, 11, 11, 5)
  return sdUnion(sdUnion(d1, d2), sdUnion(d3, d4))
}

function shapeCart(x, y) {
  // 提手（倒 U 形：两段竖线 + 顶部横线）
  const handleLeft = sdLine(x, y, 30, 27, 30, 18)
  const handleRight = sdLine(x, y, 51, 27, 51, 18)
  const handleTop = sdLine(x, y, 30, 18, 51, 18)
  const handleR = sdUnion(sdUnion(handleLeft, handleRight), handleTop)
  // 篮身（上宽下窄的梯形圆角矩形）
  const basket = sdBox(x, y, 40.5, 48, 21, 15, 3)
  // 车轮
  const wheel1 = sdCircle(x, y, 31, 68, 4.5)
  const wheel2 = sdCircle(x, y, 50, 68, 4.5)
  return sdUnion(sdUnion(handleR, basket), sdUnion(wheel1, wheel2))
}

function shapeProfile(x, y) {
  // 头
  const head = sdCircle(x, y, 40.5, 27, 12)
  // 肩（下半圆 + 底部平切）
  const shoulder = sdIntersect(sdCircle(x, y, 40.5, 66, 24), sdBox(x, y, 40.5, 66, 24, 24, 0))
  return sdUnion(head, shoulder)
}

const SHAPES = {
  home: shapeHome,
  category: shapeCategory,
  cart: shapeCart,
  profile: shapeProfile
}

/* ---------- 渲染 ---------- */

function renderIcon(shape, rgb) {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let inside = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          // 0.5 像素内的边缘视为部分覆盖（抗锯齿）
          if (shape(px, py) <= 0.5) inside++
        }
      }
      const alpha = Math.round((inside / (SS * SS)) * 255)
      const idx = (y * SIZE + x) * 4
      pixels[idx] = rgb[0]
      pixels[idx + 1] = rgb[1]
      pixels[idx + 2] = rgb[2]
      pixels[idx + 3] = alpha
    }
  }
  return pixels
}

function main() {
  const outDir = outDirOverride || path.resolve(__dirname, '../src/assets/tab')
  fs.mkdirSync(outDir, { recursive: true })

  for (const shapeName of Object.keys(SHAPES)) {
    // 未选中（灰）
    const inactive = renderIcon(SHAPES[shapeName], INACTIVE)
    fs.writeFileSync(path.join(outDir, `${shapeName}.png`), encodePng(SIZE, SIZE, inactive))
    const themeIds = targetTheme === 'all' ? Object.keys(themes) : [targetTheme]
    for (const themeId of themeIds) {
      const hex = themes[themeId].colorPrimary.replace('#', '')
      const rgb = [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ]
      const active = renderIcon(SHAPES[shapeName], rgb)
      fs.writeFileSync(path.join(outDir, `${shapeName}-active-${themeId}.png`), encodePng(SIZE, SIZE, active))
      // 选中态固定文件名：指定主题时覆盖为当前主题色（H5 构建内联用）
      if (targetTheme !== 'all') {
        fs.writeFileSync(path.join(outDir, `${shapeName}-active.png`), encodePng(SIZE, SIZE, active))
      }
    }
  }

  const files = fs.readdirSync(outDir)
  console.log(`tab 图标已生成：${files.length} 个文件 → ${outDir}`)
  console.log(files.join('\n'))
}

main()
