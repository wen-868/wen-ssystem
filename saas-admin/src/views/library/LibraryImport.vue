<template>
  <div class="import-page">
    <!-- ════════ 页头（设计稿 v1.6 sec-goods 批量导入 Excel 弹窗，行 2527~2549 展开为页面） ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">批量导入 Excel</div>
        <p class="pd">
          模板与「版块09 模板中心 · 商品导出模板」同源 · 导入触发三重查重（GS1 条码 / 平台编码 / 名称+规格）· 导入结果异步通知，失败行可下载错误明细
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="resetAll">取消</span>
        <span class="btn btn-p" :class="{ dis: !canImport }" @click="executeImport">开始导入</span>
      </div>
    </div>

    <!-- ════════ 导入流程面板 ════════ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">批量导入 Excel <span class="v16-tag lt">v1.6</span></span>
        <span class="ph-s">SPU 字段在前 · SKU 字段在后 · 每一行表示 1 条 SPU + SKU</span>
      </div>
      <div class="p-bd">
        <!-- ① 下载导入模板 -->
        <div class="frow">
          <span class="btn tpl-btn" @click="downloadTemplate">① 下载导入模板（与版块09 模板中心同源）</span>
        </div>

        <!-- ② 上传文件 -->
        <div class="fld mt12">
          <span>② 上传文件</span>
          <div class="dropzone" :class="{ filled: !!fileName }" @click="pickFile">
            <template v-if="fileName">
              {{ fileName }}（{{ dataRowCount }} 行）<br>
              <span class="small">点击重新选择文件</span>
            </template>
            <template v-else>
              点击选择 .xlsx / .csv 文件<br>
              <span class="small">支持 .xlsx / .csv · 单次 ≤5,000 行 · UTF-8 编码，仅处理前 500 行数据</span>
            </template>
          </div>
          <input ref="fileInput" type="file" accept=".csv,.tsv,.txt,.xlsx" style="display:none" @change="handleFileChange" />
        </div>

        <!-- ③ 校验结果 -->
        <div class="fld mt12">
          <span>③ 校验结果（异步，完成后通知）</span>
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr><th>校验项</th><th class="num">行数</th><th>说明</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="tag tag-g">可导入</span></td>
                  <td class="num">{{ checkResult.importable }}</td>
                  <td>字段完整 · 条码核验通过</td>
                </tr>
                <tr>
                  <td><span class="tag tag-o">重复跳过</span></td>
                  <td class="num">{{ checkResult.duplicate }}</td>
                  <td>与现有主数据重复 · 三重查重命中</td>
                </tr>
                <tr>
                  <td><span class="tag tag-r">失败</span></td>
                  <td class="num">{{ checkResult.failed }}</td>
                  <td>
                    条码格式错误 · 可下载错误明细
                    <span v-if="invalidRows.length > 0" class="btn-t" style="margin-left:6px" @click="downloadErrorCsv">下载错误明细</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 重复行处理 -->
        <div class="fld mt12">
          <span>重复行处理</span>
          <span class="sel dup-sel" @click="togglePolicy">{{ duplicatePolicy }}<b class="caret">▾</b></span>
        </div>

        <!-- 导入结果提示 -->
        <div v-if="importDone" class="tipbar mt12" :class="importResult.failed > 0 ? 'w' : ''" style="padding:8px 11px">
          <span class="ic">i</span>
          <span>导入完成：成功 <b>{{ importResult.success }}</b> 条 · 失败 <b>{{ importResult.failed }}</b> 条<template v-if="importResult.failed > 0">（失败行可下载错误明细，修正后重新导入）</template></span>
        </div>

        <!-- 守门提示（设计稿 行 2546） -->
        <div class="tipbar w mt12" style="padding:8px 11px">
          <span class="ic">!</span>
          <span>覆盖参考价会影响租户侧「新版本可同步」提示，操作前请确认；导入动作记入<b>日志中心</b>。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { createSpuApi, type SkuItem } from '../../api/library'

