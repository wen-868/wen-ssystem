<template>
  <div class="reviews-page">
    <!-- ════════ 页头（设计稿 v1.6 sec-goods Tab 5 审核队列，行 2397~2426） ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">审核队列</div>
        <p class="pd">
          AI 采集 + 供应商提交统一入队 · 通过即发布至租户检索侧 · 驳回必填模板化原因并回传提交方 · 更新于 2026-09-11 09:30
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="todo('导出待审清单（待立项：并入 T2 导出中心）')">导出待审清单</span>
        <!-- 批量通过走真实 PENDING 队列（① #20）；"置信度 ≥90% 快审"需 ai_confidence 列（C3 加列未落地）⇒ 当前按"当前页全部待审"执行 -->
        <span class="btn btn-p" @click="batchApprove">批量通过（当前页待审）</span>
      </div>
    </div>

    <!-- ════════ 待审核列表 ════════ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 5</span>审核队列 <span class="v16-tag lt">v1.6</span></span>
        <span class="ph-s">AI 采集 + 供应商提交统一入队 · 通过即发布至租户检索侧</span>
      </div>
      <div class="p-bd">
        <div class="frow" style="margin-bottom:10px">
          <span class="fld" style="width:160px">
            <span>来源</span>
            <span class="sel" @click="cycleSource">{{ sourceLabel }}<b class="caret">▾</b></span>
          </span>
          <span class="fld" style="width:170px">
            <span>类目</span>
            <span class="sel">全部类目<b class="caret">▾</b></span>
          </span>
          <span class="fld" style="width:150px">
            <span>提交时间</span>
            <span class="sel">近 7 天<b class="caret">▾</b></span>
          </span>
          <input
            class="ipt"
            style="width:210px"
            v-model="keyword"
            @keyup.enter="fetchList"
            placeholder="搜索商品名称 / 条码"
          />
          <span class="btn" @click="fetchList">重置</span>
        </div>

        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>提交时间</th>
                <th>商品名称</th>
                <th>标准条码</th>
                <th>类目</th>
                <th>来源</th>
                <th class="num">AI 置信度</th>
                <th>提交方</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.id">
                <td>{{ r.submitTime }}</td>
                <td><b>{{ r.name }}</b></td>
                <td>{{ r.barcode }}</td>
                <td>{{ r.category }}</td>
                <td><span class="v11-src" :class="r.srcCls">{{ r.source }}</span></td>
                <td class="num">{{ r.confidence ?? '—' }}</td>
                <td>{{ r.submitter }}</td>
                <td>
                  <span class="btn-t" @click="openDetail(r)">查看</span>
                  <span class="btn-t" style="color:var(--color-success);font-weight:600" @click="handleApprove(r)">通过</span>
                  <span class="btn-t dgr" @click="openReject(r)">驳回</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- ③-a #30 整改：该页**已在**调用 listSpusApi({status:'PENDING'})，端点存在 ⇒ 空态只表达"无数据"，
             不再写端点路径（前端不充当契约文档）；生产 t_library_spu=113 行，空态只代表当期无待审记录 -->
        <div v-if="rows.length === 0" class="empty">暂无待审核商品 · 审核数据来自商品库 PENDING 队列</div>

        <div class="pagebar">
          <span>共 {{ total }} 条 · 每页 {{ pageSize }} 条 · 数据源：商品库 status=PENDING</span>
          <div class="pgbtns">
            <span :class="{ on: page === 1 }" @click="goPage(page - 1)">‹</span>
            <span
              v-for="p in pageNums"
              :key="p"
              :class="{ on: p === page }"
              @click="goPage(p)"
            >{{ p }}</span>
            <span :class="{ on: page === pageCount }" @click="goPage(page + 1)">›</span>
          </div>
        </div>

        <div class="tipbar mt8" style="padding:8px 11px">
          <span class="ic">i</span>
          <span>审核规则：<b>AI 置信度 ≥90%</b> 可批量快审，&lt;90% 逐条人工核验；供应商提交先过<b>入驻资质校验</b>；驳回必填模板化原因（条码无法核验 / 图片不合规 / 类目挂载错误 / 与现有商品重复），驳回记录留痕并回传提交方。AI 采集 / 清洗任务消耗大模型用量，计入「版块05 AI 中心」计量链路 <span class="v16-tag lt">联动版块05</span></span>
        </div>
      </div>
    </div>

    <!-- ════════ 驳回原因弹窗（设计稿 v1.6 行 2508~2526，叠加弹层静态还原） ════════ -->
    <div v-if="rejectVisible" class="ov" @click.self="rejectVisible = false">
      <div class="modal">
        <div class="m-hd">
          <span class="pt">驳回原因 · {{ rejectingRow?.name || '—' }} <span class="v16-tag lt">v1.6</span></span>
          <span class="d-x" @click="rejectVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>来源</span>
              <span class="sel" style="justify-content:center">
                <span class="v11-src" :class="rejectingRow?.srcCls || 'cus'">{{ rejectingRow?.source || 'AI 采集' }}</span>
              </span>
            </span>
            <span class="fld" style="flex:1">
              <span>AI 置信度</span>
              <span class="ipt">{{ rejectingRow?.confidence ?? '—' }}</span>
            </span>
          </div>
          <div class="fld"><span>驳回原因（必选，可多选）<i class="req">*</i></span></div>
          <div class="reasons">
            <div
              v-for="(t, i) in rejectReasons"
              :key="t"
              class="reason-row"
              :class="{ sel: rejectChecked.includes(t) }"
              @click="toggleReason(t)"
            >
              <span class="tg" :class="{ off: !rejectChecked.includes(t) }"></span>{{ t }}
            </div>
          </div>
          <div class="fld">
            <span>补充说明（回传提交方）</span>
            <textarea
              v-model="rejectNote"
              class="ipt note-ipt"
              placeholder="主图第 3 张含水印，请替换后重新提交；规格请拆分单袋 / 整箱两个 SKU。"
            ></textarea>
          </div>
          <div class="tipbar" style="padding:8px 11px">
            <span class="ic">i</span>
            <span>驳回后商品退回来源方：AI 采集任务自动进入<b>复核队列</b>，供应商提交回传至供应商后台并短信通知。</span>
          </div>
        </div>
        <div class="m-ft">
          <span class="btn" @click="rejectVisible = false">取消</span>
          <span class="btn btn-d" @click="confirmReject">确认驳回</span>
        </div>
      </div>
    </div>

    <!-- ════════ 商品详情（③-a #31「查看」接线：GET /platform/library/spus/:id） ════════ -->
    <div v-if="detailVisible" class="ov" @click.self="detailVisible = false">
      <div class="modal">
        <div class="m-hd">
          <span class="pt">商品详情 · {{ detail?.name || '—' }}</span>
          <span class="d-x" @click="detailVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="frow">
            <span class="fld" style="flex:1"><span>SPU 编码</span><span class="ipt">{{ detail?.spuCode || '—' }}</span></span>
            <span class="fld" style="flex:1"><span>品牌</span><span class="ipt">{{ detail?.brandName || '—' }}</span></span>
            <span class="fld" style="flex:1"><span>规格 / 单位</span><span class="ipt">{{ detail?.specs || '—' }} / {{ detail?.unit || '—' }}</span></span>
            <span class="fld" style="flex:1"><span>状态</span><span class="ipt">{{ statusLabel(detail?.status) }}</span></span>
          </div>
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>SKU 规格</th>
                  <th>SKU 条码</th>
                  <th class="num">参考售价</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!detailSkus.length">
                  <td colspan="3" class="muted">{{ detailLoading ? '加载中…' : '暂无 SKU 明细' }}</td>
                </tr>
                <tr v-for="(k, i) in detailSkus" :key="i">
                  <td>{{ k.specs }}</td>
                  <td>{{ k.skuCode }}</td>
                  <td class="num">¥{{ k.price }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="tipbar" style="padding:8px 11px">
            <span class="ic">i</span>
            <span>字段取自 <b>GET /api/platform/library/spus/:id</b> 实时返回；取不到的以「—」显示，不做本地推算。审核流水（驳回原因留痕）待立项 T5。</span>
          </div>
        </div>
        <div class="m-ft">
          <span class="btn" @click="detailVisible = false">关闭</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 注：原 `reactive` 导入在本文件从未使用（TS noUnusedLocals 下会报错），随本卡一并清理
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listSpusApi, getSpuApi, approveSpuApi, rejectSpuApi,
  type SpuListItem,
} from '../../api/library'

