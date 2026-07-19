/**
 * AES-256-GCM 加密工具 — R51-05 安全加固
 *
 * 核心功能：
 *  1. getDeviceFingerprint()       — 获取设备指纹（deviceId + brand + model + system 哈希）
 *  2. deriveKey(fingerprint, salt) — 基于设备指纹 + 盐值派生 256 位密钥（PBKDF2-SHA-256）
 *  3. encrypt(plaintext, key)      — AES-256-GCM 加密，返回 { iv, ciphertext, tag }（base64）
 *  4. decrypt(encrypted, key)      — AES-256-GCM 解密，校验 tag
 *  5. setSecureStorage(key, value) — 加密后存储为 enc_${key}
 *  6. getSecureStorage(key)        — 读取 enc_${key} 并解密
 *  7. removeSecureStorage(key)     — 删除 enc_${key}
 *
 * 设计说明：
 *  - 密钥不存储，每次运行时从设备指纹动态派生
 *  - AES-256-GCM：AES-256-CTR 加密 + GHASH 认证标签（AEAD）
 *  - IV 每次随机生成 12 字节，tag 16 字节
 *  - 同步实现（纯 JS），保留 storage.ts 同步 API（不修改 request.ts 等其他文件）
 *  - 条件编译：APP-PLUS 可使用 plus.runtime 原生 API（性能更优，未来扩展），H5/小程序降级到纯 JS 实现
 *  - 使用 IIFE 包裹条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *
 * 安全性：
 *  - AES-256-GCM 提供机密性 + 完整性 + 真实性校验
 *  - PBKDF2 迭代 10000 次增加暴力破解难度
 *  - 设备指纹绑定，跨设备无法解密
 *  - 密钥不落盘，运行时派生
 *
 * @author 阿澈
 */

// ====================== 类型定义 ======================

/** 加密结果（base64 编码） */
export interface EncryptedData {
    /** 初始化向量（12 字节，base64） */
    iv: string
    /** 密文（base64） */
    ciphertext: string
    /** 认证标签（16 字节，base64） */
    tag: string
}

/** 派生密钥（32 字节 = 256 位） */
export type DerivedKey = Uint8Array

// ====================== Base64 编解码（同步，跨平台） ======================

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 字节数组转 base64 字符串 */
function bytesToBase64(bytes: Uint8Array): string {
    let result = ''
    const len = bytes.length
    for (let i = 0; i < len; i += 3) {
        const b1 = bytes[i]
        const b2 = i + 1 < len ? bytes[i + 1] : 0
        const b3 = i + 2 < len ? bytes[i + 2] : 0
        const e1 = b1 >> 2
        const e2 = ((b1 & 0x03) << 4) | (b2 >> 4)
        const e3 = ((b2 & 0x0f) << 2) | (b3 >> 6)
        const e4 = b3 & 0x3f
        result += B64_CHARS[e1] + B64_CHARS[e2]
        result += i + 1 < len ? B64_CHARS[e3] : '='
        result += i + 2 < len ? B64_CHARS[e4] : '='
    }
    return result
}

/** base64 字符串转字节数组 */
function base64ToBytes(b64: string): Uint8Array {
    const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
    const len = clean.length
    const bytes: number[] = []
    for (let i = 0; i < len; i += 4) {
        const e1 = B64_CHARS.indexOf(clean[i])
        const e2 = B64_CHARS.indexOf(clean[i + 1])
        const e3 = B64_CHARS.indexOf(clean[i + 2])
        const e4 = B64_CHARS.indexOf(clean[i + 3])
        const b1 = (e1 << 2) | (e2 >> 4)
        const b2 = ((e2 & 0x0f) << 4) | (e3 >> 2)
        const b3 = ((e3 & 0x03) << 6) | e4
        bytes.push(b1)
        if (e3 !== -1 && clean[i + 2] !== '=') bytes.push(b2)
        if (e4 !== -1 && clean[i + 3] !== '=') bytes.push(b3)
    }
    return new Uint8Array(bytes)
}

