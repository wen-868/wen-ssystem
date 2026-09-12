<template>
  <!-- ═══════════════════════════════════════════════════════════════
       05 AI 中心 · 用量监控（设计稿 v1.6 #sec-ai · 行 1092~1153，Tab ⑤⑥）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       消耗趋势 / KPI 复用现有 api/ai-config.getAiUsage；逐次计量流水暂无接口 → 空态 + TODO。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="ai-usage">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">用量监控</div>
        <p class="pd">AI 网关逐次计量 · 单次会话可追溯 · 日志留存 ≥90 天 · 全平台消耗与租户排行实时看板</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="todo('导出用量报表')">导出报表</span>
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
            <span class="btn" @click="todo('导出对账')">导出对账</span>
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
                <td>{{ m.model }} <span class="tag tag-b">{{ m.modelType }}</span></td>
                <td><span class="tag" :class="m.sourceClass">{{ m.source }}</span></td>
                <td class="num">{{ m.inTokens }}</td>
                <td class="num">{{ m.outTokens }}</td>
                <td class="num">{{ m.cost }}</td>
                <td><span class="tag" :class="m.statusClass">{{ m.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-if="metering.length === 0">暂无计量流水</div>
        <div class="pagebar">
          <span>实时流水 · 单次会话可追溯 · 日志留存 ≥90 天 · <span class="ver-tag" style="margin-left:2px">v1.2</span> 扣减来源：套餐含量 / 额度包 / 积分抵扣 / 超额计费</span>
          <div class="pgbtns">
            <span>‹</span><span class="on">1</span><span>2</span><span>3</span><span>…</span><span>›</span>
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
                <div class="kd">突增 ≥10 倍已告警</div>
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
            <div class="empty" v-else>暂无租户消耗排行数据</div>

            <p class="b" style="font-size:12px;margin:14px 0 6px">模型消耗占比</p>
            <div v-if="modelShare.length">
              <div class="qrow" v-for="r in modelShare" :key="r.model">
                <span style="width:104px">{{ r.model }}</span>
                <span class="bar"><i :style="{ width: r.pct + '%' }"></i></span>
                <em>{{ r.pct }}%</em>
              </div>
            </div>
            <div class="empty" v-else>暂无模型消耗占比数据</div>

            <div class="points-share">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <b style="font-size:12px;color:var(--color-primary-active)">积分抵扣占比 <span class="ver-tag" style="margin-left:2px">v1.2</span></b>
                <span style="font-size:17px;font-weight:800;color:var(--color-warning)">—</span>
              </div>
              <p class="small" style="margin:3px 0 7px">消耗来源结构（本月 · 按 Token 量）</p>
              <div class="qrow"><span style="width:64px">套餐含量</span><span class="bar"><i style="width:55%"></i></span><em>55%</em></div>
              <div class="qrow"><span style="width:64px">额度包</span><span class="bar"><i style="width:27%"></i></span><em>27%</em></div>
              <div class="qrow"><span style="width:64px">积分抵扣</span><span class="bar o"><i style="width:18%"></i></span><em style="color:var(--color-warning)"><b>18%</b></em></div>
              <div class="qrow"><span style="width:64px">超额计费</span><span class="bar"><i style="width:0%"></i></span><em>0%</em></div>
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

const usageTab = ref<'metering' | 'dashboard'>('metering')
const loading = ref(false)
const dailyList = ref<UsageDailyItem[]>([])
const summary = reactive<UsageSummary>({ chatCount: 0, toolCallCount: 0, totalTokens: 0, totalCost: 0 })

/** 计量流水：逐次计量暂无接口 → 空态 */
// TODO: 待接入 GET /platform/ai/metering-log —— AI 网关逐次计量（时间/租户/场景/模型/扣减来源/Token/费用/状态）
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

/** 异常用量租户数（设计稿示例 2，接口暂无 → 占位） */
// TODO: 待接入 GET /platform/ai/abnormal-tenants 异常用量租户计数
const abnormalCount = ref<string>('—')

/** 租户消耗排行 / 模型消耗占比：暂无接口 → 空态 */
// TODO: 待接入 GET /platform/ai/tenant-rank 与 GET /platform/ai/model-share
const tenantRank = ref<{ tenant: string; pct: number; amount: string }[]>([])
const modelShare = ref<{ model: string; pct: number }[]>([])

function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString()
}
function money(n: number | null | undefined): string {
  return '¥' + Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function todo(msg: string) {
  ElMessage.info(`${msg}（接口待接入）`)
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

onMounted(fetchUsage)
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