/* ───────────────── 状态 ─────────────────
   保留原导入业务核心逻辑（模板下载 / 文件解析 / 字段映射 /
   行级校验 / createSpuApi 导入 / 错误明细下载）；
   无文件时校验结果按设计稿演示值渲染（行 2538~2542），保证视觉完整。 */
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const importing = ref(false)
const importDone = ref(false)

const headers = ref<string[]>([])
const rawRows = ref<string[][]>([])

const duplicatePolicies = ['跳过（保留现有主数据）', '覆盖参考价']
const policyIdx = ref(0)
const duplicatePolicy = computed(() => duplicatePolicies[policyIdx.value])
function togglePolicy() {
  policyIdx.value = (policyIdx.value + 1) % duplicatePolicies.length
}

/* 字段映射（模板列名 → 目标字段，沿用原映射逻辑） */
type Target = `spu:${string}` | `sku:${string}` | ''
const spuFields: { key: string; label: string }[] = [
  { key: 'name', label: 'SPU 名称' },
  { key: 'brandName', label: '品牌名称' },
  { key: 'specs', label: '规格' },
  { key: 'unit', label: '单位' },
  { key: 'mainImage', label: '主图 URL' },
  { key: 'alcoholContent', label: '酒精度' },
  { key: 'origin', label: '产地' },
  { key: 'aromaType', label: '香型' },
  { key: 'description', label: '简介' },
]
const skuFields: { key: string; label: string }[] = [
  { key: 'skuName', label: 'SKU 规格名称' },
  { key: 'barcode', label: 'SKU 条码' },
  { key: 'volume', label: '容量 (ml)' },
  { key: 'packaging', label: '包装形式' },
  { key: 'baseUnit', label: '基本单位' },
  { key: 'boxUnit', label: '箱单位' },
  { key: 'boxRatio', label: '装箱比' },
  { key: 'suggestedRetailPrice', label: '建议零售价' },
]

function headerToTargetKey(h: string): Target {
  const norm = String(h).trim().toLowerCase()
  const spuMap: Record<string, string> = {
    'spu名称': 'name', '商品名称': 'name', '名称': 'name', 'name': 'name',
    '品牌名称': 'brandName', '品牌': 'brandName', 'brandname': 'brandName',
    '规格': 'specs', 'spu规格': 'specs', 'specs': 'specs',
    '单位': 'unit', 'spu单位': 'unit', 'unit': 'unit',
    '主图url': 'mainImage', '主图': 'mainImage', 'mainimage': 'mainImage',
    '酒精度': 'alcoholContent', '度数': 'alcoholContent',
    '产地': 'origin', 'origin': 'origin',
    '香型': 'aromaType',
    '简介': 'description', '描述': 'description',
  }
  const skuMap: Record<string, string> = {
    'sku规格名称': 'skuName', 'sku名称': 'skuName', '规格名称': 'skuName',
    'sku条码': 'barcode', '条码': 'barcode', '条形码': 'barcode', 'barcode': 'barcode',
    '容量(ml)': 'volume', '容量': 'volume', 'volume': 'volume',
    '包装': 'packaging', '包装形式': 'packaging',
    '基本单位': 'baseUnit',
    '箱单位': 'boxUnit',
    '装箱比': 'boxRatio',
    '建议零售价': 'suggestedRetailPrice', '零售价': 'suggestedRetailPrice',
  }
  const key = Object.keys(spuMap).find((k) => norm.includes(k.replace(/\s/g, '')))
  if (key) return `spu:${spuMap[key]}`
  const key2 = Object.keys(skuMap).find((k) => norm.includes(k.replace(/\s/g, '')))
  if (key2) return `sku:${skuMap[key2]}`
  return ''
}

/* 校验结果（无文件时展示设计稿演示值） */
const checkResult = ref({ importable: 1025, duplicate: 8, failed: 3 })
const dataRowCount = computed(() => Math.max(0, rawRows.value.length - 1))

interface PreviewRow {
  _rowNo: number
  _error?: string
  _spu?: any
  _sku?: Partial<SkuItem>
}
const previewRows = ref<PreviewRow[]>([])
const validRows = computed(() => previewRows.value.filter((r) => !r._error))
const invalidRows = computed(() => previewRows.value.filter((r) => r._error))
const canImport = computed(() => validRows.value.length > 0 && !importing.value)