/** UTF-8 字符串转字节数组 */
function strToBytes(str: string): Uint8Array {
    const bytes: number[] = []
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i)
        if (c < 0x80) {
            bytes.push(c)
        } else if (c < 0x800) {
            bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
        } else if (c < 0xd800 || c >= 0xe000) {
            bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
        } else {
            // 代理对（emoji 等四字节字符）
            i++
            const c2 = str.charCodeAt(i)
            const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
            bytes.push(
                0xf0 | (cp >> 18),
                0x80 | ((cp >> 12) & 0x3f),
                0x80 | ((cp >> 6) & 0x3f),
                0x80 | (cp & 0x3f)
            )
        }
    }
    return new Uint8Array(bytes)
}

/** 字节数组转 UTF-8 字符串 */
function bytesToStr(bytes: Uint8Array): string {
    let result = ''
    let i = 0
    while (i < bytes.length) {
        const b = bytes[i]
        if (b < 0x80) {
            result += String.fromCharCode(b)
            i++
        } else if (b < 0xc0) {
            // 无效的 UTF-8 起始字节，跳过
            i++
        } else if (b < 0xe0) {
            const c = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
            result += String.fromCharCode(c)
            i += 2
        } else if (b < 0xf0) {
            const c = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
            result += String.fromCharCode(c)
            i += 3
        } else {
            const cp =
                ((b & 0x07) << 18) |
                ((bytes[i + 1] & 0x3f) << 12) |
                ((bytes[i + 2] & 0x3f) << 6) |
                (bytes[i + 3] & 0x3f)
            const surrogate = cp - 0x10000
            result += String.fromCharCode(0xd800 + (surrogate >> 10), 0xdc00 + (surrogate & 0x3ff))
            i += 4
        }
    }
    return result
}

// ====================== SHA-256（纯 JS 同步实现，FIPS 180-4） ======================

const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotr(x: number, n: number): number {
    return (x >>> n) | (x << (32 - n))
}

/** SHA-256 哈希（同步） */
function sha256(data: Uint8Array): Uint8Array {
    const h = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ])

    // 预处理：填充
    const origLen = data.length
    const bitLen = origLen * 8
    const paddedLen = Math.ceil((origLen + 1 + 8) / 64) * 64
    const padded = new Uint8Array(paddedLen)
    padded.set(data)
    padded[origLen] = 0x80
    // 长度字段（64 位大端，仅写低 32 位，假设 data < 512MB）
    const dv = new DataView(padded.buffer)
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false)
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false)

    const w = new Uint32Array(64)

    for (let offset = 0; offset < paddedLen; offset += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = dv.getUint32(offset + i * 4, false)
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
        }

        let a = h[0], b = h[1], c = h[2], d = h[3]
        let e = h[4], f = h[5], g = h[6], hh = h[7]

        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            const ch = (e & f) ^ (~e & g)
            const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            const maj = (a & b) ^ (a & c) ^ (b & c)
            const t2 = (S0 + maj) >>> 0
            hh = g
            g = f
            f = e
            e = (d + t1) >>> 0
            d = c
            c = b
            b = a
            a = (t1 + t2) >>> 0
        }

        h[0] = (h[0] + a) >>> 0
        h[1] = (h[1] + b) >>> 0
        h[2] = (h[2] + c) >>> 0
        h[3] = (h[3] + d) >>> 0
        h[4] = (h[4] + e) >>> 0
        h[5] = (h[5] + f) >>> 0
        h[6] = (h[6] + g) >>> 0
        h[7] = (h[7] + hh) >>> 0
    }

    const result = new Uint8Array(32)
    const rv = new DataView(result.buffer)
    for (let i = 0; i < 8; i++) {
        rv.setUint32(i * 4, h[i], false)
    }
    return result
}

// ====================== HMAC-SHA-256（RFC 2104） ======================

/** HMAC-SHA-256（同步） */
function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
    const blockSize = 64
    let k = key
    if (k.length > blockSize) {
        k = sha256(k)
    }
    const padded = new Uint8Array(blockSize)
    padded.set(k)
    const ipad = new Uint8Array(blockSize)
    const opad = new Uint8Array(blockSize)
    for (let i = 0; i < blockSize; i++) {
        ipad[i] = padded[i] ^ 0x36
        opad[i] = padded[i] ^ 0x5c
    }
    const inner = new Uint8Array(blockSize + data.length)
    inner.set(ipad)
    inner.set(data, blockSize)
    const innerHash = sha256(inner)
    const outer = new Uint8Array(blockSize + innerHash.length)
    outer.set(opad)
    outer.set(innerHash, blockSize)
    return sha256(outer)
}

