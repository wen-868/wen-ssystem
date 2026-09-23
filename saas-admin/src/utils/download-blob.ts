/**
 * 文件流（CSV / Blob）下载工具（R101-C4-F）
 *
 * 背景：平台财务与监控的导出端点返回**文件流**（`text/csv; charset=utf-8` + BOM +
 * `Content-Disposition`，不走 JSON 信封），必须用 `responseType: 'blob'` 请求
 * （范式见 `src/api/tenant.ts:55`、`views/tenant/TenantList.vue:421-435`）。
 *
 * 两个页面（Reconciliation.vue / MonitorView.vue）共用本文件，避免同一段下载代码复制多份
 * （仓库 `npm run dup:check` 会按 jscpd 卡重复代码块）。
 */

/** 从 `Content-Disposition` 取文件名（无则返回空串） */
function filenameFromResponse(res: unknown): string {
  const raw = (res as { headers?: Record<string, unknown> } | null)?.headers?.['content-disposition']
  if (typeof raw !== 'string') return ''
  const match = /filename="?([^";]+)"?/i.exec(raw)
  return match ? match[1].trim() : ''
}

/**
 * 读取导出响应头里的实际行数（`X-Export-Rows`）。
 * 拿不到响应头（新客户端 `utils/request.ts` 只回传 `response.data`）时返回 null，
 * **不猜数字** —— 调用方据此决定是否在提示里带上行数。
 */
export function readExportRows(res: unknown): number | null {
  const raw = (res as { headers?: Record<string, unknown> } | null)?.headers?.['x-export-rows']
  const n = Number(raw)
  return Number.isFinite(n) && raw !== undefined && raw !== null && raw !== '' ? n : null
}

/** 把响应体当作文件流保存到本地；返回实际使用的文件名（供提示使用） */
export function saveBlobResponse(res: unknown, fallbackFilename: string): string {
  const body = (res as { data?: unknown } | null)?.data ?? res
  const blob =
    body instanceof Blob ? body : new Blob([body as BlobPart], { type: 'text/csv;charset=utf-8' })
  const filename = filenameFromResponse(res) || fallbackFilename
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return filename
}