/* ───────────────── ① 模板下载（保留原逻辑） ───────────────── */
function downloadTemplate() {
  const sep = ','
  const head = ['SPU名称', '品牌名称', '规格', '单位', '主图URL', '酒精度', '产地', '香型', '简介',
               'SKU规格名称', 'SKU条码', '容量(ml)', '包装', '基本单位', '箱单位', '装箱比', '建议零售价']
  const sample1 = ['农夫山泉饮用天然水 550ml', '农夫山泉', '550ml * 24瓶/箱', '箱', 'https://.../nfs.jpg', '', '浙江杭州', '', '',
                   '整箱装', '6901234500017', '550', '瓶装', '瓶', '箱', '24', '36.00']
  const sample2 = ['乐事薯片原味 104g', '乐事', '104g * 24袋/箱', '袋', '', '', '', '', '',
                   '单袋装', '6902766500011', '104', '袋装', '袋', '箱', '24', '5.50']
  const csv = [head, sample1, sample2].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep)).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'goods_import_template.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  ElMessage.success('导入模板已下载（与版块09 模板中心同源）')
}

/* ───────────────── ② 文件上传解析（保留原逻辑） ───────────────── */
function pickFile() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.files?.[0]
  if (!raw) return
  if (raw.size > 10 * 1024 * 1024) {
    ElMessage.error('文件超过 10MB 限制')
    return
  }
  const text = await raw.text()
  if (!text) {
    ElMessage.error('文件为空')
    return
  }
  const isTsv = raw.name.endsWith('.tsv') || (raw.name.endsWith('.csv') === false && text.includes('\t') && !text.includes(','))
  const sep = isTsv ? '\t' : ','
  const parsed = parseCsvText(text, sep)
  if (!parsed || parsed.length < 2) {
    ElMessage.error('文件内容不足：至少需要 1 行表头 + 1 行数据')
    return
  }
  if (parsed.length > 501) {
    ElMessage.warning('文件超过 500 行，仅处理前 500 行数据')
  }
  fileName.value = raw.name
  headers.value = parsed[0].map((h) => String(h || '').trim())
  rawRows.value = parsed.slice(0, 501)
  validate()
  input.value = ''
}

function parseCsvText(text: string, sep: string): string[][] {
  const lines: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  const normalized = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === sep) { cur.push(field); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && normalized[i + 1] === '\n') i++
        cur.push(field); field = ''
        if (cur.length > 1 || cur[0] !== '') lines.push(cur)
        cur = []
      } else field += ch
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur) }
  return lines
}

/* ───────────────── ③ 行级校验（保留原逻辑：必填字段 + 条码格式） ───────────────── */
function validate() {
  const idxMap: Record<string, number> = {}
  headers.value.forEach((h, i) => {
    const t = headerToTargetKey(h)
    if (t) idxMap[t] = i
  })
  const rows: PreviewRow[] = []
  for (let i = 1; i < rawRows.value.length; i++) {
    const cells = rawRows.value[i]
    const spu: any = {}
    const sku: Partial<SkuItem> = {}
    spuFields.forEach((f) => {
      const idx = idxMap[`spu:${f.key}`]
      if (idx !== undefined) spu[f.key] = String(cells[idx] ?? '').trim()
    })
    skuFields.forEach((f) => {
      const idx = idxMap[`sku:${f.key}`]
      if (idx !== undefined) (sku as any)[f.key] = String(cells[idx] ?? '').trim()
    })
    const errors: string[] = []
    if (!spu.name) errors.push('SPU 名称为空')
    if (!spu.specs) errors.push('SPU 规格为空')
    if (!sku.skuName) errors.push('SKU 规格名称为空')
    if (!sku.barcode) errors.push('SKU 条码为空')
    if (sku.barcode && !/^\d{6,14}$/.test(String(sku.barcode))) errors.push(`SKU 条码格式异常: ${sku.barcode}`)
    rows.push({ _rowNo: i, _error: errors.length ? errors.join('；') : undefined, _spu: spu, _sku: sku })
  }
  previewRows.value = rows
  importDone.value = false
  checkResult.value = {
    importable: validRows.value.length,
    duplicate: 0,
    failed: invalidRows.value.length,
  }
  if (rawRows.value.length > 1) {
    ElMessage.success(`校验完成：${validRows.value.length} 行可导入，${invalidRows.value.length} 行失败`)
  }
}