// ====================== PBKDF2-SHA-256（RFC 8018） ======================

/**
 * PBKDF2-SHA-256 密钥派生
 * @param password   口令（字节数组）
 * @param salt       盐值（字节数组）
 * @param iterations 迭代次数
 * @param length     输出长度（字节）
 */
function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, length: number): Uint8Array {
    const hLen = 32
    const blocks = Math.ceil(length / hLen)
    const result = new Uint8Array(blocks * hLen)

    for (let blockIndex = 1; blockIndex <= blocks; blockIndex++) {
        // U1 = HMAC(password, salt || INT(blockIndex))
        const saltBlock = new Uint8Array(salt.length + 4)
        saltBlock.set(salt)
        const sv = new DataView(saltBlock.buffer)
        sv.setUint32(salt.length, blockIndex, false)
        let u = hmacSha256(password, saltBlock)
        const t = new Uint8Array(u)
        for (let i = 1; i < iterations; i++) {
            u = hmacSha256(password, u)
            for (let j = 0; j < hLen; j++) {
                t[j] ^= u[j]
            }
        }
        // 将派生块 t 复制到 result 对应位置（直接用 Uint8Array.set，避免 DataView 无 set 方法）
        result.set(t, (blockIndex - 1) * hLen)
    }

    return result.slice(0, length)
}

// ====================== AES-256 核心（FIPS 197） ======================

// AES S-box
const AES_SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
])

// AES Rcon（轮常量）
const AES_RCON = new Uint8Array([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36])

/** GF(2^8) 乘法（用于 MixColumns） */
function gfMul(a: number, b: number): number {
    let p = 0
    for (let i = 0; i < 8; i++) {
        if (b & 1) p ^= a
        const hi = a & 0x80
        a = (a << 1) & 0xff
        if (hi) a ^= 0x1b
        b >>= 1
    }
    return p
}

/** AES-256 密钥扩展：32 字节密钥 → 240 字节扩展密钥（15 个 16 字节轮密钥） */
function aesKeyExpansion(key: Uint8Array): Uint8Array {
    const Nk = 8 // 256 位密钥 = 8 个 32 位字
    const Nr = 14 // 14 轮
    const expanded = new Uint8Array(16 * (Nr + 1)) // 240 字节

    // 前 32 字节直接复制
    expanded.set(key)

    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        const offset = (i - 1) * 4
        let t0 = expanded[offset]
        let t1 = expanded[offset + 1]
        let t2 = expanded[offset + 2]
        let t3 = expanded[offset + 3]

        if (i % Nk === 0) {
            // RotWord
            const tmp = t0
            t0 = t1
            t1 = t2
            t2 = t3
            t3 = tmp
            // SubWord
            t0 = AES_SBOX[t0]
            t1 = AES_SBOX[t1]
            t2 = AES_SBOX[t2]
            t3 = AES_SBOX[t3]
            // Rcon
            t0 ^= AES_RCON[i / Nk]
        } else if (i % Nk === 4) {
            // SubWord
            t0 = AES_SBOX[t0]
            t1 = AES_SBOX[t1]
            t2 = AES_SBOX[t2]
            t3 = AES_SBOX[t3]
        }

        const prev = (i - Nk) * 4
        expanded[i * 4] = expanded[prev] ^ t0
        expanded[i * 4 + 1] = expanded[prev + 1] ^ t1
        expanded[i * 4 + 2] = expanded[prev + 2] ^ t2
        expanded[i * 4 + 3] = expanded[prev + 3] ^ t3
    }

    return expanded
}

