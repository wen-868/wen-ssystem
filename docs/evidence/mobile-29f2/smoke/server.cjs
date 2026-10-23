#!/usr/bin/env node
/**
 * MOBILE-29F1 · H5 真实上传冒烟服务（Express + multer）
 *
 * 目的：接住 app-mobile H5 端 `uni.uploadFile` 真实发出的 multipart 请求，
 * 以服务端视角证明：
 *   ① 请求带着浏览器自生成的 `multipart/form-data; boundary=...`（不是被前端
 *      写死的 `application/json`——那正是 QODER-29 驳回根因：boundary 丢失、
 *      multer 解析不到文件）；
 *   ② multer 能收到文件实体（req.file 非空）与表单字段；
 *   ③ 安全三头（Authorization / X-Tenant-Id / x-csrf-token）随请求到达。
 *
 * 端点（与 app-mobile 两个上传函数逐字对齐）：
 *   POST /api/admin/auth/avatar          multer.single('avatar')   ← profileApi.uploadAvatar
 *   POST /api/admin/products/upload-image multer.single('image')   ← productsApi.uploadImage
 * 响应体按两个函数的 success 分支契约返回：
 *   avatar ⇒ { code:'0', msg:'ok', data:{ avatar } }（profile.ts 取 data.data）
 *   image  ⇒ { code:'0', msg:'ok', data:{ url } }     （products.ts 取 data.url ?? url）
 *
 * 复跑：node server.cjs（默认 127.0.0.1:5199；PORT 环境变量可改）
 * 留档：本文件与 run-smoke.mjs 常驻 docs/evidence/mobile-29f1/smoke/，跑完即删。
 */
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const PORT = Number(process.env.PORT || 5199)
const HOST = '127.0.0.1'
const UPLOAD_DIR = path.join(__dirname, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

/** 每次上传请求的可观测记录（服务端唯一真相源） */
const records = []

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${path.basename(file.originalname || 'upload.bin')}`
    cb(null, safe)
  }
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

const app = express()
app.use(cors()) // H5 跨域（5173 -> 5199）预检与简单请求都放行
app.use(express.json())

function record(req, extra) {
  const ct = String(req.headers['content-type'] || '')
  const rec = {
    t: new Date().toISOString(),
    method: req.method,
    endpoint: req.path,
    contentType: ct,
    hasBoundary: /multipart\/form-data/.test(ct) && /boundary=/.test(ct),
    headers: {
      authorization: req.headers['authorization'] || null,
      'x-tenant-id': req.headers['x-tenant-id'] || null,
      'x-csrf-token': req.headers['x-csrf-token'] || null
    },
    file: null,
    fields: null,
    multerError: null,
    ...extra
  }
  records.push(rec)
  console.log(`[smoke] ${rec.method} ${rec.endpoint} ct=${ct.slice(0, 60)} file=${rec.file ? rec.file.fieldname : 'NULL'} err=${rec.multerError || 'none'}`)
  return rec
}

function handleUpload(field) {
  return (req, res) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        // 旧 bug 的典型形态：前端写死 application/json ⇒ boundary 丢失 ⇒ 这里报错且 req.file 为空
        record(req, { multerError: `${err.name}: ${err.message}` })
        res.status(400).json({ code: '400', msg: `multer: ${err.message}`, data: null })
        return
      }
      const f = req.file
      if (!f) {
        record(req, { multerError: 'NO_FILE (multipart 里没有目标字段)' })
        res.status(400).json({ code: '400', msg: '未收到文件', data: null })
        return
      }
      const rec = record(req, {
        file: { fieldname: f.fieldname, originalname: f.originalname, size: f.size, mimetype: f.mimetype, savedAs: f.filename },
        fields: { ...req.body }
      })
      if (field === 'avatar') {
        res.json({ code: '0', msg: 'ok', data: { avatar: `http://${HOST}:${PORT}/files/${f.filename}` } })
      } else {
        res.json({ code: '0', msg: 'ok', data: { url: `http://${HOST}:${PORT}/files/${f.filename}` } })
      }
      void rec
    })
  }
}

app.post('/api/admin/auth/avatar', handleUpload('avatar'))
app.post('/api/admin/products/upload-image', handleUpload('image'))

// 冒烟留证：上传到的文件本体可回看
app.use('/files', express.static(UPLOAD_DIR))

// 供 run-smoke.mjs 取证
app.get('/__records', (_req, res) => res.json(records))
app.post('/__reset', (_req, res) => { records.length = 0; res.json({ ok: true }) })
app.get('/__health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, HOST, () => {
  console.log(`[smoke] upload smoke server listening on http://${HOST}:${PORT}`)
})