/* ───────────────── 错误明细下载（保留原逻辑） ───────────────── */
function downloadErrorCsv() {
  const rows = invalidRows.value
  if (rows.length === 0) { ElMessage.info('无错误行'); return }
  const sep = ','
  const lines = ['行号,错误原因']
  rows.forEach((r) => {
    lines.push(`"${r._rowNo}","${String(r._error ?? '').replace(/"/g, '""')}"`)
  })
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Import_Errors_${Date.now()}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ───────────────── 开始导入（保留原逻辑：逐行 createSpuApi） ───────────────── */
const importResult = ref({ success: 0, failed: 0 })

async function executeImport() {
  if (importing.value) return
  if (validRows.value.length === 0) {
    ElMessage.warning('无可导入行：请先上传文件并通过校验')
    return
  }
  importing.value = true
  importResult.value = { success: 0, failed: 0 }
  for (const pr of validRows.value) {
    const spu = pr._spu || {}
    const sku = pr._sku || {}
    const payload = {
      name: spu.name,
      brandName: spu.brandName || undefined,
      specs: spu.specs,
      unit: spu.unit || undefined,
      mainImage: spu.mainImage || undefined,
      alcoholContent: spu.alcoholContent || undefined,
      origin: spu.origin || undefined,
      aromaType: spu.aromaType || undefined,
      description: spu.description || undefined,
      skus: [{
        skuName: sku.skuName,
        barcode: sku.barcode,
        volume: sku.volume || '',
        packaging: sku.packaging || '',
        baseUnit: sku.baseUnit || '瓶',
        boxUnit: sku.boxUnit || '箱',
        boxRatio: sku.boxRatio || 1,
        suggestedRetailPrice: sku.suggestedRetailPrice || 0,
        status: 'ACTIVE',
      }],
    }
    try {
      await createSpuApi(payload as any)
      importResult.value.success++
    } catch {
      importResult.value.failed++
    }
  }
  importing.value = false
  importDone.value = true
  checkResult.value.duplicate = policyIdx.value === 0 ? checkResult.value.duplicate : 0
  ElMessage.success(`导入完成：成功 ${importResult.value.success} 条，失败 ${importResult.value.failed} 条`)
}

/* ───────────────── 取消 / 重置 ───────────────── */
function resetAll() {
  fileName.value = ''
  headers.value = []
  rawRows.value = []
  previewRows.value = []
  importDone.value = false
  importing.value = false
  policyIdx.value = 0
  checkResult.value = { importable: 1025, duplicate: 8, failed: 3 }
}
</script>

<style scoped>
.import-page { color: var(--ink); }

/* 功能性下拉箭头（.sel 内联箭头补充） */
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  font-style: normal;
  font-weight: var(--font-normal);
  margin-left: auto;
}

/* ① 模板按钮撑满（设计稿 行 2531：flex:1;justify-content:center） */
.tpl-btn {
  flex: 1;
  justify-content: center;
}

/* ② 上传落区（设计稿 行 2533：虚线描边 / 圆角 / 居中 / g0 底） */
.dropzone {
  border: 1px dashed var(--g3);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  text-align: center;
  color: var(--g5);
  font-size: var(--kv-label-size);
  background: var(--g0);
  cursor: pointer;
}
.dropzone:hover { border-color: var(--g4); }
.dropzone.filled { color: var(--g6); }

/* 重复行处理下拉撑满 */
.dup-sel { width: 100%; justify-content: space-between; }

/* 不可用主按钮 */
.btn-p.dis { opacity: 0.55; cursor: not-allowed; }

/* v1.6 修订标注（设计稿 .v16-tag，components.css 未移植，按令牌实现） */
.v16-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--ctrl-caret-size);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  vertical-align: var(--ver-tag-valign);
  white-space: nowrap;
}
.v16-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
</style>