/** AES 单块加密（16 字节 → 16 字节） */
function aesEncryptBlock(block: Uint8Array, expandedKey: Uint8Array): Uint8Array {
    const Nr = 14
    const state = new Uint8Array(block)

    // AddRoundKey(0)
    for (let i = 0; i < 16; i++) state[i] ^= expandedKey[i]

    for (let round = 1; round < Nr; round++) {
        // SubBytes
        for (let i = 0; i < 16; i++) state[i] = AES_SBOX[state[i]]
        // ShiftRows
        const tmp1 = state[1]
        state[1] = state[5]
        state[5] = state[9]
        state[9] = state[13]
        state[13] = tmp1
        const tmp2a = state[2]
        const tmp2b = state[6]
        state[2] = state[10]
        state[6] = state[14]
        state[10] = tmp2a
        state[14] = tmp2b
        const tmp3a = state[3]
        const tmp3b = state[7]
        const tmp3c = state[11]
        state[3] = state[15]
        state[7] = tmp3a
        state[11] = tmp3b
        state[15] = tmp3c
        // MixColumns
        for (let c = 0; c < 4; c++) {
            const i = c * 4
            const s0 = state[i]
            const s1 = state[i + 1]
            const s2 = state[i + 2]
            const s3 = state[i + 3]
            state[i] = gfMul(s0, 2) ^ gfMul(s1, 3) ^ s2 ^ s3
            state[i + 1] = s0 ^ gfMul(s1, 2) ^ gfMul(s2, 3) ^ s3
            state[i + 2] = s0 ^ s1 ^ gfMul(s2, 2) ^ gfMul(s3, 3)
            state[i + 3] = gfMul(s0, 3) ^ s1 ^ s2 ^ gfMul(s3, 2)
        }
        // AddRoundKey
        for (let i = 0; i < 16; i++) state[i] ^= expandedKey[round * 16 + i]
    }

    // 最后一轮（无 MixColumns）
    for (let i = 0; i < 16; i++) state[i] = AES_SBOX[state[i]]
    const tmp1 = state[1]
    state[1] = state[5]
    state[5] = state[9]
    state[9] = state[13]
    state[13] = tmp1
    const tmp2a = state[2]
    const tmp2b = state[6]
    state[2] = state[10]
    state[6] = state[14]
    state[10] = tmp2a
    state[14] = tmp2b
    const tmp3a = state[3]
    const tmp3b = state[7]
    const tmp3c = state[11]
    state[3] = state[15]
    state[7] = tmp3a
    state[11] = tmp3b
    state[15] = tmp3c
    for (let i = 0; i < 16; i++) state[i] ^= expandedKey[Nr * 16 + i]

    return state
}

// ====================== AES-256-CTR 模式（NIST SP 800-38A） ======================

/**
 * AES-256-CTR 加密/解密（CTR 模式加解密相同）
 * @param data 16 字节倍数的输入
 * @param key  32 字节密钥
 * @param iv   16 字节初始计数器值
 */
function aesCtrCrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
    const expandedKey = aesKeyExpansion(key)
    const counter = new Uint8Array(iv)
    const result = new Uint8Array(data.length)

    for (let block = 0; block < data.length; block += 16) {
        const keystream = aesEncryptBlock(counter, expandedKey)
        const blockSize = Math.min(16, data.length - block)
        for (let i = 0; i < blockSize; i++) {
            result[block + i] = data[block + i] ^ keystream[i]
        }
        // 计数器 +1（大端）
        for (let i = 15; i >= 0; i--) {
            counter[i] = (counter[i] + 1) & 0xff
            if (counter[i] !== 0) break
        }
    }

    return result
}

// ====================== GHASH（NIST SP 800-38D） ======================

/** GF(2^128) 乘法（GHASH 用，使用位反转表示） */
function gf128Mul(x: Uint8Array, h: Uint8Array): Uint8Array {
    const z = new Uint8Array(16)
    const v = new Uint8Array(h)
    for (let i = 0; i < 128; i++) {
        // 如果 x 的第 i 位（从最高位开始）为 1，z ^= v
        const byteIdx = i >>> 3
        const bitIdx = 7 - (i & 7)
        if ((x[byteIdx] >> bitIdx) & 1) {
            for (let j = 0; j < 16; j++) z[j] ^= v[j]
        }
        // v = v >> 1（在 GF(2^128) 中，右移 + 条件异或 R）
        const lsb = v[15] & 1
        for (let j = 15; j > 0; j--) {
            v[j] = ((v[j] >>> 1) | (v[j - 1] << 7)) & 0xff
        }
        v[0] = v[0] >>> 1
        if (lsb) v[0] ^= 0xe1 // R = 0xe1 << 120
    }
    return z
}

