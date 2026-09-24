<template>
  <!-- ═══════════════════════════════════════════════════════════════
       05 AI 中心 · 用量监控（设计稿 v1.6 #sec-ai · 行 1092~1153，Tab ⑤⑥）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       消耗趋势 / KPI 复用现有 api/ai-config.getAiUsage；
       逐次计量流水 = GET /api/platform/ai/metering-log、异常用量租户 = GET /api/platform/ai/abnormal-tenants、
       模型消耗占比 = GET /api/platform/ai/model-share（三条均为 C5-1 提供的平台级只读接口，路径由凌舟钉死、逐字照用）。
       租户消耗排行：后端无平台级端点（能力在 AI 网关侧）⇒ 保持空态并具名说明，不造假数据。
       零假数据：接口无值/字段缺失一律渲染「—」，不得补 0、不得造日期。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="ai-usage">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">用量监控</div>
        <p class="pd">AI 网关逐次计量 · 单次会话可追溯 · 日志留存 ≥90 天 · 全平台消耗与租户排行实时看板</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="notSupported('导出用量报表', UNSUPPORTED.EXPORT_USAGE)">导出报表</span>
      </div>
    </div>

    <!-- ════════ 子页签 ════════ -->
    <div class="tabs">
      <span class="tab" :class="{ on: usageTab === 'metering' }" @click="usageTab = 'metering'">⑤ 计量流水</span>
      <span class="tab" :class="{ on: usageTab === 'dashboard' }" @click="usageTab = 'dashboard'">⑥ 用量看板</span>
    </div>

    <!-- ════════ Tab 计量流水（行 1092~1110） ════════ -->
    <div v-show="usageTab === 'metering'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 5</span>计量流水 · AI 网关逐次计量</span>
          <div class="frow">
            <span class="sel">租户：全部 <span class="caret">▾</span></span>
            <span class="sel">模型：全部 <span class="caret">▾</span></span>
            <span class="sel">状态：全部 <span class="caret">▾</span></span>
            <span class="btn" @click="notSupported('导出对账', UNSUPPORTED.EXPORT_METERING)">导出对账</span>
          </div>
        </div>
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>时间</th>
                <th>租户</th>
                <th>功能场景</th>
                <th>模型</th>
                <th>扣减来源 <span class="ver-tag" style="margin-left:2px">v1.2</span></th>
                <th class="num">输入 Token</th>
                <th class="num">输出 Token</th>
                <th class="num">费用（含倍率）</th>
                <th>调用状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in metering" :key="m.id">
                <td>{{ m.time }}</td>
                <td><b>{{ m.tenant }}</b> <span class="small">{{ m.plan }}</span></td>
                <td>{{ m.scene }}</td>
                <td>{{ m.model }} <span class="tag tag-b" v-if="m.modelType !== '—'">{{ m.modelType }}</span></td>
                <td><span class="tag" :class="m.sourceClass">{{ m.source }}</span></td>
                <td class="num">{{ m.inTokens }}</td>
                <td class="num">{{ m.outTokens }}</td>
                <td class="num">{{ m.cost }}</td>
                <td><span class="tag" :class="m.statusClass">{{ m.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-if="meteringLoading">计量流水加载中…</div>
        <div class="empty" v-else-if="meteringError">
          计量流水加载失败：{{ meteringError }}
          <span class="lk" @click="loadMetering">重试</span>
        </div>
        <div class="empty" v-else-if="metering.length === 0">暂无计量流水（接口返回为空）</div>
        <div class="pagebar" v-if="metering.length">
          <span>共 {{ meteringTotalText }} 条 · 每页 {{ meteringPageSize }} 条 · 单次会话可追溯 · 日志留存 ≥90 天 · <span class="ver-tag" style="margin-left:2px">v1.2</span> 扣减来源：套餐含量 / 额度包 / 积分抵扣 / 超额计费</span>
          <div class="pgbtns">
            <span @click="changeMeteringPage(-1)">‹</span>
            <span class="on">{{ meteringPage }}</span>
            <span @click="changeMeteringPage(1)">›</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════ Tab 用量看板（行 1111~1153） ════════ -->
    <div v-show="usageTab === 'dashboard'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 6</span>用量看板</span>
          <span class="sel">本月 <span class="caret">▾</span></span>
        </div>
        <div class="p-bd" style="display:grid;grid-template-columns:1.6fr 1fr;gap:16px">
          <!-- 左：趋势 + KPI -->
          <div style="min-width:0">
            <p class="b" style="font-size:12px;margin-bottom:6px">全平台消耗趋势（日消耗金额）</p>
            <div class="chart-box" v-if="chartGeo">
              <svg class="chart" viewBox="0 0 560 150" role="img" aria-label="全平台日消耗金额趋势">
                <defs>
                  <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" :style="{ stopColor: 'var(--chart-1)', stopOpacity: 0.25 }" />
                    <stop offset="1" :style="{ stopColor: 'var(--chart-1)', stopOpacity: 0 }" />
                  </linearGradient>
                </defs>
                <g :stroke="'var(--g1)'">
                  <line x1="30" y1="15" x2="545" y2="15" />
                  <line x1="30" y1="45" x2="545" y2="45" />
                  <line x1="30" y1="75" x2="545" y2="75" />
                  <line x1="30" y1="105" x2="545" y2="105" />
                  <line x1="30" y1="135" x2="545" y2="135" />
                </g>
                <path :d="chartGeo.area" :style="{ fill: 'url(#gb)' }" />
                <polyline :points="chartGeo.line" fill="none" :style="{ stroke: 'var(--chart-1)' }" stroke-width="2.5" stroke-linejoin="round" />
                <g :fill="'var(--g4)'" font-size="9" text-anchor="middle">
                  <text :x="chartGeo.x0" y="148">{{ chartGeo.firstDate }}</text>
                  <text x="270" y="148">{{ chartGeo.midDate }}</text>
                  <text :x="chartGeo.x1" y="148">{{ chartGeo.lastDate }}</text>
                </g>
              </svg>
            </div>
            <div class="empty" v-else>暂无消耗趋势数据</div>
            <div class="g3 mt10">
              <div class="kpi" style="padding:10px">
                <div class="kt">本月消耗总额</div>
                <div class="kv" style="font-size:16px">{{ money(summary.totalCost) }}</div>
              </div>
              <div class="kpi" style="padding:10px">
                <div class="kt">总调用次数</div>
                <div class="kv" style="font-size:16px">{{ formatNumber(summary.chatCount) }}</div>
              </div>
              <div class="kpi" style="padding:10px">
                <div class="kt">异常用量租户</div>
                <div class="kv" style="font-size:16px;color:var(--color-warning)">{{ abnormalCount }}</div>
                <div class="kd" v-if="abnormalError">
                  加载失败：{{ abnormalError }} <span class="lk" @click="loadAbnormal">重试</span>
                </div>
                <div class="kd" v-else>{{ abnormalHint }}</div>
              </div>
            </div>
          </div>

          <!-- 右：排行 + 占比 -->
          <div style="min-width:0">
            <p class="b" style="font-size:12px;margin-bottom:6px">TOP5 租户消耗排行</p>
            <div v-if="tenantRank.length">
              <div class="qrow" v-for="r in tenantRank" :key="r.tenant">
                <span style="width:104px">{{ r.tenant }}</span>
                <span class="bar"><i :style="{ width: r.pct + '%' }"></i></span>
                <em>{{ r.amount }}</em>
              </div>
            </div>
            <div class="empty" v-else>
              租户消耗排行未接入（后端暂无平台级端点，该能力在 AI 网关侧，另行派单）· 数据源缺失，不展示任何示例排行
            </div>

            <p class="b" style="font-size:12px;margin:14px 0 6px">模型消耗占比</p>
            <div v-if="modelShare.length">
              <div class="qrow" v-for="r in modelShare" :key="r.model">
                <span style="width:104px">{{ r.model }}</span>
                <span class="bar" v-if="r.pct != null"><i :style="{ width: r.pct + '%' }"></i></span>
                <span class="bar" v-else></span>
                <em>{{ r.pct == null ? '—' : r.pct + '%' }}</em>
              </div>
            </div>
            <div class="empty" v-else-if="modelShareLoading">模型消耗占比加载中…</div>
            <div class="empty" v-else-if="modelShareError">
              模型消耗占比加载失败：{{ modelShareError }}
              <span class="lk" @click="loadModelShare">重试</span>
            </div>
            <div class="empty" v-else>暂无模型消耗占比数据（接口返回为空）</div>

            <div class="points-share">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <b style="font-size:12px;color:var(--color-primary-active)">积分抵扣占比 <span class="ver-tag" style="margin-left:2px">v1.2</span></b>
                <span style="font-size:17px;font-weight:800;color:var(--color-warning)">—</span>
              </div>
              <p class="small" style="margin:3px 0 7px">消耗来源结构（本月 · 按 Token 量）</p>
              <!-- 零假数据：来源结构需后端按扣减来源聚合（本批 C5-1 只提供逐次明细 + 按模型聚合）⇒ 空态，不画示例比例 -->
              <div class="empty" style="padding:6px">消耗来源结构暂无数据源（需后端按扣减来源聚合，本批未提供）</div>
            </div>
            <p class="small mt10" style="border-top:1px dashed var(--g2);padding-top:8px">毛利校验：倍率加成后毛利率 — · 财务月度对账状态 —</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAiUsage, type UsageDailyItem, type UsageSummary } from '../../api/ai-config'
import {
  getPlatformAiMeteringLog,
  getPlatformAiAbnormalTenants,
  getPlatformAiModelShare,
} from '../../api'

const usageTab = ref<'metering' | 'dashboard'>('metering')
const loading = ref(false)
const dailyList = ref<UsageDailyItem[]>([])
const summary = reactive<UsageSummary>({ chatCount: 0, toolCallCount: 0, totalTokens: 0, totalCost: 0 })

/* ───────────────── 公共：信封解包 + 字段兼容读取（零假数据口径） ───────────────── */

/** 解包：api 实例成功时原样返回 AxiosResponse ⇒ 取 res.data.data（与 PlatformAiConfig/AiBillingConfig 同口径） */
function payloadOf(res: any): any {
  if (res == null) return null
  if (res.data != null && res.data.data != null) return res.data.data
  if (res.data != null) return res.data
  return res
}
/**
 * 兼容读取字段：C5-1 的 JSON 字段名尚未冻结进 docs/API接口文档.md ⇒ 同时接受 camelCase / snake_case，
 * 取不到返回 null（渲染为「—」），绝不造值（零假数据）。
 */
function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    const v = row?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}
function textOr(v: any): string {
  return v === undefined || v === null || v === '' ? '—' : String(v)
}
function numOr(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
/** 计数 / Token：无值一律「—」（不得补 0） */
function countText(v: any): string {
  const n = numOr(v)
  return n == null ? '—' : n.toLocaleString()
}
/** 费用：无值一律「—」；历史行 cost 为 NULL（C5-1 不回填）⇒ 不得显示 0、不得当 0 参与合计 */
function costText(v: any): string {
  const n = numOr(v)
  return n == null ? '—' : '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

/** 本批「不做」的页内动作：后端无该端点（不得前端导出当前页、不得造状态冒充）。具名原因逐条写清 */
const UNSUPPORTED = {
  EXPORT_USAGE: '后端未提供平台级用量报表导出接口（本批 C5 未含）',
  EXPORT_METERING: '后端未提供计量流水导出/对账接口（本批 C5 未含）',
} as const
function notSupported(label: string, reason: string) {
  ElMessage.warning(`${label}暂不可用：${reason}`)
}

/* ───────────────── Tab⑤ 计量流水：GET /api/platform/ai/metering-log ───────────────── */
interface MeteringRow {
  id: number
  time: string
  tenant: string
  plan: string
  scene: string
  model: string
  modelType: string
  source: string
  sourceClass: string
  inTokens: string
  outTokens: string
  cost: string
  status: string
  statusClass: string
}
const metering = ref<MeteringRow[]>([])
const meteringLoading = ref(false)
const meteringError = ref<string | null>(null)
const meteringPage = ref(1)
const meteringPageSize = 20
const meteringTotal = ref<number | null>(null)
const meteringTotalText = computed(() => (meteringTotal.value == null ? '—' : meteringTotal.value.toLocaleString()))

const DEDUCT_SOURCE_CLASS: Record<string, string> = {
  套餐含量: 'tag-b', 额度包: 'tag-b', 积分抵扣: 'tag-o', 超额计费: 'tag-o',
}
function meteringSourceClass(v: string): string {
  return DEDUCT_SOURCE_CLASS[v] ?? 'tag-b'
}
function meteringStatusClass(v: string): string {
  if (v === '—') return 'tag-gy'
  return /失败|错误|fail|error/i.test(v) ? 'tag-o' : 'tag-b'
}

async function loadMetering() {
  meteringLoading.value = true
  meteringError.value = null
  try {
    const res: any = await getPlatformAiMeteringLog({ page: meteringPage.value, pageSize: meteringPageSize })
    const d: any = payloadOf(res)
    const rows: any[] = Array.isArray(d) ? d : d?.records ?? d?.list ?? []
    metering.value = rows.map((r, i) => {
      const source = textOr(pick(r, ['deductSource', 'deduct_source', 'source']))
      const status = textOr(pick(r, ['statusText', 'status', 'success']))
      return {
        id: numOr(pick(r, ['id', 'logId', 'log_id'])) ?? i + 1,
        time: textOr(pick(r, ['time', 'createdAt', 'created_at', 'calledAt', 'called_at'])),
        tenant: textOr(pick(r, ['tenantName', 'tenant_name', 'tenantId', 'tenant_id'])),
        plan: textOr(pick(r, ['planType', 'plan_type', 'planName', 'plan_name', 'plan'])),
        scene: textOr(pick(r, ['scene', 'sceneName', 'scene_name', 'bizScene', 'biz_scene'])),
        model: textOr(pick(r, ['model', 'modelName', 'model_name'])),
        modelType: textOr(pick(r, ['modelType', 'model_type', 'provider'])),
        source,
        sourceClass: meteringSourceClass(source),
        inTokens: countText(pick(r, ['promptTokens', 'prompt_tokens', 'inputTokens', 'input_tokens'])),
        outTokens: countText(pick(r, ['completionTokens', 'completion_tokens', 'outputTokens', 'output_tokens'])),
        cost: costText(pick(r, ['cost', 'fee'])),
        status,
        statusClass: meteringStatusClass(status),
      }
    })
    meteringTotal.value = numOr(Array.isArray(d) ? null : d?.total)
  } catch (e: any) {
    // 失败态必须显式（页面与「空数据」可辨，且可重试）
    metering.value = []
    meteringTotal.value = null
    meteringError.value = e?.message ? String(e.message) : '请求失败'
  } finally {
    meteringLoading.value = false
  }
}

/** 翻页：后端未给 total 时以「本页是否满页」判断有无下一页（不臆造总页数） */
async function changeMeteringPage(delta: number) {
  const next = meteringPage.value + delta
  if (next < 1) return
  if (delta > 0) {
    const hasNext = meteringTotal.value != null
      ? meteringPage.value * meteringPageSize < meteringTotal.value
      : metering.value.length === meteringPageSize
    if (!hasNext) return
  }
  meteringPage.value = next
  await loadMetering()
}

/* ───────────────── 异常用量租户：GET /api/platform/ai/abnormal-tenants ───────────────── */
const abnormalCount = ref<string>('—')
const abnormalLoading = ref(false)
const abnormalError = ref<string | null>(null)
const abnormalThresholdSource = ref<string | null>(null)
const abnormalTenants = ref<string[]>([])

/** 阈值来源由后端给出（取自平台 AI 配置）；后端判 UNAVAILABLE ⇒ 不计算异常数，计数显「—」 */
const abnormalHint = computed(() => {
  if (abnormalLoading.value) return '加载中…'
  if (abnormalThresholdSource.value === 'UNAVAILABLE') return '阈值未配置（阈值取自平台 AI 配置）· 不出判定'
  if (abnormalTenants.value.length) return `异常租户：${abnormalTenants.value.join('、')}`
  if (abnormalThresholdSource.value) return `阈值来源：${abnormalThresholdSource.value}`
  return '阈值来源未返回'
})

async function loadAbnormal() {
  abnormalLoading.value = true
  abnormalError.value = null
  try {
    const res: any = await getPlatformAiAbnormalTenants()
    const d: any = payloadOf(res)
    const src = pick(d, ['thresholdSource', 'threshold_source'])
    abnormalThresholdSource.value = src == null ? null : String(src)
    const rows: any[] = Array.isArray(d) ? d : d?.records ?? d?.list ?? d?.tenants ?? []
    abnormalTenants.value = rows
      .map((r) => textOr(pick(r, ['tenantName', 'tenant_name', 'tenantId', 'tenant_id'])))
      .filter((v) => v !== '—')
      .slice(0, 5)
    abnormalCount.value = abnormalThresholdSource.value === 'UNAVAILABLE'
      ? '—'
      : countText(pick(d, ['abnormalTenantCount', 'count', 'abnormalCount', 'abnormal_count', 'total']))
  } catch (e: any) {
    abnormalCount.value = '—'
    abnormalThresholdSource.value = null
    abnormalTenants.value = []
    abnormalError.value = e?.message ? String(e.message) : '请求失败'
  } finally {
    abnormalLoading.value = false
  }
}

/* ───────────── 右侧：租户消耗排行（未接入，空态）/ 模型消耗占比 ───────────── */
/**
 * 租户消耗排行：后端无平台级端点（能力在 AI 网关侧 /api/admin/usage/tenants，跨仓且非本轮 4 条钉死路径）
 * ⇒ 本轮不接，保持空态并具名说明；**不得**用日聚合或示例值冒充。
 */
const tenantRank = ref<{ tenant: string; pct: number; amount: string }[]>([])

/** 模型消耗占比：GET /api/platform/ai/model-share（后端按 t_ai_audit_log 逐次明细 GROUP BY model，非日聚合） */
const modelShare = ref<{ model: string; pct: number | null }[]>([])
const modelShareLoading = ref(false)
const modelShareError = ref<string | null>(null)

async function loadModelShare() {
  modelShareLoading.value = true
  modelShareError.value = null
  try {
    const res: any = await getPlatformAiModelShare()
    const d: any = payloadOf(res)
    const rows: any[] = Array.isArray(d) ? d : d?.records ?? d?.list ?? []
    const values = rows.map((r) => numOr(pick(r, ['tokens', 'totalTokens', 'total_tokens', 'calls', 'count', 'cost', 'value'])))
    const sum = values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
    modelShare.value = rows.map((r, i) => {
      const pctRaw = numOr(pick(r, ['pct', 'percent', 'sharePercent', 'share_percent']))
      let pct = pctRaw
      if (pct == null) {
        const ratio = numOr(pick(r, ['ratio', 'share']))
        if (ratio != null) pct = ratio <= 1 ? ratio * 100 : ratio
        else if (sum > 0 && values[i] != null) pct = ((values[i] as number) / sum) * 100
      }
      return {
        model: textOr(pick(r, ['model', 'modelName', 'model_name', 'name'])),
        // 占比由接口返回值换算，取不到即「—」（不臆造比例）
        pct: pct == null ? null : Math.round(pct * 10) / 10,
      }
    })
  } catch (e: any) {
    modelShare.value = []
    modelShareError.value = e?.message ? String(e.message) : '请求失败'
  } finally {
    modelShareLoading.value = false
  }
}

function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString()
}
function money(n: number | null | undefined): string {
  return '¥' + Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** 由逐日消耗金额生成 SVG 面积图几何（设计稿 viewBox 0 0 560 150） */
const chartGeo = computed(() => {
  const rows = dailyList.value
  if (!rows.length) return null
  const costs = rows.map((r) => Number(r.totalCost ?? 0))
  const max = Math.max(1, ...costs)
  const padL = 30
  const padR = 15
  const top = 15
  const bottom = 135
  const w = 545 - padL
  const step = rows.length > 1 ? w / (rows.length - 1) : 0
  const pts = rows.map((r, i) => {
    const x = padL + i * step
    const y = bottom - (Number(r.totalCost ?? 0) / max) * (bottom - top)
    return { x, y }
  })
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `M${pts[0].x.toFixed(1)},${bottom} ` + line.replace(/ /g, ' L') + ` L${pts[pts.length - 1].x.toFixed(1)},${bottom} Z`
  return {
    line,
    area,
    x0: padL,
    x1: 545,
    firstDate: rows[0].statDate,
    midDate: rows[Math.floor(rows.length / 2)].statDate,
    lastDate: rows[rows.length - 1].statDate,
  }
})

async function fetchUsage() {
  loading.value = true
  try {
    const res = await getAiUsage({})
    dailyList.value = res.list ?? []
    if (res.summary) {
      summary.chatCount = res.summary.chatCount ?? 0
      summary.toolCallCount = res.summary.toolCallCount ?? 0
      summary.totalTokens = res.summary.totalTokens ?? 0
      summary.totalCost = res.summary.totalCost ?? 0
    }
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsage()
  loadMetering()
  loadAbnormal()
  loadModelShare()
})
</script>

<style scoped>
.ai-usage {
  /* 根容器作用域锚点 */
}
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  margin-left: auto;
}
.points-share {
  border: 1px dashed var(--color-primary-soft);
  background: var(--color-primary-bg);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  margin-top: 12px;
}
</style>