/* ───────────────── 数据装载 ─────────────────
   审核数据源 = listSpusApi({status:'PENDING'})（后端真实端点，见 platform-library.routes.ts:14）；
   接口无数据/失败一律走空态，**不**用演示行兜底（禁模拟数据）。 */
interface ReviewRow {
  id: number
  submitTime: string
  name: string
  barcode: string
  category: string
  source: string
  srcCls: string
  confidence: string | null
  submitter: string
  raw?: SpuListItem
}

const loading = ref(false)
const saving = ref(false)
const rows = ref<ReviewRow[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
/* 搜索关键字（模板 v-model="keyword" 与 fetchList 入参均引用此变量） */
const keyword = ref('')

function sourceText(s: string) {
  return ({ MANUAL: '平台运营录入', IMPORT: '批量导入', OPEN_API: 'API' } as Record<string, string>)[s] || s || '—'
}
function formatTime(t: string) {
  return t ? t.replace('T', ' ').substring(5, 16) : '—'
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listSpusApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: 'PENDING',
    })
    const data = res.data || res
    const records: SpuListItem[] = data.records || data.list || []
    if (records.length > 0) {
      rows.value = records.map((r) => ({
        id: r.id,
        submitTime: formatTime(r.createdAt),
        name: r.name,
        barcode: '—',
        category: '—',
        source: sourceText(r.source),
        srcCls: 'cus',
        confidence: null,
        submitter: r.brandName || sourceText(r.source),
        raw: r,
      }))
      total.value = data.total || records.length
    } else {
      // 禁模拟数据：无数据走空态，不得用编造记录兜底
      rows.value = []
      total.value = 0
    }
  } catch {
    // 禁模拟数据：接口失败同样走空态
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/* ───────────────── 筛选器（功能性循环下拉） ───────────────── */
const sourceCycle = computed(() => [`全部（${total.value}）`, 'AI 采集', '供应商提交'])
const sourceIdx = ref(0)
const sourceLabel = computed(() => sourceCycle.value[sourceIdx.value])
function cycleSource() {
  sourceIdx.value = (sourceIdx.value + 1) % sourceCycle.value.length
}

/* ───────────────── 分页 ───────────────── */
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pageNums = computed(() => {
  const n = pageCount.value
  const cur = page.value
  const set = new Set<number>([1, n, cur, cur - 1, cur + 1].filter((x) => x >= 1 && x <= n))
  return Array.from(set).sort((a, b) => a - b)
})
function goPage(p: number) {
  if (p < 1 || p > pageCount.value || p === page.value) return
  page.value = p
  fetchList()
}

/* ───────────────── 通过 / 批量通过（保留原业务） ───────────────── */
async function handleApprove(r: ReviewRow) {
  if (!r.raw) { ElMessage.warning('该行缺少商品 ID，无法通过'); return }
  try {
    await ElMessageBox.confirm(`确定通过『${r.name}』的审核？`, '确认通过', { type: 'success' })
  } catch { return }
  saving.value = true
  try {
    await approveSpuApi(r.raw.id)
    ElMessage.success('已通过审核')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function batchApprove() {
  const apiRows = rows.value.filter((r) => r.raw)
  if (apiRows.length === 0) { ElMessage.warning('当前页没有可批量通过的商品'); return }
  try {
    await ElMessageBox.confirm(
      `确定批量通过当前页的 ${apiRows.length} 条商品审核吗？此操作不可撤销。`,
      '批量确认通过',
      { type: 'warning', confirmButtonText: '全部通过' },
    )
  } catch { return }
  saving.value = true
  let success = 0
  let failed = 0
  for (const r of apiRows) {
    try {
      await approveSpuApi(r.raw!.id)
      success++
    } catch { failed++ }
  }
  saving.value = false
  ElMessage.success(`批量通过完成：成功 ${success} 条，失败 ${failed} 条`)
  fetchList()
}

/* ───────────────── 驳回原因弹窗（设计稿行 2508~2526） ───────────────── */
const rejectVisible = ref(false)
const rejectingRow = ref<ReviewRow | null>(null)
const rejectNote = ref('')
const rejectChecked = ref<string[]>([])
const rejectReasons = [
  '条码无法核验（GS1 库无匹配）',
  '图片不合规（含水印 / 分辨率不足）',
  '类目挂载错误',
  '与现有商品重复（疑似 6902766500011 变体）',
]

function openReject(r: ReviewRow) {
  rejectingRow.value = r
  rejectNote.value = ''
  rejectChecked.value = []
  rejectVisible.value = true
}
function toggleReason(t: string) {
  const i = rejectChecked.value.indexOf(t)
  if (i >= 0) rejectChecked.value.splice(i, 1)
  else rejectChecked.value.push(t)
}

async function confirmReject() {
  if (rejectChecked.value.length === 0) {
    ElMessage.warning('请选择驳回原因')
    return
  }
  const reason = rejectChecked.value.join('；') + (rejectNote.value.trim() ? '；' + rejectNote.value.trim() : '')
  if (!rejectingRow.value?.raw) {
    ElMessage.warning('该行缺少商品 ID，无法驳回')
    return
  }
  saving.value = true
  try {
    await rejectSpuApi(rejectingRow.value.raw.id, { reason })
    ElMessage.success('已提交驳回')
    rejectVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

/* ───────────────── ③-a #31：查看改为既有点位详情（GET /spus/:id） ───────────────── */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)
const detailSkus = ref<any[]>([])
const SPU_STATUS_LABEL: Record<string, string> = {
  APPROVED: '已发布', PENDING: '审核中', REJECTED: '已拒绝', OFFLINE: '已下架',
}
function statusLabel(s?: string) {
  return SPU_STATUS_LABEL[s || ''] || s || '—'
}
async function openDetail(r: ReviewRow) {
  const id = r.raw?.id
  if (!id) {
    ElMessage.warning('该行缺少商品 ID，无法查看详情')
    return
  }
  detail.value = null
  detailSkus.value = []
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res: any = await getSpuApi(id)
    const data: any = res?.data || res
    detail.value = data || null
    detailSkus.value = (data?.skus || []).map((k: any) => ({
      specs: [k.volume, k.packaging].filter(Boolean).join(' ') || k.skuName || '—',
      skuCode: k.skuCode || k.barcode || '—',
      price: k.suggestedRetailPrice ?? '—',
    }))
  } catch (e: any) {
    ElMessage.error(e?.message || '商品详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

/** 未接入操作的诚实提示：不写"接口待接入"（避免掩盖"后端已有能力"） */
function todo(action: string) {
  ElMessage.warning(`${action}：尚未接入（不产生任何数据变更）`)
}

onMounted(fetchList)
</script>

<style scoped>
.reviews-page { color: var(--ink); }

/* 功能性下拉箭头（.sel 内联箭头补充） */
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  font-style: normal;
  font-weight: var(--font-normal);
  margin-left: auto;
}

/* 数据来源标签（设计稿 .v11-src，components.css 未移植，按令牌实现） */
.v11-src {
  display: inline-flex;
  align-items: center;
  gap: var(--tag-gap);
  font-size: var(--tag-font-size);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.v11-src.pub { background: var(--g1); color: var(--g5); }
.v11-src.cus { background: var(--color-primary-bg); border: 1px solid var(--color-primary-soft); color: var(--color-primary-hover); font-weight: var(--font-medium); }

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

/* 驳回原因选项行（设计稿 行 2516~2521：描边圆角行 + 开关） */
.reasons {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.reason-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  border: 1px solid var(--g2);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}
.reason-row.sel {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
}

/* 补充说明多行输入 */
.note-ipt {
  width: 100%;
  min-height: calc(var(--space-8) + var(--space-3));
  resize: vertical;
  font-family: inherit;
}

/* 弹窗（设计稿 .ov / .modal / .m-hd / .m-bd / .m-ft / .d-x，按令牌实现） */
.ov { position: fixed; inset: 0; background: var(--overlay-bg); z-index: 30; }
.modal {
  position: fixed; z-index: 31; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: var(--modal-width); max-width: 92%; max-height: 88%;
  background: var(--bg-card); border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow); display: flex; flex-direction: column; overflow: hidden;
}
.m-hd { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--g2); flex: none; }
.m-hd .pt { font-size: var(--text-md); font-weight: var(--font-bold); }
.d-x { color: var(--g4); font-size: var(--text-lg); line-height: 1; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; }
.d-x:hover { background: var(--g0); color: var(--g6); }
.m-bd { padding: var(--space-4); overflow-y: auto; display: grid; gap: var(--space-3); }
.m-ft { border-top: 1px solid var(--g2); padding: var(--space-3) var(--space-4); display: flex; justify-content: flex-end; gap: var(--space-2); background: var(--g0); flex: none; }

/* 必填星标 */
.req { color: var(--color-danger); font-style: normal; }
</style>