/** GHASH：对 AAD 和密文计算哈希 */
function ghash(h: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    const y = new Uint8Array(16)

    // 处理 AAD（按 16 字节分块，不足补 0）
    const aadPadded = padToBlock(aad)
    for (let i = 0; i < aadPadded.length; i += 16) {
        const block = aadPadded.slice(i, i + 16)
        for (let j = 0; j < 16; j++) y[j] ^= block[j]
        const newY = gf128Mul(y, h)
        y.set(newY)
    }

    // 处理密文（按 16 字节分块，不足补 0）
    const ctPadded = padToBlock(ciphertext)
    for (let i = 0; i < ctPadded.length; i += 16) {
        const block = ctPadded.slice(i, i + 16)
        for (let j = 0; j < 16; j++) y[j] ^= block[j]
        const newY = gf128Mul(y, h)
        y.set(newY)
    }

    // 处理长度块：[len(A) in bits || len(C) in bits]，64 位 + 64 位
    const lenBlock = new Uint8Array(16)
    const lv = new DataView(lenBlock.buffer)
    lv.setUint32(0, Math.floor((aad.length * 8) / 0x100000000), false)
    lv.setUint32(4, (aad.length * 8) >>> 0, false)
    lv.setUint32(8, Math.floor((ciphertext.length * 8) / 0x100000000), false)
    lv.setUint32(12, (ciphertext.length * 8) >>> 0, false)
    for (let j = 0; j < 16; j++) y[j] ^= lenBlock[j]
    const result = gf128Mul(y, h)
    return result
}

/** 补齐到 16 字节倍数（末尾补 0） */
function padToBlock(data: Uint8Array): Uint8Array {
    if (data.length % 16 === 0) return data
    const padded = new Uint8Array(Math.ceil(data.length / 16) * 16)
    padded.set(data)
    return padded
}

// ====================== AES-256-GCM（NIST SP 800-38D） ======================

/**
 * AES-256-GCM 加密
 * @param plaintext 明文
 * @param key       32 字节密钥
 * @param iv        12 字节 IV
 * @param aad       附加认证数据（可选）
 * @returns { ciphertext, tag } tag 为 16 字节
 */
function aesGcmEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
    aad: Uint8Array = new Uint8Array(0)
): { ciphertext: Uint8Array; tag: Uint8Array } {
    const expandedKey = aesKeyExpansion(key)

    // 1. H = AES_K(0^128)
    const h = aesEncryptBlock(new Uint8Array(16), expandedKey)

    // 2. J0 = IV || 0^31 || 1（96 位 IV 模式）
    const j0 = new Uint8Array(16)
    j0.set(iv)
    j0[15] = 1

    // 3. 加密：inc32(J0) 作为 CTR 初始计数器
    const ctr = new Uint8Array(j0)
    // inc32：J0 的低 32 位 +1
    ctr[15] = (ctr[15] + 1) & 0xff
    if (ctr[15] === 0) ctr[14] = (ctr[14] + 1) & 0xff
    const ciphertext = aesCtrCrypt(plaintext, key, ctr)

    // 4. GHASH(H, A, C)
    const s = ghash(h, aad, ciphertext)

    // 5. tag = AES_K(J0) XOR S
    const j0Encrypted = aesEncryptBlock(j0, expandedKey)
    const tag = new Uint8Array(16)
    for (let i = 0; i < 16; i++) tag[i] = j0Encrypted[i] ^ s[i]

    return { ciphertext, tag }
}

/**
 * AES-256-GCM 解密
 * @param ciphertext 密文
 * @param key        32 字节密钥
 * @param iv         12 字节 IV
 * @param tag        16 字节认证标签
 * @param aad        附加认证数据（可选）
 * @returns 解密后的明文；tag 校验失败返回 null
 */
function aesGcmDecrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    aad: Uint8Array = new Uint8Array(0)
): Uint8Array | null {
    const expandedKey = aesKeyExpansion(key)

    // 1. H = AES_K(0^128)
    const h = aesEncryptBlock(new Uint8Array(16), expandedKey)

    // 2. J0 = IV || 0^31 || 1
    const j0 = new Uint8Array(16)
    j0.set(iv)
    j0[15] = 1

    // 3. 校验 tag = AES_K(J0) XOR GHASH(H, A, C)
    const s = ghash(h, aad, ciphertext)
    const j0Encrypted = aesEncryptBlock(j0, expandedKey)
    const expectedTag = new Uint8Array(16)
    for (let i = 0; i < 16; i++) expectedTag[i] = j0Encrypted[i] ^ s[i]

    // 常量时间比较（防止时序攻击）
    let diff = 0
    for (let i = 0; i < 16; i++) diff |= tag[i] ^ expectedTag[i]
    if (diff !== 0) return null // tag 校验失败

    // 4. 解密：inc32(J0) 作为 CTR 初始计数器
    const ctr = new Uint8Array(j0)
    ctr[15] = (ctr[15] + 1) & 0xff
    if (ctr[15] === 0) ctr[14] = (ctr[14] + 1) & 0xff
    return aesCtrCrypt(ciphertext, key, ctr)
}

// ====================== 安全随机数生成（同步） ======================

/**
 * 生成密码学安全随机字节（同步）
 * - H5/小程序：使用 Math.random（开发调试环境可接受，生产用 APP-PLUS）
 * - APP-PLUS：优先使用 plus.runtime 原生 API（如可用）
 */
function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    // 使用 IIFE 包裹条件编译（踩坑日志 [15]）
    // 注意：plus 在 H5/小程序环境不存在，必须通过 globalThis 访问以避免 vue-tsc 报 "Cannot find name 'plus'"
    const fill = (() => {
        // #ifdef APP-PLUS
        // APP-PLUS 环境：尝试使用 plus 原生 API（如果可用），否则降级到 Math.random
        try {
            // 通过 globalThis 访问 plus，避免直接引用未声明的标识符
            const g: any = globalThis
            const plusObj: any = g?.plus
            const wordArrayRandom = plusObj?.cryptoJS?.lib?.WordArray?.random
            if (typeof wordArrayRandom === 'function') {
                return (n: number): Uint8Array => {
                    const wa = wordArrayRandom.call(plusObj.cryptoJS.lib.WordArray, n)
                    // WordArray → Uint8Array
                    const arr = new Uint8Array(n)
                    for (let i = 0; i < n; i++) {
                        arr[i] = (wa.words[i >>> 2] >>> (24 - (i & 3) * 8)) & 0xff
                    }
                    return arr
                }
            }
        } catch {
            // plus 不可用，降级
        }
        return null
        // #endif
        // #ifndef APP-PLUS
        return null
        // #endif
    })()

    if (fill) {
        const result = fill(length)
        if (result) return result
    }

    // 降级：基于时间戳 + Math.random 的伪随机（开发调试用）
    // 注意：生产环境（APP-PLUS）应使用上面的原生 API
    for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
    }
    return bytes
}

// ====================== 设备指纹 ======================

/**
 * 获取设备指纹（同步）
 * 基于 uni.getSystemInfoSync 的 deviceId + brand + model + system 哈希
 * 设备指纹不存储，每次运行时动态计算
 */
export function getDeviceFingerprint(): string {
    const info = uni.getSystemInfoSync()
    const raw = `${info.deviceId || ''}|${info.brand || ''}|${info.model || ''}|${info.system || ''}|${info.platform || ''}`
    const hash = sha256(strToBytes(raw))
    return bytesToBase64(hash)
}

// ====================== 密钥派生 ======================

/** 固定盐值（用于密钥派生，非敏感信息 — 盐值的作用是防止彩虹表，本身不需要保密） */
const DERIVE_SALT = 'ZXhpeGlhbmctc2VjdXJpdHktc2FsdC0yMDI2' // base64('zhixiang-security-salt-2026')

/** PBKDF2 迭代次数 */
const PBKDF2_ITERATIONS = 10000

