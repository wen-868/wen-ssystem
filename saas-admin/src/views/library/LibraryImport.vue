<template>
  <div>
    <h2 style="margin-bottom: 24px;">批量导入 SPU + SKU</h2>

    <!-- 步骤条 -->
    <el-card style="margin-bottom: 16px;">
      <el-steps :active="step" finish-status="success" simple style="margin: 8px 0;">
        <el-step title="上传文件" description="上传 CSV/TSV 数据文件" />
        <el-step title="字段映射" description="匹配表头与目标字段" />
        <el-step title="数据预览" description="逐行校验并预览" />
        <el-step title="导入结果" description="查看成功/失败统计" />
      </el-steps>
    </el-card>

    <!-- 步骤 1：上传文件 -->
    <el-card v-if="step === 0">
      <template #header>
        <div style="font-weight: 600;">第 1 步：上传数据文件</div>
      </template>
      <div style="max-width: 640px;">
        <el-alert type="info" :closable="false" style="margin-bottom: 20px;">
          <div>支持格式：UTF-8 编码的 <b>.csv</b> 或 <b>.tsv</b> 文件</div>
          <div>建议：先下载模板，按模板填写后再上传（SPU 字段在前，SKU 字段在后，每一行表示 1 条 SPU + SKU）</div>
          <el-button link type="primary" @click="downloadTemplate" style="padding: 0; margin-top: 4px;">下载导入模板 (.csv)</el-button>
        </el-alert>
        <el-upload
          class="upload-demo"
          drag
          :auto-upload="false"
          :on-change="handleFileChange"
          :limit="1"
          accept=".csv,.tsv,.txt"
        >
          <el-icon class="el-icon--upload" style="font-size: 48px; color: #c0c4cc;"><UploadFilled /></el-icon>
          <div class="el-upload__text" style="margin-top: 8px;">
            将 CSV/TSV 文件拖到此处，或 <em>点击选择文件</em>
          </div>
          <template #tip>
            <div class="el-upload__tip" style="color: #909399; margin-top: 6px;">
              最大 10MB，仅支持 UTF-8 编码；最多 500 行
            </div>
          </template>
        </el-upload>
        <div v-if="rawRows.length > 0" style="margin-top: 20px;">
          <el-result icon="success" title="文件读取成功" :sub-title="`共 ${rawRows.length - 1} 行数据，表头 ${headers.length} 列`" style="padding: 0;" />
        </div>
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <el-button type="primary" :disabled="rawRows.length < 2" @click="step = 1">下一步：字段映射 →</el-button>
        </div>
      </div>
    </el-card>

    <!-- 步骤 2：字段映射 -->
    <el-card v-if="step === 1">
      <template #header>
        <div style="font-weight: 600;">第 2 步：字段映射</div>
      </template>
      <div style="margin-bottom: 16px; color: #909399; font-size: 13px;">
        将左侧上传文件的表头与右侧目标 SPU / SKU 字段进行匹配；自动检测已标为『已匹配』的字段
      </div>
      <el-table :data="mappingRows" border size="default">
        <el-table-column label="序号" width="70" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="上传文件表头" prop="header" width="240">
          <template #default="{ row }">
            <el-tag size="default" effect="plain" style="font-weight: 500;">{{ row.header }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="示例值" width="240">
          <template #default="{ row }">
            <span style="color: #606266; font-family: monospace;">{{ row.sample || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="目标字段" min-width="260">
          <template #default="{ row }">
            <el-select v-model="row.target" placeholder="-- 不导入此列 --" clearable style="width: 100%;">
              <el-option-group label="SPU 字段">
                <el-option v-for="f in spuFields" :key="'spu:' + f.key" :label="`SPU · ${f.label}`" :value="'spu:' + f.key" />
              </el-option-group>
              <el-option-group label="SKU 字段">
                <el-option v-for="f in skuFields" :key="'sku:' + f.key" :label="`SKU · ${f.label}`" :value="'sku:' + f.key" />
              </el-option-group>
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 20px; display: flex; justify-content: space-between;">
        <el-button @click="step = 0">← 上一步</el-button>
        <el-button type="primary" :disabled="!mappingValid" @click="buildPreview">下一步：预览数据 →</el-button>
      </div>
    </el-card>

    <!-- 步骤 3：预览校验 -->
    <el-card v-if="step === 2">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">第 3 步：数据预览 & 校验</span>
          <div>
            <el-tag type="success" style="margin-right: 8px;">有效行：{{ validRows.length }}</el-tag>
            <el-tag type="danger">错误行：{{ invalidRows.length }}</el-tag>
          </div>
        </div>
      </template>
      <el-alert
        v-if="invalidRows.length > 0"
        type="error"
        :closable="false"
        style="margin-bottom: 16px;"
      >
        共发现 <b>{{ invalidRows.length }}</b> 行错误数据，红色行将在导入时被跳过，或下载失败原因清单修正后重新上传。
        <el-button link type="primary" @click="downloadErrorCsv" style="padding: 0 0 0 8px;">下载失败原因清单</el-button>
      </el-alert>
      <el-table :data="previewRows" border stripe size="small" max-height="520" style="width: 100%;">
        <el-table-column label="行号" width="70" align="center" fixed>
          <template #default="{ row }">
            <span :style="{ color: row._error ? '#f56c6c' : undefined, fontWeight: row._error ? 600 : 400 }">
              {{ row._rowNo }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="h in previewHeaders"
          :key="h"
          :label="h"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row._error && row._errorFields?.includes(h)" style="color: #f56c6c; font-weight: 600;">
              {{ row[h] || '(空)' }}
            </span>
            <span v-else>{{ row[h] || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="校验结果" width="240" fixed="right">
          <template #default="{ row }">
            <el-tag v-if="row._error" type="danger" size="small" effect="dark">{{ row._error }}</el-tag>
            <el-tag v-else type="success" size="small" effect="light">✓ 校验通过</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 20px; display: flex; justify-content: space-between;">
        <el-button @click="step = 1">← 上一步</el-button>
        <el-button type="primary" :loading="importing" :disabled="validRows.length === 0" @click="executeImport">
          开始导入（{{ validRows.length }} 行）
        </el-button>
      </div>
    </el-card>

    <!-- 步骤 4：导入结果 -->
    <el-card v-if="step === 3">
      <template #header>
        <div style="font-weight: 600;">第 4 步：导入结果</div>
      </template>
      <el-row :gutter="16" style="margin-bottom: 24px;">
        <el-col :span="8">
          <el-statistic title="总处理行数" :value="importResult.total" style="text-align: center;" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="成功导入" :value="importResult.success" style="text-align: center;">
            <template #suffix>
              <span style="font-size: 16px; color: #67c23a;">行</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="8">
          <el-statistic title="失败行数" :value="importResult.failed" style="text-align: center;">
            <template #suffix>
              <span style="font-size: 16px; color: #f56c6c;">行</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
      <el-result
        :icon="importResult.failed === 0 ? 'success' : 'warning'"
        :title="importResult.failed === 0 ? '全部导入成功！' : '部分行导入失败'"
        :sub-title="importResult.failed === 0 ? `成功创建 ${importResult.success} 条 SPU+SKU 记录` : `成功 ${importResult.success} 条，失败 ${importResult.failed} 条，可下载失败原因清单修正后重新导入`"
      >
        <template #extra>
          <div v-if="importResult.failed > 0" style="margin-bottom: 16px;">
            <el-button type="warning" @click="downloadErrorCsvStep4">下载失败原因清单</el-button>
          </div>
          <el-button type="primary" @click="resetAll">重新上传新文件</el-button>
          <el-button @click="$router.push('/library/spus')">前往 SPU 列表查看</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { createSpuApi, type SkuItem } from '../../api/library'

// ================ 状态 ================
const step = ref(0)
const importing = ref(false)

// Step 1: 原始数据
const headers = ref<string[]>([])
const rawRows = ref<string[][]>([])

// Step 2: 字段映射
type Target = `spu:${string}` | `sku:${string}` | ''
type MappingRow = { header: string; sample: string; target: Target }
const mappingRows = ref<MappingRow[]>([])

const spuFields: { key: string; label: string; required?: boolean }[] = [
  { key: 'name', label: 'SPU 名称 (*必填)', required: true },
  { key: 'brandName', label: '品牌名称' },
  { key: 'specs', label: '规格 (*必填)', required: true },
  { key: 'unit', label: '单位' },
  { key: 'mainImage', label: '主图 URL' },
  { key: 'alcoholContent', label: '酒精度' },
  { key: 'origin', label: '产地' },
  { key: 'aromaType', label: '香型' },
  { key: 'description', label: '简介' },
]
const skuFields: { key: string; label: string; required?: boolean }[] = [
  { key: 'skuName', label: 'SKU 规格名称 (*必填)', required: true },
  { key: 'barcode', label: 'SKU 条码 (*必填)', required: true },
  { key: 'volume', label: '容量 (ml)' },
  { key: 'packaging', label: '包装形式' },
  { key: 'baseUnit', label: '基本单位 (瓶)' },
  { key: 'boxUnit', label: '箱单位 (箱)' },
  { key: 'boxRatio', label: '装箱比' },
  { key: 'suggestedRetailPrice', label: '建议零售价' },
]

// Step 3: 预览
const previewRows = ref<any[]>([])
const previewHeaders = ref<string[]>([])

// Step 4: 结果
const importResult = reactive({ total: 0, success: 0, failed: 0 })
const step4Errors: { rowNo: number; row: any; error: string }[] = []

// ================ Step 1: 上传 & 解析 CSV/TSV ================
async function handleFileChange(file: any) {
  const raw = file.raw as File
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
  const rows = parseCsvText(text, sep)
  if (!rows || rows.length < 2) {
    ElMessage.error('文件内容不足：至少需要 1 行表头 + 1 行数据')
    return
  }
  headers.value = rows[0].map((h) => String(h || '').trim())
  rawRows.value = rows.slice(0, 501) // 最多 500 行数据
  if (rows.length > 501) {
    ElMessage.warning('文件超过 500 行，仅处理前 500 行数据')
  }
  // 自动匹配映射
  autoMapHeaders()
  ElMessage.success(`成功读取 ${rawRows.value.length - 1} 行数据`)
}

function parseCsvText(text: string, sep: string): string[][] {
  // 处理带引号的 CSV（简单实现）
  const lines: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  // 去除 BOM
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

function downloadTemplate() {
  const sep = ','
  const head = ['SPU名称', '品牌名称', '规格', '单位', '主图URL', '酒精度', '产地', '香型', '简介',
               'SKU规格名称', 'SKU条码', '容量(ml)', '包装', '基本单位', '箱单位', '装箱比', '建议零售价']
  const sample1 = ['飞天茅台53度', '茅台', '500ml * 6瓶/箱', '瓶', 'https://.../mt.jpg', '53%vol', '贵州茅台镇', '酱香型', '经典酱香型白酒',
                   '单瓶装', '6902952880815', '500', '瓶装', '瓶', '箱', '6', '1499.00']
  const sample2 = ['五粮液52度', '五粮液', '500ml * 12瓶/箱', '瓶', '', '52%vol', '四川宜宾', '浓香型', '',
                   '单瓶装', '6901382202888', '500', '瓶装', '瓶', '箱', '12', '999.00']
  const csv = [head, sample1, sample2].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep)).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'SPU_SKU_Import_Template.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ================ Step 2: 映射 ================
function headerToTargetKey(h: string): Target {
  const norm = String(h).trim().toLowerCase()
  const spuMap: Record<string, string> = {
    'spu名称': 'name', '商品名称': 'name', '名称': 'name', 'spu name': 'name', 'name': 'name',
    '品牌名称': 'brandName', '品牌': 'brandName', 'brand': 'brandName', 'brandname': 'brandName',
    '规格': 'specs', 'spu规格': 'specs', 'spec': 'specs', 'specs': 'specs',
    '单位': 'unit', 'spu单位': 'unit', 'unit': 'unit',
    '主图url': 'mainImage', '主图': 'mainImage', '图片': 'mainImage', 'mainimage': 'mainImage',
    '酒精度': 'alcoholContent', '度数': 'alcoholContent', 'alcoholcontent': 'alcoholContent',
    '产地': 'origin', 'origin': 'origin',
    '香型': 'aromaType', 'aromatype': 'aromaType',
    '简介': 'description', '描述': 'description', 'description': 'description',
  }
  const skuMap: Record<string, string> = {
    'sku规格名称': 'skuName', 'sku名称': 'skuName', '规格名称': 'skuName', 'skuname': 'skuName',
    'sku条码': 'barcode', '条码': 'barcode', '条形码': 'barcode', 'barcode': 'barcode',
    '容量(ml)': 'volume', '容量': 'volume', 'volume': 'volume',
    '包装': 'packaging', '包装形式': 'packaging', 'packaging': 'packaging',
    '基本单位': 'baseUnit', 'baseunit': 'baseUnit',
    '箱单位': 'boxUnit', 'boxunit': 'boxUnit',
    '装箱比': 'boxRatio', 'boxratio': 'boxRatio',
    '建议零售价': 'suggestedRetailPrice', '零售价': 'suggestedRetailPrice', '价格': 'suggestedRetailPrice', 'suggestedretailprice': 'suggestedRetailPrice',
  }
  const key = Object.keys(spuMap).find((k) => norm.includes(k.replace(/\s/g, '')))
  if (key) return `spu:${spuMap[key]}`
  const key2 = Object.keys(skuMap).find((k) => norm.includes(k.replace(/\s/g, '')))
  if (key2) return `sku:${skuMap[key2]}`
  return ''
}

function autoMapHeaders() {
  mappingRows.value = headers.value.map((h, i) => ({
    header: h,
    sample: rawRows.value[1]?.[i] ?? '',
    target: headerToTargetKey(h),
  }))
}

const mappingValid = computed(() => {
  // SPU name, specs; SKU skuName, barcode 必须被映射
  const targets = new Set(mappingRows.value.map((m) => m.target))
  return targets.has('spu:name') && targets.has('spu:specs')
      && targets.has('sku:skuName') && targets.has('sku:barcode')
})

// ================ Step 3: 预览 + 校验 ================
type PreviewRow = {
  _rowNo: number
  _error?: string
  _errorFields?: string[]
  _spu?: any
  _sku?: Partial<SkuItem>
  [key: string]: any
}

const validRows = computed(() => previewRows.value.filter((r) => !r._error))
const invalidRows = computed(() => previewRows.value.filter((r) => r._error))

function buildPreview() {
  if (!mappingValid.value) {
    ElMessage.warning('请确保已映射必填字段：SPU名称、规格；SKU规格名称、SKU条码')
    return
  }
  const idxMap: Record<string, number> = {}  // target → column index
  mappingRows.value.forEach((m, i) => { if (m.target) idxMap[m.target] = i })

  const ph = mappingRows.value.filter((m) => m.target).map((m) => {
    const [scope, key] = m.target.split(':')
    const fields = scope === 'spu' ? spuFields : skuFields
    const f = fields.find((x) => x.key === key)
    return `${scope === 'spu' ? 'SPU-' : 'SKU-'}${f?.label ?? key}`
  })
  previewHeaders.value = ph

  const rows: PreviewRow[] = []
  for (let i = 1; i < rawRows.value.length; i++) {
    const raw = rawRows.value[i]
    const row: PreviewRow = { _rowNo: i }
    const spu: any = {}
    const sku: Partial<SkuItem> = {}
    // 映射 SPU 字段
    spuFields.forEach((f) => {
      const idx = idxMap[`spu:${f.key}`]
      if (idx !== undefined) {
        const val = String(raw[idx] ?? '').trim()
        spu[f.key] = val
        row[`SPU-${f.label}`] = val
      }
    })
    skuFields.forEach((f) => {
      const idx = idxMap[`sku:${f.key}`]
      if (idx !== undefined) {
        const val = String(raw[idx] ?? '').trim()
        ;(sku as any)[f.key] = val
        row[`SKU-${f.label}`] = val
      }
    })
    row._spu = spu
    row._sku = sku
    // 校验
    const errors: string[] = []
    const errFields: string[] = []
    if (!spu.name) { errors.push('SPU 名称为空'); errFields.push('SPU-SPU 名称 (*必填)') }
    if (!spu.specs) { errors.push('SPU 规格为空'); errFields.push('SPU-规格 (*必填)') }
    if (!sku.skuName) { errors.push('SKU 规格名称为空'); errFields.push('SKU-SKU 规格名称 (*必填)') }
    if (!sku.barcode) { errors.push('SKU 条码为空'); errFields.push('SKU-SKU 条码 (*必填)') }
    if (sku.barcode && !/^\d{6,14}$/.test(String(sku.barcode))) { errors.push(`SKU 条码格式异常: ${sku.barcode}`); errFields.push('SKU-SKU 条码 (*必填)') }
    if (errors.length) {
      row._error = errors.join('；')
      row._errorFields = errFields
    }
    rows.push(row)
  }
  previewRows.value = rows
  ElMessage.success(`校验完成：${rows.filter((r) => !r._error).length} 行有效，${rows.filter((r) => r._error).length} 行错误`)
  step.value = 2
}

function downloadErrorCsv() {
  const rows = invalidRows.value
  if (rows.length === 0) { ElMessage.info('无错误行'); return }
  const sep = ','
  const head = ['行号', ...previewHeaders.value, '错误原因']
  const lines = [head.join(sep)]
  rows.forEach((r) => {
    const vals = [String(r._rowNo), ...previewHeaders.value.map((h) => String(r[h] ?? '')), String(r._error ?? '')]
    lines.push(vals.map((v) => `"${v.replace(/"/g, '""')}"`).join(sep))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Import_Errors_${Date.now()}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const downloadErrorCsvStep4 = downloadErrorCsv

// ================ Step 4: 执行导入 ================
async function executeImport() {
  if (!importing.value && validRows.value.length === 0) return
  importing.value = true
  importResult.total = validRows.value.length
  importResult.success = 0
  importResult.failed = 0
  step4Errors.length = 0

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
      importResult.success++
    } catch (e: any) {
      importResult.failed++
      step4Errors.push({ rowNo: pr._rowNo, row: pr, error: e?.message || '导入失败' })
    }
  }
  importing.value = false
  step.value = 3
}

function resetAll() {
  step.value = 0
  rawRows.value = []
  headers.value = []
  mappingRows.value = []
  previewRows.value = []
  previewHeaders.value = []
  importResult.total = 0
  importResult.success = 0
  importResult.failed = 0
  step4Errors.length = 0
}
</script>