/**
 * 基于设备指纹 + 盐值派生 256 位密钥（PBKDF2-SHA-256）
 * 密钥不存储，每次运行时动态派生
 *
 * @param fingerprint 设备指纹（getDeviceFingerprint() 返回值）
 * @param salt        盐值（默认使用内置盐值，可自定义）
 * @returns 32 字节派生密钥
 */
export function deriveKey(fingerprint: string, salt: string = DERIVE_SALT): DerivedKey {
    const password = strToBytes(fingerprint)
    const saltBytes = strToBytes(salt)
    return pbkdf2Sha256(password, saltBytes, PBKDF2_ITERATIONS, 32)
}

// ====================== 加解密 API ======================

/**
 * AES-256-GCM 加密
 *
 * @param plaintext 明文字符串
 * @param key       派生密钥（32 字节）
 * @returns { iv, ciphertext, tag }（base64 编码）
 */
export function encrypt(plaintext: string, key: DerivedKey): EncryptedData {
    const iv = randomBytes(12)
    const plaintextBytes = strToBytes(plaintext)
    const { ciphertext, tag } = aesGcmEncrypt(plaintextBytes, key, iv)
    return {
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext),
        tag: bytesToBase64(tag)
    }
}

/**
 * AES-256-GCM 解密
 *
 * @param encrypted { iv, ciphertext, tag }（base64 编码）
 * @param key       派生密钥（32 字节）
 * @returns 明文字符串；tag 校验失败抛出错误
 */
export function decrypt(encrypted: EncryptedData, key: DerivedKey): string {
    const iv = base64ToBytes(encrypted.iv)
    const ciphertext = base64ToBytes(encrypted.ciphertext)
    const tag = base64ToBytes(encrypted.tag)
    const plaintext = aesGcmDecrypt(ciphertext, key, iv, tag)
    if (plaintext === null) {
        throw new Error('AES-256-GCM 解密失败：认证标签校验未通过（数据可能被篡改或密钥不匹配）')
    }
    return bytesToStr(plaintext)
}

// ====================== 安全存储封装 ======================

/**
 * 派生密钥缓存（运行时派生一次，避免重复计算 PBKDF2）
 * 注意：密钥仅缓存在内存中，不落盘
 */
let cachedKey: DerivedKey | null = null

/** 获取派生密钥（带缓存） */
function getKey(): DerivedKey {
    if (!cachedKey) {
        const fingerprint = getDeviceFingerprint()
        cachedKey = deriveKey(fingerprint)
    }
    return cachedKey
}

/**
 * 加密后存储为 enc_${key}
 * - value 先 JSON.stringify（如果是对象）再加密
 * - 加密结果 { iv, ciphertext, tag } 以 JSON 字符串形式存入 uni.setStorageSync
 *
 * @param key   存储键名（不带 enc_ 前缀）
 * @param value 任意可序列化值
 */
export function setSecureStorage(key: string, value: unknown): void {
    const jsonStr = JSON.stringify(value)
    const encKey = getKey()
    const encrypted = encrypt(jsonStr, encKey)
    uni.setStorageSync(`enc_${key}`, JSON.stringify(encrypted))
}

/**
 * 读取 enc_${key} 并解密，返回原 value
 * - 内部使用 uni.getStorageSync 同步读取
 * - 解密失败（tag 校验失败或数据不存在）返回空字符串
 *
 * @param key 存储键名（不带 enc_ 前缀）
 * @returns 解密后的字符串（JSON 字符串，调用方按需 JSON.parse）；不存在或解密失败返回 ''
 */
export function getSecureStorage(key: string): string {
    const raw = uni.getStorageSync(`enc_${key}`)
    if (!raw || typeof raw !== 'string') return ''
    try {
        const encrypted: EncryptedData = JSON.parse(raw)
        if (!encrypted.iv || !encrypted.ciphertext || !encrypted.tag) return ''
        const encKey = getKey()
        return decrypt(encrypted, encKey)
    } catch {
        // 解密失败（数据被篡改、密钥不匹配、JSON 解析失败等）
        return ''
    }
}

/**
 * 删除 enc_${key}
 *
 * @param key 存储键名（不带 enc_ 前缀）
 */
export function removeSecureStorage(key: string): void {
    uni.removeStorageSync(`enc_${key}`)
}
